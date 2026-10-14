use image::{imageops, RgbaImage};

/// Rotasi citra RGBA sesuai sudut (0, 90, 180, 270)
pub fn rotate_rgba(img: &RgbaImage, rot: u32) -> RgbaImage {
    match rot {
        90 => imageops::rotate90(img),
        180 => imageops::rotate180(img),
        270 => imageops::rotate270(img),
        _ => img.clone(),
    }
}
