use image::DynamicImage;
use windows::Data::Pdf::{PdfDocument, PdfPageRenderOptions};
use windows::Storage::Streams::{DataReader, InMemoryRandomAccessStream};

/// Render satu halaman PDF ke DynamicImage menggunakan Windows.Data.Pdf
pub async fn render_pdf_page(
    doc: &PdfDocument,
    page_index: u32,
    scale: f32,
) -> Result<DynamicImage, Box<dyn std::error::Error>> {
    let page = doc.GetPage(page_index)?;
    let size = page.Size()?;

    let mut target_w = size.Width * scale;
    let mut target_h = size.Height * scale;
    let max_dim = target_w.max(target_h);
    if max_dim > 3800.0 {
        let factor = 3800.0 / max_dim;
        target_w *= factor;
        target_h *= factor;
    } else if max_dim > 0.0 && max_dim < 2200.0 {
        let factor = 2200.0 / max_dim;
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
