use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use tracing::{debug, warn};

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

    pub async fn ensure_admin_exists(
        &self,
        config: &Config,
        pepper: &str,
    ) -> Result<(), AuthError> {
        if !config.has_admin_config() {
            debug!("No admin configuration provided via environment variables");
            return Ok(());
        }

        let admin_email = config.admin_email.as_ref().unwrap();
        let admin_password = config.admin_password.as_ref().unwrap();
        let admin_username = config.admin_username.as_ref().unwrap();

        let mut conn = self.pool.get().map_err(|_| AuthError::InternalError)?;

        let existing_admin = users::table
            .filter(users::email.eq(admin_email))
            .select(User::as_select())
            .first(&mut conn)
            .optional()
            .map_err(|_| AuthError::DatabaseError)?;

        if existing_admin.is_some() {
            debug!("Admin user already exists: {}", admin_email);
            return Ok(());
        }

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

        diesel::insert_into(users::table)
            .values(&new_admin)
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        diesel::update(users::table.filter(users::email.eq(admin_email)))
            .set(users::is_verified.eq(true))
            .execute(&mut conn)
            .map_err(|_| AuthError::DatabaseError)?;

        debug!(
            "Admin user created successfully: {} ({})",
            admin_email, admin_username
        );
        Ok(())
    }

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

    pub async fn has_admin(&self) -> Result<bool, AuthError> {
        let admin = self.get_admin().await?;
        Ok(admin.is_some())
    }
}
