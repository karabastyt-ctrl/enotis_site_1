<?= view('admin/head', ['ui' => $ui, 'title' => ta('forgot.title', $ui)]) ?>
</head>
<body class="auth">
<main class="auth__box">
  <h1><?= e(ta('forgot.title', $ui)) ?></h1>
<?php if ($notice): ?>
  <p class="note note--ok" role="status"><?= e($notice) ?></p>
<?php endif ?>
<?php if ($error): ?>
  <p class="note note--err" role="alert"><?= e($error) ?></p>
<?php endif ?>
<?php if (!$notice): ?>
  <p class="auth__lead"><?= e(ta('forgot.lead', $ui)) ?></p>
  <form method="post" action="/admin/forgot">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label class="fld"><span><?= e(ta('forgot.who', $ui)) ?></span>
      <input name="login" autocomplete="username" required autofocus></label>
    <button class="btn btn--action btn--wide"><?= e(ta('forgot.submit', $ui)) ?></button>
  </form>
<?php endif ?>
  <p class="auth__hint"><a href="/admin"><?= e(ta('forgot.back', $ui)) ?></a></p>
  <p class="auth__hint"><?= e(ta('forgot.no_mail', $ui)) ?></p>
</main>
</body>
</html>
