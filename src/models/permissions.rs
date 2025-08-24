use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::{
    collection_permissions, record_permissions, roles, user_collection_permissions,
};

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable, ToSchema)]
#[diesel(table_name = roles)]
pub struct Role {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub priority: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = roles)]
pub struct NewRole {
    pub name: String,
    pub description: Option<String>,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable, ToSchema)]
#[diesel(table_name = collection_permissions)]
pub struct CollectionPermission {
    pub id: i32,
    pub collection_id: i32,
    pub role_id: i32,
    pub can_create: bool,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub can_list: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = collection_permissions)]
pub struct NewCollectionPermission {
    pub collection_id: i32,
    pub role_id: i32,
    pub can_create: bool,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub can_list: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable, ToSchema)]
#[diesel(table_name = user_collection_permissions)]
pub struct UserCollectionPermission {
    pub id: i32,
    pub user_id: i32,
    pub collection_id: i32,
    pub can_create: Option<bool>,
    pub can_read: Option<bool>,
    pub can_update: Option<bool>,
    pub can_delete: Option<bool>,
    pub can_list: Option<bool>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = user_collection_permissions)]
pub struct NewUserCollectionPermission {
    pub user_id: i32,
    pub collection_id: i32,
    pub can_create: Option<bool>,
    pub can_read: Option<bool>,
    pub can_update: Option<bool>,
    pub can_delete: Option<bool>,
    pub can_list: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, Identifiable, ToSchema)]
#[diesel(table_name = record_permissions)]
pub struct RecordPermission {
    pub id: i32,
    pub record_id: i32,
    pub collection_id: i32,
    pub user_id: i32,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = record_permissions)]
pub struct NewRecordPermission {
    pub record_id: i32,
    pub collection_id: i32,
    pub user_id: i32,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateRoleRequest {
    pub name: String,
    pub description: Option<String>,
    pub priority: i32,
}

impl CreateRoleRequest {
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.name.is_empty() {
            errors.push("Role name is required".to_string());
        } else if self.name.len() > 50 {
            errors.push("Role name too long (max 50 characters)".to_string());
        } else if !self.name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            errors.push("Role name can only contain letters, numbers, and underscores".to_string());
        }

        if let Some(desc) = &self.description {
            if desc.len() > 255 {
                errors.push("Role description too long (max 255 characters)".to_string());
            }
        }

        if self.priority < 0 || self.priority > 100 {
            errors.push("Role priority must be between 0 and 100".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRoleRequest {
    pub description: Option<String>,
    pub priority: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SetCollectionPermissionRequest {
    pub role_name: String,
    pub can_create: bool,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub can_list: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SetUserCollectionPermissionRequest {
    pub can_create: Option<bool>,
    pub can_read: Option<bool>,
    pub can_update: Option<bool>,
    pub can_delete: Option<bool>,
    pub can_list: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SetRecordPermissionRequest {
    pub record_id: i32,
    pub user_id: i32,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
}

#[derive(Debug, Clone)]
pub struct PermissionResult {
    pub can_create: bool,
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub can_list: bool,
}

impl PermissionResult {
    pub fn new(
        can_create: bool,
        can_read: bool,
        can_update: bool,
        can_delete: bool,
        can_list: bool,
    ) -> Self {
        Self {
            can_create,
            can_read,
            can_update,
            can_delete,
            can_list,
        }
    }

    pub fn admin() -> Self {
        Self::new(true, true, true, true, true)
    }

    pub fn none() -> Self {
        Self::new(false, false, false, false, false)
    }

    pub fn read_only() -> Self {
        Self::new(false, true, false, false, true)
    }

    pub fn has_permission(&self, action: &str) -> bool {
        match action {
            "create" => self.can_create,
            "read" => self.can_read,
            "update" => self.can_update,
            "delete" => self.can_delete,
            "list" => self.can_list,
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    Create,
    Read,
    Update,
    Delete,
    List,
}

impl Permission {
    pub fn as_str(&self) -> &'static str {
        match self {
            Permission::Create => "create",
            Permission::Read => "read",
            Permission::Update => "update",
            Permission::Delete => "delete",
            Permission::List => "list",
        }
    }
}

impl std::fmt::Display for Permission {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}
