<?php
$wine = $b['tiles_kind'] === 'wine';
$size = $b['tiles_size'] ?: ($wine ? 'compact' : 'large');
$frame = $wine ? '4x5' : str_replace(':', 'x', $b['frame'] ?: '4:5');
$tiles = visible_children($b);
$GLOBALS['eager'] ??= 3;
// Бейдж таба на плитках уровня 1 в ленте таба; на адресе одного таба его нет (раздел 5.4).
$badge = ($b['section_id'] !== null && $b['parent_id'] === null && !single_tab()) ? (sections()[$b['section_id']]['title'] ?? null) : null;
$sizes = $size === 'large' ? '(min-width: 1024px) 360px, (min-width: 600px) 50vw, 100vw'
                           : '(min-width: 1024px) 270px, (min-width: 600px) 33vw, 50vw';
?>
<section class="wrap blk tiles tiles--<?= e($size) ?><?= $wine ? ' tiles--wine' : '' ?>"<?= eid($b['id']) ?>>
<?php if ($b['title']): ?>
  <h2 class="tiles__h"><?= e($b['title']) ?></h2>
<?php endif ?>
  <ul class="grid">
<?php foreach ($tiles as $t):
    $opens = tile_opens($t);
    $lazy = $GLOBALS['eager']-- <= 0;
    $tag = $opens ? 'a' : 'div';
    $attr = $opens ? ' href="' . e(tile_url($t)) . '"' . ($opens === 'popup' ? ' data-popup-link="' . (int) $t['id'] . '"' : '') : '';
?>
    <li<?= eid($t['id']) ?>>
      <<?= $tag ?> class="card<?= $wine ? ' card--wine' : '' ?>"<?= $attr ?>>
<?php if ($t['photo']): ?>
        <span class="frame frame--<?= $frame ?><?= $wine ? ' frame--wine' : '' ?>"><?= photo_img($t['photo'], $t['title'], $lazy, false, $sizes) ?><?php if ($badge && !$wine): ?><span class="badge"><?= e($badge) ?></span><?php endif ?></span>
<?php elseif ($wine): ?>
        <span class="frame frame--4x5 frame--wine"><?= view('bottle') ?></span>
<?php endif ?>
        <span class="card__plate">
          <span class="card__text">
            <span class="card__title"><?= e($t['title']) ?></span>
<?php if ($wine): ?>
            <?= view('wine_facts', ['t' => $t, 'tag' => 'span']) ?>
<?php elseif ($t['subtitle']): ?>
            <span class="card__sub"><?= e($t['subtitle']) ?></span>
<?php endif ?>
<?php if ($wine && show_prices() && $t['price'] !== null): ?>
            <span class="price"><?= e(money((float) $t['price'])) ?></span>
<?php endif ?>
          </span>
<?php if ($opens): ?>
          <span class="card__icon" aria-hidden="true"><?= $opens === 'page' ? '→' : '+' ?></span>
<?php endif ?>
        </span>
      </<?= $tag ?>>
    </li>
<?php endforeach ?>
  </ul>
</section>
