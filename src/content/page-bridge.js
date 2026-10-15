/**
 * Page Bridge - Main World Script (Manifest V3 "world": "MAIN")
 * Berjalan langsung di context halaman ppat.atrbpn.go.id (bebas blokir CSP).
 * Mengelola sinkronisasi variabel window.dfupload2 dan trigger fungsi upload bawaan web.
 */
(function () {
    console.log("[AutoFill PPAT] Page Bridge (Main World) diinisialisasi.");

    async function handleUploadRequest(data) {
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
            await new Promise((resolve) => setTimeout(resolve, 400));

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
        }
    }

    function sendResponse(detail) {
        window.postMessage({ type: "PPAT_INJECT_AND_UPLOAD_RESPONSE", ...detail }, "*");
        window.dispatchEvent(new CustomEvent("PPAT_INJECT_AND_UPLOAD_RESPONSE", { detail }));
    }

    // Listener via window.postMessage
    window.addEventListener("message", (e) => {
        if (!e.data || e.data.type !== "PPAT_INJECT_AND_UPLOAD") return;
        handleUploadRequest(e.data);
    });

    // Listener via CustomEvent
    window.addEventListener("PPAT_INJECT_AND_UPLOAD", (e) => {
        handleUploadRequest(e.detail);
    });

    // Listener dismiss modal
    const dismissModalHandler = () => {
        try {
            const modalEl = document.getElementById("globalModal");
            if (modalEl) {
                if (window.bootstrap && window.bootstrap.Modal) {
                    const modal = window.bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
                const okBtn = modalEl.querySelector("button[data-bs-dismiss='modal'], button");
                if (okBtn) okBtn.click();
            }
        } catch (e) {
            console.warn("[PageBridge] Dismiss modal error:", e);
        }
    };

    window.addEventListener("message", (e) => {
        if (e.data && e.data.type === "PPAT_DISMISS_MODAL") dismissModalHandler();
    });
    window.addEventListener("PPAT_DISMISS_MODAL", dismissModalHandler);
})();
