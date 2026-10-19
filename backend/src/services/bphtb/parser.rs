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
    let re_nop_any = Regex::new(r"(33[0-9OolI\.\-\s]{16,26})").unwrap();
    for line in ocr_lines {
        for caps in re_nop_any.captures_iter(line) {
            let cleaned: String = caps[1]
                .chars()
                .filter_map(|c| match c {
                    '0'..='9' => Some(c),
                    'O' | 'o' => Some('0'),
                    'I' | 'l' => Some('1'),
                    _ => None,
                })
                .collect();
            if cleaned.len() >= 18 && cleaned.starts_with("33") {
                nop = cleaned[..18].to_string();
                break;
            }
        }
        if !nop.is_empty() {
            break;
        }
    }

    // 3. Luas Tanah & NJOP per M2 Tanah
    let mut luas_tanah: f64 = 0.0;
    let mut njop_m2: u64 = 0;

    let lower_raw = raw_text.to_lowercase();
    let table_slice = if let Some(pos) = lower_raw.find("penghitungan") {
        raw_text.get(pos..).unwrap_or(&raw_text[..])
    } else if let Some(pos) = lower_raw.find("uraian") {
        raw_text.get(pos..).unwrap_or(&raw_text[..])
    } else if let Some(pos) = lower_raw.find("tanah") {
        raw_text.get(pos..).unwrap_or(&raw_text[..])
    } else {
        &raw_text[..]
    };

    let re_item7_multi = Regex::new(r"(?:^|[\s:;])7[\.\,\:\s]+(\d{1,5}(?:[\,\.]\d{1,2})?)\s*(?:m|M|rn)").unwrap();
    let re_item7_simple = Regex::new(r"(?:^|[\s:;])7[\.\,\:\s]+(\d{1,5}(?:[\,\.]\d{1,2})?)\b").unwrap();
    let re_item9_multi = Regex::new(r"(?:^|[\s:;])9[\.\,\:\s]+(\d{1,3}(?:[\.\,]\d{3})+)(?:[\,\.]\d{2})?\b").unwrap();

    if let Some(caps) = re_item7_multi.captures(table_slice).or_else(|| re_item7_simple.captures(table_slice)) {
        let num_str = caps[1].replace(',', ".");
        if let Ok(v) = num_str.parse::<f64>() {
            if v > 0.0 && v < 100000.0 {
                luas_tanah = v;
            }
        }
    }

    if let Some(caps) = re_item9_multi.captures(table_slice) {
        let raw_val = &caps[1];
        let normalized = raw_val.replace('.', "").replace(',', "");
        if let Ok(v) = normalized.parse::<u64>() {
            njop_m2 = v;
        }
    }

    // Fallback luas tanah jika angka "7." terlewat oleh OCR (cari pola seperti "60,00 m" atau "60.00")
    if luas_tanah == 0.0 {
        let re_luas_fallback = Regex::new(r"(?i)\b(\d{2,4})[\,\.]00\s*(?:m2|m²|m'|m|rn)?\b").unwrap();
        if let Some(caps) = re_luas_fallback.captures(table_slice) {
            if let Ok(v) = caps[1].parse::<f64>() {
                if v >= 10.0 && v <= 50000.0 {
                    luas_tanah = v;
                }
            }
        }
    }

    // Fallback njop_m2 jika angka "9." terlewat oleh OCR (cari pola ribuan seperti "48.000,00" atau "48.000.00")
    if njop_m2 == 0 {
        let re_njop_fallback = Regex::new(r"\b(\d{2,3}\.\d{3})[\,\.]00\b").unwrap();
        if let Some(caps) = re_njop_fallback.captures(table_slice) {
            let normalized = caps[1].replace('.', "");
            if let Ok(v) = normalized.parse::<u64>() {
                njop_m2 = v;
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
