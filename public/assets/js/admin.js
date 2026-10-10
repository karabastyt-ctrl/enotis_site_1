/* Админка сайта-ленты (спецификация 2.1, раздел 10): дерево, формы с языковыми вкладками, превью, фото, сохранение.
   Всё состояние — дерево сайта в JSON формата 3 (раздел 12). Сохранение отправляет его целиком. */
(function () {
  'use strict';

  var BOOT = JSON.parse(document.getElementById('boot').textContent);
  var T = BOOT.t;
  var S = { site: null, meta: null, sel: 'set:main', lang: null, dirty: false, open: {}, errors: [], warnings: [],
            idmap: {}, device: 1280, pvLang: null, pvPath: '/', scrollY: 0, seq: 0, saving: false };
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

  // Каждый элемент: где лежит (список и родитель), уровень страницы, путь для формы и превью.
  var IDX = {};
  function reindex() {
    IDX = {};
    walkBlocks(S.site.blocks, null, 0);
  }
  function walkBlocks(list, ownerTile, level) {
    list.forEach(function (b) {
      IDX[b.id] = { node: b, list: list, kind: 'block', tile: ownerTile, level: level };
      if (b.type === 'tiles') {
        if (!b.tiles) b.tiles = [];
        b.tiles.forEach(function (tl) {
          IDX[tl.id] = { node: tl, list: b.tiles, kind: 'tile', block: b, tile: ownerTile, level: level };
          if (b.kind !== 'wine') {
            if (!tl.blocks) tl.blocks = [];
            walkBlocks(tl.blocks, tl, level + 1);
          }
        });
      }
    });
  }
  function isWine(tile) { var i = IDX[tile.id]; return i && i.block && i.block.kind === 'wine'; }
  function visibleKids(tl) { return (tl.blocks || []).filter(function (b) { return !b.hidden; }); }
  function hasCoords(tl) { return tl.lat !== null && tl.lat !== '' && tl.lat !== undefined && tl.lng !== null && tl.lng !== '' && tl.lng !== undefined; }
  // Как откроется плитка (раздел 3.2) — подсказка в дереве и форме; точное решение принимает сервер.
  function opens(tl) {
    var i = IDX[tl.id];
    if (isWine(tl)) return tx(tl.text, mainLang()) ? 'popup' : null;
    if (i.level === 0 && (visibleKids(tl).length || tl.as_page)) return visibleKids(tl).length ? 'page' : 'static';
    return (tx(tl.text, mainLang()) || tx(tl.place, mainLang()) || hasCoords(tl)) ? 'popup' : null;
  }
  function serverId(id) { return S.idmap[id] || id; }
  function clientId(eid) {
    for (var k in S.idmap) if (String(S.idmap[k]) === String(eid)) return k;
    return isNaN(+eid) ? eid : +eid;
  }
  function slugOf(tl) { return tl.slug || S.idmap['slug:' + tl.id] || ''; }

  /* ---------------------------------------------------------------- языки и переводы */

  var TEXT_FIELDS = {
    text: ['eyebrow', 'title', 'subtitle', 'text'], photo: ['caption'], tiles: ['title'],
    tile: ['title', 'subtitle', 'text', 'place', 'seo_title', 'seo_description'], wine: ['title', 'subtitle', 'grape', 'text'],
    map: ['title'], pay: ['title', 'text', 'button', 'recipient'], service: ['title', 'text', 'price_note', 'button', 'recipient']
  };
  function kindOf(node) {
    var i = IDX[node.id];
    if (!i) return null;
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
      S.site = j.site; S.meta = j.meta;
      S.lang = mainLang(); S.pvLang = mainLang();
      reindex();
      renderAll();
      schedulePreview(0);
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
    root.appendChild(fixedRow('header', t('tree.header'), t('tree.all_pages')));
    var home = h('div', { class: 'grp' }, [h('div', { class: 'grp__h' }, [h('span', { text: t('tree.home') })])]);
    home.appendChild(blockList(S.site.blocks, null));
    root.appendChild(home);
    root.appendChild(fixedRow('footer', t('tree.footer'), t('tree.all_pages')));
    var set = h('div', { class: 'grp' }, [h('div', { class: 'grp__h' }, [h('span', { text: t('tree.settings') })])]);
    ['main', 'langs', 'operators', 'docs', 'social'].forEach(function (k) {
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
    if (k === 'tile' && IDX[node.id].level === 0) kidsFn = function () { return blockList(node.blocks, node); };
    var isOpen = !!S.open[node.id];
    var miss = missingLangs(node);
    var box = h('div', { class: 'node' });
    var photoDot = (k === 'tile' || k === 'wine') ? h('span', { class: 'dot' + (node.photo ? ' is-on' : ''), title: node.photo ? t('tree.has_photo') : t('tree.no_photo') }) : null;
    var row = h('div', {
      class: 'row' + (S.sel === String(node.id) ? ' is-sel' : '') + (node.hidden ? ' is-hidden' : '') + (hasErr(node.id) ? ' has-err' : ''),
      draggable: 'true', tabindex: '0', role: 'button', 'data-id': node.id,
      onclick: function () { select(String(node.id)); }, onkeydown: enterClick
    }, [
      h('span', { class: 'row__drag', title: t('tree.drag'), text: '⋮⋮' }),
      kidsFn ? h('button', { type: 'button', class: 'row__tog', 'aria-expanded': isOpen ? 'true' : 'false', text: isOpen ? '▾' : '▸',
        onclick: function (e) { e.stopPropagation(); S.open[node.id] = !isOpen; renderTree(); } }) : photoDot || h('span', { class: 'row__sp' }),
      h('span', { class: 'row__main' }, [
        h('span', { class: 'row__lb' }, [h('b', { text: TYPE_LABEL(node) }), rowTitle(node) ? ' «' + rowTitle(node) + '»' : '']),
        rowTag(node) || miss.length ? h('span', { class: 'row__sub' }, [rowTag(node), miss.length ? h('span', { class: 'row__miss', text: (rowTag(node) ? ' · ' : '') + t('tree.no_translation', { langs: miss.join(', ').toUpperCase() }) }) : null]) : null
      ]),
      h('button', { type: 'button', class: 'row__eye', title: node.hidden ? t('tree.show') : t('tree.hide'), text: node.hidden ? '◌' : '◉',
        onclick: function (e) { e.stopPropagation(); node.hidden = !node.hidden; changed(); renderForm(); } }),
      h('button', { type: 'button', class: 'row__x', title: t('tree.delete'), text: '✕',
        onclick: function (e) { e.stopPropagation(); removeNode(node); } })
    ]);
    dragSetup(row, list, index);
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
      drag = null;
      changed();
    });
  }
  function clearDrop() {
    document.querySelectorAll('.drop-before, .drop-after').forEach(function (el) { el.classList.remove('drop-before', 'drop-after'); });
  }

  /* ---------------------------------------------------------------- добавить и удалить */

  var BLOCK_TYPES = ['text', 'photo', 'tiles', 'map', 'pay', 'service'];
  function addBlockMenu(anchor, list, ownerTile) {
    closeMenus();
    var menu = h('div', { class: 'menu', role: 'menu' });
    BLOCK_TYPES.forEach(function (type) {
      var taken = (type === 'map' || type === 'pay') && list.some(function (b) { return b.type === type; });
      var item = h('button', { type: 'button', role: 'menuitem', disabled: taken, onclick: function () { closeMenus(); addBlock(list, type, ownerTile); } }, [
        h('b', { text: t('type.' + type) }), h('small', { text: taken ? t('add.taken') : t('add.hint.' + type) })
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
    if (ownerTile) S.open[ownerTile.id] = true;
    changed();
    select(String(b.id));
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
    (node.tiles || []).forEach(function (tl) { n += 1 + countInside(tl); });
    (node.blocks || []).forEach(function (b) { n += 1 + countInside(b); });
    return n;
  }

  function removeNode(node) {
    var name = rowTitle(node) || TYPE_LABEL(node);
    var inside = countInside(node);
    var msg = inside ? t('delete.confirm_all', { name: name, n: inside }) : t('delete.confirm', { name: name });
    confirmBox(msg, t('delete.hint'), t('tree.delete'), true).then(function (ok) {
      if (!ok) return;
      var i = IDX[node.id];
      i.list.splice(i.list.indexOf(node), 1);
      if (S.sel === String(node.id)) S.sel = i.tile ? String(i.tile.id) : (i.block ? String(i.block.id) : 'header');
      changed();
      renderForm();
    });
  }

  /* ---------------------------------------------------------------- выбор */

  function select(key) {
    S.sel = String(key);
    var i = IDX[isNaN(+key) ? key : +key] || IDX[key];
    // Раскрыть родителей выбранного.
    if (i) {
      if (i.block) S.open[i.block.id] = true;
      if (i.tile) S.open[i.tile.id] = true;
      var up = i.tile && IDX[i.tile.id];
      if (up && up.block) S.open[up.block.id] = true;
    }
    renderTree();
    renderForm();
    var path = previewPathFor(key);
    if (path !== S.pvPath) { S.pvPath = path; S.scrollY = 0; loadPreview(); }
    else highlight();
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
    if (k === 'header') formHeader(root);
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
    var er = S.errors.filter(function (e) { return errKey(e) === String(node && node.id) && e.field === key && (!e.lang || e.lang === S.lang); })[0];
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
    var i = IDX[node.id];
    if (i && i.tile) parts.push(txAny(i.tile.title) || t('type.tile'));
    return parts.join(' / ');
  }

  function formElement(root, node) {
    var k = kindOf(node);
    formHead(root, TYPE_LABEL(node), pathOf(node), node);
    langTabs(root, node);
    var M = S.meta.max[k] || {};
    var f = h('div', { class: 'fbody' });
    root.appendChild(f);
    FORMS[k](f, node, M);
    root.appendChild(h('div', { class: 'ffoot' }, [h('button', { type: 'button', class: 'btn btn--danger', text: t('tree.delete'), onclick: function () { removeNode(node); } })]));
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
      var i = IDX[tl.id];
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
          S.open[tl.id] = true; S.pvPath = '/' + slugOf(tl); S.scrollY = 0; renderTree(); loadPreview();
        } }));
        if (tl.photo) f.appendChild(headPhotoField(tl));
      } else if (o === 'popup') {
        f.appendChild(h('button', { type: 'button', class: 'btn btn--ghost', text: t('form.show_popup'), onclick: function () { S.pvPath = popupPath(tl); S.scrollY = 0; loadPreview(); } }));
      }
      f.appendChild(seoBox(tl, M));
    },
    wine: function (f, tl, M) {
      f.appendChild(photoField(tl, 'photo', '4:5'));
      f.appendChild(textField(tl, 'title', t('field.name'), M.title));
      f.appendChild(textField(tl, 'subtitle', t('field.wine_subtitle'), M.subtitle, { hint: t('hint.wine_subtitle') }));
      f.appendChild(h('div', { class: 'two' }, [
        select_(t('field.wine_sweet'), [[null, '—']].concat(['dry', 'semidry', 'semisweet', 'sweet'].map(function (k) { return [k, t('wine.sweet.' + k)]; })), tl.wine_sweet, function (v) { tl.wine_sweet = v; changed(); }),
        select_(t('field.wine_color'), [[null, '—']].concat(['red', 'white', 'rose', 'amber'].map(function (k) { return [k, t('wine.color.' + k)]; })), tl.wine_color, function (v) { tl.wine_color = v; changed(); })
      ]));
      f.appendChild(textField(tl, 'grape', t('field.grape'), M.grape));
      f.appendChild(h('div', { class: 'two' }, [
        plainField(tl, 'vintage', t('field.vintage'), { number: true, inputmode: 'numeric', placeholder: '2019' }),
        plainField(tl, 'price', t('field.price') + ' (' + S.site.settings.currency + ')', { number: true, inputmode: 'decimal', hint: S.site.settings.show_prices ? t('hint.price_on') : t('hint.price_off') })
      ]));
      f.appendChild(textField(tl, 'text', t('field.wine_text'), M.text, { area: true, rows: 6, hint: t('hint.wine_text') }));
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
        plainField(b, 'price', t('field.price') + ' (' + S.site.settings.currency + ')', { number: true, inputmode: 'decimal', hint: t('hint.price_empty') }),
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
    var i = IDX[b.id];
    var blocks = i.tile ? i.tile.blocks : S.site.blocks;
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
    var i = IDX[tl.id];
    return (i.tile ? '/' + slugOf(i.tile) : '') + '/' + (slugOf(tl) || '');
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
    S.site.blocks.forEach(function (b) { if (b.type === 'tiles' && !b.hidden && b.kind !== 'wine') b.tiles.forEach(function (tl) { if (!tl.hidden && opens(tl)) n++; }); });
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
      f.appendChild(h('div', { class: 'two' }, [
        select_(t('field.currency'), [['RUB', 'RUB ₽'], ['GEL', 'GEL ₾'], ['EUR', 'EUR €'], ['USD', 'USD $']], s.currency, function (v) { s.currency = v; changed(); }),
        select_(t('field.req_format'), [['RU', t('fmt.RU')], ['GE', t('fmt.GE')], ['other', t('fmt.other')]], s.req_format, function (v) { s.req_format = v; changed(); renderForm(); })
      ]));
      f.appendChild(select_(t('field.operator'), [[null, '—']].concat(S.site.operators.map(function (o) { return [o.id, o.name || '—']; })), s.operator, function (v) {
        s.operator = v === null ? null : (isNaN(+v) ? v : +v); changed();
      }, t('hint.operator')));
      f.appendChild(seg(t('field.maps'), [['google', 'Google'], ['yandex', t('maps.yandex')]], s.maps, function (v) { s.maps = v; changed(); renderForm(); }, t('hint.maps')));
      f.appendChild(toggle(t('field.show_prices'), s.show_prices, function (v) { s.show_prices = v; changed(); }));
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
    }
  };

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
        var fmt = S.site.settings.req_format;
        REQ_FIELDS[fmt].forEach(function (k) { card.appendChild(plainField(m.req, k, t('req.' + (fmt === 'other' && k === 'iban' ? 'iban_account' : k)))); });
        if (!m.req.purpose || typeof m.req.purpose !== 'object') m.req.purpose = {};
        card.appendChild(textField(m.req, 'purpose', t('req.purpose'), 140, { placeholder: t('req.purpose_default') }));
      }
      box.appendChild(card);
    });
    var addBtn = h('button', { type: 'button', class: 'btn btn--ghost', text: '+ ' + t('pay.add'), onclick: function (e) {
      closeMenus();
      var fmt = S.site.settings.req_format;
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

  function photoField(node, key, aspect) {
    var p = node[key];
    var thumb;
    if (p) {
      thumb = h('img', { class: 'ph__img ph__img--' + aspect.replace(':', 'x'), alt: '', src: p._thumb || (p.crop || p.aspect === aspect ? p.thumb : '/admin/api/original?id=' + p.id) });
    } else {
      thumb = h('span', { class: 'ph__none ph__img--' + aspect.replace(':', 'x'), text: t('photo.none') });
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
        openEditor(j.photo, aspect, false, function (res) {
          node[key] = Object.assign(j.photo, res);
          changed(); renderForm();
        });
      }).catch(function () { setBusy(null); alertBox(t('photo.upload_failed')); });
    });
    var acts = h('div', { class: 'ph__acts' }, [
      h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: p ? t('photo.replace') : t('photo.upload'), onclick: function () { input.click(); } }),
      p ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', text: t('photo.crop'), onclick: function () {
        openEditor(p, aspect, false, function (res) { Object.assign(p, res); changed(); renderForm(); });
      } }) : null,
      p ? h('button', { type: 'button', class: 'linkbtn linkbtn--danger', text: t('photo.remove'), onclick: function () { node[key] = null; changed(); renderForm(); } }) : null,
      input
    ]);
    return h('div', { class: 'fld ph' }, [h('span', { class: 'fld__l', text: t('field.photo') + ' · ' + t('frame.' + aspect) }), h('div', { class: 'ph__row' }, [thumb, acts])]);
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
  function openEditor(photo, aspect, head, onApply) {
    var ratio = aspect === '3:2' ? 3 / 2 : 4 / 5;
    var img = h('img', { alt: '', src: '/admin/api/original?id=' + photo.id });
    var zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1' });
    var straight = h('input', { type: 'range', min: '-10', max: '10', step: '0.1', value: '0', disabled: head });
    var warn = h('p', { class: 'hint hint--warn', hidden: true, text: t('photo.small') });
    var previews = h('div', { class: 'ed__pv' }, [1280, 768, 390].map(function (w) {
      return h('div', { class: 'ed__pvi' }, [h('div', { class: 'ed__pvbox ed__pvbox--' + aspect.replace(':', 'x') + ' ed__pvbox--' + w }), h('small', { text: w + ' px' })]);
    }));
    var base90 = 0, baseRatio = 1, cropper = null;
    var box = h('div', { class: 'ed', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('photo.editor') }, [
      h('div', { class: 'ed__h' }, [h('h3', { text: head ? t('photo.head') : t('photo.editor') }), h('span', { class: 'ed__frame', text: t('frame.' + aspect) })]),
      h('div', { class: 'ed__b' }, [h('div', { class: 'ed__stage' }, [img]), h('div', { class: 'ed__side' }, [h('b', { text: t('photo.how') }), previews, warn])]),
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
    if (!i) return key === 'footer' || key === 'header' || key.indexOf('set:') === 0 ? S.pvPath : '/';
    if (i.kind === 'tile') {
      var o = opens(i.node);
      if (o === 'page' || o === 'static') return '/' + slugOf(i.node);
      if (o === 'popup' && slugOf(i.node)) return popupPath(i.node);
    }
    return i.tile ? '/' + slugOf(i.tile) : '/';
  }

  function loadPreview() {
    var frames = document.querySelectorAll('.pv__frame');
    if (!frames.length) return;
    var front = $('.pv__frame:not(.is-back)'), back = $('.pv__frame.is-back');
    var url = '/admin/preview?path=' + encodeURIComponent(S.pvPath) + '&lang=' + encodeURIComponent(S.pvLang || '') + '&y=' + Math.round(S.scrollY) + '&r=' + (++S.seq);
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
        var i = IDX[id];
        if (i) { if (i.block) S.open[i.block.id] = true; if (i.tile) S.open[i.tile.id] = true; }
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
    api('POST', 'save', { site: S.site }).then(function (j) {
      S.saving = false;
      if (!j.ok) {
        S.errors = j.errors || [];
        S.warnings = j.warnings || [];
        renderStatus(); renderTree(); renderForm();
        flash(t('save.failed'), 'err');
        return;
      }
      var ids = j.ids || {};
      var sel = S.sel;
      if (ids[sel]) sel = String(ids[sel]);
      Object.keys(S.open).forEach(function (k) { if (ids[k]) S.open[ids[k]] = S.open[k]; });
      S.site = j.site;
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
  function alertBox(text) {
    var ov = h('div', { class: 'mo' }, [h('div', { class: 'mbox', role: 'alertdialog', 'aria-modal': 'true' }, [
      h('p', { text: text }), h('div', { class: 'mbox__acts' }, [h('button', { type: 'button', class: 'btn btn--action', text: 'OK', onclick: function () { ov.remove(); } })])
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
