// Database dummy (Bisa disesuaikan atau ditarik dari API nantinya)
const database = {
    PT_DPU: {
        penjual: {
            nama: "PT DWI PERKASA UTAMA",
            alamat:
                "Jl. Raya Mranggen No. 30, RT 001 / RW 001, Desa Mranggen, Kecamatan Mranggen, Kabupaten Demak, Jawa Tengah",
            kota: "Demak",
            npwp: "0027724004515000",
            akta: "01", // Ini adalah Nomor Akta Pendirian
            tgl_akta: "02/08/2010",
            tipe_pemilik: "33", // 33: Badan Usaha Milik Swasta (BUMS)
            tipe_usaha: "4", // 4: Perseroan Terbatas (PT)
        },
        persetujuan: [
            {
                id: "1",
                nik: "3321010511670002",
                nama: "ABDUS SHOMAD",
                alamat: "RT 001, RW 001, Desa Mranggen, Kecamatan Mranggen, Kabupaten Demak",
                tempat_lahir: "Demak",
                tgl_lahir: "05/11/1967",
                pekerjaan: "Karyawan Swasta",
            },
            {
                id: "2",
                nik: "3321034309830003",
                nama: "Jumaidah Sugiharti",
                alamat: "Tamansari RT 003 / RW 003, Desa Tamansari, Kecamatan Mranggen, Kabupaten Demak",
                tempat_lahir: "Demak",
                tgl_lahir: "03/09/1983",
                pekerjaan: "Karyawan Swasta",
            },
            {
                id: "3",
                nik: "3321012106950001",
                nama: "Riyandika Yusuf Ashari",
                alamat: "Jalan Batursari Raya Nomor 09, RT 005 / RW 003, Desa Batursari, Kecamatan Mranggen, Kabupaten Demak",
                tempat_lahir: "Demak",
                tgl_lahir: "21/06/1995",
                pekerjaan: "Karyawan Swasta",
            },
        ],
    },
    PT_AMANAH: {
        penjual: {
            nama: "PT AMANAH BERKAH PROPERTY",
            alamat:
                "Perumahan Griya Mangunjiwan Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak",
            kota: "Demak",
            npwp: "0999358021515000",
            akta: "01", // Ini adalah Nomor Akta Pendirian
            tgl_akta: "18/12/2023",
            tipe_pemilik: "33", // 33: Badan Usaha Milik Swasta (BUMS)
            tipe_usaha: "4", // 4: Perseroan Terbatas (PT)
        },
        persetujuan: [
            {
                id: "1",
                nik: "3321111409030002",
                nama: "MUHAMMAD LUQMAN HAKIM",
                alamat:
                    "Perum Griya Mangunjiwan Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak",
                tempat_lahir: "Sukoharjo",
                tgl_lahir: "14/09/2003",
                pekerjaan: "Karyawan Swasta",
            },
            {
                id: "2",
                nik: "3321116209790006",
                nama: "SEPTIANA SETYOWATI",
                alamat:
                    "Perum Griya Mangunjiwan Permata Asri, RT 002 / RW 008, Kelurahan Mangunjiwan, Kecamatan Demak, Kabupaten Demak",
                tempat_lahir: "Sukoharjo",
                tgl_lahir: "22/09/1979",
                pekerjaan: "Karyawan Swasta",
            },
        ],
    },
};

