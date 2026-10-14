pub mod parser;

use std::path::Path;
use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Data::Pdf::PdfDocument;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;

use crate::core::pdf::render_pdf_page;
use crate::core::ocr::run_ocr_on_image;
use crate::core::image_utils::rotate_rgba;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PphResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub data: parser::PphData,
}

fn score_pph_lines(lines: &[String]) -> usize {
    let mut score = 0;
    for line in lines {
        let low = line.to_lowercase();
        if low.contains("surat keterangan") { score += 8; }
        if low.contains("penelitian") { score += 6; }
        if low.contains("pajak penghasilan") || low.contains("pph") { score += 10; }
        if low.contains("kementerian keuangan") || low.contains("direktorat jenderal pajak") { score += 8; }
        if low.contains("wajib pajak") || low.contains("identitas wajib pajak") { score += 10; }
        if low.contains("npwp") { score += 10; }
        if low.contains("ket-") || low.contains("phtb") { score += 15; }
        if low.contains("nomor objek pajak") || low.contains("nop") { score += 6; }
        if low.contains("kode billing") || low.contains("ntpn") { score += 5; }
    }
    score
}

/// Proses berkas dokumen Surat Keterangan PPh (PDF atau Citra) dan ekstrak nomor suket & NPWP
pub async fn process_pph_file(
    file_path: &Path,
    scale: f32,
) -> Result<PphResult, Box<dyn std::error::Error>> {
    let abs_path = std::fs::canonicalize(file_path)?;
    let ext = abs_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()?;

    if ext == "pdf" {
        let path_str = abs_path.to_str().unwrap().trim_start_matches(r"\\?\");
        let storage_file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path_str))?.await?;
        let doc = PdfDocument::LoadFromFileAsync(&storage_file)?.await?;
        let total_pages = doc.PageCount()? as usize;

        if total_pages == 0 {
            return Err("Dokumen PDF tidak memiliki halaman.".into());
        }

        let base_img = render_pdf_page(&doc, 0, scale).await?.to_rgba8();

        let mut best_lines = Vec::new();
        let mut best_score = 0;
        let mut best_rot = 0;

        let candidates: Vec<u32> = if base_img.width() > base_img.height() {
            vec![270, 90, 0, 180]
        } else {
            vec![0, 270, 90, 180]
        };

        for rot in candidates {
            let rot_img = rotate_rgba(&base_img, rot);
            let lines = run_ocr_on_image(&rot_img, &engine).await?;
            let s = score_pph_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 30 {
                    break;
                }
            }
        }

        if best_score < 10 && total_pages > 1 {
            for page_idx in 1..total_pages.min(3) {
                let base_img2 = render_pdf_page(&doc, page_idx as u32, scale).await?.to_rgba8();
                for rot in &[270, 90, 0, 180] {
                    let rot_img = rotate_rgba(&base_img2, *rot);
                    let lines = run_ocr_on_image(&rot_img, &engine).await?;
                    let s = score_pph_lines(&lines);
                    if s > best_score {
                        best_score = s;
                        best_lines = lines;
                        best_rot = *rot;
                    }
                }
            }
        }

        let mut data = parser::parse_pph_text(&best_lines);

        if total_pages > 1 {
            for page_idx in 1..total_pages.min(3) {
                let base_img_next = render_pdf_page(&doc, page_idx as u32, scale).await?.to_rgba8();
                let rot_img = rotate_rgba(&base_img_next, best_rot);
                if let Ok(lines_next) = run_ocr_on_image(&rot_img, &engine).await {
                    let data_next = parser::parse_pph_text(&lines_next);
                    if data.npwp.is_empty() && !data_next.npwp.is_empty() {
                        data.npwp = data_next.npwp;
                        data.npwp_formatted = data_next.npwp_formatted;
                    }
                    if data.nomor_suket.is_empty() && !data_next.nomor_suket.is_empty() {
                        data.nomor_suket = data_next.nomor_suket;
                    }
                    if data.kode_billing.is_empty() && !data_next.kode_billing.is_empty() {
                        data.kode_billing = data_next.kode_billing;
                    }
                    if data.ntpn.is_empty() && !data_next.ntpn.is_empty() {
                        data.ntpn = data_next.ntpn;
                    }
                    if data.jumlah_bayar.is_empty() && !data_next.jumlah_bayar.is_empty() {
                        data.jumlah_bayar = data_next.jumlah_bayar;
                    }
                }
            }
        }

        Ok(PphResult {
            success: true,
            page_number: 1,
            total_pages,
            rotation_applied: best_rot,
            data,
        })
    } else {
        let dyn_img = image::open(&abs_path)?;
        let base_img = dyn_img.to_rgba8();

        let mut best_lines = Vec::new();
        let mut best_score = 0;
        let mut best_rot = 0;

        let candidates: Vec<u32> = if base_img.width() > base_img.height() {
            vec![270, 90, 0, 180]
        } else {
            vec![0, 270, 90, 180]
        };

        for rot in candidates {
            let rot_img = rotate_rgba(&base_img, rot);
            let lines = run_ocr_on_image(&rot_img, &engine).await?;
            let s = score_pph_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 30 {
                    break;
                }
            }
        }

        let data = parser::parse_pph_text(&best_lines);

        Ok(PphResult {
            success: true,
            page_number: 1,
            total_pages: 1,
            rotation_applied: best_rot,
            data,
        })
    }
}
