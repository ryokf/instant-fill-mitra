/**
 * Pengisian otomatis Form PPh (Pajak Penghasilan).
 * Alur pengisian:
 * 1. Mengisi kolom Nomor Suket dan NPWP.
 * 2. Mengklik otomatis tombol "Cari" di sebelah kolom Nomor Suket.
 * 3. Menunggu hingga semua kolom hasil pencarian di section PPh terisi.
 * 4. Menekan/membuka otomatis tombol "Pilih File" untuk upload bukti PPh.
 */
PPAT.pphFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S_PPH = SELECTORS.pph;

    /**
     * Mencari input Nomor Suket pada section PPh dengan berbagai strategi selector.
     */
    function findInputNomorSuket(container) {
        const root = container || document;
        const candidates = [
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

        // Fallback: input teks pertama yang berada sebelum tombol cari
        const btnCari = findBtnCariSuket(root);
        if (btnCari) {
            const inputGroup = btnCari.closest(".input-group") || btnCari.parentElement;
            if (inputGroup) {
                const inp = inputGroup.querySelector("input[type='text'], input:not([type])");
                if (inp) return inp;
            }
        }
        return null;
    }

    /**
     * Mencari tombol 'Cari' di sebelah kolom Nomor Suket.
     */
    function findBtnCariSuket(container) {
        const root = container || document;

        // 1. Coba cari di dalam input-group tempat input nomor suket berada
        const suketInput = root.querySelector(
            "#nomorsuket, #nosuket, #txtNomorSuket, #nomor_suket, #suket, input[name*='suket' i]"
        );
        if (suketInput) {
            const group = suketInput.closest(".input-group") || suketInput.parentElement;
            if (group) {
                const btn = group.querySelector("button, a.btn, input[type='button'], .btn");
                if (btn) return btn;
            }
        }

        // 2. Coba selector spesifik
        const candidates = [
            "#btncarisuket",
            "#btnCariSuket",
            "#btn-cari-suket",
            "#btncari",
            "#btnCariPPH",
            "button[id*='suket' i]",
            "button[id*='cari' i]",
            "a[id*='cari' i]",
            "button.btn-search",
        ];
        for (const sel of candidates) {
            const el = root.querySelector(sel);
            if (el) return el;
        }

        // 3. Tombol dengan teks 'Cari' atau ikon pencarian
        const allButtons = Array.from(root.querySelectorAll("button, a.btn"));
        for (const btn of allButtons) {
            const text = (btn.textContent || "").trim().toLowerCase();
            if (text === "cari" || text.includes("cari suket") || text.includes("validasi")) {
                return btn;
            }
            if (btn.querySelector("i.fa-search, i.glyphicon-search")) {
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
            "#tNPWP",
            "#npwp",
            "#npwppph",
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
            "#txtUploadFilePPH",
            "#txtUploadFilePPh",
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
     * Menunggu hingga proses pencarian Suket selesai dan kolom-kolom PPh terisi.
     */
    function waitForPphFieldsReady(container, timeoutMs = 8000) {
        const root = container || document;
        return new Promise((resolve) => {
            const startTime = Date.now();

            const check = () => {
                // Periksa apakah ada input lain di section PPh yang terisi (misal nama WP, nilai, atau tgl)
                const inputs = Array.from(root.querySelectorAll("input:not([type='hidden']):not([type='file'])"));
                const filledInputs = inputs.filter((inp) => inp.value && inp.value.trim() !== "");

                // Jika setidaknya 3 input sudah terisi (Suket, NPWP, dan field respon DJP seperti Nama/Nilai)
                if (filledInputs.length >= 3) {
                    return resolve(true);
                }

                // Cek jika loading spinner hilang dan tombol cari sudah aktif kembali
                const isSearching =
                    root.querySelector(".loading, .spinner, [disabled]") ||
                    document.querySelector(".blockUI.blockOverlay");
                if (Date.now() - startTime > 1200 && !isSearching && filledInputs.length >= 2) {
                    return resolve(true);
                }

                if (Date.now() - startTime > timeoutMs) {
                    console.warn("AutoFill PPAT: Timeout menunggu kolom PPh terisi lengkap, melanjutkan.");
                    return resolve(true);
                }

                setTimeout(check, 200);
            };

            setTimeout(check, 300);
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
     * Membuka dialog file picker secara otomatis pada input file (fallback manual).
     */
    async function triggerFilePicker(fileInput) {
        if (!fileInput) return;

        highlightFileWrapper(fileInput);

        let pickerOpened = false;

        // 1. Coba showPicker() native (Chrome 99+)
        if (typeof fileInput.showPicker === "function") {
            try {
                fileInput.showPicker();
                pickerOpened = true;
            } catch (e) {
                console.warn("AutoFill PPAT: PPh fileInput.showPicker error:", e);
            }
        }

        // 2. Coba dispatch native MouseEvent click jika showPicker belum terbuka
        if (!pickerOpened) {
            try {
                fileInput.dispatchEvent(
                    new MouseEvent("click", {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                    })
                );
            } catch (e) {}
        }

        // 3. Coba fileInput.click() langsung
        try {
            fileInput.click();
        } catch (err) {
            console.warn("AutoFill PPAT: PPh fileInput.click() error:", err);
        }

        // 4. Trigger juga di Main World untuk kepastian pemanggilan
        dom.runInPageContext(() => {
            const inp =
                document.getElementById("txtUploadFilePPH") ||
                document.getElementById("txtUploadFilePPh");
            if (inp) {
                if (typeof inp.showPicker === "function") {
                    try {
                        inp.showPicker();
                        return;
                    } catch (e) {}
                }
                try {
                    inp.click();
                } catch (e) {}
            }
        });
    }

    /**
     * Mengisi Form PPh (Pajak Penghasilan).
     * @param {Object} data Data hasil ekstraksi dokumen PPh
     * @param {string} data.nomor_suket Nomor Surat Keterangan (contoh: KET-06442/PHTB-CT/KPP.1012/2026)
     * @param {string} data.npwp NPWP Wajib Pajak
     * @param {Object} options
     * @param {boolean} options.autoSubmit Otomatis submit setelah file dipilih
     * @param {boolean} options.showAlert Tampilkan alert jika berhasil
     */
    async function fill(data, options = {}) {
        if (!data) return false;
        const autoSubmit = options.autoSubmit ?? true;

        console.log("AutoFill PPAT: Memulai pengisian Section PPh dengan data:", data);

        // Cari container section PPh jika ada
        const container = document.querySelector(S_PPH.container);

        // ---------------------------------------------------------------------
        // 1. Cari & Isi Kolom Nomor Suket
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
            inputSuket.closest("[id*='pph' i], [id*='placeholder' i]") ||
            inputSuket.closest(".x_content, .x_panel, .panel-body") ||
            inputSuket.parentElement;

        inputSuket.scrollIntoView({ behavior: "smooth", block: "center" });
        await dom.delay(TIMING.FORM_SETTLE_DELAY_MS);

        if (data.nomor_suket) {
            dom.setInputValue(inputSuket, data.nomor_suket);
            console.log("AutoFill PPAT: Nomor Suket terisi ->", data.nomor_suket);
        }

        // ---------------------------------------------------------------------
        // 2. Cari & Isi Kolom NPWP (dalam scope Section PPh)
        // ---------------------------------------------------------------------
        const inputNpwp = findInputNpwp(pphScope);
        if (inputNpwp && data.npwp) {
            dom.setInputValue(inputNpwp, data.npwp);
            console.log("AutoFill PPAT: NPWP PPh terisi ->", data.npwp);
        }

        await dom.delay(300);

        // ---------------------------------------------------------------------
        // 3. Klik Otomatis Tombol 'Cari' di Sebelah Kolom Nomor Suket
        // ---------------------------------------------------------------------
        const btnCari = findBtnCariSuket(pphScope);
        if (btnCari) {
            console.log("AutoFill PPAT: Menekan tombol 'Cari' Nomor Suket...");
            btnCari.click();
        } else {
            console.warn("AutoFill PPAT: Tombol 'Cari' di sebelah kolom Nomor Suket tidak ditemukan.");
        }

        // ---------------------------------------------------------------------
        // 4. Tunggu Semua Kolom di Section PPh Terisi Lengkap
        // ---------------------------------------------------------------------
        console.log("AutoFill PPAT: Menunggu kolom-kolom PPh terisi lengkap dari hasil pencarian...");
        await waitForPphFieldsReady(pphScope, 8000);
        await dom.delay(500);

        // ---------------------------------------------------------------------
        // 5. Klik / Upload Otomatis Berkas PPh pada Tombol 'Pilih File'
        //    mengambil file PPh dari G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli]
        // ---------------------------------------------------------------------
        const fileInput = findInputFile(pphScope);
        if (fileInput) {
            if (fileInput._ppatChangeHandler) {
                fileInput.removeEventListener("change", fileInput._ppatChangeHandler);
            }

            highlightFileWrapper(fileInput);

            const buyerName =
                options.buyerName ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            let autoUploaded = false;
            if (buyerName && PPAT.pembeliUploadFiller) {
                try {
                    console.log(`AutoFill PPAT: Mencari & mengunggah berkas PPh otomatis untuk pembeli "${buyerName}"...`);
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

            if (autoUploaded) {
                if (autoSubmit) {
                    await dom.delay(TIMING.SUBMIT_DELAY_MS + 350);
                    const btnTambah =
                        document.querySelector(S_PPH.btnTambah) ||
                        (pphScope && pphScope.querySelector("button[id*='tambah' i], button.btn-primary, button[type='submit']"));
                    if (btnTambah) {
                        const waitStart = Date.now();
                        while (btnTambah.disabled && Date.now() - waitStart < 5000) {
                            await dom.delay(100);
                        }
                        console.log("AutoFill PPAT: Menekan tombol Tambah PPh (#btn-tambahpph)...");
                        btnTambah.click();
                    }
                }
            } else {
                // Fallback manual jika berkas PPh tidak ditemukan di folder pembeli
                console.log("AutoFill PPAT: Membuka dialog 'Pilih File' pada Section PPh...");
                if (autoSubmit) {
                    fileInput._ppatChangeHandler = async () => {
                        if (fileInput.files && fileInput.files.length > 0) {
                            await dom.delay(TIMING.SUBMIT_DELAY_MS + 250);
                            const btnTambah =
                                document.querySelector(S_PPH.btnTambah) ||
                                (pphScope && pphScope.querySelector("button[id*='tambah' i], button.btn-primary, button[type='submit']"));
                            if (btnTambah) {
                                console.log("AutoFill PPAT: Berkas PPh terpilih, menekan tombol Tambah PPh...");
                                btnTambah.click();
                            }
                        }
                    };
                    fileInput.addEventListener("change", fileInput._ppatChangeHandler, { once: true });
                }

                await triggerFilePicker(fileInput);
            }
        } else {
            console.warn("AutoFill PPAT: Tombol 'Pilih File' PPh tidak ditemukan.");
        }

        if (options.showAlert) {
            alert(MESSAGES.pphFilled);
        }

        return true;
    }

    return { fill, openPphFilePicker: () => triggerFilePicker(findInputFile(document.querySelector(S_PPH.container))) };
})();
