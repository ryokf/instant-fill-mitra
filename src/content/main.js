/**
 * Entry point content script: memasang panel saat DOM siap.
 * Dimuat PALING AKHIR setelah semua modul lain (lihat manifest.json).
 */
(function main() {
    function init() {
        PPAT.panel.create();
        if (PPAT.sertipikatFiller && typeof PPAT.sertipikatFiller.checkAndExecuteOpenedBerkasFlow === "function") {
            PPAT.sertipikatFiller.checkAndExecuteOpenedBerkasFlow();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
