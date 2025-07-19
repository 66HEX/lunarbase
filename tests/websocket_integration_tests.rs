use axum::{
    Router,
    routing::{get, post},
    http::StatusCode,
};
use serde_json::json;
use tower::ServiceExt;
use uuid;

use lunarbase::{AppState, Config};
use lunarbase::database::create_pool;
use lunarbase::handlers::{health_check, register, login, refresh_token, me};
use lunarbase::handlers::collections::*;
use lunarbase::handlers::websocket::*;
use lunarbase::middleware::auth_middleware;
use axum::middleware;

fn create_test_router() -> Router {
    // Use consistent test secret for JWT
    let test_jwt_secret = "test_secret".to_string();
    
    // Load test config but override JWT secret for consistency
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let app_state = AppState::new(db_pool, &test_jwt_secret).expect("Failed to create AppState");

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh_token))
        .route("/collections", get(list_collections))
        .route("/ws", get(websocket_handler))
        .route("/ws/status", get(websocket_status));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        .route("/auth/me", get(me))
        .route("/ws/stats", get(websocket_stats))
        .layer(middleware::from_fn_with_state(app_state.auth_state.clone(), auth_middleware));

    // Combine routes
    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let router = Router::new()
        .nest("/api", api_routes)
        .with_state(app_state);

    // Skip middleware in tests to avoid Prometheus global recorder conflicts
    router
}

// Helper function to create admin JWT token for testing
async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

// Helper function to create test user and return (user_id, token)
async fn create_test_user(app: &Router, role: &str) -> (i32, String) {
    use serde_json::Value;
    use tower::ServiceExt;
    
    let unique_username = format!("test_{}", uuid::Uuid::new_v4().to_string()[0..8].to_string());
    let unique_email = format!("{}@test.com", unique_username);
    
    let register_payload = json!({
        "username": unique_username,
        "email": unique_email,
        "password": "TestPassword123!"
    });

    let register_request = axum::http::Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(register_payload.to_string()))
        .unwrap();

    let register_response = app.clone().oneshot(register_request).await.unwrap();
    
    assert_eq!(register_response.status(), StatusCode::CREATED);

    let body = axum::body::to_bytes(register_response.into_body(), usize::MAX).await.unwrap();
    let body_str = String::from_utf8(body.to_vec()).unwrap();
    let json_response: Value = serde_json::from_str(&body_str).unwrap();
    
    // Extract user_id from data.user.id
    let user_id: i32 = json_response["data"]["user"]["id"].as_i64().unwrap() as i32;

    // If role is not "user", update the user's role in the database
    if role != "user" {
        use diesel::prelude::*;
        use lunarbase::schema::users;
        use lunarbase::Config;
        use lunarbase::database::create_pool;
        
        let config = Config::from_env().expect("Failed to load config");
        let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
        let mut conn = db_pool.get().expect("Failed to get database connection");
        
        diesel::update(users::table.filter(users::id.eq(user_id)))
            .set(users::role.eq(role))
            .execute(&mut conn)
            .expect("Failed to update user role");
    }

    let token = create_token_for_user(user_id, &unique_email, role);
    (user_id, token)
}

// Helper function to create JWT token for specific user
fn create_token_for_user(user_id: i32, email: &str, role: &str) -> String {
    use jsonwebtoken::{encode, Header, EncodingKey};
    use lunarbase::utils::Claims;
    use std::time::{SystemTime, UNIX_EPOCH};

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
    encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret.as_ref()))
        .expect("Failed to create test token")
}


#[tokio::test]
async fn test_websocket_connection_stats() {
    let app = create_test_router();

    // Get initial WebSocket stats
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/status")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    assert!(json_response["success"].as_bool().unwrap());
    assert_eq!(json_response["data"]["connections"].as_u64().unwrap(), 0);
    assert_eq!(json_response["data"]["subscriptions"].as_u64().unwrap(), 0);
    assert_eq!(json_response["data"]["status"].as_str().unwrap(), "operational");
}

