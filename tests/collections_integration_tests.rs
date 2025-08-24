use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    routing::{delete, get, post, put},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid;

use axum::middleware;
use lunarbase::database::create_pool;
use lunarbase::handlers::auth::*;
use lunarbase::handlers::collections::*;
use lunarbase::middleware::auth_middleware;
use lunarbase::models::{CollectionSchema, FieldDefinition, FieldType, ValidationRules};
use lunarbase::{AppState, Config};

async fn create_test_router() -> Router {
    let test_jwt_secret = "test_secret".to_string();

    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let test_password_pepper = "test_pepper".to_string();
    let app_state = AppState::new(db_pool, &test_jwt_secret, test_password_pepper, &config)
        .await
        .expect("Failed to create AppState");

    let public_routes = Router::new()
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{record_id}", get(get_record))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login));

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

    let api_routes = Router::new().merge(public_routes).merge(protected_routes);

    let router = Router::new().nest("/api", api_routes).with_state(app_state);

    router
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

fn unique_collection_name(prefix: &str) -> String {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{}_{}", prefix, timestamp)
}

async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

async fn create_test_user(_app: &Router, role: &str) -> (i32, String) {
    use diesel::prelude::*;
    use lunarbase::models::NewUser;
    use lunarbase::schema::users;
    use lunarbase::{Config, database::create_pool};

    let unique_username = format!(
        "test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let unique_email = format!("{}@test.com", unique_username);

    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let mut conn = db_pool.get().expect("Failed to get database connection");
    let test_password_pepper = "test_pepper".to_string();

    let new_user = NewUser::new_verified(
        unique_email.clone(),
        "TestPassword123!",
        unique_username,
        role.to_string(),
        true,
        &test_password_pepper,
    )
    .expect("Failed to create new user");

    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .expect("Failed to insert user");

    let user: lunarbase::models::User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(lunarbase::models::User::as_select())
        .first(&mut conn)
        .expect("Failed to fetch inserted user");

    let user_id = user.id;
    let token = create_token_for_user(user_id, &unique_email, role);
    (user_id, token)
}

fn create_token_for_user(user_id: i32, email: &str, role: &str) -> String {
    use jsonwebtoken::{EncodingKey, Header, encode};
    use lunarbase::utils::Claims;
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let exp = now + 3600;

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

#[tokio::test]
async fn test_list_collections_public() {
    let app = create_test_router().await;

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
    let app = create_test_router().await;

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
    let app = create_test_router().await;

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
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_collection_with_admin_auth() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

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
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

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
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let schema = create_test_schema();
    let unique_name = unique_collection_name("get_test");
    let payload = json!({
        "name": unique_name,
        "display_name": "Get Test Unique Collection",
        "description": "Test getting collection",
        "schema": schema
    });

    let create_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let create_response = app.clone().oneshot(create_request).await.unwrap();
    assert_eq!(create_response.status(), StatusCode::CREATED);

    let get_request = Request::builder()
        .uri(&format!("/api/collections/{}", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_response = app.oneshot(get_request).await.unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);

    let body = get_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["name"], unique_name);
    assert_eq!(
        json_response["data"]["display_name"],
        "Get Test Unique Collection"
    );
}

#[tokio::test]
async fn test_create_record_success() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app1).await;

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

    let record_data = json!({
        "title": "Test Article",
        "content": "This is a test article content",
        "published": true,
        "views": 42,
        "email": "test@example.com"
    });

    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app2.oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["data"]["title"], "Test Article");
    assert_eq!(json_response["data"]["data"]["published"], true);
    assert_eq!(json_response["data"]["data"]["views"], 42);
}

#[tokio::test]
async fn test_create_record_validation_error() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app1).await;

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

    let record_data = json!({
        "content": "Missing required title field"
    });

    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app2.oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_list_records_public() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app1).await;

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

    let list_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let list_response = app2.oneshot(list_request).await.unwrap();
    assert_eq!(list_response.status(), StatusCode::OK);

    let body = list_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert!(json_response["data"].is_array());
}

