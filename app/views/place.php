<?php
/** «Как добраться»: текст, мини-карта и кнопки карт (раздел 6.2). */
$svc = setting('maps', 'google');
?>
<section class="place">
  <h3 class="place__h"><?= e(t('tile.how_to_get')) ?></h3>
<?php if ($t['place']): ?>
  <p><?= e($t['place']) ?></p>
<?php endif ?>
<?php if (has_coords($t)):
    $lat = (float) $t['lat'];
    $lng = (float) $t['lng'];
    [$route, $open] = $svc === 'yandex'
        ? ["https://yandex.ru/maps/?rtext=~{$lat},{$lng}&rtt=auto", "https://yandex.ru/maps/?pt={$lng},{$lat}&z=15&l=map"]
        : ["https://www.google.com/maps/dir/?api=1&destination={$lat},{$lng}", "https://www.google.com/maps/search/?api=1&query={$lat},{$lng}"];
?>
  <div class="minimap" data-minimap data-lat="<?= e((string) $lat) ?>" data-lng="<?= e((string) $lng) ?>" data-title="<?= e($t['title']) ?>" data-attr="<?= e(t('map.attribution')) ?>"></div>
  <p class="place__btns">
    <a class="btn btn--ghost" href="<?= e($route) ?>" target="_blank" rel="noopener"><?= e(t('map.route')) ?></a>
    <a class="btn btn--ghost" href="<?= e($open) ?>" target="_blank" rel="noopener"><?= e(t($svc === 'yandex' ? 'map.open_yandex' : 'map.open_google')) ?></a>
  </p>
<?php endif ?>
</section>
