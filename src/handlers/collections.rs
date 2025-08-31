use crate::{
    AppState,
    models::{
        CollectionResponse, CreateCollectionRequest, CreateRecordRequest, FileUpload,
        RecordResponse, UpdateCollectionRequest, UpdateRecordRequest,
    },
    utils::{ApiResponse, LunarbaseError, Claims, ErrorResponse},
};
use axum::{
    Extension,
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::Json,
};
use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListRecordsQuery {
    #[schema(example = 10, minimum = 1, maximum = 100)]
    pub limit: Option<i64>,
    #[schema(example = 0, minimum = 0)]
    pub offset: Option<i64>,
    #[schema(example = "created_at:desc")]
    pub sort: Option<String>,
    #[schema(example = "name:eq:Product")]
    pub filter: Option<String>,
    #[schema(example = "search term")]
    pub search: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginatedRecordsResponse {
    pub records: Vec<RecordWithCollection>,
    pub pagination: PaginationMeta,
}

#[derive(Debug, Serialize, ToSchema, Clone)]
pub struct RecordWithCollection {
    #[serde(flatten)]
    pub record: RecordResponse,
    pub collection_name: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginationMeta {
    pub current_page: i64,
    pub page_size: i64,
    pub total_count: i64,
    pub total_pages: i64,
}

#[utoipa::path(
    post,
    path = "/collections",
    tag = "Collections",
    request_body = CreateCollectionRequest,
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 201, description = "Collection created successfully", body = ApiResponse<CollectionResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse)
    )
)]
pub async fn create_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Json(request): Json<CreateCollectionRequest>,
) -> Result<(StatusCode, Json<ApiResponse<CollectionResponse>>), LunarbaseError> {
    if user.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state.collection_service.create_collection(request).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(collection))))
}

