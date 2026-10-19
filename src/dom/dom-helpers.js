/**
 * Helper DOM generik (tidak tahu apa-apa soal PT / Penjual / Saksi).
 */
PPAT.dom = (() => {
    const { TIMING } = PPAT.config;

    /**
     * Menunggu elemen DOM muncul dengan timeout.
     * @returns {Promise<Element|null>} elemen, atau null jika timeout
     */
    function waitForElement(selector, timeoutMs = 8000) {
        return new Promise((resolve) => {
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);

            const startTime = Date.now();
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                } else if (Date.now() - startTime > timeoutMs) {
                    clearInterval(interval);
                    resolve(null);
                }
            }, TIMING.POLL_INTERVAL_MS);
        });
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Eksekusi skrip di Main World agar jQuery & Select2 ikut tersinkronisasi.
     * `fn` di-stringify, jadi harus mandiri (tidak boleh memakai variabel luar).
     */
    function runInPageContext(fn, ...args) {
        try {
            const script = document.createElement("script");
            script.textContent = `(${fn})(${args.map((a) => JSON.stringify(a)).join(",")});`;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        } catch (err) {
            console.warn("Eksekusi script di page context dilewati:", err);
        }
    }

    /** Memicu event pada elemen asli dan pada wrapper jQuery milik halaman. */
    function syncValueToPage(el, selector, value, jqueryEvents) {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        runInPageContext(
            (s, v, events) => {
                if (!window.jQuery) return;
                const $target = window.jQuery(s);
                if (!$target.length) return;
                $target.val(v);
                events.forEach((eventName) => $target.trigger(eventName));
            },
            selector,
            value,
            jqueryEvents,
        );
    }

    /** Mengisi nilai input/textarea standar dan memicu event validasi. */
    function fillField(selector, value) {
        if (value === undefined || value === null) return;
        const el = document.querySelector(selector);
        if (!el) {
            console.warn("Elemen tidak ditemukan: " + selector);
            return;
        }
        syncValueToPage(el, selector, value, ["input", "change"]);
    }

    /**
     * Mengisi banyak field sekaligus.
     * @param {Array<[string, string]>} fieldMap pasangan [selector, properti data]
     * @param {Object} data sumber nilai
     */
    function fillFields(fieldMap, data) {
        fieldMap.forEach(([selector, key]) => fillField(selector, data[key]));
    }

    /** Memperbarui tampilan teks pada container Select2 agar sesuai opsi terpilih. */
    function refreshSelect2Label(el) {
        const container = document.getElementById(`select2-${el.id}-container`);
        if (!container || el.selectedIndex < 0) return;

        const option = el.options[el.selectedIndex];
        if (option) {
            container.textContent = option.textContent;
            container.title = option.textContent;
        }
    }

    /**
     * Mengisi nilai <select> dan memperbarui Select2.
     * @returns {boolean} true jika berhasil
     */
    function setSelect2Value(selector, value) {
        if (!value) return false;
        const el = document.querySelector(selector);
        if (!el) {
            console.warn("Elemen select tidak ditemukan: " + selector);
            return false;
        }

        syncValueToPage(el, selector, value, ["change"]);
        refreshSelect2Label(el);
        return true;
    }

    /**
     * Mengisi nilai pada elemen input (atau selector) dan memicu event input/change/blur
     * baik di DOM maupun di jQuery Main World.
     */
    function setInputValue(elOrSelector, value) {
        if (value === undefined || value === null) return;
        const el = typeof elOrSelector === "string" ? document.querySelector(elOrSelector) : elOrSelector;
        if (!el) return;

        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));

        if (el.id) {
            runInPageContext(
                (id, v) => {
                    const target = document.getElementById(id);
                    if (!target) return;
                    target.value = v;
                    if (window.jQuery) {
                        window.jQuery(target).val(v).trigger("input").trigger("change").trigger("blur");
                    }
                },
                el.id,
                value,
            );
        } else if (el.name) {
            runInPageContext(
                (name, v) => {
                    const target = document.querySelector(`input[name=${JSON.stringify(name)}]`);
                    if (!target) return;
                    target.value = v;
                    if (window.jQuery) {
                        window.jQuery(target).val(v).trigger("input").trigger("change").trigger("blur");
                    }
                },
                el.name,
                value,
            );
        }
    }

    return { waitForElement, delay, runInPageContext, fillField, fillFields, setSelect2Value, setInputValue };
})();
