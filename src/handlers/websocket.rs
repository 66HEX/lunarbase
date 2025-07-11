use axum::{
    extract::{ws::WebSocketUpgrade, State, Request, Query},
    response::Response,
    response::Json,
};
use serde::Deserialize;

use crate::{
    AppState,
    middleware::extract_user_claims,
    utils::{AuthError, ApiResponse},
    services::WebSocketStats,
};

/// Query parameters for WebSocket connection
#[derive(Debug, Deserialize)]
pub struct WebSocketQuery {
    /// Optional authentication token
    token: Option<String>,
}

/// Handle WebSocket connection upgrade
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(app_state): State<AppState>,
    Query(params): Query<WebSocketQuery>,
    request: Request,
) -> Result<Response, AuthError> {
    // Extract user information from token if provided
    let user_id = if let Some(token) = params.token {
        // Create a modified request with Authorization header for token extraction
        let mut headers = request.headers().clone();
        headers.insert(
            "authorization",
            format!("Bearer {}", token).parse().unwrap(),
        );
        
        // Extract user claims from token
        match app_state.auth_state.jwt_service.validate_access_token(&token) {
            Ok(claims) => Some(claims.sub.parse::<i32>().unwrap_or_default()),
            Err(_) => {
                // Invalid token - allow anonymous connection
                None
            }
        }
    } else {
        // Check if Authorization header is present
        match extract_user_claims(&request) {
            Ok(claims) => Some(claims.sub.parse::<i32>().unwrap_or_default()),
            Err(_) => None, // Allow anonymous connections
        }
    };

    // Upgrade to WebSocket and handle connection
    let websocket_service = std::sync::Arc::new(app_state.websocket_service.clone());
    Ok(ws.on_upgrade(move |socket| {
        websocket_service.clone().handle_connection(socket, user_id)
    }))
}

/// Get WebSocket connection statistics (Admin only)
pub async fn websocket_stats(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<WebSocketStats>>, AuthError> {
    // Extract and verify user claims
    let claims = extract_user_claims(&request)?;
    
    // Get user from database to check admin status
    use diesel::prelude::*;
    use crate::schema::users;
    use crate::models::User;

    let mut conn = app_state.db_pool.get().map_err(|_| AuthError::DatabaseError)?;
    
    let user_id: i32 = claims.sub.parse()
        .map_err(|_| AuthError::TokenInvalid)?;
    
    let user: User = users::table
        .find(user_id)
        .first(&mut conn)
        .map_err(|_| AuthError::TokenInvalid)?;

    // Check if user is admin
    if user.role != "admin" {
        return Err(AuthError::Forbidden("Admin access required".to_string()));
    }

    // Get WebSocket statistics
    let stats = app_state.websocket_service.get_stats().await;
    
    Ok(Json(ApiResponse::success(stats)))
}

/// Get WebSocket connection count (public endpoint)
pub async fn websocket_status(
    State(app_state): State<AppState>,
) -> Result<Json<ApiResponse<WebSocketStatus>>, AuthError> {
    let connection_count = app_state.websocket_service.connection_count().await;
    let subscription_count = app_state.websocket_service.subscription_count().await;
    
    let status = WebSocketStatus {
        connections: connection_count,
        subscriptions: subscription_count,
        status: "operational".to_string(),
    };
    
    Ok(Json(ApiResponse::success(status)))
}

#[derive(Debug, serde::Serialize)]
pub struct WebSocketStatus {
    pub connections: usize,
    pub subscriptions: usize,
    pub status: String,
} 