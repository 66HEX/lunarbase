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
use lunarbase::handlers::{
    auth::*, collections::*, ownership::*, permissions::*, record_permissions::*,
};
use lunarbase::middleware::auth_middleware;
use lunarbase::models::{CollectionSchema, FieldDefinition, FieldType, ValidationRules};
use lunarbase::{AppState};

mod common;

async fn create_test_router() -> Router {
    let test_jwt_secret = "test_permission_secret".to_string();
    let config = common::create_test_config().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let test_password_pepper = "test_pepper".to_string();
    let app_state = AppState::new(db_pool, &test_jwt_secret, test_password_pepper, &config)
        .await
        .expect("Failed to create AppState");

    let public_routes = Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/collections", get(list_collections))
        .route("/collections/{name}", get(get_collection))
        .route("/collections/{name}/schema", get(get_collection_schema))
        .route("/collections/{name}/records", get(list_records))
        .route("/collections/{name}/records/{id}", get(get_record));

    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        .route("/collections", post(create_collection))
        .route("/collections/{name}", put(update_collection))
        .route("/collections/{name}", delete(delete_collection))
        .route("/collections/stats", get(get_collections_stats))
        .route("/collections/{name}/records", post(create_record))
        .route("/collections/{name}/records/{id}", put(update_record))
        .route("/collections/{name}/records/{id}", delete(delete_record))
        .route("/permissions/roles", post(create_role))
        .route("/permissions/roles", get(list_roles))
        .route("/permissions/roles/{role_name}", get(get_role))
        .route(
            "/permissions/collections/{name}",
            post(set_collection_permission),
        )
        .route(
            "/permissions/collections/{name}",
            get(get_collection_permissions),
        )
        .route(
            "/permissions/users/{user_id}/collections/{name}",
            post(set_user_collection_permission),
        )
        .route(
            "/permissions/users/{user_id}/collections/{name}",
            get(get_user_collection_permissions),
        )
        .route(
            "/permissions/users/{user_id}/collections",
            get(get_user_accessible_collections),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}",
            post(set_record_permission),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users/{user_id}",
            get(get_record_permissions),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users/{user_id}",
            delete(remove_record_permission),
        )
        .route(
            "/permissions/collections/{name}/records/{record_id}/users",
            get(list_record_permissions),
        )
        .route(
            "/ownership/collections/{name}/records/{record_id}/transfer",
            post(transfer_record_ownership),
        )
        .route(
            "/ownership/collections/{name}/my-records",
            get(get_my_owned_records),
        )
        .route(
            "/ownership/collections/{name}/users/{user_id}/records",
            get(get_user_owned_records),
        )
        .route(
            "/ownership/collections/{name}/records/{record_id}/check",
            get(check_record_ownership),
        )
        .route(
            "/ownership/collections/{name}/stats",
            get(get_ownership_stats),
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
        email: format!("user{}@test.com", user_id),
        role: role.to_string(),
        exp,
        iat: now,
        jti: uuid::Uuid::new_v4().to_string(),
    };

    let jwt_secret = "test_permission_secret";
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .expect("Failed to create test token")
}

async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

