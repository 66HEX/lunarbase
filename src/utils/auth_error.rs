use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::fmt;

#[derive(Debug)]
pub enum LunarbaseError {
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

impl fmt::Display for LunarbaseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LunarbaseError::InvalidCredentials => write!(f, "Invalid credentials"),
            LunarbaseError::AccountLocked => write!(f, "Account temporarily locked"),
            LunarbaseError::AccountNotVerified => write!(f, "Account not verified"),
            LunarbaseError::UserAlreadyVerified => write!(f, "User already verified"),
            LunarbaseError::UserNotFound => write!(f, "User not found"),
            LunarbaseError::TokenExpired => write!(f, "Token expired"),
            LunarbaseError::TokenInvalid => write!(f, "Invalid token"),
            LunarbaseError::TokenMissing => write!(f, "Token missing"),
            LunarbaseError::PasswordResetTokenInvalid => write!(f, "Invalid password reset token"),
            LunarbaseError::PasswordResetTokenExpired => write!(f, "Password reset token expired"),
            LunarbaseError::WeakPassword => {
                write!(f, "Password does not meet security requirements")
            }
            LunarbaseError::InsufficientPermissions => write!(f, "Insufficient permissions"),
            LunarbaseError::RateLimitExceeded => write!(f, "Rate limit exceeded"),
            LunarbaseError::ValidationError(errors) => {
                write!(f, "Validation error: {}", errors.join(", "))
            }
            LunarbaseError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            LunarbaseError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            LunarbaseError::DatabaseError => write!(f, "Database error"),
            LunarbaseError::InternalError => write!(f, "Internal server error"),
            LunarbaseError::NotFound(msg) => write!(f, "Not found: {}", msg),
            LunarbaseError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
        }
    }
}

impl std::error::Error for LunarbaseError {}

impl IntoResponse for LunarbaseError {
    fn into_response(self) -> Response {
        let (status, error_message, error_code) = match self {
            LunarbaseError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "Invalid email or password",
                "INVALID_CREDENTIALS",
            ),
            LunarbaseError::AccountLocked => (
                StatusCode::FORBIDDEN,
                "Account temporarily locked due to multiple failed login attempts",
                "ACCOUNT_LOCKED",
            ),
            LunarbaseError::AccountNotVerified => (
                StatusCode::FORBIDDEN,
                "Please verify your email address to continue",
                "ACCOUNT_NOT_VERIFIED",
            ),
            LunarbaseError::UserAlreadyVerified => (
                StatusCode::BAD_REQUEST,
                "User is already verified",
                "USER_ALREADY_VERIFIED",
            ),
            LunarbaseError::UserNotFound => {
                (StatusCode::NOT_FOUND, "User not found", "USER_NOT_FOUND")
            }
            LunarbaseError::TokenExpired => (
                StatusCode::UNAUTHORIZED,
                "Token has expired",
                "TOKEN_EXPIRED",
            ),
            LunarbaseError::TokenInvalid => (
                StatusCode::UNAUTHORIZED,
                "Invalid or malformed token",
                "TOKEN_INVALID",
            ),
            LunarbaseError::TokenMissing => (
                StatusCode::UNAUTHORIZED,
                "Authorization token is missing",
                "TOKEN_MISSING",
            ),
            LunarbaseError::InsufficientPermissions => (
                StatusCode::FORBIDDEN,
                "You don't have permission to access this resource",
                "INSUFFICIENT_PERMISSIONS",
            ),
            LunarbaseError::PasswordResetTokenInvalid => (
                StatusCode::BAD_REQUEST,
                "Invalid or expired password reset token",
                "PASSWORD_RESET_TOKEN_INVALID",
            ),
            LunarbaseError::PasswordResetTokenExpired => (
                StatusCode::BAD_REQUEST,
                "Password reset token has expired",
                "PASSWORD_RESET_TOKEN_EXPIRED",
            ),
            LunarbaseError::WeakPassword => (
                StatusCode::BAD_REQUEST,
                "Password does not meet security requirements",
                "WEAK_PASSWORD",
            ),
            LunarbaseError::RateLimitExceeded => (
                StatusCode::TOO_MANY_REQUESTS,
                "Too many requests. Please try again later",
                "RATE_LIMIT_EXCEEDED",
            ),
            LunarbaseError::ValidationError(_) => (
                StatusCode::BAD_REQUEST,
                "Validation failed",
                "VALIDATION_ERROR",
            ),
            LunarbaseError::BadRequest(_) => {
                (StatusCode::BAD_REQUEST, "Bad request", "BAD_REQUEST")
            }
            LunarbaseError::Conflict(_) => {
                (StatusCode::CONFLICT, "Resource already exists", "CONFLICT")
            }
            LunarbaseError::DatabaseError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "A database error occurred. Please try again later",
                "DATABASE_ERROR",
            ),
            LunarbaseError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "An internal error occurred. Please try again later",
                "INTERNAL_ERROR",
            ),
            LunarbaseError::NotFound(_) => {
                (StatusCode::NOT_FOUND, "Resource not found", "NOT_FOUND")
            }
            LunarbaseError::Forbidden(_) => {
                (StatusCode::FORBIDDEN, "Access forbidden", "FORBIDDEN")
            }
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

    pub fn error(error: LunarbaseError) -> Self {
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