#[utoipa::path(
    get,
    path = "/collections",
    tag = "Collections",
    responses(
        (status = 200, description = "Collections retrieved successfully", body = ApiResponse<Vec<CollectionResponse>>)
    )
)]
pub async fn list_collections(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<CollectionResponse>>>, LunarbaseError> {
    let collections = state.collection_service.list_collections().await?;
    Ok(Json(ApiResponse::success(collections)))
}

#[utoipa::path(
    get,
    path = "/collections/{name}",
    tag = "Collections",
    params(
        ("name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "Collection retrieved successfully", body = ApiResponse<CollectionResponse>),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    )
)]
pub async fn get_collection(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<CollectionResponse>>, LunarbaseError> {
    let collection = state.collection_service.get_collection(&name).await?;
    Ok(Json(ApiResponse::success(collection)))
}

#[utoipa::path(
    put,
    path = "/collections/{name}",
    params(
        ("name" = String, Path, description = "Collection name")
    ),
    request_body = UpdateCollectionRequest,
    responses(
        (status = 200, description = "Collection updated successfully", body = ApiResponse<CollectionResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "Collection not found")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Path(name): Path<String>,
    Json(request): Json<UpdateCollectionRequest>,
) -> Result<Json<ApiResponse<CollectionResponse>>, LunarbaseError> {
    if user.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collection = state
        .collection_service
        .update_collection(&name, request)
        .await?;
    Ok(Json(ApiResponse::success(collection)))
}

#[utoipa::path(
    delete,
    path = "/collections/{name}",
    params(
        ("name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 204, description = "Collection deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Insufficient permissions"),
        (status = 404, description = "Collection not found")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_collection(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
    Path(name): Path<String>,
) -> Result<StatusCode, LunarbaseError> {
    if user.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    state.collection_service.delete_collection(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/collections/{collection_name}/records",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name")
    ),
    request_body(
        content_type = "multipart/form-data",
        description = "Record data and optional files"
    ),
    responses(
        (status = 201, description = "Record created successfully", body = ApiResponse<RecordResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(collection_name): Path<String>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiResponse<RecordResponse>>), LunarbaseError> {
    let mut data = serde_json::Value::Object(serde_json::Map::new());
    let mut files: HashMap<String, FileUpload> = HashMap::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| LunarbaseError::BadRequest("Invalid multipart data".to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "data" {
            let data_bytes = field
                .bytes()
                .await
                .map_err(|_| LunarbaseError::BadRequest("Failed to read data field".to_string()))?;
            let data_str = String::from_utf8(data_bytes.to_vec())
                .map_err(|_| LunarbaseError::BadRequest("Invalid UTF-8 in data field".to_string()))?;
            data = serde_json::from_str(&data_str)
                .map_err(|_| LunarbaseError::BadRequest("Invalid JSON in data field".to_string()))?;
        } else if name.starts_with("file_") {
            let field_name = name.strip_prefix("file_").unwrap_or(&name).to_string();
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();

            let file_bytes = field
                .bytes()
                .await
                .map_err(|_| LunarbaseError::BadRequest("Failed to read file".to_string()))?;
            let file_data = general_purpose::STANDARD.encode(&file_bytes);

            files.insert(
                field_name,
                FileUpload {
                    filename,
                    content_type,
                    data: file_data,
                },
            );
        }
    }

    let mut request = CreateRecordRequest {
        data,
        files: if files.is_empty() { None } else { Some(files) },
    };

    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| LunarbaseError::InternalError)?;

    let user = users::table
        .filter(users::id.eq(user_id))
        .select(crate::models::User::as_select())
        .first::<crate::models::User>(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await?;

    let has_permission = state
        .permission_service
        .check_collection_permission(&user, collection.id, crate::models::Permission::Create)
        .await?;

    if !has_permission {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    state
        .ownership_service
        .set_record_ownership(&user, &mut request.data)?;

    let record = state
        .collection_service
        .create_record_with_events(&collection_name, request, Some(user_id))
        .await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::success(record))))
}

#[utoipa::path(
    get,
    path = "/collections/{collection_name}/records",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("limit" = Option<i64>, Query, description = "Limit number of records"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination"),
        ("sort" = Option<String>, Query, description = "Sort field"),
        ("filter" = Option<String>, Query, description = "Filter expression"),
        ("search" = Option<String>, Query, description = "Search term")
    ),
    responses(
        (status = 200, description = "Records retrieved successfully", body = ApiResponse<Vec<RecordResponse>>),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    )
)]
pub async fn list_records(
    State(state): State<AppState>,
    Path(collection_name): Path<String>,
    Query(query): Query<ListRecordsQuery>,
) -> Result<Json<ApiResponse<Vec<RecordResponse>>>, LunarbaseError> {
    let records = state
        .collection_service
        .list_records(
            &collection_name,
            query.sort,
            query.filter,
            query.search,
            query.limit,
            query.offset,
        )
        .await?;
    Ok(Json(ApiResponse::success(records)))
}

#[utoipa::path(
    get,
    path = "/records",
    tag = "Records",
    params(
        ("limit" = Option<i64>, Query, description = "Limit number of records (max 100)"),
        ("offset" = Option<i64>, Query, description = "Offset for pagination"),
        ("sort" = Option<String>, Query, description = "Sort field"),
        ("filter" = Option<String>, Query, description = "Filter expression"),
        ("search" = Option<String>, Query, description = "Search term")
    ),
    responses(
        (status = 200, description = "Records retrieved successfully", body = ApiResponse<PaginatedRecordsResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_all_records(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ListRecordsQuery>,
) -> Result<Json<ApiResponse<PaginatedRecordsResponse>>, LunarbaseError> {
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| LunarbaseError::InternalError)?;

    let user = users::table
        .filter(users::id.eq(user_id))
        .select(crate::models::User::as_select())
        .first::<crate::models::User>(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    let collections = state.collection_service.list_collections().await?;

    let mut all_records = Vec::new();

    for collection in collections {
        let has_permission = state
            .permission_service
            .check_collection_permission(&user, collection.id, crate::models::Permission::List)
            .await
            .unwrap_or(false);

        if has_permission {
            let records = state
                .collection_service
                .list_records(
                    &collection.name,
                    None,
                    query.filter.clone(),
                    query.search.clone(),
                    None,
                    None,
                )
                .await
                .unwrap_or_default();

            for record in records {
                all_records.push(RecordWithCollection {
                    record,
                    collection_name: collection.name.clone(),
                });
            }
        }
    }

    let total_count = all_records.len() as i64;

    if let Some(sort_str) = &query.sort {
        if sort_str.starts_with('-') {
            let field = &sort_str[1..];
            match field {
                "created_at" => {
                    all_records.sort_by(|a, b| b.record.created_at.cmp(&a.record.created_at))
                }
                "updated_at" => {
                    all_records.sort_by(|a, b| b.record.updated_at.cmp(&a.record.updated_at))
                }
                "id" => all_records.sort_by(|a, b| b.record.id.cmp(&a.record.id)),
                "collection_name" => {
                    all_records.sort_by(|a, b| b.collection_name.cmp(&a.collection_name))
                }
                _ => all_records.sort_by(|a, b| b.record.created_at.cmp(&a.record.created_at)),
            }
        } else {
            match sort_str.as_str() {
                "created_at" => {
                    all_records.sort_by(|a, b| a.record.created_at.cmp(&b.record.created_at))
                }
                "updated_at" => {
                    all_records.sort_by(|a, b| a.record.updated_at.cmp(&b.record.updated_at))
                }
                "id" => all_records.sort_by(|a, b| a.record.id.cmp(&b.record.id)),
                "collection_name" => {
                    all_records.sort_by(|a, b| a.collection_name.cmp(&b.collection_name))
                }
                _ => all_records.sort_by(|a, b| b.record.created_at.cmp(&a.record.created_at)),
            }
        }
    } else {
        all_records.sort_by(|a, b| b.record.created_at.cmp(&a.record.created_at));
    }

    let start_index = offset as usize;
    let end_index = (start_index + limit as usize).min(all_records.len());
    let paginated_records = if start_index < all_records.len() {
        all_records[start_index..end_index].to_vec()
    } else {
        Vec::new()
    };

    let current_page = (offset / limit) + 1;
    let total_pages = (total_count + limit - 1) / limit;

    let pagination_meta = PaginationMeta {
        current_page,
        page_size: limit,
        total_count,
        total_pages,
    };

    let response = PaginatedRecordsResponse {
        records: paginated_records,
        pagination: pagination_meta,
    };

    Ok(Json(ApiResponse::success(response)))
}

#[utoipa::path(
    get,
    path = "/collections/{collection_name}/records/{record_id}",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    responses(
        (status = 200, description = "Record retrieved successfully", body = ApiResponse<RecordResponse>),
        (status = 404, description = "Record not found", body = ErrorResponse)
    )
)]
pub async fn get_record(
    State(state): State<AppState>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<Json<ApiResponse<RecordResponse>>, LunarbaseError> {
    let record = state
        .collection_service
        .get_record(&collection_name, record_id)
        .await?;
    Ok(Json(ApiResponse::success(record)))
}

#[utoipa::path(
    put,
    path = "/collections/{collection_name}/records/{record_id}",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    request_body(
        content_type = "multipart/form-data",
        description = "Record data and optional files"
    ),
    responses(
        (status = 200, description = "Record updated successfully", body = ApiResponse<RecordResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<RecordResponse>>, LunarbaseError> {
    let mut data = serde_json::Value::Object(serde_json::Map::new());
    let mut files: HashMap<String, FileUpload> = HashMap::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| LunarbaseError::BadRequest("Invalid multipart data".to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();

        if name == "data" {
            let data_bytes = field
                .bytes()
                .await
                .map_err(|_| LunarbaseError::BadRequest("Failed to read data field".to_string()))?;
            let data_str = String::from_utf8(data_bytes.to_vec())
                .map_err(|_| LunarbaseError::BadRequest("Invalid UTF-8 in data field".to_string()))?;
            data = serde_json::from_str(&data_str)
                .map_err(|_| LunarbaseError::BadRequest("Invalid JSON in data field".to_string()))?;
        } else if name.starts_with("file_") {
            let field_name = name.strip_prefix("file_").unwrap_or(&name).to_string();
            let filename = field.file_name().unwrap_or("unknown").to_string();
            let content_type = field
                .content_type()
                .unwrap_or("application/octet-stream")
                .to_string();

            let file_bytes = field
                .bytes()
                .await
                .map_err(|_| LunarbaseError::BadRequest("Failed to read file".to_string()))?;
            let file_data = general_purpose::STANDARD.encode(&file_bytes);

            files.insert(
                field_name,
                FileUpload {
                    filename,
                    content_type,
                    data: file_data,
                },
            );
        }
    }

    let request = UpdateRecordRequest {
        data,
        files: if files.is_empty() { None } else { Some(files) },
    };

    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| LunarbaseError::InternalError)?;

    let user = users::table
        .filter(users::id.eq(user_id))
        .select(crate::models::User::as_select())
        .first::<crate::models::User>(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await?;

    let has_permission = state
        .permission_service
        .check_collection_permission(&user, collection.id, crate::models::Permission::Update)
        .await?;

    if !has_permission {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let record = state
        .collection_service
        .update_record_with_events(&collection_name, record_id, request, Some(user_id))
        .await?;
    Ok(Json(ApiResponse::success(record)))
}

#[utoipa::path(
    delete,
    path = "/collections/{collection_name}/records/{record_id}",
    tag = "Records",
    params(
        ("collection_name" = String, Path, description = "Collection name"),
        ("record_id" = i32, Path, description = "Record ID")
    ),
    responses(
        (status = 204, description = "Record deleted successfully"),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse),
        (status = 404, description = "Record not found", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_record(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((collection_name, record_id)): Path<(String, i32)>,
) -> Result<StatusCode, LunarbaseError> {
    use crate::schema::users;
    use diesel::prelude::*;

    let user_id: i32 = claims.sub.parse().map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = state.db_pool.get().map_err(|_| LunarbaseError::InternalError)?;

    let user = users::table
        .filter(users::id.eq(user_id))
        .select(crate::models::User::as_select())
        .first::<crate::models::User>(&mut conn)
        .map_err(|_| LunarbaseError::NotFound("User not found".to_string()))?;

    let collection = state
        .collection_service
        .get_collection(&collection_name)
        .await?;

    let has_permission = state
        .permission_service
        .check_collection_permission(&user, collection.id, crate::models::Permission::Delete)
        .await?;

    if !has_permission {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    state
        .collection_service
        .delete_record_with_events(&collection_name, record_id, Some(user_id))
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/collections/{name}/schema",
    tag = "Collections",
    params(
        ("name" = String, Path, description = "Collection name")
    ),
    responses(
        (status = 200, description = "Collection schema retrieved successfully", body = ApiResponse<serde_json::Value>),
        (status = 404, description = "Collection not found", body = ErrorResponse)
    )
)]
pub async fn get_collection_schema(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, LunarbaseError> {
    let collection = state.collection_service.get_collection(&name).await?;
    let schema_json =
        serde_json::to_value(collection.schema).map_err(|_| LunarbaseError::InternalError)?;
    Ok(Json(ApiResponse::success(schema_json)))
}

#[derive(Serialize, ToSchema)]
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

#[utoipa::path(
    get,
    path = "/collections/stats",
    tag = "Collections",
    responses(
        (status = 200, description = "Collection statistics retrieved successfully", body = ApiResponse<CollectionStats>),
        (status = 403, description = "Insufficient permissions", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_collections_stats(
    State(state): State<AppState>,
    Extension(user): Extension<Claims>,
) -> Result<Json<ApiResponse<CollectionStats>>, LunarbaseError> {
    if user.role != "admin" {
        return Err(LunarbaseError::InsufficientPermissions);
    }

    let collections = state.collection_service.list_collections().await?;
    let total_collections = collections.len() as i64;

    let (
        total_records,
        records_per_collection,
        field_types_distribution,
        average_records_per_collection,
        largest_collection,
        smallest_collection,
    ) = state.collection_service.get_collections_stats().await?;

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
