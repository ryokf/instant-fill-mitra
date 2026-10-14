use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AktaInfo {
    pub nomor_akta: String,
    pub tanggal_akta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuyerJsonOutput {
    pub id: String,
    pub nik: String,
    pub nama: String,
    pub alamat: String,
    pub tempat_lahir: String,
    pub tgl_lahir: String,
    pub pekerjaan: String,
    pub tipe_bukti: String, // 1: KTP
    #[serde(default)]
    pub nomor_akta: String,
    #[serde(default)]
    pub tanggal_akta: String,
}

pub fn clean_text(input: &str) -> String {
    let re_dashes = Regex::new(r"[-_]{2,}").unwrap();
    let re_spaces = Regex::new(r"\s+").unwrap();
    let no_dashes = re_dashes.replace_all(input, " ");
    re_spaces.replace_all(&no_dashes, " ").trim().to_string()
}

pub fn parse_indonesian_day_word(text: &str) -> Option<u32> {
    // 1. Cek apakah di dalam teks sudah ada angka langsung (1..31)
    let re_digits = Regex::new(r"\b([1-9]|[12][0-9]|3[01])\b").unwrap();
    if let Some(c) = re_digits.captures(text) {
        if let Ok(d) = c[1].parse::<u32>() {
            return Some(d);
        }
    }

    // 2. Normalisasi teks OCR (karakter beraksen, umlaut, tanda hubung/titik)
    let mut cleaned = text.to_lowercase()
        .replace('ü', "u")
        .replace('ö', "o")
        .replace('é', "e")
        .replace('-', " ")
        .replace('.', " ")
        .replace(',', " ");

    // Normalisasi variasi OCR untuk "puluh" (misal: "lüuh", "luuh", "pluh", "puloh", "pulh")
    for typo in &["lüuh", "luuh", "pluh", "puloh", "pulh"] {
        cleaned = cleaned.replace(typo, "uluh");
    }
    cleaned = cleaned.replace("ppuluh", "puluh")
        .replace("p puluh", "puluh")
        .replace("duapuluh", "dua puluh")
        .replace("tigapuluh", "tiga puluh");

    let cleaned = cleaned.trim();

    let words = [
        ("tiga puluh satu", 31),
        ("tiga puluh", 30),
        ("dua puluh sembilan", 29),
        ("dua puluh delapan", 28),
        ("dua puluh tujuh", 27),
        ("dua puluh enam", 26),
        ("dua puluh lima", 25),
        ("dua puluh empat", 24),
        ("dua puluh tiga", 23),
        ("dua puluh dua", 22),
        ("dua puluh satu", 21),
        ("dua puluh", 20),
        ("sembilan belas", 19), ("sembilanbelas", 19),
        ("delapan belas", 18), ("delapanbelas", 18),
        ("tujuh belas", 17), ("tujuhbelas", 17),
        ("enam belas", 16), ("enambelas", 16),
        ("lima belas", 15), ("limabelas", 15),
        ("empat belas", 14), ("empatbelas", 14),
        ("tiga belas", 13), ("tigabelas", 13),
        ("dua belas", 12), ("duabelas", 12),
        ("sebelas", 11),
        ("sepuluh", 10),
    ];
    for (phrase, val) in words {
        if cleaned.contains(phrase) {
            return Some(val);
        }
    }

    // Heuristik komposisi jika OCR memisahkan atau salah baca imbuhan puluh/belas
    let has_duapuluh = cleaned.contains("dua puluh") || cleaned.contains("duapuluh") || cleaned.contains("duap") || cleaned.contains("duappuluh");
    let has_tigapuluh = cleaned.contains("tiga puluh") || cleaned.contains("tigapuluh") || cleaned.contains("tigap");
    let has_belas = cleaned.contains("belas");

    let unit = if cleaned.contains("sembilan") { Some(9) }
        else if cleaned.contains("delapan") { Some(8) }
        else if cleaned.contains("tujuh") { Some(7) }
        else if cleaned.contains("enam") { Some(6) }
        else if cleaned.contains("lima") { Some(5) }
        else if cleaned.contains("empat") { Some(4) }
        else if cleaned.contains("tiga") { Some(3) }
        else if cleaned.contains("dua") { Some(2) }
        else if cleaned.contains("satu") { Some(1) }
        else { None };

    if has_tigapuluh {
        return Some(30 + unit.unwrap_or(0));
    }
    if has_duapuluh {
        return Some(20 + unit.unwrap_or(0));
    }
    if has_belas {
        if let Some(u) = unit {
            return Some(10 + u);
        }
    }

    // Hanya jika BUKAN puluhan atau belasan, boleh cocokkan satuan 1..9
    let units_only = [
        ("sembilan", 9),
        ("delapan", 8),
        ("tujuh", 7),
        ("enam", 6),
        ("lima", 5),
        ("empat", 4),
        ("tiga", 3),
        ("dua", 2),
        ("satu", 1),
    ];
    for (phrase, val) in units_only {
        if cleaned.contains(phrase) {
            return Some(val);
        }
    }

    None
}

/// Ekstrak Nomor Akta dari baris OCR (Halaman 1 dan Halaman 2)
pub fn parse_akta_nomor(p1_lines: &[String], p2_lines: &[String]) -> String {
    let re_full = Regex::new(r"(?i)nomor\s*[:\s]*([0-9]+)\s*/\s*([0-9]{4})").unwrap();

    // 1. Coba cari di Halaman 1 (tepat di bawah tulisan AKTA JUAL BELI)
    let mut after_akta = false;
    let mut p1_after_akta_lines = Vec::new();
    for line in p1_lines {
        let low = line.to_lowercase();
        if low.contains("akta") || low.contains("jual beli") {
            after_akta = true;
        }
        if after_akta {
            if let Some(caps) = re_full.captures(line) {
                return format!("{}/{}", &caps[1], &caps[2]);
            }
            p1_after_akta_lines.push(line.clone());
        }
    }

    let p1_combined = p1_after_akta_lines.join(" ");
    if let Some(caps) = re_full.captures(&p1_combined) {
        return format!("{}/{}", &caps[1], &caps[2]);
    }

    // Jika OCR memisahkan angka nomor dan tahun ke baris berbeda di Halaman 1 (karena terpotong cap/stempel)
    let re_slash_year = Regex::new(r"/\s*(20\d{2}|19\d{2})").unwrap();
    let re_num_only = Regex::new(r"\b([0-9]{1,5})\b").unwrap();

    let mut found_year = None;
    let mut found_num = None;
    for line in &p1_after_akta_lines {
        if let Some(c) = re_slash_year.captures(line) {
            found_year = Some(c[1].to_string());
        }
        let trimmed = line.trim();
        if let Some(c) = re_num_only.captures(trimmed) {
            if c[1].len() <= 4 && Some(&c[1]) != found_year.as_deref() {
                found_num = Some(c[1].to_string());
            }
        }
    }

    if let (Some(num), Some(yr)) = (found_num, found_year) {
        return format!("{}/{}", num, yr);
    }

    // 2. Fallback ke Halaman 2 (di bawah AKTA JUAL BELI biasanya tercantum nomor juga)
    for line in p2_lines {
        if let Some(caps) = re_full.captures(line) {
            return format!("{}/{}", &caps[1], &caps[2]);
        }
    }

    String::new()
}

/// Ekstrak Tanggal Akta dari awal paragraf di Halaman 2 (format DD/MM/YYYY)
pub fn parse_akta_tanggal(p2_lines: &[String]) -> String {
    let mut header_text = String::new();
    let mut found_start = false;

    // Awal paragraf pembukaan akta di halaman 2 selalu diawali dengan "- Pada hari ini, ..."
    for line in p2_lines {
        let low = line.to_lowercase();
        if low.contains("pada hari ini") || low.contains("hari ini,") || low.contains("hari ini ") {
            found_start = true;
        }
        if found_start {
            header_text.push(' ');
            header_text.push_str(line);
            if low.contains("hadir dihadapan") || low.contains("menghadap") || header_text.len() > 300 {
                break;
            }
        }
    }

    // Fallback: Jika kata 'pada hari ini' tidak terbaca, ambil baris-baris setelah judul "Lembar" / "Akta Jual Beli"
    if header_text.is_empty() {
        let mut past_title = false;
        for line in p2_lines {
            let low = line.to_lowercase();
            if low.contains("lembar") || low.contains("akta jual beli") {
                past_title = true;
                continue;
            }
            if past_title {
                header_text.push(' ');
                header_text.push_str(line);
                if header_text.len() > 300 {
                    break;
                }
            }
        }
    }

    let lower = header_text.to_lowercase();

    // 1. Cari Bulan
    let months = [
        ("januari", "01"), ("februari", "02"), ("maret", "03"),
        ("april", "04"), ("mei", "05"), ("juni", "06"),
        ("juli", "07"), ("agustus", "08"), ("september", "09"),
        ("oktober", "10"), ("november", "11"), ("desember", "12"),
    ];

    let mut month_info: Option<(&str, usize, usize)> = None;
    for (m_name, m_code) in months {
        if let Some(pos) = lower.find(m_name) {
            month_info = Some((m_code, pos, pos + m_name.len()));
            break;
        }
    }

    let (month, month_start, month_end) = match month_info {
        Some(info) => info,
        None => return String::new(),
    };

    // Substring sebelum bulan untuk tanggal, dan substring setelah bulan untuk tahun
    let prefix = &header_text[..month_start];
    let suffix = &header_text[month_end..];

    // 2. Tahun (dari setelah nama bulan)
    let re_year = Regex::new(r"\b(19\d{2}|20\d{2})\b").unwrap();
    let year = match re_year.captures(suffix).or_else(|| re_year.captures(&header_text)) {
        Some(c) => c[1].to_string(),
        None => return String::new(),
    };

    // 3. Tanggal (dari teks sebelum nama bulan)
    let mut day_num: Option<u32> = None;

    // Kasus A: Ada tanda kurung tepat sebelum bulan, misal "(empatbelas)" atau "(duapLüuh empat)" atau "(14)"
    let re_parens = Regex::new(r"\(([^)]+)\)").unwrap();
    if let Some(last_paren) = re_parens.captures_iter(prefix).last() {
        if let Some(d) = parse_indonesian_day_word(&last_paren[1]) {
            day_num = Some(d);
        }
    }

    // Kasus B: Ada angka digit langsung di prefix, misal "tanggal 14" atau " 24 "
    if day_num.is_none() {
        let re_digits = Regex::new(r"\b([1-9]|[12][0-9]|3[01])\b").unwrap();
        for cap in re_digits.captures_iter(prefix) {
            if let Ok(d) = cap[1].parse::<u32>() {
                day_num = Some(d);
            }
        }
    }

    // Kasus C: Teks terbilang langsung tanpa kurung di prefix
    if day_num.is_none() {
        day_num = parse_indonesian_day_word(prefix);
    }

    let day = match day_num {
        Some(d) => d,
        None => return String::new(),
    };

    format!("{:02}/{}/{}", day, month, year)
}

pub fn parse_indonesian_date(text: &str) -> Option<String> {
    let re_day = Regex::new(r"(?i)tanggal\s+(\d{1,2})").unwrap();
    let re_year = Regex::new(r"(?i)(?:tahun\s+)?\b(19\d{2}|20\d{2})\b").unwrap();

    let day = re_day.captures(text).map(|c| {
        let d: u32 = c[1].parse().unwrap_or(1);
        format!("{:02}", d)
    })?;

    let year = re_year.captures(text).map(|c| c[1].to_string())?;

    let lower = text.to_lowercase();
    let month = if lower.contains("januari") {
        "01"
    } else if lower.contains("februari") {
        "02"
    } else if lower.contains("maret") {
        "03"
    } else if lower.contains("april") {
        "04"
    } else if lower.contains("mei") {
        "05"
    } else if lower.contains("juni") {
        "06"
    } else if lower.contains("juli") {
        "07"
    } else if lower.contains("agustus") {
        "08"
    } else if lower.contains("september") {
        "09"
    } else if lower.contains("oktober") {
        "10"
    } else if lower.contains("november") {
        "11"
    } else if lower.contains("desember") {
        "12"
    } else {
        return None;
    };

    Some(format!("{}/{}/{}", day, month, year))
}

pub fn parse_buyer_to_custom_json(raw_text: &str, custom_id: Option<&str>) -> BuyerJsonOutput {
    let cleaned = clean_text(raw_text);

    // 1. ID
    let id = custom_id.unwrap_or("12345").to_string();

    // 2. NIK (16 digit)
    let nik_re = Regex::new(r"\b(\d{16})\b").unwrap();
    let nik = nik_re.captures(&cleaned).map(|c| c[1].to_string()).unwrap_or_default();

    // 3. Nama
    let nama_re = Regex::new(
        r"(?i)(?:(?:I{1,3}|IV|V|\d+)[\.\-\s]+)?(?:Tuan|Nyonya|Nona|Tn\.|Ny\.|Saudara|Sdri\.|Perseroan Terbatas|PT\.?)\s+([A-Z\s\.\,\'\`]+?)(?:,|\s+Warga|\s+lahir|\s+pemegang|\s+bertempat)"
    ).unwrap();

    let mut nama = String::new();
    if let Some(caps) = nama_re.captures(&cleaned) {
        let mut raw_name = caps[1].trim().to_string();
        raw_name = raw_name.trim_matches(|c: char| c == ',' || c == '.' || c == '-').trim().to_string();
        nama = raw_name;
    } else {
        // Fallback: cari kata-kata kapital di baris pertama
        let fallback_nama = Regex::new(r"(?i)(?:(?:I{1,3}|IV|V|\d+)[\.\-\s]+)?([A-Z\s]{4,35})(?:,|\s+Warga)").unwrap();
        if let Some(caps) = fallback_nama.captures(&cleaned) {
            nama = caps[1].trim().to_string();
        }
    }

    // 4. Tempat Lahir
    let tempat_re = Regex::new(r"(?i)lahir\s+di\s+([^,]+)").unwrap();
    let tempat_lahir = tempat_re.captures(&cleaned).map(|c| c[1].trim().to_string()).unwrap_or_default();

    // 5. Tanggal Lahir (DD/MM/YYYY)
    let tgl_lahir = parse_indonesian_date(&cleaned).unwrap_or_default();

    // 6. Pekerjaan
    let pek_re = Regex::new(r"(?i)(?:tahun\s+\d+|[a-z0-9]+\))\s*,\s*([A-Za-z\/\s\-]+?),\s*(?:pemegang|Nomor|Induk|Kependudukan)").unwrap();
    let pek_fallback = Regex::new(r"(?i)\b(Pelajar\/Mahasiswa|Pelajar\/\s*Mahasiswa|Karyawan\s+Swasta|Pegawai\s+Negeri\s+Sipil|PNS|Wiraswasta|Pedagang|Petani|Buruh|Ibu\s+Rumah\s+Tangga|Belum\/Tidak\s+Bekerja)\b").unwrap();

    let mut pekerjaan = String::new();
    if let Some(c) = pek_re.captures(&cleaned) {
        let p = c[1].trim().trim_matches(|ch: char| ch == ',' || ch == '.').trim().to_string();
        pekerjaan = p;
    } else if let Some(c) = pek_fallback.captures(&cleaned) {
        pekerjaan = c[1].trim().to_string();
    }
    // Normalkan ejaan: "Pelajar/ Mahasiswa" atau "Pelajar/Mahasiswa" -> "Pelajar / Mahasiswa"
    if pekerjaan.to_lowercase().contains("pelajar") && pekerjaan.to_lowercase().contains("mahasiswa") {
        pekerjaan = "Pelajar / Mahasiswa".to_string();
    }

    // 7. Alamat
    let mut alamat = String::new();
    if let Some(pos) = cleaned.to_lowercase().find("bertempat tinggal di ") {
        let sub = &cleaned[pos + "bertempat tinggal di ".len()..];
        let sub_low = sub.to_lowercase();
        let mut end_pos = sub.len();

        for marker in ["-untuk", "untuk selanjutnya", "pihak kedua", "pembeli", "\"pihak"] {
            if let Some(idx) = sub_low.find(marker) {
                if idx < end_pos {
                    end_pos = idx;
                }
            }
        }

        let raw_addr = sub[..end_pos].trim().trim_matches(|ch: char| ch == '.' || ch == '-' || ch == ' ').trim();
        alamat = raw_addr.to_string();
    }

    // 8. Tipe Bukti (1: KTP)
    let tipe_bukti = "1".to_string();

    BuyerJsonOutput {
        id,
        nik,
        nama,
        alamat,
        tempat_lahir,
        tgl_lahir,
        pekerjaan,
        tipe_bukti,
        nomor_akta: String::new(),
        tanggal_akta: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sample_text() {
        let sample = r#"
11.-Tuan MUHAMMAD FADHLILLAH, Warga Negara Indonesia, lahir
di Demak, tanggal 06 (enam) Desember tahun 2006 (duaribu
enam), Pelajar/ Mahasiswa, Induk pemegang Nomor
Kependudukan (NIK): 3321010612060001, bertempat tinggal di
Kabupaten Demak, Pondok Majapahit I Blok KK Nomor 17,
Rukun Tetangga 006, Rukun Warga 005, Desa Bandungrejo,
Kecamatan Mranggen.-
-untuk selanjutnya dalam akta ini disebut:-
-"Pihak Kedua/ Pembeli".
"#;
        let res = parse_buyer_to_custom_json(sample, Some("12345"));
        assert_eq!(res.id, "12345");
        assert_eq!(res.nik, "3321010612060001");
        assert_eq!(res.nama, "MUHAMMAD FADHLILLAH");
        assert_eq!(res.tempat_lahir, "Demak");
        assert_eq!(res.tgl_lahir, "06/12/2006");
        assert_eq!(res.pekerjaan, "Pelajar / Mahasiswa");
        assert_eq!(res.tipe_bukti, "1");
        assert!(res.alamat.contains("Kabupaten Demak"));
    }

    #[test]
    fn test_parse_akta_nomor_and_tanggal_user_example() {
        let p1 = vec![
            "PEJABAT PEMBUAT AKTA TANAH".to_string(),
            "AKTA".to_string(),
            "JUAL BELI".to_string(),
            "Nomor :  532   /  2026.-".to_string(),
        ];
        let p2 = vec![
            "AKTA JUAL BELI".to_string(),
            "Nomor: 532/2026".to_string(),
            "- Pada hari ini, Senin, tanggal 14 (empatbelas) September-----".to_string(),
            "tahun 2026 (duaribu duapuluh enam) , ------------------------".to_string(),
            "- Hadir dihadapan saya, Doktor SRI WAHYUNINGSIH...".to_string(),
        ];

        let no = parse_akta_nomor(&p1, &p2);
        assert_eq!(no, "532/2026");

        let tgl = parse_akta_tanggal(&p2);
        assert_eq!(tgl, "14/09/2026");
    }

    #[test]
    fn test_parse_akta_nomor_and_tanggal_sample_pdf() {
        let p1 = vec![
            "Nomor".to_string(),
            "AKTA".to_string(),
            "JUAL BELI".to_string(),
            "/ 2026.-".to_string(),
            "574".to_string(),
        ];
        let p2 = vec![
            "AKTA JUAL BELI".to_string(),
            "Nomor: 574/2026.—".to_string(),
            "Lembar Kedua".to_string(),
            "— Pada hari ini, Kamis, tanggal (duapuluh empat) September tahun—".to_string(),
            "2026 (duaribu duapuluh enam )".to_string(),
            "- Hadir dihadapan saya, SRI WAHYUNINGSIH...".to_string(),
        ];

        let no = parse_akta_nomor(&p1, &p2);
        assert_eq!(no, "574/2026");

        let tgl = parse_akta_tanggal(&p2);
        assert_eq!(tgl, "24/09/2026");
    }
}
