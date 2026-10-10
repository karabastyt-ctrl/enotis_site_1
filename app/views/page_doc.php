<article class="wrap doc">
  <h1><?= e($doc['title']) ?></h1>
<?php foreach (paragraphs($doc['body']) as $p): ?>
  <p><?= e($p) ?></p>
<?php endforeach ?>
</article>
