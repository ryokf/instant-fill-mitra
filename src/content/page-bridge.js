/**
 * Page Bridge - Main World Script (Manifest V3 "world": "MAIN")
 * Berjalan langsung di context halaman ppat.atrbpn.go.id (bebas blokir CSP).
 * Mengelola sinkronisasi variabel window.dfupload2 dan trigger fungsi upload bawaan web.
 */
(function () {
    console.log("[AutoFill PPAT] Page Bridge (Main World) diinisialisasi.");

    let isUploadInProgress = false;

    // Hook window.showmsg untuk memastikan backdrop ganda tidak pernah menumpuk dan klik OK secara cepat
    function hookShowmsg() {
        const originalShowmsg = window.showmsg;
        if (typeof originalShowmsg === "function" && !window.__ppat_showmsg_hooked) {
            window.__ppat_showmsg_hooked = true;
            window.showmsg = function (judul, isi) {
                // Bersihkan backdrop lama jika ada sebelum membuka modal baru
                document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
                const res = originalShowmsg.apply(this, arguments);

                // Kirim sinyal event ke content script seketika
                window.postMessage({ type: "PPAT_SHOWMSG_EVENT", title: judul, message: isi }, "*");

                // Begitu modal "Data telah diunggah" atau "telah disimpan" muncul, tekan tombol OK secepatnya (100ms)
                if (isi && typeof isi === "string") {
                    const isiLower = isi.toLowerCase();
                    if (isiLower.includes("data telah diunggah") || isiLower.includes("telah disimpan") || isiLower.includes("berhasil disimpan")) {
                        console.log("[PageBridge] Notifikasi modal otomatis terdeteksi via showmsg ('" + isi + "'). Menekan tombol OK dalam 100ms...");
                        setTimeout(() => {
                            pressModalOkButton();
                        }, 100);
                    }
                }
                return res;
            };
        }

        const originalShowmsg1 = window.showmsg1;
        if (typeof originalShowmsg1 === "function" && !window.__ppat_showmsg1_hooked) {
            window.__ppat_showmsg1_hooked = true;
            window.showmsg1 = function (judul, isi) {
                document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
                const res = originalShowmsg1.apply(this, arguments);
                window.postMessage({ type: "PPAT_SHOWMSG_EVENT", title: judul, message: isi }, "*");
                if (isi && typeof isi === "string") {
                    const isiLower = isi.toLowerCase();
                    if (isiLower.includes("data telah diunggah") || isiLower.includes("telah disimpan") || isiLower.includes("berhasil disimpan")) {
                        console.log("[PageBridge] Notifikasi modal otomatis terdeteksi via showmsg1 ('" + isi + "'). Menekan tombol OK dalam 100ms...");
                        setTimeout(() => {
                            pressModalOkButton();
                        }, 100);
                    }
                }
                return res;
            };
        }
    }
    hookShowmsg();
    setTimeout(hookShowmsg, 1000);
    setInterval(hookShowmsg, 2000);

    async function handleUploadRequest(data) {
        if (isUploadInProgress) {
            console.warn("[PageBridge] Upload request diabaikan karena proses upload sedang berjalan.");
            return;
        }
        isUploadInProgress = true;

        const { base64, filename, mimeType, tipeValue } = data || {};
        console.log(`[PageBridge] Menerima berkas upload: ${filename} (tipe: ${tipeValue})`);

        try {
            // 1. Pilih opsi pada select #tipeunggah2 jika tipeValue diberikan
            if (tipeValue) {
                const select = document.getElementById("tipeunggah2");
                if (select) {
                    select.value = tipeValue;
                    if (window.jQuery) {
                        window.jQuery(select).val(tipeValue).trigger("change");
                    } else {
                        select.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    console.log("[PageBridge] #tipeunggah2 diubah ke:", select.value);
                }
            }

            // 2. Decode base64 menjadi File di Main World
            const byteChars = atob(base64);
            const byteNums = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNums[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteNums], { type: mimeType || "application/pdf" });
            const file = new File([blob], filename, { type: mimeType || "application/pdf" });

            // 3. SET dfupload2 langsung di window dan di scope lokal
            window.dfupload2 = file;
            try {
                eval("dfupload2 = window.dfupload2;");
            } catch (_) {}

            console.log("[PageBridge] dfupload2 berhasil diset:", window.dfupload2);

            // 4. Masukkan ke input file #txtUploadFileNonInputupload2 via DataTransfer
            const input = document.getElementById("txtUploadFileNonInputupload2");
            if (input) {
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                if (window.jQuery) {
                    window.jQuery(input).trigger("change");
                } else {
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }
            }

            // Beri jeda kecil agar change handler bawaan halaman selesai
            await new Promise((resolve) => setTimeout(resolve, 150));

            // 5. Pastikan kembali dfupload2 masih tersimpan sebelum simpan
            if (!window.dfupload2) {
                window.dfupload2 = file;
                try { eval("dfupload2 = window.dfupload2;"); } catch (_) {}
            }

            // 6. Pastikan idreferensi2, pihak2, dan aktanoninput2 terisi
            if (data.idreferensi) window.idreferensi2 = data.idreferensi;
            if (data.pihak) window.pihak2 = data.pihak;
            if (data.aktanoninput) window.aktanoninput2 = data.aktanoninput;
            if (data.tipeunggahfile) window.tipeunggahfile2 = data.tipeunggahfile;

            if (!window.idreferensi2 || !window.pihak2) {
                const pUrl =
                    document.querySelector("#daftarpihak2placeholder p.url[data-refid]") ||
                    document.querySelector("#daftarpemohonpihaksetujuplaceholder p.url[data-refid]") ||
                    document.querySelector("#daftarpihak1placeholder p.url[data-refid]");
                if (pUrl) {
                    window.idreferensi2 = pUrl.getAttribute("data-refid");
                    window.pihak2 = pUrl.getAttribute("data-pihak");
                    window.aktanoninput2 = pUrl.getAttribute("data-aktaid");
                    window.tipeunggahfile2 = pUrl.getAttribute("data-tipepihak");
                    try {
                        eval(`
                            idreferensi2 = window.idreferensi2;
                            pihak2 = window.pihak2;
                            aktanoninput2 = window.aktanoninput2;
                            tipeunggahfile2 = window.tipeunggahfile2;
                        `);
                    } catch (_) {}
                    console.log("[PageBridge] Variabel referensi dipulihkan dari data-refid:", {
                        idreferensi2: window.idreferensi2,
                        pihak2: window.pihak2,
                        aktanoninput2: window.aktanoninput2,
                    });
                }
            }

            console.log("[PageBridge] Menjalankan simpandokumenupload2()...");
            if (typeof window.simpandokumenupload2 === "function") {
                window.simpandokumenupload2();
            } else {
                const btnSimpan = document.querySelector("#divnewdokumenupload2 button[onclick*='simpandokumenupload2']");
                if (btnSimpan) {
                    btnSimpan.click();
                } else {
                    throw new Error("Fungsi simpandokumenupload2 tidak ditemukan.");
                }
            }

            sendResponse({ success: true, filename });
        } catch (err) {
            console.error("[PageBridge] Gagal memproses upload berkas:", err);
            sendResponse({ success: false, error: err.message || String(err) });
        } finally {
            isUploadInProgress = false;
        }
    }

    function sendResponse(detail) {
        window.postMessage({ type: "PPAT_INJECT_AND_UPLOAD_RESPONSE", ...detail }, "*");
    }

    /**
     * Menekan tombol OK pada modal yang aktif dan menutup modal di Main World.
     * Sesuai instruksi: SELALU TEKAN TOMBOL OK JIKA ADA MODAL SEPERTI ITU.
     */
    function pressModalOkButton() {
        console.log("[PageBridge] Mencari modal aktif untuk menekan tombol OK...");
        const modalEl = document.getElementById("globalModal") || document.querySelector(".modal.show, #myModal");
        let clicked = false;

        if (modalEl) {
            const buttons = Array.from(modalEl.querySelectorAll("button, a.btn"));
            const okBtn =
                buttons.find((b) => (b.innerText || b.textContent || "").trim().toUpperCase() === "OK") ||
                modalEl.querySelector("button.btn-primary, button[data-bs-dismiss='modal'], button[data-dismiss='modal'], #btn-ok") ||
                buttons[0];

            if (okBtn) {
                console.log("[PageBridge] Menekan tombol OK (biru) pada modal:", okBtn);
                try {
                    okBtn.focus();
                    okBtn.click();
                    clicked = true;
                } catch (e) {
                    console.warn("[PageBridge] Gagal menekan okBtn:", e);
                }
            }

            // Panggil API Bootstrap modal hide jika tersedia
            try {
                if (window.bootstrap && window.bootstrap.Modal) {
                    const inst = window.bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                } else if (window.jQuery && typeof window.jQuery(modalEl).modal === "function") {
                    window.jQuery(modalEl).modal("hide");
                }
            } catch (_) {}

            // Bersihkan backdrop dan modal secara instan
            cleanupBackdropAndModal(modalEl);
            setTimeout(() => {
                cleanupBackdropAndModal(modalEl);
            }, 50);
        }

        window.postMessage({ type: "PPAT_DISMISS_MODAL_RESPONSE", success: clicked }, "*");
        return clicked;
    }

    function cleanupBackdropAndModal(modalEl) {
        const el = modalEl || document.getElementById("globalModal");
        if (el) {
            el.classList.remove("show");
            el.style.display = "none";
            el.setAttribute("aria-hidden", "true");
            el.removeAttribute("aria-modal");
        }
        document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
    }

    /**
     * Menginjeksi berkas (File) secara otomatis ke input[type="file"] pada section PBB, BPHTB, atau PPh
     * di Main World (sehingga event change native & jQuery halaman menangkap e.target.files[0] secara utuh).
     */
    async function handleSectionFileInject(data) {
        const { requestId, section, selector, base64, filename, mimeType } = data || {};
        console.log(`[PageBridge] Menginjeksi berkas section '${section}': ${filename}`);

        try {
            let input = null;
            if (selector) {
                try {
                    input = document.querySelector(selector);
                } catch (_) {}
            }

            if (!input) {
                if (section === "pbb") {
                    input =
                        document.getElementById("txtUploadFilePBB") ||
                        document.querySelector("#frmPBBDetail input[type='file'], #inputPBBplaceholder input[type='file']");
                } else if (section === "bphtb") {
                    input =
                        document.getElementById("txtUploadFileBPHTB") ||
                        document.querySelector("#frmBPHTB input[type='file'], #inputBPHTBplaceholder input[type='file']");
                } else if (section === "pph") {
                    input =
                        document.getElementById("txtUploadFilePPH") ||
                        document.getElementById("txtUploadFilePPh") ||
                        document.querySelector(
                            "#frmPPH input[type='file'], #frmPph input[type='file'], #inputPPHplaceholder input[type='file'], #inputPPhplaceholder input[type='file'], #inputpphplaceholder input[type='file'], input[name*='UploadFilePPH' i], input[name*='UploadFromFilePPH' i]"
                        );
                }
            }

            if (!input) {
                throw new Error(`Input file untuk section '${section}' tidak ditemukan di halaman.`);
            }

            // Decode base64 menjadi File di Main World
            const byteChars = atob(base64);
            const byteNums = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNums[i] = byteChars.charCodeAt(i);
            }
            const resolvedMime = mimeType || (filename && filename.toLowerCase().endsWith(".png") ? "image/png" : filename && filename.toLowerCase().match(/\.jpe?g$/) ? "image/jpeg" : "application/pdf");
            const blob = new Blob([byteNums], { type: resolvedMime });
            const file = new File([blob], filename, { type: resolvedMime, lastModified: Date.now() });

            // Pasang File ke input.files menggunakan DataTransfer
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;

            // Picu event input & change di Main World (jQuery dan native listener akan menerima e.target.files[0])
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));

            // Pastikan input.files tetap terjaga setelah event handler halaman berjalan
            if (!input.files || input.files.length === 0) {
                input.files = dt.files;
            }

            // Perbarui tampilan nama file di sekitar tombol Pilih File bila ada textbox/label pendamping
            const group = input.closest(".input-group, .form-group");
            if (group) {
                const textDisplay = group.querySelector("input[type='text'][readonly], .file-caption-name");
                if (textDisplay) {
                    if (textDisplay.tagName === "INPUT" && !textDisplay.value) {
                        textDisplay.value = filename;
                    } else if (textDisplay.tagName !== "INPUT" && !textDisplay.textContent) {
                        textDisplay.textContent = filename;
                    }
                }
            }

            console.log(`[PageBridge] ✔ Berkas '${filename}' berhasil dimasukkan ke #${input.id || section}`);
            window.postMessage(
                {
                    type: "PPAT_INJECT_SECTION_FILE_RESPONSE",
                    requestId,
                    section,
                    success: true,
                    filename,
                },
                "*"
            );
        } catch (err) {
            console.error(`[PageBridge] Gagal injeksi berkas section '${section}':`, err);
            window.postMessage(
                {
                    type: "PPAT_INJECT_SECTION_FILE_RESPONSE",
                    requestId,
                    section,
                    success: false,
                    error: err.message || String(err),
                },
                "*"
            );
        }
    }

    // Satu-satunya listener message channel
    window.addEventListener("message", (e) => {
        if (!e.data || typeof e.data !== "object") return;
        if (e.data.type === "PPAT_INJECT_AND_UPLOAD") {
            handleUploadRequest(e.data);
        } else if (e.data.type === "PPAT_INJECT_SECTION_FILE") {
            handleSectionFileInject(e.data);
        } else if (e.data.type === "PPAT_DISMISS_MODAL") {
            pressModalOkButton();
        }
    });
})();
