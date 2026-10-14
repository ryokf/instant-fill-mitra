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
pub struct BphtbResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub data: parser::BphtbData,
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

/// Jalankan OCR pada citra RGBA menggunakan Windows.Media.Ocr
async fn run_ocr_on_image(img: &RgbaImage, engine: &OcrEngine) -> Result<Vec<String>, Box<dyn std::error::Error>> {
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

fn rotate_rgba(img: &RgbaImage, rot: u32) -> RgbaImage {
    match rot {
        90 => imageops::rotate90(img),
        180 => imageops::rotate180(img),
        270 => imageops::rotate270(img),
        _ => img.clone(),
    }
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

        // Halaman pertama biasanya memuat dokumen utama SSPD BPHTB
        let base_img = render_pdf_page(&doc, 0, scale).await?.to_rgba8();

        // Cari orientasi terbaik
        let mut best_lines = Vec::new();
        let mut best_score = 0;
        let mut best_rot = 0;

        // Cek kandidat orientasi berdasarkan rasio aspek
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
        // Mode gambar (JPG/PNG)
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
