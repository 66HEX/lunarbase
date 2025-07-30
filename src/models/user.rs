use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::{DateTime, NaiveDateTime, Utc};
use diesel::prelude::*;
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::users;

// Database model
#[derive(Debug, Queryable, Selectable, Identifiable, Serialize, ToSchema)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct User {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "user@example.com")]
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    #[schema(example = "john_doe")]
    pub username: String,
    #[schema(example = true)]
    pub is_verified: bool,
    #[schema(example = true)]
    pub is_active: bool,
    #[schema(example = "user")]
    pub role: String,
    #[serde(skip_serializing)]
    pub failed_login_attempts: i32,
    #[serde(skip_serializing)]
    pub locked_until: Option<NaiveDateTime>,
    #[serde(skip_serializing)]
    pub last_login_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Update model for AsChangeset (excluding readonly fields)
#[derive(Debug, AsChangeset)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub username: Option<String>,
    pub is_verified: Option<bool>,
    pub is_active: Option<bool>,
    pub role: Option<String>,
    pub failed_login_attempts: Option<i32>,
    pub locked_until: Option<Option<NaiveDateTime>>,
    pub last_login_at: Option<Option<NaiveDateTime>>,
}

// Insert model
#[derive(Debug, Insertable)]
#[diesel(table_name = users)]
pub struct NewUser {
    pub email: String,
    pub password_hash: String,
    pub username: String,
    pub role: String,
}

// Request DTOs
#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterRequest {
    #[schema(example = "user@example.com")]
    pub email: String,
    #[schema(example = "SecurePassword123!", min_length = 8)]
    pub password: String,
    #[schema(example = "john_doe", min_length = 3, max_length = 30)]
    pub username: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    #[schema(example = "user@example.com")]
    pub email: String,
    #[schema(example = "SecurePassword123!")]
    pub password: String,
}

// Response DTOs
#[derive(Debug, Serialize, ToSchema)]
pub struct UserResponse {
    #[schema(example = 1)]
    pub id: i32,
    #[schema(example = "user@example.com")]
    pub email: String,
    #[schema(example = "john_doe")]
    pub username: String,
    #[schema(example = true)]
    pub is_verified: bool,
    #[schema(example = true)]
    pub is_active: bool,
    #[schema(example = "user")]
    pub role: String,
    pub last_login_at: Option<DateTime<Utc>>,
    pub locked_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponse {
    pub user: UserResponse,
    #[schema(example = "")]
    pub access_token: String,
    #[schema(example = "")]
    pub refresh_token: String,
    #[schema(example = 3600)]
    pub expires_in: i64,
}

// Security and validation implementation
impl User {
    /// Check if user account is locked due to failed login attempts
    pub fn is_locked(&self) -> bool {
        if let Some(locked_until) = self.locked_until {
            Utc::now().naive_utc() < locked_until
        } else {
            false
        }
    }

    /// Verify password with timing attack protection using pepper
    pub fn verify_password(&self, password: &str, pepper: &str) -> Result<bool, argon2::password_hash::Error> {
        let parsed_hash = PasswordHash::new(&self.password_hash)?;
        
        // Combine password with pepper for verification
        let peppered_password = format!("{}{}", password, pepper);
        
        Ok(Argon2::default()
            .verify_password(peppered_password.as_bytes(), &parsed_hash)
            .is_ok())
    }

    /// Convert to safe response (no sensitive data)
    pub fn to_response(&self) -> UserResponse {
        UserResponse {
            id: self.id,
            email: self.email.clone(),
            username: self.username.clone(),
            is_verified: self.is_verified,
            is_active: self.is_active,
            role: self.role.clone(),
            last_login_at: self
                .last_login_at
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc)),
            locked_until: self
                .locked_until
                .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc)),
            created_at: DateTime::from_naive_utc_and_offset(self.created_at, Utc),
        }
    }

    /// Check if user has required role
    pub fn has_role(&self, required_role: &str) -> bool {
        self.role == required_role || self.role == "admin"
    }
}

impl NewUser {
    /// Create new user with secure password hashing using pepper
    pub fn new(email: String, password: &str, username: String, pepper: &str) -> Result<Self, String> {
        // Generate cryptographically secure random salt
        let mut salt_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut salt_bytes);

        let salt = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| format!("Salt generation failed: {}", e))?;

        // Combine password with pepper for additional security
        let peppered_password = format!("{}{}", password, pepper);

        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(peppered_password.as_bytes(), &salt)
            .map_err(|e| format!("Password hashing failed: {}", e))?
            .to_string();

        Ok(NewUser {
            email,
            password_hash,
            username,
            role: "user".to_string(),
        })
    }

    /// Create new user with custom role and secure password hashing using pepper
    pub fn new_with_role(
        email: String,
        password: &str,
        username: String,
        role: String,
        pepper: &str,
    ) -> Result<Self, String> {
        // Generate cryptographically secure random salt
        let mut salt_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut salt_bytes);

        let salt = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| format!("Salt generation failed: {}", e))?;

        // Combine password with pepper for additional security
        let peppered_password = format!("{}{}", password, pepper);

        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 4, 2, None).unwrap(),
        );
        let password_hash = argon2
            .hash_password(peppered_password.as_bytes(), &salt)
            .map_err(|e| format!("Password hashing failed: {}", e))?
            .to_string();

        Ok(NewUser {
            email,
            password_hash,
            username,
            role,
        })
    }
}

// Validation traits
impl RegisterRequest {
    /// Validate registration request with comprehensive checks
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Email validation
        if self.email.is_empty() {
            errors.push("Email is required".to_string());
        } else if !self.is_valid_email() {
            errors.push("Invalid email format".to_string());
        }

        // Password validation
        if self.password.is_empty() {
            errors.push("Password is required".to_string());
        } else if !self.is_strong_password() {
            errors.push("Password must be at least 8 characters long and contain uppercase, lowercase, number and special character".to_string());
        }

        // Username validation
        if self.username.is_empty() {
            errors.push("Username is required".to_string());
        } else if !self.is_valid_username() {
            errors.push("Username must be 3-30 characters long and contain only letters, numbers, and underscores".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    fn is_valid_email(&self) -> bool {
        // Basic email validation (in production, use proper email validation crate)
        self.email.contains('@') && self.email.len() <= 255
    }

    fn is_strong_password(&self) -> bool {
        self.password.len() >= 8
            && self.password.chars().any(|c| c.is_uppercase())
            && self.password.chars().any(|c| c.is_lowercase())
            && self.password.chars().any(|c| c.is_numeric())
            && self.password.chars().any(|c| c.is_ascii_punctuation())
    }

    fn is_valid_username(&self) -> bool {
        self.username.len() >= 3
            && self.username.len() <= 30
            && self
                .username
                .chars()
                .all(|c| c.is_alphanumeric() || c == '_')
    }
}

impl LoginRequest {
    /// Validate login request
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.email.is_empty() {
            errors.push("Email is required".to_string());
        }

        if self.password.is_empty() {
            errors.push("Password is required".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}
