use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    Extension,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::{
    AppState,
    models::{
        CreateCollectionRequest, UpdateCollectionRequest, CreateRecordRequest, 
        UpdateRecordRequest, CollectionResponse, RecordResponse
    },
    utils::{AuthError, ApiResponse, Claims},
};

// Query parameters for listing records
#[derive(Debug, Deserialize)]
pub struct ListRecordsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub sort: Option<String>,
    pub filter: Option<String>,
}

// Collection management endpoints
pub async fn create_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Json(request): Json<CreateCollectionRequest>,
) -> Result<(StatusCode, Json<ApiResponse<CollectionResponse>>), AuthError> {
    // Only admin users can create collections
    if user.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let collection = state.collection_service.create_collection(request).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(collection))))
}

pub async fn list_collections(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<CollectionResponse>>>, AuthError> {
    let collections = state.collection_service.list_collections().await?;
    Ok(Json(ApiResponse::success(collections)))
}

pub async fn get_collection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<CollectionResponse>>, AuthError> {
    let collection = state.collection_service.get_collection(&name).await?;
    Ok(Json(ApiResponse::success(collection)))
}

pub async fn update_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Path(name): Path<String>,
    Json(request): Json<UpdateCollectionRequest>,
) -> Result<Json<ApiResponse<CollectionResponse>>, AuthError> {
    // Only admin users can update collections
    if user.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let collection = state.collection_service.update_collection(&name, request).await?;
    Ok(Json(ApiResponse::success(collection)))
}

pub async fn delete_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Path(name): Path<String>,
) -> Result<StatusCode, AuthError> {
    // Only admin users can delete collections
    if user.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    state.collection_service.delete_collection(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

// Record management endpoints
pub async fn create_record(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Json(request): Json<CreateRecordRequest>,
) -> Result<(StatusCode, Json<ApiResponse<RecordResponse>>), AuthError> {
    let record = state.collection_service.create_record(&collection_name, request).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(record))))
}

pub async fn list_records(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Query(query): Query<ListRecordsQuery>,
) -> Result<Json<ApiResponse<Vec<RecordResponse>>>, AuthError> {
    let records = state.collection_service.list_records(
        &collection_name, 
        query.sort,
        query.filter,
        None, // search - will be implemented later
        query.limit, 
        query.offset
    ).await?;
    Ok(Json(ApiResponse::success(records)))
}

pub async fn get_record(
    State(state): State<AppState>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<RecordResponse>>, AuthError> {
    let record = state.collection_service.get_record(&collection_name, record_id).await?;
    Ok(Json(ApiResponse::success(record)))
}

pub async fn update_record(
    State(state): State<AppState>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    Json(request): Json<UpdateRecordRequest>,
) -> Result<Json<ApiResponse<RecordResponse>>, AuthError> {
    let record = state.collection_service.update_record(&collection_name, record_id, request).await?;
    Ok(Json(ApiResponse::success(record)))
}

pub async fn delete_record(
    State(state): State<AppState>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<StatusCode, AuthError> {
    state.collection_service.delete_record(&collection_name, record_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// Helper endpoint to get collection schema
pub async fn get_collection_schema(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, AuthError> {
    let collection = state.collection_service.get_collection(&name).await?;
    let schema_json = serde_json::to_value(collection.schema)
        .map_err(|_| AuthError::InternalError)?;
    Ok(Json(ApiResponse::success(schema_json)))
}

// Statistics endpoint for admin
#[derive(Serialize)]
pub struct CollectionStats {
    pub total_collections: i64,
    pub total_records: i64,
    pub collections_by_type: HashMap<String, i64>,
    pub records_per_collection: HashMap<String, i64>,
    pub field_types_distribution: HashMap<String, i64>,
    pub average_records_per_collection: f64,
    pub largest_collection: Option<String>,
    pub smallest_collection: Option<String>,
}

pub async fn get_collections_stats(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
) -> Result<Json<ApiResponse<CollectionStats>>, AuthError> {
    // Only admin users can view stats
    if user.role != "admin" {
        return Err(AuthError::InsufficientPermissions);
    }

    let collections = state.collection_service.list_collections().await?;
    let total_collections = collections.len() as i64;
    
    let (total_records, records_per_collection, field_types_distribution, average_records_per_collection, largest_collection, smallest_collection) = 
        state.collection_service.get_collections_stats().await?;

    // Calculate collections by type (could be enhanced further)
    let mut collections_by_type = HashMap::new();
    for collection in &collections {
        let collection_type = if collection.is_system {
            "system".to_string()
        } else {
            "user".to_string()
        };
        *collections_by_type.entry(collection_type).or_insert(0) += 1;
    }
    
    let stats = CollectionStats {
        total_collections,
        total_records,
        collections_by_type,
        records_per_collection,
        field_types_distribution,
        average_records_per_collection,
        largest_collection,
        smallest_collection,
    };

    Ok(Json(ApiResponse::success(stats)))
} 