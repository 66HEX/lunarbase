use axum::{
    extract::{Request, State},
    response::Json,
};
use diesel::prelude::*;
use serde_json::Value;
use std::time::Duration;

use crate::{
    AppState,
    middleware::extract_user_claims,
    models::{LoginRequest, NewUser, RegisterRequest, User, AuthResponse},
    schema::users,
    utils::{AuthError, ApiResponse},
};

/// User registration endpoint with comprehensive validation
pub async fn register(
    State(app_state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AuthError> {
    // Rate limiting check
    if !app_state.auth_state.rate_limiter.check_rate_limit("register") {
        return Err(AuthError::RateLimitExceeded);
    }

    // Validate request payload
    payload.validate().map_err(AuthError::ValidationError)?;

    // Get database connection
    let mut conn = app_state.db_pool.get().map_err(|_| AuthError::DatabaseError)?;

    // Check if user already exists (timing attack protection)
    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| AuthError::DatabaseError)?;

    if existing_user.is_some() {
        // Add artificial delay to prevent timing attacks
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(AuthError::ValidationError(vec!["Email already registered".to_string()]));
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
        return Err(AuthError::ValidationError(vec!["Username already taken".to_string()]));
    }

    // Create new user with secure password hashing
    let new_user = NewUser::new(
        payload.email,
        &payload.password,
        payload.username,
    ).map_err(|_| AuthError::InternalError)?;

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
    let access_token = app_state.auth_state.jwt_service.generate_access_token(
        user.id,
        &user.email,
        &user.role,
    )?;

    let refresh_token = app_state.auth_state.jwt_service.generate_refresh_token(user.id)?;

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token,
        expires_in: app_state.auth_state.jwt_service.access_token_duration_seconds(),
    };

    Ok(Json(ApiResponse::success(auth_response)))
}

/// User login endpoint with timing attack protection and account lockout
pub async fn login(
    State(app_state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, AuthError> {
    // Rate limiting check
    let client_ip = "login"; // In production, get real IP
    if !app_state.auth_state.rate_limiter.check_rate_limit(client_ip) {
        return Err(AuthError::RateLimitExceeded);
    }

    // Validate request payload
    payload.validate().map_err(AuthError::ValidationError)?;

    // Get database connection
    let mut conn = app_state.db_pool.get().map_err(|_| AuthError::DatabaseError)?;

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
    let password_valid = user.verify_password(&payload.password)
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
    let access_token = app_state.auth_state.jwt_service.generate_access_token(
        user.id,
        &user.email,
        &user.role,
    )?;

    let refresh_token = app_state.auth_state.jwt_service.generate_refresh_token(user.id)?;

    // Ensure minimum delay to prevent timing attacks
    let elapsed = start_time.elapsed();
    if elapsed < base_delay {
        tokio::time::sleep(base_delay - elapsed).await;
    }

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token,
        expires_in: app_state.auth_state.jwt_service.access_token_duration_seconds(),
    };

    Ok(Json(ApiResponse::success(auth_response)))
}

/// Refresh token endpoint
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
    let refresh_claims = app_state.auth_state.jwt_service.validate_refresh_token(refresh_token)?;
    
    let user_id: i32 = refresh_claims.sub.parse()
        .map_err(|_| AuthError::TokenInvalid)?;

    // Get database connection
    let mut conn = app_state.db_pool.get().map_err(|_| AuthError::DatabaseError)?;

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
    let access_token = app_state.auth_state.jwt_service.generate_access_token(
        user.id,
        &user.email,
        &user.role,
    )?;

    let new_refresh_token = app_state.auth_state.jwt_service.generate_refresh_token(user.id)?;

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token,
        refresh_token: new_refresh_token,
        expires_in: app_state.auth_state.jwt_service.access_token_duration_seconds(),
    };

    Ok(Json(ApiResponse::success(auth_response)))
}

/// Get current user profile (protected endpoint)
pub async fn me(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<Value>>, AuthError> {
    // Extract user claims from request (set by auth middleware)
    let claims = extract_user_claims(&request)?;
    
    let user_id: i32 = claims.sub.parse()
        .map_err(|_| AuthError::TokenInvalid)?;

    // Get database connection
    let mut conn = app_state.db_pool.get().map_err(|_| AuthError::DatabaseError)?;

    // Find user in database
    let user = users::table
        .find(user_id)
        .first::<User>(&mut conn)
        .map_err(|_| AuthError::DatabaseError)?;

    Ok(Json(ApiResponse::success(serde_json::to_value(user.to_response()).unwrap())))
} 