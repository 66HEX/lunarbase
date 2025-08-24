use axum::{
    body::Body,
    extract::{Path, State},
    http::Request,
    middleware::Next,
    response::Response,
};

use crate::{
    models::{User, Permission},
    utils::AuthError,
    AppState,
};

pub async fn check_collection_permission(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let user = req
        .extensions()
        .get::<User>()
        .ok_or_else(|| AuthError::InsufficientPermissions)?;

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    let method = req.method();
    let required_permission = match method.as_str() {
        "POST" => Permission::Create,
        "GET" => {
            if req.uri().path().ends_with("/records") {
                Permission::List
            } else {
                Permission::Read
            }
        }
        "PUT" | "PATCH" => Permission::Update,
        "DELETE" => Permission::Delete,
        _ => return Err(AuthError::Forbidden("Invalid HTTP method".to_string())),
    };

    let has_permission = state
        .permission_service
        .check_collection_permission(user, collection.id, required_permission)
        .await
        .map_err(|_| AuthError::InternalError)?;

    if !has_permission {
        return Err(AuthError::Forbidden(format!(
            "Insufficient permissions for {} operation on collection '{}'",
            required_permission, collection_name
        )));
    }

    Ok(next.run(req).await)
}

pub async fn check_record_permission(
    State(state): State<AppState>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let user = req
        .extensions()
        .get::<User>()
        .ok_or_else(|| AuthError::InsufficientPermissions)?;

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await
        .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

    let required_permission = match req.method().as_str() {
        "GET" => Permission::Read,
        "PUT" | "PATCH" => Permission::Update,
        "DELETE" => Permission::Delete,
        _ => return Err(AuthError::Forbidden("Invalid HTTP method".to_string())),
    };

    let has_permission = state
        .permission_service
        .check_record_permission(user, collection.id, record_id, required_permission)
        .await
        .map_err(|_| AuthError::InternalError)?;

    if !has_permission {
        return Err(AuthError::Forbidden(format!(
            "Insufficient permissions for {} operation on record {} in collection '{}'",
            required_permission, record_id, collection_name
        )));
    }

    Ok(next.run(req).await)
}

pub async fn require_admin(
    req: Request<Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let user = req
        .extensions()
        .get::<User>()
        .ok_or_else(|| AuthError::InsufficientPermissions)?;

    if user.role != "admin" {
        return Err(AuthError::Forbidden(
            "Administrator privileges required".to_string(),
        ));
    }

    Ok(next.run(req).await)
}

pub struct PermissionChecker<'a> {
    pub state: &'a AppState,
    pub user: &'a User,
}

impl<'a> PermissionChecker<'a> {
    pub fn new(state: &'a AppState, user: &'a User) -> Self {
        Self { state, user }
    }

    pub async fn can_access_collection(
        &self,
        collection_name: &str,
        permission: Permission,
    ) -> Result<bool, AuthError> {
        let collection = self
            .state
            .collection_service
            .get_collection(collection_name)
            .await
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        self.state
            .permission_service
            .check_collection_permission(self.user, collection.id, permission)
            .await
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn can_access_record(
        &self,
        collection_name: &str,
        record_id: i32,
        permission: Permission,
    ) -> Result<bool, AuthError> {
        let collection = self
            .state
            .collection_service
            .get_collection(collection_name)
            .await
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        self.state
            .permission_service
            .check_record_permission(self.user, collection.id, record_id, permission)
            .await
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn get_accessible_collections(&self) -> Result<Vec<i32>, AuthError> {
        self.state
            .permission_service
            .get_user_accessible_collections(self.user)
            .await
            .map_err(|_| AuthError::InternalError)
    }

    pub fn is_admin(&self) -> bool {
        self.user.role == "admin"
    }
}

pub fn get_user_from_request(req: &Request<Body>) -> Result<&User, AuthError> {
    req.extensions()
        .get::<User>()
        .ok_or_else(|| AuthError::InsufficientPermissions)
}

#[macro_export]
macro_rules! require_permission {
    ($state:expr, $user:expr, $collection:expr, $permission:expr) => {{
        let checker = crate::middleware::permissions::PermissionChecker::new($state, $user);
        if !checker.can_access_collection($collection, $permission).await? {
            return Err(crate::utils::AuthError::Forbidden(format!(
                "Insufficient permissions for {} operation on collection '{}'",
                $permission, $collection
            )));
        }
    }};
}

#[macro_export]
macro_rules! require_record_permission {
    ($state:expr, $user:expr, $collection:expr, $record_id:expr, $permission:expr) => {{
        let checker = crate::middleware::permissions::PermissionChecker::new($state, $user);
        if !checker.can_access_record($collection, $record_id, $permission).await? {
            return Err(crate::utils::AuthError::Forbidden(format!(
                "Insufficient permissions for {} operation on record {} in collection '{}'",
                $permission, $record_id, $collection
            )));
        }
    }};
} 