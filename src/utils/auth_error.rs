use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::fmt;

#[derive(Debug)]
pub enum AuthError {
    InvalidCredentials,
    AccountLocked,
    AccountNotVerified,
    UserAlreadyVerified,
    UserNotFound,
    TokenExpired,
    TokenInvalid,
    TokenMissing,
    InsufficientPermissions,
    RateLimitExceeded,
    ValidationError(Vec<String>),
    BadRequest(String),
    Conflict(String),
    DatabaseError,
    InternalError,
    NotFound(String),
    Forbidden(String),
    PasswordResetTokenInvalid,
    PasswordResetTokenExpired,
    WeakPassword,
}

impl fmt::Display for AuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthError::InvalidCredentials => write!(f, "Invalid credentials"),
            AuthError::AccountLocked => write!(f, "Account temporarily locked"),
            AuthError::AccountNotVerified => write!(f, "Account not verified"),
            AuthError::UserAlreadyVerified => write!(f, "User already verified"),
            AuthError::UserNotFound => write!(f, "User not found"),
            AuthError::TokenExpired => write!(f, "Token expired"),
            AuthError::TokenInvalid => write!(f, "Invalid token"),
            AuthError::TokenMissing => write!(f, "Token missing"),
            AuthError::PasswordResetTokenInvalid => write!(f, "Invalid password reset token"),
            AuthError::PasswordResetTokenExpired => write!(f, "Password reset token expired"),
            AuthError::WeakPassword => write!(f, "Password does not meet security requirements"),
            AuthError::InsufficientPermissions => write!(f, "Insufficient permissions"),
            AuthError::RateLimitExceeded => write!(f, "Rate limit exceeded"),
            AuthError::ValidationError(errors) => {
                write!(f, "Validation error: {}", errors.join(", "))
            }
            AuthError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            AuthError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AuthError::DatabaseError => write!(f, "Database error"),
            AuthError::InternalError => write!(f, "Internal server error"),
            AuthError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AuthError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
        }
    }
}

impl std::error::Error for AuthError {}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message, error_code) = match self {
            AuthError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password",
                "INVALID_CREDENTIALS",
            ),
            AuthError::AccountLocked => (
                StatusCode::FORBIDDEN,
                "Account temporarily locked due to multiple failed login attempts",
                "ACCOUNT_LOCKED",
            ),
            AuthError::AccountNotVerified => (
                StatusCode::FORBIDDEN,
                "Please verify your email address to continue",
                "ACCOUNT_NOT_VERIFIED",
            ),
            AuthError::UserAlreadyVerified => (
                StatusCode::BAD_REQUEST,
                "User is already verified",
                "USER_ALREADY_VERIFIED",
            ),
            AuthError::UserNotFound => (StatusCode::NOT_FOUND, "User not found", "USER_NOT_FOUND"),
            AuthError::TokenExpired => (
                StatusCode::UNAUTHORIZED,
                "Token has expired",
                "TOKEN_EXPIRED",
            ),
            AuthError::TokenInvalid => (
                StatusCode::UNAUTHORIZED,
                "Invalid or malformed token",
                "TOKEN_INVALID",
            ),
            AuthError::TokenMissing => (
                StatusCode::UNAUTHORIZED,
                "Authorization token is missing",
                "TOKEN_MISSING",
            ),
            AuthError::InsufficientPermissions => (
                StatusCode::FORBIDDEN,
                "You don't have permission to access this resource",
                "INSUFFICIENT_PERMISSIONS",
            ),
            AuthError::PasswordResetTokenInvalid => (
                StatusCode::BAD_REQUEST,
                "Invalid or expired password reset token",
                "PASSWORD_RESET_TOKEN_INVALID",
            ),
            AuthError::PasswordResetTokenExpired => (
                StatusCode::BAD_REQUEST,
                "Password reset token has expired",
                "PASSWORD_RESET_TOKEN_EXPIRED",
            ),
            AuthError::WeakPassword => (
                StatusCode::BAD_REQUEST,
                "Password does not meet security requirements",
                "WEAK_PASSWORD",
            ),
            AuthError::RateLimitExceeded => (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many requests. Please try again later",
                "RATE_LIMIT_EXCEEDED",
            ),
            AuthError::ValidationError(_) => (
                StatusCode::BAD_REQUEST,
                "Validation failed",
                "VALIDATION_ERROR",
            ),
            AuthError::BadRequest(_) => (StatusCode::BAD_REQUEST, "Bad request", "BAD_REQUEST"),
            AuthError::Conflict(_) => (StatusCode::CONFLICT, "Resource already exists", "CONFLICT"),
            AuthError::DatabaseError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "A database error occurred. Please try again later",
                "DATABASE_ERROR",
            ),
            AuthError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "An internal error occurred. Please try again later",
                "INTERNAL_ERROR",
            ),
            AuthError::NotFound(_) => (StatusCode::NOT_FOUND, "Resource not found", "NOT_FOUND"),
            AuthError::Forbidden(_) => (StatusCode::FORBIDDEN, "Access forbidden", "FORBIDDEN"),
        };

        let body = Json(json!({
            "error": {
                "code": error_code,
                "message": error_message,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }
        }));

        (status, body).into_response()
    }
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<Value>,
    pub timestamp: String,
}

impl<T: serde::Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn error(error: AuthError) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(json!({
                "code": format!("{:?}", error),
                "message": error.to_string()
            })),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}
