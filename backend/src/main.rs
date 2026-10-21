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

    if let Some(input_path) = args.input {
        println!("=== Testing file: {:?} ===", input_path);
        let ext = input_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if ext == "pdf" {
            let res = services::sertipikat::process_sertipikat_file(&input_path, 3.0).await?;
            println!("Result data:\n{}", serde_json::to_string_pretty(&res.data)?);
        } else {
            let engine = windows::Media::Ocr::OcrEngine::TryCreateFromUserProfileLanguages()?;
            let img = image::open(&input_path)?.to_rgba8();
            let lines = core::ocr::run_ocr_on_image(&img, &engine).await?;
            for (idx, line) in lines.iter().enumerate() {
                println!("{:2}: {}", idx, line);
            }
        }
        return Ok(());
    }

    // Jika dipanggil tanpa argumen file input, jalankan server API di port 3001
    server::start_server(args.port).await
}
