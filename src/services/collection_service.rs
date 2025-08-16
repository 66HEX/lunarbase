use crate::models::{
    Collection, CollectionResponse, CollectionSchema, CreateCollectionRequest, CreateRecordRequest,
    FieldDefinition, FieldType, FileUpload, NewCollection, RecordResponse, Role,
    SetCollectionPermissionRequest, UpdateCollection, UpdateCollectionRequest, UpdateRecordRequest,
};
use crate::query_engine::QueryEngine;
use crate::schema::{collections, roles};
use crate::services::PermissionService;
use crate::services::S3Service;
use crate::utils::AuthError;
use base64::Engine;
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::debug;
use serde_json::{Map, Value};

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct CollectionService {
    pub pool: DbPool,
    pub websocket_service: Option<std::sync::Arc<crate::services::WebSocketService>>,
    pub permission_service: Option<PermissionService>,
    pub s3_service: Option<S3Service>,
}

impl CollectionService {
    pub fn new(pool: DbPool) -> Self {
        Self {
            pool,
            websocket_service: None,
            permission_service: None,
            s3_service: None,
        }
    }

    pub fn with_websocket_service(
        mut self,
        websocket_service: std::sync::Arc<crate::services::WebSocketService>,
    ) -> Self {
        self.websocket_service = Some(websocket_service);
        self
    }

    pub fn with_permission_service(mut self, permission_service: PermissionService) -> Self {
        self.permission_service = Some(permission_service);
        self
    }

    pub fn with_s3_service(mut self, s3_service: S3Service) -> Self {
        self.s3_service = Some(s3_service);
        self
    }

    // Helper method to emit WebSocket events
    async fn emit_record_event(
        &self,
        collection_name: &str,
        event: crate::models::RecordEvent,
        user_id: Option<i32>,
    ) {
        if let Some(ws_service) = &self.websocket_service {
            let pending_event = crate::models::PendingEvent {
                collection_name: collection_name.to_string(),
                event,
                user_id,
            };

            if let Err(e) = ws_service.broadcast_event(pending_event).await {
                tracing::warn!("Failed to broadcast WebSocket event: {}", e);
            }
        }
    }

    // DDL Operations for dynamic tables
    fn get_records_table_name(&self, collection_name: &str) -> String {
        format!("records_{}", collection_name)
    }

