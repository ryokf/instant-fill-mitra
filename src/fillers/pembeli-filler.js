/**
 * Pengisian otomatis Form Pihak Pembeli (Bagian F: #frmtipepihak2Dukcapil).
 */
PPAT.pembeliFiller = (() => {
    const { dom, config } = PPAT;
    const { SELECTORS, TIMING, DEFAULTS, MESSAGES } = config;
    const S = SELECTORS.pembeli;

    async function fill(data, options = {}) {
        const autoSubmit = options.autoSubmit ?? true;

        const form = await dom.waitForElement(S.form, TIMING.PEMBELI_FORM_TIMEOUT_MS);
        if (!form) {
            alert(MESSAGES.pembeliFormMissing);
            return false;
        }

        // Pilih Jenis Bukti Identitas (default: KTP / "1")
        dom.setSelect2Value(S.tipeBukti, data.tipe_bukti || DEFAULTS.TIPE_BUKTI_PEMBELI);
        dom.fillFields(S.fields, data);

        if (autoSubmit) {
            await dom.delay(TIMING.SUBMIT_DELAY_MS);
            const submitBtn = document.querySelector(S.btnTambah);
            if (submitBtn) {
                submitBtn.click();
            }
        } else {
            alert(MESSAGES.pembeliFilled(data.nama));
        }

        return true;
    }

    return { fill };
})();
