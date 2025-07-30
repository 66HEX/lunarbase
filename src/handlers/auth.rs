use axum::{
    Extension,
    extract::{ConnectInfo, FromRequest, Request, State, Query},
    http::{HeaderMap, StatusCode},
    response::{Json, Redirect},
};
use std::net::SocketAddr;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use utoipa::ToSchema;

use crate::{
    AppState,
    middleware::extract_user_claims,
    models::{
        AuthResponse, LoginRequest, LogoutRequest, LogoutResponse, NewUser, RegisterRequest, User,
    },
    schema::users,
    utils::{client_ip::extract_client_ip, ApiResponse, AuthError, Claims, CookieService, ErrorResponse},
};

/// Register a new user
/// 
/// **Note**: Authentication tokens are provided via httpOnly cookies, not in the JSON response.
/// The access_token and refresh_token fields in the response will be empty strings for security.
#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "Authentication",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "User registered successfully - tokens provided via httpOnly cookies", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 409, description = "User already exists", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn register(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<(StatusCode, HeaderMap, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Extract client IP for rate limiting
    let connect_info = request.extensions().get::<ConnectInfo<SocketAddr>>().copied();
    let client_ip = extract_client_ip(request.headers(), connect_info);
    let rate_limit_key = format!("register:{}", client_ip);
    
    // Rate limiting check
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit(&rate_limit_key)
    {
        return Err(AuthError::RateLimitExceeded);
    }
    
    // Extract JSON payload from request
    let Json(payload): Json<RegisterRequest> = Json::from_request(request, &app_state).await
        .map_err(|_| AuthError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    // Validate request payload
    payload.validate().map_err(AuthError::ValidationError)?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Check if user already exists (timing attack protection)
    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    if existing_user.is_some() {
        // Add artificial delay to prevent timing attacks
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(AuthError::ValidationError(vec![
            "Email already registered".to_string(),
        ]));
    }

    // Check username availability (timing attack protection)
    let existing_username = users::table
        .filter(users::username.eq(&payload.username))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    if existing_username.is_some() {
        // Add artificial delay to prevent timing attacks
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(AuthError::ValidationError(vec![
            "Username already taken".to_string(),
        ]));
    }

    // Create new user with secure password hashing
    let new_user = NewUser::new(payload.email, &payload.password, payload.username, &app_state.password_pepper)
        .map_err(|_| AuthError::InternalError)?;

    // Insert user into database
    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    // Get the inserted user
    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .first(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    // Generate tokens
    let access_token =
        app_state
            .auth_state
            .jwt_service
            .generate_access_token(user.id, &user.email, &user.role)?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)?;

    // Set tokens as httpOnly cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    // Return user data without tokens (tokens are now in cookies)
    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(), // Empty for security
        refresh_token: String::new(), // Empty for security
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((
        StatusCode::CREATED,
        headers,
        Json(ApiResponse::success(auth_response)),
    ))
}

