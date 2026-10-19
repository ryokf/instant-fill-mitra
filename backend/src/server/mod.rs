pub mod handlers;

use std::net::SocketAddr;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Health Check
        .route("/health", get(handlers::health_check))
        .route("/api/health", get(handlers::health_check))
        // Pembeli (Akta)
        .route("/api/extract-pembeli", post(handlers::extract_pembeli_handler))
        .route("/api/pembeli", post(handlers::extract_pembeli_handler))
        // BPHTB & PBB
        .route("/api/extract-bphtb", post(handlers::extract_bphtb_handler))
        .route("/api/bphtb", post(handlers::extract_bphtb_handler))
        // Sertipikat
        .route("/api/extract-sertipikat", post(handlers::extract_sertipikat_handler))
        .route("/api/sertipikat", post(handlers::extract_sertipikat_handler))
        // PPh
        .route("/api/extract-pph", post(handlers::extract_pph_handler))
        .route("/api/pph", post(handlers::extract_pph_handler))
        // PT Documents (Akta Pendirian & NPWP)
        .route("/api/pt-files-info", get(handlers::get_pt_files_info_handler))
        .route("/api/pt-file", get(handlers::get_pt_file_download_handler))
        .route("/api/pt-file-download", get(handlers::get_pt_file_download_handler))
        // Pembeli Documents (KK, KTP, PBB, BPHTB, PPh)
        .route("/api/pembeli-files-info", get(handlers::get_pembeli_files_info_handler))
        .route("/api/pembeli-file", get(handlers::get_pembeli_file_download_handler))
        .route("/api/pembeli-file-download", get(handlers::get_pembeli_file_download_handler))
        .route("/api/extract-pembeli-bphtb", get(handlers::extract_pembeli_bphtb_handler))
        .route("/api/extract-pembeli-pph", get(handlers::extract_pembeli_pph_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB max upload
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("=======================================================");
    println!("  ⚡ Service Backend Terpadu (AutoFill PPAT) Aktif!    ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Layanan Aktif Secara Bersamaan (Paralel):             ");
    println!("  1. Akta & Pembeli : POST /api/extract-pembeli       ");
    println!("  2. PBB & BPHTB    : POST /api/extract-bphtb         ");
    println!("  3. Sertipikat     : POST /api/extract-sertipikat     ");
    println!("  4. Bukti PPh      : POST /api/extract-pph           ");
    println!("  5. PT Dokumen     : GET  /api/pt-file (Akta & NPWP) ");
    println!("=======================================================");

    loop {
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[Server Error] Gagal bind ke port {}: {}. Mencoba lagi dalam 1 detik...", port, e);
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                continue;
            }
        };

        if let Err(e) = axum::serve(listener, app.clone()).await {
            eprintln!("[Server Error] axum::serve berhenti: {}. Merestart server dalam 500ms...", e);
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        } else {
            break;
        }
    }
    Ok(())
}
