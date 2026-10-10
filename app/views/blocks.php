<?php
/** Блоки ленты по порядку; несколько Услуг подряд — одной сеткой (раздел 5.8). */
$i = 0;
$n = count($blocks);
while ($i < $n) {
    $b = $blocks[$i];
    if ($b['type'] === 'service') {
        $group = [];
        while ($i < $n && $blocks[$i]['type'] === 'service') {
            $group[] = $blocks[$i++];
        }
        echo view('blocks/services', ['group' => $group]);
        continue;
    }
    echo view('blocks/' . $b['type'], ['b' => $b]);
    $i++;
}
