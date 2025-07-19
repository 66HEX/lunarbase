use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::blacklisted_tokens;

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable, ToSchema)]
#[diesel(table_name = blacklisted_tokens)]
pub struct BlacklistedToken {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub jti: String,
    #[schema(example = 1)]
    pub user_id: i32,
    #[schema(example = "access")]
    pub token_type: String,
    pub expires_at: NaiveDateTime,
    pub blacklisted_at: NaiveDateTime,
    #[schema(example = "User logout")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Insertable, ToSchema)]
#[diesel(table_name = blacklisted_tokens)]
pub struct NewBlacklistedToken {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub jti: String,
    #[schema(example = 1)]
    pub user_id: i32,
    #[schema(example = "access")]
    pub token_type: String,
    pub expires_at: NaiveDateTime,
    #[schema(example = "User logout")]
    pub reason: Option<String>,
}

impl NewBlacklistedToken {
    pub fn new(
        jti: String,
        user_id: i32,
        token_type: String,
        expires_at: NaiveDateTime,
        reason: Option<String>,
    ) -> Self {
        Self {
            jti,
            user_id,
            token_type,
            expires_at,
            reason,
        }
    }

    pub fn from_access_token(
        jti: String,
        user_id: i32,
        expires_at: NaiveDateTime,
        reason: Option<String>,
    ) -> Self {
        Self::new(jti, user_id, "access".to_string(), expires_at, reason)
    }

    pub fn from_refresh_token(
        jti: String,
        user_id: i32,
        expires_at: NaiveDateTime,
        reason: Option<String>,
    ) -> Self {
        Self::new(jti, user_id, "refresh".to_string(), expires_at, reason)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LogoutRequest {
    #[schema(example = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...")]
    pub refresh_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LogoutResponse {
    #[schema(example = "Successfully logged out")]
    pub message: String,
}
