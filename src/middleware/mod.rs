use crate::AppState;
use crate::services::configuration_manager::ConfigurationAccess;
use axum::{Router, extract::DefaultBodyLimit, middleware};
use tower_http::cors::CorsLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use tracing::Level;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod auth;
pub mod metrics;

pub use auth::*;
pub use metrics::*;

pub fn setup_logging() {
    let default_filter = if cfg!(debug_assertions) {
        "lunarbase=debug,tower_http=debug"
    } else {
        "lunarbase=info,tower_http=info"
    };

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| default_filter.into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_thread_ids(true)
                .with_line_number(true)
                .with_file(true),
        )
        .init();
}

pub async fn setup_cors(app_state: &AppState) -> CorsLayer {
    let mut cors_origins = app_state.auth_state.get_cors_allowed_origins().await;

    cors_origins.extend(vec![
        "https://lh3.googleusercontent.com".to_string(),
        "https://avatars.githubusercontent.com".to_string(),
    ]);

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

    let trace_layer = TraceLayer::new_for_http()
        .make_span_with(DefaultMakeSpan::new().level(Level::DEBUG))
        .on_response(
            DefaultOnResponse::new()
                .level(Level::DEBUG)
                .latency_unit(tower_http::LatencyUnit::Micros),
        );

    let mut router = app
        .layer(cors_layer)
        .layer(trace_layer)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024));

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
