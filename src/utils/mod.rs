use serde::Serialize;
use utoipa::ToSchema;

pub mod auth_error;
pub mod cookie_service;
pub mod jwt_service;
pub mod oauth_service;

pub use auth_error::LunarbaseError;
pub use cookie_service::CookieService;
pub use jwt_service::{Claims, JwtService};
pub use oauth_service::{OAuthConfig, OAuthService, OAuthUserInfo};

#[derive(Debug, Serialize, ToSchema)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data,
            message: None,
        }
    }

    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            success: true,
            data,
            message: Some(message),
        }
    }
}

impl ErrorResponse {
    pub fn new(error: String) -> Self {
        Self {
            success: false,
            error,
            details: None,
        }
    }

    pub fn with_details(error: String, details: String) -> Self {
        Self {
            success: false,
            error,
            details: Some(details),
        }
    }
}
