// Снимки экрана для инструкции по админке.
// Берёт макет docs/mockups/admin-2.0.html, ставит нужное состояние, рисует номера-метки и сохраняет PNG в img/.
// Запуск: node docs/manual/shots.js   (нужен playwright с Chromium)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const MOCK = 'file://' + path.resolve(__dirname, '../mockups/admin-2.0.html');
const OUT = path.resolve(__dirname, 'img');

// vp — окно браузера; js — подготовка; b — метки [селектор, номер, место(l|r|c|tl|tr|b), рамка]; clip — что снять (селектор) и поля
const S = [
 {n:'s01-ekran', vp:[1440,900], js:`DEMO.select('t-alaverdi')`, b:[['#nm',1,'b'],['#st',2,'b'],['#open',3,'tl'],['#save',4,'tl'],['#tree',5,'tr'],['#form',6,'tr'],['.pvbar',7,'tl'],['#pvdom',8,'tl'],['#dv',9,'tl']]},
 {n:'s02-derevo', vp:[1440,1250], js:`DEMO.find('tab-gr').n.on=false;DEMO.A.open['t-alaverdi']=true;DEMO.select('t-nekresi')`, clip:'#tree', pad:[6,22,6,40], maxh:1060, gut:1,
  b:[['.row[data-id="header"]',1,'l'],['.grp',2,'l'],['.row[data-id="t-gremi"] .h',3,'l'],['.row[data-id="t-alaverdi"] .tg',4,'l'],['.row[data-id="t-gremi"] .ty',5,'a'],['.row[data-id="t-gremi"] [data-hide]',6,'a'],['.row[data-id="t-gremi"] [data-del]',7,'r'],['.row[data-id="tab-gr"] .tg',8,'l'],['[data-add="t-alaverdi"]',9,'r'],['[data-addtile="ge-tiles"]',10,'r'],['[data-addtab]',11,'r'],['[data-add="home"]',12,'r'],['.row[data-id="set-main"]',13,'l'],['[data-collapse]',14,'r']]},
 {n:'s03-dobavit', vp:[1440,1250], js:`DEMO.select('t-alaverdi');DEMO.openAdd('t-alaverdi')`, clip:'[data-menu="t-alaverdi"]', pad:[60,4,10,40], wide:'#tree', gut:1,
  b:[['[data-menu="t-alaverdi"] [data-addtype="text"] .tn',1,'r'],['[data-menu="t-alaverdi"] [data-addtype="map"]',2,'r'],['[data-menu="t-alaverdi"] [data-addtype="tabs"]',3,'r']]},
 {n:'s04-tekst', vp:[1440,1000], js:`DEMO.select('hero')`, clip:'#form', maxh:760,
  b:[['.ftop .chip',1,'l'],['.ftop .sw',2,'r'],['[data-k="eyebrow"]',3,'l'],['[data-k="title"] i',4,'l'],['[data-k="titleSize"]',5,'l'],['[data-k="sub"]',6,'l'],['[data-k="body"]',7,'l'],['[data-k="bodySize"]',8,'l'],['[data-delbtn]',9,'r']]},
 {n:'s04p-tekst-sait', vp:[2400,1300], js:`DEMO.select('hero')`, clip:'#pv [data-el="hero"]', pad:[10,40,10,40],
  b:[['#pv [data-el="hero"] .s-eyebrow',3,'l'],['#pv [data-el="hero"] h1',5,'l'],['#pv [data-el="hero"] .b-lead',7,'l']]},
 {n:'s05-foto', vp:[1440,1000], js:`DEMO.select('al-photo')`, clip:'#form', maxh:560,
  b:[['[data-k="photo"] .th',1,'l'],['[data-editor]',2,'b'],['[data-upload]',3,'b'],['[data-k="caption"]',4,'l'],['[data-k="width"]',5,'l']]},
 {n:'s06-redaktor', vp:[1440,900], js:`DEMO.editor('t-alaverdi')`, clip:'.ed',
  b:[['.ed .frame',1,'tl'],['#zoom',2,'tl'],['#rot',3,'tl'],['#rst',4,'tr'],['.ed .side h4',5,'l'],['.ef .btn:not(.pri)',6,'tl'],['#apply',7,'tl']]},
 {n:'s07-plitki', vp:[1440,1000], js:`DEMO.select('ge-tiles')`, clip:'#form', maxh:740,
  b:[['[data-k="title"]',1,'l'],['[data-k="size"]',2,'l'],['[data-k="aspect"]',3,'l'],['[data-k="kind"]',4,'l'],['.box [data-addtile]',5,'r']]},
 {n:'s08-plitka', vp:[1440,1700], js:`DEMO.select('t-nekresi')`, clip:'#form', maxh:1560, to:'[data-k="place"]',
  b:[['[data-k="mode"] .chip',1,'r'],['[data-k="photo"] .th',2,'l'],['[data-k="title"]',3,'l'],['[data-k="sub"]',4,'l'],['[data-k="text"]',5,'l'],['[data-k="place"]',6,'l'],['[data-k="ll"]',7,'l'],['[data-k="asPage"] .sw',8,'r'],['[data-addinto]',9,'r'],['[data-k="seo"] h4',10,'r'],['[data-show]',11,'r'],['[data-delbtn]',12,'r']]},
 {n:'s08b-plitka', vp:[1440,1700], js:`DEMO.select('t-nekresi')`, clip:'[data-k="ll"]', wide:'#form', pad:[14,40,14,40], to:'[data-delbtn]',
  b:[['[data-k="mode"] .chip',1,'r'],['[data-k="photo"] .th',2,'l'],['[data-k="title"]',3,'l'],['[data-k="sub"]',4,'l'],['[data-k="text"]',5,'l'],['[data-k="place"]',6,'l'],['[data-k="ll"]',7,'l'],['[data-k="asPage"] .sw',8,'r'],['[data-addinto]',9,'r'],['[data-k="seo"] h4',10,'r'],['[data-show]',11,'r'],['[data-delbtn]',12,'r']]},
 {n:'s09-plitki-sait', vp:[2400,1300], js:`DEMO.select('ge-tiles')`, clip:'#pv [data-el="ge-tiles"]', pad:[10,20,10,20],
  b:[['#pv .s-tile[data-el="t-alaverdi"] .tag',1,'tl'],['#pv .s-tile[data-el="t-alaverdi"] h3',2,'l'],['#pv .s-tile[data-el="t-alaverdi"] .arr',3,'tl'],['#pv .s-tile[data-el="t-nekresi"] .arr',4,'tl'],['#pv .s-tile[data-el="t-shio"] .bar',5,'r']]},
 {n:'s10-popap', vp:[2400,1300], js:`DEMO.select('t-nekresi');DEMO.pv({pop:'t-nekresi'})`, clip:'#pv .s-modal', pad:[0,0,0,0],
  b:[['#pv .s-cbar .bk',1,'r'],['#pv .s-modal h2',2,'l'],['#pv .s-modal .in p',3,'l'],['#pv .s-route .lb',4,'l'],['#pv .s-route .btns',5,'tl'],['#pv .s-cbar .xx',6,'l']]},
 {n:'s11-stranica', vp:[2400,1300], js:`DEMO.select('t-alaverdi');DEMO.pv({page:'t-alaverdi'});document.querySelector('#pv .s-scroll').scrollTop=0`, clip:'#frm',
  b:[['#pv .s-head .back',1,'r'],['#pv .s-phead .ph',2,'tl'],['#pv .s-phead h1',3,'l'],['#pv .s-phead .s-route .lb',4,'l'],['#pv [data-el="al-shrines"] .s-bh',5,'l']]},
 {n:'s12-vino', vp:[1440,1500], js:`DEMO.select('w-red')`, clip:'#form', maxh:1260, to:'[data-k="sweet"]',
  b:[['[data-k="photo"] .th',1,'l'],['[data-k="title"]',2,'l'],['[data-k="sub"]',3,'l'],['[data-k="grape"]',4,'l'],['[data-k="year"]',5,'l'],['[data-k="price"]',6,'l'],['[data-k="color"]',7,'l'],['[data-k="sweet"]',8,'l'],['[data-k="text"]',9,'l'],['[data-k="seo"] h4',10,'r']]},
 {n:'s12b-vino', vp:[1440,1500], js:`DEMO.select('w-red')`, clip:'[data-k="text"]', wide:'#form', pad:[14,40,14,40], to:'[data-show]',
  b:[['[data-k="photo"] .th',1,'l'],['[data-k="title"]',2,'l'],['[data-k="sub"]',3,'l'],['[data-k="grape"]',4,'l'],['[data-k="year"]',5,'l'],['[data-k="price"]',6,'l'],['[data-k="color"]',7,'l'],['[data-k="sweet"]',8,'l'],['[data-k="text"]',9,'l'],['[data-k="seo"] h4',10,'r']]},
 {n:'s12p-vina-sait', vp:[2400,1300], js:`DEMO.select('al-wines')`, clip:'#pv [data-el="al-wines"]', pad:[10,20,10,20],
  b:[['#pv [data-el="w-red"] .wph',1,'tl'],['#pv [data-el="w-dry"] .wph',2,'tl'],['#pv [data-el="w-red"] .wp',3,'r']]},
 {n:'s13-karta', vp:[1440,1000], js:`DEMO.select('ge-map')`, clip:'#form', maxh:520,
  b:[['[data-k="title"]',1,'l'],['[data-k="pts"] b',2,'l'],['[data-k="pts"] [data-goid]',3,'l']]},
 {n:'s14-oplata', vp:[1440,1800], js:`DEMO.select('al-pay')`, clip:'#form', maxh:1060,
  b:[['[data-k="title"]',1,'l'],['[data-k="text"]',2,'l'],['[data-k="button"]',3,'l'],['[data-k="recipient"]',4,'l'],['.pm .h',5,'l'],['.pm input[type=checkbox]',6,'l'],['.pm [data-delpm]',7,'l'],['[data-addpm]',8,'r']]},
 {n:'s14p-okno-oplaty', vp:[2400,1300], js:`DEMO.select('al-pay');DEMO.pv({pay:'al-pay'})`, clip:'#pv .s-paym',
  b:[['#pv .s-paym h2',1,'l'],['#pv .s-qr',2,'l'],['#pv .s-paym .s-btn',3,'l'],['#pv .s-req summary',4,'l']]},
 {n:'s15-usluga', vp:[1440,1200], js:`DEMO.select('al-svc1')`, clip:'#form', maxh:900,
  b:[['[data-k="title"]',1,'l'],['[data-k="text"]',2,'l'],['[data-k="price"]',3,'l'],['[data-k="note"]',4,'l'],['[data-k="button"]',5,'l'],['[data-k="url"]',6,'l'],['[data-k="recipient"]',7,'l']]},
 {n:'s16-taby', vp:[1440,1000], js:`DEMO.select('tabs')`, clip:'#form', maxh:520,
  b:[['.box',1,'l'],['[data-goid]',2,'r'],['.in>button[data-addtab]',3,'r']]},
 {n:'s16b-tab', vp:[1440,1400], js:`DEMO.select('tab-ge')`, clip:'#form', maxh:1200,
  b:[['[data-k="title"]',1,'l'],['[data-k="slug"]',2,'l'],['[data-k="currency"]',3,'l'],['[data-k="fmt"]',4,'l'],['[data-k="owner"]',5,'l'],['[data-k="maps"]',6,'l'],['.sw[data-k="prices"]',7,'r'],['[data-k="tabio"]',8,'l'],['[data-delbtn]',9,'r']]},
 {n:'s16p-taby-sait', vp:[2400,1300], js:`DEMO.select('tabs')`, clip:'#pv .s-tabs', pad:[16,60,16,60],
  b:[['#pv .s-tab.on',1,'tl'],['#pv .s-tab.on b',2,'tr']]},
 {n:'s17-udalit', vp:[1440,900], js:`DEMO.select('t-alaverdi');DEMO.askDelete('t-alaverdi')`, clip:'.mbox', pad:[16,16,16,16]},
 {n:'s18-shapka', vp:[1440,1000], js:`DEMO.select('header')`, clip:'#form', maxh:460,
  b:[['.sw[data-k="on"]',1,'r'],['.fld input[disabled]',2,'l'],['[data-k="menu"]',3,'l']]},
 {n:'s18b-podval', vp:[1440,1000], js:`DEMO.select('footer')`, clip:'#form', maxh:420,
  b:[['.sw[data-k="on"]',1,'r'],['[data-k="email"]',2,'l'],['[data-k="phone"]',3,'l']]},
 {n:'s19-osnovnoe', vp:[1440,1700], js:`DEMO.select('set-main')`, clip:'#form', maxh:1500, to:'.snip',
  b:[['[data-k="title"]',1,'l'],['[data-k="seo"] h4',2,'r'],['.snip',3,'l'],['[data-k="currency"]',4,'l'],['[data-k="owner"]',5,'l'],['[data-k="maps"]',6,'l'],['.sw[data-k="prices"]',7,'r']]},
 {n:'s19b-osnovnoe', vp:[1440,1700], js:`DEMO.select('set-main')`, clip:'.in>.box', wide:'#form', pad:[14,40,14,40],
  b:[['[data-k="title"]',1,'l'],['[data-k="seo"] h4',2,'r'],['.snip',3,'l'],['[data-k="currency"]',4,'l'],['[data-k="owner"]',5,'l'],['[data-k="maps"]',6,'l'],['.sw[data-k="prices"]',7,'r']]},
 {n:'s20-adresa', vp:[1440,1000], js:`DEMO.select('set-dom')`, clip:'#form', maxh:820,
  b:[['[data-k="dom0"]',1,'l'],['[data-k="dom1"]',2,'l'],['[data-adddom]',3,'r']]},
 {n:'s21-socseti', vp:[1440,1000], js:`DEMO.select('set-soc')`, clip:'#form', maxh:720,
  b:[['[data-k="soc-yt"] .h',1,'l'],['[data-k="soc-tg"] input',2,'r'],['[data-k="soc-vk"] .h',3,'l'],['[data-k="soc-ig"] .warn',4,'r']]},
 {n:'s22-vygruzka', vp:[1440,1000], js:`DEMO.select('set-io')`, clip:'#form', maxh:520,
  b:[['[data-k="export"] h4',1,'r'],['.sw[data-k="only"]',2,'r'],['[data-k="import"] h4',3,'r']]},
 {n:'s23-oshibki', vp:[1440,1000], js:`DEMO.find('al-svc2').n.url='';DEMO.find('t-dzhvari').n.title='Монастырь Джвари — древнейший храм Грузии на горе';DEMO.select('t-dzhvari');DEMO.save()`, clip:'#form', maxh:360,
  b:[['.errs b',1,'r'],['.errs [data-goerr]',2,'r'],['[data-k="title"] i',3,'l']]},
 {n:'s24-telefon', vp:[1440,900], js:`DEMO.select('t-alaverdi');DEMO.device(390)`, clip:'.pvcol', b:[['#dv button.on',1,'tl'],['#pv .s-tile.sel',2,'tr']]},
];