async fn create_test_user(_app: &Router, role: &str) -> (i32, String) {
    use diesel::prelude::*;
    use lunarbase::models::NewUser;
    use lunarbase::schema::users;
    use lunarbase::database::create_pool;

    let unique_email = format!("test_{}@example.com", uuid::Uuid::new_v4());
    let unique_username = format!(
        "test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );

    let config = common::create_test_config().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let mut conn = db_pool.get().expect("Failed to get database connection");
    let test_password_pepper = "test_pepper".to_string();

    let new_user = NewUser::new_verified(
        unique_email.clone(),
        "Test123!@#",
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
    let token = create_token_for_user(user_id, role);

    (user_id, token)
}

#[tokio::test]
async fn test_role_management_full_cycle() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;

    let unique_role_name = format!(
        "role_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
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

    let list_roles_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let list_roles_response = app.clone().oneshot(list_roles_request).await.unwrap();
    assert_eq!(list_roles_response.status(), StatusCode::OK);

    let body = list_roles_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert!(json_response["data"].is_array());
    let roles = json_response["data"].as_array().unwrap();
    assert!(roles.iter().any(|role| role["name"] == unique_role_name));

    let get_role_request = Request::builder()
        .uri(&format!("/api/permissions/roles/{}", unique_role_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_role_response = app.clone().oneshot(get_role_request).await.unwrap();
    assert_eq!(get_role_response.status(), StatusCode::OK);

    let body = get_role_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["name"], unique_role_name);
    assert_eq!(
        json_response["data"]["description"],
        "Can edit content but not admin features"
    );
}

#[tokio::test]
async fn test_role_management_unauthorized() {
    let app = create_test_router().await;
    let (_user_id, user_token) = create_test_user(&app, "user").await;

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

#[tokio::test]
async fn test_collection_permissions_full_scenario() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user_id, user_token) = create_test_user(&app, "user").await;

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

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": false,
        "can_delete": false,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    let get_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_permission_response = app.clone().oneshot(get_permission_request).await.unwrap();
    assert_eq!(get_permission_response.status(), StatusCode::OK);

    let body = get_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);

    let record_data = json!({
        "title": "User Created Record",
        "content": "This should work"
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
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    let status = create_record_response.status();
    if status != StatusCode::CREATED {
        let body = create_record_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!(
            "Create record failed with status: {}, body: {}",
            status, body_str
        );
        panic!("Expected CREATED status, got: {}", status);
    }
    assert_eq!(status, StatusCode::CREATED);

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

    let boundary = "----formdata-test-boundary";
    let form_data = format!(
        "--{}\r\nContent-Disposition: form-data; name=\"data\"\r\n\r\n{{\"title\": \"Updated Title\"}}\r\n--{}--\r\n",
        boundary, boundary
    );

    let update_record_request = Request::builder()
        .uri(&format!(
            "/api/collections/{}/records/{}",
            unique_name, record_id
        ))
        .method("PUT")
        .header(
            "content-type",
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(form_data))
        .unwrap();

    let update_record_response = app.clone().oneshot(update_record_request).await.unwrap();
    println!(
        "Update record response status: {:?}",
        update_record_response.status()
    );
    assert!(
        update_record_response.status() == StatusCode::FORBIDDEN
            || update_record_response.status() == StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn test_record_level_permissions() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (_user1_id, user1_token) = create_test_user(&app, "user").await;
    let (user2_id, _user2_token) = create_test_user(&app, "user").await;

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

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            _user1_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    let record_data = json!({
        "title": "User1's Record",
        "content": "Private content"
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
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    let status = create_record_response.status();
    if status != StatusCode::CREATED {
        let body = create_record_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!(
            "Create record failed with status: {}, body: {}",
            status, body_str
        );
        panic!("Expected CREATED status, got: {}", status);
    }
    assert_eq!(status, StatusCode::CREATED);

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

    let record_permission_payload = json!({
        "user_id": user2_id,
        "record_id": record_id,
        "can_read": true,
        "can_update": false,
        "can_delete": false
    });

    let set_record_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}/records/{}",
            unique_name, record_id
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(record_permission_payload.to_string()))
        .unwrap();

    let set_record_permission_response = app
        .clone()
        .oneshot(set_record_permission_request)
        .await
        .unwrap();
    assert_eq!(set_record_permission_response.status(), StatusCode::OK);

    let get_record_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}/records/{}/users/{}",
            unique_name, record_id, user2_id
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_record_permission_response = app
        .clone()
        .oneshot(get_record_permission_request)
        .await
        .unwrap();
    assert_eq!(get_record_permission_response.status(), StatusCode::OK);

    let body = get_record_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);

    let list_record_permissions_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}/records/{}/users",
            unique_name, record_id
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let list_record_permissions_response = app
        .clone()
        .oneshot(list_record_permissions_request)
        .await
        .unwrap();
    assert_eq!(list_record_permissions_response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_ownership_full_scenario() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user1_id, user1_token) = create_test_user(&app, "user").await;
    let (user2_id, user2_token) = create_test_user(&app, "user").await;

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

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let permission_payload = json!({
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user1_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(permission_payload.to_string()))
        .unwrap();

    let set_permission_response = app.clone().oneshot(set_permission_request).await.unwrap();
    assert_eq!(set_permission_response.status(), StatusCode::OK);

    let record_data = json!({
        "title": "User1's Owned Record",
        "content": "This belongs to user1"
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
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(body))
        .unwrap();

    let create_record_response = app.clone().oneshot(create_record_request).await.unwrap();
    let status = create_record_response.status();
    if status != StatusCode::CREATED {
        let body = create_record_response
            .into_body()
            .collect()
            .await
            .unwrap()
            .to_bytes();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!(
            "Create record failed with status: {}, body: {}",
            status, body_str
        );
        panic!("Expected status 201 CREATED, got {}", status);
    }
    assert_eq!(status, StatusCode::CREATED);

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

    let check_ownership_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/records/{}/check",
            unique_name, record_id
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::empty())
        .unwrap();

    let check_ownership_response = app.clone().oneshot(check_ownership_request).await.unwrap();
    assert_eq!(check_ownership_response.status(), StatusCode::OK);

    let body = check_ownership_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["is_owner"], true);
    assert_eq!(json_response["data"]["owner_id"], user1_id);

    let get_owned_records_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/my-records",
            unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::empty())
        .unwrap();

    let get_owned_records_response = app
        .clone()
        .oneshot(get_owned_records_request)
        .await
        .unwrap();
    assert_eq!(get_owned_records_response.status(), StatusCode::OK);

    let body = get_owned_records_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["total_owned"], 1);
    assert!(json_response["data"]["records"].is_array());

    let transfer_payload = json!({
        "new_owner_id": user2_id
    });

    let transfer_ownership_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/records/{}/transfer",
            unique_name, record_id
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::from(transfer_payload.to_string()))
        .unwrap();

    let transfer_ownership_response = app
        .clone()
        .oneshot(transfer_ownership_request)
        .await
        .unwrap();
    assert_eq!(transfer_ownership_response.status(), StatusCode::OK);

    let check_ownership_user2_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/records/{}/check",
            unique_name, record_id
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user2_token))
        .body(Body::empty())
        .unwrap();

    let check_ownership_user2_response = app
        .clone()
        .oneshot(check_ownership_user2_request)
        .await
        .unwrap();
    assert_eq!(check_ownership_user2_response.status(), StatusCode::OK);

    let body = check_ownership_user2_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["is_owner"], true);
    assert_eq!(json_response["data"]["owner_id"], user2_id);

    let ownership_stats_request = Request::builder()
        .uri(&format!("/api/ownership/collections/{}/stats", unique_name))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let ownership_stats_response = app.clone().oneshot(ownership_stats_request).await.unwrap();
    assert_eq!(ownership_stats_response.status(), StatusCode::OK);

    let body = ownership_stats_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert!(json_response["data"]["total_records"].as_i64().unwrap() >= 1);
    assert!(json_response["data"]["owned_records"].as_i64().unwrap() >= 1);
}

