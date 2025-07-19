use utoipa::OpenApi;

pub mod config;
pub mod database;
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
        version = "0.1.0",
        description = "A powerful backend-as-a-service API built with Rust, Axum, and Diesel ORM",
        contact(
            name = "LunarBase Team",
            email = "contact@lunarbase.dev"
        ),
        license(
            name = "MIT",
            url = "https://opensource.org/licenses/MIT"
        )
    ),
    servers(
        (url = "http://localhost:3000/api", description = "Local development server"),
        (url = "https://api.lunarbase.dev", description = "Production server")
    ),
    paths(
        // Authentication endpoints
        handlers::auth::register,
        handlers::auth::register_admin,
        handlers::auth::login,
        handlers::auth::refresh_token,
        handlers::auth::me,
        handlers::auth::logout,

        // Collection endpoints
        handlers::collections::create_collection,
        handlers::collections::list_collections,
        handlers::collections::get_collection,
        handlers::collections::update_collection,
        handlers::collections::delete_collection,
        handlers::collections::get_collection_schema,
        handlers::collections::get_collections_stats,

        // Record endpoints
        handlers::collections::create_record,
        handlers::collections::list_records,
        handlers::collections::list_all_records,
        handlers::collections::get_record,
        handlers::collections::update_record,
        handlers::collections::delete_record,

        // Permission endpoints
        handlers::permissions::create_role,
        handlers::permissions::list_roles,
        handlers::permissions::get_role,
        handlers::permissions::get_role_collection_permission,
        handlers::permissions::set_collection_permission,
        handlers::permissions::get_collection_permissions,
        handlers::permissions::set_user_collection_permission,
        handlers::permissions::get_user_collection_permissions,

        // Record Permission endpoints
        handlers::record_permissions::set_record_permission,
        handlers::record_permissions::get_record_permissions,
        handlers::record_permissions::remove_record_permission,
        handlers::record_permissions::list_record_permissions,

        // Ownership endpoints
        handlers::ownership::transfer_record_ownership,
        handlers::ownership::get_my_owned_records,
        handlers::ownership::get_user_owned_records,
        handlers::ownership::check_record_ownership,
        handlers::ownership::get_ownership_stats,

        // WebSocket endpoints
        handlers::websocket::websocket_handler,
        handlers::websocket::websocket_stats,
        handlers::websocket::websocket_status,

        // User management endpoints
        handlers::users::list_users,
        handlers::users::get_user,
        handlers::users::create_user,
        handlers::users::update_user,
        handlers::users::delete_user,
        handlers::users::unlock_user,

        // Health check
        handlers::health::health_check,

        // Metrics endpoints
        handlers::metrics::get_metrics,
        handlers::metrics::get_metrics_summary,
    ),
    components(
        schemas(
            // Request/Response models
            utils::ApiResponse<models::user::AuthResponse>,
            utils::ApiResponse<models::user::UserResponse>,
            utils::ApiResponse<models::collection::CollectionResponse>,
            utils::ApiResponse<Vec<models::collection::CollectionResponse>>,
            utils::ApiResponse<models::collection::RecordResponse>,
            utils::ApiResponse<Vec<models::collection::RecordResponse>>,
            utils::ErrorResponse,

            // Auth models
            models::user::RegisterRequest,
            models::user::LoginRequest,
            models::user::UserResponse,
            models::user::AuthResponse,
            models::blacklisted_token::LogoutRequest,
            models::blacklisted_token::LogoutResponse,

            // Collection models
            models::collection::CreateCollectionRequest,
            models::collection::UpdateCollectionRequest,
            models::collection::CollectionResponse,
            models::collection::CollectionSchema,
            models::collection::FieldDefinition,
            models::collection::FieldType,
            models::collection::ValidationRules,

            // Record models
            models::collection::CreateRecordRequest,
            models::collection::UpdateRecordRequest,
            models::collection::RecordResponse,
            handlers::collections::PaginatedRecordsResponse,
            handlers::collections::RecordWithCollection,
            handlers::collections::PaginationMeta,

            // Permission models
            models::permissions::Role,
            models::permissions::CollectionPermission,
            models::permissions::UserCollectionPermission,
            models::permissions::RecordPermission,
            models::permissions::CreateRoleRequest,
            models::permissions::SetCollectionPermissionRequest,
            models::permissions::SetUserCollectionPermissionRequest,
            models::permissions::SetRecordPermissionRequest,

            // Ownership models
            handlers::ownership::TransferOwnershipRequest,
            handlers::ownership::GetOwnedRecordsQuery,

            // User management models
            handlers::users::CreateUserRequest,
            handlers::users::UpdateUserRequest,
            handlers::users::PaginatedUsersResponse,
            handlers::users::ListUsersQuery,

            // WebSocket models
            services::WebSocketStats,
            handlers::websocket::WebSocketStatus,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "Authentication", description = "User authentication and authorization"),
        (name = "Collections", description = "Collection management operations"),
        (name = "Records", description = "Record CRUD operations"),
        (name = "Permissions", description = "Role and permission management"),
        (name = "Record Permissions", description = "Record-level permission management"),
        (name = "Ownership", description = "Record ownership management"),
        (name = "WebSocket", description = "WebSocket connections and real-time features"),
        (name = "Users", description = "User management operations"),
        (name = "Health", description = "System health checks")
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
    AdminService, CollectionService, OwnershipService, PermissionService, WebSocketService,
};
use std::sync::Arc;

// Application state combining all shared state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: DatabasePool,
    pub auth_state: middleware::AuthState,
    pub metrics_state: middleware::MetricsState,
    pub collection_service: CollectionService,
    pub permission_service: PermissionService,
    pub ownership_service: OwnershipService,
    pub admin_service: AdminService,
    pub websocket_service: WebSocketService,
}

impl AppState {
    pub fn new(
        db_pool: DatabasePool,
        jwt_secret: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let permission_service = PermissionService::new(db_pool.clone());
        let ownership_service = OwnershipService::new(db_pool.clone());
        let admin_service = AdminService::new(db_pool.clone());
        let metrics_state = middleware::MetricsState::new()?;
        let websocket_service =
            Arc::new(WebSocketService::new(Arc::new(permission_service.clone())));
        let collection_service = CollectionService::new(db_pool.clone())
            .with_websocket_service(websocket_service.clone())
            .with_permission_service(permission_service.clone());

        Ok(Self {
            db_pool: db_pool.clone(),
            auth_state: middleware::AuthState::new(jwt_secret, db_pool.clone()),
            metrics_state,
            collection_service,
            permission_service,
            ownership_service,
            admin_service,
            websocket_service: (*websocket_service).clone(),
        })
    }
}
