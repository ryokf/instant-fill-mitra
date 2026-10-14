use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PphData {
    /// Nomor Surat Keterangan Penelitian PPh (contoh: KET-06442/PHTB-CT/KPP.1012/2026)
    pub nomor_suket: String,
    /// NPWP Wajib Pajak (15 atau 16 digit)
    pub npwp: String,
    /// NPWP terformat (contoh: 00.277.240.0-451.000)
    pub npwp_formatted: String,
    /// Nama Wajib Pajak (poin A)
    pub nama_wp: String,
    /// Tanggal Surat Keterangan
    pub tanggal_suket: String,
    /// NOP jika tercantum pada dokumen
    pub nop: String,
    /// Kode Billing pembayaran jika ada
    pub kode_billing: String,
    /// NTPN bukti pembayaran jika ada
    pub ntpn: String,
    /// Jumlah pembayaran / setoran jika ada
    pub jumlah_bayar: String,
}

pub fn clean_text(input: &str) -> String {
    let re_spaces = Regex::new(r"\s+").unwrap();
    re_spaces.replace_all(input, " ").trim().to_string()
}

/// Format 15 atau 16 digit angka menjadi format standar NPWP
pub fn format_npwp(digits: &str) -> String {
    if digits.len() == 15 {
        format!(
            "{}.{}.{}.{}-{}.{}",
            &digits[0..2],
            &digits[2..5],
            &digits[5..8],
            &digits[8..9],
            &digits[9..12],
            &digits[12..15]
        )
    } else if digits.len() == 16 {
        format!(
            "{}.{}.{}.{}-{}.{}.{}",
            &digits[0..2],
            &digits[2..5],
            &digits[5..8],
            &digits[8..9],
            &digits[9..12],
            &digits[12..15],
            &digits[15..16]
        )
    } else {
        digits.to_string()
    }
}

