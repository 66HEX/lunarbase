use crate::schema::system_settings;
use chrono::{DateTime, NaiveDateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = system_settings)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct SystemSetting {
    pub id: i32,
    pub category: String,
    pub setting_key: String,
    pub setting_value: String,
    pub data_type: String,
    pub description: Option<String>,
    pub default_value: Option<String>,
    pub is_sensitive: bool,
    pub requires_restart: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub updated_by: Option<String>,
}

#[derive(Debug, Insertable, Serialize, Deserialize)]
#[diesel(table_name = system_settings)]
pub struct NewSystemSetting {
    pub category: String,
    pub setting_key: String,
    pub setting_value: String,
    pub data_type: String,
    pub description: Option<String>,
    pub default_value: Option<String>,
    pub is_sensitive: bool,
    pub requires_restart: bool,
    pub updated_by: Option<String>,
}

impl NewSystemSetting {
    pub fn new(
        category: SettingCategory,
        setting_key: String,
        setting_value: String,
        data_type: SettingDataType,
        description: Option<String>,
        default_value: Option<String>,
        is_sensitive: bool,
        requires_restart: bool,
        updated_by: Option<String>,
    ) -> Self {
        Self {
            category: category.to_string(),
            setting_key,
            setting_value,
            data_type: data_type.to_string(),
            description,
            default_value,
            is_sensitive,
            requires_restart,
            updated_by,
        }
    }
}

#[derive(Debug, AsChangeset, Serialize, Deserialize)]
#[diesel(table_name = system_settings)]
pub struct UpdateSystemSetting {
    pub setting_value: Option<String>,
    pub description: Option<String>,
    pub is_sensitive: Option<bool>,
    pub requires_restart: Option<bool>,
    pub updated_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemSettingRequest {
    pub setting_value: String,
    pub updated_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SystemSettingResponse {
    pub id: i32,
    pub category: String,
    pub setting_key: String,
    pub setting_value: String,
    pub data_type: String,
    pub description: Option<String>,
    pub default_value: Option<String>,
    pub is_sensitive: bool,
    pub requires_restart: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SystemSetting> for SystemSettingResponse {
    fn from(setting: SystemSetting) -> Self {
        Self {
            id: setting.id,
            category: setting.category,
            setting_key: setting.setting_key,
            setting_value: setting.setting_value,
            data_type: setting.data_type,
            description: setting.description,
            default_value: setting.default_value,
            is_sensitive: setting.is_sensitive,
            requires_restart: setting.requires_restart,
            created_at: DateTime::from_naive_utc_and_offset(setting.created_at, Utc),
            updated_at: DateTime::from_naive_utc_and_offset(setting.updated_at, Utc),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum SettingDataType {
    #[serde(rename = "string")]
    String,
    #[serde(rename = "integer")]
    Integer,
    #[serde(rename = "boolean")]
    Boolean,
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "float")]
    Float,
}

impl ToString for SettingDataType {
    fn to_string(&self) -> String {
        match self {
            SettingDataType::String => "string".to_string(),
            SettingDataType::Integer => "integer".to_string(),
            SettingDataType::Boolean => "boolean".to_string(),
            SettingDataType::Json => "json".to_string(),
            SettingDataType::Float => "float".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum SettingCategory {
    #[serde(rename = "database")]
    Database,
    #[serde(rename = "auth")]
    Auth,
    #[serde(rename = "api")]
    Api,
    #[serde(rename = "email")]
    Email,
    #[serde(rename = "oauth")]
    OAuth,
    #[serde(rename = "storage")]
    Storage,
}

impl ToString for SettingCategory {
    fn to_string(&self) -> String {
        match self {
            SettingCategory::Database => "database".to_string(),
            SettingCategory::Auth => "auth".to_string(),
            SettingCategory::Api => "api".to_string(),
            SettingCategory::Email => "email".to_string(),
            SettingCategory::OAuth => "oauth".to_string(),
            SettingCategory::Storage => "storage".to_string(),
        }
    }
}

impl SystemSetting {
    pub fn to_response(&self) -> SystemSettingResponse {
        SystemSettingResponse {
            id: self.id,
            category: self.category.clone(),
            setting_key: self.setting_key.clone(),
            setting_value: self.setting_value.clone(),
            data_type: self.data_type.clone(),
            description: self.description.clone(),
            default_value: self.default_value.clone(),
            is_sensitive: self.is_sensitive,
            requires_restart: self.requires_restart,
            created_at: DateTime::from_naive_utc_and_offset(self.created_at, Utc),
            updated_at: DateTime::from_naive_utc_and_offset(self.updated_at, Utc),
        }
    }
}
