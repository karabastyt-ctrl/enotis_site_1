<!doctype html>
<html lang="<?= e(current_lang()) ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title ?? '') ?></title>
  <link rel="stylesheet" href="/assets/css/theme.css">
</head>
<body>
<main class="page"><?= $content ?></main>
</body>
</html>