pub fn parse_pph_text(ocr_lines: &[String]) -> PphData {
    let raw_text = ocr_lines.join("\n");

    // -------------------------------------------------------------------------
    // 1. KODE BILLING (15 digit) - Ekstrak lebih awal agar tidak bentrok dengan NPWP
    // -------------------------------------------------------------------------
    let mut kode_billing = String::new();
    let re_billing = Regex::new(r"(?i)kode\s*billing\s*[:\s]*([0-9]{15})").unwrap();
    if let Some(caps) = re_billing.captures(&raw_text) {
        kode_billing = caps[1].to_string();
    } else {
        for (i, line) in ocr_lines.iter().enumerate() {
            let low = line.to_lowercase();
            if low.contains("kode billing") {
                if i + 1 < ocr_lines.len() {
                    let digits: String = ocr_lines[i + 1].chars().filter(|c| c.is_ascii_digit()).collect();
                    if digits.len() == 15 {
                        kode_billing = digits;
                        break;
                    }
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 2. NOMOR SUKET (Surat Keterangan Penelitian PPh)
    // Format umum: KET-06442/PHTB-CT/KPP.1012/2026 atau KET-06927/PHTB-CT/KPP.1012/2026
    // -------------------------------------------------------------------------
    let mut nomor_suket = String::new();

    let re_suket_ket = Regex::new(
        r"(?i)\b(KET[-–—\s]*\d{3,7}\s*/\s*[A-Z0-9\-]+\s*/\s*[A-Z0-9\.\-]+\s*/\s*(?:20\d{2}|19\d{2}))\b"
    ).unwrap();

    let re_suket_nomor = Regex::new(
        r"(?i)(?:nomor|no\.?)\s*[:\s]*([A-Z0-9\-]+/[A-Z0-9\-]+/[A-Z0-9\.\-]+/(?:20\d{2}|19\d{2}))\b"
    ).unwrap();

    let re_suket_broad = Regex::new(
        r"(?i)\b(KET[-–—\s]*\d{3,7}\s*/\s*[^\s\n\r]+)"
    ).unwrap();

    for line in ocr_lines {
        let clean_line = clean_text(line);
        if let Some(caps) = re_suket_ket.captures(&clean_line) {
            nomor_suket = caps[1]
                .replace(' ', "")
                .replace('–', "-")
                .replace('—', "-");
            break;
        }
    }

    if nomor_suket.is_empty() {
        if let Some(caps) = re_suket_ket.captures(&raw_text) {
            nomor_suket = caps[1]
                .replace(' ', "")
                .replace('–', "-")
                .replace('—', "-");
        }
    }

    if nomor_suket.is_empty() {
        for line in ocr_lines {
            let clean_line = clean_text(line);
            if let Some(caps) = re_suket_nomor.captures(&clean_line) {
                nomor_suket = caps[1].replace(' ', "");
                break;
            }
        }
    }

    if nomor_suket.is_empty() {
        if let Some(caps) = re_suket_broad.captures(&raw_text) {
            nomor_suket = caps[1]
                .replace(' ', "")
                .replace('–', "-")
                .replace('—', "-");
        }
    }

    // -------------------------------------------------------------------------
    // 3. NPWP (Terletak di poin A. Identitas Wajib Pajak)
    // Format: 15 atau 16 digit angka (contoh: 0027724004515000 / 002772400451000)
    // -------------------------------------------------------------------------
    let mut npwp = String::new();
    let mut npwp_formatted = String::new();

    let re_npwp_keyword = Regex::new(r"(?i)\bNPWP\s*[:\s]*([0-9.\-\s]{15,30})").unwrap();

    // Strategi 1: Baris yang mengandung kata 'NPWP'
    for (idx, line) in ocr_lines.iter().enumerate() {
        let low = line.to_lowercase();
        if low.contains("npwp") {
            if let Some(caps) = re_npwp_keyword.captures(line) {
                let digits: String = caps[1].chars().filter(|c| c.is_ascii_digit()).collect();
                if (digits.len() == 15 || digits.len() == 16) && digits != kode_billing {
                    npwp = digits;
                    break;
                }
            }
            // Baris berikutnya jika nilai di baris terpisah
            if idx + 1 < ocr_lines.len() {
                let next_line = &ocr_lines[idx + 1];
                let digits: String = next_line.chars().filter(|c| c.is_ascii_digit()).collect();
                if (digits.len() == 15 || digits.len() == 16) && digits != kode_billing {
                    npwp = digits;
                    break;
                }
            }
        }
    }

    // Strategi 2: Pada Page 1 dokumen suket Kemenkeu (tata letak dua kolom)
    // Nilai NPWP biasanya terletak tepat setelah Nama Wajib Pajak
    if npwp.is_empty() {
        for (i, line) in ocr_lines.iter().enumerate() {
            let digits: String = line.chars().filter(|c| c.is_ascii_digit()).collect();
            // NPWP badan umumnya diawali dengan angka 0 dan panjang 15 atau 16 digit
            if (digits.len() == 15 || digits.len() == 16) && digits != kode_billing && digits.starts_with('0') {
                // Pastikan bukan NOP (18 digit)
                if digits.len() < 18 {
                    // Periksa apakah di dekat baris ini ada teks Wajib Pajak atau alamat
                    let near_wp = ocr_lines.iter().take(i + 4).skip(i.saturating_sub(4)).any(|l| {
                        let low = l.to_lowercase();
                        low.contains("wajib pajak") || low.contains("telah diteliti") || low.contains("jalan") || low.contains("jl ")
                    });
                    if near_wp {
                        npwp = digits;
                        break;
                    }
                }
            }
        }
    }

    // Strategi 3: Pencarian fallback jika belum ditemukan
    if npwp.is_empty() {
        for line in ocr_lines {
            let digits: String = line.chars().filter(|c| c.is_ascii_digit()).collect();
            if (digits.len() == 15 || digits.len() == 16) && digits != kode_billing && digits.starts_with('0') {
                npwp = digits;
                break;
            }
        }
    }

    if !npwp.is_empty() {
        npwp_formatted = format_npwp(&npwp);
    }

    // -------------------------------------------------------------------------
    // 4. NAMA WAJIB PAJAK (Poin A)
    // -------------------------------------------------------------------------
    let mut nama_wp = String::new();

    // Strategi 1: Baris langsung dengan "Nama Wajib Pajak : PT ..."
    let re_nama_inline = Regex::new(r"(?i)nama\s*(?:wajib\s*pajak)?\s*[:\s]+([A-Za-z0-9\s.,]+)").unwrap();
    for line in ocr_lines {
        let low = line.to_lowercase();
        if (low.contains("nama wajib pajak") || low.contains("nama")) && line.contains(':') {
            if let Some(caps) = re_nama_inline.captures(line) {
                let name = clean_text(&caps[1]);
                if !name.is_empty() && name.len() > 3 && !name.to_lowercase().contains("identitas") {
                    nama_wp = name;
                    break;
                }
            }
        }
    }

    // Strategi 2: Pada tata letak Page 1 Kemenkeu, nama muncul sebelum baris NPWP
    if nama_wp.is_empty() && !npwp.is_empty() {
        for (i, line) in ocr_lines.iter().enumerate() {
            let clean = clean_text(line);
            let digits: String = clean.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits == npwp && i > 0 {
                // Baris sebelum baris NPWP adalah Nama Wajib Pajak
                let candidate = clean_text(&ocr_lines[i - 1]);
                if !candidate.is_empty()
                    && !candidate.to_lowercase().contains("tanggal")
                    && !candidate.to_lowercase().contains("identitas")
                    && candidate.len() > 3
                {
                    nama_wp = candidate;
                    break;
                }
            }
        }
    }

    // Strategi 3: Baris yang diawali PT / CV
    if nama_wp.is_empty() {
        for line in ocr_lines {
            let clean = clean_text(line);
            if (clean.starts_with("PT ") || clean.starts_with("PT. ") || clean.starts_with("CV ")) && clean.len() < 50 {
                nama_wp = clean;
                break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. TANGGAL SUKET (contoh: Tanggal: 20 Agustus 2026)
    // -------------------------------------------------------------------------
    let mut tanggal_suket = String::new();
    let re_tgl = Regex::new(r"(?i)tanggal\s*[:\s]*([0-9]{1,2}\s+[A-Za-z]+\s+(?:20\d{2}|19\d{2}))").unwrap();
    if let Some(caps) = re_tgl.captures(&raw_text) {
        tanggal_suket = clean_text(&caps[1]);
    }

    // -------------------------------------------------------------------------
    // 6. NOP (Nomor Objek Pajak, 18 digit)
    // -------------------------------------------------------------------------
    let mut nop = String::new();
    let re_nop = Regex::new(r"(?i)(?:nomor\s*objek\s*pajak|NOP)\s*[:\s]*([0-9.\s]{18,25})").unwrap();
    if let Some(caps) = re_nop.captures(&raw_text) {
        let digits: String = caps[1].chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() == 18 {
            nop = digits;
        }
    }
    if nop.is_empty() {
        let re_18_digits = Regex::new(r"\b(\d{18})\b").unwrap();
        if let Some(caps) = re_18_digits.captures(&raw_text) {
            nop = caps[1].to_string();
        }
    }

    // -------------------------------------------------------------------------
    // 7. NTPN (16 karakter alfanumerik)
    // -------------------------------------------------------------------------
    let mut ntpn = String::new();
    let re_ntpn = Regex::new(r"(?i)NTPN\s*[:\s]*([A-Z0-9]{16})").unwrap();
    if let Some(caps) = re_ntpn.captures(&raw_text) {
        ntpn = caps[1].to_string();
    } else {
        // Cari deretan 16 karakter alfanumerik kombinasi huruf & angka
        let re_ntpn_code = Regex::new(r"\b([A-Z0-9]{16})\b").unwrap();
        for line in ocr_lines {
            let clean = clean_text(line);
            if let Some(caps) = re_ntpn_code.captures(&clean) {
                let code = caps[1].to_string();
                if code != npwp && code != kode_billing && code.chars().any(|c| c.is_alphabetic()) && code.chars().any(|c| c.is_ascii_digit()) {
                    ntpn = code;
                    break;
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 8. JUMLAH PEMBAYARAN / SETORAN
    // -------------------------------------------------------------------------
    let mut jumlah_bayar = String::new();
    let re_bayar = Regex::new(r"(?i)(?:jumlah\s*pembayaran|jumlah\s*setoran|nominal)\s*[:\s]*(?:Rp\.?\s*)?([0-9.,oO]+)").unwrap();
    if let Some(caps) = re_bayar.captures(&raw_text) {
        let normalized = caps[1].replace('o', "0").replace('O', "0");
        jumlah_bayar = clean_text(&normalized);
    }
    if jumlah_bayar.is_empty() || jumlah_bayar.len() < 5 {
        // Cari baris dengan format nominal uang (misal: 1.850.000)
        let re_money = Regex::new(r"\b([1-9][0-9]{0,2}(?:\.[0-9]{3})+)\b").unwrap();
        for line in ocr_lines {
            let line_norm = line.replace('o', "0").replace('O', "0");
            if let Some(caps) = re_money.captures(&line_norm) {
                jumlah_bayar = caps[1].to_string();
                break;
            }
        }
    }

    PphData {
        nomor_suket,
        npwp,
        npwp_formatted,
        nama_wp,
        tanggal_suket,
        nop,
        kode_billing,
        ntpn,
        jumlah_bayar,
    }
}
