use utoipa::OpenApi;

pub mod config;
pub mod database;
pub mod embedded_assets;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod query_engine;
pub mod schema;
pub mod services;
pub mod utils;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "LunarBase API",
        version = "0.4.0",
        description = "A powerful backend-as-a-service API built with Rust, Axum, and Diesel ORM",
        contact(
            name = "LunarBase Team",
            email = "hexthecoder@gmail.com"
        ),
        license(
            name = "MIT",
            url = "https://opensource.org/licenses/MIT"
        )
    ),
    servers(
        (url = "http://localhost:3000/api", description = "Local development server"),
    ),
    paths(
        handlers::auth::register,
        handlers::auth::register_admin,
        handlers::auth::login,
        handlers::auth::refresh_token,
        handlers::auth::me,
        handlers::auth::logout,
        handlers::auth::oauth_authorize,
        handlers::auth::oauth_callback,
        handlers::auth::verify_email,
        handlers::auth::resend_verification,

        handlers::collections::create_collection,
        handlers::collections::list_collections,
        handlers::collections::get_collection,
        handlers::collections::update_collection,
        handlers::collections::delete_collection,
        handlers::collections::get_collection_schema,
        handlers::collections::get_collections_stats,

        handlers::collections::create_record,
        handlers::collections::list_records,
        handlers::collections::list_all_records,
        handlers::collections::get_record,
        handlers::collections::update_record,
        handlers::collections::delete_record,

        handlers::permissions::create_role,
        handlers::permissions::list_roles,
        handlers::permissions::get_role,
        handlers::permissions::get_role_collection_permission,
        handlers::permissions::set_collection_permission,
        handlers::permissions::get_collection_permissions,
        handlers::permissions::set_user_collection_permission,
        handlers::permissions::get_user_collection_permissions,

        handlers::record_permissions::set_record_permission,
        handlers::record_permissions::get_record_permissions,
        handlers::record_permissions::remove_record_permission,
        handlers::record_permissions::list_record_permissions,

        handlers::ownership::transfer_record_ownership,
        handlers::ownership::get_my_owned_records,
        handlers::ownership::get_user_owned_records,
        handlers::ownership::check_record_ownership,
        handlers::ownership::get_ownership_stats,

        handlers::websocket::websocket_handler,
        handlers::websocket::websocket_stats,
        handlers::websocket::websocket_status,
        handlers::websocket::get_connections,
        handlers::websocket::disconnect_connection,
        handlers::websocket::broadcast_message,
        handlers::websocket::get_activity,

        handlers::users::list_users,
        handlers::users::get_user,
        handlers::users::create_user,
        handlers::users::update_user,
        handlers::users::delete_user,
        handlers::users::unlock_user,

        handlers::avatar_proxy::proxy_avatar,

        handlers::health::health_check,
        handlers::health::public_health_check,
        handlers::health::simple_health_check,

        handlers::metrics::get_metrics,
        handlers::metrics::get_metrics_summary,

        handlers::configuration::get_all_settings,
        handlers::configuration::get_settings_by_category,
        handlers::configuration::get_setting,
        handlers::configuration::update_setting,
        handlers::configuration::create_setting,
        handlers::configuration::delete_setting,
        handlers::configuration::reset_setting,

        handlers::backup::create_manual_backup,
        handlers::backup::get_backup_health,
    ),
    components(
        schemas(
            utils::ApiResponse<models::user::AuthResponse>,
            utils::ApiResponse<models::user::UserResponse>,
            utils::ApiResponse<models::collection::CollectionResponse>,
            utils::ApiResponse<Vec<models::collection::CollectionResponse>>,
            utils::ApiResponse<models::collection::RecordResponse>,
            utils::ApiResponse<Vec<models::collection::RecordResponse>>,
            utils::ErrorResponse,

            models::user::RegisterRequest,
            models::user::LoginRequest,
            models::user::UserResponse,
            models::user::AuthResponse,
            models::blacklisted_token::LogoutRequest,
            models::blacklisted_token::LogoutResponse,
            handlers::auth::OAuthCallbackQuery,
            handlers::auth::OAuthAuthorizationResponse,
            handlers::auth::VerifyEmailRequest,
            handlers::auth::ResendVerificationRequest,

            handlers::avatar_proxy::AvatarQuery,

            models::collection::CreateCollectionRequest,
            models::collection::UpdateCollectionRequest,
            models::collection::CollectionResponse,
            models::collection::CollectionSchema,
            models::collection::FieldDefinition,
            models::collection::FieldType,
            models::collection::ValidationRules,

            models::collection::CreateRecordRequest,
            models::collection::UpdateRecordRequest,
            models::collection::RecordResponse,
            models::collection::FileUpload,
            handlers::collections::PaginatedRecordsResponse,
            handlers::collections::RecordWithCollection,
            handlers::collections::PaginationMeta,

            models::permissions::Role,
            models::permissions::CollectionPermission,
            models::permissions::UserCollectionPermission,
            models::permissions::RecordPermission,
            models::permissions::CreateRoleRequest,
            models::permissions::SetCollectionPermissionRequest,
            models::permissions::SetUserCollectionPermissionRequest,
            models::permissions::SetRecordPermissionRequest,

            handlers::ownership::TransferOwnershipRequest,
            handlers::ownership::GetOwnedRecordsQuery,

            handlers::users::CreateUserRequest,
            handlers::users::UpdateUserRequest,
            handlers::users::PaginatedUsersResponse,
            handlers::users::ListUsersQuery,

            services::WebSocketStats,
            handlers::websocket::WebSocketStatus,
            handlers::websocket::ConnectionDetails,
            handlers::websocket::SubscriptionInfo,
            handlers::websocket::BroadcastRequest,
            handlers::websocket::BroadcastResponse,
            handlers::websocket::ActivityEntry,
            handlers::websocket::ActivityResponse,

            handlers::health::HealthResponse,
            handlers::health::DatabaseHealth,
            handlers::health::MemoryInfo,
            handlers::health::SystemInfo,

            handlers::metrics::MetricsSummary,

            models::system_setting::SystemSettingResponse,
            models::system_setting::SystemSettingRequest,
            models::system_setting::SettingCategory,
            models::system_setting::SettingDataType,
            handlers::configuration::ConfigurationResponse,
            handlers::configuration::ListSettingsQuery,
            utils::ApiResponse<models::system_setting::SystemSettingResponse>,
            utils::ApiResponse<Vec<models::system_setting::SystemSettingResponse>>,
            utils::ApiResponse<handlers::configuration::ConfigurationResponse>,

            handlers::backup::BackupResponse,
            utils::ApiResponse<handlers::backup::BackupResponse>,
            utils::ApiResponse<bool>,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Authentication", description = "User authentication and authorization"),
        (name = "Avatar", description = "Avatar proxy for external images"),
        (name = "Collections", description = "Collection management operations"),
        (name = "Records", description = "Record CRUD operations"),
        (name = "Permissions", description = "Role and permission management"),
        (name = "Record Permissions", description = "Record-level permission management"),
        (name = "Ownership", description = "Record ownership management"),
        (name = "WebSocket", description = "WebSocket connections and real-time features"),
        (name = "Users", description = "User management operations"),
        (name = "Health", description = "System health checks"),
        (name = "Monitoring", description = "System monitoring and metrics"),
        (name = "Configuration", description = "System configuration management"),
        (name = "Backup", description = "Database backup management")
    )
)]
pub struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                utoipa::openapi::security::SecurityScheme::Http(
                    utoipa::openapi::security::HttpBuilder::new()
                        .scheme(utoipa::openapi::security::HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .build(),
                ),
            )
        }
    }
}

