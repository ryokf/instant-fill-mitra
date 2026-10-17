use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use axum::{
    body::Body,
    extract::{Multipart, Query},
    http::{header, StatusCode},
    response::{IntoResponse, Json, Response},
};
use serde::Deserialize;
use serde_json::json;

use crate::services::pembeli::process_akta_pdf;
use crate::services::bphtb::process_bphtb_file;
use crate::services::sertipikat::process_sertipikat_file;
use crate::services::pph::process_pph_file;
use crate::services::pt_files::{self, DEFAULT_PT_DIR};
use crate::services::pembeli_files::{self, DEFAULT_PEMBELI_DIR};

pub async fn health_check() -> Response {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "service": "instant-fill-backend",
            "version": "1.0.0",
            "endpoints": [
                "/api/extract-pembeli",
                "/api/extract-bphtb",
                "/api/extract-sertipikat",
                "/api/extract-pph"
            ]
        })),
    ).into_response()
}

/// Helper untuk mengekstrak file bytes dari multipart form-data
async fn extract_file_from_multipart(
    mut multipart: Multipart,
    default_filename: &str,
) -> Result<(String, Vec<u8>), Response> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut original_name = default_filename.to_string();

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

    match file_bytes {
        Some(b) => Ok((original_name, b)),
        None => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Tidak ada berkas yang diunggah. Pastikan menyertakan form-data file."
            })),
        ).into_response()),
    }
}

/// Helper untuk menyimpan berkas sementara dan menjalankannya di dedicated WinRT worker thread
async fn execute_winrt_task<F, Fut, R>(
    prefix: &str,
    original_name: &str,
    bytes: &[u8],
    process_fn: F,
) -> Result<R, (StatusCode, String)>
where
    F: FnOnce(PathBuf) -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<R, Box<dyn std::error::Error>>> + 'static,
    R: Send + 'static,
{
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir();
    let temp_file_path: PathBuf = temp_dir.join(format!("{}_{}_{}", prefix, timestamp, original_name));

    if let Err(e) = tokio::fs::write(&temp_file_path, bytes).await {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Gagal menyimpan berkas sementara: {}", e),
        ));
    }

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
            process_fn(path_clone).await.map_err(|e| e.to_string())
        });
        let _ = tx.send(res);
    });

    let process_result = match rx.await {
        Ok(res) => res,
        Err(_) => Err("Worker thread terputus saat memproses dokumen.".to_string()),
    };

    // Bersihkan file sementara
    let _ = tokio::fs::remove_file(&temp_file_path).await;

    process_result.map_err(|err_msg| (StatusCode::UNPROCESSABLE_ENTITY, err_msg))
}

