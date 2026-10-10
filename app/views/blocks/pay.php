<?php
$id = 'pay-' . $b['id'];
?>
<section class="wrap blk">
  <div class="paybar">
    <div class="paybar__text">
      <h2><?= e($b['title']) ?></h2>
<?php foreach (paragraphs($b['body']) as $p): ?>
      <p><?= e($p) ?></p>
<?php endforeach ?>
    </div>
    <a class="btn" href="#<?= $id ?>" data-pay-open="<?= $id ?>"><?= e($b['button_label']) ?></a>
  </div>
</section>
<?= view('paywin', ['b' => $b, 'id' => $id]) ?>
