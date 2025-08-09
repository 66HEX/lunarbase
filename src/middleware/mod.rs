use crate::AppState;
use crate::services::configuration_manager::ConfigurationAccess;
use axum::{Router, middleware};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod auth;
pub mod metrics;

pub use auth::*;
pub use metrics::*;

pub fn setup_logging() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lunarbase=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}

pub async fn setup_cors(app_state: &AppState) -> CorsLayer {
    // Get CORS origins from configuration
    let mut cors_origins = app_state.auth_state.get_cors_allowed_origins().await;

    // Add required origins for external services
    cors_origins.extend(vec![
        "https://lh3.googleusercontent.com".to_string(),
        "https://avatars.githubusercontent.com".to_string(),
    ]);

    // Parse origins
    let parsed_origins: Vec<_> = cors_origins
        .iter()
        .filter_map(|origin| origin.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(parsed_origins)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::COOKIE,
            axum::http::header::REFERRER_POLICY,
        ])
        .allow_credentials(true)
        .expose_headers([axum::http::header::CONTENT_SECURITY_POLICY])
}

pub async fn add_middleware(app: Router, app_state: AppState) -> Router {
    let cors_layer = setup_cors(&app_state).await;
    let mut router = app.layer(cors_layer).layer(TraceLayer::new_for_http());

    // Skip metrics layer in test environment to avoid global recorder conflicts
    if !cfg!(test) {
        router = router
            .layer(setup_metrics_layer())
            .layer(middleware::from_fn_with_state(
                app_state.clone(),
                metrics_middleware,
            ));
    }

    router
}
