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
        setupBatchUpload(els);
        setupAktaUpload(els);
        setupSertipikatUpload(els);
        setupBphtbUpload(els);
        setupPphUpload(els);
        setupSaksiControls(els);
        setupSertipikatWatcher(els);

        // Inisialisasi pemantau otomatis submit pembeli untuk upload KK & KTP
        if (PPAT.pembeliUploadFiller && typeof PPAT.pembeliUploadFiller.initPembeliWatcher === "function") {
            PPAT.pembeliUploadFiller.initPembeliWatcher();
        }
    }

    /** Memeriksa apakah opsi otomatis klik "Tambah" sedang aktif di panel. */
    function isAutoSubmit() {
        const chk = document.getElementById(panelTemplate.IDS.chkAutoSubmit);
        return chk ? chk.checked : true;
    }

    /** Memeriksa apakah opsi otomatis upload dokumen PT sedang aktif di panel. */
    function isAutoUploadPtDocs() {
        const chk = document.getElementById(panelTemplate.IDS.chkAutoUploadPtDocs);
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
            onSelect: (orang) => {
                PPAT.selectedPersetujuan = orang;
                const ptName = pt ? pt.penjual.nama : null;
                PPAT.persetujuanFiller.fill(orang, {
                    autoSubmit: isAutoSubmit(),
                    autoUploadDocs: isAutoUploadPtDocs(),
                    ptName,
                });
            },
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
                PPAT.penjualFiller.fill(PPAT.ptDatabase[ptKey].penjual, {
                    autoSubmit: isAutoSubmit(),
                    autoUploadDocs: isAutoUploadPtDocs(),
                });
            }
        });
    }

    function setupFillPenjualButton({ selectPt, btnFillPenjual, btnUploadPtDocs }) {
        btnFillPenjual.addEventListener("click", () => {
            const ptKey = selectPt.value;
            if (!ptKey) return alert(MESSAGES.selectPtFirst);
            PPAT.penjualFiller.fill(PPAT.ptDatabase[ptKey].penjual, {
                autoSubmit: isAutoSubmit(),
                autoUploadDocs: isAutoUploadPtDocs(),
            });
        });

        if (btnUploadPtDocs) {
            btnUploadPtDocs.addEventListener("click", async () => {
                const ptKey = selectPt.value;
                const ptName =
                    ptKey && PPAT.ptDatabase[ptKey]
                        ? PPAT.ptDatabase[ptKey].penjual.nama
                        : PPAT.penjualUploadFiller
                        ? PPAT.penjualUploadFiller.getActivePtNameFromPage()
                        : null;

                if (!ptName) {
                    return alert("Pilih PT di dropdown atau pastikan data PT sudah tersimpan di baris penjual halaman web.");
                }

                if (PPAT.penjualUploadFiller) {
                    await PPAT.penjualUploadFiller.runAutoUpload(ptName);
                }
            });
        }
    }

    function renderPenjualPeroranganCard(els, pPerorangan, pPersetujuan) {
        const {
            cardPenjualPerorangan,
            penjualPeroranganNama,
            penjualPeroranganNik,
            persetujuanPeroranganNama,
            btnFillPersetujuanPerorangan,
        } = els;
        if (!cardPenjualPerorangan) return;
        if (penjualPeroranganNama) penjualPeroranganNama.textContent = (pPerorangan && pPerorangan.nama) || "-";
        if (penjualPeroranganNik) penjualPeroranganNik.textContent = (pPerorangan && pPerorangan.nik) || "-";
        if (persetujuanPeroranganNama) {
            persetujuanPeroranganNama.textContent =
                (pPersetujuan && pPersetujuan.nama) ? pPersetujuan.nama : "(Tidak Ada)";
        }
        if (btnFillPersetujuanPerorangan) {
            btnFillPersetujuanPerorangan.style.display =
                (pPersetujuan && pPersetujuan.nama) ? "block" : "none";
        }
        cardPenjualPerorangan.classList.remove("hidden");
    }

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

        const { selectPt, listPersetujuan, cardPenjualPerorangan } = els;

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
        // KASUS 1: Penjual PT (Badan Hukum) — Prioritas Utama bila terdeteksi PT
        // ---------------------------------------------------------------------
        if (isPtSeller) {
            if (cardPenjualPerorangan) cardPenjualPerorangan.classList.add("hidden");

            if (matchedKey && PPAT.ptDatabase[matchedKey]) {
                const ptEntry = PPAT.ptDatabase[matchedKey];

                // 1. Pilih nama PT di dropdown panel & render daftar pihak persetujuan
                if (selectPt) selectPt.value = matchedKey;
                if (listPersetujuan) renderPersetujuanList(listPersetujuan, matchedKey);

                updateStatus(`⏳ ${prefix}Terdeteksi PT: ${ptEntry.penjual.nama}. Mengisi form PT Penjual (Badan Hukum)...`, "info");

                const shouldAutoUploadDocs = isAutoUploadPtDocs();

                // 2. Isi form penjual PT (Badan Hukum, BUMS, PT) ke website ATR/BPN
                await PPAT.penjualFiller.fill(ptEntry.penjual, {
                    autoSubmit: isAutoSubmit(),
                    autoUploadDocs: shouldAutoUploadDocs,
                });

                // 3. Jeda untuk memastikan form submit PT selesai di DOM
                await PPAT.dom.delay(1000);

                // JIKA autoUploadDocs aktif:
                // penjualUploadFiller.runAutoUpload SUDAH mengisi dan mengunggah SELURUH pihak persetujuan PT
                // serta menampilkan notifikasi alert hasil upload.
                // JANGAN tambahkan lagi pihak persetujuan apapun agar tidak terjadi duplikasi!
                if (shouldAutoUploadDocs) {
                    console.log("[Panel] Auto-upload berkas PT aktif: Seluruh pihak persetujuan PT telah selesai diisikan dan diunggah. Tidak menambahkan pihak persetujuan lagi.");
                    updateStatus(
                        `✔ ${prefix}Penjual PT (${ptEntry.penjual.nama}) & seluruh berkas/persetujuan berhasil diproses! Silakan klik 'Isi Ulang Form Pembeli' bila diperlukan.`,
                        "ok"
                    );
                    return true;
                }

                // 4. Cari pihak persetujuan PT yang sesuai (HANYA jika autoUploadDocs TIDAK aktif)
                let targetPersetujuan = null;
                if (Array.isArray(ptEntry.persetujuan) && ptEntry.persetujuan.length > 0) {
                    // a. Cocokkan berdasarkan NIK dari AJB jika ada
                    if (penjualInfo.pt_nik) {
                        targetPersetujuan = ptEntry.persetujuan.find((p) => p.nik === penjualInfo.pt_nik);
                    }
                    // b. Cocokkan berdasarkan nama perwakilan jika ada
                    if (!targetPersetujuan && penjualInfo.pt_representative) {
                        const repNorm = PPAT.ptMatcher.normalizeName(penjualInfo.pt_representative);
                        targetPersetujuan = ptEntry.persetujuan.find((p) => {
                            const pNorm = PPAT.ptMatcher.normalizeName(p.nama);
                            return pNorm.includes(repNorm) || repNorm.includes(pNorm);
                        });
                    }
                    // c. Fallback ke pihak persetujuan pertama
                    if (!targetPersetujuan) {
                        targetPersetujuan = ptEntry.persetujuan[0];
                    }
                }

                // 5. Isi form Pihak Persetujuan PT ke website ATR/BPN jika belum ada di daftar
                if (targetPersetujuan) {
                    PPAT.selectedPersetujuan = targetPersetujuan;

                    // Pastikan belum ada di web ATR/BPN
                    const alreadyInWeb =
                        PPAT.persetujuanFiller &&
                        PPAT.persetujuanFiller.isPersonAlreadyInDaftar(targetPersetujuan.nama, targetPersetujuan.nik);

                    if (alreadyInWeb) {
                        console.log(`[Panel] Pihak Persetujuan PT (${targetPersetujuan.nama}) sudah tercatat di daftar ATR/BPN. Melewati penambahan.`);
                        updateStatus(
                            `✔ ${prefix}Penjual PT (${ptEntry.penjual.nama}) & Persetujuan (${targetPersetujuan.nama}) [Sudah Ada] terkonfirmasi!`,
                            "ok"
                        );
                        return true;
                    }

                    updateStatus(`⏳ ${prefix}Mengisi form Pihak Persetujuan PT (${targetPersetujuan.nama})...`, "info");
                    const setujuOk = await PPAT.persetujuanFiller.fill(targetPersetujuan, {
                        autoSubmit: isAutoSubmit(),
                        autoUploadDocs: false,
                        ptName: ptEntry.penjual.nama,
                    });
                    const persetujuanInfoText = setujuOk ? ` & Persetujuan (${targetPersetujuan.nama})` : "";
                    updateStatus(
                        `✔ ${prefix}Penjual PT (${ptEntry.penjual.nama})${persetujuanInfoText} berhasil diisi! Silakan klik 'Isi Ulang Form Pembeli' bila diperlukan.`,
                        "ok"
                    );
                } else {
                    updateStatus(
                        `✔ ${prefix}Penjual PT (${ptEntry.penjual.nama}) berhasil diisi. Tidak ada pihak persetujuan pada database.`,
                        "ok"
                    );
                }
                return true;
            } else {
                updateStatus(
                    `⚠ ${prefix}Terdeteksi PT: ${ptName || "Badan Hukum"}, namun tidak cocok dengan database PT (pt-database.js). Silakan pilih PT manual di atas.`,
                    "warn"
                );
                return false;
            }
        }

        // ---------------------------------------------------------------------
        // KASUS 2: Penjual Perorangan (Hanya jika TIDAK ADA PT sama sekali)
        // ---------------------------------------------------------------------
        if (penjualInfo.penjual_perorangan) {
            const pPerorangan = penjualInfo.penjual_perorangan;
            const pPersetujuan = penjualInfo.persetujuan;
            PPAT.activePenjualPerorangan = pPerorangan;
            PPAT.activePersetujuanPerorangan = pPersetujuan;

            if (cardPenjualPerorangan) {
                renderPenjualPeroranganCard(els, pPerorangan, pPersetujuan);
            }

            updateStatus(`⏳ ${prefix}Penjual perorangan (${pPerorangan.nama}). Mengisi form penjual...`, "info");
            await PPAT.penjualFiller.fillPerorangan(pPerorangan, {
                autoSubmit: isAutoSubmit(),
            });

            let persetujuanInfoText = "";
            if (pPersetujuan && pPersetujuan.nama) {
                const alreadyInWeb =
                    PPAT.persetujuanFiller &&
                    PPAT.persetujuanFiller.isPersonAlreadyInDaftar(pPersetujuan.nama, pPersetujuan.nik);

                if (alreadyInWeb) {
                    console.log(`[Panel] Pihak Persetujuan perorangan (${pPersetujuan.nama}) sudah tercatat di daftar ATR/BPN. Melewati penambahan.`);
                    persetujuanInfoText = ` & Persetujuan (${pPersetujuan.nama}) [Sudah Ada]`;
                } else {
                    await PPAT.dom.delay(800);
                    updateStatus(`⏳ ${prefix}Mengisi data Pihak Persetujuan (${pPersetujuan.nama})...`, "info");
                    const setujuOk = await PPAT.persetujuanFiller.fill(pPersetujuan, {
                        autoSubmit: isAutoSubmit(),
                        autoUploadDocs: false,
                    });
                    if (setujuOk) {
                        persetujuanInfoText = ` & Persetujuan (${pPersetujuan.nama})`;
                    }
                }
            }

            updateStatus(
                `✔ ${prefix}Penjual (${pPerorangan.nama})${persetujuanInfoText} berhasil diisi! Silakan klik 'Isi Ulang Form Pembeli' bila diperlukan.`,
                "ok"
            );
            return true;
        }

        return false;
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
    // Multi-Upload (Proses Semua Berkas Paralel di Backend, Isi Berurutan di Web)
    // -------------------------------------------------------------------------

    function setupBatchUpload(els) {
        const {
            dropzoneBatch,
            inputBatch,
            statusBatch,
            batchProgress,
            btnRunSequential,
            cardPembeli,
            pembeliNama,
            pembeliNik,
            pembeliPekerjaan,
            aktaNomor,
            aktaTanggal,
            cardSertipikat,
            sertipikatBerkas,
            sertipikatNib,
            sertipikatKode,
            cardBphtb,
            bphtbNop,
            bphtbLuas,
            bphtbNjop,
            bphtbNoBukti,
            cardPph,
            pphSuket,
            pphNpwp,
            pphNama,
            pphTanggal,
        } = els;

        if (!dropzoneBatch || !inputBatch) return;

        let lastBatchResults = null;

        const setBatchStatus = (text, type = "info") => {
            if (!statusBatch) return;
            statusBatch.classList.remove("hidden");
            statusBatch.className = "ppat-status " + type;
            statusBatch.textContent = text;
        };

        const renderProgressBadges = (assigned, state) => {
            if (!batchProgress) return;
            const labels = {
                pembeli: "📄 Akta Pembeli",
                sertipikat: "📜 Sertipikat",
                bphtb: "📋 PBB & BPHTB",
                pph: "💰 Bukti PPh",
            };

            let html = "<div style='font-weight:600; margin-bottom:4px;'>Status Ekstraksi Backend (Port 3001):</div>";
            for (const key of ["sertipikat", "pembeli", "bphtb", "pph"]) {
                if (!assigned[key]) continue;
                const file = assigned[key];
                const s = state[key];
                let statusBadge = "<span style='color:#0284c7;'>⏳ Sedang diproses...</span>";
                if (s && s.ok) {
                    statusBadge = "<span style='color:#16a34a; font-weight:600;'>✔ Berhasil</span>";
                } else if (s && !s.ok) {
                    statusBadge = `<span style='color:#dc2626;'>⚠ ${s.error || "Gagal"}</span>`;
                }
                html += `<div style='display:flex; justify-content:space-between; margin-bottom:2px;'>
                    <span>${labels[key]}: <i>${file.name}</i></span>
                    ${statusBadge}
                </div>`;
            }
            batchProgress.innerHTML = html;
        };

        function classifyFiles(fileList) {
            const assigned = {
                pembeli: null,
                sertipikat: null,
                bphtb: null,
                pph: null,
            };
            const unassigned = [];

            for (const f of fileList) {
                const name = f.name.toLowerCase();
                if ((name.includes("akta") || name.includes("ajb") || name.includes("pembeli")) && !assigned.pembeli) {
                    assigned.pembeli = f;
                } else if ((name.includes("sertipikat") || name.includes("sertifikat") || name.includes("cek") || name.includes("berkas") || name.includes("nib")) && !assigned.sertipikat) {
                    assigned.sertipikat = f;
                } else if ((name.includes("bphtb") || name.includes("sspd") || name.includes("pbb")) && !assigned.bphtb) {
                    assigned.bphtb = f;
                } else if ((name.includes("pph") || name.includes("suket") || name.includes("pajak")) && !assigned.pph) {
                    assigned.pph = f;
                } else {
                    unassigned.push(f);
                }
            }

            const slots = ["pembeli", "sertipikat", "bphtb", "pph"];
            for (const slot of slots) {
                if (!assigned[slot] && unassigned.length > 0) {
                    assigned[slot] = unassigned.shift();
                }
            }

            return assigned;
        }

        const handleBatchFiles = async (fileList) => {
            if (!fileList || fileList.length === 0) return;

            const assigned = classifyFiles(Array.from(fileList));
            const activeKeys = Object.keys(assigned).filter((k) => assigned[k]);

            if (activeKeys.length === 0) {
                setBatchStatus("Pilih berkas PDF atau gambar yang valid.", "warn");
                return;
            }

            dropzoneBatch.classList.add("loading");
            setBatchStatus(`⏳ Mengirim ${activeKeys.length} berkas ke backend (port 3001) secara bersamaan (paralel)...`, "info");
            batchProgress.classList.remove("hidden");
            if (btnRunSequential) btnRunSequential.classList.add("hidden");

            const progressState = {};
            renderProgressBadges(assigned, progressState);

            // Eksekusi PARALEL (Client-Driven Parallel menggunakan Promise.all)
            const tasks = activeKeys.map(async (key) => {
                const file = assigned[key];
                const formData = new FormData();
                formData.append("file", file, file.name);

                let url = config.BACKEND_URL;
                if (key === "sertipikat") url = config.SERTIPIKAT_BACKEND_URL;
                else if (key === "bphtb") url = config.BPHTB_BACKEND_URL;
                else if (key === "pph") url = config.PPH_BACKEND_URL;

                try {
                    const resp = await fetch(url, { method: "POST", body: formData });
                    const json = await resp.json();
                    if (resp.ok && json.success) {
                        progressState[key] = { ok: true, data: json.data, akta: json.akta, penjual: json.penjual, saksi: json.saksi };
                    } else {
                        progressState[key] = { ok: false, error: json.error || json.message || "Gagal diproses" };
                    }
                } catch (err) {
                    progressState[key] = { ok: false, error: "Backend offline" };
                }

                renderProgressBadges(assigned, progressState);
            });

            await Promise.all(tasks);
            dropzoneBatch.classList.remove("loading");
            inputBatch.value = "";

            lastBatchResults = {
                pembeli: progressState.pembeli?.data,
                akta: progressState.pembeli?.akta,
                penjual: progressState.pembeli?.penjual,
                saksi: progressState.pembeli?.saksi,
                sertipikat: progressState.sertipikat?.data,
                bphtb: progressState.bphtb?.data,
                pph: progressState.pph?.data,
            };

            if (lastBatchResults.pembeli) {
                PPAT.activePembeliData = lastBatchResults.pembeli;
                if (
                    lastBatchResults.pembeli.nama &&
                    PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.saveActiveBuyerName === "function"
                ) {
                    PPAT.pembeliUploadFiller.saveActiveBuyerName(lastBatchResults.pembeli.nama);
                }
            }
            if (lastBatchResults.saksi) {
                PPAT.activeSaksiData = lastBatchResults.saksi;
                if (PPAT.saksiFiller && typeof PPAT.saksiFiller.saveSavedSaksi === "function") {
                    PPAT.saksiFiller.saveSavedSaksi(lastBatchResults.saksi);
                }
                renderDetectedSaksiCard(els, lastBatchResults.saksi);
            }
            if (lastBatchResults.bphtb) {
                PPAT.activeBphtbData = lastBatchResults.bphtb;
            }
            if (lastBatchResults.pph) {
                PPAT.activePphData = lastBatchResults.pph;
            }

            // Perbarui tampilan kartu-kartu di panel
            if (lastBatchResults.pembeli && cardPembeli) {
                pembeliNama.textContent = lastBatchResults.pembeli.nama || "-";
                pembeliNik.textContent = lastBatchResults.pembeli.nik || "-";
                pembeliPekerjaan.textContent = lastBatchResults.pembeli.pekerjaan || "-";
                if (aktaNomor) aktaNomor.textContent = (lastBatchResults.akta && lastBatchResults.akta.nomor_akta) || lastBatchResults.pembeli.nomor_akta || "-";
                if (aktaTanggal) aktaTanggal.textContent = (lastBatchResults.akta && lastBatchResults.akta.tanggal_akta) || lastBatchResults.pembeli.tanggal_akta || "-";
                cardPembeli.classList.remove("hidden");
            }

            if (lastBatchResults.sertipikat && cardSertipikat) {
                sertipikatBerkas.textContent = "Berkas: " + (lastBatchResults.sertipikat.nomor_berkas || "-") + "/" + (lastBatchResults.sertipikat.tahun_berkas || "2026");
                sertipikatNib.textContent = lastBatchResults.sertipikat.nib_elektronik || lastBatchResults.sertipikat.nib || "-";
                sertipikatKode.textContent = lastBatchResults.sertipikat.nomor_seri_blangko || "-";
                cardSertipikat.classList.remove("hidden");
            }

            if (lastBatchResults.bphtb && cardBphtb) {
                bphtbNop.textContent = lastBatchResults.bphtb.nop || "-";
                bphtbLuas.textContent = lastBatchResults.bphtb.luas_tanah || "-";
                bphtbNjop.textContent = lastBatchResults.bphtb.njop_m2 ? lastBatchResults.bphtb.njop_m2.toLocaleString("id-ID") : "-";
                bphtbNoBukti.textContent = lastBatchResults.bphtb.nomor_bukti_pembayaran || "-";
                cardBphtb.classList.remove("hidden");
            }

            if (lastBatchResults.pph && cardPph) {
                pphSuket.textContent = lastBatchResults.pph.nomor_suket || "Dokumen PPh";
                pphNpwp.textContent = lastBatchResults.pph.npwp_formatted || lastBatchResults.pph.npwp || "-";
                pphNama.textContent = lastBatchResults.pph.nama_wp || "-";
                pphTanggal.textContent = lastBatchResults.pph.tanggal_suket || "-";
                cardPph.classList.remove("hidden");
            }

            const successCount = Object.values(progressState).filter((s) => s && s.ok).length;
            if (successCount > 0) {
                setBatchStatus(`✔ Ekstraksi ${successCount} berkas selesai! Memulai pengisian form berurutan...`, "ok");
                if (btnRunSequential) btnRunSequential.classList.remove("hidden");
                // Jalankan pengisian berurutan
                await executeSequentialFilling(lastBatchResults);
            } else {
                setBatchStatus("⚠ Semua berkas gagal diekstrak. Pastikan backend di http://127.0.0.1:3001 aktif.", "warn");
            }
        };

        const executeSequentialFilling = async (results) => {
            if (!results) return;

            setBatchStatus("⚡ Menjalankan alur pengisian form ATR/BPN secara berurutan...", "info");

            // =========================================================================
            // TAHAP 1: Sertipikat (Prasyarat mutlak untuk PBB & BPHTB)
            // =========================================================================
            if (results.sertipikat) {
                const certAlreadySaved = PPAT.sertipikatFiller && PPAT.sertipikatFiller.isSertifikatSaved();
                if (!certAlreadySaved) {
                    setBatchStatus("⏳ [1/4] Mengisi Form Sertipikat Elektronik (NIB & Kode)...", "info");
                    if (PPAT.sertipikatFiller && typeof PPAT.sertipikatFiller.fillSertipikatAJB === "function") {
                        await PPAT.sertipikatFiller.fillSertipikatAJB(results.sertipikat, { autoSubmit: isAutoSubmit() });
                    }

                    setBatchStatus("⏳ Menunggu Sertipikat tersimpan di 'Daftar Sertipkat HAT' (sisi kanan)...", "info");
                    const certSaved = await PPAT.sertipikatFiller.waitForSertifikatSaved(45000);
                    if (!certSaved) {
                        setBatchStatus("❌ Sertipikat belum terdaftar di sisi kanan. Pengisian selanjutnya dihentikan.", "warn");
                        alert("Sertipikat belum terkonfirmasi di 'Daftar Sertipkat HAT' di sebelah kanan form. Pengisian PBB & BPHTB dibatalkan demi keamanan.");
                        return;
                    }
                    setBatchStatus("✔ Sertipikat terkonfirmasi di Daftar Sertipikat HAT!", "ok");
                } else {
                    setBatchStatus("✔ Sertipikat sudah terdaftar pada daftar di sisi kanan.", "ok");
                }
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
            }

            // =========================================================================
            // TAHAP 2: Akta, Penjual & Pembeli
            // =========================================================================
            if (results.akta && (results.akta.nomor_akta || results.akta.tanggal_akta)) {
                setBatchStatus("⏳ [2/4] Menyimpan Nomor & Tanggal Akta...", "info");
                if (PPAT.aktaFiller) {
                    await PPAT.aktaFiller.fill(results.akta, { autoSubmit: true });
                }
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 250);
            }

            if (results.penjual) {
                setBatchStatus("⏳ [2/4] Memproses data Penjual & Pihak Persetujuan...", "info");
                await autoFillPenjualAndPersetujuan(results.penjual, els, (msg, type) => {
                    setBatchStatus(`[2/4] ${msg}`, type);
                });
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
            }

            if (results.pembeli) {
                PPAT.activePembeliData = results.pembeli;
                if (
                    results.pembeli.nama &&
                    PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.saveActiveBuyerName === "function"
                ) {
                    PPAT.pembeliUploadFiller.saveActiveBuyerName(results.pembeli.nama);
                }
                setBatchStatus("⏳ [2/4] Mengisi Data Pihak Pembeli...", "info");
                if (PPAT.pembeliFiller) {
                    await PPAT.pembeliFiller.fill(results.pembeli, { autoSubmit: isAutoSubmit(), showAlert: false });
                }
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
            }

            let buyerName =
                (results.pembeli && results.pembeli.nama) ||
                (PPAT.pembeliUploadFiller &&
                    typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                    PPAT.pembeliUploadFiller.getActiveBuyerName());

            // Jika hasil batch belum mencakup data BPHTB / PPh, coba ambil otomatis dari folder pembeli
            if (buyerName && PPAT.pembeliUploadFiller) {
                if (!results.bphtb) {
                    try {
                        setBatchStatus(`⏳ Mengambil data PBB & BPHTB dari folder pembeli "${buyerName}"...`, "info");
                        const extBphtb = await PPAT.pembeliUploadFiller.extractBuyerBphtb(buyerName);
                        if (extBphtb) {
                            results.bphtb = extBphtb;
                            PPAT.activeBphtbData = extBphtb;
                        }
                    } catch (e) {
                        console.warn("AutoFill PPAT: Gagal mengambil data BPHTB pembeli:", e);
                    }
                }
                if (!results.pph) {
                    try {
                        setBatchStatus(`⏳ Mengambil data PPh dari folder pembeli "${buyerName}"...`, "info");
                        const extPph = await PPAT.pembeliUploadFiller.extractBuyerPph(buyerName);
                        if (extPph) {
                            results.pph = extPph;
                            PPAT.activePphData = extPph;
                        }
                    } catch (e) {
                        console.warn("AutoFill PPAT: Gagal mengambil data PPh pembeli:", e);
                    }
                }
            }

            // =========================================================================
            // TAHAP 3: PBB & BPHTB
            // Aturan Keras:
            // 1. Sebelum mengisi PBB: Sertipikat HARUS sudah ada di daftar kanan.
            // 2. Sebelum mengisi BPHTB: PBB HARUS sudah ada di daftar kanan.
            // =========================================================================
            if (results.bphtb) {
                // 1. Cek prasyarat PBB: Sertipikat wajib terisi di daftar kanan!
                const certOk = PPAT.pbbBphtbFiller.isSertifikatSaved();
                if (!certOk) {
                    setBatchStatus("❌ Gagal: PBB tidak dapat diisi karena Sertipikat belum terdaftar di sisi kanan!", "warn");
                    alert("Sebelum mengisi PBB, Sertipikat harus sudah terdaftar pada 'Daftar Sertipkat HAT' di sebelah kanan form!");
                    return;
                }

                // 2. Cek apakah PBB sudah terisi di daftar kanan
                const pbbAlreadySaved = PPAT.pbbBphtbFiller.isPbbSaved();
                if (!pbbAlreadySaved) {
                    setBatchStatus("⏳ [3/4] Mengisi Form PBB & mengunggah berkas PBB otomatis...", "info");
                    await PPAT.pbbBphtbFiller.fillPbb(results.bphtb, {
                        autoSubmit: isAutoSubmit(),
                        continueToBphtb: false,
                        waitForPrerequisite: false,
                        buyerName,
                    });

                    setBatchStatus("⏳ Menunggu PBB tersimpan di 'Daftar PBB' (sisi kanan)...", "info");
                    const pbbSaved = await PPAT.pbbBphtbFiller.waitForPbbSaved(60000);
                    if (!pbbSaved) {
                        setBatchStatus("❌ PBB belum tersimpan di daftar kanan. Pengisian BPHTB ditunda.", "warn");
                        alert("PBB belum tersimpan pada 'Daftar PBB' di sebelah kanan. Pengisian BPHTB ditunda sampai PBB tersimpan.");
                        return;
                    }
                    setBatchStatus("✔ PBB terkonfirmasi di Daftar PBB!", "ok");
                    await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
                } else {
                    setBatchStatus("✔ PBB sudah terdaftar pada daftar di sisi kanan.", "ok");
                }

                // 3. Cek prasyarat BPHTB: PBB wajib terisi di daftar kanan!
                const pbbOk = PPAT.pbbBphtbFiller.isPbbSaved();
                if (!pbbOk) {
                    setBatchStatus("❌ Gagal: BPHTB tidak dapat diisi karena PBB belum terdaftar di sisi kanan!", "warn");
                    alert("Sebelum mengisi BPHTB, PBB harus sudah terdaftar pada 'Daftar PBB' di sebelah kanan form!");
                    return;
                }

                // 4. Lanjut isi Form BPHTB
                setBatchStatus("⏳ Mengisi Form BPHTB & mengunggah berkas BPHTB otomatis...", "info");
                await PPAT.pbbBphtbFiller.fillBphtb(results.bphtb, {
                    autoSubmit: isAutoSubmit(),
                    waitForPrerequisite: false,
                    buyerName,
                });

                setBatchStatus("⏳ Menunggu BPHTB tersimpan di 'Daftar BPHTB' (sisi kanan)...", "info");
                await PPAT.pbbBphtbFiller.waitForBphtbSaved(45000);
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
            }

            // =========================================================================
            // TAHAP 4: PPh
            // =========================================================================
            if (results.pph) {
                setBatchStatus("⏳ [4/5] Mengisi Form PPh (mencari suket & mengunggah berkas PPh otomatis)...", "info");
                if (PPAT.pphFiller) {
                    await PPAT.pphFiller.fill(results.pph, {
                        autoSubmit: isAutoSubmit(),
                        showAlert: false,
                        buyerName,
                    });
                }
                await PPAT.dom.delay(PPAT.config.TIMING.FORM_SETTLE_DELAY_MS + 300);
            }

            // =========================================================================
            // TAHAP 5: Pihak Saksi (Section M) & Upload KTP Saksi
            // =========================================================================
            let saksiList = results.saksi || PPAT.activeSaksiData;
            if (!saksiList && PPAT.saksiFiller && typeof PPAT.saksiFiller.getSavedSaksi === "function") {
                saksiList = await PPAT.saksiFiller.getSavedSaksi();
            }

            if (saksiList && Array.isArray(saksiList) && saksiList.length > 0) {
                const saksiDone = PPAT.saksiFiller && PPAT.saksiFiller.areAllSaksiInDaftar(saksiList);
                if (!saksiDone) {
                    setBatchStatus("⏳ [5/5] Mengisi Form 2 Pihak Saksi & mengunggah berkas KTP saksi...", "info");
                    if (PPAT.saksiFiller) {
                        await PPAT.saksiFiller.fillAndUploadSaksiList(saksiList, {
                            autoSubmit: isAutoSubmit(),
                            autoUploadDocs: true,
                            onStatus: (msg, type) => {
                                setBatchStatus(`[5/5] ${msg}`, type);
                            },
                        });
                    }
                } else {
                    setBatchStatus("✔ Seluruh Pihak Saksi sudah tercatat di sisi kanan.", "ok");
                }
            }

            setBatchStatus("✔ Seluruh form berhasil diisi & berkas PBB, BPHTB, PPh, serta KTP Saksi berhasil diunggah!", "ok");
        };

        // Event listener klik dropzone
        dropzoneBatch.addEventListener("click", () => {
            if (!dropzoneBatch.classList.contains("loading")) {
                inputBatch.click();
            }
        });

        inputBatch.addEventListener("change", (e) => {
            const files = e.target.files;
            if (files && files.length > 0) handleBatchFiles(files);
        });

        // Drag & Drop
        dropzoneBatch.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzoneBatch.classList.add("dragover");
        });

        dropzoneBatch.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dropzoneBatch.classList.remove("dragover");
        });

        dropzoneBatch.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzoneBatch.classList.remove("dragover");
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length > 0) handleBatchFiles(files);
        });

        if (btnRunSequential) {
            btnRunSequential.addEventListener("click", () => {
                if (lastBatchResults) executeSequentialFilling(lastBatchResults);
            });
        }
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
            btnUploadPembeliDocs,
            pembeliNama,
            pembeliNik,
            pembeliPekerjaan,
            aktaNomor,
            aktaTanggal,
            cardPenjualPerorangan,
            penjualPeroranganNama,
            penjualPeroranganNik,
            persetujuanPeroranganNama,
            btnFillPenjualPerorangan,
            btnFillPersetujuanPerorangan,
            selectPt,
            listPersetujuan,
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

                    // Tangani data 2 saksi hasil ekstraksi akta AJB
                    if (result.saksi && Array.isArray(result.saksi) && result.saksi.length > 0) {
                        PPAT.activeSaksiData = result.saksi;
                        if (PPAT.saksiFiller && typeof PPAT.saksiFiller.saveSavedSaksi === "function") {
                            PPAT.saksiFiller.saveSavedSaksi(result.saksi);
                        }
                        renderDetectedSaksiCard(els, result.saksi);
                    }

                    // 1. Ekstrak & isi Nomor dan Tanggal Akta ke Section A (Input Akta)
                    // Setelah semua kolom di section Input Akta terisi, klik tombol simpan secara otomatis
                    // dan tunggu modal notifikasi sampai tersimpan.
                    let aktaStatusPrefix = "";
                    if (PPAT.aktaFiller && (aktaData.nomor_akta || aktaData.tanggal_akta)) {
                        await PPAT.aktaFiller.fill(aktaData, { autoSubmit: true });
                        aktaStatusPrefix = `Akta No. ${aktaData.nomor_akta || "-"} (${aktaData.tanggal_akta || "-"}) tersimpan. `;
                    }

                    // 2. Otomatisasi Pengisian Penjual (PT atau Perorangan) beserta Pihak Persetujuan
                    const penjualInfo = result.penjual;
                    const filled = await autoFillPenjualAndPersetujuan(penjualInfo, els, setUploadStatus, aktaStatusPrefix);
                    if (!filled) {
                        setUploadStatus(`✔ ${aktaStatusPrefix}Silakan pilih pihak penjual di atas bila belum terisi.`, "ok");
                    }

                    // 3. Otomatisasi Saksi jika autoSubmit aktif
                    if (result.saksi && Array.isArray(result.saksi) && result.saksi.length > 0 && isAutoSubmit() && PPAT.saksiFiller) {
                        const saksiDone = PPAT.saksiFiller.areAllSaksiInDaftar(result.saksi);
                        if (!saksiDone) {
                            if (els.statusSaksi) {
                                els.statusSaksi.classList.remove("hidden");
                                els.statusSaksi.className = "ppat-status info";
                                els.statusSaksi.textContent = "⏳ Mengisi form 2 Saksi & mengunggah berkas KTP saksi otomatis...";
                            }
                            await PPAT.saksiFiller.fillAndUploadSaksiList(result.saksi, {
                                autoSubmit: true,
                                autoUploadDocs: true,
                                onStatus: (msg, type) => {
                                    if (els.statusSaksi) {
                                        els.statusSaksi.classList.remove("hidden");
                                        els.statusSaksi.className = "ppat-status " + type;
                                        els.statusSaksi.textContent = msg;
                                    }
                                },
                            });
                        }
                    }
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

        // Tombol isi ulang penjual perorangan
        if (btnFillPenjualPerorangan) {
            btnFillPenjualPerorangan.addEventListener("click", () => {
                if (PPAT.activePenjualPerorangan && PPAT.penjualFiller) {
                    PPAT.penjualFiller.fillPerorangan(PPAT.activePenjualPerorangan, {
                        autoSubmit: false,
                        showAlert: true,
                    });
                }
            });
        }

        // Tombol isi ulang persetujuan perorangan
        if (btnFillPersetujuanPerorangan) {
            btnFillPersetujuanPerorangan.addEventListener("click", () => {
                if (PPAT.activePersetujuanPerorangan && PPAT.persetujuanFiller) {
                    PPAT.persetujuanFiller.fill(PPAT.activePersetujuanPerorangan, {
                        autoSubmit: false,
                        autoUploadDocs: false,
                    });
                }
            });
        }

        // Tombol mandiri upload berkas pembeli (KK & KTP)
        if (btnUploadPembeliDocs) {
            btnUploadPembeliDocs.addEventListener("click", async () => {
                const buyerName =
                    (lastPembeliData && lastPembeliData.nama) ||
                    (PPAT.activePembeliData && PPAT.activePembeliData.nama) ||
                    (PPAT.pembeliUploadFiller && PPAT.pembeliUploadFiller.getActiveBuyerNameFromPage());

                if (!buyerName) {
                    return alert("Data pembeli belum tersedia. Pastikan akta PDF telah diupload atau form pembeli telah diisi.");
                }

                if (PPAT.pembeliUploadFiller) {
                    await PPAT.pembeliUploadFiller.runAutoUploadPembeli(buyerName);
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
                                setUploadStatus("✔ Form Sertipikat Elektronik berhasil diisi! Melanjutkan ke PBB, BPHTB & PPh...", "ok");
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
                        setUploadStatus("✔ Form Sertipikat berhasil diisi! Melanjutkan otomatis ke PBB, BPHTB & PPh...", "ok");
                        await runPostSertipikatAutomation(els, setUploadStatus);
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
    // Otomatisasi Beruntun Pasca-Sertipikat: PBB -> BPHTB -> PPh beserta Upload File
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

            // Jika data ekstraksi BPHTB/PBB atau PPh belum ada di panel, ekstrak otomatis secara mandiri dari folder pembeli
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
                    updateAllStatus("⏳ [1/3] Mengisi otomatis Section PBB & mengunggah file PBB...", "info");
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
                    updateAllStatus("⏳ [2/3] Mengisi Section BPHTB, menunggu info validasi, & mengunggah file BPHTB...", "info");
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
                    `⚠ Data BPHTB/PBB tidak ditemukan untuk pembeli "${buyerName || "-"}". Pastikan berkas BPHTB tersedia di folder pembeli atau upload ke panel.`,
                    "warn"
                );
            }

            // -----------------------------------------------------------------
            // TAHAP 3: Pengisian Otomatis Section PPh + Upload File PPh
            // -----------------------------------------------------------------
            if (pphData && PPAT.pphFiller) {
                updateAllStatus("⏳ [3/3] Mengisi otomatis Section PPh & mengunggah file PPh...", "info");
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
                    PPAT.activeBphtbData = result.data;
                    renderBphtbCard(result.data);

                    const buyerName =
                        (PPAT.pembeliUploadFiller &&
                            typeof PPAT.pembeliUploadFiller.getActiveBuyerName === "function" &&
                            PPAT.pembeliUploadFiller.getActiveBuyerName()) ||
                        result.data.nama_wajib_pajak ||
                        null;

                    // Periksa apakah data PBB sudah tersimpan sebelumnya pada daftar di sebelah kanan
                    if (PPAT.pbbBphtbFiller.isPbbSaved()) {
                        setUploadStatus("ℹ PBB sudah terinput di daftar sebelah kanan. Mengisi Form BPHTB & upload file...", "info");
                        const ok = await PPAT.pbbBphtbFiller.fillBphtb(result.data, {
                            autoSubmit: isAutoSubmit(),
                            waitForPrerequisite: false,
                            buyerName,
                            continueToPph: Boolean(PPAT.activePphData),
                            pphData: PPAT.activePphData,
                        });
                        if (ok) {
                            setUploadStatus("✔ Form BPHTB & berkas BPHTB berhasil diisi dan diunggah!", "ok");
                        }
                    } else {
                        // Sebelum mengisi PBB, periksa apakah Sertipikat sudah terdaftar di daftar kanan
                        if (!PPAT.pbbBphtbFiller.isSertifikatSaved()) {
                            setUploadStatus("⚠ Data PBB/BPHTB berhasil diekstrak, namun Sertipikat belum terdaftar di daftar sebelah kanan (#daftarhatplaceholder). Silakan isi dan simpan Sertipikat terlebih dahulu.", "warn");
                            return;
                        }

                        setUploadStatus("⏳ Mengisi Form PBB & mengunggah berkas PBB otomatis...", "info");

                        const success = await PPAT.pbbBphtbFiller.fillPbb(result.data, {
                            autoSubmit: isAutoSubmit(),
                            continueToBphtb: true,
                            waitForPrerequisite: false,
                            buyerName,
                            continueToPph: Boolean(PPAT.activePphData),
                            pphData: PPAT.activePphData,
                        });

                        if (success) {
                            setUploadStatus("✔ Form PBB & BPHTB beserta berkasnya berhasil diisi dan diunggah otomatis!", "ok");
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
                setUploadStatus("⚠ Backend offline (127.0.0.1:3001). Jalankan start-backend.bat.", "warn");
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
                const data = lastBphtbData || PPAT.activeBphtbData;
                if (!data) return;
                if (!PPAT.pbbBphtbFiller.isSertifikatSaved()) {
                    setUploadStatus("⚠ Sertipikat belum terdaftar di 'Daftar Sertipkat HAT' di sebelah kanan form!", "warn");
                    alert("Sebelum mengisi PBB & BPHTB, Sertipikat harus sudah terdaftar pada daftar di sebelah kanan!");
                    return;
                }
                setUploadStatus("⏳ Mengisi Form PBB & BPHTB beserta berkas...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillAll(data, { autoSubmit: isAutoSubmit() });
                if (ok) setUploadStatus("✔ Form PBB & BPHTB berhasil diisi!", "ok");
            });
        }

        if (btnFillPbbOnly) {
            btnFillPbbOnly.addEventListener("click", async () => {
                const data = lastBphtbData || PPAT.activeBphtbData;
                if (!data) return;
                if (!PPAT.pbbBphtbFiller.isSertifikatSaved()) {
                    setUploadStatus("⚠ Sertipikat belum terdaftar di 'Daftar Sertipkat HAT' di sebelah kanan form!", "warn");
                    alert("Sebelum mengisi PBB, Sertipikat harus sudah terdaftar pada daftar di sebelah kanan!");
                    return;
                }
                setUploadStatus("⏳ Mengisi Form PBB & mengunggah berkas PBB...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillPbb(data, {
                    autoSubmit: isAutoSubmit(),
                    continueToBphtb: false,
                    showAlert: false,
                });
                if (ok) {
                    setUploadStatus("✔ Form PBB & berkas PBB berhasil diisi!", "ok");
                }
            });
        }

        if (btnFillBphtbOnly) {
            btnFillBphtbOnly.addEventListener("click", async () => {
                const data = lastBphtbData || PPAT.activeBphtbData;
                if (!data) return;
                if (!PPAT.pbbBphtbFiller.isPbbSaved()) {
                    setUploadStatus("⚠ PBB belum terdaftar di 'Daftar PBB yang sudah diinput' di sebelah kanan form!", "warn");
                    alert("Sebelum mengisi BPHTB, PBB harus sudah terdaftar pada daftar di sebelah kanan!");
                    return;
                }
                setUploadStatus("⏳ Mengisi Form BPHTB & mengunggah berkas BPHTB...", "info");
                const ok = await PPAT.pbbBphtbFiller.fillBphtb(data, {
                    autoSubmit: isAutoSubmit(),
                    showAlert: false,
                });
                if (ok) {
                    setUploadStatus("✔ Form BPHTB & berkas BPHTB berhasil diisi!", "ok");
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
                    PPAT.activePphData = result.data;
                    renderPphCard(result.data);

                    setUploadStatus("⏳ Mengisi Form PPh, mencari suket & mengunggah berkas PPh otomatis...", "info");

                    const ok = await PPAT.pphFiller.fill(result.data, {
                        autoSubmit: isAutoSubmit(),
                        showAlert: false,
                    });

                    if (ok) {
                        setUploadStatus("✔ Form PPh & berkas PPh berhasil diisi dan diunggah!", "ok");
                    } else {
                        setUploadStatus("⚠ Pengisian form PPh terhenti atau kolom belum siap.", "warn");
                    }
                } else {
                    const err = result.error || result.message || "Gagal memproses dokumen PPh.";
                    setUploadStatus(`⚠ ${err}`, "warn");
                }
            } catch (err) {
                console.error("AutoFill PPAT - PPh Backend upload error:", err);
                setUploadStatus("⚠ Backend offline (127.0.0.1:3001). Jalankan start-backend.bat.", "warn");
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
                const data = lastPphData || PPAT.activePphData;
                if (!data) return;
                setUploadStatus("⏳ Mengisi Form PPh & mengunggah berkas PPh...", "info");
                const ok = await PPAT.pphFiller.fill(data, { autoSubmit: isAutoSubmit(), showAlert: false });
                if (ok) setUploadStatus("✔ Form PPh berhasil diisi!", "ok");
            });
        }
    }

    // -------------------------------------------------------------------------
    // Kontrol & Tampilan Pihak Saksi (Section 7)
    // -------------------------------------------------------------------------

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

    function setupSaksiControls(els) {
        const { cardDetectedSaksi, btnFillAutoSaksi, statusSaksi } = els;

        const setSaksiStatus = (text, type = "info") => {
            if (!statusSaksi) return;
            statusSaksi.classList.remove("hidden");
            statusSaksi.className = "ppat-status " + type;
            statusSaksi.textContent = text;
        };

        // Pulihkan data saksi tersimpan jika ada
        if (PPAT.saksiFiller && typeof PPAT.saksiFiller.getSavedSaksi === "function") {
            PPAT.saksiFiller.getSavedSaksi().then((saved) => {
                if (saved && Array.isArray(saved) && saved.length > 0) {
                    PPAT.activeSaksiData = saved;
                    renderDetectedSaksiCard(els, saved);
                }
            });
        }

        if (btnFillAutoSaksi) {
            btnFillAutoSaksi.addEventListener("click", async () => {
                let saksiList = PPAT.activeSaksiData;
                if (!saksiList && PPAT.saksiFiller && typeof PPAT.saksiFiller.getSavedSaksi === "function") {
                    saksiList = await PPAT.saksiFiller.getSavedSaksi();
                    if (saksiList) PPAT.activeSaksiData = saksiList;
                }

                if (!saksiList || !Array.isArray(saksiList) || saksiList.length === 0) {
                    setSaksiStatus("Belum ada data saksi dari akta. Upload berkas Akta AJB terlebih dahulu.", "warn");
                    return;
                }

                setSaksiStatus("⏳ Memulai pengisian form 2 saksi & upload KTP...", "info");
                await PPAT.saksiFiller.fillAndUploadSaksiList(saksiList, {
                    autoSubmit: isAutoSubmit(),
                    autoUploadDocs: true,
                    onStatus: (msg, type) => setSaksiStatus(msg, type),
                });
            });
        }
    }

    return { create };
})();
