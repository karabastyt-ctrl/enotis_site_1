// ЭНОТИС · админка сайта-ленты · макет 2.0 (по спецификации 2.0 полной).
// Данные тестовые, сохранение имитируется. Сайт в превью отрисован упрощённо.
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SYM={RUB:'₽',GEL:'₾',EUR:'€',USD:'$'};
const MAPS={google:'Google Картах',yandex:'Яндекс Картах'};
const TN={text:'Текст',photo:'Фото',tiles:'Плитки',map:'Карта',pay:'Оплата',service:'Услуга',tabs:'Табы'};
const ADDHINT={text:'Надзаголовок, заголовок, текст',photo:'Одно фото с подписью',tiles:'Сетка плиток: места, вина',map:'Точки из плиток с координатами',pay:'Кнопка «Пожертвовать» и способы',service:'Платная услуга со ссылкой',tabs:'Страны над лентой (агрегатор)'};
const SOC=[['tg','Телеграм','TG'],['vk','ВКонтакте','VK'],['yt','YouTube','YT'],['rt','Rutube','RT'],['dz','Дзен','ДЗ'],['ok','Одноклассники','OK'],['wa','WhatsApp','WA'],['vb','Viber','VB'],['mx','MAX','MX'],['ig','Instagram','IG'],['fb','Facebook','FB'],['tt','TikTok','TT']];
const CAT={qr:['qr','QR-код','all'],requisites:['requisites','Реквизиты для перевода','all'],sbp:['link','Оплатить через СБП','RU'],sberpay:['link','SberPay','RU'],tpay:['link','T-Pay','RU'],yookassa:['link','Банковской картой','RU'],robokassa:['link','Картой через Робокассу','RU'],cloudpayments:['link','Картой через CloudPayments','RU'],flitt:['link','Оплатить картой (Flitt)','GE'],bog:['link','Bank of Georgia','GE'],tbc:['link','TBC Bank','GE'],quickpay:['link','Оплатить онлайн','GE'],keepz:['link','Keepz','GE'],custom:['link','Своя ссылка','all']};
const REQF={RU:[['recipient','Получатель'],['inn','ИНН'],['bank','Банк'],['bik','БИК'],['account','Расчётный счёт'],['purpose','Назначение']],GE:[['recipient','Получатель'],['code','Идентификационный код'],['bank','Банк'],['iban','IBAN'],['swift','SWIFT'],['purpose','Назначение']],other:[['recipient','Получатель'],['bank','Банк'],['iban','IBAN / счёт'],['swift','SWIFT'],['purpose','Назначение']]};
const LIM={text:{eyebrow:40,title:60,sub:120,body:3000},photo:{caption:120},tiles:{title:60},tile:{title:45,sub:90,text:3000,place:140,seoTitle:60,seoDesc:160},wine:{title:60,grape:60,text:3000,seoTitle:60,seoDesc:160},map:{title:60},pay:{title:60,text:300,button:30,recipient:100},service:{title:60,text:500,note:40,button:30,recipient:100},tab:{title:30,slug:40}};

// ---------- данные ----------
let N=0;const nid=p=>(p||'n')+'-'+(++N);
const clone=o=>JSON.parse(JSON.stringify(o));
function T(o){return Object.assign({id:nid('t'),type:'tile',on:true,title:'Новая плитка',sub:'',text:'',place:'',lat:'',lng:'',asPage:false,seoTitle:'',seoDesc:'',photo:{hue:200},blocks:[]},o)}
function W(o){return Object.assign({id:nid('w'),type:'tile',on:true,title:'Новое вино',text:'',grape:'',year:'',color:'красное',sweet:'сухое',price:'',photo:null,seoTitle:'',seoDesc:'',blocks:[]},o)}
const BASE={text:{eyebrow:'',title:'',titleSize:'m',sub:'',body:'',bodySize:'normal'},photo:{photo:{hue:30},caption:'',width:'full'},tiles:{title:'',size:'large',aspect:'3:2',kind:'normal',items:[]},map:{title:'На карте'},pay:{title:'Поддержать проект',text:'',button:'Поддержать',recipient:'',methods:[]},service:{title:'Новая услуга',text:'',price:'',note:'',button:'Заказать',url:'',recipient:''},tabs:{tabs:[]}};
function B(type,o){return Object.assign({id:nid('b'),type,on:true},clone(BASE[type]),o)}
function TAB(o){return Object.assign({id:nid('tab'),type:'tab',on:true,title:'Новый таб',slug:'novyj-tab',currency:'EUR',fmt:'other',owner:1,maps:'google',prices:true,blocks:[]},o)}
const LONG=' Здесь продолжается рассказ: история, предания, святыни, жизнь обители сегодня. Текст может быть длинным — до 3000 знаков.';
function shrines(pref,lat,lng){return [
 T({id:pref+'-s1',title:'Главный храм',sub:'Святыня',text:'Тестовый текст о главном храме обители. Дни памяти и даты пишутся здесь же.'+LONG,place:'В центре монастыря, вход через главные ворота.',lat:(lat+0.0008).toFixed(4),lng:(lng+0.001).toFixed(4),photo:{hue:30}}),
 T({id:pref+'-s2',title:'Чудотворная икона',sub:'Святыня',text:'Тестовый текст о чудотворной иконе.',photo:{hue:15}}),
 T({id:pref+'-s3',title:'Святой источник',sub:'Место',text:'Тестовый текст о святом источнике.',place:'Тропа от ворот монастыря, 300 м вниз по склону.',lat:(lat+0.003).toFixed(4),lng:(lng+0.004).toFixed(4),photo:{hue:190}})]}
function donate(id,name,fmt){return B('pay',{id,title:'Пожертвование монастырю',text:'Деньги поступают напрямую на счёт обители.',button:'Пожертвовать',recipient:'Монастырь «'+name+'»',methods:fmt==='GE'?[{p:'qr',on:true},{p:'flitt',on:true,url:'https://example.com/d',label:''},{p:'bog',on:true,url:'https://example.com/b',label:''},{p:'requisites',on:true,req:{recipient:'Монастырь «'+name+'»',code:'000000000',bank:'TBC Bank',iban:'GE00TB0000000000000000',swift:'TBCBGE22',purpose:'Пожертвование'}}]:[{p:'qr',on:true},{p:'custom',on:true,url:'https://example.com/d',label:'Оплатить картой'}]})}
const D={
 site:{title:'Обители · мировой агрегатор',seoTitle:'',seoDesc:'',currency:'EUR',fmt:'other',owner:1,maps:'google',prices:true,
  header:{on:true,menu:'auto'},footer:{on:true,email:'info@obiteli.site',phone:'+995 555 00 00 00'},
  socials:SOC.map(([k,n])=>({k,url:k==='tg'?'https://t.me/obiteli':k==='yt'?'https://youtube.com/@obiteli':''})),login:'admin'},
 domains:[{host:'obiteli.site',mode:'all',title:'Обители · мировой агрегатор'},{host:'georgia.obiteli.site',mode:'gruziya',title:'Монастыри Грузии'}],
 owners:[{id:1,name:'ИП Тестовый (Грузия)',country:'GE',tax:'405000000',reg:'',addr:'Тбилиси',email:'info@obiteli.site'},{id:2,name:'ИП Тестовый (Россия)',country:'RU',tax:'770000000000',reg:'320770000000000',addr:'Москва',email:'ru@obiteli.site'}],
 docs:{offer:{on:true,title:'Оферта',text:'Тестовый текст оферты о добровольной поддержке проекта.'},privacy:{on:true,title:'Политика персональных данных',text:'Тестовый текст политики.'},cookies:{on:false,title:'Cookies',text:'Сайт использует файлы cookie.'}},
 cookie:false,
 home:[]
};
(function seed(){
 const al=T({id:'t-alaverdi',title:'Алаверди',sub:'Кахетия',text:'Тестовое описание обители: история основания, главные святыни, уклад монастырской жизни. Это текст самой плитки — он стоит наверху её страницы.',place:'От Телави около 20 минут на машине, парковка у ворот.',lat:'42.0325',lng:'45.3771',photo:{hue:205},seoTitle:'',seoDesc:'',
  blocks:[B('tiles',{id:'al-shrines',title:'Святыни',items:shrines('al',42.0325,45.3771)}),
   B('tiles',{id:'al-wines',title:'Вина обители',size:'compact',aspect:'4:5',kind:'wine',items:[
    W({id:'w-red',title:'Alaverdi Red',grape:'Саперави',year:2015,color:'красное',sweet:'полусухое',price:45,photo:{hue:0},text:'Тестовое описание вина: виноградник обители, выдержка в квеври, вкус и с чем подавать.'}),
    W({id:'w-dry',title:'Alaverdi',grape:'Саперави',year:2017,color:'красное',sweet:'сухое',price:60,photo:null,text:''}),
    W({id:'w-white',title:'Alaverdi White',grape:'Ркацители',year:2016,color:'белое',sweet:'сухое',price:50,photo:{hue:50},text:'Тестовое описание белого вина обители.'})]}),
   B('service',{id:'al-svc1',title:'Онлайн-молебен',text:'Братия совершит молебен о здравии. Имена передаются после оплаты.',price:30,note:'за молебен',button:'Заказать',url:'https://example.com/m',recipient:'Монастырь «Алаверди»'}),
   B('service',{id:'al-svc2',title:'Онлайн-экскурсия',text:'Экскурсию по обители проводит монах. Прямой эфир, 40 минут.',price:50,note:'за участника',button:'Заказать',url:'https://example.com/e',recipient:'Монастырь «Алаверди»'}),
   B('photo',{id:'al-photo',photo:{hue:35},caption:'Монастырский двор весной',width:'narrow'}),
   B('map',{id:'al-map',title:'Святыни на карте'}),
   donate('al-pay','Алаверди','GE')]});
 const ge=TAB({id:'tab-ge',title:'Грузия',slug:'gruziya',currency:'GEL',fmt:'GE',owner:1,maps:'google',prices:true,blocks:[
  B('tiles',{id:'ge-tiles',items:[al,
   T({id:'t-gremi',title:'Греми',sub:'Кахетия',text:'Статичная страница: только описание и «Как добраться», блоков ниже нет.',place:'Трасса Телави — Кварели, 18 км.',lat:'42.0128',lng:'45.6553',asPage:true,photo:{hue:195}}),
   T({id:'t-nekresi',title:'Некреси',sub:'Кахетия',text:'Эта обитель открывается поп-апом: фото, описание и «Как добраться» с мини-картой.'+LONG,place:'Подъём от села Шилда на служебном автобусе.',lat:'41.9631',lng:'45.7770',photo:{hue:215}}),
   T({id:'t-dzhvari',title:'Джвари',sub:'Мцхета',text:'Тестовое описание монастыря Джвари.',place:'',lat:'41.8383',lng:'44.7330',photo:{hue:200}}),
   T({id:'t-gelati',title:'Гелати',sub:'Имеретия',text:'Тестовое описание Гелати.',lat:'42.2945',lng:'42.7685',photo:{hue:190},blocks:[B('tiles',{id:'gel-wines',title:'Вина',size:'compact',aspect:'4:5',kind:'wine',items:[W({title:'Gelati Tsolikouri',grape:'Цоликоури',year:2021,color:'белое',sweet:'сухое',price:35,photo:{hue:50}}),W({title:'Gelati Amber',grape:'Цицка',year:2020,color:'янтарное',sweet:'сухое',price:40,text:'Тестовое описание янтарного вина.'})]})]}),
   T({id:'t-shio',title:'Шио-Мгвиме',sub:'Мцхета',text:'',place:'',photo:{hue:210}})]}),
  B('map',{id:'ge-map',title:'Обители Грузии на карте'}),
  B('pay',{id:'ge-pay',title:'Поддержать проект',text:'Сайт существует благодаря добровольной поддержке читателей.',button:'Поддержать',recipient:'ИП Тестовый (Грузия)',methods:[{p:'quickpay',on:true,url:'https://example.com/s',label:''},{p:'qr',on:true}]})]});
 const rs=TAB({id:'tab-rs',title:'Сербия',slug:'serbiya',currency:'EUR',fmt:'other',blocks:[
  B('tiles',{id:'rs-tiles',items:[T({title:'Студеница',sub:'Рашка',text:'Тестовое описание.',lat:'43.4866',lng:'20.5317',photo:{hue:140}}),T({title:'Жича',sub:'Кралево',text:'Тестовое описание.',lat:'43.6939',lng:'20.6461',photo:{hue:150}}),T({title:'Високи Дечани',sub:'Метохия',text:'Тестовое описание.',lat:'42.5464',lng:'20.2658',photo:{hue:160}})]}),
  B('map',{title:'Обители Сербии на карте'})]});
 const gr=TAB({id:'tab-gr',title:'Греция',slug:'greciya',currency:'EUR',fmt:'other',blocks:[
  B('tiles',{items:[T({title:'Метеоры',sub:'Фессалия',text:'Тестовое описание.',photo:{hue:30}}),T({title:'Осиос Лукас',sub:'Беотия',text:'Тестовое описание.',photo:{hue:40}})]})]});
 D.home=[B('text',{id:'hero',eyebrow:'Православные обители',title:'Монастыри мира',titleSize:'l',body:'Монастыри Грузии, Сербии и Греции: история, святыни, вина обителей, онлайн-молебны и экскурсии. Выберите страну и нажмите на обитель.',bodySize:'lead'}),
  B('tabs',{id:'tabs',tabs:[ge,rs,gr]})];
})();

