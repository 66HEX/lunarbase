use crate::utils::ErrorResponse;
use axum::{
    Extension,
    extract::{Path, State},
    response::Json,
};
use serde_json::{Value, json};

use crate::{
    AppState,
    models::{RecordPermission, SetRecordPermissionRequest, User},
    utils::{ApiResponse, AuthError, Claims},
};

// Helper function to convert Claims to User for permission checks
async fn claims_to_user(claims: &Claims, state: &AppState) -> Result<User, AuthError> {
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| AuthError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

    users::table
        .filter(users::id.eq(user_id))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))
}

// Set record-specific permissions
/// Set permissions for a specific record
#[utoipa::path(
    post,
    path = "/permissions/records/{record_id}",
    tag = "Record Permissions",
    params(
        ("record_id" = String, Path, description = "Record ID")
    ),
    request_body = SetRecordPermissionRequest,
    responses(
        (status = 200, description = "Record permission set successfully", body = ApiResponse<RecordPermission>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn set_record_permission(
    State(state): State<AppState>,
    Extension(admin_claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    Json(permission_request): Json<SetRecordPermissionRequest>,
) -> Result<Json<ApiResponse<RecordPermission>>, AuthError> {
    // Only admins can set record permissions
    if admin_claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Verify record exists
    let _record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    let permission = state
        .permission_service
        .set_record_permission(collection.id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

// Get record permissions for a specific user
/// Get permissions for a specific record
#[utoipa::path(
    get,
    path = "/permissions/records/{record_id}",
    tag = "Record Permissions",
    params(
        ("record_id" = String, Path, description = "Record ID")
    ),
    responses(
        (status = 200, description = "Record permissions retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_record_permissions(
    State(state): State<AppState>,
    Extension(requesting_claims): Extension<Claims>,
    Path((collection_name, record_id, user_id)): Path<(String, i32, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    let requesting_user_id: i32 = requesting_claims
        .sub
        .parse()
        .map_err(|_| AuthError::TokenInvalid)?;

    // Users can only view their own record permissions, admins can view anyone's
    if requesting_claims.role != "admin" && requesting_user_id != user_id {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Verify record exists
    let _record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    // For the target user, we need their User object to check permissions
    let target_user = if requesting_user_id == user_id {
        claims_to_user(&requesting_claims, &state).await?
    } else {
        // For admin requests, fetch the target user
        use crate::schema::users;
        use diesel::prelude::*;
        let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

        users::table
            .filter(users::id.eq(user_id))
            .select(User::as_select())
            .first(&mut conn)
            .map_err(|_| AuthError::NotFound("Target user not found".to_string()))?
    };

    // Check each permission type
    let can_read = state
        .permission_service
        .check_record_permission(
            &target_user,
            collection.id,
            record_id,
            crate::models::Permission::Read,
        )
        .await?;

    let can_update = state
        .permission_service
        .check_record_permission(
            &target_user,
            collection.id,
            record_id,
            crate::models::Permission::Update,
        )
        .await?;

    let can_delete = state
        .permission_service
        .check_record_permission(
            &target_user,
            collection.id,
            record_id,
            crate::models::Permission::Delete,
        )
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "user_id": user_id,
        "collection_id": collection.id,
        "collection_name": collection_name,
        "record_id": record_id,
        "permissions": {
            "can_read": can_read,
            "can_update": can_update,
            "can_delete": can_delete,
        }
    }))))
}

/// Get record permissions for a specific user
#[utoipa::path(
    get,
    path = "/permissions/collections/{collection_name}/records/{record_id}/users/{user_id}",
    tag = "Record Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID"),
        ("user_id" = i32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User record permissions retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record or user not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_record_permissions(
    State(state): State<AppState>,
    Extension(admin_claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    Json(permission_request): Json<SetRecordPermissionRequest>,
) -> Result<Json<ApiResponse<RecordPermission>>, AuthError> {
    // Only admins can set record permissions
    if admin_claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Verify record exists
    let _record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    let permission = state
        .permission_service
        .set_record_permission(collection.id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

// Remove record permissions (revoke specific access)
/// Remove permissions for a specific record
#[utoipa::path(
    delete,
    path = "/permissions/collections/{collection_name}/records/{record_id}/users/{user_id}",
    tag = "Record Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID"),
        ("user_id" = i32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "Record permission removed successfully", body = ApiResponse<String>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn remove_record_permission(
    State(state): State<AppState>,
    Extension(admin_claims): Extension<Claims>,
    Path((collection_name, record_id, user_id)): Path<(String, i32, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Only admins can remove record permissions
    if admin_claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Verify record exists
    let _record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    state
        .permission_service
        .remove_record_permission(collection.id, record_id, user_id)
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "message": "Record permission removed",
        "user_id": user_id,
        "collection_name": collection_name,
        "record_id": record_id
    }))))
}

// List all users with specific record permissions
/// List all record permissions for a collection
#[utoipa::path(
    get,
    path = "/permissions/collections/{collection_name}/records",
    tag = "Record Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "Record permissions listed successfully", body = ApiResponse<Vec<RecordPermission>>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_record_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Only admins can list record permissions
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Verify record exists
    let _record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    let permissions_list = state
        .permission_service
        .list_record_permissions(collection.id, record_id)
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "collection_id": collection.id,
        "collection_name": collection_name,
        "record_id": record_id,
        "permissions": permissions_list
    }))))
}

/// Check ownership permissions for a specific record
#[utoipa::path(
    get,
    path = "/permissions/collections/{collection_name}/records/{record_id}/ownership",
    tag = "Record Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    responses(
        (status = 200, description = "Record ownership permissions checked successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn check_record_ownership_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for ownership service
    let user = claims_to_user(&claims, &state).await?;
    // Get collection
    let _collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Get the record to check ownership
    let record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await
        .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

    // Check if record has a user_id field that matches current user
    let is_owner = state
        .permission_service
        .check_record_ownership(&user, &record)
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "user_id": user.id,
        "collection_name": collection_name,
        "record_id": record_id,
        "is_owner": is_owner,
        "can_access_as_owner": is_owner
    }))))
}
