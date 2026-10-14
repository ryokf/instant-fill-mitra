/**
 * Controller panel melayang: merakit template, daftar orang, deteksi PT,
 * dan menghubungkannya ke filler.
 */
PPAT.panel = (() => {
    const { config, panelTemplate, personList, pageReader, ptMatcher, sertipikatFiller } = PPAT;
    const { MESSAGES, TIMING } = config;

    /** Hasil pembacaan halaman web terhadap database PT. */
    const DetectResult = Object.freeze({
        NO_PENJUAL: "no-penjual",
        UNKNOWN_PT: "unknown-pt",
        FOUND: "found",
    });

    function create() {
        const existing = document.getElementById(panelTemplate.IDS.root);
        if (existing) existing.remove();

        document.body.appendChild(panelTemplate.createRoot());
        const els = panelTemplate.queryElements();

        setupVisibility(els);
        populatePtSelect(els.selectPt);
        renderSaksiList(els.listSaksi);
        renderPersetujuanList(els.listPersetujuan, null);
        setupPtSelection(els);
        setupAutoDetection(els);
        setupFillPenjualButton(els);
        setupAktaUpload(els);
        setupSertipikatUpload(els);
        setupBphtbUpload(els);
        setupPphUpload(els);
    }

    /** Memeriksa apakah opsi otomatis klik "Tambah" sedang aktif di panel. */
    function isAutoSubmit() {
        const chk = document.getElementById(panelTemplate.IDS.chkAutoSubmit);
        return chk ? chk.checked : true;
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
    // Dropdown PT & daftar orang
    // -------------------------------------------------------------------------

    function populatePtSelect(selectEl) {
        Object.entries(PPAT.ptDatabase).forEach(([key, pt]) => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = pt.penjual.nama;
            selectEl.appendChild(option);
        });
    }

    function renderPersetujuanList(listEl, ptKey) {
        const pt = ptKey ? PPAT.ptDatabase[ptKey] : null;
        personList.render(listEl, pt ? pt.persetujuan : [], {
            emptyMessage: "-- Pilih PT Dulu --",
            tooltip: "Klik untuk mengisi form Pihak Persetujuan",
            onSelect: (orang) => PPAT.persetujuanFiller.fill(orang, { autoSubmit: isAutoSubmit() }),
        });
    }

    /** Daftar saksi tidak terikat PT manapun. */
    function renderSaksiList(listEl) {
        personList.render(listEl, PPAT.saksiDatabase, {
            emptyMessage: "-- Belum ada data saksi --",
            tooltip: "Klik untuk mengisi form Pihak Saksi",
            onSelect: (saksi) => PPAT.saksiFiller.fill(saksi, { autoSubmit: isAutoSubmit() }),
        });
    }

    function setupPtSelection({ selectPt, listPersetujuan }) {
        selectPt.addEventListener("change", (e) => {
            const ptKey = e.target.value;
            renderPersetujuanList(listPersetujuan, ptKey);
            // Saat user memilih PT di dropdown, langsung isi form dan klik "Tambah"
            if (ptKey && PPAT.ptDatabase[ptKey]) {
                PPAT.penjualFiller.fill(PPAT.ptDatabase[ptKey].penjual, { autoSubmit: isAutoSubmit() });
            }
        });
    }

    function setupFillPenjualButton({ selectPt, btnFillPenjual }) {
        btnFillPenjual.addEventListener("click", () => {
            const ptKey = selectPt.value;
            if (!ptKey) return alert(MESSAGES.selectPtFirst);
            PPAT.penjualFiller.fill(PPAT.ptDatabase[ptKey].penjual, { autoSubmit: isAutoSubmit() });
        });
    }

    // -------------------------------------------------------------------------
    // Deteksi PT otomatis dari halaman web
    // -------------------------------------------------------------------------

    /** @returns {{type: string, key?: string, name?: string}} */
    function detectFromPage() {
        const names = pageReader.readPenjualNames();
        if (names.length === 0) return { type: DetectResult.NO_PENJUAL };

        const match = ptMatcher.findFirstMatch(names);
        if (!match) return { type: DetectResult.UNKNOWN_PT };

        return { type: DetectResult.FOUND, key: match.key, name: match.name };
    }

    function setupAutoDetection({ selectPt, listPersetujuan, statusBox, statusText, btnRedetect }) {
        let lastDetectedKey = null;

        const setStatus = (text, type) => {
            statusText.textContent = text;
            statusBox.className = "ppat-status " + (type || "");
        };

        /** @param {boolean} force paksa perbarui UI walau hasil sama */
        const detect = (force) => {
            const result = detectFromPage();

            switch (result.type) {
                case DetectResult.NO_PENJUAL:
                    if (force || !selectPt.value) {
                        setStatus("Penjual belum tercatat di web. Pilih manual.", "warn");
                    }
                    break;

                case DetectResult.UNKNOWN_PT:
                    if (force) setStatus("Nama PT di web belum ada di database.", "warn");
                    break;

                case DetectResult.FOUND:
                    if (force || result.key !== lastDetectedKey) {
                        lastDetectedKey = result.key;
                        selectPt.value = result.key;
                        renderPersetujuanList(listPersetujuan, result.key);
                        setStatus("✔ Terdeteksi: " + result.name, "ok");
                    }
                    break;
            }
        };

        btnRedetect.addEventListener("click", () => detect(true));

        detect(true);

        // Pengecekan berkala agar saat user klik "Tambah" di web PPAT,
        // panel otomatis mendeteksi PT dan memunculkan personil pihak persetujuan
        setInterval(() => detect(false), TIMING.DETECT_INTERVAL_MS);
    }

    // -------------------------------------------------------------------------
    // Upload & Auto-Fill Pihak Pembeli dari Akta PDF via pembeli-backend
    // -------------------------------------------------------------------------

    function setupAktaUpload(els) {
        const {
            dropzoneAkta,
            inputAkta,
            statusAkta,
            cardPembeli,
            btnFillPembeli,
            pembeliNama,
            pembeliNik,
            pembeliPekerjaan,
            aktaNomor,
            aktaTanggal,
        } = els;

        if (!dropzoneAkta || !inputAkta) return;

        let lastPembeliData = null;

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
            setUploadStatus("⏳ Membaca nomor, tanggal akta & data pembeli dari PDF...", "info");

            const formData = new FormData();
            formData.append("file", file, file.name);

            try {
                const response = await fetch(config.BACKEND_URL, {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (response.ok && result.success && result.data) {
                    lastPembeliData = result.data;
                    const aktaData = result.akta || {
                        nomor_akta: result.data.nomor_akta,
                        tanggal_akta: result.data.tanggal_akta,
                    };

                    renderPembeliCard(result.data, aktaData);

                    // 1. Ekstrak & isi Nomor dan Tanggal Akta ke Section A (Input Akta)
                    // Setelah semua kolom di section Input Akta terisi, klik tombol simpan secara otomatis
                    let aktaStatusPrefix = "";
                    if (PPAT.aktaFiller && (aktaData.nomor_akta || aktaData.tanggal_akta)) {
                        await PPAT.aktaFiller.fill(aktaData, { autoSubmit: true });
                        aktaStatusPrefix = `Akta No. ${aktaData.nomor_akta || "-"} (${aktaData.tanggal_akta || "-"}) tersimpan. `;
                    }

                    // 2. Langsung otomatis isi ke form di web PPAT (khusus pembeli tidak auto-submit agar bisa direview)
                    if (PPAT.pembeliFiller) {
                        await PPAT.pembeliFiller.fill(result.data, {
                            autoSubmit: false,
                            scrollIntoView: true,
                        });
                    }

                    setUploadStatus(`✔ ${aktaStatusPrefix}Data pembeli (${result.data.nama}) siap direview.`, "ok");
                } else {
                    const err = result.error || result.message || "Gagal memproses akta PDF.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - Backend upload error:", err);
                setUploadStatus("⚠ Backend offline (127.0.0.1:3001). Jalankan pembeli-backend.", "warn");
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

        // Tombol isi ulang pembeli
        if (btnFillPembeli) {
            btnFillPembeli.addEventListener("click", () => {
                if (lastPembeliData && PPAT.pembeliFiller) {
                    PPAT.pembeliFiller.fill(lastPembeliData, {
                        autoSubmit: false,
                        scrollIntoView: true,
                    });
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Upload & Auto-Fill Sertipikat & Berkas via sertipikat-backend
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

        // Sinkronisasi data sertipikat secara real-time antar-tab (misal dari tab Berkas ke tab AJB)
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
                    // Reset total data lama dengan data baru yang baru diekstrak dari PDF
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
                        if (sertipikatFiller.isOpenedBerkasMatching(lastSertipikatData.nomor_berkas)) {
                            // Jika berkas yang dibuka saat ini memang berkas yang sama
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
                            // Berkas lain atau belum dicari: jalankan pencarian otomatis untuk berkas ini
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
                        // Di halaman AJB
                        if (lastSertipikatData.nib_elektronik && lastSertipikatData.kode_sertipikat) {
                            setUploadStatus("⏳ Mengisi Section H (Input Sertipikat) di form AJB...", "info");
                            const ok = await sertipikatFiller.fillSertipikatAJB(lastSertipikatData, {
                                autoSubmit: isAutoSubmit(),
                            });
                            if (ok) {
                                setUploadStatus("✔ Form Sertipikat Elektronik berhasil diisi!", "ok");
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
                setUploadStatus("⚠ Backend offline (127.0.0.1:3003). Jalankan start-sertipikat-backend.bat.", "warn");
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
                        autoSubmit: isAutoSubmit(),
                    });
                    if (ok) {
                        setUploadStatus("✔ Form Sertipikat berhasil diisi!", "ok");
                    } else {
                        setUploadStatus("⚠ Form Sertipikat gagal diisi atau tidak ditemukan.", "warn");
                    }
                } else {
                    // Navigasi ke halaman AJB
                    window.location.href = "https://ppat.atrbpn.go.id/akta/Peralihan/AJB";
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Upload & Auto-Fill PBB & BPHTB dari Dokumen BPHTB via pbb-bphtb-backend
    // -------------------------------------------------------------------------

    function setupBphtbUpload(els) {
        const {
            dropzoneBphtb,
            inputBphtb,
            statusBphtb,
            cardBphtb,
            bphtbNop,
            bphtbLuas,
            bphtbNjop,
            bphtbNoBukti,
            btnFillPbbBphtb,
            btnFillPbbOnly,
            btnFillBphtbOnly,
        } = els;

        if (!dropzoneBphtb || !inputBphtb) return;

        let lastBphtbData = null;

        const setUploadStatus = (text, type = "info", isHtml = false) => {
            statusBphtb.classList.remove("hidden");
            statusBphtb.className = "ppat-status " + type;
            if (isHtml) {
                statusBphtb.innerHTML = text;
            } else {
                statusBphtb.textContent = text;
            }
        };

        const renderBphtbCard = (data) => {
            if (!cardBphtb) return;
            bphtbNop.textContent = data.nop ? `NOP: ${data.nop}` : (data.nama_wajib_pajak || "Dokumen BPHTB");
            bphtbLuas.textContent = data.luas_tanah !== undefined ? data.luas_tanah : "-";
            bphtbNjop.textContent = data.njop_m2 ? `Rp ${data.njop_m2.toLocaleString("id-ID")}` : "-";
            bphtbNoBukti.textContent = data.nomor_bukti_pembayaran || "-";
            cardBphtb.classList.remove("hidden");
        };

        const handleBphtbFile = async (file) => {
            if (!file) return;

            const name = file.name.toLowerCase();
            const isValid = name.endsWith(".pdf") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
            if (!isValid) {
                setUploadStatus("Berkas harus berformat PDF (.pdf) atau Gambar (.jpg, .png).", "warn");
                return;
            }

            dropzoneBphtb.classList.add("loading");
            setUploadStatus("⏳ Membaca & mengekstrak data PBB/BPHTB dari dokumen...", "info");

            const formData = new FormData();
            formData.append("file", file, file.name);

            try {
                const response = await fetch(config.BPHTB_BACKEND_URL, {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (response.ok && result.success && result.data) {
                    lastBphtbData = result.data;
                    renderBphtbCard(result.data);

                    // Periksa apakah data PBB sudah tersimpan sebelumnya pada daftar di sebelah kanan
                    if (PPAT.pbbBphtbFiller.isPbbSaved()) {
                        setUploadStatus("ℹ PBB sudah terinput di daftar sebelah kanan. Mengisi Form BPHTB...", "info");
                        const ok = await PPAT.pbbBphtbFiller.fillBphtb(result.data, {
                            autoSubmit: isAutoSubmit(),
                        });
                        if (ok) {
                            setUploadStatus(
                                `✔ Form BPHTB berhasil diisi! Silakan pilih berkas dokumen BPHTB.<br><button id="btn-pick-bphtb-file" style="margin-top:6px; width:100%; padding:5px 8px; font-size:11px; font-weight:600; background:#f0ad4e; color:#fff; border:none; border-radius:4px; cursor:pointer;">📁 Buka Dialog Pilih File BPHTB</button>`,
                                "ok",
                                true
                            );
                            const pickBtn = document.getElementById("btn-pick-bphtb-file");
                            if (pickBtn) {
                                pickBtn.onclick = () => PPAT.pbbBphtbFiller.openBphtbFilePicker();
                            }
                        }
                    } else {
                        setUploadStatus("⏳ Mengisi Form PBB di web PPAT...", "info");

                        const success = await PPAT.pbbBphtbFiller.fillPbb(result.data, {
                            autoSubmit: isAutoSubmit(),
                            continueToBphtb: true,
                        });

                        if (success) {
                            setUploadStatus(
                                `✔ Form PBB berhasil diisi! Silakan pilih berkas dokumen PBB (setelah tersimpan di daftar, section BPHTB otomatis diisi).<br><button id="btn-pick-pbb-file" style="margin-top:6px; width:100%; padding:5px 8px; font-size:11px; font-weight:600; background:#f0ad4e; color:#fff; border:none; border-radius:4px; cursor:pointer;">📁 Buka Dialog Pilih File PBB</button>`,
                                "ok",
                                true
                            );
                            const pickBtn = document.getElementById("btn-pick-pbb-file");
                            if (pickBtn) {
                                pickBtn.onclick = () => PPAT.pbbBphtbFiller.openPbbFilePicker();
                            }
                        } else {
                            setUploadStatus("⚠ Pengisian form PBB terhenti.", "warn");
                        }
                    }
                } else {
                    const err = result.error || result.message || "Gagal memproses dokumen BPHTB.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - BPHTB Backend upload error:", err);
                setUploadStatus("⚠ Backend offline (127.0.0.1:3002). Jalankan start-pbb-backend.bat.", "warn");
            } finally {
                dropzoneBphtb.classList.remove("loading");
                inputBphtb.value = "";
            }
        };

        // Klik untuk memilih file
        dropzoneBphtb.addEventListener("click", () => {
            if (!dropzoneBphtb.classList.contains("loading")) {
                inputBphtb.click();
            }
        });

        inputBphtb.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleBphtbFile(file);
        });

        // Drag & Drop
        dropzoneBphtb.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzoneBphtb.classList.add("dragover");
        });

        dropzoneBphtb.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzoneBphtb.classList.remove("dragover");
        });

        dropzoneBphtb.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzoneBphtb.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handleBphtbFile(file);
        });

        // Tombol aksi manual
        if (btnFillPbbBphtb) {
            btnFillPbbBphtb.addEventListener("click", async () => {
                if (!lastBphtbData) return;
                setUploadStatus("⏳ Mengisi Form PBB & BPHTB...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillAll(lastBphtbData, { autoSubmit: isAutoSubmit() });
                if (ok) setUploadStatus("✔ Form PBB & BPHTB berhasil diisi!", "ok");
            });
        }

        if (btnFillPbbOnly) {
            btnFillPbbOnly.addEventListener("click", async () => {
                if (!lastBphtbData) return;
                setUploadStatus("⏳ Mengisi Form PBB...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillPbb(lastBphtbData, { autoSubmit: isAutoSubmit(), showAlert: false });
                if (ok) {
                    setUploadStatus(
                        `✔ Form PBB berhasil diisi! Silakan pilih file dokumen PBB.<br><button id="btn-pick-pbb-file-manual" style="margin-top:6px; width:100%; padding:5px 8px; font-size:11px; font-weight:600; background:#f0ad4e; color:#fff; border:none; border-radius:4px; cursor:pointer;">📁 Buka Dialog Pilih File PBB</button>`,
                        "ok",
                        true
                    );
                    const pickBtn = document.getElementById("btn-pick-pbb-file-manual");
                    if (pickBtn) {
                        pickBtn.onclick = () => PPAT.pbbBphtbFiller.openPbbFilePicker();
                    }
                }
            });
        }

        if (btnFillBphtbOnly) {
            btnFillBphtbOnly.addEventListener("click", async () => {
                if (!lastBphtbData) return;
                setUploadStatus("⏳ Mengisi Form BPHTB...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillBphtb(lastBphtbData, { autoSubmit: isAutoSubmit(), showAlert: false });
                if (ok) {
                    setUploadStatus(
                        `✔ Form BPHTB berhasil diisi! Silakan pilih file dokumen BPHTB.<br><button id="btn-pick-bphtb-file-manual" style="margin-top:6px; width:100%; padding:5px 8px; font-size:11px; font-weight:600; background:#f0ad4e; color:#fff; border:none; border-radius:4px; cursor:pointer;">📁 Buka Dialog Pilih File BPHTB</button>`,
                        "ok",
                        true
                    );
                    const pickBtn = document.getElementById("btn-pick-bphtb-file-manual");
                    if (pickBtn) {
                        pickBtn.onclick = () => PPAT.pbbBphtbFiller.openBphtbFilePicker();
                    }
                }
            });
        }
    }

    // -------------------------------------------------------------------------
    // Upload & Auto-Fill PPh dari Dokumen Surat Keterangan PPh via pph-backend
    // -------------------------------------------------------------------------

    function setupPphUpload(els) {
        const {
            dropzonePph,
            inputPph,
            statusPph,
            cardPph,
            pphSuket,
            pphNpwp,
            pphNama,
            pphTanggal,
            btnFillPph,
        } = els;

        if (!dropzonePph || !inputPph) return;

        let lastPphData = null;

        const setUploadStatus = (text, type = "info", isHtml = false) => {
            if (!statusPph) return;
            statusPph.classList.remove("hidden");
            statusPph.className = "ppat-status " + type;
            if (isHtml) {
                statusPph.innerHTML = text;
            } else {
                statusPph.textContent = text;
            }
        };

        const renderPphCard = (data) => {
            if (!cardPph) return;
            pphSuket.textContent = data.nomor_suket || "Dokumen PPh";
            pphNpwp.textContent = data.npwp_formatted || data.npwp || "-";
            pphNama.textContent = data.nama_wp || "-";
            pphTanggal.textContent = data.tanggal_suket || "-";
            cardPph.classList.remove("hidden");
        };

        const handlePphFile = async (file) => {
            if (!file) return;

            const name = file.name.toLowerCase();
            const isValid = name.endsWith(".pdf") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg");
            if (!isValid) {
                setUploadStatus("Berkas harus berformat PDF (.pdf) atau Gambar (.jpg, .png).", "warn");
                return;
            }

            dropzonePph.classList.add("loading");
            setUploadStatus("⏳ Membaca & mengekstrak data PPh dari dokumen...", "info");

            const formData = new FormData();
            formData.append("file", file, file.name);

            try {
                const response = await fetch(config.PPH_BACKEND_URL, {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();

                if (response.ok && result.success && result.data) {
                    lastPphData = result.data;
                    renderPphCard(result.data);

                    setUploadStatus("⏳ Mengisi Form PPh, mencari suket & membuka pilih file...", "info");

                    const ok = await PPAT.pphFiller.fill(result.data, {
                        autoSubmit: isAutoSubmit(),
                        showAlert: false,
                    });

                    if (ok) {
                        setUploadStatus("✔ Form PPh berhasil diisi & dialog Pilih File dibuka!", "ok");
                    } else {
                        setUploadStatus("⚠ Pengisian form PPh terhenti atau kolom belum siap.", "warn");
                    }
                } else {
                    const err = result.error || result.message || "Gagal memproses dokumen PPh.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - PPh Backend upload error:", err);
                setUploadStatus("⚠ Backend PPh offline (127.0.0.1:3004). Jalankan start-pph-backend.bat.", "warn");
            } finally {
                dropzonePph.classList.remove("loading");
                inputPph.value = "";
            }
        };

        // Klik untuk memilih file
        dropzonePph.addEventListener("click", () => {
            if (!dropzonePph.classList.contains("loading")) {
                inputPph.click();
            }
        });

        inputPph.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handlePphFile(file);
        });

        // Drag & Drop
        dropzonePph.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzonePph.classList.add("dragover");
        });

        dropzonePph.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzonePph.classList.remove("dragover");
        });

        dropzonePph.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzonePph.classList.remove("dragover");
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) handlePphFile(file);
        });

        // Tombol isi ulang manual
        if (btnFillPph) {
            btnFillPph.addEventListener("click", async () => {
                if (!lastPphData) return;
                setUploadStatus("⏳ Mengisi Form PPh...", "info");
                const ok = await PPAT.pphFiller.fill(lastPphData, { autoSubmit: isAutoSubmit(), showAlert: false });
                if (ok) setUploadStatus("✔ Form PPh berhasil diisi!", "ok");
            });
        }
    }

    return { create };
})();