#[tokio::test]
async fn test_permission_error_scenarios() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user_id, user_token) = create_test_user(&app, "user").await;

    let get_permission_request = Request::builder()
        .uri("/api/permissions/collections/nonexistent_collection")
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_permission_response = app.clone().oneshot(get_permission_request).await.unwrap();
    assert_eq!(get_permission_response.status(), StatusCode::NOT_FOUND);

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

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let admin_permission_payload = json!({
        "role_name": "admin",
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_admin_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(admin_permission_payload.to_string()))
        .unwrap();

    let set_admin_permission_response = app
        .clone()
        .oneshot(set_admin_permission_request)
        .await
        .unwrap();
    assert_eq!(set_admin_permission_response.status(), StatusCode::OK);

    let list_roles_request = Request::builder()
        .uri("/api/permissions/roles")
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let list_roles_response = app.clone().oneshot(list_roles_request).await.unwrap();
    assert_eq!(list_roles_response.status(), StatusCode::FORBIDDEN);

    let record_data = json!({
        "title": "Admin Record",
        "content": "Created by admin"
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

    let transfer_payload = json!({
        "new_owner_id": user_id
    });

    let transfer_ownership_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/records/{}/transfer",
            unique_name, record_id
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::from(transfer_payload.to_string()))
        .unwrap();

    let transfer_ownership_response = app
        .clone()
        .oneshot(transfer_ownership_request)
        .await
        .unwrap();
    assert!(
        transfer_ownership_response.status() == StatusCode::FORBIDDEN
            || transfer_ownership_response.status() == StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn test_hierarchical_permissions() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user_id, user_token) = create_test_user(&app, "user").await;

    let get_user_collections_request = Request::builder()
        .uri(&format!("/api/permissions/users/{}/collections", user_id))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_user_collections_response = app
        .clone()
        .oneshot(get_user_collections_request)
        .await
        .unwrap();
    assert_eq!(get_user_collections_response.status(), StatusCode::OK);

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

    let create_collection_response = app
        .clone()
        .oneshot(create_collection_request)
        .await
        .unwrap();
    assert_eq!(create_collection_response.status(), StatusCode::CREATED);

    let get_user_owned_records_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/users/{}/records",
            unique_name, user_id
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_user_owned_records_response = app
        .clone()
        .oneshot(get_user_owned_records_request)
        .await
        .unwrap();
    assert_eq!(get_user_owned_records_response.status(), StatusCode::OK);

    let get_other_user_records_request = Request::builder()
        .uri(&format!(
            "/api/ownership/collections/{}/users/999/records",
            unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_other_user_records_response = app
        .clone()
        .oneshot(get_other_user_records_request)
        .await
        .unwrap();
    assert_eq!(
        get_other_user_records_response.status(),
        StatusCode::FORBIDDEN
    );
}

#[tokio::test]
async fn test_role_collection_permissions_full_cycle() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;

    let unique_role_name = format!(
        "editor_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let role_payload = json!({
        "name": unique_role_name.clone(),
        "description": "Editor role for testing",
        "priority": 30
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

    let schema = create_test_schema();
    let unique_name = unique_collection_name("role_perm_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Role Permission Test Collection",
        "description": "Test role-based permissions",
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

    let role_permission_payload = json!({
        "role_name": unique_role_name.clone(),
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": false,
        "can_list": true
    });

    let set_role_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(role_permission_payload.to_string()))
        .unwrap();

    let set_role_permission_response = app
        .clone()
        .oneshot(set_role_permission_request)
        .await
        .unwrap();
    assert_eq!(set_role_permission_response.status(), StatusCode::OK);

    let get_role_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}?role_name={}",
            unique_name, unique_role_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_role_permission_response = app
        .clone()
        .oneshot(get_role_permission_request)
        .await
        .unwrap();
    assert_eq!(get_role_permission_response.status(), StatusCode::OK);

    let body = get_role_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], true);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);

    let updated_role_permission_payload = json!({
        "role_name": unique_role_name.clone(),
        "collection_name": unique_name.clone(),
        "can_create": false,
        "can_read": true,
        "can_update": false,
        "can_delete": false,
        "can_list": true
    });

    let update_role_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(updated_role_permission_payload.to_string()))
        .unwrap();

    let update_role_permission_response = app
        .clone()
        .oneshot(update_role_permission_request)
        .await
        .unwrap();
    assert_eq!(update_role_permission_response.status(), StatusCode::OK);

    let verify_role_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}?role_name={}",
            unique_name, unique_role_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let verify_role_permission_response = app
        .clone()
        .oneshot(verify_role_permission_request)
        .await
        .unwrap();
    assert_eq!(verify_role_permission_response.status(), StatusCode::OK);

    let body = verify_role_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], false);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);
}

