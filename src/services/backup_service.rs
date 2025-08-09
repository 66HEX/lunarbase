use chrono::{DateTime, Duration, Utc};
use flate2::Compression;
use flate2::write::GzEncoder;
use std::io::Write;
use std::sync::Arc;
use tokio::fs;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::database::DatabasePool;
use crate::middleware::MetricsState;
use crate::services::S3Service;
use crate::services::configuration_manager::{ConfigurationAccess, ConfigurationManager};

#[derive(Clone)]
pub struct BackupService {
    db_pool: DatabasePool,
    s3_service: Option<Arc<S3Service>>,
    scheduler: Arc<JobScheduler>,
    config_manager: Arc<ConfigurationManager>,
    metrics_state: Option<Arc<MetricsState>>,
}

#[derive(Debug)]
pub struct BackupResult {
    pub backup_id: String,
    pub file_size: u64,
    pub s3_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub compression_ratio: Option<f64>,
}

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("S3 error: {0}")]
    S3Error(#[from] crate::services::S3ServiceError),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Scheduler error: {0}")]
    SchedulerError(String),
    #[error("Backup disabled")]
    BackupDisabled,
    #[error("Compression error: {0}")]
    CompressionError(String),
}

impl ConfigurationAccess for BackupService {
    fn config_manager(&self) -> &ConfigurationManager {
        &self.config_manager
    }
}

impl BackupService {
    pub async fn new(
        db_pool: DatabasePool,
        s3_service: Option<Arc<S3Service>>,
        config_manager: Arc<ConfigurationManager>,
        metrics_state: Option<Arc<MetricsState>>,
    ) -> Result<Self, BackupError> {
        let scheduler = JobScheduler::new()
            .await
            .map_err(|e| BackupError::SchedulerError(e.to_string()))?;

        let service = Self {
            db_pool,
            s3_service,
            scheduler: Arc::new(scheduler),
            config_manager,
            metrics_state,
        };

        // Initialize backup metrics to ensure they appear in Prometheus metrics endpoint
        if let Some(ref metrics) = service.metrics_state {
            // Initialize all backup metrics with 0 values
            let _ = metrics
                .increment_custom_metric(
                    "backup_operations_total",
                    "Total number of backup operations",
                )
                .await;
            let _ = metrics
                .increment_custom_metric("backup_failures_total", "Total number of backup failures")
                .await;
            let _ = metrics
                .increment_custom_metric(
                    "backup_cleanup_operations_total",
                    "Total number of backup cleanup operations",
                )
                .await;
            let _ = metrics
                .increment_custom_metric(
                    "backup_files_deleted_total",
                    "Total number of backup files deleted",
                )
                .await;

            // Reset all metrics back to 0 to initialize them properly
            if let Some(custom_metrics) = metrics
                .custom_metrics
                .read()
                .await
                .get("backup_operations_total")
                .cloned()
            {
                custom_metrics.reset();
            }
            if let Some(custom_metrics) = metrics
                .custom_metrics
                .read()
                .await
                .get("backup_failures_total")
                .cloned()
            {
                custom_metrics.reset();
            }
            if let Some(custom_metrics) = metrics
                .custom_metrics
                .read()
                .await
                .get("backup_cleanup_operations_total")
                .cloned()
            {
                custom_metrics.reset();
            }
            if let Some(custom_metrics) = metrics
                .custom_metrics
                .read()
                .await
                .get("backup_files_deleted_total")
                .cloned()
            {
                custom_metrics.reset();
            }
        }

        let backup_enabled = service.get_backup_enabled().await;
        if backup_enabled {
            service.setup_scheduled_backup().await?;
            let schedule = service.get_backup_schedule().await;
            info!("Backup service initialized with schedule: {}", schedule);
        } else {
            info!("Backup service initialized but disabled");
        }

        Ok(service)
    }

    async fn setup_scheduled_backup(&self) -> Result<(), BackupError> {
        let service_clone = self.clone();
        let schedule = self.get_backup_schedule().await;

        let job = Job::new_async(schedule.as_str(), move |_uuid, _l| {
            let service = service_clone.clone();
            Box::pin(async move {
                info!("Starting scheduled backup...");
                match service.create_backup().await {
                    Ok(result) => {
                        info!(
                            "Scheduled backup completed successfully. ID: {}, Size: {} bytes",
                            result.backup_id, result.file_size
                        );

                        // Run cleanup after successful backup
                        info!("Running backup cleanup...");
                        service.cleanup_old_backups(result.file_size).await;
                    }
                    Err(e) => {
                        error!("Scheduled backup failed: {}", e);
                    }
                }
            })
        })
        .map_err(|e| {
            error!("Failed to create backup job: {}", e);
            BackupError::SchedulerError(e.to_string())
        })?;

        self.scheduler.add(job).await.map_err(|e| {
            error!("Failed to add backup job to scheduler: {}", e);
            BackupError::SchedulerError(e.to_string())
        })?;

        self.scheduler.start().await.map_err(|e| {
            error!("Failed to start backup scheduler: {}", e);
            BackupError::SchedulerError(e.to_string())
        })?;

        Ok(())
    }

