use serde::Deserialize;

#[derive(Debug, Deserialize, Clone, Default)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub jwt_secret: String,
    pub password_pepper: String,
    // OAuth configuration
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,

    // Admin configuration
    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    pub admin_username: Option<String>,
    // Email configuration
    pub resend_api_key: Option<String>,
    pub email_from: Option<String>,
    pub frontend_url: String,
    // S3 configuration
    pub s3_bucket_name: Option<String>,
    pub s3_region: Option<String>,
    pub s3_access_key_id: Option<String>,
    pub s3_secret_access_key: Option<String>,
    pub s3_endpoint_url: Option<String>, // For LocalStack or custom S3-compatible services
    // TLS configuration (HTTP/2 is automatically enabled with TLS)
    pub tls_cert_path: Option<String>,
    pub tls_key_path: Option<String>,
    pub enable_tls: Option<bool>,
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
            password_pepper: std::env::var("PASSWORD_PEPPER")
                .unwrap_or_else(|_| "default-pepper-change-in-production".to_string()),
            // OAuth configuration - all optional
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").ok(),
            google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").ok(),
            github_client_id: std::env::var("GITHUB_CLIENT_ID").ok(),
            github_client_secret: std::env::var("GITHUB_CLIENT_SECRET").ok(),

            // Admin configuration - all optional
            admin_email: std::env::var("LUNARBASE_ADMIN_EMAIL").ok(),
            admin_password: std::env::var("LUNARBASE_ADMIN_PASSWORD").ok(),
            admin_username: std::env::var("LUNARBASE_ADMIN_USERNAME").ok(),
            // Email configuration
            resend_api_key: std::env::var("RESEND_API_KEY").ok(),
            email_from: std::env::var("EMAIL_FROM").ok(),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            // S3 configuration
            s3_bucket_name: std::env::var("S3_BUCKET_NAME").ok(),
            s3_region: std::env::var("S3_REGION").ok(),
            s3_access_key_id: std::env::var("S3_ACCESS_KEY_ID").ok(),
            s3_secret_access_key: std::env::var("S3_SECRET_ACCESS_KEY").ok(),
            s3_endpoint_url: std::env::var("S3_ENDPOINT_URL").ok(),
            // TLS configuration (HTTP/2 is automatically enabled with TLS)
            tls_cert_path: std::env::var("TLS_CERT_PATH").ok(),
            tls_key_path: std::env::var("TLS_KEY_PATH").ok(),
            enable_tls: std::env::var("ENABLE_TLS")
                .ok()
                .and_then(|v| v.parse().ok())
                .or(Some(false)), // Domyślnie wyłączone (wymaga certyfikatów)
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
