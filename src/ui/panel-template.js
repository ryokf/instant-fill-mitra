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
        statusBox: "ppat-detect-status",
        statusText: "ppat-status-text",
        btnRedetect: "ppat-btn-redetect",
        selectPt: "ppat-select-pt",
        btnFillPenjual: "ppat-btn-fill-penjual",
        chkAutoSubmit: "ppat-chk-autosubmit",
        listPersetujuan: "ppat-list-persetujuan",
        listSaksi: "ppat-list-saksi",
        dropzoneAkta: "ppat-dropzone-akta",
        inputAkta: "ppat-input-akta",
        statusAkta: "ppat-status-akta",
        cardPembeli: "ppat-card-pembeli",
        btnFillPembeli: "ppat-btn-fill-pembeli",
        pembeliNama: "ppat-pembeli-nama",
        pembeliNik: "ppat-pembeli-nik",
        pembeliPekerjaan: "ppat-pembeli-pekerjaan",
        aktaNomor: "ppat-akta-nomor",
        aktaTanggal: "ppat-akta-tanggal",
        dropzoneBphtb: "ppat-dropzone-bphtb",
        inputBphtb: "ppat-input-bphtb",
        statusBphtb: "ppat-status-bphtb",
        cardBphtb: "ppat-card-bphtb",
        bphtbNop: "ppat-bphtb-nop",
        bphtbLuas: "ppat-bphtb-luas",
        bphtbNjop: "ppat-bphtb-njop",
        bphtbNoBukti: "ppat-bphtb-nobukti",
        btnFillPbbBphtb: "ppat-btn-fill-pbb-bphtb",
        btnFillPbbOnly: "ppat-btn-fill-pbb-only",
        btnFillBphtbOnly: "ppat-btn-fill-bphtb-only",
        dropzoneSertipikat: "ppat-dropzone-sertipikat",
        inputSertipikat: "ppat-input-sertipikat",
        statusSertipikat: "ppat-status-sertipikat",
        cardSertipikat: "ppat-card-sertipikat",
        sertipikatBerkas: "ppat-sertipikat-berkas",
        sertipikatNib: "ppat-sertipikat-nib",
        sertipikatKode: "ppat-sertipikat-kode",
        btnCariBerkas: "ppat-btn-cari-berkas",
        btnFillSertipikat: "ppat-btn-fill-sertipikat",
        dropzonePph: "ppat-dropzone-pph",
        inputPph: "ppat-input-pph",
        statusPph: "ppat-status-pph",
        cardPph: "ppat-card-pph",
        pphSuket: "ppat-pph-suket",
        pphNpwp: "ppat-pph-npwp",
        pphNama: "ppat-pph-nama",
        pphTanggal: "ppat-pph-tanggal",
        btnFillPph: "ppat-btn-fill-pph",
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
                <!-- Status deteksi penjual di web -->
                <div id="${IDS.statusBox}" class="ppat-status">
                    <span id="${IDS.statusText}">Membaca data penjual di web...</span>
                    <a id="${IDS.btnRedetect}" class="ppat-btn-link" title="Deteksi ulang dari web">Cek Ulang</a>
                </div>

                <!-- Opsi otomatis klik tombol tambah -->
                <div class="ppat-auto-submit-row">
                    <label class="ppat-auto-submit-label">
                        <input type="checkbox" id="${IDS.chkAutoSubmit}" checked>
                        <span>Otomatis klik tombol <b>"Tambah"</b> di web</span>
                    </label>
                </div>

                <!-- SECTION 1: PENJUAL (PT) -->
                <div class="ppat-section" data-section="penjual">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">1</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Pihak Penjual (PT)</span>
                            <span class="ppat-section-hint">Pilih PT & auto-isi</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <select id="${IDS.selectPt}" class="ppat-select">
                            <option value="">-- Pilih PT --</option>
                        </select>
                        <button id="${IDS.btnFillPenjual}" class="ppat-btn-fill">Isi Form Penjual</button>
                    </div>
                </div>

                <!-- SECTION 2: PIHAK PERSETUJUAN (LANGSUNG DI BAWAH PENJUAL) -->
                <div class="ppat-section" data-section="persetujuan">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">2</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Pihak Persetujuan</span>
                            <span class="ppat-section-hint">Klik nama untuk langsung isi</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <ul id="${IDS.listPersetujuan}" class="ppat-person-list"></ul>
                    </div>
                </div>

                <!-- SECTION 3: AKTA & PIHAK PEMBELI -->
                <div class="ppat-section" data-section="akta">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">3</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Akta & Pihak Pembeli</span>
                            <span class="ppat-section-hint">Upload akta PDF</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <div id="${IDS.dropzoneAkta}" class="ppat-dropzone" title="Klik atau seret file PDF Akta ke sini">
                            <input type="file" id="${IDS.inputAkta}" accept=".pdf" style="display:none">
                            <div class="ppat-dropzone-inner">
                                <span class="ppat-dropzone-icon">📄</span>
                                <div class="ppat-dropzone-texts">
                                    <span class="ppat-dropzone-title">Upload Akta (PDF)</span>
                                    <span class="ppat-dropzone-sub">Auto-isi Input Akta & Pembeli</span>
                                </div>
                            </div>
                        </div>
                        <div id="${IDS.statusAkta}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardPembeli}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.pembeliNama}">-</span>
                                <span class="ppat-person-badge">Pembeli</span>
                            </div>
                            <div class="ppat-person-meta">No. Akta: <b id="${IDS.aktaNomor}">-</b> | Tgl: <span id="${IDS.aktaTanggal}">-</span></div>
                            <div class="ppat-person-meta">NIK: <b id="${IDS.pembeliNik}">-</b></div>
                            <div class="ppat-person-meta">Pekerjaan: <span id="${IDS.pembeliPekerjaan}">-</span></div>
                            <button id="${IDS.btnFillPembeli}" class="ppat-btn-fill" style="margin-top:8px;">Isi Ulang Form Pembeli</button>
                        </div>
                    </div>
                </div>

                <!-- SECTION 4: SERTIPIKAT & BERKAS -->
                <div class="ppat-section" data-section="sertipikat">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">4</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Sertipikat & Berkas</span>
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
                                    <span class="ppat-dropzone-sub">Auto-cari berkas & isi Sertipikat AJB</span>
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
                    </div>
                </div>

                <!-- SECTION 5: PBB & BPHTB -->
                <div class="ppat-section" data-section="bphtb">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">5</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">PBB & BPHTB</span>
                            <span class="ppat-section-hint">Upload berkas BPHTB</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <div id="${IDS.dropzoneBphtb}" class="ppat-dropzone" title="Klik atau seret berkas PDF / Gambar Dokumen BPHTB ke sini">
                            <input type="file" id="${IDS.inputBphtb}" accept=".pdf,.png,.jpg,.jpeg" style="display:none">
                            <div class="ppat-dropzone-inner">
                                <span class="ppat-dropzone-icon">📋</span>
                                <div class="ppat-dropzone-texts">
                                    <span class="ppat-dropzone-title">Upload Dokumen BPHTB</span>
                                    <span class="ppat-dropzone-sub">Klik / seret file untuk auto-fill PBB & BPHTB</span>
                                </div>
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
                            <div style="display:flex; gap:6px; margin-top:8px;">
                                <button id="${IDS.btnFillPbbBphtb}" class="ppat-btn-fill" style="flex:2;" title="Isi form PBB lalu lanjut form BPHTB">Isi Lengkap</button>
                                <button id="${IDS.btnFillPbbOnly}" class="ppat-btn-fill" style="flex:1; background:#4a5568;" title="Isi form PBB saja">Isi PBB</button>
                                <button id="${IDS.btnFillBphtbOnly}" class="ppat-btn-fill" style="flex:1; background:#4a5568;" title="Isi form BPHTB saja">Isi BPHTB</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION 6: PPH (PAJAK PENGHASILAN) -->
                <div class="ppat-section" data-section="pph">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">6</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Pajak Penghasilan (PPh)</span>
                            <span class="ppat-section-hint">Upload suket PPh</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <div id="${IDS.dropzonePph}" class="ppat-dropzone" title="Klik atau seret berkas PDF / Gambar Bukti PPh ke sini">
                            <input type="file" id="${IDS.inputPph}" accept=".pdf,.png,.jpg,.jpeg" style="display:none">
                            <div class="ppat-dropzone-inner">
                                <span class="ppat-dropzone-icon">💰</span>
                                <div class="ppat-dropzone-texts">
                                    <span class="ppat-dropzone-title">Upload Dokumen PPh</span>
                                    <span class="ppat-dropzone-sub">Auto-isi Suket & NPWP, Cari & Pilih File</span>
                                </div>
                            </div>
                        </div>
                        <div id="${IDS.statusPph}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                        <div id="${IDS.cardPph}" class="ppat-person-card hidden">
                            <div class="ppat-person-card-header">
                                <span class="ppat-person-name" id="${IDS.pphSuket}">-</span>
                                <span class="ppat-person-badge" style="background:#e11d48;">PPh</span>
                            </div>
                            <div class="ppat-person-meta">NPWP: <b id="${IDS.pphNpwp}">-</b></div>
                            <div class="ppat-person-meta">Nama WP: <span id="${IDS.pphNama}">-</span> | Tgl: <span id="${IDS.pphTanggal}">-</span></div>
                            <button id="${IDS.btnFillPph}" class="ppat-btn-fill" style="margin-top:8px; background:#e11d48;" title="Isi form PPh di halaman PPAT">Isi Form PPh</button>
                        </div>
                    </div>
                </div>

                <!-- SECTION 7: PIHAK SAKSI -->
                <div class="ppat-section" data-section="saksi">
                    <div class="ppat-section-header">
                        <span class="ppat-section-badge">7</span>
                        <div class="ppat-section-heading">
                            <span class="ppat-section-title">Pihak Saksi</span>
                            <span class="ppat-section-hint">Klik nama untuk langsung isi</span>
                        </div>
                    </div>
                    <div class="ppat-section-body">
                        <ul id="${IDS.listSaksi}" class="ppat-person-list"></ul>
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
