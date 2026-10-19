pub mod parser;

use std::path::Path;
use image::{imageops, RgbaImage};
use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Data::Pdf::PdfDocument;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;

use crate::core::pdf::render_pdf_page;
use crate::core::ocr::run_ocr_on_image;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub raw_text: String,
    pub buyer_info: parser::BuyerJsonOutput,
    pub akta_info: parser::AktaInfo,
    pub penjual_info: parser::PenjualOutput,
    pub saksi: Vec<parser::SaksiOutput>,
}

fn is_buyer_conclusion(text: &str) -> bool {
    let lower = text.to_lowercase();
    let normalized = lower
        .replace('1', "l")
        .replace('i', "l")
        .replace('|', "l")
        .replace('!', "l");

    normalized.contains("pihak kedua/pembell")
        || normalized.contains("pihak kedua / pembell")
        || normalized.contains("pihak kedua/ pembell")
        || normalized.contains("pembell\"")
        || normalized.contains("pembell”")
        || (lower.contains("pihak kedua") && (lower.contains("pembe") || lower.contains("/")))
        || (lower.contains("pihak kedua") && (lower.contains("disebut") || lower.contains("singkat")))
}

fn is_buyer_start(text: &str) -> bool {
    let trimmed = text.trim();
    let lower = text.to_lowercase();
    trimmed.starts_with("II.")
        || trimmed.starts_with("11.")
        || trimmed.starts_with("2.")
        || trimmed.starts_with("II-")
        || trimmed.starts_with("11-")
        || trimmed.starts_with("2-")
        || trimmed.starts_with("IL-")
        || trimmed.starts_with("Il-")
        || trimmed.starts_with("1l-")
        || trimmed.starts_with("1L-")
        || trimmed.starts_with("II ")
        || trimmed.starts_with("11 ")
        || trimmed.starts_with("2 ")
        || trimmed.starts_with("II.-")
        || trimmed.starts_with("2.-")
        || lower.starts_with("pihak kedua")
        || lower.starts_with("pihak ke dua")
        || lower.starts_with("pihak ke-dua")
        || lower.contains("selaku pihak kedua")
        || lower.contains("disebut pihak kedua")
        || lower.contains("disebut sebagai pihak kedua")
        || lower.contains("selanjutnya disebut pihak kedua")
        || lower.contains("selaku pembeli")
        || ((lower.starts_with("tuan ") || lower.starts_with("nona ") || lower.starts_with("nyonya ")) 
            && (lower.contains("warga negara") || lower.contains("lahir di")))
}

fn is_seller_conclusion(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("pihak pertama/penjual")
        || lower.contains("pihak pertama / penjual")
        || lower.contains("pihak pertama/ penjual")
        || lower.contains("pihak pertama/penjua1")
        || (lower.contains("pihak pertama") && (lower.contains("penjua") || lower.contains("/")))
        || lower.contains("pihak pertama")
}

fn is_footer_line(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("akta jual beli")
        || lower.contains("akta juaz beti")
        || lower.contains("akta juat beti")
        || lower.contains("halaman ")
        || lower.contains("daerah kerja")
        || lower.contains("lembar ")
}

fn is_header_or_footer_line(text: &str) -> bool {
    let lower = text.to_lowercase();
    is_footer_line(text)
        || lower.contains("pejabat pembuat akta tanah")
        || lower.contains("(ppat)")
        || lower.contains("wahyuning")
        || lower.contains("wahyumng")
        || lower.contains("provinsi")
        || lower.contains("sk. kepala bpn")
        || lower.contains("sk. kep")
        || lower.contains("jalan raya say")
}

