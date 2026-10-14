pub mod parser;

use std::path::Path;
use image::{imageops, DynamicImage, RgbaImage};
use serde::{Deserialize, Serialize};
use windows::core::HSTRING;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::StorageFile;
use windows::Storage::Streams::{DataReader, DataWriter, InMemoryRandomAccessStream};
use std::io::Cursor;
use image::ImageEncoder;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub raw_text: String,
    pub buyer_info: parser::BuyerJsonOutput,
    pub akta_info: parser::AktaInfo,
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

/// Jalankan OCR pada citra RGBA menggunakan Windows.Media.Ocr untuk mendapatkan baris teks secara langsung dalam memori (tanpa disk)
async fn run_ocr_on_image(img: &RgbaImage, engine: &OcrEngine, _page_idx: usize) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let mut bmp_buf = Cursor::new(Vec::with_capacity((img.width() * img.height() * 4 + 1024) as usize));
    image::codecs::bmp::BmpEncoder::new(&mut bmp_buf).write_image(
        img.as_raw(),
        img.width(),
        img.height(),
        image::ExtendedColorType::Rgba8,
    )?;
    let bmp_bytes = bmp_buf.into_inner();

    let mem_stream = InMemoryRandomAccessStream::new()?;
    let writer = DataWriter::CreateDataWriter(&mem_stream)?;
    writer.WriteBytes(&bmp_bytes)?;
    writer.StoreAsync()?.await?;
    writer.DetachStream()?;
    mem_stream.Seek(0)?;

    let decoder = BitmapDecoder::CreateAsync(&mem_stream)?.await?;
    let bitmap = decoder.GetSoftwareBitmapAsync()?.await?;

    let result = engine.RecognizeAsync(&bitmap)?.await?;

    let mut lines_out = Vec::new();
    for line in result.Lines()? {
        lines_out.push(line.Text()?.to_string());
    }

    Ok(lines_out)
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

    // KASUS A: Seluruh data pembeli berada pada SATU halaman yang sama
    if let Some(start_line_idx) = start_line_same_page {
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
        });
    }

    Err("Gagal menentukan batas awal data pembeli pada dokumen akta.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_process_sample_pdf_akta_info() {
        let pdf = Path::new("sample.pdf");
        if !pdf.exists() {
            return;
        }
        let res = process_akta_pdf(pdf, 2.0, None).await.unwrap();
        println!("--> AKTA INFO NOMOR: {:?}", res.akta_info.nomor_akta);
        println!("--> AKTA INFO TANGGAL: {:?}", res.akta_info.tanggal_akta);
        println!("--> BUYER INFO: {:?}", res.buyer_info);
        assert_eq!(res.akta_info.nomor_akta, "574/2026");
        assert_eq!(res.akta_info.tanggal_akta, "24/09/2026");
    }

    #[tokio::test]
    async fn test_debug_new_uploaded_pdf() {
        let path = Path::new(r"C:\Users\ryokh\.gemini\antigravity\brain\bde4aa9d-d135-4d5b-83ce-47b9bf6746dc\.user_uploaded\media_1791952474248_df2bda62.pdf");
        if !path.exists() {
            return;
        }
        let res = process_akta_pdf(path, 1.5, None).await.unwrap();
        assert_eq!(res.buyer_info.nama, "NANDHI ARIFTA TRISNA");
        assert_eq!(res.buyer_info.nik, "3374082104970001");
        assert_eq!(res.akta_info.nomor_akta, "540/2026");
        assert_eq!(res.akta_info.tanggal_akta, "17/09/2026");
    }
}



