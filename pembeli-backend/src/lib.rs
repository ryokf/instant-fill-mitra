pub mod parser;

use std::path::Path;
use image::{imageops, DynamicImage, RgbaImage};
use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;
use windows::Storage::Streams::{DataReader, InMemoryRandomAccessStream};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub raw_text: String,
    pub buyer_info: parser::BuyerJsonOutput,
}

/// Render halaman PDF ke citra DynamicImage menggunakan Windows.Data.Pdf
async fn render_pdf_page(doc: &PdfDocument, page_index: u32, scale: f32) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    let page = doc.GetPage(page_index)?;
    let size = page.Size()?;

    let mem_stream = InMemoryRandomAccessStream::new()?;
    let options = PdfPageRenderOptions::new()?;
    options.SetDestinationWidth((size.Width * scale) as u32)?;
    options.SetDestinationHeight((size.Height * scale) as u32)?;
    page.RenderWithOptionsToStreamAsync(&mem_stream, &options)?.await?;

    let stream_size = mem_stream.Size()? as usize;
    mem_stream.Seek(0)?;
    let reader = DataReader::CreateDataReader(&mem_stream)?;
    reader.LoadAsync(stream_size as u32)?.await?;
    let mut bytes = vec![0u8; stream_size];
    reader.ReadBytes(&mut bytes)?;

    let dyn_img = image::load_from_memory(&bytes)?;
    Ok(dyn_img)
}

/// Jalankan OCR pada citra RGBA menggunakan Windows.Media.Ocr untuk mendapatkan baris teks
async fn run_ocr_on_image(img: &RgbaImage, engine: &OcrEngine, page_idx: usize) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let temp_file = std::env::temp_dir().join(format!("ocr_tmp_{}_{}.png", std::process::id(), page_idx));
    img.save(&temp_file)?;

    let abs_path = std::fs::canonicalize(&temp_file)?;
    let path_str = abs_path.to_str().unwrap().trim_start_matches(r"\\?\");
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path_str))?.await?;
    let stream = file.OpenAsync(windows::Storage::FileAccessMode::Read)?.await?;
    let decoder = BitmapDecoder::CreateAsync(&stream)?.await?;
    let bitmap = decoder.GetSoftwareBitmapAsync()?.await?;

    let result = engine.RecognizeAsync(&bitmap)?.await?;
    let _ = std::fs::remove_file(&temp_file);

    let mut lines_out = Vec::new();
    for line in result.Lines()? {
        lines_out.push(line.Text()?.to_string());
    }

    Ok(lines_out)
}

fn is_buyer_conclusion(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("pihak kedua/pembeli")
        || lower.contains("pihak kedua / pembeli")
        || lower.contains("pihak kedua/ pembeli")
        || lower.contains("pembeli\"")
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
        || ((lower.starts_with("tuan ") || lower.starts_with("nona ") || lower.starts_with("nyonya ")) 
            && (lower.contains("warga negara") || lower.contains("lahir di")))
}

fn is_seller_conclusion(text: &str) -> bool {
    let lower = text.to_lowercase();
    lower.contains("pihak pertama/penjual")
        || lower.contains("pihak pertama / penjual")
        || lower.contains("pihak pertama/ penjual")
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

/// Fungsi utama: Proses dokumen PDF akta dan ekstrak data pembeli (tanpa cropping)
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

    for page_idx in 0..total_pages {
        let dyn_img = render_pdf_page(&doc, page_idx as u32, scale).await?;
        let (raw_w, raw_h) = (dyn_img.width(), dyn_img.height());

        let (upright_img, rot) = if raw_w > raw_h {
            (imageops::rotate270(&dyn_img), 270)
        } else {
            (dyn_img.to_rgba8(), 0)
        };

        let lines = run_ocr_on_image(&upright_img, &engine, page_idx).await?;

        // Cek apakah penutup pembeli ada di halaman ini
        for (l_idx, line) in lines.iter().enumerate() {
            if is_buyer_conclusion(line) {
                end_location = Some((page_idx, l_idx));
                break;
            }
        }

        pages_data.push((lines, rot));

        if end_location.is_some() {
            break;
        }
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

    // KASUS A: Seluruh data pembeli berada pada SATU halaman yang sama
    if let Some(start_line_idx) = start_line_same_page {
        let selected_lines = &lines_end[start_line_idx..=end_line_idx];
        let raw_text = selected_lines.join("\n");
        let buyer_info = parser::parse_buyer_to_custom_json(&raw_text, custom_id);

        return Ok(CropResult {
            success: true,
            page_number: end_page_idx + 1,
            total_pages,
            rotation_applied: *rot_applied,
            raw_text,
            buyer_info,
        });
    }

    // KASUS B: Data pembeli TERPOTONG DUA HALAMAN (Dimulai di halaman sebelumnya dan selesai di halaman ini)
    if end_page_idx > 0 {
        let start_page_idx = end_page_idx - 1;
        let (lines_start, _) = &pages_data[start_page_idx];

        // 1. Cari penutup pihak penjual di halaman sebelumnya
        let mut seller_end_idx = None;
        for (l_idx, line) in lines_start.iter().enumerate() {
            if is_seller_conclusion(line) {
                seller_end_idx = Some(l_idx);
            }
        }

        // 2. Awal pembeli dimulai setelah penjual atau baris II.-
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
            for (l_idx, line) in lines_start.iter().enumerate() {
                if is_buyer_start(line) {
                    start_line_prev = Some(l_idx);
                    break;
                }
            }
        }

        let start_line_idx = start_line_prev.unwrap_or(0);

        // Ambil semua baris pembeli di halaman sebelumnya sebelum footer
        let mut selected_lines_p1: Vec<String> = Vec::new();
        for l_idx in start_line_idx..lines_start.len() {
            if is_footer_line(&lines_start[l_idx]) {
                break;
            }
            selected_lines_p1.push(lines_start[l_idx].clone());
        }

        // Ambil baris pembeli di halaman penutup (dari baris 0 s/d end_line_idx)
        let selected_lines_p2 = &lines_end[0..=end_line_idx];

        let mut raw_lines = selected_lines_p1;
        for line in selected_lines_p2 {
            raw_lines.push(line.clone());
        }
        let raw_text = raw_lines.join("\n");
        let buyer_info = parser::parse_buyer_to_custom_json(&raw_text, custom_id);

        return Ok(CropResult {
            success: true,
            page_number: start_page_idx + 1,
            total_pages,
            rotation_applied: *rot_applied,
            raw_text,
            buyer_info,
        });
    }

    Err("Gagal menentukan batas awal data pembeli pada dokumen akta.".into())
}
