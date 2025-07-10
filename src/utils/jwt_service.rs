use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use super::AuthError;

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
}

impl JwtService {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_ref()),
            decoding_key: DecodingKey::from_secret(secret.as_ref()),
            access_token_duration: Duration::minutes(15), // Short-lived access tokens
            refresh_token_duration: Duration::days(7),    // Longer-lived refresh tokens
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
} 