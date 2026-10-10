<?php foreach (wine_facts($t) as [$kind, $text]): ?>
<<?= $tag ?> class="wine__<?= $kind ?>"><?= e($text) ?></<?= $tag ?>>
<?php endforeach ?>
