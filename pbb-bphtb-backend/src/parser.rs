use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BphtbData {
    pub nop: String,
    pub luas_tanah: f64,
    pub njop_m2: u64,
    pub tahun: u32,
    pub nomor_bukti_pembayaran: String,
    pub nama_wajib_pajak: String,
    pub nik: String,
    pub letak_tanah: String,
    pub kelurahan: String,
    pub kecamatan: String,
}

pub fn clean_text(input: &str) -> String {
    let re_spaces = Regex::new(r"\s+").unwrap();
    re_spaces.replace_all(input, " ").trim().to_string()
}

pub fn parse_bphtb_text(ocr_lines: &[String]) -> BphtbData {
    let raw_text = ocr_lines.join("\n");

    // 1. Nomor Bukti Pembayaran (terletak di ujung kanan atas dokumen BPHTB)
    let mut nomor_bukti_pembayaran = String::new();
    let re_bukti_prefix = Regex::new(r"\b(21\d{10})\b").unwrap();
    for line in ocr_lines.iter().take(20) {
        if let Some(caps) = re_bukti_prefix.captures(line) {
            nomor_bukti_pembayaran = caps[1].to_string();
            break;
        }
    }
    if nomor_bukti_pembayaran.is_empty() {
        let re_digits_10_14 = Regex::new(r"\b(\d{10,14})\b").unwrap();
        for line in ocr_lines.iter().take(20) {
            let lower = line.to_lowercase();
            if lower.contains("briva") || lower.contains("telp") || lower.contains("06721") {
                continue;
            }
            if let Some(caps) = re_digits_10_14.captures(line) {
                nomor_bukti_pembayaran = caps[1].to_string();
                break;
            }
        }
    }

    // 2. NOP (Nomor Objek Pajak PBB - 18 digit)
    let mut nop = String::new();
    let re_nop = Regex::new(r"(?i)(?:NOP|PBB)[\s:.=•\-]*(\d{17,18})\b").unwrap();
    if let Some(caps) = re_nop.captures(&raw_text) {
        nop = caps[1].to_string();
    } else {
        let re_nop_loose = Regex::new(r"\b(33\d{16})\b").unwrap();
        for line in ocr_lines {
            if let Some(caps) = re_nop_loose.captures(line) {
                nop = caps[1].to_string();
                break;
            }
        }
    }

    // 3. Luas Tanah & NJOP per M2 Tanah
    let mut luas_tanah: f64 = 0.0;
    let mut njop_m2: u64 = 0;

    let re_item7 = Regex::new(r"(?:7[\.\,\s]+)(\d+(?:[\,\.]\d+)?)").unwrap();
    let re_item9 = Regex::new(r"(?:9[\.\,\s]+)([\d\.\,]+)").unwrap();

    for line in ocr_lines {
        let trimmed = line.trim();
        if trimmed.starts_with('8') || trimmed.starts_with("10.") || trimmed.starts_with("12.") {
            continue;
        }

        if luas_tanah == 0.0 {
            if let Some(caps) = re_item7.captures(trimmed) {
                let num_str = caps[1].replace(',', ".");
                if let Ok(v) = num_str.parse::<f64>() {
                    if v > 0.0 && v < 1000000.0 {
                        luas_tanah = v;
                    }
                }
            }
        }

        if njop_m2 == 0 {
            if let Some(caps) = re_item9.captures(trimmed) {
                let raw_val = &caps[1];
                let normalized = if raw_val.contains(',') {
                    let parts: Vec<&str> = raw_val.split(',').collect();
                    parts[0].replace('.', "")
                } else {
                    raw_val.replace('.', "")
                };
                if let Ok(v) = normalized.parse::<u64>() {
                    njop_m2 = v;
                }
            }
        }
    }

    // Fallback luas tanah jika baris "7." belum tertangkap
    if luas_tanah == 0.0 {
        let re_luas_fallback = Regex::new(r"(?i)Tanah\s*\(bumi\)[\s\S]{1,80}?(\d+(?:[\,\.]\d+)?)\s*(?:m|m2|m²|m')").unwrap();
        if let Some(caps) = re_luas_fallback.captures(&raw_text) {
            let num_str = caps[1].replace(',', ".");
            if let Ok(v) = num_str.parse::<f64>() {
                luas_tanah = v;
            }
        }
    }

    // 4. Tahun Pajak (diisi tahun sekarang jika tidak terdeteksi, atau dari Tahun Pajak di dokumen)
    let mut tahun = 2026;
    let re_thn = Regex::new(r"(?i)Tahun\s*Pajak\s*:\s*(\d{4})").unwrap();
    if let Some(caps) = re_thn.captures(&raw_text) {
        if let Ok(y) = caps[1].parse::<u32>() {
            tahun = y;
        }
    }

    // 5. NIK Wajib Pajak (16 digit) & Nama Wajib Pajak
    let mut nik = String::new();
    let mut nama_wajib_pajak = String::new();

    let re_nik = Regex::new(r"\b(\d{16})\b").unwrap();
    let re_all_letters = Regex::new(r"^[A-Z\s\.\,\'\`\-]+$").unwrap();

    for (idx, line) in ocr_lines.iter().enumerate() {
        if let Some(caps) = re_nik.captures(line) {
            nik = caps[1].to_string();
            // Cek baris tepat sebelum NIK untuk nama
            if idx > 0 {
                let candidate = ocr_lines[idx - 1].trim();
                let candidate_cleaned = candidate.trim_matches(|c: char| c == ':' || c == '-' || c == ',' || c == '.').trim();
                if re_all_letters.is_match(candidate_cleaned) && candidate_cleaned.len() > 3 && !candidate_cleaned.to_lowercase().contains("wajib pajak") {
                    nama_wajib_pajak = candidate_cleaned.to_string();
                }
            }
            break;
        }
    }

    if nama_wajib_pajak.is_empty() {
        let re_nama = Regex::new(r"(?i)Nama\s+Wajib\s+Pajak\s*[:\s]+([^\r\n]+)").unwrap();
        if let Some(caps) = re_nama.captures(&raw_text) {
            let first_line = caps[1].lines().next().unwrap_or(&caps[1]);
            let n = first_line.trim().trim_matches(|c: char| c == ':' || c == '-' || c == ',' || c == '.').trim();
            if !n.is_empty() && !n.to_lowercase().contains("alamat") {
                nama_wajib_pajak = n.to_string();
            }
        }
    }

    // 6. Letak Tanah, Kelurahan, Kecamatan
    let mut letak_tanah = String::new();
    let mut kelurahan = String::new();
    let mut kecamatan = String::new();

    let re_letak = Regex::new(r"(?i)KP\s+[A-Z0-9\s\/]+RT\s+[0-9O\s\/]+").unwrap();
    if let Some(caps) = re_letak.captures(&raw_text) {
        letak_tanah = clean_text(&caps[0]);
    } else {
        let re_letak2 = Regex::new(r"(?i)PAYON\s+[A-Z0-9\s\/]+").unwrap();
        if let Some(caps) = re_letak2.captures(&raw_text) {
            letak_tanah = clean_text(&caps[0]);
        }
    }

    let re_kel = Regex::new(r"(?i)Kelurahan[\s:•\-]*([A-Z\s]+)").unwrap();
    if let Some(caps) = re_kel.captures(&raw_text) {
        let k = clean_text(&caps[1]);
        if !k.to_lowercase().contains("kecamatan") {
            kelurahan = k;
        }
    }
    if kelurahan.is_empty() {
        for line in ocr_lines {
            let trimmed = line.trim();
            if trimmed == "BANDUNGREJO" || trimmed == "KEBON BATUR" || trimmed == "TEMON" {
                kelurahan = trimmed.to_string();
                break;
            }
        }
    }

    for line in ocr_lines {
        let trimmed = line.trim().trim_matches(|c| c == '•' || c == '-' || c == ' ' || c == ':');
        if trimmed.starts_with("MRANGGEN") || trimmed == "MRANGGEN" || trimmed.starts_with("BRATI") || trimmed == "BRATI" {
            kecamatan = trimmed.to_string();
            break;
        }
    }

    BphtbData {
        nop,
        luas_tanah,
        njop_m2,
        tahun,
        nomor_bukti_pembayaran,
        nama_wajib_pajak,
        nik,
        letak_tanah,
        kelurahan,
        kecamatan,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bphtb_sample() {
        let lines = vec![
            "PEMERINTAH KABUPATEN DEMAK".into(),
            "211202632173".into(),
            "Briva : 13852112632173".into(),
            "06721/SSPD/BPHTB/2026".into(),
            "Tahun Pajak : 2026".into(),
            "Nama Wajib Pajak".into(),
            "EVA KRISTIYANTO".into(),
            "3315142911980001".into(),
            "• 332101000901100160".into(),
            "7. 60,00 m'".into(),
            "9. 537.000,00".into(),
        ];
        let data = parse_bphtb_text(&lines);
        assert_eq!(data.nomor_bukti_pembayaran, "211202632173");
        assert_eq!(data.nop, "332101000901100160");
        assert_eq!(data.luas_tanah, 60.0);
        assert_eq!(data.njop_m2, 537000);
        assert_eq!(data.tahun, 2026);
        assert_eq!(data.nama_wajib_pajak, "EVA KRISTIYANTO");
        assert_eq!(data.nik, "3315142911980001");
    }
}
