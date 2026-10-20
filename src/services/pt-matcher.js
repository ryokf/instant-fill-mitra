/**
 * Pencocokan nama PT yang terbaca dari web dengan data di database.
 */
PPAT.ptMatcher = (() => {
    /** Normalisasi nama agar pencocokan toleran (huruf besar/kecil, spasi, titik, koma). */
    function normalizeName(name) {
        return (name || "").toUpperCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
    }

    /** @returns {string|null} key PT di database, atau null jika tidak ditemukan */
    function findPtKeyByName(name) {
        const target = normalizeName(name);
        if (!target) return null;

        const entries = Object.entries(PPAT.ptDatabase).map(([key, pt]) => ({
            key,
            normalizedName: normalizeName(pt.penjual.nama),
        }));

        // 1. Cocok persis
        const exact = entries.find((e) => e.normalizedName === target);
        if (exact) return exact.key;

        // 2. Cocok substring
        const partial = entries.find((e) => target.includes(e.normalizedName) || e.normalizedName.includes(target));
        return partial ? partial.key : null;
    }

    return { normalizeName, findPtKeyByName };
})();
