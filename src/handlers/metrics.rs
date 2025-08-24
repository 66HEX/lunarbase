use crate::AppState;
use axum::{extract::State, http::StatusCode};
use serde::Serialize;
use utoipa::ToSchema;

#[utoipa::path(
    get,
    path = "/metrics",
    tag = "Monitoring",
    responses(
        (status = 200, description = "Prometheus metrics in text format", content_type = "text/plain"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_metrics(State(app_state): State<AppState>) -> Result<String, StatusCode> {
    app_state
        .metrics_state
        .update_database_connections(&app_state.db_pool);

    let websocket_count = app_state.websocket_service.connection_count().await;
    app_state
        .metrics_state
        .active_connections
        .set(websocket_count as f64);

    app_state
        .metrics_state
        .get_metrics()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Serialize, ToSchema)]
pub struct MetricsSummary {
    pub http_requests_total: f64,
    pub active_websocket_connections: f64,
    pub database_connections_active: f64,
    pub http2_connections_active: f64,
    pub tls_connections_active: f64,
    pub backup_operations_total: f64,
    pub backup_failures_total: f64,
    pub backup_cleanup_operations_total: f64,
    pub backup_files_deleted_total: f64,
    pub timestamp: String,
}

#[utoipa::path(
    get,
    path = "/admin/metrics/summary",
    tag = "Monitoring",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Metrics summary for dashboard", body = MetricsSummary,
            example = json!({
                "http_requests_total": 1234.0,
                "active_websocket_connections": 5.0,
                "database_connections_active": 10.0,
                "backup_operations_total": 42.0,
                "backup_failures_total": 2.0,
                "backup_cleanup_operations_total": 15.0,
                "backup_files_deleted_total": 128.0,
                "timestamp": "2024-01-15T10:30:00Z"
            })
        ),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_metrics_summary(
    State(app_state): State<AppState>,
) -> Result<axum::Json<MetricsSummary>, StatusCode> {
    app_state
        .metrics_state
        .update_database_connections(&app_state.db_pool);

    let websocket_count = app_state.websocket_service.connection_count().await;
    app_state
        .metrics_state
        .active_connections
        .set(websocket_count as f64);

    let request_count = app_state.metrics_state.request_counter.get();
    let active_connections = app_state.metrics_state.active_connections.get();
    let db_connections = app_state.metrics_state.database_connections.get();
    let http2_connections = app_state.metrics_state.http2_connections.get();
    let tls_connections = app_state.metrics_state.tls_connections.get();

    let custom_metrics = app_state.metrics_state.custom_metrics.read().await;
    let backup_operations = custom_metrics
        .get("backup_operations_total")
        .map(|c| c.get())
        .unwrap_or(0.0);
    let backup_failures = custom_metrics
        .get("backup_failures_total")
        .map(|c| c.get())
        .unwrap_or(0.0);
    let backup_cleanup_operations = custom_metrics
        .get("backup_cleanup_operations_total")
        .map(|c| c.get())
        .unwrap_or(0.0);
    let backup_files_deleted = custom_metrics
        .get("backup_files_deleted_total")
        .map(|c| c.get())
        .unwrap_or(0.0);

    let summary = MetricsSummary {
        http_requests_total: request_count,
        active_websocket_connections: active_connections,
        database_connections_active: db_connections,
        http2_connections_active: http2_connections,
        tls_connections_active: tls_connections,
        backup_operations_total: backup_operations,
        backup_failures_total: backup_failures,
        backup_cleanup_operations_total: backup_cleanup_operations,
        backup_files_deleted_total: backup_files_deleted,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    Ok(axum::Json(summary))
}
