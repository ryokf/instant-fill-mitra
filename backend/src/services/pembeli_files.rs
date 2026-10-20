use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

pub const DEFAULT_PEMBELI_DIR: &str = r"G:\My Drive\notaris bu sri\Pihak Kedua";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PembeliDocInfo {
    pub found: bool,
    pub filename: Option<String>,
    pub file_path: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PembeliFolderMatch {
    pub buyer_query: String,
    pub folder_name: String,
    pub folder_path: String,
    pub kk: PembeliDocInfo,
    pub ktp: PembeliDocInfo,
    pub pbb: PembeliDocInfo,
    pub bphtb: PembeliDocInfo,
    pub pph: PembeliDocInfo,
    #[serde(default)]
    pub ktp_persetujuan: Option<PembeliDocInfo>,
}

/// Membersihkan nama untuk pencocokan toleran (hanya huruf dan angka, UPPERCASE).
pub fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// Menghapus sapaan umum (TUAN, NYONYA, NONA, dll.) dari awal nama pembeli.
fn strip_honorifics(s: &str) -> String {
    let honorifics = ["TUAN", "NYONYA", "NONA", "SDR", "SDRI", "BAPAK", "IBU", "TN", "NY"];
    let tokens: Vec<&str> = s
        .split_whitespace()
        .filter(|t| {
            let clean_t = clean_name(t);
            !honorifics.contains(&clean_t.as_str())
        })
        .collect();
    if tokens.is_empty() {
        s.to_string()
    } else {
        tokens.join(" ")
    }
}

/// Mencari folder Pembeli di dalam satu direktori spesifik.
fn find_pembeli_folder_in_dir(dir_path: &Path, stripped_query: &str, clean_query: &str) -> Option<(u32, String, PathBuf)> {
    if !dir_path.exists() || !dir_path.is_dir() {
        return None;
    }

    let entries = match std::fs::read_dir(dir_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut best_match: Option<(String, PathBuf)> = None;
    let mut best_score: u32 = 0;

    let query_tokens: Vec<&str> = stripped_query.split_whitespace().collect();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Abaikan folder sistem atau temporary seperti "finish", "revisi", "old data"
        let folder_name_upper = folder_name.to_uppercase();
        if folder_name_upper == "FINISH" || folder_name_upper == "REVISI" || folder_name_upper == "OLD DATA" {
            continue;
        }

        let clean_folder = clean_name(&folder_name);
        let mut score: u32 = 0;

        if clean_folder == clean_query {
            score += 100;
        } else if clean_folder.contains(clean_query) {
            score += 80;
        } else if clean_query.contains(&clean_folder) && clean_folder.len() >= 4 {
            score += 70;
        }

        // Pencocokan per token kata
        let mut matched_tokens = 0;
        for token in &query_tokens {
            let clean_t = clean_name(token);
            if clean_t.len() >= 3 && clean_folder.contains(&clean_t) {
                matched_tokens += 1;
                score += 30;
            }
        }

        if query_tokens.len() > 1 && matched_tokens >= (query_tokens.len() / 2 + 1) {
            score += 40;
        }

        if score > best_score {
            best_score = score;
            best_match = Some((folder_name, path));
        }
    }

    best_match.map(|(name, path)| (best_score, name, path))
}

/// Mencari folder Pembeli di dalam `base_dir` yang paling cocok dengan `buyer_query`.
/// Jika tidak ditemukan di `base_dir` utama, otomatis mencari di subfolder `revisi` dan `finish`.
pub fn find_pembeli_folder(base_dir: &str, buyer_query: &str) -> Option<(String, PathBuf)> {
    let base_path = Path::new(base_dir);
    if !base_path.exists() || !base_path.is_dir() {
        return None;
    }

    let stripped_query = strip_honorifics(buyer_query);
    let clean_query = clean_name(&stripped_query);
    if clean_query.is_empty() {
        return None;
    }

    // 1. Cari di direktori utama Pihak Kedua
    if let Some((score, name, path)) = find_pembeli_folder_in_dir(base_path, &stripped_query, &clean_query) {
        if score >= 60 {
            return Some((name, path));
        }
    }

    // 2. Fallback: cari juga di subfolder "revisi" dan "finish" bila belum ditemukan kecocokan kuat
    let mut best_overall = find_pembeli_folder_in_dir(base_path, &stripped_query, &clean_query);
    for sub in ["revisi", "finish", "old data"] {
        let sub_path = base_path.join(sub);
        if let Some((score, name, path)) = find_pembeli_folder_in_dir(&sub_path, &stripped_query, &clean_query) {
            match &best_overall {
                Some((best_score, _, _)) if score > *best_score => {
                    best_overall = Some((score, name, path));
                }
                None => {
                    best_overall = Some((score, name, path));
                }
                _ => {}
            }
        }
    }

    best_overall.and_then(|(score, name, path)| if score > 0 { Some((name, path)) } else { None })
}

/// Mencari berkas dokumen di dalam folder Pembeli berdasarkan jenisnya ("kk", "ktp", "pbb", "bphtb", "pph").
pub fn find_pembeli_document(folder_path: &Path, doc_type: &str) -> Option<(String, PathBuf, u64)> {
    let entries = match std::fs::read_dir(folder_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let doc_type_lower = doc_type.to_lowercase();
    let is_ktp_persetujuan = doc_type_lower == "ktp_persetujuan"
        || doc_type_lower == "persetujuan"
        || doc_type_lower.contains("persetujuan");
    let is_kk_penjual = doc_type_lower == "kk_penjual";
    let is_ktp_penjual = doc_type_lower == "ktp_penjual";
    let is_kk = !is_kk_penjual && (doc_type_lower == "kk" || doc_type_lower.contains("keluarga"));
    let is_ktp = !is_ktp_penjual && !is_ktp_persetujuan && doc_type_lower == "ktp";
    let is_pbb = doc_type_lower == "pbb" || doc_type_lower.contains("sppt");
    let is_bphtb = doc_type_lower == "bphtb" || doc_type_lower.contains("sspd");
    let is_pph = doc_type_lower == "pph" || doc_type_lower.contains("suket") || doc_type_lower.contains("ssb");

    let mut best_file: Option<(String, PathBuf, u64)> = None;
    let mut best_score: u32 = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let file_name_upper = file_name.to_uppercase();

        let ext_valid = file_name_upper.ends_with(".PDF")
            || file_name_upper.ends_with(".JPG")
            || file_name_upper.ends_with(".JPEG")
            || file_name_upper.ends_with(".PNG");

        if !ext_valid {
            continue;
        }

        let stem_upper = Path::new(&file_name_upper)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(&file_name_upper);

        let mut score: u32 = 0;

        if is_ktp_persetujuan {
            if stem_upper == "KTP PERSETUJUAN" {
                score += 100;
            } else if file_name_upper.starts_with("KTP PERSETUJUAN") {
                score += 90;
            } else if file_name_upper.contains("KTP") && file_name_upper.contains("PERSETUJUAN") {
                score += 80;
            } else if file_name_upper.contains("PERSETUJUAN") {
                score += 60;
            }
        } else if is_kk_penjual {
            if stem_upper == "KK PENJUAL" {
                score += 100;
            } else if file_name_upper.starts_with("KK PENJUAL") {
                score += 90;
            } else if file_name_upper.contains("KK") && file_name_upper.contains("PENJUAL") {
                score += 80;
            } else if stem_upper == "KK" {
                score += 70;
            } else if file_name_upper.starts_with("KK") && !file_name_upper.contains("PEMBELI") {
                score += 50;
            } else if file_name_upper.contains("KK") && !file_name_upper.contains("PEMBELI") {
                score += 30;
            }
        } else if is_ktp_penjual {
            if stem_upper == "KTP PENJUAL" {
                score += 100;
            } else if file_name_upper.starts_with("KTP PENJUAL") {
                score += 90;
            } else if file_name_upper.contains("KTP") && file_name_upper.contains("PENJUAL") {
                score += 80;
            } else if stem_upper == "KTP" {
                score += 70;
            } else if file_name_upper.starts_with("KTP") && !file_name_upper.contains("PEMBELI") && !file_name_upper.contains("PERSETUJUAN") {
                score += 50;
            } else if file_name_upper.contains("KTP") && !file_name_upper.contains("PEMBELI") && !file_name_upper.contains("PERSETUJUAN") {
                score += 30;
            }
        } else if is_kk {
            if file_name_upper.contains("PENJUAL") {
                continue;
            }
            if stem_upper == "KK" || stem_upper == "KK PEMBELI" {
                score += 100;
            } else if file_name_upper.starts_with("KK") {
                score += 60;
            } else if file_name_upper.contains("KK") || file_name_upper.contains("KELUARGA") {
                score += 30;
            }
        } else if is_ktp {
            if file_name_upper.contains("PENJUAL") || file_name_upper.contains("PERSETUJUAN") {
                continue;
            }
            if stem_upper == "KTP" || stem_upper == "KTP PEMBELI" {
                score += 100;
            } else if file_name_upper.starts_with("KTP") {
                score += 60;
            } else if file_name_upper.contains("KTP") {
                score += 30;
            }
        } else if is_pbb {
            if stem_upper == "PBB" {
                score += 100;
            } else if file_name_upper.starts_with("PBB") {
                score += 80;
            } else if file_name_upper.contains("PBB") || file_name_upper.contains("SPPT") {
                score += 50;
            }
        } else if is_bphtb {
            if stem_upper == "BPHTB" {
                score += 100;
            } else if file_name_upper.starts_with("BPHTB") {
                score += 80;
            } else if file_name_upper.contains("BPHTB") || file_name_upper.contains("SSPD") {
                score += 50;
            }
        } else if is_pph {
            if stem_upper == "PPH" {
                score += 100;
            } else if file_name_upper.starts_with("PPH") {
                score += 80;
            } else if file_name_upper.contains("PPH") || file_name_upper.contains("SUKET") || file_name_upper.contains("SSB") {
                score += 50;
            }
        }

        if score > best_score {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            best_score = score;
            best_file = Some((file_name, path, size));
        }
    }

    best_file
}

fn to_doc_info(opt: Option<(String, PathBuf, u64)>) -> PembeliDocInfo {
    match opt {
        Some((filename, path, size)) => PembeliDocInfo {
            found: true,
            filename: Some(filename),
            file_path: Some(path.to_string_lossy().to_string()),
            size: Some(size),
        },
        None => PembeliDocInfo {
            found: false,
            filename: None,
            file_path: None,
            size: None,
        },
    }
}

/// Mengambil informasi folder dan berkas dokumen pembeli (KK, KTP, PBB, BPHTB, PPh, KTP Persetujuan).
pub fn get_pembeli_info(base_dir: &str, buyer_name: &str) -> Result<PembeliFolderMatch, String> {
    let (folder_name, folder_path) = find_pembeli_folder(base_dir, buyer_name)
        .ok_or_else(|| format!("Folder pihak kedua untuk '{}' tidak ditemukan di '{}'", buyer_name, base_dir))?;

    let kk_info = to_doc_info(find_pembeli_document(&folder_path, "kk"));
    let ktp_info = to_doc_info(find_pembeli_document(&folder_path, "ktp"));
    let pbb_info = to_doc_info(find_pembeli_document(&folder_path, "pbb"));
    let bphtb_info = to_doc_info(find_pembeli_document(&folder_path, "bphtb"));
    let pph_info = to_doc_info(find_pembeli_document(&folder_path, "pph"));
    let ktp_persetujuan_info = to_doc_info(find_pembeli_document(&folder_path, "ktp_persetujuan"));

    Ok(PembeliFolderMatch {
        buyer_query: buyer_name.to_string(),
        folder_name,
        folder_path: folder_path.to_string_lossy().to_string(),
        kk: kk_info,
        ktp: ktp_info,
        pbb: pbb_info,
        bphtb: bphtb_info,
        pph: pph_info,
        ktp_persetujuan: Some(ktp_persetujuan_info),
    })
}
