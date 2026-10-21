/**
 * Otomatisasi Upload Dokumen Penjual (Akta Pendirian & NPWP).
 * Mengunduh file dari folder lokal via service backend (Port 3001)
 * lalu mengunggahnya secara sekuensial ke website ATR/BPN.
 */
PPAT.penjualUploadFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING } = config;
    const S = SELECTORS.penjualUpload;

    let isUploadingPerorangan = false;
    let watcherInitialized = false;

    /**
     * Membaca nama PT yang saat ini tercatat di baris Penjual (Pihak 1) pada website ATR/BPN.
     * @returns {string|null} Nama PT atau null jika belum ada
     */
    function getActivePtNameFromPage() {
        const blockquote = document.querySelector(SELECTORS.daftarPenjual);
        if (blockquote) {
            const text = blockquote.innerText || blockquote.textContent || "";
            const match = text.match(/Nama\s*:\s*([^<\n\r]+)/i);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return null;
    }

    /**
     * Membaca nama Penjual yang saat ini tercatat di baris Penjual (Pihak 1) pada website ATR/BPN.
     * @returns {string|null} Nama Penjual atau null jika belum ada
     */
    function getActiveSellerNameFromPage() {
        const rows = document.querySelectorAll(`${S.btnUnggah}, ${SELECTORS.daftarPenjual}, #daftarpihak1placeholder li, #daftarpihak1placeholder blockquote`);
        for (const row of rows) {
            const bq = row.matches("blockquote") ? row : (row.querySelector("blockquote") || row);
            const rawHtml = bq.innerHTML || "";
            const cleanText = rawHtml.replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "");
            const textToMatch = cleanText || bq.innerText || bq.textContent || "";
            const match = textToMatch.match(/Nama\s*:\s*([^<\n\r]+)/i);
            if (match && match[1]) {
                let found = match[1].trim();
                found = found.split(/Alamat\s*:|NIK\s*:|Email\s*:/i)[0].trim();
                if (found && found !== "-") {
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * Memeriksa apakah tipe penjual saat ini adalah Perorangan.
     * @returns {boolean}
     */
    function isTipePenjualPerorangan() {
        if (PPAT.activePenjualPerorangan) return true;
        const select = document.querySelector((SELECTORS.penjualPerorangan && SELECTORS.penjualPerorangan.tipePihak) || "select#tipepihak1");
        if (select && select.value) {
            const val = select.value.toLowerCase();
            if (val === "perorangan" || val.includes("perorangan")) return true;
            if (val === "non perorangan" || val.includes("badan") || val.includes("hukum")) return false;
        }
        const formPerorangan = document.querySelector((SELECTORS.penjualPerorangan && SELECTORS.penjualPerorangan.form) || "#frmtipepihak1Dukcapil");
        if (formPerorangan && (formPerorangan.offsetWidth > 0 || formPerorangan.offsetHeight > 0 || formPerorangan.style.display !== "none")) {
            return true;
        }
        return false;
    }

    /**
     * Mendapatkan nama pembeli aktif untuk mencari folder G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli].
     * @param {string} [explicitBuyerName] Nama pembeli jika sudah diketahui secara eksplisit
     * @returns {string} Nama pembeli atau string kosong jika belum ditemukan
     */
    function resolveBuyerName(explicitBuyerName) {
        if (explicitBuyerName && typeof explicitBuyerName === "string" && explicitBuyerName.trim() && explicitBuyerName.trim() !== "-") {
            return explicitBuyerName.trim();
        }
        if (PPAT.activePembeliData && PPAT.activePembeliData.nama && PPAT.activePembeliData.nama.trim() !== "-") {
            return PPAT.activePembeliData.nama.trim();
        }
        if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function") {
            const fromUploadFiller = PPAT.pembeliUploadFiller.getActiveBuyerName();
            if (fromUploadFiller) return fromUploadFiller;
        }
        try {
            const saved = localStorage.getItem("ppat_saved_buyer_name");
            if (saved && saved.trim() && saved.trim() !== "-") return saved.trim();
        } catch (_) {}

        if (PPAT.activeBphtbData && PPAT.activeBphtbData.nama_wajib_pajak) {
            const n = PPAT.activeBphtbData.nama_wajib_pajak.trim();
            if (n && n !== "-") return n;
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
     * Mengambil info berkas di folder Pihak Kedua\[nama pembeli] via backend port 3001.
     */
    async function fetchBuyerInfo(buyerName) {
        if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.fetchPembeliInfo === "function") {
            return await PPAT.pembeliUploadFiller.fetchPembeliInfo(buyerName);
        }
        const url = `${config.PEMBELI_FILES_INFO_URL}?buyer_name=${encodeURIComponent(buyerName)}`;
        const resp = await fetch(url);
        return await resp.json();
    }

    /**
     * Mengunduh berkas KK / KTP dari folder Pihak Kedua\[nama pembeli] via backend port 3001.
     */
    async function downloadBuyerDocument(buyerName, docType) {
        if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.downloadPembeliDocument === "function") {
            return await PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, docType);
        }
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

        const filename = fileNameHeader || defaultFilename;
        const blob = await resp.blob();
        const base64 = await blobToBase64(blob);

        return { filename, base64, blob, mimeType: blob.type || "application/pdf" };
    }

    /**
     * Mencari baris dan tombol Unggah Penjual di #daftarpihak1placeholder.
     */
    async function waitForPenjualRow(sellerName, timeoutMs = 10000) {
        const startTime = Date.now();
        const searchName = (sellerName || "").trim().toLowerCase();

        while (Date.now() - startTime < timeoutMs) {
            const container = document.querySelector("#daftarpihak1placeholder");
            if (container) {
                const rows = Array.from(container.querySelectorAll("li, tr, blockquote"));
                for (const row of rows) {
                    const bq = row.matches("blockquote") ? row : (row.querySelector("blockquote") || row);
                    const rowText = (bq ? bq.innerText || bq.textContent : row.innerText || "").toLowerCase();

                    let isMatch = false;
                    if (!searchName) {
                        isMatch = true;
                    } else if (rowText.includes(searchName)) {
                        isMatch = true;
                    } else {
                        const tokens = searchName.split(/\s+/).filter((t) => t.length > 2);
                        if (tokens.length > 0 && tokens.every((t) => rowText.includes(t))) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        const btn = (row.matches("li, tr") ? row : row.closest("li, tr") || container)
                            .querySelector("a[onclick*='unggahpihakakta']");
                        if (btn) return btn;
                    }
                }

                const allBtns = container.querySelectorAll("a[onclick*='unggahpihakakta']");
                if (allBtns.length === 1) {
                    return allBtns[0];
                }
                if (allBtns.length > 0 && !searchName) {
                    return allBtns[allBtns.length - 1];
                }
            }

            const fallbackBtn = document.querySelector(S.btnUnggah);
            if (fallbackBtn && !searchName) return fallbackBtn;

            await dom.delay(100);
        }

        return document.querySelector(S.btnUnggah);
    }

    /**
     * Mengambil info folder dan file PT dari service backend.
     */
    async function fetchPtInfo(ptName, personName) {
        let url = `${config.PT_FILE_INFO_URL}?pt_name=${encodeURIComponent(ptName)}`;
        if (personName) {
            url += `&person_name=${encodeURIComponent(personName)}`;
        }
        const resp = await fetch(url);
        return await resp.json();
    }

    /**
     * Mengunduh berkas dokumen dari backend port 3001.
     */
    async function downloadDocument(ptName, docType, personName) {
        let url = `${config.PT_FILE_DOWNLOAD_URL}?pt_name=${encodeURIComponent(ptName)}&doc_type=${encodeURIComponent(docType)}`;
        if (personName) {
            url += `&person_name=${encodeURIComponent(personName)}`;
        }
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
        let defaultFilename = "DOKUMEN.pdf";
        if (docType === "akta") defaultFilename = "AKTA PENDIRIAN.pdf";
        else if (docType === "npwp") defaultFilename = "NPWP.pdf";
        else if (docType === "ktp") defaultFilename = "KTP.pdf";

        let filename = fileNameHeader || defaultFilename;

        const blob = await resp.blob();
        const base64 = await blobToBase64(blob);

        return { filename, base64, blob };
    }

    /**
     * Menunggu hingga sidebar upload dokumen terbuka, opsi select terisi,
     * dan UI tidak lagi terblokir (unblockUI).
     */
    async function waitForSidebarReady(timeoutMs = TIMING.SIDEBAR_TIMEOUT_MS) {
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
     * Mendengarkan event PPAT_SHOWMSG_EVENT dari Page Bridge serta polling DOM dengan jeda sangat cepat.
     * @returns {Promise<string|null>} Pesan isi modal atau null jika timeout
     */
    function waitForGlobalModal(timeoutMs = TIMING.UPLOAD_TIMEOUT_MS) {
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
                        const body = document.querySelector(S.modalBody);
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
     * Membersihkan paksa modal dan backdrop agar tidak menghalangi interaksi elemen berikutnya.
     */
    function forceCleanupModalDom() {
        const openModals = document.querySelectorAll("#globalModal, #myModal, .modal");
        openModals.forEach((m) => {
            m.classList.remove("show");
            m.style.display = "none";
            m.setAttribute("aria-hidden", "true");
            m.removeAttribute("aria-modal");
        });
        document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
    }

    /**
     * Memeriksa apakah ada modal notifikasi (#globalModal, #myModal, dll) atau backdrop-nya sedang aktif di layar.
     */
    function isModalOpen() {
        const modal = document.querySelector("#globalModal, #myModal, .modal");
        const backdrop = document.querySelector(".modal-backdrop");
        if (!modal && !backdrop) return false;

        const isVisible = modal && (
            modal.classList.contains("show") ||
            (modal.style.display === "block" && modal.getAttribute("aria-hidden") !== "true") ||
            (modal.offsetWidth > 0 && modal.offsetHeight > 0 && !modal.classList.contains("fade"))
        );

        const hasActiveBackdrop = backdrop && backdrop.classList.contains("show");
        return Boolean(isVisible || hasActiveBackdrop);
    }

    /**
     * Menekan tombol OK berwarna biru pada modal yang muncul dan memastikan modal tertutup seketika.
     * Sesuai instruksi: SELALU TEKAN TOMBOL OK JIKA ADA MODAL SEPERTI ITU SEBELUM KLIK UNGGAH LAGI.
     * @param {number} maxWaitMs Waktu maksimal menunggu modal tertutup
     */
    async function dismissModalAndEnsureClosed(maxWaitMs = 1000) {
        if (!isModalOpen()) {
            return;
        }

        console.log("[AutoUpload] Modal aktif terdeteksi. Menekan tombol OK berwarna biru...");

        // 1. Cari tombol OK di DOM dan klik langsung tanpa delay
        const modal = document.querySelector("#globalModal, #myModal, .modal.show, .modal[style*='display: block']");
        if (modal) {
            const buttons = Array.from(modal.querySelectorAll("button, a.btn"));
            const okBtn =
                buttons.find((b) => (b.innerText || b.textContent || "").trim().toUpperCase() === "OK") ||
                modal.querySelector("button.btn-primary, button[data-bs-dismiss='modal'], button[data-dismiss='modal'], #btn-ok") ||
                buttons[0];

            if (okBtn) {
                console.log("[AutoUpload] Menekan tombol OK pada modal di DOM:", okBtn);
                try {
                    okBtn.focus();
                    okBtn.click();
                } catch (e) {
                    console.warn("[AutoUpload] Gagal klik okBtn di content script:", e);
                }
            }
        }

        // 2. Kirim sinyal ke Page Bridge (Main World) untuk memastikan Bootstrap hide terpanggil
        window.postMessage({ type: "PPAT_DISMISS_MODAL" }, "*");

        // 3. Polling cepat (20ms) hingga modal tertutup
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            if (!isModalOpen()) {
                break;
            }
            await dom.delay(20);

            // Jika dalam 120ms modal belum tertutup otomatis, bersihkan paksa
            if (Date.now() - startTime > 120) {
                forceCleanupModalDom();
                break;
            }
        }

        forceCleanupModalDom();
    }

    /**
     * Mengirimkan file ke Page Bridge (Main World) untuk diset ke window.dfupload2
     * dan memicu fungsi simpandokumenupload2().
     */
    function sendUploadToMainWorld(base64, filename, tipeValue, extraData = {}) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                cleanup();
                resolve({ success: false, error: "Timeout komunikasi dengan Page Bridge (Main World)." });
            }, 10000);

            function messageHandler(e) {
                if (e.data && e.data.type === "PPAT_INJECT_AND_UPLOAD_RESPONSE") {
                    cleanup();
                    resolve(e.data);
                }
            }

            function cleanup() {
                clearTimeout(timeout);
                window.removeEventListener("message", messageHandler);
            }

            window.addEventListener("message", messageHandler);

            const payload = {
                type: "PPAT_INJECT_AND_UPLOAD",
                base64,
                filename,
                mimeType: "application/pdf",
                tipeValue,
                pihak: extraData.pihak || "Pihak 1",
                idreferensi: extraData.idreferensi,
                aktanoninput: extraData.aktanoninput,
                tipeunggahfile: extraData.tipeunggahfile,
            };

            window.postMessage(payload, "*");
        });
    }

    /**
     * Menjalankan satu tahap upload (Akta Pendirian, NPWP, KK, atau KTP):
     * 1. Gunakan berkas yang sudah/sedang diunduh dari backend secara paralel
     * 2. Klik tombol "Unggah" seketika
     * 3. Tunggu sidebar upload siap
     * 4. Pilih opsi jenis dokumen yang sesuai pada dropdown
     * 5. Suntikkan berkas via Main World Page Bridge
     * 6. Klik Simpan
     * 7. Tunggu respon modal "Data telah diunggah" lalu klik OK
     */
    async function executeUploadStep(ptName, docType, filename, preferredOptionValue, preloadedDocPromise, btnUnggahTarget = S.btnUnggah) {
        try {
            // 0. SEBELUM MULAI: Pastikan modal apapun yang ada sudah ditutup dengan menekan tombol OK
            if (isModalOpen()) {
                console.log("[AutoUpload] Ditemukan modal sebelum proses upload, menekan OK terlebih dahulu...");
                await dismissModalAndEnsureClosed();
            }

            // Gunakan promise download yang sedang/sudah berjalan di background
            const docPromise = preloadedDocPromise || downloadDocument(ptName, docType);

            // Cari tombol Unggah sesuai selector target (Penjual atau Persetujuan)
            console.log(`[AutoUpload] Mencari tombol Unggah untuk ${docType}...`);
            let btnUnggah = null;
            if (btnUnggahTarget instanceof Element) {
                if (document.body.contains(btnUnggahTarget)) {
                    btnUnggah = btnUnggahTarget;
                } else {
                    const all = document.querySelectorAll(config.SELECTORS.persetujuan.btnUnggah);
                    btnUnggah = all.length > 0 ? all[all.length - 1] : null;
                }
            } else if (typeof btnUnggahTarget === "string") {
                const allBtns = document.querySelectorAll(btnUnggahTarget);
                btnUnggah = allBtns.length > 0 ? allBtns[allBtns.length - 1] : (await dom.waitForElement(btnUnggahTarget, 3000));
            }
            if (!btnUnggah) {
                return {
                    success: false,
                    error: `Tombol Unggah tidak ditemukan.`,
                };
            }

            // Ekstrak info referensi jika ada dari baris atau onclick tombol
            let refId = null;
            let pihak = "Pihak 1";
            let aktaId = null;
            let tipeUnggahFile = null;
            const parentRow = btnUnggah.closest("li, tr, blockquote") || btnUnggah.parentElement;
            const pUrl = parentRow ? parentRow.querySelector("p.url[data-refid]") : null;
            if (pUrl) {
                refId = pUrl.getAttribute("data-refid");
                pihak = pUrl.getAttribute("data-pihak") || "Pihak 1";
                aktaId = pUrl.getAttribute("data-aktaid");
                tipeUnggahFile = pUrl.getAttribute("data-tipepihak");
            } else {
                const onclickAttr = btnUnggah.getAttribute("onclick") || "";
                const m = onclickAttr.match(/unggahpihakakta\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
                if (m) {
                    refId = m[1];
                    pihak = m[2];
                }
            }

            // Pastikan tidak ada backdrop yang menutupi
            forceCleanupModalDom();

            // Klik tombol Unggah seketika untuk membuka sidebar
            console.log(`[AutoUpload] Mengklik tombol Unggah (${docType}) seketika...`);
            btnUnggah.focus();
            btnUnggah.click();

            // Tunggu sidebar upload terbuka dan opsi jenis dokumen siap
            console.log(`[AutoUpload] Menunggu sidebar upload terbuka (${docType})...`);
            const select = await waitForSidebarReady();
            if (!select) {
                return {
                    success: false,
                    error: "Sidebar upload tidak terbuka atau opsi jenis dokumen gagal dimuat dari server ATR/BPN.",
                };
            }

            // Pastikan data berkas sudah siap
            console.log(`[AutoUpload] Menunggu berkas ${docType} ('${filename}') siap...`);
            const docData = await docPromise;
            if (!docData || !docData.base64) {
                return {
                    success: false,
                    error: `Berkas ${docType} gagal dimuat dari server backend lokal.`,
                };
            }
            const { base64 } = docData;
            const actualFilename = docData.filename || filename;

            // Tentukan value opsi yang cocok pada dropdown
            let selectedValue = null;
            const docLower = (docType || "").toLowerCase();

            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                const optTextUpper = (opt.text || "").toUpperCase();
                const optValUpper = (opt.value || "").toUpperCase();

                if (preferredOptionValue && (opt.value === preferredOptionValue || optValUpper === preferredOptionValue.toUpperCase())) {
                    selectedValue = opt.value;
                    break;
                }

                if (docLower === "kk") {
                    if (optValUpper.includes("KK") || optValUpper.includes("KELUARGA") || optTextUpper.includes("KK") || optTextUpper.includes("KELUARGA")) {
                        selectedValue = opt.value;
                        break;
                    }
                } else if (docLower === "ktp") {
                    if (optValUpper.includes("KTP") || optValUpper.includes("IDENTITAS") || optTextUpper.includes("KTP") || optTextUpper.includes("IDENTITAS")) {
                        selectedValue = opt.value;
                        break;
                    }
                } else if (docLower === "akta") {
                    if (optValUpper.includes("AKTA") || optTextUpper.includes("AKTA")) {
                        selectedValue = opt.value;
                        break;
                    }
                } else if (docLower === "npwp") {
                    if (optValUpper.includes("NPWP") || optTextUpper.includes("NPWP")) {
                        selectedValue = opt.value;
                        break;
                    }
                }
            }

            if (!selectedValue && select.options.length > 0) {
                if (docLower === "kk") {
                    const fallbackOpt = Array.from(select.options).find((o) =>
                        (o.value || "").toUpperCase().includes("KK") || (o.text || "").toUpperCase().includes("KK") ||
                        (o.value || "").toUpperCase().includes("KELUARGA") || (o.text || "").toUpperCase().includes("KELUARGA")
                    );
                    if (fallbackOpt) selectedValue = fallbackOpt.value;
                } else if (docLower === "ktp") {
                    const fallbackOpt = Array.from(select.options).find((o) =>
                        (o.value || "").toUpperCase().includes("KTP") || (o.text || "").toUpperCase().includes("KTP") ||
                        (o.value || "").toUpperCase().includes("IDENTITAS") || (o.text || "").toUpperCase().includes("IDENTITAS")
                    );
                    if (fallbackOpt) selectedValue = fallbackOpt.value;
                }
                if (!selectedValue) {
                    const firstValid = Array.from(select.options).find((o) => o.value && o.value.trim() !== "");
                    selectedValue = firstValid ? firstValid.value : select.options[0].value;
                }
            }

            await dom.delay(50);

            // Suntikkan file ke elemen input dan window.dfupload2 via Page Bridge (Main World)
            console.log(`[AutoUpload] Mengirim berkas '${actualFilename}' ke Page Bridge (Main World)...`);
            const bridgeRes = await sendUploadToMainWorld(base64, actualFilename, selectedValue, {
                pihak,
                idreferensi: refId,
                aktanoninput: aktaId,
                tipeunggahfile: tipeUnggahFile,
            });
            if (!bridgeRes.success) {
                return {
                    success: false,
                    error: `Gagal injeksi berkas di Main World: ${bridgeRes.error || "Gagal menyuntikkan berkas"}`,
                };
            }

            // Tunggu modal respon muncul
            console.log(`[AutoUpload] Menunggu konfirmasi upload dari website ATR/BPN (${docType})...`);
            const modalMsg = await waitForGlobalModal();
            if (!modalMsg) {
                if (isModalOpen()) {
                    await dismissModalAndEnsureClosed();
                }
                return {
                    success: false,
                    error: "Waktu tunggu habis (timeout) saat menunggu konfirmasi upload dokumen dari website ATR/BPN.",
                };
            }

            console.log(`[AutoUpload] Pesan dari website ATR/BPN: "${modalMsg}"`);

            // SELALU TEKAN TOMBOL OK JIKA ADA MODAL SEPERTI ITU
            console.log(`[AutoUpload] Menekan tombol OK pada modal "${modalMsg}"...`);
            await dismissModalAndEnsureClosed();

            if (modalMsg.toLowerCase().includes("data telah diunggah")) {
                return { success: true, filename: actualFilename };
            } else {
                return { success: false, error: modalMsg, filename: actualFilename };
            }
        } catch (err) {
            if (isModalOpen()) {
                await dismissModalAndEnsureClosed();
            }
            return { success: false, error: err.message || String(err) };
        }
    }

    /**
     * Memeriksa apakah seorang pihak persetujuan sudah tercatat di tabel/daftar web ATR/BPN.
     */
    function isPersonInDaftar(personName, personNik) {
        if (PPAT.persetujuanFiller && typeof PPAT.persetujuanFiller.isPersonAlreadyInDaftar === "function") {
            return PPAT.persetujuanFiller.isPersonAlreadyInDaftar(personName, personNik);
        }
        const container = document.querySelector(config.SELECTORS.persetujuan.daftarPlaceholder || "#daftarpemohonpihaksetujuplaceholder");
        if (!container) return false;
        const cleanTarget = (personName || "").trim().toLowerCase();
        if (!cleanTarget) return false;
        return container.textContent.toLowerCase().includes(cleanTarget);
    }

    /**
     * Menunggu dan mencari tombol "Unggah" untuk personil pihak persetujuan tertentu.
     * Mencari row yang mengandung nama personil atau baris baru yang muncul.
     */
    async function waitForPersetujuanRow(personName, prevBtnCount = 0, timeoutMs = 12000) {
        const startTime = Date.now();
        const cleanTarget = (personName || "").trim().toLowerCase();
        const placeholderSelector = config.SELECTORS.persetujuan.daftarPlaceholder || "#daftarpemohonpihaksetujuplaceholder";

        while (Date.now() - startTime < timeoutMs) {
            const container = document.querySelector(placeholderSelector);
            if (container) {
                // 1. Cek spesifik berdasarkan nama personil di dalam row/li
                const items = container.querySelectorAll("li, .message_wrapper");
                for (const item of items) {
                    const text = (item.textContent || "").toLowerCase();
                    if (cleanTarget && text.includes(cleanTarget)) {
                        const btn = item.querySelector("a[onclick*='unggahpihakakta']");
                        if (btn) return btn;
                    }
                }

                // 2. Jika row bertambah dibanding sebelum submit, ambil tombol terakhir
                const allBtns = container.querySelectorAll("a[onclick*='unggahpihakakta']");
                if (allBtns.length > prevBtnCount) {
                    await dom.delay(100);
                    const updatedBtns = container.querySelectorAll("a[onclick*='unggahpihakakta']");
                    return updatedBtns[updatedBtns.length - 1];
                }
            }
            await dom.delay(200);
        }

        // Fallback: tombol terakhir di daftar jika ada
        const fallbackBtns = document.querySelectorAll(config.SELECTORS.persetujuan.btnUnggah);
        return fallbackBtns.length > 0 ? fallbackBtns[fallbackBtns.length - 1] : null;
    }

    /**
     * Alur lengkap upload berkas otomatis untuk PT:
     * 1. Akta Pendirian Penjual
     * 2. NPWP Penjual
     * 3. Pengisian data SEMUA Pihak Persetujuan & Upload KTP Persetujuan masing-masing
     * 4. Menampilkan notifikasi akhir lengkap
     */
    async function runAutoUpload(ptNameInput) {
        const ptName = ptNameInput || getActivePtNameFromPage();
        if (!ptName) {
            alert("Nama PT tidak terdeteksi di halaman web maupun panel. Silakan pilih atau isi data PT terlebih dahulu.");
            return;
        }

        console.log(`[AutoUpload] Memulai proses otomatisasi lengkap untuk PT: '${ptName}'`);

        // Pastikan database PT dari Supabase sudah termuat
        if (PPAT.cloudDatabase && typeof PPAT.cloudDatabase.ensureLoaded === "function") {
            await PPAT.cloudDatabase.ensureLoaded();
        }

        // Cari data seluruh personil Pihak Persetujuan dari database
        const ptKey = PPAT.ptMatcher ? PPAT.ptMatcher.findPtKeyByName(ptName) : null;
        if (!ptKey && (PPAT.activePenjualPerorangan || document.querySelector("#frmtipepihak1Dukcapil") || document.querySelector("#daftarpihak1placeholder"))) {
            console.log(`[AutoUpload] '${ptName}' bukan nama PT di ptDatabase, mengalihkan ke upload Penjual Perorangan...`);
            return await runAutoUploadPerorangan(ptName);
        }
        const persetujuanList = (ptKey && PPAT.ptDatabase[ptKey]) ? PPAT.ptDatabase[ptKey].persetujuan : [];

        // 1. Cek informasi folder dan file di backend port 3001
        let ptInfo;
        try {
            const firstPersonName = (persetujuanList && persetujuanList.length > 0) ? persetujuanList[0].nama : null;
            const res = await fetchPtInfo(ptName, firstPersonName);
            if (!res.success || !res.data) {
                alert(`Folder PT tidak ditemukan di 'G:\\My Drive\\notaris bu sri\\PT':\n${res.error || "Pencocokan nama PT gagal."}`);
                return;
            }
            ptInfo = res.data;
        } catch (err) {
            alert(
                `Gagal menghubungi service backend di http://127.0.0.1:3001.\n` +
                `Pastikan backend sudah aktif (jalankan start-backend.bat).\n\n` +
                `Detail: ${err.message}`
            );
            return;
        }

        const folderName = ptInfo.folder_name;
        const results = {
            akta: { filename: ptInfo.akta.filename, success: false, error: null },
            npwp: { filename: ptInfo.npwp.filename, success: false, error: null },
            persetujuan: [],
        };

        // Mulai download berkas akta, npwp, dan KTP SEMUA pihak persetujuan secara paralel di background
        console.log("[AutoUpload] Memulai download berkas Akta, NPWP, dan KTP semua pihak persetujuan secara paralel di latar belakang...");
        const aktaPromise = (ptInfo.akta.found && ptInfo.akta.filename)
            ? downloadDocument(ptName, "akta")
            : Promise.resolve(null);
        const npwpPromise = (ptInfo.npwp.found && ptInfo.npwp.filename)
            ? downloadDocument(ptName, "npwp")
            : Promise.resolve(null);

        const ktpPromises = {};
        for (const person of persetujuanList) {
            console.log(`[AutoUpload] Preloading berkas KTP untuk '${person.nama}' di latar belakang...`);
            ktpPromises[person.nama] = downloadDocument(ptName, "ktp", person.nama).catch((err) => ({ error: err.message }));
        }

        // 2. Tahap 1: Upload Akta Pendirian
        if (!ptInfo.akta.found || !ptInfo.akta.filename) {
            results.akta.error = `Berkas AKTA PENDIRIAN tidak ditemukan di dalam folder '${folderName}'.`;
        } else {
            const resAkta = await executeUploadStep(ptName, "akta", ptInfo.akta.filename, "AKTAPPENJUAL", aktaPromise, S.btnUnggah);
            if (resAkta.success) {
                results.akta.success = true;
            } else {
                results.akta.error = resAkta.error;
            }
        }

        // Langsung lanjut ke Tahap 2 seketika tanpa jeda buatan
        // 3. Tahap 2: Upload NPWP Penjual
        if (!ptInfo.npwp.found || !ptInfo.npwp.filename) {
            results.npwp.error = `Berkas NPWP tidak ditemukan di dalam folder '${folderName}'.`;
        } else {
            const resNpwp = await executeUploadStep(ptName, "npwp", ptInfo.npwp.filename, "NPWPPENJUAL", npwpPromise, S.btnUnggah);
            if (resNpwp.success) {
                results.npwp.success = true;
            } else {
                results.npwp.error = resNpwp.error;
            }
        }

        // 4. Tahap 3: Otomatisasi SELURUH Pihak Persetujuan (Pengisian Form & Upload KTP Masing-masing)
        const persetujuanResults = [];
        if (persetujuanList && persetujuanList.length > 0 && PPAT.persetujuanFiller) {
            console.log(`[AutoUpload] Melanjutkan ke pengisian ${persetujuanList.length} Pihak Persetujuan untuk PT: '${ptName}'...`);

            for (let i = 0; i < persetujuanList.length; i++) {
                const person = persetujuanList[i];
                console.log(`[AutoUpload] === Memproses Pihak Persetujuan [${i + 1}/${persetujuanList.length}]: '${person.nama}' ===`);

                const personRes = {
                    person: person.nama,
                    filename: null,
                    success: false,
                    error: null,
                };

                // Pastikan modal dari proses sebelumnya ditutup sempurna
                if (isModalOpen()) {
                    await dismissModalAndEnsureClosed();
                }
                forceCleanupModalDom();
                await dom.delay(300);

                // Cek apakah personil ini sudah ada di daftar pihak persetujuan web ATR/BPN
                const alreadyInDaftar = isPersonInDaftar(person.nama, person.nik);
                let btnUnggahPerson = null;

                if (alreadyInDaftar) {
                    console.log(`[AutoUpload] Pihak Persetujuan '${person.nama}' sudah ada di daftar web ATR/BPN. Melewati pengisian form...`);
                    btnUnggahPerson = await waitForPersetujuanRow(person.nama, 0, 3000);
                } else {
                    // Catat jumlah tombol sebelum submit baris baru
                    const prevCount = document.querySelectorAll(config.SELECTORS.persetujuan.btnUnggah).length;

                    // Pastikan form persetujuan siap
                    await PPAT.persetujuanFiller.ensurePersetujuanForm();

                    // Isi data & klik Tambah (dengan verifikasi ketat NIK, Nama, Tempat Lahir, Tgl Lahir)
                    const fillOk = await PPAT.persetujuanFiller.fill(person, {
                        autoSubmit: true,
                        autoUploadDocs: false,
                    });

                    if (!fillOk) {
                        personRes.error = `Gagal mengisi atau memverifikasi form data Pihak Persetujuan '${person.nama}'.`;
                        persetujuanResults.push(personRes);
                        console.warn(`[AutoUpload] Melewati upload KTP untuk '${person.nama}' karena form gagal.`);
                        continue;
                    }

                    // Tunggu hingga baris baru untuk personil ini muncul di tabel
                    console.log(`[AutoUpload] Menunggu baris baru '${person.nama}' muncul di daftar pihak persetujuan...`);
                    btnUnggahPerson = await waitForPersetujuanRow(person.nama, prevCount, 12000);
                }

                if (!btnUnggahPerson) {
                    personRes.error = `Tombol Unggah untuk '${person.nama}' tidak ditemukan di daftar pihak persetujuan.`;
                    persetujuanResults.push(personRes);
                    console.warn(`[AutoUpload] ${personRes.error}`);
                    continue;
                }

                // Upload berkas KTP untuk personil ini
                await dom.delay(200);
                const docPromise = ktpPromises[person.nama] || downloadDocument(ptName, "ktp", person.nama);
                console.log(`[AutoUpload] Mengunggah berkas KTP untuk Pihak Persetujuan: '${person.nama}'...`);

                const resKtp = await executeUploadStep(
                    ptName,
                    "ktp",
                    "KTP.pdf",
                    null,
                    docPromise,
                    btnUnggahPerson
                );

                if (resKtp.success) {
                    personRes.success = true;
                    personRes.filename = resKtp.filename || "KTP.pdf";
                    console.log(`[AutoUpload] Berhasil mengunggah KTP '${person.nama}': ${personRes.filename}`);
                } else {
                    personRes.error = resKtp.error;
                    console.warn(`[AutoUpload] Gagal mengunggah KTP '${person.nama}':`, resKtp.error);
                }

                persetujuanResults.push(personRes);

                // Jika masih ada pihak persetujuan berikutnya, pastikan modal tertutup dan beri jeda transisi
                if (i < persetujuanList.length - 1) {
                    await dismissModalAndEnsureClosed();
                    forceCleanupModalDom();
                    await dom.delay(400);
                }
            }
        } else if (!persetujuanList || persetujuanList.length === 0) {
            persetujuanResults.push({
                person: "Pihak Persetujuan",
                filename: null,
                success: false,
                error: `Data pihak persetujuan untuk '${ptName}' belum terdaftar di database.`,
            });
        }

        results.persetujuan = persetujuanResults;

        // 5. Tahap 4: Tampilkan notifikasi rekapitulasi akhir
        notifyUploadResults(results, folderName);
    }

    /**
     * Menampilkan notifikasi popup / alert mengenai status upload berkas lengkap (Penjual & Persetujuan).
     */
    function notifyUploadResults(results, folderName) {
        const aktaOk = results.akta.success;
        const npwpOk = results.npwp.success;
        const persetujuanList = Array.isArray(results.persetujuan)
            ? results.persetujuan
            : (results.persetujuan ? [results.persetujuan] : []);

        const allPersetujuanOk = persetujuanList.length > 0 && persetujuanList.every((p) => p.success);

        if (aktaOk && npwpOk && allPersetujuanOk) {
            let successMsg = `✅ Data masuk semua! Berkas penjual & seluruh pihak persetujuan (${folderName}) berhasil diunggah:\n\n`;
            successMsg += `1. Akta Pendirian: ${results.akta.filename} (Berhasil)\n`;
            successMsg += `2. NPWP Penjual: ${results.npwp.filename} (Berhasil)\n`;
            successMsg += `3. Pihak Persetujuan (${persetujuanList.length} orang):\n`;
            persetujuanList.forEach((p, idx) => {
                successMsg += `   - ${p.person}: ${p.filename || "KTP.pdf"} (Berhasil)\n`;
            });
            alert(successMsg);
            console.log(successMsg);
        } else {
            let msg = `⚠️ Status Otomatisasi Penjual & Persetujuan (${folderName}):\n\n`;

            if (aktaOk) {
                msg += `✔ Akta Pendirian (${results.akta.filename}): BERHASIL\n`;
            } else {
                msg += `❌ Akta Pendirian: GAGAL (${results.akta.error || "Tidak diketahui"})\n`;
            }

            if (npwpOk) {
                msg += `✔ NPWP Penjual (${results.npwp.filename}): BERHASIL\n`;
            } else {
                msg += `❌ NPWP Penjual: GAGAL (${results.npwp.error || "Tidak diketahui"})\n`;
            }

            if (persetujuanList.length > 0) {
                msg += `\nPihak Persetujuan:\n`;
                persetujuanList.forEach((p, idx) => {
                    if (p.success) {
                        msg += `✔ - ${p.person} (${p.filename || "KTP.pdf"}): BERHASIL\n`;
                    } else {
                        msg += `❌ - ${p.person || "Persetujuan"}: GAGAL (${p.error || "Tidak diketahui"})\n`;
                    }
                });
            } else {
                msg += `❌ Pihak Persetujuan: Belum ada data pihak persetujuan.\n`;
            }

            alert(msg);
            console.warn(msg);
        }
    }

    /**
     * Menjalankan otomatisasi upload dokumen KK dan KTP untuk Penjual Perorangan.
     * Mengunduh berkas KK dan KTP dari folder G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli]
     * dan mengunggahnya secara sekuensial ke baris Penjual (Pihak 1) di website ATR/BPN.
     *
     * @param {string} [sellerNameInput] Nama penjual
     * @param {string} [buyerNameInput] Nama pembeli (folder target)
     */
    async function runAutoUploadPerorangan(sellerNameInput, buyerNameInput) {
        if (isUploadingPerorangan) {
            console.warn("[AutoUploadPenjualPerorangan] Upload sedang berlangsung. Abaikan panggilan ganda.");
            return { success: false, error: "Upload sedang berlangsung" };
        }

        const sellerName = (
            sellerNameInput ||
            (PPAT.activePenjualPerorangan && PPAT.activePenjualPerorangan.nama) ||
            getActiveSellerNameFromPage() ||
            "Penjual Perorangan"
        ).trim();

        // 1. Dapatkan nama pembeli untuk folder target Pihak Kedua\[nama pembeli]
        let buyerName = resolveBuyerName(buyerNameInput);

        // Jika belum tersedia seketika, beri jeda singkat untuk memastikan data AJB selesai diset
        if (!buyerName) {
            console.log("[AutoUploadPenjualPerorangan] Menunggu deteksi nama pembeli...");
            for (let i = 0; i < 8; i++) {
                await dom.delay(250);
                buyerName = resolveBuyerName();
                if (buyerName) break;
            }
        }

        if (!buyerName) {
            const promptName = prompt(
                "Nama pembeli belum terdeteksi otomatis.\nMasukkan nama pembeli untuk mencari folder di:\nG:\\My Drive\\notaris bu sri\\Pihak Kedua\\[nama pembeli]:"
            );
            if (promptName && promptName.trim()) {
                buyerName = promptName.trim();
                if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.saveActiveBuyerName === "function") {
                    PPAT.pembeliUploadFiller.saveActiveBuyerName(buyerName);
                }
            } else {
                alert("Upload dibatalkan: Nama pembeli diperlukan untuk menentukan lokasi folder KK dan KTP di Pihak Kedua.");
                return { success: false, error: "Nama pembeli tidak ditentukan" };
            }
        }

        isUploadingPerorangan = true;
        console.log(`[AutoUploadPenjualPerorangan] Memulai otomatisasi upload KK & KTP Penjual (${sellerName}) dari folder Pihak Kedua: '${buyerName}'...`);

        try {
            // 2. Cek ketersediaan file KK dan KTP di folder pembeli via backend port 3001
            let info;
            try {
                info = await fetchBuyerInfo(buyerName);
            } catch (err) {
                console.error("[AutoUploadPenjualPerorangan] Gagal menghubungi service backend:", err);
                alert(
                    `Gagal menghubungi service backend di http://127.0.0.1:3001.\n` +
                    `Pastikan backend sudah aktif (jalankan start-backend.bat).\n\n` +
                    `Detail: ${err.message}`
                );
                return { success: false, error: err.message };
            }

            if (!info || !info.success) {
                const errMsg = (info && info.error) || `Folder untuk pembeli '${buyerName}' tidak ditemukan di folder Pihak Kedua.`;
                alert(`⚠️ ${errMsg}\n\nPeriksa folder di:\nG:\\My Drive\\notaris bu sri\\Pihak Kedua\\${buyerName}`);
                return { success: false, error: errMsg };
            }

            const pembeliData = info.data || info;
            const folderName = pembeliData.folder_name || pembeliData.folder || info.folder || buyerName;

            const kkObj = pembeliData.kk_penjual || (info.files && info.files.kk_penjual) || pembeliData.kk || (info.files && info.files.kk) || {};
            const ktpObj = pembeliData.ktp_penjual || (info.files && info.files.ktp_penjual) || pembeliData.ktp || (info.files && info.files.ktp) || {};

            const kkFound = typeof kkObj === "object" ? Boolean(kkObj.found) : Boolean(kkObj);
            const ktpFound = typeof ktpObj === "object" ? Boolean(ktpObj.found) : Boolean(ktpObj);

            const kkFilename = (typeof kkObj === "object" ? kkObj.filename : kkObj) || "KK PENJUAL.pdf";
            const ktpFilename = (typeof ktpObj === "object" ? ktpObj.filename : ktpObj) || "KTP PENJUAL.pdf";

            console.log(`[AutoUploadPenjualPerorangan] Folder Pihak Kedua terkonfirmasi: '${folderName}'. KK: ${kkFilename} (found: ${kkFound}), KTP: ${ktpFilename} (found: ${ktpFound})`);

            if (!kkFound && !ktpFound) {
                alert(
                    `⚠️ Berkas KK dan KTP tidak ditemukan di dalam folder:\n` +
                    `G:\\My Drive\\notaris bu sri\\Pihak Kedua\\${folderName}\n\n` +
                    `Pastikan berkas KK dan KTP tersedia.`
                );
                return { success: false, error: "Berkas KK dan KTP tidak ditemukan" };
            }

            // 3. Pre-load download berkas KK & KTP secara paralel di latar belakang
            console.log(`[AutoUploadPenjualPerorangan] Mengunduh KK & KTP secara paralel di latar belakang...`);
            const kkPromise = kkFound
                ? downloadBuyerDocument(buyerName, "kk_penjual")
                : Promise.resolve(null);
            const ktpPromise = ktpFound
                ? downloadBuyerDocument(buyerName, "ktp_penjual")
                : Promise.resolve(null);

            const results = {
                seller: sellerName,
                buyer: buyerName,
                folder: folderName,
                kk: { filename: kkFilename, success: false, error: null },
                ktp: { filename: ktpFilename, success: false, error: null },
            };

            // 4. Cari tombol Unggah untuk baris Penjual di #daftarpihak1placeholder
            let btnUnggah = await waitForPenjualRow(sellerName, 8000);
            if (!btnUnggah) {
                alert(`Tombol 'Unggah' untuk pihak penjual '${sellerName}' tidak ditemukan di daftar pihak 1.`);
                return { success: false, error: "Tombol Unggah pihak 1 tidak ditemukan" };
            }

            // 5. Langkah 1: Upload Kartu Keluarga Penjual (KK -> KKPENJUAL)
            if (kkFound) {
                console.log(`[AutoUploadPenjualPerorangan] [1/2] Mengunggah Kartu Keluarga (KK) Penjual...`);
                const resKk = await executeUploadStep(
                    sellerName,
                    "kk",
                    kkFilename,
                    "KKPENJUAL",
                    kkPromise,
                    btnUnggah
                );
                if (resKk.success) {
                    results.kk.success = true;
                    results.kk.filename = resKk.filename || kkFilename;
                    console.log(`[AutoUploadPenjualPerorangan] ✔ KK Penjual berhasil diunggah: ${results.kk.filename}`);
                } else {
                    results.kk.error = resKk.error;
                    console.warn(`[AutoUploadPenjualPerorangan] Gagal mengunggah KK Penjual:`, resKk.error);
                }

                await dismissModalAndEnsureClosed();
                forceCleanupModalDom();
                await dom.delay(400);
            } else {
                results.kk.error = `Berkas KK tidak ditemukan di dalam folder '${folderName}'.`;
            }

            // 6. Langkah 2: Upload KTP Penjual (KTP -> KTPPENJUAL)
            if (ktpFound) {
                console.log(`[AutoUploadPenjualPerorangan] [2/2] Mengunggah KTP Penjual...`);
                btnUnggah = (await waitForPenjualRow(sellerName, 5000)) || btnUnggah;
                const resKtp = await executeUploadStep(
                    sellerName,
                    "ktp",
                    ktpFilename,
                    "KTPPENJUAL",
                    ktpPromise,
                    btnUnggah
                );
                if (resKtp.success) {
                    results.ktp.success = true;
                    results.ktp.filename = resKtp.filename || ktpFilename;
                    console.log(`[AutoUploadPenjualPerorangan] ✔ KTP Penjual berhasil diunggah: ${results.ktp.filename}`);
                } else {
                    results.ktp.error = resKtp.error;
                    console.warn(`[AutoUploadPenjualPerorangan] Gagal mengunggah KTP Penjual:`, resKtp.error);
                }

                await dismissModalAndEnsureClosed();
                forceCleanupModalDom();
                await dom.delay(350);
            } else {
                results.ktp.error = `Berkas KTP tidak ditemukan di dalam folder '${folderName}'.`;
            }

            // 7. Langkah 3: Upload KTP Pihak Persetujuan (jika ada persetujuan atau berkas KTP PERSETUJUAN / KTP PENJUAL)
            const personName = (PPAT.activePersetujuanPerorangan && PPAT.activePersetujuanPerorangan.nama) || "";
            const hasPersetujuanInWeb = Boolean(document.querySelector(config.SELECTORS.persetujuan.btnUnggah));
            const ktpPersetujuanFound = pembeliData.ktp_persetujuan && (typeof pembeliData.ktp_persetujuan === "object" ? pembeliData.ktp_persetujuan.found : Boolean(pembeliData.ktp_persetujuan));
            const hasPersetujuanTarget = Boolean(personName || hasPersetujuanInWeb || ktpPersetujuanFound);

            if (hasPersetujuanTarget) {
                console.log(`[AutoUploadPenjualPerorangan] [3/3] Memeriksa dan mengunggah KTP Pihak Persetujuan (${personName || "Persetujuan"})...`);

                // Pastikan pihak persetujuan sudah masuk di daftar web jika ada data personilnya
                if (personName && !isPersonInDaftar(personName, PPAT.activePersetujuanPerorangan && PPAT.activePersetujuanPerorangan.nik) && PPAT.persetujuanFiller) {
                    console.log(`[AutoUploadPenjualPerorangan] Mengisi form Pihak Persetujuan '${personName}' terlebih dahulu...`);
                    await PPAT.persetujuanFiller.ensurePersetujuanForm();
                    await PPAT.persetujuanFiller.fill(PPAT.activePersetujuanPerorangan, { autoSubmit: true });
                    await dom.delay(600);
                }

                const resPersetujuan = await uploadPersetujuanPerorangan(personName, buyerName, { isPerorangan: true });
                if (resPersetujuan) {
                    results.persetujuan = {
                        person: personName || "Pihak Persetujuan",
                        filename: resPersetujuan.filename || (resPersetujuan.isFallback ? ktpFilename : "KTP PERSETUJUAN.pdf"),
                        success: resPersetujuan.success,
                        error: resPersetujuan.error,
                        isFallback: resPersetujuan.isFallback || false,
                    };
                }
            }

            // 8. Notifikasi status hasil akhir
            notifyPeroranganUploadResults(results);
            return results;
        } catch (err) {
            console.error("[AutoUploadPenjualPerorangan] Error fatal dalam alur upload:", err);
            alert(`Terjadi kesalahan pada otomatisasi upload berkas penjual perorangan:\n${err.message || err}`);
            return { success: false, error: err.message || String(err) };
        } finally {
            isUploadingPerorangan = false;
        }
    }

    /**
     * Mengunggah berkas KTP Pihak Persetujuan untuk Penjual Perorangan.
     * Lokasi default: G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli]\KTP PERSETUJUAN.pdf
     *
     * Pengkondisian:
     * Ketika tipe penjual adalah perorangan, jika di dalam folder yang dituju
     * tidak terdapat KTP PERSETUJUAN padahal penjual adalah perorangan,
     * maka file yang diupload untuk pihak persetujuan adalah file yang memiliki nama KTP PENJUAL.
     *
     * @param {string} [personNameInput] Nama pihak persetujuan
     * @param {string} [buyerNameInput] Nama pembeli (folder tujuan di Pihak Kedua)
     * @param {object} [options] Opsi tambahan
     */
    async function uploadPersetujuanPerorangan(personNameInput, buyerNameInput, options = {}) {
        const personName = (
            personNameInput ||
            (PPAT.activePersetujuanPerorangan && PPAT.activePersetujuanPerorangan.nama) ||
            ""
        ).trim();

        const buyerName = resolveBuyerName(buyerNameInput);
        if (!buyerName) {
            console.warn("[UploadPersetujuan] Nama pembeli tidak ditemukan.");
            return { success: false, error: "Nama pembeli tidak ditemukan" };
        }

        const isPerorangan = options.isPerorangan !== undefined
            ? options.isPerorangan
            : isTipePenjualPerorangan();

        console.log(`[UploadPersetujuan] Memulai upload KTP Persetujuan '${personName || "-"}' dari folder Pihak Kedua '${buyerName}' (tipe penjual: ${isPerorangan ? "Perorangan" : "Non-Perorangan"})...`);

        // 1. Cek info file di backend
        let info;
        try {
            info = await fetchBuyerInfo(buyerName);
        } catch (err) {
            console.error("[UploadPersetujuan] Gagal menghubungi backend:", err);
            return { success: false, error: err.message };
        }

        const pembeliData = info.data || info;
        const folderName = pembeliData.folder_name || pembeliData.folder || info.folder || buyerName;
        const ktpPersetujuanObj = pembeliData.ktp_persetujuan || (info.files && info.files.ktp_persetujuan);

        const ktpPersetujuanFound = typeof ktpPersetujuanObj === "object" && ktpPersetujuanObj !== null
            ? Boolean(ktpPersetujuanObj.found && ktpPersetujuanObj.filename)
            : Boolean(ktpPersetujuanObj);

        let docTypeToDownload = "ktp_persetujuan";
        let filename = "KTP PERSETUJUAN.pdf";
        let isFallback = false;

        if (ktpPersetujuanFound) {
            if (typeof ktpPersetujuanObj === "object" && ktpPersetujuanObj !== null && ktpPersetujuanObj.filename) {
                filename = ktpPersetujuanObj.filename;
            } else if (typeof ktpPersetujuanObj === "string" && ktpPersetujuanObj) {
                filename = ktpPersetujuanObj;
            }
            docTypeToDownload = "ktp_persetujuan";
            console.log(`[UploadPersetujuan] Berkas 'KTP PERSETUJUAN' ditemukan di folder '${folderName}': '${filename}'`);
        } else if (isPerorangan) {
            // PENGKONDISIAN UTAMA:
            // Ketika tipe penjual adalah perorangan, jika di dalam folder yang dituju tidak terdapat KTP PERSETUJUAN
            // padahal penjual adalah perorangan, maka file yang diupload untuk pihak persetujuan adalah file yang memiliki nama KTP PENJUAL.
            isFallback = true;
            docTypeToDownload = "ktp_penjual";

            const ktpPenjualObj = pembeliData.ktp_penjual || (info.files && info.files.ktp_penjual);
            let penjualFilename = null;
            if (typeof ktpPenjualObj === "object" && ktpPenjualObj !== null && ktpPenjualObj.filename) {
                penjualFilename = ktpPenjualObj.filename;
            } else if (typeof ktpPenjualObj === "string" && ktpPenjualObj) {
                penjualFilename = ktpPenjualObj;
            }

            filename = penjualFilename || "KTP PENJUAL.pdf";
            console.log(
                `[UploadPersetujuan] ℹ Pengkondisian aktif: Berkas 'KTP PERSETUJUAN' tidak ada di folder '${folderName}', penjual bertipe perorangan.\n` +
                `[UploadPersetujuan] ➔ Berkas yang diunggah untuk Pihak Persetujuan dialihkan ke: '${filename}' (KTP PENJUAL).`
            );
        } else {
            console.warn(`[UploadPersetujuan] Berkas 'KTP PERSETUJUAN' tidak ditemukan di folder '${folderName}'.`);
        }

        // 2. Download berkas dokumen target (KTP Persetujuan atau fallback ke KTP Penjual)
        console.log(`[UploadPersetujuan] Mengunduh berkas '${filename}' (${docTypeToDownload}) dari folder '${folderName}'...`);
        let docPromise;
        try {
            docPromise = downloadBuyerDocument(buyerName, docTypeToDownload);
        } catch (err) {
            console.warn(`[UploadPersetujuan] Gagal download berkas ${docTypeToDownload}:`, err);
            return { success: false, error: err.message, isFallback };
        }

        // 3. Cari tombol Unggah untuk baris Pihak Persetujuan di #daftarpemohonpihaksetujuplaceholder
        const btnUnggah = await waitForPersetujuanRow(personName, 0, 10000);
        if (!btnUnggah) {
            const errMsg = `Tombol Unggah untuk Pihak Persetujuan '${personName || "-"}' tidak ditemukan di daftar pihak persetujuan.`;
            console.warn(`[UploadPersetujuan] ${errMsg}`);
            return { success: false, error: errMsg, isFallback };
        }

        // 4. Eksekusi upload step
        const res = await executeUploadStep(
            personName || "Persetujuan",
            "ktp",
            filename,
            null,
            docPromise,
            btnUnggah
        );

        if (res.success) {
            res.isFallback = isFallback;
            const note = isFallback ? " (menggunakan file KTP PENJUAL)" : "";
            console.log(`[UploadPersetujuan] ✔ Berkas untuk Pihak Persetujuan '${personName || "-"}' berhasil diunggah: ${res.filename}${note}`);
            await dismissModalAndEnsureClosed();
            forceCleanupModalDom();
        } else {
            res.isFallback = isFallback;
            console.warn(`[UploadPersetujuan] Gagal upload berkas untuk Pihak Persetujuan '${personName || "-"}':`, res.error);
        }

        return res;
    }

    /**
     * Menampilkan notifikasi popup / alert mengenai status upload berkas Penjual Perorangan.
     */
    function notifyPeroranganUploadResults(results) {
        const kkOk = Boolean(results.kk && results.kk.success);
        const ktpOk = Boolean(results.ktp && results.ktp.success);
        const persetujuanOk = results.persetujuan ? Boolean(results.persetujuan.success) : true;
        const kkFilename = (results.kk && results.kk.filename) || "KK.pdf";
        const ktpFilename = (results.ktp && results.ktp.filename) || "KTP.pdf";

        if (kkOk && ktpOk && persetujuanOk) {
            let msg = `✅ Berkas Penjual Perorangan (${results.seller}) dari folder Pihak Kedua (${results.folder}) berhasil diunggah ke website ATR/BPN:\n\n` +
                      `1. Kartu Keluarga (KK): ${kkFilename} (Berhasil)\n` +
                      `2. KTP Penjual: ${ktpFilename} (Berhasil)\n`;
            if (results.persetujuan) {
                const note = results.persetujuan.isFallback ? " [menggunakan KTP Penjual]" : "";
                msg += `3. KTP Persetujuan (${results.persetujuan.person}): ${results.persetujuan.filename || "KTP PERSETUJUAN.pdf"}${note} (Berhasil)\n`;
            }
            alert(msg);
            console.log(msg);
        } else {
            let msg = `⚠️ Status Upload Berkas Penjual Perorangan (${results.seller}):\n\n`;
            msg += kkOk ? `✔ Kartu Keluarga: ${kkFilename} (BERHASIL)\n` : `❌ Kartu Keluarga: GAGAL (${(results.kk && results.kk.error) || "Gagal"})\n`;
            msg += ktpOk ? `✔ KTP Penjual: ${ktpFilename} (BERHASIL)\n` : `❌ KTP Penjual: GAGAL (${(results.ktp && results.ktp.error) || "Gagal"})\n`;
            if (results.persetujuan) {
                const note = results.persetujuan.isFallback ? " [KTP Penjual]" : "";
                msg += results.persetujuan.success
                    ? `✔ KTP Persetujuan (${results.persetujuan.person}): ${results.persetujuan.filename || "KTP PERSETUJUAN.pdf"}${note} (BERHASIL)\n`
                    : `❌ KTP Persetujuan (${results.persetujuan.person}): GAGAL (${results.persetujuan.error || "Gagal"})\n`;
            }
            alert(msg);
            console.warn(msg);
        }
    }

    /**
     * Memantau aksi pengguna saat menekan tombol Tambah Penjual Perorangan (#btn-tambahtipepihak1NIK)
     * untuk otomatis memicu alur upload KK & KTP saat baris masuk di daftar pihak 1.
     */
    function initPenjualWatcher() {
        if (watcherInitialized) return;
        watcherInitialized = true;
        console.log("[AutoUploadPenjual] Watcher submit form penjual perorangan diaktifkan.");

        document.addEventListener("click", async (e) => {
            const target = e.target;
            const btnTambah = target.closest(SELECTORS.penjualPerorangan.btnTambah) ||
                              (target.id === "btn-tambahtipepihak1NIK" ? target : null);
            if (!btnTambah) return;

            // Beri jeda 800ms agar jika dipicu oleh fillPerorangan, alur fillPerorangan yang mengeksekusi
            await dom.delay(800);
            if (isUploadingPerorangan) return;

            const nameInput = document.querySelector("#frmtipepihak1Dukcapil #tNAMA_LENGKAP");
            const submittedName = (
                (nameInput ? nameInput.value : "") ||
                (PPAT.activePenjualPerorangan && PPAT.activePenjualPerorangan.nama) ||
                ""
            ).trim();

            console.log(`[AutoUploadPenjual] Tombol 'Tambah' penjual perorangan diklik. Nama target: '${submittedName}'. Menunggu baris masuk di daftar...`);

            const rowBtn = await waitForPenjualRow(submittedName, 15000);
            if (rowBtn) {
                if (isUploadingPerorangan) return;
                console.log(`[AutoUploadPenjual] Baris penjual '${submittedName}' terkonfirmasi di daftar! Memulai upload otomatis KK & KTP...`);
                await dom.delay(300);
                await runAutoUploadPerorangan(submittedName);
            } else {
                console.warn(`[AutoUploadPenjual] Baris penjual '${submittedName}' tidak muncul dalam batas waktu.`);
            }
        }, true);
    }

    return {
        runAutoUpload,
        runAutoUploadPerorangan,
        uploadPersetujuanPerorangan,
        isTipePenjualPerorangan,
        initPenjualWatcher,
        getActivePtNameFromPage,
        getActiveSellerNameFromPage,
        resolveBuyerName,
        fetchPtInfo,
        fetchBuyerInfo,
        downloadDocument,
        downloadBuyerDocument,
        waitForGlobalModal,
        dismissModalAndEnsureClosed,
        forceCleanupModalDom,
        waitForSidebarReady,
        waitForPenjualRow,
        waitForPersetujuanRow,
    };
})();
