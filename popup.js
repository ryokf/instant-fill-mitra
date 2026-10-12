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
    const listPersetujuan = document.getElementById("list-persetujuan");
    const detectStatus = document.getElementById("detect-status");
    const btnRedetect = document.getElementById("btn-redetect");

    // Populate PT dropdown
    for (const key in database) {
        let option = document.createElement("option");
        option.value = key;
        option.textContent = database[key].penjual.nama;
        selectPt.appendChild(option);
    }

    // Tampilkan daftar Pihak Persetujuan (bisa diklik) sesuai PT terpilih
    function renderPersetujuan(ptKey) {
        listPersetujuan.innerHTML = "";

        if (!ptKey || !database[ptKey]) {
            const li = document.createElement("li");
            li.className = "empty";
            li.textContent = "-- Pilih PT Dulu --";
            listPersetujuan.appendChild(li);
            return;
        }

        database[ptKey].persetujuan.forEach((orang, index) => {
            const li = document.createElement("li");
            li.title = "Klik untuk mengisi form Pihak Persetujuan";
            li.textContent = orang.nama;

            const nik = document.createElement("span");
            nik.className = "nik";
            nik.textContent = "NIK " + orang.nik;
            li.appendChild(nik);

            li.addEventListener("click", () => {
                listPersetujuan
                    .querySelectorAll("li.active")
                    .forEach((el) => el.classList.remove("active"));
                li.classList.add("active");
                fillPersetujuan(ptKey, index);
            });

            listPersetujuan.appendChild(li);
        });
    }

    // Kirim data Pihak Persetujuan ke halaman web
    async function fillPersetujuan(ptKey, index) {
        const tab = await getActiveTab();
        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                files: ["content.js"],
            },
            () => {
                chrome.tabs.sendMessage(tab.id, {
                    action: "fillPersetujuan",
                    data: database[ptKey].persetujuan[index],
                });
            },
        );
    }

    function setStatus(text, type) {
        detectStatus.textContent = text;
        detectStatus.className = "status " + (type || "");
    }

    // Update Persetujuan dropdown based on selected PT
    selectPt.addEventListener("change", (e) => {
        renderPersetujuan(e.target.value);
    });

    // Hasil deteksi terakhir, agar UI hanya diperbarui bila ada perubahan
    // (supaya pilihan manual & highlight nama tidak ter-reset oleh pengecekan berkala)
    let lastDetectSignature = null;

    /**
     * Membaca "Daftar Penjual" di web, lalu otomatis memilih PT yang cocok
     * sehingga user cukup memilih nama Pihak Persetujuan.
     * @param {boolean} force paksa perbarui UI walau hasil sama
     * @returns {Promise<string|null>} key PT yang terdeteksi
     */
    async function detectPtFromPage(force = false) {
        let signature, apply;
        try {
            const tab = await getActiveTab();
            if (!tab || !tab.url || !tab.url.startsWith("https://ppat.atrbpn.go.id/")) {
                signature = "not-ppat";
                apply = () =>
                    setStatus(
                        "Buka halaman Akta di ppat.atrbpn.go.id untuk deteksi otomatis.",
                        "warn",
                    );
            } else {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: readPenjualNamesFromPage,
                });
                const names = (results && results[0] && results[0].result) || [];

                if (names.length === 0) {
                    signature = "tab:" + tab.id + "|empty";
                    apply = () =>
                        setStatus(
                            "Penjual belum tercatat di web. Pilih PT secara manual.",
                            "warn",
                        );
                } else {
                    let foundKey = null, foundName = null;
                    for (const name of names) {
                        const key = findPtKeyByName(name);
                        if (key) {
                            foundKey = key;
                            foundName = name;
                            break;
                        }
                    }

                    if (foundKey) {
                        signature = "tab:" + tab.id + "|pt:" + foundKey;
                        apply = () => {
                            selectPt.value = foundKey;
                            renderPersetujuan(foundKey);
                            setStatus("✔ Terdeteksi dari web: " + foundName, "ok");
                        };
                    } else {
                        signature = "tab:" + tab.id + "|unknown:" + names.join(",");
                        apply = () =>
                            setStatus(
                                "Penjual di web (" + names.join(", ") + ") tidak ada di database.",
                                "warn",
                            );
                    }
                }
            }
        } catch (err) {
            signature = "error";
            apply = () =>
                setStatus(
                    "Tidak dapat membaca halaman. Buka halaman Akta di ppat.atrbpn.go.id.",
                    "warn",
                );
        }

        if (force || signature !== lastDetectSignature) {
            lastDetectSignature = signature;
            apply();
        }
        return signature.includes("|pt:") ? selectPt.value : null;
    }

    btnRedetect.addEventListener("click", (e) => {
        e.preventDefault();
        detectPtFromPage(true);
    });

    // Deteksi otomatis saat panel dibuka
    detectPtFromPage(true);

    // Panel selalu terbuka, jadi deteksi ulang ketika:
    // 1. pindah tab
    chrome.tabs.onActivated.addListener(() => detectPtFromPage());
    // 2. halaman selesai dimuat / dimuat ulang
    chrome.tabs.onUpdated.addListener((tabId, info) => {
        if (info.status === "complete") detectPtFromPage();
    });
    // 3. berkala, untuk menangkap penjual yang baru ditambahkan via AJAX
    setInterval(() => {
        if (document.visibilityState === "visible") detectPtFromPage();
    }, 3000);

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
});