pub fn extract_seller_lines_until(
    pages_data: &[(Vec<String>, u32)],
    buyer_start_page: usize,
    buyer_start_line: usize,
) -> String {
    let mut seller_lines: Vec<String> = Vec::new();
    let mut collecting = false;

    for (page_idx, (lines, _)) in pages_data.iter().enumerate() {
        if page_idx > buyer_start_page {
            break;
        }
        for (line_idx, line) in lines.iter().enumerate() {
            if page_idx == buyer_start_page && line_idx >= buyer_start_line {
                break;
            }

            let low = line.to_lowercase();
            if is_header_or_footer_line(line) {
                continue;
            }

            if !collecting {
                let trimmed = line.trim();
                if low.contains("akhir akta ini")
                    || trimmed.starts_with("I.")
                    || trimmed.starts_with("1.")
                    || trimmed.starts_with("I-")
                    || trimmed.starts_with("1-")
                    || trimmed.starts_with("I.-")
                    || trimmed.starts_with("1.-")
                    || trimmed.starts_with("I. ")
                    || trimmed.starts_with("1. ")
                    || low.contains("menghadap kepada saya")
                    || low.contains("hadir di hadapan saya")
                    || low.contains("hadir dihadapan saya")
                    || low.contains("berhadapan dengan saya")
                {
                    collecting = true;
                    if low.contains("akhir akta ini")
                        || low.contains("menghadap kepada saya")
                        || low.contains("hadir di hadapan saya")
                        || low.contains("hadir dihadapan saya")
                        || low.contains("berhadapan dengan saya")
                    {
                        continue;
                    }
                }
            }

            if collecting {
                seller_lines.push(line.clone());
            }
        }
    }

    seller_lines.join("\n")
}

