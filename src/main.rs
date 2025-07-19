use axum::{routing::{get, post, put, delete}, Router, middleware};
use std::net::SocketAddr;
use tokio::signal;
use tracing::{info, warn};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use lunarbase::{Config, AppState, ApiDoc};
use lunarbase::database::create_pool;
use lunarbase::handlers::{
    health::{ public_health_check, simple_health_check, health_check}, register, register_admin, login, refresh_token, me, logout,
    collections::{
        create_collection, list_collections, get_collection, update_collection, delete_collection,
        create_record, list_records, get_record, update_record, delete_record,
        get_collection_schema, get_collections_stats, list_all_records
    },
    permissions::{
        create_role, list_roles, get_role, get_role_collection_permission,
        set_collection_permission, get_collection_permissions, 
        set_user_collection_permission, get_user_collection_permissions, 
        get_user_accessible_collections
    },
    record_permissions::{
        set_record_permission, get_record_permissions, remove_record_permission,
        list_record_permissions
    },
    ownership::{
        transfer_record_ownership, get_my_owned_records, get_user_owned_records,
        check_record_ownership, get_ownership_stats
    },
    users::{
        list_users, get_user, create_user, update_user, delete_user, unlock_user
    },
    websocket::{
        websocket_handler, websocket_stats, websocket_status
    },
    admin::{
        serve_admin_assets
    },
    metrics::{
        get_metrics, get_metrics_summary
    }
};
use lunarbase::middleware::{setup_logging, add_middleware, auth_middleware};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Logging initialization
    setup_logging();
    info!("Starting LunarBase server...");

    // Configuration loading
    let config = Config::from_env()?;
    info!("Configuration loaded successfully");

    // Database connection pool creation
    let pool = create_pool(&config.database_url)?;
    info!("Database pool created successfully");

    // Application state creation
    let app_state = AppState::new(pool, &config.jwt_secret)?;

    // Automatic admin creation from environment variables
    if let Err(e) = app_state.admin_service.ensure_admin_exists(&config).await {
        warn!("Failed to create admin from environment variables: {}", e);
    }

    // Routing creation
    let app = create_router(app_state);

    // Server address configuration
    let addr = config.server_address().parse::<SocketAddr>()?;
    info!("Server will listen on {}", addr);

    // Server startup with graceful shutdown
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Server started successfully");
    
    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shutdown complete");
    Ok(())
}

fn create_router(app_state: AppState) -> Router {
    // Public routes (no authentication)
    let public_routes = Router::new()
        .route("/health", get(public_health_check))
        .route("/health/simple", get(simple_health_check))
        .route("/auth/register", post(register))
        .route("/auth/register-admin", post(register_admin))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh_token))
        // Metrics endpoints
        .route("/metrics", get(get_metrics))
        .route("/metrics/summary", get(get_metrics_summary))
        // Public collection and record read endpoints
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{id}", get(get_record))
        // WebSocket endpoints
        .route("/ws", get(websocket_handler))
        .route("/ws/status", get(websocket_status));

    // Protected routes (authentication)
    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
        .route("/health/admin", get(health_check))
        // Collection management (admin only)
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        // Record management
        .route("/records", get(list_all_records))
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{id}", put(update_record))
        .route("/collections/{name}/records/{id}", delete(delete_record))
        // Permission management (admin only)
        .route("/permissions/roles", post(create_role))
        .route("/permissions/roles", get(list_roles))
        .route("/permissions/roles/{role_name}", get(get_role))
        .route("/permissions/roles/{role_name}/collections/{collection_name}", get(get_role_collection_permission))
        .route("/permissions/collections/{name}", post(set_collection_permission))
        .route("/permissions/collections/{name}", get(get_collection_permissions))
        .route("/permissions/users/{user_id}/collections/{name}", post(set_user_collection_permission))
        .route("/permissions/users/{user_id}/collections/{name}", get(get_user_collection_permissions))
        .route("/permissions/users/{user_id}/collections", get(get_user_accessible_collections))
        // Record-level permissions
        .route("/permissions/collections/{name}/records/{record_id}", post(set_record_permission))
        .route("/permissions/collections/{name}/records/{record_id}/users/{user_id}", get(get_record_permissions))
        .route("/permissions/collections/{name}/records/{record_id}/users/{user_id}", delete(remove_record_permission))
        .route("/permissions/collections/{name}/records/{record_id}/users", get(list_record_permissions))
        // Ownership management
        .route("/ownership/collections/{name}/records/{record_id}/transfer", post(transfer_record_ownership))
        .route("/ownership/collections/{name}/my-records", get(get_my_owned_records))
        .route("/ownership/collections/{name}/users/{user_id}/records", get(get_user_owned_records))
        .route("/ownership/collections/{name}/records/{record_id}/check", get(check_record_ownership))
        .route("/ownership/collections/{name}/stats", get(get_ownership_stats))
        // User management (admin only)
        .route("/users", get(list_users))
        .route("/users", post(create_user))
        .route("/users/{user_id}", get(get_user))
        .route("/users/{user_id}", put(update_user))
        .route("/users/{user_id}", delete(delete_user))
        .route("/users/{user_id}/unlock", post(unlock_user))
        // WebSocket admin endpoints
        .route("/ws/stats", get(websocket_stats))
        .layer(middleware::from_fn_with_state(app_state.auth_state.clone(), auth_middleware));

    // Combine routes (public and protected)
    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let swagger_router = SwaggerUi::new("/docs")
        .url("/docs/openapi.json", ApiDoc::openapi());

    let app = Router::new()
        .nest("/api", api_routes)
        .merge(swagger_router)
        .nest_service("/admin", serve_admin_assets())
        .with_state(app_state);

    // Middleware application
    add_middleware(app)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down gracefully...");
        },
        _ = terminate => {
            info!("Received terminate signal, shutting down gracefully...");
        },
    }
}