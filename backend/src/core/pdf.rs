use image::DynamicImage;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Storage::Streams::{DataReader, InMemoryRandomAccessStream};

/// Render satu halaman PDF ke DynamicImage menggunakan Windows.Data.Pdf dengan batas dimensi fleksibel
pub async fn render_pdf_page_fitted(
    doc: &PdfDocument,
    page_index: u32,
    scale: f32,
    min_dim: f32,
    max_dim: f32,
) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    let page = doc.GetPage(page_index)?;
    let size = page.Size()?;

    let mut target_w = size.Width * scale;
    let mut target_h = size.Height * scale;
    let current_max = target_w.max(target_h);
    if max_dim > 0.0 && current_max > max_dim {
        let factor = max_dim / current_max;
        target_w *= factor;
        target_h *= factor;
    } else if min_dim > 0.0 && current_max > 0.0 && current_max < min_dim {
        let factor = min_dim / current_max;
        target_w *= factor;
        target_h *= factor;
    }

    let mem_stream = InMemoryRandomAccessStream::new()?;
    let options = PdfPageRenderOptions::new()?;
    options.SetDestinationWidth(target_w as u32)?;
    options.SetDestinationHeight(target_h as u32)?;
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

/// Render satu halaman PDF ke DynamicImage menggunakan Windows.Data.Pdf (default clamp: 2000 - 3800)
pub async fn render_pdf_page(
    doc: &PdfDocument,
    page_index: u32,
    scale: f32,
) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    render_pdf_page_fitted(doc, page_index, scale, 2000.0, 3800.0).await
}
