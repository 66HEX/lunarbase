use serde::Deserialize;
use crate::cli::commands::serve::ServeArgs;

#[derive(Debug, Deserialize, Clone, Default)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub jwt_secret: String,
    pub password_pepper: String,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,

    pub admin_email: Option<String>,
    pub admin_password: Option<String>,
    pub admin_username: Option<String>,
    pub resend_api_key: Option<String>,
    pub email_from: Option<String>,
    pub frontend_url: String,
    pub s3_bucket_name: Option<String>,
    pub s3_region: Option<String>,
    pub s3_access_key_id: Option<String>,
    pub s3_secret_access_key: Option<String>,
    pub s3_endpoint_url: Option<String>,
    pub tls_cert_path: Option<String>,
    pub tls_key_path: Option<String>,
    pub enable_tls: Option<bool>,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Self::from_env_with_args(None)
    }

    pub fn from_env_with_args(serve_args: Option<&ServeArgs>) -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        let (server_host, server_port) = if let Some(args) = serve_args {
            (args.host(), args.port())
        } else {
            ("127.0.0.1".to_string(), 3000)
        };

        let enable_tls = if let Some(args) = serve_args {
            if args.tls {
                Some(true)
            } else {
                Some(false)
            }
        } else {
            Some(false)
        };

        let tls_cert_path = if let Some(args) = serve_args {
            args.tls_cert.as_ref().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let tls_key_path = if let Some(args) = serve_args {
            args.tls_key.as_ref().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let config = Config {
            database_url: std::env::var("DATABASE_URL").unwrap_or_else(|_| "db.sqlite".to_string()),
            server_host: server_host.clone(),
            server_port,
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key".to_string()),
            password_pepper: std::env::var("PASSWORD_PEPPER")
                .unwrap_or_else(|_| "default-pepper-change-in-production".to_string()),
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").ok(),
            google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").ok(),
            github_client_id: std::env::var("GITHUB_CLIENT_ID").ok(),
            github_client_secret: std::env::var("GITHUB_CLIENT_SECRET").ok(),

            admin_email: std::env::var("LUNARBASE_ADMIN_EMAIL").ok(),
            admin_password: std::env::var("LUNARBASE_ADMIN_PASSWORD").ok(),
            admin_username: std::env::var("LUNARBASE_ADMIN_USERNAME").ok(),
            resend_api_key: std::env::var("RESEND_API_KEY").ok(),
            email_from: std::env::var("EMAIL_FROM").ok(),
            frontend_url: Self::build_frontend_url(&server_host, server_port, enable_tls.unwrap_or(false)),
            s3_bucket_name: std::env::var("S3_BUCKET_NAME").ok(),
            s3_region: std::env::var("S3_REGION").ok(),
            s3_access_key_id: std::env::var("S3_ACCESS_KEY_ID").ok(),
            s3_secret_access_key: std::env::var("S3_SECRET_ACCESS_KEY").ok(),
            s3_endpoint_url: std::env::var("S3_ENDPOINT_URL").ok(),
            tls_cert_path,
            tls_key_path,
            enable_tls,
        };

        Ok(config)
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }

    fn build_frontend_url(host: &str, port: u16, tls_enabled: bool) -> String {
        let scheme = if tls_enabled { "https" } else { "http" };
        format!("{}://{}:{}", scheme, host, port)
    }

    pub fn has_admin_config(&self) -> bool {
        self.admin_email.is_some() && self.admin_password.is_some() && self.admin_username.is_some()
    }
}
