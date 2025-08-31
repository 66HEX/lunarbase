use clap::Parser;
use lunarbase::cli::{Cli, Commands};
use lunarbase::server::run_server;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Serve(serve_args) => {
            run_server(&serve_args).await?;
        }
    }

    Ok(())
}
