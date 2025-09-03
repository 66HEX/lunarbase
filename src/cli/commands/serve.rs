use clap::Args;
use std::path::PathBuf;

#[derive(Args)]
#[command(about = "Start the LunarBase server")]
pub struct ServeArgs {
    #[arg(short = 'H', long, help = "Host to bind the server to")]
    pub host: Option<String>,

    #[arg(short, long, help = "Path to configuration file")]
    pub config: Option<PathBuf>,

    #[arg(long, help = "Run API-only mode without frontend")]
    pub api_only: bool,

    #[arg(long, help = "Enable HTTP compression")]
    pub compression: bool,

    #[arg(long, help = "Compression level (1-9)", default_value = "6")]
    pub compression_level: u8,

    #[arg(long, help = "Disable gzip compression")]
    pub no_gzip: bool,

    #[arg(long, help = "Disable brotli compression")]
    pub no_brotli: bool,

    #[arg(long, help = "Disable deflate compression")]
    pub no_deflate: bool,

    #[arg(long, help = "Enable HTTP to HTTPS redirect server")]
    pub enable_redirect: bool,



    #[arg(
        long,
        help = "Enable ACME/Let's Encrypt automatic certificate management"
    )]
    pub acme: bool,

    #[arg(
        long,
        help = "Domains for ACME certificate (can be specified multiple times)"
    )]
    pub acme_domain: Vec<String>,

    #[arg(long, help = "Contact email for ACME registration")]
    pub acme_email: Option<String>,

    #[arg(
        long,
        help = "Directory for ACME certificate cache",
        default_value = "./acme_cache"
    )]
    pub acme_cache_dir: String,

    #[arg(
        long,
        help = "Use Let's Encrypt production environment (default: staging)"
    )]
    pub acme_production: bool,
}

impl ServeArgs {
    pub fn host(&self) -> String {
        self.host.clone().unwrap_or_else(|| "127.0.0.1".to_string())
    }

    pub fn port(&self) -> u16 {
        if self.acme {
            443
        } else {
            3000
        }
    }

    pub fn redirect_port(&self) -> u16 {
        80
    }

    pub fn redirect_target_port(&self) -> u16 {
        self.port()
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.host(), self.port())
    }
}
