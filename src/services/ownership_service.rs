use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use serde_json::Value;
use tracing::debug;

use crate::models::{Permission, RecordResponse, User};
use crate::utils::LunarbaseError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct OwnershipService {
    pub pool: DbPool,
}

impl OwnershipService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    pub fn set_record_ownership(
        &self,
        user: &User,
        record_data: &mut Value,
    ) -> Result<(), LunarbaseError> {
        if !record_data.as_object().unwrap().contains_key("author_id") {
            if let Some(obj) = record_data.as_object_mut() {
                obj.insert("author_id".to_string(), Value::Number(user.id.into()));
            }
        }

        if !record_data.as_object().unwrap().contains_key("owner_id") {
            if let Some(obj) = record_data.as_object_mut() {
                obj.insert("owner_id".to_string(), Value::Number(user.id.into()));
            }
        }

        Ok(())
    }

    pub fn check_ownership(
        &self,
        user: &User,
        record: &RecordResponse,
    ) -> Result<bool, LunarbaseError> {
        if let Some(owner_id_value) = record.data.get("owner_id") {
            if self.matches_user_id(owner_id_value, user.id) {
                return Ok(true);
            }
        }

        if let Some(author_id_value) = record.data.get("author_id") {
            if self.matches_user_id(author_id_value, user.id) {
                return Ok(true);
            }
        }

        if let Some(email_value) = record.data.get("email") {
            if let Some(record_email) = email_value.as_str() {
                if record_email == user.email {
                    return Ok(true);
                }
            }
        }

        if let Some(username_value) = record.data.get("username") {
            if let Some(record_username) = username_value.as_str() {
                if record_username == user.username {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    fn matches_user_id(&self, value: &Value, user_id: i32) -> bool {
        match value {
            Value::Number(num) => {
                if let Some(id) = num.as_i64() {
                    id == user_id as i64
                } else if let Some(id) = num.as_u64() {
                    id == user_id as u64
                } else {
                    false
                }
            }
            Value::String(s) => {
                if let Ok(id) = s.parse::<i32>() {
                    id == user_id
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    pub fn get_ownership_permissions(
        &self,
        user: &User,
        record: &RecordResponse,
    ) -> Result<OwnershipPermissions, LunarbaseError> {
        let is_owner = self.check_ownership(user, record)?;

        if is_owner {
            Ok(OwnershipPermissions {
                can_read: true,
                can_update: true,
                can_delete: true,
                is_owner: true,
            })
        } else {
            Ok(OwnershipPermissions {
                can_read: false,
                can_update: false,
                can_delete: false,
                is_owner: false,
            })
        }
    }

    pub async fn transfer_ownership(
        &self,
        current_user: &User,
        record: &RecordResponse,
        new_owner_id: i32,
        collection_name: &str,
        record_id: i32,
    ) -> Result<(), LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let is_owner = self.check_ownership(current_user, record)?;
        if !is_owner && current_user.role != "admin" {
            return Err(LunarbaseError::InsufficientPermissions);
        }

        use crate::schema::users;
        let _new_owner = users::table
            .filter(users::id.eq(new_owner_id))
            .select(User::as_select())
            .first(&mut conn)
            .map_err(|_| LunarbaseError::NotFound("New owner user not found".to_string()))?;

        let table_name = format!("records_{}", collection_name);

        let update_owner_id_sql = format!(
            "UPDATE {} SET owner_id = {} WHERE id = {}",
            table_name, new_owner_id, record_id
        );

        let owner_id_result = diesel::sql_query(&update_owner_id_sql).execute(&mut conn);

        if owner_id_result.is_err() {
            return Err(LunarbaseError::ValidationError(vec![
                "Record does not have owner_id field for ownership transfer".to_string(),
            ]));
        }

        debug!(
            "Ownership transferred successfully: collection={}, record_id={}, from_user={}, to_user={}",
            collection_name, record_id, current_user.id, new_owner_id
        );

        Ok(())
    }

    pub fn check_ownership_permission(
        &self,
        user: &User,
        record: &RecordResponse,
        permission: Permission,
    ) -> Result<bool, LunarbaseError> {
        if user.role == "admin" {
            return Ok(true);
        }

        let ownership_perms = self.get_ownership_permissions(user, record)?;

        match permission {
            Permission::Read => Ok(ownership_perms.can_read),
            Permission::Update => Ok(ownership_perms.can_update),
            Permission::Delete => Ok(ownership_perms.can_delete),
            Permission::Create => Ok(false),
            Permission::List => Ok(false),
        }
    }

    pub async fn get_owned_records(
        &self,
        user: &User,
        collection_name: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<i32>, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        use crate::schema::collections;
        let _collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<crate::models::Collection>(&mut conn)
            .map_err(|_| LunarbaseError::NotFound("Collection not found".to_string()))?;

        let table_name = format!("records_{}", collection_name);
        let limit_clause = limit.unwrap_or(100);
        let offset_clause = offset.unwrap_or(0);

        let mut owned_record_ids = Vec::new();

        let owner_id_query = format!(
            "SELECT id FROM {} WHERE owner_id = {} LIMIT {} OFFSET {}",
            table_name, user.id, limit_clause, offset_clause
        );

        if let Ok(results) = self.execute_ownership_query(&mut conn, &owner_id_query) {
            owned_record_ids.extend(results);
        }

        if owned_record_ids.is_empty() {
            let author_id_query = format!(
                "SELECT id FROM {} WHERE author_id = {} LIMIT {} OFFSET {}",
                table_name, user.id, limit_clause, offset_clause
            );

            if let Ok(results) = self.execute_ownership_query(&mut conn, &author_id_query) {
                owned_record_ids.extend(results);
            }
        }

        if owned_record_ids.is_empty() {
            let email_query = format!(
                "SELECT id FROM {} WHERE email = '{}' LIMIT {} OFFSET {}",
                table_name, user.email, limit_clause, offset_clause
            );

            if let Ok(results) = self.execute_ownership_query(&mut conn, &email_query) {
                owned_record_ids.extend(results);
            }
        }

        owned_record_ids.sort();
        owned_record_ids.dedup();

        debug!(
            "Found {} owned records for user {} in collection {}",
            owned_record_ids.len(),
            user.id,
            collection_name
        );

        Ok(owned_record_ids)
    }

    fn execute_ownership_query(
        &self,
        conn: &mut SqliteConnection,
        query: &str,
    ) -> Result<Vec<i32>, LunarbaseError> {
        #[derive(QueryableByName)]
        struct RecordId {
            #[diesel(sql_type = diesel::sql_types::Integer)]
            id: i32,
        }

        match diesel::sql_query(query).load::<RecordId>(conn) {
            Ok(results) => Ok(results.into_iter().map(|r| r.id).collect()),
            Err(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::Unknown,
                _,
            )) => Ok(vec![]),
            Err(_) => Err(LunarbaseError::InternalError),
        }
    }

    pub fn create_ownership_rule(
        &self,
        collection_name: &str,
        ownership_field: &str,
    ) -> Result<OwnershipRule, LunarbaseError> {
        Ok(OwnershipRule {
            collection_name: collection_name.to_string(),
            ownership_field: ownership_field.to_string(),
            auto_assign_on_create: true,
            owner_permissions: OwnershipPermissions {
                can_read: true,
                can_update: true,
                can_delete: true,
                is_owner: true,
            },
        })
    }
}

#[derive(Debug, Clone)]
pub struct OwnershipPermissions {
    pub can_read: bool,
    pub can_update: bool,
    pub can_delete: bool,
    pub is_owner: bool,
}

#[derive(Debug, Clone)]
pub struct OwnershipRule {
    pub collection_name: String,
    pub ownership_field: String,
    pub auto_assign_on_create: bool,
    pub owner_permissions: OwnershipPermissions,
}

impl OwnershipRule {
    pub fn new(collection_name: String, ownership_field: String) -> Self {
        Self {
            collection_name,
            ownership_field,
            auto_assign_on_create: true,
            owner_permissions: OwnershipPermissions {
                can_read: true,
                can_update: true,
                can_delete: true,
                is_owner: true,
            },
        }
    }

    pub fn with_permissions(mut self, permissions: OwnershipPermissions) -> Self {
        self.owner_permissions = permissions;
        self
    }

    pub fn without_auto_assign(mut self) -> Self {
        self.auto_assign_on_create = false;
        self
    }
}
