use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::{error, info, warn};
use serde_json::Value;

use crate::models::system_setting::SystemSetting;
use crate::schema::system_settings;
use crate::utils::AuthError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

/// Configuration manager that loads and caches system settings from database
#[derive(Clone)]
pub struct ConfigurationManager {
    pool: DbPool,
    cache: Arc<RwLock<HashMap<String, String>>>,
}

impl ConfigurationManager {
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize the configuration manager by loading all settings from database
    pub async fn initialize(&self) -> Result<(), AuthError> {
        info!("Initializing configuration manager...");
        self.reload_cache().await?;
        info!("Configuration manager initialized successfully");
        Ok(())
    }

    /// Reload all settings from database into cache
    pub async fn reload_cache(&self) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;
        
        let settings = system_settings::table
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load system settings: {}", e);
                AuthError::DatabaseError
            })?;

        let mut cache = self.cache.write().await;
        cache.clear();
        
        for setting in settings {
            let key = format!("{}:{}", setting.category, setting.setting_key);
            cache.insert(key, setting.setting_value);
        }
        
        info!("Loaded {} settings into cache", cache.len());
        Ok(())
    }

    /// Get a setting value as string
    pub async fn get_string(&self, category: &str, key: &str) -> Option<String> {
        let cache_key = format!("{}:{}", category, key);
        let cache = self.cache.read().await;
        cache.get(&cache_key).cloned()
    }

    /// Get a setting value as integer
    pub async fn get_i32(&self, category: &str, key: &str) -> Option<i32> {
        self.get_string(category, key).await?
            .parse::<i32>()
            .map_err(|e| {
                warn!("Failed to parse setting {}:{} as i32: {}", category, key, e);
                e
            })
            .ok()
    }

    /// Get a setting value as unsigned integer
    pub async fn get_u32(&self, category: &str, key: &str) -> Option<u32> {
        self.get_string(category, key).await?
            .parse::<u32>()
            .map_err(|e| {
                warn!("Failed to parse setting {}:{} as u32: {}", category, key, e);
                e
            })
            .ok()
    }

    /// Get a setting value as boolean
    pub async fn get_bool(&self, category: &str, key: &str) -> Option<bool> {
        let value = self.get_string(category, key).await?;
        match value.to_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => Some(true),
            "false" | "0" | "no" | "off" => Some(false),
            _ => {
                warn!("Invalid boolean value for setting {}:{}: {}", category, key, value);
                None
            }
        }
    }

    /// Get a setting value as JSON
    pub async fn get_json(&self, category: &str, key: &str) -> Option<Value> {
        let value = self.get_string(category, key).await?;
        serde_json::from_str(&value)
            .map_err(|e| {
                warn!("Failed to parse setting {}:{} as JSON: {}", category, key, e);
                e
            })
            .ok()
    }

    /// Get a setting value as vector of strings (from JSON array)
    pub async fn get_string_array(&self, category: &str, key: &str) -> Option<Vec<String>> {
        let json_value = self.get_json(category, key).await?;
        if let Value::Array(arr) = json_value {
            let mut result = Vec::new();
            for item in arr {
                if let Value::String(s) = item {
                    result.push(s);
                } else {
                    warn!("Non-string value in array for setting {}:{}", category, key);
                    return None;
                }
            }
            Some(result)
        } else {
            warn!("Setting {}:{} is not a JSON array", category, key);
            None
        }
    }

    /// Get a setting value with fallback to default
    pub async fn get_string_or_default(&self, category: &str, key: &str, default: &str) -> String {
        self.get_string(category, key).await.unwrap_or_else(|| {
            warn!("Setting {}:{} not found, using default: {}", category, key, default);
            default.to_string()
        })
    }

    /// Get a setting value as i32 with fallback to default
    pub async fn get_i32_or_default(&self, category: &str, key: &str, default: i32) -> i32 {
        self.get_i32(category, key).await.unwrap_or_else(|| {
            warn!("Setting {}:{} not found or invalid, using default: {}", category, key, default);
            default
        })
    }

    /// Get a setting value as u32 with fallback to default
    pub async fn get_u32_or_default(&self, category: &str, key: &str, default: u32) -> u32 {
        self.get_u32(category, key).await.unwrap_or_else(|| {
            warn!("Setting {}:{} not found or invalid, using default: {}", category, key, default);
            default
        })
    }

    /// Get a setting value as bool with fallback to default
    pub async fn get_bool_or_default(&self, category: &str, key: &str, default: bool) -> bool {
        self.get_bool(category, key).await.unwrap_or_else(|| {
            warn!("Setting {}:{} not found or invalid, using default: {}", category, key, default);
            default
        })
    }

    /// Get a setting value as string array with fallback to default
    pub async fn get_string_array_or_default(&self, category: &str, key: &str, default: Vec<String>) -> Vec<String> {
        self.get_string_array(category, key).await.unwrap_or_else(|| {
            warn!("Setting {}:{} not found or invalid, using default: {:?}", category, key, default);
            default
        })
    }

    /// Update cache when a setting is changed
    pub async fn update_cache(&self, category: &str, key: &str, value: &str) {
        let cache_key = format!("{}:{}", category, key);
        let mut cache = self.cache.write().await;
        cache.insert(cache_key, value.to_string());
        info!("Updated cache for setting {}:{}", category, key);
    }

    /// Remove setting from cache
    pub async fn remove_from_cache(&self, category: &str, key: &str) {
        let cache_key = format!("{}:{}", category, key);
        let mut cache = self.cache.write().await;
        cache.remove(&cache_key);
        info!("Removed setting {}:{} from cache", category, key);
    }

    /// Get all cached settings (for debugging)
    pub async fn get_all_cached(&self) -> HashMap<String, String> {
        let cache = self.cache.read().await;
        cache.clone()
    }

    /// Check if cache is empty
    pub async fn is_cache_empty(&self) -> bool {
        let cache = self.cache.read().await;
        cache.is_empty()
    }
}

