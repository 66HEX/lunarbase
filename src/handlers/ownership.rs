use crate::utils::ErrorResponse;
use axum::{
    Extension,
    extract::{Path, Query, State},
    response::Json,
};
use serde::Deserialize;
use serde_json::{Value, json};
use utoipa::ToSchema;

use crate::{
    AppState,
    models::User,
    utils::{ApiResponse, AuthError, Claims},
};

// Helper function to convert Claims to User for ownership checks
async fn claims_to_user(claims: &Claims, state: &AppState) -> Result<User, AuthError> {
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| AuthError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

    users::table
        .filter(users::id.eq(user_id))
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TransferOwnershipRequest {
    pub new_owner_id: i32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GetOwnedRecordsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Transfer ownership of a record
#[utoipa::path(
    post,
    path = "/collections/{collection_name}/records/{record_id}/ownership/transfer",
    tag = "Ownership",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    request_body = TransferOwnershipRequest,
    responses(
        (status = 200, description = "Ownership transferred successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn transfer_record_ownership(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    Json(request): Json<TransferOwnershipRequest>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for ownership service
    let user = claims_to_user(&claims, &state).await?;

    // Get the current record to check ownership
    let record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    // Transfer ownership
    state
        .ownership_service
        .transfer_ownership(
            &user,
            &record,
            request.new_owner_id,
            &collection_name,
            record_id,
        )
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "message": "Ownership transferred successfully",
        "collection_name": collection_name,
        "record_id": record_id,
        "previous_owner_id": user.id,
        "new_owner_id": request.new_owner_id
    }))))
}

/// Get records owned by the current user
#[utoipa::path(
    get,
    path = "/collections/{collection_name}/ownership/my-records",
    tag = "Ownership",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("limit" = Option<i64>, Query, description = "Maximum number of records to return"),
        ("offset" = Option<i64>, Query, description = "Number of records to skip")
    ),
    responses(
        (status = 200, description = "Owned records retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_my_owned_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
    Query(params): Query<GetOwnedRecordsQuery>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for ownership service
    let user = claims_to_user(&claims, &state).await?;

    let owned_record_ids = state
        .ownership_service
        .get_owned_records(&user, &collection_name, params.limit, params.offset)
        .await?;

    // Get full record details for owned records
    let mut owned_records = Vec::new();
    for record_id in owned_record_ids {
        if let Ok(record) = state
            .collection_service
            .get_record(&collection_name, record_id)
            .await
        {
            owned_records.push(record);
        }
    }

    Ok(Json(ApiResponse::success(json!({
        "collection_name": collection_name,
        "user_id": user.id,
        "total_owned": owned_records.len(),
        "records": owned_records
    }))))
}

/// Get records owned by a specific user (admin only)
#[utoipa::path(
    get,
    path = "/collections/{collection_name}/ownership/users/{user_id}/records",
    tag = "Ownership",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("user_id" = i32, Path, description = "User ID"),
        ("limit" = Option<i64>, Query, description = "Maximum number of records to return"),
        ("offset" = Option<i64>, Query, description = "Number of records to skip")
    ),
    responses(
        (status = 200, description = "User owned records retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_owned_records(
    State(state): State<AppState>,
    Extension(requesting_claims): Extension<Claims>,
    Path((collection_name, user_id)): Path<(String, i32)>,
    Query(params): Query<GetOwnedRecordsQuery>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Only admins can view other users' owned records
    if requesting_claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get the target user
    use crate::schema::users;
    use diesel::prelude::*;
    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

    let target_user = users::table
        .filter(users::id.eq(user_id))
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))?;

    let owned_record_ids = state
        .ownership_service
        .get_owned_records(&target_user, &collection_name, params.limit, params.offset)
        .await?;

    // Get full record details for owned records
    let mut owned_records = Vec::new();
    for record_id in owned_record_ids {
        if let Ok(record) = state
            .collection_service
            .get_record(&collection_name, record_id)
            .await
        {
            owned_records.push(record);
        }
    }

    Ok(Json(ApiResponse::success(json!({
        "collection_name": collection_name,
        "user_id": user_id,
        "username": target_user.username,
        "total_owned": owned_records.len(),
        "records": owned_records
    }))))
}

/// Check if current user owns a specific record
#[utoipa::path(
    get,
    path = "/collections/{collection_name}/records/{record_id}/ownership",
    tag = "Ownership",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    responses(
        (status = 200, description = "Ownership status retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn check_record_ownership(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for ownership service
    let user = claims_to_user(&claims, &state).await?;

    // Get the record
    let record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    // Check ownership
    let is_owner = state.ownership_service.check_ownership(&user, &record)?;

    let ownership_permissions = state
        .ownership_service
        .get_ownership_permissions(&user, &record)?;

    Ok(Json(ApiResponse::success(json!({
        "collection_name": collection_name,
        "record_id": record_id,
        "user_id": user.id,
        "is_owner": is_owner,
        "ownership_permissions": {
            "can_read": ownership_permissions.can_read,
            "can_update": ownership_permissions.can_update,
            "can_delete": ownership_permissions.can_delete,
        }
    }))))
}

// Set ownership when creating a record (internal helper)
pub async fn set_record_ownership_on_create(
    user: &User,
    record_data: &mut Value,
    state: &AppState,
) -> Result<(), AuthError> {
    state
        .ownership_service
        .set_record_ownership(user, record_data)?;

    Ok(())
}

// Get ownership statistics for admin
/// Get ownership statistics for a collection
#[utoipa::path(
    get,
    path = "/collections/{collection_name}/ownership/stats",
    tag = "Ownership",
    params(
        ("collection_name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "Ownership statistics retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_ownership_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Only admins can view ownership statistics
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Get basic stats
    use diesel::prelude::*;
    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

    let table_name = format!("records_{}", collection_name);

    // Count total records
    let total_records_query = format!("SELECT COUNT(*) as count FROM {}", table_name);

    #[derive(QueryableByName)]
    struct CountResult {
        #[diesel(sql_type = diesel::sql_types::BigInt)]
        count: i64,
    }

    let total_records = diesel::sql_query(&total_records_query)
        .load::<CountResult>(&mut conn)
        .map_err(|_| AuthError::InternalError)?
        .into_iter()
        .next()
        .map(|r| r.count)
        .unwrap_or(0);

    // Count records with ownership (have user_id)
    let owned_records_query = format!(
        "SELECT COUNT(*) as count FROM {} WHERE user_id IS NOT NULL",
        table_name
    );

    let owned_records = diesel::sql_query(&owned_records_query)
        .load::<CountResult>(&mut conn)
        .unwrap_or_default()
        .into_iter()
        .next()
        .map(|r| r.count)
        .unwrap_or(0);

    let ownership_percentage = if total_records > 0 {
        (owned_records as f64 / total_records as f64) * 100.0
    } else {
        0.0
    };

    Ok(Json(ApiResponse::success(json!({
        "collection_name": collection_name,
        "collection_id": collection.id,
        "total_records": total_records,
        "owned_records": owned_records,
        "unowned_records": total_records - owned_records,
        "ownership_percentage": ownership_percentage,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))))
}
