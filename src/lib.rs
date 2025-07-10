pub mod config;
pub mod database;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod schema;
pub mod utils;

pub use config::Config;
pub use database::DatabasePool;

// Application state combining all shared state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: DatabasePool,
    pub auth_state: middleware::AuthState,
}

impl AppState {
    pub fn new(db_pool: DatabasePool, jwt_secret: &str) -> Self {
        Self {
            db_pool,
            auth_state: middleware::AuthState::new(jwt_secret),
        }
    }
} 