(async () => {
 const only = process.argv[2];
 const br = await chromium.launch();
 for (const s of S) {
  if (only && !s.n.startsWith(only)) continue;
  const p = await br.newPage({ viewport: { width: s.vp[0], height: s.vp[1] }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log(s.n, 'ERR', e.message));
  p.on('console', m => { if (m.type() === 'warning') console.log(s.n, m.text()); });
  await p.goto(MOCK); await p.waitForLoadState('networkidle'); await p.waitForTimeout(500);
  if (s.gut) await p.addStyleTag({content:'body{margin-left:44px!important;width:calc(100% - 44px)}'});
  if (s.clip === '#form') await p.addStyleTag({content:'#tree,.pvcol{visibility:hidden}'});
  await p.evaluate(s.js); await p.waitForTimeout(500);
  if (s.b) await p.evaluate(b => DEMO.badges(b), s.b);
  let clip;
  if (s.clip) clip = await p.evaluate(([sel, pad, wide, maxh, to]) => {
   const r = document.querySelector(sel).getBoundingClientRect(); const w = wide ? document.querySelector(wide).getBoundingClientRect() : null;
   const [t, rr, bb, l] = pad || [14, 40, 14, 40];
   let x = (w ? w.left : r.left) - l, y = r.top - t, x2 = (w ? w.right : r.right) + rr, y2 = r.bottom + bb;
   if (to) y2 = document.querySelector(to).getBoundingClientRect().bottom + bb;
   if (maxh) y2 = Math.min(y2, y + maxh);
   x = Math.max(0, x); y = Math.max(0, y); x2 = Math.min(innerWidth, x2); y2 = Math.min(innerHeight, y2);
   return { x, y, width: x2 - x, height: y2 - y };
  }, [s.clip, s.pad, s.wide, s.maxh, s.to]);
  await p.screenshot({ path: path.join(OUT, s.n + '.png'), clip });
  await p.close();
  console.log('ok', s.n);
 }
 await br.close();
})();
