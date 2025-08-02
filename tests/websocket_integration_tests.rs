use axum::{
    Router,
    http::StatusCode,
    routing::{get, post, delete},
};
use serde_json::json;
use tower::ServiceExt;
use uuid;

use axum::middleware;
use lunarbase::database::create_pool;
use lunarbase::handlers::collections::*;
use lunarbase::handlers::websocket::*;
use lunarbase::handlers::{health_check, login, me, refresh_token, register};
use lunarbase::middleware::auth_middleware;
use lunarbase::{AppState, Config};

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
        .route("/ws/connections", get(get_connections))
        .route("/ws/connections/{connection_id}", delete(disconnect_connection))
        .route("/ws/broadcast", post(broadcast_message))
        .route("/ws/activity", get(get_activity))
        .layer(middleware::from_fn_with_state(
            app_state.auth_state.clone(),
            auth_middleware,
        ));

    // Combine routes
    let api_routes = Router::new().merge(public_routes).merge(protected_routes);

    let router = Router::new().nest("/api", api_routes).with_state(app_state);

    // Skip middleware in tests to avoid Prometheus global recorder conflicts
    router
}

// Helper function to create admin JWT token for testing
async fn create_admin_token(app: &Router) -> (i32, String) {
    create_test_user(app, "admin").await
}

// Helper function to create test user and return (user_id, token)
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
    let user: lunarbase::models::User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(lunarbase::models::User::as_select())
        .first(&mut conn)
        .expect("Failed to fetch inserted user");

    let user_id = user.id;
    let token = create_token_for_user(user_id, &unique_email, role);
    (user_id, token)
}

// Helper function to create JWT token for specific user
fn create_token_for_user(user_id: i32, email: &str, role: &str) -> String {
    use jsonwebtoken::{EncodingKey, Header, encode};
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
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_ref()),
    )
    .expect("Failed to create test token")
}

#[tokio::test]
async fn test_websocket_connection_stats() {
    let app = create_test_router().await;

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

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert_eq!(json_response["data"]["connections"].as_u64().unwrap(), 0);
    assert_eq!(json_response["data"]["subscriptions"].as_u64().unwrap(), 0);
    assert_eq!(
        json_response["data"]["status"].as_str().unwrap(),
        "operational"
    );
}

#[tokio::test]
async fn test_websocket_admin_stats_requires_auth() {
    let app = create_test_router().await;

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
    let app = create_test_router().await;

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

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert!(json_response["data"]["total_connections"].is_number());
    assert!(json_response["data"]["authenticated_connections"].is_number());
    assert!(json_response["data"]["total_subscriptions"].is_number());
    assert!(json_response["data"]["subscriptions_by_collection"].is_object());
}

