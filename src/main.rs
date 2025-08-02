use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use std::net::SocketAddr;
use tokio::signal;
use tracing::{info, warn};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};

use lunarbase::database::create_pool;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");
use lunarbase::handlers::{
    admin::{serve_admin_assets},
    avatar_proxy::proxy_avatar,
    collections::{
        create_collection, create_record, delete_collection, delete_record, get_collection,
        get_collection_schema, get_collections_stats, get_record, list_all_records,
        list_collections, list_records, update_collection, update_record,
    },
    health::{health_check, public_health_check, simple_health_check},
    login, logout, me, oauth_authorize, oauth_callback, verify_email, verify_email_get, resend_verification,
    metrics::{get_metrics, get_metrics_summary},
    ownership::{
        check_record_ownership, get_my_owned_records, get_ownership_stats, get_user_owned_records,
        transfer_record_ownership,
    },
    permissions::{
        create_role, get_collection_permissions, get_role, get_role_collection_permission,
        get_user_accessible_collections, get_user_collection_permissions, list_roles,
        set_collection_permission, set_user_collection_permission,
    },
    record_permissions::{
        get_record_permissions, list_record_permissions, remove_record_permission,
        set_record_permission,
    },
    refresh_token, register, register_admin,
    users::{create_user, delete_user, get_user, list_users, unlock_user, update_user},
    websocket::{websocket_handler, websocket_stats, websocket_status, get_connections, disconnect_connection, broadcast_message, get_activity},
};
use lunarbase::middleware::{add_middleware, auth_middleware, setup_logging};
use lunarbase::{ApiDoc, AppState, Config};

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

    // Run database migrations automatically
    {
        let mut conn = pool.get()?;
        conn.run_pending_migrations(MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;
        info!("Database migrations completed successfully");
    }

    // Application state creation
    let app_state = AppState::new(pool, &config.jwt_secret, config.password_pepper.clone(), &config).await?;

    // Automatic admin creation from environment variables
    if let Err(e) = app_state.admin_service.ensure_admin_exists(&config, &app_state.password_pepper).await {
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
        .route("/auth/verify-email", post(verify_email))
        .route("/verify-email", get(verify_email_get))
        .route("/auth/resend-verification", post(resend_verification))
        // OAuth endpoints
        .route("/auth/oauth/{provider}", get(oauth_authorize))
        .route("/auth/oauth/{provider}/callback", get(oauth_callback))
        // Avatar proxy endpoint
        .route("/avatar-proxy", get(proxy_avatar))
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
        .route(
            "/permissions/roles/{role_name}/collections/{collection_name}",
            get(get_role_collection_permission),
        )
        .route(
            "/permissions/collections/{name}",
            post(set_collection_permission),
        )
        .route(
            "/permissions/collections/{name}",
            get(get_collection_permissions),
        )
        .route(
            "/permissions/users/{user_id}/collections/{name}",
            post(set_user_collection_permission),
        )
        .route(
            "/permissions/users/{user_id}/collections/{name}",
            get(get_user_collection_permissions),
        )
        .route(
            "/permissions/users/{user_id}/collections",
            get(get_user_accessible_collections),
        )
        // Record-level permissions
        .route(
            "/permissions/collections/{name}/records/{record_id}",
            post(set_record_permission),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users/{user_id}",
            get(get_record_permissions),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users/{user_id}",
            delete(remove_record_permission),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users",
            get(list_record_permissions),
        )
        // Ownership management
        .route(
            "/ownership/collections/{name}/records/{record_id}/transfer",
            post(transfer_record_ownership),
        )
        .route(
            "/ownership/collections/{name}/my-records",
            get(get_my_owned_records),
        )
        .route(
            "/ownership/collections/{name}/users/{user_id}/records",
            get(get_user_owned_records),
        )
        .route(
            "/ownership/collections/{name}/records/{record_id}/check",
            get(check_record_ownership),
        )
        .route(
            "/ownership/collections/{name}/stats",
            get(get_ownership_stats),
        )
        // User management (admin only)
        .route("/users", get(list_users))
        .route("/users", post(create_user))
        .route("/users/{user_id}", get(get_user))
        .route("/users/{user_id}", put(update_user))
        .route("/users/{user_id}", delete(delete_user))
        .route("/users/{user_id}/unlock", post(unlock_user))
        // WebSocket admin endpoints
        .route("/ws/stats", get(websocket_stats))
        .route("/ws/connections", get(get_connections))
        .route("/ws/connections/{connection_id}", delete(disconnect_connection))
        .route("/ws/broadcast", post(broadcast_message))
        .route("/ws/activity", get(get_activity))
        .layer(middleware::from_fn_with_state(
            app_state.auth_state.clone(),
            auth_middleware,
        ));

    // Combine routes (public and protected)
    let api_routes = Router::new().merge(public_routes).merge(protected_routes);

    let swagger_router = SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi());

    let app = Router::new()
        .nest("/api", api_routes)
        .merge(swagger_router)
        .nest_service("/admin", serve_admin_assets())
        // Add metrics endpoints at root level for Prometheus scraping
        .route("/metrics", get(get_metrics))
        .route("/metrics/summary", get(get_metrics_summary))
        .with_state(app_state.clone());

    // Middleware application
    add_middleware(app, app_state)
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
