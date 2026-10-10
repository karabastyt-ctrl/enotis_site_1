<?php
/** @var string $content */
$title ??= site_title();
$desc = isset($description) && $description !== null ? mb_substr(preg_replace('/\s+/u', ' ', $description), 0, 160) : null;
$langs = site_languages();
$section ??= null;
$locale = ['ru' => 'ru_RU', 'ka' => 'ka_GE', 'en' => 'en_US', 'fr' => 'fr_FR'][current_lang()];
$cookie = setting('cookie_notice', '1') === '1';
$cookieDoc = doc('cookies');
?>
<!doctype html>
<html lang="<?= e(current_lang()) ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?= e($title) ?></title>
<?php if ($desc): ?>
  <meta name="description" content="<?= e($desc) ?>">
<?php endif ?>
<?php if (isset($local) && $path !== null):
    $canon = canonical_url($local, $section);
    $img = og_image($image ?? null);
    $ld = page_jsonld(get_defined_vars());
?>
  <link rel="canonical" href="<?= e($canon) ?>">
<?php   if (count($langs) > 1): foreach ($langs as $l): ?>
  <link rel="alternate" hreflang="<?= e($l['code']) ?>" href="<?= e(canonical_url($local, $section, $l['code'])) ?>">
<?php   endforeach ?>
  <link rel="alternate" hreflang="x-default" href="<?= e(canonical_url($local, $section, default_lang())) ?>">
<?php   endif ?>
  <meta property="og:type" content="<?= ($jsonld ?? null) === 'website' ? 'website' : 'article' ?>">
  <meta property="og:title" content="<?= e($title) ?>">
<?php   if ($desc): ?>
  <meta property="og:description" content="<?= e($desc) ?>">
<?php   endif ?>
  <meta property="og:url" content="<?= e($canon) ?>">
<?php   if ($img): ?>
  <meta property="og:image" content="<?= e($img) ?>">
  <meta name="twitter:card" content="summary_large_image">
<?php   endif ?>
  <meta property="og:site_name" content="<?= e(site_title()) ?>">
  <meta property="og:locale" content="<?= e($locale) ?>">
<?php   if ($ld): ?>
  <script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
<?php   endif ?>
<?php endif ?>
  <?= favicon_tags() ?>

  <link rel="preload" href="/assets/fonts/golos-400-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/playfair-600-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/fonts/fonts.css?v=<?= ENGINE_VERSION ?>">
  <link rel="stylesheet" href="/assets/css/theme.css?v=<?= ENGINE_VERSION ?>">
  <link rel="stylesheet" href="/assets/css/site.css?v=<?= ENGINE_VERSION ?>">
  <script src="/assets/js/site.js?v=<?= ENGINE_VERSION ?>" defer></script>
<?php if (!preview_mode() && ($code = setting('counter_code'))): ?>
  <?= $code /* код счётчика из админки, вставляется как есть (раздел 9.2) */ ?>
<?php endif ?>
</head>
<body<?= !empty($popup) ? ' class="is-locked"' : '' ?>>
<a class="skip" href="#main"><?= e(t('site.skip')) ?></a>
<?= view('header', ['back' => $back ?? null]) ?>
<main id="main"><?= $content ?></main>
<?= view('footer') ?>
<?php if ($cookie): ?>
<div class="cookie" data-cookie hidden>
  <p><?= e(t('cookie.text')) ?><?php if ($cookieDoc): ?> <a href="<?= e(url('/doc/cookies')) ?>"><?= e(t('cookie.more')) ?></a><?php endif ?></p>
  <button type="button" class="btn btn--ghost" data-cookie-ok><?= e(t('cookie.ok')) ?></button>
</div>
<?php endif ?>
</body>
</html>
