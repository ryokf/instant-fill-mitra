use std::path::{Path, PathBuf};

pub const DEFAULT_SAKSI_DIR: &str = r"G:\My Drive\notaris bu sri\Saksi";

/// Membersihkan string nama untuk pencocokan toleran (hanya alphanumeric, UPPERCASE)
pub fn clean_name(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase()
}

/// Mencari file KTP saksi di dalam direktori `base_dir` berdasarkan nama atau kata kunci saksi.
/// Contoh nama file yang ada: "NURUL - NOVIA.pdf", "RIEFKY - RIDHWAN.pdf".
pub fn find_saksi_ktp_file(base_dir: &str, query: &str) -> Option<(String, PathBuf, u64)> {
    let base_path = Path::new(base_dir);
    if !base_path.exists() || !base_path.is_dir() {
        return None;
    }

    let clean_query = clean_name(query);
    if clean_query.is_empty() {
        return None;
    }

    let entries = match std::fs::read_dir(base_path) {
        Ok(e) => e,
        Err(_) => return None,
    };

    let mut best_match: Option<(String, PathBuf, u64)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let fname = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        if !fname.to_lowercase().ends_with(".pdf") {
            continue;
        }

        let clean_fname = clean_name(&fname);

        // 1. Cek kecocokan langsung substring
        if clean_fname.contains(&clean_query) || clean_query.contains(&clean_fname) {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            return Some((fname, path, size));
        }

        // 2. Token matching (misal query "NURUL HIKMAH" cocok dengan "NURUL - NOVIA.pdf")
        let query_tokens: Vec<&str> = query.split_whitespace().collect();
        for token in query_tokens {
            let clean_token = clean_name(token);
            if clean_token.len() >= 4 && clean_fname.contains(&clean_token) {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                best_match = Some((fname.clone(), path.clone(), size));
                break;
            }
        }
    }

    best_match
}
