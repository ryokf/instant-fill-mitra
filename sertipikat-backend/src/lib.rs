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
pub struct SertipikatResult {
    pub success: bool,
    pub page_number: usize,
    pub total_pages: usize,
    pub rotation_applied: u32,
    pub data: parser::SertipikatData,
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

fn rotate_rgba(img: &RgbaImage, rot: u32) -> RgbaImage {
    match rot {
        90 => imageops::rotate90(img),
        180 => imageops::rotate180(img),
        270 => imageops::rotate270(img),
        _ => img.clone(),
    }
}

/// Proses berkas dokumen Pengecekan Sertipikat (PDF atau Citra) dan ekstrak nomor berkas dsb.
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

        // Halaman pertama memuat dokumen utama Pengecekan Sertipikat
        let base_img = render_pdf_page(&doc, 0, scale).await?.to_rgba8();

        // Cari orientasi terbaik
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

        if best_score < 5 {
            // Jika halaman 1 kurang meyakinkan dan ada halaman lain, cek halaman 2
            if total_pages > 1 {
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
        // Citra biasa (PNG / JPG)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_process_sample_pdf() {
        let pdf = Path::new("sample.pdf");
        if !pdf.exists() {
            return;
        }
        let res = process_sertipikat_file(pdf, 2.0).await.unwrap();
        println!("--> NOMOR BERKAS : {:?}", res.data.nomor_berkas);
        println!("--> TAHUN BERKAS : {:?}", res.data.tahun_berkas);
        println!("--> NIB ELEKTRONIK: {:?}", res.data.nib_elektronik);
        println!("--> BLANGKO       : {:?}", res.data.nomor_seri_blangko);
        assert_eq!(res.data.nomor_berkas, "53119");
        assert_eq!(res.data.tahun_berkas, "2026");
        assert_eq!(res.data.nib_elektronik, "11090000197610");
        assert_eq!(res.data.nomor_seri_blangko, "B1209978");
    }
}
