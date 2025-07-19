use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub jwt_secret: String,
    // Admin configuration
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    pub admin_username: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        let config = Config {
            database_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "db.sqlite".to_string()),
            server_host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            server_port: std::env::var("SERVER_PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()?,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key".to_string()),
            // Admin configuration - all optional
            admin_email: std::env::var("LUNARBASE_ADMIN_EMAIL").ok(),
            admin_password: std::env::var("LUNARBASE_ADMIN_PASSWORD").ok(),
            admin_username: std::env::var("LUNARBASE_ADMIN_USERNAME").ok(),
        };

        Ok(config)
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }

    /// Check if admin configuration is complete
    pub fn has_admin_config(&self) -> bool {
        self.admin_email.is_some() && self.admin_password.is_some() && self.admin_username.is_some()
    }
}
