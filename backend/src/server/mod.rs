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
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB max upload
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("=======================================================");
    println!("  ⚡ Service Backend Terpadu (AutoFill PPAT) Aktif!    ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Layanan Aktif Secara Bersamaan (Paralel):             ");
    println!("  1. Akta & Pembeli : POST /api/extract-pembeli       ");
    println!("  2. PBB & BPHTB    : POST /api/extract-bphtb         ");
    println!("  3. Sertipikat     : POST /api/extract-sertipikat     ");
    println!("  4. Bukti PPh      : POST /api/extract-pph           ");
    println!("=======================================================");

    axum::serve(listener, app).await?;
    Ok(())
}
