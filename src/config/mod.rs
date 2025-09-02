use crate::cli::commands::serve::ServeArgs;
use crate::services::configuration_service::ConfigurationService;
use serde::Deserialize;

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
    pub acme_enabled: Option<bool>,
    pub acme_domains: Vec<String>,
    pub acme_email: Option<String>,
    pub acme_cache_dir: Option<String>,
    pub acme_production: Option<bool>,
}

impl Config {
    pub fn from_env() -> Result<Self, Box<dyn std::error::Error>> {
        Self::from_env_with_args(None)
    }

    pub fn from_env_with_args(
        serve_args: Option<&ServeArgs>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        dotenvy::dotenv().ok();

        let (server_host, server_port) = if let Some(args) = serve_args {
            (args.host(), args.port())
        } else {
            ("127.0.0.1".to_string(), 3000)
        };

        let enable_tls = if let Some(args) = serve_args {
            if args.tls { Some(true) } else { Some(false) }
        } else {
            Some(false)
        };

        let tls_cert_path = if let Some(args) = serve_args {
            args.tls_cert
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        let tls_key_path = if let Some(args) = serve_args {
            args.tls_key
                .as_ref()
                .map(|p| p.to_string_lossy().to_string())
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
            google_client_id: None,
            google_client_secret: None,
            github_client_id: None,
            github_client_secret: None,

            admin_email: std::env::var("LUNARBASE_ADMIN_EMAIL").ok(),
            admin_password: std::env::var("LUNARBASE_ADMIN_PASSWORD").ok(),
            admin_username: std::env::var("LUNARBASE_ADMIN_USERNAME").ok(),
            resend_api_key: None,
            email_from: None,
            frontend_url: Self::build_frontend_url(
                &server_host,
                server_port,
                enable_tls.unwrap_or(false),
            ),
            s3_bucket_name: None,
            s3_region: None,
            s3_access_key_id: None,
            s3_secret_access_key: None,
            s3_endpoint_url: None,
            tls_cert_path,
            tls_key_path,
            enable_tls,

            acme_enabled: if let Some(args) = serve_args {
                if args.acme { Some(true) } else { Some(false) }
            } else {
                std::env::var("ACME_ENABLED")
                    .ok()
                    .and_then(|v| v.parse().ok())
            },
            acme_domains: if let Some(args) = serve_args {
                args.acme_domain.clone()
            } else {
                std::env::var("ACME_DOMAINS")
                    .ok()
                    .map(|domains| domains.split(',').map(|s| s.trim().to_string()).collect())
                    .unwrap_or_default()
            },
            acme_email: if let Some(args) = serve_args {
                args.acme_email.clone()
            } else {
                std::env::var("ACME_EMAIL").ok()
            },
            acme_cache_dir: if let Some(args) = serve_args {
                Some(args.acme_cache_dir.clone())
            } else {
                std::env::var("ACME_CACHE_DIR").ok()
            },
            acme_production: if let Some(args) = serve_args {
                Some(args.acme_production)
            } else {
                std::env::var("ACME_PRODUCTION")
                    .ok()
                    .and_then(|v| v.parse().ok())
            },
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

    pub async fn load_dynamic_settings(&mut self, config_service: &ConfigurationService) -> Result<(), Box<dyn std::error::Error>> {
        // Load OAuth settings
        if let Ok(Some(google_client_id)) = config_service.get_setting_value("oauth", "google_client_id").await {
            if !google_client_id.is_empty() {
                self.google_client_id = Some(google_client_id);
            }
        }
        if let Ok(Some(google_client_secret)) = config_service.get_setting_value("oauth", "google_client_secret").await {
            if !google_client_secret.is_empty() {
                self.google_client_secret = Some(google_client_secret);
            }
        }
        if let Ok(Some(github_client_id)) = config_service.get_setting_value("oauth", "github_client_id").await {
            if !github_client_id.is_empty() {
                self.github_client_id = Some(github_client_id);
            }
        }
        if let Ok(Some(github_client_secret)) = config_service.get_setting_value("oauth", "github_client_secret").await {
            if !github_client_secret.is_empty() {
                self.github_client_secret = Some(github_client_secret);
            }
        }

        if let Ok(Some(resend_api_key)) = config_service.get_setting_value("email", "resend_api_key").await {
            if !resend_api_key.is_empty() {
                self.resend_api_key = Some(resend_api_key);
            }
        }
        if let Ok(Some(email_from)) = config_service.get_setting_value("email", "email_from").await {
            if !email_from.is_empty() {
                self.email_from = Some(email_from);
            }
        }

        if let Ok(Some(s3_bucket_name)) = config_service.get_setting_value("storage", "s3_bucket_name").await {
            if !s3_bucket_name.is_empty() {
                self.s3_bucket_name = Some(s3_bucket_name);
            }
        }
        if let Ok(Some(s3_region)) = config_service.get_setting_value("storage", "s3_region").await {
            if !s3_region.is_empty() {
                self.s3_region = Some(s3_region);
            }
        }
        if let Ok(Some(s3_access_key_id)) = config_service.get_setting_value("storage", "s3_access_key_id").await {
            if !s3_access_key_id.is_empty() {
                self.s3_access_key_id = Some(s3_access_key_id);
            }
        }
        if let Ok(Some(s3_secret_access_key)) = config_service.get_setting_value("storage", "s3_secret_access_key").await {
            if !s3_secret_access_key.is_empty() {
                self.s3_secret_access_key = Some(s3_secret_access_key);
            }
        }
        if let Ok(Some(s3_endpoint_url)) = config_service.get_setting_value("storage", "s3_endpoint_url").await {
            if !s3_endpoint_url.is_empty() {
                self.s3_endpoint_url = Some(s3_endpoint_url);
            }
        }

        Ok(())
    }
}
