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

/**
 * Normalisasi nama PT agar perbandingan tidak sensitif terhadap
 * huruf besar/kecil, spasi ganda, titik, dan koma.
 */
function normalizeName(name) {
    return (name || "")
        .toUpperCase()
        .replace(/[.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Mencari key PT di database berdasarkan nama yang terbaca dari web.
 */
function findPtKeyByName(name) {
    const target = normalizeName(name);
    if (!target) return null;

    // 1. Cocok persis
    for (const key in database) {
        if (normalizeName(database[key].penjual.nama) === target) return key;
    }
    // 2. Cocok sebagian (antisipasi tambahan teks/singkatan di web)
    for (const key in database) {
        const dbName = normalizeName(database[key].penjual.nama);
        if (target.includes(dbName) || dbName.includes(target)) return key;
    }
    return null;
}

/**
 * Dijalankan DI HALAMAN web PPAT: membaca nama-nama penjual yang sudah
 * tercatat pada panel "Daftar Penjual" (#daftarpihak1placeholder).
 */
function readPenjualNamesFromPage() {
    const names = [];
    const items = document.querySelectorAll(
        "#daftarpihak1placeholder blockquote.message",
    );
    items.forEach((bq) => {
        // Isi blockquote: "Nama : PT XXX<br>Alamat : ...<br>Email : ..."
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

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

document.addEventListener("DOMContentLoaded", () => {
    const selectPt = document.getElementById("select-pt");
    const selectPersetujuan = document.getElementById("select-persetujuan");
    const detectStatus = document.getElementById("detect-status");
    const btnRedetect = document.getElementById("btn-redetect");

    // Populate PT dropdown
    for (const key in database) {
        let option = document.createElement("option");
        option.value = key;
        option.textContent = database[key].penjual.nama;
        selectPt.appendChild(option);
    }

    // Isi dropdown Pihak Persetujuan sesuai PT terpilih
    function renderPersetujuan(ptKey) {
        selectPersetujuan.innerHTML = "";

        if (ptKey && database[ptKey]) {
            database[ptKey].persetujuan.forEach((orang, index) => {
                let option = document.createElement("option");
                option.value = index;
                option.textContent = orang.nama + " (" + orang.id + ")";
                selectPersetujuan.appendChild(option);
            });
        } else {
            selectPersetujuan.innerHTML =
                '<option value="">-- Pilih PT Dulu --</option>';
        }
    }

    function setStatus(text, type) {
        detectStatus.textContent = text;
        detectStatus.className = "status " + (type || "");
    }

    // Update Persetujuan dropdown based on selected PT
    selectPt.addEventListener("change", (e) => {
        renderPersetujuan(e.target.value);
    });

    /**
     * Membaca "Daftar Penjual" di web, lalu otomatis memilih PT yang cocok
     * sehingga user cukup memilih nama Pihak Persetujuan.
     * @returns {Promise<string|null>} key PT yang terdeteksi
     */
    async function detectPtFromPage() {
        setStatus("Membaca data penjual di halaman...", "");
        try {
            const tab = await getActiveTab();
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: readPenjualNamesFromPage,
            });
            const names = (results && results[0] && results[0].result) || [];

            if (names.length === 0) {
                setStatus(
                    "Penjual belum tercatat di web. Pilih PT secara manual.",
                    "warn",
                );
                return null;
            }

            for (const name of names) {
                const key = findPtKeyByName(name);
                if (key) {
                    selectPt.value = key;
                    renderPersetujuan(key);
                    setStatus("✔ Terdeteksi dari web: " + name, "ok");
                    return key;
                }
            }

            setStatus(
                "Penjual di web (" + names.join(", ") + ") tidak ada di database.",
                "warn",
            );
            return null;
        } catch (err) {
            console.warn("Deteksi PT gagal:", err);
            setStatus(
                "Tidak dapat membaca halaman. Buka halaman Akta di ppat.atrbpn.go.id.",
                "warn",
            );
            return null;
        }
    }

    btnRedetect.addEventListener("click", (e) => {
        e.preventDefault();
        detectPtFromPage();
    });

    // Deteksi otomatis saat popup dibuka
    detectPtFromPage();

    // Execute autofill for Penjual
    document
        .getElementById("btn-fill-penjual")
        .addEventListener("click", async () => {
            const ptKey = selectPt.value;
            if (!ptKey) return alert("Pilih PT terlebih dahulu!");

            const tab = await getActiveTab();
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    files: ["content.js"],
                },
                () => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "fillPenjual",
                        data: database[ptKey].penjual,
                    });
                },
            );
        });

    // Execute autofill for Pihak Persetujuan
    document
        .getElementById("btn-fill-persetujuan")
        .addEventListener("click", async () => {
            let ptKey = selectPt.value;

            // Jika PT belum terpilih, coba deteksi ulang dari halaman
            if (!ptKey) {
                ptKey = await detectPtFromPage();
                if (!ptKey) return alert("PT penjual tidak terdeteksi. Pilih PT terlebih dahulu!");
            }

            const indexPersetujuan = selectPersetujuan.value;
            if (indexPersetujuan === "")
                return alert("Pilih Pihak Persetujuan!");

            const tab = await getActiveTab();
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    files: ["content.js"],
                },
                () => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "fillPersetujuan",
                        data: database[ptKey].persetujuan[indexPersetujuan],
                    });
                },
            );
        });
});