// OAuth DTOs
#[derive(Debug, Deserialize, ToSchema)]
pub struct OAuthCallbackQuery {
    #[schema(example = "authorization_code_here")]
    pub code: Option<String>,
    #[schema(example = "csrf_state_token")]
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OAuthAuthorizationResponse {
    #[schema(example = "https://accounts.google.com/o/oauth2/v2/auth?...")]
    pub authorization_url: String,
    #[schema(example = "csrf_state_token")]
    pub state: String,
}

/// Initiate OAuth authorization
/// 
/// Redirects the user to the OAuth provider's authorization page.
#[utoipa::path(
    get,
    path = "/auth/oauth/{provider}",
    tag = "Authentication",
    params(
        ("provider" = String, Path, description = "OAuth provider (google or github)", example = "google")
    ),
    responses(
        (status = 302, description = "Redirect to OAuth provider"),
        (status = 400, description = "Invalid provider or configuration error", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn oauth_authorize(
    State(app_state): State<AppState>,
    axum::extract::Path(provider): axum::extract::Path<String>,
) -> Result<Redirect, AuthError> {
    let oauth_service = &app_state.oauth_service;

    // Get authorization URL
    let (auth_url, _state) = oauth_service
        .get_authorization_url(&provider)
        .map_err(|_| AuthError::ValidationError(vec!["Invalid OAuth provider or configuration".to_string()]))?;

    Ok(Redirect::temporary(&auth_url))
}

/// Handle OAuth callback
/// 
/// Processes the OAuth callback from the provider and creates/logs in the user.
#[utoipa::path(
    get,
    path = "/auth/oauth/{provider}/callback",
    tag = "Authentication",
    params(
        ("provider" = String, Path, description = "OAuth provider (google or github)", example = "google")
    ),
    responses(
        (status = 302, description = "Redirect to frontend with success"),
        (status = 400, description = "OAuth error or validation error", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn oauth_callback(
    State(app_state): State<AppState>,
    axum::extract::Path(provider): axum::extract::Path<String>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<(HeaderMap, Redirect), AuthError> {

    
    // Check for OAuth errors
    if let Some(error) = query.error {
        let error_msg = query.error_description.unwrap_or(error);
        return Ok((
            HeaderMap::new(),
            Redirect::temporary(&format!("http://localhost:3000/admin/auth/error?message={}", 
                urlencoding::encode(&error_msg))),
        ));
    }

    let oauth_service = &app_state.oauth_service;

    // Check for required parameters
    let code = query.code.ok_or_else(|| {
        AuthError::ValidationError(vec!["Missing authorization code".to_string()])
    })?;
    
    let state = query.state.ok_or_else(|| {
        AuthError::ValidationError(vec!["Missing state parameter".to_string()])
    })?;

    // Exchange code for access token
    let access_token = oauth_service
        .exchange_code_for_token(&provider, &code, &state)
        .await
        .map_err(|e| {
            AuthError::ValidationError(vec![format!("Failed to exchange OAuth code: {}", e)])
        })?;

    // Get user info from OAuth provider
    let oauth_user = oauth_service
        .get_user_info(&provider, &access_token)
        .await
        .map_err(|_| AuthError::ValidationError(vec!["Failed to get user info from OAuth provider".to_string()]))?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Check if user exists by email
    let existing_user = users::table
        .filter(users::email.eq(&oauth_user.email))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    let user = if let Some(mut user) = existing_user {
         // Update last login time
         let update_user = crate::models::user::UpdateUser {
             email: None,
             password_hash: None,
             username: None,
             is_verified: None,
             is_active: None,
             role: None,
             failed_login_attempts: None,
             locked_until: None,
             last_login_at: Some(Some(chrono::Utc::now().naive_utc())),
         };
         
         diesel::update(users::table.find(user.id))
             .set(&update_user)
             .execute(&mut conn)
             .map_err(|_| AuthError::DatabaseError)?;
         
         // Refresh user data
         user.last_login_at = Some(chrono::Utc::now().naive_utc());
         user
    } else {
        // Create new user from OAuth info
        let username = oauth_user.name
            .unwrap_or_else(|| format!("{}_{}", provider, &oauth_user.id[..8]));
        
        // Generate a random password since OAuth users don't need one
        let random_password = uuid::Uuid::new_v4().to_string();
        
        let new_user = NewUser::new(
            oauth_user.email.clone(),
            &random_password,
            username,
            &app_state.password_pepper,
        ).map_err(|e| AuthError::ValidationError(vec![e]))?;

        diesel::insert_into(users::table)
            .values(&new_user)
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        // Get the created user
        users::table
            .filter(users::email.eq(&oauth_user.email))
            .first(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?
    };

    // Generate JWT tokens
    let jwt_access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .map_err(|_| AuthError::InternalError)?;

    let jwt_refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .map_err(|_| AuthError::InternalError)?;

    // Set tokens as httpOnly cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &jwt_access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &jwt_refresh_token);

    // Redirect to frontend success page
    Ok((
        headers,
        Redirect::temporary("http://localhost:3000/admin/auth/success"),
    ))
}

/// Logout endpoint - blacklists tokens
#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Authentication",
    request_body = LogoutRequest,
    responses(
        (status = 200, description = "Logout successful", body = ApiResponse<LogoutResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn logout(
    State(app_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    request: Request,
) -> Result<(HeaderMap, Json<ApiResponse<LogoutResponse>>), AuthError> {
    // Get the current access token from the JWT ID in claims
    // Since we have the claims, we can blacklist using the JTI
    let expires_at = crate::utils::jwt_service::JwtService::timestamp_to_naive_datetime(claims.exp);
    let user_id: i32 = claims.sub.parse().map_err(|_| AuthError::InternalError)?;
    
    app_state
        .auth_state
        .jwt_service
        .blacklist_token_by_jti(&claims.jti, user_id, "access", expires_at, Some("User logout".to_string()))
        .map_err(|_| AuthError::InternalError)?;

    // Try to get refresh token from cookie and blacklist it
    if let Some(refresh_token) = CookieService::extract_refresh_token(request.headers()) {
        app_state
            .auth_state
            .jwt_service
            .blacklist_refresh_token(&refresh_token, Some("User logout".to_string()))
            .map_err(|_| AuthError::InternalError)?;
    }

    // Clear cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.clear_all_tokens(&mut headers);

    let logout_response = LogoutResponse {
        message: "Successfully logged out".to_string(),
    };

    Ok((headers, Json(ApiResponse::success(logout_response))))
}

/// User login endpoint with timing attack protection and account lockout
/// 
/// **Note**: Authentication tokens are provided via httpOnly cookies, not in the JSON response.
/// The access_token and refresh_token fields in the response will be empty strings for security.
#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Authentication",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful - tokens provided via httpOnly cookies", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Invalid credentials", body = ErrorResponse),
        (status = 423, description = "Account locked", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn login(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<(HeaderMap, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Extract client IP for rate limiting
    let connect_info = request.extensions().get::<ConnectInfo<SocketAddr>>().copied();
    let client_ip = extract_client_ip(request.headers(), connect_info);
    let rate_limit_key = format!("login:{}", client_ip);
    
    // Rate limiting check
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit(&rate_limit_key)
    {
        return Err(AuthError::RateLimitExceeded);
    }
    
    // Extract JSON payload from request
    let Json(payload): Json<LoginRequest> = Json::from_request(request, &app_state).await
        .map_err(|_| AuthError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    // Validate request payload
    payload.validate().map_err(AuthError::ValidationError)?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Add base delay for timing attack protection
    let base_delay = Duration::from_millis(100);
    let start_time = std::time::Instant::now();

    // Find user by email
    let user = users::table
        .filter(users::email.eq(&payload.email))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    let user = match user {
        Some(user) => user,
        None => {
            // Ensure minimum delay to prevent timing attacks
            let elapsed = start_time.elapsed();
            if elapsed < base_delay {
                tokio::time::sleep(base_delay - elapsed).await;
            }
            return Err(AuthError::InvalidCredentials);
        }
    };

    // Check if account is locked
    if user.is_locked() {
        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }
        return Err(AuthError::AccountLocked);
    }

    // Check if account is verified (if verification is enabled)
    if !user.is_verified {
        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }
        return Err(AuthError::AccountNotVerified);
    }

    // Verify password
    let password_valid = user
        .verify_password(&payload.password, &app_state.password_pepper)
        .map_err(|_| AuthError::InternalError)?;

    if !password_valid {
        // Increment failed login attempts
        let new_attempts = user.failed_login_attempts + 1;
        let locked_until = if new_attempts >= 5 {
            Some(chrono::Utc::now().naive_utc() + chrono::Duration::hours(1))
        } else {
            None
        };

        diesel::update(users::table.find(user.id))
            .set((
                users::failed_login_attempts.eq(new_attempts),
                users::locked_until.eq(locked_until),
            ))
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        // Ensure minimum delay to prevent timing attacks
        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }

        return Err(AuthError::InvalidCredentials);
    }

    // Reset failed login attempts on successful login
    diesel::update(users::table.find(user.id))
        .set((
            users::failed_login_attempts.eq(0),
            users::locked_until.eq(None::<chrono::NaiveDateTime>),
            users::last_login_at.eq(Some(chrono::Utc::now().naive_utc())),
        ))
        .execute(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    // Generate tokens
    let access_token =
        app_state
            .auth_state
            .jwt_service
            .generate_access_token(user.id, &user.email, &user.role)?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)?;

    // Set tokens as httpOnly cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    // Ensure minimum delay to prevent timing attacks
    let elapsed = start_time.elapsed();
    if elapsed < base_delay {
        tokio::time::sleep(base_delay - elapsed).await;
    }

    // Return user data without tokens (tokens are now in cookies)
    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(), // Empty for security
        refresh_token: String::new(), // Empty for security
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((headers, Json(ApiResponse::success(auth_response))))
}

/// Refresh token endpoint
/// 
/// **Note**: Refresh token is read from httpOnly cookies, and new tokens are provided via httpOnly cookies.
/// The access_token and refresh_token fields in the response will be empty strings for security.
#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "Authentication",
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Token refreshed successfully - new tokens provided via httpOnly cookies", body = ApiResponse<AuthResponse>),
        (status = 401, description = "Invalid refresh token", body = ErrorResponse)
    )
)]
pub async fn refresh_token(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<(HeaderMap, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Extract refresh token from cookie
    let refresh_token = CookieService::extract_refresh_token(request.headers())
        .ok_or(AuthError::TokenInvalid)?;

    // Validate refresh token
    let refresh_claims = app_state
        .auth_state
        .jwt_service
        .validate_refresh_token(&refresh_token)?;

    let user_id: i32 = refresh_claims
        .sub
        .parse()
        .map_err(|_| AuthError::TokenInvalid)?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Find user in database
    let user = users::table
        .find(user_id)
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::TokenInvalid)?;

    // Check if user is still active
    if !user.is_active {
        return Err(AuthError::TokenInvalid);
    }

    // Generate new tokens
    let access_token =
        app_state
            .auth_state
            .jwt_service
            .generate_access_token(user.id, &user.email, &user.role)?;

    let new_refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)?;

    // Set new tokens as httpOnly cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &new_refresh_token);

    // Return user data without tokens (tokens are now in cookies)
    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(), // Empty for security
        refresh_token: String::new(), // Empty for security
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((headers, Json(ApiResponse::success(auth_response))))
}

/// Get current user profile (protected endpoint)
#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "Authentication",
    responses(
        (status = 200, description = "User profile retrieved successfully", body = ApiResponse<serde_json::Value>),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn me(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Extract user claims from request (set by auth middleware)
    let claims = extract_user_claims(&request)?;

    let user_id: i32 = claims.sub.parse().map_err(|_| AuthError::TokenInvalid)?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Find user in database
    let user = users::table
        .find(user_id)
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    Ok(Json(ApiResponse::success(
        serde_json::to_value(user.to_response()).unwrap(),
    )))
}

/// Admin registration endpoint - allows creating first admin or additional admins
/// 
/// **Note**: Authentication tokens are provided via httpOnly cookies, not in the JSON response.
/// The access_token and refresh_token fields in the response will be empty strings for security.
#[utoipa::path(
    post,
    path = "/auth/register-admin",
    tag = "Authentication",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "Admin registered successfully - tokens provided via httpOnly cookies", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 409, description = "Admin already exists", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn register_admin(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<(StatusCode, HeaderMap, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Extract client IP for rate limiting
    let connect_info = request.extensions().get::<ConnectInfo<SocketAddr>>().copied();
    let client_ip = extract_client_ip(request.headers(), connect_info);
    let rate_limit_key = format!("register_admin:{}", client_ip);
    
    // Rate limiting check
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit(&rate_limit_key)
    {
        return Err(AuthError::RateLimitExceeded);
    }
    
    // Extract JSON payload from request
    let Json(payload): Json<RegisterRequest> = Json::from_request(request, &app_state).await
        .map_err(|_| AuthError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    // Validate request payload
    payload.validate().map_err(AuthError::ValidationError)?;

    // Get database connection
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| AuthError::DatabaseError)?;

    // Check if any admin exists
    let existing_admin = users::table
        .filter(users::role.eq("admin"))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    // If admin exists, deny registration (only first admin can be created this way)
    if existing_admin.is_some() {
        return Err(AuthError::ValidationError(vec![
            "Admin already exists. Additional admins must be created by existing admins through the admin panel.".to_string()
        ]));
    }

    // Check if user already exists (timing attack protection)
    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    if existing_user.is_some() {
        // Add artificial delay to prevent timing attacks
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(AuthError::ValidationError(vec![
            "Email already registered".to_string(),
        ]));
    }

    // Check username availability (timing attack protection)
    let existing_username = users::table
        .filter(users::username.eq(&payload.username))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    if existing_username.is_some() {
        // Add artificial delay to prevent timing attacks
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(AuthError::ValidationError(vec![
            "Username already taken".to_string(),
        ]));
    }

    // Create new admin user
    let new_user = NewUser::new_with_role(
        payload.email,
        &payload.password,
        payload.username,
        "admin".to_string(),
        &app_state.password_pepper,
    )
    .map_err(|_| AuthError::InternalError)?;

    // Insert user into database
    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    // Get the inserted user
    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .first(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    // Generate tokens
    let access_token =
        app_state
            .auth_state
            .jwt_service
            .generate_access_token(user.id, &user.email, &user.role)?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)?;

    // Set tokens as httpOnly cookies
    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    // Return user data without tokens (tokens are now in cookies)
    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(), // Empty for security
        refresh_token: String::new(), // Empty for security
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((
        StatusCode::CREATED,
        headers,
        Json(ApiResponse::success(auth_response)),
    ))
}
