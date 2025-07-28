use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};

use crate::models::{
    CollectionPermission, NewCollectionPermission, NewRecordPermission, NewRole,
    NewUserCollectionPermission, Permission, PermissionResult, RecordPermission, Role, User,
    UserCollectionPermission,
};
use crate::schema::{
    collection_permissions, collections, record_permissions, roles, user_collection_permissions,
};
use crate::utils::AuthError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct PermissionService {
    pub pool: DbPool,
}

impl PermissionService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    // Role management
    pub async fn create_role(
        &self,
        role_request: &crate::models::CreateRoleRequest,
    ) -> Result<Role, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if role already exists
        let existing_role = roles::table
            .filter(roles::name.eq(&role_request.name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if existing_role.is_some() {
            return Err(AuthError::ValidationError(vec![format!(
                "Role '{}' already exists",
                role_request.name
            )]));
        }

        let new_role = NewRole {
            name: role_request.name.clone(),
            description: role_request.description.clone(),
            priority: role_request.priority,
        };

        diesel::insert_into(roles::table)
            .values(&new_role)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        roles::table
            .order(roles::id.desc())
            .first(&mut conn)
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn get_role_by_name(&self, name: &str) -> Result<Role, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        roles::table
            .filter(roles::name.eq(name))
            .first(&mut conn)
            .map_err(|_| AuthError::NotFound("Role not found".to_string()))
    }

    pub async fn get_role_collection_permission(
        &self,
        role_name: &str,
        collection_id: i32,
    ) -> Result<Option<CollectionPermission>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Get role by name
        let role = roles::table
            .filter(roles::name.eq(role_name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(role) = role {
            // Get collection permission for this role
            let permission = collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id))
                .filter(collection_permissions::role_id.eq(role.id))
                .first::<CollectionPermission>(&mut conn)
                .optional()
                .map_err(|_| AuthError::InternalError)?;

            Ok(permission)
        } else {
            Err(AuthError::NotFound("Role not found".to_string()))
        }
    }

    pub async fn list_roles(&self) -> Result<Vec<Role>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        roles::table
            .order(roles::priority.desc())
            .load(&mut conn)
            .map_err(|_| AuthError::InternalError)
    }

    // Collection permission management
    pub async fn set_collection_permission(
        &self,
        collection_id: i32,
        role_id: i32,
        permissions: &crate::models::SetCollectionPermissionRequest,
    ) -> Result<CollectionPermission, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if permission already exists
        let existing = collection_permissions::table
            .filter(collection_permissions::collection_id.eq(collection_id))
            .filter(collection_permissions::role_id.eq(role_id))
            .first::<CollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(existing_permission) = existing {
            // Update existing permission
            diesel::update(collection_permissions::table.find(existing_permission.id))
                .set((
                    collection_permissions::can_create.eq(permissions.can_create),
                    collection_permissions::can_read.eq(permissions.can_read),
                    collection_permissions::can_update.eq(permissions.can_update),
                    collection_permissions::can_delete.eq(permissions.can_delete),
                    collection_permissions::can_list.eq(permissions.can_list),
                ))
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            collection_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        } else {
            // Create new permission
            let new_permission = NewCollectionPermission {
                collection_id,
                role_id,
                can_create: permissions.can_create,
                can_read: permissions.can_read,
                can_update: permissions.can_update,
                can_delete: permissions.can_delete,
                can_list: permissions.can_list,
            };

            diesel::insert_into(collection_permissions::table)
                .values(&new_permission)
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            collection_permissions::table
                .order(collection_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        }
    }

    // User-specific permission management
    pub async fn set_user_collection_permission(
        &self,
        user_id: i32,
        collection_id: i32,
        permissions: &crate::models::SetUserCollectionPermissionRequest,
    ) -> Result<UserCollectionPermission, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if permission already exists
        let existing = user_collection_permissions::table
            .filter(user_collection_permissions::user_id.eq(user_id))
            .filter(user_collection_permissions::collection_id.eq(collection_id))
            .first::<UserCollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(existing_permission) = existing {
            // Update existing permission
            diesel::update(user_collection_permissions::table.find(existing_permission.id))
                .set((
                    user_collection_permissions::can_create.eq(permissions.can_create),
                    user_collection_permissions::can_read.eq(permissions.can_read),
                    user_collection_permissions::can_update.eq(permissions.can_update),
                    user_collection_permissions::can_delete.eq(permissions.can_delete),
                    user_collection_permissions::can_list.eq(permissions.can_list),
                ))
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            user_collection_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        } else {
            // Create new permission
            let new_permission = NewUserCollectionPermission {
                user_id,
                collection_id,
                can_create: permissions.can_create,
                can_read: permissions.can_read,
                can_update: permissions.can_update,
                can_delete: permissions.can_delete,
                can_list: permissions.can_list,
            };

            diesel::insert_into(user_collection_permissions::table)
                .values(&new_permission)
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            user_collection_permissions::table
                .order(user_collection_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        }
    }

    // Permission checking logic
    pub async fn check_collection_permission(
        &self,
        user: &User,
        collection_id: i32,
        permission: Permission,
    ) -> Result<bool, AuthError> {
        // Admin always has all permissions
        if user.role == "admin" {
            return Ok(true);
        }

        let permissions = self
            .get_user_collection_permissions(user, collection_id)
            .await?;
        Ok(permissions.has_permission(permission.as_str()))
    }

    pub async fn get_user_collection_permissions(
        &self,
        user: &User,
        collection_id: i32,
    ) -> Result<PermissionResult, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Admin always has all permissions
        if user.role == "admin" {
            return Ok(PermissionResult::admin());
        }

        // 1. Get user's role
        let role = roles::table
            .filter(roles::name.eq(&user.role))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        let mut final_permissions = PermissionResult::none();

        // 2. Get role-based permissions for this collection
        if let Some(role) = role {
            let role_permissions = collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id))
                .filter(collection_permissions::role_id.eq(role.id))
                .first::<CollectionPermission>(&mut conn)
                .optional()
                .map_err(|_| AuthError::InternalError)?;

            if let Some(perm) = role_permissions {
                final_permissions = PermissionResult::new(
                    perm.can_create,
                    perm.can_read,
                    perm.can_update,
                    perm.can_delete,
                    perm.can_list,
                );
            }
        }

        // 3. Get user-specific permissions (these override role permissions)
        let user_permissions = user_collection_permissions::table
            .filter(user_collection_permissions::user_id.eq(user.id))
            .filter(user_collection_permissions::collection_id.eq(collection_id))
            .first::<UserCollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(user_perm) = user_permissions {
            // Override with user-specific permissions where specified
            if let Some(can_create) = user_perm.can_create {
                final_permissions.can_create = can_create;
            }
            if let Some(can_read) = user_perm.can_read {
                final_permissions.can_read = can_read;
            }
            if let Some(can_update) = user_perm.can_update {
                final_permissions.can_update = can_update;
            }
            if let Some(can_delete) = user_perm.can_delete {
                final_permissions.can_delete = can_delete;
            }
            if let Some(can_list) = user_perm.can_list {
                final_permissions.can_list = can_list;
            }
        }

        Ok(final_permissions)
    }

    // Record-level permission checking
    pub async fn check_record_permission(
        &self,
        user: &User,
        collection_id: i32,
        record_id: i32,
        permission: Permission,
    ) -> Result<bool, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Admin always has all permissions
        if user.role == "admin" {
            return Ok(true);
        }

        // Check for record-specific permissions first
        let record_permission = record_permissions::table
            .filter(record_permissions::record_id.eq(record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .filter(record_permissions::user_id.eq(user.id))
            .first::<RecordPermission>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(rec_perm) = record_permission {
            return Ok(match permission {
                Permission::Read => rec_perm.can_read,
                Permission::Update => rec_perm.can_update,
                Permission::Delete => rec_perm.can_delete,
                _ => false, // Record permissions don't have create/list
            });
        }

        // Fall back to collection-level permissions
        self.check_collection_permission(user, collection_id, permission)
            .await
    }

    // Utility methods
    pub async fn get_user_accessible_collections(
        &self,
        user: &User,
    ) -> Result<Vec<i32>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Admin can access all collections
        if user.role == "admin" {
            let all_collections: Vec<i32> = collections::table
                .select(collections::id)
                .load(&mut conn)
                .map_err(|_| AuthError::InternalError)?;
            return Ok(all_collections);
        }

        // Get user's role
        let role = roles::table
            .filter(roles::name.eq(&user.role))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        let mut accessible_collections = Vec::new();

        // Collections accessible through role permissions
        if let Some(role) = role {
            let role_collections: Vec<i32> = collection_permissions::table
                .filter(collection_permissions::role_id.eq(role.id))
                .filter(
                    collection_permissions::can_read
                        .eq(true)
                        .or(collection_permissions::can_list.eq(true))
                        .or(collection_permissions::can_create.eq(true))
                        .or(collection_permissions::can_update.eq(true))
                        .or(collection_permissions::can_delete.eq(true)),
                )
                .select(collection_permissions::collection_id)
                .load(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            accessible_collections.extend(role_collections);
        }

        // Collections accessible through user-specific permissions
        let user_collections: Vec<i32> = user_collection_permissions::table
            .filter(user_collection_permissions::user_id.eq(user.id))
            .filter(
                user_collection_permissions::can_read
                    .eq(Some(true))
                    .or(user_collection_permissions::can_list.eq(Some(true)))
                    .or(user_collection_permissions::can_create.eq(Some(true)))
                    .or(user_collection_permissions::can_update.eq(Some(true)))
                    .or(user_collection_permissions::can_delete.eq(Some(true))),
            )
            .select(user_collection_permissions::collection_id)
            .load(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        accessible_collections.extend(user_collections);

        // Remove duplicates
        accessible_collections.sort();
        accessible_collections.dedup();

        Ok(accessible_collections)
    }

    // Delete all permissions for a collection
    pub async fn delete_collection_permissions(&self, collection_id: i32) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Delete all role-based collection permissions
        diesel::delete(
            collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| AuthError::InternalError)?;

        // Delete all user-specific collection permissions
        diesel::delete(
            user_collection_permissions::table
                .filter(user_collection_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| AuthError::InternalError)?;

        // Delete all record permissions for this collection
        diesel::delete(
            record_permissions::table.filter(record_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    // Record-level permission management
    pub async fn set_record_permission(
        &self,
        collection_id: i32,
        permission_request: &crate::models::SetRecordPermissionRequest,
    ) -> Result<RecordPermission, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if permission already exists
        let existing = record_permissions::table
            .filter(record_permissions::record_id.eq(permission_request.record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .filter(record_permissions::user_id.eq(permission_request.user_id))
            .first::<RecordPermission>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if let Some(existing_permission) = existing {
            // Update existing permission
            diesel::update(record_permissions::table.find(existing_permission.id))
                .set((
                    record_permissions::can_read.eq(permission_request.can_read),
                    record_permissions::can_update.eq(permission_request.can_update),
                    record_permissions::can_delete.eq(permission_request.can_delete),
                ))
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            record_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        } else {
            // Create new permission
            let new_permission = NewRecordPermission {
                record_id: permission_request.record_id,
                collection_id,
                user_id: permission_request.user_id,
                can_read: permission_request.can_read,
                can_update: permission_request.can_update,
                can_delete: permission_request.can_delete,
            };

            diesel::insert_into(record_permissions::table)
                .values(&new_permission)
                .execute(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            record_permissions::table
                .order(record_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| AuthError::InternalError)
        }
    }

    pub async fn remove_record_permission(
        &self,
        collection_id: i32,
        record_id: i32,
        user_id: i32,
    ) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        diesel::delete(
            record_permissions::table
                .filter(record_permissions::record_id.eq(record_id))
                .filter(record_permissions::collection_id.eq(collection_id))
                .filter(record_permissions::user_id.eq(user_id)),
        )
        .execute(&mut conn)
        .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    pub async fn list_record_permissions(
        &self,
        collection_id: i32,
        record_id: i32,
    ) -> Result<Vec<RecordPermission>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        record_permissions::table
            .filter(record_permissions::record_id.eq(record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .load(&mut conn)
            .map_err(|_| AuthError::InternalError)
    }

    // Ownership checking logic
    pub async fn check_record_ownership(
        &self,
        user: &User,
        record: &crate::models::RecordResponse,
    ) -> Result<bool, AuthError> {
        // Check if the record has an owner_id field that matches the current user
        if let Some(owner_id_value) = record.data.get("owner_id") {
            if let Some(record_owner_id) = owner_id_value.as_i64() {
                return Ok(record_owner_id == user.id as i64);
            }
            if let Some(record_owner_id_str) = owner_id_value.as_str() {
                if let Ok(record_owner_id) = record_owner_id_str.parse::<i32>() {
                    return Ok(record_owner_id == user.id);
                }
            }
        }

        // Check if record has author_id field
        if let Some(author_id_value) = record.data.get("author_id") {
            if let Some(author_id) = author_id_value.as_i64() {
                return Ok(author_id == user.id as i64);
            }
            if let Some(author_id_str) = author_id_value.as_str() {
                if let Ok(author_id) = author_id_str.parse::<i32>() {
                    return Ok(author_id == user.id);
                }
            }
        }

        // Check if record has owner_id field
        if let Some(owner_id_value) = record.data.get("owner_id") {
            if let Some(owner_id) = owner_id_value.as_i64() {
                return Ok(owner_id == user.id as i64);
            }
            if let Some(owner_id_str) = owner_id_value.as_str() {
                if let Ok(owner_id) = owner_id_str.parse::<i32>() {
                    return Ok(owner_id == user.id);
                }
            }
        }

        // No ownership field found
        Ok(false)
    }

    // Enhanced permission checking with ownership
    pub async fn check_record_permission_with_ownership(
        &self,
        user: &User,
        collection_id: i32,
        record_id: i32,
        permission: Permission,
        record: &crate::models::RecordResponse,
    ) -> Result<bool, AuthError> {
        // Admin always has all permissions
        if user.role == "admin" {
            return Ok(true);
        }

        // Check if user owns the record
        let is_owner = self.check_record_ownership(user, record).await?;

        // Record owners automatically have read and update permissions
        if is_owner {
            match permission {
                Permission::Read | Permission::Update => return Ok(true),
                Permission::Delete => {
                    // Delete permission for owners might be configurable per collection
                    // For now, allow owners to delete their own records
                    return Ok(true);
                }
                _ => {} // Fall through to normal permission check
            }
        }

        // Fall back to normal record permission check
        self.check_record_permission(user, collection_id, record_id, permission)
            .await
    }
}
