// Hindari duplikasi listener jika content.js di-inject berulang kali
if (!window.__ppatAutofillInitialized) {
    window.__ppatAutofillInitialized = true;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "fillPenjual") {
            handleFillPenjual(request.data);
        } else if (request.action === "fillPersetujuan") {
            handleFillPersetujuan(request.data);
        }
    });
}

/**
 * Menunggu elemen DOM muncul (dengan timeout)
 */
function waitForElement(selector, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        const startTime = Date.now();
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                resolve(el);
            } else if (Date.now() - startTime > timeoutMs) {
                clearInterval(timer);
                resolve(null);
            }
        }, 150);
    });
}

/**
 * Mengeksekusi fungsi di konteks window halaman (Main World)
 * Digunakan agar instance jQuery dan plugin Select2 di web target dapat ikut tersinkronisasi.
 */
function runInPageContext(fn, ...args) {
    try {
        const script = document.createElement("script");
        script.textContent = `(${fn})(${args.map((a) => JSON.stringify(a)).join(",")});`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch (err) {
        console.warn("Eksekusi skrip di page context dilewati:", err);
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

        // Sinkronisasi via jQuery di page context jika tersedia
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
 * Mengisi nilai dropdown <select> dan memperbarui visual container Select2
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

    // Perbarui label tampilan teks Select2 di DOM
    const containerId = `select2-${el.id}-container`;
    const container = document.getElementById(containerId);
    if (container && el.selectedIndex >= 0) {
        const opt = el.options[el.selectedIndex];
        if (opt) {
            container.textContent = opt.textContent;
            container.title = opt.textContent;
        }
    }

    // Trigger update via jQuery Select2 di page context agar internal state Select2 terupdate
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
 * Penanganan pengisian form Penjual (Badan Hukum)
 */
async function handleFillPenjual(data) {
    const tipePihak1El = document.querySelector("select#tipepihak1");
    const existingForm = document.querySelector("#frmInput1BadanHukum");

    // Masalah 1: Jika form Badan Hukum belum ada atau Tipe Penjual belum "Non Perorangan"
    if (!existingForm || (tipePihak1El && tipePihak1El.value !== "Non Perorangan")) {
        if (tipePihak1El) {
            setSelect2Value("select#tipepihak1", "Non Perorangan");
        }

        // Tunggu hingga template form Badan Hukum dimuat oleh AJAX web PPAT
        const formLoaded = await waitForElement("#frmInput1BadanHukum", 8000);
        if (!formLoaded) {
            alert("Gagal memuat Form Penjual (Badan Hukum). Pastikan Anda berada di halaman pembuatan Akta PPAT.");
            return;
        }

        // Beri jeda singkat agar inisialisasi script dan Select2 pada form baru selesai
        await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Masalah 2: Atur dropdown Select2 untuk Jenis Badan Hukum (BUMS) dan Tipe Usaha (PT)
    // 33: Badan Usaha Milik Swasta (BUMS)
    setSelect2Value("#frmInput1BadanHukum select#tipepemilikid", data.tipe_pemilik || "33");
    // 4: Perseroan Terbatas (PT)
    setSelect2Value("#frmInput1BadanHukum select#tipeusaha", data.tipe_usaha || "4");

    // Isi field form Penjual (Badan Hukum)
    fillField("#tNAMA_LENGKAPPihak1", data.nama);
    fillField("#frmInput1BadanHukum #tALAMAT", data.alamat);
    fillField("#frmInput1BadanHukum #tLOKASI", data.kota);
    fillField("#frmInput1BadanHukum #tNPWP", data.npwp);
    fillField("#frmInput1BadanHukum #tIDENTITAS", data.akta);
    fillField("#frmInput1BadanHukum #tPENDIRIAN", data.tgl_akta);

    alert("Data Penjual (Badan Hukum) berhasil diisi!");
}

/**
 * Penanganan pengisian form Pihak Persetujuan (WNI)
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
