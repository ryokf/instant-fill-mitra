/**
 * Membaca data yang sudah tercatat di halaman web PPAT.
 */
PPAT.pageReader = (() => {
    const NAMA_LINE_PATTERN = /^Nama\s*:\s*(.+)$/i;

    /** Mengambil teks polos dari potongan HTML. */
    function htmlToText(html) {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        return (tmp.textContent || "").trim();
    }

    /** Isi blockquote: "Nama : PT XXX<br>Alamat : ...<br>Email : ..." */
    function extractNameFromBlockquote(blockquote) {
        const lines = blockquote.innerHTML.split(/<br\s*\/?>/i);
        for (const line of lines) {
            const match = htmlToText(line).match(NAMA_LINE_PATTERN);
            if (match) return match[1].trim();
        }
        return null;
    }

    /** Membaca nama PT dari panel "Daftar Penjual" di halaman PPAT. */
    function readPenjualNames() {
        const items = document.querySelectorAll(PPAT.config.SELECTORS.daftarPenjual);
        return Array.from(items)
            .map(extractNameFromBlockquote)
            .filter((name) => name !== null);
    }

    return { readPenjualNames };
})();
