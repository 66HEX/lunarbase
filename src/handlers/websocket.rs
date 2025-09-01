use crate::utils::ErrorResponse;
use axum::{
    Extension,
    extract::{Path, Query, Request, State, ws::WebSocketUpgrade},
    response::Json,
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    AppState,
    middleware::extract_user_claims,
    services::WebSocketStats,
    utils::{ApiResponse, LunarbaseError},
};

#[derive(Debug, Deserialize)]
pub struct WebSocketQuery {
    token: Option<String>,
}

#[utoipa::path(
    get,
    path = "/ws",
    tag = "WebSocket",
    responses(
        (status = 101, description = "WebSocket connection established"),
        (status = 400, description = "Bad request - WebSocket upgrade failed", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(app_state): State<AppState>,
    Query(params): Query<WebSocketQuery>,
    request: Request,
) -> Result<Response, LunarbaseError> {
    let user_id = if let Some(token) = params.token {
        let mut headers = request.headers().clone();
        headers.insert(
            "authorization",
            format!("Bearer {}", token).parse().unwrap(),
        );

        match app_state
            .auth_state
            .jwt_service
            .validate_access_token(&token)
        {
            Ok(claims) => Some(claims.sub.parse::<i32>().unwrap_or_default()),
            Err(_) => None,
        }
    } else {
        match extract_user_claims(&request) {
            Ok(claims) => Some(claims.sub.parse::<i32>().unwrap_or_default()),
            Err(_) => None,
        }
    };

    let websocket_service = std::sync::Arc::new(app_state.websocket_service.clone());
    Ok(ws.on_upgrade(move |socket| websocket_service.clone().handle_connection(socket, user_id)))
}

#[utoipa::path(
    get,
    path = "/ws/stats",
    tag = "WebSocket",
    responses(
        (status = 200, description = "WebSocket statistics retrieved successfully", body = ApiResponse<WebSocketStats>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn websocket_stats(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<WebSocketStats>>, LunarbaseError> {
    let claims = extract_user_claims(&request)?;

    use crate::models::User;
    use crate::schema::users;
    use diesel::prelude::*;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if user.role != "admin" {
        return Err(LunarbaseError::Forbidden(
            "Admin access required".to_string(),
        ));
    }

    let stats = app_state.websocket_service.get_stats().await;

    Ok(Json(ApiResponse::success(stats)))
}

#[utoipa::path(
    get,
    path = "/ws/status",
    tag = "WebSocket",
    responses(
        (status = 200, description = "WebSocket status retrieved successfully", body = ApiResponse<WebSocketStatus>),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn websocket_status(
    State(app_state): State<AppState>,
) -> Result<Json<ApiResponse<WebSocketStatus>>, LunarbaseError> {
    let connection_count = app_state.websocket_service.connection_count().await;
    let subscription_count = app_state.websocket_service.subscription_count().await;

    let status = WebSocketStatus {
        connections: connection_count,
        subscriptions: subscription_count,
        status: "operational".to_string(),
    };

    Ok(Json(ApiResponse::success(status)))
}

#[utoipa::path(
    get,
    path = "/ws/connections",
    tag = "WebSocket",
    responses(
        (status = 200, description = "Active connections retrieved successfully", body = ApiResponse<ConnectionsResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_connections(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<ConnectionsResponse>>, LunarbaseError> {
    let claims = extract_user_claims(&request)?;

    use crate::models::User;
    use crate::schema::users;
    use diesel::prelude::*;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if user.role != "admin" {
        return Err(LunarbaseError::Forbidden(
            "Admin access required".to_string(),
        ));
    }

    let connections = app_state.websocket_service.get_connection_details().await;
    let total_count = connections.len();

    let response = ConnectionsResponse {
        connections,
        total_count,
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    delete,
    path = "/ws/connections/{connection_id}",
    tag = "WebSocket",
    params(
        ("connection_id" = String, Path, description = "Connection ID to disconnect")
    ),
    responses(
        (status = 200, description = "Connection disconnected successfully"),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Connection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn disconnect_connection(
    State(app_state): State<AppState>,
    Path(connection_id): Path<String>,
    request: Request,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    let claims = extract_user_claims(&request)?;

    use crate::models::User;
    use crate::schema::users;
    use diesel::prelude::*;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if user.role != "admin" {
        return Err(LunarbaseError::Forbidden(
            "Admin access required".to_string(),
        ));
    }

    let conn_uuid = Uuid::parse_str(&connection_id).map_err(|_| {
        LunarbaseError::ValidationError(vec!["Invalid connection ID format".to_string()])
    })?;

    let success = app_state
        .websocket_service
        .disconnect_connection(conn_uuid)
        .await;

    if success {
        Ok(Json(ApiResponse::success(
            "Connection disconnected successfully".to_string(),
        )))
    } else {
        Err(LunarbaseError::NotFound("Connection not found".to_string()))
    }
}

#[utoipa::path(
    post,
    path = "/ws/broadcast",
    tag = "WebSocket",
    request_body = BroadcastRequest,
    responses(
        (status = 200, description = "Message broadcasted successfully", body = ApiResponse<BroadcastResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn broadcast_message(
    State(app_state): State<AppState>,
    Extension(claims): Extension<crate::utils::Claims>,
    Json(broadcast_req): Json<BroadcastRequest>,
) -> Result<Json<ApiResponse<BroadcastResponse>>, LunarbaseError> {
    use crate::models::User;
    use crate::schema::users;
    use diesel::prelude::*;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if user.role != "admin" {
        return Err(LunarbaseError::Forbidden(
            "Admin access required".to_string(),
        ));
    }

    let sent_count = app_state
        .websocket_service
        .broadcast_admin_message(
            &broadcast_req.message,
            broadcast_req.target_users.as_ref(),
            broadcast_req.target_collections.as_ref(),
        )
        .await;

    let response = BroadcastResponse {
        sent_to_connections: sent_count,
        message: broadcast_req.message,
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/ws/activity",
    tag = "WebSocket",
    params(
        ("limit" = Option<usize>, Query, description = "Maximum number of activities to return (default: 100)"),
        ("offset" = Option<usize>, Query, description = "Number of activities to skip (default: 0)")
    ),
    responses(
        (status = 200, description = "Activity log retrieved successfully", body = ApiResponse<ActivityResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_activity(
    State(app_state): State<AppState>,
    Query(params): Query<ActivityQuery>,
    request: Request,
) -> Result<Json<ApiResponse<ActivityResponse>>, LunarbaseError> {
    let claims = extract_user_claims(&request)?;

    use crate::models::User;
    use crate::schema::users;
    use diesel::prelude::*;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let user: User = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if user.role != "admin" {
        return Err(LunarbaseError::Forbidden(
            "Admin access required".to_string(),
        ));
    }

    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);
    let activity = app_state
        .websocket_service
        .get_activity_log(limit, offset)
        .await;

    Ok(Json(ApiResponse::success(activity)))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ActivityQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct WebSocketStatus {
    pub connections: usize,
    pub subscriptions: usize,
    pub status: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ConnectionDetails {
    pub connection_id: String,
    pub user_id: Option<i32>,
    pub connected_at: String,
    pub subscriptions: Vec<SubscriptionInfo>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ConnectionsResponse {
    pub connections: Vec<ConnectionDetails>,
    pub total_count: usize,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct SubscriptionInfo {
    pub subscription_id: String,
    pub collection_name: String,
    pub subscription_type: String,
    pub filters: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize, utoipa::ToSchema)]
pub struct BroadcastRequest {
    pub message: String,
    pub target_users: Option<Vec<i32>>,
    pub target_collections: Option<Vec<String>>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BroadcastResponse {
    pub sent_to_connections: usize,
    pub message: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ActivityEntry {
    pub timestamp: String,
    pub connection_id: String,
    pub user_id: Option<i32>,
    pub action: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct ActivityResponse {
    pub activities: Vec<ActivityEntry>,
    pub total_count: usize,
}
