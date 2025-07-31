use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    routing::get,
};
use tower::ServiceExt;


use lunarbase::database::create_pool;
use lunarbase::handlers::auth::*;
use lunarbase::{AppState, Config};

fn create_test_router() -> Router {
    // Use consistent test secret for JWT
    let test_jwt_secret = "test_secret".to_string();

    // Load test config but override JWT secret for consistency
    let config = Config::from_env().expect("Failed to load config");
    let db_pool = create_pool(&config.database_url).expect("Failed to create database pool");
    let test_password_pepper = "test_pepper".to_string();
    let app_state = AppState::new(db_pool, &test_jwt_secret, test_password_pepper, &config).expect("Failed to create AppState");

    // OAuth routes
    let oauth_routes = Router::new()
        .route("/auth/oauth/{provider}", get(oauth_authorize))
        .route("/auth/oauth/{provider}/callback", get(oauth_callback));

    // Combine routes
    let api_routes = Router::new().merge(oauth_routes);

    let router = Router::new().nest("/api", api_routes).with_state(app_state);

    router
}

#[tokio::test]
async fn test_github_oauth_authorize_redirect() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/github")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should redirect to GitHub OAuth
    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
    
    let location = response.headers().get("location").unwrap();
    let location_str = location.to_str().unwrap();
    
    // Should redirect to GitHub OAuth URL
    assert!(location_str.contains("github.com/login/oauth/authorize"));
    assert!(location_str.contains("client_id="));
    assert!(location_str.contains("scope=user%3Aemail"));
    assert!(location_str.contains("state="));
}

#[tokio::test]
async fn test_google_oauth_authorize_redirect() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/google")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should redirect to Google OAuth
    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
    
    let location = response.headers().get("location").unwrap();
    let location_str = location.to_str().unwrap();
    
    // Should redirect to Google OAuth URL
    assert!(location_str.contains("accounts.google.com/o/oauth2/v2/auth"));
    assert!(location_str.contains("client_id="));
    assert!(location_str.contains("scope="));
    assert!(location_str.contains("state="));
}

#[tokio::test]
async fn test_oauth_authorize_invalid_provider() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/invalid_provider")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should return bad request for invalid provider
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_oauth_callback_missing_code() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/github/callback?state=test_state")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should return bad request for missing required parameter
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_oauth_callback_missing_state() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/github/callback?code=test_code")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should return bad request for missing required parameter
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_oauth_callback_invalid_provider() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/invalid/callback?code=test_code&state=test_state")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should return bad request for invalid provider
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_oauth_callback_with_error_parameter() {
    let app = create_test_router();
    
    let request = Request::builder()
        .uri("/api/auth/oauth/github/callback?error=access_denied&error_description=User%20denied%20access")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    
    // Should redirect to error page
    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
    
    let location = response.headers().get("location").unwrap();
    let location_str = location.to_str().unwrap();
    
    assert!(location_str.contains("error"));
    assert!(location_str.contains("User%20denied%20access"));
}

#[tokio::test]
async fn test_oauth_state_parameter_security() {
    let app = create_test_router();
    
    // Test GitHub OAuth authorize
    let request = Request::builder()
        .uri("/api/auth/oauth/github")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
    
    let location = response.headers().get("location").unwrap();
    let location_str = location.to_str().unwrap();
    
    // Verify that state parameter is present and looks like a UUID
    assert!(location_str.contains("state="));
    
    // Extract state parameter
    let state_start = location_str.find("state=").unwrap() + 6;
    let state_end = location_str[state_start..].find('&').unwrap_or(location_str[state_start..].len());
    let state = &location_str[state_start..state_start + state_end];
    
    // State should be a base64url encoded string (typically 22 characters for 16 bytes)
    assert_eq!(state.len(), 22);
}

#[tokio::test]
async fn test_oauth_scope_limitation() {
    // Test GitHub scopes
    let github_app = create_test_router();
    let github_request = Request::builder()
        .uri("/api/auth/oauth/github")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let github_response = github_app.oneshot(github_request).await.unwrap();
    let github_location = github_response.headers().get("location").unwrap().to_str().unwrap();
    
    // Should only request user:email scope for GitHub
    assert!(github_location.contains("scope=user%3Aemail"));
    assert!(!github_location.contains("repo"));
    assert!(!github_location.contains("admin"));
    
    // Test Google scopes
    let google_app = create_test_router();
    let google_request = Request::builder()
        .uri("/api/auth/oauth/google")
        .method("GET")
        .body(Body::empty())
        .unwrap();
    
    let google_response = google_app.oneshot(google_request).await.unwrap();
    let google_location = google_response.headers().get("location").unwrap().to_str().unwrap();
    
    // Should only request basic profile and email for Google
    assert!(google_location.contains("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email"));
}

// Note: Testing successful OAuth flow would require mocking external OAuth providers
// or using integration test environment with test OAuth apps.
// The tests above cover the main error cases and redirect logic that can be tested
// without external dependencies.