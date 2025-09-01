use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};

use super::LunarbaseError;
use crate::schema::blacklisted_tokens;
use crate::services::{ConfigurationAccess, ConfigurationManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: String,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
    pub token_type: String,
}

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    pool: Pool<ConnectionManager<SqliteConnection>>,
    config_manager: ConfigurationManager,
}

impl JwtService {
    pub fn new(
        secret: &str,
        pool: Pool<ConnectionManager<SqliteConnection>>,
        config_manager: ConfigurationManager,
    ) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_ref()),
            decoding_key: DecodingKey::from_secret(secret.as_ref()),
            pool,
            config_manager,
        }
    }

    pub async fn generate_access_token(
        &self,
        user_id: i32,
        email: &str,
        role: &str,
    ) -> Result<String, LunarbaseError> {
        let now = Utc::now();
        let jwt_lifetime_hours = self.get_jwt_lifetime_hours().await;
        let exp = now + Duration::hours(jwt_lifetime_hours as i64);

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            role: role.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub async fn generate_refresh_token(&self, user_id: i32) -> Result<String, LunarbaseError> {
        let now = Utc::now();
        let jwt_lifetime_hours = self.get_jwt_lifetime_hours().await;
        let exp = now + Duration::hours((jwt_lifetime_hours * 7) as i64);

        let claims = RefreshClaims {
            sub: user_id.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
            token_type: "refresh".to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|_| LunarbaseError::InternalError)
    }

    pub fn validate_access_token(&self, token: &str) -> Result<Claims, LunarbaseError> {
        let validation = Validation::new(Algorithm::HS256);

        match decode::<Claims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => {
                let now = Utc::now().timestamp();
                if token_data.claims.exp < now {
                    return Err(LunarbaseError::TokenExpired);
                }
                Ok(token_data.claims)
            }
            Err(_) => Err(LunarbaseError::TokenInvalid),
        }
    }

    pub fn validate_refresh_token(&self, token: &str) -> Result<RefreshClaims, LunarbaseError> {
        let validation = Validation::new(Algorithm::HS256);

        match decode::<RefreshClaims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => {
                let now = Utc::now().timestamp();
                if token_data.claims.exp < now {
                    return Err(LunarbaseError::TokenExpired);
                }

                if token_data.claims.token_type != "refresh" {
                    return Err(LunarbaseError::TokenInvalid);
                }

                Ok(token_data.claims)
            }
            Err(_) => Err(LunarbaseError::TokenInvalid),
        }
    }

    pub fn extract_token_from_header(auth_header: &str) -> Result<&str, LunarbaseError> {
        if auth_header.starts_with("Bearer ") {
            Ok(&auth_header[7..])
        } else {
            Err(LunarbaseError::TokenInvalid)
        }
    }

    pub async fn access_token_duration_seconds(&self) -> i64 {
        let jwt_lifetime_hours = self.get_jwt_lifetime_hours().await;
        Duration::hours(jwt_lifetime_hours as i64).num_seconds()
    }

    pub fn decode_token_unsafe(&self, token: &str) -> Result<Claims, LunarbaseError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;

        match decode::<Claims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => Ok(token_data.claims),
            Err(_) => Err(LunarbaseError::TokenInvalid),
        }
    }

    pub fn decode_refresh_token_unsafe(
        &self,
        token: &str,
    ) -> Result<RefreshClaims, LunarbaseError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;

        match decode::<RefreshClaims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => Ok(token_data.claims),
            Err(_) => Err(LunarbaseError::TokenInvalid),
        }
    }

    pub fn is_token_blacklisted(&self, jti: &str) -> Result<bool, LunarbaseError> {
        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let count: i64 = blacklisted_tokens::table
            .filter(blacklisted_tokens::jti.eq(jti))
            .count()
            .get_result(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)?;

        Ok(count > 0)
    }

    pub fn blacklist_token(
        &self,
        token: &str,
        token_type: &str,
        reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.get()?;

        let claims = self.decode_token_unsafe(token)?;

        let new_blacklisted_token = crate::models::NewBlacklistedToken {
            jti: claims.jti,
            user_id: claims.sub.parse()?,
            token_type: token_type.to_string(),
            expires_at: Self::timestamp_to_naive_datetime(claims.exp),
            reason,
        };

        diesel::insert_into(blacklisted_tokens::table)
            .values(&new_blacklisted_token)
            .execute(&mut conn)?;

        Ok(())
    }

    pub fn blacklist_token_by_jti(
        &self,
        jti: &str,
        user_id: i32,
        token_type: &str,
        expires_at: NaiveDateTime,
        reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.get()?;

        let new_blacklisted_token = crate::models::NewBlacklistedToken {
            jti: jti.to_string(),
            user_id,
            token_type: token_type.to_string(),
            expires_at,
            reason,
        };

        diesel::insert_into(blacklisted_tokens::table)
            .values(&new_blacklisted_token)
            .execute(&mut conn)?;

        Ok(())
    }

    pub fn validate_access_token_with_blacklist(
        &self,
        token: &str,
    ) -> Result<Claims, LunarbaseError> {
        let claims = self.validate_access_token(token)?;

        if self.is_token_blacklisted(&claims.jti)? {
            return Err(LunarbaseError::TokenInvalid);
        }

        Ok(claims)
    }

    pub fn validate_access_token_with_verification(
        &self,
        token: &str,
    ) -> Result<Claims, LunarbaseError> {
        let claims = self.validate_access_token_with_blacklist(token)?;

        let user_id: i32 = claims
            .sub
            .parse()
            .map_err(|_| LunarbaseError::TokenInvalid)?;
        if !self.is_user_verified(user_id)? {
            return Err(LunarbaseError::AccountNotVerified);
        }

        Ok(claims)
    }

    pub fn is_user_verified(&self, user_id: i32) -> Result<bool, LunarbaseError> {
        use crate::schema::users;

        let mut conn = self.pool.get().map_err(|_| LunarbaseError::InternalError)?;

        let is_verified: bool = users::table
            .filter(users::id.eq(user_id))
            .select(users::is_verified)
            .first(&mut conn)
            .map_err(|_| LunarbaseError::InternalError)?;

        Ok(is_verified)
    }

    pub fn validate_refresh_token_with_blacklist(
        &self,
        token: &str,
    ) -> Result<RefreshClaims, LunarbaseError> {
        let claims = self.validate_refresh_token(token)?;

        if self.is_token_blacklisted(&claims.jti)? {
            return Err(LunarbaseError::TokenInvalid);
        }

        Ok(claims)
    }

    pub fn blacklist_refresh_token(
        &self,
        token: &str,
        reason: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.get()?;

        let refresh_claims = self.decode_refresh_token_unsafe(token)?;

        let new_blacklisted_token = crate::models::NewBlacklistedToken {
            jti: refresh_claims.jti,
            user_id: refresh_claims.sub.parse()?,
            token_type: "refresh".to_string(),
            expires_at: Self::timestamp_to_naive_datetime(refresh_claims.exp),
            reason,
        };

        diesel::insert_into(blacklisted_tokens::table)
            .values(&new_blacklisted_token)
            .execute(&mut conn)?;

        Ok(())
    }

    pub fn timestamp_to_naive_datetime(timestamp: i64) -> NaiveDateTime {
        DateTime::from_timestamp(timestamp, 0)
            .map(|dt| dt.naive_utc())
            .unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap().naive_utc())
    }
}

impl ConfigurationAccess for JwtService {
    fn config_manager(&self) -> &ConfigurationManager {
        &self.config_manager
    }
}
