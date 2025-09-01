use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};

use crate::models::{
    CollectionPermission, NewCollectionPermission, NewRecordPermission, NewRole,
    NewUserCollectionPermission, Permission, PermissionResult, RecordPermission, Role, User,
    UserCollectionPermission,
};
use crate::schema::{
    collection_permissions, collections, record_permissions, roles, user_collection_permissions,
    users,
};
use crate::utils::LunarbaseError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct PermissionService {
    pub pool: DbPool,
}

impl PermissionService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub async fn create_role(
        &self,
        role_request: &crate::models::CreateRoleRequest,
    ) -> Result<Role, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let existing_role = roles::table
            .filter(roles::name.eq(&role_request.name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if existing_role.is_some() {
            return Err(LunarbaseError::ValidationError(vec![format!(
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
            .map_err(|_| LunarbaseError::InternalError)?;

        roles::table
            .order(roles::id.desc())
            .first(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub async fn get_role_by_name(&self, name: &str) -> Result<Role, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        roles::table
            .filter(roles::name.eq(name))
            .first(&mut conn)
            .map_err(|_| LunarbaseError::NotFound("Role not found".to_string()))
    }

    pub async fn get_role_collection_permission(
        &self,
        role_name: &str,
        collection_id: i32,
    ) -> Result<Option<CollectionPermission>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let role = roles::table
            .filter(roles::name.eq(role_name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(role) = role {
            let permission = collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id))
                .filter(collection_permissions::role_id.eq(role.id))
                .first::<CollectionPermission>(&mut conn)
                .optional()
                .map_err(|_| LunarbaseError::InternalError)?;

            Ok(permission)
        } else {
            Err(LunarbaseError::NotFound("Role not found".to_string()))
        }
    }

    pub async fn list_roles(&self) -> Result<Vec<Role>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        roles::table
            .order(roles::priority.desc())
            .load(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub async fn delete_role(&self, role_name: &str) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let role = roles::table
            .filter(roles::name.eq(role_name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        let role = role
            .ok_or_else(|| LunarbaseError::NotFound(format!("Role '{}' not found", role_name)))?;

        if role.name == "admin" {
            return Err(LunarbaseError::ValidationError(vec![
                "Cannot delete admin role".to_string(),
            ]));
        }

        let users_with_role: Vec<i32> = users::table
            .filter(users::role.eq(&role.name))
            .select(users::id)
            .load(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)?;

        if !users_with_role.is_empty() {
            return Err(LunarbaseError::ValidationError(vec![format!(
                "Cannot delete role '{}' because {} user(s) are assigned to it",
                role_name,
                users_with_role.len()
            )]));
        }

        diesel::delete(
            collection_permissions::table.filter(collection_permissions::role_id.eq(role.id)),
        )
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::InternalError)?;

        diesel::delete(roles::table.filter(roles::id.eq(role.id)))
            .execute(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)?;

        Ok(())
    }

    pub async fn update_role(
        &self,
        role_name: &str,
        update_request: &crate::models::UpdateRoleRequest,
    ) -> Result<Role, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let role = roles::table
            .filter(roles::name.eq(role_name))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        let role = role
            .ok_or_else(|| LunarbaseError::NotFound(format!("Role '{}' not found", role_name)))?;

        if role.name == "admin"
            && update_request.name.is_some()
            && update_request.name.as_ref().unwrap() != "admin"
        {
            return Err(LunarbaseError::ValidationError(vec![
                "Cannot change admin role name".to_string(),
            ]));
        }

        if let Some(new_name) = &update_request.name {
            if new_name != &role.name {
                let existing_role = roles::table
                    .filter(roles::name.eq(new_name))
                    .filter(roles::id.ne(role.id))
                    .first::<Role>(&mut conn)
                    .optional()
                    .map_err(|_| LunarbaseError::InternalError)?;

                if existing_role.is_some() {
                    return Err(LunarbaseError::ValidationError(vec![format!(
                        "Role '{}' already exists",
                        new_name
                    )]));
                }
            }
        }

        if let Some(description) = &update_request.description {
            diesel::update(roles::table.find(role.id))
                .set(roles::description.eq(Some(description)))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;
        }

        if let Some(priority) = update_request.priority {
            diesel::update(roles::table.find(role.id))
                .set(roles::priority.eq(priority))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;
        }

        if let Some(name) = &update_request.name {
            diesel::update(roles::table.find(role.id))
                .set(roles::name.eq(name))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;

            diesel::update(users::table.filter(users::role.eq(&role.name)))
                .set(users::role.eq(name))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;
        }

        roles::table
            .find(role.id)
            .first(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub async fn set_collection_permission(
        &self,
        collection_id: i32,
        role_id: i32,
        permissions: &crate::models::SetCollectionPermissionRequest,
    ) -> Result<CollectionPermission, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let existing = collection_permissions::table
            .filter(collection_permissions::collection_id.eq(collection_id))
            .filter(collection_permissions::role_id.eq(role_id))
            .first::<CollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(existing_permission) = existing {
            diesel::update(collection_permissions::table.find(existing_permission.id))
                .set((
                    collection_permissions::can_create.eq(permissions.can_create),
                    collection_permissions::can_read.eq(permissions.can_read),
                    collection_permissions::can_update.eq(permissions.can_update),
                    collection_permissions::can_delete.eq(permissions.can_delete),
                    collection_permissions::can_list.eq(permissions.can_list),
                ))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;

            collection_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        } else {
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
                .map_err(|_| LunarbaseError::InternalError)?;

            collection_permissions::table
                .order(collection_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        }
    }

    pub async fn set_user_collection_permission(
        &self,
        user_id: i32,
        collection_id: i32,
        permissions: &crate::models::SetUserCollectionPermissionRequest,
    ) -> Result<UserCollectionPermission, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let existing = user_collection_permissions::table
            .filter(user_collection_permissions::user_id.eq(user_id))
            .filter(user_collection_permissions::collection_id.eq(collection_id))
            .first::<UserCollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(existing_permission) = existing {
            diesel::update(user_collection_permissions::table.find(existing_permission.id))
                .set((
                    user_collection_permissions::can_create.eq(permissions.can_create),
                    user_collection_permissions::can_read.eq(permissions.can_read),
                    user_collection_permissions::can_update.eq(permissions.can_update),
                    user_collection_permissions::can_delete.eq(permissions.can_delete),
                    user_collection_permissions::can_list.eq(permissions.can_list),
                ))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;

            user_collection_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        } else {
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
                .map_err(|_| LunarbaseError::InternalError)?;

            user_collection_permissions::table
                .order(user_collection_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        }
    }

    pub async fn check_collection_permission(
        &self,
        user: &User,
        collection_id: i32,
        permission: Permission,
    ) -> Result<bool, LunarbaseError> {
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
    ) -> Result<PermissionResult, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        if user.role == "admin" {
            return Ok(PermissionResult::admin());
        }

        let role = roles::table
            .filter(roles::name.eq(&user.role))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        let mut final_permissions = PermissionResult::none();

        if let Some(role) = role {
            let role_permissions = collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id))
                .filter(collection_permissions::role_id.eq(role.id))
                .first::<CollectionPermission>(&mut conn)
                .optional()
                .map_err(|_| LunarbaseError::InternalError)?;

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

        let user_permissions = user_collection_permissions::table
            .filter(user_collection_permissions::user_id.eq(user.id))
            .filter(user_collection_permissions::collection_id.eq(collection_id))
            .first::<UserCollectionPermission>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(user_perm) = user_permissions {
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

    pub async fn check_record_permission(
        &self,
        user: &User,
        collection_id: i32,
        record_id: i32,
        permission: Permission,
    ) -> Result<bool, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        if user.role == "admin" {
            return Ok(true);
        }

        let record_permission = record_permissions::table
            .filter(record_permissions::record_id.eq(record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .filter(record_permissions::user_id.eq(user.id))
            .first::<RecordPermission>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(rec_perm) = record_permission {
            return Ok(match permission {
                Permission::Read => rec_perm.can_read,
                Permission::Update => rec_perm.can_update,
                Permission::Delete => rec_perm.can_delete,
                _ => false,
            });
        }

        self.check_collection_permission(user, collection_id, permission)
            .await
    }

    pub async fn get_user_accessible_collections(
        &self,
        user: &User,
    ) -> Result<Vec<i32>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        if user.role == "admin" {
            let all_collections: Vec<i32> = collections::table
                .select(collections::id)
                .load(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;
            return Ok(all_collections);
        }

        let role = roles::table
            .filter(roles::name.eq(&user.role))
            .first::<Role>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        let mut accessible_collections = Vec::new();

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
                .map_err(|_| LunarbaseError::InternalError)?;

            accessible_collections.extend(role_collections);
        }

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
            .map_err(|_| LunarbaseError::InternalError)?;

        accessible_collections.extend(user_collections);

        accessible_collections.sort();
        accessible_collections.dedup();

        Ok(accessible_collections)
    }

    pub async fn delete_collection_permissions(
        &self,
        collection_id: i32,
    ) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        diesel::delete(
            collection_permissions::table
                .filter(collection_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::InternalError)?;

        diesel::delete(
            user_collection_permissions::table
                .filter(user_collection_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::InternalError)?;

        diesel::delete(
            record_permissions::table.filter(record_permissions::collection_id.eq(collection_id)),
        )
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::InternalError)?;

        Ok(())
    }

    pub async fn set_record_permission(
        &self,
        collection_id: i32,
        permission_request: &crate::models::SetRecordPermissionRequest,
    ) -> Result<RecordPermission, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let existing = record_permissions::table
            .filter(record_permissions::record_id.eq(permission_request.record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .filter(record_permissions::user_id.eq(permission_request.user_id))
            .first::<RecordPermission>(&mut conn)
            .optional()
            .map_err(|_| LunarbaseError::InternalError)?;

        if let Some(existing_permission) = existing {
            diesel::update(record_permissions::table.find(existing_permission.id))
                .set((
                    record_permissions::can_read.eq(permission_request.can_read),
                    record_permissions::can_update.eq(permission_request.can_update),
                    record_permissions::can_delete.eq(permission_request.can_delete),
                ))
                .execute(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)?;

            record_permissions::table
                .find(existing_permission.id)
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        } else {
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
                .map_err(|_| LunarbaseError::InternalError)?;

            record_permissions::table
                .order(record_permissions::id.desc())
                .first(&mut conn)
                .map_err(|_| LunarbaseError::InternalError)
        }
    }

    pub async fn remove_record_permission(
        &self,
        collection_id: i32,
        record_id: i32,
        user_id: i32,
    ) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        diesel::delete(
            record_permissions::table
                .filter(record_permissions::record_id.eq(record_id))
                .filter(record_permissions::collection_id.eq(collection_id))
                .filter(record_permissions::user_id.eq(user_id)),
        )
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::InternalError)?;

        Ok(())
    }

    pub async fn list_record_permissions(
        &self,
        collection_id: i32,
        record_id: i32,
    ) -> Result<Vec<RecordPermission>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        record_permissions::table
            .filter(record_permissions::record_id.eq(record_id))
            .filter(record_permissions::collection_id.eq(collection_id))
            .load(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub async fn check_record_ownership(
        &self,
        user: &User,
        record: &crate::models::RecordResponse,
    ) -> Result<bool, LunarbaseError> {
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

        Ok(false)
    }

    pub async fn check_record_permission_with_ownership(
        &self,
        user: &User,
        collection_id: i32,
        record_id: i32,
        permission: Permission,
        record: &crate::models::RecordResponse,
    ) -> Result<bool, LunarbaseError> {
        if user.role == "admin" {
            return Ok(true);
        }

        let is_owner = self.check_record_ownership(user, record).await?;

        if is_owner {
            match permission {
                Permission::Read | Permission::Update => return Ok(true),
                Permission::Delete => {
                    // TODO: For now, allow owners to delete their own records
                    return Ok(true);
                }
                _ => {}
            }
        }

        self.check_record_permission(user, collection_id, record_id, permission)
            .await
    }
}
