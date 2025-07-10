use axum::{
    Router,
    routing::{get, post, put, delete},
    http::{StatusCode, Request},
    body::Body,
};
use serde_json::{json, Value};
use tower::ServiceExt;
use http_body_util::BodyExt;
use uuid;

use ironbase::{AppState, Config};
use ironbase::database::create_pool;
use ironbase::handlers::collections::*;
use ironbase::models::{CollectionSchema, FieldDefinition, FieldType, ValidationRules};
use ironbase::middleware::{add_middleware, auth_middleware};
use axum::middleware;

fn create_test_router() -> Router {
    // Use consistent test secret for JWT
    let test_jwt_secret = "test_secret".to_string();
    
    // Load test config but override JWT secret for consistency
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let app_state = AppState::new(db_pool, &test_jwt_secret);

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{record_id}", get(get_record));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        .route("/collections/{name}/records/{record_id}", put(update_record))
        .route("/collections/{name}/records/{record_id}", delete(delete_record))
        .layer(middleware::from_fn_with_state(app_state.auth_state.clone(), auth_middleware));

    // Combine routes
    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let router = Router::new()
        .nest("/api", api_routes)
        .with_state(app_state);

    add_middleware(router)
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
                validation: Some(ValidationRules {
                    min_length: None,
                    max_length: Some(1000),
                    min_value: None,
                    max_value: None,
                    pattern: None,
                    enum_values: None,
                }),
            },
            FieldDefinition {
                name: "published".to_string(),
                field_type: FieldType::Boolean,
                required: false,
                default_value: Some(json!(false)),
                validation: None,
            },
            FieldDefinition {
                name: "views".to_string(),
                field_type: FieldType::Number,
                required: false,
                default_value: Some(json!(0)),
                validation: Some(ValidationRules {
                    min_length: None,
                    max_length: None,
                    min_value: Some(0.0),
                    max_value: Some(1000000.0),
                    pattern: None,
                    enum_values: None,
                }),
            },
            FieldDefinition {
                name: "email".to_string(),
                field_type: FieldType::Email,
                required: false,
                default_value: None,
                validation: None,
            },
        ],
    }
}

// Helper function to generate unique collection name
fn unique_collection_name(prefix: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{}_{}", prefix, timestamp)
}

// Helper function to create admin JWT token for testing
fn create_admin_token() -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    use ironbase::utils::Claims;
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let exp = now + 3600; // 1 hour

    let claims = Claims {
        sub: "admin".to_string(),
        email: "admin@test.com".to_string(),
        role: "admin".to_string(),
        exp,
        iat: now,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "test_secret".to_string());
    encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret.as_ref()))
        .expect("Failed to create test token")
}

#[tokio::test]
async fn test_list_collections_public() {
    let app = create_test_router();

    let request = Request::builder()
        .uri("/api/collections")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_nonexistent_collection() {
    let app = create_test_router();

    let request = Request::builder()
        .uri("/api/collections/nonexistent")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_create_collection_without_auth() {
    let app = create_test_router();

    let schema = create_test_schema();
    let payload = json!({
        "name": "test_articles",
        "display_name": "Test Articles",
        "description": "A test collection for articles",
        "schema": schema
    });

    let request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    // Should require authentication
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_collection_with_admin_auth() {
    let app = create_test_router();
    let token = create_admin_token();

    let schema = create_test_schema();
    let unique_name = unique_collection_name("admin_test");
    let payload = json!({
        "name": unique_name,
        "display_name": "Admin Test Unique", 
        "description": "A test collection for admin auth test",
        "schema": schema
    });

    let request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert_eq!(json_response["data"]["name"], unique_name);
    assert_eq!(json_response["data"]["display_name"], "Admin Test Unique");
}

#[tokio::test]
async fn test_create_collection_invalid_name() {
    let app = create_test_router();
    let token = create_admin_token();

    let schema = create_test_schema();
    let payload = json!({
        "name": "invalid-name!",
        "display_name": "Invalid Name",
        "description": "Test invalid name",
        "schema": schema
    });

    let request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_create_and_get_collection() {
    let app1 = create_test_router();
    let app2 = create_test_router();
    let token = create_admin_token();

    let schema = create_test_schema();
    let unique_name = unique_collection_name("get_test");
    let payload = json!({
        "name": unique_name,
        "display_name": "Get Test Unique Collection",
        "description": "Test getting collection",
        "schema": schema
    });

    // Create collection
    let create_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let create_response = app1.oneshot(create_request).await.unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);

    // Get collection
    let get_request = Request::builder()
        .uri(&format!("/api/collections/{}", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_response = app2.oneshot(get_request).await.unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);

    let body = get_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["name"], unique_name);
    assert_eq!(json_response["data"]["display_name"], "Get Test Unique Collection");
}

#[tokio::test]
async fn test_create_record_success() {
    let app1 = create_test_router();
    let app2 = create_test_router();
    let token = create_admin_token();

    // First create a collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("record_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Record Test Unique Collection",
        "description": "Test records",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app1.oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Create record
    let record_payload = json!({
        "data": {
            "title": "Test Article",
            "content": "This is a test article content",
            "published": true,
            "views": 42,
            "email": "test@example.com"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app2.oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["data"]["title"], "Test Article");
    assert_eq!(json_response["data"]["data"]["published"], true);
    assert_eq!(json_response["data"]["data"]["views"], 42);
}

#[tokio::test]
async fn test_create_record_validation_error() {
    let app1 = create_test_router();
    let app2 = create_test_router();
    let token = create_admin_token();

    // Create collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("validation_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Validation Test Unique Collection", 
        "description": "Test validation",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app1.oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Try to create record without required field
    let record_payload = json!({
        "data": {
            "content": "Missing required title field"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app2.oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_list_records_public() {
    let app1 = create_test_router();
    let app2 = create_test_router();
    let token = create_admin_token();

    // Create collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("list_records");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "List Records Unique Test",
        "description": "Test listing records",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app1.oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // List records (should work without auth)
    let list_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let list_response = app2.oneshot(list_request).await.unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);

    let body = list_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    // Should return empty array for new collection
    assert!(json_response["data"].is_array());
}

#[tokio::test]
async fn test_get_collection_schema() {
    let app1 = create_test_router();
    let app2 = create_test_router();
    let token = create_admin_token();

    // Create collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("schema_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Schema Test Unique Collection",
        "description": "Test getting schema",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app1.oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Get schema
    let schema_request = Request::builder()
        .uri(&format!("/api/collections/{}/schema", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let schema_response = app2.oneshot(schema_request).await.unwrap();
    assert_eq!(schema_response.status(), StatusCode::OK);

    let body = schema_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert!(json_response["data"]["fields"].is_array());
    assert_eq!(json_response["data"]["fields"].as_array().unwrap().len(), 5);
} 