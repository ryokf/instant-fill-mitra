mod core;
mod services;
mod server;

use std::path::PathBuf;
use clap::Parser;

#[derive(Parser, Debug)]
#[command(name = "instant-fill-backend")]
#[command(author = "DeepMind Pair Programming")]
#[command(version = "1.0.0")]
#[command(about = "Unified Backend Server untuk AutoFill PPAT Mitra Kerja (Akta Pembeli, PBB/BPHTB, Sertipikat, PPh)")]
struct Cli {
    /// Port untuk HTTP server API (default: 3001)
    #[arg(long, default_value_t = 3001)]
    port: u16,

    /// Jalur file input jika ingin uji coba ekstraksi satu berkas secara manual
    #[arg(value_name = "INPUT")]
    input: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let args = Cli::parse();

    // Jika dipanggil tanpa argumen file input, jalankan server API di port 3001
    server::start_server(args.port).await
}
