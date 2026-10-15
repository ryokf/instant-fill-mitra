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
}

/// Membersihkan nama untuk pencocokan toleran (hanya huruf dan angka, UPPERCASE).
pub fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// Mencari folder Pembeli di dalam `base_dir` yang paling cocok dengan `buyer_query`.
pub fn find_pembeli_folder(base_dir: &str, buyer_query: &str) -> Option<(String, PathBuf)> {
    let base_path = Path::new(base_dir);
    if !base_path.exists() || !base_path.is_dir() {
        return None;
    }

    let clean_query = clean_name(buyer_query);
    if clean_query.is_empty() {
        return None;
    }

    let entries = match std::fs::read_dir(base_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut best_match: Option<(String, PathBuf)> = None;
    let mut best_score: u32 = 0;

    let query_tokens: Vec<&str> = buyer_query.split_whitespace().collect();

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
        } else if clean_folder.contains(&clean_query) {
            score += 80;
        } else if clean_query.contains(&clean_folder) {
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

    if best_score > 0 {
        best_match
    } else {
        None
    }
}

/// Mencari berkas dokumen di dalam folder Pembeli berdasarkan jenisnya ("kk" atau "ktp").
pub fn find_pembeli_document(folder_path: &Path, doc_type: &str) -> Option<(String, PathBuf, u64)> {
    let entries = match std::fs::read_dir(folder_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let doc_type_lower = doc_type.to_lowercase();
    let is_kk = doc_type_lower.contains("kk") || doc_type_lower.contains("keluarga");
    let is_ktp = doc_type_lower.contains("ktp");

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

        let mut score: u32 = 0;

        if is_kk {
            if file_name_upper.starts_with("KK") || file_name_upper == "KK.PDF" {
                score += 50;
            } else if file_name_upper.contains("KK") || file_name_upper.contains("KELUARGA") {
                score += 30;
            }
        } else if is_ktp {
            if file_name_upper.starts_with("KTP") || file_name_upper == "KTP.PDF" {
                score += 50;
            } else if file_name_upper.contains("KTP") {
                score += 30;
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

/// Mengambil informasi folder dan berkas dokumen pembeli (KK dan KTP).
pub fn get_pembeli_info(base_dir: &str, buyer_name: &str) -> Result<PembeliFolderMatch, String> {
    let (folder_name, folder_path) = find_pembeli_folder(base_dir, buyer_name)
        .ok_or_else(|| format!("Folder pihak kedua untuk '{}' tidak ditemukan di '{}'", buyer_name, base_dir))?;

    let kk_info = match find_pembeli_document(&folder_path, "kk") {
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
    };

    let ktp_info = match find_pembeli_document(&folder_path, "ktp") {
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
    };

    Ok(PembeliFolderMatch {
        buyer_query: buyer_name.to_string(),
        folder_name,
        folder_path: folder_path.to_string_lossy().to_string(),
        kk: kk_info,
        ktp: ktp_info,
    })
}
