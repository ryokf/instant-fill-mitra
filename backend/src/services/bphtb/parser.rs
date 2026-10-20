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

/// Normalize OCR confusion characters into digits:
/// 'o', 'O', 'Q' -> '0'
/// 'l', 'I', '|' -> '1'
pub fn clean_ocr_digits(s: &str) -> String {
    s.chars().map(|c| match c {
        'o' | 'O' | 'Q' => '0',
        'l' | 'I' | '|' => '1',
        _ => c,
    }).collect()
}

/// Parse Indonesian currency amount from OCR string with potential typos
/// e.g. "27.ooo,oo", "7.150,OO", "4.536.ooo,oo", "537.ooo,oo", "335.000,00", "394.000"
pub fn parse_rupiah_amount(s: &str) -> Option<u64> {
    let cleaned = clean_ocr_digits(s.trim());
    if cleaned.is_empty() {
        return None;
    }

    // 1. If there's a comma decimal separator (standard in Indonesian currency, e.g. ",00" or ",0")
    let main_part = if let Some(comma_pos) = cleaned.rfind(',') {
        let after_comma = cleaned[comma_pos + 1..].trim();
        // If after comma is 1-3 digits (like "00" or "oo" -> "00"), treat as cents and take before comma
        if after_comma.chars().all(|c| c.is_ascii_digit()) && after_comma.len() <= 3 {
            &cleaned[..comma_pos]
        } else {
            &cleaned[..]
        }
    } else if let Some(last_dot_pos) = cleaned.rfind('.') {
        // If it uses dot as decimal cents: e.g. "27.000.00" or "48000.00"
        let after_dot = cleaned[last_dot_pos + 1..].trim();
        let before_dot = &cleaned[..last_dot_pos];
        if (after_dot == "00" || after_dot == "0") && (before_dot.contains('.') || before_dot.len() <= 7) {
            before_dot
        } else {
            &cleaned[..]
        }
    } else {
        &cleaned[..]
    };

    let digits_only: String = main_part.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits_only.is_empty() {
        return None;
    }
    digits_only.parse::<u64>().ok()
}

