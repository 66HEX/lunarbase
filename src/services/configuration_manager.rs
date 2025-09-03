use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, warn};

use crate::models::system_setting::SystemSetting;
use crate::schema::system_settings;
use crate::utils::LunarbaseError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

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

    pub async fn initialize(&self) -> Result<(), LunarbaseError> {
        debug!("Initializing configuration manager...");
        self.reload_cache().await?;
        debug!("Configuration manager initialized successfully");
        Ok(())
    }

    pub async fn reload_cache(&self) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let settings = system_settings::table
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load system settings: {}", e);
                LunarbaseError::DatabaseError
            })?;

        let mut cache = self.cache.write().await;
        cache.clear();

        for setting in settings {
            let key = format!("{}:{}", setting.category, setting.setting_key);
            cache.insert(key, setting.setting_value);
        }

        debug!("Loaded {} settings into cache", cache.len());
        Ok(())
    }

    pub async fn get_string(&self, category: &str, key: &str) -> Option<String> {
        let cache_key = format!("{}:{}", category, key);
        let cache = self.cache.read().await;
        cache.get(&cache_key).cloned()
    }

    pub async fn get_i32(&self, category: &str, key: &str) -> Option<i32> {
        self.get_string(category, key)
            .await?
            .parse::<i32>()
            .map_err(|e| {
                warn!("Failed to parse setting {}:{} as i32: {}", category, key, e);
                e
            })
            .ok()
    }

    pub async fn get_u32(&self, category: &str, key: &str) -> Option<u32> {
        self.get_string(category, key)
            .await?
            .parse::<u32>()
            .map_err(|e| {
                warn!("Failed to parse setting {}:{} as u32: {}", category, key, e);
                e
            })
            .ok()
    }

    pub async fn get_bool(&self, category: &str, key: &str) -> Option<bool> {
        let value = self.get_string(category, key).await?;
        match value.to_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => Some(true),
            "false" | "0" | "no" | "off" => Some(false),
            _ => {
                warn!(
                    "Invalid boolean value for setting {}:{}: {}",
                    category, key, value
                );
                None
            }
        }
    }

    pub async fn get_json(&self, category: &str, key: &str) -> Option<Value> {
        let value = self.get_string(category, key).await?;
        serde_json::from_str(&value)
            .map_err(|e| {
                warn!(
                    "Failed to parse setting {}:{} as JSON: {}",
                    category, key, e
                );
                e
            })
            .ok()
    }

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

    pub async fn get_string_or_default(&self, category: &str, key: &str, default: &str) -> String {
        self.get_string(category, key).await.unwrap_or_else(|| {
            warn!(
                "Setting {}:{} not found, using default: {}",
                category, key, default
            );
            default.to_string()
        })
    }

    pub async fn get_i32_or_default(&self, category: &str, key: &str, default: i32) -> i32 {
        self.get_i32(category, key).await.unwrap_or_else(|| {
            warn!(
                "Setting {}:{} not found or invalid, using default: {}",
                category, key, default
            );
            default
        })
    }

    pub async fn get_u32_or_default(&self, category: &str, key: &str, default: u32) -> u32 {
        self.get_u32(category, key).await.unwrap_or_else(|| {
            warn!(
                "Setting {}:{} not found or invalid, using default: {}",
                category, key, default
            );
            default
        })
    }

    pub async fn get_bool_or_default(&self, category: &str, key: &str, default: bool) -> bool {
        self.get_bool(category, key).await.unwrap_or_else(|| {
            warn!(
                "Setting {}:{} not found or invalid, using default: {}",
                category, key, default
            );
            default
        })
    }

    pub async fn get_string_array_or_default(
        &self,
        category: &str,
        key: &str,
        default: Vec<String>,
    ) -> Vec<String> {
        self.get_string_array(category, key)
            .await
            .unwrap_or_else(|| {
                warn!(
                    "Setting {}:{} not found or invalid, using default: {:?}",
                    category, key, default
                );
                default
            })
    }

    pub async fn update_cache(&self, category: &str, key: &str, value: &str) {
        let cache_key = format!("{}:{}", category, key);
        let mut cache = self.cache.write().await;
        cache.insert(cache_key, value.to_string());
        debug!("Updated cache for setting {}:{}", category, key);
    }

    pub async fn remove_from_cache(&self, category: &str, key: &str) {
        let cache_key = format!("{}:{}", category, key);
        let mut cache = self.cache.write().await;
        cache.remove(&cache_key);
        debug!("Removed setting {}:{} from cache", category, key);
    }

    pub async fn get_all_cached(&self) -> HashMap<String, String> {
        let cache = self.cache.read().await;
        cache.clone()
    }

    pub async fn is_cache_empty(&self) -> bool {
        let cache = self.cache.read().await;
        cache.is_empty()
    }
}

