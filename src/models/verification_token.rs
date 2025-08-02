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
}
