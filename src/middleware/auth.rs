use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::utils::{AuthError, Claims, CookieService, JwtService};
use diesel::SqliteConnection;
use diesel::r2d2::{ConnectionManager, Pool};

/// Rate limiting storage (in production, use Redis)
#[derive(Clone)]
pub struct RateLimiter {
    requests: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_seconds: u64) -> Self {
        Self {
            requests: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_seconds),
        }
    }

    pub fn check_rate_limit(&self, identifier: &str) -> bool {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();

        // Clean old requests
        let window_start = now - self.window;

        let user_requests = requests
            .entry(identifier.to_string())
            .or_insert_with(Vec::new);
        user_requests.retain(|&timestamp| timestamp > window_start);

        if user_requests.len() >= self.max_requests {
            false
        } else {
            user_requests.push(now);
            true
        }
    }
}

/// Auth middleware state
#[derive(Clone)]
pub struct AuthState {
    pub jwt_service: Arc<JwtService>,
    pub rate_limiter: RateLimiter,
}

impl AuthState {
    pub fn new(jwt_secret: &str, pool: Pool<ConnectionManager<SqliteConnection>>) -> Self {
        Self {
            jwt_service: Arc::new(JwtService::new(jwt_secret, pool)),
            rate_limiter: RateLimiter::new(1000, 300), // 1000 requests per 5 minutes
        }
    }
}

/// Helper to extract user claims from request extensions
pub fn extract_user_claims(request: &Request) -> Result<Claims, AuthError> {
    request
        .extensions()
        .get::<Claims>()
        .ok_or(AuthError::TokenInvalid)
        .map(|claims| claims.clone())
}

/// Authentication middleware
pub async fn auth_middleware(
    State(auth_state): State<AuthState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AuthError> {
    // Debug: log all headers
    tracing::debug!("Request headers: {:?}", request.headers());
    
    // Try to get token from cookie first, then fallback to Authorization header
    let token = if let Some(cookie_token) = CookieService::extract_access_token(request.headers()) {
        tracing::debug!("Found token in cookie: {}", &cookie_token[..std::cmp::min(10, cookie_token.len())]);
        cookie_token
    } else if let Some(auth_header) = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
    {
        tracing::debug!("Found token in Authorization header");
        // Extract token from header (fallback for compatibility)
        JwtService::extract_token_from_header(auth_header)?.to_string()
    } else {
        tracing::debug!("No token found in cookies or Authorization header");
        return Err(AuthError::TokenInvalid);
    };

    // Rate limiting check
    let client_ip = request
        .headers()
        .get("x-forwarded-for")
        .or_else(|| request.headers().get("x-real-ip"))
        .and_then(|header| header.to_str().ok())
        .unwrap_or("unknown");

    if !auth_state.rate_limiter.check_rate_limit(client_ip) {
        return Err(AuthError::RateLimitExceeded);
    }

    // Validate token with blacklist and user verification check
    let claims = auth_state
        .jwt_service
        .validate_access_token_with_verification(&token)?;

    // Inject claims into request extensions for downstream handlers
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

/// Optional authentication middleware (doesn't fail if no token)
pub async fn optional_auth_middleware(
    State(auth_state): State<AuthState>,
    mut request: Request,
    next: Next,
) -> Response {
    // Try to get token from cookie first, then fallback to Authorization header
    let token = if let Some(cookie_token) = CookieService::extract_access_token(request.headers()) {
        Some(cookie_token)
    } else if let Some(auth_header) = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
    {
        // Try to extract token from header (fallback for compatibility)
        JwtService::extract_token_from_header(auth_header).ok().map(|s| s.to_string())
    } else {
        None
    };

    // Try to validate token if we have one
    if let Some(token) = token {
        if let Ok(claims) = auth_state
            .jwt_service
            .validate_access_token_with_blacklist(&token)
        {
            request.extensions_mut().insert(claims);
        }
    }

    next.run(request).await
}

/// Check if user has required role
pub fn check_user_role(claims: &Claims, required_role: &str) -> bool {
    claims.role == required_role || claims.role == "admin"
}
