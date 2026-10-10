<?php
declare(strict_types=1);

/**
 * Контент сайта из базы на текущем языке (спецификация 2.1, разделы 3–6).
 * Дерево: блоки страницы → плитки внутри блока Плитки → блоки страницы плитки.
 */

const I18N_FIELDS = ['eyebrow', 'title', 'subtitle', 'body', 'place', 'grape', 'button_label',
                     'recipient', 'pay_purpose', 'price_note', 'seo_title', 'seo_description'];

/** Все элементы ленты сайта (без табов) деревом. Тексты — на текущем языке. */
function content_tree(): array
{
    static $tree = null;
    if ($tree !== null) {
        return $tree;
    }
    $lang = current_lang();
    $rows = db()->query('SELECT * FROM elements WHERE section_id IS NULL ORDER BY position, id')->fetchAll();
    $st = db()->prepare('SELECT * FROM element_i18n WHERE lang = ?');
    $st->execute([$lang]);
    $texts = [];
    foreach ($st->fetchAll() as $r) {
        $texts[(int) $r['element_id']] = $r;
    }
    $photos = [];
    foreach (db()->query('SELECT * FROM photos')->fetchAll() as $p) {
        $photos[(int) $p['id']] = $p;
    }

    $nodes = [];
    foreach ($rows as $r) {
        $id = (int) $r['id'];
        $n = $r;
        $n['id'] = $id;
        $n['parent_id'] = $r['parent_id'] === null ? null : (int) $r['parent_id'];
        foreach (I18N_FIELDS as $f) {
            $v = $texts[$id][$f] ?? null;
            $n[$f] = ($v === null || trim($v) === '') ? null : $v;
        }
        $n['photo'] = $r['photo_id'] !== null ? ($photos[(int) $r['photo_id']] ?? null) : null;
        $n['children'] = [];
        $nodes[$id] = $n;
    }
    $roots = [];
    foreach ($nodes as $id => $n) {
        if ($n['parent_id'] === null) {
            $roots[] = $id;
        } elseif (isset($nodes[$n['parent_id']])) {
            $nodes[$n['parent_id']]['children'][] = $id;
        }
    }
    $tree = ['nodes' => $nodes, 'roots' => $roots];
    return $tree;
}

function node(int $id): array
{
    return content_tree()['nodes'][$id];
}

/** Видим ли элемент посетителю на текущем языке (разделы 4.3, 4.6). */
function is_visible(array $n): bool
{
    if ((int) $n['hidden'] === 1) {
        return false;
    }
    return match ($n['type']) {
        'text'           => $n['eyebrow'] || $n['title'] || $n['subtitle'] || $n['body'],
        'tile'           => (bool) $n['title'],
        'pay'            => $n['title'] && $n['button_label'] && pay_methods((int) $n['id']),
        'service'        => $n['title'] && $n['button_label'] && $n['link_url'],
        'tiles'          => (bool) visible_children($n),
        'map'            => (bool) map_points($n),
        default          => true,   // photo, tabs
    };
}

/** Видимые дети элемента (блоки страницы или плитки блока). */
function visible_children(array $n): array
{
    $out = [];
    foreach ($n['children'] as $cid) {
        $c = node($cid);
        if (is_visible($c)) {
            $out[] = $c;
        }
    }
    return $out;
}

/** Блоки главной (уровень 1). */
function home_blocks(): array
{
    $out = [];
    foreach (content_tree()['roots'] as $id) {
        $n = node($id);
        if (is_visible($n)) {
            $out[] = $n;
        }
    }
    return $out;
}

/** Уровень плитки: 1 — в блоке главной, 2 — в блоке страницы плитки. */
function tile_level(array $tile): int
{
    $block = node($tile['parent_id']);
    return $block['parent_id'] === null ? 1 : 2;
}

function is_wine(array $tile): bool
{
    return node($tile['parent_id'])['tiles_kind'] === 'wine';
}