    pub async fn create_backup(&self) -> Result<BackupResult, BackupError> {
        let backup_enabled = self.get_backup_enabled().await;
        if !backup_enabled {
            return Err(BackupError::BackupDisabled);
        }

        let backup_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();
        let backup_prefix = self.get_backup_prefix().await;
        let compression_enabled = self.get_backup_compression().await;
        let filename = format!(
            "{}-{}.sqlite{}",
            backup_prefix,
            timestamp.format("%Y%m%d_%H%M%S"),
            if compression_enabled { ".gz" } else { "" }
        );

        info!("Creating backup with ID: {}", backup_id);

        // Create database backup using SQLCipher VACUUM INTO
        let temp_backup_path = format!("/tmp/backup_{}.db", backup_id);
        self.create_database_backup(&temp_backup_path).await?;

        // Read the backup file
        let backup_data = fs::read(&temp_backup_path).await?;
        let _original_size = backup_data.len() as u64;

        // Compress if enabled
        let (final_data, compression_ratio) = if compression_enabled {
            let compressed = self.compress_data(&backup_data)?;
            let ratio = compressed.len() as f64 / backup_data.len() as f64;
            (compressed, Some(ratio))
        } else {
            (backup_data, None)
        };

        let file_size = final_data.len() as u64;

        // Upload to S3 if available
        let s3_url = if let Some(s3_service) = &self.s3_service {
            let s3_key = format!("backups/{}", filename);
            match s3_service
                .upload_file_with_key(
                    final_data,
                    s3_key,
                    filename.clone(),
                    "application/octet-stream".to_string(),
                )
                .await
            {
                Ok(upload_result) => {
                    info!("Backup uploaded to S3: {}", upload_result.file_url);

                    // Log backup success metric
                    if let Some(ref metrics) = self.metrics_state {
                        if let Err(e) = metrics
                            .increment_custom_metric(
                                "backup_operations_total",
                                "Total number of backup operations",
                            )
                            .await
                        {
                            warn!("Failed to update backup metrics: {}", e);
                        }
                    }

                    Some(upload_result.file_url)
                }
                Err(e) => {
                    error!("Failed to upload backup to S3: {}", e);

                    // Log backup failure metric
                    if let Some(ref metrics) = self.metrics_state {
                        if let Err(e) = metrics
                            .increment_custom_metric(
                                "backup_failures_total",
                                "Total number of backup failures",
                            )
                            .await
                        {
                            warn!("Failed to update backup failure metrics: {}", e);
                        }
                    }

                    None
                }
            }
        } else {
            warn!("S3 service not available, backup not uploaded");
            None
        };

        // Clean up temporary file
        if let Err(e) = fs::remove_file(&temp_backup_path).await {
            warn!("Failed to remove temporary backup file: {}", e);
        }

        // Clean up old backups only if new backup was successfully uploaded
        if s3_url.is_some() {
            self.cleanup_old_backups(file_size).await;
        }

        Ok(BackupResult {
            backup_id,
            file_size,
            s3_url,
            created_at: timestamp,
            compression_ratio,
        })
    }

    async fn create_database_backup(&self, backup_path: &str) -> Result<(), BackupError> {
        use diesel::prelude::*;
        use diesel::sql_query;

        let mut conn = self
            .db_pool
            .get()
            .map_err(|e| BackupError::DatabaseError(e.to_string()))?;

        // Use SQLCipher's VACUUM INTO for atomic backup
        let query = format!("VACUUM INTO '{}'", backup_path);
        sql_query(query)
            .execute(&mut conn)
            .map_err(|e| BackupError::DatabaseError(e.to_string()))?;

        info!("Database backup created at: {}", backup_path);
        Ok(())
    }

    fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>, BackupError> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder
            .write_all(data)
            .map_err(|e| BackupError::CompressionError(e.to_string()))?;
        encoder
            .finish()
            .map_err(|e| BackupError::CompressionError(e.to_string()))
    }

    async fn cleanup_old_backups(&self, new_backup_size: u64) {
        let s3_service = match &self.s3_service {
            Some(service) => service,
            None => {
                warn!("S3 service not available, skipping backup cleanup");
                return;
            }
        };

        let min_backup_size_bytes = self.get_backup_min_size_bytes().await;
        let retention_days = self.get_backup_retention_days().await;
        let backup_prefix_config = self.get_backup_prefix().await;

        // Check if new backup has a sensible size before cleaning up old backups
        // Skip size check if new_backup_size is 0 (manual cleanup)
        if new_backup_size > 0 && new_backup_size < min_backup_size_bytes {
            warn!(
                "New backup size ({} bytes) is below minimum threshold ({} bytes). Skipping cleanup to preserve old backups.",
                new_backup_size, min_backup_size_bytes
            );
            return;
        }

        info!(
            "Starting cleanup of backups older than {} days (new backup size: {} bytes)",
            retention_days, new_backup_size
        );

        // Calculate cutoff date
        let cutoff_date = Utc::now() - Duration::days(retention_days as i64);

        // List all backup objects with the backup prefix
        let backup_prefix = format!("backups/{}", backup_prefix_config);

        match s3_service.list_objects(&backup_prefix).await {
            Ok(objects) => {
                let mut deleted_count = 0;
                let mut error_count = 0;

                for object in objects {
                    // Check if the backup is older than retention period
                    if object.last_modified < cutoff_date {
                        info!(
                            "Deleting old backup: {} (created: {})",
                            object.key, object.last_modified
                        );

                        match s3_service.delete_object(&object.key).await {
                            Ok(_) => {
                                deleted_count += 1;
                                info!("Successfully deleted backup: {}", object.key);
                            }
                            Err(e) => {
                                error_count += 1;
                                error!("Failed to delete backup {}: {}", object.key, e);
                            }
                        }
                    } else {
                        info!(
                            "Keeping backup: {} (created: {})",
                            object.key, object.last_modified
                        );
                    }
                }

                info!(
                    "Backup cleanup completed. Deleted: {}, Errors: {}",
                    deleted_count, error_count
                );

                // Log cleanup metrics
                if let Some(ref metrics) = self.metrics_state {
                    if let Err(e) = metrics
                        .increment_custom_metric(
                            "backup_cleanup_operations_total",
                            "Total number of backup cleanup operations",
                        )
                        .await
                    {
                        warn!("Failed to update cleanup metrics: {}", e);
                    }

                    // Log deleted backups count as a custom metric
                    for _ in 0..deleted_count {
                        if let Err(e) = metrics
                            .increment_custom_metric(
                                "backup_files_deleted_total",
                                "Total number of backup files deleted",
                            )
                            .await
                        {
                            warn!("Failed to update deleted files metrics: {}", e);
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to list backup objects: {}", e);
            }
        }
    }

    pub async fn manual_backup(&self) -> Result<BackupResult, BackupError> {
        info!("Manual backup requested");
        let result = self.create_backup().await?;

        // Run cleanup after successful manual backup
        info!("Running backup cleanup after manual backup...");
        self.cleanup_old_backups(result.file_size).await;

        Ok(result)
    }

    /// Manually trigger cleanup of old backups
    pub async fn manual_cleanup(&self) {
        info!("Manual cleanup requested");
        // For manual cleanup, bypass size check by passing 0 (which will skip the check)
        self.cleanup_old_backups(0).await;
    }

    pub async fn health_check(&self) -> bool {
        let backup_enabled = self.get_backup_enabled().await;
        if !backup_enabled {
            return true; // Service is "healthy" when disabled
        }

        // Check if S3 service is available
        if let Some(s3_service) = &self.s3_service {
            s3_service.health_check().await.is_ok()
        } else {
            false
        }
    }

    pub async fn stop(&self) -> Result<(), BackupError> {
        // Note: JobScheduler doesn't support shutdown through Arc
        // The scheduler will be dropped when the service is dropped
        info!("Backup service stopped");
        Ok(())
    }
}

// Helper function to create backup service from config manager
pub async fn create_backup_service_from_config(
    db_pool: DatabasePool,
    s3_service: Option<Arc<S3Service>>,
    config_manager: Arc<ConfigurationManager>,
    metrics_state: Option<Arc<MetricsState>>,
) -> Result<Option<BackupService>, BackupError> {
    // Create a temporary service to check if backup is enabled
    let temp_service = BackupService {
        db_pool: db_pool.clone(),
        s3_service: s3_service.clone(),
        scheduler: Arc::new(
            JobScheduler::new()
                .await
                .map_err(|e| BackupError::SchedulerError(e.to_string()))?,
        ),
        config_manager: config_manager.clone(),
        metrics_state: metrics_state.clone(),
    };

    let backup_enabled = temp_service.get_backup_enabled().await;
    if !backup_enabled {
        info!("Backup service is disabled");
        return Ok(None);
    }

    if s3_service.is_none() {
        warn!("S3 service not configured, backup service will be disabled");
        return Ok(None);
    }

    let service = BackupService::new(db_pool, s3_service, config_manager, metrics_state).await?;
    Ok(Some(service))
}
