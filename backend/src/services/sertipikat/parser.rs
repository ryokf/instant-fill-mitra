use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SertipikatData {
    pub nomor_berkas: String,
    pub tahun_berkas: String,
    pub nib: String,
    pub nib_elektronik: String,
    pub nomor_seri_blangko: String,
    pub jenis_hak: String,
    pub desa: String,
    pub kecamatan: String,
    pub kabupaten: String,
    pub provinsi: String,
    pub luas_m2: String,
    pub nama_pemilik: String,
    pub ntpn: String,
}

pub fn clean_text(input: &str) -> String {
    let re_spaces = Regex::new(r"\s+").unwrap();
    re_spaces.replace_all(input, " ").trim().to_string()
}

pub fn parse_sertipikat_text(ocr_lines: &[String]) -> SertipikatData {
    let raw_text = ocr_lines.join("\n");

    // 1. Nomor Berkas dan Tahun Berkas
    let mut nomor_berkas = String::new();
    let mut tahun_berkas = String::from("2026");

    let re_berkas_full = Regex::new(r"(?i)\b(?:no\.?|nomor)?\s*(?:berkas)?\s*[:\s]*([0-9]{3,8})\s*/\s*(20\d{2}|19\d{2})\b").unwrap();
    let re_berkas_keyword = Regex::new(r"(?i)berkas\s*[:\s]*([0-9]{3,8})").unwrap();

    for line in ocr_lines {
        let low = line.to_lowercase();
        if low.contains("tanggungan") || low.contains("roya") || low.contains("peringkat") || low.contains("pemberian") {
            continue;
        }
        if let Some(caps) = re_berkas_full.captures(line) {
            nomor_berkas = caps[1].to_string();
            tahun_berkas = caps[2].to_string();
            break;
        }
    }

    if nomor_berkas.is_empty() {
        for line in ocr_lines {
            let low = line.to_lowercase();
            if low.contains("tanggungan") || low.contains("roya") {
                continue;
            }
            if let Some(caps) = re_berkas_keyword.captures(line) {
                nomor_berkas = caps[1].to_string();
                break;
            }
        }
    }

    // 2. NIB (Nomor Identifikasi Bidang Tanah) & NIB Elektronik (14 digit tanpa titik)
    let mut nib = String::new();
    let mut nib_elektronik = String::new();
    let re_nib = Regex::new(r"(?i)\bNIB\s*[:\s]*([0-9][0-9.\s]{10,20}[0-9])\b").unwrap();
    if let Some(caps) = re_nib.captures(&raw_text) {
        nib = clean_text(&caps[1]);
        let digits_only: String = caps[1].chars().filter(|c| c.is_ascii_digit()).collect();
        if digits_only.len() >= 13 && digits_only.len() <= 14 {
            nib_elektronik = digits_only;
        }
    }

    if nib_elektronik.is_empty() {
        let re_14_digits = Regex::new(r"\b(11\d{11,12})\b").unwrap();
        if let Some(caps) = re_14_digits.captures(&raw_text) {
            nib_elektronik = caps[1].to_string();
            if nib.is_empty() {
                nib = nib_elektronik.clone();
            }
        }
    }

    // 3. Nomor Seri Blangko Sertipikat Elektronik (contoh: B1209978)
    let mut nomor_seri_blangko = String::new();
    let re_b_series = Regex::new(r"\b([A-Z]\d{6,8})\b").unwrap();

    for (idx, line) in ocr_lines.iter().enumerate() {
        let low = line.to_lowercase();
        if low.contains("seri") || low.contains("blangko") || low.contains("cetak") || low.contains("elektronik") {
            if let Some(caps) = re_b_series.captures(line) {
                nomor_seri_blangko = caps[1].to_string();
                break;
            }
            if idx + 1 < ocr_lines.len() {
                if let Some(caps) = re_b_series.captures(&ocr_lines[idx + 1]) {
                    nomor_seri_blangko = caps[1].to_string();
                    break;
                }
            }
        }
    }

    if nomor_seri_blangko.is_empty() {
        if let Some(caps) = re_b_series.captures(&raw_text) {
            nomor_seri_blangko = caps[1].to_string();
        }
    }

    // 4. Jenis Hak
    let mut jenis_hak = String::new();
    let re_hak = Regex::new(r"(?i)jenis\s*hak\s*[:\s]*([A-Za-z\s]+?)(?:NIB|No|Desa|Luas|Tanggal|\n|$)").unwrap();
    if let Some(caps) = re_hak.captures(&raw_text) {
        jenis_hak = clean_text(&caps[1]);
    } else {
        for line in ocr_lines {
            let low = line.to_lowercase();
            if low.contains("guna bangunan") {
                jenis_hak = "Hak Guna Bangunan".to_string();
                break;
            } else if low.contains("hak milik") {
                jenis_hak = "Hak Milik".to_string();
                break;
            } else if low.contains("hak pakai") {
                jenis_hak = "Hak Pakai".to_string();
                break;
            }
        }
    }

    // 5. Luas
    let mut luas_m2 = String::new();
    let re_luas = Regex::new(r"(?i)luas\s*[:\s]*([0-9.,]+)\s*(?:m2|m²)?").unwrap();
    if let Some(caps) = re_luas.captures(&raw_text) {
        luas_m2 = caps[1].replace(',', ".").trim().to_string();
    }

    // 6. NTPN
    let mut ntpn = String::new();
    let re_ntpn = Regex::new(r"(?i)NTPN\s*[:\s]*([A-Z0-9]{10,20})\b").unwrap();
    if let Some(caps) = re_ntpn.captures(&raw_text) {
        ntpn = caps[1].to_string();
    }

    // 7. Desa, Kecamatan, Kabupaten, Provinsi
    let mut desa = String::new();
    let mut kecamatan = String::new();
    let mut kabupaten = String::new();
    let mut provinsi = String::new();

    let re_desa = Regex::new(r"(?i)desa\s+([A-Za-z\s]+?)(?:\s+kecamatan|\s+kabupaten|$)").unwrap();
    if let Some(caps) = re_desa.captures(&raw_text) {
        desa = clean_text(&caps[1]);
    }

    let re_kec = Regex::new(r"(?i)kecamatan\s+([A-Za-z\s]+?)(?:\s+kabupaten|\s+kota|$)").unwrap();
    if let Some(caps) = re_kec.captures(&raw_text) {
        kecamatan = clean_text(&caps[1]);
    }

    let re_kab = Regex::new(r"(?i)(?:kabupaten|kota)\s+([A-Za-z\s]+?)(?:\s+provinsi|$)").unwrap();
    if let Some(caps) = re_kab.captures(&raw_text) {
        kabupaten = clean_text(&caps[1]);
    }

    let re_prov = Regex::new(r"(?i)provinsi\s+([A-Za-z\s]+?)(?:\n|No\s*SK|Luas|$)").unwrap();
    if let Some(caps) = re_prov.captures(&raw_text) {
        provinsi = clean_text(&caps[1]);
    }

    // 8. Nama Pemilik
    let mut nama_pemilik = String::new();
    let mut capture_pemilik = false;
    for line in ocr_lines {
        let low = line.to_lowercase();
        if low.contains("nama pemilik") {
            capture_pemilik = true;
            continue;
        }
        if capture_pemilik {
            let trimmed = clean_text(line);
            if !trimmed.is_empty() && !trimmed.starts_with("Catatan") && !trimmed.starts_with("Petunjuk") {
                nama_pemilik = trimmed.trim_start_matches(|c| c == '•' || c == '-' || c == '*' || c == ' ').to_string();
                break;
            }
        }
    }

    SertipikatData {
        nomor_berkas,
        tahun_berkas,
        nib,
        nib_elektronik,
        nomor_seri_blangko,
        jenis_hak,
        desa,
        kecamatan,
        kabupaten,
        provinsi,
        luas_m2,
        nama_pemilik,
        ntpn,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sample_pengecekan_sertipikat() {
        let lines = vec![
            "KEMENTERIAN AGRARIA DAN TATA RUANG/".to_string(),
            "BADAN PERTANAHAN NASIONAL".to_string(),
            "KANTOR PERTANAHAN KABUPATEN DEMAK".to_string(),
            "PENGECEKAN SERTIPIKAT".to_string(),
            "NTPN : 820260915145677 16/09/2026 08:42:24".to_string(),
            "No Berkas : 53119 / 2026".to_string(),
            "Sertipikat".to_string(),
            "Jenis Hak : Hak Guna Bangunan".to_string(),
            "NIB : 1109.000019761.0".to_string(),
            "Desa Kebonbatur Kecamatan Mranggen".to_string(),
            "Kabupaten Demak Provinsi Jawa Tengah".to_string(),
            "Luas : 60 m2".to_string(),
            "Nama Pemilik".to_string(),
            "• PT YUDHA MUDA SAKTI berkedudukan di SEMARANG".to_string(),
            "Informasi Blangko Sertipikat Elektronik".to_string(),
            "Sertipikat elektronik dicetak dengan nomor seri B1209978".to_string(),
        ];

        let res = parse_sertipikat_text(&lines);
        assert_eq!(res.nomor_berkas, "53119");
        assert_eq!(res.tahun_berkas, "2026");
        assert_eq!(res.nib_elektronik, "11090000197610");
        assert_eq!(res.nomor_seri_blangko, "B1209978");
        assert_eq!(res.jenis_hak, "Hak Guna Bangunan");
        assert_eq!(res.desa, "Kebonbatur");
        assert_eq!(res.kecamatan, "Mranggen");
        assert_eq!(res.kabupaten, "Demak");
        assert_eq!(res.provinsi, "Jawa Tengah");
        assert_eq!(res.luas_m2, "60");
        assert!(res.nama_pemilik.contains("PT YUDHA MUDA SAKTI"));
        assert_eq!(res.ntpn, "820260915145677");
    }
}
