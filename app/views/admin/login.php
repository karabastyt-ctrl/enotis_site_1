<?= view('admin/head', ['ui' => $ui, 'title' => ta('login.title', $ui)]) ?>
</head>
<body class="auth">
<main class="auth__box">
  <h1><?= e(ta('login.title', $ui)) ?></h1>
<?php if ($notice): ?>
  <p class="note note--ok"><?= e($notice) ?></p>
<?php endif ?>
<?php if ($error): ?>
  <p class="note note--err" role="alert"><?= e($error) ?></p>
<?php endif ?>
  <form method="post" action="/admin/login">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label class="fld"><span><?= e(ta('login.login', $ui)) ?></span>
      <input name="login" value="<?= e($login) ?>" autocomplete="username" required autofocus></label>
    <label class="fld"><span><?= e(ta('login.password', $ui)) ?></span>
      <input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn btn--action btn--wide"><?= e(ta('login.submit', $ui)) ?></button>
  </form>
  <p class="auth__hint"><?= e(ta('login.forgot_hint', $ui)) ?></p>
</main>
</body>
</html>
