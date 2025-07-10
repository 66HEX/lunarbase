use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use chrono::NaiveDateTime;
use crate::schema::collections;
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable)]
#[diesel(table_name = collections)]
pub struct Collection {
    pub id: i32,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema_json: String,
    pub is_system: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Insertable)]
#[diesel(table_name = collections)]
pub struct NewCollection {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema_json: String,
    pub is_system: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, AsChangeset)]
#[diesel(table_name = collections)]
pub struct UpdateCollection {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema_json: Option<String>,
}



// DTOs for API requests/responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCollectionRequest {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema: CollectionSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCollectionRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema: Option<CollectionSchema>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionResponse {
    pub id: i32,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema: CollectionSchema,
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecordRequest {
    pub data: Value, // JSON data for the record
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateRecordRequest {
    pub data: Value, // JSON data for the record
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordResponse {
    pub id: String,
    pub collection_id: String,
    pub data: Value,
    pub created_at: String,
    pub updated_at: String,
}

// Schema definition for collection fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionSchema {
    pub fields: Vec<FieldDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldDefinition {
    pub name: String,
    pub field_type: FieldType,
    pub required: bool,
    pub default_value: Option<Value>,
    pub validation: Option<ValidationRules>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    Text,
    Number,
    Boolean,
    Date,
    Email,
    Url,
    Json,
    File,
    Relation, // For references to other collections
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRules {
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub pattern: Option<String>, // Regex pattern
    pub enum_values: Option<Vec<String>>, // For enum fields
}

// Helper methods for Collection
impl Collection {
    pub fn get_schema(&self) -> Result<CollectionSchema, serde_json::Error> {
        serde_json::from_str(&self.schema_json)
    }
}

impl CollectionResponse {
    pub fn from_collection(collection: Collection) -> Result<Self, serde_json::Error> {
        let schema: CollectionSchema = serde_json::from_str(&collection.schema_json)?;
        
        Ok(CollectionResponse {
            id: collection.id,
            name: collection.name,
            display_name: collection.display_name,
            description: collection.description,
            schema,
            is_system: collection.is_system,
            created_at: collection.created_at.format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: collection.updated_at.format("%Y-%m-%d %H:%M:%S").to_string(),
        })
    }
}

 