/// Fungsi utama: Proses dokumen PDF akta dan ekstrak data pembeli
pub async fn process_akta_pdf(
    pdf_path: &Path,
    scale: f32,
    custom_id: Option<&str>,
) -> Result<CropResult, Box<dyn std::error::Error>> {
    let abs_pdf = std::fs::canonicalize(pdf_path)?;
    let pdf_path_str = abs_pdf.to_str().unwrap().trim_start_matches(r"\\?\");

    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(pdf_path_str))?.await?;
    let doc = PdfDocument::LoadFromFileAsync(&file)?.await?;
    let total_pages = doc.PageCount()? as usize;
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()?;

    // 1. Render dan OCR halaman per halaman, langsung berhenti begitu penutup pembeli ditemukan
    let mut pages_data: Vec<(Vec<String>, u32)> = Vec::new(); // (lines, rotation)
    let mut end_location: Option<(usize, usize)> = None; // (page_idx, line_idx)

    async fn render_and_prepare_page(doc: &PdfDocument, page_idx: u32, scale: f32) -> Result<(RgbaImage, u32), String> {
        let dyn_img = render_pdf_page(doc, page_idx, scale).await.map_err(|e| e.to_string())?;
        let (raw_w, raw_h) = (dyn_img.width(), dyn_img.height());
        let (upright_img, rot) = if raw_w > raw_h {
            (imageops::rotate270(&dyn_img), 270)
        } else {
            (dyn_img.to_rgba8(), 0)
        };
        Ok((upright_img, rot))
    }

    let mut current_render_task = if total_pages > 0 {
        let doc_clone = doc.clone();
        Some(tokio::spawn(async move {
            render_and_prepare_page(&doc_clone, 0, scale).await
        }))
    } else {
        None
    };

    for page_idx in 0..total_pages {
        let (upright_img, rot) = match current_render_task.take() {
            Some(task) => task.await.map_err(|e| e.to_string())??,
            None => render_and_prepare_page(&doc, page_idx as u32, scale).await?,
        };

        // Pipelining: Render halaman berikutnya di background selagi OCR halaman ini berjalan
        let next_idx = page_idx + 1;
        let next_render_task = if next_idx < total_pages {
            let doc_clone = doc.clone();
            Some(tokio::spawn(async move {
                render_and_prepare_page(&doc_clone, next_idx as u32, scale).await
            }))
        } else {
            None
        };

        let lines = run_ocr_on_image(&upright_img, &engine).await?;

        // Cek apakah penutup pembeli ada di halaman ini
        for (l_idx, line) in lines.iter().enumerate() {
            if is_buyer_conclusion(line) {
                end_location = Some((page_idx, l_idx));
                break;
            }
        }

        pages_data.push((lines, rot));

        if end_location.is_some() {
            if let Some(task) = next_render_task {
                task.abort();
            }
            break;
        }

        current_render_task = next_render_task;
    }

    let (end_page_idx, end_line_idx) = end_location.ok_or("Bagian data pembeli tidak ditemukan dalam dokumen akta.")?;

    let (lines_end, rot_applied) = &pages_data[end_page_idx];

    let mut start_line_same_page = None;
    for l_idx in (0..end_line_idx).rev() {
        if is_seller_conclusion(&lines_end[l_idx]) {
            start_line_same_page = Some(l_idx + 1);
            break;
        }
        if is_buyer_start(&lines_end[l_idx]) {
            start_line_same_page = Some(l_idx);
            break;
        }
    }

    // Ekstrak Nomor Akta dan Tanggal Akta dari Halaman 1 & Halaman 2
    let empty_lines = Vec::new();
    let p1_lines = pages_data.get(0).map(|p| &p.0).unwrap_or(&empty_lines);
    let p2_lines = pages_data.get(1).map(|p| &p.0).unwrap_or(&empty_lines);

    let nomor_akta = parser::parse_akta_nomor(p1_lines, p2_lines);
    let tanggal_akta = parser::parse_akta_tanggal(p2_lines);

    let akta_info = parser::AktaInfo {
        nomor_akta: nomor_akta.clone(),
        tanggal_akta: tanggal_akta.clone(),
    };

    // Ekstraksi saksi dari teks dokumen dan sisa halaman penutup akta
    let mut all_doc_text = String::new();
    for (lines, _) in &pages_data {
        all_doc_text.push_str(&lines.join("\n"));
        all_doc_text.push('\n');
    }

    let mut saksi_list = parser::extract_saksi_from_text(&all_doc_text);

    if saksi_list.len() < 2 {
        for p_idx in (end_page_idx + 1)..total_pages {
            if let Ok((up_img, _)) = render_and_prepare_page(&doc, p_idx as u32, scale).await {
                if let Ok(lines) = run_ocr_on_image(&up_img, &engine).await {
                    all_doc_text.push_str(&lines.join("\n"));
                    all_doc_text.push('\n');
                    let found = parser::extract_saksi_from_text(&all_doc_text);
                    if found.len() >= 2 {
                        saksi_list = found;
                        break;
                    }
                }
            }
        }
    }

    if saksi_list.len() < 2 {
        saksi_list = parser::extract_saksi_from_text(&all_doc_text);
    }

    // KASUS A: Seluruh data pembeli berada pada SATU halaman yang sama
    if let Some(start_line_idx) = start_line_same_page {
        let seller_raw_text = extract_seller_lines_until(&pages_data, end_page_idx, start_line_idx);
        let penjual_info = parser::parse_penjual_section(&seller_raw_text);

        let selected_lines = &lines_end[start_line_idx..=end_line_idx];
        let raw_text = selected_lines.join("\n");
        let mut buyer_info = parser::parse_buyer_to_custom_json(&raw_text, custom_id);
        buyer_info.nomor_akta = nomor_akta;
        buyer_info.tanggal_akta = tanggal_akta;

        return Ok(CropResult {
            success: true,
            page_number: end_page_idx + 1,
            total_pages,
            rotation_applied: *rot_applied,
            raw_text,
            buyer_info,
            akta_info,
            penjual_info,
            saksi: saksi_list,
        });
    }

    // KASUS B: Data pembeli TERPOTONG DUA HALAMAN
    if end_page_idx > 0 {
        let start_page_idx = end_page_idx - 1;
        let (lines_start, _) = &pages_data[start_page_idx];

        let mut seller_end_idx = None;
        for (l_idx, line) in lines_start.iter().enumerate() {
            if is_seller_conclusion(line) {
                seller_end_idx = Some(l_idx);
            }
        }

        let mut start_line_prev = None;
        if let Some(s_end) = seller_end_idx {
            for l_idx in (s_end + 1)..lines_start.len() {
                if is_buyer_start(&lines_start[l_idx]) {
                    start_line_prev = Some(l_idx);
                    break;
                }
            }
            if start_line_prev.is_none() {
                start_line_prev = Some(s_end + 1);
            }
        } else {
            for (l_idx, line) in lines_start.iter().enumerate().rev() {
                if is_buyer_start(line) {
                    start_line_prev = Some(l_idx);
                    break;
                }
            }
        }

        let start_line_idx = start_line_prev.unwrap_or(0);

        let seller_raw_text = extract_seller_lines_until(&pages_data, start_page_idx, start_line_idx);
        let penjual_info = parser::parse_penjual_section(&seller_raw_text);

        let mut selected_lines_p1: Vec<String> = Vec::new();
        for l_idx in start_line_idx..lines_start.len() {
            if is_footer_line(&lines_start[l_idx]) {
                break;
            }
            selected_lines_p1.push(lines_start[l_idx].clone());
        }

        let selected_lines_p2 = &lines_end[0..=end_line_idx];

        let mut raw_lines = selected_lines_p1;
        for line in selected_lines_p2 {
            raw_lines.push(line.clone());
        }
        let raw_text = raw_lines.join("\n");
        let mut buyer_info = parser::parse_buyer_to_custom_json(&raw_text, custom_id);
        buyer_info.nomor_akta = nomor_akta;
        buyer_info.tanggal_akta = tanggal_akta;

        return Ok(CropResult {
            success: true,
            page_number: start_page_idx + 1,
            total_pages,
            rotation_applied: *rot_applied,
            raw_text,
            buyer_info,
            akta_info,
            penjual_info,
            saksi: saksi_list,
        });
    }

    Err("Gagal menentukan batas awal data pembeli pada dokumen akta.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_inspect_ajb() {
        let path = Path::new(r"C:\Users\ryokh\.gemini\antigravity\brain\6e7a6fb3-a7ce-4175-94fc-67eb245eefef\.user_uploaded\media_1792217419304_da22a521.pdf");
        if path.exists() {
            let res = process_akta_pdf(path, 2.0, None).await.unwrap();
            assert!(!res.penjual_info.is_pt);
            let penjual = res.penjual_info.penjual_perorangan.as_ref().unwrap();
            assert_eq!(penjual.nama, "SUMADI");
            assert_eq!(penjual.nik, "3374052508690001");
            assert_eq!(penjual.tempat_lahir, "Demak");
            assert_eq!(penjual.tgl_lahir, "25/08/1969");
            assert_eq!(penjual.jenis_kelamin, "Laki-laki");
            assert_eq!(penjual.pekerjaan, "Karyawan Swasta");

            let persetujuan = res.penjual_info.persetujuan.as_ref().unwrap();
            assert_eq!(persetujuan.nama, "ROCHIMAH");
            assert_eq!(persetujuan.nik, "3374054105720002");
            assert_eq!(persetujuan.tempat_lahir, "Semarang");
            assert_eq!(persetujuan.tgl_lahir, "01/05/1972");
            assert_eq!(persetujuan.jenis_kelamin, "Perempuan");
            assert_eq!(persetujuan.pekerjaan, "Belum/Tidak Bekerja");

            assert_eq!(res.buyer_info.nama, "UMIYATI");
            assert_eq!(res.buyer_info.nik, "3321044908790001");
            assert_eq!(res.buyer_info.tgl_lahir, "09/08/1979");
            assert_eq!(res.akta_info.nomor_akta, "606/2026");
            assert_eq!(res.akta_info.tanggal_akta, "12/10/2026");
            println!("ALL AJB FULL PIPELINE ASSERTIONS PASSED!");
        }
    }

    #[tokio::test]
    async fn test_inspect_ajb_pt() {
        for (p, expected_pt) in [
            (r"c:\Users\ryokh\Downloads\AJB.pdf", "PT YUDHA MUDA SAKTI"),
            (r"C:\Users\ryokh\Downloads\organized (7).pdf", "PT AMANAH BERKAH PROPERTY"),
            (r"C:\Users\ryokh\Downloads\document (13).pdf", "PT DWI PERKASA UTAMA"),
        ] {
            let path = Path::new(p);
            if path.exists() {
                let res = process_akta_pdf(path, 2.0, None).await.unwrap();
                println!("=== FILE: {} ===", p);
                println!("is_pt = {}, pt_name = {:?}", res.penjual_info.is_pt, res.penjual_info.pt_name);
                println!("akta = {:?}", res.akta_info);
                println!("buyer = {:?}", res.buyer_info);
                println!("penjual_info = {:?}", res.penjual_info);
                assert!(res.penjual_info.is_pt, "File {} harus terdeteksi sebagai PT!", p);
                assert_eq!(res.penjual_info.pt_name.as_deref(), Some(expected_pt));
                assert!(res.penjual_info.penjual_perorangan.is_none());
            }
        }
    }
}
