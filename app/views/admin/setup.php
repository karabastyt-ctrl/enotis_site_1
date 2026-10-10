<?= view('admin/head', ['ui' => $ui, 'title' => ta('setup.title', $ui)]) ?>
</head>
<body class="auth">
<main class="auth__box">
  <h1><?= e(ta('setup.title', $ui)) ?></h1>
  <p class="auth__lead"><?= e(ta('setup.lead', $ui)) ?></p>
<?php if ($error): ?>
  <p class="note note--err" role="alert"><?= e($error) ?></p>
<?php endif ?>
  <form method="post" action="/admin/setup">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label class="fld"><span><?= e(ta('login.login', $ui)) ?></span>
      <input name="login" autocomplete="username" required maxlength="60" autofocus></label>
    <label class="fld"><span><?= e(ta('profile.email', $ui)) ?></span>
      <input name="email" type="email" autocomplete="email"><small><?= e(ta('profile.email_hint', $ui)) ?></small></label>
    <label class="fld"><span><?= e(ta('profile.password_new', $ui)) ?></span>
      <input name="password" type="password" autocomplete="new-password" required minlength="8"></label>
    <label class="fld"><span><?= e(ta('profile.password_new2', $ui)) ?></span>
      <input name="password2" type="password" autocomplete="new-password" required minlength="8"></label>
    <button class="btn btn--action btn--wide"><?= e(ta('setup.submit', $ui)) ?></button>
  </form>
</main>
</body>
</html>