// -----------------------------------------------------------------------------
// Handler: Extract Pembeli (Akta PDF)
// -----------------------------------------------------------------------------
pub async fn extract_pembeli_handler(multipart: Multipart) -> Response {
    let (filename, bytes) = match extract_file_from_multipart(multipart, "akta.pdf").await {
        Ok(data) => data,
        Err(err_resp) => return err_resp,
    };

    println!("[API: Pembeli] Memproses dokumen akta: {} ({} bytes)...", filename, bytes.len());

    let result = execute_winrt_task("akta_upload", &filename, &bytes, |path| async move {
        process_akta_pdf(&path, 2.0, None).await
    }).await;

    match result {
        Ok(crop_result) => {
            println!(
                "[API: Pembeli] Berhasil - No Akta: {}, Tgl: {}, Nama: {}",
                crop_result.akta_info.nomor_akta,
                crop_result.akta_info.tanggal_akta,
                crop_result.buyer_info.nama
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data akta dan pembeli berhasil diekstrak.",
                    "data": crop_result.buyer_info,
                    "akta": crop_result.akta_info,
                    "penjual": crop_result.penjual_info,
                    "meta": {
                        "page_number": crop_result.page_number,
                        "total_pages": crop_result.total_pages,
                        "rotation": crop_result.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err((code, err_msg)) => {
            eprintln!("[API: Pembeli] Gagal: {}", err_msg);
            (
                code,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data pembeli: {}", err_msg)
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Extract BPHTB
// -----------------------------------------------------------------------------
pub async fn extract_bphtb_handler(multipart: Multipart) -> Response {
    let (filename, bytes) = match extract_file_from_multipart(multipart, "bphtb.pdf").await {
        Ok(data) => data,
        Err(err_resp) => return err_resp,
    };

    println!("[API: BPHTB] Memproses berkas BPHTB: {} ({} bytes)...", filename, bytes.len());

    let result = execute_winrt_task("bphtb_upload", &filename, &bytes, |path| async move {
        process_bphtb_file(&path, 1.5).await
    }).await;

    match result {
        Ok(res) => {
            println!(
                "[API: BPHTB] Berhasil - NOP: {}, Luas: {}, NJOP: {}, No. Bukti: {}",
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
        Err((code, err_msg)) => {
            eprintln!("[API: BPHTB] Gagal: {}", err_msg);
            (
                code,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data BPHTB: {}", err_msg)
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Extract Sertipikat
// -----------------------------------------------------------------------------
pub async fn extract_sertipikat_handler(multipart: Multipart) -> Response {
    let (filename, bytes) = match extract_file_from_multipart(multipart, "sertipikat.pdf").await {
        Ok(data) => data,
        Err(err_resp) => return err_resp,
    };

    println!("[API: Sertipikat] Memproses berkas Sertipikat: {} ({} bytes)...", filename, bytes.len());

    let result = execute_winrt_task("sertipikat_upload", &filename, &bytes, |path| async move {
        process_sertipikat_file(&path, 2.0).await
    }).await;

    match result {
        Ok(res) => {
            println!(
                "[API: Sertipikat] Berhasil - No Berkas: {}, Thn: {}, NIB: {}, Blangko: {}",
                res.data.nomor_berkas, res.data.tahun_berkas, res.data.nib_elektronik, res.data.nomor_seri_blangko
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data pengecekan sertipikat berhasil diekstrak.",
                    "data": res.data,
                    "meta": {
                        "page_number": res.page_number,
                        "total_pages": res.total_pages,
                        "rotation": res.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err((code, err_msg)) => {
            eprintln!("[API: Sertipikat] Gagal: {}", err_msg);
            (
                code,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data pengecekan sertipikat: {}", err_msg)
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Extract PPh
// -----------------------------------------------------------------------------
pub async fn extract_pph_handler(multipart: Multipart) -> Response {
    let (filename, bytes) = match extract_file_from_multipart(multipart, "pph.pdf").await {
        Ok(data) => data,
        Err(err_resp) => return err_resp,
    };

    println!("[API: PPh] Memproses berkas PPh: {} ({} bytes)...", filename, bytes.len());

    let result = execute_winrt_task("pph_upload", &filename, &bytes, |path| async move {
        process_pph_file(&path, 2.0).await
    }).await;

    match result {
        Ok(res) => {
            println!(
                "[API: PPh] Berhasil - No Suket: {}, NPWP: {}, WP: {}",
                res.data.nomor_suket, res.data.npwp, res.data.nama_wp
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "message": "Data bukti PPh berhasil diekstrak.",
                    "data": res.data,
                    "meta": {
                        "page_number": res.page_number,
                        "total_pages": res.total_pages,
                        "rotation": res.rotation_applied
                    }
                })),
            ).into_response()
        }
        Err((code, err_msg)) => {
            eprintln!("[API: PPh] Gagal: {}", err_msg);
            (
                code,
                Json(json!({
                    "success": false,
                    "error": format!("Gagal mengekstrak data bukti PPh: {}", err_msg)
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Info File PT (Akta Pendirian, NPWP, & KTP)
// -----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct PtInfoQuery {
    pub pt_name: String,
    pub person_name: Option<String>,
    pub base_dir: Option<String>,
}

pub async fn get_pt_files_info_handler(Query(query): Query<PtInfoQuery>) -> Response {
    let base_dir = query.base_dir.as_deref().unwrap_or(DEFAULT_PT_DIR);
    println!("[API: PT Info] Mencari info dokumen untuk PT: '{}' di '{}'", query.pt_name, base_dir);

    match pt_files::get_pt_info(base_dir, &query.pt_name, query.person_name.as_deref()) {
        Ok(info) => {
            println!(
                "[API: PT Info] Berhasil - Folder: {}, Akta: {:?}, NPWP: {:?}, KTP: {:?}",
                info.folder_name, info.akta.filename, info.npwp.filename, info.ktp.as_ref().and_then(|k| k.filename.as_ref())
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "data": info
                })),
            ).into_response()
        }
        Err(err) => {
            eprintln!("[API: PT Info] Gagal: {}", err);
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": err
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Download File PT (Akta Pendirian, NPWP, atau KTP)
// -----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct PtDownloadQuery {
    pub pt_name: String,
    pub doc_type: String,
    pub person_name: Option<String>,
    pub base_dir: Option<String>,
}

pub async fn get_pt_file_download_handler(Query(query): Query<PtDownloadQuery>) -> Response {
    let base_dir = query.base_dir.as_deref().unwrap_or(DEFAULT_PT_DIR);
    println!(
        "[API: PT Download] Mengambil berkas jenis '{}' untuk PT: '{}' (person: {:?})",
        query.doc_type, query.pt_name, query.person_name
    );

    let pt_match = match pt_files::find_pt_folder(base_dir, &query.pt_name) {
        Some(m) => m,
        None => {
            let msg = format!("Folder PT untuk '{}' tidak ditemukan di '{}'", query.pt_name, base_dir);
            eprintln!("[API: PT Download] Gagal: {}", msg);
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    let doc_match = match pt_files::find_pt_document(&pt_match.1, &query.doc_type, query.person_name.as_deref()) {
        Some(m) => m,
        None => {
            let msg = format!(
                "Berkas dokumen jenis '{}' tidak ditemukan di folder PT '{}'",
                query.doc_type, pt_match.0
            );
            eprintln!("[API: PT Download] Gagal: {}", msg);
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    let (filename, filepath, _size) = doc_match;
    let bytes = match tokio::fs::read(&filepath).await {
        Ok(b) => b,
        Err(e) => {
            let msg = format!("Gagal membaca berkas '{}': {}", filepath.display(), e);
            eprintln!("[API: PT Download] Error I/O: {}", msg);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    println!(
        "[API: PT Download] Berhasil menyajikan berkas '{}' ({} bytes)",
        filename,
        bytes.len()
    );

    let content_type = if filename.to_uppercase().ends_with(".PDF") {
        "application/pdf"
    } else if filename.to_uppercase().ends_with(".PNG") {
        "image/png"
    } else {
        "image/jpeg"
    };

    let builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", filename),
        )
        .header("x-file-name", filename)
        .header(
            "access-control-expose-headers",
            "Content-Disposition, X-File-Name",
        );

    match builder.body(Body::from(bytes)) {
        Ok(resp) => resp,
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "error": format!("Gagal membangun respons: {}", e)
            })),
        ).into_response(),
    }
}

// -----------------------------------------------------------------------------
// Handler: Info File Pembeli / Pihak Kedua (KK & KTP)
// -----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct PembeliInfoQuery {
    pub buyer_name: String,
    pub base_dir: Option<String>,
}

pub async fn get_pembeli_files_info_handler(Query(query): Query<PembeliInfoQuery>) -> Response {
    let base_dir = query.base_dir.as_deref().unwrap_or(DEFAULT_PEMBELI_DIR);
    println!("[API: Pembeli Info] Mencari dokumen pihak kedua untuk: '{}' di '{}'", query.buyer_name, base_dir);

    match pembeli_files::get_pembeli_info(base_dir, &query.buyer_name) {
        Ok(info) => {
            println!(
                "[API: Pembeli Info] Berhasil - Folder: {}, KK: {:?}, KTP: {:?}",
                info.folder_name, info.kk.filename, info.ktp.filename
            );
            (
                StatusCode::OK,
                Json(json!({
                    "success": true,
                    "data": info,
                    "folder": info.folder_name,
                    "files": {
                        "kk": info.kk.filename,
                        "ktp": info.ktp.filename,
                    }
                })),
            ).into_response()
        }
        Err(err) => {
            eprintln!("[API: Pembeli Info] Gagal: {}", err);
            (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": err
                })),
            ).into_response()
        }
    }
}

// -----------------------------------------------------------------------------
// Handler: Download File Pembeli / Pihak Kedua (KK atau KTP)
// -----------------------------------------------------------------------------
#[derive(Deserialize)]
pub struct PembeliDownloadQuery {
    pub buyer_name: String,
    pub doc_type: String, // "kk" atau "ktp"
    pub base_dir: Option<String>,
}

pub async fn get_pembeli_file_download_handler(Query(query): Query<PembeliDownloadQuery>) -> Response {
    let base_dir = query.base_dir.as_deref().unwrap_or(DEFAULT_PEMBELI_DIR);
    println!(
        "[API: Pembeli Download] Mengambil berkas '{}' untuk pihak kedua: '{}'",
        query.doc_type, query.buyer_name
    );

    let folder_match = match pembeli_files::find_pembeli_folder(base_dir, &query.buyer_name) {
        Some(m) => m,
        None => {
            let msg = format!("Folder pihak kedua untuk '{}' tidak ditemukan di '{}'", query.buyer_name, base_dir);
            eprintln!("[API: Pembeli Download] Gagal: {}", msg);
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    let doc_match = match pembeli_files::find_pembeli_document(&folder_match.1, &query.doc_type) {
        Some(m) => m,
        None => {
            let msg = format!(
                "Berkas dokumen jenis '{}' tidak ditemukan di folder pembeli '{}'",
                query.doc_type, folder_match.0
            );
            eprintln!("[API: Pembeli Download] Gagal: {}", msg);
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    let (filename, filepath, _size) = doc_match;
    let bytes = match tokio::fs::read(&filepath).await {
        Ok(b) => b,
        Err(e) => {
            let msg = format!("Gagal membaca berkas '{}': {}", filepath.display(), e);
            eprintln!("[API: Pembeli Download] Error I/O: {}", msg);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "success": false,
                    "error": msg
                })),
            ).into_response();
        }
    };

    println!(
        "[API: Pembeli Download] Berhasil menyajikan berkas '{}' ({} bytes)",
        filename,
        bytes.len()
    );

    let content_type = if filename.to_uppercase().ends_with(".PDF") {
        "application/pdf"
    } else if filename.to_uppercase().ends_with(".PNG") {
        "image/png"
    } else {
        "image/jpeg"
    };

    let builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", filename),
        )
        .header("x-file-name", filename)
        .header(
            "access-control-expose-headers",
            "Content-Disposition, X-File-Name",
        );

    match builder.body(Body::from(bytes)) {
        Ok(resp) => resp,
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "success": false,
                "error": format!("Gagal membangun respons: {}", e)
            })),
        ).into_response(),
    }
}

