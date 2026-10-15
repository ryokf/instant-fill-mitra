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

                // Begitu modal "Data telah diunggah" muncul, tekan tombol OK secepatnya (100ms)
                if (isi && typeof isi === "string" && isi.toLowerCase().includes("data telah diunggah")) {
                    console.log("[PageBridge] Notifikasi 'Data telah diunggah' terdeteksi via showmsg. Menekan tombol OK dalam 100ms...");
                    setTimeout(() => {
                        pressModalOkButton();
                    }, 100);
                }
                return res;
            };
        }
    }
    hookShowmsg();
    setTimeout(hookShowmsg, 1000);

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
            if (!window.idreferensi2 || !window.pihak2) {
                const pUrl = document.querySelector("#daftarpihak1placeholder p.url[data-refid]");
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

    // Satu-satunya listener message channel
    window.addEventListener("message", (e) => {
        if (!e.data || typeof e.data !== "object") return;
        if (e.data.type === "PPAT_INJECT_AND_UPLOAD") {
            handleUploadRequest(e.data);
        } else if (e.data.type === "PPAT_DISMISS_MODAL") {
            pressModalOkButton();
        }
    });
})();