/// Parse luas tanah from OCR string (e.g. "168,00 m2", "66,OOm2", "72,00 m'", "184")
pub fn parse_luas_amount(s: &str) -> Option<f64> {
    let cleaned = clean_ocr_digits(s.trim());
    if cleaned.is_empty() {
        return None;
    }

    let mut num_str = String::new();
    let mut seen_sep = false;

    for c in cleaned.chars() {
        if c.is_ascii_digit() {
            num_str.push(c);
        } else if (c == ',' || c == '.') && !seen_sep && !num_str.is_empty() {
            num_str.push('.');
            seen_sep = true;
        } else if !num_str.is_empty() {
            break;
        }
    }

    if let Ok(v) = num_str.parse::<f64>() {
        if v >= 1.0 && v <= 100_000.0 {
            return Some(v);
        }
    }
    None
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

    // 3. Luas Tanah, NJOP per M2, dan Total Nilai Tanah (Item 7, Item 9, Item 11)
    let mut luas_tanah: f64 = 0.0;
    let mut njop_m2: u64 = 0;
    let mut total_tanah: u64 = 0;

    // Item 9 regex: prefix 9, g, q, G followed by punctuation/whitespace and amount
    // Matches: "9. 27.ooo,oo", "9. 537.ooo,oo", "g. 7.150,OO", "9: 335.000,00", "9. 394.000,00"
    let re_item9 = Regex::new(r"(?i)(?:^|[\s:;])(?:9|[gq])[\.\,\:\;\s\-]+([0-9oOQIl]{1,4}(?:[\.\,][0-9oOQIl]{3})+(?:[\,\.][0-9oOQIl]{2})?)").unwrap();
    let re_item9_simple = Regex::new(r"(?i)(?:^|[\s:;])(?:9|[gq])[\.\,\:\;\s\-]+([0-9oOQIl]{4,8})\b").unwrap();

    // Item 7 regex: prefix 7 or T followed by punctuation/whitespace and luas amount
    // Matches: "7. 168,00 m2", "7. 66,OOm2", "7. 72,00 m'", "7. 184,00 m2", "7. 60,00 m'"
    let re_item7_with_unit = Regex::new(r"(?i)(?:^|[\s:;])[7T][\.\,\:\;\s\-]+([0-9oOQIl]{1,5}(?:[\,\.][0-9oOQIl]{1,2})?)\s*(?:m2|m²|m'|m:|rn2|m)\b").unwrap();
    let re_item7_plain = Regex::new(r"(?i)(?:^|[\s:;])[7T][\.\,\:\;\s\-]+([0-9oOQIl]{1,5}(?:[\,\.][0-9oOQIl]{1,2})?)\b").unwrap();

    // Item 11 regex: prefix 11 or ll or II followed by punctuation/whitespace (or attached) and amount
    // Matches: "11. 4.536.ooo,oo", "11.1.315.600,oo", "11. 35.442.ooo,oo", "11. 24.120.ooo,oo"
    let re_item11 = Regex::new(r"(?i)(?:^|[\s:;])(?:11|[lI]{2})[\.\,\:\;\s\-]*([0-9oOQIl]{1,4}(?:[\.\,][0-9oOQIl]{3})+(?:[\,\.][0-9oOQIl]{2})?)").unwrap();

    // Standalone luas fallback with unit (e.g. "66,00 m2" on a line without "7.")
    let re_luas_fallback_unit = Regex::new(r"(?i)\b([0-9oOQIl]{2,4}[\,\.][0-9oOQIl]{1,2})\s*(?:m2|m²|m'|m:|rn2)\b").unwrap();

    // Regex to detect header of NJOP column
    let re_header_njop = Regex::new(r"(?i)(?:njop\s*(?:pbb)?\s*/\s*m|n\}op|mop\s*rn2)").unwrap();

    let mut njop_header_line_idx: Option<usize> = None;
    let mut passed_section_a = false;

    // Line-by-line pass to extract items without cross-line bleeding
    for (idx, line) in ocr_lines.iter().enumerate() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        // Detect passing Section A (identitas wajib pajak)
        if lower.contains("nop") || lower.contains("3321") || lower.contains("letak tanah") || lower.contains("penghitungan") || lower.contains("penghltungan") || lower.contains("uraian") {
            passed_section_a = true;
        }

        // Section A lines like "9. Kode Pos" or "11. No HP" should be ignored
        if lower.contains("kode pos") || lower.contains("no hp") || lower.contains("telepon") || lower.contains("telp") {
            continue;
        }

        if re_header_njop.is_match(trimmed) {
            njop_header_line_idx = Some(idx);
        }

        // Only scan items after Section A (or after index 20)
        if !passed_section_a && idx < 20 {
            continue;
        }

        // 1. Try match Item 9 (NJOP/m2 Tanah)
        if njop_m2 == 0 {
            if let Some(caps) = re_item9.captures(trimmed).or_else(|| re_item9_simple.captures(trimmed)) {
                if let Some(val) = parse_rupiah_amount(&caps[1]) {
                    if val >= 1_000 && val <= 50_000_000 {
                        njop_m2 = val;
                    }
                }
            }
        }

        // 2. Try match Item 7 (Luas Tanah)
        if luas_tanah == 0.0 {
            if let Some(caps) = re_item7_with_unit.captures(trimmed).or_else(|| re_item7_plain.captures(trimmed)) {
                if let Some(val) = parse_luas_amount(&caps[1]) {
                    if val >= 10.0 && val <= 50000.0 {
                        luas_tanah = val;
                    }
                }
            }
        }

        // 3. Try match Item 11 (Luas x NJOP PBB / m2 Tanah)
        if total_tanah == 0 {
            if let Some(caps) = re_item11.captures(trimmed) {
                if let Some(val) = parse_rupiah_amount(&caps[1]) {
                    if val >= 10_000 && val <= 100_000_000_000 {
                        total_tanah = val;
                    }
                }
            }
        }
    }

    // Fallback 1: Look directly below "NJOP PBB / m" header if Item 9 had no prefix
    if njop_m2 == 0 {
        if let Some(h_idx) = njop_header_line_idx {
            for lookahead_idx in (h_idx + 1)..=std::cmp::min(h_idx + 3, ocr_lines.len().saturating_sub(1)) {
                let candidate_line = &ocr_lines[lookahead_idx];
                if candidate_line.to_lowercase().contains("harga") || candidate_line.to_lowercase().contains("luas x") {
                    break;
                }
                if let Some(val) = parse_rupiah_amount(candidate_line) {
                    if val >= 1_000 && val <= 50_000_000 {
                        njop_m2 = val;
                        break;
                    }
                }
            }
        }
    }

    // Fallback 2: Luas tanah from standalone unit match (e.g. "66,00 m2" when "7." was detached)
    if luas_tanah == 0.0 {
        for line in ocr_lines.iter().skip(30).take(40) {
            if let Some(caps) = re_luas_fallback_unit.captures(line) {
                if let Some(val) = parse_luas_amount(&caps[1]) {
                    if val >= 10.0 && val <= 50000.0 {
                        luas_tanah = val;
                        break;
                    }
                }
            }
        }
    }

    // Mathematical Triangulation & Fallback Invariant:
    // Item 11 (Total Nilai Tanah) = Item 7 (Luas) * Item 9 (NJOP/m2)
    if total_tanah > 0 && luas_tanah > 0.0 {
        let calc_njop = (total_tanah as f64 / luas_tanah).round() as u64;
        if njop_m2 == 0 {
            // Recover missing NJOP from Item 11 / Luas!
            njop_m2 = calc_njop;
        } else {
            // Check consistency: if Item 9 and math don't match, verify if luas was misread (e.g. 8 instead of 66)
            let diff = (njop_m2 as i64 - calc_njop as i64).abs();
            if diff > 100 {
                let expected_luas = (total_tanah as f64 / njop_m2 as f64).round();
                if (expected_luas - luas_tanah).abs() > 0.5 && expected_luas >= 10.0 && expected_luas <= 50000.0 {
                    luas_tanah = expected_luas;
                } else if calc_njop >= 1_000 && calc_njop <= 50_000_000 {
                    if calc_njop % 1000 == 0 || calc_njop % 50 == 0 {
                        njop_m2 = calc_njop;
                    }
                }
            }
        }
    } else if total_tanah > 0 && njop_m2 > 0 && luas_tanah == 0.0 {
        // Recover missing Luas from Item 11 / NJOP!
        let calc_luas = (total_tanah as f64 / njop_m2 as f64).round();
        if calc_luas >= 10.0 && calc_luas <= 50000.0 {
            luas_tanah = calc_luas;
        }
    }

    // Final fallback for NJOP: search for general currency pattern in Section B lines
    if njop_m2 == 0 {
        let re_njop_fallback = Regex::new(r"\b([0-9oOQIl]{2,4}\.[0-9oOQIl]{3})[\,\.][0-9oOQIl]{2}\b").unwrap();
        for line in ocr_lines.iter().skip(40).take(35) {
            let lower = line.to_lowercase();
            if lower.contains("npop") || lower.contains("setor") || lower.contains("bayar") {
                continue;
            }
            if let Some(caps) = re_njop_fallback.captures(line) {
                if let Some(val) = parse_rupiah_amount(&caps[1]) {
                    if val >= 1_000 && val <= 50_000_000 {
                        njop_m2 = val;
                        break;
                    }
                }
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
    fn test_parse_rupiah_amount() {
        assert_eq!(parse_rupiah_amount("27.ooo,oo"), Some(27000));
        assert_eq!(parse_rupiah_amount("7.150,OO"), Some(7150));
        assert_eq!(parse_rupiah_amount("4.536.ooo,oo"), Some(4536000));
        assert_eq!(parse_rupiah_amount("35.442.ooo,oo"), Some(35442000));
        assert_eq!(parse_rupiah_amount("1.315.600,oo"), Some(1315600));
        assert_eq!(parse_rupiah_amount("537.000,00"), Some(537000));
        assert_eq!(parse_rupiah_amount("394.000"), Some(394000));
        assert_eq!(parse_rupiah_amount("48.000,00"), Some(48000));
    }

    #[test]
    fn test_parse_bphtb_umiyati() {
        let lines = vec![
            "PEMERINTAH KABUPATEN DEMAK".into(),
            "SSPD".into(),
            "211202632917".into(),
            "06887/SSPD/BPHTB/2026".into(),
            "Tahun Pajak : 2026".into(),
            "Nama Wajib Pajak".into(),
            "UMIYATI".into(),
            "3321044908790001".into(),
            ": 332104001402300530".into(),
            "Penghitungan NJOP PBB".into(),
            "ranah (bumi)".into(),
            "Luas".into(),
            "7. 168,00 m2".into(),
            "8. 50,00 m?".into(),
            "NJOP PBB / m:".into(),
            "9. 27.ooo,oo".into(),
            "10. 225.ooo,oo".into(),
            "Luas x NJOP PBB / m2".into(),
            "11. 4.536.ooo,oo".into(),
        ];
        let data = parse_bphtb_text(&lines);
        assert_eq!(data.luas_tanah, 168.0);
        assert_eq!(data.njop_m2, 27000);
        assert_eq!(data.nop, "332104001402300530");
        assert_eq!(data.nama_wajib_pajak, "UMIYATI");
    }

    #[test]
    fn test_parse_bphtb_arwani() {
        let lines = vec![
            "PEMERINTAH KABUPATEN DEMAK".into(),
            "211202630622".into(),
            "Tahun Pajak : 2026".into(),
            "Nama Wajib Pajak".into(),
            "ARWANI".into(),
            "3321040903860004".into(),
            ": 332104001202100550".into(),
            "Penghitungan NJOP PBB".into(),
            "Tanah (bumi)".into(),
            "Luas".into(),
            "7. 184,00 m2".into(),
            "N}OP PBB / m2".into(),
            "g. 7.150,OO".into(),
            "Luas x NJOP PBB 1 rn2".into(),
            "11.1.315.600,oo".into(),
        ];
        let data = parse_bphtb_text(&lines);
        assert_eq!(data.luas_tanah, 184.0);
        assert_eq!(data.njop_m2, 7150);
        assert_eq!(data.nop, "332104001202100550");
        assert_eq!(data.nama_wajib_pajak, "ARWANI");
    }

    #[test]
    fn test_parse_bphtb_rizal_zakaria() {
        let lines = vec![
            "PEMERINTAH KABUPATEN DEMAK".into(),
            "211202633713".into(),
            "Tahun Pajak : 2026".into(),
            "RIZAL ZAKARIA".into(),
            "3327082703950021".into(),
            "332107000400901000".into(),
            "Penghltungan NJOP PBB".into(),
            "Uraian".into(),
            "(anah (bumi)".into(),
            "7. 72,00 m'".into(),
            "8. 30,00 m:".into(),
            "NJOP PBB / m".into(),
            "9. 335.000,00".into(),
            "10. 968.000,oo".into(),
            "Pt NCHII UNGAN BPH TB (Hanya diisi berdasarkan penghitungan Wajib Pajak)".into(),
            "Luas x NJOP PBB /".into(),
            "11. 24.120.ooo,oo".into(),
        ];
        let data = parse_bphtb_text(&lines);
        assert_eq!(data.luas_tanah, 72.0);
        assert_eq!(data.njop_m2, 335000);
        assert_eq!(data.nop, "332107000400901000");
    }

    #[test]
    fn test_parse_bphtb_muhammad_naufal() {
        let lines = vec![
            "PEMERINTAH KABUPATEN DEMAK".into(),
            "211202631195".into(),
            "Tahun Pajak : 2026".into(),
            "MUHAMMAD NAUFAL SYAHRURROFIF".into(),
            "3374040910030001".into(),
            "33210200090t0052to".into(),
            "Penghitungan NJOP PBB".into(),
            "Tanah (bumi)".into(),
            "7.".into(),
            "8.".into(),
            "66,00 m2".into(),
            "30.00".into(),
            "MOP rn2".into(),
            "9. 537.ooo,oo".into(),
            "10. %8.ooo.oo".into(),
            "X Njep".into(),
            "11. 35.442.ooo,oo".into(),
        ];
        let data = parse_bphtb_text(&lines);
        assert_eq!(data.luas_tanah, 66.0);
        assert_eq!(data.njop_m2, 537000);
    }

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