#[tokio::test]
async fn test_websocket_models_serialization() {
    use lunarbase::models::{SubscriptionRequest, SubscriptionType, WebSocketMessage};

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
    use lunarbase::models::{PendingEvent, RecordEvent};
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
    use lunarbase::models::{PendingEvent, RecordEvent, SubscriptionData, SubscriptionType};
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

// Tests for new admin WebSocket endpoints

#[tokio::test]
async fn test_get_connections_requires_admin() {
    let app = create_test_router().await;

    // Create regular user
    let (_user_id, user_token) = create_test_user(&app, "user").await;

    // Try to access connections with regular user
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/connections")
                .header("Authorization", format!("Bearer {}", user_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_get_connections_with_admin() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Access connections with admin
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/connections")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert!(json_response["success"].as_bool().unwrap());
    assert!(json_response["data"]["connections"].is_array());
    assert!(json_response["data"]["total_count"].is_number());
}

#[tokio::test]
async fn test_disconnect_connection_requires_admin() {
    let app = create_test_router().await;

    // Create regular user
    let (_user_id, user_token) = create_test_user(&app, "user").await;

    // Try to disconnect connection with regular user
    let fake_connection_id = uuid::Uuid::new_v4().to_string();
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri(&format!("/api/ws/connections/{}", fake_connection_id))
                .method("DELETE")
                .header("Authorization", format!("Bearer {}", user_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_disconnect_nonexistent_connection() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Try to disconnect non-existent connection
    let fake_connection_id = uuid::Uuid::new_v4().to_string();
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri(&format!("/api/ws/connections/{}", fake_connection_id))
                .method("DELETE")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_disconnect_connection_invalid_uuid() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Try to disconnect with invalid UUID
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/connections/invalid-uuid")
                .method("DELETE")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_broadcast_message_requires_admin() {
    let app = create_test_router().await;

    // Create regular user
    let (_user_id, user_token) = create_test_user(&app, "user").await;

    let broadcast_payload = json!({
        "message": "Test broadcast message",
        "target_users": null,
        "target_collections": null
    });

    // Try to broadcast with regular user
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/broadcast")
                .method("POST")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", user_token))
                .body(axum::body::Body::from(broadcast_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_broadcast_message_with_admin() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    let broadcast_payload = json!({
        "message": "Test admin broadcast",
        "target_users": null,
        "target_collections": null
    });

    // Broadcast with admin
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/broadcast")
                .method("POST")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::from(broadcast_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert_eq!(json_response["data"]["message"].as_str().unwrap(), "Test admin broadcast");
    assert!(json_response["data"]["sent_to_connections"].is_number());
}

#[tokio::test]
async fn test_broadcast_message_with_target_users() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    let broadcast_payload = json!({
        "message": "Targeted broadcast",
        "target_users": [1, 2, 3],
        "target_collections": null
    });

    // Broadcast with specific user targets
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/broadcast")
                .method("POST")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::from(broadcast_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert_eq!(json_response["data"]["message"].as_str().unwrap(), "Targeted broadcast");
}

#[tokio::test]
async fn test_broadcast_message_with_target_collections() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    let broadcast_payload = json!({
        "message": "Collection broadcast",
        "target_users": null,
        "target_collections": ["articles", "users"]
    });

    // Broadcast with specific collection targets
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/broadcast")
                .method("POST")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::from(broadcast_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert_eq!(json_response["data"]["message"].as_str().unwrap(), "Collection broadcast");
}

#[tokio::test]
async fn test_get_activity_requires_admin() {
    let app = create_test_router().await;

    // Create regular user
    let (_user_id, user_token) = create_test_user(&app, "user").await;

    // Try to access activity with regular user
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/activity")
                .header("Authorization", format!("Bearer {}", user_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_get_activity_with_admin() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Access activity with admin
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/activity")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert!(json_response["data"]["activities"].is_array());
    assert!(json_response["data"]["total_count"].is_number());
}

#[tokio::test]
async fn test_get_activity_with_pagination() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Access activity with pagination parameters
    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/activity?limit=10&offset=5")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_response: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json_response["success"].as_bool().unwrap());
    assert!(json_response["data"]["activities"].is_array());
    assert!(json_response["data"]["total_count"].is_number());
}

#[tokio::test]
async fn test_broadcast_request_validation() {
    let app = create_test_router().await;

    // Create admin user
    let (_user_id, admin_token) = create_admin_token(&app).await;

    // Test with empty message
    let broadcast_payload = json!({
        "message": "",
        "target_users": null,
        "target_collections": null
    });

    let response = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/api/ws/broadcast")
                .method("POST")
                .header("content-type", "application/json")
                .header("Authorization", format!("Bearer {}", admin_token))
                .body(axum::body::Body::from(broadcast_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Should still work with empty message (validation depends on implementation)
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_websocket_admin_endpoints_unauthorized() {
    let app = create_test_router().await;

    // Test all admin endpoints without authentication
    let endpoints = vec![
        ("/api/ws/connections", "GET"),
        ("/api/ws/broadcast", "POST"),
        ("/api/ws/activity", "GET"),
    ];

    for (endpoint, method) in endpoints {
        let mut request_builder = axum::http::Request::builder().uri(endpoint);
        
        if method == "POST" {
            request_builder = request_builder
                .method("POST")
                .header("content-type", "application/json");
        }

        let body = if method == "POST" {
            axum::body::Body::from(json!({"message": "test"}).to_string())
        } else {
            axum::body::Body::empty()
        };

        let response = app
            .clone()
            .oneshot(request_builder.body(body).unwrap())
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Endpoint {} should require authentication",
            endpoint
        );
    }
}

#[tokio::test]
async fn test_record_specific_subscription() {
    use lunarbase::models::{PendingEvent, RecordEvent, SubscriptionData, SubscriptionType};
    use serde_json::json;

    // Create subscription for a specific record
    let subscription = SubscriptionData::new(
        "articles".to_string(),
        SubscriptionType::Record {
            record_id: "123".to_string(),
        },
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
