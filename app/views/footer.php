<?php
if (setting('footer_show', '1') !== '1') {
    return;
}
$email = setting('footer_email');
$phone = setting('footer_phone');
$op = operator();
$fmt = $op ? $op['country'] : 'RU';
$docs = visible_docs();
$social = social_links();
?>
<footer class="ftr"<?= eid('footer') ?>>
  <div class="ftr__in">
    <div class="ftr__main">
      <p class="ftr__title"><?= e(site_title()) ?></p>
<?php if ($email || $phone): ?>
      <p class="ftr__contacts">
<?php   if ($email): ?><a href="mailto:<?= e($email) ?>"><?= e($email) ?></a><?php endif ?>
<?php   if ($phone): ?><a href="tel:<?= e(preg_replace('/[^\d+]/', '', $phone)) ?>"><?= e($phone) ?></a><?php endif ?>
      </p>
<?php endif ?>
<?php if ($social): ?>
      <ul class="social">
<?php   foreach ($social as $s): ?>
        <li><a href="<?= e($s['url']) ?>" target="_blank" rel="noopener" aria-label="<?= e(SOCIAL_NAMES[$s['network']] ?? $s['network']) ?>"><?= social_icon($s['network']) ?></a></li>
<?php   endforeach ?>
      </ul>
<?php endif ?>
    </div>
<?php if ($op || $docs): ?>
    <div class="ftr__legal">
<?php   if ($op): ?>
      <p><?= e(implode(' · ', array_filter([
            $op['name'],
            $op['tax_id'] ? t('op.tax_id.' . $fmt) . ' ' . $op['tax_id'] : null,
            $op['reg_no'] ? t('op.reg_no.' . $fmt) . ' ' . $op['reg_no'] : null,
            $op['address'],
        ]))) ?></p>
<?php   endif ?>
<?php   if ($docs): ?>
      <p class="ftr__docs"><?php foreach ($docs as $k => $d): ?><a href="<?= e(url('/doc/' . $k)) ?>"><?= e($d['title']) ?></a><?php endforeach ?></p>
<?php   endif ?>
    </div>
<?php endif ?>
  </div>
</footer>
