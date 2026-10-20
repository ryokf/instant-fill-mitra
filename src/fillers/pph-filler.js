/**
 * Pengisian otomatis Form PPh (Pajak Penghasilan / SSP).
 * Alur pengisian:
 * 1. Mengisi kolom NPWP dan Nomor Suket (kodeverifikasi).
 * 2. Mengklik tombol "Cari" (#btncarissp) di sebelah kolom Nomor Suket.
 * 3. Menunggu hingga proses cek Suket selesai (blockUI selesai & kolom hasil cek terisi).
 * 4. Mengunggah file berkas PPh otomatis dari folder pembeli (PPH.pdf).
 * 5. Dilanjutkan dengan menekan tombol "Tambah" (#frmSurat submit).
 */
PPAT.pphFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S_PPH = SELECTORS.pph;

    /**
     * Memeriksa apakah data PPh sudah tersimpan pada "Daftar SSP/PPH yang sudah diinput"
     * di sebelah kanan form PPh (#daftarsuratplaceholder li).
     */
    function isPphSaved() {
        const placeholder = document.querySelector(S_PPH.daftarPlaceholder || "#daftarsuratplaceholder");
        if (!placeholder) return false;
        const items = placeholder.querySelectorAll("li");
        return Array.from(items).some((li) => {
            return (
                li.querySelector(".message_wrapper") ||
                li.querySelector(".heading") ||
                (li.textContent && li.textContent.trim().length > 5)
            );
        });
    }

    /**
     * Menunggu hingga data PPh tersimpan di "Daftar SSP/PPH yang sudah diinput".
     */
    function waitForPphSaved(timeoutMs = 45000) {
        if (isPphSaved()) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector(S_PPH.daftarPlaceholder || "#daftarsuratplaceholder");

            let interval = null;
            let observer = null;

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
                    if (isPphSaved()) {
                        cleanup();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            interval = setInterval(() => {
                if (isPphSaved()) {
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
     * Mencari input Nomor Suket pada section PPh dengan berbagai strategi selector.
     */
    function findInputNomorSuket(container) {
        const root = container || document;
        const candidates = [
            "#kodeverifikasi",
            "input[name='kodeverifikasi']",
            "#nomorsuket",
            "#nosuket",
            "#txtNomorSuket",
            "#nomor_suket",
            "#suket",
            "input[name*='suket' i]",
            "input[name*='skb' i]",
            "input[placeholder*='suket' i]",
            "input[placeholder*='KET-' i]",
            "input[id*='suket' i]",
        ];
        for (const sel of candidates) {
            const el = root.querySelector(sel);
            if (el) return el;
        }

        // Fallback: input teks di dalam input-group sebelum tombol cari
        const btnCari = findBtnCariSuket(root);
        if (btnCari) {
            const inputGroup = btnCari.closest(".input-group") || btnCari.closest(".form-group") || btnCari.parentElement;
            if (inputGroup) {
                const inp = inputGroup.querySelector("input[type='text'], input:not([type])");
                if (inp) return inp;
            }
        }
        return null;
    }

    /**
     * Mencari tombol 'Cari' / 'Cek' di sebelah kolom Nomor Suket.
     */
    function findBtnCariSuket(container) {
        const root = container || document;

        // 1. Selector ID spesifik tombol Cari SSP
        const candidates = [
            "#btncarissp",
            "#btncarisuket",
            "#btnCariSuket",
            "#btn-cari-suket",
            "#btncari",
            "#btnCariPPH",
            "button[title*='Verifikasi' i]",
            "button[id*='suket' i]",
            "button[id*='cari' i]",
        ];
        for (const sel of candidates) {
            const el = root.querySelector(sel);
            if (el) return el;
        }

        // 2. Tombol di sebelah input nomor suket
        const suketInput = root.querySelector("#kodeverifikasi, #nomorsuket, #nosuket, input[name='kodeverifikasi']");
        if (suketInput) {
            const parent = suketInput.closest(".form-group") || suketInput.parentElement;
            if (parent) {
                const btn = parent.querySelector("#btncarissp, button.btn-success, button[title*='Verifikasi' i], .input-group-btn button, button");
                if (btn) return btn;
            }
        }

        // 3. Tombol dengan teks 'Cari'
        const allButtons = Array.from(root.querySelectorAll("button, a.btn"));
        for (const btn of allButtons) {
            const text = (btn.textContent || "").trim().toLowerCase();
            if (text === "cari" || text.includes("cari suket") || text.includes("verifikasi")) {
                return btn;
            }
        }

        return null;
    }

    /**
     * Mencari input NPWP pada section PPh.
     */
    function findInputNpwp(container) {
        const root = container || document;
        const candidates = [
            "#npwp",
            "#tNPWP",
            "#npwppph",
            "input[name='npwp']",
            "input[name*='npwp' i]",
            "input[id*='npwp' i]",
            "input[placeholder*='npwp' i]",
        ];
        for (const sel of candidates) {
            const el = root.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    /**
     * Mencari input file pada section PPh.
     */
    function findInputFile(container) {
        const specificCandidates = [
            "#txtUploadFileSSP",
            "#txtUploadFilePPH",
            "#txtUploadFilePPh",
            "input[name='UploadFromFileInstansi']",
            "input[name*='UploadFilePPH' i]",
            "input[name*='UploadFromFilePPH' i]",
        ];
        for (const sel of specificCandidates) {
            const el = document.querySelector(sel);
            if (el) return el;
        }

        if (container) {
            const genericCandidates = [
                ".btn-file input[type='file']",
                "input[type='file']",
            ];
            for (const sel of genericCandidates) {
                const el = container.querySelector(sel);
                if (el) return el;
            }
        }
        return null;
    }

    /**
     * Mencari tombol Tambah pada form PPh.
     */
    function findBtnTambah(container) {
        const root = container || document;
        const candidates = [
            "button[type='submit'][form='frmSurat']",
            "button[form='frmSurat']",
            "#frmSurat button[type='submit']",
            "#btn-tambah",
            "#btn-tambahpph",
            "#btn-tambahPPH",
        ];
        for (const sel of candidates) {
            const el = root.querySelector(sel) || document.querySelector(sel);
            if (el) return el;
        }

        const buttons = Array.from((root || document).querySelectorAll("button"));
        return buttons.find((b) => (b.textContent || "").trim().toLowerCase() === "tambah") || null;
    }

    /**
     * Memicu klik pada tombol 'Cek' / 'Cari' di sebelah kolom Nomor Suket
     * dan mengeksekusi cekServicessp(0) di Main World.
     */
    function triggerCekSuket(btnCari) {
        console.log("AutoFill PPAT: Menekan tombol Cek Suket PPh (#btncarissp)...");
        if (btnCari) {
            try {
                btnCari.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                btnCari.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                btnCari.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                btnCari.click();
            } catch (_) {}
        }

        // Panggil fungsi cekServicessp bawaan ATR/BPN di Main World
        dom.runInPageContext(() => {
            if (typeof window.cekServicessp === "function") {
                try {
                    window.cekServicessp(0);
                    return;
                } catch (_) {}
            }
            if (window.jQuery) {
                const $btn = window.jQuery("#btncarissp");
                if ($btn.length) $btn.click();
            }
        });
    }

    /**
     * Menunggu hingga proses cek Suket selesai:
     * - Loading overlay (.blockUI) hilang
     * - Kolom hasil respon terisi (#nomorssp, #tanggalssp, #nilaissp, atau #npwpplaceholder)
     *   atau modal notifikasi respon muncul.
     */
    function waitForPphCekCompleted(container, timeoutMs = 25000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            // Beri jeda 400ms pertama agar AJAX / blockUI sempat aktif
            setTimeout(() => {
                const check = () => {
                    const isBlocking = !!document.querySelector(".blockUI.blockOverlay");
                    const nomorEl = document.querySelector("#nomorssp");
                    const tglEl = document.querySelector("#tanggalssp");
                    const nilaiEl = document.querySelector("#nilaissp");
                    const respPlaceholder = document.querySelector("#npwpplaceholder");
                    const hasModal = !!document.querySelector("#myModal.in, #myModal .modal-content");

                    const hasDataFilled =
                        (nomorEl && nomorEl.value && nomorEl.value.trim() !== "") ||
                        (tglEl && tglEl.value && tglEl.value.trim() !== "" && !tglEl.value.includes("0001")) ||
                        (nilaiEl && nilaiEl.value && nilaiEl.value.trim() !== "" && nilaiEl.value.trim() !== "0") ||
                        (respPlaceholder && respPlaceholder.textContent && respPlaceholder.textContent.trim().length > 3) ||
                        hasModal;

                    if (!isBlocking && hasDataFilled) {
                        console.log("AutoFill PPAT: Cek Suket PPh selesai dan hasil validasi terdeteksi!");
                        return resolve(true);
                    }

                    if (Date.now() - startTime > timeoutMs) {
                        console.warn("AutoFill PPAT: Batas waktu menunggu hasil Cek Suket PPh terlewati, melanjutkan pengisian.");
                        return resolve(false);
                    }

                    setTimeout(check, 150);
                };

                check();
            }, 400);
        });
    }

    /**
     * Memberi highlight visual pada tombol Pilih File PPh.
     */
    function highlightFileWrapper(fileInput) {
        if (!fileInput) return;
        const fileWrapper = fileInput.closest(".btn-file") || fileInput.closest(".form-group") || fileInput;
        fileWrapper.scrollIntoView({ behavior: "smooth", block: "center" });

        fileWrapper.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
        fileWrapper.style.boxShadow = "0 0 16px rgba(225, 29, 72, 0.9)";
        fileWrapper.style.outline = "2px solid #e11d48";
        setTimeout(() => {
            fileWrapper.style.boxShadow = "";
            fileWrapper.style.outline = "";
        }, 4000);
    }

    /**
     * Mengisi Form PPh (Pajak Penghasilan / SSP).
     * Urutan eksekusi:
     * 1. Mengisi NPWP (#npwp) dan No. Suket (#kodeverifikasi).
     * 2. Klik tombol cek (#btncarissp) disebelah input nomor suket.
     * 3. Menunggu proses validasi suket selesai.
     * 4. Upload berkas PPh otomatis dari folder pembeli (PPH.pdf).
     * 5. Menekan tombol Tambah (#frmSurat submit).
     */
    async function fill(data, options = {}) {
        if (!data) return false;
        const autoSubmit = options.autoSubmit ?? true;

        console.log("AutoFill PPAT: Memulai pengisian Section PPh dengan data:", data);

        const container = document.querySelector(S_PPH.container);

        // ---------------------------------------------------------------------
        // 1. Cari & Isi Kolom NPWP dan Nomor Suket
        // ---------------------------------------------------------------------
        const inputSuket = findInputNomorSuket(container);
        if (!inputSuket) {
            console.warn(MESSAGES.pphFormMissing || "Kolom Nomor Suket PPh tidak ditemukan di halaman PPAT.");
            if (options.showAlert) alert(MESSAGES.pphFormMissing || "Kolom Nomor Suket PPh tidak ditemukan di halaman PPAT.");
            return false;
        }

        const pphScope =
            container ||
            inputSuket.closest("form") ||
            inputSuket.closest("[id*='pph' i], [id*='placeholder' i], [id*='ssp' i]") ||
            inputSuket.closest(".x_content, .x_panel, .panel-body") ||
            inputSuket.parentElement;

        inputSuket.scrollIntoView({ behavior: "smooth", block: "center" });
        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS);

        // 1a. Isi Kolom NPWP
        const inputNpwp = findInputNpwp(pphScope);
        const cleanNpwp = (data.npwp || data.npwp_formatted || "").toString().replace(/\D/g, "");
        if (inputNpwp && cleanNpwp) {
            dom.setInputValue(inputNpwp, cleanNpwp);
            console.log("AutoFill PPAT: NPWP PPh terisi ->", cleanNpwp);
        }

        // 1b. Isi Kolom Nomor Suket / Kode Verifikasi
        const suketVal = (data.nomor_suket || data.nomor_skb || data.kode_verifikasi || "").toString().trim();
        if (suketVal) {
            dom.setInputValue(inputSuket, suketVal);
            console.log("AutoFill PPAT: Nomor Suket PPh terisi ->", suketVal);
        }

        // Sinkronisasi ke jQuery Main World
        dom.runInPageContext((suket, npwp) => {
            if (!window.jQuery) return;
            if (npwp) window.jQuery("#npwp, #tNPWP").val(npwp).trigger("input").trigger("change").trigger("blur");
            if (suket) window.jQuery("#kodeverifikasi, #nomorsuket").val(suket).trigger("input").trigger("change").trigger("blur");
        }, suketVal, cleanNpwp);

        await dom.delay(350);

        // ---------------------------------------------------------------------
        // 2. Klik Tombol Cek di sebelah Input Nomor Suket
        // ---------------------------------------------------------------------
        const btnCari = findBtnCariSuket(pphScope);
        if (btnCari) {
            triggerCekSuket(btnCari);
        } else {
            console.warn("AutoFill PPAT: Tombol 'Cari' di sebelah kolom Nomor Suket tidak ditemukan.");
        }

        // ---------------------------------------------------------------------
        // 3. Menunggu Hingga Proses Cek Suket Selesai
        // ---------------------------------------------------------------------
        console.log("AutoFill PPAT: Menunggu proses Cek Suket PPh selesai...");
        await waitForPphCekCompleted(pphScope, 25000);
        await dom.delay(500);

        // ---------------------------------------------------------------------
        // 4. Setelah itu baru Klik / Upload Berkas PPh Otomatis dari Folder Pembeli
        // ---------------------------------------------------------------------
        const fileInput = findInputFile(pphScope);
        if (fileInput) {
            highlightFileWrapper(fileInput);

            const buyerName =
                options.buyerName ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            let autoUploaded = false;
            if (buyerName && PPAT.pembeliUploadFiller) {
                try {
                    console.log(`AutoFill PPAT: Mengunggah berkas PPh otomatis untuk pembeli "${buyerName}"...`);
                    const docData = options.pphDocPromise
                        ? await options.pphDocPromise
                        : await PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "pph");

                    if (docData && docData.base64) {
                        const selector = fileInput.id ? `#${fileInput.id}` : S_PPH.inputFile;
                        const injectRes = await PPAT.pembeliUploadFiller.injectSectionFile("pph", selector, docData);
                        if (injectRes && injectRes.success) {
                            autoUploaded = true;
                            console.log(`AutoFill PPAT: Berkas PPh (${docData.filename}) berhasil di-attach ke tombol Pilih File PPh!`);
                        } else {
                            console.warn("AutoFill PPAT: Gagal inject berkas PPh:", injectRes && injectRes.error);
                        }
                    }
                } catch (err) {
                    console.warn("AutoFill PPAT: Gagal mengambil berkas PPh dari folder pembeli:", err);
                }
            }

            // -----------------------------------------------------------------
            // 5. Dilanjutkan dengan Tombol Tambah
            // -----------------------------------------------------------------
            if (autoUploaded && autoSubmit) {
                await dom.delay(TIMING.SUBMIT_DELAY_MS + 350);
                const btnTambah = findBtnTambah(pphScope);
                if (btnTambah) {
                    const waitStart = Date.now();
                    while (btnTambah.disabled && Date.now() - waitStart < 5000) {
                        await dom.delay(100);
                    }
                    console.log("AutoFill PPAT: Menekan tombol Tambah PPh...");
                    btnTambah.click();
                }

                console.log("AutoFill PPAT: Menunggu PPh tersimpan di 'Daftar SSP/PPH'...");
                await waitForPphSaved(45000);
            }
        } else {
            console.warn("AutoFill PPAT: Tombol 'Pilih File' PPh tidak ditemukan.");
            if (autoSubmit) {
                const btnTambah = findBtnTambah(pphScope);
                if (btnTambah) btnTambah.click();
            }
        }

        if (options.showAlert) {
            alert(MESSAGES.pphFilled);
        }

        return true;
    }

    return {
        fill,
        isPphSaved,
        waitForPphSaved,
        waitForPphCekCompleted,
        triggerCekSuket,
        findInputNomorSuket,
        findBtnCariSuket,
        findInputNpwp,
        findInputFile,
        findBtnTambah,
    };
})();
