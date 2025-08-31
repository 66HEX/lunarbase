use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "lunarbase")]
#[command(about = "A security-first database management platform")]
#[command(version)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    Serve(crate::cli::commands::serve::ServeArgs),
}