// ---------- обход дерева ----------
// ctx: {kind:'home'|'tab'|'page', level, tab, page, path:[подписи]}
function walk(fn){
 const visit=(list,owner,ctx)=>list.forEach(b=>{fn(b,list,owner,ctx);
  if(b.type==='tabs')b.tabs.forEach(t=>{fn(t,b.tabs,b,ctx);visit(t.blocks,t,{kind:'tab',level:1,tab:t,page:null,path:[...ctx.path,t.title]})});
  if(b.type==='tiles')b.items.forEach(t=>{const c={...ctx,tb:b};fn(t,b.items,b,c);if(ctx.level===1&&b.kind!=='wine')visit(t.blocks,t,{kind:'page',level:2,tab:ctx.tab,page:t,path:[...ctx.path,t.title]})});
 });
 visit(D.home,null,{kind:'home',level:1,tab:null,page:null,path:['Главная']});
}
function find(id){let r=null;walk((n,list,owner,ctx)=>{if(!r&&n.id===id)r={n,list,owner,ctx}});return r}
function ancestors(id){const chain=[];let f=find(id);while(f&&f.owner){chain.unshift(f.owner.id);f=find(f.owner.id)}return chain}
function feedSet(ctx){return ctx&&ctx.tab?ctx.tab:D.site}
function tabsBlock(){return D.home.find(b=>b.type==='tabs')}
const isWine=(ctx)=>ctx&&ctx.tb&&ctx.tb.kind==='wine';
function tileMode(t,ctx){
 if(isWine(ctx))return t.text?'popup':'none';
 if(ctx.level===1){if(t.blocks.some(b=>b.on))return 'page';if(t.asPage)return 'static'}
 return (t.text||t.place||(t.lat&&t.lng))?'popup':'none';
}
function countIn(n){let c=0;const v=l=>l.forEach(b=>{c++;if(b.items)b.items.forEach(t=>{c++;v(t.blocks||[])});if(b.tabs)b.tabs.forEach(t=>{c++;v(t.blocks)})});if(n.blocks)v(n.blocks);if(n.items)n.items.forEach(t=>{c++;v(t.blocks||[])});if(n.tabs)n.tabs.forEach(t=>{c++;v(t.blocks)});return c}
function visTiles(list){let n=0;list.forEach(b=>{if(b.on&&b.type==='tiles')n+=b.items.filter(t=>t.on).length});return n}

// ---------- картинки ----------
function hash(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%997;return h}
function phSVG(h,seed){const v=(seed*37)%60;return `<svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${h},55%,62%)"/><stop offset=".62" stop-color="hsl(${h},35%,82%)"/></linearGradient></defs><rect width="300" height="200" fill="url(#g${seed})"/><path d="M0 150 Q60 ${120+v/3} 120 140 T300 ${130+v/4} V200 H0Z" fill="hsl(${(h+120)%360},22%,42%)"/><path d="M0 170 Q90 150 170 168 T300 160 V200H0Z" fill="hsl(${(h+110)%360},25%,33%)"/><g fill="hsl(30,25%,${70-v/6}%)" stroke="hsl(30,20%,38%)" stroke-width="1"><rect x="${110+v/2}" y="105" width="70" height="55"/><rect x="${130+v/2}" y="78" width="30" height="30"/><path d="M${126+v/2} 80 L${145+v/2} 48 L${164+v/2} 80Z" fill="hsl(${h},20%,45%)"/><rect x="${90+v/2}" y="120" width="22" height="40"/></g><line x1="${145+v/2}" y1="38" x2="${145+v/2}" y2="50" stroke="#3a2a22" stroke-width="2"/><line x1="${140+v/2}" y1="42" x2="${150+v/2}" y2="42" stroke="#3a2a22" stroke-width="2"/></svg>`}
function bottleSVG(w){const p='M53 12h14v32q15 9 15 27v63q0 6-6 6H44q-6 0-6-6V71q0-18 15-27z';
 if(w.photo){const c={'белое':'#C8B25E','янтарное':'#B06E22','розовое':'#C77C7C'}[w.color]||'#2B0F14';return `<svg viewBox="0 0 120 150"><path d="${p}" fill="${c}"/><rect x="53" y="8" width="14" height="10" fill="#3A1A20"/><rect x="42" y="88" width="36" height="34" fill="#F4EEE4"/><rect x="47" y="96" width="26" height="3" fill="#8B2E2E"/><rect x="47" y="104" width="26" height="2" fill="#B8A893"/><rect x="47" y="109" width="18" height="2" fill="#B8A893"/></svg>`}
 return `<svg viewBox="0 0 120 150"><path d="${p}" fill="#CDB8A3" stroke="#A88E78" stroke-width="2"/></svg>`}