// Database Pihak Saksi (Independen / tidak terikat oleh PT atau data manapun)
const databaseSaksi = [
    {
        id: "1",
        nik: "3315166105990001",
        nama: "NURUL HIKMAH",
        alamat: "Rejosari, RT 003 / RW 003, Desa Botorejo, Kecamatan Wonosalam, Kabupaten Demak",
        tempat_lahir: "Grobogan",
        tgl_lahir: "21/05/1999",
        pekerjaan: "Wiraswasta",
        tipe_bukti: "1", // 1: KTP
    },
    {
        id: "2",
        nik: "3321046311970003",
        nama: "NOVIA MAHARSARI",
        alamat: "Dukuh Ngobongan, RT 003 / RW 003, Desa Tanjungsekar, Kecamatan Pucakwangi, Kabupaten Pati",
        tempat_lahir: "Semarang",
        tgl_lahir: "23/11/1997",
        pekerjaan: "Pelajar / Mahasiswa",
        tipe_bukti: "1", // 1: KTP
    },
    {
        id: "3",
        nik: "3404021708990001",
        nama: "RIDHWAN NUR CAHYO SAPUTRO",
        alamat: "Jetis Prenggan, RT 001/RW 018, Desa Sidokarto, Kecamatan Godean, Kabupaten Sleman",
        tempat_lahir: "Sleman",
        tgl_lahir: "17/08/1999",
        pekerjaan: "Pelajar / Mahasiswa",
        tipe_bukti: "1", // 1: KTP
    },
    {
        id: "4",
        nik: "3321040608940002",
        nama: "MUHAMMAD RIEFKY ABDILLAH",
        alamat: "Jl. Kapas Timur VIII D G.1061, RT 004/RW 008, Kelurahan Gebangsari, Kecamatan Genuk, Kota Semarang",
        tempat_lahir: "Demak",
        tgl_lahir: "06/08/1994",
        pekerjaan: "Karyawan Swasta",
        tipe_bukti: "1", // 1: KTP
    },
];

/**
 * Normalisasi nama untuk pencocokan toleran
 */
function normalizeName(name) {
    return (name || "")
        .toUpperCase()
        .replace(/[.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Mencari key PT di database berdasarkan nama
 */
function findPtKeyByName(name) {
    const target = normalizeName(name);
    if (!target) return null;

    // 1. Cocok persis
    for (const key in database) {
        if (normalizeName(database[key].penjual.nama) === target) return key;
    }
    // 2. Cocok substring
    for (const key in database) {
        const dbName = normalizeName(database[key].penjual.nama);
        if (target.includes(dbName) || dbName.includes(target)) return key;
    }
    return null;
}

/**
 * Membaca nama PT dari panel "Daftar Penjual" di halaman PPAT
 */
function readPenjualNamesFromPage() {
    const names = [];
    const items = document.querySelectorAll(
        "#daftarpihak1placeholder blockquote.message",
    );
    items.forEach((bq) => {
        const lines = bq.innerHTML.split(/<br\s*\/?>/i);
        for (const line of lines) {
            const tmp = document.createElement("div");
            tmp.innerHTML = line;
            const text = (tmp.textContent || "").trim();
            const match = text.match(/^Nama\s*:\s*(.+)$/i);
            if (match) {
                names.push(match[1].trim());
                break;
            }
        }
    });
    return names;
}

/**
 * Menunggu elemen DOM muncul dengan timeout
 */
function waitForElement(selector, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        const startTime = Date.now();
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
            } else if (Date.now() - startTime > timeoutMs) {
                clearInterval(interval);
                resolve(null);
            }
        }, 150);
    });
}

/**
 * Eksekusi skrip di Main World agar jQuery & Select2 ikut tersinkronisasi
 */
function runInPageContext(fn, ...args) {
    try {
        const script = document.createElement("script");
        script.textContent = `(${fn})(${args.map((a) => JSON.stringify(a)).join(",")});`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (err) {
        console.warn("Eksekusi script di page context dilewati:", err);
    }
}

/**
 * Mengisi nilai input/textarea standar dan memicu event validasi
 */
function fillField(selector, value) {
    if (value === undefined || value === null) return;
    const el = document.querySelector(selector);
    if (el) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        runInPageContext((s, v) => {
            if (window.jQuery) {
                var $t = window.jQuery(s);
                if ($t.length) {
                    $t.val(v).trigger("input").trigger("change");
                }
            }
        }, selector, value);
    } else {
        console.warn("Elemen tidak ditemukan: " + selector);
    }
}

/**
 * Mengisi nilai <select> dan memperbarui Select2
 */
