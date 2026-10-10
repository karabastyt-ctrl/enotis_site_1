<?php
$tag = 'h2';
if (!$GLOBALS['h1_done'] && $b['title']) {
    $tag = 'h1';
    $GLOBALS['h1_done'] = true;
}
$size = $b['title_size'] ?: 'm';
$body = $b['body_size'] ?: 'normal';
$intro = $b['eyebrow'] && $size === 'l';
?>
<section class="wrap blk text text--<?= e($body) ?><?= $intro ? ' text--intro' : '' ?>"<?= eid($b['id']) ?>>
<?php if ($b['eyebrow']): ?>
  <p class="eyebrow"><?= e($b['eyebrow']) ?></p>
<?php endif ?>
<?php if ($b['title']): ?>
  <<?= $tag ?> class="title title--<?= e($size) ?>"><?= e($b['title']) ?></<?= $tag ?>>
<?php endif ?>
<?php if ($b['subtitle']): ?>
  <p class="subtitle"><?= e($b['subtitle']) ?></p>
<?php endif ?>
<?php foreach (paragraphs($b['body']) as $p): ?>
  <p><?= e($p) ?></p>
<?php endforeach ?>
</section>