#[tokio::test]
async fn test_multiple_role_permissions() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;

    let editor_role = format!(
        "editor_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let viewer_role = format!(
        "viewer_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );

    for (role_name, description) in [
        (editor_role.clone(), "Editor role"),
        (viewer_role.clone(), "Viewer role"),
    ] {
        let role_payload = json!({
            "name": role_name,
            "description": description,
            "priority": 25
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
    }

    let schema = create_test_schema();
    let unique_name = unique_collection_name("multi_role_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "Multi Role Test Collection",
        "description": "Test multiple role permissions",
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

    let editor_permissions = json!({
        "role_name": editor_role.clone(),
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let viewer_permissions = json!({
        "role_name": viewer_role.clone(),
        "collection_name": unique_name.clone(),
        "can_create": false,
        "can_read": true,
        "can_update": false,
        "can_delete": false,
        "can_list": true
    });

    let set_editor_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(editor_permissions.to_string()))
        .unwrap();

    let set_editor_permission_response = app
        .clone()
        .oneshot(set_editor_permission_request)
        .await
        .unwrap();
    assert_eq!(set_editor_permission_response.status(), StatusCode::OK);

    let set_viewer_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(viewer_permissions.to_string()))
        .unwrap();

    let set_viewer_permission_response = app
        .clone()
        .oneshot(set_viewer_permission_request)
        .await
        .unwrap();
    assert_eq!(set_viewer_permission_response.status(), StatusCode::OK);

    let get_editor_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}?role_name={}",
            unique_name, editor_role
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_editor_permission_response = app
        .clone()
        .oneshot(get_editor_permission_request)
        .await
        .unwrap();
    assert_eq!(get_editor_permission_response.status(), StatusCode::OK);

    let body = get_editor_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], true);

    let get_viewer_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/collections/{}?role_name={}",
            unique_name, viewer_role
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::empty())
        .unwrap();

    let get_viewer_permission_response = app
        .clone()
        .oneshot(get_viewer_permission_request)
        .await
        .unwrap();
    assert_eq!(get_viewer_permission_response.status(), StatusCode::OK);

    let body = get_viewer_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
}

