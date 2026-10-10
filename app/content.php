<?php
declare(strict_types=1);

/**
 * Контент сайта из базы на текущем языке (спецификация 2.1, разделы 3–6).
 * Дерево: блоки страницы → плитки внутри блока Плитки → блоки страницы плитки.
 */

const I18N_FIELDS = ['eyebrow', 'title', 'subtitle', 'body', 'place', 'grape', 'button_label',
                     'recipient', 'pay_purpose', 'price_note', 'seo_title', 'seo_description'];

/**
 * Все элементы сайта деревом. Тексты — на текущем языке (кэш на каждый язык: sitemap обходит все).
 * roots[0] — блоки главной (общие над табами и сам блок Табы), roots[id таба] — лента таба.
 */
function content_tree(): array
{
    static $cache = [];
    $lang = current_lang();
    if (isset($cache[$lang])) {
        return $cache[$lang];
    }
    $rows = db()->query('SELECT * FROM elements ORDER BY position, id')->fetchAll();
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
        $n['section_id'] = $r['section_id'] === null ? null : (int) $r['section_id'];
        foreach (I18N_FIELDS as $f) {
            $v = $texts[$id][$f] ?? null;
            $n[$f] = ($v === null || trim($v) === '') ? null : $v;
        }
        $n['photo'] = $r['photo_id'] !== null ? ($photos[(int) $r['photo_id']] ?? null) : null;
        $n['children'] = [];
        $nodes[$id] = $n;
    }
    $roots = [0 => []];
    foreach ($nodes as $id => $n) {
        if ($n['parent_id'] === null) {
            $roots[$n['section_id'] ?? 0][] = $id;
        } elseif (isset($nodes[$n['parent_id']])) {
            $nodes[$n['parent_id']]['children'][] = $id;
        }
    }
    return $cache[$lang] = ['nodes' => $nodes, 'roots' => $roots];
}

function node(int $id): array
{
    return content_tree()['nodes'][$id];
}

/* ---------------------------------------------------------------- табы и адреса (разделы 3.3, 4.2, 4.5) */