function qrSVG(seed){let s=seed+7,r=()=>{s=(s*9301+49297)%233280;return s/233280},o='';const fp=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/><rect x="${x+2}" y="${y+2}" width="3" height="3"/>`;for(let y=0;y<25;y++)for(let x=0;x<25;x++){if((x<8&&y<8)||(x>16&&y<8)||(x<8&&y>16))continue;if(r()>.5)o+=`<rect x="${x}" y="${y}" width="1" height="1"/>`}return `<svg viewBox="0 0 25 25" style="width:100%;height:100%" fill="#1b1b1b">${fp(0,0)}${fp(18,0)}${fp(0,18)}${o}</svg>`}
const paras=t=>String(t||'').split('\n').filter(x=>x.trim()).map(p=>`<p>${esc(p)}</p>`).join('');
function plural(n,a,b,c){const m=n%10,h=n%100;return n+' '+(m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c)}

// ---------- сайт (превью) ----------
const pst={host:'obiteli.site',tab:'gruziya',page:null,pop:null,pay:null,doc:null,menu:false};
function curDom(){return D.domains.find(d=>d.host===pst.host)||D.domains[0]}
function visTabs(){const tb=tabsBlock();return tb&&tb.on?tb.tabs.filter(t=>t.on):[]}
function activeTab(){const v=visTabs();if(!v.length)return null;const d=curDom();if(d.mode!=='all')return v.find(t=>t.slug===d.mode)||v[0];return v.find(t=>t.slug===pst.tab)||v[0]}
function siteTitle(){return curDom().title||D.site.title}
function tileHref(t){return t.id}
function tileHTML(t,tb,ctx,badge){const m=tileMode(t,{tb,level:ctx.level});const ic=m==='page'||m==='static'?'→':m==='popup'?'+':'';
 if(tb.kind==='wine')return wineHTML(t,tb,ctx);
 return `<a class="s-tile ${m==='none'?'nolink':''}" data-el="${t.id}" ${m!=='none'?`data-act="${m==='popup'?'pop':'page'}" data-id="${t.id}"`:''}>${t.photo?`<span class="ph ${tb.aspect==='4:5'?'r45':''}">${phSVG(t.photo.hue,hash(t.title))}${badge?`<span class="tag">${esc(badge)}</span>`:''}</span>`:''}<span class="bar"><div><h3>${esc(t.title)}</h3>${t.sub?`<small>${esc(t.sub)}</small>`:''}</div>${ic?`<span class="arr">${ic}</span>`:''}</span></a>`}
function wineHTML(w,tb,ctx){const fs=feedSet(ctx);const pr=fs.prices&&w.price!==''&&w.price!=null;
 return `<div class="s-wine ${w.text?'clk':''}" data-el="${w.id}" ${w.text?`data-act="pop" data-id="${w.id}"`:''}><div class="wph">${bottleSVG(w)}</div><div class="wb"><h4>${esc(w.title)}</h4>${ctx.tab?`<div class="wm">${esc(ctx.tab.title)}</div>`:''}<div class="wm">${esc(ctx.page?ctx.page.title:siteTitle())}</div><div class="wt">${esc([w.sweet,w.color].filter(Boolean).join(', '))}</div>${w.grape?`<div class="wg">${esc(w.grape)}</div>`:''}${w.year?`<div class="wg">${esc(w.year)}</div>`:''}${pr?`<div class="wp">${esc(w.price)} ${SYM[fs.currency]}</div>`:''}</div></div>`}
function mapPoints(list,ctx){const pts=[];const add=(l,c)=>l.forEach(b=>{if(!b.on||b.type!=='tiles'||b.kind==='wine')return;b.items.forEach(t=>{if(!t.on)return;if(t.lat&&t.lng)pts.push({t,ctx:c});if(c.level===1)add(t.blocks,{...c,level:2,page:t})})});add(list,ctx);return pts}
function mapHTML(b,list,ctx){const pts=mapPoints(list,ctx);if(!pts.length)return '';
 const la=pts.map(p=>+p.t.lat),lo=pts.map(p=>+p.t.lng);const a0=Math.min(...la),a1=Math.max(...la),o0=Math.min(...lo),o1=Math.max(...lo);
 const X=v=>o1===o0?50:8+84*(v-o0)/(o1-o0),Y=v=>a1===a0?50:10+80*(a1-v)/(a1-a0);
 return `<section class="s-mapb" data-el="${b.id}">${b.title?`<div class="s-bh">${esc(b.title)}</div>`:''}<div class="s-mapbox">${pts.map(p=>`<i class="s-pin" style="left:${X(+p.t.lng)}%;top:${Y(+p.t.lat)}%" data-act="${p.ctx.level===2?'pop2':tileMode(p.t,{level:p.ctx.level})==='popup'?'pop':'page'}" data-id="${p.t.id}" data-pg="${p.ctx.page?p.ctx.page.id:''}"><span>${esc(p.t.title)}</span></i>`).join('')}<span class="osm">© Авторы OpenStreetMap</span></div><div class="s-maphint2">Нажмите на отметку, чтобы открыть место. Карту можно приближать</div></section>`}
function blocksHTML(list,ctx,st){let h='';
 for(let i=0;i<list.length;i++){const b=list[i];if(!b.on)continue;const fs=feedSet(ctx);
  if(b.type==='text'){if(!(b.eyebrow||b.title||b.sub||b.body))continue;const tag=ctx.kind!=='page'&&b.title&&!st.h1?'h1':'h2';if(tag==='h1')st.h1=1;
   h+=`<section class="s-text" data-el="${b.id}">${b.eyebrow?`<div class="s-eyebrow">${esc(b.eyebrow)}</div>`:''}${b.title?`<${tag} class="t-${b.titleSize}">${esc(b.title)}</${tag}>`:''}${b.sub?`<p class="sub">${esc(b.sub)}</p>`:''}${b.body?`<div class="b-${b.bodySize}">${paras(b.body)}</div>`:''}</section>`}
  else if(b.type==='photo'){if(!b.photo)continue;h+=`<figure class="s-photo ${b.width}" data-el="${b.id}"><span class="ph">${phSVG(b.photo.hue,hash(b.id))}</span>${b.caption?`<figcaption>${esc(b.caption)}</figcaption>`:''}</figure>`}
  else if(b.type==='tiles'){const it=b.items.filter(t=>t.on);if(!it.length)continue;const badge=ctx.kind==='tab'&&curDom().mode==='all'?ctx.tab.title:'';
   h+=`<section data-el="${b.id}">${b.title?`<div class="s-bh">${esc(b.title)}</div>`:''}<div class="${b.size==='large'?'g-large':'g-compact'} ${b.kind==='wine'?'g-wine':''}">${it.map(t=>tileHTML(t,b,ctx,badge)).join('')}</div></section>`}
  else if(b.type==='map')h+=mapHTML(b,list,ctx);
  else if(b.type==='pay'){if(!b.methods.some(m=>m.on))continue;h+=`<section class="s-pay" data-el="${b.id}"><div><h3>${esc(b.title)}</h3>${b.text?`<p>${esc(b.text)}</p>`:''}</div><button class="s-btn" data-act="pay" data-id="${b.id}">${esc(b.button)}</button></section>`}
  else if(b.type==='service'){const grp=[];let j=i;while(j<list.length&&list[j].type==='service'){if(list[j].on&&list[j].url)grp.push(list[j]);j++}i=j-1;if(!grp.length)continue;
   h+=`<div class="s-svcs ${grp.length===1?'one':''}">${grp.map(v=>`<div class="s-svc" data-el="${v.id}"><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p><div class="s-price">${v.price!==''&&v.price!=null?esc(v.price)+' '+SYM[fs.currency]:'По договорённости'}${v.note?`<span>· ${esc(v.note)}</span>`:''}</div><button class="s-btn" data-act="svc">${esc(v.button||'Заказать')}</button>${v.recipient?`<div class="s-who">Услугу оказывает: ${esc(v.recipient)}</div>`:''}</div>`).join('')}</div>`}
  else if(b.type==='tabs'){const v=visTabs();const at=activeTab();if(!at)continue;
   h+=`<nav class="s-tabs" data-el="${b.id}">${v.map(t=>`<button class="s-tab ${t===at?'on':''}" data-act="tab" data-slug="${t.slug}" data-el="${t.id}">${esc(t.title)}<b>${visTiles(t.blocks)}</b></button>`).join('')}</nav>`;
   h+=blocksHTML(at.blocks,{kind:'tab',level:1,tab:at,page:null},st)}
 }
 return h}
function routeHTML(t,fs){if(!(t.place||(t.lat&&t.lng)))return '';return `<div class="s-route"><div class="lb">Как добраться</div>${t.place?`<p>${esc(t.place)}</p>`:''}${t.lat&&t.lng?`<div class="s-mapc fake"><i class="s-pin"></i><span class="osm" style="position:absolute;right:6px;bottom:4px;font-size:11px;color:var(--mute)">© Авторы OpenStreetMap</span></div><div class="btns"><button class="s-btn" data-act="route">Проложить маршрут</button><button class="s-btn ghost" data-act="mapopen">Открыть в ${MAPS[fs.maps]}</button></div>`:''}</div>`}
function findSite(id){const f=find(id);return f}
function renderSite(){const dom=curDom();const one=dom.mode!=='all';const at=activeTab();
 const pageF=pst.page?find(pst.page):null;const page=pageF&&pageF.n.on?pageF.n:null;
 const ctx0=page?{kind:'page',level:2,tab:pageF.ctx.tab,page}:at&&one?{kind:'tab',level:1,tab:at,page:null}:{kind:'home',level:1,tab:null,page:null};
 const fs=feedSet(page?pageF.ctx:ctx0.kind==='tab'?ctx0:{tab:at});
 const feedList=at?at.blocks:D.home;
 const st={h1:0};const S=D.site;
 let menuTiles=[];(page?[]:(one?at.blocks:at?at.blocks:D.home)).forEach(b=>{if(b.on&&b.type==='tiles'&&b.kind!=='wine')b.items.forEach(t=>t.on&&menuTiles.push(t))});
 const burger=!page&&!pst.doc&&(S.header.menu==='on'||(S.header.menu==='auto'&&menuTiles.length>6));
 let h='';
 if(S.header.on)h+=`<header class="s-head" data-el="header">${page||pst.doc?`<span class="back" data-act="home">← Назад</span>`:''}<span class="ttl" data-act="home">${esc(siteTitle())}</span>${burger?`<button class="burger" style="display:block" data-act="burger">☰</button>`:''}</header>`;
 if(pst.menu&&burger)h+=`<nav class="s-menu">${menuTiles.map(t=>`<a data-act="page" data-id="${t.id}">${esc(t.title)}</a>`).join('')}</nav>`;
 h+=`<main class="s-wrap">`;
 if(pst.doc){const d=D.docs[pst.doc];h+=`<article class="s-doc" style="padding:40px 0"><h1 style="color:var(--bur)">${esc(d.title)}</h1>${paras(d.text)}</article>`}
 else if(page){const t=page;h+=`<section class="s-phead" data-el="${t.id}"><div class="s-ptop">${t.photo?`<div class="ph">${phSVG(t.photo.hue,hash(t.title+'p'))}</div>`:'<div></div>'}<div><div class="s-eyebrow">${esc([pageF.ctx.tab&&curDom().mode==='all'?pageF.ctx.tab.title:'',t.sub].filter(Boolean).join(' · '))}</div><h1>${esc(t.title)}</h1>${t.text?`<div class="s-ptext">${paras(t.text)}</div>`:''}</div></div>${routeHTML(t,fs)}</section>`;
  h+=blocksHTML(t.blocks,{kind:'page',level:2,tab:pageF.ctx.tab,page:t},st)+'<div style="height:30px"></div>'}
 else if(one&&at)h+=blocksHTML(at.blocks,{kind:'tab',level:1,tab:at,page:null},st);
 else h+=blocksHTML(D.home,{kind:'home',level:1,tab:null,page:null},st);
 h+=`</main>`;
 const own=D.owners.find(o=>o.id==fs.owner);const socs=S.socials.filter(s=>s.url);
 if(S.footer.on)h+=`<footer class="s-foot" data-el="footer"><div class="in"><div><b>${esc(siteTitle())}</b><div>${esc(S.footer.email)} · ${esc(S.footer.phone)}</div>${socs.length?`<div class="s-soc">${socs.map(s=>`<span>${SOC.find(x=>x[0]===s.k)[2]}</span>`).join('')}</div>`:''}${own?`<div class="req">${esc(own.name)} · ${own.country==='RU'?'ИНН':'Код'} ${esc(own.tax)}${own.reg?' · ОГРНИП '+esc(own.reg):''} · ${esc(own.addr)}</div>`:''}</div><div class="docs">${Object.entries(D.docs).filter(([k,d])=>d.on).map(([k,d])=>`<a data-act="doc" data-doc="${k}">${esc(d.title)}</a>`).join('')}</div></div></footer>`;
 if(D.cookie&&!pst.cookieOk)h+=`<div class="s-cookie"><span>Сайт использует cookies. <a data-act="doc" data-doc="cookies">Подробнее</a></span><button data-act="cookie">Понятно</button></div>`;
 return h}
function overlayHTML(){
 if(pst.pop){const f=find(pst.pop);if(!f||!f.n.on)return '';const t=f.n,fs=feedSet(f.ctx);
  if(isWine(f.ctx)){const pr=fs.prices&&t.price!==''&&t.price!=null;return cardOv(t.title,[[t.sweet,t.color].join(', '),t.grape,t.year].filter(Boolean).join(' · '),t.text+(pr?`\nЦена: ${t.price} ${SYM[fs.currency]}`:''),'',`<div class="wph big">${bottleSVG(t)}</div>`)}
  return cardOv(t.title,t.sub,t.text,routeHTML(t,fs),t.photo?`<div class="ph">${phSVG(t.photo.hue,hash(t.title))}</div>`:'')}
 if(pst.pay){const f=find(pst.pay);if(!f)return '';const p=f.n,fs=feedSet(f.ctx);return `<div class="s-ov sheet" data-act="close"><div class="s-modal s-paym" data-stop="1"><button class="x" data-act="close">×</button><div class="in"><h2 style="font-size:26px">${esc(p.button)}</h2><div class="sub" style="text-transform:none;letter-spacing:0">${esc(p.recipient)}</div>${payMethodsHTML(p,fs)}</div></div></div>`}
 return ''}
function cardOv(title,sub,text,route,ph){return `<div class="s-ov" data-act="close"><div class="s-modal s-cardm" data-stop="1"><div class="s-cbar"><button class="bk" data-act="close"><span>‹</span>К списку</button><span class="ct">${esc(title)}</span><button class="xx" data-act="close">×</button></div>${ph}<div class="in"><h2>${esc(title)}</h2>${sub?`<div class="sub">${esc(sub)}</div>`:''}${paras(text)}${route}</div></div></div>`}
function payMethodsHTML(pay,fs){const ms=pay.methods.filter(m=>m.on);const qr=ms.find(m=>m.p==='qr'),rq=ms.find(m=>m.p==='requisites');const links=ms.filter(m=>CAT[m.p][0]==='link');
 return `${qr?`<div class="s-qr">${qrSVG(hash(pay.recipient||'x'))}</div><div class="s-note" style="margin-top:0">Наведите камеру телефона на код</div>`:''}${links.map((m,i)=>`<button class="s-btn ${i?'ghost':''}" data-act="paylink" data-label="${esc(m.label||CAT[m.p][1])}">${esc(m.label||CAT[m.p][1])}</button>`).join('')}${rq?`<details class="s-req"><summary>Реквизиты для перевода</summary><dl>${REQF[fs.fmt].filter(([k])=>rq.req[k]).map(([k,l])=>`<dt>${l}</dt><dd>${esc(rq.req[k])}</dd>`).join('')}</dl><button class="s-btn ghost" data-act="copy">Скопировать реквизиты</button></details>`:''}${D.docs.offer.on?`<div class="s-note">Нажимая кнопку, вы соглашаетесь с <a data-act="doc" data-doc="offer">офертой</a></div>`:''}`}

function mountSite(root){root.classList.add('site','pv');let lastKey='';
 const draw=()=>{const sc=root.querySelector('.s-scroll');const key=[pst.host,pst.tab,pst.page,pst.doc].join('|');const top=sc&&key===lastKey?sc.scrollTop:0;lastKey=key;
  root.innerHTML=`<div class="s-scroll">${renderSite()}</div>${overlayHTML()}${pst.toast?`<div class="s-toast">${esc(pst.toast)}</div>`:''}`;
  root.querySelector('.s-scroll').scrollTop=top;
  const e=A.sel&&root.querySelector(`.s-scroll [data-el="${CSS.escape(A.sel)}"]`);if(e){e.classList.add('sel');if(A.scroll){A.scroll=false;const s=root.querySelector('.s-scroll');s.scrollTop=Math.max(0,Math.min(e.offsetTop-s.clientHeight/2+e.offsetHeight/2,e.offsetTop-80))}}else A.scroll=false;
  const m=root.querySelector('.s-cardm');if(m){const ct=m.querySelector('.ct'),h=m.querySelector('h2');m.addEventListener('scroll',()=>ct.classList.toggle('show',h.getBoundingClientRect().bottom<m.getBoundingClientRect().top+52))}};
 const toast=t=>{pst.toast=t;draw();clearTimeout(pst._t);pst._t=setTimeout(()=>{pst.toast='';draw()},2200)};
 root.onclick=e=>{const a=e.target.closest('[data-act]');const elx=e.target.closest('.s-scroll [data-el]');
  if(e.target.closest('[data-stop]')&&a&&a.dataset.act==='close'&&!e.target.closest('.x,.bk,.xx'))return;
  if(elx&&!(a&&['tab','home','close','burger','doc'].includes(a.dataset.act)))selectFromPreview(elx.dataset.el);
  if(!a)return;const d=a.dataset;
  switch(d.act){
   case 'tab':pst.tab=d.slug;pst.menu=false;selectFromPreview(d.el||a.dataset.el);break;
   case 'page':{pst.pop=null;pst.page=d.id;pst.menu=false;pst.doc=null;break}
   case 'pop':pst.pop=d.id;pst.menu=false;break;
   case 'pop2':pst.page=d.pg;pst.pop=d.id;break;
   case 'home':pst.page=null;pst.pop=null;pst.doc=null;pst.pay=null;break;
   case 'close':pst.pop=null;pst.pay=null;break;
   case 'pay':pst.pay=d.id;break;
   case 'burger':pst.menu=!pst.menu;break;
   case 'doc':pst.doc=d.doc;pst.pay=null;pst.page=null;break;
   case 'cookie':pst.cookieOk=true;break;
   case 'svc':return toast('Откроется страница оплаты получателя в новой вкладке');
   case 'paylink':return toast('«'+d.label+'» — откроется оплата в новой вкладке');
   case 'copy':return toast('Скопировано');
   case 'route':return toast('Маршрут откроется в картах (новая вкладка или приложение)');
   case 'mapopen':return toast('Точка откроется в картах');
  }
  draw()};
 return {draw}}

// ---------- админка ----------
const A={sel:'hero',open:{'tabs':true,'tab-ge':true,'ge-tiles':true},add:null,dirty:false,errors:[],scroll:false};
const $=s=>document.querySelector(s);
function toast(t){const d=document.createElement('div');d.className='toastA';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}
function dirty(v=true){A.dirty=v;const s=$('#st');s.textContent=v?'Есть несохранённые изменения':'Все изменения сохранены';s.classList.toggle('dirty',v)}
function blockLabel(b){if(b.type==='text')return b.title||b.eyebrow||(b.body?b.body.slice(0,28)+'…':'Текст');if(b.type==='photo')return b.caption||'Фото';if(b.type==='tiles')return b.title||'Плитки';if(b.type==='map')return b.title||'Карта';if(b.type==='pay'||b.type==='service')return b.title||TN[b.type];return TN[b.type]}
function rowHTML(id,label,type,o={}){return `<div class="row ${A.sel===id?'sel':''} ${o.hid?'hid':''} ${o.cls||''}" data-id="${id}" ${o.drag?`draggable="true" data-dnd="${o.drag}"`:''}><span class="h">${o.drag?'⋮⋮':''}</span>${o.tog?`<span class="tg" data-tog="${id}">${A.open[id]?'▾':'▸'}</span>`:`<span class="dot ${o.photo===false?'no':''}" style="${o.photo==null?'visibility:hidden':''}"></span>`}<span class="lb">${o.bold?'<b>':''}${esc(label)}${o.bold?'</b>':''}</span><span class="ty">${esc(type)}</span>${o.ctl?`<span class="ic" data-hide="${id}" title="Скрыть / показать">${o.hid?'◌':'◉'}</span><span class="ic" data-del="${id}" title="Удалить">✕</span>`:''}</div>`}
function addMenuHTML(key,kind,list){
 if(A.add!==key)return `<div class="addel" data-add="${key}">+ Добавить блок</div>`;
 const why=t=>{if(t==='tabs'){if(kind!=='home')return 'Только на главной';if(tabsBlock())return 'Уже есть на сайте'}if((t==='map'||t==='pay')&&list.some(b=>b.type===t))return 'Уже есть на этой странице';return ''};
 return `<div class="addel" data-add="">− Скрыть выбор</div><div class="menu" data-menu="${key}">${Object.keys(TN).map(t=>{const w=why(t);return `<div class="${w?'dis':''}" data-addtype="${t}" data-key="${key}"><span class="tn">${TN[t]}</span><small>${w||ADDHINT[t]}</small></div>`}).join('')}</div>`}
function treeBlocks(list,ownerId,kind,level){let h='';
 list.forEach(b=>{const drag=b.type==='tabs'?'':ownerId;
  if(b.type==='tiles'){h+=rowHTML(b.id,blockLabel(b),`${b.kind==='wine'?'вина':b.size==='large'?'крупные':'компактные'} · ${b.aspect}`,{tog:1,drag,ctl:1,hid:!b.on,cls:'blk',bold:1});
   if(A.open[b.id]){h+=`<div class="kids">`+b.items.map(t=>tileRow(t,b,level)).join('')+`<div class="addel tile" data-addtile="${b.id}">+ Добавить ${b.kind==='wine'?'вино':'плитку'}</div></div>`}}
  else if(b.type==='tabs'){h+=rowHTML(b.id,'Табы',plural(b.tabs.length,'таб','таба','табов'),{tog:1,ctl:1,hid:!b.on,cls:'blk',bold:1});
   if(A.open[b.id]){h+=`<div class="kids">`+b.tabs.map(t=>{let r=rowHTML(t.id,t.title,'Таб · '+visTiles(t.blocks),{tog:1,drag:b.id,ctl:1,hid:!t.on});if(A.open[t.id])r+=`<div class="kids">${treeBlocks(t.blocks,t.id,'tab',1)}</div>`;return r}).join('')+`<div class="addel" data-addtab="1">+ Таб</div></div>`}}
  else h+=rowHTML(b.id,blockLabel(b),TN[b.type],{drag,ctl:1,hid:!b.on,cls:'blk'});
 });
 h+=addMenuHTML(ownerId,kind,list);return h}
function tileRow(t,tb,level){const wine=tb.kind==='wine';const m=tileMode(t,{tb,level});
 const n=t.blocks.length;const ty=wine?'Вино':m==='page'?'Страница · '+n:m==='static'?'Страница · статичная':m==='popup'?'Поп-ап':'Не нажимается';
 if(wine||level===2)return rowHTML(t.id,t.title,ty,{drag:tb.id,ctl:1,hid:!t.on,photo:!!t.photo});
 let r=rowHTML(t.id,t.title,ty,{tog:1,drag:tb.id,ctl:1,hid:!t.on});
 if(A.open[t.id])r+=`<div class="kids">${n?'':`<div class="empty">Блоков нет. Добавьте блок — плитка станет страницей</div>`}${treeBlocks(t.blocks,t.id,'page',2)}</div>`;
 return r}
function drawTree(){let h=`<div class="tw">`;
 h+=rowHTML('header','Шапка','Все страницы');
 h+=`<div class="grp"><span>Главная</span><span><span class="lnk" data-expand="1">Развернуть всё</span> · <span class="lnk" data-collapse="1">Свернуть</span></span></div>`;
 h+=treeBlocks(D.home,'home','home',1);
 h+=rowHTML('footer','Подвал','Все страницы');
 h+=`<div class="grp"><span>Настройки сайта</span></div>`+[['set-main','Основное','Название, поисковики'],['set-dom','Адреса','Домены'],['set-own','Владельцы','Реквизиты'],['set-docs','Документы и cookies','3 страницы'],['set-soc','Соцсети','Иконки в подвале'],['set-io','Выгрузка и загрузка','ZIP'],['set-login','Вход','Логин, пароль']].map(([i,l,t])=>rowHTML(i,l,t)).join('');
 $('#tree').innerHTML=h+`</div>`}

// ---------- формы ----------
let FN=null; // объект формы
const getP=(o,p)=>p.split('.').reduce((x,k)=>x==null?x:x[k],o);
function setP(o,p,v){const ks=p.split('.');const l=ks.pop();ks.reduce((x,k)=>x[k],o)[l]=v}
const cnt=(f,max)=>{const v=String(getP(FN,f)??'');return max?`<i class="${v.length>max?'over':''}" data-cnt="${f}">${v.length} / ${max}</i>`:''};
const F={
 txt:(lab,f,max,hint,ph)=>`<div class="fld" data-k="${f}"><label>${lab}${cnt(f,max)}</label><input type="text" data-f="${f}" data-max="${max||''}" value="${esc(getP(FN,f)??'')}" ${ph?`placeholder="${esc(ph)}"`:''}>${hint?`<div class="hintx">${hint}</div>`:''}</div>`,
 area:(lab,f,max,hint,ph)=>`<div class="fld" data-k="${f}"><label>${lab}${cnt(f,max)}</label><textarea data-f="${f}" data-max="${max||''}" ${ph?`placeholder="${esc(ph)}"`:''}>${esc(getP(FN,f)??'')}</textarea>${hint?`<div class="hintx">${hint}</div>`:''}</div>`,
 num:(lab,f,hint)=>`<div class="fld" data-k="${f}"><label>${lab}</label><input type="number" data-f="${f}" data-num="1" value="${esc(getP(FN,f)??'')}">${hint?`<div class="hintx">${hint}</div>`:''}</div>`,
 sw:(lab,f,hint)=>`<label class="sw" data-k="${f}"><input type="checkbox" data-f="${f}" data-bool="1" ${getP(FN,f)?'checked':''}> ${lab}</label>${hint?`<div class="hintx" style="margin:-8px 0 12px">${hint}</div>`:''}`,
 seg:(lab,f,opts,hint)=>`<div class="fld" data-k="${f}">${lab?`<label>${lab}</label>`:''}<div class="seg ${opts.length>2?'s3':''}">${opts.map(([v,t])=>`<label><input type="radio" name="${f}" value="${v}" data-f="${f}" ${String(getP(FN,f))===String(v)?'checked':''}>${t}</label>`).join('')}</div>${hint?`<div class="hintx">${hint}</div>`:''}</div>`,
 sel:(lab,f,opts,hint)=>`<div class="fld" data-k="${f}"><label>${lab}</label><select data-f="${f}">${opts.map(([v,t])=>`<option value="${v}" ${String(getP(FN,f))===String(v)?'selected':''}>${t}</option>`).join('')}</select>${hint?`<div class="hintx">${hint}</div>`:''}</div>`,
 head:(crumb,type,title,showSw)=>`<div class="crumb">${esc(crumb)}</div><div class="ftitle">${esc(title)}</div><div class="ftop"><span class="chip">${type}</span>${showSw?`<label class="sw" data-k="on"><input type="checkbox" data-f="on" data-bool="1" ${FN.on?'checked':''}> Показывать на сайте</label>`:''}</div>`,
 photo:(r,hint)=>{const p=FN.photo;return `<div class="fld" data-k="photo"><label>Фото</label><div class="photo"><div class="th ${p?'':'none'} ${r==='4:5'?'r45':''}">${p?(r==='4:5'&&FN.grape!==undefined?`<div class="wph" style="height:100%">${bottleSVG(FN)}</div>`:phSVG(p.hue,hash(FN.title||FN.id))):'нет фото'}</div><div>${p?`<button class="btn sm" data-editor="1">Изменить кадр</button> <button class="btn sm" data-upload="1">Заменить фото</button> <span class="lnkb" data-nophoto="1">убрать</span>`:`<button class="btn sm" data-upload="1">Загрузить фото</button>`}<div class="hintx">Рамка ${r}${hint?', '+hint:''}. Сжатие автоматически</div></div></div></div>`},
 seo:(autoT,autoD)=>`<div class="seo" data-k="seo"><h4>Для поисковиков</h4>${F.txt('Заголовок','seoTitle',60,'',autoT)}${F.area('Описание','seoDesc',160,'Пусто — заполнится само (видно серым)',autoD)}<div class="snip"><div class="u">${esc(curDom().host)} › …</div><div class="t">${esc(FN.seoTitle||autoT)}</div><div class="d">${esc((FN.seoDesc||autoD).slice(0,160))}</div></div><div class="hintx">Так страница может выглядеть в Google и Яндексе</div></div>`,
 del:(label)=>`<div style="margin-top:22px"><button class="btn bad sm" data-delbtn="1">${label||'Удалить'}</button></div>`
};
function crumbOf(f){return f.ctx.path.join(' / ')}
function drawForm(){const id=A.sel;let h='';const S=D.site;
 const err=A.errors.length?`<div class="errs"><b>Не сохранено. Исправьте:</b>${A.errors.map(e=>`<div data-goerr="${e.id}">${esc(e.msg)}</div>`).join('')}</div>`:'';
 if(id==='header'){FN=S.header;const n=visTiles(activeTab()?activeTab().blocks:D.home);h=`<div class="crumb">Все страницы</div><div class="ftitle">Шапка</div>`+F.sw('Показывать шапку','on')+`<div class="fld"><label>Название сайта</label><input type="text" value="${esc(S.title)}" disabled><div class="hintx">Нажатие ведёт на главную. Название задаётся в «Основное», а для каждого адреса — в «Адреса»</div></div>`+F.seg('Меню ☰','menu',[['auto','Авто'],['on','Всегда'],['off','Никогда']],`Авто: появляется, если плиток на главной больше 6. Сейчас ${n} — ${n>6?'показано':'скрыто'}`)+`<div class="hintx">Шапка закреплена сверху. На страницах плиток слева появляется «← Назад»</div>`}
 else if(id==='footer'){FN=S.footer;h=`<div class="crumb">Все страницы</div><div class="ftitle">Подвал</div>`+F.sw('Показывать подвал','on')+F.txt('Почта','email')+F.txt('Телефон','phone')+`<div class="hintx">Иконки соцсетей — «Настройки сайта → Соцсети». Реквизиты владельца и ссылки на документы появляются сами</div>`}
 else if(id==='set-main'){FN=S;const tb=!!tabsBlock();h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Основное</div>`+F.txt('Название сайта','title',40,'В шапке, подвале и в заголовке вкладки браузера')+F.seo(S.title,(D.home.find(b=>b.type==='text')||{}).body||'')+`<div class="box"><h4>Валюта, реквизиты, карты</h4>${tb?'<div class="hintx" style="margin-bottom:10px">На сайте есть Табы: у каждого таба свои настройки. Здесь — для общих блоков над табами и документов</div>':''}`+F.sel('Валюта','currency',[['RUB','RUB ₽'],['GEL','GEL ₾'],['EUR','EUR €'],['USD','USD $']])+F.sel('Формат реквизитов','fmt',[['RU','Россия (ИНН, БИК, счёт)'],['GE','Грузия (код, IBAN, SWIFT)'],['other','Другой (IBAN / счёт, SWIFT)']])+F.sel('Владелец','owner',D.owners.map(o=>[o.id,o.name]),'Его реквизиты — в подвале')+F.sel('Сервис карт','maps',[['google','Google Карты'],['yandex','Яндекс Карты']],'Для кнопок «Проложить маршрут» и «Открыть в картах»')+F.sw('Показывать цены вин','prices','Для российской аудитории — решение юриста')+`</div>`}
 else if(id==='set-dom'){FN=D;h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Адреса</div><div class="hintx" style="margin-bottom:12px">Один сайт может открываться по нескольким адресам. Адрес показывает все табы или только один таб (тогда без полосы табов). Содержимое общее: правка видна везде.</div>`+D.domains.map((d,i)=>`<div class="box" data-k="dom${i}">${F.txt('Адрес (домен)',`domains.${i}.host`)}${F.sel('Показывает',`domains.${i}.mode`,[['all','Все табы'],...(tabsBlock()?tabsBlock().tabs.map(t=>[t.slug,'Только таб «'+t.title+'»']):[])])}${F.txt('Название сайта на этом адресе',`domains.${i}.title`,40)}<span class="lnkb" data-deldom="${i}">удалить адрес</span></div>`).join('')+`<button class="btn sm" data-adddom="1">+ Адрес</button><div class="hintx" style="margin-top:8px">Какой адрес показывать в превью — выбор над превью</div>`}
 else if(id==='set-own'){FN=D;h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Владельцы</div><div class="hintx" style="margin-bottom:12px">Реквизиты владельца выводятся в подвале. Их требуют платёжные сервисы</div>`+D.owners.map((o,i)=>`<div class="box">${F.txt('Название',`owners.${i}.name`,120)}${F.sel('Страна',`owners.${i}.country`,[['RU','Россия'],['GE','Грузия'],['other','Другая']])}${F.txt(o.country==='RU'?'ИНН':'Идентификационный код',`owners.${i}.tax`)}${o.country==='RU'?F.txt('ОГРНИП / ОГРН',`owners.${i}.reg`):''}${F.txt('Адрес',`owners.${i}.addr`)}${F.txt('Почта',`owners.${i}.email`)}</div>`).join('')+`<button class="btn sm" data-addown="1">+ Владелец</button>`}
 else if(id==='set-docs'){FN=D;h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Документы и cookies</div>`+Object.keys(D.docs).map(k=>`<div class="box" data-k="doc-${k}">${F.sw('Показывать на сайте',`docs.${k}.on`)}${F.txt('Заголовок',`docs.${k}.title`,60)}${F.area('Текст',`docs.${k}.text`,20000)}</div>`).join('')+F.sw('Уведомление о cookies внизу сайта','cookie')+`<div class="hintx">Тексты документов согласуйте с юристом</div>`}
 else if(id==='set-soc'){FN=S;h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Соцсети</div><div class="hintx" style="margin-bottom:12px">Вставьте ссылку — в подвале появится иконка. Пустое поле — иконки нет. Порядок меняется перетаскиванием ⋮⋮</div>`+S.socials.map((s,i)=>{const d=SOC.find(x=>x[0]===s.k);return `<div class="soc" draggable="true" data-dnd="soc" data-i="${i}" data-k="soc-${s.k}"><span class="h" style="cursor:grab;color:#B9AEA4">⋮⋮</span><span class="ico ${s.url?'':'off'}">${d[2]}</span><span>${d[1]}</span><input type="text" data-f="socials.${i}.url" value="${esc(s.url)}" placeholder="https://…">${s.k==='ig'||s.k==='fb'?`<div class="warn">Для сайтов в РФ: Meta признана экстремистской, нужна проверка юриста</div>`:''}</div>`}).join('')}
 else if(id==='set-io'){FN={only:false};h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Выгрузка и загрузка</div><div class="box" data-k="export"><h4>Выгрузить сайт</h4><div class="hintx" style="margin-bottom:10px">Скачается один ZIP: всё дерево сайта и фото. Так делают копию или шаблон для нового сайта.</div><label class="sw" data-k="only"><input type="checkbox" id="onlystruct"> Только структура (без текстов, фото, координат, ссылок и реквизитов) — пустой шаблон</label><button class="btn sm" data-toast="Скачивается ZIP сайта">Выгрузить сайт</button></div><div class="box" data-k="import"><h4>Загрузить сайт</h4><div class="hintx" style="margin-bottom:10px">Выберите ZIP. Текущий сайт будет заменён. Перед этим копия базы сохранится сама.</div><button class="btn sm" data-import="1">Загрузить сайт…</button></div><div class="hintx">Выгрузить или загрузить один таб — в настройках таба. Логин и пароль не выгружаются никогда.</div>`}
 else if(id==='set-login'){FN={};h=`<div class="crumb">Настройки сайта</div><div class="ftitle">Вход</div><div class="fld"><label>Логин</label><input type="text" value="${esc(S.login)}"></div><div class="fld"><label>Новый пароль</label><input type="text" placeholder="не меньше 10 знаков"></div><div class="fld"><label>Повторите пароль</label><input type="text"></div><button class="btn sm" data-toast="Пароль изменён">Сменить пароль</button><div class="hintx" style="margin-top:8px">После 5 неверных попыток вход закрывается на 15 минут</div>`}
 else {const f=find(id);if(!f){$('#form').innerHTML='';return}FN=f.n;const n=f.n,ctx=f.ctx,cr=crumbOf(f);const fs=feedSet(ctx);
  if(n.type==='text')h=F.head(cr,'Текст',blockLabel(n),1)+F.txt('Надзаголовок','eyebrow',40,'Мелко прописными над заголовком')+F.txt('Заголовок','title',60)+F.seg('Размер заголовка','titleSize',[['l','Крупно'],['m','Обычно'],['s','Мелко']])+F.txt('Подзаголовок','sub',120)+F.area('Текст','body',3000,'Новая строка = новый абзац. Жирного и ссылок нет')+F.seg('Размер текста','bodySize',[['lead','Вводный'],['normal','Обычный'],['small','Мелкий']])+`<div class="hintx">Все поля необязательные: пустое поле на сайте не видно</div>`+F.del();
  else if(n.type==='photo')h=F.head(cr,'Фото',blockLabel(n),1)+F.photo('3:2')+F.txt('Подпись','caption',120,'Необязательно. Видна под фото')+F.seg('Ширина','width',[['full','На всю ширину'],['narrow','Узкое по центру']],'Узкое — около половины ширины; на телефоне всегда на всю ширину')+F.del();
  else if(n.type==='tiles')h=F.head(cr,'Плитки',blockLabel(n),1)+F.txt('Заголовок блока','title',60,'Необязательно, например «Святыни»')+F.seg('Размер','size',[['large','Крупные<small>3 · 2 · 1 в ряд</small>'],['compact','Компактные<small>4 · 3 · 2 в ряд</small>']],'В ряд на компьютере · планшете · телефоне')+F.seg('Фото','aspect',[['3:2','Горизонтальное 3:2'],['4:5','Вертикальное 4:5']],'Смена рамки: фото плиток обрежутся заново по центру — проверьте кадры')+F.seg('Вид','kind',[['normal','Обычные'],['wine','Вина']],'Нужны плитки разного вида или размера — поставьте два блока Плитки подряд')+`<div class="box"><b>${plural(n.items.length,'плитка','плитки','плиток')}</b><div class="hintx">Плитки — в дереве под этим блоком</div><button class="btn sm" style="margin-top:8px" data-addtile="${n.id}">+ Добавить ${n.kind==='wine'?'вино':'плитку'}</button></div>`+F.del('Удалить блок и плитки ('+countIn(n)+')');
  else if(n.type==='tile'&&isWine(ctx)){const pr=fs.prices;h=F.head(cr,'Вино',n.title,1)+F.photo('4:5','бутылка по центру на ровном фоне')+F.txt('Название','title',60)+F.txt('Сорт винограда','grape',60)+`<div class="fld"><div class="two">${F.num('Год урожая','year')}${F.num('Цена, '+SYM[fs.currency],'price',pr?'Пусто — цены нет':'Цены вин в этой ленте скрыты')}</div></div>`+F.sel('Цвет','color',['красное','белое','розовое','янтарное'].map(x=>[x,x]))+F.sel('Сладость','sweet',['сухое','полусухое','полусладкое','сладкое'].map(x=>[x,x]))+F.area('Описание','text',3000,'Если заполнено — вино открывается поп-апом. Кнопки «Купить» нет')+F.seo(n.title+' — '+siteTitle(),n.text)+`<button class="btn sm" data-show="${n.id}">Показать в превью</button>`+F.del();}
  else if(n.type==='tile'){const m=tileMode(n,ctx);const lv1=ctx.level===1;const chip={page:['page','Сейчас открывается: страница →'],static:['page','Сейчас открывается: статичная страница →'],popup:['pop','Сейчас открывается: поп-ап +'],none:['none','Не нажимается: нет текста и «Как добраться»']}[m];
   h=F.head(cr,'Плитка',n.title,1)+`<div class="fld" data-k="mode"><span class="chip ${chip[0]}">${chip[1]}</span></div>`+F.photo(ctx.tb.aspect)+F.txt('Название','title',45)+F.txt('Подпись','sub',90,'Видна под фото всегда')+F.area('Текст','text',3000,m==='page'||m==='static'?'Описание наверху страницы':'Виден в поп-апе')+F.txt('Как добраться','place',140,'Текстом')+`<div class="fld" data-k="ll"><label>Широта, долгота</label><div class="two"><input type="text" data-f="lat" value="${esc(n.lat)}" placeholder="42.0325"><input type="text" data-f="lng" value="${esc(n.lng)}" placeholder="45.3771"></div><div class="hintx">Точка сама появится на карте. ${n.lat&&n.lng?'<span class="lnkb" data-toast="Откроется карта в новой вкладке">Проверить на карте</span>':''}</div></div>`+
    (lv1?`<div class="box" data-k="asPage">${F.sw('Открывать как страницу','asPage')}<div class="hintx">${n.blocks.some(b=>b.on)?'У плитки есть блоки — она и так открывается страницей.':'Без галочки плитка без блоков открывается поп-апом. С галочкой — отдельной страницей.'}</div><button class="btn sm" style="margin-top:8px" data-addinto="${n.id}">+ Добавить блок на страницу плитки</button></div>`:`<div class="hintx" style="margin-bottom:12px">Плитка на странице плитки всегда открывается поп-апом</div>`)+
    F.seo(n.title+' — '+siteTitle(),n.sub||n.text)+(m==='page'||m==='static'?`<button class="btn sm" data-gopage="${n.id}">Перейти на страницу плитки →</button>`:m==='popup'?`<button class="btn sm" data-show="${n.id}">Показать поп-ап в превью</button>`:'')+F.del(n.blocks.length?`Удалить плитку и всё на её странице (${countIn(n)})`:'Удалить плитку')}
  else if(n.type==='map'){const pts=mapPoints(f.list,{...ctx});h=F.head(cr,'Карта',blockLabel(n),1)+F.txt('Заголовок','title',60)+`<div class="box" data-k="pts"><b>Отметки ставятся сами — из координат плиток. Сейчас отметок: ${pts.length}</b>${pts.map(p=>`<div class="lnkb" style="margin-top:6px" data-goid="${p.t.id}">● ${esc(p.t.title)}</div>`).join('')}<div class="hintx" style="margin-top:8px">Нет отметок — карта на сайте не видна. Одна карта на страницу</div></div>`+F.del()}
  else if(n.type==='pay')h=F.head(cr,'Оплата',blockLabel(n),1)+`<div class="hintx" style="margin-bottom:12px">Одна на страницу. Кнопка открывает окно оплаты</div>`+F.txt('Заголовок','title',60)+F.area('Текст','text',300)+F.txt('Текст кнопки','button',30)+F.txt('Кому идут деньги','recipient',100,'Видно посетителю в окне оплаты')+payForm(n,fs)+F.del();
  else if(n.type==='service')h=F.head(cr,'Услуга',blockLabel(n),1)+F.txt('Заголовок','title',60)+F.area('Текст','text',500)+`<div class="fld"><div class="two">${F.num('Цена, '+SYM[fs.currency],'price','Пусто — «по договорённости»')}${F.txt('Подпись к цене','note',40,'',  'за молебен')}</div></div>`+F.txt('Текст кнопки','button',30)+F.txt('Ссылка на оплату','url',0,'Ссылку берите из платёжного сервиса получателя. <b>Без ссылки услуга на сайте не показывается</b>','https://…')+F.txt('Кому идут деньги','recipient',100,'На сайте: «Услугу оказывает: …»')+F.del();
  else if(n.type==='tabs')h=F.head(cr,'Табы','Табы',1)+`<div class="box"><div class="hintx">• Табы — страны (или разделы) над лентой.<br>• Блоки <b>выше</b> Табов — общие для всех табов.<br>• Табы всегда последний блок главной.<br>• Табы видны, даже если таб один.</div></div>`+n.tabs.map(t=>`<div class="lnkb" style="margin:6px 0" data-goid="${t.id}">${esc(t.title)} · ${plural(visTiles(t.blocks),'плитка','плитки','плиток')}${t.on?'':' (скрыт)'}</div>`).join('')+`<button class="btn sm" style="margin-top:8px" data-addtab="1">+ Таб</button>`+F.del(n.tabs.length>1?'Удалить Табы':'Удалить Табы (лента таба станет лентой главной)');
  else if(n.type==='tab'){h=F.head(cr,'Таб',n.title,1)+F.txt('Подпись','title',30)+F.txt('Slug (в адресе)','slug',40,'Латиница, цифры, дефис. После первого сохранения сам не меняется')+F.sel('Валюта','currency',[['RUB','RUB ₽'],['GEL','GEL ₾'],['EUR','EUR €'],['USD','USD $']])+F.sel('Формат реквизитов','fmt',[['RU','Россия (ИНН, БИК, счёт)'],['GE','Грузия (код, IBAN, SWIFT)'],['other','Другой (IBAN / счёт, SWIFT)']])+F.sel('Владелец','owner',D.owners.map(o=>[o.id,o.name]),'Реквизиты — в подвале страниц этого таба')+F.sel('Сервис карт','maps',[['google','Google Карты'],['yandex','Яндекс Карты']],'Кнопки «Проложить маршрут» и «Открыть в картах» в поп-апах')+F.sw('Показывать цены вин','prices','Для российской аудитории — решение юриста')+`<div class="hintx" style="margin-bottom:12px">Свой адрес страны (например, georgia.…) — в «Настройки сайта → Адреса»</div><div class="box" data-k="tabio"><h4>Перенос таба</h4><button class="btn sm" data-toast="Скачивается ZIP таба">Выгрузить таб</button> <button class="btn sm" data-toast="Выбор ZIP — таб добавится скрытым">Загрузить таб</button><div class="hintx">Выгруженный таб можно загрузить как отдельный сайт</div></div>`+F.del('Удалить таб и всё в нём ('+countIn(n)+')')}
 }
 $('#form').innerHTML=`<div class="in">${err}${h}</div>`}
function payForm(p,fs){const ms=p.methods;let h=`<div class="box" data-k="methods"><h4>Способы оплаты</h4><div class="hintx" style="margin:-4px 0 8px">Порядок здесь = порядок кнопок на сайте. Первая кнопка выделена. Формат реквизитов ленты: <b>${fs.fmt}</b></div>`;
 ms.forEach((m,i)=>{const c=CAT[m.p];h+=`<div class="pm" draggable="true" data-dnd="pm" data-i="${i}"><span class="h">⋮⋮</span><input type="checkbox" data-f="methods.${i}.on" data-bool="1" ${m.on?'checked':''}><span class="nm2">${esc(m.label||c[1])}</span><span class="ic" data-delpm="${i}" style="cursor:pointer;color:#B9AEA4">✕</span><div class="sub">`+
  (c[0]==='link'?`<input type="text" placeholder="Ссылка на оплату https://…" data-f="methods.${i}.url" value="${esc(m.url||'')}"><input type="text" placeholder="Подпись кнопки (пусто — «${esc(c[1])}»)" data-f="methods.${i}.label" value="${esc(m.label||'')}">`:c[0]==='qr'?`<button class="btn sm" data-toast="Выбор картинки QR из банка">Заменить картинку QR</button>`:REQF[fs.fmt].map(([k,l])=>`<input type="text" placeholder="${l}" data-f="methods.${i}.req.${k}" value="${esc(m.req[k]||'')}">`).join(''))+`</div></div>`});
 const can=Object.entries(CAT).filter(([k,c])=>(c[2]==='all'||c[2]===fs.fmt)&&!((k==='qr'||k==='requisites')&&ms.some(m=>m.p===k)));
 return h+`<select class="btn sm" data-addpm="1" style="margin-top:6px"><option value="">+ Способ…</option>${can.map(([k,c])=>`<option value="${k}">${c[1]}</option>`).join('')}</select><div class="hintx">Каждый QR-код и ссылку проверьте перед включением: получатель и счёт</div></div>`}

// ---------- превью ----------
let PW=1280;
function routeFor(id){pst.pop=null;pst.pay=null;pst.doc=null;pst.menu=false;
 const f=find(id);if(!f)return;const ctx=f.ctx;
 const tab=f.n.type==='tab'?f.n:ctx.tab;
 if(tab){pst.tab=tab.slug;const d=curDom();if(d.mode!=='all'&&d.mode!==tab.slug){pst.host=D.domains.find(x=>x.mode==='all').host;$('#pvdom').value=pst.host}}
 else if(curDom().mode!=='all'){pst.host=D.domains.find(x=>x.mode==='all').host;$('#pvdom').value=pst.host}
 pst.page=ctx.page?ctx.page.id:null;A.scroll=true}
function selectFromPreview(id){if(!id)return;if(id==='header'||id==='footer'||find(id)){A.sel=id;ancestors(id).forEach(a=>A.open[a]=true);A.errors=A.errors;drawTree();drawForm()}}
const pv=mountSite($('#pv'));
function fit(){const st=$('#pvst'),f=$('#frm');const H=Math.max(st.clientHeight-28,400);f.style.width=PW+'px';const sc=Math.min(1,(st.clientWidth-28)/PW);f.style.height=(H/sc)+'px';f.style.transform=`scale(${sc})`}
function all(){drawTree();drawForm();pv.draw();$('#nm').textContent=D.site.title}
function select(id){A.sel=id;ancestors(id).forEach(a=>A.open[a]=true);routeFor(id);all()}

// ---------- окна ----------
function modal(html){const m=document.createElement('div');m.className='mo';m.innerHTML=html;document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-mclose]'))m.remove()});return m}
function confirmBox(title,text,ok,fn){const m=modal(`<div class="mbox"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="acts"><button class="btn" data-mclose="1">Отмена</button><button class="btn pri" data-ok="1">${esc(ok)}</button></div></div>`);m.querySelector('[data-ok]').onclick=()=>{m.remove();fn()};return m}
function askDelete(id){const f=find(id);if(!f)return;const n=f.n;const name=n.type==='tile'||n.type==='tab'?n.title:blockLabel(n);
 if(n.type==='tabs'&&n.tabs.length>1)return modal(`<div class="mbox"><h3>Нельзя удалить Табы</h3><p>Сначала оставьте один таб (остальные удалите или выгрузите).</p><div class="acts"><button class="btn pri" data-mclose="1">Понятно</button></div></div>`);
 const k=countIn(n);
 confirmBox(`Удалить «${name}»?`,(k?`И всё внутри (${k}). `:'')+'После сохранения удаление не отменить, фото удалятся.','Удалить',()=>{
  if(n.type==='tabs'){const t=n.tabs[0];const i=D.home.indexOf(n);D.home.splice(i,1,...(t?t.blocks:[]));if(t)Object.assign(D.site,{currency:t.currency,fmt:t.fmt,owner:t.owner,maps:t.maps,prices:t.prices})}
  else f.list.splice(f.list.indexOf(n),1);
  A.sel=f.owner?f.owner.id:'hero';if(!find(A.sel))A.sel='header';dirty();routeFor(A.sel);all();toast('Удалено. Пока не сохранили — можно обновить страницу')})}
function addBlock(key,type){const owner=key==='home'?null:find(key).n;const list=owner?owner.blocks:D.home;
 const doAdd=(mode)=>{let b;
  if(type==='tabs'){const t=TAB({title:'Основной',slug:'osnovnoj',on:true,currency:D.site.currency,fmt:D.site.fmt,owner:D.site.owner,maps:D.site.maps,prices:D.site.prices});
   if(mode==='move'){t.blocks=D.home.splice(0)}b=B('tabs',{tabs:[t]});D.home.push(b);A.open[b.id]=true;A.open[t.id]=true}
  else{b=B(type);if(type==='tiles'){b.items=[T()];A.open[b.id]=true}const ti=list.findIndex(x=>x.type==='tabs');if(!owner&&ti>=0)list.splice(ti,0,b);else list.push(b)}
  A.add=null;A.sel=b.id;dirty();routeFor(b.id);all();
  if(owner&&owner.type==='tile'&&owner.blocks.length===1)toast('Плитка «'+owner.title+'» теперь открывается страницей');};
 if(type==='tabs'&&D.home.length){const m=modal(`<div class="mbox"><h3>Добавить Табы</h3><p>На главной уже есть блоки. Что с ними сделать?</p><div class="opt" data-o="move"><b>Блоки главной станут первым табом</b><span>Рекомендуется. Сайт станет агрегатором, текущая лента — его первая страна</span></div><div class="opt" data-o="keep"><b>Оставить их общими над табами</b><span>Они будут видны над полосой табов на всех табах</span></div><div class="acts"><button class="btn" data-mclose="1">Отмена</button></div></div>`);m.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{m.remove();doAdd(o.dataset.o)});return}
 doAdd()}
function addTile(tbId){const tb=find(tbId).n;const t=tb.kind==='wine'?W():T({photo:null});tb.items.push(t);A.open[tb.id]=true;A.sel=t.id;dirty();routeFor(t.id);all();toast(tb.kind==='wine'?'Вино добавлено: загрузите фото 4:5':'Плитка добавлена: загрузите фото и впишите название')}
function addTab(){const tb=tabsBlock();const t=TAB({on:false,title:'Новый таб',slug:'novyj-tab-'+(tb.tabs.length+1),currency:D.site.currency,fmt:D.site.fmt,owner:D.site.owner,maps:D.site.maps,prices:D.site.prices});tb.tabs.push(t);A.open[tb.id]=true;A.sel=t.id;dirty();routeFor(t.id);all();toast('Таб создан скрытым — включите «Показывать на сайте»')}
// редактор фото
const ED={x:0,y:0,s:1,r:0};
function openEditor(n,fresh){const f=find(n.id);const r=(f&&f.ctx.tb&&f.ctx.tb.aspect==='4:5')||isWine(f&&f.ctx)?'4:5':'3:2';const wine=isWine(f&&f.ctx);
 Object.assign(ED,{x:0,y:0,s:1,r:0});const fw=r==='4:5'?300:540,fh=r==='4:5'?375:360;
 const img=wine?`<div style="width:100%;height:100%;background:#E6D8C3;display:grid;place-items:center">${bottleSVG({photo:1,color:n.color})}</div>`:phSVG((n.photo&&n.photo.hue)||200,hash(n.id)+3);
 const mini=(cols,w)=>`<div class="mini" style="grid-template-columns:repeat(${cols},1fr);width:${w}px">${Array.from({length:cols}).map((_,i)=>`<div class="${i===0?'me':''}" style="aspect-ratio:${r==='4:5'?'4/5':'3/2'}">${i===0?`<div class="mimg" style="position:absolute;inset:0">${img}</div>`:''}</div>`).join('')}</div>`;
 const m=modal(`<div class="mbox ed"><div class="eh"><h3>Редактор фото · рамка ${r}</h3><button class="btn sm" data-mclose="1">×</button></div><div class="eb"><div class="stage" id="stage"><div class="imgw" id="imgw">${img}</div><div class="frame" style="width:${fw}px;height:${fh}px"></div></div><div class="side"><h4>Как будет выглядеть</h4>Компьютер${mini(3,240)}Планшет${mini(2,180)}Телефон${mini(1,100)}<div style="margin-top:10px">Тексты и настройки при замене фото не меняются</div></div></div><div class="tools" id="tools"><span>Масштаб</span><input type="range" min="1" max="4" step="0.05" value="1" id="zoom"><button class="btn sm" id="rot">Повернуть на 90°</button><button class="btn sm" id="rst">Сбросить</button><span class="hintx" style="margin:0">Перетащите фото мышью, чтобы главное попало в рамку. Колесо мыши тоже меняет масштаб</span></div><div class="ef"><span class="hintx">Итог: ${r==='4:5'?'1200×1500':'1600×1067'} px, JPEG, сжатие автоматически</span><button class="btn" data-mclose="1">Отмена</button><button class="btn pri" id="apply">Применить</button></div></div>`);
 const upd=()=>{const tr=`translate(${ED.x}px,${ED.y}px) scale(${ED.s}) rotate(${ED.r}deg)`;m.querySelector('#imgw').style.transform=tr;m.querySelectorAll('.mimg').forEach(e=>e.style.transform=`translate(${ED.x/8}px,${ED.y/8}px) scale(${ED.s*1.0}) rotate(${ED.r}deg)`);m.querySelector('#zoom').value=ED.s};
 const st=m.querySelector('#stage');let dr=null;st.onmousedown=e=>{dr={x:e.clientX-ED.x,y:e.clientY-ED.y}};addEventListener('mousemove',e=>{if(dr){ED.x=e.clientX-dr.x;ED.y=e.clientY-dr.y;upd()}});addEventListener('mouseup',()=>dr=null);
 st.onwheel=e=>{e.preventDefault();ED.s=Math.min(4,Math.max(1,ED.s-e.deltaY/500));upd()};
 m.querySelector('#zoom').oninput=e=>{ED.s=+e.target.value;upd()};m.querySelector('#rot').onclick=()=>{ED.r=(ED.r+90)%360;ED.s=Math.max(ED.s,ED.r%180?1.5:1);upd()};m.querySelector('#rst').onclick=()=>{Object.assign(ED,{x:0,y:0,s:1,r:0});upd()};
 m.querySelector('#apply').onclick=()=>{m.remove();if(fresh)n.photo={hue:(hash(n.id+Date.now())*7)%360};dirty();all();toast('Кадр применён')};
 window.__ed=m;return m}

// ---------- события ----------
$('#tree').addEventListener('click',e=>{const t=e.target;
 if(t.dataset.tog){A.open[t.dataset.tog]=!A.open[t.dataset.tog];return drawTree()}
 if(t.dataset.expand){walk(n=>{if(n.type==='tiles'||n.type==='tabs'||n.type==='tab'||(n.type==='tile'&&n.blocks.length))A.open[n.id]=true});return drawTree()}
 if(t.dataset.collapse){A.open={};return drawTree()}
 if(t.dataset.hide){const f=find(t.dataset.hide);f.n.on=!f.n.on;dirty();all();return toast(f.n.on?'Снова видно на сайте':'Скрыто: посетители не видят, данные сохраняются')}
 if(t.dataset.del)return askDelete(t.dataset.del);
 if(t.dataset.add!=null){A.add=t.dataset.add||null;return drawTree()}
 const at=t.closest('[data-addtype]');if(at){if(at.classList.contains('dis'))return toast(at.querySelector('small').textContent);return addBlock(at.dataset.key,at.dataset.addtype)}
 if(t.dataset.addtile)return addTile(t.dataset.addtile);
 if(t.dataset.addtab)return addTab();
 const r=t.closest('.row');if(r)select(r.dataset.id)});
$('#form').addEventListener('input',e=>{const t=e.target;if(!t.dataset.f)return;let v=t.dataset.bool?t.checked:t.dataset.num?(t.value===''?'':+t.value):t.value;setP(FN,t.dataset.f,v);
 const c=document.querySelector(`[data-cnt="${CSS.escape(t.dataset.f)}"]`);if(c){c.textContent=String(v).length+' / '+t.dataset.max;c.classList.toggle('over',String(v).length>+t.dataset.max)}
 dirty();clearTimeout(A._t);A._t=setTimeout(()=>{drawTree();pv.draw();if(t.tagName==='SELECT'||t.type==='checkbox'||t.type==='radio')drawForm();$('#nm').textContent=D.site.title},300)});
$('#form').addEventListener('change',e=>{const t=e.target;if(t.dataset.addpm){if(!t.value)return;const c=CAT[t.value];const m={p:t.value,on:true};if(c[0]==='link'){m.url='';m.label=''}if(t.value==='requisites')m.req={purpose:'Пожертвование'};FN.methods.push(m);dirty();drawForm();pv.draw()}});
$('#form').addEventListener('click',e=>{const t=e.target.closest('[data-toast],[data-gopage],[data-show],[data-delpm],[data-adddom],[data-deldom],[data-addown],[data-goid],[data-goerr],[data-delbtn],[data-editor],[data-upload],[data-nophoto],[data-addtile],[data-addtab],[data-addinto],[data-import]');if(!t)return;const d=t.dataset;
 if(d.toast)toast(d.toast);
 if(d.gopage){pst.page=d.gopage;pst.pop=null;pv.draw()}
 if(d.show){const f=find(d.show);pst.page=f.ctx.page?f.ctx.page.id:null;pst.pop=d.show;pv.draw()}
 if(d.delpm!=null){FN.methods.splice(+d.delpm,1);dirty();drawForm();pv.draw()}
 if(d.adddom){D.domains.push({host:'new.obiteli.site',mode:'all',title:'Новый адрес'});dirty();drawForm();fillDom()}
 if(d.deldom!=null){if(D.domains.length<2)return toast('Нужен хотя бы один адрес');D.domains.splice(+d.deldom,1);dirty();drawForm();fillDom()}
 if(d.addown){D.owners.push({id:D.owners.length+1,name:'Новый владелец',country:'RU',tax:'',reg:'',addr:'',email:''});dirty();drawForm()}
 if(d.goid||d.goerr)select(d.goid||d.goerr);
 if(d.delbtn)askDelete(A.sel);
 if(d.editor)openEditor(FN);
 if(d.upload){toast('Выбор файла на компьютере…');setTimeout(()=>openEditor(FN,true),400)}
 if(d.nophoto){FN.photo=null;dirty();all()}
 if(d.addtile)addTile(d.addtile);
 if(d.addtab)addTab();
 if(d.addinto){A.open[d.addinto]=true;A.add=d.addinto;drawTree();toast('Выберите тип блока в дереве слева')}
 if(d.import)confirmBox('Загрузить сайт из ZIP?','Текущий сайт будет заменён. Перед этим копия базы сохранится сама.','Заменить сайт',()=>toast('Сайт загружен из ZIP'))});
let drag=null;
document.addEventListener('dragstart',e=>{const d=e.target.closest('[data-dnd]');if(!d)return;drag=d;e.dataTransfer.effectAllowed='move'});
document.addEventListener('dragover',e=>{const d=e.target.closest('[data-dnd]');if(drag&&d&&d.dataset.dnd===drag.dataset.dnd){e.preventDefault();d.classList.add('drag-over')}});
document.addEventListener('dragleave',e=>{const d=e.target.closest('[data-dnd]');d&&d.classList.remove('drag-over')});
document.addEventListener('drop',e=>{const d=e.target.closest('[data-dnd]');if(!drag||!d||d.dataset.dnd!==drag.dataset.dnd)return;e.preventDefault();d.classList.remove('drag-over');
 const g=drag.dataset.dnd;
 if(g==='pm'||g==='soc'){const arr=g==='pm'?FN.methods:D.site.socials;const a=+drag.dataset.i,b=+d.dataset.i;arr.splice(b,0,arr.splice(a,1)[0])}
 else{const fa=find(drag.dataset.id),fb=find(d.dataset.id);if(fa&&fb&&fa.list===fb.list){const l=fa.list;l.splice(l.indexOf(fb.n),0,l.splice(l.indexOf(fa.n),1)[0]);const ti=D.home.findIndex(x=>x.type==='tabs');if(ti>=0&&ti!==D.home.length-1)D.home.push(D.home.splice(ti,1)[0])}}
 drag=null;dirty();all()});
function validate(){const er=[];walk((n,list,owner,ctx)=>{const lim=n.type==='tile'?(isWine(ctx)?LIM.wine:LIM.tile):LIM[n.type];const nm=n.type==='tile'||n.type==='tab'?n.title:blockLabel(n);
 if(lim)for(const k in lim)if(String(n[k]??'').length>lim[k])er.push({id:n.id,msg:`«${nm}»: поле длиннее ${lim[k]} знаков`});
 if(n.type==='tile'&&(!!n.lat!==!!n.lng))er.push({id:n.id,msg:`«${nm}»: нужны и широта, и долгота`});
 if(n.type==='service'&&n.on&&!n.url)er.push({id:n.id,msg:`«${nm}»: у видимой услуги нет ссылки на оплату`});
 if(n.type==='tab'&&!/^[a-z0-9-]{1,40}$/.test(n.slug))er.push({id:n.id,msg:`Таб «${nm}»: slug — только латиница, цифры, дефис`})});return er}
$('#save').onclick=()=>{A.errors=validate();if(A.errors.length){drawForm();return toast('Не сохранено: исправьте ошибки над формой')}dirty(false);drawForm();toast('Сохранено — изменения сразу на сайте')};
$('#open').onclick=()=>toast('Сайт откроется в новой вкладке');
$('#dv').onclick=e=>{const b=e.target.closest('button');if(!b)return;[...b.parentNode.children].forEach(x=>x.classList.toggle('on',x===b));PW=+b.dataset.w;fit()};
function fillDom(){$('#pvdom').innerHTML=D.domains.map(d=>`<option value="${esc(d.host)}">${esc(d.host)}</option>`).join('');$('#pvdom').value=pst.host}
$('#pvdom').onchange=e=>{pst.host=e.target.value;pst.page=null;pst.pop=null;pv.draw()};
addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='s'){e.preventDefault();$('#save').click()}});
addEventListener('resize',fit);fillDom();routeFor(A.sel);all();fit();

// ---------- для скриншотов инструкции ----------
window.DEMO={select,find,D,A,pst,all,addBlock,
 device(w){document.querySelector(`#dv button[data-w="${w}"]`).click()},
 openAdd(key){A.add=key;A.open[key]=true;ancestors(key).forEach(a=>A.open[a]=true);drawTree()},
 pv(o){Object.assign(pst,o);pv.draw()},
 editor(id){return openEditor(find(id).n)},
 askDelete,validate,
 save(){$('#save').click()},
 clear(){document.querySelectorAll('.hb,.hbox,.mo,.toastA').forEach(x=>x.remove())},
 badges(list){document.querySelectorAll('.hb,.hbox').forEach(x=>x.remove());list.forEach(([sel,n,pos,box])=>{const el=typeof sel==='string'?document.querySelector(sel):sel;if(!el){console.warn('нет',sel);return}const r=el.getBoundingClientRect();
  if(box){const b=document.createElement('div');b.className='hbox';Object.assign(b.style,{left:r.left-3+'px',top:r.top-3+'px',width:r.width+6+'px',height:r.height+6+'px'});document.body.appendChild(b)}
  const d=document.createElement('div');d.className='hb';d.textContent=n;const p=pos||'l';let x=r.left-30,y=r.top+r.height/2-13;
  if(p==='r')x=r.right+4;if(p==='c')x=r.left+r.width/2-13;if(p==='a'){x=r.left+r.width/2-13;y=r.top-28}if(p==='b'){x=r.left+r.width/2-13;y=r.bottom+2}if(p==='tl'){x=r.left-10;y=r.top-10}if(p==='tr'){x=r.right-16;y=r.top-10}
  d.style.left=Math.max(2,x)+'px';d.style.top=Math.max(2,y)+'px';document.body.appendChild(d)})}};
