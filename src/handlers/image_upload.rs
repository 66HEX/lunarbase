use crate::{
    AppState,
    utils::{ApiResponse, AuthError, Claims},
};
use axum::{
    Extension,
    extract::{Json as ExtractJson, Multipart, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct ImageUploadResponse {
    #[schema(example = "https://bucket.s3.amazonaws.com/uploads/image.jpg")]
    pub url: String,
    #[schema(example = "image.jpg")]
    pub filename: String,
    #[schema(example = 1024)]
    pub size: u64,
    #[schema(example = "image/jpeg")]
    pub content_type: String,
}

#[utoipa::path(
    post,
    path = "/upload-image",
    tag = "Images",
    request_body(
        content_type = "multipart/form-data",
        description = "Image file to upload"
    ),
    responses(
        (status = 201, description = "Image uploaded successfully", body = ApiResponse<ImageUploadResponse>),
        (status = 400, description = "Invalid file or missing file", body = ApiResponse<String>),
        (status = 401, description = "Unauthorized", body = ApiResponse<String>),
        (status = 413, description = "File too large", body = ApiResponse<String>),
        (status = 415, description = "Unsupported media type", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn upload_image(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<ApiResponse<ImageUploadResponse>>), AuthError> {
    let s3_service = state.s3_service.as_ref().ok_or_else(|| {
        AuthError::BadRequest(
            "File upload is not configured. S3 service is not available.".to_string(),
        )
    })?;

    let mut file_data: Option<Vec<u8>> = None;
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AuthError::BadRequest("Invalid multipart data".to_string()))?
    {
        let field_name = field.name().unwrap_or("").to_string();

        if field_name == "file" || field_name == "image" {
            // Get filename and content type
            filename = field.file_name().map(|s| s.to_string());
            content_type = field.content_type().map(|s| s.to_string());

            let bytes = field
                .bytes()
                .await
                .map_err(|_| AuthError::BadRequest("Failed to read file data".to_string()))?;

            file_data = Some(bytes.to_vec());
            break;
        }
    }

    let file_bytes = file_data.ok_or_else(|| {
        AuthError::BadRequest("No file found in request. Please include a file field.".to_string())
    })?;

    let file_name = filename.unwrap_or_else(|| "image".to_string());
    let file_content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());

    const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
    if file_bytes.len() > MAX_FILE_SIZE {
        return Err(AuthError::BadRequest(
            "File too large. Maximum size is 10MB.".to_string(),
        ));
    }

    if !file_content_type.starts_with("image/") {
        return Err(AuthError::BadRequest(
            "Only image files are allowed.".to_string(),
        ));
    }

    let upload_result = s3_service
        .upload_file(
            file_bytes.clone(),
            file_name.clone(),
            file_content_type.clone(),
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to upload image to S3: {}", e);
            AuthError::InternalError
        })?;

    let response = ImageUploadResponse {
        url: upload_result.file_url,
        filename: upload_result.original_filename,
        size: upload_result.file_size,
        content_type: upload_result.content_type,
    };

    Ok((StatusCode::CREATED, Json(ApiResponse::success(response))))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct DeleteImageRequest {
    #[schema(example = "https://bucket.s3.amazonaws.com/uploads/image.jpg")]
    pub url: String,
}

#[utoipa::path(
    delete,
    path = "/delete-image",
    tag = "Images",
    request_body = DeleteImageRequest,
    responses(
        (status = 200, description = "Image deleted successfully", body = ApiResponse<String>),
        (status = 400, description = "Invalid URL or missing URL", body = ApiResponse<String>),
        (status = 401, description = "Unauthorized", body = ApiResponse<String>),
        (status = 404, description = "Image not found", body = ApiResponse<String>),
        (status = 500, description = "Internal server error", body = ApiResponse<String>)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_image(
    State(state): State<AppState>,
    Extension(_claims): Extension<Claims>,
    ExtractJson(payload): ExtractJson<DeleteImageRequest>,
) -> Result<(StatusCode, Json<ApiResponse<String>>), AuthError> {
    let s3_service = state.s3_service.as_ref().ok_or_else(|| {
        AuthError::BadRequest(
            "File deletion is not configured. S3 service is not available.".to_string(),
        )
    })?;

    if payload.url.trim().is_empty() {
        return Err(AuthError::BadRequest("URL is required".to_string()));
    }

    s3_service.delete_file(&payload.url).await.map_err(|e| {
        tracing::error!("Failed to delete image from S3: {}", e);
        AuthError::InternalError
    })?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            "Image deleted successfully".to_string(),
        )),
    ))
}
