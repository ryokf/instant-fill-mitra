/**
 * Pengisian otomatis Form PBB (Section I) dan Form BPHTB (Section J).
 * PBB dan BPHTB hanya bisa diisi jika sertifikat sudah terisi di web PPAT.
 */
PPAT.pbbBphtbFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S_PBB = SELECTORS.pbb;
    const S_BPHTB = SELECTORS.bphtb;

    /**
     * Memeriksa apakah sertifikat sudah terisi pada halaman web PPAT:
     * Divalidasi melalui "Daftar Sertipkat HAT yang sudah diinput" di sebelah kanan (#daftarhatplaceholder li).
     */
    function isSertifikatSaved() {
        if (PPAT.sertipikatFiller && typeof PPAT.sertipikatFiller.isSertifikatSaved === "function") {
            return PPAT.sertipikatFiller.isSertifikatSaved();
        }
        const placeholder = document.querySelector("#daftarhatplaceholder");
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
     * Menunggu hingga data Sertipikat tersimpan di daftar sebelah kanan (#daftarhatplaceholder li).
     */
    function waitForSertifikatSaved(timeoutMs = 60000) {
        if (PPAT.sertipikatFiller && typeof PPAT.sertipikatFiller.waitForSertifikatSaved === "function") {
            return PPAT.sertipikatFiller.waitForSertifikatSaved(timeoutMs);
        }
        if (isSertifikatSaved()) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector("#daftarhatplaceholder");

            let observer = null;
            if (placeholder) {
                observer = new MutationObserver(() => {
                    if (isSertifikatSaved()) {
                        if (observer) observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            const interval = setInterval(() => {
                if (isSertifikatSaved()) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeoutMs) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(false);
                }
            }, 200);
        });
    }

    /**
     * Memeriksa apakah dropdown sertifikat (#alashakid) sudah terisi opsi.
     */
    function isSertifikatFilled() {
        const selectCert = document.querySelector(S_PBB.dropdownSertifikat);
        if (!selectCert) return false;
        const validOptions = Array.from(selectCert.options).filter((opt) => opt.value && opt.value.trim() !== "");
        return validOptions.length > 0;
    }

    /**
     * Memeriksa apakah data PBB sudah tersimpan pada "Daftar PBB yang sudah diinput"
     * di sebelah kanan form PBB (#daftarpbbplaceholder li).
     */
    function isPbbSaved() {
        const placeholder = document.querySelector(S_PBB.daftarPlaceholder || "#daftarpbbplaceholder");
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
     * Menunggu hingga data PBB tersimpan di "Daftar PBB yang sudah diinput" (#daftarpbbplaceholder li).
     * Menggunakan MutationObserver untuk deteksi instan saat AJAX response halaman tiba.
     */
    function waitForPbbSaved(timeoutMs = 60000) {
        if (isPbbSaved()) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector(S_PBB.daftarPlaceholder || "#daftarpbbplaceholder");

            let observer = null;
            if (placeholder) {
                observer = new MutationObserver(() => {
                    if (isPbbSaved()) {
                        if (observer) observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            const interval = setInterval(() => {
                if (isPbbSaved()) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeoutMs) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(false);
                }
            }, 200);
        });
    }

    /**
     * Memeriksa apakah data BPHTB sudah tersimpan pada "Daftar BPHTB yang sudah diinput"
     * di sebelah kanan form BPHTB (#bphtbplaceholder li).
     */
    function isBphtbSaved() {
        const placeholder = document.querySelector(S_BPHTB.daftarPlaceholder || "#bphtbplaceholder");
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
     * Menunggu hingga data BPHTB tersimpan di "Daftar BPHTB yang sudah diinput" (#bphtbplaceholder li).
     */
    function waitForBphtbSaved(timeoutMs = 60000) {
        if (isBphtbSaved()) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector(S_BPHTB.daftarPlaceholder || "#bphtbplaceholder");

            let observer = null;
            if (placeholder) {
                observer = new MutationObserver(() => {
                    if (isBphtbSaved()) {
                        if (observer) observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            const interval = setInterval(() => {
                if (isBphtbSaved()) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeoutMs) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(false);
                }
            }, 200);
        });
    }

    /**
     * Mengisi Form PBB (Pajak Bumi Bangunan - Bagian I).
     * Urutan eksekusi yang wajib dipatuhi:
     * 0. PRASYARAT: Sertipikat HARUS sudah terdaftar di Daftar Sertipikat HAT di sebelah kanan form.
     * 1. Kolom Nomor Sertipikat (#alashakid) dipilih terlebih dahulu.
     * 2. Tunggu sampai kolom Luas (M2) yang berada tepat dibawah Nomor Sertipikat (#luassertipikat) terisi.
     * 3. Jika sudah terisi, baru lanjutkan mengisi kolom dibawahnya (NOP, Tahun, Luas, NJOP).
     * 4. Jika sudah terisi semua, baru lakukan klik pada tombol pilih file (#txtUploadFilePBB).
     */
    async function fillPbb(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? false;

        // ---------------------------------------------------------------------
        // PRASYARAT MUTLAK: Sertipikat harus sudah terdaftar di daftar kanan (#daftarhatplaceholder)
        // ---------------------------------------------------------------------
        if (!isSertifikatSaved()) {
            if (options.waitForPrerequisite) {
                console.log("AutoFill PPAT: Menunggu Sertipikat terdaftar di Daftar Sertipikat HAT (#daftarhatplaceholder)...");
                const certOk = await waitForSertifikatSaved(options.prerequisiteTimeout || 45000);
                if (!certOk) {
                    alert(MESSAGES.sertifikatBelumTerdaftar || "Sertipikat belum terdaftar pada daftar di sebelah kanan!");
                    return false;
                }
            } else {
                alert(MESSAGES.sertifikatBelumTerdaftar || "Sertipikat belum terdaftar pada daftar di sebelah kanan!");
                return false;
            }
        }

        // ---------------------------------------------------------------------
        // TAHAP 1: Kolom Nomor Sertipikat (#alashakid), dipilih terlebih dahulu
        // ---------------------------------------------------------------------
        const selectCert = await dom.waitForElement(S_PBB.dropdownSertifikat, TIMING.PBB_FORM_TIMEOUT_MS);
        if (!selectCert) {
            alert(MESSAGES.pbbFormMissing);
            return false;
        }

        // Cari opsi nomor sertifikat valid (tunggu AJAX refreshPage jika baru saja ditambahkan)
        let validOption = Array.from(selectCert.options).find((opt) => opt.value && opt.value.trim() !== "");
        if (!validOption) {
            const startWaitCert = Date.now();
            while (Date.now() - startWaitCert < 10000) {
                await dom.delay(200);
                const curSelect = document.querySelector(S_PBB.dropdownSertifikat);
                if (curSelect) {
                    validOption = Array.from(curSelect.options).find((opt) => opt.value && opt.value.trim() !== "");
                    if (validOption) break;
                }
            }
        }

        if (!validOption) {
            alert(MESSAGES.sertifikatBelumTerisi);
            return false;
        }

        // Arahkan scroll ke dropdown nomor sertifikat
        selectCert.scrollIntoView({ behavior: "smooth", block: "center" });

        // Pilih opsi sertifikat pertama di dropdown dan sinkronisasi ke Select2 & Main World jQuery
        dom.setSelect2Value(S_PBB.dropdownSertifikat, validOption.value);

        // Beri jeda awal agar event change direspon oleh AJAX halaman (cekPersil)
        await dom.delay(250);

        // ---------------------------------------------------------------------
        // TAHAP 2: Tunggu sampai kolom Luas (M2) yang berada tepat dibawah
        //          Nomor Sertipikat (#luassertipikat) terisi
        // ---------------------------------------------------------------------
        const waitStartTime = Date.now();
        const timeoutMs = TIMING.ZNT_WAIT_TIMEOUT_MS || 15000;
        let luasSertifikatTerisi = false;

        while (Date.now() - waitStartTime < timeoutMs) {
            // Ambil elemen Luas (M2) sertipikat TERBARU dari DOM pada setiap putaran
            const luasSertifikatEl =
                document.querySelector("#zntplaceholder #luassertipikat") ||
                document.querySelector("#luassertipikat");
            const isBlocking = !!document.querySelector(".blockUI.blockOverlay");

            if (luasSertifikatEl) {
                const val = luasSertifikatEl.value ? luasSertifikatEl.value.trim() : "";
                // Terisi jika tidak sedang diblokir loading overlay dan nilainya tidak kosong serta bukan "0"
                if (!isBlocking && val !== "" && val !== "0") {
                    luasSertifikatTerisi = true;
                    break;
                }
            }
            await dom.delay(50);
        }

        if (!luasSertifikatTerisi) {
            const luasFinalEl =
                document.querySelector("#zntplaceholder #luassertipikat") ||
                document.querySelector("#luassertipikat");
            if (luasFinalEl && luasFinalEl.value.trim() !== "") {
                luasSertifikatTerisi = true;
            }
        }

        // ---------------------------------------------------------------------
        // TAHAP 3: Jika sudah terisi, baru lanjutkan mengisi kolom dibawahnya:
        //          - SPPT (NOP)           -> #nomor
        //          - Tahun                -> #tahun
        //          - Luas (M2)            -> #luas
        //          - NJOP per M2 (Rp)     -> #nilai
        // ---------------------------------------------------------------------
        const elNomor = document.querySelector("#frmPBBDetail #nomor") || document.querySelector("#nomor");
        const elTahun = document.querySelector("#frmPBBDetail #tahun") || document.querySelector("#tahun");
        const elLuas = document.querySelector("#frmPBBDetail #luas") || document.querySelector("#luas");
        const elNilai = document.querySelector("#frmPBBDetail #nilai") || document.querySelector("#nilai");

        if (!elNomor || !elTahun || !elLuas || !elNilai) {
            console.error("AutoFill PPAT: Kolom form PBB di bawah luas sertipikat tidak ditemukan lengkap di DOM.");
            return false;
        }

        const currentYear = new Date().getFullYear().toString();
        const cleanNop = (data.nop || "").toString().replace(/\D/g, "");
        const tahunVal = data.tahun ? data.tahun.toString() : currentYear;
        const luasVal = data.luas_tanah !== undefined && data.luas_tanah !== null ? data.luas_tanah.toString() : "";
        const njopVal = data.njop_m2 !== undefined && data.njop_m2 !== null ? data.njop_m2.toString() : "";

        // Fungsi isi cepat: memicu input & blur untuk validasi unobtrusive tanpa memicu cekPBB yang lambat
        const setValFast = (el, val) => {
            if (!el || val === undefined || val === null) return;
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
        };

        // Isi ke-4 kolom sekaligus secara instan
        setValFast(elNomor, cleanNop);
        setValFast(elTahun, tahunVal);
        setValFast(elLuas, luasVal);
        setValFast(elNilai, njopVal);

        // Memicu change khusus pada luas dan nilai untuk sinkronisasi nilai
        elLuas.dispatchEvent(new Event("change", { bubbles: true }));
        elNilai.dispatchEvent(new Event("change", { bubbles: true }));

        // Sinkronisasi ke jQuery Main World agar form langsung berstatus valid
        dom.runInPageContext((nop, thn, ls, njop) => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            if (nop) $("#frmPBBDetail #nomor").val(nop).trigger("input").trigger("blur");
            if (thn) $("#frmPBBDetail #tahun").val(thn).trigger("input").trigger("blur");
            if (ls) $("#frmPBBDetail #luas").val(ls).trigger("input").trigger("blur").trigger("change");
            if (njop) $("#frmPBBDetail #nilai").val(njop).trigger("input").trigger("blur").trigger("change");
        }, cleanNop, tahunVal, luasVal, njopVal);

        // ---------------------------------------------------------------------
        // TAHAP 4: Jika sudah terisi semua, baru lakukan klik pada tombol pilih file
        // ---------------------------------------------------------------------
        const fileInput =
            document.querySelector("#txtUploadFilePBB") ||
            document.querySelector(S_PBB.inputFile) ||
            document.querySelector("input[name='UploadFromFileInstansi']") ||
            document.querySelector(".btn-file input[type='file']");

        if (fileInput) {
            // Lepas listener sebelumnya jika ada untuk menghindari eksekusi ganda
            if (fileInput._ppatChangeHandler) {
                fileInput.removeEventListener("change", fileInput._ppatChangeHandler);
            }

            // Pasang handler satu-kali: saat user selesai memilih berkas dari dialog file,
            // baru tekan Tambah jika autoSubmit aktif
            fileInput._ppatChangeHandler = async () => {
                if (fileInput.files && fileInput.files.length > 0) {
                    if (autoSubmit) {
                        // Beri jeda agar event bawaan situs PPAT selesai memproses blob file
                        await dom.delay(TIMING.SUBMIT_DELAY_MS + 250);
                        const submitBtn = document.querySelector(S_PBB.btnTambah);
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    }

                    // Otomatis lanjutkan ke pengisian BPHTB setelah data PBB terdeteksi tersimpan di Daftar PBB
                    if (options.continueToBphtb ?? true) {
                        console.log("AutoFill PPAT: Menunggu PBB tersimpan di 'Daftar PBB yang sudah diinput'...");
                        const saved = await waitForPbbSaved(45000);
                        if (saved) {
                            console.log("AutoFill PPAT: PBB terdeteksi di Daftar PBB! Melanjutkan otomatis ke Section BPHTB...");
                            await dom.delay(500);
                            await fillBphtb(data, options);
                        } else {
                            console.warn("AutoFill PPAT: Batas waktu menunggu PBB tersimpan terlewati.");
                        }
                    } else if (options.showAlert) {
                        alert(MESSAGES.pbbFilled);
                    }
                }
            };

            fileInput.addEventListener("change", fileInput._ppatChangeHandler, { once: true });

            // Arahkan scroll ke posisi tombol upload file agar tampak di layar
            const fileWrapper = fileInput.closest(".btn-file") || fileInput.closest(".form-group") || fileInput;
            fileWrapper.scrollIntoView({ behavior: "smooth", block: "center" });

            // Beri highlight animasi visual pada tombol Pilih File
            fileWrapper.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
            fileWrapper.style.boxShadow = "0 0 16px rgba(240, 173, 78, 1)";
            fileWrapper.style.outline = "2px solid #f0ad4e";
            setTimeout(() => {
                fileWrapper.style.boxShadow = "";
                fileWrapper.style.outline = "";
            }, 4000);

            // Buka dialog file picker secara otomatis:
            let pickerOpened = false;

            // 1. Coba showPicker() native (Chrome 99+)
            if (typeof fileInput.showPicker === "function") {
                try {
                    fileInput.showPicker();
                    pickerOpened = true;
                } catch (e) {
                    console.warn("AutoFill PPAT: showPicker error:", e);
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
                console.warn("AutoFill PPAT: fileInput.click() error:", err);
            }

            // 4. Trigger juga di Main World untuk memastikan pemanggilan
            dom.runInPageContext(() => {
                const inp =
                    document.getElementById("txtUploadFilePBB") ||
                    document.querySelector(".btn-file input[type='file']");
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
        } else {
            console.warn("AutoFill PPAT: Elemen tombol upload file PBB (#txtUploadFilePBB) tidak ditemukan.");
            if (options.scrollIntoView ?? true) {
                form.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            if (autoSubmit) {
                await dom.delay(TIMING.SUBMIT_DELAY_MS);
                const submitBtn = document.querySelector(S_PBB.btnTambah);
                if (submitBtn) submitBtn.click();
            }
        }

        return true;
    }

    /**
     * Mengisi Form BPHTB (Bea Perolehan Hak atas Tanah dan Bangunan - Bagian J).
     * 1. Pada dropdown Nomor Obyek Pajak (#obyekpajakid), pilih opsi NOP yang sesuai / opsi pertama.
     * 2. Isi kolom Nomor Bukti Pembayaran (#nomorbphtb) dari ujung kanan atas dokumen BPHTB.
     * 3. Memicu validasi input & blur agar sistem ATR/BPN memvalidasi data dan mengaktifkan tombol Tambah.
     * 4. Otomatis klik tombol "Pilih File" (#txtUploadFileBPHTB) sehingga pengguna hanya perlu memilih file.
     * 5. Jika autoSubmit: pasang listener untuk otomatis klik tombol Tambah (#btn-tambahbphtb) setelah berkas dipilih.
     */
    async function fillBphtb(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? false;

        // ---------------------------------------------------------------------
        // PRASYARAT MUTLAK: PBB harus sudah terdaftar di daftar kanan (#daftarpbbplaceholder)
        // ---------------------------------------------------------------------
        if (!isPbbSaved()) {
            if (options.waitForPrerequisite) {
                console.log("AutoFill PPAT: Menunggu PBB terdaftar di Daftar PBB (#daftarpbbplaceholder)...");
                const pbbOk = await waitForPbbSaved(options.prerequisiteTimeout || 45000);
                if (!pbbOk) {
                    alert(MESSAGES.pbbBelumTerdaftar || "PBB belum terdaftar pada daftar di sebelah kanan form! BPHTB hanya bisa diisi jika PBB sudah terisi.");
                    return false;
                }
            } else {
                alert(MESSAGES.pbbBelumTerdaftar || "PBB belum terdaftar pada daftar di sebelah kanan form! BPHTB hanya bisa diisi jika PBB sudah terisi.");
                return false;
            }
        }

        const form = await dom.waitForElement(S_BPHTB.form, TIMING.BPHTB_FORM_TIMEOUT_MS);
        if (!form) {
            alert(MESSAGES.bphtbFormMissing);
            return false;
        }

        // Arahkan tampilan layar ke section BPHTB
        const container = document.querySelector(S_BPHTB.container) || form;
        container.scrollIntoView({ behavior: "smooth", block: "center" });

        // Tunggu dropdown obyekpajakid muncul dan memiliki opsi NOP dari PBB
        const selectNop = await dom.waitForElement(S_BPHTB.dropdownNop, TIMING.BPHTB_FORM_TIMEOUT_MS);
        if (selectNop) {
            let validOption = Array.from(selectNop.options).find((opt) => opt.value && opt.value.trim() !== "");
            if (!validOption) {
                // Polling hingga opsi NOP dimuat oleh AJAX /akta/Akta/ListNOP pasca-submit PBB
                const startWait = Date.now();
                while (Date.now() - startWait < 10000) {
                    await dom.delay(150);
                    const curSelect = document.querySelector(S_BPHTB.dropdownNop);
                    if (curSelect) {
                        validOption = Array.from(curSelect.options).find((opt) => opt.value && opt.value.trim() !== "");
                        if (validOption) break;
                    }
                }
            }

            if (validOption) {
                // Selalu pilih opsi NOP pertama di dropdown
                dom.setSelect2Value(S_BPHTB.dropdownNop, validOption.value);
            }
        }

        // Isi kolom Nomor Bukti Pembayaran (#nomorbphtb)
        const noBukti = (data.nomor_bukti_pembayaran || "").toString().trim();
        const elBukti = document.querySelector(S_BPHTB.inputNomorBukti);
        if (elBukti && noBukti) {
            elBukti.value = noBukti;
            elBukti.dispatchEvent(new Event("input", { bubbles: true }));
            elBukti.dispatchEvent(new Event("change", { bubbles: true }));
            elBukti.dispatchEvent(new Event("blur", { bubbles: true }));

            // Sinkronisasi ke Main World jQuery agar host-to-host maxValueBPHTB terpicu dan tombol Tambah aktif
            dom.runInPageContext((val) => {
                if (!window.jQuery) return;
                window.jQuery("#nomorbphtb").val(val).trigger("input").trigger("change").trigger("blur");
            }, noBukti);
        }

        // Otomatis klik tombol "Pilih File" BPHTB (#txtUploadFileBPHTB)
        const fileInputBphtb =
            document.querySelector("#txtUploadFileBPHTB") ||
            document.querySelector(S_BPHTB.inputFile) ||
            document.querySelector("input[name='UploadFromFileInstansi'][id*='BPHTB']") ||
            document.querySelector("#inputBPHTBplaceholder input[type='file']");

        if (fileInputBphtb) {
            // Lepas listener sebelumnya jika ada untuk menghindari eksekusi ganda
            if (fileInputBphtb._ppatChangeHandler) {
                fileInputBphtb.removeEventListener("change", fileInputBphtb._ppatChangeHandler);
            }

            // Pasang handler satu-kali: saat user selesai memilih berkas BPHTB dari dialog file,
            // baru otomatis tekan Tambah jika autoSubmit aktif
            fileInputBphtb._ppatChangeHandler = async () => {
                if (fileInputBphtb.files && fileInputBphtb.files.length > 0) {
                    if (autoSubmit) {
                        // Tunggu tombol tambah BPHTB aktif (karena AJAX maxValueBPHTB memvalidasi data)
                        const submitBtn = document.querySelector(S_BPHTB.btnTambah);
                        if (submitBtn) {
                            const waitBtnStart = Date.now();
                            while (submitBtn.disabled && Date.now() - waitBtnStart < 6000) {
                                await dom.delay(100);
                            }
                            await dom.delay(TIMING.SUBMIT_DELAY_MS + 250);
                            submitBtn.click();
                        }
                    } else if (options.showAlert) {
                        alert(MESSAGES.bphtbFilled);
                    }
                }
            };

            fileInputBphtb.addEventListener("change", fileInputBphtb._ppatChangeHandler, { once: true });

            // Arahkan scroll ke posisi tombol upload file BPHTB
            const fileWrapper =
                fileInputBphtb.closest(".btn-file") ||
                fileInputBphtb.closest(".form-group") ||
                fileInputBphtb;
            fileWrapper.scrollIntoView({ behavior: "smooth", block: "center" });

            // Beri highlight visual emas
            fileWrapper.style.transition = "box-shadow 0.3s ease, outline 0.3s ease";
            fileWrapper.style.boxShadow = "0 0 16px rgba(240, 173, 78, 1)";
            fileWrapper.style.outline = "2px solid #f0ad4e";
            setTimeout(() => {
                fileWrapper.style.boxShadow = "";
                fileWrapper.style.outline = "";
            }, 4000);

            // Buka dialog file picker secara otomatis:
            let pickerOpened = false;

            // 1. showPicker native (Chrome 99+)
            if (typeof fileInputBphtb.showPicker === "function") {
                try {
                    fileInputBphtb.showPicker();
                    pickerOpened = true;
                } catch (e) {
                    console.warn("AutoFill PPAT: BPHTB showPicker error:", e);
                }
            }

            // 2. Dispatch MouseEvent click jika showPicker belum terbuka
            if (!pickerOpened) {
                try {
                    fileInputBphtb.dispatchEvent(
                        new MouseEvent("click", {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                        })
                    );
                } catch (e) {}
            }

            // 3. fileInput.click() langsung
            try {
                fileInputBphtb.click();
            } catch (err) {
                console.warn("AutoFill PPAT: BPHTB fileInput.click error:", err);
            }

            // 4. Trigger juga di Main World context
            dom.runInPageContext(() => {
                const inp =
                    document.getElementById("txtUploadFileBPHTB") ||
                    document.querySelector("#inputBPHTBplaceholder input[type='file']");
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
        } else {
            console.warn("AutoFill PPAT: Elemen tombol upload file BPHTB (#txtUploadFileBPHTB) tidak ditemukan.");
            if (autoSubmit) {
                const submitBtn = document.querySelector(S_BPHTB.btnTambah);
                if (submitBtn) {
                    const waitBtnStart = Date.now();
                    while (submitBtn.disabled && Date.now() - waitBtnStart < 4000) {
                        await dom.delay(100);
                    }
                    await dom.delay(TIMING.SUBMIT_DELAY_MS);
                    submitBtn.click();
                }
            }
        }

        return true;
    }

    /**
     * Mengisi PBB terlebih dahulu, kemudian melanjutkan pengisian BPHTB secara otomatis.
     */
    async function fillAll(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? false;

        // 1. Verifikasi prasyarat awal: Sertipikat harus sudah terdaftar di sisi kanan!
        if (!isSertifikatSaved()) {
            alert(MESSAGES.sertifikatBelumTerdaftar || "Sertipikat belum terdaftar pada 'Daftar Sertipkat HAT' di sebelah kanan form!");
            return false;
        }

        // 2. Jika data PBB sudah ada di daftar sebelah kanan, langsung isi BPHTB!
        if (isPbbSaved()) {
            console.log("AutoFill PPAT: PBB sudah terinput di daftar sebelah kanan. Mengisi BPHTB...");
            return await fillBphtb(data, { autoSubmit, scrollIntoView: true, waitForPrerequisite: false });
        }

        // 3. Jalankan pengisian PBB dengan opsi continueToBphtb aktif
        return await fillPbb(data, { autoSubmit, continueToBphtb: true, scrollIntoView: true, waitForPrerequisite: false });
    }

    /**
     * Memicu klik langsung pada tombol Pilih File dokumen PBB.
     */
    function openPbbFilePicker() {
        const fileInput =
            document.querySelector("#txtUploadFilePBB") ||
            document.querySelector(S_PBB.inputFile) ||
            document.querySelector("input[name='UploadFromFileInstansi']") ||
            document.querySelector(".btn-file input[type='file']");

        if (fileInput) {
            const fileWrapper = fileInput.closest(".btn-file") || fileInput.closest(".form-group") || fileInput;
            fileWrapper.scrollIntoView({ behavior: "smooth", block: "center" });

            if (typeof fileInput.showPicker === "function") {
                try {
                    fileInput.showPicker();
                    return true;
                } catch (e) {}
            }
            try {
                fileInput.click();
                return true;
            } catch (e) {}
        }
        return false;
    }

    /**
     * Memicu klik langsung pada tombol Pilih File dokumen BPHTB.
     */
    function openBphtbFilePicker() {
        const fileInput =
            document.querySelector("#txtUploadFileBPHTB") ||
            document.querySelector(S_BPHTB.inputFile) ||
            document.querySelector("input[name='UploadFromFileInstansi'][id*='BPHTB']") ||
            document.querySelector("#inputBPHTBplaceholder input[type='file']");

        if (fileInput) {
            const fileWrapper = fileInput.closest(".btn-file") || fileInput.closest(".form-group") || fileInput;
            fileWrapper.scrollIntoView({ behavior: "smooth", block: "center" });

            if (typeof fileInput.showPicker === "function") {
                try {
                    fileInput.showPicker();
                    return true;
                } catch (e) {}
            }
            try {
                fileInput.click();
                return true;
            } catch (e) {}
        }
        return false;
    }

    return {
        isSertifikatFilled,
        isSertifikatSaved,
        waitForSertifikatSaved,
        isPbbSaved,
        waitForPbbSaved,
        isBphtbSaved,
        waitForBphtbSaved,
        fillPbb,
        fillBphtb,
        fillAll,
        openPbbFilePicker,
        openBphtbFilePicker,
    };
})();
