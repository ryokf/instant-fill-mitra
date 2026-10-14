/**
 * Pengisian otomatis & alur otomasi Sertipikat:
 * 1. Pada halaman Berkas (https://ppat.atrbpn.go.id/intan/Berkas):
 *    - Mengisi kolom nomor berkas & tahun berkas.
 *    - Otomatis klik tombol "Cari Berkas" (#btncari).
 *    - Menunggu 1 baris hasil di tabel (#berkassayaplaceholder tr), lalu klik baris tersebut.
 *    - Di view/halaman berkas yang terbuka (tab MELENGKAPI / #tabproses2):
 *      1. Mendownload dokumen PDF yang ditampilkan di viewer (#docViewerProduct / GetFileDokumen).
 *      2. Mengklik tombol Step 1 pada wizard (step 1 sampai 5) hingga kolom
 *         NIB Elektronik (#DataSertipikat_inputsertipikat_nibelektronik) dan
 *         Kode Sertifikat (#DataSertipikat_inputsertipikat_kodesertipikat) muncul.
 *      3. Menyimpan nilai kedua kolom tersebut ke chrome.storage.local / localStorage.
 * 2. Pada halaman AJB (https://ppat.atrbpn.go.id/akta/Peralihan/AJB):
 *    - Mengisi otomatis Section H (Input Sertipikat) dengan mode Elektronik,
 *      memasukkan NIB Elektronik dan Kode Sertifikat, lalu klik tombol "Cek" / Tambah.
 */