/** Как открывается плитка (раздел 3.2): 'page', 'popup' или null (не нажимается). */
function tile_opens(array $tile): ?string
{
    if (!is_wine($tile) && tile_level($tile) === 1) {
        // Раздел 3.2: блоки внутри плитки делают её страницей; скрытые и непереведённые не считаются.
        if (visible_children($tile) || (int) $tile['as_page'] === 1) {
            return 'page';
        }
    }
    if (is_wine($tile)) {
        return $tile['body'] ? 'popup' : null;
    }
    return ($tile['body'] || $tile['place'] || has_coords($tile)) ? 'popup' : null;
}

function has_coords(array $n): bool
{
    return $n['lat'] !== null && $n['lng'] !== null;
}

/** Плитка, внутри которой лежит элемент (для блоков страницы), или null на главной. */
function owner_tile(array $n): ?array
{
    while ($n['parent_id'] !== null) {
        $n = node($n['parent_id']);
        if ($n['type'] === 'tile') {
            return $n;
        }
    }
    return null;
}

/** Адрес плитки: страница или поп-ап (раздел 4.1). */
function tile_url(array $tile): string
{
    $page = tile_level($tile) === 2 ? owner_tile(node($tile['parent_id'])) : null;
    return url(($page ? '/' . $page['slug'] : '') . '/' . $tile['slug']);
}

/** Все видимые плитки внутри набора блоков (без захода на страницы плиток). */
function tiles_in(array $blocks): array
{
    $out = [];
    foreach ($blocks as $b) {
        if ($b['type'] === 'tiles') {
            foreach (visible_children($b) as $t) {
                $out[] = $t;
            }
        }
    }
    return $out;
}

/** Найти видимую плитку по slug среди набора блоков. */
function find_tile(array $blocks, string $slug): ?array
{
    foreach (tiles_in($blocks) as $t) {
        if ($t['slug'] === $slug) {
            return $t;
        }
    }
    return null;
}

/**
 * Точки карты (раздел 5.6): на главной — плитки ленты и плитки их страниц,
 * на странице плитки — только плитки этой страницы.
 */
function map_points(array $mapBlock): array
{
    $owner = owner_tile($mapBlock);
    $blocks = blocks_without_maps($owner ? $owner['children'] : content_tree()['roots']);
    $points = [];
    foreach (tiles_in($blocks) as $t) {
        if (has_coords($t)) {
            $points[] = $t;
        }
        if (!$owner && tile_opens($t) === 'page') {
            foreach (tiles_in(visible_children($t)) as $t2) {
                if (has_coords($t2)) {
                    $points[] = $t2;
                }
            }
        }
    }
    return $points;
}

/** Видимые блоки без карт: карта ищет точки, не проверяя саму себя. */
function blocks_without_maps(array $ids): array
{
    $out = [];
    foreach ($ids as $id) {
        $n = node($id);
        if ($n['type'] !== 'map' && is_visible($n)) {
            $out[] = $n;
        }
    }
    return $out;
}

/** Включённые способы оплаты блока, с подписями на текущем языке. */
function pay_methods(int $elementId): array
{
    static $all = null;
    if ($all === null) {
        $all = [];
        $st = db()->prepare('SELECT m.*, i.label FROM pay_methods m
            LEFT JOIN pay_method_i18n i ON i.method_id = m.id AND i.lang = ?
            WHERE m.enabled = 1 ORDER BY m.position, m.id');
        $st->execute([current_lang()]);
        foreach ($st->fetchAll() as $m) {
            $m['req'] = $m['req_json'] ? (json_decode($m['req_json'], true) ?: []) : [];
            $all[(int) $m['element_id']][] = $m;
        }
    }
    return $all[$elementId] ?? [];
}

/** Владелец (оператор) ленты: подвал и окно оплаты. */
function operator(): ?array
{
    $id = setting('operator_id');
    if (!$id) {
        return null;
    }
    $st = db()->prepare('SELECT * FROM operators WHERE id = ?');
    $st->execute([(int) $id]);
    return $st->fetch() ?: null;
}

/** Текстовая настройка сайта на текущем языке, без перевода — с основного (раздел 4.6). */
function setting_text(string $key): ?string
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->query('SELECT key, lang, value FROM settings_i18n')->fetchAll() as $r) {
            if ($r['value'] !== null && trim($r['value']) !== '') {
                $cache[$r['key']][$r['lang']] = $r['value'];
            }
        }
    }
    return $cache[$key][current_lang()] ?? $cache[$key][default_lang()] ?? null;
}

