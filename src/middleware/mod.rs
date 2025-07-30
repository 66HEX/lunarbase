use crate::AppState;
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

pub fn setup_cors() -> CorsLayer {
    CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse().unwrap(),
            "http://localhost:5173".parse().unwrap(),
            "http://127.0.0.1:3000".parse().unwrap(),
            "http://127.0.0.1:5173".parse().unwrap(),
            "https://lh3.googleusercontent.com".parse().unwrap(),
            "https://avatars.githubusercontent.com".parse().unwrap(),
        ])
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
        .expose_headers([
            axum::http::header::CONTENT_SECURITY_POLICY,
        ])
}

pub fn add_middleware(app: Router, app_state: AppState) -> Router {
    let mut router = app.layer(setup_cors()).layer(TraceLayer::new_for_http());

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
