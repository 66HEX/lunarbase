use axum::{
    Extension,
    extract::{FromRequest, Query, Request, State},
    http::{HeaderMap, StatusCode},
    response::{Json, Redirect},
};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::debug;
use utoipa::ToSchema;

use crate::{
    AppState,
    middleware::extract_user_claims,
    models::{
        AuthResponse, LoginRequest, LogoutRequest, LogoutResponse, NewUser, RegisterRequest, User,
        UserResponse,
    },
    schema::users,
    services::configuration_manager::ConfigurationAccess,
    utils::{ApiResponse, Claims, CookieService, ErrorResponse, LunarbaseError},
};

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
) -> Result<(StatusCode, HeaderMap, Json<ApiResponse<AuthResponse>>), LunarbaseError> {
    let Json(payload): Json<RegisterRequest> = Json::from_request(request, &app_state)
        .await
        .map_err(|_| LunarbaseError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    payload
        .validate()
        .map_err(LunarbaseError::ValidationError)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_user.is_some() {
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(LunarbaseError::ValidationError(vec![
            "Email already registered".to_string(),
        ]));
    }

    let existing_username = users::table
        .filter(users::username.eq(&payload.username))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_username.is_some() {
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(LunarbaseError::ValidationError(vec![
            "Username already taken".to_string(),
        ]));
    }

    let new_user = NewUser::new(
        payload.email,
        &payload.password,
        payload.username,
        &app_state.password_pepper,
    )
    .map_err(|_| LunarbaseError::InternalError)?;

    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if let Err(e) = app_state
        .email_service
        .send_verification_email(user.id, &user.email, &user.username)
        .await
    {
        tracing::warn!(
            "Failed to send verification email to {}: {:?}",
            user.email,
            e
        );
    }

    let access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .await?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .await?;

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(),
        refresh_token: String::new(),
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds()
            .await,
    };

    Ok((
        StatusCode::CREATED,
        headers,
        Json(ApiResponse::success(auth_response)),
    ))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct VerifyEmailRequest {
    #[schema(example = "verification_token_here")]
    pub token: String,
}

#[utoipa::path(
    post,
    path = "/auth/verify-email",
    tag = "Authentication",
    request_body = VerifyEmailRequest,
    responses(
        (status = 200, description = "Email verified successfully", body = ApiResponse<String>),
        (status = 400, description = "Invalid or expired token", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn verify_email(
    State(app_state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    let user_id = app_state.email_service.verify_token(&payload.token).await?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    diesel::update(users::table.filter(users::id.eq(user_id)))
        .set(users::is_verified.eq(true))
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    Ok(Json(ApiResponse::success(
        "Email verified successfully".to_string(),
    )))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct VerifyEmailQuery {
    #[schema(example = "verification_token_here")]
    pub token: String,
}

#[utoipa::path(
    get,
    path = "/verify-email",
    tag = "Authentication",
    params(
        ("token" = String, Query, description = "Verification token from email")
    ),
    responses(
        (status = 302, description = "Redirect to frontend with verification result"),
        (status = 400, description = "Invalid or expired token")
    )
)]
pub async fn verify_email_get(
    State(app_state): State<AppState>,
    Query(query): Query<VerifyEmailQuery>,
) -> Result<Redirect, LunarbaseError> {
    match app_state.email_service.verify_token(&query.token).await {
        Ok(user_id) => {
            let mut conn = app_state
                .db_pool
                .get()
                .map_err(|_| LunarbaseError::DatabaseError)?;

            match diesel::update(users::table.filter(users::id.eq(user_id)))
                .set(users::is_verified.eq(true))
                .execute(&mut conn)
            {
                Ok(_) => Ok(Redirect::to(&format!(
                    "{}/admin",
                    app_state.email_service.get_frontend_url()
                ))),
                Err(_) => Ok(Redirect::to(&format!(
                    "{}/email-verified?success=false&error=database",
                    app_state.email_service.get_frontend_url()
                ))),
            }
        }
        Err(_) => Ok(Redirect::to(&format!(
            "{}/email-verified?success=false&error=invalid_token",
            app_state.email_service.get_frontend_url()
        ))),
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResendVerificationRequest {
    #[schema(example = "user@example.com")]
    pub email: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ForgotPasswordRequest {
    #[schema(example = "user@example.com")]
    pub email: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ResetPasswordRequest {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub token: String,
    #[schema(example = "NewSecurePassword123!", min_length = 8)]
    pub new_password: String,
}

#[utoipa::path(
    post,
    path = "/auth/resend-verification",
    tag = "Authentication",
    request_body = ResendVerificationRequest,
    responses(
        (status = 200, description = "Verification email sent", body = ApiResponse<String>),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 400, description = "User already verified", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn resend_verification(
    State(app_state): State<AppState>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user: User = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::UserNotFound)?;

    if user.is_verified {
        return Err(LunarbaseError::UserAlreadyVerified);
    }

    app_state
        .email_service
        .send_verification_email(user.id, &user.email, &user.username)
        .await?;

    Ok(Json(ApiResponse::success(
        "Verification email sent".to_string(),
    )))
}

#[utoipa::path(
    post,
    path = "/auth/forgot-password",
    tag = "Authentication",
    request_body = ForgotPasswordRequest,
    responses(
        (status = 200, description = "Password reset email sent", body = ApiResponse<String>),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn forgot_password(
    State(app_state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    let start_time = std::time::Instant::now();
    let base_delay = std::time::Duration::from_millis(500);

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_result: Result<User, _> = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first(&mut conn);

    match user_result {
        Ok(user) => {
            if user.is_active {
                if let Err(e) = app_state
                    .email_service
                    .send_password_reset_email(user.id, &user.email, &user.username)
                    .await
                {
                    tracing::warn!(
                        "Failed to send password reset email to {}: {:?}",
                        user.email,
                        e
                    );
                }
            }
        }
        Err(_) => {
            debug!(
                "Password reset requested for non-existent email: {}",
                payload.email
            );
        }
    }

    let elapsed = start_time.elapsed();
    if elapsed < base_delay {
        tokio::time::sleep(base_delay - elapsed).await;
    }

    Ok(Json(ApiResponse::success(
        "If an account with that email exists, a password reset link has been sent".to_string(),
    )))
}

#[utoipa::path(
    post,
    path = "/auth/reset-password",
    tag = "Authentication",
    request_body = ResetPasswordRequest,
    responses(
        (status = 200, description = "Password reset successfully", body = ApiResponse<String>),
        (status = 400, description = "Invalid or expired token", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    )
)]
pub async fn reset_password(
    State(app_state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<ApiResponse<String>>, LunarbaseError> {
    use crate::models::verification_token::TokenType;
    use argon2::password_hash::SaltString;
    use argon2::{Argon2, PasswordHasher};
    use diesel::prelude::*;
    use rand::rngs::OsRng;

    if payload.new_password.len() < 8 {
        return Err(LunarbaseError::WeakPassword);
    }

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user_id = app_state
        .email_service
        .verify_token_with_type(&payload.token, TokenType::PasswordReset)
        .await
        .map_err(|_| LunarbaseError::PasswordResetTokenInvalid)?;

    let user: User = users::table
        .filter(users::id.eq(user_id))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::UserNotFound)?;

    let salt = SaltString::generate(&mut OsRng);
    let peppered_password = format!("{}{}", payload.new_password, app_state.password_pepper);
    let argon2 = Argon2::new(
        argon2::Algorithm::Argon2id,
        argon2::Version::V0x13,
        argon2::Params::new(65536, 4, 2, None).unwrap(),
    );
    let password_hash = argon2
        .hash_password(peppered_password.as_bytes(), &salt)
        .map_err(|_| LunarbaseError::InternalError)?
        .to_string();

    diesel::update(users::table.filter(users::id.eq(user.id)))
        .set((
            users::password_hash.eq(&password_hash),
            users::failed_login_attempts.eq(0),
            users::locked_until.eq::<Option<chrono::NaiveDateTime>>(None),
            users::updated_at.eq(chrono::Utc::now().naive_utc()),
        ))
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    debug!("Password reset successfully for user: {}", user.email);

    Ok(Json(ApiResponse::success(
        "Password has been reset successfully".to_string(),
    )))
}

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
) -> Result<Redirect, LunarbaseError> {
    let oauth_service = &app_state.oauth_service;

    let (auth_url, _state) = oauth_service
        .get_authorization_url(&provider)
        .map_err(|_| {
            LunarbaseError::ValidationError(vec![
                "Invalid OAuth provider or configuration".to_string(),
            ])
        })?;

    Ok(Redirect::temporary(&auth_url))
}

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
) -> Result<(HeaderMap, Redirect), LunarbaseError> {
    if let Some(error) = query.error {
        let error_msg = query.error_description.unwrap_or(error);
        return Ok((
            HeaderMap::new(),
            Redirect::temporary(&format!(
                "{}/admin/auth/error?message={}",
                app_state.email_service.get_frontend_url(),
                urlencoding::encode(&error_msg)
            )),
        ));
    }

    let oauth_service = &app_state.oauth_service;

    let code = query.code.ok_or_else(|| {
        LunarbaseError::ValidationError(vec!["Missing authorization code".to_string()])
    })?;

    let state = query.state.ok_or_else(|| {
        LunarbaseError::ValidationError(vec!["Missing state parameter".to_string()])
    })?;

    let access_token = oauth_service
        .exchange_code_for_token(&provider, &code, &state)
        .await
        .map_err(|e| {
            LunarbaseError::ValidationError(vec![format!("Failed to exchange OAuth code: {}", e)])
        })?;

    let oauth_user = oauth_service
        .get_user_info(&provider, &access_token)
        .await
        .map_err(|_| {
            LunarbaseError::ValidationError(vec![
                "Failed to get user info from OAuth provider".to_string(),
            ])
        })?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let existing_user = users::table
        .filter(users::email.eq(&oauth_user.email))
        .select(User::as_select())
        .first(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user = if let Some(mut user) = existing_user {
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
            avatar_url: Some(oauth_user.avatar_url.clone()),
        };

        diesel::update(users::table.find(user.id))
            .set(&update_user)
            .execute(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?;

        user.last_login_at = Some(chrono::Utc::now().naive_utc());
        user
    } else {
        let username = oauth_user
            .name
            .unwrap_or_else(|| format!("{}_{}", provider, &oauth_user.id[..8]));

        let random_password = uuid::Uuid::new_v4().to_string();

        let new_user = NewUser::new_with_avatar(
            oauth_user.email.clone(),
            &random_password,
            username,
            "user".to_string(),
            oauth_user.avatar_url.clone(),
            &app_state.password_pepper,
        )
        .map_err(|e| LunarbaseError::ValidationError(vec![e]))?;

        diesel::insert_into(users::table)
            .values(&new_user)
            .execute(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?;

        let mut created_user: User = users::table
            .filter(users::email.eq(&oauth_user.email))
            .select(User::as_select())
            .first(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?;

        diesel::update(users::table.filter(users::id.eq(created_user.id)))
            .set(users::is_verified.eq(true))
            .execute(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?;

        created_user.is_verified = true;
        created_user
    };

    let jwt_access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .await
        .map_err(|_| LunarbaseError::InternalError)?;

    let jwt_refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .await
        .map_err(|_| LunarbaseError::InternalError)?;

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &jwt_access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &jwt_refresh_token);

    Ok((
        headers,
        Redirect::temporary(&format!(
            "{}/admin/auth/success",
            app_state.email_service.get_frontend_url()
        )),
    ))
}

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
) -> Result<(HeaderMap, Json<ApiResponse<LogoutResponse>>), LunarbaseError> {
    let expires_at = crate::utils::jwt_service::JwtService::timestamp_to_naive_datetime(claims.exp);
    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::InternalError)?;

    app_state
        .auth_state
        .jwt_service
        .blacklist_token_by_jti(
            &claims.jti,
            user_id,
            "access",
            expires_at,
            Some("User logout".to_string()),
        )
        .map_err(|_| LunarbaseError::InternalError)?;

    if let Some(refresh_token) = CookieService::extract_refresh_token(request.headers()) {
        app_state
            .auth_state
            .jwt_service
            .blacklist_refresh_token(&refresh_token, Some("User logout".to_string()))
            .map_err(|_| LunarbaseError::InternalError)?;
    }

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.clear_all_tokens(&mut headers);

    let logout_response = LogoutResponse {
        message: "Successfully logged out".to_string(),
    };

    Ok((headers, Json(ApiResponse::success(logout_response))))
}

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
) -> Result<(HeaderMap, Json<ApiResponse<AuthResponse>>), LunarbaseError> {
    let Json(payload): Json<LoginRequest> = Json::from_request(request, &app_state)
        .await
        .map_err(|_| LunarbaseError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    payload
        .validate()
        .map_err(LunarbaseError::ValidationError)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let base_delay = Duration::from_millis(100);
    let start_time = std::time::Instant::now();

    let user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first::<User>(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user = match user {
        Some(user) => user,
        None => {
            let elapsed = start_time.elapsed();
            if elapsed < base_delay {
                tokio::time::sleep(base_delay - elapsed).await;
            }
            return Err(LunarbaseError::InvalidCredentials);
        }
    };

    if user.is_locked() {
        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }
        return Err(LunarbaseError::AccountLocked);
    }

    if !user.is_verified {
        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }
        return Err(LunarbaseError::AccountNotVerified);
    }

    let password_valid = user
        .verify_password(&payload.password, &app_state.password_pepper)
        .map_err(|_| LunarbaseError::InternalError)?;

    if !password_valid {
        let max_login_attempts = app_state.auth_state.get_max_login_attempts().await;
        let lockout_duration_minutes = app_state.auth_state.get_lockout_duration_minutes().await;

        let new_attempts = user.failed_login_attempts + 1;
        let locked_until = if new_attempts >= max_login_attempts {
            Some(
                chrono::Utc::now().naive_utc()
                    + chrono::Duration::minutes(lockout_duration_minutes as i64),
            )
        } else {
            None
        };

        diesel::update(users::table.find(user.id))
            .set((
                users::failed_login_attempts.eq(new_attempts),
                users::locked_until.eq(locked_until),
            ))
            .execute(&mut conn)
            .map_err(|_| LunarbaseError::DatabaseError)?;

        let elapsed = start_time.elapsed();
        if elapsed < base_delay {
            tokio::time::sleep(base_delay - elapsed).await;
        }

        return Err(LunarbaseError::InvalidCredentials);
    }

    diesel::update(users::table.find(user.id))
        .set((
            users::failed_login_attempts.eq(0),
            users::locked_until.eq(None::<chrono::NaiveDateTime>),
            users::last_login_at.eq(Some(chrono::Utc::now().naive_utc())),
        ))
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .await?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .await?;

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    let elapsed = start_time.elapsed();
    if elapsed < base_delay {
        tokio::time::sleep(base_delay - elapsed).await;
    }

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(),
        refresh_token: String::new(),
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds()
            .await,
    };

    Ok((headers, Json(ApiResponse::success(auth_response))))
}

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
) -> Result<(HeaderMap, Json<ApiResponse<AuthResponse>>), LunarbaseError> {
    let refresh_token = CookieService::extract_refresh_token(request.headers())
        .ok_or(LunarbaseError::TokenInvalid)?;

    let refresh_claims = app_state
        .auth_state
        .jwt_service
        .validate_refresh_token(&refresh_token)?;

    let user_id: i32 = refresh_claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    if !user.is_active {
        return Err(LunarbaseError::TokenInvalid);
    }

    let access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .await?;

    let new_refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .await?;

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &new_refresh_token);

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(),
        refresh_token: String::new(),
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds()
            .await,
    };

    Ok((headers, Json(ApiResponse::success(auth_response))))
}

#[utoipa::path(
    get,
    path = "/auth/me",
    tag = "Authentication",
    responses(
        (status = 200, description = "User profile retrieved successfully", body = ApiResponse<UserResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn me(
    State(app_state): State<AppState>,
    request: Request,
) -> Result<Json<ApiResponse<UserResponse>>, LunarbaseError> {
    let claims = extract_user_claims(&request)?;

    let user_id: i32 = claims
        .sub
        .parse()
        .map_err(|_| LunarbaseError::TokenInvalid)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user = users::table
        .find(user_id)
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    Ok(Json(ApiResponse::success(user.to_response())))
}

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
) -> Result<(StatusCode, HeaderMap, Json<ApiResponse<AuthResponse>>), LunarbaseError> {
    let Json(payload): Json<RegisterRequest> = Json::from_request(request, &app_state)
        .await
        .map_err(|_| LunarbaseError::ValidationError(vec!["Invalid JSON payload".to_string()]))?;

    payload
        .validate()
        .map_err(LunarbaseError::ValidationError)?;

    let mut conn = app_state
        .db_pool
        .get()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let existing_admin = users::table
        .filter(users::role.eq("admin"))
        .select(User::as_select())
        .first(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_admin.is_some() {
        return Err(LunarbaseError::ValidationError(vec![
            "Admin already exists. Additional admins must be created by existing admins through the admin panel.".to_string()
        ]));
    }

    let existing_user = users::table
        .filter(users::email.eq(&payload.email))
        .select(User::as_select())
        .first(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_user.is_some() {
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(LunarbaseError::ValidationError(vec![
            "Email already registered".to_string(),
        ]));
    }

    let existing_username = users::table
        .filter(users::username.eq(&payload.username))
        .select(User::as_select())
        .first(&mut conn)
        .optional()
        .map_err(|_| LunarbaseError::DatabaseError)?;

    if existing_username.is_some() {
        tokio::time::sleep(Duration::from_millis(100)).await;
        return Err(LunarbaseError::ValidationError(vec![
            "Username already taken".to_string(),
        ]));
    }

    let new_user = NewUser::new_with_role(
        payload.email,
        &payload.password,
        payload.username,
        "admin".to_string(),
        &app_state.password_pepper,
    )
    .map_err(|_| LunarbaseError::InternalError)?;

    diesel::insert_into(users::table)
        .values(&new_user)
        .execute(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let user: User = users::table
        .filter(users::email.eq(&new_user.email))
        .select(User::as_select())
        .first(&mut conn)
        .map_err(|_| LunarbaseError::DatabaseError)?;

    let access_token = app_state
        .auth_state
        .jwt_service
        .generate_access_token(user.id, &user.email, &user.role)
        .await?;

    let refresh_token = app_state
        .auth_state
        .jwt_service
        .generate_refresh_token(user.id)
        .await?;

    let cookie_service = CookieService::new();
    let mut headers = HeaderMap::new();
    cookie_service.set_access_token_cookie(&mut headers, &access_token);
    cookie_service.set_refresh_token_cookie(&mut headers, &refresh_token);

    let auth_response = AuthResponse {
        user: user.to_response(),
        access_token: String::new(),
        refresh_token: String::new(),
        expires_in: app_state
            .auth_state
            .jwt_service
            .access_token_duration_seconds()
            .await,
    };

    Ok((
        StatusCode::CREATED,
        headers,
        Json(ApiResponse::success(auth_response)),
    ))
}