function site_title(): string
{
    return setting_text('site_title') ?? '';
}

/** Видимый документ на текущем языке: заголовок и текст обязательны. */
function doc(string $key): ?array
{
    $st = db()->prepare('SELECT d.key, i.title, i.body FROM docs d JOIN doc_i18n i ON i.key = d.key AND i.lang = ?
        WHERE d.key = ? AND d.hidden = 0');
    $st->execute([current_lang(), $key]);
    $d = $st->fetch();
    return ($d && trim((string) $d['title']) !== '' && trim((string) $d['body']) !== '') ? $d : null;
}

function visible_docs(): array
{
    $out = [];
    foreach (['offer', 'privacy', 'cookies'] as $k) {
        if ($d = doc($k)) {
            $out[$k] = $d;
        }
    }
    return $out;
}

function social_links(): array
{
    return db()->query("SELECT network, url FROM social_links WHERE url IS NOT NULL AND url <> '' ORDER BY position")->fetchAll();
}

/** Текст абзацами: каждый перенос строки — новый абзац (раздел 5.2). */
function paragraphs(?string $text): array
{
    if ($text === null) {
        return [];
    }
    $parts = preg_split('/\R+/u', trim($text)) ?: [];
    return array_values(array_filter(array_map('trim', $parts), fn($p) => $p !== ''));
}

/** Цена с валютой ленты: «30 ₾», «1 500 ₽». */
function money(float $price): string
{
    $sym = ['RUB' => '₽', 'GEL' => '₾', 'EUR' => '€', 'USD' => '$'][setting('currency', 'RUB')] ?? '';
    $dec = fmod($price, 1.0) == 0.0 ? 0 : 2;
    $num = number_format($price, $dec, ',', "\u{202F}");
    return setting('currency') === 'USD' ? $sym . $num : $num . "\u{00A0}" . $sym;
}

/** Тип вина: «полусухое, красное» (раздел 5.5). */
function wine_type(array $w): string
{
    $type = strtr(t('wine.type'), [
        '{sweet}' => $w['wine_sweet'] ? t('wine.sweet.' . $w['wine_sweet']) : '',
        '{color}' => $w['wine_color'] ? t('wine.color.' . $w['wine_color']) : '',
    ]);
    // Пустая часть не оставляет висящей запятой.
    return trim(preg_replace(['/\s*,\s*(,\s*)*/u', '/\s+/u'], [', ', ' '], $type), " ,");
}

/**
 * Строки карточки вина под названием, каждая своей строкой (раздел 5.5):
 * части подписи через «·» (страна, хозяйство), «сладость, цвет», сорт, год. Пустые пропускаются.
 */
function wine_facts(array $w): array
{
    $lines = [];
    foreach (preg_split('/\s*·\s*/u', (string) $w['subtitle']) as $part) {
        if ($part !== '') {
            $lines[] = ['sub', $part];
        }
    }
    foreach (['type' => wine_type($w), 'grape' => $w['grape'] ?? '', 'year' => $w['vintage'] ? (string) $w['vintage'] : ''] as $k => $v) {
        if ($v !== '') {
            $lines[] = [$k, $v];
        }
    }
    return $lines;
}

function show_prices(): bool
{
    return setting('show_prices', '1') === '1';
}
