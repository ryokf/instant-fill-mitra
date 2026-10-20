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
        // Pembeli (Akta AJB)
        .route("/api/extract-pembeli", post(handlers::extract_pembeli_handler))
        .route("/api/pembeli", post(handlers::extract_pembeli_handler))
        // Sertipikat (Pengecekan Sertipikat)
        .route("/api/extract-sertipikat", post(handlers::extract_sertipikat_handler))
        .route("/api/sertipikat", post(handlers::extract_sertipikat_handler))
        // PT Documents (Akta Pendirian, NPWP, & KTP Persetujuan)
        .route("/api/pt-files-info", get(handlers::get_pt_files_info_handler))
        .route("/api/pt-file", get(handlers::get_pt_file_download_handler))
        .route("/api/pt-file-download", get(handlers::get_pt_file_download_handler))
        // Pembeli Documents (KK, KTP, PBB, BPHTB, PPh dari folder Pihak Kedua)
        .route("/api/pembeli-files-info", get(handlers::get_pembeli_files_info_handler))
        .route("/api/pembeli-file", get(handlers::get_pembeli_file_download_handler))
        .route("/api/extract-pembeli-bphtb", get(handlers::extract_pembeli_bphtb_handler))
        .route("/api/extract-pembeli-pph", get(handlers::extract_pembeli_pph_handler))
        // Saksi Documents (KTP Saksi G:\My Drive\notaris bu sri\Saksi)
        .route("/api/saksi-file", get(handlers::get_saksi_file_download_handler))
        .route("/api/saksi-file-download", get(handlers::get_saksi_file_download_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB max upload
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("=======================================================");
    println!("  ⚡ Service Backend Terpadu (AutoFill PPAT) Aktif!    ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Layanan Workflow Aktif:                              ");
    println!("  1. Akta AJB        : POST /api/extract-pembeli       ");
    println!("  2. Cek Sertipikat  : POST /api/extract-sertipikat     ");
    println!("  3. Dokumen PT      : GET  /api/pt-file               ");
    println!("  4. Dokumen Pembeli : GET  /api/pembeli-file          ");
    println!("  5. Auto PBB/BPHTB  : GET  /api/extract-pembeli-bphtb ");
    println!("  6. Auto PPh        : GET  /api/extract-pembeli-pph   ");
    println!("  7. Dokumen Saksi   : GET  /api/saksi-file            ");
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
