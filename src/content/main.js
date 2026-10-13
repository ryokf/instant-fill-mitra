/**
 * Entry point content script: memasang panel saat DOM siap.
 * Dimuat PALING AKHIR setelah semua modul lain (lihat manifest.json).
 */
(function main() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", PPAT.panel.create);
    } else {
        PPAT.panel.create();
    }
})();
