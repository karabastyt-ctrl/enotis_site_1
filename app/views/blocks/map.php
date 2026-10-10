<?php
$points = [];
foreach (map_points($b) as $t) {
    $opens = tile_opens($t);
    $points[] = [
        'lat'   => (float) $t['lat'],
        'lng'   => (float) $t['lng'],
        'title' => $t['title'],
        'url'   => $opens ? tile_url($t) : null,
        'popup' => $opens === 'popup' ? (int) $t['id'] : null,
    ];
}
?>
<section class="wrap blk map"<?= eid($b['id']) ?>>
<?php if ($b['title']): ?>
  <h2 class="map__h"><?= e($b['title']) ?></h2>
<?php endif ?>
  <div class="map__box" data-map data-attr="<?= e(t('map.attribution')) ?>" data-points="<?= e(json_encode($points, JSON_UNESCAPED_UNICODE)) ?>">
    <ul class="map__list">
<?php foreach ($points as $p): ?>
      <li><?php if ($p['url']): ?><a href="<?= e($p['url']) ?>"><?= e($p['title']) ?></a><?php else: ?><?= e($p['title']) ?><?php endif ?></li>
<?php endforeach ?>
    </ul>
  </div>
  <p class="map__hint"><?= e(t('map.hint')) ?></p>
</section>
