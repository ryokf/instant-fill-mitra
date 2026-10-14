/**
 * Controller panel melayang: merakit template, daftar orang, deteksi PT,
 * dan menghubungkannya ke filler.
 */
PPAT.panel = (() => {
    const { config, panelTemplate, personList, pageReader, ptMatcher } = PPAT;
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
        setupBphtbUpload(els);
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

    return { create };
})();
