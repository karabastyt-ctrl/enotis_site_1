<?php
/**
 * Блоки ленты по порядку; несколько Услуг подряд — одной сеткой (раздел 5.8).
 * Каждый блок рисуется с настройками своей ленты: таба, если лежит в табе, иначе сайта (раздел 3.4).
 */
$i = 0;
$n = count($blocks);
while ($i < $n) {
    $b = $blocks[$i];
    $prev = feed($b['section_id']);
    if ($b['type'] === 'service') {
        $group = [];
        while ($i < $n && $blocks[$i]['type'] === 'service') {
            $group[] = $blocks[$i++];
        }
        echo view('blocks/services', ['group' => $group]);
    } else {
        echo view('blocks/' . $b['type'], ['b' => $b] + (isset($popup) ? ['popup' => $popup] : []));
        $i++;
    }
    feed($prev);
}
