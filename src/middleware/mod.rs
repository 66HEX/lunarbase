use crate::AppState;
use crate::services::configuration_manager::ConfigurationAccess;
use crate::cli::commands::serve::ServeArgs;
use axum::{Router, extract::DefaultBodyLimit, middleware};
use tower_http::cors::CorsLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tracing::{Level, debug};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub mod auth;
pub mod compression;
pub mod metrics;
pub mod security_headers;

pub use auth::*;
pub use compression::*;
pub use metrics::*;
pub use security_headers::*;

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

    let governor_conf = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(50)  
            .burst_size(50)   
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .unwrap()
    );
    let governor_layer = GovernorLayer::new(governor_conf);

    let mut router = app;

    if let Some(args) = serve_args {
        if args.compression || app_state.get_compression_enabled().await {
            let compression_config = build_compression_config(&app_state, args).await;
            if let Ok(compression_layer) = create_compression_layer(&compression_config) {
                debug!("Adding compression layer");
                router = router.layer(compression_layer);
            }
        }
        
        if args.security_headers || app_state.get_security_headers_enabled().await {
            let security_config = build_security_headers_config(&app_state, args).await;
            debug!("Adding security headers middleware");
            router = router.layer(middleware::from_fn(move |req, next| {
                let config = security_config.clone();
                async move { security_headers_middleware(config, req, next).await }
            }));
        }
    } else {
        if app_state.get_compression_enabled().await {
            let compression_config = build_compression_config_from_db(&app_state).await;
            if let Ok(compression_layer) = create_compression_layer(&compression_config) {
                debug!("Adding compression layer from database config");
                router = router.layer(compression_layer);
            }
        }
        
        if app_state.get_security_headers_enabled().await {
            let security_config = build_security_headers_config_from_db(&app_state).await;
            debug!("Adding security headers middleware from database config");
            router = router.layer(middleware::from_fn(move |req, next| {
                let config = security_config.clone();
                async move { security_headers_middleware(config, req, next).await }
            }));
        }
    }

    router = router
        .layer(governor_layer)
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

async fn build_security_headers_config(app_state: &AppState, args: &ServeArgs) -> SecurityHeadersConfig {
    let enabled = args.security_headers || app_state.get_security_headers_enabled().await;
    let strict_mode = args.security_headers_strict;
    
    if strict_mode {
        return SecurityHeadersConfig::production();
    }
    
    let hsts_enabled = !args.no_hsts && app_state.get_hsts_enabled().await;
    let hsts_max_age = if args.hsts_max_age > 0 { args.hsts_max_age } else { app_state.get_hsts_max_age().await };
    
    let frame_policy = args.frame_options.as_ref()
        .map(|policy| match policy.to_lowercase().as_str() {
            "deny" => FrameOptionsPolicy::Deny,
            "sameorigin" => FrameOptionsPolicy::SameOrigin,
            uri if uri.starts_with("allow-from:") => {
                FrameOptionsPolicy::AllowFrom(uri.strip_prefix("allow-from:").unwrap_or("").to_string())
            }
            _ => FrameOptionsPolicy::Deny,
        });
    
    let frame_policy = if let Some(policy) = frame_policy {
        policy
    } else {
        let db_policy = app_state.get_frame_options_policy().await;
        match db_policy.to_uppercase().as_str() {
            "SAMEORIGIN" => FrameOptionsPolicy::SameOrigin,
            "DENY" => FrameOptionsPolicy::Deny,
            uri if uri.starts_with("ALLOW-FROM ") => {
                FrameOptionsPolicy::AllowFrom(uri.strip_prefix("ALLOW-FROM ").unwrap_or("").to_string())
            }
            _ => FrameOptionsPolicy::Deny,
        }
    };
    
    let csp_policy = if let Some(policy) = args.csp_policy.clone() {
        policy
    } else {
        app_state.get_csp_policy().await
    };
    
    SecurityHeadersConfig {
        enabled,
        hsts: HstsConfig {
            enabled: hsts_enabled,
            max_age: hsts_max_age,
            include_subdomains: app_state.get_hsts_include_subdomains().await,
            preload: app_state.get_hsts_preload().await,
        },
        content_type_options: app_state.get_content_type_options().await,
        frame_options: FrameOptionsConfig {
            enabled: app_state.get_frame_options_enabled().await,
            policy: frame_policy,
        },
        xss_protection: app_state.get_xss_protection().await,
        csp: CspConfig {
            enabled: app_state.get_csp_enabled().await,
            policy: csp_policy,
            report_only: args.csp_report_only || app_state.get_csp_report_only().await,
        },
        referrer_policy: ReferrerPolicyConfig {
            enabled: app_state.get_referrer_policy_enabled().await,
            policy: parse_referrer_policy(&app_state.get_referrer_policy().await),
        },
        permissions_policy: PermissionsPolicyConfig {
            enabled: app_state.get_permissions_policy_enabled().await,
            policy: app_state.get_permissions_policy().await,
        },
    }
}

async fn build_security_headers_config_from_db(app_state: &AppState) -> SecurityHeadersConfig {
    let db_policy = app_state.get_frame_options_policy().await;
    let frame_policy = match db_policy.to_uppercase().as_str() {
        "SAMEORIGIN" => FrameOptionsPolicy::SameOrigin,
        "DENY" => FrameOptionsPolicy::Deny,
        uri if uri.starts_with("ALLOW-FROM ") => {
            FrameOptionsPolicy::AllowFrom(uri.strip_prefix("ALLOW-FROM ").unwrap_or("").to_string())
        }
        _ => FrameOptionsPolicy::Deny,
    };
    
    SecurityHeadersConfig {
        enabled: app_state.get_security_headers_enabled().await,
        hsts: HstsConfig {
            enabled: app_state.get_hsts_enabled().await,
            max_age: app_state.get_hsts_max_age().await,
            include_subdomains: app_state.get_hsts_include_subdomains().await,
            preload: app_state.get_hsts_preload().await,
        },
        content_type_options: app_state.get_content_type_options().await,
        frame_options: FrameOptionsConfig {
            enabled: app_state.get_frame_options_enabled().await,
            policy: frame_policy,
        },
        xss_protection: app_state.get_xss_protection().await,
        csp: CspConfig {
            enabled: app_state.get_csp_enabled().await,
            policy: app_state.get_csp_policy().await,
            report_only: app_state.get_csp_report_only().await,
        },
        referrer_policy: ReferrerPolicyConfig {
            enabled: app_state.get_referrer_policy_enabled().await,
            policy: parse_referrer_policy(&app_state.get_referrer_policy().await),
        },
        permissions_policy: PermissionsPolicyConfig {
            enabled: app_state.get_permissions_policy_enabled().await,
            policy: app_state.get_permissions_policy().await,
        },
    }
}

fn parse_referrer_policy(policy_str: &str) -> ReferrerPolicy {
    match policy_str {
        "no-referrer" => ReferrerPolicy::NoReferrer,
        "no-referrer-when-downgrade" => ReferrerPolicy::NoReferrerWhenDowngrade,
        "origin" => ReferrerPolicy::Origin,
        "origin-when-cross-origin" => ReferrerPolicy::OriginWhenCrossOrigin,
        "same-origin" => ReferrerPolicy::SameOrigin,
        "strict-origin" => ReferrerPolicy::StrictOrigin,
        "strict-origin-when-cross-origin" => ReferrerPolicy::StrictOriginWhenCrossOrigin,
        "unsafe-url" => ReferrerPolicy::UnsafeUrl,
        _ => ReferrerPolicy::StrictOriginWhenCrossOrigin,
    }
}
