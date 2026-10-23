pub mod parser;

use std::path::Path;
use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Data::Pdf::PdfDocument;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;

use crate::core::pdf::render_pdf_page_fitted;
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

fn binarize_rgba(img: &image::RgbaImage, threshold: u8) -> image::RgbaImage {
    let mut out = image::RgbaImage::new(img.width(), img.height());
    for (x, y, p) in img.enumerate_pixels() {
        let lum = (p[0] as u32 * 299 + p[1] as u32 * 587 + p[2] as u32 * 114) / 1000;
        let val = if lum < threshold as u32 { 0 } else { 255 };
        out.put_pixel(x, y, image::Rgba([val as u8, val as u8, val as u8, 255]));
    }
    out
}

fn merge_sertipikat_data(dest: &mut parser::SertipikatData, src: parser::SertipikatData) {
    if dest.nomor_berkas.is_empty() && !src.nomor_berkas.is_empty() {
        dest.nomor_berkas = src.nomor_berkas;
        dest.tahun_berkas = src.tahun_berkas;
    }
    if (dest.nib_elektronik.is_empty() || dest.nib_elektronik.len() < 13) && !src.nib_elektronik.is_empty() {
        if src.nib_elektronik.len() >= dest.nib_elektronik.len() {
            dest.nib_elektronik = src.nib_elektronik;
        }
    }
    if dest.nib.is_empty() && !src.nib.is_empty() {
        dest.nib = src.nib;
    }
    if dest.nomor_seri_blangko.is_empty() && !src.nomor_seri_blangko.is_empty() {
        dest.nomor_seri_blangko = src.nomor_seri_blangko;
    }
    if dest.desa.is_empty() && !src.desa.is_empty() {
        dest.desa = src.desa;
    }
    if dest.kecamatan.is_empty() && !src.kecamatan.is_empty() {
        dest.kecamatan = src.kecamatan;
    }
    if dest.kabupaten.is_empty() && !src.kabupaten.is_empty() {
        dest.kabupaten = src.kabupaten;
    }
    if dest.provinsi.is_empty() && !src.provinsi.is_empty() {
        dest.provinsi = src.provinsi;
    }
    if dest.jenis_hak.is_empty() && !src.jenis_hak.is_empty() {
        dest.jenis_hak = src.jenis_hak;
    }
    if dest.nama_pemilik.is_empty() && !src.nama_pemilik.is_empty() {
        dest.nama_pemilik = src.nama_pemilik;
    }
    if dest.ntpn.is_empty() && !src.ntpn.is_empty() {
        dest.ntpn = src.ntpn;
    }
    if dest.luas_m2.is_empty() && !src.luas_m2.is_empty() {
        dest.luas_m2 = src.luas_m2;
    }
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

        // Resolusi render optimal untuk dokumen cek sertipikat (1600 - 2400 px)
        let effective_scale = if scale <= 0.0 { 1.8 } else { scale };
        let base_img = render_pdf_page_fitted(&doc, 0, effective_scale, 1600.0, 2400.0).await?.to_rgba8();

        let mut best_lines = Vec::new();
        let mut best_score = 0;
        let mut best_rot = 0;
        let mut best_rot_img = base_img.clone();

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
                best_rot_img = rot_img;
                if s >= 30 {
                    break;
                }
            }
        }

        if best_score < 5 && total_pages > 1 {
            let base_img2 = render_pdf_page_fitted(&doc, 1, effective_scale, 1600.0, 2400.0).await?.to_rgba8();
            for rot in &[270, 90, 0, 180] {
                let rot_img = rotate_rgba(&base_img2, *rot);
                let lines = run_ocr_on_image(&rot_img, &engine).await?;
                let s = score_sertipikat_lines(&lines);
                if s > best_score {
                    best_score = s;
                    best_lines = lines;
                    best_rot = *rot;
                    best_rot_img = rot_img;
                }
            }
        }

        let mut data = parser::parse_sertipikat_text(&best_lines);

        // Fallback 1: Binarization / Thresholding
        // Menghilangkan bayangan scanner dan bekas lipatan kertas yang sering mengaburkan digit NIB / Nomor Berkas
        if data.nomor_berkas.is_empty() || data.nib_elektronik.len() < 13 || data.nomor_seri_blangko.is_empty() {
            let bin_img = binarize_rgba(&best_rot_img, 160);
            if let Ok(bin_lines) = run_ocr_on_image(&bin_img, &engine).await {
                let bin_data = parser::parse_sertipikat_text(&bin_lines);
                merge_sertipikat_data(&mut data, bin_data);
            }
        }

        // Fallback 2: Jika nomor berkas masih kosong, uji coba render alternatif (skala 2.4)
        if data.nomor_berkas.is_empty() {
            if let Ok(alt_img) = render_pdf_page_fitted(&doc, 0, 2.4, 2400.0, 3200.0).await {
                let rot_img = rotate_rgba(&alt_img.to_rgba8(), best_rot);
                if let Ok(retry_lines) = run_ocr_on_image(&rot_img, &engine).await {
                    let retry_data = parser::parse_sertipikat_text(&retry_lines);
                    merge_sertipikat_data(&mut data, retry_data);
                }
            }
        }

        // Fallback 3: Skala 1.5 jika masih kosong
        if data.nomor_berkas.is_empty() {
            if let Ok(low_img) = render_pdf_page_fitted(&doc, 0, 1.5, 1400.0, 2000.0).await {
                let rot_img = rotate_rgba(&low_img.to_rgba8(), best_rot);
                if let Ok(retry_lines) = run_ocr_on_image(&rot_img, &engine).await {
                    let retry_data = parser::parse_sertipikat_text(&retry_lines);
                    merge_sertipikat_data(&mut data, retry_data);
                }
            }
        }

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
        let mut best_rot_img = base_img.clone();

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
                best_rot_img = rot_img;
                if s >= 30 {
                    break;
                }
            }
        }

        let mut data = parser::parse_sertipikat_text(&best_lines);

        if data.nomor_berkas.is_empty() || data.nib_elektronik.len() < 13 || data.nomor_seri_blangko.is_empty() {
            let bin_img = binarize_rgba(&best_rot_img, 160);
            if let Ok(bin_lines) = run_ocr_on_image(&bin_img, &engine).await {
                let bin_data = parser::parse_sertipikat_text(&bin_lines);
                merge_sertipikat_data(&mut data, bin_data);
            }
        }

        Ok(SertipikatResult {
            success: true,
            page_number: 1,
            total_pages: 1,
            rotation_applied: best_rot,
            data,
        })
    }
}
