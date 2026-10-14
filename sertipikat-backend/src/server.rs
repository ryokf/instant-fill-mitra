use std::net::SocketAddr;
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
use sertipikat_backend::process_sertipikat_file;

pub async fn start_server(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/extract-sertipikat", post(extract_sertipikat_handler))
        .route("/api/sertipikat", post(extract_sertipikat_handler))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // max 50MB
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("=======================================================");
    println!("  Service Sertipikat Backend Aktif!                    ");
    println!("  URL Server : http://127.0.0.1:{}", port);
    println!("  Endpoint   : POST http://127.0.0.1:{}/api/extract-sertipikat", port);
    println!("  Status     : Siap menerima upload dokumen Pengecekan");
    println!("=======================================================");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "sertipikat-backend",
        "version": "0.1.0"
    }))
}

async fn extract_sertipikat_handler(mut multipart: Multipart) -> Response {
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
                    "error": "Tidak ada berkas yang diunggah."
                })),
            ).into_response();
        }
    };

    let ext = if original_name.to_lowercase().ends_with(".png") {
        "png"
    } else if original_name.to_lowercase().ends_with(".jpg") || original_name.to_lowercase().ends_with(".jpeg") {
        "jpg"
    } else {
        "pdf"
    };

    let temp_dir = std::env::temp_dir();
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let temp_file_path = temp_dir.join(format!("sertipikat_upload_{}.{}", timestamp, ext));

    if let Err(e) = tokio::fs::write(&temp_file_path, &bytes).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "error": format!("Gagal menyimpan berkas sementara: {}", e)
            })),
        ).into_response();
    }

    println!("[API] Memproses berkas sertipikat: {} ({} bytes)...", original_name, bytes.len());

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
            process_sertipikat_file(&path_clone, 2.0)
                .await
                .map_err(|e| e.to_string())
        });
        let _ = tx.send(res);
    });

    let process_result = match rx.await {
        Ok(res) => res,
        Err(_) => Err("Worker thread pengolah sertipikat terputus.".to_string()),
    };

    // Bersihkan file sementara
    let _ = tokio::fs::remove_file(&temp_file_path).await;

    match process_result {
        Ok(result) => {
            println!(
                "[API] Berhasil mengekstrak data sertipikat: No Berkas: {}/{}, NIB: {}",
                result.data.nomor_berkas, result.data.tahun_berkas, result.data.nib_elektronik
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data sertipikat dan nomor berkas berhasil diekstrak dari dokumen.",
                    "data": result.data,
                    "meta": {
                        "page_number": result.page_number,
                        "total_pages": result.total_pages,
                        "rotation": result.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err(e) => {
            eprintln!("[API Error] Gagal mengekstrak sertipikat: {}", e);
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak sertipikat: {}", e)
                })),
            ).into_response()
        }
    }
}
