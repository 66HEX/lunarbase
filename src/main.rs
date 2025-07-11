use axum::{routing::{get, post, put, delete}, Router, middleware};
use std::net::SocketAddr;
use tokio::signal;
use tracing::info;

use ironbase::{Config, AppState};
use ironbase::database::create_pool;
use ironbase::handlers::{
    health_check, register, login, refresh_token, me,
    collections::{
        create_collection, list_collections, get_collection, update_collection, delete_collection,
        create_record, list_records, get_record, update_record, delete_record,
        get_collection_schema, get_collections_stats
    },
    permissions::{
        create_role, list_roles, get_role, set_collection_permission, 
        get_collection_permissions, set_user_collection_permission,
        get_user_collection_permissions, get_user_accessible_collections
    },
    record_permissions::{
        set_record_permission, get_record_permissions, remove_record_permission,
        list_record_permissions
    },
    ownership::{
        transfer_record_ownership, get_my_owned_records, get_user_owned_records,
        check_record_ownership, get_ownership_stats
    }
};
use ironbase::middleware::{setup_logging, add_middleware, auth_middleware};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Inicjalizacja logowania
    setup_logging();
    info!("Starting IronBase server...");

    // Wczytanie konfiguracji
    let config = Config::from_env()?;
    info!("Configuration loaded successfully");

    // Utworzenie pool połączeń z bazą danych
    let pool = create_pool(&config.database_url)?;
    info!("Database pool created successfully");

    // Utworzenie application state
    let app_state = AppState::new(pool, &config.jwt_secret);

    // Utworzenie routingu
    let app = create_router(app_state);

    // Konfiguracja adresu serwera
    let addr = config.server_address().parse::<SocketAddr>()?;
    info!("Server will listen on {}", addr);

    // Uruchomienie serwera z graceful shutdown
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Server started successfully");
    
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Server shutdown complete");
    Ok(())
}

fn create_router(app_state: AppState) -> Router {
    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh_token))
        // Public collection and record read endpoints
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{id}", get(get_record));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        // Collection management (admin only)
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        // Record management
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{id}", put(update_record))
        .route("/collections/{name}/records/{id}", delete(delete_record))
        // Permission management (admin only)
        .route("/permissions/roles", post(create_role))
        .route("/permissions/roles", get(list_roles))
        .route("/permissions/roles/{role_name}", get(get_role))
        .route("/permissions/collections/{name}", post(set_collection_permission))
        .route("/permissions/collections/{name}", get(get_collection_permissions))
        .route("/permissions/collections/{name}/users/{user_id}", post(set_user_collection_permission))
        .route("/permissions/collections/{name}/users/{user_id}", get(get_user_collection_permissions))
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
        .layer(middleware::from_fn_with_state(app_state.auth_state.clone(), auth_middleware));

    // Combine routes
    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let app = Router::new()
        .nest("/api", api_routes)
        .with_state(app_state);

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
