use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::{info, warn};

use crate::Config;
use crate::models::{NewUser, User};
use crate::schema::users;
use crate::utils::AuthError;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

#[derive(Clone)]
pub struct AdminService {
    pub pool: DbPool,
}

impl AdminService {
    pub fn new(pool: DbPool) -> Self {
        Self { pool }
    }

    /// Create admin user from configuration if it doesn't exist
    pub async fn ensure_admin_exists(
        &self,
        config: &Config,
        pepper: &str,
    ) -> Result<(), AuthError> {
        // Check if admin configuration is provided
        if !config.has_admin_config() {
            info!("No admin configuration provided via environment variables");
            return Ok(());
        }

        let admin_email = config.admin_email.as_ref().unwrap();
        let admin_password = config.admin_password.as_ref().unwrap();
        let admin_username = config.admin_username.as_ref().unwrap();

        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        // Check if admin already exists
        let existing_admin = users::table
            .filter(users::email.eq(admin_email))
            .select(User::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|_| AuthError::DatabaseError)?;

        if existing_admin.is_some() {
            info!("Admin user already exists: {}", admin_email);
            return Ok(());
        }

        // Check if any admin exists (to avoid creating multiple admins)
        let any_admin = users::table
            .filter(users::role.eq("admin"))
            .select(User::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|_| AuthError::DatabaseError)?;

        if any_admin.is_some() {
            warn!(
                "Admin already exists but with different email. Skipping admin creation from environment variables."
            );
            return Ok(());
        }

        // Create new admin user
        let new_admin = NewUser::new_with_role(
            admin_email.clone(),
            admin_password,
            admin_username.clone(),
            "admin".to_string(),
            pepper,
        )
        .map_err(|e| {
            warn!("Failed to create admin user: {}", e);
            AuthError::InternalError
        })?;

        // Insert admin into database
        diesel::insert_into(users::table)
            .values(&new_admin)
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        // Update admin to be verified (since admins should be verified by default)
        diesel::update(users::table.filter(users::email.eq(admin_email)))
            .set(users::is_verified.eq(true))
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        info!(
            "Admin user created successfully: {} ({})",
            admin_email, admin_username
        );
        Ok(())
    }

    /// Get admin user if exists
    pub async fn get_admin(&self) -> Result<Option<User>, AuthError> {
        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let admin = users::table
            .filter(users::role.eq("admin"))
            .select(User::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|_| AuthError::DatabaseError)?;

        Ok(admin)
    }

    /// Check if any admin exists
    pub async fn has_admin(&self) -> Result<bool, AuthError> {
        let admin = self.get_admin().await?;
        Ok(admin.is_some())
    }
}
