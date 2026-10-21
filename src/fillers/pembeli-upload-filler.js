/**
 * Otomatisasi Upload Dokumen Pihak Pembeli (KK & KTP).
 * Mengunduh file dari folder lokal via backend (Port 3001)
 * lalu mengunggahnya secara sekuensial ke website ATR/BPN (Pihak 2).
 */
PPAT.pembeliUploadFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING } = config;
    const S = SELECTORS.pembeliUpload;

    let isUploading = false;
    const processedBuyers = new Set();
    let watcherInitialized = false;

    const BUYER_NAME_STORAGE_KEY = "ppat_saved_buyer_name";

    /**
     * Menyimpan nama pembeli aktif ke localStorage agar tetap tersedia lintas navigasi halaman.
     */
    function saveActiveBuyerName(name) {
        const clean = (name || "").trim();
        if (!clean || clean === "-") return;
        try {
            localStorage.setItem(BUYER_NAME_STORAGE_KEY, clean);
        } catch (_) {}
    }

    /**
     * Membaca nama Pembeli yang saat ini tercatat di baris Pihak 2 pada website ATR/BPN.
     * @returns {string|null}
     */
    function getActiveBuyerNameFromPage() {
        const rows = document.querySelectorAll(`${S.daftarPlaceholder} li, ${S.daftarPlaceholder} tr, #daftarpihak2placeholder li, #daftarpihak2placeholder blockquote`);
        for (const row of rows) {
            const bq = row.querySelector("blockquote") || row;
            // Di ATR/BPN baris teks di dalam blockquote dipisah oleh <br>.
            // innerHTML dibersihkan dengan mengganti <br> menjadi \n agar tidak menyatu dengan field berikutnya (Alamat/NIK).
            const rawHtml = bq.innerHTML || "";
            const cleanText = rawHtml.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
            const textToMatch = cleanText || bq.innerText || bq.textContent || "";
            const match = textToMatch.match(/Nama\s*:\s*([^<\n\r]+)/i);
            if (match && match[1]) {
                let found = match[1].trim();
                // Potong jika kata kunci berikutnya (Alamat / NIK / Email) masih terbawa
                found = found.split(/Alamat\s*:|NIK\s*:|Email\s*:/i)[0].trim();
                if (found && found !== "-") {
                    saveActiveBuyerName(found);
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * Mendapatkan nama pembeli aktif dari berbagai sumber (memori, DOM daftar pihak 2, form input, panel, atau localStorage).
     * @returns {string}
     */
    function getActiveBuyerName() {
        const cleanName = (val) => {
            if (!val || typeof val !== "string") return "";
            let c = val.trim();
            if (c === "-") return "";
            c = c.split(/Alamat\s*:|NIK\s*:|Email\s*:/i)[0].trim();
            return c;
        };

        const fromActive = PPAT.activePembeliData && PPAT.activePembeliData.nama ? cleanName(PPAT.activePembeliData.nama) : "";
        if (fromActive) {
            saveActiveBuyerName(fromActive);
            return fromActive;
        }

        const fromPage = getActiveBuyerNameFromPage();
        if (fromPage) return cleanName(fromPage);

        const formInput = document.querySelector("#frmtipepihak2Dukcapil #tNAMA_LENGKAP");
        if (formInput && formInput.value && formInput.value.trim()) {
            const val = cleanName(formInput.value);
            if (val) {
                saveActiveBuyerName(val);
                return val;
            }
        }

        const cardEl = document.getElementById("ppat-pembeli-nama");
        if (cardEl && cardEl.textContent && cardEl.textContent.trim() !== "-") {
            const val = cleanName(cardEl.textContent);
            if (val) return val;
        }

        try {
            const saved = localStorage.getItem(BUYER_NAME_STORAGE_KEY);
            if (saved && saved.trim()) {
                const val = cleanName(saved);
                if (val) return val;
            }
        } catch (_) {}

        if (PPAT.activeBphtbData && PPAT.activeBphtbData.nama_wajib_pajak) {
            const bphtbName = cleanName(PPAT.activeBphtbData.nama_wajib_pajak);
            if (bphtbName && bphtbName !== "-") return bphtbName;
        }

        return "";
    }

    /**
     * Mengonversi Blob ke Base64 string.
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
     * Mengambil info folder dan file Pembeli dari service backend.
     */
    async function fetchPembeliInfo(buyerName) {
        const url = `${config.PEMBELI_FILES_INFO_URL}?buyer_name=${encodeURIComponent(buyerName)}`;
        const resp = await fetch(url);
        return await resp.json();
    }

    /**
     * Mengunduh berkas Pembeli (kk, ktp, pbb, bphtb, pph) dari backend port 3001.
     */
    async function downloadPembeliDocument(buyerName, docType) {
        const url = `${config.PEMBELI_FILE_DOWNLOAD_URL}?buyer_name=${encodeURIComponent(buyerName)}&doc_type=${encodeURIComponent(docType)}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            let errorText = `Status HTTP: ${resp.status}`;
            try {
                const errJson = await resp.json();
                if (errJson.error) errorText = errJson.error;
            } catch (_) {}
            throw new Error(errorText);
        }

        const fileNameHeader = resp.headers.get("x-file-name");
        const docLower = (docType || "").toLowerCase();
        let defaultFilename = "DOKUMEN.pdf";
        if (docLower === "kk" || docLower === "kk_penjual") defaultFilename = "KK.pdf";
        else if (docLower === "ktp" || docLower === "ktp_penjual") defaultFilename = "KTP.pdf";
        else if (docLower === "ktp_persetujuan" || docLower.includes("persetujuan")) defaultFilename = "KTP PERSETUJUAN.pdf";
        else if (docLower === "pbb") defaultFilename = "PBB.pdf";
        else if (docLower === "bphtb") defaultFilename = "BPHTB.pdf";
        else if (docLower === "pph") defaultFilename = "PPH.pdf";

        const filename = fileNameHeader || defaultFilename;

        const blob = await resp.blob();
        const base64 = await blobToBase64(blob);

        return { filename, base64, blob, mimeType: blob.type || "application/pdf" };
    }

    /**
     * Mengekstrak data PBB & BPHTB secara otomatis dari berkas BPHTB di folder Pihak Kedua\[nama pembeli].
     */
    async function extractBuyerBphtb(buyerName) {
        const url = `${config.EXTRACT_PEMBELI_BPHTB_URL}?buyer_name=${encodeURIComponent(buyerName)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (!resp.ok || !json.success) {
            throw new Error(json.error || `Gagal mengekstrak BPHTB untuk '${buyerName}'`);
        }
        return json.data;
    }

    /**
     * Mengekstrak data PPh secara otomatis dari berkas PPh di folder Pihak Kedua\[nama pembeli].
     */
    async function extractBuyerPph(buyerName) {
        const url = `${config.EXTRACT_PEMBELI_PPH_URL}?buyer_name=${encodeURIComponent(buyerName)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        if (!resp.ok || !json.success) {
            throw new Error(json.error || `Gagal mengekstrak PPh untuk '${buyerName}'`);
        }
        return json.data;
    }

    /**
     * Menginjeksi berkas dokumen (PBB / BPHTB / PPh) ke elemen input[type="file"]
     * melalui Page Bridge (Main World).
     */
    function injectSectionFile(section, selector, docData) {
        return new Promise((resolve) => {
            if (!docData || !docData.base64) {
                return resolve({ success: false, error: "Data berkas kosong." });
            }

            const requestId = `${section}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const timeoutTimer = setTimeout(() => {
                window.removeEventListener("message", onResponse);
                resolve({ success: false, error: "Timeout menunggu respons injeksi file dari Page Bridge." });
            }, 10000);

            function onResponse(e) {
                if (
                    e.data &&
                    e.data.type === "PPAT_INJECT_SECTION_FILE_RESPONSE" &&
                    e.data.requestId === requestId
                ) {
                    window.removeEventListener("message", onResponse);
                    clearTimeout(timeoutTimer);
                    resolve(e.data);
                }
            }

            window.addEventListener("message", onResponse);
            window.postMessage(
                {
                    type: "PPAT_INJECT_SECTION_FILE",
                    requestId,
                    section,
                    selector,
                    base64: docData.base64,
                    filename: docData.filename,
                    mimeType: docData.mimeType || "application/pdf",
                },
                "*"
            );
        });
    }

    /**
     * Menunggu hingga sidebar upload dokumen terbuka, opsi select terisi,
     * dan UI tidak lagi terblokir (unblockUI).
     */
    async function waitForSidebarReady(timeoutMs = TIMING.SIDEBAR_TIMEOUT_MS) {
        if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.waitForSidebarReady === "function") {
            return await PPAT.penjualUploadFiller.waitForSidebarReady(timeoutMs);
        }

        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const sideNav = document.getElementById("divsidenavupload2");
            const select = document.querySelector(S.selectTipeUnggah);
            const newDocDiv = document.querySelector(S.divNewDokumen);
            const hasBlockUi = document.querySelector(".blockUI") !== null;

            const isSideNavOpen = sideNav && (
                sideNav.style.width === "80%" ||
                (sideNav.style.width && sideNav.style.width !== "0" && sideNav.style.width !== "0px") ||
                sideNav.offsetWidth > 100
            );

            if (isSideNavOpen && select && select.options.length > 0 && newDocDiv && newDocDiv.style.display !== "none" && !hasBlockUi) {
                return select;
            }
            await dom.delay(30);
        }
        return null;
    }

    /**
     * Menunggu modal notifikasi ATR/BPN (#globalModal) muncul dan memiliki teks pesan.
     */
    function waitForGlobalModal(timeoutMs = TIMING.UPLOAD_TIMEOUT_MS) {
        if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.waitForGlobalModal === "function") {
            return PPAT.penjualUploadFiller.waitForGlobalModal(timeoutMs);
        }

        return new Promise((resolve) => {
            let resolved = false;

            function onMessage(e) {
                if (e.data && e.data.type === "PPAT_SHOWMSG_EVENT" && e.data.message) {
                    cleanup();
                    resolve(e.data.message);
                }
            }

            const timer = setTimeout(() => {
                cleanup();
                resolve(null);
            }, timeoutMs);

            const interval = setInterval(() => {
                const modal = document.querySelector(S.modal);
                if (modal) {
                    const isVisible =
                        modal.classList.contains("show") ||
                        modal.style.display === "block" ||
                        (modal.offsetWidth > 0 && modal.offsetHeight > 0);

                    if (isVisible) {
                        const body = document.querySelector("#globalModalBody");
                        const text = (body ? body.innerText || body.textContent : "").trim();
                        if (text.length > 0) {
                            cleanup();
                            resolve(text);
                            return;
                        }
                    }
                }
            }, 30);

            function cleanup() {
                if (resolved) return;
                resolved = true;
                clearTimeout(timer);
                clearInterval(interval);
                window.removeEventListener("message", onMessage);
            }

            window.addEventListener("message", onMessage);
        });
    }

    /**
     * Mengirim instruksi ke Page Bridge untuk menutup modal.
     */
    function dismissModalAndEnsureClosed() {
        if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.dismissModalAndEnsureClosed === "function") {
            return PPAT.penjualUploadFiller.dismissModalAndEnsureClosed();
        }

        return new Promise((resolve) => {
            function onResponse(e) {
                if (e.data && e.data.type === "PPAT_DISMISS_MODAL_RESPONSE") {
                    window.removeEventListener("message", onResponse);
                    clearTimeout(fallbackTimer);
                    resolve(true);
                }
            }
            window.addEventListener("message", onResponse);
            const fallbackTimer = setTimeout(() => {
                window.removeEventListener("message", onResponse);
                resolve(false);
            }, 500);

            window.postMessage({ type: "PPAT_DISMISS_MODAL" }, "*");
        });
    }

    function forceCleanupModalDom() {
        if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.forceCleanupModalDom === "function") {
            return PPAT.penjualUploadFiller.forceCleanupModalDom();
        }

        const modal = document.querySelector(S.modal);
        if (modal) {
            modal.classList.remove("show");
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
            modal.removeAttribute("aria-modal");
        }
        document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
    }

    /**
     * Mencari baris pembeli di #daftarpihak2placeholder berdasarkan nama.
     * @param {string} buyerName
     * @param {number} timeoutMs
     * @returns {Promise<HTMLElement|null>} Tombol Unggah di baris yang cocok
     */
    async function waitForPembeliRow(buyerName, timeoutMs = 12000) {
        const startTime = Date.now();
        const searchName = (buyerName || "").trim().toLowerCase();

        while (Date.now() - startTime < timeoutMs) {
            const rows = Array.from(document.querySelectorAll(`${S.daftarPlaceholder} li`));
            for (const row of rows) {
                const bq = row.querySelector("blockquote");
                const rowText = (bq ? bq.innerText || bq.textContent : row.innerText || "").toLowerCase();

                let isMatch = false;
                if (!searchName) {
                    isMatch = true;
                } else if (rowText.includes(searchName)) {
                    isMatch = true;
                } else {
                    // Coba pencocokan sebagian kata nama (misal NANDHI)
                    const tokens = searchName.split(/\s+/).filter((t) => t.length > 2);
                    if (tokens.length > 0 && tokens.every((t) => rowText.includes(t))) {
                        isMatch = true;
                    }
                }

                if (isMatch) {
                    const btn = row.querySelector("a[onclick*='unggahpihakakta']");
                    if (btn) return btn;
                }
            }

            // Jika hanya ada 1 baris pembeli di daftar, gunakan tombol di baris tersebut
            if (rows.length === 1) {
                const btn = rows[0].querySelector("a[onclick*='unggahpihakakta']");
                if (btn) return btn;
            }

            await dom.delay(100);
        }

        return null;
    }

    /**
     * Menjalankan 1 langkah upload berkas ke sidebar pembeli (KK / KTP).
     */
    async function executePembeliUploadStep(buyerName, docType, filename, optionValue, preloadedPromise, btnUnggahTarget) {
        console.log(`[AutoUploadPembeli] Memulai langkah upload '${docType}' (${filename}) untuk pembeli '${buyerName}'...`);

        // 1. Dapatkan tombol unggah
        let btnUnggah = btnUnggahTarget;
        if (!btnUnggah) {
            btnUnggah = await waitForPembeliRow(buyerName, 8000);
        }

        if (!btnUnggah) {
            return {
                success: false,
                filename,
                error: `Tombol 'Unggah' untuk pembeli '${buyerName}' tidak ditemukan di halaman.`,
            };
        }

        // 2. Klik tombol Unggah untuk membuka sidebar
        console.log(`[AutoUploadPembeli] Menekan tombol Unggah untuk pembeli '${buyerName}'...`);
        btnUnggah.click();

        // 3. Tunggu sidebar siap & berkas selesai diunduh secara bersamaan
        const [selectEl, docData] = await Promise.all([
            waitForSidebarReady(TIMING.SIDEBAR_TIMEOUT_MS),
            preloadedPromise,
        ]);

        if (!selectEl) {
            return {
                success: false,
                filename,
                error: "Sidebar upload (#divsidenavupload2) tidak merespons atau opsi dokumen tidak muncul.",
            };
        }

        if (!docData || !docData.base64) {
            return {
                success: false,
                filename,
                error: `Gagal membaca berkas ${docType} dari backend (data kosong).`,
            };
        }

        // 4. Tentukan opsi select (KKPEMBELI atau KTPPEMBELI)
        let resolvedOptionValue = optionValue;
        if (!resolvedOptionValue) {
            const availableOptions = Array.from(selectEl.options).map((o) => ({
                value: o.value,
                text: o.text.toLowerCase(),
            }));

            if (docType === "kk") {
                const opt = availableOptions.find((o) => o.value === "KKPEMBELI" || o.text.includes("keluarga") || o.text.includes("kk"));
                if (opt) resolvedOptionValue = opt.value;
            } else if (docType === "ktp") {
                const opt = availableOptions.find((o) => o.value === "KTPPEMBELI" || o.text.includes("ktp"));
                if (opt) resolvedOptionValue = opt.value;
            }
        }

        // 5. Kirim berkas ke Page Bridge (Main World)
        console.log(`[AutoUploadPembeli] Mengirim berkas ke Page Bridge: ${docData.filename} (tipe: ${resolvedOptionValue})...`);
        const uploadResult = await new Promise((resolve) => {
            const timeoutTimer = setTimeout(() => {
                window.removeEventListener("message", onBridgeResponse);
                resolve({ success: false, error: "Batas waktu (timeout) respons Page Bridge terlampaui." });
            }, TIMING.UPLOAD_TIMEOUT_MS);

            function onBridgeResponse(e) {
                if (e.data && e.data.type === "PPAT_INJECT_AND_UPLOAD_RESPONSE") {
                    window.removeEventListener("message", onBridgeResponse);
                    clearTimeout(timeoutTimer);
                    resolve(e.data);
                }
            }

            window.addEventListener("message", onBridgeResponse);

            window.postMessage({
                type: "PPAT_INJECT_AND_UPLOAD",
                base64: docData.base64,
                filename: docData.filename,
                mimeType: "application/pdf",
                tipeValue: resolvedOptionValue,
                pihak: "Pihak 2",
            }, "*");
        });

        if (!uploadResult.success) {
            return {
                success: false,
                filename: docData.filename,
                error: uploadResult.error || "Gagal injeksi berkas di Main World.",
            };
        }

        // 6. Tunggu modal konfirmasi "Data telah diunggah"
        console.log(`[AutoUploadPembeli] Menunggu modal 'Data telah diunggah' untuk ${docData.filename}...`);
        const modalMsg = await waitForGlobalModal(TIMING.UPLOAD_TIMEOUT_MS);
        console.log(`[AutoUploadPembeli] Modal diterima: '${modalMsg}'`);

        // 7. Tutup modal secara bersih
        await dismissModalAndEnsureClosed();
        forceCleanupModalDom();
        await dom.delay(350);

        return {
            success: true,
            filename: docData.filename,
            message: modalMsg,
        };
    }

    /**
     * Menjalankan otomatisasi upload berkas KK dan KTP untuk pembeli yang ditentukan.
     * @param {string} buyerNameParam
     */
    async function runAutoUploadPembeli(buyerNameParam) {
        if (isUploading) {
            console.warn("[AutoUploadPembeli] Upload sedang berlangsung. Abaikan panggilan ganda.");
            return;
        }

        const buyerName = (
            buyerNameParam ||
            (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
            getActiveBuyerNameFromPage() ||
            ""
        ).trim();

        if (!buyerName) {
            alert("Nama pembeli belum tersedia. Pastikan akta PDF telah diupload atau data pembeli ada di halaman web.");
            return;
        }

        isUploading = true;
        console.log(`[AutoUploadPembeli] Memulai otomatisasi upload KK & KTP untuk: '${buyerName}'...`);

        try {
            // 1. Cek info berkas di backend port 3001
            let info;
            try {
                info = await fetchPembeliInfo(buyerName);
            } catch (err) {
                console.error("[AutoUploadPembeli] Gagal menghubungi backend:", err);
                alert(`Gagal menghubungi backend di http://127.0.0.1:3001.\nPastikan service backend aktif.`);
                return;
            }

            if (!info || !info.success) {
                const errMsg = (info && info.error) || `Folder untuk pembeli '${buyerName}' tidak ditemukan di folder Pihak Kedua.`;
                alert(`⚠ ${errMsg}\n\nPeriksa folder di:\nG:\\My Drive\\notaris bu sri\\Pihak Kedua\\${buyerName}`);
                return;
            }

            const pembeliData = info.data || info;
            const folderName = pembeliData.folder_name || pembeliData.folder || info.folder || buyerName;

            const kkObj = pembeliData.kk || (info.files && info.files.kk) || {};
            const ktpObj = pembeliData.ktp || (info.files && info.files.ktp) || {};

            const kkFound = typeof kkObj === "object" ? Boolean(kkObj.found) : Boolean(kkObj);
            const ktpFound = typeof ktpObj === "object" ? Boolean(ktpObj.found) : Boolean(ktpObj);

            const kkFilename = (typeof kkObj === "object" ? kkObj.filename : kkObj) || "KK.pdf";
            const ktpFilename = (typeof ktpObj === "object" ? ktpObj.filename : ktpObj) || "KTP.pdf";

            console.log(`[AutoUploadPembeli] Folder pembeli terkonfirmasi: '${folderName}'. KK: ${kkFilename} (found: ${kkFound}), KTP: ${ktpFilename} (found: ${ktpFound})`);

            if (!kkFound && !ktpFound) {
                alert(`⚠ Berkas KK dan KTP tidak ditemukan di dalam folder:\nG:\\My Drive\\notaris bu sri\\Pihak Kedua\\${folderName}\n\nPastikan terdapat file KK dan KTP.`);
                return;
            }

            // 2. Pre-fetch download berkas KK & KTP secara paralel
            const kkPromise = kkFound
                ? downloadPembeliDocument(buyerName, "kk")
                : Promise.resolve(null);
            const ktpPromise = ktpFound
                ? downloadPembeliDocument(buyerName, "ktp")
                : Promise.resolve(null);

            const results = {
                buyer: buyerName,
                folder: folderName,
                kk: { success: false, filename: kkFilename },
                ktp: { success: false, filename: ktpFilename },
            };

            // 3. Langkah 1: Upload KK (Kartu Keluarga Pembeli -> KKPEMBELI)
            if (kkFound) {
                console.log(`[AutoUploadPembeli] [1/2] Mengunggah Kartu Keluarga (KK)...`);
                const btnKk = await waitForPembeliRow(buyerName, 8000);
                const resKk = await executePembeliUploadStep(
                    buyerName,
                    "kk",
                    kkFilename,
                    "KKPEMBELI",
                    kkPromise,
                    btnKk
                );
                results.kk = resKk;

                if (!resKk.success) {
                    console.warn("[AutoUploadPembeli] Gagal mengunggah KK:", resKk.error);
                } else {
                    console.log("[AutoUploadPembeli] ✔ KK berhasil diunggah:", resKk.filename);
                }

                // Jeda singkat transisi & pastikan modal bersih
                await dismissModalAndEnsureClosed();
                forceCleanupModalDom();
                await dom.delay(400);
            } else {
                results.kk = { success: false, filename: kkFilename, error: "Berkas KK tidak ditemukan di folder." };
            }

            // 4. Langkah 2: Upload KTP (Fotocopy KTP Pembeli -> KTPPEMBELI)
            if (ktpFound) {
                console.log(`[AutoUploadPembeli] [2/2] Mengunggah KTP Pembeli...`);
                const btnKtp = await waitForPembeliRow(buyerName, 8000);
                const resKtp = await executePembeliUploadStep(
                    buyerName,
                    "ktp",
                    ktpFilename,
                    "KTPPEMBELI",
                    ktpPromise,
                    btnKtp
                );
                results.ktp = resKtp;

                if (!resKtp.success) {
                    console.warn("[AutoUploadPembeli] Gagal mengunggah KTP:", resKtp.error);
                } else {
                    console.log("[AutoUploadPembeli] ✔ KTP berhasil diunggah:", resKtp.filename);
                }
            } else {
                results.ktp = { success: false, filename: ktpFilename, error: "Berkas KTP tidak ditemukan di folder." };
            }

            // Tandai pembeli ini sudah selesai diunggah
            processedBuyers.add(buyerName.toLowerCase());

            // 5. Tampilkan notifikasi hasil akhir
            notifyPembeliUploadResults(results);
        } catch (err) {
            console.error("[AutoUploadPembeli] Error fatal dalam alur upload:", err);
            alert(`Terjadi kesalahan pada otomatisasi upload berkas pembeli:\n${err.message || err}`);
        } finally {
            isUploading = false;
        }
    }

    /**
     * Menampilkan alert rekapitulasi status upload pembeli.
     */
    function notifyPembeliUploadResults(results) {
        const kkOk = Boolean(results.kk && results.kk.success);
        const ktpOk = Boolean(results.ktp && results.ktp.success);
        const kkFilename = (results.kk && results.kk.filename) || "KK.pdf";
        const ktpFilename = (results.ktp && results.ktp.filename) || "KTP.pdf";

        if (kkOk && ktpOk) {
            const msg = `✅ Berkas Pembeli (${results.buyer}) berhasil diunggah ke website ATR/BPN:\n\n` +
                        `1. Kartu Keluarga Pembeli: ${kkFilename} (Berhasil)\n` +
                        `2. Fotocopy KTP Pembeli: ${ktpFilename} (Berhasil)`;
            alert(msg);
            console.log(msg);
        } else {
            let msg = `⚠️ Status Upload Berkas Pembeli (${results.buyer}):\n\n`;
            msg += kkOk ? `✔ Kartu Keluarga: ${kkFilename} (BERHASIL)\n` : `❌ Kartu Keluarga: GAGAL (${(results.kk && results.kk.error) || "Gagal"})\n`;
            msg += ktpOk ? `✔ Fotocopy KTP: ${ktpFilename} (BERHASIL)\n` : `❌ Fotocopy KTP: GAGAL (${(results.ktp && results.ktp.error) || "Gagal"})\n`;
            alert(msg);
            console.warn(msg);
        }
    }

    /**
     * Memantau aksi pengguna saat submit form Pembeli (#btn-tambahtipepihak2NIK)
     * dan kemunculan baris pembeli di #daftarpihak2placeholder untuk otomatis upload KK & KTP.
     */
    function initPembeliWatcher() {
        if (watcherInitialized) return;
        watcherInitialized = true;
        console.log("[AutoUploadPembeli] Watcher submit form pembeli diaktifkan.");

        // Listener pada tombol Tambah form pembeli
        document.addEventListener("click", async (e) => {
            const target = e.target;
            const btnTambah = target.closest(SELECTORS.pembeli.btnTambah) ||
                              (target.id === "btn-tambahtipepihak2NIK" ? target : null);

            if (!btnTambah) return;

            // Baca nama yang sedang ada di form
            const nameInput = document.querySelector("#frmtipepihak2Dukcapil #tNAMA_LENGKAP");
            const submittedName = (
                (nameInput ? nameInput.value : "") ||
                (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
                ""
            ).trim();

            console.log(`[AutoUploadPembeli] Tombol 'Tambah' pembeli diklik. Nama target: '${submittedName}'. Menunggu baris masuk di daftar...`);

            // Tunggu hingga baris baru muncul di #daftarpihak2placeholder
            await dom.delay(500);
            const rowBtn = await waitForPembeliRow(submittedName, 15000);
            if (rowBtn) {
                console.log(`[AutoUploadPembeli] Baris pembeli '${submittedName}' terkonfirmasi di daftar! Memulai upload otomatis KK & KTP...`);
                await dom.delay(300);
                await runAutoUploadPembeli(submittedName);
            } else {
                console.warn(`[AutoUploadPembeli] Baris pembeli '${submittedName}' tidak muncul dalam batas waktu.`);
            }
        }, true);

        // Observer pada #daftarpihak2placeholder jika baris masuk melalui cara lain
        const daftarPlaceholder = document.querySelector(S.daftarPlaceholder);
        if (daftarPlaceholder) {
            const observer = new MutationObserver((mutations) => {
                if (isUploading) return;
                const buyerName = getActiveBuyerNameFromPage();
                if (buyerName && !processedBuyers.has(buyerName.toLowerCase())) {
                    // Jika ada data pembeli aktif dan cocok dengan baris yang baru muncul
                    if (PPAT.activePembeliData && PPAT.activePembeliData.nama) {
                        const activeName = PPAT.activePembeliData.nama.trim().toLowerCase();
                        if (buyerName.toLowerCase().includes(activeName) || activeName.includes(buyerName.toLowerCase())) {
                            console.log(`[AutoUploadPembeli] Deteksi baris pembeli baru melalui observer: '${buyerName}'. Memulai upload...`);
                            dom.delay(400).then(() => runAutoUploadPembeli(buyerName));
                        }
                    }
                }
            });

            observer.observe(daftarPlaceholder, { childList: true, subtree: true });
        }
    }

    return {
        saveActiveBuyerName,
        getActiveBuyerName,
        getActiveBuyerNameFromPage,
        fetchPembeliInfo,
        downloadPembeliDocument,
        extractBuyerBphtb,
        extractBuyerPph,
        injectSectionFile,
        executePembeliUploadStep,
        runAutoUploadPembeli,
        initPembeliWatcher,
    };
})();
