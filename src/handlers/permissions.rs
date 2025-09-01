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
        SetUserCollectionPermissionRequest, UpdateRoleRequest, User, UserCollectionPermission,
    },
    utils::{ApiResponse, Claims, LunarbaseError},
};

async fn claims_to_user(claims: &Claims, state: &AppState) -> Result<User, LunarbaseError> {
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::InternalError)?;

    users::table
        .filter(users::id.eq(user_id))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))
}

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
) -> Result<Json<ApiResponse<Role>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    role_request
        .validate()
        .map_err(LunarbaseError::ValidationError)?;

    let role = state.permission_service.create_role(&role_request).await?;

    Ok(Json(ApiResponse::success(role)))
}

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
) -> Result<Json<ApiResponse<Vec<Role>>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let roles = state.permission_service.list_roles().await?;

    Ok(Json(ApiResponse::success(roles)))
}

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
) -> Result<Json<ApiResponse<Role>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let role = state
        .permission_service
        .get_role_by_name(&role_name)
        .await?;

    Ok(Json(ApiResponse::success(role)))
}

#[utoipa::path(
    delete,
    path = "/permissions/roles/{role_name}",
    tag = "Permissions",
    params(
        ("role_name" = String, Path, description = "Role name")
    ),
    responses(
        (status = 200, description = "Role deleted successfully", body = ApiResponse<String>),
        (status = 400, description = "Validation error - Role cannot be deleted", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Role not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(role_name): Path<String>,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    state.permission_service.delete_role(&role_name).await?;

    Ok(Json(ApiResponse::success(format!(
        "Role '{}' deleted successfully",
        role_name
    ))))
}

#[utoipa::path(
    put,
    path = "/permissions/roles/{role_name}",
    tag = "Permissions",
    params(
        ("role_name" = String, Path, description = "Role name")
    ),
    request_body = UpdateRoleRequest,
    responses(
        (status = 200, description = "Role updated successfully", body = ApiResponse<Role>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions - Admin only", body = ErrorResponse),
        (status = 404, description = "Role not found", body = ErrorResponse),
        (status = 409, description = "Role name already exists", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_role(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(role_name): Path<String>,
    Json(update_request): Json<UpdateRoleRequest>,
) -> Result<Json<ApiResponse<Role>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    update_request
        .validate()
        .map_err(LunarbaseError::ValidationError)?;

    let updated_role = state
        .permission_service
        .update_role(&role_name, &update_request)
        .await?;

    Ok(Json(ApiResponse::success(updated_role)))
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
) -> Result<Json<ApiResponse<CollectionPermission>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

    let permission = state
        .permission_service
        .get_role_collection_permission(&role_name, collection.id)
        .await?;

    if let Some(permission) = permission {
        Ok(Json(ApiResponse::success(permission)))
    } else {
        Err(LunarbaseError::NotFound("Permission not found".to_string()))
    }
}

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
) -> Result<Json<ApiResponse<CollectionPermission>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

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
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    if claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

    if let Some(role_name) = params.get("role_name") {
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
            Err(LunarbaseError::NotFound("Permission not found".to_string()))
        }
    } else {
        let user = claims_to_user(&claims, &state).await?;

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

#[utoipa::path(
    post,
    path = "/permissions/users/{user_id}/collections/{collection_name}",
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
) -> Result<Json<ApiResponse<UserCollectionPermission>>, LunarbaseError> {
    if admin_claims.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

    let permission = state
        .permission_service
        .set_user_collection_permission(user_id, collection.id, &permission_request)
        .await?;

    Ok(Json(ApiResponse::success(permission)))
}

#[utoipa::path(
    get,
    path = "/permissions/users/{user_id}/collections/{collection_name}",
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
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    let requesting_user_id: i32 = requesting_claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if requesting_claims.role != "admin" && requesting_user_id != user_id {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

    let requesting_user = claims_to_user(&requesting_claims, &state).await?;

    let target_user = if requesting_user_id == user_id {
        requesting_user
    } else {
        use crate::schema::users;
        use diesel::prelude::*;
        let mut conn = state
            .db_pool
            .get()
            .map_err(|_| LunarbaseError::InternalError)?;

        users::table
            .filter(users::id.eq(user_id))
            .select(User::as_select())
            .first(&mut conn)
            .map_err(|_| LunarbaseError::NotFound("Target user not found".to_string()))?
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
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    let user = claims_to_user(&claims, &state).await?;

    let accessible_collection_ids = state
        .permission_service
        .get_user_accessible_collections(&user)
        .await?;

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
) -> Result<Json<ApiResponse<Value>>, LunarbaseError> {
    let user = claims_to_user(&claims, &state).await?;
    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

    let permission = match permission_type.as_str() {
        "create" => crate::models::Permission::Create,
        "read" => crate::models::Permission::Read,
        "update" => crate::models::Permission::Update,
        "delete" => crate::models::Permission::Delete,
        "list" => crate::models::Permission::List,
        _ => {
            return Err(LunarbaseError::ValidationError(vec![
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
