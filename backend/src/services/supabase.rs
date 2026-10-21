use serde_json::{json, Value};
use std::env;
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const CACHE_TTL: Duration = Duration::from_secs(60);

struct CacheEntry<T> {
    data: T,
    timestamp: Instant,
}

static PT_CACHE: LazyLock<RwLock<Option<CacheEntry<Value>>>> = LazyLock::new(|| RwLock::new(None));
static SAKSI_CACHE: LazyLock<RwLock<Option<CacheEntry<Value>>>> = LazyLock::new(|| RwLock::new(None));

fn get_config() -> Result<(String, String), String> {
    let url = env::var("SUPABASE_URL")
        .unwrap_or_else(|_| "https://prcecqaepynnewuzbtbo.supabase.co".to_string());
    let key = env::var("SUPABASE_SECRET_KEY")
        .map_err(|_| "Variabel SUPABASE_SECRET_KEY belum diatur di file .env".to_string())?;

    if url.is_empty() || key.is_empty() {
        return Err("SUPABASE_URL atau SUPABASE_SECRET_KEY tidak boleh kosong".to_string());
    }

    Ok((url.trim_end_matches('/').to_string(), key))
}

pub async fn get_pt_database(force_refresh: bool) -> Result<Value, String> {
    // 1. Cek cache jika tidak dipaksa refresh
    if !force_refresh {
        let read = PT_CACHE.read().await;
        if let Some(entry) = &*read {
            if entry.timestamp.elapsed() < CACHE_TTL {
                return Ok(entry.data.clone());
            }
        }
    }

    // 2. Fetch dari Supabase
    let (url, key) = get_config()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Gagal inisialisasi HTTP client: {}", e))?;

    let endpoint = format!("{}/rest/v1/pt_penjual?select=*,pt_persetujuan(*)", url);
    let resp = client
        .get(&endpoint)
        .header("apikey", &key)
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Supabase: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Supabase error {}: {}", status, body));
    }

    let rows: Value = resp
        .json()
        .await
        .map_err(|e| format!("Gagal membaca JSON dari Supabase: {}", e))?;

    // 3. Transformasi ke format dictionary PPAT.ptDatabase
    let mut pt_map = serde_json::Map::new();

    if let Some(arr) = rows.as_array() {
        for row in arr {
            let kode_pt = row["kode_pt"]
                .as_str()
                .unwrap_or_default()
                .trim()
                .to_string();

            if kode_pt.is_empty() {
                continue;
            }

            let penjual = json!({
                "nama": row["nama"].as_str().unwrap_or(""),
                "alamat": row["alamat"].as_str().unwrap_or(""),
                "kota": row["kota"].as_str().unwrap_or(""),
                "npwp": row["npwp"].as_str().unwrap_or(""),
                "akta": row["akta"].as_str().unwrap_or(""),
                "tgl_akta": row["tgl_akta"].as_str().unwrap_or(""),
                "tipe_pemilik": row["tipe_pemilik"].as_str().unwrap_or("33"),
                "tipe_usaha": row["tipe_usaha"].as_str().unwrap_or("4"),
            });

            let mut persetujuan_list = Vec::new();
            if let Some(p_arr) = row["pt_persetujuan"].as_array() {
                for (idx, p) in p_arr.iter().enumerate() {
                    let id_val = p["id"].as_i64().map(|n| n.to_string()).unwrap_or_else(|| (idx + 1).to_string());
                    persetujuan_list.push(json!({
                        "id": id_val,
                        "nik": p["nik"].as_str().unwrap_or(""),
                        "nama": p["nama"].as_str().unwrap_or(""),
                        "alamat": p["alamat"].as_str().unwrap_or(""),
                        "tempat_lahir": p["tempat_lahir"].as_str().unwrap_or(""),
                        "tgl_lahir": p["tgl_lahir"].as_str().unwrap_or(""),
                        "pekerjaan": p["pekerjaan"].as_str().unwrap_or(""),
                    }));
                }
            }

            pt_map.insert(
                kode_pt,
                json!({
                    "penjual": penjual,
                    "persetujuan": persetujuan_list,
                }),
            );
        }
    }

    let result = Value::Object(pt_map);

    // 4. Update cache
    let mut write = PT_CACHE.write().await;
    *write = Some(CacheEntry {
        data: result.clone(),
        timestamp: Instant::now(),
    });

    Ok(result)
}

pub async fn get_saksi_database(force_refresh: bool) -> Result<Value, String> {
    // 1. Cek cache jika tidak dipaksa refresh
    if !force_refresh {
        let read = SAKSI_CACHE.read().await;
        if let Some(entry) = &*read {
            if entry.timestamp.elapsed() < CACHE_TTL {
                return Ok(entry.data.clone());
            }
        }
    }

    // 2. Fetch dari Supabase
    let (url, key) = get_config()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Gagal inisialisasi HTTP client: {}", e))?;

    let endpoint = format!("{}/rest/v1/saksi?select=*&order=id.asc", url);
    let resp = client
        .get(&endpoint)
        .header("apikey", &key)
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi Supabase: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Supabase error {}: {}", status, body));
    }

    let rows: Value = resp
        .json()
        .await
        .map_err(|e| format!("Gagal membaca JSON dari Supabase: {}", e))?;

    // 3. Transformasi ke format array PPAT.saksiDatabase
    let mut saksi_list = Vec::new();
    if let Some(arr) = rows.as_array() {
        for (idx, row) in arr.iter().enumerate() {
            let id_val = row["id"].as_i64().map(|n| n.to_string()).unwrap_or_else(|| (idx + 1).to_string());
            saksi_list.push(json!({
                "id": id_val,
                "nik": row["nik"].as_str().unwrap_or(""),
                "nama": row["nama"].as_str().unwrap_or(""),
                "alamat": row["alamat"].as_str().unwrap_or(""),
                "tempat_lahir": row["tempat_lahir"].as_str().unwrap_or(""),
                "tgl_lahir": row["tgl_lahir"].as_str().unwrap_or(""),
                "pekerjaan": row["pekerjaan"].as_str().unwrap_or(""),
                "tipe_bukti": row["tipe_bukti"].as_str().unwrap_or("1"),
            }));
        }
    }

    let result = Value::Array(saksi_list);

    // 4. Update cache
    let mut write = SAKSI_CACHE.write().await;
    *write = Some(CacheEntry {
        data: result.clone(),
        timestamp: Instant::now(),
    });

    Ok(result)
}


#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_supabase_fetch() {
        dotenvy::dotenv().ok();
        let pt = get_pt_database(true).await.expect("Failed to fetch PT database");
        println!("Fetched PT keys: {:?}", pt.as_object().map(|m| m.keys().collect::<Vec<_>>()));
        assert!(pt.get("PT_DPU").is_some());
        assert!(pt.get("PT_AMANAH").is_some());
        assert!(pt.get("PT_YUDHA_MUDA_SAKTI").is_some());

        let saksi = get_saksi_database(true).await.expect("Failed to fetch Saksi database");
        println!("Fetched Saksi count: {:?}", saksi.as_array().map(|a| a.len()));
        assert_eq!(saksi.as_array().unwrap().len(), 4);
    }
}
