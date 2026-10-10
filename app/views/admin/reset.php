<?= view('admin/head', ['ui' => $ui, 'title' => ta('reset.title', $ui)]) ?>
</head>
<body class="auth">
<main class="auth__box">
  <h1><?= e(ta('reset.title', $ui)) ?></h1>
<?php if ($error): ?>
  <p class="note note--err" role="alert"><?= e($error) ?></p>
<?php endif ?>
  <form method="post" action="/admin/reset">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <input type="hidden" name="token" value="<?= e($token) ?>">
    <label class="fld"><span><?= e(ta('profile.password_new', $ui)) ?></span>
      <input name="password" type="password" autocomplete="new-password" minlength="8" required autofocus>
      <small class="hint"><?= e(ta('profile.password_short', $ui)) ?></small></label>
    <label class="fld"><span><?= e(ta('profile.password_new2', $ui)) ?></span>
      <input name="password2" type="password" autocomplete="new-password" minlength="8" required></label>
    <button class="btn btn--action btn--wide"><?= e(ta('reset.submit', $ui)) ?></button>
  </form>
</main>
</body>
</html>
