use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::{debug, error};

use crate::models::system_setting::{
    NewSystemSetting, SettingCategory, SettingDataType, SystemSetting, SystemSettingResponse,
    UpdateSystemSetting,
};
use crate::schema::system_settings;
use crate::utils::AuthError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct ConfigurationService {
    pub pool: DbPool,
}

impl ConfigurationService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Get all system settings
    pub async fn get_all_settings(&self) -> Result<Vec<SystemSettingResponse>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let settings = system_settings::table
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load system settings: {}", e);
                AuthError::DatabaseError
            })?;

        Ok(settings.into_iter().map(|s| s.into()).collect())
    }

    /// Get settings by category
    pub async fn get_settings_by_category(
        &self,
        category: &str,
    ) -> Result<Vec<SystemSettingResponse>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let settings = system_settings::table
            .filter(system_settings::category.eq(category))
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load settings for category {}: {}", category, e);
                AuthError::DatabaseError
            })?;

        Ok(settings.into_iter().map(|s| s.into()).collect())
    }

    /// Get a specific setting by category and key
    pub async fn get_setting(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<SystemSettingResponse>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let setting = system_settings::table
            .filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                error!("Failed to load setting {}:{}: {}", category, setting_key, e);
                AuthError::DatabaseError
            })?;

        Ok(setting.map(|s| s.into()))
    }

    /// Update a setting value
    pub async fn update_setting(
        &self,
        category: &str,
        setting_key: &str,
        new_value: &str,
        updated_by: Option<String>,
    ) -> Result<SystemSettingResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if setting exists
        let existing_setting = system_settings::table
            .filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                error!(
                    "Failed to check existing setting {}:{}: {}",
                    category, setting_key, e
                );
                AuthError::DatabaseError
            })?;

        if existing_setting.is_none() {
            return Err(AuthError::NotFound(format!(
                "Setting {}:{} not found",
                category, setting_key
            )));
        }

        // Update the setting
        let update_data = UpdateSystemSetting {
            setting_value: Some(new_value.to_string()),
            description: None,
            is_sensitive: None,
            requires_restart: None,
            updated_by,
        };

        diesel::update(
            system_settings::table.filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            ),
        )
        .set(&update_data)
        .execute(&mut conn)
        .map_err(|e| {
            error!(
                "Failed to update setting {}:{}: {}",
                category, setting_key, e
            );
            AuthError::DatabaseError
        })?;

        // Return updated setting
        let updated_setting = system_settings::table
            .filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .map_err(|e| {
                error!(
                    "Failed to load updated setting {}:{}: {}",
                    category, setting_key, e
                );
                AuthError::DatabaseError
            })?;

        debug!(
            "Setting updated: {}:{} = {}",
            category, setting_key, new_value
        );
        Ok(updated_setting.into())
    }

    /// Create a new setting
    pub async fn create_setting(
        &self,
        category: SettingCategory,
        setting_key: String,
        setting_value: String,
        data_type: SettingDataType,
        description: Option<String>,
        default_value: String,
        is_sensitive: bool,
        requires_restart: bool,
    ) -> Result<SystemSettingResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if setting already exists
        let existing = system_settings::table
            .filter(
                system_settings::category
                    .eq(category.to_string())
                    .and(system_settings::setting_key.eq(&setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                error!("Failed to check existing setting: {}", e);
                AuthError::DatabaseError
            })?;

        if existing.is_some() {
            return Err(AuthError::Conflict(format!(
                "Setting {}:{} already exists",
                category.to_string(),
                setting_key
            )));
        }

        let new_setting = NewSystemSetting::new(
            category,
            setting_key,
            setting_value,
            data_type,
            description,
            Some(default_value),
            is_sensitive,
            requires_restart,
            None, // updated_by
        );

        diesel::insert_into(system_settings::table)
            .values(&new_setting)
            .execute(&mut conn)
            .map_err(|e| {
                error!("Failed to create setting: {}", e);
                AuthError::DatabaseError
            })?;

        // Return the created setting
        let created_setting = system_settings::table
            .filter(
                system_settings::category
                    .eq(new_setting.category)
                    .and(system_settings::setting_key.eq(new_setting.setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .map_err(|e| {
                error!("Failed to load created setting: {}", e);
                AuthError::DatabaseError
            })?;

        debug!(
            "Setting created: {}:{}",
            created_setting.category, created_setting.setting_key
        );
        Ok(created_setting.into())
    }

    /// Delete a setting
    pub async fn delete_setting(&self, category: &str, setting_key: &str) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let deleted_count = diesel::delete(
            system_settings::table.filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            ),
        )
        .execute(&mut conn)
        .map_err(|e| {
            error!(
                "Failed to delete setting {}:{}: {}",
                category, setting_key, e
            );
            AuthError::DatabaseError
        })?;

        if deleted_count == 0 {
            return Err(AuthError::NotFound(format!(
                "Setting {}:{} not found",
                category, setting_key
            )));
        }

        debug!("Setting deleted: {}:{}", category, setting_key);
        Ok(())
    }

    /// Get setting value as string
    pub async fn get_setting_value(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<String>, AuthError> {
        let setting = self.get_setting(category, setting_key).await?;
        Ok(setting.map(|s| s.setting_value))
    }

    /// Get setting value as integer
    pub async fn get_setting_value_as_i32(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<i32>, AuthError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => v.parse::<i32>().map(Some).map_err(|_| {
                AuthError::ValidationError(vec![format!("Invalid integer value: {}", v)])
            }),
            None => Ok(None),
        }
    }

    /// Get setting value as boolean
    pub async fn get_setting_value_as_bool(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<bool>, AuthError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => match v.to_lowercase().as_str() {
                "true" | "1" | "yes" | "on" => Ok(Some(true)),
                "false" | "0" | "no" | "off" => Ok(Some(false)),
                _ => Err(AuthError::ValidationError(vec![format!(
                    "Invalid boolean value: {}",
                    v
                )])),
            },
            None => Ok(None),
        }
    }

    /// Get setting value as float
    pub async fn get_setting_value_as_f64(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<f64>, AuthError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => v.parse::<f64>().map(Some).map_err(|_| {
                AuthError::ValidationError(vec![format!("Invalid float value: {}", v)])
            }),
            None => Ok(None),
        }
    }

    /// Reset setting to default value
    pub async fn reset_setting_to_default(
        &self,
        category: &str,
        setting_key: &str,
        updated_by: Option<String>,
    ) -> Result<SystemSettingResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Get the setting to find its default value
        let setting = system_settings::table
            .filter(
                system_settings::category
                    .eq(category)
                    .and(system_settings::setting_key.eq(setting_key)),
            )
            .select(SystemSetting::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|e| {
                error!("Failed to load setting {}:{}: {}", category, setting_key, e);
                AuthError::DatabaseError
            })?;

        let setting = setting.ok_or_else(|| {
            AuthError::NotFound(format!("Setting {}:{} not found", category, setting_key))
        })?;
        let default_value = setting.default_value.unwrap_or_default();

        // Update to default value
        self.update_setting(category, setting_key, &default_value, updated_by)
            .await
    }
}