#[tokio::test]
async fn test_user_specific_permissions_override_role() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user_id, user_token) = create_test_user(&app, "user").await;

    let schema = create_test_schema();
    let unique_name = unique_collection_name("user_override_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "User Override Test Collection",
        "description": "Test user-specific permission overrides",
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

    let role_permission_payload = json!({
        "role_name": "user",
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": false,
        "can_list": true
    });

    let set_role_permission_request = Request::builder()
        .uri(&format!("/api/permissions/collections/{}", unique_name))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(role_permission_payload.to_string()))
        .unwrap();

    let set_role_permission_response = app
        .clone()
        .oneshot(set_role_permission_request)
        .await
        .unwrap();
    assert_eq!(set_role_permission_response.status(), StatusCode::OK);

    let user_permission_payload = json!({
        "owner_id": user_id,
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": true,
        "can_list": true
    });

    let set_user_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(user_permission_payload.to_string()))
        .unwrap();

    let set_user_permission_response = app
        .clone()
        .oneshot(set_user_permission_request)
        .await
        .unwrap();
    assert_eq!(set_user_permission_response.status(), StatusCode::OK);

    let get_user_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_user_permission_response = app
        .clone()
        .oneshot(get_user_permission_request)
        .await
        .unwrap();
    assert_eq!(get_user_permission_response.status(), StatusCode::OK);

    let body = get_user_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_delete"], true);
    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], true);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);

    let record_data = json!({
        "title": "Test Record for Deletion",
        "content": "This record will be deleted"
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
        .header("authorization", format!("Bearer {}", user_token))
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
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let delete_record_response = app.clone().oneshot(delete_record_request).await.unwrap();
    assert_eq!(delete_record_response.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn test_user_specific_permissions_null_values() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user_id, user_token) = create_test_user(&app, "user").await;

    let schema = create_test_schema();
    let unique_name = unique_collection_name("user_null_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "User Null Test Collection",
        "description": "Test user-specific permissions with null values",
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

    let user_permission_payload = json!({
        "owner_id": user_id,
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": null,
        "can_update": false,
        "can_delete": null,
        "can_list": true
    });

    let set_user_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(user_permission_payload.to_string()))
        .unwrap();

    let set_user_permission_response = app
        .clone()
        .oneshot(set_user_permission_request)
        .await
        .unwrap();
    assert_eq!(set_user_permission_response.status(), StatusCode::OK);

    let get_user_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user_token))
        .body(Body::empty())
        .unwrap();

    let get_user_permission_response = app
        .clone()
        .oneshot(get_user_permission_request)
        .await
        .unwrap();
    assert_eq!(get_user_permission_response.status(), StatusCode::OK);

    let body = get_user_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);
}

