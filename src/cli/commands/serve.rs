use clap::Args;
use std::path::PathBuf;

#[derive(Args)]
#[command(about = "Start the LunarBase server")]
pub struct ServeArgs {
    #[arg(short = 'H', long, help = "Host to bind the server to")]
    pub host: Option<String>,

    #[arg(short, long, help = "Port to bind the server to")]
    pub port: Option<u16>,

    #[arg(short, long, help = "Path to configuration file")]
    pub config: Option<PathBuf>,

    #[arg(long, help = "Force TLS/HTTPS mode")]
    pub tls: bool,

    #[arg(long, help = "Path to TLS certificate file (PEM format)")]
    pub tls_cert: Option<PathBuf>,

    #[arg(long, help = "Path to TLS private key file (PEM format)")]
    pub tls_key: Option<PathBuf>,

    #[arg(long, help = "Run API-only mode without frontend")]
    pub api_only: bool,
}

impl ServeArgs {
    pub fn host(&self) -> String {
        self.host.clone().unwrap_or_else(|| "127.0.0.1".to_string())
    }

    pub fn port(&self) -> u16 {
        self.port.unwrap_or(3000)
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.host(), self.port())
    }
}
