/**
 * Namespace global tunggal untuk seluruh content script ekstensi.
 *
 * Content script MV3 tidak mendukung ES module secara langsung, sehingga
 * setiap file mendaftarkan modulnya ke objek `PPAT` (mis. `PPAT.dom`).
 * File ini HARUS dimuat paling awal (lihat urutan di manifest.json).
 */
globalThis.PPAT = globalThis.PPAT || {};