#[tokio::test]
async fn test_user_permissions_unauthorized_access() {
    let app = create_test_router().await;
    let (_admin_id, admin_token) = create_admin_token(&app).await;
    let (user1_id, user1_token) = create_test_user(&app, "user").await;
    let (user2_id, user2_token) = create_test_user(&app, "user").await;

    let schema = create_test_schema();
    let unique_name = unique_collection_name("user_unauth_test");
    let collection_payload = json!({
        "name": unique_name,
        "display_name": "User Unauthorized Test Collection",
        "description": "Test unauthorized access to user permissions",
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

    let user1_permission_payload = json!({
        "owner_id": user1_id,
        "collection_name": unique_name.clone(),
        "can_create": true,
        "can_read": true,
        "can_update": true,
        "can_delete": false,
        "can_list": true
    });

    let set_user1_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user1_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(user1_permission_payload.to_string()))
        .unwrap();

    let set_user1_permission_response = app
        .clone()
        .oneshot(set_user1_permission_request)
        .await
        .unwrap();
    assert_eq!(set_user1_permission_response.status(), StatusCode::OK);

    let get_user1_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user1_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user2_token))
        .body(Body::empty())
        .unwrap();

    let get_user1_permission_response = app
        .clone()
        .oneshot(get_user1_permission_request)
        .await
        .unwrap();
    assert_eq!(
        get_user1_permission_response.status(),
        StatusCode::FORBIDDEN
    );

    let malicious_permission_payload = json!({
        "owner_id": user1_id,
        "collection_name": unique_name.clone(),
        "can_create": false,
        "can_read": false,
        "can_update": false,
        "can_delete": false,
        "can_list": false
    });

    let malicious_set_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user1_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", user2_token))
        .body(Body::from(malicious_permission_payload.to_string()))
        .unwrap();

    let malicious_set_permission_response = app
        .clone()
        .oneshot(malicious_set_permission_request)
        .await
        .unwrap();
    assert_eq!(
        malicious_set_permission_response.status(),
        StatusCode::FORBIDDEN
    );

    let get_own_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user1_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user1_token))
        .body(Body::empty())
        .unwrap();

    let get_own_permission_response = app
        .clone()
        .oneshot(get_own_permission_request)
        .await
        .unwrap();
    assert_eq!(get_own_permission_response.status(), StatusCode::OK);

    let body = get_own_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], true);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], true);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], true);

    let user2_permission_payload = json!({
        "owner_id": user2_id,
        "collection_name": unique_name.clone(),
        "can_create": false,
        "can_read": true,
        "can_update": false,
        "can_delete": false,
        "can_list": false
    });

    let set_user2_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user2_id, unique_name
        ))
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", admin_token))
        .body(Body::from(user2_permission_payload.to_string()))
        .unwrap();

    let set_user2_permission_response = app
        .clone()
        .oneshot(set_user2_permission_request)
        .await
        .unwrap();
    assert_eq!(set_user2_permission_response.status(), StatusCode::OK);

    let get_user2_own_permission_request = Request::builder()
        .uri(&format!(
            "/api/permissions/users/{}/collections/{}",
            user2_id, unique_name
        ))
        .method("GET")
        .header("authorization", format!("Bearer {}", user2_token))
        .body(Body::empty())
        .unwrap();

    let get_user2_own_permission_response = app
        .clone()
        .oneshot(get_user2_own_permission_request)
        .await
        .unwrap();
    assert_eq!(get_user2_own_permission_response.status(), StatusCode::OK);

    let body = get_user2_own_permission_response
        .into_body()
        .collect()
        .await
        .unwrap()
        .to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["permissions"]["can_create"], false);
    assert_eq!(json_response["data"]["permissions"]["can_read"], true);
    assert_eq!(json_response["data"]["permissions"]["can_update"], false);
    assert_eq!(json_response["data"]["permissions"]["can_delete"], false);
    assert_eq!(json_response["data"]["permissions"]["can_list"], false);
}
