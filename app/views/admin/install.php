<?= view('admin/head', ['ui' => $ui, 'title' => ta('install.title', $ui)]) ?>
</head>
<body class="auth">
<main class="auth__box auth__box--wide">
  <h1><?= e(ta('install.title', $ui)) ?></h1>
  <p class="auth__lead"><?= e(ta('install.lead', $ui)) ?></p>
  <ul class="checks">
<?php foreach ($checks as $k => [$ok, $must]): ?>
    <li class="checks__i <?= $ok ? 'is-ok' : ($must ? 'is-bad' : 'is-warn') ?>"><?= $ok ? '✓' : ($must ? '✕' : '!') ?> <?= e(ta('install.check.' . $k, $ui)) ?><?php if (!$ok): ?> <small><?= e(ta($must ? 'install.must' : 'install.warn.' . $k, $ui)) ?></small><?php endif ?></li>
<?php endforeach ?>
  </ul>
<?php if ($blocked): ?>
  <p class="note note--err" role="alert"><?= e(ta('install.blocked', $ui)) ?></p>
<?php else: ?>
<?php if ($error): ?>
  <p class="note note--err" role="alert"><?= e($error) ?></p>
<?php endif ?>
  <form method="post" action="/admin/install">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label class="fld"><span><?= e(ta('install.site_title', $ui)) ?></span>
      <input name="site_title" required maxlength="40" autofocus value="<?= e((string) ($v['site_title'] ?? '')) ?>"></label>
    <div class="two">
      <label class="fld"><span><?= e(ta('install.site_lang', $ui)) ?></span>
        <select name="site_lang"><?php foreach (LANGS as $l): ?><option value="<?= e($l) ?>"<?= ($v['site_lang'] ?? 'ru') === $l ? ' selected' : '' ?>><?= e(ta('ui_lang.' . $l, $ui)) ?></option><?php endforeach ?></select></label>
      <label class="fld"><span><?= e(ta('profile.ui_lang', $ui)) ?></span>
        <select name="ui_lang" onchange="location.href='/admin/install?ui='+this.value"><?php foreach (LANGS as $l): ?><option value="<?= e($l) ?>"<?= $ui === $l ? ' selected' : '' ?>><?= e(ta('ui_lang.' . $l, $ui)) ?></option><?php endforeach ?></select></label>
    </div>
    <label class="fld"><span><?= e(ta('login.login', $ui)) ?></span>
      <input name="login" autocomplete="username" required maxlength="60" value="<?= e((string) ($v['login'] ?? '')) ?>"></label>
    <label class="fld"><span><?= e(ta('profile.email', $ui)) ?></span>
      <input name="email" type="email" autocomplete="email" required value="<?= e((string) ($v['email'] ?? '')) ?>"><small><?= e(ta('profile.email_hint', $ui)) ?></small></label>
    <label class="fld"><span><?= e(ta('profile.password_new', $ui)) ?></span>
      <input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
    <label class="fld"><span><?= e(ta('profile.password_new2', $ui)) ?></span>
      <input name="password2" type="password" autocomplete="new-password" required minlength="8"></label>
    <button class="btn btn--action btn--wide"><?= e(ta('install.submit', $ui)) ?></button>
  </form>
<?php endif ?>
  <p class="auth__foot"><?= e(ta('install.version', $ui)) ?> <?= e(ENGINE_VERSION) ?></p>
</main>
</body>
</html>
