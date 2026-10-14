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
pub struct BphtbResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub data: parser::BphtbData,
}

fn score_bphtb_lines(lines: &[String]) -> usize {
    let mut score = 0;
    for line in lines {
        let low = line.to_lowercase();
        if low.contains("bphtb") { score += 5; }
        if low.contains("sspd") { score += 5; }
        if low.contains("setoran pajak") { score += 5; }
        if low.contains("nomor objek pajak") || low.contains("nop") { score += 4; }
        if low.contains("tanah") || low.contains("bangunan") { score += 3; }
        if low.contains("njop") { score += 4; }
        if low.contains("wajib pajak") { score += 3; }
        if low.contains("briva") { score += 3; }
    }
    score
}

/// Proses berkas dokumen BPHTB (PDF atau Citra) dan ekstrak data PBB/BPHTB
pub async fn process_bphtb_file(
    file_path: &Path,
    scale: f32,
) -> Result<BphtbResult, Box<dyn std::error::Error>> {
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
            vec![90, 270, 0, 180]
        } else {
            vec![0, 90, 270, 180]
        };

        for rot in candidates {
            let rot_img = rotate_rgba(&base_img, rot);
            let lines = run_ocr_on_image(&rot_img, &engine).await?;
            let s = score_bphtb_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 30 {
                    break;
                }
            }
        }

        let data = parser::parse_bphtb_text(&best_lines);

        Ok(BphtbResult {
            success: true,
            page_number: 1,
            total_pages,
            rotation_applied: best_rot,
            data,
        })
    } else {
        let img = image::open(&abs_path)?.to_rgba8();

        let mut best_lines = Vec::new();
        let mut best_score = 0;
        let mut best_rot = 0;

        let candidates = vec![0, 90, 270, 180];
        for rot in candidates {
            let rot_img = rotate_rgba(&img, rot);
            let lines = run_ocr_on_image(&rot_img, &engine).await?;
            let s = score_bphtb_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 15 { break; }
            }
        }

        let data = parser::parse_bphtb_text(&best_lines);

        Ok(BphtbResult {
            success: true,
            page_number: 1,
            total_pages: 1,
            rotation_applied: best_rot,
            data,
        })
    }
}
