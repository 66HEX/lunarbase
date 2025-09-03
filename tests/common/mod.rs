use lunarbase::Config;
use lunarbase::cli::commands::serve::ServeArgs;

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

        enable_redirect: false,
        redirect_port: 80,
        redirect_target_port: None,
        acme: false,
        acme_domain: vec![],
        acme_email: None,
        acme_cache_dir: "./test_acme_cache".to_string(),
        acme_production: false,
    }
}

pub fn create_test_config() -> Result<Config, Box<dyn std::error::Error>> {
    let serve_args = create_test_serve_args();
    Config::from_env_with_args(Some(&serve_args))
}
