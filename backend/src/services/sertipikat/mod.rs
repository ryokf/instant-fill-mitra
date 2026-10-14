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
pub struct SertipikatResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub data: parser::SertipikatData,
}

fn score_sertipikat_lines(lines: &[String]) -> usize {
    let mut score = 0;
    for line in lines {
        let low = line.to_lowercase();
        if low.contains("pengecekan sertipikat") || low.contains("sertipikat") { score += 10; }
        if low.contains("no berkas") || low.contains("nomor berkas") || low.contains("berkas") { score += 8; }
        if low.contains("nib") { score += 6; }
        if low.contains("pertanahan") || low.contains("agraria") { score += 5; }
        if low.contains("ntpn") { score += 5; }
        if low.contains("hak guna bangunan") || low.contains("hak milik") || low.contains("hak pakai") { score += 5; }
    }
    score
}

/// Proses berkas dokumen Pengecekan Sertipikat (PDF atau Citra) dan ekstrak nomor berkas, NIB, dsb.
pub async fn process_sertipikat_file(
    file_path: &Path,
    scale: f32,
) -> Result<SertipikatResult, Box<dyn std::error::Error>> {
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
            let s = score_sertipikat_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 30 {
                    break;
                }
            }
        }

        if best_score < 5 && total_pages > 1 {
            let base_img2 = render_pdf_page(&doc, 1, scale).await?.to_rgba8();
            for rot in &[270, 90, 0, 180] {
                let rot_img = rotate_rgba(&base_img2, *rot);
                let lines = run_ocr_on_image(&rot_img, &engine).await?;
                let s = score_sertipikat_lines(&lines);
                if s > best_score {
                    best_score = s;
                    best_lines = lines;
                    best_rot = *rot;
                }
            }
        }

        let data = parser::parse_sertipikat_text(&best_lines);

        Ok(SertipikatResult {
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
            let s = score_sertipikat_lines(&lines);
            if s > best_score {
                best_score = s;
                best_lines = lines;
                best_rot = rot;
                if s >= 30 {
                    break;
                }
            }
        }

        let data = parser::parse_sertipikat_text(&best_lines);

        Ok(SertipikatResult {
            success: true,
            page_number: 1,
            total_pages: 1,
            rotation_applied: best_rot,
            data,
        })
    }
}
