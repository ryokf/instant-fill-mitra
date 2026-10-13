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
                <div id="${IDS.statusBox}" class="ppat-status">
                    <span id="${IDS.statusText}">Membaca data penjual di web...</span>
                    <a id="${IDS.btnRedetect}" class="ppat-btn-link" title="Deteksi ulang dari web">Cek Ulang</a>
                </div>

                <div class="ppat-auto-submit-row">
                    <label class="ppat-auto-submit-label">
                        <input type="checkbox" id="${IDS.chkAutoSubmit}" checked>
                        <span>Otomatis klik tombol <b>"Tambah"</b> di web</span>
                    </label>
                </div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pilih Penjual (PT) <span class="ppat-label-hint">(pilih langsung isi & tambah)</span>:</label>
                    <select id="${IDS.selectPt}" class="ppat-select">
                        <option value="">-- Pilih PT --</option>
                    </select>
                    <button id="${IDS.btnFillPenjual}" class="ppat-btn-fill">Isi Form Penjual</button>
                </div>

                <div class="ppat-divider"></div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pihak Pembeli <span class="ppat-label-hint">(upload akta PDF)</span>:</label>
                    <div id="${IDS.dropzoneAkta}" class="ppat-dropzone" title="Klik atau seret file PDF Akta ke sini">
                        <input type="file" id="${IDS.inputAkta}" accept=".pdf" style="display:none">
                        <div class="ppat-dropzone-inner">
                            <span class="ppat-dropzone-icon">📄</span>
                            <div class="ppat-dropzone-texts">
                                <span class="ppat-dropzone-title">Upload Akta (PDF)</span>
                                <span class="ppat-dropzone-sub">Klik / seret file untuk auto-fill pembeli</span>
                            </div>
                        </div>
                    </div>
                    <div id="${IDS.statusAkta}" class="ppat-status hidden" style="margin-top:6px; margin-bottom:0;"></div>
                    <div id="${IDS.cardPembeli}" class="ppat-person-card hidden">
                        <div class="ppat-person-card-header">
                            <span class="ppat-person-name" id="${IDS.pembeliNama}">-</span>
                            <span class="ppat-person-badge">Pembeli</span>
                        </div>
                        <div class="ppat-person-meta">NIK: <b id="${IDS.pembeliNik}">-</b></div>
                        <div class="ppat-person-meta">Pekerjaan: <span id="${IDS.pembeliPekerjaan}">-</span></div>
                        <button id="${IDS.btnFillPembeli}" class="ppat-btn-fill" style="margin-top:8px;">Isi Ulang Form Pembeli</button>
                    </div>
                </div>

                <div class="ppat-divider"></div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pihak Persetujuan <span class="ppat-label-hint">(klik langsung isi)</span>:</label>
                    <ul id="${IDS.listPersetujuan}" class="ppat-person-list"></ul>
                </div>

                <div class="ppat-divider"></div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pihak Saksi <span class="ppat-label-hint">(klik langsung isi)</span>:</label>
                    <ul id="${IDS.listSaksi}" class="ppat-person-list"></ul>
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
