use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

pub const DEFAULT_PT_DIR: &str = r"G:\My Drive\notaris bu sri\PT";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtDocInfo {
    pub found: bool,
    pub filename: Option<String>,
    pub file_path: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtFolderMatch {
    pub pt_query: String,
    pub folder_name: String,
    pub folder_path: String,
    pub akta: PtDocInfo,
    pub npwp: PtDocInfo,
    pub ktp: Option<PtDocInfo>,
}

/// Membersihkan nama untuk pencocokan toleran (hanya huruf dan angka, UPPERCASE).
pub fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// Mencari folder PT di dalam `base_dir` yang paling cocok dengan `pt_query`.
pub fn find_pt_folder(base_dir: &str, pt_query: &str) -> Option<(String, PathBuf)> {
    let base_path = Path::new(base_dir);
    if !base_path.exists() || !base_path.is_dir() {
        return None;
    }

    let clean_query = clean_name(pt_query);
    if clean_query.is_empty() {
        return None;
    }

    let entries = match std::fs::read_dir(base_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut best_match: Option<(String, PathBuf)> = None;
    let mut best_score: u32 = 0;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        let clean_folder = clean_name(&folder_name);
        if clean_folder.is_empty() {
            continue;
        }

        let mut score: u32 = 0;
        if clean_folder == clean_query {
            score = 100;
        } else if clean_query.starts_with(&clean_folder) {
            score = 80;
        } else if clean_folder.starts_with(&clean_query) {
            score = 70;
        } else if clean_query.contains(&clean_folder) {
            score = 60;
        } else if clean_folder.contains(&clean_query) {
            score = 50;
        } else {
            // Pencocokan token kata kunci penting (misal "RETINDO", "NAZURA", "JBS", dll)
            let q_tokens: Vec<&str> = pt_query.split_whitespace().collect();
            let mut token_score = 0;
            for token in q_tokens {
                let clean_t = clean_name(token);
                if clean_t.len() >= 3 && clean_t != "PT" && clean_folder.contains(&clean_t) {
                    token_score += 15;
                }
            }
            if token_score > score {
                score = token_score;
            }
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

/// Mencari berkas dokumen di dalam folder PT berdasarkan jenisnya ("akta", "npwp", atau "ktp").
/// Hanya mencari berkas di root folder PT (mengabaikan subdirektori seperti OLD DATA).
pub fn find_pt_document(folder_path: &Path, doc_type: &str, person_name: Option<&str>) -> Option<(String, PathBuf, u64)> {
    let entries = match std::fs::read_dir(folder_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let doc_type_lower = doc_type.to_lowercase();
    let is_akta = doc_type_lower.contains("akta") || doc_type_lower.contains("pendirian");
    let is_npwp = doc_type_lower.contains("npwp") || doc_type_lower.contains("npw");
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

        // Hanya periksa file dokumen atau gambar yang didukung
        let ext_valid = file_name_upper.ends_with(".PDF")
            || file_name_upper.ends_with(".JPG")
            || file_name_upper.ends_with(".JPEG")
            || file_name_upper.ends_with(".PNG");

        if !ext_valid {
            continue;
        }

        let mut score: u32 = 0;

        if is_akta {
            if file_name_upper.contains("PENDIRIAN") && file_name_upper.contains("AKTA") {
                score += 20;
            } else if file_name_upper.contains("PENDIRIAN") {
                score += 15;
            } else if file_name_upper.contains("AKTA") {
                score += 5;
            }

            if score > 0 && file_name_upper.contains("TERBARU") {
                score += 5;
            }
        } else if is_npwp {
            if file_name_upper.contains("NPWP") {
                score += 20;
            } else if file_name_upper.contains("NPW") {
                score += 10;
            }

            if score > 0 && file_name_upper.contains("TERBARU") {
                score += 5;
            }
            if score > 0 && file_name_upper.contains("LEGALISIR") {
                score += 3;
            }
        } else if is_ktp {
            if file_name_upper.contains("KTP") {
                score += 20;
            }

            if let Some(pname) = person_name {
                let clean_pname = clean_name(pname);
                let clean_fname = clean_name(&file_name);

                let tokens: Vec<&str> = pname.split_whitespace().collect();
                for token in tokens {
                    let clean_t = clean_name(token);
                    if clean_t.len() >= 3 {
                        if clean_fname.contains(&clean_t) {
                            score += 40;
                        } else if clean_t.len() >= 4 && clean_fname.contains(&clean_t[..4]) {
                            score += 25;
                        }
                    }
                }

                if clean_fname.contains(&clean_pname) {
                    score += 50;
                }
            }

            if score > 0 && file_name_upper.contains("PERSETUJUAN") {
                score += 15;
            }
            if score > 0 && file_name_upper.contains("BARU") {
                score += 5;
            }
        }

        if score > best_score {
            let metadata = std::fs::metadata(&path).ok();
            let size = metadata.map(|m| m.len()).unwrap_or(0);
            best_score = score;
            best_file = Some((file_name, path, size));
        }
    }

    if best_score > 0 {
        best_file
    } else {
        None
    }
}

/// Mendapatkan informasi lengkap folder PT beserta dokumen Akta Pendirian, NPWP, dan KTP.
pub fn get_pt_info(base_dir: &str, pt_query: &str, person_name: Option<&str>) -> Result<PtFolderMatch, String> {
    let (folder_name, folder_path) = find_pt_folder(base_dir, pt_query)
        .ok_or_else(|| format!("Folder PT yang cocok dengan '{}' tidak ditemukan di '{}'", pt_query, base_dir))?;

    let akta_match = find_pt_document(&folder_path, "akta", None);
    let npwp_match = find_pt_document(&folder_path, "npwp", None);
    let ktp_match = find_pt_document(&folder_path, "ktp", person_name);

    let akta_info = match akta_match {
        Some((fname, fpath, fsize)) => PtDocInfo {
            found: true,
            filename: Some(fname),
            file_path: Some(fpath.to_string_lossy().to_string()),
            size: Some(fsize),
        },
        None => PtDocInfo {
            found: false,
            filename: None,
            file_path: None,
            size: None,
        },
    };

    let npwp_info = match npwp_match {
        Some((fname, fpath, fsize)) => PtDocInfo {
            found: true,
            filename: Some(fname),
            file_path: Some(fpath.to_string_lossy().to_string()),
            size: Some(fsize),
        },
        None => PtDocInfo {
            found: false,
            filename: None,
            file_path: None,
            size: None,
        },
    };

    let ktp_info = ktp_match.map(|(fname, fpath, fsize)| PtDocInfo {
        found: true,
        filename: Some(fname),
        file_path: Some(fpath.to_string_lossy().to_string()),
        size: Some(fsize),
    });

    Ok(PtFolderMatch {
        pt_query: pt_query.to_string(),
        folder_name,
        folder_path: folder_path.to_string_lossy().to_string(),
        akta: akta_info,
        npwp: npwp_info,
        ktp: ktp_info,
    })
}
