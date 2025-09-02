use axum::{
    Router, middleware,
    routing::{delete, get, post, put},
};
use axum::{
    body::Body,
    http::{Request, Response},
};
use axum_server::tls_rustls::RustlsConfig;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use rustls::ServerConfig;
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::convert::Infallible;
use std::fs::File;
use std::future::Future;
use std::io::BufReader;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::task::{Context, Poll};
use tokio::signal;
use tower::Service;
use tower::layer::Layer;
use tracing::{info, warn};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::cli::commands::serve::ServeArgs;
use crate::database::{create_pool, create_pool_with_size};
use crate::services::{ConfigurationAccess, ConfigurationManager};

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

#[derive(Clone)]
struct ConnectionTracker {
    tls_connections: Arc<AtomicUsize>,
    http2_connections: Arc<AtomicUsize>,
    metrics_state: crate::middleware::MetricsState,
}

impl ConnectionTracker {
    fn new(metrics_state: crate::middleware::MetricsState) -> Self {
        Self {
            tls_connections: Arc::new(AtomicUsize::new(0)),
            http2_connections: Arc::new(AtomicUsize::new(0)),
            metrics_state,
        }
    }

    fn increment_tls(&self) {
        let count = self.tls_connections.fetch_add(1, Ordering::SeqCst) + 1;
        self.metrics_state.tls_connections.set(count as f64);
    }

    fn decrement_tls(&self) {
        let count = self
            .tls_connections
            .fetch_sub(1, Ordering::SeqCst)
            .saturating_sub(1);
        self.metrics_state.tls_connections.set(count as f64);
    }

    fn increment_http2(&self) {
        let count = self.http2_connections.fetch_add(1, Ordering::SeqCst) + 1;
        self.metrics_state.http2_connections.set(count as f64);
    }

    fn decrement_http2(&self) {
        let count = self
            .http2_connections
            .fetch_sub(1, Ordering::SeqCst)
            .saturating_sub(1);
        self.metrics_state.http2_connections.set(count as f64);
    }
}

#[derive(Clone)]
struct ConnectionTrackingService<S> {
    inner: S,
    tracker: ConnectionTracker,
}

impl<S> ConnectionTrackingService<S> {
    fn new(inner: S, tracker: ConnectionTracker) -> Self {
        Self { inner, tracker }
    }
}

impl<S, ReqBody> Service<Request<ReqBody>> for ConnectionTrackingService<S>
where
    S: Service<Request<ReqBody>, Response = Response<Body>, Error = Infallible>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        let mut inner = self.inner.clone();
        let tracker = self.tracker.clone();

        tracker.increment_tls();
        tracker.increment_http2();

        Box::pin(async move {
            let result = inner.call(req).await;
            tracker.decrement_tls();
            tracker.decrement_http2();
            result
        })
    }
}

#[derive(Clone)]
struct ConnectionTrackingLayer {
    tracker: ConnectionTracker,
}

impl ConnectionTrackingLayer {
    fn new(tracker: ConnectionTracker) -> Self {
        Self { tracker }
    }
}

impl<S> Layer<S> for ConnectionTrackingLayer {
    type Service = ConnectionTrackingService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        ConnectionTrackingService::new(inner, self.tracker.clone())
    }
}

use crate::handlers::{
    avatar_proxy::proxy_avatar,
    backup::{create_manual_backup, get_backup_health},
    collections::{
        create_collection, create_record, delete_collection, delete_record, get_collection,
        get_collection_schema, get_collections_record_counts, get_collections_stats, get_record,
        list_all_records, list_collections, list_records, update_collection, update_record,
    },
    configuration::{
        create_setting, delete_setting, get_all_settings, get_setting, get_settings_by_category,
        reset_setting, update_setting,
    },
    embedded_admin::{serve_embedded_admin_html, serve_embedded_assets},
    forgot_password,
    health::{health_check, public_health_check, simple_health_check},
    image_upload::{delete_image, upload_image},
    login, logout, me,
    metrics::{get_metrics, get_metrics_summary},
    oauth_authorize, oauth_callback,
    ownership::{
        check_record_ownership, get_my_owned_records, get_ownership_stats, get_user_owned_records,
        transfer_record_ownership,
    },
    permissions::{
        create_role, delete_role, get_collection_permissions, get_role,
        get_role_collection_permission, get_user_accessible_collections,
        get_user_collection_permissions, list_roles, set_collection_permission,
        set_user_collection_permission, update_role,
    },
    record_permissions::{
        get_record_permissions, list_record_permissions, remove_record_permission,
        set_record_permission,
    },
    refresh_token, register, register_admin, resend_verification, reset_password,
    users::{create_user, delete_user, get_user, list_users, unlock_user, update_user},
    verify_email, verify_email_get,
    websocket::{
        broadcast_message, disconnect_connection, get_activity, get_connections, websocket_handler,
        websocket_stats, websocket_status,
    },
};
use crate::middleware::{add_middleware_with_args, auth_middleware, setup_logging};
use crate::{ApiDoc, AppState, Config};

