use axum::{response::Json, http::StatusCode};
use serde_json::{json, Value};

pub async fn health_check() -> Result<(StatusCode, Json<Value>), StatusCode> {
    let response = json!({
        "status": "ok",
        "message": "IronBase is running",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok((StatusCode::OK, Json(response)))
} 