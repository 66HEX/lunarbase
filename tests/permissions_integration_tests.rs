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
use ironbase::handlers::{
    collections::*,
    permissions::*,
    record_permissions::*,
    ownership::*,
    auth::*,
};
use ironbase::models::{CollectionSchema, FieldDefinition, FieldType, ValidationRules};
use ironbase::middleware::{add_middleware, auth_middleware};
use axum::middleware;

fn create_test_router() -> Router {
    let test_jwt_secret = "test_permission_secret".to_string();
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let app_state = AppState::new(db_pool, &test_jwt_secret);

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{id}", get(get_record));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        // Collection management (admin only)
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        // Record management
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{id}", put(update_record))
        .route("/collections/{name}/records/{id}", delete(delete_record))
        // Permission management (admin only)
        .route("/permissions/roles", post(create_role))
        .route("/permissions/roles", get(list_roles))
        .route("/permissions/roles/{role_name}", get(get_role))
        .route("/permissions/collections/{name}", post(set_collection_permission))
        .route("/permissions/collections/{name}", get(get_collection_permissions))
        .route("/permissions/collections/{name}/users/{user_id}", post(set_user_collection_permission))
        .route("/permissions/collections/{name}/users/{user_id}", get(get_user_collection_permissions))
        .route("/permissions/users/{user_id}/collections", get(get_user_accessible_collections))
        // Record-level permissions
        .route("/permissions/collections/{name}/records/{record_id}", post(set_record_permission))
        .route("/permissions/collections/{name}/records/{record_id}/users/{user_id}", get(get_record_permissions))
        .route("/permissions/collections/{name}/records/{record_id}/users/{user_id}", delete(remove_record_permission))
        .route("/permissions/collections/{name}/records/{record_id}/users", get(list_record_permissions))
        // Ownership management
        .route("/ownership/collections/{name}/records/{record_id}/transfer", post(transfer_record_ownership))
        .route("/ownership/collections/{name}/my-records", get(get_my_owned_records))
        .route("/ownership/collections/{name}/users/{user_id}/records", get(get_user_owned_records))
        .route("/ownership/collections/{name}/records/{record_id}/check", get(check_record_ownership))
        .route("/ownership/collections/{name}/stats", get(get_ownership_stats))
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
                name: "user_id".to_string(),
                field_type: FieldType::Number,
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

fn create_token_for_user(user_id: i32, role: &str) -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    use ironbase::utils::Claims;
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let exp = now + 3600; // 1 hour

    let claims = Claims {
        sub: user_id.to_string(),
        email: format!("user{}@test.com", user_id),
        role: role.to_string(),
        exp,
        iat: now,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let jwt_secret = "test_permission_secret";
    encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret.as_ref()))
        .expect("Failed to create test token")
}

fn create_admin_token() -> String {
    create_token_for_user(2, "admin")  // User ID 2 is admin in database
}

fn create_user_token(user_id: i32) -> String {
    create_token_for_user(user_id, "user")
}

async fn create_test_user(app: &Router, role: &str) -> (i32, String) {
    let unique_email = format!("test_{}@example.com", uuid::Uuid::new_v4());
    let unique_username = format!("test_{}", uuid::Uuid::new_v4().to_string()[0..8].to_string()); // Keep username short
    let register_payload = json!({
        "email": unique_email,
        "password": "Test123!@#",
        "username": unique_username
    });

    let register_request = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(register_payload.to_string()))
        .unwrap();

    let register_response = app.clone().oneshot(register_request).await.unwrap();
    assert_eq!(register_response.status(), StatusCode::CREATED);

    let body = register_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    let user_id = json_response["data"]["user"]["id"].as_i64().unwrap() as i32;
    let token = create_token_for_user(user_id, role);
    
    (user_id, token)
}

// === ROLE MANAGEMENT TESTS ===

