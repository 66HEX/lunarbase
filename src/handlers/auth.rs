use axum::{
    Extension,
    extract::{Request, State},
    http::StatusCode,
    response::Json,
};
use diesel::prelude::*;
use serde_json::Value;
use std::time::Duration;

use crate::{
    AppState,
    middleware::extract_user_claims,
    models::{
        AuthResponse, LoginRequest, LogoutRequest, LogoutResponse, NewUser, RegisterRequest, User,
    },
    schema::users,
    utils::{ApiResponse, AuthError, Claims, ErrorResponse},
};

/// Register a new user
#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "Authentication",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "User registered successfully", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 409, description = "User already exists", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn register(
    State(app_state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Rate limiting check
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit("register")
    {
        return Err(AuthError::RateLimitExceeded);
    }

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
    let new_user = NewUser::new(payload.email, &payload.password, payload.username)
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

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token,
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(auth_response)),
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
    Json(payload): Json<LogoutRequest>,
) -> Result<Json<ApiResponse<LogoutResponse>>, AuthError> {
    // Get the current access token from the JWT ID in claims
    // Since we have the claims, we can blacklist using the JTI
    app_state
        .auth_state
        .jwt_service
        .blacklist_token(&claims.jti, "access", Some("User logout".to_string()))
        .map_err(|_| AuthError::InternalError)?;

    // If refresh token is provided, blacklist it too
    if let Some(ref refresh_token) = payload.refresh_token {
        app_state
            .auth_state
            .jwt_service
            .blacklist_refresh_token(&refresh_token, Some("User logout".to_string()))
            .map_err(|_| AuthError::InternalError)?;
    }

    let logout_response = LogoutResponse {
        message: "Successfully logged out".to_string(),
    };

    Ok(Json(ApiResponse::success(logout_response)))
}

/// User login endpoint with timing attack protection and account lockout
#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Authentication",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 401, description = "Invalid credentials", body = ErrorResponse),
        (status = 423, description = "Account locked", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn login(
    State(app_state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AuthError> {
    // Rate limiting check
    let client_ip = "login"; // In production, get real IP
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit(client_ip)
    {
        return Err(AuthError::RateLimitExceeded);
    }

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
        .verify_password(&payload.password)
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

    // Ensure minimum delay to prevent timing attacks
    let elapsed = start_time.elapsed();
    if elapsed < base_delay {
        tokio::time::sleep(base_delay - elapsed).await;
    }

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token,
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok(Json(ApiResponse::success(auth_response)))
}

/// Refresh token endpoint
#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "Authentication",
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Token refreshed successfully", body = ApiResponse<AuthResponse>),
        (status = 401, description = "Invalid refresh token", body = ErrorResponse)
    )
)]
pub async fn refresh_token(
    State(app_state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<AuthResponse>>, AuthError> {
    // Extract refresh token from payload
    let refresh_token = payload
        .get("refresh_token")
        .and_then(|t| t.as_str())
        .ok_or(AuthError::TokenInvalid)?;

    // Validate refresh token
    let refresh_claims = app_state
        .auth_state
        .jwt_service
        .validate_refresh_token(refresh_token)?;

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

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token: new_refresh_token,
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok(Json(ApiResponse::success(auth_response)))
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
#[utoipa::path(
    post,
    path = "/auth/register-admin",
    tag = "Authentication",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "Admin registered successfully", body = ApiResponse<AuthResponse>),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 409, description = "Admin already exists", body = ErrorResponse),
        (status = 429, description = "Rate limit exceeded", body = ErrorResponse)
    )
)]
pub async fn register_admin(
    State(app_state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<ApiResponse<AuthResponse>>), AuthError> {
    // Rate limiting check
    if !app_state
        .auth_state
        .rate_limiter
        .check_rate_limit("register_admin")
    {
        return Err(AuthError::RateLimitExceeded);
    }

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

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token,
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds(),
    };

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(auth_response)),
    ))
}
