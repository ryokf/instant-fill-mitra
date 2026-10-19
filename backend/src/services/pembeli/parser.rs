use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AktaInfo {
    pub nomor_akta: String,
    pub tanggal_akta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PeroranganInfo {
    pub nik: String,
    pub nama: String,
    pub alamat: String,
    pub tempat_lahir: String,
    pub tgl_lahir: String,
    pub jenis_kelamin: String,
    pub pekerjaan: String,
    pub tipe_bukti: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct PenjualOutput {
    pub is_pt: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pt_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pt_nik: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pt_representative: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub penjual_perorangan: Option<PeroranganInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persetujuan: Option<PeroranganInfo>,
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

    // 1. Coba cari di Halaman 1 (di bawah judul AKTA JUAL BELI, abaikan kop)
    let mut after_akta = false;
    let mut p1_after_akta_lines = Vec::new();
    for line in p1_lines {
        let low = line.to_lowercase();
        let is_kop = low.contains("pejabat") || low.contains("daerah kerja") || low.contains("sk.") || low.contains("kepala bpn");
        if !is_kop && (low.contains("akta jual beli") || low.contains("jual beli") || low.trim() == "akta") {
            after_akta = true;
            continue;
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

    // 2. Fallback ke Halaman 2 (tepat di bawah judul AKTA JUAL BELI)
    let mut after_akta_p2 = false;
    for line in p2_lines {
        let low = line.to_lowercase();
        let is_kop = low.contains("pejabat") || low.contains("sk.") || low.contains("kepala bpn");
        if !is_kop && (low.contains("akta jual beli") || low.contains("jual beli")) {
            after_akta_p2 = true;
            continue;
        }
        if after_akta_p2 {
            if let Some(caps) = re_full.captures(line) {
                return format!("{}/{}", &caps[1], &caps[2]);
            }
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
    let lower = text.to_lowercase();
    let re_year = Regex::new(r"(?i)(?:tahun\s+)?\b(19\d{2}|20\d{2})\b").unwrap();
    let year = re_year.captures(text).map(|c| c[1].to_string())?;

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

    let re_day = Regex::new(r"(?i)(?:tanggal|tanggai|tangga1|tgl)\s*[:\s]*(\d{1,2})").unwrap();
    let day = if let Some(c) = re_day.captures(text) {
        let d: u32 = c[1].parse().unwrap_or(1);
        format!("{:02}", d)
    } else if let Some(d) = parse_indonesian_day_word(text) {
        format!("{:02}", d)
    } else {
        return None;
    };

    Some(format!("{}/{}/{}", day, month, year))
}

pub fn determine_gender(text: &str, nik: &str) -> String {
    let lower = text.to_lowercase();
    if lower.contains("nyonya") || lower.contains("ny.") || lower.contains("nona") || lower.contains("nn.") || lower.contains("sdri") {
        return "Perempuan".to_string();
    }
    if lower.contains("tuan") || lower.contains("tn.") || lower.contains("saudara") || lower.contains("sdr.") {
        return "Laki-laki".to_string();
    }
    // Cek NIK: digit 7-8 adalah tanggal lahir, wanita ditambah 40 (41-71)
    if nik.len() == 16 {
        if let Ok(d) = nik[6..8].parse::<u32>() {
            if d > 40 {
                return "Perempuan".to_string();
            } else {
                return "Laki-laki".to_string();
            }
        }
    }
    "Laki-laki".to_string()
}

pub fn extract_nik_from_text(text: &str) -> String {
    let re_nik = Regex::new(r"\b(\d{16})\b").unwrap();
    if let Some(c) = re_nik.captures(text) {
        return c[1].to_string();
    }
    let re_nik_spaced = Regex::new(r"(?i)(?:nik|kependudukan)[\s\:\-\.]*(\d[\d\s\-]{14,22}\d)").unwrap();
    if let Some(c) = re_nik_spaced.captures(text) {
        let digits: String = c[1].chars().filter(|ch| ch.is_ascii_digit()).collect();
        if digits.len() == 16 {
            return digits;
        }
    }
    String::new()
}

pub fn extract_name_from_person_text(text: &str) -> String {
    let nama_re = Regex::new(
        r"(?i)(?:(?:I{1,3}|IV|V|\d+)[\.\-\s]+)?(?:penghadap\s+)?(?:Tuan|Nyonya|Nona|Tn\.|Ny\.|Saudara|Sdri\.)\s+([A-Za-z\s\.\,\'\`]+?)(?:,|\s+Warga|\s+lahir|\s+pemegang|\s+bertempat)"
    ).unwrap();

    if let Some(caps) = nama_re.captures(text) {
        let mut raw_name = caps[1].trim().to_string();
        raw_name = raw_name.trim_matches(|c: char| c == ',' || c == '.' || c == '-' || c == '_').trim().to_string();
        return raw_name;
    }

    let fallback_nama = Regex::new(r"(?i)(?:(?:I{1,3}|IV|V|\d+)[\.\-\s]+)?(?:penghadap\s+)?([A-Z\s]{4,35})(?:,|\s+Warga)").unwrap();
    if let Some(caps) = fallback_nama.captures(text) {
        return caps[1].trim().to_string();
    }

    String::new()
}

pub fn extract_birth_place(text: &str) -> String {
    let re = Regex::new(r"(?i)lahir\s+di\s+([^,]+)").unwrap();
    re.captures(text)
        .map(|c| c[1].trim().trim_matches(|ch: char| ch == ',' || ch == '.' || ch == '-').trim().to_string())
        .unwrap_or_default()
}

pub fn extract_job(text: &str) -> String {
    let pek_re = Regex::new(r"(?i)(?:tahun\s+\d+|[a-z0-9]+\))\s*,\s*([A-Za-z\/\s\-]+?),\s*(?:pemegang|Nomor|Induk|Kependudukan)").unwrap();
    let pek_fallback = Regex::new(r"(?i)\b(Pelajar\/Mahasiswa|Pelajar\/\s*Mahasiswa|Karyawan\s+Swasta|Pegawai\s+Negeri\s+Sipil|PNS|Wiraswasta|Pedagang|Petani|Buruh|Ibu\s+Rumah\s+Tangga|Mengurus\s+Rumah\s+Tangga|Belum\/Tidak\s+Bekerja|Tidak\s+Bekerja)\b").unwrap();

    let mut pekerjaan = String::new();
    if let Some(c) = pek_re.captures(text) {
        pekerjaan = c[1].trim().trim_matches(|ch: char| ch == ',' || ch == '.').trim().to_string();
    } else if let Some(c) = pek_fallback.captures(text) {
        pekerjaan = c[1].trim().to_string();
    }
    if pekerjaan.to_lowercase().contains("pelajar") && pekerjaan.to_lowercase().contains("mahasiswa") {
        pekerjaan = "Pelajar / Mahasiswa".to_string();
    }
    pekerjaan
}

pub fn extract_shared_address(text: &str) -> String {
    let cleaned = clean_text(text);
    let lower = cleaned.to_lowercase();
    let markers = [
        "kedua-duanya bertempat tinggal di ",
        "keduanya bertempat tinggal di ",
        "bertempat tinggal di ",
    ];

    for marker in markers {
        if let Some(pos) = lower.find(marker) {
            let sub = &cleaned[pos + marker.len()..];
            let sub_low = sub.to_lowercase();
            let mut end_pos = sub.len();
            for end_marker in [
                ", pada saat ini",
                "pada saat ini",
                ", untuk sementara waktu",
                "untuk sementara waktu",
                "-untuk selanjutnya",
                "untuk selanjutnya",
                "dalam akta ini disebut",
                "pihak pertama",
                "pihak kedua",
                "\"pihak",
            ] {
                if let Some(idx) = sub_low.find(end_marker) {
                    if idx < end_pos {
                        end_pos = idx;
                    }
                }
            }
            let raw_addr = sub[..end_pos].trim().trim_matches(|ch: char| ch == '.' || ch == '-' || ch == ',' || ch == ' ').trim();
            if !raw_addr.is_empty() {
                return raw_addr.to_string();
            }
        }
    }
    String::new()
}

pub fn is_pt_seller(text: &str) -> (bool, Option<String>) {
    let lower = text.to_lowercase();

    // 1. Cek langsung kecocokan dengan PT yang ada di database proyek (termasuk variasi OCR & pengurus)
    if lower.contains("yudha muda")
        || lower.contains("muda sakti")
        || lower.contains("gregorius")
        || lower.contains("3374132902000007")
    {
        return (true, Some("PT YUDHA MUDA SAKTI".to_string()));
    }
    if lower.contains("dwi perkasa")
        || lower.contains("perkasa utama")
        || lower.contains("abdus shomad")
        || lower.contains("3321010511670002")
    {
        return (true, Some("PT DWI PERKASA UTAMA".to_string()));
    }
    if lower.contains("amanah berkah")
        || lower.contains("berkah property")
        || lower.contains("luqman hakim")
        || lower.contains("septiana setyowati")
        || lower.contains("3321111409030002")
        || lower.contains("3321116209790006")
    {
        return (true, Some("PT AMANAH BERKAH PROPERTY".to_string()));
    }

    // 2. Cek kata kunci PT umum
    let is_pt = lower.contains("perseroan terbatas")
        || lower.contains("badan hukum")
        || lower.contains("direktur perseroan")
        || lower.contains("komisaris perseroan")
        || lower.contains("perseroan komanditer")
        || lower.contains("pt.")
        || lower.contains("p.t.")
        || Regex::new(r"(?i)\bpt\b\.?\s+[a-z]").unwrap().is_match(text);

    if !is_pt {
        return (false, None);
    }

    let re_pt_name = Regex::new(r"(?i)(?:perseroan\s+terbatas\s+(?:pt\.?\s+)?|pt\.?\s+)([A-Za-z0-9\s\.\,\-]+)").unwrap();
    let pt_name = re_pt_name.captures(text).and_then(|c| {
        let mut raw = c[1].to_string();
        let stop_markers = [
            " yang berkedudukan",
            " berkedudukan",
            " bertempat kedudukan",
            " dalam hal ini",
            " berkedudukan di",
            " beralamat",
            " selaku",
            " diwakili",
            " suatu perseroan",
            " telah mendapat",
            " berdasarkan",
            "\n",
            ",",
        ];
        let lower_raw = raw.to_lowercase();
        let mut min_pos = raw.len();
        for marker in stop_markers {
            if let Some(pos) = lower_raw.find(marker) {
                if pos < min_pos {
                    min_pos = pos;
                }
            }
        }
        raw.truncate(min_pos);
        let name = raw.trim().trim_matches(|ch: char| ch == ',' || ch == '.' || ch == '-').trim();
        if name.is_empty() {
            None
        } else {
            let upper = name.to_uppercase();
            if upper.starts_with("PT ") || upper.starts_with("PT.") {
                Some(upper.replace("PT.", "PT").split_whitespace().collect::<Vec<_>>().join(" "))
            } else {
                Some(format!("PT {}", upper.split_whitespace().collect::<Vec<_>>().join(" ")))
            }
        }
    });

    (true, pt_name)
}

pub fn parse_person_details(text: &str, default_alamat: &str) -> PeroranganInfo {
    let cleaned = clean_text(text);
    let nik = extract_nik_from_text(&cleaned);
    let nama = extract_name_from_person_text(&cleaned);
    let tempat_lahir = extract_birth_place(&cleaned);
    let tgl_lahir = parse_indonesian_date(&cleaned).unwrap_or_default();
    let pekerjaan = extract_job(&cleaned);
    let jenis_kelamin = determine_gender(&cleaned, &nik);

    let mut alamat = String::new();
    if let Some(pos) = cleaned.to_lowercase().find("bertempat tinggal di ") {
        let sub = &cleaned[pos + "bertempat tinggal di ".len()..];
        let sub_low = sub.to_lowercase();
        let mut end_pos = sub.len();
        for marker in [", pada saat ini", ", untuk sementara", "-untuk", "untuk selanjutnya", "pihak pertama", "pihak kedua", "penjual", "pembeli", "\"pihak"] {
            if let Some(idx) = sub_low.find(marker) {
                if idx < end_pos {
                    end_pos = idx;
                }
            }
        }
        let raw_addr = sub[..end_pos].trim().trim_matches(|ch: char| ch == '.' || ch == '-' || ch == ',' || ch == ' ').trim();
        alamat = raw_addr.to_string();
    }

    if alamat.is_empty() && !default_alamat.is_empty() {
        alamat = default_alamat.to_string();
    }

    PeroranganInfo {
        nik,
        nama,
        alamat,
        tempat_lahir,
        tgl_lahir,
        jenis_kelamin,
        pekerjaan,
        tipe_bukti: "1".to_string(),
    }
}

pub fn parse_penjual_section(raw_text: &str) -> PenjualOutput {
    let (is_pt, pt_name) = is_pt_seller(raw_text);
    if is_pt {
        let cleaned = clean_text(raw_text);
        let pt_nik = {
            let n = extract_nik_from_text(&cleaned);
            if n.is_empty() { None } else { Some(n) }
        };
        let pt_rep = {
            let r = extract_name_from_person_text(&cleaned);
            if r.is_empty() { None } else { Some(r) }
        };

        return PenjualOutput {
            is_pt: true,
            pt_name,
            pt_nik,
            pt_representative: pt_rep,
            penjual_perorangan: None,
            persetujuan: None,
        };
    }

    let shared_address = extract_shared_address(raw_text);

    let re_persetujuan_marker = Regex::new(
        r"(?i)(?:telah\s+mendapat\s+persetujuan|persetujuan\s+suami|persetujuan\s+istri|persetujuan\s+isteri|persetujuan\s+dari|persetujuan\s+kawan\s+kawin|dengan\s+persetujuan)"
    ).unwrap();

    if let Some(mat) = re_persetujuan_marker.find(raw_text) {
        let seller_part = &raw_text[..mat.start()];
        let persetujuan_part = &raw_text[mat.start()..];

        let penjual = parse_person_details(seller_part, &shared_address);
        let persetujuan = parse_person_details(persetujuan_part, &shared_address);

        PenjualOutput {
            is_pt: false,
            pt_name: None,
            pt_nik: None,
            pt_representative: None,
            penjual_perorangan: Some(penjual),
            persetujuan: Some(persetujuan),
        }
    } else {
        let penjual = parse_person_details(raw_text, &shared_address);
        PenjualOutput {
            is_pt: false,
            pt_name: None,
            pt_nik: None,
            pt_representative: None,
            penjual_perorangan: Some(penjual),
            persetujuan: None,
        }
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SaksiOutput {
    pub id: String,
    pub nik: String,
    pub nama: String,
    pub alamat: String,
    pub tempat_lahir: String,
    pub tgl_lahir: String,
    pub pekerjaan: String,
    pub tipe_bukti: String,
}

pub fn get_saksi_database() -> Vec<SaksiOutput> {
    vec![
        SaksiOutput {
            id: "1".to_string(),
            nik: "3315166105990001".to_string(),
            nama: "NURUL HIKMAH".to_string(),
            alamat: "Rejosari, RT 003 / RW 003, Desa Botorejo, Kecamatan Wonosalam, Kabupaten Demak".to_string(),
            tempat_lahir: "Grobogan".to_string(),
            tgl_lahir: "21/05/1999".to_string(),
            pekerjaan: "Wiraswasta".to_string(),
            tipe_bukti: "1".to_string(),
        },
        SaksiOutput {
            id: "2".to_string(),
            nik: "3321046311970003".to_string(),
            nama: "NOVIA MAHARSARI".to_string(),
            alamat: "Dukuh Ngobongan, RT 003 / RW 003, Desa Tanjungsekar, Kecamatan Pucakwangi, Kabupaten Pati".to_string(),
            tempat_lahir: "Semarang".to_string(),
            tgl_lahir: "23/11/1997".to_string(),
            pekerjaan: "Pelajar / Mahasiswa".to_string(),
            tipe_bukti: "1".to_string(),
        },
        SaksiOutput {
            id: "3".to_string(),
            nik: "3404021708990001".to_string(),
            nama: "RIDHWAN NUR CAHYO SAPUTRO".to_string(),
            alamat: "Jetis Prenggan, RT 001/RW 018, Desa Sidokarto, Kecamatan Godean, Kabupaten Sleman".to_string(),
            tempat_lahir: "Sleman".to_string(),
            tgl_lahir: "17/08/1999".to_string(),
            pekerjaan: "Pelajar / Mahasiswa".to_string(),
            tipe_bukti: "1".to_string(),
        },
        SaksiOutput {
            id: "4".to_string(),
            nik: "3321040608940002".to_string(),
            nama: "MUHAMMAD RIEFKY ABDILLAH".to_string(),
            alamat: "Jl. Kapas Timur VIII D G.1061, RT 004/RW 008, Kelurahan Gebangsari, Kecamatan Genuk, Kota Semarang".to_string(),
            tempat_lahir: "Demak".to_string(),
            tgl_lahir: "06/08/1994".to_string(),
            pekerjaan: "Karyawan Swasta".to_string(),
            tipe_bukti: "1".to_string(),
        },
    ]
}

/// Mengekstrak dan mencocokkan 2 saksi dari teks akta AJB
pub fn extract_saksi_from_text(text: &str) -> Vec<SaksiOutput> {
    let clean = clean_text(text).to_uppercase();
    let db = get_saksi_database();
    let mut matched = Vec::new();

    // 1. Cek kecocokan nama atau NIK masing-masing saksi
    for s in &db {
        let name_upper = s.nama.to_uppercase();
        let tokens: Vec<&str> = name_upper.split_whitespace().collect();
        let mut found = false;

        if clean.contains(&name_upper) || (!s.nik.is_empty() && clean.contains(&s.nik)) {
            found = true;
        } else if tokens.len() >= 2 {
            if clean.contains(tokens[0]) && clean.contains(tokens[1]) {
                found = true;
            }
        }

        if found && !matched.contains(s) {
            matched.push(s.clone());
        }
    }

    // 2. Jika hanya ketemu 1 saksi, lengkapi pasangannya secara otomatis
    if matched.len() == 1 {
        let first_id = &matched[0].id;
        if first_id == "1" {
            if let Some(s2) = db.iter().find(|s| s.id == "2") {
                matched.push(s2.clone());
            }
        } else if first_id == "2" {
            if let Some(s1) = db.iter().find(|s| s.id == "1") {
                matched.insert(0, s1.clone());
            }
        } else if first_id == "3" {
            if let Some(s4) = db.iter().find(|s| s.id == "4") {
                matched.insert(0, s4.clone());
            }
        } else if first_id == "4" {
            if let Some(s3) = db.iter().find(|s| s.id == "3") {
                matched.push(s3.clone());
            }
        }
    }

    matched
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
    fn test_parse_penjual_perorangan_with_persetujuan() {
        let sample = r#"
I.-Tuan SUMADI, Warga Negara Indonesia, lahir di Demak, tanggal
25 (duapuluh lima) Agustus tahun 1969 (seribu sembilan ratus
enampuluh sembilan), Karyawan Swasta, pemegang Nomor Induk
Kependudukan (NIK): 3374052508690001,
— menurut keterangannya untuk melakukan perbuatan hukum
dalam akta ini telah mendapat persetujuan suaminya
penghadap Nyonya ROCHIMAH, Warga Negara Indonesia,
lahir di Semarang, tanggal 01 (satu) Mei tahun 1972 (seribu
sembilanratus tujuhpuluh dua), Belum/Tidak Bekerja,
Pemegang Nomor Induk Kependudukan (NIK): -
3374054105720002,
— Kedua-duanya bertempat tinggal di Kota Semarang, Terboyo
Wetan, Rukun Tetangga 003, Rukun Warga 002, Kelurahan
Terboyo Wetan, Kecamatan Genuk, pada saat ini berada di
saya, PPAT, serta para saksi, -
—Untuk selanjutnya dalam akta ini disebut:-
-"Pihak Pertama/ Penjual".
"#;
        let out = parse_penjual_section(sample);
        assert!(!out.is_pt);
        assert!(out.penjual_perorangan.is_some());
        let penjual = out.penjual_perorangan.unwrap();
        assert_eq!(penjual.nama, "SUMADI");
        assert_eq!(penjual.nik, "3374052508690001");
        assert_eq!(penjual.tempat_lahir, "Demak");
        assert_eq!(penjual.tgl_lahir, "25/08/1969");
        assert_eq!(penjual.pekerjaan, "Karyawan Swasta");
        assert_eq!(penjual.jenis_kelamin, "Laki-laki");
        assert!(penjual.alamat.contains("Kota Semarang, Terboyo Wetan"));

        assert!(out.persetujuan.is_some());
        let persetujuan = out.persetujuan.unwrap();
        assert_eq!(persetujuan.nama, "ROCHIMAH");
        assert_eq!(persetujuan.nik, "3374054105720002");
        assert_eq!(persetujuan.tempat_lahir, "Semarang");
        assert_eq!(persetujuan.tgl_lahir, "01/05/1972");
        assert_eq!(persetujuan.pekerjaan, "Belum/Tidak Bekerja");
        assert_eq!(persetujuan.jenis_kelamin, "Perempuan");
        assert!(persetujuan.alamat.contains("Kota Semarang, Terboyo Wetan"));
    }

    #[test]
    fn test_parse_penjual_pt() {
        let sample = r#"
I. Perseroan Terbatas PT DWI PERKASA UTAMA, berkedudukan di Demak,
dalam hal ini diwakili oleh Tuan ABDUS SHOMAD...
-Untuk selanjutnya disebut:
-"Pihak Pertama/Penjual".
"#;
        let out = parse_penjual_section(sample);
        assert!(out.is_pt);
        assert_eq!(out.pt_name, Some("PT DWI PERKASA UTAMA".to_string()));
        assert!(out.penjual_perorangan.is_none());
        assert!(out.persetujuan.is_none());
    }

    #[test]
    fn test_parse_penjual_pt_person_first_then_pt() {
        let sample = r#"
I. Tuan GREGORIUS I GEDE SATRIA WIRA YUDA, lahir di Semarang, tanggal 29 Februari 2000, pemegang NIK 3374132902000007,
untuk selanjutnya dalam akta ini disebut PIHAK PERTAMA;
- yang dalam hal ini bertindak selaku kuasa Direktur Utama untuk dan atas nama perseroan terbatas PT YUDHA MUDA SAKTI, berkedudukan di Kota Semarang...
"#;
        let out = parse_penjual_section(sample);
        assert!(out.is_pt);
        assert_eq!(out.pt_name, Some("PT YUDHA MUDA SAKTI".to_string()));
        assert_eq!(out.pt_nik, Some("3374132902000007".to_string()));
        assert!(out.penjual_perorangan.is_none());
        assert!(out.persetujuan.is_none());
        assert!(out.pt_representative.is_some());
    }

    #[test]
    fn test_parse_umiyati_buyer_sample() {
        let sample = r#"
11. -Nyonya UMIYATI, Warga Negara Indonesia, lahir di Semarang,
tanggai 09 (sembilan) Agustus tahun 1979 (seribu
sembilanratus tujuhpuluh sembilan), Mengurus Rumah Tangga,
pemegang Nomor Induk Kependudukan (NIK):
3321044908790001, bertempat tinggal di Kabupaten Demak,
Sriwulan, Rukun Tetangga 004, Rukun Warga 002, Desa
Sriwulan, Kecamatan Sayung.-
-untuk selanjutnya dalam akta ini disebut:-
-"Pihak Kedua/Pembeli".-
"#;
        let res = parse_buyer_to_custom_json(sample, None);
        assert_eq!(res.nik, "3321044908790001");
        assert_eq!(res.nama, "UMIYATI");
        assert_eq!(res.tempat_lahir, "Semarang");
        assert_eq!(res.tgl_lahir, "09/08/1979");
        assert_eq!(res.pekerjaan, "Mengurus Rumah Tangga");
    }
}
