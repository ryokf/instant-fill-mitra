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
                submitBtn.click();
            }
        }

        return true;
    }

    return { fill };
})();
