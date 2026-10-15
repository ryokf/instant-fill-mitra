/**
 * Otomatisasi Upload Dokumen Penjual (Akta Pendirian & NPWP).
 * Mengunduh file dari folder lokal via service backend (Port 3001)
 * lalu mengunggahnya secara sekuensial ke website ATR/BPN.
 */
PPAT.penjualUploadFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING } = config;
    const S = SELECTORS.penjualUpload;

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
     * Mengambil info folder dan file PT dari service backend.
     */
    async function fetchPtInfo(ptName) {
        const url = `${config.PT_FILE_INFO_URL}?pt_name=${encodeURIComponent(ptName)}`;
        const resp = await fetch(url);
        return await resp.json();
    }

    /**
     * Mengunduh berkas dokumen dari backend port 3001.
     */
    async function downloadDocument(ptName, docType) {
        const url = `${config.PT_FILE_DOWNLOAD_URL}?pt_name=${encodeURIComponent(ptName)}&doc_type=${encodeURIComponent(docType)}`;
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
        let filename = fileNameHeader || (docType === "akta" ? "AKTA PENDIRIAN.pdf" : "NPWP.pdf");

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

    const dismissGlobalModal = dismissModalAndEnsureClosed;

    /**
     * Mengirimkan file ke Page Bridge (Main World) untuk diset ke window.dfupload2
     * dan memicu fungsi simpandokumenupload2().
     */
    function sendUploadToMainWorld(base64, filename, tipeValue) {
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
            };

            window.postMessage(payload, "*");
        });
    }

    /**
     * Menjalankan satu tahap upload (Akta Pendirian atau NPWP):
     * 1. Gunakan berkas yang sudah/sedang diunduh dari backend secara paralel
     * 2. Klik tombol "Unggah" di baris Penjual seketika
     * 3. Tunggu sidebar upload siap
     * 4. Pilih opsi jenis dokumen yang sesuai pada dropdown
     * 5. Suntikkan berkas via Main World Page Bridge
     * 6. Klik Simpan
     * 7. Tunggu respon modal "Data telah diunggah" lalu klik OK
     */
    async function executeUploadStep(ptName, docType, filename, preferredOptionValue, preloadedDocPromise) {
        try {
            // 0. SEBELUM MULAI: Pastikan modal apapun yang ada sudah ditutup dengan menekan tombol OK
            if (isModalOpen()) {
                console.log("[AutoUpload] Ditemukan modal sebelum proses upload, menekan OK terlebih dahulu...");
                await dismissModalAndEnsureClosed();
            }

            // Gunakan promise download yang sedang/sudah berjalan di background
            const docPromise = preloadedDocPromise || downloadDocument(ptName, docType);

            // Cari tombol Unggah pada daftar Penjual
            console.log(`[AutoUpload] Mencari tombol Unggah pada daftar Penjual untuk ${docType}...`);
            const btnUnggah = document.querySelector(S.btnUnggah) || (await dom.waitForElement(S.btnUnggah, 3000));
            if (!btnUnggah) {
                return {
                    success: false,
                    error: "Tombol Unggah di daftar pihak penjual (#daftarpihak1placeholder) tidak ditemukan.",
                };
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

            // Tentukan value opsi yang cocok pada dropdown
            let selectedValue = null;
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if (preferredOptionValue && opt.value === preferredOptionValue) {
                    selectedValue = opt.value;
                    break;
                }
                const optTextUpper = opt.text.toUpperCase();
                const optValUpper = opt.value.toUpperCase();

                if (docType === "akta" && (optValUpper.includes("AKTA") || optTextUpper.includes("AKTA"))) {
                    selectedValue = opt.value;
                    break;
                }
                if (docType === "npwp" && (optValUpper.includes("NPWP") || optTextUpper.includes("NPWP"))) {
                    selectedValue = opt.value;
                    break;
                }
            }

            if (!selectedValue && select.options.length > 0) {
                selectedValue = select.options[0].value;
            }

            await dom.delay(50);

            // Suntikkan file ke elemen input dan window.dfupload2 via Page Bridge (Main World)
            console.log(`[AutoUpload] Mengirim berkas '${filename}' ke Page Bridge (Main World)...`);
            const bridgeRes = await sendUploadToMainWorld(base64, filename, selectedValue);
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
                return { success: true };
            } else {
                return { success: false, error: modalMsg };
            }
        } catch (err) {
            if (isModalOpen()) {
                await dismissModalAndEnsureClosed();
            }
            return { success: false, error: err.message || String(err) };
        }
    }

    /**
     * Alur lengkap upload berkas otomatis untuk PT:
     * 1. Akta Pendirian
     * 2. NPWP
     * 3. Menampilkan notifikasi akhir
     */
    async function runAutoUpload(ptNameInput) {
        const ptName = ptNameInput || getActivePtNameFromPage();
        if (!ptName) {
            alert("Nama PT tidak terdeteksi di halaman web maupun panel. Silakan pilih atau isi data PT terlebih dahulu.");
            return;
        }

        console.log(`[AutoUpload] Memulai proses upload otomatis untuk PT: '${ptName}'`);

        // 1. Cek informasi folder dan file di backend
        let ptInfo;
        try {
            const res = await fetchPtInfo(ptName);
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
        };

        // Mulai download berkas akta dan npwp secara paralel di latar belakang agar waktu tunggu 0ms
        console.log("[AutoUpload] Memulai download berkas Akta dan NPWP secara paralel di latar belakang...");
        const aktaPromise = (ptInfo.akta.found && ptInfo.akta.filename)
            ? downloadDocument(ptName, "akta")
            : Promise.resolve(null);
        const npwpPromise = (ptInfo.npwp.found && ptInfo.npwp.filename)
            ? downloadDocument(ptName, "npwp")
            : Promise.resolve(null);

        // 2. Tahap 1: Upload Akta Pendirian
        if (!ptInfo.akta.found || !ptInfo.akta.filename) {
            results.akta.error = `Berkas AKTA PENDIRIAN tidak ditemukan di dalam folder '${folderName}'.`;
        } else {
            const resAkta = await executeUploadStep(ptName, "akta", ptInfo.akta.filename, "AKTAPPENJUAL", aktaPromise);
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
            const resNpwp = await executeUploadStep(ptName, "npwp", ptInfo.npwp.filename, "NPWPPENJUAL", npwpPromise);
            if (resNpwp.success) {
                results.npwp.success = true;
            } else {
                results.npwp.error = resNpwp.error;
            }
        }

        // 4. Tahap 3: Notifikasi hasil akhir
        notifyUploadResults(results, folderName);
    }

    /**
     * Menampilkan notifikasi popup / alert mengenai status upload berkas.
     */
    function notifyUploadResults(results, folderName) {
        const aktaOk = results.akta.success;
        const npwpOk = results.npwp.success;

        if (aktaOk && npwpOk) {
            const successMsg =
                `✅ Data masuk semua! Berkas penjual (${folderName}) berhasil diunggah:\n\n` +
                `1. Akta Pendirian: ${results.akta.filename} (Berhasil)\n` +
                `2. NPWP Penjual: ${results.npwp.filename} (Berhasil)`;
            alert(successMsg);
            console.log(successMsg);
        } else {
            let errorMsg = `⚠️ Status Upload Berkas Penjual (${folderName}):\n\n`;

            if (aktaOk) {
                errorMsg += `✔ Akta Pendirian (${results.akta.filename}): BERHASIL\n`;
            } else {
                errorMsg += `❌ Akta Pendirian: GAGAL (${results.akta.error || "Tidak diketahui"})\n`;
            }

            if (npwpOk) {
                errorMsg += `✔ NPWP Penjual (${results.npwp.filename}): BERHASIL\n`;
            } else {
                errorMsg += `❌ NPWP Penjual: GAGAL (${results.npwp.error || "Tidak diketahui"})\n`;
            }

            alert(errorMsg);
            console.warn(errorMsg);
        }
    }

    return {
        runAutoUpload,
        getActivePtNameFromPage,
        fetchPtInfo,
        downloadDocument,
    };
})();
