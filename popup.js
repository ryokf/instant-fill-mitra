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

document.addEventListener("DOMContentLoaded", () => {
    const selectPt = document.getElementById("select-pt");
    const selectPersetujuan = document.getElementById("select-persetujuan");

    // Populate PT dropdown
    for (const key in database) {
        let option = document.createElement("option");
        option.value = key;
        option.textContent = database[key].penjual.nama;
        selectPt.appendChild(option);
    }

    // Update Persetujuan dropdown based on selected PT
    selectPt.addEventListener("change", (e) => {
        const selectedPt = e.target.value;
        selectPersetujuan.innerHTML = "";

        if (selectedPt && database[selectedPt]) {
            database[selectedPt].persetujuan.forEach((orang, index) => {
                let option = document.createElement("option");
                option.value = index;
                option.textContent = orang.nama + " (" + orang.id + ")";
                selectPersetujuan.appendChild(option);
            });
        } else {
            selectPersetujuan.innerHTML =
                '<option value="">-- Pilih PT Dulu --</option>';
        }
    });

    // Execute autofill for Penjual
    document
        .getElementById("btn-fill-penjual")
        .addEventListener("click", async () => {
            const ptKey = selectPt.value;
            if (!ptKey) return alert("Pilih PT terlebih dahulu!");

            let [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
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
            const ptKey = selectPt.value;
            const indexPersetujuan = selectPersetujuan.value;
            if (!ptKey || indexPersetujuan === "")
                return alert("Pilih PT dan Pihak Persetujuan!");

            let [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
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
