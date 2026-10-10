<?php
/** Окно оплаты (раздел 7). Без JS открывается по якорю #pay-N (CSS :target). */
$methods = pay_methods((int) $b['id']);
$format = feed_setting('req_format', 'RU');
$fields = [
    'RU'    => ['recipient' => 'req.recipient', 'inn' => 'req.inn', 'bank' => 'req.bank', 'bik' => 'req.bik', 'account' => 'req.account'],
    'GE'    => ['recipient' => 'req.recipient', 'code' => 'req.code', 'bank' => 'req.bank', 'iban' => 'req.iban', 'swift' => 'req.swift'],
    'other' => ['recipient' => 'req.recipient', 'bank' => 'req.bank', 'iban' => 'req.iban_account', 'swift' => 'req.swift'],
][$format] ?? [];
$offer = doc('offer');
$links = array_values(array_filter($methods, fn($m) => $m['kind'] === 'link' && $m['url']));
$qr = current(array_filter($methods, fn($m) => $m['kind'] === 'qr' && $m['qr_path'])) ?: null;
$req = current(array_filter($methods, fn($m) => $m['kind'] === 'requisites')) ?: null;
$hid = $id . '-title';
?>
<div class="ov ov--sheet" id="<?= $id ?>" data-overlay data-paywin>
  <div class="pp paywin" role="dialog" aria-modal="true" aria-labelledby="<?= $hid ?>" tabindex="-1">
    <div class="pp__bar">
      <span></span>
      <a class="pp__x pp__x--always" href="#" data-close aria-label="<?= e(t('popup.close')) ?>">×</a>
    </div>
    <div class="pp__body">
      <h2 id="<?= $hid ?>"><?= e($b['button_label']) ?></h2>
<?php if ($b['recipient']): ?>
      <p class="pp__sub"><?= e($b['recipient']) ?></p>
<?php endif ?>
<?php if ($qr): ?>
      <figure class="qr">
        <img src="/uploads/<?= e($qr['qr_path']) ?>" alt="QR" width="220" height="220" loading="lazy">
        <figcaption><?= e(t('pay.qr_hint')) ?></figcaption>
      </figure>
<?php endif ?>
<?php if ($links): ?>
      <div class="paywin__btns">
<?php   foreach ($links as $i => $m): ?>
        <a class="btn<?= $i ? ' btn--ghost' : '' ?>" href="<?= e($m['url']) ?>" target="_blank" rel="noopener"><?= e($m['label'] ?: t('pay.provider.' . $m['provider'])) ?></a>
<?php   endforeach ?>
      </div>
<?php endif ?>
<?php if ($req):
    $r = $req['req'];
    $purpose = $r['purpose'][current_lang()] ?? $r['purpose'][default_lang()] ?? t('req.purpose_default');
    $rows = [];
    foreach ($fields as $k => $label) {
        if (!empty($r[$k])) {
            $rows[] = [t($label), (string) $r[$k]];
        }
    }
    $rows[] = [t('req.purpose'), $purpose];
?>
      <details class="req">
        <summary><?= e($req['label'] ?: t('pay.requisites')) ?></summary>
        <dl data-req>
<?php   foreach ($rows as [$label, $value]): ?>
          <dt><?= e($label) ?></dt><dd><?= e($value) ?></dd>
<?php   endforeach ?>
        </dl>
        <button type="button" class="btn btn--ghost" data-copy data-copied="<?= e(t('pay.copied')) ?>" hidden><?= e(t('pay.copy')) ?></button>
      </details>
<?php endif ?>
<?php if ($offer && $links): ?>
      <p class="fine"><?= e(t('pay.offer_before')) ?> <a href="<?= e(url('/doc/offer')) ?>"><?= e(t('pay.offer_link')) ?></a></p>
<?php endif ?>
    </div>
  </div>
</div>
