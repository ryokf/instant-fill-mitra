/**
 * Controller panel melayang: merakit template dan menghubungkannya ke alur kerja (workflow)
 * 1. Upload AJB -> Isi Nomor & Tanggal Akta + Simpan Data Pembeli & Saksi
 * 2. Penjual PT -> Cocokkan nama PT dengan pt-database.js -> Isi Penjual PT & Pihak Persetujuan + Upload Berkas PT
 * 3. Penjual Perorangan -> Ekstrak & isi langsung Penjual & Pihak Persetujuan dari AJB
 * 4. Isi Section Pembeli dengan data Pembeli yang diekstrak dari AJB (+ auto-upload KK & KTP saat tersimpan)
 * 5. Upload Cek Sertipikat di halaman Berkas untuk mendapatkan NIB & Kode Sertipikat -> Isi ke ATR/BPN
 * 6. Otomatisasi penuh berurutan: PBB -> BPHTB -> PPh -> Saksi
 */
PPAT.panel = (() => {
    const { config, panelTemplate, sertipikatFiller } = PPAT;
    const { MESSAGES } = config;

    function create() {
        const existing = document.getElementById(panelTemplate.IDS.root);
        if (existing) existing.remove();

        document.body.appendChild(panelTemplate.createRoot());
        const els = panelTemplate.queryElements();

        setupVisibility(els);
        setupAktaUpload(els);
        setupSertipikatUpload(els);
        restoreSavedSaksi(els);
        setupSertipikatWatcher(els);

        // Inisialisasi pemantau otomatis submit pembeli untuk upload KK & KTP
        if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.initPembeliWatcher === "function") {
            PPAT.pembeliUploadFiller.initPembeliWatcher();
        }

        // Inisialisasi pemantau otomatis submit penjual perorangan untuk upload KK & KTP
        if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.initPenjualWatcher === "function") {
            PPAT.penjualUploadFiller.initPenjualWatcher();
        }
    }

    // -------------------------------------------------------------------------
    // Visibilitas panel (buka / minimize / toggle dari ikon toolbar)
    // -------------------------------------------------------------------------

    function setupVisibility({ panel, badge, btnMinimize, btnClose }) {
        const minimize = () => {
            panel.classList.add("hidden");
            badge.style.display = "block";
        };
        const expand = () => {
            panel.classList.remove("hidden");
            badge.style.display = "none";
        };

        btnMinimize.addEventListener("click", minimize);
        btnClose.addEventListener("click", minimize);
        badge.addEventListener("click", expand);

        // Toggle dari ikon toolbar (dikirim oleh background service worker)
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action !== MESSAGES.TOGGLE_PANEL_ACTION) return;
            panel.classList.contains("hidden") ? expand() : minimize();
        });
    }

    // -------------------------------------------------------------------------
    // Tampilan Kartu Penjual & Saksi
    // -------------------------------------------------------------------------

    function renderPenjualPeroranganCard(els, pPerorangan, pPersetujuan) {
        const {
            cardPenjualPerorangan,
            penjualPeroranganNama,
            penjualPeroranganNik,
            persetujuanPeroranganNama,
        } = els;
        if (!cardPenjualPerorangan) return;
        if (penjualPeroranganNama) penjualPeroranganNama.textContent = (pPerorangan && pPerorangan.nama) || "-";
        if (penjualPeroranganNik) penjualPeroranganNik.textContent = (pPerorangan && pPerorangan.nik) || "-";
        if (persetujuanPeroranganNama) {
            persetujuanPeroranganNama.textContent =
                (pPersetujuan && pPersetujuan.nama) ? pPersetujuan.nama : "(Tidak Ada)";
        }
        cardPenjualPerorangan.classList.remove("hidden");
    }

    function renderDetectedSaksiCard(els, saksiList) {
        if (!els || !els.cardDetectedSaksi) return;
        if (!Array.isArray(saksiList) || saksiList.length === 0) {
            els.cardDetectedSaksi.classList.add("hidden");
            return;
        }
        if (els.saksi1Nama) els.saksi1Nama.textContent = saksiList[0]?.nama || "-";
        if (els.saksi2Nama) els.saksi2Nama.textContent = saksiList[1]?.nama || "-";
        els.cardDetectedSaksi.classList.remove("hidden");
    }

    function restoreSavedSaksi(els) {
        if (PPAT.saksiFiller && typeof PPAT.saksiFiller.getSavedSaksi === "function") {
            PPAT.saksiFiller.getSavedSaksi().then((saved) => {
                if (saved && Array.isArray(saved) && saved.length > 0) {
                    PPAT.activeSaksiData = saved;
                    renderDetectedSaksiCard(els, saved);
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Langkah 2 & 3: Otomatisasi Penjual (PT atau Perorangan) & Pihak Persetujuan
    // -------------------------------------------------------------------------

    /**
     * Otomatisasi pengisian data penjual (PT atau Perorangan) beserta Pihak Persetujuan.
     * @param {Object} penjualInfo - Data penjual hasil ekstraksi backend
     * @param {Object} els - Referensi elemen-elemen panel
     * @param {Function} updateStatus - Callback untuk menampilkan status di panel
     * @param {string} prefix - Prefix teks status (misal nomor akta)
     * @returns {Promise<boolean>}
     */
    async function autoFillPenjualAndPersetujuan(penjualInfo, els, updateStatus, prefix = "") {
        if (!penjualInfo) return false;

        // Pastikan database PT dari Supabase sudah termuat
        if (PPAT.cloudDatabase && typeof PPAT.cloudDatabase.ensureLoaded === "function") {
            await PPAT.cloudDatabase.ensureLoaded();
        }

        const { cardPenjualPerorangan } = els;

        // Cari apakah data di penjualInfo cocok dengan salah satu PT di ptDatabase
        // (baik dari nama PT, maupun dari NIK/Nama pengurus/persetujuan PT)
        const ptName = penjualInfo.pt_name;
        let matchedKey = ptName && PPAT.ptMatcher ? PPAT.ptMatcher.findPtKeyByName(ptName) : null;

        if (!matchedKey && PPAT.ptDatabase) {
            const candidateNiks = [
                penjualInfo.pt_nik,
                penjualInfo.penjual_perorangan && penjualInfo.penjual_perorangan.nik,
                penjualInfo.persetujuan && penjualInfo.persetujuan.nik,
            ].filter(Boolean);

            const candidateNames = [
                penjualInfo.pt_representative,
                penjualInfo.penjual_perorangan && penjualInfo.penjual_perorangan.nama,
                penjualInfo.persetujuan && penjualInfo.persetujuan.nama,
            ].filter(Boolean);

            for (const [key, pt] of Object.entries(PPAT.ptDatabase)) {
                if (Array.isArray(pt.persetujuan)) {
                    const hasNikMatch = candidateNiks.some((nik) =>
                        pt.persetujuan.some((p) => p.nik && p.nik === nik)
                    );
                    const hasNameMatch = candidateNames.some((rawName) => {
                        const repNorm = PPAT.ptMatcher ? PPAT.ptMatcher.normalizeName(rawName) : "";
                        if (repNorm.length <= 3) return false;
                        return pt.persetujuan.some((p) => {
                            const pNorm = PPAT.ptMatcher ? PPAT.ptMatcher.normalizeName(p.nama) : "";
                            return pNorm.includes(repNorm) || repNorm.includes(pNorm);
                        });
                    });
                    if (hasNikMatch || hasNameMatch) {
                        matchedKey = key;
                        break;
                    }
                }
            }
        }

        const isPtSeller = Boolean(penjualInfo.is_pt || penjualInfo.pt_name || matchedKey);

        // ---------------------------------------------------------------------
        // KASUS 1 (Langkah 2): Penjual PT (Badan Hukum) -> Cocokkan dengan pt-database.js
        // ---------------------------------------------------------------------
        if (isPtSeller) {
            if (cardPenjualPerorangan) cardPenjualPerorangan.classList.add("hidden");

            if (matchedKey && PPAT.ptDatabase[matchedKey]) {
                const ptEntry = PPAT.ptDatabase[matchedKey];

                updateStatus(`⏳ ${prefix}Terdeteksi PT: ${ptEntry.penjual.nama}. Mengisi form PT Penjual & Pihak Persetujuan...`, "info");

                // Isi form penjual PT (Badan Hukum, BUMS, PT) ke website ATR/BPN
                // serta otomatis unggah dokumen PT & isi + unggah seluruh Pihak Persetujuan PT
                await PPAT.penjualFiller.fill(ptEntry.penjual, {
                    autoSubmit: true,
                    autoUploadDocs: true,
                });

                await PPAT.dom.delay(1000);

                updateStatus(
                    `✔ ${prefix}Penjual PT (${ptEntry.penjual.nama}) & seluruh berkas/persetujuan berhasil diproses!`,
                    "ok"
                );
                return true;
            } else {
                updateStatus(
                    `⚠ ${prefix}Terdeteksi PT: ${ptName || "Badan Hukum"}, namun tidak ditemukan kecocokan pada pt-database.js.`,
                    "warn"
                );
                return false;
            }
        }

        // ---------------------------------------------------------------------
        // KASUS 2 (Langkah 3): Penjual Perorangan -> Ekstrak langsung dari AJB
        // ---------------------------------------------------------------------
        if (penjualInfo.penjual_perorangan) {
            const pPerorangan = penjualInfo.penjual_perorangan;
            const pPersetujuan = penjualInfo.persetujuan;
            PPAT.activePenjualPerorangan = pPerorangan;
            PPAT.activePersetujuanPerorangan = pPersetujuan;

            if (cardPenjualPerorangan) {
                renderPenjualPeroranganCard(els, pPerorangan, pPersetujuan);
            }

            const buyerName =
                (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
                (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" && PPAT.pembeliUploadFiller.getActiveBuyerName()) ||
                "";

            updateStatus(`⏳ ${prefix}Penjual perorangan (${pPerorangan.nama}). Mengisi form penjual & upload KK/KTP...`, "info");
            await PPAT.penjualFiller.fillPerorangan(pPerorangan, {
                autoSubmit: true,
                autoUploadDocs: true,
                buyerName: buyerName,
            });

            let persetujuanInfoText = "";
            if (pPersetujuan && pPersetujuan.nama) {
                const alreadyInWeb =
                    PPAT.persetujuanFiller &&
                    PPAT.persetujuanFiller.isPersonAlreadyInDaftar(pPersetujuan.nama, pPersetujuan.nik);

                let setujuOk = alreadyInWeb;
                if (alreadyInWeb) {
                    console.log(`[Panel] Pihak Persetujuan perorangan (${pPersetujuan.nama}) sudah tercatat di daftar ATR/BPN. Melewati penambahan.`);
                    persetujuanInfoText = ` & Persetujuan (${pPersetujuan.nama}) [Sudah Ada]`;
                } else {
                    await PPAT.dom.delay(800);
                    updateStatus(`⏳ ${prefix}Mengisi data Pihak Persetujuan (${pPersetujuan.nama})...`, "info");
                    setujuOk = await PPAT.persetujuanFiller.fill(pPersetujuan, {
                        autoSubmit: true,
                        autoUploadDocs: false,
                    });
                    if (setujuOk) {
                        persetujuanInfoText = ` & Persetujuan (${pPersetujuan.nama})`;
                    }
                }

                // Otomatis unggah KTP Pihak Persetujuan (KTP PERSETUJUAN / fallback KTP PENJUAL) dari folder Pihak Kedua\[nama pembeli]
                if (setujuOk && PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.uploadPersetujuanPerorangan === "function") {
                    await PPAT.dom.delay(600);
                    updateStatus(`⏳ ${prefix}Mengunggah KTP Pihak Persetujuan (${pPersetujuan.nama})...`, "info");
                    const resKtpSetuju = await PPAT.penjualUploadFiller.uploadPersetujuanPerorangan(pPersetujuan.nama, buyerName, { isPerorangan: true });
                    if (resKtpSetuju && resKtpSetuju.success) {
                        persetujuanInfoText += resKtpSetuju.isFallback ? " + KTP Terunggah (KTP Penjual)" : " + KTP Terunggah";
                    }
                }
            }

            updateStatus(
                `✔ ${prefix}Penjual (${pPerorangan.nama})${persetujuanInfoText} berhasil diisi!`,
                "ok"
            );
            return true;
        }

        return false;
    }

    // -------------------------------------------------------------------------
    // Langkah 1 - 4: Upload AJB -> Akta, Penjual & Persetujuan, lalu Pembeli
    // -------------------------------------------------------------------------

    function setupAktaUpload(els) {
        const {
            dropzoneAkta,
            inputAkta,
            statusAkta,
            cardPembeli,
            pembeliNama,
            pembeliNik,
            pembeliPekerjaan,
            aktaNomor,
            aktaTanggal,
        } = els;

        if (!dropzoneAkta || !inputAkta) return;

        const setUploadStatus = (text, type = "info") => {
            statusAkta.classList.remove("hidden");
            statusAkta.className = "ppat-status " + type;
            statusAkta.textContent = text;
        };

        const renderPembeliCard = (data, akta) => {
            if (!cardPembeli) return;
            pembeliNama.textContent = data.nama || "-";
            pembeliNik.textContent = data.nik || "-";
            pembeliPekerjaan.textContent = data.pekerjaan || "-";
            if (aktaNomor) aktaNomor.textContent = (akta && akta.nomor_akta) || data.nomor_akta || "-";
            if (aktaTanggal) aktaTanggal.textContent = (akta && akta.tanggal_akta) || data.tanggal_akta || "-";
            cardPembeli.classList.remove("hidden");
        };

        const handlePdfFile = async (file) => {
            if (!file) return;

            if (!file.name.toLowerCase().endsWith(".pdf")) {
                setUploadStatus("Hanya file berkas PDF (.pdf) yang diperbolehkan.", "warn");
                return;
            }

            dropzoneAkta.classList.add("loading");
            setUploadStatus("⏳ Membaca nomor, tanggal akta, data penjual & pembeli dari AJB PDF...", "info");

            const formData = new FormData();
            formData.append("file", file, file.name);

            try {
                const response = await fetch(config.BACKEND_URL, {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (response.ok && result.success && result.data) {
                    // Simpan data pembeli untuk pengisian otomatis dan pencocokan folder dokumen pembeli
                    PPAT.activePembeliData = result.data;
                    if (
                        result.data.nama &&
                        PPAT.pembeliUploadFiller &&
                        typeof PPAT.pembeliUploadFiller.saveActiveBuyerName === "function"
                    ) {
                        PPAT.pembeliUploadFiller.saveActiveBuyerName(result.data.nama);
                    }
                    const aktaData = result.akta || {
                        nomor_akta: result.data.nomor_akta,
                        tanggal_akta: result.data.tanggal_akta,
                    };

                    renderPembeliCard(result.data, aktaData);

                    // Simpan data 2 saksi hasil ekstraksi akta AJB untuk diisi otomatis pada Langkah 6
                    if (result.saksi && Array.isArray(result.saksi) && result.saksi.length > 0) {
                        PPAT.activeSaksiData = result.saksi;
                        if (PPAT.saksiFiller && typeof PPAT.saksiFiller.saveSavedSaksi === "function") {
                            PPAT.saksiFiller.saveSavedSaksi(result.saksi);
                        }
                        renderDetectedSaksiCard(els, result.saksi);
                    }

                    // LANGKAH 1: Isi Nomor dan Tanggal Akta ke Section A (Input Akta)
                    let aktaStatusPrefix = "";
                    if (PPAT.aktaFiller && (aktaData.nomor_akta || aktaData.tanggal_akta)) {
                        await PPAT.aktaFiller.fill(aktaData, { autoSubmit: true });
                        aktaStatusPrefix = `Akta No. ${aktaData.nomor_akta || "-"} (${aktaData.tanggal_akta || "-"}) tersimpan. `;
                    }

                    // LANGKAH 2 & 3: Otomatisasi Pengisian Penjual (PT atau Perorangan) beserta Pihak Persetujuan
                    const penjualInfo = result.penjual;
                    await autoFillPenjualAndPersetujuan(penjualInfo, els, setUploadStatus, aktaStatusPrefix);

                    // LANGKAH 4: Mengisikan data pembeli di Section Pembeli dengan data yang sudah diekstrak dari AJB
                    if (PPAT.pembeliFiller) {
                        setUploadStatus(
                            `⏳ ${aktaStatusPrefix}Mengisi data Pihak Pembeli (${result.data.nama || "-"})...`,
                            "info"
                        );
                        await PPAT.dom.delay(500);
                        await PPAT.pembeliFiller.fill(result.data, {
                            autoSubmit: false,
                            scrollIntoView: true,
                        });
                        setUploadStatus(
                            `✔ ${aktaStatusPrefix}Data Akta, Penjual, Persetujuan & Pembeli (${result.data.nama || "-"}) berhasil diisi!`,
                            "ok"
                        );
                    }
                } else {
                    const err = result.error || result.message || "Gagal memproses akta PDF.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - Backend upload error:", err);
                setUploadStatus("⚠ Backend offline (127.0.0.1:3001). Jalankan backend terlebih dahulu.", "warn");
            } finally {
                dropzoneAkta.classList.remove("loading");
                inputAkta.value = "";
            }
        };

        // Klik untuk memilih file
        dropzoneAkta.addEventListener("click", () => {
            if (!dropzoneAkta.classList.contains("loading")) {
                inputAkta.click();
            }
        });

        inputAkta.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handlePdfFile(file);
        });

        // Drag & Drop
        dropzoneAkta.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzoneAkta.classList.add("dragover");
        });

        dropzoneAkta.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzoneAkta.classList.remove("dragover");
        });

        dropzoneAkta.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzoneAkta.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handlePdfFile(file);
        });

        // Tombol manual upload berkas KK & KTP Penjual Perorangan
        if (els.btnUploadPenjualPerorangan) {
            els.btnUploadPenjualPerorangan.addEventListener("click", async () => {
                const sellerName = (PPAT.activePenjualPerorangan && PPAT.activePenjualPerorangan.nama) || null;
                const buyerName =
                    (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
                    (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" && PPAT.pembeliUploadFiller.getActiveBuyerName()) ||
                    null;
                if (PPAT.penjualUploadFiller && typeof PPAT.penjualUploadFiller.runAutoUploadPerorangan === "function") {
                    await PPAT.penjualUploadFiller.runAutoUploadPerorangan(sellerName, buyerName);
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Langkah 5: Upload Cek Sertipikat & Ambil NIB + Kode Sertipikat -> Isi ke ATR/BPN
    // -------------------------------------------------------------------------

    function setupSertipikatUpload(els) {
        const {
            dropzoneSertipikat,
            inputSertipikat,
            statusSertipikat,
            cardSertipikat,
            sertipikatBerkas,
            sertipikatNib,
            sertipikatKode,
            btnCariBerkas,
            btnFillSertipikat,
        } = els;

        if (!dropzoneSertipikat || !inputSertipikat) return;

        let lastSertipikatData = null;

        const setUploadStatus = (text, type = "info") => {
            statusSertipikat.classList.remove("hidden");
            statusSertipikat.className = "ppat-status " + type;
            statusSertipikat.textContent = text;
        };

        const renderSertipikatCard = (data) => {
            if (!cardSertipikat) return;
            const berkasText = data.nomor_berkas
                ? `Berkas: ${data.nomor_berkas}/${data.tahun_berkas || "2026"}`
                : "Berkas: -";
            sertipikatBerkas.textContent = berkasText;
            sertipikatNib.textContent = data.nib_elektronik || data.nib || "-";
            sertipikatKode.textContent = data.kode_sertipikat || data.nomor_seri_blangko || "-";
            cardSertipikat.classList.remove("hidden");
        };

        // Muat data sertipikat yang tersimpan sebelumnya (jika ada)
        sertipikatFiller.getSavedSertipikat().then((saved) => {
            if (saved && (saved.nomor_berkas || saved.nib_elektronik || saved.kode_sertipikat)) {
                lastSertipikatData = saved;
                renderSertipikatCard(saved);
            }
        });

        // Sinkronisasi data sertipikat secara real-time antar-tab (dari tab Berkas ke tab AJB)
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === "local" && changes["ppat_sertipikat_data"]) {
                    const fresh = changes["ppat_sertipikat_data"].newValue;
                    if (fresh) {
                        lastSertipikatData = fresh;
                        renderSertipikatCard(fresh);
                    }
                }
            });
        }
        window.addEventListener("storage", (e) => {
            if (e.key === "ppat_sertipikat_data" && e.newValue) {
                try {
                    const fresh = JSON.parse(e.newValue);
                    lastSertipikatData = fresh;
                    renderSertipikatCard(fresh);
                } catch (err) {}
            }
        });

        const handleSertipikatFile = async (file) => {
            if (!file) return;

            if (!file.name.toLowerCase().endsWith(".pdf")) {
                setUploadStatus("Hanya file berkas PDF (.pdf) yang diperbolehkan.", "warn");
                return;
            }

            dropzoneSertipikat.classList.add("loading");
            setUploadStatus("⏳ Membaca data nomor berkas & sertipikat dari PDF...", "info");

            const formData = new FormData();
            formData.append("file", file, file.name);

            try {
                const response = await fetch(config.SERTIPIKAT_BACKEND_URL, {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (response.ok && result.success && result.data) {
                    lastSertipikatData = {
                        nomor_berkas: result.data.nomor_berkas || "",
                        tahun_berkas: result.data.tahun_berkas || "2026",
                        nib: result.data.nib || "",
                        nib_elektronik: result.data.nib_elektronik || "",
                        kode_sertipikat: result.data.nomor_seri_blangko || result.data.kode_sertipikat || "",
                        nomor_seri_blangko: result.data.nomor_seri_blangko || "",
                        source: "upload_pdf",
                        saved_at: Date.now(),
                    };

                    await sertipikatFiller.saveSertipikat(lastSertipikatData);
                    renderSertipikatCard(lastSertipikatData);

                    // Cek halaman saat ini:
                    if (sertipikatFiller.isBerkasPage()) {
                        if (!lastSertipikatData.nomor_berkas) {
                            setUploadStatus("⚠ Nomor berkas tidak terdeteksi dari PDF. Silakan periksa dokumen atau isi manual.", "warn");
                            return;
                        }
                        if (sertipikatFiller.isOpenedBerkasMatching(lastSertipikatData.nomor_berkas)) {
                            setUploadStatus("⏳ Berkas terbuka cocok! Mengunduh dokumen & mengambil Step 1...", "info");
                            const res = await sertipikatFiller.processOpenedBerkas(
                                lastSertipikatData.nomor_berkas,
                                lastSertipikatData.tahun_berkas,
                                (msg, type) => setUploadStatus(msg, type)
                            );
                            if (res) {
                                lastSertipikatData = res;
                                renderSertipikatCard(res);
                            }
                        } else {
                            setUploadStatus(`⏳ Berada di menu Berkas. Mencari Berkas No. ${lastSertipikatData.nomor_berkas}...`, "info");
                            const res = await sertipikatFiller.searchAndProcessBerkas(lastSertipikatData, (msg, type) => {
                                setUploadStatus(msg, type);
                            });
                            if (res) {
                                lastSertipikatData = res;
                                renderSertipikatCard(res);
                            }
                        }
                    } else if (sertipikatFiller.isAjbPage()) {
                        if (lastSertipikatData.nib_elektronik && lastSertipikatData.kode_sertipikat) {
                            setUploadStatus("⏳ Mengisi Section H (Input Sertipikat) di form AJB...", "info");
                            const ok = await sertipikatFiller.fillSertipikatAJB(lastSertipikatData, {
                                autoSubmit: true,
                            });
                            if (ok) {
                                setUploadStatus("✔ Form Sertipikat Elektronik berhasil diisi! Melanjutkan ke PBB, BPHTB, PPh & Saksi...", "ok");
                                await runPostSertipikatAutomation(els, setUploadStatus);
                            } else {
                                setUploadStatus("⚠ Form Sertipikat tidak ditemukan atau gagal diisi.", "warn");
                            }
                        } else {
                            setUploadStatus(
                                `✔ Berkas No. ${lastSertipikatData.nomor_berkas}/${lastSertipikatData.tahun_berkas} diekstrak. Silakan klik 'Cari di Berkas' untuk mengambil Kode Sertipikat.`,
                                "ok"
                            );
                        }
                    } else {
                        setUploadStatus(
                            `✔ Berkas No. ${lastSertipikatData.nomor_berkas}/${lastSertipikatData.tahun_berkas} diekstrak. Silakan buka menu Berkas atau halaman AJB.`,
                            "ok"
                        );
                    }
                } else {
                    const err = result.error || result.message || "Gagal memproses dokumen pengecekan sertipikat.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - Sertipikat Backend error:", err);
                setUploadStatus("⚠ Backend offline (127.0.0.1:3001). Jalankan start-backend.bat.", "warn");
            } finally {
                dropzoneSertipikat.classList.remove("loading");
                inputSertipikat.value = "";
            }
        };

        // Klik untuk memilih file
        dropzoneSertipikat.addEventListener("click", () => {
            if (!dropzoneSertipikat.classList.contains("loading")) {
                inputSertipikat.click();
            }
        });

        inputSertipikat.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleSertipikatFile(file);
        });

        // Drag & Drop
        dropzoneSertipikat.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzoneSertipikat.classList.add("dragover");
        });

        dropzoneSertipikat.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzoneSertipikat.classList.remove("dragover");
        });

        dropzoneSertipikat.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzoneSertipikat.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleSertipikatFile(file);
        });

        // Tombol aksi: Cari di Berkas
        if (btnCariBerkas) {
            btnCariBerkas.addEventListener("click", async () => {
                const freshData = (await sertipikatFiller.getSavedSertipikat()) || lastSertipikatData;
                if (!freshData || !freshData.nomor_berkas) {
                    setUploadStatus("Upload dokumen pengecekan sertipikat terlebih dahulu.", "warn");
                    return;
                }

                lastSertipikatData = freshData;
                renderSertipikatCard(freshData);

                if (sertipikatFiller.isBerkasPage()) {
                    if (!freshData.nomor_berkas) {
                        setUploadStatus("⚠ Nomor berkas tidak terdeteksi dari PDF. Silakan periksa dokumen atau isi manual.", "warn");
                        return;
                    }
                    if (sertipikatFiller.isOpenedBerkasMatching(freshData.nomor_berkas)) {
                        setUploadStatus("⏳ Memproses berkas yang terbuka (unduh dokumen & Step 1)...", "info");
                        const res = await sertipikatFiller.processOpenedBerkas(
                            freshData.nomor_berkas,
                            freshData.tahun_berkas,
                            (msg, type) => setUploadStatus(msg, type)
                        );
                        if (res) {
                            lastSertipikatData = res;
                            renderSertipikatCard(res);
                        }
                    } else {
                        setUploadStatus(`⏳ Menjalankan pencarian Berkas No. ${freshData.nomor_berkas}...`, "info");
                        const res = await sertipikatFiller.searchAndProcessBerkas(freshData, (msg, type) => {
                            setUploadStatus(msg, type);
                        });
                        if (res) {
                            lastSertipikatData = res;
                            renderSertipikatCard(res);
                        }
                    }
                } else {
                    setUploadStatus("⏳ Menyimpan antrean & mengalihkan ke menu Berkas...", "info");
                    await sertipikatFiller.setPendingFlow(freshData);
                    window.location.href = "https://ppat.atrbpn.go.id/intan/Berkas";
                }
            });
        }

        // Tombol aksi: Isi Sertipikat di halaman AJB
        if (btnFillSertipikat) {
            btnFillSertipikat.addEventListener("click", async () => {
                const freshData = (await sertipikatFiller.getSavedSertipikat()) || lastSertipikatData;
                if (!freshData || (!freshData.nib_elektronik && !freshData.kode_sertipikat && !freshData.nomor_berkas)) {
                    setUploadStatus("Upload dokumen pengecekan sertipikat terlebih dahulu.", "warn");
                    return;
                }

                lastSertipikatData = freshData;
                renderSertipikatCard(freshData);

                if (sertipikatFiller.isAjbPage()) {
                    setUploadStatus("⏳ Mengisi Form Sertipikat...", "info");
                    const ok = await sertipikatFiller.fillSertipikatAJB(freshData, {
                        autoSubmit: true,
                    });
                    if (ok) {
                        setUploadStatus("✔ Form Sertipikat berhasil diisi! Melanjutkan otomatis ke PBB, BPHTB, PPh & Saksi...", "ok");
                        await runPostSertipikatAutomation(els, setUploadStatus);
                    } else {
                        setUploadStatus("⚠ Form Sertipikat gagal diisi atau tidak ditemukan.", "warn");
                    }
                } else {
                    window.location.href = "https://ppat.atrbpn.go.id/akta/Peralihan/AJB";
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Langkah 6: Otomatisasi Beruntun Pasca-Sertipikat (PBB -> BPHTB -> PPh -> Saksi)
    // -------------------------------------------------------------------------

    let isPostSertipikatRunning = false;

    async function runPostSertipikatAutomation(els, onStatus = null) {
        if (isPostSertipikatRunning) {
            console.log("AutoFill PPAT: Alur pasca-sertipikat sedang berjalan, melewati pemanggilan duplikat.");
            return;
        }
        if (!sertipikatFiller || !sertipikatFiller.isAjbPage()) return;

        isPostSertipikatRunning = true;

        const updateAllStatus = (msg, type = "info") => {
            console.log(`AutoFill PPAT [Post-Sertipikat]: ${msg}`);
            if (typeof onStatus === "function") {
                try { onStatus(msg, type); } catch (_) {}
            }
            if (els) {
                if (els.statusSertipikat) {
                    els.statusSertipikat.classList.remove("hidden");
                    els.statusSertipikat.className = "ppat-status " + type;
                    els.statusSertipikat.textContent = msg;
                }
                if (els.statusBphtb) {
                    els.statusBphtb.classList.remove("hidden");
                    els.statusBphtb.className = "ppat-status " + type;
                    els.statusBphtb.textContent = msg;
                }
            }
        };

        try {
            const certAlreadySaved = PPAT.pbbBphtbFiller && PPAT.pbbBphtbFiller.isSertifikatSaved();
            if (certAlreadySaved) {
                updateAllStatus("✔ Sertipikat terdeteksi di 'Daftar Sertipkat HAT'. Memulai pengisian otomatis PBB & BPHTB...", "ok");
            } else {
                updateAllStatus("⏳ Memeriksa / Menunggu Sertipikat terdaftar di 'Daftar Sertipkat HAT' (#daftarhatplaceholder)...", "info");
                const certSaved = await PPAT.pbbBphtbFiller.waitForSertifikatSaved(60000);
                if (!certSaved) {
                    updateAllStatus("⚠ Sertipikat belum terdaftar di sisi kanan dalam batas waktu.", "warn");
                    return;
                }
                updateAllStatus("✔ Sertipikat terkonfirmasi di Daftar Sertipkat HAT!", "ok");
            }

            await PPAT.dom.delay(500);

            // Identifikasi nama pembeli untuk mencari folder G:\My Drive\notaris bu sri\Pihak Kedua\[nama pembeli]
            let buyerName =
                (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            // Tunggu nama pembeli jika halaman baru selesai memuat AJAX pihak 2
            if (!buyerName && PPAT.pembeliUploadFiller) {
                const startWaitBuyer = Date.now();
                while (Date.now() - startWaitBuyer < 6000) {
                    await PPAT.dom.delay(250);
                    buyerName = PPAT.pembeliUploadFiller.getActiveBuyerName();
                    if (buyerName) break;
                }
            }

            let bphtbData = PPAT.activeBphtbData || null;
            let pphData = PPAT.activePphData || null;

            // Ekstrak otomatis data BPHTB/PBB dan PPh dari folder pembeli
            if (buyerName && PPAT.pembeliUploadFiller) {
                if (!bphtbData) {
                    updateAllStatus(`⏳ Mengambil data PBB & BPHTB dari folder pembeli "${buyerName}"...`, "info");
                    try {
                        bphtbData = await PPAT.pembeliUploadFiller.extractBuyerBphtb(buyerName);
                        if (bphtbData) {
                            PPAT.activeBphtbData = bphtbData;
                            if (els && els.cardBphtb) {
                                if (els.bphtbNop) {
                                    els.bphtbNop.textContent = bphtbData.nop
                                        ? `NOP: ${bphtbData.nop}`
                                        : bphtbData.nama_wajib_pajak || "Dokumen BPHTB";
                                }
                                if (els.bphtbLuas) {
                                    els.bphtbLuas.textContent =
                                        bphtbData.luas_tanah !== undefined ? bphtbData.luas_tanah : "-";
                                }
                                if (els.bphtbNjop) {
                                    els.bphtbNjop.textContent = bphtbData.njop_m2
                                        ? `Rp ${bphtbData.njop_m2.toLocaleString("id-ID")}`
                                        : "-";
                                }
                                if (els.bphtbNoBukti) {
                                    els.bphtbNoBukti.textContent = bphtbData.nomor_bukti_pembayaran || "-";
                                }
                                els.cardBphtb.classList.remove("hidden");
                            }
                        }
                    } catch (err) {
                        console.warn("AutoFill PPAT: Gagal ekstraksi BPHTB dari folder pembeli:", err);
                    }
                }

                if (!pphData) {
                    updateAllStatus(`⏳ Mengambil data PPh dari folder pembeli "${buyerName}"...`, "info");
                    try {
                        pphData = await PPAT.pembeliUploadFiller.extractBuyerPph(buyerName);
                        if (pphData) {
                            PPAT.activePphData = pphData;
                            if (els && els.cardPph) {
                                if (els.pphSuket) els.pphSuket.textContent = pphData.nomor_suket || "Dokumen PPh";
                                if (els.pphNpwp) {
                                    els.pphNpwp.textContent =
                                        pphData.npwp_formatted || pphData.npwp || "-";
                                }
                                if (els.pphNama) els.pphNama.textContent = pphData.nama_wp || "-";
                                if (els.pphTanggal) els.pphTanggal.textContent = pphData.tanggal_suket || "-";
                                els.cardPph.classList.remove("hidden");
                            }
                        }
                    } catch (err) {
                        console.warn("AutoFill PPAT: Gagal ekstraksi PPh dari folder pembeli:", err);
                    }
                }
            }

            // Pre-fetch berkas PBB, BPHTB, dan PPh secara paralel dari folder pembeli
            const pbbDocPromise =
                buyerName && PPAT.pembeliUploadFiller
                    ? PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "pbb")
                    : Promise.resolve(null);
            const bphtbDocPromise =
                buyerName && PPAT.pembeliUploadFiller
                    ? PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "bphtb")
                    : Promise.resolve(null);
            const pphDocPromise =
                buyerName && PPAT.pembeliUploadFiller
                    ? PPAT.pembeliUploadFiller.downloadPembeliDocument(buyerName, "pph")
                    : Promise.resolve(null);

            // -----------------------------------------------------------------
            // TAHAP 1: Pengisian Otomatis Section PBB + Upload File PBB
            // -----------------------------------------------------------------
            if (bphtbData) {
                if (!PPAT.pbbBphtbFiller.isPbbSaved()) {
                    updateAllStatus("⏳ [1/4] Mengisi otomatis Section PBB & mengunggah file PBB...", "info");
                    const pbbOk = await PPAT.pbbBphtbFiller.fillPbb(bphtbData, {
                        autoSubmit: true,
                        continueToBphtb: false,
                        waitForPrerequisite: false,
                        buyerName,
                        pbbDocPromise,
                    });

                    if (pbbOk) {
                        updateAllStatus("⏳ Menunggu PBB tersimpan di 'Daftar PBB' (#daftarpbbplaceholder)...", "info");
                        const pbbSaved = await PPAT.pbbBphtbFiller.waitForPbbSaved(45000);
                        if (!pbbSaved) {
                            updateAllStatus("⚠ PBB belum terkonfirmasi di Daftar PBB. Menghentikan antrean BPHTB.", "warn");
                            return;
                        }
                        updateAllStatus("✔ PBB terkonfirmasi tersimpan di Daftar PBB!", "ok");
                    }
                    await PPAT.dom.delay(500);
                } else {
                    updateAllStatus("✔ PBB sudah terdaftar di sisi kanan. Melanjutkan ke BPHTB...", "ok");
                }

                // -------------------------------------------------------------
                // TAHAP 2: Pengisian Otomatis Section BPHTB + Upload File BPHTB
                // -------------------------------------------------------------
                if (PPAT.pbbBphtbFiller.isPbbSaved() && !PPAT.pbbBphtbFiller.isBphtbSaved()) {
                    updateAllStatus("⏳ [2/4] Mengisi Section BPHTB, menunggu info validasi, & mengunggah file BPHTB...", "info");
                    const bphtbOk = await PPAT.pbbBphtbFiller.fillBphtb(bphtbData, {
                        autoSubmit: true,
                        continueToPph: false,
                        waitForPrerequisite: false,
                        buyerName,
                        bphtbDocPromise,
                    });

                    if (bphtbOk) {
                        updateAllStatus("⏳ Menunggu BPHTB tersimpan di 'Daftar BPHTB' (#bphtbplaceholder)...", "info");
                        const bphtbSaved = await PPAT.pbbBphtbFiller.waitForBphtbSaved(45000);
                        if (bphtbSaved) {
                            updateAllStatus("✔ BPHTB terkonfirmasi tersimpan di Daftar BPHTB!", "ok");
                        }
                    }
                    await PPAT.dom.delay(500);
                }
            } else {
                updateAllStatus(
                    `⚠ Data BPHTB/PBB tidak ditemukan untuk pembeli "${buyerName || "-"}". Pastikan berkas BPHTB tersedia di folder pembeli.`,
                    "warn"
                );
            }

            // -----------------------------------------------------------------
            // TAHAP 3: Pengisian Otomatis Section PPh + Upload File PPh
            // -----------------------------------------------------------------
            if (pphData && PPAT.pphFiller) {
                updateAllStatus("⏳ [3/4] Mengisi otomatis Section PPh & mengunggah file PPh...", "info");
                if (els && els.statusPph) {
                    els.statusPph.classList.remove("hidden");
                    els.statusPph.className = "ppat-status info";
                    els.statusPph.textContent = "⏳ Mengisi otomatis Section PPh & mengunggah file PPh...";
                }

                await PPAT.pphFiller.fill(pphData, {
                    autoSubmit: true,
                    showAlert: false,
                    buyerName,
                    pphDocPromise,
                });

                if (els && els.statusPph) {
                    els.statusPph.className = "ppat-status ok";
                    els.statusPph.textContent = "✔ Section PPh & berkas PPh berhasil diisi dan diunggah!";
                }
                await PPAT.dom.delay(500);
            }

            // -----------------------------------------------------------------
            // TAHAP 4: Pengisian Otomatis 2 Pihak Saksi + Upload KTP Saksi
            // -----------------------------------------------------------------
            let saksiData = PPAT.activeSaksiData;
            if (!saksiData && PPAT.saksiFiller && typeof PPAT.saksiFiller.getSavedSaksi === "function") {
                saksiData = await PPAT.saksiFiller.getSavedSaksi();
                if (saksiData) PPAT.activeSaksiData = saksiData;
            }

            if (saksiData && Array.isArray(saksiData) && saksiData.length > 0 && PPAT.saksiFiller) {
                const saksiDone = PPAT.saksiFiller.areAllSaksiInDaftar(saksiData);
                if (!saksiDone) {
                    updateAllStatus("⏳ [4/4] Mengisi otomatis 2 Pihak Saksi & mengunggah KTP saksi...", "info");
                    if (els && els.statusSaksi) {
                        els.statusSaksi.classList.remove("hidden");
                        els.statusSaksi.className = "ppat-status info";
                        els.statusSaksi.textContent = "⏳ Mengisi 2 Saksi & mengunggah KTP saksi...";
                    }
                    await PPAT.saksiFiller.fillAndUploadSaksiList(saksiData, {
                        autoSubmit: true,
                        autoUploadDocs: true,
                        onStatus: (msg, type) => {
                            updateAllStatus(`[Saksi] ${msg}`, type);
                            if (els && els.statusSaksi) {
                                els.statusSaksi.classList.remove("hidden");
                                els.statusSaksi.className = "ppat-status " + type;
                                els.statusSaksi.textContent = msg;
                            }
                        },
                    });
                } else {
                    updateAllStatus("✔ Seluruh Pihak Saksi sudah tercatat di sisi kanan.", "ok");
                }
            }

            if (bphtbData || pphData || saksiData) {
                updateAllStatus(
                    "✔ Otomatisasi selesai! Section Sertipikat, PBB, BPHTB, PPh, dan Saksi beserta seluruh file berhasil diisi & diunggah!",
                    "ok"
                );
            }
        } catch (err) {
            console.error("AutoFill PPAT: Error pada runPostSertipikatAutomation:", err);
            updateAllStatus(`⚠ Terjadi kendala: ${err?.message || err}`, "warn");
        } finally {
            isPostSertipikatRunning = false;
        }
    }

    function setupSertipikatWatcher(els) {
        if (!sertipikatFiller || !sertipikatFiller.isAjbPage()) return;

        let debounceTimer = null;
        const triggerPostSertipikat = () => {
            if (isPostSertipikatRunning) return;
            const certSaved = PPAT.pbbBphtbFiller && PPAT.pbbBphtbFiller.isSertifikatSaved();
            const pbbSaved = PPAT.pbbBphtbFiller && PPAT.pbbBphtbFiller.isPbbSaved();
            // Jalankan jika sertipikat sudah terdaftar dan PBB belum selesai
            if (certSaved && !pbbSaved) {
                console.log("AutoFill PPAT: Sertipikat terdaftar & PBB belum tersimpan! Memulai alur otomatis pasca-sertipikat...");
                runPostSertipikatAutomation(els);
            }
        };

        const scheduleCheck = (delay = 300) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(triggerPostSertipikat, delay);
        };

        // 1. Pantau perubahan DOM pada #daftarhatplaceholder (saat baris sertipikat ditambahkan via AJAX)
        const certPlaceholder = document.querySelector("#daftarhatplaceholder");
        if (certPlaceholder) {
            const observer = new MutationObserver(() => {
                scheduleCheck(200);
            });
            observer.observe(certPlaceholder, { childList: true, subtree: true });
        }

        // 2. Pantau event klik pada tombol Cek (#btn-tambahhat) dan Simpan (#btn-simpanhat)
        document.addEventListener(
            "click",
            (e) => {
                const btn = e.target && e.target.closest && (
                    e.target.closest("#btn-tambahhat") ||
                    e.target.closest("#btn-simpanhat") ||
                    e.target.closest("#txtUploadDokumenHat") ||
                    e.target.closest("#myModalInfoSertipikat button") ||
                    e.target.closest("#divsidenavhat button")
                );
                if (btn) {
                    scheduleCheck(800);
                }
            },
            true
        );

        // 3. Heartbeat berkala setiap 2 detik untuk menangkap keadaan ketika halaman selesai render AJAX
        const heartbeat = setInterval(() => {
            if (!sertipikatFiller || !sertipikatFiller.isAjbPage()) {
                clearInterval(heartbeat);
                return;
            }
            if (!isPostSertipikatRunning) {
                const certSaved = PPAT.pbbBphtbFiller && PPAT.pbbBphtbFiller.isSertifikatSaved();
                const pbbSaved = PPAT.pbbBphtbFiller && PPAT.pbbBphtbFiller.isPbbSaved();
                if (certSaved && !pbbSaved) {
                    triggerPostSertipikat();
                }
            }
        }, 2000);

        // 4. Periksa langsung saat inisialisasi panel jika sertipikat sudah tersimpan di halaman
        setTimeout(scheduleCheck, 500);
    }

    return { create };
})();
