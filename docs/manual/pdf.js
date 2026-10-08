// Печатная версия инструкции: node docs/manual/pdf.js → docs/manual/admin-manual.pdf
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
(async () => {
 const b = await chromium.launch(); const p = await b.newPage();
 await p.goto('file://' + path.resolve(__dirname, 'admin-manual.html')); await p.waitForLoadState('networkidle');
 await p.emulateMedia({ media: 'print' });
 await p.pdf({ path: path.resolve(__dirname, 'admin-manual.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font:9px Arial;color:#888;width:100%;text-align:center">Админка сайта · инструкция · стр. <span class="pageNumber"></span> из <span class="totalPages"></span></div>' });
 await b.close();
})();
