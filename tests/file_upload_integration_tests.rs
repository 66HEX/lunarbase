use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    routing::{delete, get, post, put},
};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid;
use jsonwebtoken::{encode, EncodingKey, Header};
use std::time::{SystemTime, UNIX_EPOCH};
use diesel::prelude::*;

use axum::middleware;
use lunarbase::database::create_pool;
use lunarbase::handlers::auth::*;
use lunarbase::handlers::collections::*;
use lunarbase::middleware::auth_middleware;
use lunarbase::models::{CollectionSchema, FieldDefinition, FieldType, ValidationRules, NewUser, User};
use lunarbase::{AppState, Config};
use lunarbase::schema::users;

async fn create_test_router() -> Router {
    // Use consistent test secret for JWT
    let test_jwt_secret = "test_secret".to_string();

    // Load test config but override JWT secret for consistency
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let test_password_pepper = "test_pepper".to_string();
    let app_state = AppState::new(db_pool, &test_jwt_secret, test_password_pepper, &config).await.expect("Failed to create AppState");

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{record_id}", get(get_record))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        .route("/collections/{name}/records", post(create_record))
        .route(
            "/collections/{name}/records/{record_id}",
            put(update_record),
        )
        .route(
            "/collections/{name}/records/{record_id}",
            delete(delete_record),
        )
        .layer(middleware::from_fn_with_state(
            app_state.auth_state.clone(),
            auth_middleware,
        ));

    Router::new()
        .merge(public_routes)
        .nest("/api", protected_routes)
        .with_state(app_state)
}

fn unique_collection_name(prefix: &str) -> String {
    let uuid_suffix = uuid::Uuid::new_v4().to_string();
    let short_uuid = &uuid_suffix[0..8];
    format!("{}_{}", prefix, short_uuid)
}

async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

async fn create_test_user(_app: &Router, role: &str) -> (i32, String) {
    let unique_username = format!(
        "test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let unique_email = format!("{}@test.com", unique_username);

    // Create user directly in database with is_verified = true
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let mut conn = db_pool.get().expect("Failed to get database connection");
    let test_password_pepper = "test_pepper".to_string();

    // Create new user with verification status set to true for tests
    let new_user = NewUser::new_verified(
        unique_email.clone(),
        "TestPassword123!",
        unique_username,
        role.to_string(),
        true,
        &test_password_pepper
    ).expect("Failed to create new user");

    // Insert user into database
    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .expect("Failed to insert user");

    // Get the inserted user
    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(User::as_select())
        .first(&mut conn)
        .expect("Failed to fetch inserted user");

    let user_id = user.id;
    let token = create_token_for_user(user_id, &unique_email, role);
    (user_id, token)
}

fn create_token_for_user(user_id: i32, email: &str, role: &str) -> String {
    use lunarbase::utils::Claims;
    
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let exp = now + 3600; // 1 hour

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        role: role.to_string(),
        exp,
        iat: now,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let jwt_secret = "test_secret".to_string();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .expect("Failed to create test token")
}

fn create_test_schema() -> CollectionSchema {
    CollectionSchema {
        fields: vec![
            FieldDefinition {
                name: "name".to_string(),
                field_type: FieldType::Text,
                required: true,
                default_value: None,
                validation: Some(ValidationRules {
                    min_length: Some(1),
                    max_length: Some(100),
                    pattern: None,
                    min_value: None,
                    max_value: None,
                    enum_values: None,
                }),
            },
            FieldDefinition {
                name: "avatar".to_string(),
                field_type: FieldType::File,
                required: false,
                default_value: None,
                validation: None,
            },
            FieldDefinition {
                name: "documents".to_string(),
                field_type: FieldType::File,
                required: false,
                default_value: None,
                validation: None,
            },
        ],
    }
}

#[tokio::test]
async fn test_file_upload_s3_disabled() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_files");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    let status = response.status();
    if status != StatusCode::CREATED {
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let response_text = String::from_utf8_lossy(&body);
        eprintln!("First request - Response status: {}, body: {}", status, response_text);
        panic!("Expected 201 CREATED, got {}: {}", status, response_text);
    }
    assert_eq!(status, StatusCode::CREATED);
    
    // Try to upload a file when S3 is disabled
    let record_data = json!({
        "name": "Test Record"
    });
    
    // Create multipart body with data field and file field
    let boundary = "test_boundary";
    let multipart_body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\n\r\n{}\r\n--{}\r\nContent-Disposition: form-data; name=\"file_avatar\"; filename=\"test.txt\"\r\nContent-Type: text/plain\r\n\r\nHello World\r\n--{}--",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary,
        boundary
    );
    
    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(multipart_body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
    let status = response.status();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let response_text = String::from_utf8_lossy(&body);
    
    if status != StatusCode::BAD_REQUEST {
        eprintln!("Second request - Response status: {}, body: {}", status, response_text);
        panic!("Expected 400 BAD_REQUEST, got {}: {}", status, response_text);
    }
     
     // Should fail because S3 is not configured
    eprintln!("Response body: {}", response_text);
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(response_text.contains("VALIDATION_ERROR"));
}