/** Все табы по порядку, подпись — на текущем языке. Ключ — id таба. */
function sections(): array
{
    static $cache = [];
    $lang = current_lang();
    if (isset($cache[$lang])) {
        return $cache[$lang];
    }
    $st = db()->prepare('SELECT s.*, i.title FROM sections s LEFT JOIN section_i18n i ON i.section_id = s.id AND i.lang = ?
        ORDER BY s.position, s.id');
    $st->execute([$lang]);
    $out = [];
    foreach ($st->fetchAll() as $s) {
        $s['id'] = (int) $s['id'];
        $s['title'] = trim((string) $s['title']) === '' ? null : $s['title'];
        $out[$s['id']] = $s;
    }
    return $cache[$lang] = $out;
}

/** Блок Табы главной, если он есть и не скрыт. */
function tabs_block(): ?array
{
    foreach (content_tree()['roots'][0] as $id) {
        $n = node($id);
        if ($n['type'] === 'tabs') {
            return (int) $n['hidden'] === 1 ? null : $n;
        }
    }
    return null;
}

/** Таб виден: блок Табы есть, таб не скрыт и подписан на текущем языке (раздел 4.6). */
function tab_visible(?array $s): bool
{
    return $s !== null && (int) $s['hidden'] === 0 && $s['title'] !== null && tabs_block() !== null;
}

/** Табы на полосе: на общем адресе — все видимые, на адресе таба полосы нет. */
function visible_tabs(): array
{
    if (single_tab() || !tabs_block()) {
        return [];
    }
    return array_values(array_filter(sections(), 'tab_visible'));
}

/** Список адресов из «Настройки сайта → Адреса»: host, section_id, названия сайта по языкам. */
function domains(): array
{
    static $list = null;
    if ($list !== null) {
        return $list;
    }
    $list = [];
    foreach (db()->query('SELECT * FROM domains ORDER BY position, host')->fetchAll() as $d) {
        $list[$d['host']] = ['host' => $d['host'], 'section_id' => $d['section_id'] === null ? null : (int) $d['section_id'], 'titles' => []];
    }
    foreach (db()->query('SELECT host, lang, site_title FROM domain_i18n')->fetchAll() as $r) {
        if (isset($list[$r['host']]) && trim((string) $r['site_title']) !== '') {
            $list[$r['host']]['titles'][$r['lang']] = $r['site_title'];
        }
    }
    return $list;
}

/** Хост запроса без порта и «www.». */
function request_host(): string
{
    $h = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    return preg_replace('/[^a-z0-9.\-]/', '', $h);
}

/**
 * Адрес, на котором открыт сайт (раздел 4.5): по заголовку Host; нет в списке — первый; списка нет — null.
 * $override — превью админки показывает сайт «на выбранном адресе».
 */
function current_domain(?string $override = null): ?array
{
    static $cur = false;
    if ($override !== null) {
        $cur = domains()[$override] ?? false;
    }
    if ($cur !== false) {
        return $cur;
    }
    $all = domains();
    if (!$all) {
        return $cur = null;
    }
    $host = request_host();
    return $cur = $all[$host] ?? $all[preg_replace('/^www\./', '', $host)] ?? $all['www.' . $host] ?? reset($all);
}

/** Адрес одного таба: сайт целиком — лента этого таба, без полосы и общих блоков. */
function single_tab(): ?array
{
    $d = current_domain();
    if (!$d || $d['section_id'] === null || !tabs_block()) {
        return null;
    }
    return sections()[$d['section_id']] ?? null;
}

/**
 * Лента, чьи настройки сейчас действуют (раздел 3.4): id таба или null (сайт).
 * Без аргумента — текущая; с аргументом — переключает и возвращает прежнюю.
 */
function feed(int|null|false $set = false): ?int
{
    static $cur = null;
    $prev = $cur;
    if ($set !== false) {
        $cur = $set;
    }
    return $prev;
}

/** Настройка «страны» текущей ленты: валюта, формат реквизитов, владелец, сервис карт, цены вин. */
function feed_setting(string $key, ?string $default = null): ?string
{
    $sid = feed();
    if ($sid !== null && ($s = sections()[$sid] ?? null)) {
        $v = $s[$key] ?? null;
        return $v === null ? $default : (string) $v;
    }
    return setting($key, $default);
}

/** Активный таб главной: выбран адресом или первый видимый. */
function active_tab(array|null|false $set = false): ?array
{
    static $tab = null;
    if ($set !== false) {
        $tab = $set;
    }
    return $tab;
}

/** Видимые блоки ленты (0 — главная, иначе таб), без блока Табы. $noMaps — для карты: она не проверяет саму себя. */
function root_blocks(int $section, bool $noMaps = false): array
{
    $out = [];
    foreach (content_tree()['roots'][$section] ?? [] as $id) {
        $n = node($id);
        if ($n['type'] !== 'tabs' && !($noMaps && $n['type'] === 'map') && is_visible($n)) {
            $out[] = $n;
        }
    }
    return $out;
}

/** Плитки, которые видит главная: общие и активного таба (бургер, карта главной, раздел 5.4). */
function home_feed_blocks(bool $noMaps = false): array
{
    if ($s = single_tab()) {
        return root_blocks($s['id'], $noMaps);
    }
    $blocks = root_blocks(0, $noMaps);
    if ($tab = active_tab()) {
        $blocks = array_merge($blocks, root_blocks($tab['id'], $noMaps));
    }
    return $blocks;
}

/** Префикс адреса ленты: «/gruziya» у таба на общем адресе, иначе пусто. */
function feed_prefix(?int $section): string
{
    if ($section === null || single_tab()) {
        return '';
    }
    $s = sections()[$section] ?? null;
    return $s ? '/' . $s['slug'] : '';
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

/** Блоки главной (уровень 1): общие и блок Табы последним; на адресе таба — лента таба. */
function home_blocks(): array
{
    if ($s = single_tab()) {
        return root_blocks($s['id']);
    }
    $out = root_blocks(0);
    if (visible_tabs()) {
        $out[] = tabs_block();
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
    return url(feed_prefix($tile['section_id']) . ($page ? '/' . $page['slug'] : '') . '/' . $tile['slug']);
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
    if ($owner) {
        $blocks = array_filter(array_map('node', $owner['children']), fn($b) => $b['type'] !== 'map' && is_visible($b));
    } else {
        // Карта общих блоков на главной с табами показывает и активный таб (раздел 5.4).
        $blocks = $mapBlock['section_id'] !== null ? root_blocks($mapBlock['section_id'], true) : home_feed_blocks(true);
    }
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

/** Включённые способы оплаты блока, с подписями на текущем языке. */
function pay_methods(int $elementId): array
{
    static $cache = [];
    $all = &$cache[current_lang()];
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
    $id = feed_setting('operator_id');
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

/** Название сайта: у адреса своё (раздел 4.5), без перевода — с основного языка, иначе из настроек. */
function site_title(): string
{
    $d = current_domain();
    if ($d) {
        $t = $d['titles'][current_lang()] ?? $d['titles'][default_lang()] ?? null;
        if ($t !== null) {
            return $t;
        }
    }
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
    $cur = feed_setting('currency', 'RUB');
    $sym = ['RUB' => '₽', 'GEL' => '₾', 'EUR' => '€', 'USD' => '$'][$cur] ?? '';
    $dec = fmod($price, 1.0) == 0.0 ? 0 : 2;
    $num = number_format($price, $dec, ',', "\u{202F}");
    return $cur === 'USD' ? $sym . $num : $num . "\u{00A0}" . $sym;
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
    return feed_setting('show_prices', '1') === '1';
}
