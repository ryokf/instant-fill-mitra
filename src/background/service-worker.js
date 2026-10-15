/**
 * Service worker: membuka/menutup panel saat ikon toolbar diklik.
 */
const PPAT_URL_PREFIX = "https://ppat.atrbpn.go.id/";
const TOGGLE_PANEL_ACTION = "toggleAutoFillPanel";

/**
 * Daftar file content script diambil dari manifest, sehingga urutan injeksi
 * manual selalu sama dengan injeksi otomatis (satu sumber kebenaran).
 */
function getContentScriptConfig() {
    const scripts = chrome.runtime.getManifest().content_scripts || [];
    return scripts.find((s) => s.world !== "MAIN") || scripts[0];
}

/** Menginjeksi ulang content script + CSS ke tab (dipakai jika script belum termuat). */
async function injectContentScripts(tabId) {
    const { js = [], css = [] } = getContentScriptConfig();
    if (css.length > 0) {
        await chrome.scripting.insertCSS({ target: { tabId }, files: css });
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: js });
}

function isPpatTab(tab) {
    return Boolean(tab.url && tab.url.startsWith(PPAT_URL_PREFIX));
}

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab || !tab.id) return;

    try {
        await chrome.tabs.sendMessage(tab.id, { action: TOGGLE_PANEL_ACTION });
    } catch (err) {
        // Tab belum siap: coba injeksi content script jika di domain target
        if (!isPpatTab(tab)) return;
        try {
            await injectContentScripts(tab.id);
        } catch (e) {
            console.warn("Gagal menginjeksi content script:", e);
        }
    }
});
