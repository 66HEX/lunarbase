use axum::{
    Extension,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    AppState,
    models::system_setting::{
        SettingCategory, SettingDataType, SystemSettingRequest, SystemSettingResponse,
    },
    services::ConfigurationService,
    utils::auth_error::ApiResponse,
    utils::{LunarbaseError, Claims, ErrorResponse},
};

fn validate_category(category: &str) -> Result<(), LunarbaseError> {
    match category {
        "database" | "auth" | "api" => Ok(()),
        _ => Err(LunarbaseError::ValidationError(vec![format!(
            "Invalid category '{}'. Valid categories are: database, auth, api",
            category
        )])),
    }
}

fn validate_data_type(data_type: &str) -> Result<(), LunarbaseError> {
    match data_type.to_lowercase().as_str() {
        "string" | "integer" | "boolean" | "json" | "float" => Ok(()),
        _ => Err(LunarbaseError::ValidationError(vec![format!(
            "Invalid data type '{}'. Valid types are: string, integer, boolean, json, float",
            data_type
        )])),
    }
}

fn validate_setting_key(key: &str) -> Result<(), LunarbaseError> {
    if key.is_empty() {
        return Err(LunarbaseError::ValidationError(vec![
            "Setting key cannot be empty".to_string(),
        ]));
    }

    if key.len() > 100 {
        return Err(LunarbaseError::ValidationError(vec![
            "Setting key cannot exceed 100 characters".to_string(),
        ]));
    }

    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err(LunarbaseError::ValidationError(vec![
            "Setting key can only contain alphanumeric characters, underscores, and hyphens"
                .to_string(),
        ]));
    }

    Ok(())
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListSettingsQuery {
    #[schema(example = "database")]
    pub category: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConfigurationResponse {
    pub settings: Vec<SystemSettingResponse>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSettingRequest {
    #[schema(example = "database")]
    pub category: String,
    #[schema(example = "max_connections")]
    pub setting_key: String,
    #[schema(example = "100")]
    pub setting_value: String,
    #[schema(example = "integer")]
    pub data_type: String,
    #[schema(example = "Maximum number of database connections")]
    pub description: Option<String>,
    #[schema(example = "50")]
    pub default_value: Option<String>,
    #[schema(example = false)]
    pub is_sensitive: Option<bool>,
    #[schema(example = true)]
    pub requires_restart: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/admin/configuration",
    tag = "Configuration",
    params(
        ("category" = Option<String>, Query, description = "Filter by category")
    ),
    responses(
        (status = 200, description = "Settings retrieved successfully", body = ApiResponse<ConfigurationResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_all_settings(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListSettingsQuery>,
) -> Result<Json<ApiResponse<ConfigurationResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let config_service = ConfigurationService::new(app_state.db_pool.clone());

    let settings = if let Some(category_str) = query.category {
        validate_category(&category_str)?;
        config_service
            .get_settings_by_category(&category_str)
            .await?
    } else {
        config_service.get_all_settings().await?
    };

    let response = ConfigurationResponse {
        settings: settings.into_iter().map(|s| s.into()).collect(),
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/admin/configuration/{category}",
    tag = "Configuration",
    params(
        ("category" = String, Path, description = "Setting category")
    ),
    responses(
        (status = 200, description = "Settings retrieved successfully", body = ApiResponse<ConfigurationResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 400, description = "Invalid category", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_settings_by_category(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(category_str): Path<String>,
) -> Result<Json<ApiResponse<ConfigurationResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&category_str)?;

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    let settings = config_service
        .get_settings_by_category(&category_str)
        .await?;

    let response = ConfigurationResponse {
        settings: settings.into_iter().map(|s| s.into()).collect(),
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/admin/configuration/{category}/{setting_key}",
    tag = "Configuration",
    params(
        ("category" = String, Path, description = "Setting category"),
        ("setting_key" = String, Path, description = "Setting key")
    ),
    responses(
        (status = 200, description = "Setting retrieved successfully", body = ApiResponse<SystemSettingResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Setting not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_setting(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((category_str, setting_key)): Path<(String, String)>,
) -> Result<Json<ApiResponse<SystemSettingResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&category_str)?;
    validate_setting_key(&setting_key)?;

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    let setting = config_service
        .get_setting(&category_str, &setting_key)
        .await?
        .ok_or_else(|| {
            LunarbaseError::NotFound(format!(
                "Setting {}:{} not found",
                category_str, setting_key
            ))
        })?;

    Ok(Json(ApiResponse::success(setting)))
}

#[utoipa::path(
    put,
    path = "/admin/configuration/{category}/{setting_key}",
    tag = "Configuration",
    params(
        ("category" = String, Path, description = "Setting category"),
        ("setting_key" = String, Path, description = "Setting key")
    ),
    request_body = SystemSettingRequest,
    responses(
        (status = 200, description = "Setting updated successfully", body = ApiResponse<SystemSettingResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Setting not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_setting(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((category_str, setting_key)): Path<(String, String)>,
    Json(payload): Json<SystemSettingRequest>,
) -> Result<Json<ApiResponse<SystemSettingResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&category_str)?;
    validate_setting_key(&setting_key)?;

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    let updated_setting = config_service
        .update_setting(
            &category_str,
            &setting_key,
            &payload.setting_value,
            payload.updated_by,
        )
        .await?;

    Ok(Json(ApiResponse::success(updated_setting)))
}

#[utoipa::path(
    post,
    path = "/admin/configuration",
    tag = "Configuration",
    request_body = CreateSettingRequest,
    responses(
        (status = 201, description = "Setting created successfully", body = ApiResponse<SystemSettingResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 409, description = "Setting already exists", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_setting(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateSettingRequest>,
) -> Result<(StatusCode, Json<ApiResponse<SystemSettingResponse>>), LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&payload.category)?;
    validate_data_type(&payload.data_type)?;
    validate_setting_key(&payload.setting_key)?;

    let category = match payload.category.as_str() {
        "database" => SettingCategory::Database,
        "auth" => SettingCategory::Auth,
        "api" => SettingCategory::Api,
        _ => unreachable!(),
    };

    let data_type = match payload.data_type.to_lowercase().as_str() {
        "string" => SettingDataType::String,
        "integer" => SettingDataType::Integer,
        "boolean" => SettingDataType::Boolean,
        "json" => SettingDataType::Json,
        "float" => SettingDataType::Float,
        _ => unreachable!(),
    };

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    let new_setting = config_service
        .create_setting(
            category,
            payload.setting_key,
            payload.setting_value,
            data_type,
            payload.description,
            payload.default_value.unwrap_or_default(),
            payload.is_sensitive.unwrap_or(false),
            payload.requires_restart.unwrap_or(false),
        )
        .await?;

    Ok((StatusCode::CREATED, Json(ApiResponse::success(new_setting))))
}

#[utoipa::path(
    delete,
    path = "/admin/configuration/{category}/{setting_key}",
    tag = "Configuration",
    params(
        ("category" = String, Path, description = "Setting category"),
        ("setting_key" = String, Path, description = "Setting key")
    ),
    responses(
        (status = 200, description = "Setting deleted successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Setting not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_setting(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((category_str, setting_key)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&category_str)?;
    validate_setting_key(&setting_key)?;

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    config_service
        .delete_setting(&category_str, &setting_key)
        .await?;

    Ok(Json(ApiResponse::success(())))
}

#[utoipa::path(
    post,
    path = "/admin/configuration/{category}/{setting_key}/reset",
    tag = "Configuration",
    params(
        ("category" = String, Path, description = "Setting category"),
        ("setting_key" = String, Path, description = "Setting key")
    ),
    responses(
        (status = 200, description = "Setting reset successfully", body = ApiResponse<SystemSettingResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Setting not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn reset_setting(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((category_str, setting_key)): Path<(String, String)>,
) -> Result<Json<ApiResponse<SystemSettingResponse>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    validate_category(&category_str)?;
    validate_setting_key(&setting_key)?;

    let config_service = ConfigurationService::new(app_state.db_pool.clone());
    let reset_setting = config_service
        .reset_setting_to_default(&category_str, &setting_key, None)
        .await?;

    Ok(Json(ApiResponse::success(reset_setting)))
}