pub use config::Config;
pub use database::DatabasePool;
use services::{
    AdminService, BackupService, CollectionService, ConfigurationManager, EmailService,
    OwnershipService, PermissionService, WebSocketService, create_backup_service_from_config,
    create_s3_service_from_config,
};
use std::sync::Arc;

pub struct AppState {
    pub db_pool: DatabasePool,
    pub auth_state: middleware::AuthState,
    pub metrics_state: middleware::MetricsState,
    pub collection_service: CollectionService,
    pub permission_service: PermissionService,
    pub ownership_service: OwnershipService,
    pub admin_service: AdminService,
    pub websocket_service: WebSocketService,
    pub email_service: EmailService,
    pub oauth_service: utils::OAuthService,
    pub backup_service: Option<BackupService>,
    pub configuration_manager: ConfigurationManager,
    pub password_pepper: String,
}

impl AppState {
    pub async fn new(
        db_pool: DatabasePool,
        jwt_secret: &str,
        password_pepper: String,
        config: &Config,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let permission_service = PermissionService::new(db_pool.clone());
        let ownership_service = OwnershipService::new(db_pool.clone());
        let admin_service = AdminService::new(db_pool.clone());
        let metrics_state = middleware::MetricsState::new()?;
        metrics_state.start_cpu_sampler();
        let websocket_service =
            Arc::new(WebSocketService::new(Arc::new(permission_service.clone())));
        let mut collection_service = CollectionService::new(db_pool.clone())
            .with_websocket_service(websocket_service.clone())
            .with_permission_service(permission_service.clone());

        let s3_service_option = create_s3_service_from_config(config).await.ok().flatten();
        if let Some(ref s3_service) = s3_service_option {
            collection_service = collection_service.with_s3_service(s3_service.clone());
        }
        let oauth_config = utils::oauth_service::OAuthConfig::from_env();
        let oauth_service = utils::OAuthService::new(oauth_config);
        let email_service = EmailService::new(config, db_pool.clone());

        let configuration_manager = ConfigurationManager::new(db_pool.clone());
        configuration_manager.initialize().await?;

        let backup_service = create_backup_service_from_config(
            db_pool.clone(),
            s3_service_option.map(Arc::new),
            Arc::new(configuration_manager.clone()),
            Some(Arc::new(metrics_state.clone())),
        )
        .await
        .ok()
        .flatten();

        Ok(Self {
            db_pool: db_pool.clone(),
            auth_state: middleware::AuthState::new(
                jwt_secret,
                db_pool.clone(),
                configuration_manager.clone(),
            )
            .await,
            metrics_state,
            collection_service,
            permission_service,
            ownership_service,
            admin_service,
            websocket_service: (*websocket_service).clone(),
            email_service,
            oauth_service,
            backup_service,
            configuration_manager,
            password_pepper,
        })
    }
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            db_pool: self.db_pool.clone(),
            auth_state: self.auth_state.clone(),
            metrics_state: self.metrics_state.clone(),
            collection_service: self.collection_service.clone(),
            permission_service: self.permission_service.clone(),
            ownership_service: self.ownership_service.clone(),
            admin_service: self.admin_service.clone(),
            websocket_service: self.websocket_service.clone(),
            email_service: self.email_service.clone(),
            oauth_service: self.oauth_service.clone(),
            backup_service: self.backup_service.clone(),
            configuration_manager: self.configuration_manager.clone(),
            password_pepper: self.password_pepper.clone(),
        }
    }
}
