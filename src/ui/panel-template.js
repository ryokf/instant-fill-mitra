/**
 * Markup HTML panel melayang + daftar id elemen yang dipakai controller.
 */
PPAT.panelTemplate = (() => {
    const IDS = Object.freeze({
        root: "ppat-autofill-root",
        panel: "ppat-panel",
        badge: "ppat-launcher-badge",
        btnMinimize: "ppat-btn-minimize",
        btnClose: "ppat-btn-close",
        // Langkah 1-4: Upload Akta AJB (Akta, Penjual & Persetujuan, Pembeli)
        dropzoneAkta: "ppat-dropzone-akta",
        inputAkta: "ppat-input-akta",
        statusAkta: "ppat-status-akta",
        cardPenjualPerorangan: "ppat-card-penjual-perorangan",
        penjualPeroranganNama: "ppat-penjual-perorangan-nama",
        penjualPeroranganNik: "ppat-penjual-perorangan-nik",
        persetujuanPeroranganNama: "ppat-persetujuan-perorangan-nama",
        btnUploadPenjualPerorangan: "ppat-btn-upload-penjual-perorangan",
        cardPembeli: "ppat-card-pembeli",
        pembeliNama: "ppat-pembeli-nama",
        pembeliNik: "ppat-pembeli-nik",
        pembeliPekerjaan: "ppat-pembeli-pekerjaan",
        aktaNomor: "ppat-akta-nomor",
        aktaTanggal: "ppat-akta-tanggal",
        // Langkah 5: Upload Cek Sertipikat & Berkas
        dropzoneSertipikat: "ppat-dropzone-sertipikat",
        inputSertipikat: "ppat-input-sertipikat",
        statusSertipikat: "ppat-status-sertipikat",
        cardSertipikat: "ppat-card-sertipikat",
        sertipikatBerkas: "ppat-sertipikat-berkas",
        sertipikatNib: "ppat-sertipikat-nib",
        sertipikatKode: "ppat-sertipikat-kode",
        btnCariBerkas: "ppat-btn-cari-berkas",
        btnFillSertipikat: "ppat-btn-fill-sertipikat",
        // Langkah 6: Otomatisasi PBB & BPHTB, PPh, dan Saksi
        statusBphtb: "ppat-status-bphtb",
        cardBphtb: "ppat-card-bphtb",
        bphtbNop: "ppat-bphtb-nop",
        bphtbLuas: "ppat-bphtb-luas",
        bphtbNjop: "ppat-bphtb-njop",
        bphtbNoBukti: "ppat-bphtb-nobukti",
        statusPph: "ppat-status-pph",
        cardPph: "ppat-card-pph",
        pphSuket: "ppat-pph-suket",
        pphNpwp: "ppat-pph-npwp",
        pphNama: "ppat-pph-nama",
        pphTanggal: "ppat-pph-tanggal",
        statusSaksi: "ppat-status-saksi",
        cardDetectedSaksi: "ppat-card-detected-saksi",
        saksi1Nama: "ppat-saksi-1-nama",
        saksi2Nama: "ppat-saksi-2-nama",
    });

    const HTML = `
        <div id="${IDS.badge}">⚡ AutoFill PPAT</div>
        <div id="${IDS.panel}">
            <div id="ppat-panel-header">
                <span class="title">⚡ AutoFill Akta Jual Beli</span>
                <div class="actions">
                    <button id="${IDS.btnMinimize}" title="Kecilkan panel">─</button>
                    <button id="${IDS.btnClose}" title="Tutup panel">✕</button>
                </div>
            </div>
            <div id="ppat-panel-body">
                <!-- SECTION 1: UPLOAD AJB (AKTA, PENJUAL, PERSETUJUAN & PEMBELI) -->
                <div class="ppat-section" data-section="akta">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">1</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Akta AJB, Penjual & Pembeli</span>
                            <span class="ppat-section-hint">Upload akta PDF</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <div id="${IDS.dropzoneAkta}" class="ppat-dropzone" title="Klik atau seret file PDF Akta ke sini">
                            <input type="file" id="${IDS.inputAkta}" accept=".pdf" style="display:none">
                            <div class="ppat-dropzone-inner">
                                <span class="ppat-dropzone-icon">📄</span>
                                <div class="ppat-dropzone-texts">
                                    <span class="ppat-dropzone-title">Upload Akta AJB (PDF)</span>
                                    <span class="ppat-dropzone-sub">Auto-isi Akta, Penjual, Persetujuan & Pembeli</span>
                                </div>
                            </div>
                        </div>
                        <div id="${IDS.statusAkta}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardPenjualPerorangan}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.penjualPeroranganNama}">-</span>
                                <span class="ppat-person-badge" style="background:#0284c7;">Penjual</span>
                            </div>
                            <div class="ppat-person-meta">NIK: <b id="${IDS.penjualPeroranganNik}">-</b></div>
                            <div class="ppat-person-meta">Persetujuan: <b id="${IDS.persetujuanPeroranganNama}">-</b></div>
                            <div style="margin-top:8px;">
                                <button type="button" id="${IDS.btnUploadPenjualPerorangan}" class="ppat-btn-fill" style="background:#0284c7; width:100%;" title="Upload otomatis berkas KK & KTP Penjual serta KTP Persetujuan dari folder Pihak Kedua">
                                    📤 Upload Berkas Penjual & Persetujuan (KK & KTP)
                                </button>
                            </div>
                        </div>
                        <div id="${IDS.cardPembeli}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.pembeliNama}">-</span>
                                <span class="ppat-person-badge">Pembeli</span>
                            </div>
                            <div class="ppat-person-meta">No. Akta: <b id="${IDS.aktaNomor}">-</b> | Tgl: <span id="${IDS.aktaTanggal}">-</span></div>
                            <div class="ppat-person-meta">NIK: <b id="${IDS.pembeliNik}">-</b></div>
                            <div class="ppat-person-meta">Pekerjaan: <span id="${IDS.pembeliPekerjaan}">-</span></div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: SERTIPIKAT & OTOMATISASI LANJUTAN (PBB, BPHTB, PPH, SAKSI) -->
                <div class="ppat-section" data-section="sertipikat">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">2</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Sertipikat & Otomatisasi</span>
                            <span class="ppat-section-hint">Upload cek sertipikat</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <div id="${IDS.dropzoneSertipikat}" class="ppat-dropzone" title="Klik atau seret file PDF Pengecekan Sertipikat ke sini">
                            <input type="file" id="${IDS.inputSertipikat}" accept=".pdf" style="display:none">
                            <div class="ppat-dropzone-inner">
                                <span class="ppat-dropzone-icon">📜</span>
                                <div class="ppat-dropzone-texts">
                                    <span class="ppat-dropzone-title">Upload Pengecekan Sertipikat</span>
                                    <span class="ppat-dropzone-sub">Auto-cari NIB & Kode lalu isi PBB, BPHTB, PPh & Saksi</span>
                                </div>
                            </div>
                        </div>
                        <div id="${IDS.statusSertipikat}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardSertipikat}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.sertipikatBerkas}">Berkas: -</span>
                                <span class="ppat-person-badge" style="background:#337ab7;">Sertipikat</span>
                            </div>
                            <div class="ppat-person-meta">NIB Elektronik: <b id="${IDS.sertipikatNib}">-</b></div>
                            <div class="ppat-person-meta">Kode Sertifikat: <b id="${IDS.sertipikatKode}">-</b></div>
                            <div style="display:flex; gap:6px; margin-top:8px;">
                                <button id="${IDS.btnCariBerkas}" class="ppat-btn-fill" style="flex:1; background:#337ab7;" title="Cari di menu Berkas ATR/BPN">Cari di Berkas</button>
                                <button id="${IDS.btnFillSertipikat}" class="ppat-btn-fill" style="flex:1;" title="Isi form Sertipikat di halaman AJB">Isi Sertipikat</button>
                            </div>
                        </div>
                        <div id="${IDS.statusBphtb}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardBphtb}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.bphtbNop}">-</span>
                                <span class="ppat-person-badge" style="background:#d97706;">PBB & BPHTB</span>
                            </div>
                            <div class="ppat-person-meta">Luas: <b id="${IDS.bphtbLuas}">-</b> M² | NJOP/M²: <b id="${IDS.bphtbNjop}">-</b></div>
                            <div class="ppat-person-meta">No. Bukti Bayar: <b id="${IDS.bphtbNoBukti}">-</b></div>
                        </div>
                        <div id="${IDS.statusPph}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardPph}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.pphSuket}">-</span>
                                <span class="ppat-person-badge" style="background:#e11d48;">PPh</span>
                            </div>
                            <div class="ppat-person-meta">NPWP: <b id="${IDS.pphNpwp}">-</b></div>
                            <div class="ppat-person-meta">Nama WP: <span id="${IDS.pphNama}">-</span> | Tgl: <span id="${IDS.pphTanggal}">-</span></div>
                        </div>
                        <div id="${IDS.statusSaksi}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardDetectedSaksi}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name">2 Saksi dari AJB</span>
                                <span class="ppat-person-badge" style="background:#0d9488;">Saksi</span>
                            </div>
                            <div class="ppat-person-meta">Saksi 1: <b id="${IDS.saksi1Nama}">-</b></div>
                            <div class="ppat-person-meta">Saksi 2: <b id="${IDS.saksi2Nama}">-</b></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    /** Membuat elemen root berisi panel dan mengembalikannya (belum dipasang ke DOM). */
    function createRoot() {
        const root = document.createElement("div");
        root.id = IDS.root;
        root.innerHTML = HTML;
        return root;
    }

    /** Mengambil referensi semua elemen penting setelah root dipasang ke DOM. */
    function queryElements() {
        const byId = (id) => document.getElementById(id);
        return Object.fromEntries(Object.entries(IDS).map(([name, id]) => [name, byId(id)]));
    }

    return { IDS, createRoot, queryElements };
})();
