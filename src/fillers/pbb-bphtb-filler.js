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
                    if (isSertifikatSaved()) {
                        cleanup();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            interval = setInterval(() => {
                if (isSertifikatSaved()) {
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
                    if (isPbbSaved()) {
                        cleanup();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            interval = setInterval(() => {
                if (isPbbSaved()) {
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
    function waitForBphtbSaved(timeoutMs = 45000) {
        if (isBphtbSaved()) return Promise.resolve(true);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector(S_BPHTB.daftarPlaceholder || "#bphtbplaceholder");

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
                    if (isBphtbSaved()) {
                        cleanup();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true });
            }

            interval = setInterval(() => {
                if (isBphtbSaved()) {
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
     * Memeriksa apakah data hasil validasi BPHTB sudah muncul di bawah tombol pilih file (#maxplaceholder).
     */
    function isBphtbValidationInfoLoaded() {
        const placeholder = document.querySelector("#maxplaceholder");
        if (!placeholder) return false;
        const text = (placeholder.textContent || "").trim();
        if (!text) return false;
        return (
            text.includes("Nama Wajib Pajak") ||
            text.includes("Nomor Bukti Bayar") ||
            text.includes("Status Validasi") ||
            text.includes("Letak Obyek") ||
            text.includes("Tanggal")
        );
    }

    /**
     * Melakukan klik di luar form BPHTB dan memicu blur/cekServiceBPHTB agar sistem ATR/BPN
     * memanggil /akta/Akta/maxValueBPHTB dan memunculkan data validasi di bawah tombol Pilih File.
     */
    function triggerClickOutsideBphtbForm() {
        console.log("AutoFill PPAT: Melakukan klik di luar form BPHTB untuk memicu validasi data...");
        const elBukti = document.querySelector(S_BPHTB.inputNomorBukti);
        if (elBukti) {
            elBukti.dispatchEvent(new Event("change", { bubbles: true }));
            elBukti.dispatchEvent(new Event("blur", { bubbles: true }));
            elBukti.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
            if (typeof elBukti.blur === "function") {
                elBukti.blur();
            }
        }

        // Klik area netral di luar form BPHTB (judul panel, body, atau wrapper luar)
        const outsideTargets = [
            document.querySelector("#inputBPHTBplaceholder .x_title"),
            document.querySelector("#inputBPHTBplaceholder"),
            document.querySelector(".right_col"),
            document.body,
        ];
        for (const target of outsideTargets) {
            if (target) {
                try {
                    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
                    target.click();
                } catch (e) {}
                break;
            }
        }

        // Panggil juga fungsi bawaan ATR/BPN di Main World
        dom.runInPageContext(() => {
            if (!window.jQuery) return;
            const $ = window.jQuery;
            $("#nomorbphtb").trigger("input").trigger("change").trigger("blur");
            if (typeof window.cekServiceBPHTB === "function") {
                try {
                    window.cekServiceBPHTB();
                } catch (e) {}
            }
        });
    }

    /**
     * Menunggu hingga data validasi BPHTB muncul di bawah tombol pilih file (#maxplaceholder)
     * dan loading overlay (.blockUI) selesai.
     */
    function waitForBphtbValidationInfo(timeoutMs = 25000) {
        if (isBphtbValidationInfoLoaded() && !document.querySelector(".blockUI.blockOverlay")) {
            return Promise.resolve(true);
        }

        return new Promise((resolve) => {
            const startTime = Date.now();
            const placeholder = document.querySelector("#maxplaceholder");

            let observer = null;
            if (placeholder) {
                observer = new MutationObserver(() => {
                    const isBlocking = !!document.querySelector(".blockUI.blockOverlay");
                    if (!isBlocking && isBphtbValidationInfoLoaded()) {
                        if (observer) observer.disconnect();
                        resolve(true);
                    }
                });
                observer.observe(placeholder, { childList: true, subtree: true, characterData: true });
            }

            let retryCount = 0;
            const interval = setInterval(() => {
                const isBlocking = !!document.querySelector(".blockUI.blockOverlay");
                if (!isBlocking && isBphtbValidationInfoLoaded()) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(true);
                } else if (Date.now() - startTime > timeoutMs) {
                    if (observer) observer.disconnect();
                    clearInterval(interval);
                    resolve(false);
                } else if (!isBlocking && !isBphtbValidationInfoLoaded() && Date.now() - startTime > (retryCount + 1) * 2000) {
                    retryCount++;
                    triggerClickOutsideBphtbForm();
                }
            }, 150);
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
        const autoSubmit = options.autoSubmit ?? true;

        // ---------------------------------------------------------------------
        // PRASYARAT MUTLAK: Sertipikat harus sudah terdaftar di daftar kanan (#daftarhatplaceholder)
        // ---------------------------------------------------------------------
        if (!isSertifikatSaved()) {
            if (options.waitForPrerequisite) {
                console.log("AutoFill PPAT: Menunggu Sertipikat terdaftar di Daftar Sertipikat HAT (#daftarhatplaceholder)...");
                const certOk = await waitForSertifikatSaved(options.prerequisiteTimeout || 45000);
                if (!certOk) {
                    if (options.showAlert) alert(MESSAGES.sertifikatBelumTerdaftar || "Sertipikat belum terdaftar pada daftar di sebelah kanan!");
                    console.warn("AutoFill PPAT: Sertipikat belum terdaftar di sisi kanan.");
                    return false;
                }
            } else {
                if (options.showAlert) alert(MESSAGES.sertifikatBelumTerdaftar || "Sertipikat belum terdaftar pada daftar di sebelah kanan!");
                return false;
            }
        }

        // Tunggu overlay blockUI hilang jika ada pasca-submit sertipikat
        const waitBlockStart = Date.now();
        while (Date.now() - waitBlockStart < 8000 && document.querySelector(".blockUI.blockOverlay")) {
            await dom.delay(100);
        }

        // ---------------------------------------------------------------------
        // TAHAP 1: Kolom Nomor Sertipikat (#alashakid), dipilih terlebih dahulu
        // ---------------------------------------------------------------------
        let selectCert = await dom.waitForElement(S_PBB.dropdownSertifikat, TIMING.PBB_FORM_TIMEOUT_MS);
        if (!selectCert) {
            console.warn(MESSAGES.pbbFormMissing);
            if (options.showAlert) alert(MESSAGES.pbbFormMissing);
            return false;
        }

        // Cari opsi nomor sertifikat valid (tunggu AJAX refreshPage jika baru saja ditambahkan)
        let validOption = selectCert.options ? Array.from(selectCert.options).find((opt) => opt.value && opt.value.trim() !== "") : null;
        if (!validOption) {
            const startWaitCert = Date.now();
            let refreshTriggered = false;
            while (Date.now() - startWaitCert < 20000) {
                await dom.delay(200);
                const curSelect = document.querySelector(S_PBB.dropdownSertifikat);
                if (curSelect && curSelect.options) {
                    selectCert = curSelect;
                    validOption = Array.from(curSelect.options).find((opt) => opt.value && opt.value.trim() !== "");
                    if (validOption) break;
                }

                // Jika setelah 1 detik opsi masih kosong, trigger refreshPage("alashakid") dari script halaman
                if (!refreshTriggered && Date.now() - startWaitCert > 1000) {
                    refreshTriggered = true;
                    console.log("AutoFill PPAT: Memicu refreshPage('alashakid') untuk memuat daftar sertipikat di dropdown PBB...");
                    dom.runInPageContext(() => {
                        if (typeof window.refreshPage === "function") {
                            window.refreshPage("alashakid");
                        }
                    });
                }
            }
        }

        if (!validOption) {
            console.warn("AutoFill PPAT: Pilihan Nomor Sertipikat pada dropdown PBB (#alashakid) tidak ditemukan atau belum dimuat.");
            if (options.showAlert) alert(MESSAGES.sertifikatBelumTerisi);
            return false;
        }

        selectCert = document.querySelector(S_PBB.dropdownSertifikat) || selectCert;
        // Arahkan scroll ke dropdown nomor sertifikat
        selectCert.scrollIntoView({ behavior: "smooth", block: "center" });

        // Pilih opsi sertifikat pertama di dropdown dan sinkronisasi ke Select2 & Main World jQuery
        dom.setSelect2Value(S_PBB.dropdownSertifikat, validOption.value);
        dom.runInPageContext((val) => {
            if (!window.jQuery) return;
            const $sel = window.jQuery("select#alashakid, #alashakplaceholder select");
            if ($sel.length) {
                $sel.val(val).trigger("change");
                if (typeof window.cekPersil === "function") {
                    window.cekPersil($sel[0]);
                }
            }
        }, validOption.value);

        // Beri jeda awal agar event change direspon oleh AJAX halaman (cekPersil)
        await dom.delay(350);

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

            // Jika belum respon setelah 2.5s, coba re-trigger cekPersil
            if (Date.now() - waitStartTime > 2500 && (Date.now() - waitStartTime) % 2000 < 120) {
                dom.runInPageContext((val) => {
                    if (window.jQuery && typeof window.cekPersil === "function") {
                        const el = document.getElementById("alashakid");
                        if (el) window.cekPersil(el);
                    }
                }, validOption.value);
            }

            await dom.delay(80);
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
        // TAHAP 4: Klik / Upload otomatis pada tombol pilih file (#txtUploadFilePBB)
        //          mengambil file PBB dari G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli]
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

            // Coba upload otomatis file PBB dari folder Pihak Kedua\[nama pembeli]
            const buyerName =
                options.buyerName ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            let autoUploaded = false;
            if (buyerName && PPAT.pembeliUploadFiller) {
                try {
                    console.log(`AutoFill PPAT: Mencari & mengunggah berkas PBB otomatis untuk pembeli "${buyerName}"...`);
                    const docData = options.pbbDocPromise
                        ? await options.pbbDocPromise
                        : await PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "pbb");

                    if (docData && docData.base64) {
                        const selector = fileInput.id ? `#${fileInput.id}` : S_PBB.inputFile;
                        const injectRes = await PPAT.pembeliUploadFiller.injectSectionFile("pbb", selector, docData);
                        if (injectRes && injectRes.success) {
                            autoUploaded = true;
                            console.log(`AutoFill PPAT: Berkas PBB (${docData.filename}) berhasil di-attach ke tombol Pilih File PBB!`);
                        } else {
                            console.warn("AutoFill PPAT: Gagal inject berkas PBB:", injectRes && injectRes.error);
                        }
                    }
                } catch (err) {
                    console.warn("AutoFill PPAT: Gagal mengambil berkas PBB dari folder pembeli:", err);
                }
            }

            if (autoUploaded && autoSubmit) {
                await dom.delay(TIMING.SUBMIT_DELAY_MS + 350);
                const submitBtn = document.querySelector(S_PBB.btnTambah);
                if (submitBtn) {
                    console.log("AutoFill PPAT: Menekan tombol Tambah PBB (#btn-tambahpbb)...");
                    submitBtn.click();
                }
            }
        } else {
            console.warn("AutoFill PPAT: Elemen tombol upload file PBB (#txtUploadFilePBB) tidak ditemukan.");
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
     * 4. Otomatis klik & upload file BPHTB ke tombol "Pilih File" (#txtUploadFileBPHTB) dari folder pembeli.
     * 5. Jika autoSubmit: otomatis klik tombol Tambah (#btn-tambahbphtb) setelah berkas terpasang.
     */
    async function fillBphtb(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

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

        // Lakukan klik di luar form sampai data validasi muncul di bawah tombol pilih file (#maxplaceholder)
        triggerClickOutsideBphtbForm();
        console.log("AutoFill PPAT: Menunggu data validasi BPHTB muncul di bawah tombol pilih file (#maxplaceholder)...");
        const validationOk = await waitForBphtbValidationInfo(options.validationTimeout || 35000);
        if (validationOk) {
            console.log("AutoFill PPAT: Data validasi BPHTB telah terkonfirmasi muncul di #maxplaceholder!");
        } else {
            console.warn("AutoFill PPAT: Batas waktu menunggu data validasi BPHTB di #maxplaceholder terlewati, melanjutkan pengisian.");
        }
        await dom.delay(350);

        // Otomatis klik & upload file BPHTB pada tombol "Pilih File" BPHTB (#txtUploadFileBPHTB)
        const fileInputBphtb =
            document.querySelector("#txtUploadFileBPHTB") ||
            document.querySelector(S_BPHTB.inputFile) ||
            document.querySelector("input[name='UploadFromFileInstansi'][id*='BPHTB']") ||
            document.querySelector("#inputBPHTBplaceholder input[type='file']");

        if (fileInputBphtb) {
            if (fileInputBphtb._ppatChangeHandler) {
                fileInputBphtb.removeEventListener("change", fileInputBphtb._ppatChangeHandler);
            }

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

            // Coba upload otomatis file BPHTB dari folder Pihak Kedua\[nama pembeli]
            const buyerName =
                options.buyerName ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            let autoUploaded = false;
            if (buyerName && PPAT.pembeliUploadFiller) {
                try {
                    console.log(`AutoFill PPAT: Mencari & mengunggah berkas BPHTB otomatis untuk pembeli "${buyerName}"...`);
                    const docData = options.bphtbDocPromise
                        ? await options.bphtbDocPromise
                        : await PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "bphtb");

                    if (docData && docData.base64) {
                        const selector = fileInputBphtb.id ? `#${fileInputBphtb.id}` : S_BPHTB.inputFile;
                        const injectRes = await PPAT.pembeliUploadFiller.injectSectionFile("bphtb", selector, docData);
                        if (injectRes && injectRes.success) {
                            autoUploaded = true;
                            console.log(`AutoFill PPAT: Berkas BPHTB (${docData.filename}) berhasil di-attach ke tombol Pilih File BPHTB!`);
                        } else {
                            console.warn("AutoFill PPAT: Gagal inject berkas BPHTB:", injectRes && injectRes.error);
                        }
                    }
                } catch (err) {
                    console.warn("AutoFill PPAT: Gagal mengambil berkas BPHTB dari folder pembeli:", err);
                }
            }

            if (autoUploaded && autoSubmit) {
                const submitBtn = document.querySelector(S_BPHTB.btnTambah);
                if (submitBtn) {
                    const waitBtnStart = Date.now();
                    while (submitBtn.disabled && Date.now() - waitBtnStart < 8000) {
                        await dom.delay(100);
                    }
                    await dom.delay(TIMING.SUBMIT_DELAY_MS + 350);
                    console.log("AutoFill PPAT: Menekan tombol Tambah BPHTB (#btn-tambahbphtb)...");
                    submitBtn.click();
                }
            }
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

    return {
        isSertifikatSaved,
        waitForSertifikatSaved,
        isPbbSaved,
        waitForPbbSaved,
        isBphtbSaved,
        waitForBphtbSaved,
        isBphtbValidationInfoLoaded,
        triggerClickOutsideBphtbForm,
        waitForBphtbValidationInfo,
        fillPbb,
        fillBphtb,
    };
})();
