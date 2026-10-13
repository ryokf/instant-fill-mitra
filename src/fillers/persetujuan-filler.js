/**
 * Pengisian otomatis Form Pihak Persetujuan (WNI).
 */
PPAT.persetujuanFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S = SELECTORS.persetujuan;

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const form = await dom.waitForElement(S.form, TIMING.PERSETUJUAN_FORM_TIMEOUT_MS);
        if (!form) {
            alert(MESSAGES.persetujuanFormMissing);
            return;
        }

        dom.fillFields(S.fields, data);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
                submitBtn.click();
            }
        } else {
            alert(MESSAGES.persetujuanFilled);
        }
    }

    return { fill };
})();
