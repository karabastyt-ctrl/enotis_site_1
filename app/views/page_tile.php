<?php
$GLOBALS['h1_done'] = true;
$t = $tile;
$hasPlace = $t['place'] || has_coords($t);
?>
<article class="tpage">
  <header class="tpage__top wrap"<?= eid($t['id']) ?>>
<?php if ($t['photo']): ?>
    <div class="tpage__photo frame frame--3x2"><?= photo_img($t['photo'], $t['title'], false, true, '(min-width: 768px) 480px, 100vw') ?></div>
<?php endif ?>
    <div class="tpage__text">
<?php if ($eyebrow = implode(' · ', array_filter([$tab['title'] ?? null, $t['subtitle']]))): ?>
      <p class="eyebrow"><?= e($eyebrow) ?></p>
<?php endif ?>
      <h1><?= e($t['title']) ?></h1>
<?php foreach (paragraphs($t['body']) as $p): ?>
      <p><?= e($p) ?></p>
<?php endforeach ?>
    </div>
  </header>
<?php if ($hasPlace): ?>
  <div class="wrap tpage__place"><?= view('place', ['t' => $t]) ?></div>
<?php endif ?>
  <div class="feed">
<?= view('blocks', ['blocks' => $blocks]) ?>
  </div>
</article>
<?= view('popups', ['blocks' => $blocks, 'open' => $popup, 'pageUrl' => url(feed_prefix($t['section_id']) . '/' . $t['slug'])]) ?>
