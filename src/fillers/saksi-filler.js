/**
 * Pengisian otomatis Form Pihak Saksi (Bagian M).
 */
PPAT.saksiFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, DEFAULTS, MESSAGES } = config;
    const S = SELECTORS.saksi;

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const form = await dom.waitForElement(S.form, TIMING.SAKSI_FORM_TIMEOUT_MS);
        if (!form) {
            alert(MESSAGES.saksiFormMissing);
            return;
        }

        // Pilih Jenis Bukti Identitas (default: KTP)
        dom.setSelect2Value(S.tipeBukti, data.tipe_bukti || DEFAULTS.TIPE_BUKTI_SAKSI);
        dom.fillFields(S.fields, data);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
                submitBtn.click();
            }
        } else {
            alert(MESSAGES.saksiFilled(data.nama));
        }
    }

    return { fill };
})();
