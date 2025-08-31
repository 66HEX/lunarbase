use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::{debug, error};

use crate::models::system_setting::{
    NewSystemSetting, SettingCategory, SettingDataType, SystemSetting, SystemSettingResponse,
    UpdateSystemSetting,
};
use crate::schema::system_settings;
use crate::utils::LunarbaseError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct ConfigurationService {
    pub pool: DbPool,
}

impl ConfigurationService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn get_all_settings(&self) -> Result<Vec<SystemSettingResponse>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let settings = system_settings::table
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load system settings: {}", e);
                LunarbaseError::DatabaseError
            })?;

        Ok(settings.into_iter().map(|s| s.into()).collect())
    }

    pub async fn get_settings_by_category(
        &self,
        category: &str,
    ) -> Result<Vec<SystemSettingResponse>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let settings = system_settings::table
            .filter(system_settings::category.eq(category))
            .select(SystemSetting::as_select())
            .load(&mut conn)
            .map_err(|e| {
                error!("Failed to load settings for category {}: {}", category, e);
                LunarbaseError::DatabaseError
            })?;

        Ok(settings.into_iter().map(|s| s.into()).collect())
    }

    pub async fn get_setting(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<SystemSettingResponse>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

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
                LunarbaseError::DatabaseError
            })?;

        Ok(setting.map(|s| s.into()))
    }

    pub async fn update_setting(
        &self,
        category: &str,
        setting_key: &str,
        new_value: &str,
        updated_by: Option<String>,
    ) -> Result<SystemSettingResponse, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

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
                LunarbaseError::DatabaseError
            })?;

        let existing_setting = existing_setting.ok_or_else(|| {
            LunarbaseError::NotFound(format!("Setting {}:{} not found", category, setting_key))
        })?;

        self.validate_setting_value(new_value, &existing_setting.data_type)?;

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
            LunarbaseError::DatabaseError
        })?;

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
                LunarbaseError::DatabaseError
            })?;

        debug!(
            "Setting updated: {}:{} = {}",
            category, setting_key, new_value
        );
        Ok(updated_setting.into())
    }

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
    ) -> Result<SystemSettingResponse, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

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
                LunarbaseError::DatabaseError
            })?;

        if existing.is_some() {
            return Err(LunarbaseError::Conflict(format!(
                "Setting {}:{} already exists",
                category.to_string(),
                setting_key
            )));
        }

        self.validate_setting_value(&setting_value, &data_type.to_string())?;

        if !default_value.is_empty() {
            self.validate_setting_value(&default_value, &data_type.to_string())?;
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
            None,
        );

        diesel::insert_into(system_settings::table)
            .values(&new_setting)
            .execute(&mut conn)
            .map_err(|e| {
                error!("Failed to create setting: {}", e);
                LunarbaseError::DatabaseError
            })?;

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
                LunarbaseError::DatabaseError
            })?;

        debug!(
            "Setting created: {}:{}",
            created_setting.category, created_setting.setting_key
        );
        Ok(created_setting.into())
    }

    pub async fn delete_setting(&self, category: &str, setting_key: &str) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

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
            LunarbaseError::DatabaseError
        })?;

        if deleted_count == 0 {
            return Err(LunarbaseError::NotFound(format!(
                "Setting {}:{} not found",
                category, setting_key
            )));
        }

        debug!("Setting deleted: {}:{}", category, setting_key);
        Ok(())
    }

    pub async fn get_setting_value(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<String>, LunarbaseError> {
        let setting = self.get_setting(category, setting_key).await?;
        Ok(setting.map(|s| s.setting_value))
    }

    pub async fn get_setting_value_as_i32(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<i32>, LunarbaseError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => v.parse::<i32>().map(Some).map_err(|_| {
                LunarbaseError::ValidationError(vec![format!("Invalid integer value: {}", v)])
            }),
            None => Ok(None),
        }
    }

    pub async fn get_setting_value_as_bool(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<bool>, LunarbaseError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => match v.to_lowercase().as_str() {
                "true" | "1" | "yes" | "on" => Ok(Some(true)),
                "false" | "0" | "no" | "off" => Ok(Some(false)),
                _ => Err(LunarbaseError::ValidationError(vec![format!(
                    "Invalid boolean value: {}",
                    v
                )])),
            },
            None => Ok(None),
        }
    }

    pub async fn get_setting_value_as_f64(
        &self,
        category: &str,
        setting_key: &str,
    ) -> Result<Option<f64>, LunarbaseError> {
        let value = self.get_setting_value(category, setting_key).await?;
        match value {
            Some(v) => v.parse::<f64>().map(Some).map_err(|_| {
                LunarbaseError::ValidationError(vec![format!("Invalid float value: {}", v)])
            }),
            None => Ok(None),
        }
    }

    pub async fn reset_setting_to_default(
        &self,
        category: &str,
        setting_key: &str,
        updated_by: Option<String>,
    ) -> Result<SystemSettingResponse, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

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
                LunarbaseError::DatabaseError
            })?;

        let setting = setting.ok_or_else(|| {
            LunarbaseError::NotFound(format!("Setting {}:{} not found", category, setting_key))
        })?;
        let default_value = setting.default_value.unwrap_or_default();

        self.update_setting(category, setting_key, &default_value, updated_by)
            .await
    }

    fn validate_setting_value(&self, value: &str, data_type: &str) -> Result<(), LunarbaseError> {
        let mut errors = Vec::new();

        match data_type {
            "string" => {
                if value.len() > 10000 {
                    errors.push("Setting value is too long (maximum 10000 characters)".to_string());
                }
            }
            "integer" => {
                if let Err(_) = value.parse::<i64>() {
                    errors.push(format!("Invalid integer value: '{}'", value));
                }
            }
            "float" => {
                if let Err(_) = value.parse::<f64>() {
                    errors.push(format!("Invalid float value: '{}'", value));
                }
            }
            "boolean" => match value.to_lowercase().as_str() {
                "true" | "false" | "1" | "0" | "yes" | "no" | "on" | "off" => {}
                _ => {
                    errors.push(format!(
                            "Invalid boolean value: '{}'. Expected: true, false, 1, 0, yes, no, on, off",
                            value
                        ));
                }
            },
            "json" => {
                if let Err(e) = serde_json::from_str::<serde_json::Value>(value) {
                    errors.push(format!("Invalid JSON value: {}", e));
                }
            }
            _ => {
                errors.push(format!("Unknown data type: {}", data_type));
            }
        }

        if !errors.is_empty() {
            return Err(LunarbaseError::ValidationError(errors));
        }

        Ok(())
    }
}
