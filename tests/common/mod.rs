use lunarbase::cli::commands::serve::ServeArgs;
use lunarbase::{Config};

pub fn create_test_serve_args() -> ServeArgs {
    ServeArgs {
        host: Some("127.0.0.1".to_string()),
        port: Some(3000),
        config: None,
        tls: false,
        tls_cert: None,
        tls_key: None,
        api_only: false,
        compression: false,
        compression_level: 6,
        no_gzip: false,
        no_brotli: false,
        no_deflate: false,
    }
}

pub fn create_test_config() -> Result<Config, Box<dyn std::error::Error>> {
    let serve_args = create_test_serve_args();
    Config::from_env_with_args(Some(&serve_args))
}