pub async fn run_server(serve_args: &ServeArgs) -> Result<(), Box<dyn std::error::Error>> {
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .map_err(|_| "Failed to install default crypto provider")?;

    setup_logging();
    info!("Starting LunarBase server...");

    let config = Config::from_env_with_args(Some(serve_args))?;
    info!("Configuration loaded successfully");
    info!("Server will bind to: {}", serve_args.server_address());

    let initial_pool = create_pool(&config.database_url)?;
    info!("Initial database pool created successfully");

    {
        let mut conn = initial_pool.get()?;
        conn.run_pending_migrations(MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;
        info!("Database migrations completed successfully");
    }

    let config_manager = ConfigurationManager::new(initial_pool.clone());
    config_manager.initialize().await?;

    struct TempConfigAccess {
        config_manager: ConfigurationManager,
    }

    impl ConfigurationAccess for TempConfigAccess {
        fn config_manager(&self) -> &ConfigurationManager {
            &self.config_manager
        }
    }

    let temp_access = TempConfigAccess {
        config_manager: config_manager.clone(),
    };
    let connection_pool_size = temp_access.get_connection_pool_size().await;
    info!("Using connection pool size: {}", connection_pool_size);

    let pool = create_pool_with_size(&config.database_url, connection_pool_size)?;
    info!(
        "Final database pool created with size: {}",
        connection_pool_size
    );

    let app_state = AppState::new(
        pool,
        &config.jwt_secret,
        config.password_pepper.clone(),
        &config,
    )
    .await?;

    if let Err(e) = app_state
        .admin_service
        .ensure_admin_exists(&config, &app_state.password_pepper)
        .await
    {
        warn!("Failed to create admin from environment variables: {}", e);
    }

    let metrics_state_clone = app_state.metrics_state.clone();

    let app = create_router(app_state, serve_args).await;

    let addr = serve_args.server_address().parse::<SocketAddr>()?;
    info!("Server will listen on {}", addr);

    if config.enable_tls.unwrap_or(false) {
        let tls_config = create_tls_config(&config).await?;
        info!("TLS enabled - starting HTTPS server with HTTP/2 support");

        let https_url = format!("https://{}:{}", serve_args.host(), serve_args.port());
        info!("API: {}/api", https_url);
        info!("API Docs: {}/docs", https_url);
        if !serve_args.api_only {
            info!("Admin panel: {}/admin", https_url);
        }

        let connection_tracker = ConnectionTracker::new(metrics_state_clone);
        let tracking_layer = ConnectionTrackingLayer::new(connection_tracker);
        let tracked_app = app.layer(tracking_layer);

        axum_server::bind_rustls(addr, tls_config)
            .serve(tracked_app.into_make_service())
            .await?;
    } else {
        info!("TLS disabled - starting HTTP server (HTTP/1.1 only)");

        let http_url = format!("http://{}:{}", serve_args.host(), serve_args.port());
        info!("API: {}/api", http_url);
        info!("API Docs: {}/docs", http_url);
        if !serve_args.api_only {
            info!("Admin panel: {}/admin", http_url);
        }

        let listener = tokio::net::TcpListener::bind(addr).await?;

        axum::serve(listener, app.into_make_service())
            .with_graceful_shutdown(shutdown_signal())
            .await?;
    }

    info!("Server started successfully");
    info!("Server shutdown complete");
    Ok(())
}

async fn create_tls_config(config: &Config) -> Result<RustlsConfig, Box<dyn std::error::Error>> {
    let cert_path = config
        .tls_cert_path
        .as_ref()
        .ok_or("TLS_CERT_PATH is required when TLS is enabled")?;
    let key_path = config
        .tls_key_path
        .as_ref()
        .ok_or("TLS_KEY_PATH is required when TLS is enabled")?;

    info!("Loading TLS certificate from: {}", cert_path);
    info!("Loading TLS private key from: {}", key_path);

    let cert_file = File::open(cert_path)
        .map_err(|e| format!("Failed to open certificate file {}: {}", cert_path, e))?;
    let mut cert_reader = BufReader::new(cert_file);
    let cert_chain = certs(&mut cert_reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse certificate: {}", e))?;

    if cert_chain.is_empty() {
        return Err("No certificates found in certificate file".into());
    }

    let key_file = File::open(key_path)
        .map_err(|e| format!("Failed to open private key file {}: {}", key_path, e))?;
    let mut key_reader = BufReader::new(key_file);
    let mut keys = pkcs8_private_keys(&mut key_reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to parse private key: {}", e))?;

    if keys.is_empty() {
        return Err("No private keys found in key file".into());
    }

    let private_key = keys.remove(0);

    let tls_config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(cert_chain, private_key.into())
        .map_err(|e| format!("Failed to create TLS config: {}", e))?;

    info!("TLS configuration created successfully with HTTP/2 support");
    Ok(RustlsConfig::from_config(Arc::new(tls_config)))
}

async fn create_router(app_state: AppState, serve_args: &ServeArgs) -> Router {
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
        .route("/auth/forgot-password", post(forgot_password))
        .route("/auth/reset-password", post(reset_password))
        .route("/auth/oauth/{provider}", get(oauth_authorize))
        .route("/auth/oauth/{provider}/callback", get(oauth_callback))
        .route("/avatar-proxy", get(proxy_avatar))
        .route("/metrics", get(get_metrics))
        .route("/metrics/summary", get(get_metrics_summary))
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{id}", get(get_record))
        .route("/ws", get(websocket_handler))
        .route("/ws/status", get(websocket_status));

    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        .route("/auth/logout", post(logout))
        .route("/admin/health", get(health_check))
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        .route(
            "/collections/record-counts",
            get(get_collections_record_counts),
        )
        .route("/records", get(list_all_records))
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{id}", put(update_record))
        .route("/collections/{name}/records/{id}", delete(delete_record))
        .route("/permissions/roles", post(create_role))
        .route("/permissions/roles", get(list_roles))
        .route("/permissions/roles/{role_name}", get(get_role))
        .route("/permissions/roles/{role_name}", put(update_role))
        .route("/permissions/roles/{role_name}", delete(delete_role))
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
        .route("/users", get(list_users))
        .route("/users", post(create_user))
        .route("/users/{user_id}", get(get_user))
        .route("/users/{user_id}", put(update_user))
        .route("/users/{user_id}", delete(delete_user))
        .route("/users/{user_id}/unlock", post(unlock_user))
        .route("/ws/stats", get(websocket_stats))
        .route("/ws/connections", get(get_connections))
        .route(
            "/ws/connections/{connection_id}",
            delete(disconnect_connection),
        )
        .route("/ws/broadcast", post(broadcast_message))
        .route("/ws/activity", get(get_activity))
        .route("/admin/configuration", get(get_all_settings))
        .route(
            "/admin/configuration/{category}",
            get(get_settings_by_category),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}",
            get(get_setting),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}",
            put(update_setting),
        )
        .route("/admin/configuration", post(create_setting))
        .route(
            "/admin/configuration/{category}/{setting_key}",
            delete(delete_setting),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}/reset",
            post(reset_setting),
        )
        .route("/admin/backup", post(create_manual_backup))
        .route("/admin/backup/health", get(get_backup_health))
        .route("/upload-image", post(upload_image))
        .route("/delete-image", delete(delete_image))
        .layer(middleware::from_fn_with_state(
            app_state.auth_state.clone(),
            auth_middleware,
        ));

    let api_routes = Router::new().merge(public_routes).merge(protected_routes);

    let swagger_router = SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi());

    let mut app = Router::new().nest("/api", api_routes).merge(swagger_router);

    if !serve_args.api_only {
        app = app
            .route("/admin", get(serve_embedded_admin_html))
            .route("/admin/", get(serve_embedded_admin_html))
            .route("/admin/{*path}", get(serve_embedded_assets));
    }

    let app = app
        .route("/metrics", get(get_metrics))
        .route("/metrics/summary", get(get_metrics_summary))
        .with_state(app_state.clone());

    add_middleware_with_args(app, app_state, Some(serve_args)).await
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
