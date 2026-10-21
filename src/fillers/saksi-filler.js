/**
 * Pengisian otomatis Form Pihak Saksi (Bagian M) & Upload KTP Saksi.
 * Alur pengisian:
 * 1. Menerima 2 nama saksi yang diekstrak dari akta AJB.
 * 2. Mengisi data saksi 1 dari saksi-database.js dan submit ke daftar saksi.
 * 3. Mengunggah KTP saksi 1 dari folder G:\My Drive\notaris bu sri\Saksi\[nama saksi 1 - nama saksi 2].
 * 4. Mengisi data saksi 2 dari saksi-database.js dan submit ke daftar saksi.
 * 5. Mengunggah KTP saksi 2 ke baris saksi 2 di daftar.
 */
PPAT.saksiFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, DEFAULTS, MESSAGES } = config;
    const S = SELECTORS.saksi;

    /**
     * Konversi Blob ke Base64 data string
     */
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(",")[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Mengunduh berkas KTP saksi dari backend service (G:\My Drive\notaris bu sri\Saksi).
     * @param {string} saksiName Nama salah satu saksi
     * @returns {Promise<{ filename: string, base64: string, blob: Blob }|null>}
     */
    async function downloadSaksiKtp(saksiName) {
        if (!saksiName) return null;
        try {
            const url = `${config.SAKSI_FILE_DOWNLOAD_URL}?name=${encodeURIComponent(saksiName)}`;
            console.log(`[AutoUploadSaksi] Mengunduh KTP saksi dari: ${url}`);
            const resp = await fetch(url);
            if (!resp.ok) {
                console.warn(`[AutoUploadSaksi] Gagal mengunduh KTP saksi untuk '${saksiName}': HTTP ${resp.status}`);
                return null;
            }

            let filename = resp.headers.get("x-file-name") || "KTP-Saksi.pdf";
            const disposition = resp.headers.get("content-disposition");
            if (disposition) {
                const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
                if (match && match[1]) filename = match[1].trim();
            }

            const blob = await resp.blob();
            const base64 = await blobToBase64(blob);

            return { filename, base64, blob };
        } catch (err) {
            console.warn(`[AutoUploadSaksi] Error koneksi saat mengunduh KTP saksi '${saksiName}':`, err);
            return null;
        }
    }

    /**
     * Memeriksa apakah saksi sudah terdaftar di daftar sebelah kanan (#daftarpemohonsaksiplaceholder).
     */
    function isSaksiAlreadyInDaftar(saksiName) {
        if (!saksiName) return false;
        const placeholder = document.querySelector(S.daftarPlaceholder || "#daftarpemohonsaksiplaceholder");
        if (!placeholder) return false;

        const cleanTarget = saksiName.trim().toLowerCase();
        const items = placeholder.querySelectorAll("li");

        return Array.from(items).some((li) => {
            const text = (li.textContent || "").toLowerCase();
            if (text.includes(cleanTarget)) return true;
            const tokens = cleanTarget.split(/\s+/).filter((t) => t.length > 2);
            return tokens.length >= 2 && tokens.every((t) => text.includes(t));
        });
    }

    /**
     * Memeriksa apakah semua saksi dalam daftar sudah terdaftar di sebelah kanan.
     */
    function areAllSaksiInDaftar(saksiList) {
        if (!Array.isArray(saksiList) || saksiList.length === 0) return false;
        return saksiList.every((s) => isSaksiAlreadyInDaftar(s.nama || s));
    }

    /**
     * Menunggu hingga saksi dengan nama tertentu muncul di #daftarpemohonsaksiplaceholder.
     */
    function waitForSaksiInDaftar(saksiName, timeoutMs = 25000) {
        if (isSaksiAlreadyInDaftar(saksiName)) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector(S.daftarPlaceholder || "#daftarpemohonsaksiplaceholder");

            let observer = null;
            let interval = null;

            const cleanup = () => {
                if (observer) {
                    try { observer.disconnect(); } catch (_) {}
                    observer = null;
                }
                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }
            };

            if (placeholder) {
                observer = new MutationObserver(() => {
                    if (isSaksiAlreadyInDaftar(saksiName)) {
                        cleanup();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            interval = setInterval(() => {
                if (isSaksiAlreadyInDaftar(saksiName)) {
                    cleanup();
                    resolve(true);
                } else if (Date.now() - startTime > timeoutMs) {
                    cleanup();
                    resolve(false);
                }
            }, 200);
        });
    }

    /**
     * Mencari tombol 'Unggah' untuk saksi tertentu di #daftarpemohonsaksiplaceholder.
     */
    async function waitForSaksiRow(saksiName, timeoutMs = 12000) {
        const startTime = Date.now();
        const searchName = (saksiName || "").trim().toLowerCase();

        while (Date.now() - startTime < timeoutMs) {
            const rows = Array.from(document.querySelectorAll(`${S.daftarPlaceholder || "#daftarpemohonsaksiplaceholder"} li`));
            for (const row of rows) {
                const bq = row.querySelector("blockquote");
                const rowText = (bq ? bq.innerText || bq.textContent : row.innerText || "").toLowerCase();

                let isMatch = false;
                if (!searchName) {
                    isMatch = true;
                } else if (rowText.includes(searchName)) {
                    isMatch = true;
                } else {
                    const tokens = searchName.split(/\s+/).filter((t) => t.length > 2);
                    if (tokens.length >= 2 && tokens.every((t) => rowText.includes(t))) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    const btn = row.querySelector("a[onclick*='unggahpihakakta']");
                    if (btn) return btn;
                }
            }

            if (rows.length === 1 && !searchName) {
                const btn = rows[0].querySelector("a[onclick*='unggahpihakakta']");
                if (btn) return btn;
            }

            await dom.delay(100);
        }

        return null;
    }

    /**
     * Menyimpan data saksi aktif ke storage lokal.
     */
    async function saveSavedSaksi(saksiList) {
        if (!saksiList) return;
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                await chrome.storage.local.set({ ppat_saksi_data: saksiList });
            } else {
                localStorage.setItem("ppat_saksi_data", JSON.stringify(saksiList));
            }
        } catch (_) {}
    }

    /**
     * Mengambil data saksi yang tersimpan di storage lokal.
     */
    async function getSavedSaksi() {
        try {
            if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                const res = await chrome.storage.local.get("ppat_saksi_data");
                if (res && res.ppat_saksi_data) return res.ppat_saksi_data;
            }
            const raw = localStorage.getItem("ppat_saksi_data");
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Mengunggah berkas KTP Saksi melalui sidebar ATR/BPN (#divsidenavupload2).
     */
    async function uploadKtpSaksi(saksiName, ktpDocPromise) {
        console.log(`[AutoUploadSaksi] Memulai langkah upload KTP untuk saksi '${saksiName}'...`);

        // 0. Pastikan modal lama ditutup dan DOM dibersihkan
        if (PPAT.penjualUploadFiller) {
            if (typeof PPAT.penjualUploadFiller.isModalOpen === "function" && PPAT.penjualUploadFiller.isModalOpen()) {
                await PPAT.penjualUploadFiller.dismissModalAndEnsureClosed();
            }
            PPAT.penjualUploadFiller.forceCleanupModalDom();
        }

        // 1. Dapatkan tombol Unggah di baris saksi
        const btnUnggah = await waitForSaksiRow(saksiName, 8000);
        if (!btnUnggah) {
            console.warn(`[AutoUploadSaksi] Tombol 'Unggah' untuk saksi '${saksiName}' tidak ditemukan di halaman.`);
            return false;
        }

        // 2. Klik tombol Unggah untuk membuka sidebar
        btnUnggah.click();

        // 3. Tunggu sidebar siap & berkas selesai diunduh
        const waitForSidebar = PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.waitForSidebarReady === "function"
            ? PPAT.penjualUploadFiller.waitForSidebarReady(TIMING.SIDEBAR_TIMEOUT_MS)
            : dom.waitForElement("#divsidenavupload2 select#tipeunggah2", TIMING.SIDEBAR_TIMEOUT_MS);

        const [selectEl, docData] = await Promise.all([
            waitForSidebar,
            ktpDocPromise || downloadSaksiKtp(saksiName),
        ]);

        if (!selectEl) {
            console.warn("[AutoUploadSaksi] Sidebar upload (#divsidenavupload2) tidak merespons atau opsi dokumen tidak muncul.");
            return false;
        }

        if (!docData || !docData.base64) {
            console.warn(`[AutoUploadSaksi] Data berkas KTP saksi '${saksiName}' kosong atau gagal diunduh.`);
            return false;
        }

        // 4. Pilih opsi KTP di dropdown tipeunggah2 (default opsi pertama yang valid)
        let optionVal = "";
        const options = Array.from(selectEl.options || []);
        const ktpOption = options.find((opt) => {
            const txt = (opt.textContent || "").toLowerCase();
            return txt.includes("ktp") || txt.includes("identitas");
        });
        if (ktpOption) {
            optionVal = ktpOption.value;
        } else if (options.length > 0) {
            const firstValid = options.find((opt) => opt.value && opt.value.trim() !== "");
            if (firstValid) optionVal = firstValid.value;
        }

        const requestId = `saksi_ktp_${Date.now()}`;

        // 5. Kirim perintah injeksi berkas & simpan ke Page Bridge
        const injectPromise = new Promise((resolve) => {
            function onResponse(e) {
                if (
                    e.data &&
                    e.data.type === "PPAT_INJECT_AND_UPLOAD_RESPONSE" &&
                    (!e.data.requestId || e.data.requestId === requestId)
                ) {
                    window.removeEventListener("message", onResponse);
                    clearTimeout(fallbackTimer);
                    resolve(e.data);
                }
            }

            const fallbackTimer = setTimeout(() => {
                window.removeEventListener("message", onResponse);
                resolve({ success: false, error: "Timeout respons Page Bridge untuk upload KTP saksi." });
            }, TIMING.UPLOAD_TIMEOUT_MS);

            window.addEventListener("message", onResponse);
        });

        window.postMessage(
            {
                type: "PPAT_INJECT_AND_UPLOAD",
                requestId,
                filename: docData.filename,
                base64: docData.base64,
                mimeType: "application/pdf",
                optionValue: optionVal,
                tipeValue: optionVal,
                pihak: "Saksi",
            },
            "*"
        );

        // 6. Tunggu modal notifikasi ATR/BPN
        const modalMsg = PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.waitForGlobalModal === "function"
            ? await PPAT.penjualUploadFiller.waitForGlobalModal(TIMING.UPLOAD_TIMEOUT_MS)
            : null;

        await injectPromise;

        // 7. Tutup modal notifikasi dan bersihkan DOM
        if (PPAT.penjualUploadFiller) {
            await PPAT.penjualUploadFiller.dismissModalAndEnsureClosed();
            PPAT.penjualUploadFiller.forceCleanupModalDom();
        }

        console.log(`[AutoUploadSaksi] ✔ KTP saksi '${saksiName}' (${docData.filename}) berhasil diunggah! Pesan: ${modalMsg || "OK"}`);
        return true;
    }

    /**
     * Mengisi satu data Saksi ke form #frmSaksiDukcapil.
     */
    async function fillSingle(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const form = await dom.waitForElement(S.form, TIMING.SAKSI_FORM_TIMEOUT_MS);
        if (!form) {
            console.warn(MESSAGES.saksiFormMissing || "Form Input Saksi (#frmSaksiDukcapil) tidak ditemukan.");
            if (options.showAlert) alert(MESSAGES.saksiFormMissing || "Form Saksi tidak ditemukan.");
            return false;
        }

        form.scrollIntoView({ behavior: "smooth", block: "center" });
        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS);

        // Pilih Jenis Bukti Identitas (default: KTP / "1")
        const tipeBuktiVal = data.tipe_bukti || DEFAULTS.TIPE_BUKTI_SAKSI || "1";
        dom.setSelect2Value(S.tipeBukti, tipeBuktiVal);

        // Memicu RefreshPemohonsaksinik di Main World
        dom.runInPageContext((val) => {
            if (window.jQuery) {
                const $sel = window.jQuery("#tipebuktisaksi1");
                $sel.val(val).trigger("change");
                if (typeof window.RefreshPemohonsaksinik === "function") {
                    window.RefreshPemohonsaksinik("");
                }
            }
        }, tipeBuktiVal);

        await dom.delay(200);

        // Isi kolom teks
        dom.fillFields(S.fields, data);

        // Set radio Jenis Kelamin
        const isPerempuan =
            (data.jenis_kelamin && data.jenis_kelamin.toLowerCase().includes("perempuan")) ||
            (data.nama && (data.nama.toLowerCase().startsWith("nyonya") || data.nama.toLowerCase().startsWith("nona")));

        const radioTarget = isPerempuan ? "Perempuan" : "Laki-laki";
        const radios = form.querySelectorAll("input[type='radio'][name='JENIS_KELAMIN']");
        radios.forEach((r) => {
            if (r.value === radioTarget) {
                r.checked = true;
                r.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        // Sinkronisasi ke jQuery Main World
        dom.runInPageContext((d, rad) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (d.nik) $("#tNIKsaksi").val(d.nik).trigger("input").trigger("change").trigger("blur");
            if (d.nama) $("#tNAMA_LENGKAPsaksi").val(d.nama).trigger("input").trigger("change").trigger("blur");
            if (d.alamat) $("#tALAMATsaksi").val(d.alamat).trigger("input").trigger("change").trigger("blur");
            if (d.tempat_lahir) $("#tTEMPAT_LAHIRsaksi").val(d.tempat_lahir).trigger("input").trigger("change").trigger("blur");
            if (d.tgl_lahir) $("#tTANGGAL_LAHIRsaksi").val(d.tgl_lahir).trigger("input").trigger("change").trigger("blur");
            if (d.pekerjaan) $("#tJENIS_PEKERJAANsaksi").val(d.pekerjaan).trigger("input").trigger("change").trigger("blur");
            if (rad) $(`#frmSaksiDukcapil input[name='JENIS_KELAMIN'][value='${rad}']`).prop("checked", true).trigger("change");
        }, data, radioTarget);

        await dom.delay(300);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS + 250);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
                console.log(`[AutoUploadSaksi] Menekan tombol Tambah Saksi untuk '${data.nama}'...`);
                submitBtn.click();
            }

            console.log(`[AutoUploadSaksi] Menunggu saksi '${data.nama}' tersimpan di daftar kanan...`);
            const saved = await waitForSaksiInDaftar(data.nama, 25000);
            if (saved) {
                console.log(`[AutoUploadSaksi] ✔ Saksi '${data.nama}' terkonfirmasi di daftar!`);
            } else {
                console.warn(`[AutoUploadSaksi] Batas waktu menunggu saksi '${data.nama}' terlewati.`);
            }
            return saved;
        }

        return true;
    }

    /**
     * Mengisi 2 saksi secara berurutan dan mengunggah KTP masing-masing saksi.
     * @param {Array<Object>} saksiList Daftar 2 saksi hasil ekstraksi akta AJB
     * @param {Object} options
     * @param {Function} options.onStatus Callback status progress
     * @param {boolean} options.autoSubmit Otomatis submit form
     * @param {boolean} options.autoUploadDocs Otomatis upload berkas KTP
     */
    async function fillAndUploadSaksiList(saksiList, options = {}) {
        if (!Array.isArray(saksiList) || saksiList.length === 0) {
            console.warn("[AutoUploadSaksi] Daftar saksi kosong.");
            return false;
        }

        const onStatus = options.onStatus || (() => {});
        const autoUploadDocs = options.autoUploadDocs ?? true;
        const autoSubmit = options.autoSubmit ?? true;

        onStatus("⏳ Mempersiapkan pengisian otomatis 2 Pihak Saksi...", "info");

        // Pastikan database Saksi dari Supabase sudah termuat
        if (PPAT.cloudDatabase && typeof PPAT.cloudDatabase.ensureLoaded === "function") {
            await PPAT.cloudDatabase.ensureLoaded();
        }

        // Pre-fetch berkas KTP Saksi dari folder G:\My Drive\notaris bu sri\Saksi
        const firstSaksiName = saksiList[0].nama || "";
        const ktpDocPromise = autoUploadDocs && firstSaksiName
            ? downloadSaksiKtp(firstSaksiName)
            : Promise.resolve(null);

        for (let i = 0; i < saksiList.length; i++) {
            const saksi = saksiList[i];
            const num = i + 1;
            const total = saksiList.length;

            onStatus(`⏳ [${num}/${total}] Memproses Saksi ${num}: ${saksi.nama}...`, "info");

            // 1. Cek apakah saksi sudah ada di daftar kanan
            if (isSaksiAlreadyInDaftar(saksi.nama)) {
                onStatus(`ℹ Saksi ${num} (${saksi.nama}) sudah terdaftar di sebelah kanan.`, "info");
            } else {
                onStatus(`⏳ [${num}/${total}] Mengisi form Saksi ${num}: ${saksi.nama}...`, "info");

                // Lengkapi NIK dan data lainnya dari Supabase saksiDatabase jika saksi hanya berisi nama
                let saksiToFill = saksi;
                if ((!saksi.nik || !saksi.alamat) && Array.isArray(PPAT.saksiDatabase)) {
                    const sNameNorm = (saksi.nama || "").trim().toLowerCase();
                    const matched = PPAT.saksiDatabase.find((dbS) => {
                        const dbNameNorm = (dbS.nama || "").trim().toLowerCase();
                        return sNameNorm && (dbNameNorm.includes(sNameNorm) || sNameNorm.includes(dbNameNorm));
                    });
                    if (matched) {
                        saksiToFill = { ...matched, ...saksi };
                    }
                }

                await fillSingle(saksiToFill, { autoSubmit, showAlert: false });
                await dom.delay(600);
            }

            // 2. Upload KTP Saksi ke baris saksi tersebut
            if (autoUploadDocs) {
                onStatus(`⏳ [${num}/${total}] Mengunggah KTP Saksi ${num} (${saksi.nama})...`, "info");
                try {
                    await uploadKtpSaksi(saksi.nama, ktpDocPromise);
                    onStatus(`✔ KTP Saksi ${num} (${saksi.nama}) berhasil diunggah!`, "ok");
                } catch (err) {
                    console.warn(`[AutoUploadSaksi] Gagal upload KTP Saksi ${num}:`, err);
                    onStatus(`⚠ Upload KTP Saksi ${num} terlewati: ${err?.message || err}`, "warn");
                }
                await dom.delay(500);
            }
        }

        onStatus("✔ Seluruh Pihak Saksi dan berkas KTP berhasil diisi & diunggah!", "ok");
        return true;
    }

    return {
        fill: (data, opts) => fillSingle(data, opts),
        fillSingle,
        fillAndUploadSaksiList,
        downloadSaksiKtp,
        uploadKtpSaksi,
        isSaksiAlreadyInDaftar,
        areAllSaksiInDaftar,
        waitForSaksiInDaftar,
        waitForSaksiRow,
        saveSavedSaksi,
        getSavedSaksi,
    };
})();
