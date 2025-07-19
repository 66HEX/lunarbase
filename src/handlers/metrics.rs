use axum::{extract::State, http::StatusCode};
use crate::AppState;

/// Prometheus metrics endpoint
/// 
/// This endpoint exposes metrics in Prometheus format for monitoring and observability.
/// Metrics include:
/// - HTTP request counts and durations
/// - Active WebSocket connections
/// - Database connection pool status
/// - Custom application metrics
#[utoipa::path(
    get,
    path = "/metrics",
    tag = "Monitoring",
    responses(
        (status = 200, description = "Prometheus metrics in text format", content_type = "text/plain"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_metrics(
    State(app_state): State<AppState>,
) -> Result<String, StatusCode> {
    // Update database connections metric before returning metrics
    app_state.metrics_state.update_database_connections(&app_state.db_pool);
    
    app_state.metrics_state.get_metrics().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// Get metrics summary for admin dashboard
#[utoipa::path(
    get,
    path = "/admin/metrics/summary",
    tag = "Monitoring",
    responses(
        (status = 200, description = "Metrics summary for dashboard"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_metrics_summary(
    State(app_state): State<AppState>,
) -> Result<axum::Json<serde_json::Value>, StatusCode> {
    // Update database connections metric before returning summary
    app_state.metrics_state.update_database_connections(&app_state.db_pool);
    
    // Get current metric values for dashboard display
    let request_count = app_state.metrics_state.request_counter.get();
    let active_connections = app_state.metrics_state.active_connections.get();
    let db_connections = app_state.metrics_state.database_connections.get();
    
    let summary = serde_json::json!({
        "http_requests_total": request_count,
        "active_websocket_connections": active_connections,
        "database_connections_active": db_connections,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(axum::Json(summary))
}