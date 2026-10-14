use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use axum::{
    extract::{DefaultBodyLimit, Multipart},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use auto_crop_akta::process_akta_pdf;

pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/extract-pembeli", post(extract_pembeli_handler))
        .route("/api/pembeli", post(extract_pembeli_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // max 50MB
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("=======================================================");
    println!("  Service Pembeli Backend (Auto-Fill PPAT) Aktif!     ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Endpoint   : POST http://127.0.0.1:{}/api/extract-pembeli", port);
    println!("  Status     : Siap menerima upload dokumen Akta PDF   ");
    println!("=======================================================");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "pembeli-backend",
        "version": "0.1.0"
    }))
}

use axum::response::{IntoResponse, Response};

async fn extract_pembeli_handler(
    mut multipart: Multipart,
) -> Response {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut original_name = String::from("document.pdf");

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or_default().to_string();
        let fname = field.file_name().map(|s| s.to_string());

        if let Ok(bytes) = field.bytes().await {
            if !bytes.is_empty() {
                if let Some(f) = fname {
                    original_name = f;
                }
                file_bytes = Some(bytes.to_vec());
                let _ = field_name;
                break;
            }
        }
    }

    let bytes = match file_bytes {
        Some(b) => b,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "success": false,
                    "error": "Tidak ada file PDF yang diunggah. Pastikan menyertakan form data file."
                })),
            ).into_response();
        }
    };

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir();
    let temp_file_path: PathBuf = temp_dir.join(format!("akta_upload_{}_{}", timestamp, original_name));

    if let Err(e) = tokio::fs::write(&temp_file_path, &bytes).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "error": format!("Gagal menyimpan file sementara: {}", e)
            })),
        ).into_response();
    }

    println!("[API] Memproses dokumen PDF: {} ({} bytes)...", original_name, bytes.len());

    let path_clone = temp_file_path.clone();
    let (tx, rx) = tokio::sync::oneshot::channel();

    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                let _ = tx.send(Err(format!("Gagal menginisialisasi runtime worker: {}", e)));
                return;
            }
        };

        let res = rt.block_on(async {
            process_akta_pdf(&path_clone, 2.0, None)
                .await
                .map_err(|e| e.to_string())
        });
        let _ = tx.send(res);
    });

    let crop_result = match rx.await {
        Ok(res) => res,
        Err(_) => Err("Worker thread pengolah PDF terputus.".to_string()),
    };

    // Bersihkan file sementara
    let _ = tokio::fs::remove_file(&temp_file_path).await;

    match crop_result {
        Ok(result) => {
            println!("[API] Berhasil mengekstrak data akta (No: {}, Tgl: {}) dan pembeli: {}", result.akta_info.nomor_akta, result.akta_info.tanggal_akta, result.buyer_info.nama);
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data akta dan pembeli berhasil diekstrak dari akta.",
                    "data": result.buyer_info,
                    "akta": result.akta_info,
                    "meta": {
                        "page_number": result.page_number,
                        "total_pages": result.total_pages,
                        "rotation": result.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err(e) => {
            eprintln!("[API] Gagal mengekstrak pembeli: {}", e);
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data pembeli: {}", e)
                })),
            ).into_response()
        }
    }
}
