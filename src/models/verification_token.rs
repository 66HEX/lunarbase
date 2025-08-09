use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::verification_tokens;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, ToSchema)]
#[diesel(table_name = verification_tokens)]
pub struct VerificationToken {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub token: String,
    #[schema(example = 1)]
    pub user_id: i32,
    #[schema(example = "user@example.com")]
    pub email: String,
    pub expires_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TokenType {
    EmailVerification,
    PasswordReset,
}

impl TokenType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TokenType::EmailVerification => "email_verification",
            TokenType::PasswordReset => "password_reset",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "email_verification" => Some(TokenType::EmailVerification),
            "password_reset" => Some(TokenType::PasswordReset),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Insertable, ToSchema)]
#[diesel(table_name = verification_tokens)]
pub struct NewVerificationToken {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub token: String,
    #[schema(example = 1)]
    pub user_id: i32,
    #[schema(example = "user@example.com")]
    pub email: String,
    pub expires_at: NaiveDateTime,
}

impl NewVerificationToken {
    pub fn new(token: String, user_id: i32, email: String, expires_at: NaiveDateTime) -> Self {
        Self {
            token,
            user_id,
            email,
            expires_at,
        }
    }

    pub fn new_with_type(
        token: String,
        user_id: i32,
        email: String,
        expires_at: NaiveDateTime,
        _token_type: TokenType,
    ) -> Self {
        // Note: Since the database schema doesn't have a token_type column yet,
        // we'll store the type information in a comment for future migration
        Self {
            token,
            user_id,
            email,
            expires_at,
        }
    }
}