/// Helper trait to make configuration access easier
pub trait ConfigurationAccess: Sync {
    fn config_manager(&self) -> &ConfigurationManager;

    /// Get JWT lifetime in hours
    fn get_jwt_lifetime_hours(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager().get_i32_or_default("auth", "jwt_lifetime_hours", 24).await
        }
    }

    /// Get lockout duration in minutes
    fn get_lockout_duration_minutes(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager().get_i32_or_default("auth", "lockout_duration_minutes", 15).await
        }
    }

    /// Get max login attempts
    fn get_max_login_attempts(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager().get_i32_or_default("auth", "max_login_attempts", 5).await
        }
    }

    /// Get rate limit requests per minute
    fn get_rate_limit_requests_per_minute(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager().get_i32_or_default("api", "rate_limit_requests_per_minute", 100).await
        }
    }

    /// Get CORS allowed origins
    fn get_cors_allowed_origins(&self) -> impl std::future::Future<Output = Vec<String>> + Send {
        async {
            self.config_manager().get_string_array_or_default(
                "api", 
                "cors_allowed_origins", 
                vec!["http://localhost:3000".to_string(), "http://localhost:5173".to_string()]
            ).await
        }
    }

    /// Get database connection pool size
    fn get_connection_pool_size(&self) -> impl std::future::Future<Output = u32> + Send {
        async {
            self.config_manager().get_u32_or_default("database", "connection_pool_size", 10).await
        }
    }

    /// Get backup enabled flag
    fn get_backup_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager().get_bool_or_default("database", "backup_enabled", false).await
        }
    }

    /// Get backup retention in days
    fn get_backup_retention_days(&self) -> impl std::future::Future<Output = u32> + Send {
        async {
            self.config_manager().get_u32_or_default("database", "backup_retention_days", 30).await
        }
    }

    /// Get backup schedule (cron expression)
    fn get_backup_schedule(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager().get_string_or_default("database", "backup_schedule", "0 0 2 * * *").await
        }
    }

    /// Get backup compression enabled flag
    fn get_backup_compression(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager().get_bool_or_default("database", "backup_compression", true).await
        }
    }

    /// Get backup prefix
    fn get_backup_prefix(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager().get_string_or_default("database", "backup_prefix", "lunarbase-backup").await
        }
    }

    /// Get backup minimum size in bytes
    fn get_backup_min_size_bytes(&self) -> impl std::future::Future<Output = u64> + Send {
        async {
            self.config_manager().get_u32_or_default("database", "backup_min_size_bytes", 1024).await as u64
        }
    }
}