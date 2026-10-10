<?php
if (!$b['photo']) {
    return;
}
$frame = str_replace(':', 'x', $b['frame'] ?: '3:2');
$narrow = $b['photo_width'] === 'narrow';
?>
<figure class="wrap blk photo<?= $narrow ? ' photo--narrow' : '' ?>"<?= eid($b['id']) ?>>
  <div class="frame frame--<?= $frame ?>"><?= photo_img($b['photo'], $b['subtitle'] ?? '', true, false, $narrow ? '(min-width: 600px) 560px, 100vw' : '(min-width: 1180px) 1120px, 100vw') ?></div>
<?php if ($b['subtitle']): ?>
  <figcaption><?= e($b['subtitle']) ?></figcaption>
<?php endif ?>
</figure>
