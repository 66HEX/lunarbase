use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;
use tracing::{debug, error};
use utoipa::ToSchema;

use crate::AppState;
use crate::services::BackupError;
use crate::utils::{ApiResponse, ErrorResponse};

#[derive(Debug, Serialize, ToSchema)]
pub struct BackupResponse {
    pub backup_id: String,
    pub file_size: u64,
    pub s3_url: Option<String>,
    pub created_at: String,
    pub compression_ratio: Option<f64>,
}

#[utoipa::path(
    post,
    path = "/admin/backup",
    tag = "Backup",
    responses(
        (status = 200, description = "Backup created successfully", body = ApiResponse<BackupResponse>),
        (status = 400, description = "Backup is disabled", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse),
        (status = 503, description = "S3 service unavailable", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_manual_backup(
    State(app_state): State<AppState>,
) -> Result<Json<ApiResponse<BackupResponse>>, (StatusCode, Json<ErrorResponse>)> {
    debug!("Manual backup requested");

    let backup_service = match &app_state.backup_service {
        Some(service) => service,
        None => {
            error!("Backup service is not configured or disabled");
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ErrorResponse {
                    success: false,
                    error: "Backup service is not available".to_string(),
                    details: Some("Backup service is not configured or disabled".to_string()),
                }),
            ));
        }
    };

    match backup_service.manual_backup().await {
        Ok(result) => {
            debug!(
                "Manual backup completed successfully. ID: {}, Size: {} bytes",
                result.backup_id, result.file_size
            );

            let response = BackupResponse {
                backup_id: result.backup_id,
                file_size: result.file_size,
                s3_url: result.s3_url,
                created_at: result.created_at.to_rfc3339(),
                compression_ratio: result.compression_ratio,
            };

            Ok(Json(ApiResponse {
                success: true,
                data: response,
                message: Some("Backup created successfully".to_string()),
            }))
        }
        Err(BackupError::BackupDisabled) => {
            error!("Backup is disabled in configuration");
            Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    success: false,
                    error: "Backup disabled".to_string(),
                    details: Some(
                        "Backup functionality is disabled in the system configuration".to_string(),
                    ),
                }),
            ))
        }
        Err(BackupError::S3Error(e)) => {
            error!("S3 error during backup: {}", e);
            Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(ErrorResponse {
                    success: false,
                    error: "S3 service error".to_string(),
                    details: Some(format!("Failed to upload backup to S3: {}", e)),
                }),
            ))
        }
        Err(BackupError::DatabaseError(e)) => {
            error!("Database error during backup: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    success: false,
                    error: "Database error".to_string(),
                    details: Some(format!("Failed to create database backup: {}", e)),
                }),
            ))
        }
        Err(BackupError::IoError(e)) => {
            error!("IO error during backup: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    success: false,
                    error: "IO error".to_string(),
                    details: Some(format!("File system error during backup: {}", e)),
                }),
            ))
        }
        Err(BackupError::CompressionError(e)) => {
            error!("Compression error during backup: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    success: false,
                    error: "Compression error".to_string(),
                    details: Some(format!("Failed to compress backup: {}", e)),
                }),
            ))
        }
        Err(e) => {
            error!("Unexpected error during backup: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    success: false,
                    error: "Internal server error".to_string(),
                    details: Some(format!("Unexpected error: {}", e)),
                }),
            ))
        }
    }
}

#[utoipa::path(
    get,
    path = "/admin/backup/health",
    tag = "Backup",
    responses(
        (status = 200, description = "Backup service health status", body = ApiResponse<bool>),
        (status = 503, description = "Backup service unavailable", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_backup_health(
    State(app_state): State<AppState>,
) -> Result<Json<ApiResponse<bool>>, (StatusCode, Json<ErrorResponse>)> {
    match &app_state.backup_service {
        Some(service) => {
            let is_healthy = service.health_check().await;
            Ok(Json(ApiResponse {
                success: true,
                data: is_healthy,
                message: Some(if is_healthy {
                    "Backup service is healthy".to_string()
                } else {
                    "Backup service is not healthy".to_string()
                }),
            }))
        }
        None => Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(ErrorResponse {
                success: false,
                error: "Backup service unavailable".to_string(),
                details: Some("Backup service is not configured or disabled".to_string()),
            }),
        )),
    }
}