#[tokio::test]
async fn test_role_management_full_cycle() {
    let app = create_test_router();
    let admin_token = create_admin_token();

    // 1. Create a new role with unique name
    let unique_role_name = format!("role_{}", uuid::Uuid::new_v4().to_string()[0..8].to_string());
    let role_payload = json!({
        "name": unique_role_name.clone(),
        "description": "Can edit content but not admin features",
        "priority": 50
    });

    let create_role_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(role_payload.to_string()))
        .unwrap();

    let create_role_response = app.clone().oneshot(create_role_request).await.unwrap();
    assert_eq!(create_role_response.status(), StatusCode::OK);

    // 2. List all roles
    let list_roles_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let list_roles_response = app.clone().oneshot(list_roles_request).await.unwrap();
    assert_eq!(list_roles_response.status(), StatusCode::OK);

    let body = list_roles_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert!(json_response["data"].is_array());
    let roles = json_response["data"].as_array().unwrap();
    assert!(roles.iter().any(|role| role["name"] == unique_role_name));

    // 3. Get specific role
    let get_role_request = Request::builder()
        .uri(&format!("/api/permissions/roles/{}", unique_role_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_role_response = app.clone().oneshot(get_role_request).await.unwrap();
    assert_eq!(get_role_response.status(), StatusCode::OK);

    let body = get_role_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["name"], unique_role_name);
    assert_eq!(json_response["data"]["description"], "Can edit content but not admin features");
}

#[tokio::test]
async fn test_role_management_unauthorized() {
    let app = create_test_router();
    let user_token = create_user_token(2);

    // User should not be able to create roles
    let role_payload = json!({
        "name": "unauthorized_role",
        "description": "Should not be created",
        "priority": 25
    });

    let create_role_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(role_payload.to_string()))
        .unwrap();

    let create_role_response = app.clone().oneshot(create_role_request).await.unwrap();
    assert_eq!(create_role_response.status(), StatusCode::FORBIDDEN);
}

// === COLLECTION PERMISSIONS TESTS ===

