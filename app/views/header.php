<?php
if (setting('header_show', '1') !== '1') {
    return;
}
$langs = site_languages();
$logo = setting('logo_path');
$withTitle = !$logo || setting('logo_with_title', '1') === '1';
$menu = [];
foreach (tiles_in(home_blocks()) as $t) {
    if (!is_wine($t) && tile_opens($t)) {
        $menu[] = $t;
    }
}
$burger = match (setting('header_burger', 'auto')) {
    'on'    => (bool) $menu,
    'off'   => false,
    default => count($menu) > 6,
};
$here = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$plain = preg_replace('~^/(' . implode('|', LANGS) . ')(?=/|$)~', '', $here) ?: '/';
?>
<header class="hdr" data-header<?= eid('header') ?>>
  <div class="hdr__in">
<?php if ($back): ?>
    <a class="hdr__back" href="<?= e($back) ?>"><?= e(t('nav.back')) ?></a>
<?php endif ?>
    <a class="hdr__brand" href="<?= e(url('/')) ?>">
<?php if ($logo): ?>
      <img class="hdr__logo" src="/uploads/<?= e($logo) ?>" alt="<?= $withTitle ? '' : e(site_title()) ?>" height="40">
<?php endif ?>
<?php if ($withTitle): ?>
      <span class="hdr__title"><?= e(site_title()) ?></span>
<?php endif ?>
    </a>
<?php if (count($langs) > 1): ?>
    <nav class="langs" aria-label="<?= e(t('nav.language')) ?>">
<?php   foreach ($langs as $i => $l): ?>
      <?= $i ? '<span aria-hidden="true">·</span>' : '' ?><a href="<?= e(url($plain, $l['code'])) ?>?switch=1" hreflang="<?= e($l['code']) ?>" lang="<?= e($l['code']) ?>" title="<?= e($l['name']) ?>"<?= $l['code'] === current_lang() ? ' aria-current="true"' : '' ?>><?= e(strtoupper($l['code'])) ?></a>
<?php   endforeach ?>
    </nav>
<?php endif ?>
<?php if ($burger): ?>
    <details class="menu" data-menu>
      <summary aria-label="<?= e(t('nav.menu')) ?>"><span class="menu__icon" aria-hidden="true">☰</span></summary>
      <nav class="menu__list">
<?php   foreach ($menu as $t): ?>
        <a href="<?= e(tile_url($t)) ?>"<?= tile_opens($t) === 'popup' ? ' data-popup-link="' . e($t['slug']) . '"' : '' ?>><?= e($t['title']) ?></a>
<?php   endforeach ?>
      </nav>
    </details>
<?php endif ?>
  </div>
</header>