#[tokio::test]
async fn test_get_collection_schema() {
    let app1 = create_test_router().await;
    let app2 = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app1).await;

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

    let schema_request = Request::builder()
        .uri(&format!("/api/collections/{}/schema", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let schema_response = app2.oneshot(schema_request).await.unwrap();
    assert_eq!(schema_response.status(), StatusCode::OK);

    let body = schema_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert!(json_response["data"]["fields"].is_array());
    assert_eq!(json_response["data"]["fields"].as_array().unwrap().len(), 5);
}

#[tokio::test]
async fn test_delete_record_with_files() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let unique_name = unique_collection_name("delete_files_test");

    let schema = CollectionSchema {
        fields: vec![
            FieldDefinition {
                name: "title".to_string(),
                field_type: FieldType::Text,
                required: true,
                default_value: None,
                validation: None,
            },
            FieldDefinition {
                name: "document".to_string(),
                field_type: FieldType::File,
                required: false,
                default_value: None,
                validation: None,
            },
        ],
    };

    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Delete Files Test Collection",
        "description": "Test collection for file deletion",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let record_data = json!({
        "title": "Test Record with File",
        "document": "https://test-bucket.s3.amazonaws.com/files/test-document.pdf"
    });

    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    let record_id: i32 = json_response["data"]["id"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    let delete_record_request = Request::builder()
        .uri(&format!(
            "/api/collections/{}/records/{}",
            unique_name, record_id
        ))
        .method("DELETE")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let delete_record_response = app.clone().oneshot(delete_record_request).await.unwrap();
    assert_eq!(delete_record_response.status(), StatusCode::NO_CONTENT);

    let get_record_request = Request::builder()
        .uri(&format!(
            "/api/collections/{}/records/{}",
            unique_name, record_id
        ))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_record_response = app.clone().oneshot(get_record_request).await.unwrap();
    assert_eq!(get_record_response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_delete_collection_with_files() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let unique_name = unique_collection_name("delete_collection_files_test");

    let schema = CollectionSchema {
        fields: vec![
            FieldDefinition {
                name: "title".to_string(),
                field_type: FieldType::Text,
                required: true,
                default_value: None,
                validation: None,
            },
            FieldDefinition {
                name: "document".to_string(),
                field_type: FieldType::File,
                required: false,
                default_value: None,
                validation: None,
            },
        ],
    };

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(
            serde_json::to_string(&json!({
                "name": unique_name,
                "display_name": "Test Collection with Files",
                "description": "Test collection for file deletion",
                "schema": schema
            }))
            .unwrap(),
        ))
        .unwrap();

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let record_data = json!({
        "title": "Test Document",
        "document": "https://test-bucket.s3.amazonaws.com/files/test-document.pdf"
    });

    let boundary = "boundary";
    let body = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary,
        serde_json::to_string(&record_data).unwrap(),
        boundary
    );

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let record_data2 = json!({
        "title": "Test Document 2",
        "document": "https://test-bucket.s3.amazonaws.com/files/test-document-2.pdf"
    });

    let boundary2 = "boundary2";
    let body2 = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\nContent-Type: application/json\r\n\r\n{}\r\n--{}--\r\n",
        boundary2,
        serde_json::to_string(&record_data2).unwrap(),
        boundary2
    );

    let create_record_request2 = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary2),
        )
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(body2))
        .unwrap();

    let create_record_response2 = app.clone().oneshot(create_record_request2).await.unwrap();
    assert_eq!(create_record_response2.status(), StatusCode::CREATED);

    let delete_collection_request = Request::builder()
        .uri(&format!("/api/collections/{}", unique_name))
        .method("DELETE")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let delete_collection_response = app
        .clone()
        .oneshot(delete_collection_request)
        .await
        .unwrap();
    assert_eq!(delete_collection_response.status(), StatusCode::NO_CONTENT);

    let get_collection_request = Request::builder()
        .uri(&format!("/api/collections/{}", unique_name))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_collection_response = app.clone().oneshot(get_collection_request).await.unwrap();
    assert_eq!(get_collection_response.status(), StatusCode::NOT_FOUND);
}
