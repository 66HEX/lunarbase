use axum::{
    http::{header, Method},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod auth;
pub mod permissions;

pub use auth::*;
pub use permissions::*;

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
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
}

pub fn add_middleware(router: Router) -> Router {
    router
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .layer(setup_cors())
} 