#[tokio::test]
async fn test_websocket_admin_stats_requires_auth() {
    let app = create_test_router();

    // Try to access admin stats without authentication
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/stats")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_websocket_admin_stats_with_auth() {
    let app = create_test_router();

    // Use the same approach as permissions tests - create token for existing admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Access admin WebSocket stats
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/stats")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    assert!(json_response["success"].as_bool().unwrap());
    assert!(json_response["data"]["total_connections"].is_number());
    assert!(json_response["data"]["authenticated_connections"].is_number());
    assert!(json_response["data"]["total_subscriptions"].is_number());
    assert!(json_response["data"]["subscriptions_by_collection"].is_object());
}

#[tokio::test]
async fn test_websocket_models_serialization() {
    use lunarbase::models::{
        WebSocketMessage, SubscriptionRequest, SubscriptionType
    };

    // Test WebSocket message serialization
    let subscription_request = SubscriptionRequest {
        subscription_id: "test-sub-1".to_string(),
        collection_name: "test_collection".to_string(),
        subscription_type: SubscriptionType::Collection,
        filters: None,
    };

    let message = WebSocketMessage::Subscribe(subscription_request);
    let serialized = serde_json::to_string(&message).unwrap();
    let deserialized: WebSocketMessage = serde_json::from_str(&serialized).unwrap();

    match deserialized {
        WebSocketMessage::Subscribe(req) => {
            assert_eq!(req.subscription_id, "test-sub-1");
            assert_eq!(req.collection_name, "test_collection");
        }
        _ => panic!("Expected Subscribe message"),
    }
}

#[tokio::test]
async fn test_record_event_creation() {
    use lunarbase::models::{RecordEvent, PendingEvent};
    use serde_json::json;

    // Test record event creation
    let event = RecordEvent::Created {
        record_id: "123".to_string(),
        record: json!({"title": "Test Record", "content": "Test content"}),
    };

    let pending_event = PendingEvent {
        collection_name: "test_collection".to_string(),
        event,
        user_id: Some(1),
    };

    // Test serialization
    match &pending_event.event {
        RecordEvent::Created { record_id, record } => {
            assert_eq!(record_id, "123");
            assert_eq!(record["title"].as_str().unwrap(), "Test Record");
        }
        _ => panic!("Expected Created event"),
    }
}

#[tokio::test] 
async fn test_subscription_data_matching() {
    use lunarbase::models::{
        SubscriptionData, SubscriptionType, PendingEvent, RecordEvent
    };
    use serde_json::json;

    // Create subscription for a specific collection
    let subscription = SubscriptionData::new(
        "articles".to_string(),
        SubscriptionType::Collection,
        None,
        Some(1),
    );

    // Create matching event
    let matching_event = PendingEvent {
        collection_name: "articles".to_string(),
        event: RecordEvent::Created {
            record_id: "1".to_string(),
            record: json!({"title": "New Article"}),
        },
        user_id: Some(1),
    };

    // Create non-matching event
    let non_matching_event = PendingEvent {
        collection_name: "users".to_string(),
        event: RecordEvent::Created {
            record_id: "2".to_string(),
            record: json!({"name": "John Doe"}),
        },
        user_id: Some(1),
    };

    assert!(subscription.matches_event(&matching_event));
    assert!(!subscription.matches_event(&non_matching_event));
}

#[tokio::test]
async fn test_record_specific_subscription() {
    use lunarbase::models::{
        SubscriptionData, SubscriptionType, PendingEvent, RecordEvent
    };
    use serde_json::json;

    // Create subscription for a specific record
    let subscription = SubscriptionData::new(
        "articles".to_string(),
        SubscriptionType::Record { record_id: "123".to_string() },
        None,
        Some(1),
    );

    // Create matching event for the specific record
    let matching_event = PendingEvent {
        collection_name: "articles".to_string(),
        event: RecordEvent::Updated {
            record_id: "123".to_string(),
            record: json!({"title": "Updated Article"}),
            old_record: None,
        },
        user_id: Some(1),
    };

    // Create non-matching event for different record
    let non_matching_event = PendingEvent {
        collection_name: "articles".to_string(),
        event: RecordEvent::Updated {
            record_id: "456".to_string(),
            record: json!({"title": "Other Article"}),
            old_record: None,
        },
        user_id: Some(1),
    };

    assert!(subscription.matches_event(&matching_event));
    assert!(!subscription.matches_event(&non_matching_event));
}