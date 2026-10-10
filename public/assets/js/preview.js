/* Превью в админке (спецификация 2.1, раздел 10.8): нажатие на элемент открывает его в форме,
   ссылки не уводят с превью, выбранный элемент подсвечен. Подключается только в /admin/preview. */
(function () {
  'use strict';
  var parent = window.parent;
  if (!parent || parent === window) return;
  var origin = location.origin;
  function send(msg) { parent.postMessage(msg, origin); }

  var y = +(new URLSearchParams(location.search).get('y') || 0);
  if (y) {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    window.addEventListener('load', function () { window.scrollTo(0, y); });
  }
  var timer = null;
  window.addEventListener('scroll', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { send({ type: 'scroll', y: window.scrollY }); }, 150);
  }, { passive: true });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-eid]');
    if (el) send({ type: 'select', eid: el.getAttribute('data-eid') });
    var a = e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-popup-link') || a.hasAttribute('data-pay-open') || a.hasAttribute('data-close')) return;
    var href = a.getAttribute('href');
    if (href.charAt(0) === '#') return;
    e.preventDefault();
    var u = new URL(href, location.href);
    if (u.origin !== origin) return; // внешние ссылки (оплата, соцсети) в превью не открываются
    send({ type: 'nav', path: u.pathname });
  }, true);

  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'hl') return;
    document.querySelectorAll('.pv-hl').forEach(function (el) { el.classList.remove('pv-hl'); });
    var el = document.querySelector('[data-eid="' + CSS.escape(e.data.eid) + '"]');
    if (!el) return;
    el.classList.add('pv-hl');
    if (e.data.scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
})();
