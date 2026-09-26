chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fillPenjual") {
        const data = request.data;
        // Penjual (Badan Hukum) - Diambil dari HTML id frmInput1BadanHukum
        fillField("#tNAMA_LENGKAPPihak1", data.nama);
        fillField("#frmInput1BadanHukum #tALAMAT", data.alamat);
        fillField("#frmInput1BadanHukum #tLOKASI", data.kota);
        fillField("#frmInput1BadanHukum #tNPWP", data.npwp);
        fillField("#frmInput1BadanHukum #tIDENTITAS", data.akta);
        fillField("#frmInput1BadanHukum #tPENDIRIAN", data.tgl_akta);
        alert("Data Penjual berhasil diisi!");
    } 
    else if (request.action === "fillPersetujuan") {
        const data = request.data;
        // Pihak Persetujuan (WNI) - Diambil dari HTML id frmPihaksetujuDukcapil
        fillField("#tNIKpihaksetuju", data.nik);
        fillField("#tNAMA_LENGKAPpihaksetuju", data.nama);
        fillField("#tALAMATpihaksetuju", data.alamat);
        fillField("#tTEMPAT_LAHIRpihaksetuju", data.tempat_lahir);
        fillField("#tTANGGAL_LAHIRpihaksetuju", data.tgl_lahir);
        fillField("#frmPihaksetujuDukcapil #tJENIS_PEKERJAAN", data.pekerjaan);
        alert("Data Pihak Persetujuan berhasil diisi!\nSilakan periksa dan klik 'Tambah'.");
    }
});

function fillField(selector, value) {
    const el = document.querySelector(selector);
    if (el) {
        el.value = value;
        // Memicu event agar validasi jQuery/framework JS di web mendeteksi perubahan
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        console.warn("Elemen tidak ditemukan: " + selector);
    }
}