function setSelect2Value(selector, value) {
    if (!value) return false;
    const el = document.querySelector(selector);
    if (!el) {
        console.warn("Elemen select tidak ditemukan: " + selector);
        return false;
    }

    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    const containerId = `select2-${el.id}-container`;
    const container = document.getElementById(containerId);
    if (container && el.selectedIndex >= 0) {
        const opt = el.options[el.selectedIndex];
        if (opt) {
            container.textContent = opt.textContent;
            container.title = opt.textContent;
        }
    }

    runInPageContext((s, v) => {
        if (window.jQuery) {
            var $t = window.jQuery(s);
            if ($t.length) {
                $t.val(v).trigger("change");
            }
        }
    }, selector, value);

    return true;
}

/**
 * Logika pengisian otomatis Form Penjual (Badan Hukum)
 */
async function handleFillPenjual(data) {
    const tipePihak1El = document.querySelector("select#tipepihak1");
    const existingForm = document.querySelector("#frmInput1BadanHukum");

    // Jika form Badan Hukum belum ada atau belum Non Perorangan
    if (!existingForm || (tipePihak1El && tipePihak1El.value !== "Non Perorangan")) {
        if (tipePihak1El) {
            setSelect2Value("select#tipepihak1", "Non Perorangan");
        }

        const formLoaded = await waitForElement("#frmInput1BadanHukum", 8000);
        if (!formLoaded) {
            alert("Gagal memuat Form Penjual (Badan Hukum). Pastikan Anda berada di halaman pembuatan Akta PPAT.");
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Set Select2 Jenis & Tipe Badan Hukum
    setSelect2Value("#frmInput1BadanHukum select#tipepemilikid", data.tipe_pemilik || "33");
    setSelect2Value("#frmInput1BadanHukum select#tipeusaha", data.tipe_usaha || "4");

    // Isi field form Penjual
    fillField("#tNAMA_LENGKAPPihak1", data.nama);
    fillField("#frmInput1BadanHukum #tALAMAT", data.alamat);
    fillField("#frmInput1BadanHukum #tLOKASI", data.kota);
    fillField("#frmInput1BadanHukum #tNPWP", data.npwp);
    fillField("#frmInput1BadanHukum #tIDENTITAS", data.akta);
    fillField("#frmInput1BadanHukum #tPENDIRIAN", data.tgl_akta);

    alert("Data Penjual (Badan Hukum) berhasil diisi!");
}

/**
 * Logika pengisian otomatis Form Pihak Persetujuan (WNI)
 */
async function handleFillPersetujuan(data) {
    const formLoaded = await waitForElement("#frmPihaksetujuDukcapil", 5000);
    if (!formLoaded) {
        alert("Form Pihak Persetujuan tidak ditemukan. Pastikan Anda berada di seksi E (Pihak Persetujuan).");
        return;
    }

    fillField("#tNIKpihaksetuju", data.nik);
    fillField("#tNAMA_LENGKAPpihaksetuju", data.nama);
    fillField("#tALAMATpihaksetuju", data.alamat);
    fillField("#tTEMPAT_LAHIRpihaksetuju", data.tempat_lahir);
    fillField("#tTANGGAL_LAHIRpihaksetuju", data.tgl_lahir);
    fillField("#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN", data.pekerjaan);

    alert("Data Pihak Persetujuan berhasil diisi!\nSilakan periksa dan klik 'Tambah'.");
}

/**
 * Logika pengisian otomatis Form Pihak Saksi (Bagian M)
 */
async function handleFillSaksi(data) {
    const formLoaded = await waitForElement("#frmSaksiDukcapil", 5000);
    if (!formLoaded) {
        alert("Form Saksi tidak ditemukan. Pastikan Anda berada di halaman pembuatan Akta PPAT.");
        return;
    }

    // Pilih Jenis Bukti Identitas: 1 = KTP
    setSelect2Value("#frmSaksiDukcapil select#tipebuktisaksi1", data.tipe_bukti || "1");

    // Isi field form Saksi
    fillField("#tNIKsaksi", data.nik);
    fillField("#tNAMA_LENGKAPsaksi", data.nama);
    fillField("#tALAMATsaksi", data.alamat);
    fillField("#tTEMPAT_LAHIRsaksi", data.tempat_lahir);
    fillField("#tTANGGAL_LAHIRsaksi", data.tgl_lahir);
    fillField("#tJENIS_PEKERJAANsaksi", data.pekerjaan);

    alert("Data Saksi (" + data.nama + ") berhasil diisi!\nSilakan periksa dan klik 'Tambah'.");
}

// =============================================================================
// IN-PAGE FLOATING PANEL (Panel Melayang Langsung di Halaman Web PPAT)
// =============================================================================

function createInPagePanel() {
    if (document.getElementById("ppat-autofill-root")) return;

    // 1. Injeksi Style Khusus Panel agar tidak bentrok dengan CSS halaman
    const style = document.createElement("style");
    style.id = "ppat-autofill-style";
    style.textContent = `
        #ppat-autofill-root {
            position: fixed;
            top: 75px;
            right: 20px;
            z-index: 9999999;
            font-family: Arial, sans-serif;
            color: #333;
        }
        #ppat-panel {
            width: 310px;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.22);
            border: 1px solid #ddd;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: ppatFadeIn 0.2s ease-out;
        }
        #ppat-panel.hidden {
            display: none !important;
        }
        #ppat-panel-header {
            background: #26B99A;
            color: #ffffff;
            padding: 10px 14px;
            font-size: 13px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }
        #ppat-panel-header .title {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #ppat-panel-header .actions button {
            background: transparent;
            border: none;
            color: #ffffff;
            font-size: 14px;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
            opacity: 0.85;
        }
        #ppat-panel-header .actions button:hover {
            opacity: 1;
        }
        #ppat-panel-body {
            padding: 12px 14px;
            max-height: 520px;
            overflow-y: auto;
        }
        .ppat-status {
            font-size: 11px;
            padding: 6px 8px;
            border-radius: 4px;
            margin-bottom: 12px;
            background: #f4f4f4;
            color: #555;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .ppat-status.ok {
            background: #e6f7f2;
            color: #137a63;
        }
        .ppat-status.warn {
            background: #fff4e0;
            color: #8a5a00;
        }
        .ppat-btn-link {
            font-size: 10px;
            color: #26B99A;
            cursor: pointer;
            text-decoration: underline;
            margin-left: 6px;
            white-space: nowrap;
        }
        .ppat-form-group {
            margin-bottom: 12px;
        }
        .ppat-label {
            display: block;
            font-size: 11px;
            margin-bottom: 4px;
            font-weight: bold;
            color: #444;
        }
        .ppat-select {
            width: 100%;
            padding: 7px;
            font-size: 12px;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
            margin-bottom: 6px;
            background: #fff;
        }
        .ppat-btn-fill {
            width: 100%;
            padding: 7px;
            background-color: #26B99A;
            color: white;
            border: none;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .ppat-btn-fill:hover {
            background-color: #169F85;
        }
        .ppat-divider {
            border-top: 1px dashed #ccc;
            margin: 12px 0;
        }
        .ppat-person-list {
            list-style: none;
            margin: 0;
            padding: 0;
            max-height: 220px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .ppat-person-list li {
            padding: 8px 10px;
            border-bottom: 1px solid #eee;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.15s;
        }
        .ppat-person-list li:last-child {
            border-bottom: none;
        }
        .ppat-person-list li:hover {
            background: #e6f7f2;
        }
        .ppat-person-list li.active {
            background: #26B99A;
            color: #fff;
        }
        .ppat-person-list li .nik {
            display: block;
            font-size: 10px;
            color: #777;
            margin-top: 2px;
        }
        .ppat-person-list li.active .nik {
            color: #e6f7f2;
        }
        .ppat-person-list li.empty {
            cursor: default;
            color: #999;
            font-style: italic;
            text-align: center;
        }
        .ppat-person-list li.empty:hover {
            background: none;
        }
        /* Tombol melayang jika panel diminimalkan/ditutup */
        #ppat-launcher-badge {
            display: none;
            background: #26B99A;
            color: #fff;
            padding: 8px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 4px 14px rgba(0,0,0,0.25);
            cursor: pointer;
            user-select: none;
            transition: transform 0.15s, background 0.15s;
        }
        #ppat-launcher-badge:hover {
            background: #169F85;
            transform: scale(1.04);
        }
        @keyframes ppatFadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // 2. Kontainer Root
    const root = document.createElement("div");
    root.id = "ppat-autofill-root";

    // 3. Template HTML Panel
    root.innerHTML = `
        <div id="ppat-launcher-badge">⚡ AutoFill PPAT</div>
        <div id="ppat-panel">
            <div id="ppat-panel-header">
                <span class="title">⚡ AutoFill Akta Jual Beli</span>
                <div class="actions">
                    <button id="ppat-btn-minimize" title="Kecilkan panel">─</button>
                    <button id="ppat-btn-close" title="Tutup panel">✕</button>
                </div>
            </div>
            <div id="ppat-panel-body">
                <div id="ppat-detect-status" class="ppat-status">
                    <span id="ppat-status-text">Membaca data penjual di web...</span>
                    <a id="ppat-btn-redetect" class="ppat-btn-link" title="Deteksi ulang dari web">Cek Ulang</a>
                </div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pilih Penjual (PT):</label>
                    <select id="ppat-select-pt" class="ppat-select">
                        <option value="">-- Pilih PT --</option>
                    </select>
                    <button id="ppat-btn-fill-penjual" class="ppat-btn-fill">Isi Form Penjual</button>
                </div>

                <div class="ppat-divider"></div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pihak Persetujuan <span style="font-weight:normal;color:#888;">(klik langsung isi)</span>:</label>
                    <ul id="ppat-list-persetujuan" class="ppat-person-list">
                        <li class="empty">-- Pilih PT Dulu --</li>
                    </ul>
                </div>

                <div class="ppat-divider"></div>

                <div class="ppat-form-group">
                    <label class="ppat-label">Pihak Saksi <span style="font-weight:normal;color:#888;">(klik langsung isi)</span>:</label>
                    <ul id="ppat-list-saksi" class="ppat-person-list"></ul>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(root);

    // 4. Referensi Elemen Panel
    const panel = document.getElementById("ppat-panel");
    const badge = document.getElementById("ppat-launcher-badge");
    const btnMinimize = document.getElementById("ppat-btn-minimize");
    const btnClose = document.getElementById("ppat-btn-close");
    const selectPt = document.getElementById("ppat-select-pt");
    const listPersetujuan = document.getElementById("ppat-list-persetujuan");
    const listSaksi = document.getElementById("ppat-list-saksi");
    const statusBox = document.getElementById("ppat-detect-status");
    const statusText = document.getElementById("ppat-status-text");
    const btnRedetect = document.getElementById("ppat-btn-redetect");
    const btnFillPenjual = document.getElementById("ppat-btn-fill-penjual");

    // Toggle minimize / buka
    function minimizePanel() {
        panel.classList.add("hidden");
        badge.style.display = "block";
    }
    function expandPanel() {
        panel.classList.remove("hidden");
        badge.style.display = "none";
    }

    btnMinimize.addEventListener("click", minimizePanel);
    btnClose.addEventListener("click", minimizePanel);
    badge.addEventListener("click", expandPanel);

    // Isi Dropdown PT
    for (const key in database) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = database[key].penjual.nama;
        selectPt.appendChild(opt);
    }

    // Tampilkan daftar nama Pihak Persetujuan
    function renderPersetujuanList(ptKey) {
        listPersetujuan.innerHTML = "";

        if (!ptKey || !database[ptKey]) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "-- Pilih PT Dulu --";
            listPersetujuan.appendChild(li);
            return;
        }

        database[ptKey].persetujuan.forEach((orang) => {
            const li = document.createElement("li");
            li.title = "Klik untuk mengisi form Pihak Persetujuan";
            li.textContent = orang.nama;

            const nikSpan = document.createElement("span");
            nikSpan.className = "nik";
            nikSpan.textContent = "NIK: " + orang.nik;
            li.appendChild(nikSpan);

            li.addEventListener("click", () => {
                listPersetujuan
                    .querySelectorAll("li.active")
                    .forEach((el) => el.classList.remove("active"));
                li.classList.add("active");
                handleFillPersetujuan(orang);
            });

            listPersetujuan.appendChild(li);
        });
    }

    // Tampilkan daftar nama Pihak Saksi (tidak terikat PT manapun)
    function renderSaksiList() {
        listSaksi.innerHTML = "";

        if (!databaseSaksi || databaseSaksi.length === 0) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "-- Belum ada data saksi --";
            listSaksi.appendChild(li);
            return;
        }

        databaseSaksi.forEach((saksi) => {
            const li = document.createElement("li");
            li.title = "Klik untuk mengisi form Pihak Saksi";
            li.textContent = saksi.nama;

            const nikSpan = document.createElement("span");
            nikSpan.className = "nik";
            nikSpan.textContent = "NIK: " + saksi.nik;
            li.appendChild(nikSpan);

            li.addEventListener("click", () => {
                listSaksi
                    .querySelectorAll("li.active")
                    .forEach((el) => el.classList.remove("active"));
                li.classList.add("active");
                handleFillSaksi(saksi);
            });

            listSaksi.appendChild(li);
        });
    }

    renderSaksiList();

    function setStatus(text, type) {
        statusText.textContent = text;
        statusBox.className = "ppat-status " + (type || "");
    }

    selectPt.addEventListener("change", (e) => {
        renderPersetujuanList(e.target.value);
    });

    // Deteksi nama PT yang sudah tercatat di web
    let lastDetectedKey = null;
    function detectPtFromWeb(force = false) {
        const names = readPenjualNamesFromPage();

        if (names.length === 0) {
            if (force || !selectPt.value) {
                setStatus("Penjual belum tercatat di web. Pilih manual.", "warn");
            }
            return null;
        }

        let foundKey = null;
        let foundName = null;
        for (const name of names) {
            const k = findPtKeyByName(name);
            if (k) {
                foundKey = k;
                foundName = name;
                break;
            }
        }

        if (foundKey) {
            if (force || foundKey !== lastDetectedKey) {
                lastDetectedKey = foundKey;
                selectPt.value = foundKey;
                renderPersetujuanList(foundKey);
                setStatus("✔ Terdeteksi: " + foundName, "ok");
            }
            return foundKey;
        } else {
            if (force) {
                setStatus("Nama PT di web belum ada di database.", "warn");
            }
            return null;
        }
    }

    btnRedetect.addEventListener("click", () => {
        detectPtFromWeb(true);
    });

    btnFillPenjual.addEventListener("click", () => {
        const ptKey = selectPt.value;
        if (!ptKey) return alert("Pilih PT terlebih dahulu!");
        handleFillPenjual(database[ptKey].penjual);
    });

    // Jalankan deteksi awal
    detectPtFromWeb(true);

    // Pengecekan berkala (setiap 2.5 detik) agar saat user klik "Tambah" di web PPAT,
    // panel otomatis mendeteksi PT dan memunculkan personil pihak persetujuan
    setInterval(() => {
        detectPtFromWeb(false);
    }, 2500);

    // Listener toggle dari icon toolbar di Opera
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleAutoFillPanel") {
            if (panel.classList.contains("hidden")) {
                expandPanel();
            } else {
                minimizePanel();
            }
        }
    });
}

// Inisialisasi Panel saat DOM siap
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createInPagePanel);
} else {
    createInPagePanel();
}
