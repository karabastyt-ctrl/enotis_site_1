<section class="wrap blk services<?= count($group) > 1 ? ' services--grid' : '' ?>">
<?php foreach ($group as $s): ?>
  <article class="svc"<?= eid($s['id']) ?>>
    <h2><?= e($s['title']) ?></h2>
<?php   foreach (paragraphs($s['body']) as $p): ?>
    <p><?= e($p) ?></p>
<?php   endforeach ?>
    <p class="svc__price">
      <span class="price"><?= $s['price'] !== null ? e(money((float) $s['price'])) : e(t('service.price_free')) ?></span>
<?php   if ($s['price_note']): ?>
      <span class="svc__note">· <?= e($s['price_note']) ?></span>
<?php   endif ?>
    </p>
    <a class="btn" href="<?= e($s['link_url']) ?>" target="_blank" rel="noopener"><?= e($s['button_label']) ?></a>
<?php   if ($s['recipient']): ?>
    <p class="fine"><?= e(t('service.by')) ?> <?= e($s['recipient']) ?></p>
<?php   endif ?>
  </article>
<?php endforeach ?>
</section>