#[tokio::test]
async fn test_create_record_without_files() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_no_files");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Create record without any files using multipart/form-data
    let record_data = json!({
        "name": "Test Record Without Files"
    });

    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );

    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
     
     // Should succeed
     assert_eq!(response.status(), StatusCode::CREATED);
    
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let response_json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(response_json["data"]["data"]["name"], "Test Record Without Files");
    assert!(response_json["data"]["data"]["avatar"].is_null());
    assert!(response_json["data"]["data"]["documents"].is_null());
}

#[tokio::test]
async fn test_invalid_multipart_data() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_invalid_multipart");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Send invalid multipart data
    let invalid_multipart_body = "--boundary\r\nContent-Disposition: form-data; name=\"invalid\"\r\n\r\ninvalid data\r\n--boundary--";
    
    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", "multipart/form-data; boundary=boundary")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(invalid_multipart_body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
     
     // Should fail with bad request
     assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_file_field_validation() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_file_validation");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Try to upload with invalid field types using multipart/form-data
    let file_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    
    let record_data = json!({
        "name": file_data, // This should be text, not a file
    });
    
    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}\r\nContent-Disposition: form-data; name=\"file_avatar\"\r\nContent-Type: text/plain\r\n\r\nregular text\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary,
        boundary
    );
    
    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
    
    // Debug: Print response status and body
    let status = response.status();
    println!("test_file_field_validation - Response status: {}", status);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let response_text = String::from_utf8(body.to_vec()).unwrap();
    println!("test_file_field_validation - Response body: {}", response_text);
     
     // Should fail - invalid data type for text field
     assert_eq!(status, StatusCode::BAD_REQUEST);
     
     // Check that it's a validation error
     assert!(response_text.contains("VALIDATION_ERROR"));
}

#[tokio::test]
async fn test_nonexistent_file_field() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_nonexistent_field");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Try to upload to a field that doesn't exist using multipart/form-data
    let record_data = json!({
        "name": "Test Record",
        "nonexistent_file_field": "some_value"
    });
    
    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );
    
    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
    
    // Debug: Print response status and body
    let status = response.status();
    println!("test_nonexistent_file_field - Response status: {}", status);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let response_text = String::from_utf8(body.to_vec()).unwrap();
    println!("test_nonexistent_file_field - Response body: {}", response_text);
     
     // Should succeed - nonexistent fields are ignored
     assert_eq!(status, StatusCode::CREATED);
     
     // Check that the record was created successfully
     let response_json: Value = serde_json::from_slice(&body).unwrap();
     assert_eq!(response_json["data"]["data"]["name"], "Test Record");
     // nonexistent_file_field should not be present in the response
     assert!(response_json["data"]["data"]["nonexistent_file_field"].is_null());
}

#[tokio::test]
async fn test_invalid_base64_data() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app1).await;
    
    let collection_name = unique_collection_name("test_invalid_base64");
    
    // Create collection with file fields
    let schema = create_test_schema();
    let create_collection_request = json!({
        "name": collection_name,
        "schema": schema
    });
    
    let request = Request::builder()
        .method("POST")
        .uri("/api/collections")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(serde_json::to_string(&create_collection_request).unwrap()))
        .unwrap();
    
    let response = app1.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    
    // Try to upload invalid base64 data using multipart/form-data
    let record_data = json!({
        "name": "Test Record"
    });
    
    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}\r\nContent-Disposition: form-data; name=\"file_avatar\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\ninvalid_base64_data!!!\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary,
        boundary
    );
    
    let request = Request::builder()
        .method("POST")
        .uri(&format!("/api/collections/{}/records", collection_name))
        .header("content-type", format!("multipart/form-data; boundary={}", boundary))
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();
    
    let response = app2.oneshot(request).await.unwrap();
     
     // Should fail with bad request
     assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let response_text = String::from_utf8(body.to_vec()).unwrap();
    assert!(response_text.contains("VALIDATION_ERROR"));
}