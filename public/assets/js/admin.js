/* Админка сайта-ленты (спецификация 2.1, раздел 10): дерево, формы с языковыми вкладками, превью, фото, сохранение.
   Всё состояние — дерево сайта в JSON формата 3 (раздел 12). Сохранение отправляет его целиком. */
(function () {
  'use strict';

  var BOOT = JSON.parse(document.getElementById('boot').textContent);
  var T = BOOT.t;
  var S = { site: null, meta: null, sel: 'set:main', lang: null, dirty: false, open: {}, errors: [], warnings: [],
            idmap: {}, device: 1280, pvLang: null, pvPath: '/', pvHost: '', scrollY: 0, seq: 0, saving: false };
  var tmp = 0;

  /* ---------------------------------------------------------------- мелочи */

  function t(key, vars) {
    var s = T[key] != null ? T[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function newId() { tmp += 1; return 'n' + tmp; }
  function langs() { return S.site.languages.on; }
  function mainLang() { return S.site.languages.main; }
  function multi() { return langs().length > 1; }
  function tx(obj, lang) { return obj && typeof obj === 'object' ? (obj[lang || S.lang] || '') : ''; }
  function txAny(obj) { return tx(obj, S.lang) || tx(obj, mainLang()) || ''; }
  function api(method, name, body, isForm) {
    var opts = { method: method, headers: { 'X-CSRF': BOOT.csrf }, credentials: 'same-origin' };
    if (body) {
      if (isForm) opts.body = body;
      else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body, noPrivate); }
    }
    return fetch('/admin/api/' + name, opts).then(function (r) {
      if (r.status === 401) { location.reload(); throw new Error('auth'); }
      return r.json().then(function (j) { j._status = r.status; return j; });
    });
  }
  // Поля с «_» — только для админки (миниатюры, служебные пометки), на сервер не уходят.
  function noPrivate(k, v) { return k.charAt(0) === '_' ? undefined : v; }

  /* ---------------------------------------------------------------- индекс дерева */

  // Каждый элемент: где лежит (список и родитель), уровень страницы, таб, путь для формы и превью.
  // Ключ выбора — id элемента, у таба — «t» + id (у табов свои номера).
  var IDX = {}, META = new WeakMap();
  function reindex() {
    IDX = {}; META = new WeakMap();
    if (!S.site.domains) S.site.domains = [];
    walkBlocks(S.site.blocks, null, 0, null);
  }
  function put(key, entry) { entry.key = String(key); IDX[key] = entry; META.set(entry.node, entry); }
  function walkBlocks(list, ownerTile, level, tab) {
    list.forEach(function (b) {
      put(b.id, { node: b, list: list, kind: 'block', tile: ownerTile, level: level, tab: tab });
      if (b.type === 'tabs') {
        if (!b.tabs) b.tabs = [];
        b.tabs.forEach(function (tb) {
          put('t' + tb.id, { node: tb, list: b.tabs, kind: 'tab', block: b, tile: null, level: 0, tab: tb });
          if (!tb.blocks) tb.blocks = [];
          walkBlocks(tb.blocks, null, 0, tb);
        });
      }
      if (b.type === 'tiles') {
        if (!b.tiles) b.tiles = [];
        b.tiles.forEach(function (tl) {
          put(tl.id, { node: tl, list: b.tiles, kind: 'tile', block: b, tile: ownerTile, level: level, tab: tab });
          if (b.kind !== 'wine') {
            if (!tl.blocks) tl.blocks = [];
            walkBlocks(tl.blocks, tl, level + 1, tab);
          }
        });
      }
    });
  }
  function info(node) { return node ? META.get(node) : null; }
  function keyOf(node) { var i = info(node); return i ? i.key : String(node.id); }
  function tabsBlock() { return S.site.blocks.filter(function (b) { return b.type === 'tabs'; })[0] || null; }
  // Лента элемента: таб или сайт — у неё валюта, формат реквизитов, владелец, карты, цены вин (раздел 3.4).
  function feedOf(node) { var i = info(node); return (i && i.tab) || S.site.settings; }
  function tabSlugOf(tb) { return tb.slug || S.idmap['tabslug:' + tb.id] || ''; }
  // Префикс адреса таба в превью: на адресе одного таба его нет (раздел 4.5).
  function tabPrefix(tb) {
    if (!tb) return '';
    var d = S.site.domains.filter(function (x) { return x.host === S.pvHost; })[0];
    if (d && d.tab != null) return '';
    return '/' + tabSlugOf(tb);
  }
  function isWine(tile) { var i = info(tile); return i && i.block && i.block.kind === 'wine'; }
  function visibleKids(tl) { return (tl.blocks || []).filter(function (b) { return !b.hidden; }); }
  function hasCoords(tl) { return tl.lat !== null && tl.lat !== '' && tl.lat !== undefined && tl.lng !== null && tl.lng !== '' && tl.lng !== undefined; }
  // Как откроется плитка (раздел 3.2) — подсказка в дереве и форме; точное решение принимает сервер.
  function opens(tl) {
    var i = info(tl);
    if (isWine(tl)) return tx(tl.text, mainLang()) ? 'popup' : null;
    if (i.level === 0 && (visibleKids(tl).length || tl.as_page)) return visibleKids(tl).length ? 'page' : 'static';
    return (tx(tl.text, mainLang()) || tx(tl.place, mainLang()) || hasCoords(tl)) ? 'popup' : null;
  }
  function serverId(key) {
    key = String(key);
    if (key.charAt(0) === 't') { var tid = key.slice(1); return 't' + (S.idmap['tab:' + tid] || tid); }
    return S.idmap[key] || key;
  }
  // id из превью и из ошибок сервера → ключ выбора в админке (у новых элементов — временный id).
  function clientId(eid) {
    eid = String(eid);
    if (eid.charAt(0) === 't') {
      var tid = eid.slice(1);
      for (var t in S.idmap) if (t.indexOf('tab:') === 0 && String(S.idmap[t]) === tid) return 't' + t.slice(4);
      return eid;
    }
    for (var k in S.idmap) if (k.indexOf(':') < 0 && String(S.idmap[k]) === eid) return k;
    return isNaN(+eid) ? eid : +eid;
  }
  function slugOf(tl) { return tl.slug || S.idmap['slug:' + tl.id] || ''; }

  /* ---------------------------------------------------------------- языки и переводы */

  var TEXT_FIELDS = {
    text: ['eyebrow', 'title', 'subtitle', 'text'], photo: ['caption'], tiles: ['title'],
    tile: ['title', 'subtitle', 'text', 'place', 'seo_title', 'seo_description'], wine: ['title', 'subtitle', 'grape', 'text'],
    map: ['title'], pay: ['title', 'text', 'button', 'recipient'], service: ['title', 'text', 'price_note', 'button', 'recipient'],
    tab: ['title'], tabs: []
  };
  function kindOf(node) {
    var i = info(node);
    if (!i) return null;
    if (i.kind === 'tab') return 'tab';
    if (i.kind === 'tile') return isWine(node) ? 'wine' : 'tile';
    return node.type;
  }
  // Языки без перевода у элемента, где вообще есть текст (раздел 10.3).
  function missingLangs(node) {
    if (!multi()) return [];
    var fields = TEXT_FIELDS[kindOf(node)] || [];
    var any = false, has = {};
    fields.forEach(function (f) {
      var o = node[f];
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (l) { if (String(o[l]).trim()) { any = true; has[l] = true; } });
    });
    if (!any) return [];
    return langs().filter(function (l) { return !has[l]; });
  }

  /* ---------------------------------------------------------------- загрузка */

  function load() {
    api('GET', 'site').then(function (j) {
      S.site = j.site; S.meta = j.meta; S.priv = j.private;
      S.lang = mainLang(); S.pvLang = mainLang();
      reindex();
      renderAll();
      schedulePreview(0);
      api('GET', 'update').then(function (u) { S.upd = u; renderUpbar(); }).catch(function () {});
    });
  }

  function renderAll() {
    $('[data-site-name]').textContent = txAny(S.site.settings.site_title) || t('app.title');
    $('[data-foot]').textContent = t('footer.engine') + ' ' + S.meta.engine + ' · ' + t('footer.schema') + ' ' + S.meta.schema;
    renderStatus();
    renderTree();
    renderForm();
    renderPreviewBar();
  }

  function changed() {
    S.dirty = true;
    reindex();
    renderStatus();
    renderTree();
    schedulePreview(400);
  }

  function renderStatus() {
    var st = $('[data-status]');
    st.className = 'top__status' + (S.dirty ? ' is-dirty' : '');
    st.textContent = S.dirty ? t('top.unsaved') : t('top.saved');
    $('[data-save]').disabled = !S.dirty || S.saving;
  }

  /* ---------------------------------------------------------------- дерево */

  var TYPE_LABEL = function (node) {
    var k = kindOf(node);
    return t('type.' + k);
  };

  function rowTitle(node) {
    var k = kindOf(node);
    var title = '';
    if (k === 'photo') title = txAny(node.caption);
    else if (k === 'text') title = txAny(node.title) || txAny(node.eyebrow) || txAny(node.text).slice(0, 40);
    else title = txAny(node.title);
    return title;
  }

  function rowTag(node) {
    var k = kindOf(node);
    if (k === 'tiles') return node.kind === 'wine' ? t('tag.wine', { n: node.tiles.length }) : t('tag.tiles_' + node.size) + ' · ' + node.aspect;
    if (k === 'tab') return t('tag.tab', { n: tabTileCount(node) });
    if (k === 'tabs') return t('tag.tabs', { n: node.tabs.length });
    if (k === 'tile') {
      var o = opens(node);
      if (o === 'page') return t('tag.page', { n: visibleKids(node).length });
      if (o === 'static') return t('tag.static');
      if (o === 'popup') return t('tag.popup');
      return t('tag.no_click');
    }
    if (k === 'wine') return opens(node) ? t('tag.popup') : t('tag.no_click');
    return '';
  }

  function renderTree() {
    var root = $('[data-tree]');
    var keepScroll = root.scrollTop;
    root.innerHTML = '';
    var L = launchItems(), done = L.filter(function (x) { return x.ok; }).length;
    var lrow = fixedRow('launch', done === L.length ? '✓ ' + t('launch.ready') : t('launch.title'), done === L.length ? '' : t('launch.count', { n: done, m: L.length }));
    if (done === L.length) lrow.classList.add('row--ok');
    root.appendChild(lrow);
    root.appendChild(fixedRow('header', t('tree.header'), t('tree.all_pages')));
    var home = h('div', { class: 'grp' }, [h('div', { class: 'grp__h' }, [h('span', { text: t('tree.home') })])]);
    home.appendChild(blockList(S.site.blocks, null));
    root.appendChild(home);
    root.appendChild(fixedRow('footer', t('tree.footer'), t('tree.all_pages')));
    var set = h('div', { class: 'grp' }, [h('div', { class: 'grp__h' }, [h('span', { text: t('tree.settings') })])]);
    ['main', 'design', 'langs', 'domains', 'operators', 'docs', 'social', 'mail', 'backups', 'transfer', 'advanced', 'update'].forEach(function (k) {
      set.appendChild(fixedRow('set:' + k, t('set.' + k), ''));
    });
    root.appendChild(set);
    root.scrollTop = keepScroll;
  }

  function fixedRow(key, label, tag) {
    var row = h('div', { class: 'row row--fixed' + (S.sel === key ? ' is-sel' : '') + (hasErr(key) ? ' has-err' : ''), tabindex: '0', role: 'button',
      onclick: function () { select(key); }, onkeydown: enterClick }, [
      h('span', { class: 'row__lb', text: label }), tag ? h('span', { class: 'row__tag', text: tag }) : null
    ]);
    return row;
  }
  function enterClick(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }

  function hasErr(id) {
    return S.errors.some(function (er) { return errKey(er) === String(id); });
  }

  // Плитки ленты таба на полосе табов: видимые плитки уровня 1 (раздел 5.4).
  function tabTileCount(tb) {
    var n = 0;
    tb.blocks.forEach(function (b) { if (b.type === 'tiles' && !b.hidden) b.tiles.forEach(function (tl) { if (!tl.hidden && tx(tl.title, mainLang())) n++; }); });
    return n;
  }

  function tabList(block) {
    var wrap = h('div', { class: 'kids' });
    block.tabs.forEach(function (tb, i) { wrap.appendChild(nodeRow(tb, block.tabs, i)); });
    wrap.appendChild(h('button', { type: 'button', class: 'add', text: '+ ' + t('tree.add_tab'), onclick: function () { addTab(block); } }));
    return wrap;
  }

  function blockList(list, ownerTile) {
    var wrap = h('div', { class: 'kids' });
    list.forEach(function (b, i) { wrap.appendChild(nodeRow(b, list, i)); });
    var add = h('button', { type: 'button', class: 'add', text: '+ ' + t('tree.add_block'), onclick: function (e) { addBlockMenu(e.currentTarget, list, ownerTile); } });
    wrap.appendChild(add);
    return wrap;
  }

  function tileList(block) {
    var wrap = h('div', { class: 'kids' });
    block.tiles.forEach(function (tl, i) { wrap.appendChild(nodeRow(tl, block.tiles, i)); });
    wrap.appendChild(h('button', { type: 'button', class: 'add', text: '+ ' + t(block.kind === 'wine' ? 'tree.add_wine' : 'tree.add_tile'),
      onclick: function () { addTile(block); } }));
    return wrap;
  }

  function nodeRow(node, list, index) {
    var k = kindOf(node);
    var kidsFn = null;
    if (k === 'tiles') kidsFn = function () { return tileList(node); };
    if (k === 'tile' && info(node).level === 0) kidsFn = function () { return blockList(node.blocks, node); };
    if (k === 'tabs') kidsFn = function () { return tabList(node); };
    if (k === 'tab') kidsFn = function () { return blockList(node.blocks, null); };
    var key = keyOf(node);
    var isOpen = !!S.open[key];
    var fixed = k === 'tabs'; // блок Табы всегда последний: не перетаскивается
    var miss = missingLangs(node);
    var box = h('div', { class: 'node' });
    var photoDot = (k === 'tile' || k === 'wine') ? h('span', { class: 'dot' + (node.photo ? ' is-on' : ''), title: node.photo ? t('tree.has_photo') : t('tree.no_photo') }) : null;
    var row = h('div', {
      class: 'row' + (S.sel === key ? ' is-sel' : '') + (node.hidden ? ' is-hidden' : '') + (hasErr(key) ? ' has-err' : ''),
      draggable: fixed ? null : 'true', tabindex: '0', role: 'button', 'data-id': key,
      onclick: function () { select(key); }, onkeydown: enterClick
    }, [
      fixed ? h('span', { class: 'row__sp' }) : h('span', { class: 'row__drag', title: t('tree.drag'), text: '⋮⋮' }),
      kidsFn ? h('button', { type: 'button', class: 'row__tog', 'aria-expanded': isOpen ? 'true' : 'false', text: isOpen ? '▾' : '▸',
        onclick: function (e) { e.stopPropagation(); S.open[key] = !isOpen; renderTree(); } }) : photoDot || h('span', { class: 'row__sp' }),
      h('span', { class: 'row__main' }, [
        h('span', { class: 'row__lb' }, [h('b', { text: TYPE_LABEL(node) }), rowTitle(node) ? ' «' + rowTitle(node) + '»' : '']),
        rowTag(node) || miss.length ? h('span', { class: 'row__sub' }, [rowTag(node), miss.length ? h('span', { class: 'row__miss', text: (rowTag(node) ? ' · ' : '') + t('tree.no_translation', { langs: miss.join(', ').toUpperCase() }) }) : null]) : null
      ]),
      h('button', { type: 'button', class: 'row__eye', title: node.hidden ? t('tree.show') : t('tree.hide'), text: node.hidden ? '◌' : '◉',
        onclick: function (e) { e.stopPropagation(); node.hidden = !node.hidden; changed(); renderForm(); } }),
      h('button', { type: 'button', class: 'row__x', title: t('tree.delete'), text: '✕',
        onclick: function (e) { e.stopPropagation(); removeNode(node); } })
    ]);
    if (!fixed) dragSetup(row, list, index);
    box.appendChild(row);
    if (kidsFn && isOpen) box.appendChild(kidsFn());
    return box;
  }

  // Перетаскивание — только внутри своего родителя (раздел 10.3).
  var drag = null;
  function dragSetup(row, list, index) {
    row.addEventListener('dragstart', function (e) { drag = { list: list, index: index }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); row.classList.add('is-drag'); });
    row.addEventListener('dragend', function () { drag = null; row.classList.remove('is-drag'); clearDrop(); });
    row.addEventListener('dragover', function (e) {
      if (!drag || drag.list !== list) return;
      e.preventDefault();
      clearDrop();
      var r = row.getBoundingClientRect();
      row.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    });
    row.addEventListener('drop', function (e) {
      if (!drag || drag.list !== list) return;
      e.preventDefault();
      var r = row.getBoundingClientRect();
      var to = index + (e.clientY < r.top + r.height / 2 ? 0 : 1);
      var item = list.splice(drag.index, 1)[0];
      if (drag.index < to) to -= 1;
      list.splice(to, 0, item);
      keepTabsLast(list);
      drag = null;
      changed();
    });
  }
  function clearDrop() {
    document.querySelectorAll('.drop-before, .drop-after').forEach(function (el) { el.classList.remove('drop-before', 'drop-after'); });
  }

  /* ---------------------------------------------------------------- добавить и удалить */

  var BLOCK_TYPES = ['text', 'photo', 'tiles', 'map', 'pay', 'service', 'tabs'];
  function keepTabsLast(list) {
    var i = list.findIndex(function (b) { return b.type === 'tabs'; });
    if (i >= 0 && i !== list.length - 1) list.push(list.splice(i, 1)[0]);
  }
  function addBlockMenu(anchor, list, ownerTile) {
    closeMenus();
    var menu = h('div', { class: 'menu', role: 'menu' });
    BLOCK_TYPES.forEach(function (type) {
      var taken = (type === 'map' || type === 'pay') && list.some(function (b) { return b.type === type; });
      var why = taken ? t('add.taken') : t('add.hint.' + type);
      if (type === 'tabs') {
        if (list !== S.site.blocks) { taken = true; why = t('add.only_home'); }
        else if (tabsBlock()) { taken = true; why = t('add.taken_site'); }
      }
      var item = h('button', { type: 'button', role: 'menuitem', disabled: taken, onclick: function () { closeMenus(); if (type === 'tabs') addTabsBlock(); else addBlock(list, type, ownerTile); } }, [
        h('b', { text: t('type.' + type) }), h('small', { text: why })
      ]);
      menu.appendChild(item);
    });
    anchor.after(menu);
    setTimeout(function () { document.addEventListener('click', closeMenus, { once: true }); });
  }
  function closeMenus() { document.querySelectorAll('.menu').forEach(function (m) { m.remove(); }); }

  function emptyBlock(type) {
    var b = { id: newId(), type: type, hidden: false };
    if (type === 'text') Object.assign(b, { eyebrow: {}, title: {}, title_size: 'm', subtitle: {}, text: {}, body_size: 'normal' });
    if (type === 'photo') Object.assign(b, { photo: null, caption: {}, aspect: '3:2', width: 'full' });
    if (type === 'tiles') Object.assign(b, { title: {}, size: 'large', aspect: '4:5', kind: 'normal', tiles: [] });
    if (type === 'map') Object.assign(b, { title: {} });
    if (type === 'pay') Object.assign(b, { title: {}, text: {}, button: {}, recipient: {}, methods: [] });
    if (type === 'service') Object.assign(b, { title: {}, text: {}, price: null, price_note: {}, button: obj(t('default.order_button')), url: '', recipient: {} });
    return b;
  }
  function obj(v) { var o = {}; o[mainLang()] = v; return o; }

  function addBlock(list, type, ownerTile) {
    var b = emptyBlock(type);
    list.push(b);
    keepTabsLast(list); // на главной новый блок встаёт перед Табами
    if (ownerTile) S.open[ownerTile.id] = true;
    changed();
    select(String(b.id));
  }

  // Новый таб — с настройками сайта (раздел 10.4).
  function newTab(title, hidden) {
    var s = S.site.settings;
    return { id: newId(), slug: '', title: obj(title), hidden: hidden, currency: s.currency, req_format: s.req_format,
             operator: s.operator, maps: s.maps, show_prices: s.show_prices, blocks: [] };
  }

  // Блок Табы на главную: блоки главной — первым табом (по умолчанию) или общими над табами (раздел 10.4).
  function addTabsBlock() {
    var home = S.site.blocks;
    var first = newTab(t('default.new_tab'), false);
    var finish = function (move) {
      if (move) { first.blocks = home.splice(0, home.length); }
      var b = { id: newId(), type: 'tabs', hidden: false, tabs: [first] };
      home.push(b);
      S.open[b.id] = true;
      changed();
      select('t' + first.id);
    };
    if (!home.length) { finish(false); return; }
    choiceBox(t('tabs.add_title'), t('tabs.add_hint'), [[t('tabs.add_move'), true], [t('tabs.add_keep'), false]]).then(function (v) {
      if (v !== null) finish(v);
    });
  }

  function addTab(block) {
    var tb = newTab(t('default.new_tab'), true);
    block.tabs.push(tb);
    S.open[block.id] = true;
    changed();
    select('t' + tb.id);
    flash(t('tab.created_hidden'), 'warn');
  }

  function addTile(block) {
    var wine = block.kind === 'wine';
    var tl = { id: newId(), hidden: false, title: obj(t(wine ? 'default.new_wine' : 'default.new_tile')), subtitle: {}, text: {}, photo: null };
    if (wine) Object.assign(tl, { grape: {}, vintage: null, wine_color: null, wine_sweet: null, price: null });
    else Object.assign(tl, { place: {}, lat: null, lng: null, as_page: false, seo_title: {}, seo_description: {}, blocks: [] });
    block.tiles.push(tl);
    S.open[block.id] = true;
    changed();
    select(String(tl.id));
  }

  function countInside(node) {
    var n = 0;
    (node.tabs || []).forEach(function (tb) { n += 1 + countInside(tb); });
    (node.tiles || []).forEach(function (tl) { n += 1 + countInside(tl); });
    (node.blocks || []).forEach(function (b) { n += 1 + countInside(b); });
    return n;
  }

  function removeNode(node) {
    var k = kindOf(node);
    // Блок Табы удаляется, только когда таб один: его лента становится лентой главной (раздел 10.4).
    if (k === 'tabs' && node.tabs.length > 1) { alertBox(t('tabs.delete_many')); return; }
    var name = rowTitle(node) || TYPE_LABEL(node);
    var inside = k === 'tabs' ? 0 : countInside(node);
    var msg = inside ? t('delete.confirm_all', { name: name, n: inside }) : t('delete.confirm', { name: name });
    var hint = k === 'tabs' && node.tabs.length ? t('tabs.delete_one') : t('delete.hint');
    confirmBox(msg, hint, t('tree.delete'), true).then(function (ok) {
      if (!ok) return;
      var i = info(node);
      var at = i.list.indexOf(node);
      i.list.splice(at, 1);
      if (k === 'tabs' && node.tabs.length) {
        var tb = node.tabs[0], s = S.site.settings;
        Array.prototype.push.apply(S.site.blocks, tb.blocks);
        ['currency', 'req_format', 'operator', 'maps', 'show_prices'].forEach(function (f) { s[f] = tb[f]; });
      }
      // Адрес удалённого таба показывает весь сайт.
      var gone = k === 'tabs' ? node.tabs : (k === 'tab' ? [node] : []);
      S.site.domains.forEach(function (d) { if (gone.some(function (tb) { return String(tb.id) === String(d.tab); })) d.tab = null; });
      if (S.sel === i.key) S.sel = i.tile ? keyOf(i.tile) : (i.block ? keyOf(i.block) : (i.tab ? keyOf(i.tab) : 'header'));
      changed();
      renderForm();
    });
  }

  /* ---------------------------------------------------------------- выбор */

  function select(key) {
    S.sel = String(key);
    openParents(IDX[isNaN(+key) ? key : +key] || IDX[key]);
    renderTree();
    renderForm();
    var path = previewPathFor(key);
    if (path !== S.pvPath) { S.pvPath = path; S.scrollY = 0; loadPreview(); }
    else highlight();
  }

  // Раскрыть в дереве родителей выбранного: блок, плитку, таб и блок Табы.
  function openParents(i) {
    if (!i) return;
    if (i.block) S.open[keyOf(i.block)] = true;
    if (i.tile) { S.open[keyOf(i.tile)] = true; openParents(info(i.tile)); return; }
    if (i.kind !== 'tab' && i.tab) { S.open[keyOf(i.tab)] = true; openParents(info(i.tab)); }
  }

  function selected() {
    var k = S.sel;
    var i = IDX[k] || IDX[+k];
    return i ? i.node : null;
  }

  /* ---------------------------------------------------------------- формы */

  function renderForm() {
    var root = $('[data-form]');
    var keep = root.scrollTop;
    root.innerHTML = '';
    if (S.errors.length || S.warnings.length) root.appendChild(problemList());
    var k = S.sel;
    if (k === 'launch') formLaunch(root);
    else if (k === 'header') formHeader(root);
    else if (k === 'footer') formFooter(root);
    else if (k.indexOf('set:') === 0) FORMS_SET[k.slice(4)](root);
    else {
      var node = selected();
      if (!node) { S.sel = 'set:main'; return renderForm(); }
      formElement(root, node);
    }
    root.scrollTop = keep;
  }

  function problemList() {
    var box = h('div', { class: 'probs' });
    if (S.errors.length) {
      box.appendChild(h('b', { class: 'probs__h probs__h--err', text: t('save.errors_title') }));
      S.errors.forEach(function (er) { box.appendChild(problemItem(er, true)); });
    }
    if (S.warnings.length) {
      var det = h('details', { class: 'probs__warn', open: !S.errors.length && S.warnings.length < 6 }, [
        h('summary', { text: t('save.warnings_title', { n: S.warnings.length }) })
      ]);
      S.warnings.forEach(function (w) { det.appendChild(problemItem(w, false)); });
      box.appendChild(det);
    }
    return box;
  }

  function errKey(er) {
    var id = er.id;
    if (id === 'settings') return 'set:main';
    if (id === 'social') return 'set:social';
    if (id === 'operators') return 'set:operators';
    if (id === 'languages') return 'set:langs';
    if (id === 'domains') return 'set:domains';
    if (id === 'mail' || id === 'advanced' || id === 'design') return 'set:' + id;
    if (typeof id === 'string' && id.indexOf('tab:') === 0) return String(clientId('t' + id.slice(4)));
    return id == null ? '' : String(clientId(id));
  }

  function problemText(er) {
    var node = IDX[errKey(er)] ? IDX[errKey(er)].node : null;
    var where = node ? (TYPE_LABEL(node) + (rowTitle(node) ? ' «' + rowTitle(node) + '»' : '')) : (er.id && String(er.id).indexOf('set') !== 0 ? t('set.' + errKey(er).slice(4)) : '');
    var msg = t(er.code, { n: er.n, langs: (er.langs || []).join(', ').toUpperCase() });
    if (er.field && ['err.service_url', 'err.coords'].indexOf(er.code) < 0) msg = t('field.' + er.field) + ': ' + msg;
    if (er.lang && multi()) msg += ' (' + er.lang.toUpperCase() + ')';
    return (where ? where + ' — ' : '') + msg;
  }

  function problemItem(er, isErr) {
    return h('button', { type: 'button', class: 'probs__i' + (isErr ? ' is-err' : ''), text: problemText(er), onclick: function () {
      if (er.lang && langs().indexOf(er.lang) >= 0) S.lang = er.lang;
      var key = errKey(er);
      if (key) select(key);
    } });
  }

  function formHead(root, title, path, node) {
    var head = h('div', { class: 'fhead' }, [
      path ? h('div', { class: 'fhead__path', text: path }) : null,
      h('h2', { text: title })
    ]);
    if (node) {
      head.appendChild(toggle(t('form.show'), !node.hidden, function (v) { node.hidden = !v; changed(); renderTree(); }));
    }
    root.appendChild(head);
  }

  function langTabs(root, node) {
    if (!multi()) return;
    var miss = node ? missingLangs(node) : [];
    var bar = h('div', { class: 'ltabs', role: 'tablist' });
    langs().forEach(function (l) {
      bar.appendChild(h('button', { type: 'button', role: 'tab', class: 'ltabs__t' + (S.lang === l ? ' is-on' : ''), 'aria-selected': S.lang === l ? 'true' : 'false',
        onclick: function () { S.lang = l; if (S.pvLang !== l) { S.pvLang = l; renderPreviewBar(); loadPreview(); } renderForm(); renderTree(); } },
        [l.toUpperCase(), miss.indexOf(l) >= 0 ? h('span', { class: 'ltabs__dot', title: t('form.no_translation_dot') }) : null]));
    });
    root.appendChild(bar);
    if (miss.indexOf(S.lang) >= 0) root.appendChild(h('p', { class: 'hint hint--warn', text: t('form.no_translation', { lang: S.lang.toUpperCase() }) }));
  }

  // Текстовое поле на языке вкладки, со счётчиком «N / макс» (раздел 10.5).
  function textField(node, key, label, max, opts) {
    opts = opts || {};
    if (!node[key] || typeof node[key] !== 'object' || Array.isArray(node[key])) node[key] = {};
    var val = node[key][S.lang] || '';
    var input = opts.area
      ? h('textarea', { rows: opts.rows || 5, 'data-field': key })
      : h('input', { type: 'text', 'data-field': key, placeholder: opts.placeholder || null });
    input.value = val;
    var count = max ? h('span', { class: 'cnt' }) : null;
    function upd() {
      if (count) {
        var n = input.value.length;
        count.textContent = n + ' / ' + max;
        count.classList.toggle('is-over', n > max);
      }
    }
    input.addEventListener('input', function () {
      if (input.value === '') delete node[key][S.lang]; else node[key][S.lang] = input.value;
      upd();
      changed();
      if (opts.onInput) opts.onInput();
    });
    upd();
    return field(label, input, opts.hint, count, fieldErr(node, key));
  }

  function fieldErr(node, key) {
    var nk = node && info(node) ? keyOf(node) : String(node && node.id);
    var er = S.errors.filter(function (e) { return errKey(e) === nk && e.field === key && (!e.lang || e.lang === S.lang); })[0];
    return er ? t(er.code, { n: er.n }) : null;
  }

  function field(label, control, hint, extra, err) {
    var lab = h('label', { class: 'fld' + (err ? ' has-err' : '') }, [
      h('span', { class: 'fld__l' }, [label, extra || null]),
      control,
      hint ? h('small', { class: 'hint', text: hint }) : null,
      err ? h('small', { class: 'hint hint--err', text: err }) : null
    ]);
    return lab;
  }

  function plainField(node, key, label, opts) {
    opts = opts || {};
    var input = h('input', { type: opts.type || 'text', inputmode: opts.inputmode || null, placeholder: opts.placeholder || null, 'data-field': key });
    input.value = node[key] == null ? '' : node[key];
    input.addEventListener('input', function () {
      var v = input.value;
      if (opts.number) v = v.trim() === '' ? null : v.trim().replace(',', '.');
      node[key] = v;
      changed();
      if (opts.onInput) opts.onInput();
    });
    return field(label, input, opts.hint, null, fieldErr(node, key));
  }

  function seg(label, options, value, onChange, hint) {
    var box = h('div', { class: 'seg', role: 'radiogroup' });
    options.forEach(function (o) {
      box.appendChild(h('button', { type: 'button', role: 'radio', class: 'seg__o' + (o[0] === value ? ' is-on' : ''), 'aria-checked': o[0] === value ? 'true' : 'false',
        onclick: function () { onChange(o[0]); } }, [o[1]]));
    });
    return h('div', { class: 'fld' }, [h('span', { class: 'fld__l', text: label }), box, hint ? h('small', { class: 'hint', text: hint }) : null]);
  }

  function select_(label, options, value, onChange, hint) {
    var sel = h('select', {});
    options.forEach(function (o) { var op = h('option', { value: o[0] == null ? '' : o[0], text: o[1] }); if (String(o[0]) === String(value == null ? '' : value)) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { onChange(sel.value === '' ? null : sel.value); });
    return field(label, sel, hint);
  }

  function toggle(label, on, onChange, hint) {
    var input = h('input', { type: 'checkbox', class: 'sw__i' });
    input.checked = !!on;
    input.addEventListener('change', function () { onChange(input.checked); });
    return h('label', { class: 'sw' }, [input, h('span', { class: 'sw__track' }), h('span', { class: 'sw__l', text: label }), hint ? h('small', { class: 'hint', text: hint }) : null]);
  }

  function section(title) { return h('h3', { class: 'fsec', text: title }); }

  function pathOf(node) {
    var parts = [t('tree.home')];
    var i = info(node);
    if (i && i.tab && i.kind !== 'tab') parts.push(txAny(i.tab.title) || t('type.tab'));
    if (i && i.tile) parts.push(txAny(i.tile.title) || t('type.tile'));
    return parts.join(' / ');
  }

  function formElement(root, node) {
    var k = kindOf(node);
    formHead(root, TYPE_LABEL(node), pathOf(node), node);
    if ((TEXT_FIELDS[k] || []).length) langTabs(root, node);
    var M = S.meta.max[k] || {};
    var f = h('div', { class: 'fbody' });
    root.appendChild(f);
    FORMS[k](f, node, M);
    var del = k === 'tab' ? t('tab.delete_all', { n: countInside(node) }) : t('tree.delete');
    root.appendChild(h('div', { class: 'ffoot' }, [h('button', { type: 'button', class: 'btn btn--danger', text: del, onclick: function () { removeNode(node); } })]));
  }

  var FORMS = {
    text: function (f, b, M) {
      f.appendChild(textField(b, 'eyebrow', t('field.eyebrow'), M.eyebrow));
      f.appendChild(textField(b, 'title', t('field.title'), M.title));
      f.appendChild(seg(t('field.title_size'), [['l', t('size.l')], ['m', t('size.m')], ['s', t('size.s')]], b.title_size, function (v) { b.title_size = v; changed(); renderForm(); }));
      f.appendChild(textField(b, 'subtitle', t('field.subtitle'), M.subtitle));
      f.appendChild(textField(b, 'text', t('field.text'), M.text, { area: true, rows: 8, hint: t('hint.paragraphs') }));
      f.appendChild(seg(t('field.body_size'), [['lead', t('size.lead')], ['normal', t('size.normal')], ['small', t('size.small')]], b.body_size, function (v) { b.body_size = v; changed(); renderForm(); }));
    },
    photo: function (f, b, M) {
      f.appendChild(photoField(b, 'photo', b.aspect || '3:2'));
      f.appendChild(textField(b, 'caption', t('field.caption'), M.caption));
      f.appendChild(seg(t('field.frame'), [['3:2', t('frame.3:2')], ['4:5', t('frame.4:5')]], b.aspect, function (v) {
        if (b.photo && b.aspect !== v) { b.photo.crop = null; b.photo._thumb = null; }
        b.aspect = v; changed(); renderForm();
      }, b.photo ? t('hint.frame_change') : null));
      f.appendChild(seg(t('field.width'), [['full', t('width.full')], ['narrow', t('width.narrow')]], b.width, function (v) { b.width = v; changed(); renderForm(); }));
    },
    tiles: function (f, b, M) {
      f.appendChild(textField(b, 'title', t('field.block_title'), M.title, { hint: t('hint.block_title') }));
      f.appendChild(seg(t('field.kind'), [['normal', t('kind.normal')], ['wine', t('kind.wine')]], b.kind, function (v) {
        b.kind = v;
        if (v === 'wine') { b.aspect = '4:5'; b.size = 'compact'; }
        b.tiles.forEach(function (tl) { if (tl.photo) { tl.photo.crop = null; tl.photo._thumb = null; } });
        changed(); renderForm();
      }, b.tiles.length ? t('hint.kind_change') : null));
      f.appendChild(seg(t('field.size'), [['large', t('size.tiles_large')], ['compact', t('size.tiles_compact')]], b.size, function (v) { b.size = v; changed(); renderForm(); }));
      if (b.kind === 'wine') f.appendChild(h('p', { class: 'hint', text: t('hint.wine_frame') }));
      else f.appendChild(seg(t('field.frame'), [['4:5', t('frame.4:5')], ['3:2', t('frame.3:2')]], b.aspect, function (v) {
        if (v === b.aspect) return;
        b.aspect = v;
        b.tiles.forEach(function (tl) { if (tl.photo) { tl.photo.crop = null; tl.photo._thumb = null; } });
        changed(); renderForm();
      }, t('hint.frame_change')));
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t(b.kind === 'wine' ? 'tree.add_wine' : 'tree.add_tile'), onclick: function () { addTile(b); } }));
    },
    tile: function (f, tl, M) {
      var i = info(tl);
      var aspect = i.block.aspect || '4:5';
      f.appendChild(photoField(tl, 'photo', aspect));
      f.appendChild(textField(tl, 'title', t('field.name'), M.title));
      f.appendChild(textField(tl, 'subtitle', t('field.tile_subtitle'), M.subtitle, { hint: t('hint.tile_subtitle') }));
      var o = opens(tl);
      f.appendChild(textField(tl, 'text', t('field.text'), M.text, { area: true, rows: 7, hint: o === 'page' || o === 'static' ? t('hint.text_page') : t('hint.text_popup') }));
      f.appendChild(section(t('sec.place')));
      f.appendChild(textField(tl, 'place', t('field.place'), M.place));
      var two = h('div', { class: 'two' }, [
        plainField(tl, 'lat', t('field.lat'), { number: true, inputmode: 'decimal', placeholder: '42.0325' }),
        plainField(tl, 'lng', t('field.lng'), { number: true, inputmode: 'decimal', placeholder: '45.3771' })
      ]);
      f.appendChild(two);
      var mapLink = hasCoords(tl) ? h('a', { href: 'https://www.openstreetmap.org/?mlat=' + encodeURIComponent(tl.lat) + '&mlon=' + encodeURIComponent(tl.lng) + '#map=14/' + encodeURIComponent(tl.lat) + '/' + encodeURIComponent(tl.lng), target: '_blank', rel: 'noopener', text: t('field.check_map') }) : null;
      f.appendChild(h('p', { class: 'hint' }, [t('hint.coords'), mapLink ? ' · ' : '', mapLink]));
      f.appendChild(section(t('sec.opens')));
      if (i.level === 0) {
        f.appendChild(toggle(t('field.as_page'), tl.as_page, function (v) { tl.as_page = v; changed(); renderForm(); }));
      }
      f.appendChild(h('p', { class: 'opens' }, [t('form.opens_now') + ' ', h('b', { text: t('opens.' + (o || 'none')) })]));
      if (o === 'page' || o === 'static') {
        f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('form.go_page'), onclick: function () {
          S.open[tl.id] = true; S.pvPath = tabPrefix(i.tab) + '/' + slugOf(tl); S.scrollY = 0; renderTree(); loadPreview();
        } }));
        if (tl.photo) f.appendChild(headPhotoField(tl));
      } else if (o === 'popup') {
        f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('form.show_popup'), onclick: function () { S.pvPath = popupPath(tl); S.scrollY = 0; loadPreview(); } }));
      }
      f.appendChild(seoBox(tl, M));
    },
    wine: function (f, tl, M) {
      f.appendChild(photoField(tl, 'photo', '4:5', true));
      f.appendChild(textField(tl, 'title', t('field.name'), M.title));
      f.appendChild(textField(tl, 'subtitle', t('field.wine_subtitle'), M.subtitle, { hint: t('hint.wine_subtitle') }));
      f.appendChild(h('div', { class: 'two' }, [
        select_(t('field.wine_sweet'), [[null, '—']].concat(['dry', 'semidry', 'semisweet', 'sweet'].map(function (k) { return [k, t('wine.sweet.' + k)]; })), tl.wine_sweet, function (v) { tl.wine_sweet = v; changed(); }),
        select_(t('field.wine_color'), [[null, '—']].concat(['red', 'white', 'rose', 'amber'].map(function (k) { return [k, t('wine.color.' + k)]; })), tl.wine_color, function (v) { tl.wine_color = v; changed(); })
      ]));
      f.appendChild(textField(tl, 'grape', t('field.grape'), M.grape));
      f.appendChild(h('div', { class: 'two' }, [
        plainField(tl, 'vintage', t('field.vintage'), { number: true, inputmode: 'numeric', placeholder: '2019' }),
        plainField(tl, 'price', t('field.price') + ' (' + feedOf(tl).currency + ')', { number: true, inputmode: 'decimal', hint: feedOf(tl).show_prices ? t('hint.price_on') : t('hint.price_off') })
      ]));
      f.appendChild(textField(tl, 'text', t('field.wine_text'), M.text, { area: true, rows: 6, hint: t('hint.wine_text') }));
    },
    tabs: function (f, b) {
      f.appendChild(h('p', { class: 'hint', text: t('hint.tabs') }));
      var ul = h('ul', { class: 'plist' });
      b.tabs.forEach(function (tb) {
        ul.appendChild(h('li', {}, [h('button', { type: 'button', class: 'linkbtn', text: (txAny(tb.title) || t('type.tab')) + (tb.hidden ? ' · ' + t('tab.hidden') : ''), onclick: function () { select('t' + tb.id); } })]));
      });
      f.appendChild(ul);
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t('tree.add_tab'), onclick: function () { addTab(b); } }));
      f.appendChild(section(t('sec.tab_import')));
      f.appendChild(fileButton(t('tab.import'), '.zip,application/zip', function (file) {
        var fd = new FormData();
        fd.append('file', file);
        setBusy(t('transfer.reading'));
        api('POST', 'import_tab', fd, true).then(function (j) {
          setBusy(null);
          if (!j.tab) { alertBox(importError(j)); return; }
          addImportedTab(b, j);
        }).catch(function () { setBusy(null); alertBox(t('transfer.failed')); });
      }, t('hint.tab_import')));
    },
    tab: function (f, tb, M) {
      var isNew = typeof tb.id !== 'number';
      f.appendChild(textField(tb, 'title', t('field.tab_title'), M.title, { hint: t('hint.tab_title') }));
      var slugIn = h('input', { type: 'text', 'data-field': 'slug', maxlength: '40', readonly: !isNew, placeholder: slugify(tx(tb.title, mainLang())) });
      slugIn.value = isNew ? (tb.slug || '') : tb.slug;
      slugIn.addEventListener('input', function () { tb.slug = slugIn.value.trim().toLowerCase(); changed(); });
      f.appendChild(field(t('field.slug'), slugIn, isNew ? t('hint.slug_new') : t('hint.slug_fixed'), null, fieldErr(tb, 'slug')));
      f.appendChild(section(t('sec.money')));
      feedFields(f, tb);
      f.appendChild(h('p', { class: 'hint' }, [t('hint.tab_domain') + ' ', h('button', { type: 'button', class: 'linkbtn', text: t('set.domains'), onclick: function () { select('set:domains'); } })]));
      f.appendChild(section(t('sec.tab_export')));
      if (isNew) f.appendChild(h('p', { class: 'hint', text: t('hint.tab_export_unsaved') }));
      else f.appendChild(h('a', { class: 'btn btn--ghost', href: '/admin/api/export?tab=' + tb.id, text: t('tab.export') }));
    },
    map: function (f, b, M) {
      f.appendChild(textField(b, 'title', t('field.title'), M.title));
      var pts = mapPoints(b);
      f.appendChild(h('p', { class: 'hint', text: t('hint.map', { n: pts.length }) }));
      var ul = h('ul', { class: 'plist' });
      pts.forEach(function (tl) { ul.appendChild(h('li', {}, [h('button', { type: 'button', class: 'linkbtn', text: txAny(tl.title) || '—', onclick: function () { select(String(tl.id)); } })])); });
      f.appendChild(ul);
    },
    pay: function (f, b, M) {
      f.appendChild(h('p', { class: 'hint', text: t('hint.pay_one') }));
      f.appendChild(textField(b, 'title', t('field.title'), M.title, { placeholder: t('ph.pay_title') }));
      f.appendChild(textField(b, 'text', t('field.text'), M.text, { area: true, rows: 3 }));
      f.appendChild(textField(b, 'button', t('field.button'), M.button, { placeholder: t('ph.pay_button') }));
      f.appendChild(textField(b, 'recipient', t('field.recipient'), M.recipient, { hint: t('hint.recipient') }));
      f.appendChild(section(t('sec.methods')));
      f.appendChild(methodsEditor(b));
    },
    service: function (f, b, M) {
      f.appendChild(textField(b, 'title', t('field.title'), M.title, { placeholder: t('ph.service_title') }));
      f.appendChild(textField(b, 'text', t('field.text'), M.text, { area: true, rows: 4 }));
      f.appendChild(h('div', { class: 'two' }, [
        plainField(b, 'price', t('field.price') + ' (' + feedOf(b).currency + ')', { number: true, inputmode: 'decimal', hint: t('hint.price_empty') }),
        textField(b, 'price_note', t('field.price_note'), M.price_note, { placeholder: t('ph.price_note') })
      ]));
      f.appendChild(textField(b, 'button', t('field.button'), M.button));
      f.appendChild(plainField(b, 'url', t('field.pay_url'), { type: 'url', placeholder: 'https://', hint: t('hint.service_url') }));
      f.appendChild(textField(b, 'recipient', t('field.service_by'), M.recipient));
    }
  };

  function seoBox(node, M) {
    var det = h('details', { class: 'seo' }, [h('summary', { text: t('sec.seo') })]);
    det.appendChild(textField(node, 'seo_title', t('field.seo_title'), M.seo_title, { placeholder: txAny(node.title) }));
    det.appendChild(textField(node, 'seo_description', t('field.seo_description'), M.seo_description, { area: true, rows: 3 }));
    if (tx(node.seo_title) || tx(node.seo_description)) det.open = true;
    return det;
  }

  function mapPoints(b) {
    var i = info(b);
    var blocks = i.tile ? i.tile.blocks : (i.tab ? i.tab.blocks : S.site.blocks);
    var out = [];
    blocks.forEach(function (bl) {
      if (bl.type !== 'tiles' || bl.hidden) return;
      bl.tiles.forEach(function (tl) {
        if (tl.hidden) return;
        if (hasCoords(tl)) out.push(tl);
        if (!i.tile) (tl.blocks || []).forEach(function (b2) {
          if (b2.type === 'tiles' && !b2.hidden) b2.tiles.forEach(function (t2) { if (!t2.hidden && hasCoords(t2)) out.push(t2); });
        });
      });
    });
    return out;
  }

  function popupPath(tl) {
    var i = info(tl);
    return tabPrefix(i.tab) + (i.tile ? '/' + slugOf(i.tile) : '') + '/' + (slugOf(tl) || '');
  }

  /* ---------------------------------------------------------------- шапка, подвал, настройки */

  function formHeader(root) {
    var hd = S.site.header;
    formHead(root, t('tree.header'), t('tree.all_pages'));
    root.appendChild(toggle(t('form.show'), hd.show, function (v) { hd.show = v; changed(); }));
    langTabs(root, null);
    var f = h('div', { class: 'fbody' });
    f.appendChild(textField(S.site.settings, 'site_title', t('field.site_title'), S.meta.max.settings.site_title, { onInput: function () { $('[data-site-name]').textContent = txAny(S.site.settings.site_title); } }));
    var n = 0;
    var tb = tabsBlock(), first = tb && !tb.hidden && tb.tabs.filter(function (x) { return !x.hidden; })[0];
    S.site.blocks.concat(first ? first.blocks : []).forEach(function (b) { if (b.type === 'tiles' && !b.hidden && b.kind !== 'wine') b.tiles.forEach(function (tl) { if (!tl.hidden && opens(tl)) n++; }); });
    var shown = hd.burger === 'on' ? n > 0 : hd.burger === 'off' ? false : n > 6;
    f.appendChild(seg(t('field.burger'), [['auto', t('burger.auto')], ['on', t('burger.on')], ['off', t('burger.off')]], hd.burger, function (v) { hd.burger = v; changed(); renderForm(); },
      t(shown ? 'hint.burger_shown' : 'hint.burger_hidden', { n: n })));
    root.appendChild(f);
  }

  function formFooter(root) {
    var ft = S.site.footer;
    formHead(root, t('tree.footer'), t('tree.all_pages'));
    root.appendChild(toggle(t('form.show'), ft.show, function (v) { ft.show = v; changed(); }));
    var f = h('div', { class: 'fbody' });
    f.appendChild(plainField(ft, 'email', t('field.email'), { type: 'email' }));
    f.appendChild(plainField(ft, 'phone', t('field.phone'), { type: 'tel', placeholder: '+995 …' }));
    f.appendChild(h('p', { class: 'hint' }, [t('hint.footer_more') + ' ', h('button', { type: 'button', class: 'linkbtn', text: t('set.social'), onclick: function () { select('set:social'); } }), ', ',
      h('button', { type: 'button', class: 'linkbtn', text: t('set.operators'), onclick: function () { select('set:operators'); } }), ', ',
      h('button', { type: 'button', class: 'linkbtn', text: t('set.docs'), onclick: function () { select('set:docs'); } })]));
    root.appendChild(f);
  }

  // Настройки «страны» ленты: у сайта без табов и у каждого таба одинаковые (раздел 3.4).
  function feedFields(f, s) {
    f.appendChild(h('div', { class: 'two' }, [
      select_(t('field.currency'), [['RUB', 'RUB ₽'], ['GEL', 'GEL ₾'], ['EUR', 'EUR €'], ['USD', 'USD $']], s.currency, function (v) { s.currency = v; changed(); }),
      select_(t('field.req_format'), [['RU', t('fmt.RU')], ['GE', t('fmt.GE')], ['other', t('fmt.other')]], s.req_format, function (v) { s.req_format = v; changed(); renderForm(); })
    ]));
    f.appendChild(select_(t('field.operator'), [[null, '—']].concat(S.site.operators.map(function (o) { return [o.id, o.name || '—']; })), s.operator, function (v) {
      s.operator = v === null ? null : (isNaN(+v) ? v : +v); changed();
    }, t('hint.operator')));
    f.appendChild(seg(t('field.maps'), [['google', 'Google'], ['yandex', t('maps.yandex')]], s.maps, function (v) { s.maps = v; changed(); renderForm(); }, t('hint.maps')));
    f.appendChild(toggle(t('field.show_prices'), s.show_prices, function (v) { s.show_prices = v; changed(); }));
  }

  // Slug из названия — так же, как на сервере (раздел 4.4); здесь только подсказка.
  var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y',
    'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l',
    'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh',
    'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h' };
  function slugify(s) {
    return String(s || '').toLowerCase().split('').map(function (c) { return TR[c] != null ? TR[c] : c; }).join('')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  }

  function fileButton(label, accept, onFile, hint) {
    var input = h('input', { type: 'file', accept: accept, hidden: true });
    input.addEventListener('change', function () { var f = input.files[0]; input.value = ''; if (f) onFile(f); });
    return h('div', { class: 'fld' }, [h('button', { type: 'button', class: 'btn btn--ghost', text: label, onclick: function () { input.click(); } }), input,
      hint ? h('small', { class: 'hint', text: hint }) : null]);
  }

  function importError(j) {
    var list = (j.errors || []).map(function (er) { return problemText(er); });
    return list.length ? t('transfer.check_failed') + '\n' + list.slice(0, 8).join('\n') : t(j.error || 'transfer.failed');
  }

  // Загрузить таб: новым скрытым табом; slug с «-2» при совпадении; владелец — если такого ещё нет (раздел 13).
  function addImportedTab(block, j) {
    var tb = j.tab;
    tb.id = newId();
    tb.hidden = true;
    var used = block.tabs.map(tabSlugOf), base = tb.slug || '', sl = base, n = 1;
    while (sl && used.indexOf(sl) >= 0) sl = base + '-' + (++n);
    tb.slug = sl;
    tb.operator = null;
    if (j.operator) {
      var op = S.site.operators.filter(function (o) { return o.name === j.operator.name && (o.tax_id || '') === (j.operator.tax_id || ''); })[0];
      if (!op) { op = Object.assign({}, j.operator, { id: newId() }); S.site.operators.push(op); }
      tb.operator = op.id;
    }
    (function renew(list) {
      list.forEach(function (b) {
        b.id = newId();
        (b.methods || []).forEach(function (m) { m.id = newId(); });
        (b.tiles || []).forEach(function (tl) { tl.id = newId(); delete tl.slug; renew(tl.blocks || []); });
      });
    })(tb.blocks || []);
    block.tabs.push(tb);
    changed();
    select('t' + tb.id);
    flash(t('tab.imported'), 'warn');
  }

  var FORMS_SET = {
    main: function (root) {
      var s = S.site.settings;
      formHead(root, t('set.main'), t('tree.settings'));
      langTabs(root, null);
      var f = h('div', { class: 'fbody' });
      var M = S.meta.max.settings;
      f.appendChild(textField(s, 'site_title', t('field.site_title'), M.site_title));
      f.appendChild(section(t('sec.seo_home')));
      f.appendChild(textField(s, 'seo_title', t('field.seo_title'), M.seo_title));
      f.appendChild(textField(s, 'seo_description', t('field.seo_description'), M.seo_description, { area: true, rows: 3 }));
      f.appendChild(section(t('sec.money')));
      if (tabsBlock()) f.appendChild(h('p', { class: 'hint hint--warn', text: t('hint.main_with_tabs') }));
      feedFields(f, s);
      f.appendChild(toggle(t('field.cookie_notice'), s.cookie_notice, function (v) { s.cookie_notice = v; changed(); }));
      root.appendChild(f);
    },
    langs: function (root) {
      var L = S.site.languages;
      formHead(root, t('set.langs'), t('tree.settings'));
      var f = h('div', { class: 'fbody' });
      f.appendChild(h('p', { class: 'hint', text: t('hint.langs') }));
      Object.keys(S.meta.lang_names).forEach(function (code) {
        var on = L.on.indexOf(code) >= 0;
        var row = h('div', { class: 'lrow' }, [
          toggle(S.meta.lang_names[code] + ' (' + code.toUpperCase() + ')', on, function (v) {
            if (!v) {
              if (code === L.main) { alertBox(t('hint.main_lang_off')); renderForm(); return; }
              confirmBox(t('langs.off_confirm', { lang: S.meta.lang_names[code] }), t('langs.off_hint'), t('langs.off_button'), false).then(function (ok) {
                if (ok) { L.on = L.on.filter(function (c) { return c !== code; }); if (S.lang === code) S.lang = L.main; if (S.pvLang === code) S.pvLang = L.main; changed(); renderAll(); loadPreview(); }
                else renderForm();
              });
              return;
            }
            L.on = Object.keys(S.meta.lang_names).filter(function (c) { return c === code || L.on.indexOf(c) >= 0; });
            changed(); renderAll();
          }),
          on ? h('label', { class: 'lrow__main' }, [h('input', { type: 'radio', name: 'mainlang', checked: L.main === code, onchange: function () { L.main = code; changed(); renderAll(); } }), ' ' + t('langs.main')]) : null
        ]);
        f.appendChild(row);
      });
      root.appendChild(f);
    },
    domains: function (root) {
      formHead(root, t('set.domains'), t('tree.settings'));
      langTabs(root, null);
      var f = h('div', { class: 'fbody' });
      f.appendChild(h('p', { class: 'hint', text: t('hint.domains') }));
      var tb = tabsBlock();
      var shows = [[null, t('domain.all')]].concat(tb ? tb.tabs.map(function (x) { return [x.id, t('domain.only', { tab: txAny(x.title) || '—' })]; }) : []);
      S.site.domains.forEach(function (d, i) {
        if (!d.site_title || typeof d.site_title !== 'object') d.site_title = {};
        var box = h('div', { class: 'card' });
        box.appendChild(plainField(d, 'host', t('field.host'), { placeholder: 'example.ru', onInput: renderPreviewBar }));
        box.appendChild(select_(t('field.domain_shows'), shows, d.tab, function (v) { d.tab = v === null ? null : (isNaN(+v) ? v : +v); changed(); }));
        box.appendChild(textField(d, 'site_title', t('field.domain_title'), S.meta.max.domain.site_title, { placeholder: txAny(S.site.settings.site_title) }));
        box.appendChild(h('button', { type: 'button', class: 'btn btn--danger btn--small', text: t('tree.delete'), onclick: function () {
          S.site.domains.splice(i, 1); changed(); renderForm(); renderPreviewBar();
        } }));
        f.appendChild(box);
      });
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t('domain.add'), onclick: function () {
        S.site.domains.push({ host: '', tab: null, site_title: {} }); changed(); renderForm();
      } }));
      root.appendChild(f);
    },
    transfer: function (root) {
      formHead(root, t('set.transfer'), t('tree.settings'));
      var f = h('div', { class: 'fbody' });
      f.appendChild(section(t('transfer.export')));
      var structure = false;
      f.appendChild(toggle(t('transfer.structure'), false, function (v) { structure = v; }, t('hint.structure')));
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('transfer.export_btn'), onclick: function () {
        location.href = '/admin/api/export' + (structure ? '?structure=1' : '');
      } }));
      f.appendChild(h('p', { class: 'hint' + (S.dirty ? ' hint--warn' : ''), text: S.dirty ? t('hint.export_unsaved') : t('hint.export') }));
      f.appendChild(section(t('transfer.import')));
      f.appendChild(fileButton(t('transfer.import_btn'), '.zip,application/zip', function (file) {
        confirmBox(t('transfer.replace'), t('transfer.replace_hint'), t('transfer.import_btn'), true).then(function (ok) {
          if (!ok) return;
          var fd = new FormData();
          fd.append('file', file);
          setBusy(t('transfer.reading'));
          api('POST', 'import', fd, true).then(function (j) {
            setBusy(null);
            if (!j.ok) { alertBox(importError(j)); return; }
            S.dirty = false;
            location.reload();
          }).catch(function () { setBusy(null); alertBox(t('transfer.failed')); });
        });
      }, t('hint.import')));
      root.appendChild(f);
    },
    operators: function (root) {
      formHead(root, t('set.operators'), t('tree.settings'));
      var f = h('div', { class: 'fbody' });
      f.appendChild(h('p', { class: 'hint', text: t('hint.operators') }));
      S.site.operators.forEach(function (o, i) {
        var box = h('div', { class: 'card' });
        box.appendChild(plainField(o, 'name', t('field.op_name'), { onInput: function () {} }));
        box.appendChild(select_(t('field.op_country'), [['RU', t('country.RU')], ['GE', t('country.GE')], ['other', t('country.other')]], o.country, function (v) { o.country = v; changed(); renderForm(); }));
        box.appendChild(h('div', { class: 'two' }, [
          plainField(o, 'tax_id', t('op.tax_id.' + o.country)),
          o.country === 'RU' ? plainField(o, 'reg_no', t('op.reg_no')) : null
        ]));
        box.appendChild(plainField(o, 'address', t('field.address')));
        box.appendChild(plainField(o, 'email', t('field.email'), { type: 'email' }));
        box.appendChild(h('button', { type: 'button', class: 'btn btn--danger btn--small', text: t('tree.delete'), onclick: function () {
          confirmBox(t('delete.confirm', { name: o.name || t('set.operators') }), '', t('tree.delete'), true).then(function (ok) {
            if (!ok) return;
            S.site.operators.splice(i, 1);
            if (String(S.site.settings.operator) === String(o.id)) S.site.settings.operator = null;
            changed(); renderForm();
          });
        } }));
        f.appendChild(box);
      });
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t('op.add'), onclick: function () {
        S.site.operators.push({ id: newId(), name: '', country: S.site.settings.req_format === 'GE' ? 'GE' : 'RU', tax_id: '', reg_no: '', address: '', email: '' });
        changed(); renderForm();
      } }));
      root.appendChild(f);
    },
    docs: function (root) {
      formHead(root, t('set.docs'), t('tree.settings'));
      langTabs(root, null);
      var f = h('div', { class: 'fbody' });
      f.appendChild(h('p', { class: 'hint', text: t('hint.docs') }));
      ['offer', 'privacy', 'cookies'].forEach(function (k) {
        var d = S.site.docs[k] || (S.site.docs[k] = { show: false, title: {}, body: {} });
        var box = h('div', { class: 'card' }, [h('h3', { class: 'fsec', text: t('doc.' + k) })]);
        box.appendChild(toggle(t('form.show'), d.show, function (v) { d.show = v; changed(); }));
        box.appendChild(textField(d, 'title', t('field.doc_title'), 120, { placeholder: t('doc.' + k) }));
        box.appendChild(textField(d, 'body', t('field.doc_body'), null, { area: true, rows: 8, hint: t('hint.paragraphs') }));
        f.appendChild(box);
      });
      f.appendChild(toggle(t('field.cookie_notice'), S.site.settings.cookie_notice, function (v) { S.site.settings.cookie_notice = v; changed(); }));
      root.appendChild(f);
    },
    social: function (root) {
      formHead(root, t('set.social'), t('tree.settings'));
      var f = h('div', { class: 'fbody' });
      f.appendChild(h('p', { class: 'hint', text: t('hint.social') }));
      var list = S.site.social;
      // Полный список из 13 площадок в порядке на сайте.
      Object.keys(S.meta.social).forEach(function (n) { if (!list.some(function (s) { return s.network === n; })) list.push({ network: n, url: '' }); });
      list.forEach(function (s, i) {
        var input = h('input', { type: 'url', placeholder: 'https://', 'data-field': s.network });
        input.value = s.url || '';
        var ico = h('span', { class: 'soc__ico' + (s.url ? ' is-on' : ''), html: S.meta.social_icons[s.network] || '' });
        input.addEventListener('input', function () { s.url = input.value.trim(); ico.classList.toggle('is-on', !!s.url); changed(); });
        var row = h('div', { class: 'soc', draggable: 'true' }, [
          h('span', { class: 'row__drag', text: '⋮⋮' }), ico, h('span', { class: 'soc__n', text: S.meta.social[s.network] }), input
        ]);
        dragSetup(row, list, i);
        f.appendChild(row);
        var err = S.errors.filter(function (e) { return e.id === 'social' && e.field === s.network; })[0];
        if (err) f.appendChild(h('small', { class: 'hint hint--err soc__note', text: t(err.code) }));
        if (s.network === 'instagram' || s.network === 'facebook') f.appendChild(h('small', { class: 'hint soc__note', text: t('hint.meta') }));
        if (s.network === 'x') f.appendChild(h('small', { class: 'hint soc__note', text: t('hint.x') }));
      });
      root.appendChild(f);
    },
    design: function (root) { formDesign(root); },
    mail: function (root) { formMail(root); },
    backups: function (root) { formBackups(root); },
    advanced: function (root) { formAdvanced(root); },
    update: function (root) { formUpdate(root); }
  };

  /* ---------------------------------------------------------------- настройки установки: почта, счётчик (не выгружаются) */

  function privErr(key) {
    var er = S.errors.filter(function (e) { return (e.id === 'mail' || e.id === 'advanced') && e.field === key; })[0];
    return er ? t(er.code, { n: er.n }) : null;
  }
  function privField(key, label, opts) {
    opts = opts || {};
    var input = h('input', { type: opts.type || 'text', placeholder: opts.placeholder || null, autocomplete: opts.ac || 'off', inputmode: opts.inputmode || null, 'data-field': key });
    input.value = S.priv[key] == null ? '' : S.priv[key];
    input.addEventListener('input', function () { S.priv[key] = input.value; changed(); if (opts.onInput) opts.onInput(); });
    return field(label, input, opts.hint, null, privErr(key));
  }

  /* ---------------------------------------------------------------- Оформление (раздел 10.5) */

  // Загрузка картинки оформления; favicon и картинка для соцсетей сначала кадрируются (Cropper.js).
  function brandUpload(kind, file) {
    function send(blob, name) {
      var fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', blob, name);
      setBusy(t('photo.uploading'));
      return api('POST', 'brand', fd, true).then(function (j) {
        setBusy(null);
        if (!j.url) { alertBox(t(j.error || 'photo.upload_failed')); return null; }
        return j.url;
      }).catch(function () { setBusy(null); alertBox(t('photo.upload_failed')); return null; });
    }
    if (kind === 'logo') {
      if (file.size > 2 * 1024 * 1024) { alertBox(t('brand.too_big')); return Promise.resolve(null); }
      return send(file, file.name);
    }
    var square = kind === 'favicon';
    return cropLocal(file, square ? 1 : 1200 / 630, square ? 512 : 1200, square ? 512 : 630, square ? 512 : 0,
      square ? t('brand.favicon') : t('brand.og')).then(function (blob) {
      return blob ? send(blob, square ? 'icon.png' : 'og.jpg') : null;
    });
  }

  // Кадр для картинки с компьютера: рамка нужной формы, результат — готовый файл нужного размера.
  function cropLocal(file, ratio, outW, outH, minSide, title) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var probe = new Image();
      probe.onerror = function () { URL.revokeObjectURL(url); alertBox(t('photo.bad_type')); resolve(null); };
      probe.onload = function () {
        if (minSide && Math.min(probe.naturalWidth, probe.naturalHeight) < minSide) {
          URL.revokeObjectURL(url); alertBox(t('brand.icon_small')); resolve(null); return;
        }
        var img = h('img', { alt: '', src: url });
        var cropper = null;
        var box = h('div', { class: 'ed ed--small', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
          h('div', { class: 'ed__h' }, [h('h3', { text: title }), h('span', { class: 'ed__frame', text: outW + ' × ' + outH })]),
          h('div', { class: 'ed__b' }, [h('div', { class: 'ed__stage' }, [img])]),
          h('div', { class: 'ed__f' }, [
            h('button', { type: 'button', class: 'btn btn--ghost', text: t('btn.cancel'), onclick: function () { close(null); } }),
            h('button', { type: 'button', class: 'btn btn--action', text: t('btn.apply'), onclick: function () {
              var c = cropper.getCroppedCanvas({ width: outW, height: outH, imageSmoothingQuality: 'high', fillColor: ratio === 1 ? 'transparent' : '#fff' });
              c.toBlob(function (b) { close(b); }, ratio === 1 ? 'image/png' : 'image/jpeg', 0.9);
            } })
          ])
        ]);
        var ov = h('div', { class: 'mo' }, [box]);
        function onKey(e) { if (e.key === 'Escape') close(null); }
        function close(v) { document.removeEventListener('keydown', onKey); if (cropper) cropper.destroy(); ov.remove(); URL.revokeObjectURL(url); resolve(v); }
        document.body.appendChild(ov);
        document.addEventListener('keydown', onKey);
        img.addEventListener('load', function () {
          cropper = new Cropper(img, { aspectRatio: ratio, viewMode: 1, dragMode: 'move', autoCropArea: 1, background: false, zoomOnWheel: true });
        });
      };
      probe.src = url;
    });
  }

  function brandBox(kind, label, hint, imgClass) {
    var s = S.site.settings;
    var cur = s[kind];
    var input = h('input', { type: 'file', accept: kind === 'logo' ? '.png,.svg,.jpg,.jpeg,.webp,image/png,image/svg+xml,image/jpeg,image/webp' : 'image/png,image/jpeg,image/webp', hidden: true });
    input.addEventListener('change', function () {
      var file = input.files[0];
      input.value = '';
      if (!file) return;
      brandUpload(kind, file).then(function (u) {
        if (!u) return;
        s[kind] = Object.assign({}, s[kind] || (kind === 'logo' ? { with_title: true } : {}), { url: u });
        changed(); renderForm();
      });
    });
    var view = cur && cur.url ? h('img', { class: 'brand__img ' + imgClass, alt: '', src: cur.url }) : h('span', { class: 'brand__none ' + imgClass, text: t('photo.none') });
    return h('div', { class: 'fld brand' }, [
      h('span', { class: 'fld__l', text: label }),
      h('div', { class: 'brand__row' }, [view, h('div', { class: 'ph__acts' }, [
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: cur ? t('photo.replace') : t('photo.upload'), onclick: function () { input.click(); } }),
        cur ? h('button', { type: 'button', class: 'linkbtn linkbtn--danger', text: t('photo.remove'), onclick: function () { s[kind] = null; changed(); renderForm(); } }) : null,
        input
      ])]),
      h('small', { class: 'hint', text: hint })
    ]);
  }

  function formDesign(root) {
    var s = S.site.settings;
    formHead(root, t('set.design'), t('tree.settings'));
    var f = h('div', { class: 'fbody' });
    f.appendChild(brandBox('logo', t('brand.logo'), t('hint.logo'), 'brand__img--logo'));
    if (s.logo) f.appendChild(toggle(t('brand.with_title'), s.logo.with_title !== false, function (v) { s.logo.with_title = v; changed(); }));
    f.appendChild(brandBox('favicon', t('brand.favicon'), s.favicon ? t('hint.favicon') : t('hint.favicon_none'), 'brand__img--icon'));
    f.appendChild(brandBox('og_image', t('brand.og'), t('hint.og'), 'brand__img--og'));
    root.appendChild(f);
  }

  /* ---------------------------------------------------------------- Почта (раздел 10.10) */

  function formMail(root) {
    var P = S.priv;
    formHead(root, t('set.mail'), t('tree.settings'));
    var f = h('div', { class: 'fbody' });
    f.appendChild(privField('mail_from', t('field.mail_from'), { type: 'email', placeholder: P.mail_from_default, hint: t('hint.mail_from', { def: P.mail_from_default }) }));
    var det = h('details', { class: 'more' }, [h('summary', { text: t('mail.own_box') })]);
    if (P.smtp_host || privErr('smtp_host') || privErr('smtp_port')) det.open = true;
    det.appendChild(h('p', { class: 'hint', text: t('hint.smtp') }));
    det.appendChild(privField('smtp_host', t('field.smtp_host'), { placeholder: 'smtp.yandex.ru' }));
    det.appendChild(h('div', { class: 'two' }, [
      privField('smtp_port', t('field.smtp_port'), { inputmode: 'numeric', placeholder: P.smtp_secure === 'ssl' ? '465' : '587' }),
      seg(t('field.smtp_secure'), [['ssl', 'SSL'], ['tls', 'STARTTLS']], P.smtp_secure, function (v) { P.smtp_secure = v; changed(); renderForm(); })
    ]));
    det.appendChild(privField('smtp_user', t('field.smtp_user'), { ac: 'off' }));
    var pass = h('input', { type: 'password', autocomplete: 'new-password', placeholder: P.smtp_pass_set ? '••••••••' : '', 'data-field': 'smtp_pass' });
    if (P.smtp_pass) pass.value = P.smtp_pass;
    pass.addEventListener('input', function () { P.smtp_pass = pass.value; changed(); });
    det.appendChild(field(t('field.smtp_pass'), pass, P.smtp_pass_set ? t('hint.smtp_pass_set') : null));
    f.appendChild(det);

    f.appendChild(section(t('mail.test')));
    var email = BOOT.admin.email;
    var out = h('p', { class: 'hint', text: P.mail_test_ok ? t('mail.test_ok_at', { at: P.mail_test_ok }) : '' });
    f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', disabled: !email, text: t('mail.test_btn'), onclick: function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      out.className = 'hint';
      out.textContent = t('mail.sending');
      api('POST', 'mail_test', P).then(function (j) {
        btn.disabled = false;
        if (j.ok) {
          out.className = 'hint hint--ok';
          out.textContent = t('mail.sent', { to: j.to }) + (j.saved ? '' : ' ' + t('mail.sent_unsaved'));
          if (j.saved) { P.mail_test_ok = 'now'; renderTree(); }
        } else {
          out.className = 'hint hint--err';
          out.textContent = t('mail.failed') + ' ' + (j.error || '');
        }
      }).catch(function () { btn.disabled = false; out.className = 'hint hint--err'; out.textContent = t('mail.failed'); });
    } }));
    f.appendChild(h('small', { class: 'hint', text: email ? t('hint.mail_test', { to: email }) : t('hint.mail_no_admin') }));
    f.appendChild(out);
    root.appendChild(f);
  }

  /* ---------------------------------------------------------------- Резервные копии (раздел 10.11) */

  function backupDate(b) {
    var d = new Date(b.date + 'T12:00:00');
    var today = new Date(); today.setHours(12, 0, 0, 0);
    var days = Math.round((today - d) / 86400000);
    var txt = new Intl.DateTimeFormat(BOOT.ui, { day: 'numeric', month: 'long' }).format(d);
    if (days === 0) txt = t('backup.today') + ', ' + txt;
    else if (days === 1) txt = t('backup.yesterday') + ', ' + txt;
    return txt + (b.time ? ', ' + b.time : '');
  }

  function formBackups(root) {
    formHead(root, t('set.backups'), t('tree.settings'));
    var f = h('div', { class: 'fbody' });
    f.appendChild(h('p', { class: 'hint', text: t('hint.backups') }));
    var list = h('div', { class: 'bk' }, [h('p', { class: 'hint', text: t('app.loading') })]);
    function draw(items) {
      list.innerHTML = '';
      if (!items.length) list.appendChild(h('p', { class: 'hint', text: t('backup.none') }));
      items.forEach(function (b) {
        list.appendChild(h('div', { class: 'bk__row' }, [
          h('span', { class: 'bk__d', text: backupDate(b) }),
          b.kind !== 'daily' ? h('span', { class: 'bk__tag', text: t('backup.kind_' + b.kind) }) : null,
          h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t('backup.restore'), onclick: function () { restore(b); } })
        ]));
      });
    }
    function restore(b) {
      var when = backupDate(b);
      confirmBox(t('backup.restore_q', { date: when }), t('backup.restore_hint', { date: when }) + (S.dirty ? ' ' + t('backup.restore_unsaved') : ''), t('backup.restore'), true).then(function (ok) {
        if (!ok) return;
        setBusy(t('backup.restoring'));
        api('POST', 'backup_restore', { name: b.name }).then(function (j) {
          setBusy(null);
          if (!j.ok) { alertBox(t(j.error || 'backup.failed')); return; }
          S.dirty = false;
          api('GET', 'site').then(function (r) {
            S.site = r.site; S.priv = r.private; S.errors = []; S.warnings = []; S.idmap = {};
            reindex(); renderAll(); schedulePreview(0);
            flash(t('backup.restored'), 'ok');
          });
        }).catch(function () { setBusy(null); alertBox(t('backup.failed')); });
      });
    }
    f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('backup.now'), onclick: function (e) {
      e.currentTarget.disabled = true;
      api('POST', 'backup_now').then(function (j) { draw(j.list || []); flash(t('backup.made'), 'ok'); renderForm(); });
    } }));
    f.appendChild(list);
    f.appendChild(h('p', { class: 'hint', text: t('hint.backups_download') }));
    root.appendChild(f);
    api('GET', 'backups').then(function (j) { draw(j.list || []); });
  }

  /* ---------------------------------------------------------------- Дополнительно */

  function formAdvanced(root) {
    var P = S.priv;
    formHead(root, t('set.advanced'), t('tree.settings'));
    var f = h('div', { class: 'fbody' });
    var area = h('textarea', { rows: 10, class: 'mono', spellcheck: 'false', 'data-field': 'counter_code', placeholder: '<script>…</script>' });
    area.value = P.counter_code || '';
    var cnt = h('span', { class: 'cnt' });
    function upd() { cnt.textContent = area.value.length + ' / 5000'; cnt.classList.toggle('is-over', area.value.length > 5000); }
    area.addEventListener('input', function () { P.counter_code = area.value; upd(); changed(); });
    upd();
    f.appendChild(field(t('field.counter_code'), area, t('hint.counter'), cnt, privErr('counter_code')));
    f.appendChild(h('p', { class: 'hint hint--warn', text: t('hint.counter_law') }));

    // Фотосервис (раздел 10.6.1): ключ хранится только в этой установке, показывается замаскированным.
    f.appendChild(section(t('sec.photo_service')));
    f.appendChild(seg(t('field.photo_service'), [['claid', 'Claid.ai'], ['photoroom', 'Photoroom']], P.photo_service, function (v) { P.photo_service = v; changed(); formAdvancedRedraw(); }));
    var key = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: P.photo_key_masked || '', 'data-field': 'photo_api_key' });
    if (P.photo_api_key) key.value = P.photo_api_key;
    key.addEventListener('input', function () { P.photo_api_key = key.value; changed(); });
    var clear = P.photo_key_masked ? h('button', { type: 'button', class: 'linkbtn linkbtn--danger', text: t('photo.key_clear'), onclick: function () { P.photo_api_key = ''; P.photo_key_masked = ''; changed(); formAdvancedRedraw(); } }) : null;
    f.appendChild(field(t('field.photo_api_key'), key, P.photo_key_masked ? t('hint.photo_key_set') : t('hint.photo_key'), clear, privErr('photo_api_key')));
    f.appendChild(h('p', { class: 'hint' }, [t('hint.photo_service') + ' ', h('a', { href: P.photo_service === 'photoroom' ? 'https://app.photoroom.com/api-dashboard' : 'https://claid.ai/', target: '_blank', rel: 'noopener', text: P.photo_service === 'photoroom' ? 'photoroom.com' : 'claid.ai' })]));
    root.appendChild(f);
    function formAdvancedRedraw() { root.innerHTML = ''; formAdvanced(root); }
  }

  /* ---------------------------------------------------------------- Обновление (раздел 10.12) */

  function notesOf(u) {
    var n = u && u.notes ? (u.notes[BOOT.ui] && u.notes[BOOT.ui].length ? u.notes[BOOT.ui] : u.notes.ru || []) : [];
    return Array.isArray(n) ? n : [];
  }

  // Полоса под верхней панелью: «Доступна версия X · Что нового · Обновить».
  function renderUpbar() {
    var bar = $('[data-upbar]');
    bar.innerHTML = '';
    var u = S.upd;
    if (!u || !u.newer) return;
    bar.appendChild(h('span', { text: t('update.available', { v: u.latest }) }));
    bar.appendChild(h('button', { type: 'button', class: 'linkbtn', text: t('update.whats_new'), onclick: function () { select('set:update'); } }));
    bar.appendChild(h('button', { type: 'button', class: 'btn btn--action btn--small', text: t('update.run'), onclick: function () { select('set:update'); runUpdate(); } }));
  }

  function formUpdate(root) {
    formHead(root, t('set.update'), t('tree.settings'));
    var f = h('div', { class: 'fbody' });
    var u = S.upd || {};
    f.appendChild(h('div', { class: 'upd__ver' }, [
      h('span', { class: 'muted', text: t('update.current') }), h('b', { text: u.current || BOOT.engine || '—' }),
      h('span', { class: 'muted', text: t('update.latest') }), h('b', { text: u.latest || t('update.unknown') })
    ]));
    var notes = notesOf(u);
    if (u.newer && notes.length) {
      f.appendChild(h('b', { text: t('update.whats_new') }));
      f.appendChild(h('ul', { class: 'upd__notes' }, notes.map(function (n) { return h('li', { text: n }); })));
    }
    if (!u.newer && u.latest) f.appendChild(h('p', { class: 'hint', text: t('update.uptodate') }));
    var acts = h('div', { class: 'upd__acts' }, [
      h('button', { type: 'button', class: 'btn btn--ghost', text: t('update.check'), onclick: function (e) {
        e.currentTarget.disabled = true;
        api('POST', 'update_check').then(function (j) { S.upd = j; renderUpbar(); renderForm(); }).catch(function () { renderForm(); });
      } }),
      u.newer && u.writable ? h('button', { type: 'button', class: 'btn btn--action', text: t('update.run'), onclick: runUpdate }) : null
    ]);
    f.appendChild(acts);
    if (u.newer && !u.writable) {
      f.appendChild(h('p', { class: 'hint hint--warn' }, [t('update.manual') + ' ', u.zip ? h('a', { href: u.zip, text: t('update.download_zip') }) : null]));
    }
    f.appendChild(h('div', { 'data-upd-steps': '' }));
    if (u.rollback) {
      f.appendChild(section(t('update.rollback_title')));
      f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('update.rollback', { v: u.rollback }), onclick: function () {
        confirmBox(t('update.rollback', { v: u.rollback }), t('update.rollback_hint'), t('update.rollback_ok'), true).then(function (ok) {
          if (!ok) return;
          setBusy(t('update.rolling_back'));
          api('POST', 'update_rollback').then(function (j) {
            setBusy(null);
            if (!j.ok) { alertBox(t(j.error || 'update.failed')); return; }
            location.reload();
          }).catch(function () { setBusy(null); location.reload(); });
        });
      } }));
    }
    root.appendChild(f);
  }

  var UPD_STEPS = ['prepare', 'download', 'replace', 'finish'];

  // «Обновить»: шаги отдельными запросами, прогресс — списком; ошибка — сервер уже откатил.
  function runUpdate() {
    if (S.dirty) { alertBox(t('update.save_first')); return; }
    confirmBox(t('update.confirm_title', { v: S.upd.latest }), t('update.confirm'), t('update.run'), false).then(function (ok) {
      if (!ok) return;
      var box = $('[data-upd-steps]');
      var list = h('ol', { class: 'upd__steps' }, UPD_STEPS.map(function (s) { return h('li', { 'data-s': s, text: t('update.step.' + s) }); }));
      if (box) { box.innerHTML = ''; box.appendChild(list); }
      setBusy(t('update.running'));
      function mark(i) {
        Array.prototype.forEach.call(list.children, function (li, k) { li.className = k < i ? 'is-done' : (k === i ? 'is-now' : ''); });
      }
      function step(i) {
        mark(i);
        api('POST', 'update_step', { step: UPD_STEPS[i] }).then(function (j) {
          if (!j.ok) {
            setBusy(null);
            alertBox(t(j.error || 'update.failed') + (j.rolled_back ? ' ' + t('update.rolled_back') : ''));
            api('GET', 'update').then(function (u) { S.upd = u; renderUpbar(); renderForm(); });
            return;
          }
          if (j.next) { step(UPD_STEPS.indexOf(j.next)); return; }
          mark(UPD_STEPS.length);
          setBusy(null);
          flash(t('update.done', { v: j.version }), 'ok');
          setTimeout(function () { location.reload(); }, 1200);
        }).catch(function () {
          setBusy(null);
          alertBox(t('update.failed') + ' ' + t('update.rolled_back'));
          setTimeout(function () { location.reload(); }, 1500);
        });
      }
      step(0);
    });
  }

  /* ---------------------------------------------------------------- Перед запуском (раздел 10.13) */

  function allNodes() { return Object.keys(IDX).map(function (k) { return IDX[k]; }); }
  function shownNode(i) {
    for (var n = i; n; n = n.tile ? info(n.tile) : null) {
      if (n.node.hidden) return false;
      if (n.kind === 'tile' && n.block && n.block.hidden) return false;
      if (n.tab && n.tab.hidden) return false;
    }
    return true;
  }
  function filledAll(obj) { return langs().every(function (l) { return tx(obj, l).trim() !== ''; }); }

  function launchItems() {
    if (!S.site || !S.priv) return [];
    var s = S.site.settings, items = [];
    var blocks = allNodes().filter(function (i) { return i.kind === 'block' && shownNode(i); });
    var pays = blocks.filter(function (i) { return i.node.type === 'pay'; });
    var services = blocks.filter(function (i) { return i.node.type === 'service'; });
    items.push({ key: 'name', ok: filledAll(s.site_title), go: 'set:main' });
    items.push({ key: 'brand', ok: !!(s.logo && s.favicon), go: 'set:design' });
    items.push({ key: 'og', ok: !!s.og_image, go: 'set:design' });
    items.push({ key: 'seo', ok: filledAll(s.seo_title) && filledAll(s.seo_description), go: 'set:main' });
    if (pays.length || services.length) {
      var feeds = [];
      pays.concat(services).forEach(function (i) { var fd = feedOf(i.node); if (feeds.indexOf(fd) < 0) feeds.push(fd); });
      var okOwner = feeds.every(function (fd) {
        var op = S.site.operators.filter(function (o) { return String(o.id) === String(fd.operator); })[0];
        return op && String(op.name || '').trim() && String(op.tax_id || '').trim() && String(op.address || '').trim();
      });
      items.push({ key: 'owner', ok: okOwner, go: 'set:operators' });
    }
    if (pays.length || services.length || (S.priv.counter_code || '').trim()) {
      var d = S.site.docs || {};
      items.push({ key: 'docs', ok: !!(d.offer && d.offer.show && d.privacy && d.privacy.show), go: 'set:docs' });
    }
    if (pays.length) {
      var bad = pays.filter(function (i) { return !(i.node.methods || []).some(function (m) { return m.on; }); })[0];
      items.push({ key: 'pay', ok: !bad && !!S.priv.payment_checked, go: bad ? keyOf(bad.node) : 'launch', manual: true });
    }
    items.push({ key: 'mail', ok: !!(BOOT.admin.email && S.priv.mail_test_ok), go: 'set:mail' });
    if (multi()) {
      var miss = allNodes().filter(function (i) { return shownNode(i) && missingLangs(i.node).length; })[0];
      items.push({ key: 'langs', ok: !miss, go: miss ? miss.key : 'launch' });
    }
    return items;
  }

  function formLaunch(root) {
    var L = launchItems(), done = L.filter(function (x) { return x.ok; }).length;
    formHead(root, t('launch.title'), t('launch.count', { n: done, m: L.length }));
    var f = h('div', { class: 'fbody' });
    f.appendChild(h('p', { class: 'hint', text: done === L.length ? t('launch.all_done') : t('hint.launch') }));
    L.forEach(function (it) {
      f.appendChild(h('button', { type: 'button', class: 'chk' + (it.ok ? ' is-ok' : ''), onclick: function () { if (it.go !== 'launch') select(it.go); } }, [
        h('span', { class: 'chk__m', 'aria-hidden': 'true', text: it.ok ? '✓' : '○' }),
        h('span', { class: 'chk__t' }, [h('b', { text: t('launch.' + it.key) }), h('small', { text: t('launch.' + it.key + '_hint') })])
      ]));
      if (it.manual) {
        f.appendChild(toggle(t('launch.pay_checked'), S.priv.payment_checked, function (v) { S.priv.payment_checked = v; changed(); renderForm(); }));
      }
    });
    root.appendChild(f);
  }


  /* ---------------------------------------------------------------- способы оплаты (раздел 10.7) */

  var REQ_FIELDS = {
    RU: ['recipient', 'inn', 'bank', 'bik', 'account'],
    GE: ['recipient', 'code', 'bank', 'iban', 'swift'],
    other: ['recipient', 'bank', 'iban', 'swift']
  };

  function providerLabel(code) {
    var l = S.meta.provider_labels[code] || {};
    return l[S.lang] || l.ru || code;
  }

  function methodsEditor(b) {
    var box = h('div', { class: 'methods' });
    box.appendChild(h('p', { class: 'hint', text: t('hint.methods_order') }));
    b.methods.forEach(function (m, i) {
      var head = h('div', { class: 'meth__h', draggable: 'true' }, [
        h('span', { class: 'row__drag', text: '⋮⋮' }),
        toggle('', m.on, function (v) { m.on = v; changed(); }),
        h('b', { text: m.provider === 'custom' ? t('pay.custom') : providerLabel(m.provider) }),
        h('button', { type: 'button', class: 'row__x', title: t('tree.delete'), text: '✕', onclick: function () { b.methods.splice(i, 1); changed(); renderForm(); } })
      ]);
      dragSetup(head, b.methods, i);
      var card = h('div', { class: 'meth' + (m.on ? '' : ' is-off') }, [head]);
      if (m.kind === 'link') {
        card.appendChild(plainField(m, 'url', t('field.pay_url'), { type: 'url', placeholder: 'https://' }));
        card.appendChild(textField(m, 'label', t('field.method_label'), S.meta.max.method.label, { placeholder: m.provider === 'custom' ? '' : providerLabel(m.provider), hint: t('hint.method_label') }));
      } else if (m.kind === 'qr') {
        card.appendChild(qrField(m));
      } else if (m.kind === 'requisites') {
        m.req = m.req && typeof m.req === 'object' ? m.req : {};
        var fmt = feedOf(b).req_format;
        REQ_FIELDS[fmt].forEach(function (k) { card.appendChild(plainField(m.req, k, t('req.' + (fmt === 'other' && k === 'iban' ? 'iban_account' : k)))); });
        if (!m.req.purpose || typeof m.req.purpose !== 'object') m.req.purpose = {};
        card.appendChild(textField(m.req, 'purpose', t('req.purpose'), 140, { placeholder: t('req.purpose_default') }));
      }
      box.appendChild(card);
    });
    var addBtn = h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t('pay.add'), onclick: function (e) {
      closeMenus();
      var fmt = feedOf(b).req_format;
      var menu = h('div', { class: 'menu', role: 'menu' });
      Object.keys(S.meta.providers).forEach(function (code) {
        var p = S.meta.providers[code];
        if (p.format !== 'all' && p.format !== fmt) return;
        var taken = (p.kind === 'qr' || p.kind === 'requisites') && b.methods.some(function (m) { return m.kind === p.kind; });
        menu.appendChild(h('button', { type: 'button', role: 'menuitem', disabled: taken, onclick: function () {
          closeMenus();
          var m = { id: newId(), kind: p.kind, provider: code, on: true, url: '', image: '', label: {}, req: p.kind === 'requisites' ? { purpose: {} } : null };
          b.methods.push(m); changed(); renderForm();
        } }, [h('b', { text: code === 'custom' ? t('pay.custom') : providerLabel(code) })]));
      });
      e.currentTarget.after(menu);
      setTimeout(function () { document.addEventListener('click', closeMenus, { once: true }); });
    } });
    box.appendChild(addBtn);
    box.appendChild(h('p', { class: 'hint', text: t('hint.methods_check') }));
    return box;
  }

  function qrField(m) {
    var img = m.image ? h('img', { src: '/uploads/' + m.image, alt: 'QR', class: 'qr__img' }) : h('span', { class: 'qr__none', text: t('photo.none') });
    var input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true });
    input.addEventListener('change', function () {
      if (!input.files[0]) return;
      var fd = new FormData();
      fd.append('file', input.files[0]);
      api('POST', 'qr', fd, true).then(function (j) {
        if (j.image) { m.image = j.image; changed(); renderForm(); }
        else alertBox(t(j.error || 'photo.upload_failed'));
      });
    });
    return h('div', { class: 'qr' }, [img, h('button', { type: 'button', class: 'btn btn--ghost', text: m.image ? t('photo.replace') : t('photo.upload'), onclick: function () { input.click(); } }), input,
      h('small', { class: 'hint', text: t('hint.qr') })]);
  }

  /* ---------------------------------------------------------------- фото (раздел 10.6) */

  // Фотосервис (раздел 10.6.1): режим по месту фото — вина «Студийное фото», остальное «Улучшить».
  // Выбор «обработанное или оригинал» хранится у фото и уходит на сервер с сохранением.
  function svcOn() { return !!(S.priv && S.priv.photo_ready); }

  function photoField(node, key, aspect, wine) {
    var p = node[key];
    var mode = svcOn() ? (node._svc || (wine ? 'studio' : 'enhance')) : 'none';
    var thumb;
    if (p) {
      thumb = h('img', { class: 'ph__img ph__img--' + aspect.replace(':', 'x'), alt: '', src: p._thumb || (p.crop || p.aspect === aspect ? p.thumb : srcOf(p)) });
    } else {
      thumb = h('span', { class: 'ph__none ph__img--' + aspect.replace(':', 'x'), text: t('photo.none') });
    }
    function edit(ph, hint) {
      openEditor(ph, aspect, false, function (res) { node[key] = Object.assign(ph, res); changed(); renderForm(); }, hint);
    }
    // Переключить источник: кадр и верх страницы считаются заново (у файлов разные размеры).
    function useSource(ph, processed, crop) {
      ph.use_processed = processed; ph.crop = crop || null; ph.head_crop = null; ph.rotate = 0;
      ph._thumb = null; ph._head_thumb = null;
      if (ph === node[key]) { changed(); renderForm(); }
    }
    function process(ph, again) {
      var cancelled = false;
      busyBox(t('photo.processing'), function () { cancelled = true; edit(ph); });
      api('POST', 'photo_process', { id: ph.id, mode: mode, aspect: aspect, again: again }).then(function (j) {
        if (cancelled) return;
        busyBox(null);
        if (!j.ok) { alertBox(t(j.error || 'photo.svc_failed')); edit(ph); return; }
        ph.mode = j.mode; ph.pv = j.processed;
        compareBox(ph).then(function (useIt) {
          if (useIt) { useSource(ph, true, j.crop); edit(ph, j.fits ? null : t('photo.not_fit')); }
          else { if (ph.use_processed) useSource(ph, false); edit(ph); }
        });
      }).catch(function () { if (cancelled) return; busyBox(null); alertBox(t('photo.svc_failed')); edit(ph); });
    }
    var input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { alertBox(t('photo.too_big')); return; }
      var fd = new FormData();
      fd.append('file', file);
      fd.append('aspect', aspect);
      setBusy(t('photo.uploading'));
      api('POST', 'photo', fd, true).then(function (j) {
        setBusy(null);
        if (!j.photo) { alertBox(t(j.error || 'photo.upload_failed')); return; }
        if (mode === 'none') edit(j.photo); else process(j.photo, false);
      }).catch(function () { setBusy(null); alertBox(t('photo.upload_failed')); });
    });
    var acts = h('div', { class: 'ph__acts' }, [
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: p ? t('photo.replace') : t('photo.upload'), onclick: function () { input.click(); } }),
      p ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t('photo.crop'), onclick: function () { edit(p); } }) : null,
      p && mode !== 'none' ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t(p.mode === mode ? 'photo.process_again' : 'photo.process'), onclick: function () { process(p, p.mode === mode); } }) : null,
      p ? h('button', { type: 'button', class: 'linkbtn linkbtn--danger', text: t('photo.remove'), onclick: function () { node[key] = null; changed(); renderForm(); } }) : null,
      input
    ]);
    var status = null;
    if (p && p.mode) {
      status = h('p', { class: 'ph__svc' }, p.use_processed
        ? [t('photo.processed') + ': ' + t('photo.mode.' + p.mode) + ' · ', h('button', { type: 'button', class: 'linkbtn', text: t('photo.back_original'), onclick: function () { useSource(p, false); edit(p); } })]
        : [h('button', { type: 'button', class: 'linkbtn', text: t('photo.back_processed') + ' (' + t('photo.mode.' + p.mode) + ')', onclick: function () { useSource(p, true); edit(p); } })]);
    }
    var modes = svcOn() ? seg(t('photo.processing_mode'), [['studio', t('photo.mode.studio')], ['enhance', t('photo.mode.enhance')], ['none', t('photo.mode.none')]], mode,
      function (v) { node._svc = v; renderForm(); }) : null;
    if (modes) modes.classList.add('ph__modes');
    return h('div', { class: 'fld ph' }, [h('span', { class: 'fld__l', text: t('field.photo') + ' · ' + t('frame.' + aspect) }), modes, h('div', { class: 'ph__row' }, [thumb, acts]), status]);
  }

  // Файл фото для редактора: обработанный или оригинал — по несохранённому выбору.
  function srcOf(p) {
    return '/admin/api/original?id=' + p.id + '&src=' + (p.use_processed ? 'proc&v=' + encodeURIComponent(p.pv || '') : 'orig');
  }

  // «Было / Стало» (раздел 10.6.1). true — «Применить», false — «Оставить как было».
  function compareBox(p) {
    return new Promise(function (resolve) {
      var ov;
      function done(v) { ov.remove(); resolve(v); }
      ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox cmp', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('photo.compare') }, [
        h('h3', { text: t('photo.compare') + ' · ' + t('photo.mode.' + p.mode) }),
        h('div', { class: 'cmp__row' }, [
          h('figure', {}, [h('img', { alt: '', src: '/admin/api/original?id=' + p.id + '&src=orig' }), h('figcaption', { text: t('photo.before') })]),
          h('figure', {}, [h('img', { alt: '', src: '/admin/api/original?id=' + p.id + '&src=proc&v=' + encodeURIComponent(p.pv || '') }), h('figcaption', { text: t('photo.after') })])
        ]),
        h('div', { class: 'mbox__acts' }, [
          h('button', { type: 'button', class: 'btn btn--ghost', text: t('photo.keep'), onclick: function () { done(false); } }),
          h('button', { type: 'button', class: 'btn btn--action', text: t('btn.apply'), onclick: function () { done(true); } })
        ])
      ])]);
      document.body.appendChild(ov);
    });
  }

  // Окно ожидания с «Отменить»; busyBox(null) закрывает.
  function busyBox(text, onCancel) {
    var old = $('.busy--svc');
    if (old) old.remove();
    if (!text) return;
    var b = h('div', { class: 'busy busy--svc', role: 'status' }, [text + ' ',
      h('button', { type: 'button', class: 'linkbtn', text: t('btn.cancel'), onclick: function () { b.remove(); onCancel(); } })]);
    document.body.appendChild(b);
  }

  function headPhotoField(tl) {
    var p = tl.photo;
    var thumb = h('img', { class: 'ph__img ph__img--3x2', alt: '', src: p._head_thumb || p.head_thumb });
    return h('div', { class: 'fld ph' }, [h('span', { class: 'fld__l', text: t('photo.head') }), h('div', { class: 'ph__row' }, [thumb, h('div', { class: 'ph__acts' }, [
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t('photo.crop'), onclick: function () {
        openEditor(p, '3:2', true, function (res) { p.head_crop = res.crop; p._head_thumb = res._thumb; changed(); renderForm(); });
      } }),
      h('small', { class: 'hint', text: t('hint.head_photo') })
    ])])]);
  }

  var SIZES = { '3:2': [1600, 1067], '4:5': [1200, 1500] };

  // Редактор кадра на Cropper.js: рамка неподвижна, двигается и масштабируется фото.
  function openEditor(photo, aspect, head, onApply, hint) {
    var ratio = aspect === '3:2' ? 3 / 2 : 4 / 5;
    var img = h('img', { alt: '', src: srcOf(photo) });
    var zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1' });
    var straight = h('input', { type: 'range', min: '-10', max: '10', step: '0.1', value: '0', disabled: head });
    var warn = h('p', { class: 'hint hint--warn', hidden: true, text: t('photo.small') });
    var previews = h('div', { class: 'ed__pv' }, [1280, 768, 390].map(function (w) {
      return h('div', { class: 'ed__pvi' }, [h('div', { class: 'ed__pvbox ed__pvbox--' + aspect.replace(':', 'x') + ' ed__pvbox--' + w }), h('small', { text: w + ' px' })]);
    }));
    var base90 = 0, baseRatio = 1, cropper = null;
    var box = h('div', { class: 'ed', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('photo.editor') }, [
      h('div', { class: 'ed__h' }, [h('h3', { text: head ? t('photo.head') : t('photo.editor') }), h('span', { class: 'ed__frame', text: t('frame.' + aspect) })]),
      h('div', { class: 'ed__b' }, [h('div', { class: 'ed__stage' }, [img]), h('div', { class: 'ed__side' }, [h('b', { text: t('photo.how') }), previews, warn, hint ? h('p', { class: 'hint hint--warn', text: hint }) : null])]),
      h('div', { class: 'ed__tools' }, [
        h('label', {}, [t('photo.zoom') + ' ', zoom]),
        head ? null : h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: '↻ ' + t('photo.rotate'), onclick: function () {
          base90 = (base90 + 90) % 360; cropper.rotateTo(base90 + (+straight.value)); fitCover();
        } }),
        head ? null : h('label', {}, [t('photo.straighten') + ' ', straight]),
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t('photo.reset'), onclick: function () {
          base90 = 0; straight.value = 0; zoom.value = 1; cropper.reset(); setTimeout(fitCover);
        } })
      ]),
      h('div', { class: 'ed__f' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', text: t('btn.cancel'), onclick: close }),
        h('button', { type: 'button', class: 'btn btn--action', text: t('btn.apply'), onclick: apply })
      ])
    ]);
    var ov = h('div', { class: 'mo' }, [box]);
    document.body.appendChild(ov);
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    // Фото закрывает рамку целиком, без пустых полей.
    function fitCover() {
      var cb = cropper.getCropBoxData(), cv = cropper.getCanvasData();
      var need = Math.max(cb.width / cv.width, cb.height / cv.height);
      if (need > 1) { cropper.zoomTo(cropper.getImageData().width / cropper.getImageData().naturalWidth * need); }
      cv = cropper.getCanvasData();
      baseRatio = cropper.getImageData().width / cropper.getImageData().naturalWidth / (+zoom.value || 1);
    }
    img.addEventListener('load', function () {
      var start = head ? photo.head_crop : photo.crop;
      cropper = new Cropper(img, {
        aspectRatio: ratio, viewMode: 1, dragMode: 'move', autoCropArea: 1, cropBoxMovable: false, cropBoxResizable: false,
        toggleDragModeOnDblclick: false, guides: true, center: false, background: false, zoomOnWheel: true, wheelZoomRatio: 0.05,
        preview: previews.querySelectorAll('.ed__pvbox'),
        ready: function () {
          // Рамка — по центру сцены, как можно больше; фото двигается под ней.
          var c = cropper.getContainerData();
          var w = Math.min(c.width * 0.86, c.height * 0.86 * ratio);
          cropper.setCropBoxData({ width: w, height: w / ratio, left: (c.width - w) / 2, top: (c.height - w / ratio) / 2 });
          if (!head && photo.rotate) { base90 = Math.round(photo.rotate / 90) * 90 % 360; straight.value = photo.rotate - Math.round(photo.rotate / 90) * 90; }
          var rot = head ? (photo.rotate || 0) : (photo.rotate || 0);
          if (rot) cropper.rotateTo(rot);
          if (start && start.w) cropper.setData({ x: start.x, y: start.y, width: start.w, height: start.h, rotate: rot });
          else {
            var cv = cropper.getCanvasData(), cb = cropper.getCropBoxData();
            var k = Math.max(cb.width / cv.width, cb.height / cv.height);
            cropper.zoomTo(cropper.getImageData().width / cropper.getImageData().naturalWidth * k);
            cv = cropper.getCanvasData();
            cropper.setCanvasData({ left: cb.left + (cb.width - cv.width) / 2, top: cb.top + (cb.height - cv.height) / 2 });
          }
          fitCover();
          baseRatio = cropper.getImageData().width / cropper.getImageData().naturalWidth;
          zoom.value = 1;
          checkSize();
        },
        crop: checkSize,
        zoom: function (e) {
          // Меньше, чем «закрыть рамку», уменьшать нельзя.
          var cb = cropper.getCropBoxData(), im = cropper.getImageData();
          var rad = Math.abs(((im.rotate || 0) % 180)) * Math.PI / 180;
          var w = e.detail.ratio * im.naturalWidth, hh = e.detail.ratio * im.naturalHeight;
          var bw = Math.abs(w * Math.cos(rad)) + Math.abs(hh * Math.sin(rad)), bh = Math.abs(w * Math.sin(rad)) + Math.abs(hh * Math.cos(rad));
          if (bw < cb.width - 0.5 || bh < cb.height - 0.5) { e.preventDefault(); return; }
          if (baseRatio) zoom.value = Math.min(4, Math.max(1, e.detail.ratio / baseRatio));
        }
      });
    });
    zoom.addEventListener('input', function () { if (cropper && baseRatio) cropper.zoomTo(baseRatio * (+zoom.value)); });
    straight.addEventListener('input', function () { if (cropper) { cropper.rotateTo(base90 + (+straight.value)); fitCover(); } });

    function checkSize() {
      if (!cropper) return;
      var d = cropper.getData();
      warn.hidden = d.width >= SIZES[aspect][0] * 0.98;
    }
    function close() {
      document.removeEventListener('keydown', onKey);
      if (cropper) cropper.destroy();
      ov.remove();
    }
    function apply() {
      var d = cropper.getData(true);
      var c = cropper.getCroppedCanvas({ width: 240, height: Math.round(240 / ratio) });
      var res = { crop: { x: d.x, y: d.y, w: d.width, h: d.height }, _thumb: c ? c.toDataURL('image/jpeg', 0.8) : null };
      if (!head) { res.rotate = d.rotate || 0; res.aspect = aspect; }
      close();
      onApply(res);
    }
  }

  /* ---------------------------------------------------------------- превью (раздел 10.8) */

  function renderPreviewBar() {
    var root = $('[data-preview]');
    if (!root.firstChild) {
      root.innerHTML = '';
      var bar = h('div', { class: 'pv__bar' });
      var stage = h('div', { class: 'pv__stage' }, [
        h('iframe', { class: 'pv__frame', title: t('preview.title') }),
        h('iframe', { class: 'pv__frame is-back', title: t('preview.title'), 'aria-hidden': 'true', tabindex: '-1' })
      ]);
      root.appendChild(bar);
      root.appendChild(h('p', { class: 'pv__cap', text: t('preview.caption') }));
      root.appendChild(stage);
      window.addEventListener('resize', fitPreview);
    }
    var bar2 = $('.pv__bar', root);
    bar2.innerHTML = '';
    var dev = h('div', { class: 'seg seg--small' });
    [[1280, t('preview.desktop')], [768, t('preview.tablet')], [390, t('preview.phone')]].forEach(function (d) {
      dev.appendChild(h('button', { type: 'button', class: 'seg__o' + (S.device === d[0] ? ' is-on' : ''), onclick: function () { S.device = d[0]; renderPreviewBar(); fitPreview(); } }, [d[1] + ' ' + d[0]]));
    });
    bar2.appendChild(dev);
    if (multi()) {
      var ls = h('div', { class: 'seg seg--small' });
      langs().forEach(function (l) {
        ls.appendChild(h('button', { type: 'button', class: 'seg__o' + (S.pvLang === l ? ' is-on' : ''), onclick: function () { S.pvLang = l; S.lang = l; renderPreviewBar(); renderForm(); renderTree(); loadPreview(); } }, [l.toUpperCase()]));
      });
      bar2.appendChild(ls);
    }
    var hosts = S.site.domains.filter(function (d) { return d.host; });
    if (hosts.length) {
      if (!hosts.some(function (d) { return d.host === S.pvHost; })) S.pvHost = hosts[0].host;
      var hs = h('select', { class: 'pv__host', title: t('preview.address') });
      hosts.forEach(function (d) { var o = h('option', { value: d.host, text: d.host }); if (d.host === S.pvHost) o.selected = true; hs.appendChild(o); });
      hs.addEventListener('change', function () { S.pvHost = hs.value; S.pvPath = '/'; S.scrollY = 0; loadPreview(); });
      bar2.appendChild(hs);
    } else S.pvHost = '';
    bar2.appendChild(h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: '⌂ ' + t('preview.home'), onclick: function () { S.pvPath = '/'; S.scrollY = 0; loadPreview(); } }));
    fitPreview();
  }

  function fitPreview() {
    var stage = $('.pv__stage');
    if (!stage) return;
    var w = stage.clientWidth, hgt = stage.clientHeight;
    var k = Math.min(1, w / S.device);
    document.querySelectorAll('.pv__frame').forEach(function (f) {
      f.style.width = S.device + 'px';
      f.style.height = (hgt / k) + 'px';
      f.style.transform = 'scale(' + k + ')';
      f.style.left = Math.max(0, (w - S.device * k) / 2) + 'px';
    });
  }

  var pvTimer = null;
  function schedulePreview(ms) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(sendPreview, ms);
  }
  function sendPreview() {
    var seq = ++S.seq;
    api('POST', 'preview', { site: S.site }).then(function (j) {
      if (seq !== S.seq) return;
      S.idmap = j.ids || {};
      loadPreview();
    });
  }

  function previewPathFor(key) {
    var i = IDX[key] || IDX[+key];
    if (!i) return key === 'footer' || key === 'header' || key === 'launch' || key.indexOf('set:') === 0 ? S.pvPath : '/';
    if (i.kind === 'tile') {
      var o = opens(i.node);
      if (o === 'page' || o === 'static') return tabPrefix(i.tab) + '/' + slugOf(i.node);
      if (o === 'popup' && slugOf(i.node)) return popupPath(i.node);
    }
    if (i.tile) return tabPrefix(i.tab) + '/' + slugOf(i.tile);
    return tabPrefix(i.tab) || '/';
  }

  function loadPreview() {
    var frames = document.querySelectorAll('.pv__frame');
    if (!frames.length) return;
    var front = $('.pv__frame:not(.is-back)'), back = $('.pv__frame.is-back');
    var url = '/admin/preview?path=' + encodeURIComponent(S.pvPath) + '&lang=' + encodeURIComponent(S.pvLang || '') + '&host=' + encodeURIComponent(S.pvHost || '') + '&y=' + Math.round(S.scrollY) + '&r=' + (++S.seq);
    back.onload = function () {
      back.onload = null;
      back.classList.remove('is-back'); back.removeAttribute('aria-hidden'); back.removeAttribute('tabindex');
      front.classList.add('is-back'); front.setAttribute('aria-hidden', 'true'); front.setAttribute('tabindex', '-1');
      highlight(true);
    };
    back.src = url;
  }

  function highlight(quiet) {
    var f = $('.pv__frame:not(.is-back)');
    if (!f || !f.contentWindow) return;
    var key = S.sel;
    f.contentWindow.postMessage({ type: 'hl', eid: String(serverId(isNaN(+key) ? key : +key)), scroll: !quiet }, location.origin);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data) return;
    var d = e.data;
    if (d.type === 'scroll') S.scrollY = d.y;
    if (d.type === 'select' && d.eid) {
      var id = clientId(d.eid);
      if (String(id) !== S.sel && (IDX[id] || d.eid === 'header' || d.eid === 'footer')) {
        S.sel = String(id);
        openParents(IDX[id]);
        renderTree(); renderForm(); highlight(true);
      }
    }
    if (d.type === 'nav') {
      var path = d.path.replace(/^\/(ru|ka|en|fr)(?=\/|$)/, '') || '/';
      var m = d.path.match(/^\/(ru|ka|en|fr)(?=\/|$)/);
      if (m && langs().indexOf(m[1]) >= 0) { S.pvLang = m[1]; S.lang = m[1]; renderPreviewBar(); renderForm(); }
      else if (!m) S.pvLang = mainLang();
      S.pvPath = path; S.scrollY = 0; loadPreview();
    }
  });

  /* ---------------------------------------------------------------- сохранение (раздел 10.9) */

  function save() {
    if (!S.dirty || S.saving) return;
    S.saving = true;
    renderStatus();
    api('POST', 'save', { site: S.site, private: S.priv }).then(function (j) {
      S.saving = false;
      if (!j.ok) {
        S.errors = j.errors || [];
        S.warnings = j.warnings || [];
        renderStatus(); renderTree(); renderForm();
        flash(t('save.failed'), 'err');
        return;
      }
      var ids = j.ids || {};
      // Временные id новых элементов и табов → настоящие.
      var real = function (k) {
        if (k.charAt(0) === 't' && ids['tab:' + k.slice(1)]) return 't' + ids['tab:' + k.slice(1)];
        return ids[k] ? String(ids[k]) : k;
      };
      var sel = real(S.sel);
      Object.keys(S.open).forEach(function (k) { if (real(k) !== k) S.open[real(k)] = S.open[k]; });
      S.site = j.site;
      S.priv = j.private || S.priv;
      S.idmap = {};
      S.errors = [];
      S.warnings = j.warnings || [];
      S.dirty = false;
      S.sel = sel;
      reindex();
      if (S.pvPath) S.pvPath = previewPathFor(S.sel) || S.pvPath;
      renderAll();
      flash(t('save.done'), 'ok');
      schedulePreview(0);
    }).catch(function () { S.saving = false; renderStatus(); flash(t('save.failed'), 'err'); });
  }

  function flash(text, kind) {
    var st = $('[data-status]');
    st.textContent = text;
    st.className = 'top__status is-' + kind;
    setTimeout(renderStatus, 2500);
  }

  function setBusy(text) {
    var b = $('.busy');
    if (!text) { if (b) b.remove(); return; }
    if (!b) document.body.appendChild(h('div', { class: 'busy', role: 'status', text: text }));
    else b.textContent = text;
  }

  /* ---------------------------------------------------------------- окна */

  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var ov;
      function done(v) { document.removeEventListener('keydown', key); ov.remove(); resolve(v); }
      function key(e) { if (e.key === 'Escape') done(false); }
      ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox', role: 'alertdialog', 'aria-modal': 'true' }, [
        h('h3', { text: title }), text ? h('p', { text: text }) : null,
        h('div', { class: 'mbox__acts' }, [
          h('button', { type: 'button', class: 'btn btn--ghost', text: t('btn.cancel'), onclick: function () { done(false); } }),
          h('button', { type: 'button', class: 'btn ' + (danger ? 'btn--danger-solid' : 'btn--action'), text: okLabel, onclick: function () { done(true); } })
        ])
      ])]);
      document.body.appendChild(ov);
      document.addEventListener('keydown', key);
      $('.mbox .btn:last-child', ov).focus();
    });
  }
  // Окно с выбором из нескольких вариантов; null — «Отмена».
  function choiceBox(title, text, options) {
    return new Promise(function (resolve) {
      var ov;
      function done(v) { document.removeEventListener('keydown', key); ov.remove(); resolve(v); }
      function key(e) { if (e.key === 'Escape') done(null); }
      ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox', role: 'alertdialog', 'aria-modal': 'true' }, [
        h('h3', { text: title }), text ? h('p', { text: text }) : null,
        h('div', { class: 'mbox__choices' }, options.map(function (o, i) {
          return h('button', { type: 'button', class: 'btn ' + (i ? 'btn--ghost' : 'btn--action'), text: o[0], onclick: function () { done(o[1]); } });
        })),
        h('div', { class: 'mbox__acts' }, [h('button', { type: 'button', class: 'btn btn--ghost', text: t('btn.cancel'), onclick: function () { done(null); } })])
      ])]);
      document.body.appendChild(ov);
      document.addEventListener('keydown', key);
      $('.mbox__choices .btn', ov).focus();
    });
  }
  function alertBox(text) {
    var ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox', role: 'alertdialog', 'aria-modal': 'true' }, [
      h('p', { class: 'mbox__text', text: text }), h('div', { class: 'mbox__acts' }, [h('button', { type: 'button', class: 'btn btn--action', text: 'OK', onclick: function () { ov.remove(); } })])
    ])]);
    document.body.appendChild(ov);
    $('.btn', ov).focus();
  }

  /* ---------------------------------------------------------------- «Мой профиль» (раздел 10.14) */

  function openProfile() {
    $('.pmenu').open = false;
    var a = BOOT.admin;
    var data = { ui_lang: a.ui_lang, login: a.login, email: a.email, password_current: '', password_new: '', password_new2: '' };
    var errs = {};
    var ov;
    function inp(key, type, label, hint, ac) {
      var i = h('input', { type: type || 'text', autocomplete: ac || 'off' });
      i.value = data[key];
      i.addEventListener('input', function () { data[key] = i.value; });
      return h('label', { class: 'fld' + (errs[key] ? ' has-err' : '') }, [h('span', { class: 'fld__l', text: label }), i,
        hint ? h('small', { class: 'hint', text: hint }) : null, errs[key] ? h('small', { class: 'hint hint--err', text: t(errs[key]) }) : null]);
    }
    function draw() {
      if (ov) ov.remove();
      var langSel = h('select', {});
      ['ru', 'ka', 'en', 'fr'].forEach(function (l) { var o = h('option', { value: l, text: t('ui_lang.' + l) }); if (l === data.ui_lang) o.selected = true; langSel.appendChild(o); });
      langSel.addEventListener('change', function () { data.ui_lang = langSel.value; });
      ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox mbox--wide', role: 'dialog', 'aria-modal': 'true' }, [
        h('h3', { text: t('profile.title') }),
        h('label', { class: 'fld' }, [h('span', { class: 'fld__l', text: t('profile.ui_lang') }), langSel, h('small', { class: 'hint', text: t('profile.ui_lang_hint') })]),
        inp('login', 'text', t('login.login'), null, 'username'),
        inp('email', 'email', t('profile.email'), t('profile.email_hint'), 'email'),
        h('h4', { class: 'fsec', text: t('profile.password') }),
        inp('password_current', 'password', t('profile.password_current'), null, 'current-password'),
        h('div', { class: 'two' }, [inp('password_new', 'password', t('profile.password_new'), t('profile.password_short'), 'new-password'), inp('password_new2', 'password', t('profile.password_new2'), null, 'new-password')]),
        h('div', { class: 'mbox__acts' }, [
          h('button', { type: 'button', class: 'btn btn--ghost', text: t('btn.cancel'), onclick: function () { ov.remove(); } }),
          h('button', { type: 'button', class: 'btn btn--action', text: t('btn.save'), onclick: submit })
        ])
      ])]);
      document.body.appendChild(ov);
    }
    function submit() {
      api('POST', 'profile', data).then(function (j) {
        if (!j.ok) { errs = j.errors || {}; draw(); return; }
        var reload = data.ui_lang !== a.ui_lang;
        a.login = data.login; a.email = data.email; a.ui_lang = data.ui_lang;
        ov.remove();
        if (reload) {
          if (S.dirty && !window.confirm(t('profile.reload_unsaved'))) { flash(t('profile.saved'), 'ok'); return; }
          S.dirty = false; location.reload();
        } else flash(t('profile.saved'), 'ok');
      });
    }
    draw();
  }

  /* ---------------------------------------------------------------- запуск */

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('[data-save]').addEventListener('click', save);
  $('[data-profile]').addEventListener('click', openProfile);
  load();
})();
