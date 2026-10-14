mod server;

use std::path::{Path, PathBuf};
use clap::Parser;
use sertipikat_backend::process_sertipikat_file;

#[derive(Parser, Debug)]
#[command(name = "sertipikat-backend")]
#[command(author = "DeepMind Pair Programming")]
#[command(version = "0.1.0")]
#[command(about = "Ekstraksi Otomatis Dokumen Pengecekan Sertipikat untuk Pengisian Berkas & Sertipikat ATR/BPN")]
struct Cli {
    /// Jalur file PDF / gambar dokumen Pengecekan Sertipikat (jika kosong, otomatis menjalankan mode server API)
    #[arg(value_name = "INPUT")]
    input: Option<PathBuf>,

    /// Jalankan sebagai HTTP server API untuk ekstensi browser
    #[arg(long, default_value_t = false)]
    serve: bool,

    /// Port untuk HTTP server API (default: 3003)
    #[arg(long, default_value_t = 3003)]
    port: u16,

    /// Jalur file JSON hasil ekstraksi (opsional)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Skala resolusi rendering PDF (default: 2.0)
    #[arg(long, default_value_t = 2.0)]
    scale: f32,
}

async fn handle_single_file(
    file_path: &Path,
    output_json_path: Option<&Path>,
    scale: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n[MEMPROSES] {} ...", file_path.display());

    let result = process_sertipikat_file(file_path, scale).await?;

    println!("[BERHASIL]");
    println!("  * Halaman           : Halaman {} dari {}", result.page_number, result.total_pages);
    println!("  * Rotasi Otomatis   : {} derajat", result.rotation_applied);

    let json_output_str = serde_json::to_string_pretty(&result.data)?;
    println!("\n--- Data Hasil Ekstraksi Pengecekan Sertipikat ---");
    println!("{}", json_output_str);

    if let Some(out_path) = output_json_path {
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(out_path, &json_output_str)?;
        println!("\n  * Disimpan ke : {}", out_path.display());
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Cli::parse();

    // Jika dipanggil dengan flag --serve atau tanpa argumen file input, jalankan server API
    if args.serve || args.input.is_none() {
        return server::start_server(args.port).await;
    }

    let input = args.input.as_ref().unwrap();

    if !input.exists() {
        eprintln!("Error: Berkas '{}' tidak ditemukan.", input.display());
        std::process::exit(1);
    }

    if let Err(e) = handle_single_file(input, args.output.as_deref(), args.scale).await {
        eprintln!("[GAGAL] Terjadi kesalahan: {}", e);
        std::process::exit(1);
    }

    Ok(())
}
