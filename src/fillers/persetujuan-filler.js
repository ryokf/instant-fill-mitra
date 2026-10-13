/**
 * Pengisian otomatis Form Pihak Persetujuan (WNI).
 */
PPAT.persetujuanFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, MESSAGES } = config;
    const S = SELECTORS.persetujuan;

    async function fill(data) {
        const form = await dom.waitForElement(S.form, TIMING.PERSETUJUAN_FORM_TIMEOUT_MS);
        if (!form) {
            alert(MESSAGES.persetujuanFormMissing);
            return;
        }

        dom.fillFields(S.fields, data);

        alert(MESSAGES.persetujuanFilled);
    }

    return { fill };
})();
