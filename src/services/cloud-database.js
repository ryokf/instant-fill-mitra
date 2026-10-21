/**
 * Service pemuat data Cloud Supabase via Backend Rust (Port 3001).
 * Mengisi PPAT.ptDatabase dan PPAT.saksiDatabase secara dinamis
 * sehingga data sensitif (NIK, Alamat, dsb) tidak lagi di-hardcode di browser.
 */
PPAT.cloudDatabase = (() => {
    let loadPromise = null;

    /**
     * Memuat data database dari backend lokal yang terhubung ke Supabase.
     * @param {boolean} force Paksa refresh jika true
     */
    async function load(force = false) {
        if (loadPromise && !force) return loadPromise;

        loadPromise = (async () => {
            const config = PPAT.config || {};
            const ptUrl = config.PT_DATABASE_URL || "http://127.0.0.1:3001/api/pt-database";
            const saksiUrl = config.SAKSI_DATABASE_URL || "http://127.0.0.1:3001/api/saksi-database";

            try {
                const [ptResp, saksiResp] = await Promise.all([
                    fetch(ptUrl).catch((err) => {
                        console.warn("[CloudDB] Gagal fetch PT database:", err);
                        return null;
                    }),
                    fetch(saksiUrl).catch((err) => {
                        console.warn("[CloudDB] Gagal fetch Saksi database:", err);
                        return null;
                    })
                ]);

                if (ptResp && ptResp.ok) {
                    const ptData = await ptResp.json();
                    if (ptData && typeof ptData === "object" && !ptData.error) {
                        PPAT.ptDatabase = ptData;
                        console.log(`[CloudDB] Berhasil memuat ${Object.keys(ptData).length} PT dari Supabase`);
                    }
                }

                if (saksiResp && saksiResp.ok) {
                    const saksiData = await saksiResp.json();
                    if (Array.isArray(saksiData)) {
                        PPAT.saksiDatabase = saksiData;
                        console.log(`[CloudDB] Berhasil memuat ${saksiData.length} Saksi dari Supabase`);
                    }
                }
            } catch (err) {
                console.warn("[CloudDB] Error saat memuat data cloud database:", err);
            }

            return {
                ptDatabase: PPAT.ptDatabase,
                saksiDatabase: PPAT.saksiDatabase,
            };
        })();

        return loadPromise;
    }

    /**
     * Memastikan data PT dan Saksi sudah termuat sebelum proses autofill berjalan.
     */
    async function ensureLoaded() {
        if (!PPAT.ptDatabase || Object.keys(PPAT.ptDatabase).length === 0) {
            await load();
        }
        return {
            ptDatabase: PPAT.ptDatabase,
            saksiDatabase: PPAT.saksiDatabase,
        };
    }

    return {
        load,
        ensureLoaded,
    };
})();
