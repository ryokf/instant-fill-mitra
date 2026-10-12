// Saat ikon toolbar ekstensi diklik, buka atau tutup panel melayang di halaman web PPAT
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) return;
    try {
        await chrome.tabs.sendMessage(tab.id, { action: "toggleAutoFillPanel" });
    } catch (err) {
        // Jika tab belum siap atau bukan halaman PPAT, coba injeksi content.js jika di domain target
        if (tab.url && tab.url.startsWith("https://ppat.atrbpn.go.id/")) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ["content.js"],
                });
            } catch (e) {
                console.warn("Gagal menginjeksi content.js:", e);
            }
        }
    }
});
