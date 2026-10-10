<?php
$GLOBALS['h1_done'] = false;
?>
<div class="feed">
<?= view('blocks', ['blocks' => $blocks, 'popup' => $popup]) ?>
<?php if (!$GLOBALS['h1_done']): ?>
  <h1 class="visually-hidden"><?= e(site_title()) ?></h1>
<?php endif ?>
</div>
<?= view('popups', ['blocks' => $blocks, 'open' => $popup, 'pageUrl' => url('/')]) ?>
