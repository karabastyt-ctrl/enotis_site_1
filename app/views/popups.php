<?php
/** Поп-апы плиток страницы: в <template> для JS; открытый по адресу — сразу в HTML (раздел 4.3). */
foreach (tiles_in($blocks) as $t) {
    if (tile_opens($t) !== 'popup') {
        continue;
    }
    $isOpen = $open && (int) $open['id'] === (int) $t['id'];
    $html = view('popup', ['t' => $t, 'pageUrl' => $pageUrl, 'isOpen' => $isOpen]);
    if ($isOpen) {
        echo $html;
    } else {
        echo '<template id="pp-' . e($t['slug']) . '" data-url="' . e(tile_url($t)) . '" data-title="' . e(
            $t['seo_title'] ?? $t['title']) . '">' . $html . '</template>';
    }
}
