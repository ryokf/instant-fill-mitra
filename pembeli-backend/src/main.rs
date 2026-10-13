mod server;

use std::path::{Path, PathBuf};
use clap::Parser;
use auto_crop_akta::process_akta_pdf;

#[derive(Parser, Debug)]
#[command(name = "auto-crop-akta")]
#[command(author = "DeepMind Pair Programming")]
#[command(version = "0.1.0")]
#[command(about = "Program Ekstraksi Otomatis Data Pembeli pada Akta Tanah / PPAT (PDF) & Backend API Service")]
struct Cli {
    /// Jalur file PDF akta atau folder berisi berkas PDF (jika tidak diisi, otomatis mode server API)
    #[arg(value_name = "INPUT")]
    input: Option<PathBuf>,

    /// Jalankan sebagai HTTP server API untuk ekstensi browser
    #[arg(long, default_value_t = false)]
    serve: bool,

    /// Port untuk HTTP server API (default: 3001)
    #[arg(long, default_value_t = 3001)]
    port: u16,

    /// Jalur file JSON hasil ekstraksi (default: [nama_file].json)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Folder tujuan penyimpanan jika memproses banyak file PDF sekaligus
    #[arg(long)]
    out_dir: Option<PathBuf>,

    /// Simpan data pembeli ke file format JSON (default: true)
    #[arg(long, default_value_t = true)]
    json: bool,

    /// Nilai ID kustom untuk output JSON (default: "12345")
    #[arg(long)]
    id: Option<String>,

    /// Skala resolusi rendering PDF (default: 1.5)
    #[arg(long, default_value_t = 1.5)]
    scale: f32,

    /// Hapus semua dummy, sample data, dan output sementara dari proyek ini
    #[arg(long, default_value_t = false)]
    clean: bool,
}

async fn handle_single_pdf(
    pdf_path: &Path,
    output_json_path: Option<&Path>,
    save_json: bool,
    custom_id: Option<&str>,
    scale: f32,
) -> Result<(), Box<dyn std::error::Error>> {
    println!("\n[MEMPROSES] {} ...", pdf_path.display());

    let result = process_akta_pdf(pdf_path, scale, custom_id).await?;

    println!("[BERHASIL]");
    println!("  * Halaman Ditemukan  : Halaman {} dari {}", result.page_number, result.total_pages);
    println!("  * Rotasi Otomatis    : {} derajat", result.rotation_applied);

    let json_output_str = serde_json::to_string_pretty(&result.buyer_info)?;
    println!("\n--- JSON Data Pembeli ---");
    println!("{}", json_output_str);

    if save_json || output_json_path.is_some() {
        let json_path = if let Some(out) = output_json_path {
            if out.extension().map(|e| e == "json").unwrap_or(false) {
                out.to_path_buf()
            } else {
                out.with_extension("json")
            }
        } else {
            pdf_path.with_extension("json")
        };

        if let Some(parent) = json_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&json_path, &json_output_str)?;
        println!("\n  * File JSON Disimpan : {}", json_path.display());
    }

    Ok(())
}

fn clean_sample_data() -> Result<(), Box<dyn std::error::Error>> {
    println!("\n[BERSIHKAN] Menghapus semua file dummy, sample, dan folder output...");
    let mut count = 0;

    if let Ok(entries) = std::fs::read_dir(".") {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    let should_delete = file_name.ends_with(".pdf")
                        || file_name.starts_with("hasil_")
                        || file_name.starts_with("sample_")
                        || file_name.starts_with("ajb_")
                        || file_name.ends_with("_annotated.png")
                        || file_name.ends_with("_crop_pembeli.png");

                    if should_delete {
                        if let Err(e) = std::fs::remove_file(&path) {
                            eprintln!("  [GAGAL] {}: {}", file_name, e);
                        } else {
                            println!("  [DIHAPUS] {}", file_name);
                            count += 1;
                        }
                    }
                }
            }
        }
    }

    let output_dir = Path::new("output");
    if output_dir.exists() && output_dir.is_dir() {
        if let Err(e) = std::fs::remove_dir_all(output_dir) {
            eprintln!("  [GAGAL] output/: {}", e);
        } else {
            println!("  [DIHAPUS] output/ (direktori)");
            count += 1;
        }
    }

    println!("\n[SELESAI] Sebanyak {} file/folder dummy/sample berhasil dibersihkan.\n", count);
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Cli::parse();

    if args.clean {
        return clean_sample_data();
    }

    // Jika dipanggil dengan flag --serve atau tanpa argumen file input, jalankan server API
    if args.serve || args.input.is_none() {
        return server::start_server(args.port).await;
    }

    let input = args.input.as_ref().unwrap();

    if !input.exists() {
        eprintln!("Error: Jalur input '{}' tidak ditemukan.", input.display());
        std::process::exit(1);
    }

    if input.is_file() {
        let file_stem = input.file_stem().unwrap().to_str().unwrap();
        let default_out = input.with_file_name(format!("{}.json", file_stem));
        let out_path = args.output.unwrap_or(default_out);

        if let Err(e) = handle_single_pdf(
            input,
            Some(&out_path),
            args.json,
            args.id.as_deref(),
            args.scale,
        ).await {
            eprintln!("[GAGAL] Terjadi kesalahan: {}", e);
            std::process::exit(1);
        }
    } else if input.is_dir() {
        let out_dir = args.out_dir.unwrap_or_else(|| input.join("hasil_ekstraksi"));
        std::fs::create_dir_all(&out_dir)?;

        let mut entries = Vec::new();
        for entry in std::fs::read_dir(input)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.to_string_lossy().to_lowercase() == "pdf" {
                        entries.push(path);
                    }
                }
            }
        }

        if entries.is_empty() {
            println!("Tidak ada file PDF ditemukan di folder '{}'.", input.display());
            return Ok(());
        }

        println!("Ditemukan {} file PDF. Menyimpan hasil ke: {}", entries.len(), out_dir.display());
        let mut success_count = 0;

        for pdf in &entries {
            let file_stem = pdf.file_stem().unwrap().to_str().unwrap();
            let out_file = out_dir.join(format!("{}.json", file_stem));

            match handle_single_pdf(
                pdf,
                Some(&out_file),
                args.json,
                args.id.as_deref(),
                args.scale,
            ).await {
                Ok(_) => success_count += 1,
                Err(e) => eprintln!("[GAGAL] {} : {}", pdf.display(), e),
            }
        }

        println!("\n[SELESAI] {} dari {} file berhasil diproses.", success_count, entries.len());
    }

    Ok(())
}
