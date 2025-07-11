use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use serde_json::{Value, Map};
use crate::models::{
    Collection, NewCollection, UpdateCollection, CollectionSchema, FieldDefinition, FieldType,
    CreateCollectionRequest, UpdateCollectionRequest, CreateRecordRequest, UpdateRecordRequest,
    CollectionResponse, RecordResponse
};
use crate::schema::collections;
use crate::utils::AuthError;
use crate::query_engine::QueryEngine;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct CollectionService {
    pub pool: DbPool,
}

impl CollectionService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
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

    fn generate_create_table_sql(&self, collection_name: &str, schema: &CollectionSchema) -> String {
        let table_name = self.get_records_table_name(collection_name);
        let mut sql = format!("CREATE TABLE {} (\n", table_name);
        sql.push_str("    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,\n");

        for field in &schema.fields {
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

            sql.push_str(&format!("    {} {}{}{},\n", field.name, field_type, not_null, default_clause));
        }

        sql.push_str("    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n");
        sql.push_str("    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n");
        sql.push_str(")");

        sql
    }

    fn create_records_table(&self, conn: &mut SqliteConnection, collection_name: &str, schema: &CollectionSchema) -> Result<(), AuthError> {
        let create_sql = self.generate_create_table_sql(collection_name, schema);
        
        diesel::sql_query(&create_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        // Create indexes
        let table_name = self.get_records_table_name(collection_name);
        let index_sql = format!("CREATE INDEX idx_{}_created_at ON {} (created_at)", table_name, table_name);
        diesel::sql_query(&index_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        // Create update trigger
        let trigger_sql = format!(
            "CREATE TRIGGER update_{}_updated_at 
             AFTER UPDATE ON {}
             BEGIN
                 UPDATE {} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
             END",
            table_name, table_name, table_name
        );
        diesel::sql_query(&trigger_sql)
            .execute(conn)
            .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    fn drop_records_table(&self, conn: &mut SqliteConnection, collection_name: &str) -> Result<(), AuthError> {
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

    fn value_to_sql_string(&self, value: &Value, field_type: &FieldType) -> String {
        match field_type {
            FieldType::Text | FieldType::Email | FieldType::Url | FieldType::Json | FieldType::File | FieldType::Relation => {
                if let Some(s) = value.as_str() {
                    format!("'{}'", s.replace("'", "''"))
                } else {
                    "NULL".to_string()
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

    fn query_record_by_sql(&self, conn: &mut SqliteConnection, sql: &str, collection_name: &str) -> Result<RecordResponse, AuthError> {
        use diesel::sql_types::*;
        
        // Get collection schema first
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(conn)
            .map_err(|_| AuthError::InternalError)?;

        let schema = collection.get_schema()
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
            let _field_query = format!("SELECT {} FROM {} WHERE id = {}", field.name, table_name, base_row.id);
            
            let field_value = match field.field_type {
                FieldType::Text | FieldType::Email | FieldType::Url | FieldType::Json | FieldType::File | FieldType::Relation => {
                    #[derive(Debug, diesel::QueryableByName)]
                    struct StringField {
                        #[diesel(sql_type = Nullable<Text>)]
                        value: Option<String>,
                    }
                    
                    let query_with_alias = format!("SELECT {} as value FROM {} WHERE id = {}", field.name, table_name, base_row.id);
                    let result: Vec<StringField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;
                    
                    if let Some(row) = result.first() {
                        row.value.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null)
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
                    
                    let query_with_alias = format!("SELECT {} as value FROM {} WHERE id = {}", field.name, table_name, base_row.id);
                    let result: Vec<NumberField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;
                    
                    if let Some(row) = result.first() {
                        if let Some(n) = row.value {
                            // Check if it's a whole number (integer)
                            if n.fract() == 0.0 && n >= i64::MIN as f64 && n <= i64::MAX as f64 {
                                Value::Number(serde_json::Number::from(n as i64))
                            } else {
                                Value::Number(serde_json::Number::from_f64(n).unwrap_or(serde_json::Number::from(0)))
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
                    
                    let query_with_alias = format!("SELECT {} as value FROM {} WHERE id = {}", field.name, table_name, base_row.id);
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
                    
                    let query_with_alias = format!("SELECT {} as value FROM {} WHERE id = {}", field.name, table_name, base_row.id);
                    let result: Vec<DateField> = diesel::sql_query(&query_with_alias)
                        .load(conn)
                        .map_err(|_| AuthError::InternalError)?;
                    
                    if let Some(row) = result.first() {
                        row.value.as_ref().map(|s| Value::String(s.clone())).unwrap_or(Value::Null)
                    } else {
                        Value::Null
                    }
                }
            };
            
            data.insert(field.name.clone(), field_value);
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
    pub async fn create_collection(&self, request: CreateCollectionRequest) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Validate collection name
        self.validate_collection_name(&request.name)?;

        // Check if collection with this name already exists
        let existing = collections::table
            .filter(collections::name.eq(&request.name))
            .first::<Collection>(&mut conn)
            .optional()
            .map_err(|_| AuthError::InternalError)?;

        if existing.is_some() {
            return Err(AuthError::ValidationError(vec!["Collection with this name already exists".to_string()]));
        }

        // Validate schema
        self.validate_schema(&request.schema)?;

        let schema_json = serde_json::to_string(&request.schema)
            .map_err(|_| AuthError::InternalError)?;

        let new_collection = NewCollection {
            name: request.name.clone(),
            display_name: request.display_name,
            description: request.description,
            schema_json,
            is_system: Some(false),
        };

        // Insert collection metadata
        diesel::insert_into(collections::table)
            .values(&new_collection)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        // Create dedicated records table
        self.create_records_table(&mut conn, &request.name, &request.schema)?;

        let collection = collections::table
            .filter(collections::name.eq(&new_collection.name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        CollectionResponse::from_collection(collection)
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn get_collection(&self, name: &str) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        CollectionResponse::from_collection(collection)
            .map_err(|_| AuthError::InternalError)
    }

    pub async fn list_collections(&self) -> Result<Vec<CollectionResponse>, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

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

    pub async fn update_collection(&self, name: &str, request: UpdateCollectionRequest) -> Result<CollectionResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Check if it's a system collection
        if collection.is_system {
            return Err(AuthError::Forbidden("Cannot modify system collections".to_string()));
        }

        let mut update = UpdateCollection {
            display_name: request.display_name,
            description: request.description,
            schema_json: None,
        };

        // If schema is being updated, validate it
        if let Some(schema) = request.schema {
            self.validate_schema(&schema)?;
            update.schema_json = Some(serde_json::to_string(&schema)
                .map_err(|_| AuthError::InternalError)?);
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
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Check if it's a system collection
        if collection.is_system {
            return Err(AuthError::Forbidden("Cannot delete system collections".to_string()));
        }

        // Drop records table first
        self.drop_records_table(&mut conn, name)?;

        // Delete collection metadata
        diesel::delete(collections::table.filter(collections::id.eq(collection.id)))
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        Ok(())
    }

    // Record management methods using dynamic tables
    pub async fn create_record(&self, collection_name: &str, request: CreateRecordRequest) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Parse and validate data against schema
        let schema = collection.get_schema()
            .map_err(|_| AuthError::InternalError)?;
        
        let validated_data = self.validate_record_data(&schema, &request.data)?;

        // Build INSERT SQL for dynamic table
        let table_name = self.get_records_table_name(collection_name);
        let mut columns = Vec::new();
        let mut values = Vec::new();

        for field in &schema.fields {
            if let Some(field_value) = validated_data.get(&field.name) {
                columns.push(field.name.clone());
                let sql_value = self.value_to_sql_string(field_value, &field.field_type);
                values.push(sql_value);
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
        self.query_record_by_sql(&mut conn, &select_sql, collection_name)
    }

    pub async fn get_record(&self, collection_name: &str, record_id: i32) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

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
        offset: Option<i64>
    ) -> Result<Vec<RecordResponse>, AuthError> {
        tracing::debug!("list_records called with collection_name={}, sort={:?}, filter={:?}, limit={:?}, offset={:?}", 
                       collection_name, sort, filter, limit, offset);
        
        let mut conn = self.pool.get()
            .map_err(|e| {
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

        let schema = collection.get_schema()
            .map_err(|e| {
                tracing::error!("Failed to parse collection schema: {:?}", e);
                AuthError::InternalError
            })?;

        // Create QueryEngine from parameters
        let query_engine = QueryEngine::new(sort, filter, search, limit, offset)
            .map_err(|e| {
                tracing::error!("Failed to create QueryEngine: {:?}", e);
                e
            })?;

        // Build complete SQL query using QueryEngine
        let table_name = self.get_records_table_name(collection_name);
        let (sql, parameters) = query_engine.build_complete_query(&table_name, &schema)?;

        // Execute query with improved parameter safety
        tracing::debug!("Executing SQL: {} with {} parameters", sql, parameters.len());

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

        let rows: Vec<RecordRow> = diesel::sql_query(&final_sql)
            .load(&mut conn)
            .map_err(|e| {
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

    pub async fn update_record(&self, collection_name: &str, record_id: i32, request: UpdateRecordRequest) -> Result<RecordResponse, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Find the collection
        let collection = collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        // Parse and validate data against schema
        let schema = collection.get_schema()
            .map_err(|_| AuthError::InternalError)?;
        
        let validated_data = self.validate_record_data(&schema, &request.data)?;

        // Build UPDATE SQL for dynamic table
        let table_name = self.get_records_table_name(collection_name);
        let mut set_clauses = Vec::new();

        for field in &schema.fields {
            if let Some(field_value) = validated_data.get(&field.name) {
                let sql_value = self.value_to_sql_string(field_value, &field.field_type);
                set_clauses.push(format!("{} = {}", field.name, sql_value));
            }
        }

        if set_clauses.is_empty() {
            return Err(AuthError::ValidationError(vec!["No fields to update".to_string()]));
        }

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
        let select_sql = format!("SELECT * FROM {} WHERE id = {}", table_name, record_id);
        self.query_record_by_sql(&mut conn, &select_sql, collection_name)
    }

    pub async fn delete_record(&self, collection_name: &str, record_id: i32) -> Result<(), AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        // Verify collection exists
        collections::table
            .filter(collections::name.eq(collection_name))
            .first::<Collection>(&mut conn)
            .map_err(|_| AuthError::NotFound("Collection not found".to_string()))?;

        let table_name = self.get_records_table_name(collection_name);
        let delete_sql = format!("DELETE FROM {} WHERE id = {}", table_name, record_id);

        let deleted_rows = diesel::sql_query(&delete_sql)
            .execute(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        if deleted_rows == 0 {
            return Err(AuthError::NotFound("Record not found".to_string()));
        }

        Ok(())
    }

    pub async fn get_collections_stats(&self) -> Result<(i64, std::collections::HashMap<String, i64>, std::collections::HashMap<String, i64>, f64, Option<String>, Option<String>), AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

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

            let count_result: Result<CountResult, _> = diesel::sql_query(&count_sql)
                .get_result(&mut conn);
                
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

        Ok((total_records, records_per_collection, field_types_distribution, average_records, largest_collection, smallest_collection))
    }

    // Validation methods
    fn validate_collection_name(&self, name: &str) -> Result<(), AuthError> {
        if name.is_empty() {
            return Err(AuthError::ValidationError(vec!["Collection name cannot be empty".to_string()]));
        }

        if name.len() > 50 {
            return Err(AuthError::ValidationError(vec!["Collection name too long (max 50 characters)".to_string()]));
        }

        // Check for valid characters (alphanumeric and underscore only)
        if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(AuthError::ValidationError(vec!["Collection name can only contain letters, numbers, and underscores".to_string()]));
        }

        // Check for reserved names
        let reserved_names = ["users", "auth", "admin", "api", "system"];
        if reserved_names.contains(&name) {
            return Err(AuthError::ValidationError(vec!["Collection name is reserved".to_string()]));
        }

        Ok(())
    }

    fn validate_schema(&self, schema: &CollectionSchema) -> Result<(), AuthError> {
        if schema.fields.is_empty() {
            return Err(AuthError::ValidationError(vec!["Schema must have at least one field".to_string()]));
        }

        let mut field_names = std::collections::HashSet::new();
        for field in &schema.fields {
            // Check for duplicate field names
            if !field_names.insert(&field.name) {
                return Err(AuthError::ValidationError(vec![format!("Duplicate field name: {}", field.name)]));
            }

            // Validate field name
            if field.name.is_empty() || field.name.len() > 50 {
                return Err(AuthError::ValidationError(vec!["Field name must be 1-50 characters".to_string()]));
            }

            if !field.name.chars().all(|c| c.is_alphanumeric() || c == '_') {
                return Err(AuthError::ValidationError(vec!["Field name can only contain letters, numbers, and underscores".to_string()]));
            }
        }

        Ok(())
    }

    fn validate_record_data(&self, schema: &CollectionSchema, data: &Value) -> Result<Value, AuthError> {
        let mut validated = Map::new();
        
        if let Some(data_obj) = data.as_object() {
            // Validate each field in the schema
            for field in &schema.fields {
                let field_value = data_obj.get(&field.name);

                // Check required fields
                if field.required && (field_value.is_none() || field_value == Some(&Value::Null)) {
                    return Err(AuthError::ValidationError(vec![format!("Field '{}' is required", field.name)]));
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
            return Err(AuthError::ValidationError(vec!["Record data must be a JSON object".to_string()]));
        }

        Ok(Value::Object(validated))
    }

    fn validate_field_value(&self, field: &FieldDefinition, value: &Value) -> Result<Value, AuthError> {
        // Type validation
        match field.field_type {
            FieldType::Text => {
                if let Some(s) = value.as_str() {
                    if let Some(validation) = &field.validation {
                        if let Some(min_len) = validation.min_length {
                            if s.len() < min_len {
                                return Err(AuthError::ValidationError(vec![format!("Field '{}' is too short (minimum {} characters)", field.name, min_len)]));
                            }
                        }
                        if let Some(max_len) = validation.max_length {
                            if s.len() > max_len {
                                return Err(AuthError::ValidationError(vec![format!("Field '{}' is too long (maximum {} characters)", field.name, max_len)]));
                            }
                        }
                        if let Some(pattern) = &validation.pattern {
                            match regex::Regex::new(pattern) {
                                Ok(regex) => {
                                    if !regex.is_match(s) {
                                        return Err(AuthError::ValidationError(vec![format!("Field '{}' does not match required pattern: {}", field.name, pattern)]));
                                    }
                                },
                                Err(_) => {
                                    return Err(AuthError::ValidationError(vec![format!("Invalid regex pattern for field '{}': {}", field.name, pattern)]));
                                }
                            }
                        }
                        if let Some(enum_values) = &validation.enum_values {
                            if !enum_values.contains(&s.to_string()) {
                                return Err(AuthError::ValidationError(vec![format!("Field '{}' must be one of: {:?}", field.name, enum_values)]));
                            }
                        }
                    }
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be text", field.name)]))
                }
            },
            FieldType::Number => {
                if let Some(n) = value.as_f64() {
                    if let Some(validation) = &field.validation {
                        if let Some(min_val) = validation.min_value {
                            if n < min_val {
                                return Err(AuthError::ValidationError(vec![format!("Field '{}' is too small (minimum {})", field.name, min_val)]));
                            }
                        }
                        if let Some(max_val) = validation.max_value {
                            if n > max_val {
                                return Err(AuthError::ValidationError(vec![format!("Field '{}' is too large (maximum {})", field.name, max_val)]));
                            }
                        }
                    }
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a number", field.name)]))
                }
            },
            FieldType::Boolean => {
                if value.is_boolean() {
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a boolean", field.name)]))
                }
            },
            FieldType::Email => {
                if let Some(s) = value.as_str() {
                    // Simple email validation
                    if s.contains('@') && s.contains('.') {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid email address", field.name)]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be text", field.name)]))
                }
            },
            FieldType::Json => Ok(value.clone()), // Any JSON value is valid
            FieldType::Date => {
                if let Some(s) = value.as_str() {
                    // Validate date format (YYYY-MM-DD)
                    match chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                        Ok(_) => Ok(value.clone()),
                        Err(_) => Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid date in YYYY-MM-DD format", field.name)]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a date string", field.name)]))
                }
            },
            FieldType::Url => {
                if let Some(s) = value.as_str() {
                    // Basic URL validation
                    if s.starts_with("http://") || s.starts_with("https://") {
                        // Further validation could include proper URL parsing
                        if s.contains('.') && s.len() > 10 {
                            Ok(value.clone())
                        } else {
                            Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid URL", field.name)]))
                        }
                    } else {
                        Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid URL starting with http:// or https://", field.name)]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a URL string", field.name)]))
                }
            },
            FieldType::File => {
                if let Some(s) = value.as_str() {
                    // For now, treat file as a path string - in future this could be enhanced
                    // to validate file existence, size limits, file types, etc.
                    if !s.is_empty() && s.len() <= 500 {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid file path (max 500 characters)", field.name)]))
                    }
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a file path string", field.name)]))
                }
            },
            FieldType::Relation => {
                // Relation should be an ID reference to another record
                if let Some(s) = value.as_str() {
                    // Basic validation - should be a non-empty string ID
                    if !s.is_empty() && s.len() <= 50 {
                        Ok(value.clone())
                    } else {
                        Err(AuthError::ValidationError(vec![format!("Field '{}' must be a valid relation ID (max 50 characters)", field.name)]))
                    }
                } else if let Some(_n) = value.as_i64() {
                    // Also accept numeric IDs
                    Ok(value.clone())
                } else {
                    Err(AuthError::ValidationError(vec![format!("Field '{}' must be a relation ID (string or number)", field.name)]))
                }
            }
        }
    }
} 

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::create_pool;
    use crate::models::ValidationRules;
    use serde_json::json;

    fn setup_test_service() -> CollectionService {
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "test.sqlite".to_string());
        let pool = create_pool(&database_url).expect("Failed to create test pool");
        CollectionService::new(pool)
    }

    fn create_test_schema() -> CollectionSchema {
        CollectionSchema {
            fields: vec![
                FieldDefinition {
                    name: "title".to_string(),
                    field_type: FieldType::Text,
                    required: true,
                    default_value: None,
                    validation: Some(ValidationRules {
                        min_length: Some(1),
                        max_length: Some(100),
                        min_value: None,
                        max_value: None,
                        pattern: None,
                        enum_values: None,
                    }),
                },
                FieldDefinition {
                    name: "content".to_string(),
                    field_type: FieldType::Text,
                    required: false,
                    default_value: Some(json!("")),
                    validation: None,
                },
            ],
        }
    }

    #[tokio::test]
    async fn test_collection_service_create_collection() {
        let service = setup_test_service();
        let schema = create_test_schema();

        // Use timestamp to ensure unique name
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let unique_name = format!("unit_test_collection_{}", timestamp);

        let request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Unit Test Collection".to_string()),
            description: Some("Test collection for unit tests".to_string()),
            schema,
        };

        let result = service.create_collection(request).await;
        assert!(result.is_ok(), "Failed to create collection: {:?}", result.err());

        let collection = result.unwrap();
        assert_eq!(collection.name, unique_name);
        assert_eq!(collection.display_name, Some("Unit Test Collection".to_string()));
    }

    #[tokio::test]
    async fn test_collection_service_invalid_name() {
        let service = setup_test_service();
        let schema = create_test_schema();

        let request = CreateCollectionRequest {
            name: "invalid-name!".to_string(),
            display_name: Some("Invalid Name".to_string()),
            description: None,
            schema,
        };

        let result = service.create_collection(request).await;
        assert!(result.is_err());
        
        if let Err(AuthError::ValidationError(errors)) = result {
            assert!(!errors.is_empty());
        } else {
            panic!("Expected ValidationError");
        }
    }

    #[tokio::test]
    async fn test_collection_service_get_nonexistent() {
        let service = setup_test_service();

        let result = service.get_collection("nonexistent").await;
        assert!(result.is_err());
        
        if let Err(AuthError::NotFound(_)) = result {
            // Expected
        } else {
            panic!("Expected NotFound error");
        }
    }

    #[tokio::test]
    async fn test_record_validation() {
        let service = setup_test_service();
        let schema = create_test_schema();

        // Use timestamp to ensure unique name
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let unique_name = format!("validation_test_collection_{}", timestamp);

        let collection_request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Validation Test".to_string()),
            description: None,
            schema,
        };

        let collection = service.create_collection(collection_request).await
            .expect("Failed to create collection");

        // Test valid record
        let valid_record = CreateRecordRequest {
            data: json!({
                "title": "Valid Title",
                "content": "Valid content"
            })
        };

        let result = service.create_record(&collection.name, valid_record).await;
        assert!(result.is_ok(), "Valid record should be created successfully");

        // Test invalid record (missing required field)
        let invalid_record = CreateRecordRequest {
            data: json!({
                "content": "Missing title"
            })
        };

        let result = service.create_record(&collection.name, invalid_record).await;
        assert!(result.is_err(), "Invalid record should fail validation");
        
        if let Err(AuthError::ValidationError(errors)) = result {
            assert!(!errors.is_empty());
            assert!(errors.iter().any(|e| e.contains("required")));
        } else {
            panic!("Expected ValidationError");
        }
    }

    #[tokio::test]
    async fn test_list_records_debug() {
        let service = setup_test_service();
        let schema = create_test_schema();
        
        // Create a test collection first with unique name
        let unique_name = format!("test_debug_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Test Debug".to_string()),
            description: Some("Test collection for debugging".to_string()),
            schema: schema.clone(),
        };
        
        let _collection = service.create_collection(request).await.expect("Failed to create collection");
        
        // Try to list records (should work even with empty table)
        let result = service.list_records(&unique_name, None, None, None, None, None).await;
        
        match result {
            Ok(records) => {
                println!("Success: got {} records", records.len());
            }
            Err(e) => {
                println!("Error: {:?}", e);
                panic!("list_records failed: {:?}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_regex_validation() {
        let service = setup_test_service();
        
        // Create collection with regex validation
        let schema = CollectionSchema {
            fields: vec![
                FieldDefinition {
                    name: "email".to_string(),
                    field_type: FieldType::Text,
                    required: true,
                    default_value: None,
                    validation: Some(ValidationRules {
                        min_length: None,
                        max_length: None,
                        min_value: None,
                        max_value: None,
                        pattern: Some(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$".to_string()), // Email regex
                        enum_values: None,
                    }),
                },
                FieldDefinition {
                    name: "phone".to_string(),
                    field_type: FieldType::Text,
                    required: false,
                    default_value: None,
                    validation: Some(ValidationRules {
                        min_length: None,
                        max_length: None,
                        min_value: None,
                        max_value: None,
                        pattern: Some(r"^\+?[1-9]\d{1,14}$".to_string()), // Phone number regex
                        enum_values: None,
                    }),
                },
            ],
        };

        let unique_name = format!("regex_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let collection_request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Regex Test".to_string()),
            description: None,
            schema,
        };

        let collection = service.create_collection(collection_request).await
            .expect("Failed to create collection");

        // Test 1: Valid email should pass
        let valid_record = CreateRecordRequest {
            data: json!({
                "email": "test@example.com",
                "phone": "+1234567890"
            })
        };
        let result = service.create_record(&collection.name, valid_record).await;
        assert!(result.is_ok(), "Valid email and phone should pass regex validation");

        // Test 2: Invalid email should fail
        let invalid_email_record = CreateRecordRequest {
            data: json!({
                "email": "invalid-email",
                "phone": "+1234567890"
            })
        };
        let result = service.create_record(&collection.name, invalid_email_record).await;
        assert!(result.is_err(), "Invalid email should fail regex validation");
        if let Err(AuthError::ValidationError(errors)) = result {
            assert!(errors.iter().any(|e| e.contains("does not match required pattern")));
        }

        // Test 3: Invalid phone should fail
        let invalid_phone_record = CreateRecordRequest {
            data: json!({
                "email": "valid@example.com",
                "phone": "invalid-phone"
            })
        };
        let result = service.create_record(&collection.name, invalid_phone_record).await;
        assert!(result.is_err(), "Invalid phone should fail regex validation");
        if let Err(AuthError::ValidationError(errors)) = result {
            assert!(errors.iter().any(|e| e.contains("does not match required pattern")));
        }

        // Test 4: Email only (phone is optional) should pass
        let email_only_record = CreateRecordRequest {
            data: json!({
                "email": "another@test.com"
            })
        };
        let result = service.create_record(&collection.name, email_only_record).await;
        assert!(result.is_ok(), "Valid email without optional phone should pass");
    }

    #[tokio::test]
    async fn test_invalid_regex_pattern() {
        let service = setup_test_service();
        
        // Create collection with invalid regex pattern
        let schema = CollectionSchema {
            fields: vec![
                FieldDefinition {
                    name: "test_field".to_string(),
                    field_type: FieldType::Text,
                    required: true,
                    default_value: None,
                    validation: Some(ValidationRules {
                        min_length: None,
                        max_length: None,
                        min_value: None,
                        max_value: None,
                        pattern: Some(r"[invalid regex (".to_string()), // Invalid regex pattern
                        enum_values: None,
                    }),
                },
            ],
        };

        let unique_name = format!("invalid_regex_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let collection_request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Invalid Regex Test".to_string()),
            description: None,
            schema,
        };

        let collection = service.create_collection(collection_request).await
            .expect("Failed to create collection");

        // Try to create record with invalid regex pattern
        let test_record = CreateRecordRequest {
            data: json!({
                "test_field": "any value"
            })
        };
        let result = service.create_record(&collection.name, test_record).await;
        assert!(result.is_err(), "Invalid regex pattern should cause validation error");
        if let Err(AuthError::ValidationError(errors)) = result {
            assert!(errors.iter().any(|e| e.contains("Invalid regex pattern")));
        }
    }

    #[tokio::test]
    async fn test_additional_field_types_validation() {
        let service = setup_test_service();
        
        // Create collection with various field types
        let schema = CollectionSchema {
            fields: vec![
                FieldDefinition {
                    name: "birth_date".to_string(),
                    field_type: FieldType::Date,
                    required: true,
                    default_value: None,
                    validation: None,
                },
                FieldDefinition {
                    name: "website".to_string(),
                    field_type: FieldType::Url,
                    required: false,
                    default_value: None,
                    validation: None,
                },
                FieldDefinition {
                    name: "avatar".to_string(),
                    field_type: FieldType::File,
                    required: false,
                    default_value: None,
                    validation: None,
                },
                FieldDefinition {
                    name: "related_user".to_string(),
                    field_type: FieldType::Relation,
                    required: false,
                    default_value: None,
                    validation: None,
                },
            ],
        };

        let unique_name = format!("field_types_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let collection_request = CreateCollectionRequest {
            name: unique_name.clone(),
            display_name: Some("Field Types Test".to_string()),
            description: None,
            schema,
        };

        let collection = service.create_collection(collection_request).await
            .expect("Failed to create collection");

        // Test 1: Valid values should pass
        let valid_record = CreateRecordRequest {
            data: json!({
                "birth_date": "1990-01-15",
                "website": "https://example.com",
                "avatar": "/uploads/avatar.jpg",
                "related_user": "user123"
            })
        };
        let result = service.create_record(&collection.name, valid_record).await;
        assert!(result.is_ok(), "Valid field types should pass validation");

        // Test 2: Invalid date format should fail
        let invalid_date_record = CreateRecordRequest {
            data: json!({
                "birth_date": "15-01-1990"  // Wrong format
            })
        };
        let result = service.create_record(&collection.name, invalid_date_record).await;
        assert!(result.is_err(), "Invalid date format should fail");

        // Test 3: Invalid URL should fail
        let invalid_url_record = CreateRecordRequest {
            data: json!({
                "birth_date": "1990-01-15",
                "website": "not-a-url"
            })
        };
        let result = service.create_record(&collection.name, invalid_url_record).await;
        assert!(result.is_err(), "Invalid URL should fail");

        // Test 4: Numeric relation ID should pass
        let numeric_relation_record = CreateRecordRequest {
            data: json!({
                "birth_date": "1990-01-15",
                "related_user": 456
            })
        };
        let result = service.create_record(&collection.name, numeric_relation_record).await;
        assert!(result.is_ok(), "Numeric relation ID should pass validation");
    }

    #[tokio::test]
    async fn test_list_records_products_debug() {
        let service = setup_test_service();
        
        // Test with "products" collection specifically - this might not exist
        let result = service.list_records("products", None, None, None, None, None).await;
        
        match result {
            Ok(records) => {
                println!("Success: got {} records from products collection", records.len());
            }
            Err(e) => {
                println!("Error with products collection: {:?}", e);
            }
        }
        
        // Test with non-existent collection  
        let result2 = service.list_records("nonexistent", None, None, None, None, None).await;
        
        match result2 {
            Ok(records) => {
                println!("Success: got {} records from nonexistent collection", records.len());
            }
            Err(e) => {
                println!("Expected error with nonexistent collection: {:?}", e);
            }
        }
    }
} 