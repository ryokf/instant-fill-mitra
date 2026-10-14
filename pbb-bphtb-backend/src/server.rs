use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use axum::{
    extract::{DefaultBodyLimit, Multipart},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};
use pbb_bphtb_backend::process_bphtb_file;

pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/extract-bphtb", post(extract_bphtb_handler))
        .route("/api/bphtb", post(extract_bphtb_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // max 50MB
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("=======================================================");
    println!("  Service PBB & BPHTB Backend Aktif!                   ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Endpoint   : POST http://127.0.0.1:{}/api/extract-bphtb", port);
    println!("  Status     : Siap menerima upload dokumen BPHTB     ");
    println!("=======================================================");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "pbb-bphtb-backend",
        "version": "0.1.0"
    }))
}

async fn extract_bphtb_handler(mut multipart: Multipart) -> Response {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut original_name = String::from("document.pdf");

    while let Ok(Some(field)) = multipart.next_field().await {
        let fname = field.file_name().map(|s| s.to_string());
        if let Ok(bytes) = field.bytes().await {
            if !bytes.is_empty() {
                if let Some(f) = fname {
                    original_name = f;
                }
                file_bytes = Some(bytes.to_vec());
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
                    "error": "Tidak ada file dokumen BPHTB yang diunggah. Pastikan menyertakan form data berkas PDF atau gambar."
                })),
            ).into_response();
        }
    };

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir();
    let temp_file_path: PathBuf = temp_dir.join(format!("bphtb_upload_{}_{}", timestamp, original_name));

    if let Err(e) = tokio::fs::write(&temp_file_path, &bytes).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "error": format!("Gagal menyimpan file sementara: {}", e)
            })),
        ).into_response();
    }

    println!("[API] Memproses berkas BPHTB: {} ({} bytes)...", original_name, bytes.len());

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
            process_bphtb_file(&path_clone, 1.5)
                .await
                .map_err(|e| e.to_string())
        });
        let _ = tx.send(res);
    });

    let result = match rx.await {
        Ok(res) => res,
        Err(_) => Err("Worker thread pengolah BPHTB terputus.".to_string()),
    };

    let _ = tokio::fs::remove_file(&temp_file_path).await;

    match result {
        Ok(res) => {
            println!(
                "[API] Berhasil mengekstrak BPHTB - NOP: {}, Luas: {}, NJOP: {}, No. Bukti: {}",
                res.data.nop, res.data.luas_tanah, res.data.njop_m2, res.data.nomor_bukti_pembayaran
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data BPHTB berhasil diekstrak.",
                    "data": res.data,
                    "meta": {
                        "page_number": res.page_number,
                        "total_pages": res.total_pages,
                        "rotation": res.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err(e) => {
            eprintln!("[API] Gagal mengekstrak BPHTB: {}", e);
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data BPHTB: {}", e)
                })),
            ).into_response()
        }
    }
}
