use crate::utils::ErrorResponse;
use axum::{
    Extension,
    extract::{Path, Query, State},
    response::Json,
};
use serde_json::{Value, json};
use std::collections::HashMap;

use crate::{
    AppState,
    models::{
        CollectionPermission, CreateRoleRequest, Role, SetCollectionPermissionRequest,
        SetUserCollectionPermissionRequest, User, UserCollectionPermission,
    },
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
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))
}

// Role management endpoints
/// Create a new role
#[utoipa::path(
    post,
    path = "/permissions/roles",
    tag = "Permissions",
    request_body = CreateRoleRequest,
    responses(
        (status = 201, description = "Role created successfully", body = ApiResponse<Role>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(role_request): Json<CreateRoleRequest>,
) -> Result<Json<ApiResponse<Role>>, AuthError> {
    // Only admins can create roles
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Validate role request
    role_request
        .validate()
        .map_err(AuthError::ValidationError)?;

    let role = state.permission_service.create_role(&role_request).await?;

    Ok(Json(ApiResponse::success(role)))
}

/// List all roles
#[utoipa::path(
    get,
    path = "/permissions/roles",
    tag = "Permissions",
    responses(
        (status = 200, description = "Roles retrieved successfully", body = ApiResponse<Vec<Role>>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_roles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ApiResponse<Vec<Role>>>, AuthError> {
    // Only admins can list roles
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let roles = state.permission_service.list_roles().await?;

    Ok(Json(ApiResponse::success(roles)))
}

/// Get role by name
#[utoipa::path(
    get,
    path = "/permissions/roles/{role_name}",
    tag = "Permissions",
    params(
        ("role_name" = String, Path, description = "Role name")
    ),
    responses(
        (status = 200, description = "Role retrieved successfully", body = ApiResponse<Role>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Role not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(role_name): Path<String>,
) -> Result<Json<ApiResponse<Role>>, AuthError> {
    // Only admins can get role details
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let role = state
        .permission_service
        .get_role_by_name(&role_name)
        .await?;

    Ok(Json(ApiResponse::success(role)))
}

#[utoipa::path(
    get,
    path = "/permissions/roles/{role_name}/collections/{collection_name}",
    params(
        ("role_name" = String, Path, description = "Role name"),
        ("collection_name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "Role collection permission retrieved successfully", body = ApiResponse<CollectionPermission>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "Role or collection not found")
    ),
    security(
        ("bearer_auth" = [])
    ),
    tag = "Permissions"
)]
pub async fn get_role_collection_permission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((role_name, collection_name)): Path<(String, String)>,
) -> Result<Json<ApiResponse<CollectionPermission>>, AuthError> {
    // Only admins can get role collection permissions
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Get role collection permission
    let permission = state
        .permission_service
        .get_role_collection_permission(&role_name, collection.id)
        .await?;

    if let Some(permission) = permission {
        Ok(Json(ApiResponse::success(permission)))
    } else {
        Err(AuthError::NotFound("Permission not found".to_string()))
    }
}

// Collection permission management
/// Set collection permissions for a role
#[utoipa::path(
    post,
    path = "/permissions/collections/{collection_name}",
    tag = "Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name")
    ),
    request_body = SetCollectionPermissionRequest,
    responses(
        (status = 200, description = "Collection permission set successfully", body = ApiResponse<CollectionPermission>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn set_collection_permission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
    Json(permission_request): Json<SetCollectionPermissionRequest>,
) -> Result<Json<ApiResponse<CollectionPermission>>, AuthError> {
    // Only admins can set collection permissions
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Get role by name to get role_id
    let role = state
        .permission_service
        .get_role_by_name(&permission_request.role_name)
        .await?;

    let permission = state
        .permission_service
        .set_collection_permission(collection.id, role.id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

/// Get collection permissions
#[utoipa::path(
    get,
    path = "/permissions/collections/{collection_name}",
    tag = "Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("role_name" = Option<String>, Query, description = "Role name to get permissions for")
    ),
    responses(
        (status = 200, description = "Collection permissions retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_collection_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Only admins can view collection permissions
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Check if role_name is provided in query parameters
    if let Some(role_name) = params.get("role_name") {
        // Get role collection permission
        let permission = state
            .permission_service
            .get_role_collection_permission(role_name, collection.id)
            .await?;

        if let Some(permission) = permission {
            Ok(Json(ApiResponse::success(json!({
                "collection_id": collection.id,
                "collection_name": collection.name,
                "role_name": role_name,
                "permissions": {
                    "can_create": permission.can_create,
                    "can_read": permission.can_read,
                    "can_update": permission.can_update,
                    "can_delete": permission.can_delete,
                    "can_list": permission.can_list,
                }
            }))))
        } else {
            Err(AuthError::NotFound("Permission not found".to_string()))
        }
    } else {
        // Convert claims to user for permission service
        let user = claims_to_user(&claims, &state).await?;

        // Get user's permissions for this collection
        let user_permissions = state
            .permission_service
            .get_user_collection_permissions(&user, collection.id)
            .await?;

        Ok(Json(ApiResponse::success(json!({
            "collection_id": collection.id,
            "collection_name": collection.name,
            "permissions": {
                "can_create": user_permissions.can_create,
                "can_read": user_permissions.can_read,
                "can_update": user_permissions.can_update,
                "can_delete": user_permissions.can_delete,
                "can_list": user_permissions.can_list,
            }
        }))))
    }
}

// User-specific permission management
/// Set collection permissions for a specific user
#[utoipa::path(
    post,
    path = "/api/permissions/users/{user_id}/collections/{collection_name}",
    tag = "Permissions",
    params(
        ("user_id" = i32, Path, description = "User ID"),
        ("collection_name" = String, Path, description = "Collection name")
    ),
    request_body = SetUserCollectionPermissionRequest,
    responses(
        (status = 200, description = "User collection permission set successfully", body = ApiResponse<UserCollectionPermission>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "User or collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn set_user_collection_permission(
    State(state): State<AppState>,
    Extension(admin_claims): Extension<Claims>,
    Path((user_id, collection_name)): Path<(i32, String)>,
    Json(permission_request): Json<SetUserCollectionPermissionRequest>,
) -> Result<Json<ApiResponse<UserCollectionPermission>>, AuthError> {
    // Only admins can set user-specific permissions
    if admin_claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    let permission = state
        .permission_service
        .set_user_collection_permission(user_id, collection.id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

/// Get collection permissions for a specific user
#[utoipa::path(
    get,
    path = "/api/permissions/users/{user_id}/collections/{collection_name}",
    tag = "Permissions",
    params(
        ("user_id" = i32, Path, description = "User ID"),
        ("collection_name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "User collection permissions retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "User or collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_collection_permissions(
    State(state): State<AppState>,
    Extension(requesting_claims): Extension<Claims>,
    Path((user_id, collection_name)): Path<(i32, String)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    let requesting_user_id: i32 = requesting_claims
        .sub
        .parse()
        .map_err(|_| AuthError::TokenInvalid)?;

    // Users can only view their own permissions, admins can view anyone's
    if requesting_claims.role != "admin" && requesting_user_id != user_id {
        return Err(AuthError::InsufficientPermissions);
    }

    // Get collection
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    // Convert claims to user for permission service
    let requesting_user = claims_to_user(&requesting_claims, &state).await?;

    // For the target user, get their User object to check permissions
    let target_user = if requesting_user_id == user_id {
        requesting_user
    } else {
        // For admin requests, fetch the target user
        use crate::schema::users;
        use diesel::prelude::*;
        let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;

        users::table
            .filter(users::id.eq(user_id))
            .first::<User>(&mut conn)
            .map_err(|_| AuthError::NotFound("Target user not found".to_string()))?
    };

    let permissions = state
        .permission_service
        .get_user_collection_permissions(&target_user, collection.id)
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "user_id": user_id,
        "collection_id": collection.id,
        "collection_name": collection.name,
        "permissions": {
            "can_create": permissions.can_create,
            "can_read": permissions.can_read,
            "can_update": permissions.can_update,
            "can_delete": permissions.can_delete,
            "can_list": permissions.can_list,
        }
    }))))
}

/// Get user's accessible collections
#[utoipa::path(
    get,
    path = "/permissions/users/me/collections",
    tag = "Permissions",
    responses(
        (status = 200, description = "User accessible collections retrieved successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_accessible_collections(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for permission service
    let user = claims_to_user(&claims, &state).await?;

    let accessible_collection_ids = state
        .permission_service
        .get_user_accessible_collections(&user)
        .await?;

    // Get collection details for accessible collections
    let mut accessible_collections = Vec::new();
    for collection_id in accessible_collection_ids {
        if let Ok(collection) = state
            .collection_service
            .get_collection_by_id(collection_id)
            .await
        {
            let permissions = state
                .permission_service
                .get_user_collection_permissions(&user, collection_id)
                .await?;

            // Use schema directly from CollectionResponse
            let schema = &collection.schema;

            accessible_collections.push(json!({
                "id": collection.id,
                "name": collection.name,
                "display_name": collection.display_name,
                "description": collection.description,
                "schema": schema,
                "is_system": collection.is_system,
                "created_at": collection.created_at.to_string(),
                "updated_at": collection.updated_at.to_string(),
                "permissions": {
                    "can_create": permissions.can_create,
                    "can_read": permissions.can_read,
                    "can_update": permissions.can_update,
                    "can_delete": permissions.can_delete,
                    "can_list": permissions.can_list,
                }
            }));
        }
    }

    Ok(Json(ApiResponse::success(json!({
        "user_id": user.id,
        "accessible_collections": accessible_collections
    }))))
}

// Permission check endpoint for debugging/testing
/// Check specific permission for a collection
#[utoipa::path(
    get,
    path = "/permissions/collections/{collection_name}/check/{permission_type}",
    tag = "Permissions",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("permission_type" = String, Path, description = "Permission type (create, read, update, delete, list)")
    ),
    responses(
        (status = 200, description = "Permission check completed successfully", body = ApiResponse<Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse),
        (status = 400, description = "Invalid permission type", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn check_permission(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, permission_type)): Path<(String, String)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Convert claims to user for permission service
    let user = claims_to_user(&claims, &state).await?;
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    let permission = match permission_type.as_str() {
        "create" => crate::models::Permission::Create,
        "read" => crate::models::Permission::Read,
        "update" => crate::models::Permission::Update,
        "delete" => crate::models::Permission::Delete,
        "list" => crate::models::Permission::List,
        _ => {
            return Err(AuthError::ValidationError(vec![
                "Invalid permission type".to_string(),
            ]));
        }
    };

    let has_permission = state
        .permission_service
        .check_collection_permission(&user, collection.id, permission)
        .await?;

    Ok(Json(ApiResponse::success(json!({
        "user_id": user.id,
        "collection_name": collection_name,
        "permission": permission_type,
        "has_permission": has_permission
    }))))
}
