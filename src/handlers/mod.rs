pub mod admin;
pub mod auth;
pub mod avatar_proxy;
pub mod collections;
pub mod configuration;
pub mod embedded_admin;
pub mod health;
pub mod metrics;
pub mod ownership;
pub mod permissions;
pub mod record_permissions;
pub mod users;
pub mod websocket;

pub use admin::*;
pub use auth::*;
pub use avatar_proxy::*;
pub use configuration::*;
pub use embedded_admin::*;
pub use health::*;
pub use metrics::*;
pub use ownership::*;
pub use permissions::*;
pub use record_permissions::*;
pub use users::*;
pub use websocket::*;

// Re-export OAuth handlers specifically
pub use auth::{oauth_authorize, oauth_callback, verify_email_get};