    fn map_field_type_to_sql(&self, field_type: &FieldType) -> &'static str {
        match field_type {
            FieldType::Text => "TEXT",
            FieldType::Number => "REAL",
            FieldType::Boolean => "BOOLEAN",
            FieldType::Date => "TIMESTAMP",
            FieldType::Email => "TEXT",
            FieldType::Url => "TEXT",
            FieldType::Json => "TEXT",
            FieldType::File => "TEXT",
            FieldType::Relation => "TEXT",
        }
    }

    fn generate_create_table_sql(
        &self,
        collection_name: &str,
        schema: &CollectionSchema,
    ) -> String {
        let table_name = self.get_records_table_name(collection_name);
        let mut sql = format!("CREATE TABLE {} (\n", table_name);
        sql.push_str("    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,\n");

        for field in &schema.fields {
            // Skip 'id' field since it's already added as PRIMARY KEY
            // Also skip ownership fields since they're added automatically
            if field.name.to_lowercase() == "id"
                || field.name == "author_id"
                || field.name == "owner_id"
                || field.name == "created_at"
                || field.name == "updated_at"
            {
                continue;
            }

            let field_type = self.map_field_type_to_sql(&field.field_type);
            let not_null = if field.required { " NOT NULL" } else { "" };

            let default_clause = if let Some(default_value) = &field.default_value {
                match field.field_type {
                    FieldType::Text | FieldType::Email | FieldType::Url => {
                        if let Some(s) = default_value.as_str() {
                            format!(" DEFAULT '{}'", s.replace("'", "''"))
                        } else {
                            String::new()
                        }
                    }
                    FieldType::Number => {
                        if let Some(n) = default_value.as_f64() {
                            format!(" DEFAULT {}", n)
                        } else {
                            String::new()
                        }
                    }
                    FieldType::Boolean => {
                        if let Some(b) = default_value.as_bool() {
                            format!(" DEFAULT {}", if b { "TRUE" } else { "FALSE" })
                        } else {
                            String::new()
                        }
                    }
                    _ => String::new(),
                }
            } else {
                String::new()
            };

            sql.push_str(&format!(
                "    {} {}{}{},\n",
                field.name, field_type, not_null, default_clause
            ));
        }

        // Add ownership fields
        sql.push_str("    author_id INTEGER,\n");
        sql.push_str("    owner_id INTEGER,\n");
        sql.push_str("    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n");
        sql.push_str("    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n");
        sql.push_str(")");

        sql
    }

    fn create_records_table(
        &self,
        conn: &mut SqliteConnection,
        collection_name: &str,
        schema: &CollectionSchema,
    ) -> Result<(), AuthError> {
        tracing::debug!(
            "Generating CREATE TABLE SQL for collection: {}",
            collection_name
        );
        let create_sql = self.generate_create_table_sql(collection_name, schema);
        tracing::debug!("Generated SQL: {}", create_sql);

        tracing::debug!("Executing CREATE TABLE statement");
        diesel::sql_query(&create_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to create records table: {:?}", e);
            AuthError::InternalError
        })?;
        tracing::debug!("Records table created successfully");

        // Create indexes
        let table_name = self.get_records_table_name(collection_name);
        let index_sql = format!(
            "CREATE INDEX idx_{}_created_at ON {} (created_at)",
            table_name, table_name
        );
        tracing::debug!("Creating index with SQL: {}", index_sql);
        diesel::sql_query(&index_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to create index: {:?}", e);
            AuthError::InternalError
        })?;
        tracing::debug!("Index created successfully");

        // Create update trigger
        let trigger_sql = format!(
            "CREATE TRIGGER update_{}_updated_at 
             AFTER UPDATE ON {}
             BEGIN
                 UPDATE {} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END",
            table_name, table_name, table_name
        );
        tracing::debug!("Creating trigger with SQL: {}", trigger_sql);
        diesel::sql_query(&trigger_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to create trigger: {:?}", e);
            AuthError::InternalError
        })?;
        tracing::debug!("Trigger created successfully");

        Ok(())
    }

    fn drop_records_table(
        &self,
        conn: &mut SqliteConnection,
        collection_name: &str,
    ) -> Result<(), AuthError> {
        let table_name = self.get_records_table_name(collection_name);

        // Drop trigger first
        let drop_trigger_sql = format!("DROP TRIGGER IF EXISTS update_{}_updated_at", table_name);
        diesel::sql_query(&drop_trigger_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        // Drop index
        let drop_index_sql = format!("DROP INDEX IF EXISTS idx_{}_created_at", table_name);
        diesel::sql_query(&drop_index_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        // Drop table
        let drop_table_sql = format!("DROP TABLE IF EXISTS {}", table_name);
        diesel::sql_query(&drop_table_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    fn update_records_table_schema(
        &self,
        conn: &mut SqliteConnection,
        collection_name: &str,
        old_schema: &CollectionSchema,
        new_schema: &CollectionSchema,
    ) -> Result<(), AuthError> {
        let table_name = self.get_records_table_name(collection_name);

        // Create maps for easier comparison
        let old_fields: std::collections::HashMap<String, &FieldDefinition> = old_schema
            .fields
            .iter()
            .map(|f| (f.name.clone(), f))
            .collect();
        let new_fields: std::collections::HashMap<String, &FieldDefinition> = new_schema
            .fields
            .iter()
            .map(|f| (f.name.clone(), f))
            .collect();

        // Check if we need to drop any columns
        let fields_to_drop: Vec<String> = old_fields
            .keys()
            .filter(|field_name| {
                !new_fields.contains_key(*field_name) && field_name.to_lowercase() != "id"
            })
            .cloned()
            .collect();

        // If we need to drop columns, use table recreation strategy
        if !fields_to_drop.is_empty() {
            debug!(
                "Dropping columns {:?} from table {}, using table recreation strategy",
                fields_to_drop,
                table_name
            );
            return self.recreate_table_with_schema(conn, collection_name, new_schema);
        }

        // Otherwise, just add new columns (existing logic)
        for field in &new_schema.fields {
            if !old_fields.contains_key(&field.name) && field.name.to_lowercase() != "id" {
                let field_type = self.map_field_type_to_sql(&field.field_type);
                let not_null = if field.required { " NOT NULL" } else { "" };

                let default_clause = if let Some(default_value) = &field.default_value {
                    match field.field_type {
                        FieldType::Text | FieldType::Email | FieldType::Url => {
                            if let Some(s) = default_value.as_str() {
                                format!(" DEFAULT '{}'", s.replace("'", "''"))
                            } else {
                                String::new()
                            }
                        }
                        FieldType::Number => {
                            if let Some(n) = default_value.as_f64() {
                                format!(" DEFAULT {}", n)
                            } else {
                                String::new()
                            }
                        }
                        FieldType::Boolean => {
                            if let Some(b) = default_value.as_bool() {
                                format!(" DEFAULT {}", if b { "1" } else { "0" })
                            } else {
                                String::new()
                            }
                        }
                        _ => String::new(),
                    }
                } else if field.required {
                    // For required fields without default, provide a sensible default
                    match field.field_type {
                        FieldType::Text
                        | FieldType::Email
                        | FieldType::Url
                        | FieldType::File
                        | FieldType::Relation => " DEFAULT ''".to_string(),
                        FieldType::Number => " DEFAULT 0".to_string(),
                        FieldType::Boolean => " DEFAULT 0".to_string(),
                        FieldType::Json => " DEFAULT '{}'".to_string(),
                        FieldType::Date => " DEFAULT CURRENT_TIMESTAMP".to_string(),
                    }
                } else {
                    String::new()
                };

                let add_column_sql = format!(
                    "ALTER TABLE {} ADD COLUMN {} {}{}{}",
                    table_name, field.name, field_type, not_null, default_clause
                );

                tracing::debug!("Adding column with SQL: {}", add_column_sql);
                diesel::sql_query(&add_column_sql)
                    .execute(conn)
                    .map_err(|e| {
                        tracing::error!("Failed to add column {}: {:?}", field.name, e);
                        AuthError::InternalError
                    })?;
            }
        }

        tracing::debug!("Schema update completed for table: {}", table_name);
        Ok(())
    }

    /// Recreates the table with new schema, preserving all existing data
    /// This is used when columns need to be dropped (SQLite limitation workaround)
    fn recreate_table_with_schema(
        &self,
        conn: &mut SqliteConnection,
        collection_name: &str,
        new_schema: &CollectionSchema,
    ) -> Result<(), AuthError> {
        let table_name = self.get_records_table_name(collection_name);
        let temp_table_name = format!("{}_temp_{}", table_name, chrono::Utc::now().timestamp());

        debug!("Starting table recreation for {}", table_name);

        // Step 1: Create new table with updated schema
        let create_temp_sql =
            self.generate_create_table_sql_with_name(&temp_table_name, new_schema);
        tracing::debug!("Creating temporary table with SQL: {}", create_temp_sql);
        diesel::sql_query(&create_temp_sql)
            .execute(conn)
            .map_err(|e| {
                tracing::error!("Failed to create temporary table: {:?}", e);
                AuthError::InternalError
            })?;

        // Step 2: Copy data from old table to new table
        // Only copy columns that exist in both schemas
        let common_columns = self.get_common_columns(collection_name, new_schema, conn)?;
        let columns_list = common_columns.join(", ");

        let copy_data_sql = format!(
            "INSERT INTO {} ({}) SELECT {} FROM {}",
            temp_table_name, columns_list, columns_list, table_name
        );

        tracing::debug!("Copying data with SQL: {}", copy_data_sql);
        diesel::sql_query(&copy_data_sql)
            .execute(conn)
            .map_err(|e| {
                tracing::error!("Failed to copy data to temporary table: {:?}", e);
                // Clean up temporary table on failure
                let _ = diesel::sql_query(&format!("DROP TABLE IF EXISTS {}", temp_table_name))
                    .execute(conn);
                AuthError::InternalError
            })?;

        // Step 3: Drop old table (including triggers and indexes)
        self.drop_records_table(conn, collection_name)?;

        // Step 4: Rename temporary table to original name
        let rename_sql = format!("ALTER TABLE {} RENAME TO {}", temp_table_name, table_name);
        tracing::debug!("Renaming table with SQL: {}", rename_sql);
        diesel::sql_query(&rename_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to rename temporary table: {:?}", e);
            AuthError::InternalError
        })?;

        // Step 5: Recreate indexes and triggers
        self.create_table_indexes_and_triggers(conn, collection_name)?;

        debug!("Table recreation completed successfully for {}", table_name);
        Ok(())
    }

    /// Generate CREATE TABLE SQL with custom table name
    fn generate_create_table_sql_with_name(
        &self,
        table_name: &str,
        schema: &CollectionSchema,
    ) -> String {
        let mut sql = format!("CREATE TABLE {} (\n", table_name);
        sql.push_str("    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,\n");

        for field in &schema.fields {
            // Skip 'id' field since it's already added as PRIMARY KEY
            // Also skip ownership fields since they're added automatically
            if field.name.to_lowercase() == "id"
                || field.name == "author_id"
                || field.name == "owner_id"
                || field.name == "created_at"
                || field.name == "updated_at"
            {
                continue;
            }

            let field_type = self.map_field_type_to_sql(&field.field_type);
            let not_null = if field.required { " NOT NULL" } else { "" };

            let default_clause = if let Some(default_value) = &field.default_value {
                match field.field_type {
                    FieldType::Text | FieldType::Email | FieldType::Url => {
                        if let Some(s) = default_value.as_str() {
                            format!(" DEFAULT '{}'", s.replace("'", "''"))
                        } else {
                            String::new()
                        }
                    }
                    FieldType::Number => {
                        if let Some(n) = default_value.as_f64() {
                            format!(" DEFAULT {}", n)
                        } else {
                            String::new()
                        }
                    }
                    FieldType::Boolean => {
                        if let Some(b) = default_value.as_bool() {
                            format!(" DEFAULT {}", if b { "TRUE" } else { "FALSE" })
                        } else {
                            String::new()
                        }
                    }
                    _ => String::new(),
                }
            } else {
                String::new()
            };

            sql.push_str(&format!(
                "    {} {}{}{},\n",
                field.name, field_type, not_null, default_clause
            ));
        }

        // Add ownership fields
        sql.push_str("    author_id INTEGER,\n");
        sql.push_str("    owner_id INTEGER,\n");
        sql.push_str("    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n");
        sql.push_str("    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n");
        sql.push_str(")");

        sql
    }

    /// Get columns that exist in both old table and new schema
    fn get_common_columns(
        &self,
        collection_name: &str,
        new_schema: &CollectionSchema,
        conn: &mut SqliteConnection,
    ) -> Result<Vec<String>, AuthError> {
        let table_name = self.get_records_table_name(collection_name);

        // Get existing columns from the table
        let pragma_sql = format!("PRAGMA table_info({})", table_name);

        #[derive(Debug, diesel::QueryableByName)]
        struct ColumnInfo {
            #[diesel(sql_type = diesel::sql_types::Text)]
            name: String,
        }

        let existing_columns: Vec<ColumnInfo> =
            diesel::sql_query(&pragma_sql).load(conn).map_err(|e| {
                tracing::error!("Failed to get table info: {:?}", e);
                AuthError::InternalError
            })?;

        let existing_column_names: std::collections::HashSet<String> =
            existing_columns.into_iter().map(|col| col.name).collect();

        // Start with system columns that should always exist
        let mut common_columns = vec![
            "id".to_string(),
            "created_at".to_string(),
            "updated_at".to_string(),
        ];

        // Add ownership columns if they exist in the old table
        let ownership_fields = ["owner_id", "author_id"];
        for field_name in &ownership_fields {
            if existing_column_names.contains(*field_name) {
                common_columns.push(field_name.to_string());
            }
        }

        // Add schema fields that exist in the old table
        for field in &new_schema.fields {
            if field.name.to_lowercase() != "id" && existing_column_names.contains(&field.name) {
                common_columns.push(field.name.clone());
            }
        }

        tracing::debug!("Common columns for migration: {:?}", common_columns);
        Ok(common_columns)
    }

    /// Create indexes and triggers for the table
    fn create_table_indexes_and_triggers(
        &self,
        conn: &mut SqliteConnection,
        collection_name: &str,
    ) -> Result<(), AuthError> {
        let table_name = self.get_records_table_name(collection_name);

        // Create index
        let index_sql = format!(
            "CREATE INDEX idx_{}_created_at ON {} (created_at)",
            table_name, table_name
        );
        tracing::debug!("Creating index with SQL: {}", index_sql);
        diesel::sql_query(&index_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to create index: {:?}", e);
            AuthError::InternalError
        })?;

        // Create update trigger
        let trigger_sql = format!(
            "CREATE TRIGGER update_{}_updated_at 
             AFTER UPDATE ON {}
             BEGIN
                 UPDATE {} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END",
            table_name, table_name, table_name
        );
        tracing::debug!("Creating trigger with SQL: {}", trigger_sql);
        diesel::sql_query(&trigger_sql).execute(conn).map_err(|e| {
            tracing::error!("Failed to create trigger: {:?}", e);
            AuthError::InternalError
        })?;

        Ok(())
    }

    // Create default permissions for a collection
    async fn create_default_permissions(&self, collection_id: i32) -> Result<(), AuthError> {
        if let Some(permission_service) = &self.permission_service {
            let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

            // Get all roles from the database
            let roles = roles::table
                .load::<Role>(&mut conn)
                .map_err(|_| AuthError::InternalError)?;

            // Define default permissions for each role
            for role in roles {
                let permissions = match role.name.as_str() {
                    "admin" => SetCollectionPermissionRequest {
                        role_name: role.name.clone(),
                        can_create: true,
                        can_read: true,
                        can_update: true,
                        can_delete: true,
                        can_list: true,
                    },
                    "user" => SetCollectionPermissionRequest {
                        role_name: role.name.clone(),
                        can_create: true,
                        can_read: true,
                        can_update: true,
                        can_delete: false,
                        can_list: true,
                    },
                    "guest" => SetCollectionPermissionRequest {
                        role_name: role.name.clone(),
                        can_create: false,
                        can_read: true,
                        can_update: false,
                        can_delete: false,
                        can_list: true,
                    },
                    _ => {
                        // For any other roles, give minimal permissions
                        SetCollectionPermissionRequest {
                            role_name: role.name.clone(),
                            can_create: false,
                            can_read: true,
                            can_update: false,
                            can_delete: false,
                            can_list: true,
                        }
                    }
                };

                // Create the permission using PermissionService
                if let Err(e) = permission_service
                    .set_collection_permission(collection_id, role.id, &permissions)
                    .await
                {
                    tracing::warn!(
                        "Failed to create default permission for role {}: {:?}",
                        role.name,
                        e
                    );
                }
            }
        }
        Ok(())
    }

    fn value_to_sql_string(&self, value: &Value, field_type: &FieldType) -> String {
        match field_type {
            FieldType::Text
            | FieldType::Email
            | FieldType::Url
            | FieldType::File
            | FieldType::Relation => {
                if let Some(s) = value.as_str() {
                    format!("'{}'", s.replace("'", "''"))
                } else {
                    "NULL".to_string()
                }
            }
            FieldType::Json => {
                // For JSON fields, serialize the entire value to a JSON string
                match serde_json::to_string(value) {
                    Ok(json_str) => format!("'{}'", json_str.replace("'", "''")),
                    Err(_) => "NULL".to_string(),
                }
            }
            FieldType::Number => {
                if let Some(n) = value.as_f64() {
                    n.to_string()
                } else {
                    "NULL".to_string()
                }
            }
            FieldType::Boolean => {
                if let Some(b) = value.as_bool() {
                    if b { "TRUE" } else { "FALSE" }.to_string()
                } else {
                    "NULL".to_string()
                }
            }
            FieldType::Date => {
                if let Some(s) = value.as_str() {
                    format!("'{}'", s.replace("'", "''"))
                } else {
                    "NULL".to_string()
                }
            }
        }
    }

    fn query_record_by_sql(
        &self,
        conn: &mut SqliteConnection,
        sql: &str,
        collection_name: &str,
    ) -> Result<RecordResponse, AuthError> {
        use diesel::sql_types::*;

        // Get collection schema first
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(conn)
            .map_err(|_| AuthError::InternalError)?;

        let schema = collection
            .get_schema()
            .map_err(|_| AuthError::InternalError)?;

        // Define a dynamic row structure for the query
        #[derive(Debug, diesel::QueryableByName)]
        struct DynamicRow {
            #[diesel(sql_type = Integer)]
            id: i32,
            #[diesel(sql_type = Text)]
            created_at: String,
            #[diesel(sql_type = Text)]
            updated_at: String,
        }

        // Execute base query to get system columns
        let base_result: Vec<DynamicRow> = diesel::sql_query(sql)
            .load(conn)
            .map_err(|_| AuthError::NotFound("Record not found".to_string()))?;

        if base_result.is_empty() {
            return Err(AuthError::NotFound("Record not found".to_string()));
        }

        let base_row = &base_result[0];

        // Get field values using separate queries (more reliable than dynamic parsing)
        let mut data = Map::new();
        let table_name = self.get_records_table_name(collection_name);

        for field in &schema.fields {
            let field_value = match field.field_type {
                FieldType::Text
                | FieldType::Email
                | FieldType::Url
                | FieldType::File
                | FieldType::Relation => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct StringField {
                        #[diesel(sql_type = Nullable<Text>)]
                        value: Option<String>,
                    }

                    let query_with_alias = format!(
                        "SELECT {} as value FROM {} WHERE id = {}",
                        field.name, table_name, base_row.id
                    );
                    let result: Vec<StringField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;

                    if let Some(row) = result.first() {
                        row.value
                            .as_ref()
                            .map(|s| Value::String(s.clone()))
                            .unwrap_or(Value::Null)
                    } else {
                        Value::Null
                    }
                }
                FieldType::Json => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct JsonField {
                        #[diesel(sql_type = Nullable<Text>)]
                        value: Option<String>,
                    }

                    let query_with_alias = format!(
                        "SELECT {} as value FROM {} WHERE id = {}",
                        field.name, table_name, base_row.id
                    );
                    let result: Vec<JsonField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;

                    if let Some(row) = result.first() {
                        if let Some(json_str) = &row.value {
                            // Try to parse the JSON string back to a Value
                            match serde_json::from_str(json_str) {
                                Ok(json_value) => json_value,
                                Err(_) => Value::String(json_str.clone()), // Fallback to string if parsing fails
                            }
                        } else {
                            Value::Null
                        }
                    } else {
                        Value::Null
                    }
                }
                FieldType::Number => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct NumberField {
                        #[diesel(sql_type = Nullable<Double>)]
                        value: Option<f64>,
                    }

                    let query_with_alias = format!(
                        "SELECT {} as value FROM {} WHERE id = {}",
                        field.name, table_name, base_row.id
                    );
                    let result: Vec<NumberField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;

                    if let Some(row) = result.first() {
                        if let Some(n) = row.value {
                            // Check if it's a whole number (integer)
                            if n.fract() == 0.0 && n >= i64::MIN as f64 && n <= i64::MAX as f64 {
                                Value::Number(serde_json::Number::from(n as i64))
                            } else {
                                Value::Number(
                                    serde_json::Number::from_f64(n)
                                        .unwrap_or(serde_json::Number::from(0)),
                                )
                            }
                        } else {
                            Value::Null
                        }
                    } else {
                        Value::Null
                    }
                }
                FieldType::Boolean => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct BoolField {
                        #[diesel(sql_type = Nullable<Bool>)]
                        value: Option<bool>,
                    }

                    let query_with_alias = format!(
                        "SELECT {} as value FROM {} WHERE id = {}",
                        field.name, table_name, base_row.id
                    );
                    let result: Vec<BoolField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;

                    if let Some(row) = result.first() {
                        row.value.map(|b| Value::Bool(b)).unwrap_or(Value::Null)
                    } else {
                        Value::Null
                    }
                }
                FieldType::Date => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct DateField {
                        #[diesel(sql_type = Nullable<Timestamp>)]
                        value: Option<String>,
                    }

                    let query_with_alias = format!(
                        "SELECT {} as value FROM {} WHERE id = {}",
                        field.name, table_name, base_row.id
                    );
                    let result: Vec<DateField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;

                    if let Some(row) = result.first() {
                        row.value
                            .as_ref()
                            .map(|s| Value::String(s.clone()))
                            .unwrap_or(Value::Null)
                    } else {
                        Value::Null
                    }
                }
            };

            data.insert(field.name.clone(), field_value);
        }

        // Add ownership fields if they exist in the table
        let ownership_fields = ["owner_id", "author_id"];
        for field_name in &ownership_fields {
            #[derive(Debug, diesel::QueryableByName)]
            struct OwnershipField {
                #[diesel(sql_type = Nullable<Integer>)]
                value: Option<i32>,
            }

            let query_with_alias = format!(
                "SELECT {} as value FROM {} WHERE id = {}",
                field_name, table_name, base_row.id
            );

            // Try to query the ownership field, ignore if column doesn't exist
            if let Ok(result) = diesel::sql_query(&query_with_alias).load::<OwnershipField>(conn) {
                if let Some(row) = result.first() {
                    if let Some(value) = row.value {
                        data.insert(
                            field_name.to_string(),
                            Value::Number(serde_json::Number::from(value)),
                        );
                    }
                }
            }
        }

        Ok(RecordResponse {
            id: base_row.id.to_string(),
            collection_id: collection.id.to_string(),
            data: Value::Object(data),
            created_at: base_row.created_at.clone(),
            updated_at: base_row.updated_at.clone(),
        })
    }

    // Collection management methods
    pub async fn create_collection(
        &self,
        request: CreateCollectionRequest,
    ) -> Result<CollectionResponse, AuthError> {
        tracing::debug!("Starting create_collection for: {}", request.name);

        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get database connection: {:?}", e);
            AuthError::InternalError
        })?;

        tracing::debug!("Got database connection successfully");

        // Validate collection name
        tracing::debug!("Validating collection name: {}", request.name);
        self.validate_collection_name(&request.name)?;
        tracing::debug!("Collection name validation passed");

        // Check if collection with this name already exists
        tracing::debug!("Checking if collection already exists");
        let existing = collections::table
            .filter(collections::name.eq(&request.name))
            .first::<Collection>(&mut conn)
            .optional()
            .map_err(|e| {
                tracing::error!("Failed to check existing collection: {:?}", e);
                AuthError::InternalError
            })?;

        if existing.is_some() {
            tracing::debug!("Collection already exists");
            return Err(AuthError::ValidationError(vec![
                "Collection with this name already exists".to_string(),
            ]));
        }
        tracing::debug!("Collection does not exist, proceeding");

        // Validate schema
        tracing::debug!("Validating schema");
        self.validate_schema(&request.schema)?;
        tracing::debug!("Schema validation passed");

        tracing::debug!("Serializing schema to JSON");
        let schema_json = serde_json::to_string(&request.schema).map_err(|e| {
            tracing::error!("Failed to serialize schema: {:?}", e);
            AuthError::InternalError
        })?;
        tracing::debug!("Schema serialized successfully");

        let new_collection = NewCollection {
            name: request.name.clone(),
            display_name: request.display_name,
            description: request.description,
            schema_json,
            is_system: false,
        };

        // Insert collection metadata
        tracing::debug!("Inserting collection metadata");
        diesel::insert_into(collections::table)
            .values(&new_collection)
            .execute(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to insert collection metadata: {:?}", e);
                AuthError::InternalError
            })?;
        tracing::debug!("Collection metadata inserted successfully");

        // Create dedicated records table
        tracing::debug!("Creating records table for collection: {}", request.name);
        self.create_records_table(&mut conn, &request.name, &request.schema)?;
        tracing::debug!("Records table created successfully");

        tracing::debug!("Fetching created collection");
        let collection = collections::table
            .filter(collections::name.eq(&new_collection.name))
            .first::<Collection>(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to fetch created collection: {:?}", e);
                AuthError::InternalError
            })?;
        tracing::debug!("Collection fetched successfully");

        tracing::debug!("Creating default permissions for collection");
        if let Err(e) = self.create_default_permissions(collection.id).await {
            tracing::warn!(
                "Failed to create default permissions for collection {}: {:?}",
                collection.name,
                e
            );
        } else {
            tracing::debug!("Default permissions created successfully");
        }

        tracing::debug!("Converting collection to response");
        let response = CollectionResponse::from_collection(collection).map_err(|e| {
            tracing::error!("Failed to convert collection to response: {:?}", e);
            AuthError::InternalError
        })?;
        tracing::debug!("Collection creation completed successfully");
        Ok(response)
    }

    pub async fn get_collection(&self, name: &str) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        CollectionResponse::from_collection(collection).map_err(|_| AuthError::InternalError)
    }

    pub async fn get_collection_by_id(&self, id: i32) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let collection = collections::table
            .filter(collections::id.eq(id))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        CollectionResponse::from_collection(collection).map_err(|_| AuthError::InternalError)
    }

    pub async fn list_collections(&self) -> Result<Vec<CollectionResponse>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let collections_list = collections::table
            .filter(collections::is_system.eq(false))
            .order(collections::created_at.desc())
            .load::<Collection>(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        let mut responses = Vec::new();
        for collection in collections_list {
            let response = CollectionResponse::from_collection(collection)
                .map_err(|_| AuthError::InternalError)?;
            responses.push(response);
        }

        Ok(responses)
    }

    pub async fn update_collection(
        &self,
        name: &str,
        request: UpdateCollectionRequest,
    ) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Check if it's a system collection
        if collection.is_system {
            return Err(AuthError::Forbidden(
                "Cannot modify system collections".to_string(),
            ));
        }

        // If name is being changed, validate it and rename the records table
        if let Some(ref new_name) = request.name {
            if new_name != &collection.name {
                // Validate new name
                if !new_name.chars().all(|c| c.is_alphanumeric() || c == '_') || new_name.is_empty()
                {
                    return Err(AuthError::BadRequest(
                        "Collection name must contain only alphanumeric characters and underscores"
                            .to_string(),
                    ));
                }

                // Check if new name already exists
                let existing = collections::table
                    .filter(collections::name.eq(new_name))
                    .first::<Collection>(&mut conn)
                    .optional()
                    .map_err(|_| AuthError::InternalError)?;

                if existing.is_some() {
                    return Err(AuthError::BadRequest(
                        "Collection with this name already exists".to_string(),
                    ));
                }

                // Rename the records table
                let old_table_name = self.get_records_table_name(&collection.name);
                let new_table_name = self.get_records_table_name(new_name);

                let rename_sql = format!(
                    "ALTER TABLE {} RENAME TO {}",
                    old_table_name, new_table_name
                );
                diesel::sql_query(&rename_sql)
                    .execute(&mut conn)
                    .map_err(|_| AuthError::InternalError)?;
            }
        }

        let mut update = UpdateCollection {
            name: request.name,
            display_name: request.display_name,
            description: request.description,
            schema_json: None,
        };

        // If schema is being updated, validate it and update table structure
        if let Some(schema) = request.schema {
            self.validate_schema(&schema)?;

            // Get current schema for comparison
            let current_schema = collection
                .get_schema()
                .map_err(|_| AuthError::InternalError)?;

            // Update table structure if schema changed
            self.update_records_table_schema(
                &mut conn,
                &collection.name,
                &current_schema,
                &schema,
            )?;

            update.schema_json =
                Some(serde_json::to_string(&schema).map_err(|_| AuthError::InternalError)?);
        }

        diesel::update(collections::table)
            .filter(collections::id.eq(collection.id))
            .set(&update)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        let updated_collection = collections::table
            .filter(collections::id.eq(collection.id))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        CollectionResponse::from_collection(updated_collection)
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn delete_collection(&self, name: &str) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Check if it's a system collection
        if collection.is_system {
            return Err(AuthError::Forbidden(
                "Cannot delete system collections".to_string(),
            ));
        }

        // Delete all permissions for this collection first
        if let Some(permission_service) = &self.permission_service {
            if let Err(e) = permission_service
                .delete_collection_permissions(collection.id)
                .await
            {
                tracing::warn!(
                    "Failed to delete permissions for collection {}: {:?}",
                    name,
                    e
                );
            } else {
                debug!("Successfully deleted permissions for collection: {}", name);
            }
        }

        // Delete all files associated with records in this collection before dropping the table
        let schema = collection
            .get_schema()
            .map_err(|_| AuthError::InternalError)?;
        let file_deletion_errors = self.delete_collection_files(name, &schema).await;
        if !file_deletion_errors.is_empty() {
            tracing::warn!(
                "Some files could not be deleted for collection {}: {:?}",
                name,
                file_deletion_errors
            );
        }

        // Drop records table
        self.drop_records_table(&mut conn, name)?;

        // Delete collection metadata
        diesel::delete(collections::table.filter(collections::id.eq(collection.id)))
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    // Record management methods using dynamic tables
    pub async fn create_record(
        &self,
        collection_name: &str,
        request: CreateRecordRequest,
    ) -> Result<RecordResponse, AuthError> {
        self.create_record_with_events(collection_name, request, None)
            .await
    }

    pub async fn create_record_with_events(
        &self,
        collection_name: &str,
        request: CreateRecordRequest,
        user_id: Option<i32>,
    ) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Parse and validate data against schema
        let schema = collection
            .get_schema()
            .map_err(|_| AuthError::InternalError)?;

        // Process file uploads if any
        let mut data = request.data.clone();
        if let Some(files) = &request.files {
            let file_urls = self.process_file_uploads(&schema, files).await?;

            // Add file URLs to data
            if let Value::Object(ref mut map) = data {
                for (field_name, url) in file_urls {
                    map.insert(field_name, Value::String(url));
                }
            }
        }

        let validated_data = self.validate_record_data(&schema, &data)?;

        // Build INSERT SQL for dynamic table
        let table_name = self.get_records_table_name(collection_name);
        let mut columns = Vec::new();
        let mut values = Vec::new();

        // Add schema-defined fields
        for field in &schema.fields {
            if let Some(field_value) = validated_data.get(&field.name) {
                columns.push(field.name.clone());
                let sql_value = self.value_to_sql_string(field_value, &field.field_type);
                values.push(sql_value);
            }
        }

        // Add ownership fields from request.data (these were added by ownership_service)
        let ownership_fields = ["owner_id", "author_id"];
        for field_name in &ownership_fields {
            if let Some(field_value) = request.data.get(field_name) {
                // Only add if not already included from schema
                if !columns.contains(&field_name.to_string()) {
                    columns.push(field_name.to_string());
                    let sql_value = self.value_to_sql_string(field_value, &FieldType::Number);
                    values.push(sql_value);
                }
            }
        }

        let insert_sql = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            table_name,
            columns.join(", "),
            values.join(", ")
        );

        diesel::sql_query(&insert_sql)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        // Get the inserted record
        let select_sql = format!("SELECT * FROM {} ORDER BY id DESC LIMIT 1", table_name);
        let record_response = self.query_record_by_sql(&mut conn, &select_sql, collection_name)?;

        // Emit WebSocket event
        let event = crate::models::RecordEvent::Created {
            record_id: record_response.id.to_string(),
            record: serde_json::to_value(&record_response.data).unwrap_or_default(),
        };
        self.emit_record_event(collection_name, event, user_id)
            .await;

        Ok(record_response)
    }

    pub async fn get_record(
        &self,
        collection_name: &str,
        record_id: i32,
    ) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Verify collection exists
        collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        let table_name = self.get_records_table_name(collection_name);
        let select_sql = format!("SELECT * FROM {} WHERE id = {}", table_name, record_id);

        self.query_record_by_sql(&mut conn, &select_sql, collection_name)
    }

    pub async fn list_records(
        &self,
        collection_name: &str,
        sort: Option<String>,
        filter: Option<String>,
        search: Option<String>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<RecordResponse>, AuthError> {
        tracing::debug!(
            "list_records called with collection_name={}, sort={:?}, filter={:?}, limit={:?}, offset={:?}",
            collection_name,
            sort,
            filter,
            limit,
            offset
        );

        let mut conn = self.pool.get().map_err(|e| {
            tracing::error!("Failed to get database connection: {:?}", e);
            AuthError::InternalError
        })?;

        // Verify collection exists and get schema
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|e| {
                tracing::error!("Failed to find collection '{}': {:?}", collection_name, e);
                AuthError::NotFound("Collection not found".to_string())
            })?;

        let schema = collection.get_schema().map_err(|e| {
            tracing::error!("Failed to parse collection schema: {:?}", e);
            AuthError::InternalError
        })?;

        // Create QueryEngine from parameters
        let query_engine = QueryEngine::new(sort, filter, search, limit, offset).map_err(|e| {
            tracing::error!("Failed to create QueryEngine: {:?}", e);
            e
        })?;

        // Build complete SQL query using QueryEngine
        let table_name = self.get_records_table_name(collection_name);
        let (sql, parameters) = query_engine.build_complete_query(&table_name, &schema)?;

        // Execute query with improved parameter safety
        tracing::debug!(
            "Executing SQL: {} with {} parameters",
            sql,
            parameters.len()
        );

        // Get all matching records with safer parameter handling
        use diesel::sql_types::*;

        #[derive(Debug, diesel::QueryableByName)]
        struct RecordRow {
            #[diesel(sql_type = Integer)]
            id: i32,
        }

        // Use SQLite parameter binding with proper escaping
        let mut final_sql = sql;
        for param in parameters.iter() {
            // Properly escape the parameter value using SQLite standard
            let escaped_param = param.replace("'", "''");
            final_sql = final_sql.replacen("?", &format!("'{}'", escaped_param), 1);
        }

        tracing::debug!("Final SQL after parameter substitution: {}", final_sql);

        let rows: Vec<RecordRow> = diesel::sql_query(&final_sql).load(&mut conn).map_err(|e| {
            tracing::error!("Failed to execute SQL query '{}': {:?}", final_sql, e);
            AuthError::InternalError
        })?;

        let mut responses = Vec::new();
        for row in rows {
            let select_sql = format!("SELECT * FROM {} WHERE id = {}", table_name, row.id);
            let response = self.query_record_by_sql(&mut conn, &select_sql, collection_name)?;
            responses.push(response);
        }

        Ok(responses)
    }

    pub async fn update_record(
        &self,
        collection_name: &str,
        record_id: i32,
        request: UpdateRecordRequest,
    ) -> Result<RecordResponse, AuthError> {
        self.update_record_with_events(collection_name, record_id, request, None)
            .await
    }

    pub async fn update_record_with_events(
        &self,
        collection_name: &str,
        record_id: i32,
        request: UpdateRecordRequest,
        user_id: Option<i32>,
    ) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Parse and validate data against schema
        let schema = collection
            .get_schema()
            .map_err(|_| AuthError::InternalError)?;

        // Get the current record to check for existing files that need to be deleted
        let table_name = self.get_records_table_name(collection_name);
        let select_sql = format!("SELECT * FROM {} WHERE id = {}", table_name, record_id);
        let old_record = self
            .query_record_by_sql(&mut conn, &select_sql, collection_name)
            .ok();

        // Process file uploads if any
        let mut data = request.data.clone();
        if let Some(files) = &request.files {
            // Delete old files for fields that are being updated with new files
            if let Some(ref old_rec) = old_record {
                if let Some(s3_service) = &self.s3_service {
                    for (field_name, _) in files {
                        // Check if this field is a file field in the schema
                        if let Some(field_def) =
                            schema.fields.iter().find(|f| f.name == *field_name)
                        {
                            if field_def.field_type == FieldType::File {
                                // Get the old file URL and delete it
                                if let Some(old_url) = old_rec.data.get(field_name) {
                                    if let Some(url_str) = old_url.as_str() {
                                        if !url_str.is_empty() {
                                            if let Err(e) = s3_service.delete_file(url_str).await {
                                                tracing::warn!(
                                                    "Failed to delete old file '{}' for field '{}': {}",
                                                    url_str,
                                                    field_name,
                                                    e
                                                );
                                            } else {
                                                debug!(
                                                    "Deleted old file '{}' for field '{}'",
                                                    url_str,
                                                    field_name
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            let file_urls = self.process_file_uploads(&schema, files).await?;

            // Add file URLs to data
            if let Value::Object(ref mut map) = data {
                for (field_name, url) in file_urls {
                    map.insert(field_name, Value::String(url));
                }
            }
        }

        let validated_data = self.validate_record_data(&schema, &data)?;

        // Build UPDATE SQL for dynamic table
        let table_name = self.get_records_table_name(collection_name);
        let mut set_clauses = Vec::new();

        // Add schema-defined fields
        for field in &schema.fields {
            if let Some(field_value) = validated_data.get(&field.name) {
                let sql_value = self.value_to_sql_string(field_value, &field.field_type);
                set_clauses.push(format!("{} = {}", field.name, sql_value));
            }
        }

        // Add ownership fields from data (if being updated)
        let ownership_fields = ["owner_id", "author_id"];
        for field_name in &ownership_fields {
            if let Some(field_value) = data.get(field_name) {
                // Check if this field wasn't already processed from schema
                let already_processed = schema.fields.iter().any(|f| f.name == *field_name);
                if !already_processed {
                    let sql_value = self.value_to_sql_string(field_value, &FieldType::Number);
                    set_clauses.push(format!("{} = {}", field_name, sql_value));
                }
            }
        }

        if set_clauses.is_empty() {
            return Err(AuthError::ValidationError(vec![
                "No fields to update".to_string(),
            ]));
        }

        // Note: old_record was already fetched earlier for file deletion

        // Apply the update
        let update_sql = format!(
            "UPDATE {} SET {}, updated_at = CURRENT_TIMESTAMP WHERE id = {}",
            table_name,
            set_clauses.join(", "),
            record_id
        );

        let affected_rows = diesel::sql_query(&update_sql)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        if affected_rows == 0 {
            return Err(AuthError::NotFound("Record not found".to_string()));
        }

        // Get the updated record
        let record_response = self.query_record_by_sql(&mut conn, &select_sql, collection_name)?;

        // Emit WebSocket event with old record data
        let event = crate::models::RecordEvent::Updated {
            record_id: record_response.id.to_string(),
            record: serde_json::to_value(&record_response.data).unwrap_or_default(),
            old_record: old_record.map(|r| serde_json::to_value(&r.data).unwrap_or_default()),
        };
        self.emit_record_event(collection_name, event, user_id)
            .await;

        Ok(record_response)
    }

    pub async fn delete_record(
        &self,
        collection_name: &str,
        record_id: i32,
    ) -> Result<(), AuthError> {
        self.delete_record_with_events(collection_name, record_id, None)
            .await
    }

    /// Delete all files associated with records in a collection from S3
    async fn delete_collection_files(
        &self,
        collection_name: &str,
        schema: &CollectionSchema,
    ) -> Vec<String> {
        let mut errors = Vec::new();

        // Check if there are any file fields in the schema
        let has_file_fields = schema
            .fields
            .iter()
            .any(|field| field.field_type == FieldType::File);
        if !has_file_fields {
            return errors; // No file fields, nothing to delete
        }

        // Get all records from the collection
        match self
            .list_records(collection_name, None, None, None, None, None)
            .await
        {
            Ok(records) => {
                for record in records {
                    let file_deletion_errors = self.delete_record_files(schema, &record.data).await;
                    errors.extend(file_deletion_errors);
                }
            }
            Err(e) => {
                errors.push(format!(
                    "Failed to retrieve records for collection {}: {:?}",
                    collection_name, e
                ));
            }
        }

        errors
    }

    /// Delete files associated with a record from S3
    async fn delete_record_files(
        &self,
        schema: &CollectionSchema,
        record_data: &serde_json::Value,
    ) -> Vec<String> {
        let mut errors = Vec::new();

        // Check if S3 service is available
        let s3_service = match &self.s3_service {
            Some(service) => service,
            None => {
                tracing::debug!("S3 service not available, skipping file deletion");
                return errors;
            }
        };

        // Find all file fields in schema
        let file_fields: Vec<&FieldDefinition> = schema
            .fields
            .iter()
            .filter(|field| matches!(field.field_type, FieldType::File))
            .collect();

        if file_fields.is_empty() {
            return errors; // No file fields in this collection
        }

        // Extract file URLs from record data and delete them
        for field in file_fields {
            if let Some(file_url_value) = record_data.get(&field.name) {
                if let Some(file_url) = file_url_value.as_str() {
                    if !file_url.is_empty() {
                        match s3_service.delete_file(file_url).await {
                            Ok(_) => {
                                debug!(
                                    "Successfully deleted file '{}' for field '{}'",
                                    file_url,
                                    field.name
                                );
                            }
                            Err(e) => {
                                let error_msg = format!(
                                    "Failed to delete file '{}' for field '{}': {}",
                                    file_url, field.name, e
                                );
                                tracing::error!("{}", error_msg);
                                errors.push(error_msg);
                            }
                        }
                    }
                }
            }
        }

        errors
    }

    pub async fn delete_record_with_events(
        &self,
        collection_name: &str,
        record_id: i32,
        user_id: Option<i32>,
    ) -> Result<(), AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Verify collection exists
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Get collection schema
        let schema = collection
            .get_schema()
            .map_err(|_| AuthError::InternalError)?;

        let table_name = self.get_records_table_name(collection_name);

        // Get record before deletion (for files and event)
        let select_sql = format!("SELECT * FROM {} WHERE id = {}", table_name, record_id);
        let old_record = self
            .query_record_by_sql(&mut conn, &select_sql, collection_name)
            .ok();

        // Delete record from database
        let delete_sql = format!("DELETE FROM {} WHERE id = {}", table_name, record_id);
        let deleted_rows = diesel::sql_query(&delete_sql)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        if deleted_rows == 0 {
            return Err(AuthError::NotFound("Record not found".to_string()));
        }

        // Delete associated files from S3 (if record existed)
        if let Some(ref record) = old_record {
            let file_deletion_errors = self.delete_record_files(&schema, &record.data).await;
            if !file_deletion_errors.is_empty() {
                tracing::warn!(
                    "Some files could not be deleted for record {} in collection {}: {:?}",
                    record_id,
                    collection_name,
                    file_deletion_errors
                );
            }
        }

        // Emit WebSocket event
        let event = crate::models::RecordEvent::Deleted {
            record_id: record_id.to_string(),
            old_record: old_record.map(|r| serde_json::to_value(&r.data).unwrap_or_default()),
        };
        self.emit_record_event(collection_name, event, user_id)
            .await;

        Ok(())
    }

    pub async fn get_collections_stats(
        &self,
    ) -> Result<
        (
            i64,
            std::collections::HashMap<String, i64>,
            std::collections::HashMap<String, i64>,
            f64,
            Option<String>,
            Option<String>,
        ),
        AuthError,
    > {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let collections = self.list_collections().await?;
        let total_collections = collections.len() as i64;

        let mut total_records = 0i64;
        let mut records_per_collection = std::collections::HashMap::new();
        let mut field_types_distribution = std::collections::HashMap::new();

        let mut max_records = 0i64;
        let mut min_records = i64::MAX;
        let mut largest_collection: Option<String> = None;
        let mut smallest_collection: Option<String> = None;

        for collection in &collections {
            // Count records in this collection
            let table_name = self.get_records_table_name(&collection.name);
            let count_sql = format!("SELECT COUNT(*) as count FROM {}", table_name);

            #[derive(diesel::QueryableByName)]
            struct CountResult {
                #[diesel(sql_type = diesel::sql_types::BigInt)]
                count: i64,
            }

            let count_result: Result<CountResult, _> =
                diesel::sql_query(&count_sql).get_result(&mut conn);

            let record_count = match count_result {
                Ok(result) => result.count,
                Err(_) => 0, // Table might not exist yet
            };

            total_records += record_count;
            records_per_collection.insert(collection.name.clone(), record_count);

            // Track largest and smallest collections
            if record_count > max_records {
                max_records = record_count;
                largest_collection = Some(collection.name.clone());
            }
            if record_count < min_records && record_count >= 0 {
                min_records = record_count;
                smallest_collection = Some(collection.name.clone());
            }

            // Count field types
            for field in &collection.schema.fields {
                let field_type = format!("{:?}", field.field_type);
                *field_types_distribution.entry(field_type).or_insert(0) += 1;
            }
        }

        let average_records = if total_collections > 0 {
            total_records as f64 / total_collections as f64
        } else {
            0.0
        };

        // Handle edge case where all collections are empty
        if min_records == i64::MAX {
            smallest_collection = collections.first().map(|c| c.name.clone());
        }

        Ok((
            total_records,
            records_per_collection,
            field_types_distribution,
            average_records,
            largest_collection,
            smallest_collection,
        ))
    }

    // Validation methods
    fn validate_collection_name(&self, name: &str) -> Result<(), AuthError> {
        if name.is_empty() {
            return Err(AuthError::ValidationError(vec![
                "Collection name cannot be empty".to_string(),
            ]));
        }

        if name.len() > 50 {
            return Err(AuthError::ValidationError(vec![
                "Collection name too long (max 50 characters)".to_string(),
            ]));
        }

        // Check for valid characters (alphanumeric and underscore only)
        if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(AuthError::ValidationError(vec![
                "Collection name can only contain letters, numbers, and underscores".to_string(),
            ]));
        }

        // Check for reserved names
        let reserved_names = ["users", "auth", "admin", "api", "system"];
        if reserved_names.contains(&name) {
            return Err(AuthError::ValidationError(vec![
                "Collection name is reserved".to_string(),
            ]));
        }

        Ok(())
    }

    fn validate_schema(&self, schema: &CollectionSchema) -> Result<(), AuthError> {
        if schema.fields.is_empty() {
            return Err(AuthError::ValidationError(vec![
                "Schema must have at least one field".to_string(),
            ]));
        }

        let mut field_names = std::collections::HashSet::new();
        // Reserved field names that conflict with system columns (id is now allowed and will be skipped)
        let reserved_field_names = ["created_at", "updated_at"];

        for field in &schema.fields {
            // Check for duplicate field names
            if !field_names.insert(&field.name) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Duplicate field name: {}",
                    field.name
                )]));
            }

            // Check for reserved field names
            if reserved_field_names.contains(&field.name.as_str()) {
                return Err(AuthError::ValidationError(vec![format!(
                    "Field name '{}' is reserved and cannot be used",
                    field.name
                )]));
            }

            // Validate field name
            if field.name.is_empty() || field.name.len() > 50 {
                return Err(AuthError::ValidationError(vec![
                    "Field name must be 1-50 characters".to_string(),
                ]));
            }

            if !field.name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                return Err(AuthError::ValidationError(vec![
                    "Field name can only contain letters, numbers, and underscores".to_string(),
                ]));
            }
        }

        Ok(())
    }

    /// Process file uploads for fields of type "file"
    async fn process_file_uploads(
        &self,
        schema: &CollectionSchema,
        files: &std::collections::HashMap<String, FileUpload>,
    ) -> Result<std::collections::HashMap<String, String>, AuthError> {
        let mut file_urls = std::collections::HashMap::new();
        let mut uploaded_files = Vec::new();

        // Check if S3 service is available
        let s3_service = match &self.s3_service {
            Some(service) => service,
            None => {
                return Err(AuthError::ValidationError(vec![
                    "File upload is not configured. S3 service is not available.".to_string(),
                ]));
            }
        };

        // Validate that all file fields exist in schema and are of type "file"
        for (field_name, _file_upload) in files {
            let field_def = schema.fields.iter().find(|f| &f.name == field_name);
            match field_def {
                Some(field) if matches!(field.field_type, FieldType::File) => {
                    // Field exists and is of type "file", proceed with upload
                }
                Some(_) => {
                    return Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' is not of type 'file'",
                        field_name
                    )]));
                }
                None => {
                    return Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' does not exist in collection schema",
                        field_name
                    )]));
                }
            }
        }

        // Upload files to S3
        for (field_name, file_upload) in files {
            // Decode base64 data
            let file_data =
                match base64::engine::general_purpose::STANDARD.decode(&file_upload.data) {
                    Ok(data) => data,
                    Err(_) => {
                        // Cleanup previously uploaded files
                        s3_service.cleanup_files(uploaded_files).await;
                        return Err(AuthError::ValidationError(vec![format!(
                            "Invalid base64 data for file field '{}'",
                            field_name
                        )]));
                    }
                };

            // Upload file to S3
            match s3_service
                .upload_file(
                    file_data,
                    file_upload.filename.clone(),
                    file_upload.content_type.clone(),
                )
                .await
            {
                Ok(result) => {
                    uploaded_files.push(result.file_url.clone());
                    file_urls.insert(field_name.clone(), result.file_url);
                }
                Err(e) => {
                    // Cleanup previously uploaded files
                    s3_service.cleanup_files(uploaded_files).await;
                    tracing::error!("Failed to upload file for field '{}': {}", field_name, e);
                    return Err(AuthError::ValidationError(vec![format!(
                        "Failed to upload file for field '{}'",
                        field_name
                    )]));
                }
            }
        }

        Ok(file_urls)
    }

    fn validate_record_data(
        &self,
        schema: &CollectionSchema,
        data: &Value,
    ) -> Result<Value, AuthError> {
        let mut validated = Map::new();

        if let Some(data_obj) = data.as_object() {
            // Validate each field in the schema
            for field in &schema.fields {
                // Skip 'id' field as it's auto-generated by the database
                if field.name == "id" {
                    continue;
                }

                let field_value = data_obj.get(&field.name);

                // Check required fields
                if field.required && (field_value.is_none() || field_value == Some(&Value::Null)) {
                    return Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' is required",
                        field.name
                    )]));
                }

                // If field is not provided but has default value, use default
                let value_to_validate = if field_value.is_none() {
                    if let Some(default) = &field.default_value {
                        default
                    } else {
                        continue; // Skip optional fields without values
                    }
                } else {
                    field_value.unwrap()
                };

                // Validate field type and constraints
                let validated_value = self.validate_field_value(&field, value_to_validate)?;
                validated.insert(field.name.clone(), validated_value);
            }
        } else {
            return Err(AuthError::ValidationError(vec![
                "Record data must be a JSON object".to_string(),
            ]));
        }

        Ok(Value::Object(validated))
    }

    fn validate_field_value(
        &self,
        field: &FieldDefinition,
        value: &Value,
    ) -> Result<Value, AuthError> {
        // Type validation
        match field.field_type {
            FieldType::Text => {
                if let Some(s) = value.as_str() {
                    if let Some(validation) = &field.validation {
                        if let Some(min_len) = validation.min_length {
                            if s.len() < min_len {
                                return Err(AuthError::ValidationError(vec![format!(
                                    "Field '{}' is too short (minimum {} characters)",
                                    field.name, min_len
                                )]));
                            }
                        }
                        if let Some(max_len) = validation.max_length {
                            if s.len() > max_len {
                                return Err(AuthError::ValidationError(vec![format!(
                                    "Field '{}' is too long (maximum {} characters)",
                                    field.name, max_len
                                )]));
                            }
                        }
                        if let Some(pattern) = &validation.pattern {
                            match regex::Regex::new(pattern) {
                                Ok(regex) => {
                                    if !regex.is_match(s) {
                                        return Err(AuthError::ValidationError(vec![format!(
                                            "Field '{}' does not match required pattern: {}",
                                            field.name, pattern
                                        )]));
                                    }
                                }
                                Err(_) => {
                                    return Err(AuthError::ValidationError(vec![format!(
                                        "Invalid regex pattern for field '{}': {}",
                                        field.name, pattern
                                    )]));
                                }
                            }
                        }
                        if let Some(enum_values) = &validation.enum_values {
                            if !enum_values.contains(&s.to_string()) {
                                return Err(AuthError::ValidationError(vec![format!(
                                    "Field '{}' must be one of: {:?}",
                                    field.name, enum_values
                                )]));
                            }
                        }
                    }
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be text",
                        field.name
                    )]))
                }
            }
            FieldType::Number => {
                if let Some(n) = value.as_f64() {
                    if let Some(validation) = &field.validation {
                        if let Some(min_val) = validation.min_value {
                            if n < min_val {
                                return Err(AuthError::ValidationError(vec![format!(
                                    "Field '{}' is too small (minimum {})",
                                    field.name, min_val
                                )]));
                            }
                        }
                        if let Some(max_val) = validation.max_value {
                            if n > max_val {
                                return Err(AuthError::ValidationError(vec![format!(
                                    "Field '{}' is too large (maximum {})",
                                    field.name, max_val
                                )]));
                            }
                        }
                    }
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a number",
                        field.name
                    )]))
                }
            }
            FieldType::Boolean => {
                if value.is_boolean() {
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a boolean",
                        field.name
                    )]))
                }
            }
            FieldType::Email => {
                if let Some(s) = value.as_str() {
                    // Simple email validation
                    if s.contains('@') && s.contains('.') {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!(
                            "Field '{}' must be a valid email address",
                            field.name
                        )]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be text",
                        field.name
                    )]))
                }
            }
            FieldType::Json => Ok(value.clone()), // Any JSON value is valid
            FieldType::Date => {
                if let Some(s) = value.as_str() {
                    // Validate date format (YYYY-MM-DD)
                    match chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                        Ok(_) => Ok(value.clone()),
                        Err(_) => Err(AuthError::ValidationError(vec![format!(
                            "Field '{}' must be a valid date in YYYY-MM-DD format",
                            field.name
                        )])),
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a date string",
                        field.name
                    )]))
                }
            }
            FieldType::Url => {
                if let Some(s) = value.as_str() {
                    // Basic URL validation
                    if s.starts_with("http://") || s.starts_with("https://") {
                        // Further validation could include proper URL parsing
                        if s.contains('.') && s.len() > 10 {
                            Ok(value.clone())
                        } else {
                            Err(AuthError::ValidationError(vec![format!(
                                "Field '{}' must be a valid URL",
                                field.name
                            )]))
                        }
                    } else {
                        Err(AuthError::ValidationError(vec![format!(
                            "Field '{}' must be a valid URL starting with http:// or https://",
                            field.name
                        )]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a URL string",
                        field.name
                    )]))
                }
            }
            FieldType::File => {
                if let Some(s) = value.as_str() {
                    // TODO: For now, treat file as a path string - in future this could be enhanced
                    // to validate file existence, size limits, file types, etc.
                    if !s.is_empty() && s.len() <= 500 {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!(
                            "Field '{}' must be a valid file path (max 500 characters)",
                            field.name
                        )]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a file path string",
                        field.name
                    )]))
                }
            }
            FieldType::Relation => {
                // Relation should be an ID reference to another record
                if let Some(s) = value.as_str() {
                    // Basic validation - should be a non-empty string ID
                    if !s.is_empty() && s.len() <= 50 {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!(
                            "Field '{}' must be a valid relation ID (max 50 characters)",
                            field.name
                        )]))
                    }
                } else if let Some(_n) = value.as_i64() {
                    // Also accept numeric IDs
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!(
                        "Field '{}' must be a relation ID (string or number)",
                        field.name
                    )]))
                }
            }
        }
    }
}
