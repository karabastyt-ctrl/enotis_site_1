<?php
/** Оболочка админки (раздел 10.2): дерево, форма и превью рисует admin.js по данным /admin/api/site. */
$strings = lang_strings('admin', 'ru');
$strings = array_merge($strings, lang_strings('admin', $ui));
$boot = [
    'csrf'  => $csrf,
    'ui'    => $ui,
    'admin' => ['login' => $admin['login'], 'email' => (string) $admin['email'], 'ui_lang' => $admin['ui_lang']],
    't'     => $strings,
];
?>
<?= view('admin/head', ['ui' => $ui, 'title' => ta('app.title', $ui)]) ?>
  <link rel="stylesheet" href="/assets/vendor/cropper/cropper.min.css?v=<?= ENGINE_VERSION ?>">
  <script src="/assets/vendor/cropper/cropper.min.js?v=<?= ENGINE_VERSION ?>" defer></script>
  <script src="/assets/js/admin.js?v=<?= ENGINE_VERSION ?>" defer></script>
  <script type="application/json" id="boot"><?= json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) ?></script>
</head>
<body class="app">
<header class="top">
  <div class="top__site" data-site-name></div>
  <div class="top__status" data-status></div>
  <div class="top__acts">
    <a class="btn btn--ghost" href="/" target="_blank" rel="noopener"><?= e(ta('top.open_site', $ui)) ?></a>
    <button type="button" class="btn btn--action" data-save disabled><?= e(ta('top.save', $ui)) ?></button>
    <details class="pmenu">
      <summary class="btn btn--ghost"><?= e(ta('profile.title', $ui)) ?> ▾</summary>
      <div class="pmenu__list">
        <button type="button" data-profile><?= e(ta('profile.open', $ui)) ?></button>
        <form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="<?= e($csrf) ?>"><button><?= e(ta('profile.logout', $ui)) ?></button></form>
      </div>
    </details>
  </div>
</header>
<div class="upbar" data-upbar></div>
<main class="cols">
  <nav class="tree" data-tree aria-label="<?= e(ta('tree.label', $ui)) ?>"><p class="muted pad"><?= e(ta('app.loading', $ui)) ?></p></nav>
  <section class="form" data-form></section>
  <section class="pv" data-preview></section>
</main>
<footer class="foot" data-foot></footer>
<noscript><p class="note note--err pad"><?= e(ta('app.need_js', $ui)) ?></p></noscript>
</body>
</html>
