use axum::{routing::{get, post}, Router, middleware};
use std::net::SocketAddr;
use tokio::signal;
use tracing::info;

use ironbase::{Config, AppState};
use ironbase::database::create_pool;
use ironbase::handlers::{health_check, register, login, refresh_token, me};
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
        .route("/auth/refresh", post(refresh_token));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/auth/me", get(me))
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