pub trait ConfigurationAccess: Sync {
    fn config_manager(&self) -> &ConfigurationManager;

    fn get_jwt_lifetime_hours(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager()
                .get_i32_or_default("auth", "jwt_lifetime_hours", 24)
                .await
        }
    }

    fn get_lockout_duration_minutes(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager()
                .get_i32_or_default("auth", "lockout_duration_minutes", 15)
                .await
        }
    }

    fn get_max_login_attempts(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager()
                .get_i32_or_default("auth", "max_login_attempts", 5)
                .await
        }
    }

    fn get_rate_limit_requests_per_minute(&self) -> impl std::future::Future<Output = i32> + Send {
        async {
            self.config_manager()
                .get_i32_or_default("api", "rate_limit_requests_per_minute", 100)
                .await
        }
    }

    fn get_cors_allowed_origins(&self) -> impl std::future::Future<Output = Vec<String>> + Send {
        async {
            self.config_manager()
                .get_string_array_or_default(
                    "api",
                    "cors_allowed_origins",
                    vec![
                        "http://localhost:3000".to_string(),
                        "http://localhost:5173".to_string(),
                    ],
                )
                .await
        }
    }

    fn get_connection_pool_size(&self) -> impl std::future::Future<Output = u32> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("database", "connection_pool_size", 10)
                .await
        }
    }

    fn get_backup_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("database", "backup_enabled", false)
                .await
        }
    }

    fn get_backup_retention_days(&self) -> impl std::future::Future<Output = u32> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("database", "backup_retention_days", 30)
                .await
        }
    }

    fn get_backup_schedule(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default("database", "backup_schedule", "0 0 2 * * *")
                .await
        }
    }

    fn get_backup_compression(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("database", "backup_compression", true)
                .await
        }
    }

    fn get_backup_prefix(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default("database", "backup_prefix", "lunarbase-backup")
                .await
        }
    }

    fn get_backup_min_size_bytes(&self) -> impl std::future::Future<Output = u64> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("database", "backup_min_size_bytes", 1024)
                .await as u64
        }
    }

    fn get_compression_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("web_server", "compression_enabled", true)
                .await
        }
    }

    fn get_compression_level(&self) -> impl std::future::Future<Output = u8> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("web_server", "compression_level", 6)
                .await as u8
        }
    }

    fn get_compression_min_size(&self) -> impl std::future::Future<Output = usize> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("web_server", "compression_min_size", 1024)
                .await as usize
        }
    }

    fn get_compression_gzip(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("web_server", "compression_gzip", true)
                .await
        }
    }

    fn get_compression_brotli(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("web_server", "compression_brotli", true)
                .await
        }
    }

    fn get_compression_deflate(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("web_server", "compression_deflate", true)
                .await
        }
    }

    fn get_security_headers_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "enabled", true)
                .await
        }
    }

    fn get_hsts_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "hsts_enabled", true)
                .await
        }
    }

    fn get_hsts_max_age(&self) -> impl std::future::Future<Output = u32> + Send {
        async {
            self.config_manager()
                .get_u32_or_default("security_headers", "hsts_max_age", 31536000)
                .await
        }
    }

    fn get_hsts_include_subdomains(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "hsts_include_subdomains", true)
                .await
        }
    }

    fn get_hsts_preload(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "hsts_preload", false)
                .await
        }
    }

    fn get_csp_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "csp_enabled", true)
                .await
        }
    }

    fn get_csp_policy(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default("security_headers", "csp_policy", "default-src 'self'")
                .await
        }
    }

    fn get_csp_report_only(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "csp_report_only", false)
                .await
        }
    }

    fn get_frame_options_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "frame_options_enabled", true)
                .await
        }
    }

    fn get_frame_options_policy(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default("security_headers", "frame_options_policy", "DENY")
                .await
        }
    }

    fn get_content_type_options(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "content_type_options", true)
                .await
        }
    }

    fn get_xss_protection(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "xss_protection", true)
                .await
        }
    }

    fn get_referrer_policy_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "referrer_policy_enabled", true)
                .await
        }
    }

    fn get_referrer_policy(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default(
                    "security_headers",
                    "referrer_policy",
                    "strict-origin-when-cross-origin",
                )
                .await
        }
    }

    fn get_permissions_policy_enabled(&self) -> impl std::future::Future<Output = bool> + Send {
        async {
            self.config_manager()
                .get_bool_or_default("security_headers", "permissions_policy_enabled", true)
                .await
        }
    }

    fn get_permissions_policy(&self) -> impl std::future::Future<Output = String> + Send {
        async {
            self.config_manager()
                .get_string_or_default(
                    "security_headers",
                    "permissions_policy",
                    "camera=(), microphone=(), geolocation=(), payment=()",
                )
                .await
        }
    }
}
