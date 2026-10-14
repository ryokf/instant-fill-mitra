/**
 * Pengisian otomatis & alur otomasi Sertipikat:
 * 1. Pada halaman Berkas (https://ppat.atrbpn.go.id/intan/Berkas):
 *    - Mengisi kolom nomor berkas & tahun berkas.
 *    - Otomatis klik tombol "Cari Berkas" (#btncari).
 *    - Menunggu 1 baris hasil di tabel (#berkassayaplaceholder tr), lalu klik baris tersebut.
 *    - Otomatis mengunduh dokumen yang tersedia pada halaman/tab yang terbuka.
 *    - Mengklik tombol Step 1 hingga kolom NIB Elektronik (#nibelektronik) dan Kode Sertifikat (#kodesertipikat) muncul.
 *    - Menyimpan nilai kedua kolom tersebut ke chrome.storage.local / localStorage.
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

    // -------------------------------------------------------------------------
    // Alur Otomasi Berkas (https://ppat.atrbpn.go.id/intan/Berkas)
    // -------------------------------------------------------------------------

    /**
     * Mengisi nomor berkas dan tahun berkas, kemudian menekan tombol Cari Berkas (#btncari).
     */
    async function searchBerkas(data) {
        const inputNomor = await dom.waitForElement(S_BERKAS.inputNomor, TIMING.BERKAS_TIMEOUT_MS);
        if (!inputNomor) {
            console.warn(MESSAGES.berkasFormMissing);
            return false;
        }

        const nomorVal = (data.nomor_berkas || "").toString().trim();
        const tahunVal = (data.tahun_berkas || new Date().getFullYear()).toString().trim();

        if (nomorVal) {
            dom.fillField(S_BERKAS.inputNomor, nomorVal);
        }
        if (tahunVal) {
            dom.fillField(S_BERKAS.inputTahun, tahunVal);
        }

        // Sinkronisasi ke Main World jQuery jika ada
        dom.runInPageContext((nmr, thn) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (nmr) $("#nmrberkas").val(nmr).trigger("input").trigger("change");
            if (thn) $("#thnberkas").val(thn).trigger("input").trigger("change");
        }, nomorVal, tahunVal);

        await dom.delay(TIMING.SUBMIT_DELAY_MS);

        // Klik tombol cari berkas
        const btnCari = document.querySelector(S_BERKAS.btnCari);
        if (btnCari) {
            btnCari.click();
            return true;
        }

        return false;
    }

    /**
     * Menunggu baris hasil muncul di tabel (#berkassayaplaceholder tr),
     * lalu mengklik baris tersebut untuk membuka view berkas.
     */
    async function waitForAndClickBerkasRow(timeoutMs = 15000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            // Cek apakah ada overlay blockUI aktif
            const isBlocking = !!document.querySelector(".blockUI.blockOverlay");

            const rows = document.querySelectorAll(`${S_BERKAS.tableBody} tr`);
            if (rows.length > 0 && !isBlocking) {
                // Pastikan bukan pesan "tidak ada data"
                const firstRow = rows[0];
                const text = firstRow.textContent || "";
                if (text.toLowerCase().includes("tidak ada data") || text.toLowerCase().includes("noresults")) {
                    console.warn("AutoFill PPAT: Pencarian berkas tidak menghasilkan data.");
                    return null;
                }

                // Klik baris pertama
                firstRow.scrollIntoView({ behavior: "smooth", block: "center" });
                await dom.delay(200);

                // Klik elemen row dan elemen anchor/link di dalamnya jika ada
                firstRow.click();
                const link = firstRow.querySelector("a, button, td[onclick]");
                if (link && link !== firstRow) {
                    link.click();
                }

                // Jalankan juga trigger click di Main World jQuery
                dom.runInPageContext(() => {
                    if (!window.jQuery) return;
                    const $row = window.jQuery("#berkassayaplaceholder tr").first();
                    if ($row && $row.length) {
                        $row.trigger("click");
                        $row.find("a, td").first().trigger("click");
                    }
                });

                return firstRow;
            }

            await dom.delay(200);
        }

        console.warn("AutoFill PPAT: Batas waktu menunggu baris berkas di tabel terlampaui.");
        return null;
    }

    /**
     * Mencari tombol / link download dokumen pada view berkas dan mengkliknya.
     */
    async function triggerDocumentDownload(timeoutMs = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            // Cari link atau button download
            const selectors = [
                "#tabproses2 a[href*='Download' i]",
                "#tabproses2 a[href*='download' i]",
                "#tabproses2 a[href*='Unduh' i]",
                "#tabproses2 a[href*='unduh' i]",
                "#tabproses2 a[href*='Dokumen' i]",
                "#tabproses2 a[href*='pdf' i]",
                "#tabproses2 a[download]",
                "#tabproses2 .btn-download",
                "#tabproses2 a:has(i.fa-download)",
                "#tabproses2 button:has(i.fa-download)",
                "a[href*='Download' i]",
                "a[href*='Unduh' i]",
                "a[href*='Dokumen' i]",
                "a[download]",
                ".btn-download",
                "a:has(i.fa-download)",
            ];

            let downloadEl = null;
            for (const sel of selectors) {
                try {
                    downloadEl = document.querySelector(sel);
                    if (downloadEl) break;
                } catch (e) {}
            }

            // Jika belum ketemu dari selector, cari berdasarkan text konten
            if (!downloadEl) {
                const candidates = document.querySelectorAll("#tabproses2 a, #tabproses2 button, a.btn");
                for (const el of candidates) {
                    const t = (el.textContent || "").trim().toLowerCase();
                    if (t.includes("download") || t.includes("unduh") || t.includes("dokumen")) {
                        downloadEl = el;
                        break;
                    }
                }
            }

            if (downloadEl) {
                console.log("AutoFill PPAT: Link download dokumen ditemukan:", downloadEl);
                downloadEl.scrollIntoView({ behavior: "smooth", block: "center" });
                await dom.delay(150);

                // Trigger click
                downloadEl.click();

                // Jika elemen memiliki href URL valid, trigger klik anchor eksplisit
                const href = downloadEl.getAttribute("href");
                if (href && !href.startsWith("javascript") && !href.startsWith("#")) {
                    const tempA = document.createElement("a");
                    tempA.href = downloadEl.href || href;
                    tempA.download = "";
                    tempA.target = "_blank";
                    document.body.appendChild(tempA);
                    tempA.click();
                    tempA.remove();
                }

                return true;
            }

            await dom.delay(200);
        }

        console.warn("AutoFill PPAT: Link download dokumen tidak ditemukan dalam batas waktu.");
        return false;
    }

    /**
     * Mengklik Step 1 pada wizard (step 1 sampai 5) hingga kolom NIB Elektronik
     * dan Kode Sertifikat muncul, lalu membaca nilainya.
     */
    async function clickStep1AndReadFields(timeoutMs = 15000) {
        const startTime = Date.now();

        // Cari dan klik tombol Step 1
        const findStep1Button = () => {
            const selectors = [
                "ul.step-anchor a[href*='step-1']",
                "ul.step-anchor li:first-child a",
                "ul.wizard_steps li:first-child a",
                ".sw-theme-default a[href*='step-1']",
                "a[href*='step-1']",
                "a[href$='#step-1']",
                "#melengkapi-tab",
            ];

            for (const sel of selectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el) return el;
                } catch (e) {}
            }

            // Cari elemen dengan teks "1" atau "Step 1"
            const allLinks = document.querySelectorAll("ul.step-anchor a, ul.wizard_steps a, .sw-main a, .nav-tabs a");
            for (const el of allLinks) {
                const t = (el.textContent || "").trim();
                if (t === "1" || t.toLowerCase() === "step 1" || t.toLowerCase().includes("step 1")) {
                    return el;
                }
            }

            return null;
        };

        const step1Btn = findStep1Button();
        if (step1Btn) {
            console.log("AutoFill PPAT: Tombol Step 1 ditemukan, mengklik Step 1...");
            step1Btn.click();
        }

        // Jalankan perintah smartWizard goToStep di Main World jika tersedia
        dom.runInPageContext(() => {
            if (window.jQuery) {
                const $ = window.jQuery;
                if ($.fn.smartWizard) {
                    $(".sw-main, #smartwizard, #wizard").smartWizard("goToStep", 0);
                }
                const $s1 = $("ul.step-anchor a[href*='step-1'], ul.wizard_steps li:first-child a").first();
                if ($s1.length) $s1.trigger("click");
            }
        });

        // Tunggu input NIB Elektronik dan Kode Sertifikat muncul dan terisi
        while (Date.now() - startTime < timeoutMs) {
            const nibEl =
                document.querySelector(S_BERKAS.inputNibElektronik) ||
                document.querySelector("input[name*='nib' i]") ||
                document.querySelector("input[id*='nib' i]");

            const kodeEl =
                document.querySelector(S_BERKAS.inputKodeSertipikat) ||
                document.querySelector("input[name*='kode' i]") ||
                document.querySelector("input[id*='kode' i]") ||
                document.querySelector("input[name*='kodesertifikat' i]") ||
                document.querySelector("input[name*='kodesertipikat' i]");

            if (nibEl || kodeEl) {
                const nibVal = (nibEl && (nibEl.value || nibEl.textContent) ? (nibEl.value || nibEl.textContent).trim() : "");
                const kodeVal = (kodeEl && (kodeEl.value || kodeEl.textContent) ? (kodeEl.value || kodeEl.textContent).trim() : "");

                if (nibVal || kodeVal) {
                    console.log("AutoFill PPAT: Field Step 1 terdeteksi:", { nibVal, kodeVal });
                    return {
                        nib_elektronik: nibVal,
                        kode_sertipikat: kodeVal,
                    };
                }
            }

            await dom.delay(200);
        }

        // Cek juga apakah ada teks NIB dan Kode pada tabel atau span di Step 1
        const textNodes = document.querySelectorAll("#tabproses2 td, #tabproses2 p, #tabproses2 span");
        let foundNib = "";
        let foundKode = "";
        for (const el of textNodes) {
            const t = el.textContent || "";
            const mNib = t.match(/\b([0-9]{13,14})\b/);
            if (mNib && !foundNib) foundNib = mNib[1];
            const mKode = t.match(/\b([A-Z][0-9]{6,8})\b/);
            if (mKode && !foundKode) foundKode = mKode[1];
        }

        if (foundNib || foundKode) {
            return {
                nib_elektronik: foundNib,
                kode_sertipikat: foundKode,
            };
        }

        console.warn("AutoFill PPAT: Field NIB Elektronik & Kode Sertifikat belum terisi di Step 1.");
        return null;
    }

    /**
     * Menjalankan keseluruhan alur pencarian berkas di https://ppat.atrbpn.go.id/intan/Berkas:
     * 1. Input nomor & tahun berkas -> Klik Cari.
     * 2. Tunggu 1 baris hasil di tabel -> Klik baris.
     * 3. Download dokumen yang tersedia.
     * 4. Klik Step 1 pada wizard.
     * 5. Baca NIB Elektronik dan Kode Sertifikat, lalu simpan ke storage.
     */
    async function searchAndProcessBerkas(data, onProgress = null) {
        const updateStatus = (msg, type = "info") => {
            console.log(`AutoFill PPAT [Berkas]: ${msg}`);
            if (typeof onProgress === "function") {
                onProgress(msg, type);
            }
        };

        updateStatus("⏳ Mengisi Nomor Berkas dan melakukan pencarian...", "info");
        const searched = await searchBerkas(data);
        if (!searched) {
            updateStatus("⚠ Gagal mengisi nomor berkas atau tombol cari tidak ditemukan.", "warn");
            return null;
        }

        updateStatus("⏳ Menunggu baris data berkas di tabel...", "info");
        const row = await waitForAndClickBerkasRow(TIMING.BERKAS_TIMEOUT_MS);
        if (!row) {
            updateStatus("⚠ Data berkas tidak ditemukan di tabel.", "warn");
            return null;
        }

        updateStatus("⏳ Berkas terbuka. Mencari & mengunduh dokumen...", "info");
        await dom.delay(600);
        await triggerDocumentDownload(8000);

        updateStatus("⏳ Mengklik Step 1 dan membaca NIB Elektronik & Kode Sertifikat...", "info");
        await dom.delay(400);
        const stepFields = await clickStep1AndReadFields(10000);

        const nibFinal = (stepFields && stepFields.nib_elektronik) || data.nib_elektronik || data.nib || "";
        const kodeFinal = (stepFields && stepFields.kode_sertipikat) || data.nomor_seri_blangko || "";

        const savedPayload = {
            nomor_berkas: data.nomor_berkas || "",
            tahun_berkas: data.tahun_berkas || "2026",
            nib_elektronik: nibFinal,
            kode_sertipikat: kodeFinal,
            nomor_seri_blangko: data.nomor_seri_blangko || kodeFinal,
            jenis_hak: data.jenis_hak || "",
            desa: data.desa || "",
            kecamatan: data.kecamatan || "",
            kabupaten: data.kabupaten || "",
            luas_m2: data.luas_m2 || "",
            nama_pemilik: data.nama_pemilik || "",
            source: "berkas_page",
        };

        await saveSertipikat(savedPayload);
        updateStatus(
            `✔ Selesai! NIB: ${nibFinal || "-"} | Kode: ${kodeFinal || "-"} tersimpan. Siap diisi ke form AJB.`,
            "ok"
        );

        return savedPayload;
    }

    // -------------------------------------------------------------------------
    // Pengisian Section H: Input Sertipikat di Halaman AJB
    // (https://ppat.atrbpn.go.id/akta/Peralihan/AJB)
    // -------------------------------------------------------------------------

    /**
     * Memastikan toggle (#toggle-two) dalam posisi "Elektronik".
     */
    async function ensureElektronikToggle() {
        const toggle = document.querySelector(S_SERTIPIKAT.toggleMode);
        const inputNib = document.querySelector(S_SERTIPIKAT.inputNibElektronik);

        // Jika input NIB Elektronik belum ada di DOM, toggle kemungkinan masih dalam mode Manual
        if (!inputNib || (toggle && toggle.checked)) {
            console.log("AutoFill PPAT: Mengaktifkan mode Sertipikat Elektronik pada toggle...");

            if (toggle) {
                const wrapper = toggle.closest(".toggle");
                if (wrapper) {
                    wrapper.click();
                } else {
                    toggle.click();
                }
            }

            // Panggil API bootstrapToggle('off') langsung di Main World
            dom.runInPageContext(() => {
                if (!window.jQuery) return;
                const $toggle = window.jQuery("#toggle-two");
                if ($toggle.length) {
                    $toggle.bootstrapToggle("off");
                }
            });

            // Tunggu form AJAX (#inputsertipikatdiv) selesai merender input elektronik
            await dom.waitForElement(S_SERTIPIKAT.inputNibElektronik, 5000);
            await dom.delay(300);
        }

        return true;
    }

    /**
     * Mengisi Section H (Input Sertipikat) pada halaman AJB:
     * - Memastikan mode Elektronik aktif.
     * - Mengisi NIB Elektronik (#nibelektronik).
     * - Mengisi Kode Sertifikat (#kodesertipikat).
     * - Otomatis klik tombol "Cek" / Tambah jika autoSubmit aktif.
     */
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

        // Scroll ke seksi sertipikat
        container.scrollIntoView({ behavior: "smooth", block: "center" });

        // Pastikan mode Elektronik aktif
        await ensureElektronikToggle();

        const inputNib = await dom.waitForElement(S_SERTIPIKAT.inputNibElektronik, 5000);
        const inputKode = await dom.waitForElement(S_SERTIPIKAT.inputKodeSertipikat, 5000);

        if (!inputNib || !inputKode) {
            console.warn("AutoFill PPAT: Kolom input NIB Elektronik atau Kode Sertifikat tidak ditemukan di form AJB.");
            return false;
        }

        const nibVal = (data.nib_elektronik || data.nib || "").toString().trim();
        const kodeVal = (data.kode_sertipikat || data.nomor_seri_blangko || "").toString().trim();

        if (nibVal) {
            dom.fillField(S_SERTIPIKAT.inputNibElektronik, nibVal);
        }
        if (kodeVal) {
            dom.fillField(S_SERTIPIKAT.inputKodeSertipikat, kodeVal);
        }

        // Sinkronisasi ke Main World jQuery
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
        isBerkasPage,
        isAjbPage,
        searchBerkas,
        waitForAndClickBerkasRow,
        triggerDocumentDownload,
        clickStep1AndReadFields,
        searchAndProcessBerkas,
        fillSertipikatAJB,
    };
})();
