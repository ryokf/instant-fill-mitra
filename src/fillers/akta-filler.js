/**
 * Pengisian otomatis Section A: Input Akta (#frmEditAkta).
 * Mengisi Nomor Akta, Tanggal Akta, dan otomatis menekan tombol "Simpan".
 */
PPAT.aktaFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S = SELECTORS.akta;

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const form = await dom.waitForElement(S.form, TIMING.AKTA_FORM_TIMEOUT_MS);
        if (!form) {
            console.warn(MESSAGES.aktaFormMissing);
            return false;
        }

        // Isi nomor akta
        if (data.nomor_akta) {
            dom.fillField(S.fields[0][0], data.nomor_akta);
        }

        // Isi tanggal akta
        if (data.tanggal_akta) {
            dom.fillField(S.fields[1][0], data.tanggal_akta);

            // Memicu event dp.change khusus untuk bootstrap-datetimepicker di halaman
            dom.runInPageContext((selector) => {
                if (window.jQuery) {
                    window.jQuery(selector).trigger("dp.change").trigger("change");
                }
            }, S.fields[1][0]);
        }

        // Setelah semua kolom di section Input Akta terisi, klik tombol simpan secara otomatis
        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnSimpan);
            if (submitBtn) {
                console.log("[AktaFiller] Menekan tombol Simpan Akta...");
                submitBtn.click();

                // Tunggu hingga modal "Data Akta telah disimpan" muncul dan tertutup secara otomatis
                await waitForAktaSaveModal(6000);
            }
        }

        return true;
    }

    /**
     * Menunggu modal notifikasi "Data Akta telah disimpan" muncul dan memastikan modal tertutup.
     */
    function waitForAktaSaveModal(timeoutMs = 6000) {
        return new Promise((resolve) => {
            let done = false;

            function finish() {
                if (done) return;
                done = true;
                clearTimeout(timer);
                clearInterval(poller);
                window.removeEventListener("message", onMessage);
                // Pastikan backdrop bersih
                document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
                document.body.classList.remove("modal-open");
                resolve(true);
            }

            function onMessage(e) {
                if (e.data && e.data.type === "PPAT_SHOWMSG_EVENT" && e.data.message) {
                    const msg = String(e.data.message).toLowerCase();
                    if (msg.includes("telah disimpan") || msg.includes("data akta") || msg.includes("berhasil")) {
                        console.log("[AktaFiller] Modal konfirmasi simpan akta terdeteksi via event:", e.data.message);
                        setTimeout(finish, 250);
                    }
                }
            }

            window.addEventListener("message", onMessage);

            const timer = setTimeout(() => {
                console.log("[AktaFiller] Selesai menunggu modal akta (timeout).");
                finish();
            }, timeoutMs);

            const poller = setInterval(() => {
                const modal = document.querySelector("#globalModal, .modal.show, #myModal");
                if (modal) {
                    const isVisible =
                        modal.classList.contains("show") ||
                        modal.style.display === "block" ||
                        (modal.offsetWidth > 0 && modal.offsetHeight > 0);
                    if (isVisible) {
                        console.log("[AktaFiller] Modal konfirmasi akta terdeteksi di DOM.");
                        setTimeout(finish, 250);
                    }
                }
            }, 50);
        });
    }

    return { fill };
})();
