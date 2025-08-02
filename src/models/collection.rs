use crate::schema::collections;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, ToSchema)]
#[diesel(table_name = collections)]
pub struct Collection {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "users")]
    pub name: String,
    #[schema(example = "User Collection")]
    pub display_name: Option<String>,
    #[schema(example = "Collection for storing user data")]
    pub description: Option<String>,
    #[serde(skip_serializing)]
    pub schema_json: String,
    #[schema(example = false)]
    pub is_system: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateCollectionRequest {
    #[schema(example = "products", min_length = 1, max_length = 50)]
    pub name: String,
    #[schema(example = "Product Collection")]
    pub display_name: Option<String>,
    #[schema(example = "Collection for storing product data")]
    pub description: Option<String>,
    pub schema: CollectionSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateCollectionRequest {
    #[schema(example = "updated_products")]
    pub name: Option<String>,
    #[schema(example = "Updated Product Collection")]
    pub display_name: Option<String>,
    #[schema(example = "Updated description for product collection")]
    pub description: Option<String>,
    pub schema: Option<CollectionSchema>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionResponse {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "products")]
    pub name: String,
    #[schema(example = "Product Collection")]
    pub display_name: Option<String>,
    #[schema(example = "Collection for storing product data")]
    pub description: Option<String>,
    pub schema: CollectionSchema,
    #[schema(example = false)]
    pub is_system: bool,
    #[schema(example = "2024-01-01 12:00:00")]
    pub created_at: String,
    #[schema(example = "2024-01-01 12:00:00")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateRecordRequest {
    #[schema(example = json!({"name": "Product 1", "price": 99.99}))]
    pub data: Value,
    /// Optional files to upload for fields of type "file"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<std::collections::HashMap<String, FileUpload>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FileUpload {
    #[schema(example = "document.pdf")]
    pub filename: String,
    #[schema(example = "application/pdf")]
    pub content_type: String,
    /// Base64 encoded file data
    #[schema(example = "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo...")]
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateRecordRequest {
    #[schema(example = json!({"name": "Updated Product", "price": 149.99}))]
    pub data: Value,
    pub files: Option<std::collections::HashMap<String, FileUpload>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RecordResponse {
    #[schema(example = "1")]
    pub id: String,
    #[schema(example = "products")]
    pub collection_id: String,
    #[schema(example = json!({"name": "Product 1", "price": 99.99}))]
    pub data: Value,
    #[schema(example = "2024-01-01 12:00:00")]
    pub created_at: String,
    #[schema(example = "2024-01-01 12:00:00")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CollectionSchema {
    pub fields: Vec<FieldDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct FieldDefinition {
    #[schema(example = "name")]
    pub name: String,
    pub field_type: FieldType,
    #[schema(example = true)]
    pub required: bool,
    pub default_value: Option<Value>,
    pub validation: Option<ValidationRules>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
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
    Relation,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ValidationRules {
    #[schema(example = 1)]
    pub min_length: Option<usize>,
    #[schema(example = 100)]
    pub max_length: Option<usize>,
    #[schema(example = 0.0)]
    pub min_value: Option<f64>,
    #[schema(example = 1000.0)]
    pub max_value: Option<f64>,
    #[schema(example = "^[a-zA-Z0-9]+$")]
    pub pattern: Option<String>,
    #[schema(example = json!(["option1", "option2"]))]
    pub enum_values: Option<Vec<String>>,
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
            created_at: collection
                .created_at
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
            updated_at: collection
                .updated_at
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
        })
    }
}

// Insert model
#[derive(Debug, Insertable)]
#[diesel(table_name = collections)]
pub struct NewCollection {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema_json: String,
    pub is_system: bool,
}

// Update model
#[derive(Debug, AsChangeset)]
#[diesel(table_name = collections)]
pub struct UpdateCollection {
    pub name: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub schema_json: Option<String>,
}
