use std::io::Cursor;
use image::{ImageEncoder, RgbaImage};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

#[derive(Debug, Clone, Default)]
pub struct OcrPageLines {
    pub body_lines: Vec<String>,
    pub margin_lines: Vec<String>,
    pub all_lines: Vec<String>,
}

fn group_words_into_lines(words: &[(f32, f32, f32, f32, String)], y_threshold: f32) -> Vec<String> {
    if words.is_empty() {
        return Vec::new();
    }

    let mut sorted = words.to_vec();
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut lines = Vec::new();
    let mut cur_y = -1000.0;
    let mut cur_words: Vec<(f32, f32, f32, f32, String)> = Vec::new();

    for w in sorted {
        if (w.1 - cur_y).abs() > y_threshold {
            if !cur_words.is_empty() {
                cur_words.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
                lines.push(cur_words.iter().map(|item| item.4.clone()).collect::<Vec<_>>().join(" "));
                cur_words.clear();
            }
            cur_y = w.1;
        }
        cur_words.push(w);
    }

    if !cur_words.is_empty() {
        cur_words.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        lines.push(cur_words.iter().map(|item| item.4.clone()).collect::<Vec<_>>().join(" "));
    }

    lines
}

/// Menjalankan OCR dengan pemisahan kolom margin (renvoi) dan kolom badan akta
pub async fn run_ocr_page_with_layout(
    img: &RgbaImage,
    engine: &OcrEngine,
) -> Result<OcrPageLines, Box<dyn std::error::Error>> {
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

    let width = img.width() as f32;
    let height = img.height() as f32;
    let split_x = width * 0.31;
    let y_threshold = 22.0 * (height / 2200.0).max(1.0);

    let mut margin_words = Vec::new();
    let mut body_words = Vec::new();
    let mut standard_lines = Vec::new();

    for line in result.Lines()? {
        standard_lines.push(line.Text()?.to_string());
        for word in line.Words()? {
            let rect = word.BoundingRect()?;
            let text = word.Text()?.to_string();

            // Abaikan footer di bagian paling bawah dokumen (y > 88% tinggi halaman) untuk margin
            if rect.Y > height * 0.88 {
                continue;
            }

            if rect.X + rect.Width <= split_x {
                margin_words.push((rect.X, rect.Y, rect.Width, rect.Height, text));
            } else if rect.X >= split_x {
                body_words.push((rect.X, rect.Y, rect.Width, rect.Height, text));
            }
        }
    }

    // Jika ditemukan 10 atau lebih kata di kolom margin (renvoi signifikan seperti pembeli ke-2)
    if margin_words.len() >= 10 {
        let margin_lines = group_words_into_lines(&margin_words, y_threshold);
        let body_lines = group_words_into_lines(&body_words, y_threshold);
        let mut all_lines = body_lines.clone();
        all_lines.extend(margin_lines.clone());

        Ok(OcrPageLines {
            body_lines,
            margin_lines,
            all_lines,
        })
    } else {
        Ok(OcrPageLines {
            body_lines: standard_lines.clone(),
            margin_lines: Vec::new(),
            all_lines: standard_lines,
        })
    }
}

/// Menjalankan OCR pada citra RGBA menggunakan Windows.Media.Ocr langsung dalam memori
pub async fn run_ocr_on_image(
    img: &RgbaImage,
    engine: &OcrEngine,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let page_lines = run_ocr_page_with_layout(img, engine).await?;
    Ok(page_lines.all_lines)
}
