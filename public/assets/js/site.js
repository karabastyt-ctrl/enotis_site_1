/* Сайт-лента: улучшения поверх готового HTML (спецификация 2.1, раздел 2, принцип 4).
   Без этого файла сайт работает: ссылки ведут на адреса поп-апов, окно оплаты открывается по якорю. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Шапка: на телефоне прячется при прокрутке вниз (раздел 5.1) ---------- */
  var header = $('[data-header]');
  if (header) {
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var phone = window.innerWidth < 600;
      header.classList.toggle('is-hidden', phone && y > 80 && y > lastY);
      lastY = y;
    }, { passive: true });
  }
  // Меню бургера закрывается выбором пункта и щелчком мимо; шапку перерисовывает переключение табов.
  document.addEventListener('click', function (e) {
    var menu = $('[data-menu]');
    if (menu && (e.target.closest('[data-menu] a') || !menu.contains(e.target))) menu.open = false;
  });

  /* ---------- Окна: ловят фокус, закрываются Esc и по затемнению ---------- */
  var FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
  var stack = [];

  function openOverlay(ov, onClose) {
    var prevFocus = document.activeElement;
    ov.classList.add('is-open');
    document.body.classList.add('is-locked');
    var dialog = $('[role="dialog"]', ov);
    stack.push({ ov: ov, onClose: onClose, prevFocus: prevFocus });
    dialog.focus();
    initMinimaps(ov);
    watchBarTitle(dialog);
  }

  function closeTop(fromHistory) {
    var top = stack.pop();
    if (!top) return;
    top.ov.classList.remove('is-open');
    if (!stack.length) document.body.classList.remove('is-locked');
    if (top.onClose) top.onClose(fromHistory);
    if (top.prevFocus && top.prevFocus.focus) top.prevFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (!stack.length) return;
    if (e.key === 'Escape') { e.preventDefault(); closeTop(false); return; }
    if (e.key !== 'Tab') return;
    var dialog = $('[role="dialog"]', stack[stack.length - 1].ov);
    var items = $$(FOCUSABLE, dialog).filter(function (el) { return el.offsetParent !== null; });
    if (!items.length) { e.preventDefault(); return; }
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  document.addEventListener('click', function (e) {
    if (!stack.length) return;
    var top = stack[stack.length - 1];
    if (e.target === top.ov || e.target.closest('[data-close]')) {
      if (top.ov.contains(e.target)) { e.preventDefault(); closeTop(false); }
    }
  });

  /* Название места в полосе поп-апа появляется, когда заголовок ушёл за верх (раздел 6.2). */
  function watchBarTitle(dialog) {
    var h = $('h2', dialog);
    if (!h || dialog.dataset.watch) return;
    dialog.dataset.watch = '1';
    dialog.addEventListener('scroll', function () {
      dialog.classList.toggle('is-scrolled', dialog.scrollTop > h.offsetTop + h.offsetHeight - 50);
    }, { passive: true });
  }

  /* ---------- Поп-апы плиток: данные уже в <template>, адрес меняется через pushState ---------- */
  var pageUrl = location.pathname;
  var pageTitle = document.title;
  var current = null;

  function openPopup(slug, push) {
    var tpl = document.getElementById('pp-' + slug);
    if (!tpl) return false;
    if (current) closeTop(true);
    var frag = tpl.content.cloneNode(true);
    var ov = frag.firstElementChild;
    document.body.appendChild(frag);
    var url = tpl.dataset.url;
    if (push) history.pushState({ popup: slug }, '', url);
    document.title = tpl.dataset.title || pageTitle;
    current = ov;
    openOverlay(ov, function (fromHistory) {
      ov.remove();
      current = null;
      document.title = pageTitle;
      if (!fromHistory) {
        if (history.state && history.state.popup) history.back();
        else history.replaceState(null, '', pageUrl);
      }
    });
    return true;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-popup-link]');
    if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    if (openPopup(a.getAttribute('data-popup-link'), true)) e.preventDefault();
  });

  window.addEventListener('popstate', function (e) {
    var slug = e.state && e.state.popup;
    if (current) closeTop(true);
    if (e.state && e.state.tab && e.state.tab !== tabUrl) loadTab(e.state.tab, false);
    if (slug) openPopup(slug, false);
  });

  /* ---------- Табы без перезагрузки (раздел 5.4): лента таба приходит фрагментом ---------- */
  var tabUrl = location.pathname;
  var tabsNav = $('[data-tabs]');
  function loadTab(href, push) {
    var box = $('[data-tab-feed]');
    if (!box || !window.fetch) { location.href = href; return; }
    box.classList.add('is-loading');
    fetch(href + (href.indexOf('?') < 0 ? '?' : '&') + 'fragment=1', { headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        box.innerHTML = j.feed;
        box.classList.remove('is-loading');
        var tmp = document.createElement('div');
        tmp.innerHTML = j.header;
        var fresh = $('.hdr__in', tmp), old = $('.hdr__in');
        if (fresh && old) old.replaceWith(fresh);
        $$('[data-tab]').forEach(function (a) {
          if (a.getAttribute('href') === href) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        tabUrl = href; pageUrl = href; pageTitle = j.title; document.title = j.title;
        if (push) history.pushState({ tab: href }, '', href);
        var top = tabsNav.getBoundingClientRect().top + window.scrollY - 16;
        if (window.scrollY > top) window.scrollTo(0, top);
        watchMaps(box);
      })
      .catch(function () { location.href = href; });
  }
  if (tabsNav) {
    if (!$('.ov.is-open[data-popup]')) history.replaceState({ tab: tabUrl }, '', location.href);
    tabsNav.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tab]');
      if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (a.getAttribute('href') !== tabUrl) loadTab(a.getAttribute('href'), true);
    });
  }

  // Поп-ап, открытый по прямому адресу, сервер отдал уже открытым.
  var opened = $('.ov.is-open[data-popup]');
  if (opened) {
    var back = $('[data-close]', opened);
    pageUrl = back ? back.getAttribute('href') : '/';
    current = opened;
    openOverlay(opened, function (fromHistory) {
      opened.remove();
      current = null;
      if (!fromHistory) history.pushState(null, '', pageUrl);
      document.title = pageTitle;
    });
  }

  /* ---------- Окно оплаты (раздел 7) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-pay-open]');
    if (!btn) return;
    var ov = document.getElementById(btn.getAttribute('data-pay-open'));
    if (!ov) return;
    e.preventDefault();
    openOverlay(ov, null);
  });
  if (location.hash && /^#pay-\d+$/.test(location.hash)) {
    var payOv = $(location.hash);
    if (payOv) { history.replaceState(null, '', location.pathname + location.search); openOverlay(payOv, null); }
  }

  $$('[data-copy]').forEach(function (btn) {
    if (!navigator.clipboard) return;
    btn.hidden = false;
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var dl = btn.parentNode.querySelector('[data-req]');
      var lines = $$('dt', dl).map(function (dt) { return dt.textContent + ': ' + dt.nextElementSibling.textContent; });
      navigator.clipboard.writeText(lines.join('\n')).then(function () {
        btn.textContent = btn.getAttribute('data-copied');
        setTimeout(function () { btn.textContent = label; }, 2000);
      });
    });
  });

  /* ---------- Карты: Leaflet грузится, только когда карта видна (раздел 5.6) ---------- */
  var leafletReady = null;
  function loadScript(src) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }
  function leaflet(cluster) {
    if (!leafletReady) {
      loadCss('/assets/vendor/leaflet/leaflet.css');
      leafletReady = loadScript('/assets/vendor/leaflet/leaflet.js');
    }
    if (!cluster) return leafletReady;
    return leafletReady.then(function () {
      if (window.L && L.markerClusterGroup) return;
      loadCss('/assets/vendor/markercluster/MarkerCluster.css');
      loadCss('/assets/vendor/markercluster/MarkerCluster.Default.css');
      return loadScript('/assets/vendor/markercluster/leaflet.markercluster.js');
    });
  }
  function tiles(map, attr) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">' + attr + '</a>'
    }).addTo(map);
    map.attributionControl.setPrefix(false);
  }
  function marker(lat, lng) {
    return L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<span class="marker"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }) });
  }
  // Колесо мыши не приближает, пока по карте не кликнули.
  function wheelAfterClick(map) {
    map.scrollWheelZoom.disable();
    map.once('click focus', function () { map.scrollWheelZoom.enable(); });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function initMap(box) {
    var points = JSON.parse(box.getAttribute('data-points') || '[]');
    if (!points.length) return;
    var cluster = points.length > 30;
    leaflet(cluster).then(function () {
      box.innerHTML = '';
      box.classList.add('is-map');
      var map = L.map(box, { zoomControl: true });
      tiles(map, box.getAttribute('data-attr'));
      wheelAfterClick(map);
      var group = cluster ? L.markerClusterGroup({ showCoverageOnHover: false }) : L.featureGroup();
      points.forEach(function (p) {
        var m = marker(p.lat, p.lng);
        m.bindTooltip(escapeHtml(p.title), { direction: 'top', offset: [0, -8] });
        if (p.url) {
          m.on('click', function () {
            if (!(p.popup && openPopup(p.popup, true))) location.href = p.url;
          });
        }
        group.addLayer(m);
      });
      group.addTo(map);
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 13);
      else map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 13 });
    });
  }

  function initMinimaps(root) {
    $$('[data-minimap]', root).forEach(function (box) {
      if (box.dataset.ready) return;
      box.dataset.ready = '1';
      leaflet(false).then(function () {
        var lat = parseFloat(box.getAttribute('data-lat')), lng = parseFloat(box.getAttribute('data-lng'));
        // На телефоне одним пальцем прокручивается поп-ап, карта — щипком.
        var map = L.map(box, { dragging: !L.Browser.mobile, tap: false }).setView([lat, lng], 13);
        tiles(map, box.getAttribute('data-attr'));
        wheelAfterClick(map);
        marker(lat, lng).addTo(map);
      });
    });
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { io.unobserve(en.target); initMap(en.target); }
    });
  }, { rootMargin: '300px' }) : null;
  function watchMaps(root) {
    $$('[data-map]', root).forEach(function (m) { if (io) io.observe(m); else initMap(m); });
  }
  watchMaps(document);
  // Мини-карта на странице плитки («Как добраться» вне поп-апа).
  $$('[data-minimap]').forEach(function (box) { if (!box.closest('.ov')) initMinimaps(box.parentNode); });

  /* ---------- Cookies (раздел 8) ---------- */
  var bar = $('[data-cookie]');
  if (bar) {
    var seen = false;
    try { seen = localStorage.getItem('cookie_ok') === '1'; } catch (e) { /* приватный режим */ }
    if (!seen) bar.hidden = false;
    $('[data-cookie-ok]', bar).addEventListener('click', function () {
      try { localStorage.setItem('cookie_ok', '1'); } catch (e) { /* ничего */ }
      bar.hidden = true;
    });
  }
})();
