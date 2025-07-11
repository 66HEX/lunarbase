use axum::{
    extract::{Path, State},
    response::Json,
    Extension,
};
use serde_json::{json, Value};

use crate::{
    models::{
        User, Role, CollectionPermission, UserCollectionPermission,
        CreateRoleRequest, SetCollectionPermissionRequest,
        SetUserCollectionPermissionRequest,
    },
    utils::{AuthError, ApiResponse, Claims},
    AppState,
};

// Helper function to convert Claims to User for permission checks
async fn claims_to_user(claims: &Claims, state: &AppState) -> Result<User, AuthError> {
    use crate::schema::users;
    use diesel::prelude::*;
    
    let user_id: i32 = claims.sub.parse()
        .map_err(|_| AuthError::TokenInvalid)?;
    
    let mut conn = state.db_pool.get().map_err(|_| AuthError::InternalError)?;
    
    users::table
        .filter(users::id.eq(user_id))
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::NotFound("User not found".to_string()))
}

// Role management endpoints
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
    role_request.validate().map_err(AuthError::ValidationError)?;

    let role = state
        .permission_service
        .create_role(&role_request)
        .await?;

    Ok(Json(ApiResponse::success(role)))
}

pub async fn list_roles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ApiResponse<Vec<Role>>>, AuthError> {
    // Only admins can list roles
    if claims.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let roles = state
        .permission_service
        .list_roles()
        .await?;

    Ok(Json(ApiResponse::success(roles)))
}

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

// Collection permission management
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

    let permission = state
        .permission_service
        .set_collection_permission(collection.id, permission_request.role_id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

pub async fn get_collection_permissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
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

// User-specific permission management
pub async fn set_user_collection_permission(
    State(state): State<AppState>,
    Extension(admin_claims): Extension<Claims>,
    Path((collection_name, user_id)): Path<(String, i32)>,
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

pub async fn get_user_collection_permissions(
    State(state): State<AppState>,
    Extension(requesting_claims): Extension<Claims>,
    Path((collection_name, user_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    let requesting_user_id: i32 = requesting_claims.sub.parse()
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

// Get user's accessible collections
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
        if let Ok(collection) = state.collection_service.get_collection_by_id(collection_id).await {
            let permissions = state
                .permission_service
                .get_user_collection_permissions(&user, collection_id)
                .await?;

            accessible_collections.push(json!({
                "id": collection.id,
                "name": collection.name,
                "display_name": collection.display_name,
                "description": collection.description,
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
        _ => return Err(AuthError::ValidationError(vec!["Invalid permission type".to_string()])),
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