#[tokio::test]
async fn test_collection_permissions_full_scenario() {
    let app = create_test_router();
    let admin_token = create_admin_token();
    let (user_id, user_token) = create_test_user(&app, "user").await;

    // 1. Create test collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("perm_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Permission Test Collection",
        "description": "Test collection permissions",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app.clone().oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // 2. Set user-specific collection permissions
    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": false,
        "can_delete": false,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/users/{}", unique_name, user_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    // 3. Get user's collection permissions
    let get_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/users/{}", unique_name, user_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_permission_response = app.clone().oneshot(get_permission_request).await.unwrap();
    assert_eq!(get_permission_response.status(), StatusCode::OK);

    let body = get_permission_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);

    // 4. Test user can create record (has permission)
    let record_payload = json!({
        "data": {
            "title": "User Created Record",
            "content": "This should work"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    let record_id: i32 = json_response["data"]["id"].as_str().unwrap().parse().unwrap();

    // 5. Test user cannot update record (no permission)
    let update_payload = json!({
        "data": {
            "title": "Updated Title"
        }
    });

    let update_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records/{}", unique_name, record_id))
        .method("PUT")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(update_payload.to_string()))
        .unwrap();

    let update_record_response = app.clone().oneshot(update_record_request).await.unwrap();
    // This should fail due to lack of update permission
    assert!(update_record_response.status() == StatusCode::FORBIDDEN || 
            update_record_response.status() == StatusCode::UNAUTHORIZED);
}

// === RECORD PERMISSIONS TESTS ===

#[tokio::test]
async fn test_record_level_permissions() {
    let app = create_test_router();
    let admin_token = create_admin_token();
    let (_user1_id, user1_token) = create_test_user(&app, "user").await;
    let (user2_id, _user2_token) = create_test_user(&app, "user").await;

    // Create collection and record
    let schema = create_test_schema();
    let unique_name = unique_collection_name("record_perm");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Record Permission Test",
        "description": "Test record-level permissions",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app.clone().oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Give user1 permission to create records in this collection
    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/users/{}", unique_name, _user1_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    // Create record as user1
    let record_payload = json!({
        "data": {
            "title": "User1's Record",
            "content": "Private content"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    let record_id: i32 = json_response["data"]["id"].as_str().unwrap().parse().unwrap();

    // Set record-specific permission for user2
    let record_permission_payload = json!({
        "user_id": user2_id,
        "record_id": record_id,
        "can_read": true,
        "can_update": false,
        "can_delete": false
    });

    let set_record_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/records/{}", unique_name, record_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(record_permission_payload.to_string()))
        .unwrap();

    let set_record_permission_response = app.clone().oneshot(set_record_permission_request).await.unwrap();
    assert_eq!(set_record_permission_response.status(), StatusCode::OK);

    // Get record permissions for user2
    let get_record_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/records/{}/users/{}", unique_name, record_id, user2_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_record_permission_response = app.clone().oneshot(get_record_permission_request).await.unwrap();
    assert_eq!(get_record_permission_response.status(), StatusCode::OK);

    let body = get_record_permission_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);

    // List all record permissions
    let list_record_permissions_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/records/{}/users", unique_name, record_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let list_record_permissions_response = app.clone().oneshot(list_record_permissions_request).await.unwrap();
    assert_eq!(list_record_permissions_response.status(), StatusCode::OK);
}

// === OWNERSHIP TESTS ===

#[tokio::test]
async fn test_ownership_full_scenario() {
    let app = create_test_router();
    let admin_token = create_admin_token();
    let (user1_id, user1_token) = create_test_user(&app, "user").await;
    let (user2_id, user2_token) = create_test_user(&app, "user").await;

    // Create collection
    let schema = create_test_schema();
    let unique_name = unique_collection_name("ownership_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Ownership Test Collection",
        "description": "Test ownership functionality",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app.clone().oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Give user1 permission to create records in this collection
    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}/users/{}", unique_name, user1_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    // User1 creates a record (automatically becomes owner)
    let record_payload = json!({
        "data": {
            "title": "User1's Owned Record",
            "content": "This belongs to user1"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    let record_id: i32 = json_response["data"]["id"].as_str().unwrap().parse().unwrap();

    // Check ownership (user1 should be owner)
    let check_ownership_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/records/{}/check", unique_name, record_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::empty())
        .unwrap();

    let check_ownership_response = app.clone().oneshot(check_ownership_request).await.unwrap();
    assert_eq!(check_ownership_response.status(), StatusCode::OK);

    let body = check_ownership_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["is_owner"], true);
    assert_eq!(json_response["data"]["user_id"], user1_id);

    // Get user1's owned records
    let get_owned_records_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/my-records", unique_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::empty())
        .unwrap();

    let get_owned_records_response = app.clone().oneshot(get_owned_records_request).await.unwrap();
    assert_eq!(get_owned_records_response.status(), StatusCode::OK);

    let body = get_owned_records_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["total_owned"], 1);
    assert!(json_response["data"]["records"].is_array());

    // Transfer ownership to user2
    let transfer_payload = json!({
        "new_owner_id": user2_id
    });

    let transfer_ownership_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/records/{}/transfer", unique_name, record_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(transfer_payload.to_string()))
        .unwrap();

    let transfer_ownership_response = app.clone().oneshot(transfer_ownership_request).await.unwrap();
    assert_eq!(transfer_ownership_response.status(), StatusCode::OK);

    // Verify ownership transferred to user2
    let check_ownership_user2_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/records/{}/check", unique_name, record_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", user2_token))
        .body(Body::empty())
        .unwrap();

    let check_ownership_user2_response = app.clone().oneshot(check_ownership_user2_request).await.unwrap();
    assert_eq!(check_ownership_user2_response.status(), StatusCode::OK);

    let body = check_ownership_user2_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert_eq!(json_response["data"]["is_owner"], true);
    assert_eq!(json_response["data"]["user_id"], user2_id);

    // Admin can view ownership statistics
    let ownership_stats_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/stats", unique_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let ownership_stats_response = app.clone().oneshot(ownership_stats_request).await.unwrap();
    assert_eq!(ownership_stats_response.status(), StatusCode::OK);

    let body = ownership_stats_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    assert!(json_response["data"]["total_records"].as_i64().unwrap() >= 1);
    assert!(json_response["data"]["owned_records"].as_i64().unwrap() >= 1);
}

// === ERROR SCENARIOS AND EDGE CASES ===

#[tokio::test]
async fn test_permission_error_scenarios() {
    let app = create_test_router();
    let admin_token = create_admin_token();
    let (user_id, user_token) = create_test_user(&app, "user").await;

    // Test accessing non-existent collection
    let get_permission_request = Request::builder()
        .uri("/api/permissions/collections/nonexistent_collection")
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_permission_response = app.clone().oneshot(get_permission_request).await.unwrap();
    assert_eq!(get_permission_response.status(), StatusCode::NOT_FOUND);

    // Test setting permissions for non-existent user
    let schema = create_test_schema();
    let unique_name = unique_collection_name("error_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Error Test Collection",
        "description": "Test error scenarios",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app.clone().oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Test user accessing admin endpoints
    let list_roles_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let list_roles_response = app.clone().oneshot(list_roles_request).await.unwrap();
    assert_eq!(list_roles_response.status(), StatusCode::FORBIDDEN);

    // Test transferring ownership without being owner
    let record_payload = json!({
        "data": {
            "title": "Admin Record",
            "content": "Created by admin"
        }
    });

    let create_record_request = Request::builder()
        .uri(&format!("/api/collections/{}/records", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(record_payload.to_string()))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    assert_eq!(create_record_response.status(), StatusCode::CREATED);

    let body = create_record_response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    let record_id: i32 = json_response["data"]["id"].as_str().unwrap().parse().unwrap();

    // User tries to transfer ownership of admin's record (should fail)
    let transfer_payload = json!({
        "new_owner_id": user_id
    });

    let transfer_ownership_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/records/{}/transfer", unique_name, record_id))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(transfer_payload.to_string()))
        .unwrap();

    let transfer_ownership_response = app.clone().oneshot(transfer_ownership_request).await.unwrap();
    assert!(transfer_ownership_response.status() == StatusCode::FORBIDDEN || 
            transfer_ownership_response.status() == StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_hierarchical_permissions() {
    let app = create_test_router();
    let admin_token = create_admin_token();
    let (user_id, user_token) = create_test_user(&app, "user").await;

    // Admin can view any user's accessible collections
    let get_user_collections_request = Request::builder()
        .uri(&format!("/api/permissions/users/{}/collections", user_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_user_collections_response = app.clone().oneshot(get_user_collections_request).await.unwrap();
    assert_eq!(get_user_collections_response.status(), StatusCode::OK);

    // User cannot view other users' collections (if implemented)
    // This would require creating another user and testing cross-user access

    // Admin can view any user's owned records
    let schema = create_test_schema();
    let unique_name = unique_collection_name("hierarchy_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Hierarchy Test Collection",
        "description": "Test permission hierarchy",
        "schema": schema
    });

    let create_collection_request = Request::builder()
        .uri("/api/collections")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(collection_payload.to_string()))
        .unwrap();

    let create_collection_response = app.clone().oneshot(create_collection_request).await.unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    // Admin can view user's owned records
    let get_user_owned_records_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/users/{}/records", unique_name, user_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_user_owned_records_response = app.clone().oneshot(get_user_owned_records_request).await.unwrap();
    assert_eq!(get_user_owned_records_response.status(), StatusCode::OK);

    // User cannot view other users' owned records
    let get_other_user_records_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/users/999/records", unique_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_other_user_records_response = app.clone().oneshot(get_other_user_records_request).await.unwrap();
    assert_eq!(get_other_user_records_response.status(), StatusCode::FORBIDDEN);
} 