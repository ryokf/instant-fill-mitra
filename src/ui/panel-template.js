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
        listPersetujuan: "ppat-list-persetujuan",
        listSaksi: "ppat-list-saksi",
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

                <div class="ppat-form-group">
                    <label class="ppat-label">Pilih Penjual (PT):</label>
                    <select id="${IDS.selectPt}" class="ppat-select">
                        <option value="">-- Pilih PT --</option>
                    </select>
                    <button id="${IDS.btnFillPenjual}" class="ppat-btn-fill">Isi Form Penjual</button>
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
