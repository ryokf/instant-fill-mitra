global.window = {
    addEventListener: () => {},
    postMessage: () => {},
    location: { href: 'https://ppat.atrbpn.go.id/akta/Peralihan/AJB' }
};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } }),
    body: { appendChild: () => {} }
};
global.chrome = {
    runtime: { onMessage: { addListener: () => {} } },
    storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } }
};

require('../src/core/namespace.js');
require('../src/core/config.js');
require('../src/data/saksi-database.js');
require('../src/dom/dom-helpers.js');
require('../src/fillers/saksi-filler.js');
require('../src/ui/panel-template.js');

console.log('PPAT namespace initialized.');
console.log('Saksi database count:', PPAT.saksiDatabase.length);
console.log('saksiFiller available methods:', Object.keys(PPAT.saksiFiller));
console.log('panelTemplate IDS for saksi:', {
    statusSaksi: PPAT.panelTemplate.IDS.statusSaksi,
    cardDetectedSaksi: PPAT.panelTemplate.IDS.cardDetectedSaksi,
    saksi1Nama: PPAT.panelTemplate.IDS.saksi1Nama,
    saksi2Nama: PPAT.panelTemplate.IDS.saksi2Nama,
    btnFillAutoSaksi: PPAT.panelTemplate.IDS.btnFillAutoSaksi
});
