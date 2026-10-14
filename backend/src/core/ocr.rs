use std::io::Cursor;
use image::{ImageEncoder, RgbaImage};
use windows::Graphics::Imaging::BitmapDecoder;
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

/// Menjalankan OCR pada citra RGBA menggunakan Windows.Media.Ocr langsung dalam memori
pub async fn run_ocr_on_image(
    img: &RgbaImage,
    engine: &OcrEngine,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
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
