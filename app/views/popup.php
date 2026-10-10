<?php
$wine = is_wine($t);
$frame = $wine ? '4x5' : str_replace(':', 'x', node($t['parent_id'])['frame'] ?? '4:5');
$hid = 'pp-title-' . $t['id'];
?>
<div class="ov<?= $isOpen ? ' is-open' : '' ?>" data-overlay data-popup="<?= e($t['slug']) ?>">
  <div class="pp<?= $wine ? ' pp--wine' : '' ?>" role="dialog" aria-modal="true" aria-labelledby="<?= $hid ?>" tabindex="-1">
    <div class="pp__bar">
      <a class="pp__back" href="<?= e($pageUrl) ?>" data-close><?= e(t('nav.to_list')) ?></a>
      <span class="pp__name" aria-hidden="true"><?= e($t['title']) ?></span>
      <a class="pp__x" href="<?= e($pageUrl) ?>" data-close aria-label="<?= e(t('popup.close')) ?>">×</a>
    </div>
    <div class="pp__body">
<?php if ($t['photo']): ?>
      <div class="pp__photo frame frame--<?= $frame ?><?= $wine ? ' frame--wine' : '' ?>"><?= photo_img($t['photo'], $t['title'], !$isOpen, false, '(min-width: 700px) 640px, 100vw') ?></div>
<?php elseif ($wine): ?>
      <div class="pp__photo frame frame--4x5 frame--wine"><?= view('bottle') ?></div>
<?php endif ?>
      <h2 id="<?= $hid ?>"><?= e($t['title']) ?></h2>
<?php if ($t['subtitle']): ?>
      <p class="pp__sub<?= $wine ? ' smallcaps' : '' ?>"><?= e($t['subtitle']) ?></p>
<?php endif ?>
<?php if ($wine && ($line = wine_line($t))): ?>
      <p class="wine__line"><?= e($line) ?></p>
<?php endif ?>
<?php foreach (paragraphs($t['body']) as $p): ?>
      <p><?= e($p) ?></p>
<?php endforeach ?>
<?php if ($wine && show_prices() && $t['price'] !== null): ?>
      <p class="price"><?= e(money((float) $t['price'])) ?></p>
<?php endif ?>
<?php if (!$wine && ($t['place'] || has_coords($t))): ?>
<?= view('place', ['t' => $t]) ?>
<?php endif ?>
    </div>
  </div>
</div>
