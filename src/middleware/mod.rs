use crate::AppState;
use crate::services::configuration_manager::ConfigurationAccess;
use crate::cli::commands::serve::ServeArgs;
use axum::{Router, extract::DefaultBodyLimit, middleware};
use tower_http::cors::CorsLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use tracing::{Level, debug};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod auth;
pub mod compression;
pub mod metrics;

pub use auth::*;
pub use compression::*;
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
    add_middleware_with_args(app, app_state, None).await
}

pub async fn add_middleware_with_args(app: Router, app_state: AppState, serve_args: Option<&ServeArgs>) -> Router {
    let cors_layer = setup_cors(&app_state).await;

    let trace_layer = TraceLayer::new_for_http()
        .make_span_with(DefaultMakeSpan::new().level(Level::DEBUG))
        .on_response(
            DefaultOnResponse::new()
                .level(Level::DEBUG)
                .latency_unit(tower_http::LatencyUnit::Micros),
        );

    let mut router = app;

    if let Some(args) = serve_args {
        if args.compression || app_state.get_compression_enabled().await {
            let compression_config = build_compression_config(&app_state, args).await;
            if let Ok(compression_layer) = create_compression_layer(&compression_config) {
                debug!("Adding compression layer");
                router = router.layer(compression_layer);
            }
        }
    } else {
        if app_state.get_compression_enabled().await {
            let compression_config = build_compression_config_from_db(&app_state).await;
            if let Ok(compression_layer) = create_compression_layer(&compression_config) {
                debug!("Adding compression layer from database config");
                router = router.layer(compression_layer);
            }
        }
    }

    router = router
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

async fn build_compression_config(app_state: &AppState, args: &ServeArgs) -> CompressionConfig {
    let enabled = args.compression || app_state.get_compression_enabled().await;
    let level = if args.compression_level > 0 { args.compression_level } else { app_state.get_compression_level().await };
    let min_size = app_state.get_compression_min_size().await;
    
    let gzip = !args.no_gzip && app_state.get_compression_gzip().await;
    let brotli = !args.no_brotli && app_state.get_compression_brotli().await;
    let deflate = !args.no_deflate && app_state.get_compression_deflate().await;
    
    CompressionConfig {
        enabled,
        level,
        min_size,
        algorithms: CompressionAlgorithms {
            gzip,
            brotli,
            deflate,
        },
    }
}

async fn build_compression_config_from_db(app_state: &AppState) -> CompressionConfig {
    CompressionConfig {
        enabled: app_state.get_compression_enabled().await,
        level: app_state.get_compression_level().await,
        min_size: app_state.get_compression_min_size().await,
        algorithms: CompressionAlgorithms {
            gzip: app_state.get_compression_gzip().await,
            brotli: app_state.get_compression_brotli().await,
            deflate: app_state.get_compression_deflate().await,
        },
    }
}
