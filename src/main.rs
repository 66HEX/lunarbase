use axum::{routing::get, Router};
use std::net::SocketAddr;
use tokio::signal;
use tracing::info;

use ironbase::{Config, DatabasePool};
use ironbase::database::create_pool;
use ironbase::handlers::health_check;
use ironbase::middleware::{setup_logging, add_middleware};

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

    // Utworzenie routingu
    let app = create_router(pool);

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

fn create_router(pool: DatabasePool) -> Router {
    let api_routes = Router::new()
        .route("/health", get(health_check));

    let app = Router::new()
        .nest("/api", api_routes)
        .with_state(pool);

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
