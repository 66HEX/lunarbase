use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    routing::{delete, get, post, put},
};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid;

use axum::middleware;
use lunarbase::database::create_pool;
use lunarbase::handlers::auth::*;
use lunarbase::handlers::configuration::*;
use lunarbase::middleware::auth_middleware;
use lunarbase::{AppState};

mod common;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

async fn create_test_router() -> Router {
    let test_jwt_secret = "test_secret".to_string();

    let config = common::create_test_config().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");

    {
        let mut conn = db_pool.get().expect("Failed to get database connection");
        conn.run_pending_migrations(MIGRATIONS)
            .expect("Failed to run migrations");
    }

    let test_password_pepper = "test_pepper".to_string();
    let app_state = AppState::new(db_pool, &test_jwt_secret, test_password_pepper, &config)
        .await
        .expect("Failed to create AppState");

    let public_routes = Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login));

    let protected_routes = Router::new()
        .route("/admin/configuration", get(get_all_settings))
        .route(
            "/admin/configuration/{category}",
            get(get_settings_by_category),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}",
            get(get_setting),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}",
            put(update_setting),
        )
        .route("/admin/configuration", post(create_setting))
        .route(
            "/admin/configuration/{category}/{setting_key}",
            delete(delete_setting),
        )
        .route(
            "/admin/configuration/{category}/{setting_key}/reset",
            post(reset_setting),
        )
        .layer(middleware::from_fn_with_state(
            app_state.auth_state.clone(),
            auth_middleware,
        ));

    let api_routes = Router::new().merge(public_routes).merge(protected_routes);

    let router = Router::new().nest("/api", api_routes).with_state(app_state);

    router
}

async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

async fn create_test_user(_app: &Router, role: &str) -> (i32, String) {
    use diesel::prelude::*;
    use lunarbase::models::NewUser;
    use lunarbase::schema::users;
    use lunarbase::database::create_pool;

    let unique_username = format!(
        "test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let unique_email = format!("{}@test.com", unique_username);

    let config = common::create_test_config().expect("Failed to load config");
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

async fn create_test_setting(category: &str, key: &str, value: &str) -> String {
    use diesel::prelude::*;
    use lunarbase::models::system_setting::NewSystemSetting;
    use lunarbase::schema::system_settings;
    use lunarbase::database::create_pool;

    let config = common::create_test_config().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let mut conn = db_pool.get().expect("Failed to get database connection");

    let new_setting = NewSystemSetting {
        category: category.to_string(),
        setting_key: key.to_string(),
        setting_value: value.to_string(),
        data_type: "string".to_string(),
        description: Some(format!("Test setting for {}", key)),
        default_value: Some("default".to_string()),
        is_sensitive: false,
        requires_restart: false,
        updated_by: Some("test_user".to_string()),
    };

    diesel::insert_into(system_settings::table)
        .values(&new_setting)
        .execute(&mut conn)
        .expect("Failed to insert test setting");

    format!("{}-{}", category, key)
}

async fn cleanup_test_setting(category: &str, key: &str) {
    use diesel::prelude::*;
    use lunarbase::schema::system_settings;
    use lunarbase::database::create_pool;

    let config = common::create_test_config().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let mut conn = db_pool.get().expect("Failed to get database connection");

    diesel::delete(
        system_settings::table
            .filter(system_settings::category.eq(category))
            .filter(system_settings::setting_key.eq(key)),
    )
    .execute(&mut conn)
    .ok();
}

#[tokio::test]
async fn test_get_all_settings_without_auth() {
    let app = create_test_router().await;

    let request = Request::builder()
        .uri("/api/admin/configuration")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_get_all_settings_with_admin_auth() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let request = Request::builder()
        .uri("/api/admin/configuration")
        .method("GET")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert!(json_response["data"]["settings"].is_array());
}

#[tokio::test]
async fn test_create_setting_success() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "test_key_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    let payload = json!({
        "category": "database",
        "setting_key": unique_key,
        "setting_value": "test_value",
        "data_type": "string",
        "description": "Test setting",
        "default_value": "default_test",
        "is_sensitive": false,
        "requires_restart": false
    });

    let request = Request::builder()
        .uri("/api/admin/configuration")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    let status = response.status();

    if status != StatusCode::CREATED {
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        println!("Response status: {}", status);
        println!("Response body: {}", body_str);
        panic!("Expected status 201, got {}", status);
    }

    assert_eq!(status, StatusCode::CREATED);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert_eq!(json_response["data"]["setting_key"], unique_key);
    assert_eq!(json_response["data"]["setting_value"], "test_value");

    cleanup_test_setting("database", &unique_key).await;
}

#[tokio::test]
async fn test_get_setting_success() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "get_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "test_value").await;

    let request = Request::builder()
        .uri(&format!("/api/admin/configuration/database/{}", unique_key))
        .method("GET")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert_eq!(json_response["data"]["setting_key"], unique_key);
    assert_eq!(json_response["data"]["setting_value"], "test_value");

    cleanup_test_setting("database", &unique_key).await;
}

#[tokio::test]
async fn test_get_setting_not_found() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let request = Request::builder()
        .uri("/api/admin/configuration/database/nonexistent_key")
        .method("GET")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_update_setting_success() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "update_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "original_value").await;

    let payload = json!({
        "setting_value": "updated_value",
        "description": "Updated test setting"
    });

    let request = Request::builder()
        .uri(&format!("/api/admin/configuration/database/{}", unique_key))
        .method("PUT")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert_eq!(json_response["data"]["setting_value"], "updated_value");

    cleanup_test_setting("database", &unique_key).await;
}

#[tokio::test]
async fn test_delete_setting_success() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "delete_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "to_be_deleted").await;

    let request = Request::builder()
        .uri(&format!("/api/admin/configuration/database/{}", unique_key))
        .method("DELETE")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_get_settings_by_category() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "category_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "category_value").await;

    let request = Request::builder()
        .uri("/api/admin/configuration/database")
        .method("GET")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    assert!(json_response["data"]["settings"].is_array());

    cleanup_test_setting("database", &unique_key).await;
}

#[tokio::test]
async fn test_reset_setting_success() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "reset_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "modified_value").await;

    let request = Request::builder()
        .uri(&format!(
            "/api/admin/configuration/database/{}/reset",
            unique_key
        ))
        .method("POST")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = response.into_body().collect().await.unwrap().to_bytes();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();

    assert_eq!(json_response["data"]["setting_value"], "default");

    cleanup_test_setting("database", &unique_key).await;
}

#[tokio::test]
async fn test_create_setting_without_auth() {
    let app = create_test_router().await;

    let payload = json!({
        "category": "database",
        "setting_key": "unauthorized_test",
        "setting_value": "test_value",
        "data_type": "string"
    });

    let request = Request::builder()
        .uri("/api/admin/configuration")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_create_setting_duplicate_key() {
    let app = create_test_router().await;
    let (_admin_id, token) = create_admin_token(&app).await;

    let unique_key = format!(
        "duplicate_test_{}",
        uuid::Uuid::new_v4().to_string()[0..8].to_string()
    );
    create_test_setting("database", &unique_key, "existing_value").await;

    let payload = json!({
        "category": "database",
        "setting_key": unique_key,
        "setting_value": "new_value",
        "data_type": "string"
    });

    let request = Request::builder()
        .uri("/api/admin/configuration")
        .method("POST")
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {}", token))
        .body(Body::from(payload.to_string()))
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);

    cleanup_test_setting("database", &unique_key).await;
}
