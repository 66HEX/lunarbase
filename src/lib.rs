pub mod config;
pub mod database;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod schema;
pub mod services;
pub mod utils;

pub use config::Config;
pub use database::DatabasePool;
use services::CollectionService;

// Application state combining all shared state
#[derive(Clone)]
pub struct AppState {
    pub db_pool: DatabasePool,
    pub auth_state: middleware::AuthState,
    pub collection_service: CollectionService,
}

impl AppState {
    pub fn new(db_pool: DatabasePool, jwt_secret: &str) -> Self {
        let collection_service = CollectionService::new(db_pool.clone());
        
        Self {
            db_pool,
            auth_state: middleware::AuthState::new(jwt_secret),
            collection_service,
        }
    }
} 