PPAT.sertipikatFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S_BERKAS = SELECTORS.berkas;
    const S_SERTIPIKAT = SELECTORS.sertipikat;

    const STORAGE_KEY = "ppat_sertipikat_data";
    const PENDING_KEY = "ppat_berkas_pending_flow";

    // -------------------------------------------------------------------------
    // Helper Penyimpanan Data (Chrome Storage + LocalStorage Fallback)
    // -------------------------------------------------------------------------

    async function saveSertipikat(data) {
        if (!data) return;
        const payload = {
            ...data,
            saved_at: Date.now(),
        };

        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                await new Promise((resolve) => {
                    chrome.storage.local.set({ [STORAGE_KEY]: payload }, resolve);
                });
            } catch (err) {
                console.warn("AutoFill PPAT: Gagal simpan ke chrome.storage.local:", err);
            }
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
            console.warn("AutoFill PPAT: Gagal simpan ke localStorage:", err);
        }

        return payload;
    }

    async function getSavedSertipikat() {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const res = await new Promise((resolve) => {
                    chrome.storage.local.get([STORAGE_KEY], resolve);
                });
                if (res && res[STORAGE_KEY]) {
                    return res[STORAGE_KEY];
                }
            } catch (err) {
                console.warn("AutoFill PPAT: Gagal baca dari chrome.storage.local:", err);
            }
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (err) {
            console.warn("AutoFill PPAT: Gagal baca dari localStorage:", err);
        }

        return null;
    }

    async function setPendingFlow(data) {
        const payload = {
            active: true,
            nomor_berkas: data.nomor_berkas,
            tahun_berkas: data.tahun_berkas || "2026",
            data: data,
            timestamp: Date.now(),
        };

        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                await new Promise((r) => chrome.storage.local.set({ [PENDING_KEY]: payload }, r));
            } catch (e) {}
        }
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
        } catch (e) {}
        return payload;
    }

    async function getPendingFlow() {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                const res = await new Promise((r) => chrome.storage.local.get([PENDING_KEY], r));
                if (res && res[PENDING_KEY]) return res[PENDING_KEY];
            } catch (e) {}
        }
        try {
            const raw = localStorage.getItem(PENDING_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    async function clearPendingFlow() {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            try {
                await new Promise((r) => chrome.storage.local.remove([PENDING_KEY], r));
            } catch (e) {}
        }
        try {
            localStorage.removeItem(PENDING_KEY);
        } catch (e) {}
    }

    // -------------------------------------------------------------------------
    // Helper Identifikasi Halaman
    // -------------------------------------------------------------------------

    function isBerkasPage() {
        return (
            window.location.pathname.toLowerCase().includes("/intan/berkas") ||
            !!document.querySelector(S_BERKAS.inputNomor) ||
            !!document.querySelector(S_BERKAS.form)
        );
    }

    function isAjbPage() {
        return (
            window.location.pathname.toLowerCase().includes("/akta/") ||
            !!document.querySelector(S_SERTIPIKAT.container) ||
            !!document.querySelector(S_SERTIPIKAT.form)
        );
    }

    function isOpenedBerkasLoaded() {
        return (
            !!document.querySelector("#docViewerProduct") ||
            !!document.querySelector("#smartwizard") ||
            !!document.querySelector("#DataSertipikat_inputsertipikat_nibelektronik") ||
            !!document.querySelector("#tabproses2 .step-content")
        );
    }

    /**
     * Membaca nomor berkas dari halaman/view berkas yang sedang terbuka.
     */
    function getOpenedBerkasNumber() {
        // 1. Cek hidden input di Step 1 (#DataSertipikat_nomorberkas)
        const input = document.querySelector("#DataSertipikat_nomorberkas");
        if (input && input.value) {
            const m = input.value.match(/([0-9]{3,8})/);
            if (m) return m[1];
        }

        // 2. Cek heading h2 di tabproses2 atau smartwizard
        const headings = document.querySelectorAll("#tabproses2 h2, #smartwizard h2, .hidden-print h2, .page-title h2");
        for (const h of headings) {
            const text = h.textContent || "";
            const m = text.match(/Nomor\s*Berkas\s*:\s*([0-9]{3,8})/i);
            if (m) return m[1];
        }

        // 3. Cek link data-content-url di smartwizard
        const stepLink = document.querySelector("a[data-content-url*='nomorberkas=']");
        if (stepLink) {
            const url = stepLink.getAttribute("data-content-url") || "";
            const m = url.match(/nomorberkas=([0-9]{3,8})/i);
            if (m) return m[1];
        }

        return null;
    }

    /**
     * Memeriksa apakah view berkas yang sedang terbuka sesuai dengan nomor berkas target.
     */
    function isOpenedBerkasMatching(targetNomorBerkas) {
        if (!targetNomorBerkas) return false;
        if (!isOpenedBerkasLoaded()) return false;
        const currentNum = getOpenedBerkasNumber();
        if (!currentNum) return false;
        return currentNum.toString().trim() === targetNomorBerkas.toString().trim();
    }

    /**
     * Beralih ke tab BERKAS (#tabproses1) untuk melakukan pencarian jika tab detail sedang aktif.
     */
    function switchToBerkasSearchTab() {
        const berkasTab = document.querySelector("#berkas-tab, a[href*='#tabproses1']");
        if (berkasTab) {
            berkasTab.click();
        }
        dom.runInPageContext(() => {
            if (window.jQuery) {
                window.jQuery("#berkas-tab, a[href='#tabproses1']").tab("show");
            }
        });
    }

    // -------------------------------------------------------------------------
    // Ekstraksi & Download Dokumen yang Ditampilkan di Halaman Berkas
    // -------------------------------------------------------------------------

    /**
     * Menemukan URL berkas/dokumen PDF di halaman yang terbuka dan mengunduhnya.
     */
    async function downloadDocumentFromOpenedPage(nomorBerkas = "Berkas") {
        console.log("AutoFill PPAT: Mendeteksi dokumen yang dapat diunduh pada halaman baru...");

        let docUrl = null;

        // 1. Cek dari atribut data-content-url pada link Step 1 / Step wizard
        const step1El = document.querySelector(
            "ul.wizard_steps a[data-content-url], ul.step-anchor a[data-content-url], a[data-content-url*='Step1']"
        );
        if (step1El) {
            const contentUrl = (step1El.getAttribute("data-content-url") || "").replace(/&amp;/g, "&");
            const mBid = contentUrl.match(/[?&]berkasidEnc=([^&]+)/i);
            const mKid = contentUrl.match(/[?&]kantoridEnc=([^&]+)/i);
            if (mBid && mKid) {
                docUrl = `/intan/PengecekanSertipikat/GetFileDokumen?bid=${mBid[1]}&kid=${mKid[1]}`;
                console.log("AutoFill PPAT: Ditemukan URL dokumen dari Step 1 data-content-url:", docUrl);
            }
        }

        // 2. Cek dari skrip LoadSertipikat jika belum ketemu
        if (!docUrl) {
            const scripts = document.querySelectorAll("script");
            for (const s of scripts) {
                const text = s.textContent || "";
                const m = text.match(/GetFileDokumen\?bid=([^&'"]+)&kid=([^&'"]+)/);
                if (m) {
                    docUrl = `/intan/PengecekanSertipikat/GetFileDokumen?bid=${m[1]}&kid=${m[2]}`;
                    console.log("AutoFill PPAT: Ditemukan URL dokumen dari skrip halaman:", docUrl);
                    break;
                }
            }
        }

        // 3. Cek dari iframe pdfviewertools jika ada
        const iframe = document.querySelector("#docViewerProduct iframe, iframe[src*='pdfviewertools']");
        if (iframe) {
            const src = iframe.getAttribute("src") || "";
            const mFile = src.match(/[?&]file=([^&#]+)/);
            if (mFile && !docUrl) {
                docUrl = decodeURIComponent(mFile[1]);
                console.log("AutoFill PPAT: Ditemukan URL dokumen dari parameter iframe:", docUrl);
            }

            // Coba klik tombol download di dalam iframe PDF viewer (pdfviewertools) jika bisa diakses
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    const dlBtn = iframeDoc.getElementById("download") || iframeDoc.getElementById("secondaryDownload");
                    if (dlBtn) {
                        console.log("AutoFill PPAT: Menekan tombol download langsung di dalam toolbar viewer...");
                        dlBtn.click();
                    }
                }
            } catch (err) {
                // Cross-origin fallback
            }
        }

        // 4. Cek elemen link atau tombol download generik di halaman
        if (!docUrl) {
            const genericSelectors = [
                "a[href*='GetFileDokumen' i]",
                "a[href*='Download' i]",
                "a[href*='Unduh' i]",
                "a[download]",
                ".btn-download",
                "a:has(i.fa-download)",
                "button:has(i.fa-download)",
            ];
            for (const sel of genericSelectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el) {
                        const href = el.getAttribute("href");
                        if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
                            docUrl = href;
                            break;
                        } else {
                            el.click();
                            return true;
                        }
                    }
                } catch (e) {}
            }
        }

        // Jika URL dokumen berhasil didapatkan, jalankan download
        if (docUrl) {
            const cleanNomor = nomorBerkas.toString().replace(/[\/\\:*?"<>|]/g, "_");
            const filename = `Pengecekan_Sertipikat_${cleanNomor}.pdf`;
            const fullUrl = new URL(docUrl, window.location.origin).href;

            console.log(`AutoFill PPAT: Menjalankan download dokumen: ${fullUrl} -> ${filename}`);

            // 1. Download via Background Service Worker (chrome.downloads API)
            try {
                if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: "downloadFile",
                        url: fullUrl,
                        filename: filename,
                    });
                }
            } catch (err) {
                console.warn("AutoFill PPAT: runtime.sendMessage downloadFile error:", err);
            }

            // 2. Download via elemen anchor <a download> di DOM
            try {
                const a = document.createElement("a");
                a.href = fullUrl;
                a.download = filename;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                setTimeout(() => a.remove(), 1000);
            } catch (err) {
                console.warn("AutoFill PPAT: Anchor download error:", err);
            }

            // 3. Trigger di Main World
            dom.runInPageContext((url, fn) => {
                try {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fn;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => a.remove(), 1000);
                } catch (e) {}
            }, fullUrl, filename);

            return true;
        }

        console.warn("AutoFill PPAT: URL dokumen pengecekan tidak terdeteksi di DOM.");
        return false;
    }

    // -------------------------------------------------------------------------
    // Alur Klik Step 1 & Ekstraksi NIB Elektronik + Kode Sertifikat
    // -------------------------------------------------------------------------

    /**
     * Mengklik tombol Step 1 pada wizard (step 1 sampai 5) hingga kolom NIB Elektronik
     * dan Kode Sertifikat muncul, lalu membaca nilainya.
     */
    /**
     * Mengklik tombol Step 1 pada wizard (step 1 sampai 5) hingga kolom NIB Elektronik
     * dan Kode Sertifikat muncul, lalu membaca nilainya.
     */
    async function clickStep1AndReadFields(expectedNomorBerkas = null, timeoutMs = 15000) {
        console.log("AutoFill PPAT: Mengklik Step 1 untuk memunculkan kolom NIB Elektronik dan Kode Sertifikat...");

        // Cari tombol Step 1
        const findStep1Button = () => {
            const selectors = [
                "ul.wizard_steps a[href*='#sertifikat']",
                "ul.step-anchor a[href*='#sertifikat']",
                "a[data-content-url*='Step1']",
                "ul.wizard_steps li:first-child a",
                "ul.step-anchor li:first-child a",
                "a[href*='step-1']",
            ];

            for (const sel of selectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el) return el;
                } catch (e) {}
            }

            const allLinks = document.querySelectorAll("ul.wizard_steps a, ul.step-anchor a, .sw-main a");
            for (const el of allLinks) {
                const t = (el.textContent || "").trim();
                if (t === "1" || t.toLowerCase().includes("step 1")) {
                    return el;
                }
            }

            return null;
        };

        const step1Btn = findStep1Button();
        if (step1Btn) {
            step1Btn.scrollIntoView({ behavior: "smooth", block: "center" });
            await dom.delay(150);
            step1Btn.click();
        }

        // Panggil juga fungsi bawaan SmartWizard di Main World
        dom.runInPageContext(() => {
            if (window.jQuery) {
                const $ = window.jQuery;
                if ($.fn.smartWizard) {
                    $("#smartwizard, .sw-main").smartWizard("goToStep", 0);
                }
                $("ul.wizard_steps li:first-child a, a[data-content-url*='Step1'], a[href*='#sertifikat']")
                    .first()
                    .trigger("click");
            }
        });

        // Tunggu input NIB Elektronik & Kode Sertifikat terisi di Step 1 (#sertifikat)
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            // Jika ada expectedNomorBerkas, pastikan nomor berkas di DOM Step 1 sesuai
            if (expectedNomorBerkas) {
                const currentNum = getOpenedBerkasNumber();
                if (currentNum && currentNum.toString().trim() !== expectedNomorBerkas.toString().trim()) {
                    // Masih memuat nomor berkas lama, tunggu hingga DOM selesai update
                    await dom.delay(300);
                    continue;
                }
            }

            const inputNib =
                document.querySelector("#DataSertipikat_inputsertipikat_nibelektronik") ||
                document.querySelector(S_BERKAS.inputNibElektronik) ||
                document.querySelector("#sertifikat input[name*='nib' i]");

            const inputKode =
                document.querySelector("#DataSertipikat_inputsertipikat_kodesertipikat") ||
                document.querySelector(S_BERKAS.inputKodeSertipikat) ||
                document.querySelector("#sertifikat input[name*='kode' i]");

            if (inputNib && inputKode) {
                const nibVal = (inputNib.value || "").trim();
                const kodeVal = (inputKode.value || "").trim();

                if (nibVal && kodeVal) {
                    console.log("AutoFill PPAT: Nilai Step 1 berhasil dibaca:", { nibVal, kodeVal });
                    return {
                        nib_elektronik: nibVal,
                        kode_sertipikat: kodeVal,
                    };
                }
            }

            await dom.delay(200);
        }

        // Fallback: baca dari DOM teks di #sertifikat jika input berbentuk readonly/teks
        const sertifikatDiv = document.querySelector("#sertifikat") || document.querySelector("#tabproses2");
        if (sertifikatDiv) {
            const text = sertifikatDiv.textContent || "";
            const mNib = text.match(/\b([0-9]{13,14})\b/);
            const mKode = text.match(/\b([A-Z0-9]{6,8})\b/);
            if (mNib || mKode) {
                return {
                    nib_elektronik: mNib ? mNib[1] : "",
                    kode_sertipikat: mKode ? mKode[1] : "",
                };
            }
        }

        console.warn("AutoFill PPAT: Kolom NIB Elektronik dan Kode Sertifikat tidak ditemukan di Step 1.");
        return null;
    }

    /**
     * Memproses view berkas yang terbuka:
     * 1. Download dokumen PDF pengecekan.
     * 2. Klik Step 1.
     * 3. Ambil NIB Elektronik dan Kode Sertifikat, lalu simpan.
     */
    async function processOpenedBerkas(nomorBerkas, tahunBerkas, onProgress = null) {
        const updateStatus = (msg, type = "info") => {
            console.log(`AutoFill PPAT [Opened Berkas]: ${msg}`);
            if (typeof onProgress === "function") {
                onProgress(msg, type);
            }
        };

        // 1. Download dokumen
        updateStatus("⏳ Mendeteksi & mengunduh dokumen pengecekan sertipikat...", "info");
        await dom.delay(500);
        const downloaded = await downloadDocumentFromOpenedPage(nomorBerkas);
        if (downloaded) {
            updateStatus("✔ Dokumen pengecekan sertipikat berhasil diunduh!", "ok");
        } else {
            updateStatus("⚠ Menunggu viewer dokumen...", "warn");
        }

        await dom.delay(600);

        // 2. Klik Step 1 dan baca NIB Elektronik serta Kode Sertifikat
        updateStatus("⏳ Mengklik tombol Step 1 dan membaca kolom NIB & Kode Sertifikat...", "info");
        const fields = await clickStep1AndReadFields(nomorBerkas, 15000);

        const nibFinal = fields?.nib_elektronik || "";
        const kodeFinal = fields?.kode_sertipikat || "";

        const existing = await getSavedSertipikat();

        const savedPayload = {
            ...(existing && existing.nomor_berkas === nomorBerkas ? existing : {}),
            nomor_berkas: nomorBerkas || "",
            tahun_berkas: tahunBerkas || "2026",
            nib_elektronik: nibFinal || existing?.nib_elektronik || "",
            kode_sertipikat: kodeFinal || existing?.kode_sertipikat || "",
            nomor_seri_blangko: kodeFinal || existing?.nomor_seri_blangko || "",
            source: "berkas_step1",
            saved_at: Date.now(),
        };

        await saveSertipikat(savedPayload);
        await clearPendingFlow();

        updateStatus(
            `✔ Selesai! Berkas ${nomorBerkas} - NIB: ${savedPayload.nib_elektronik || "-"} | Kode: ${kodeFinal || "-"} berhasil disimpan ke ekstensi!`,
            "ok"
        );

        return savedPayload;
    }

    // -------------------------------------------------------------------------
    // Alur Pencarian Berkas di https://ppat.atrbpn.go.id/intan/Berkas
    // -------------------------------------------------------------------------

    async function searchBerkas(data) {
        switchToBerkasSearchTab();
        await dom.delay(300);

        const inputNomor = await dom.waitForElement(S_BERKAS.inputNomor, TIMING.BERKAS_TIMEOUT_MS);
        if (!inputNomor) {
            console.warn(MESSAGES.berkasFormMissing);
            return false;
        }

        const nomorVal = (data.nomor_berkas || "").toString().trim();
        const tahunVal = (data.tahun_berkas || new Date().getFullYear()).toString().trim();

        if (nomorVal) dom.fillField(S_BERKAS.inputNomor, nomorVal);
        if (tahunVal) dom.fillField(S_BERKAS.inputTahun, tahunVal);

        dom.runInPageContext((nmr, thn) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (nmr) $("#nmrberkas").val(nmr).trigger("input").trigger("change");
            if (thn) $("#thnberkas").val(thn).trigger("input").trigger("change");
        }, nomorVal, tahunVal);

        await dom.delay(TIMING.SUBMIT_DELAY_MS);

        const btnCari = document.querySelector(S_BERKAS.btnCari);
        if (btnCari) {
            btnCari.click();
            dom.runInPageContext(() => {
                if (window.jQuery) {
                    window.jQuery("#frmFindBerkasSaya").submit();
                }
            });
            return true;
        }
        return false;
    }

    async function waitForAndClickBerkasRow(targetNomorBerkas, timeoutMs = 25000) {
        const startTime = Date.now();
        const targetStr = (targetNomorBerkas || "").toString().trim();

        while (Date.now() - startTime < timeoutMs) {
            const isBlocking = !!document.querySelector(".blockUI.blockOverlay");
            const rows = document.querySelectorAll(`${S_BERKAS.tableBody} tr`);

            if (rows.length > 0 && !isBlocking) {
                for (const row of rows) {
                    const text = (row.textContent || "").trim();
                    if (text.toLowerCase().includes("tidak ada data") || text.toLowerCase().includes("noresults")) {
                        console.warn("AutoFill PPAT: Pencarian berkas tidak menghasilkan data.");
                        return null;
                    }

                    const isMatch = !targetStr || text.includes(targetStr);
                    if (isMatch) {
                        console.log(`AutoFill PPAT: Menemukan baris berkas ${targetStr || "pertama"}, mengklik...`);
                        row.scrollIntoView({ behavior: "smooth", block: "center" });
                        await dom.delay(200);

                        // Klik baris tabel
                        row.click();
                        const link = row.querySelector("a, button, td[onclick]");
                        if (link && link !== row) link.click();

                        dom.runInPageContext((target) => {
                            if (!window.jQuery) return;
                            const $ = window.jQuery;
                            let $targetRow = $("#berkassayaplaceholder tr").first();
                            if (target) {
                                $("#berkassayaplaceholder tr").each(function () {
                                    if ($(this).text().indexOf(target) !== -1) {
                                        $targetRow = $(this);
                                        return false;
                                    }
                                });
                            }
                            if ($targetRow && $targetRow.length) {
                                $targetRow.trigger("click");
                                const onclickAttr = $targetRow.attr("onclick");
                                if (onclickAttr) {
                                    try { eval(onclickAttr); } catch (e) {}
                                }
                            }
                        }, targetStr);

                        return row;
                    }
                }
            }

            await dom.delay(300);
        }

        console.warn(`AutoFill PPAT: Baris berkas ${targetStr} tidak muncul di tabel.`);
        return null;
    }

    /**
     * Menjalankan keseluruhan alur pencarian berkas:
     * 1. Cek apakah berkas sudah terbuka dan cocok.
     * 2. Jika belum, isi nomor & tahun berkas -> Klik Cari.
     * 3. Tunggu baris hasil spesifik berkas tersebut di tabel -> Klik baris.
     * 4. Tunggu detail berkas target selesai dimuat di #tabproses2.
     * 5. Download dokumen PDF.
     * 6. Klik Step 1.
     * 7. Simpan NIB Elektronik dan Kode Sertifikat.
     */
    async function searchAndProcessBerkas(data, onProgress = null) {
        const updateStatus = (msg, type = "info") => {
            console.log(`AutoFill PPAT [Berkas]: ${msg}`);
            if (typeof onProgress === "function") {
                onProgress(msg, type);
            }
        };

        const targetNomor = (data.nomor_berkas || "").toString().trim();
        if (!targetNomor) {
            updateStatus("⚠ Nomor berkas tidak valid.", "warn");
            return null;
        }

        // Jika berkas target SUDAH terbuka di layar:
        if (isOpenedBerkasMatching(targetNomor)) {
            updateStatus(`⏳ Berkas No. ${targetNomor} sudah terbuka, melanjutkan ekstraksi...`, "info");
            return await processOpenedBerkas(targetNomor, data.tahun_berkas, onProgress);
        }

        // Simpan state pending agar jika halaman reload / tab dibuka ulang, alur tetap berjalan
        await setPendingFlow(data);

        updateStatus(`⏳ Mengisi Nomor Berkas ${targetNomor} dan melakukan pencarian...`, "info");
        const searched = await searchBerkas(data);
        if (!searched) {
            updateStatus("⚠ Gagal mengisi nomor berkas atau tombol cari tidak ditemukan.", "warn");
            return null;
        }

        updateStatus(`⏳ Menunggu baris berkas ${targetNomor} di tabel...`, "info");
        const row = await waitForAndClickBerkasRow(targetNomor, TIMING.BERKAS_TIMEOUT_MS);
        if (!row) {
            updateStatus(`⚠ Data berkas ${targetNomor} tidak ditemukan di tabel.`, "warn");
            return null;
        }

        updateStatus(`⏳ Membuka detail berkas ${targetNomor}...`, "info");

        // Tunggu hingga detail berkas target benar-benar terbuka di #tabproses2
        const startTime = Date.now();
        let loaded = false;
        while (Date.now() - startTime < 25000) {
            const isBlocking = !!document.querySelector(".blockUI.blockOverlay");
            if (!isBlocking && isOpenedBerkasMatching(targetNomor)) {
                loaded = true;
                break;
            }
            await dom.delay(400);
        }

        if (loaded || isOpenedBerkasMatching(targetNomor)) {
            return await processOpenedBerkas(targetNomor, data.tahun_berkas, onProgress);
        }

        // Fallback jika nomor tidak teridentifikasi di teks tapi viewer/step sudah muncul
        if (isOpenedBerkasLoaded()) {
            const currentNum = getOpenedBerkasNumber();
            if (!currentNum || currentNum === targetNomor) {
                return await processOpenedBerkas(targetNomor, data.tahun_berkas, onProgress);
            }
        }

        updateStatus("⚠ Detail berkas belum selesai dimuat.", "warn");
        return null;
    }

    /**
     * Pengecekan otomatis saat halaman baru selesai dimuat:
     * Jika halaman ini adalah menu Berkas dan ada alur pending aktif:
     */
    async function checkAndExecuteOpenedBerkasFlow() {
        const pending = await getPendingFlow();
        // Hanya jalankan jika pending aktif dalam 3 menit terakhir
        if (!pending || !pending.active || Date.now() - pending.timestamp > 180000) return;

        console.log("AutoFill PPAT: Mendeteksi alur pending berkas:", pending);

        if (isBerkasPage()) {
            if (isOpenedBerkasMatching(pending.nomor_berkas)) {
                console.log(`AutoFill PPAT: Berkas ${pending.nomor_berkas} sudah terbuka, jalankan download & Step 1...`);
                await processOpenedBerkas(pending.nomor_berkas, pending.tahun_berkas);
            } else {
                console.log(`AutoFill PPAT: Menjalankan pencarian berkas pending ${pending.nomor_berkas} secara otomatis...`);
                await searchAndProcessBerkas(pending.data || pending);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Pengisian Section H: Input Sertipikat di Halaman AJB
    // (https://ppat.atrbpn.go.id/akta/Peralihan/AJB)
    // -------------------------------------------------------------------------

    async function ensureElektronikToggle() {
        const toggle = document.querySelector(S_SERTIPIKAT.toggleMode);
        const inputNib = document.querySelector(S_SERTIPIKAT.inputNibElektronik);

        if (!inputNib || (toggle && toggle.checked)) {
            console.log("AutoFill PPAT: Mengaktifkan mode Sertipikat Elektronik pada toggle...");

            if (toggle) {
                const wrapper = toggle.closest(".toggle");
                if (wrapper) wrapper.click();
                else toggle.click();
            }

            dom.runInPageContext(() => {
                if (!window.jQuery) return;
                const $toggle = window.jQuery("#toggle-two");
                if ($toggle.length) {
                    $toggle.bootstrapToggle("off");
                }
            });

            await dom.waitForElement(S_SERTIPIKAT.inputNibElektronik, 5000);
            await dom.delay(300);
        }

        return true;
    }

    async function fillSertipikatAJB(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const container = await dom.waitForElement(
            `${S_SERTIPIKAT.container}, ${S_SERTIPIKAT.form}`,
            TIMING.SERTIPIKAT_FORM_TIMEOUT_MS
        );
        if (!container) {
            console.warn(MESSAGES.sertipikatFormMissing);
            return false;
        }

        container.scrollIntoView({ behavior: "smooth", block: "center" });

        await ensureElektronikToggle();

        const inputNib = await dom.waitForElement(S_SERTIPIKAT.inputNibElektronik, 5000);
        const inputKode = await dom.waitForElement(S_SERTIPIKAT.inputKodeSertipikat, 5000);

        if (!inputNib || !inputKode) {
            console.warn("AutoFill PPAT: Kolom input NIB Elektronik atau Kode Sertifikat tidak ditemukan di form AJB.");
            return false;
        }

        const nibVal = (data.nib_elektronik || data.nib || "").toString().trim();
        const kodeVal = (data.kode_sertipikat || data.nomor_seri_blangko || "").toString().trim();

        if (nibVal) dom.fillField(S_SERTIPIKAT.inputNibElektronik, nibVal);
        if (kodeVal) dom.fillField(S_SERTIPIKAT.inputKodeSertipikat, kodeVal);

        dom.runInPageContext((n, k) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (n) $("#nibelektronik").val(n).trigger("input").trigger("change").trigger("blur");
            if (k) $("#kodesertipikat").val(k).trigger("input").trigger("change").trigger("blur");
        }, nibVal, kodeVal);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS + 200);
            const btnSubmit = document.querySelector(S_SERTIPIKAT.btnTambah);
            if (btnSubmit) {
                btnSubmit.click();
            }
        }

        return true;
    }

    return {
        saveSertipikat,
        getSavedSertipikat,
        setPendingFlow,
        getPendingFlow,
        clearPendingFlow,
        isBerkasPage,
        isAjbPage,
        isOpenedBerkasLoaded,
        getOpenedBerkasNumber,
        isOpenedBerkasMatching,
        switchToBerkasSearchTab,
        downloadDocumentFromOpenedPage,
        clickStep1AndReadFields,
        processOpenedBerkas,
        searchBerkas,
        waitForAndClickBerkasRow,
        searchAndProcessBerkas,
        checkAndExecuteOpenedBerkasFlow,
        fillSertipikatAJB,
    };
})();
