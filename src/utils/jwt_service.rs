use chrono::{Duration, Utc, NaiveDateTime, DateTime};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};

use super::AuthError;
use crate::schema::blacklisted_tokens;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,        // Subject (user ID)
    pub email: String,      // User email
    pub role: String,       // User role
    pub exp: i64,          // Expiration time
    pub iat: i64,          // Issued at
    pub jti: String,       // JWT ID for token blacklisting
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshClaims {
    pub sub: String,        // Subject (user ID)  
    pub exp: i64,          // Expiration time
    pub iat: i64,          // Issued at
    pub jti: String,       // JWT ID
    pub token_type: String, // "refresh"
}

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    access_token_duration: Duration,
    refresh_token_duration: Duration,
    pool: Pool<ConnectionManager<SqliteConnection>>,
}

impl JwtService {
    pub fn new(secret: &str, pool: Pool<ConnectionManager<SqliteConnection>>) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_ref()),
            decoding_key: DecodingKey::from_secret(secret.as_ref()),
            access_token_duration: Duration::minutes(15), // Short-lived access tokens
            refresh_token_duration: Duration::days(7),    // Longer-lived refresh tokens
            pool,
        }
    }

    /// Generate access token with short expiration
    pub fn generate_access_token(
        &self,
        user_id: i32,
        email: &str,
        role: &str,
    ) -> Result<String, AuthError> {
        let now = Utc::now();
        let exp = now + self.access_token_duration;
        
        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            role: role.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|_| AuthError::InternalError)
    }

    /// Generate refresh token with longer expiration
    pub fn generate_refresh_token(&self, user_id: i32) -> Result<String, AuthError> {
        let now = Utc::now();
        let exp = now + self.refresh_token_duration;

        let claims = RefreshClaims {
            sub: user_id.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
            token_type: "refresh".to_string(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|_| AuthError::InternalError)
    }

    /// Validate and decode access token
    pub fn validate_access_token(&self, token: &str) -> Result<Claims, AuthError> {
        let validation = Validation::new(Algorithm::HS256);
        
        match decode::<Claims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => {
                // Check if token is expired
                let now = Utc::now().timestamp();
                if token_data.claims.exp < now {
                    return Err(AuthError::TokenExpired);
                }
                Ok(token_data.claims)
            }
            Err(_) => Err(AuthError::TokenInvalid),
        }
    }

    /// Validate and decode refresh token
    pub fn validate_refresh_token(&self, token: &str) -> Result<RefreshClaims, AuthError> {
        let validation = Validation::new(Algorithm::HS256);
        
        match decode::<RefreshClaims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => {
                // Check if token is expired
                let now = Utc::now().timestamp();
                if token_data.claims.exp < now {
                    return Err(AuthError::TokenExpired);
                }
                
                // Check if it's actually a refresh token
                if token_data.claims.token_type != "refresh" {
                    return Err(AuthError::TokenInvalid);
                }
                
                Ok(token_data.claims)
            }
            Err(_) => Err(AuthError::TokenInvalid),
        }
    }

    /// Extract token from Authorization header
    pub fn extract_token_from_header(auth_header: &str) -> Result<&str, AuthError> {
        if auth_header.starts_with("Bearer ") {
            Ok(&auth_header[7..])
        } else {
            Err(AuthError::TokenInvalid)
        }
    }

    /// Get access token duration in seconds
    pub fn access_token_duration_seconds(&self) -> i64 {
        self.access_token_duration.num_seconds()
    }

    /// Decode token without validation (for extracting claims from potentially expired tokens)
    pub fn decode_token_unsafe(&self, token: &str) -> Result<Claims, AuthError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false; // Don't validate expiration
        validation.validate_nbf = false; // Don't validate not before
        
        match decode::<Claims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => Ok(token_data.claims),
            Err(_) => Err(AuthError::TokenInvalid),
        }
    }

    /// Decode refresh token without validation
    pub fn decode_refresh_token_unsafe(&self, token: &str) -> Result<RefreshClaims, AuthError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = false;
        validation.validate_nbf = false;
        
        match decode::<RefreshClaims>(token, &self.decoding_key, &validation) {
            Ok(token_data) => Ok(token_data.claims),
            Err(_) => Err(AuthError::TokenInvalid),
        }
    }

    /// Check if token is blacklisted
    pub fn is_token_blacklisted(&self, jti: &str) -> Result<bool, AuthError> {
        let mut conn = self.pool.get()
            .map_err(|_| AuthError::InternalError)?;

        let count: i64 = blacklisted_tokens::table
            .filter(blacklisted_tokens::jti.eq(jti))
            .count()
            .get_result(&mut conn)
            .map_err(|_| AuthError::InternalError)?;

        Ok(count > 0)
    }

    /// Add token to blacklist
    pub fn blacklist_token(&self, token: &str, token_type: &str, reason: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.get()?;
        
        // Decode token to get claims
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

    /// Validate access token with blacklist check
    pub fn validate_access_token_with_blacklist(&self, token: &str) -> Result<Claims, AuthError> {
        let claims = self.validate_access_token(token)?;
        
        if self.is_token_blacklisted(&claims.jti)? {
            return Err(AuthError::TokenInvalid);
        }
        
        Ok(claims)
    }

    /// Validate refresh token with blacklist check
    pub fn validate_refresh_token_with_blacklist(&self, token: &str) -> Result<RefreshClaims, AuthError> {
        let claims = self.validate_refresh_token(token)?;
        
        if self.is_token_blacklisted(&claims.jti)? {
            return Err(AuthError::TokenInvalid);
        }
        
        Ok(claims)
    }

    /// Blacklist refresh token
    pub fn blacklist_refresh_token(&self, token: &str, reason: Option<String>) -> Result<(), Box<dyn std::error::Error>> {
        let mut conn = self.pool.get()?;
        
        // Decode refresh token to get claims
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

    /// Convert timestamp to NaiveDateTime
    pub fn timestamp_to_naive_datetime(timestamp: i64) -> NaiveDateTime {
        DateTime::from_timestamp(timestamp, 0)
            .map(|dt| dt.naive_utc())
            .unwrap_or_else(|| DateTime::from_timestamp(0, 0).unwrap().naive_utc())
    }
}