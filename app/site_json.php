<?php
declare(strict_types=1);

/**
 * Дерево сайта в JSON формата 3 (спецификация 2.1, раздел 12): одно на всё —
 * состояние админки, превью, сохранение, тестовое наполнение, позже выгрузка.
 *
 * site_export()   — база → дерево (с id, чтобы админка правила те же записи);
 * site_validate() — проверки перед записью (раздел 10.9);
 * site_write()    — дерево → база; вызывается внутри транзакции.
 */

const RESERVED_SLUGS = ['admin', 'assets', 'uploads', 'doc', 'install', 'sitemap.xml', 'robots.txt', 'ru', 'ka', 'en', 'fr'];

/** Предельная длина полей по виду элемента (разделы 5.2–5.8, 10.5). */
const FIELD_MAX = [
    'text'     => ['eyebrow' => 40, 'title' => 60, 'subtitle' => 120, 'text' => 3000],
    'photo'    => ['caption' => 120],
    'tiles'    => ['title' => 60],
    'tile'     => ['title' => 45, 'subtitle' => 90, 'text' => 3000, 'place' => 140, 'seo_title' => 60, 'seo_description' => 160],
    'wine'     => ['title' => 60, 'subtitle' => 90, 'grape' => 60, 'text' => 3000],
    'map'      => ['title' => 60],
    'pay'      => ['title' => 60, 'text' => 300, 'button' => 30, 'recipient' => 100],
    'service'  => ['title' => 60, 'text' => 500, 'price_note' => 40, 'button' => 30, 'recipient' => 100],
    'settings' => ['site_title' => 40, 'seo_title' => 60, 'seo_description' => 160],
    'method'   => ['label' => 40],
];

/* ---------------------------------------------------------------- выгрузка */

/** Вся база сайта деревом формата 3. Тексты — на всех языках, что есть в базе. */
function site_export(): array
{
    $pdo = db();
    $langs = $pdo->query('SELECT code, is_default, is_active FROM languages ORDER BY position')->fetchAll();
    $main = 'ru';
    $on = [];
    foreach ($langs as $l) {
        if ($l['is_active']) {
            $on[] = $l['code'];
        }
        if ($l['is_default']) {
            $main = $l['code'];
        }
    }

    $set = $pdo->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    $setI18n = [];
    foreach ($pdo->query('SELECT key, lang, value FROM settings_i18n')->fetchAll() as $r) {
        if ($r['value'] !== null && $r['value'] !== '') {
            $setI18n[$r['key']][$r['lang']] = $r['value'];
        }
    }

    $docs = [];
    $docTexts = [];
    foreach ($pdo->query('SELECT * FROM doc_i18n')->fetchAll() as $r) {
        $docTexts[$r['key']]['title'][$r['lang']] = (string) $r['title'];
        $docTexts[$r['key']]['body'][$r['lang']] = (string) $r['body'];
    }
    foreach ($pdo->query('SELECT key, hidden FROM docs')->fetchAll() as $d) {
        $docs[$d['key']] = ['show' => !$d['hidden'], 'title' => (object) ($docTexts[$d['key']]['title'] ?? []),
                            'body' => (object) ($docTexts[$d['key']]['body'] ?? [])];
    }

    $operators = [];
    foreach ($pdo->query('SELECT * FROM operators ORDER BY id')->fetchAll() as $o) {
        $operators[] = ['id' => (int) $o['id'], 'name' => $o['name'], 'country' => $o['country'],
                        'tax_id' => (string) $o['tax_id'], 'reg_no' => (string) $o['reg_no'],
                        'address' => (string) $o['address'], 'email' => (string) $o['email']];
    }

    $social = [];
    foreach ($pdo->query('SELECT network, url FROM social_links ORDER BY position')->fetchAll() as $s) {
        $social[] = ['network' => $s['network'], 'url' => (string) $s['url']];
    }

    // Элементы, тексты, фото и способы оплаты — одним проходом.
    $rows = $pdo->query('SELECT * FROM elements WHERE section_id IS NULL ORDER BY position, id')->fetchAll();
    $texts = [];
    foreach ($pdo->query('SELECT * FROM element_i18n')->fetchAll() as $r) {
        foreach (I18N_FIELDS as $f) {
            if ($r[$f] !== null && $r[$f] !== '') {
                $texts[(int) $r['element_id']][$f][$r['lang']] = $r[$f];
            }
        }
    }
    $photos = [];
    foreach ($pdo->query('SELECT * FROM photos')->fetchAll() as $p) {
        $photos[(int) $p['id']] = $p;
    }
    $methods = [];
    $mLabels = [];
    foreach ($pdo->query('SELECT * FROM pay_method_i18n')->fetchAll() as $r) {
        if ($r['label'] !== null && $r['label'] !== '') {
            $mLabels[(int) $r['method_id']][$r['lang']] = $r['label'];
        }
    }
    foreach ($pdo->query('SELECT * FROM pay_methods ORDER BY position, id')->fetchAll() as $m) {
        $id = (int) $m['id'];
        $methods[(int) $m['element_id']][] = [
            'id' => $id, 'kind' => $m['kind'], 'provider' => $m['provider'] ?: $m['kind'], 'on' => (bool) $m['enabled'],
            'url' => (string) $m['url'], 'image' => (string) $m['qr_path'],
            'label' => (object) ($mLabels[$id] ?? []),
            'req' => $m['req_json'] ? (object) (json_decode($m['req_json'], true) ?: []) : null,
        ];
    }
    $kids = [];
    foreach ($rows as $r) {
        $kids[$r['parent_id'] === null ? 0 : (int) $r['parent_id']][] = $r;
    }

    $ctx = ['kids' => $kids, 'texts' => $texts, 'photos' => $photos, 'methods' => $methods];
    return [
        'format'    => 3,
        'engine'    => ENGINE_VERSION,
        'languages' => ['main' => $main, 'on' => $on],
        'settings'  => [
            'site_title'      => (object) ($setI18n['site_title'] ?? []),
            'seo_title'       => (object) ($setI18n['seo_title'] ?? []),
            'seo_description' => (object) ($setI18n['seo_description'] ?? []),
            'currency'        => $set['currency'] ?? 'RUB',
            'req_format'      => $set['req_format'] ?? 'RU',
            'operator'        => isset($set['operator_id']) && $set['operator_id'] !== '' ? (int) $set['operator_id'] : null,
            'maps'            => $set['maps'] ?? 'google',
            'show_prices'     => ($set['show_prices'] ?? '1') === '1',
            'cookie_notice'   => ($set['cookie_notice'] ?? '1') === '1',
        ],
        'header'    => ['show' => ($set['header_show'] ?? '1') === '1', 'burger' => $set['header_burger'] ?? 'auto'],
        'footer'    => ['show' => ($set['footer_show'] ?? '1') === '1', 'email' => (string) ($set['footer_email'] ?? ''),
                        'phone' => (string) ($set['footer_phone'] ?? '')],
        'social'    => $social,
        'operators' => $operators,
        'docs'      => $docs,
        'blocks'    => export_blocks(0, $ctx),
    ];
}

function export_blocks(int $parentId, array $ctx): array
{
    $out = [];
    foreach ($ctx['kids'][$parentId] ?? [] as $r) {
        $id = (int) $r['id'];
        $tx = fn(string $f) => (object) ($ctx['texts'][$id][$f] ?? []);
        $b = ['id' => $id, 'type' => $r['type'], 'hidden' => (bool) $r['hidden']];
        switch ($r['type']) {
            case 'text':
                $b += ['eyebrow' => $tx('eyebrow'), 'title' => $tx('title'), 'title_size' => $r['title_size'] ?: 'm',
                       'subtitle' => $tx('subtitle'), 'text' => $tx('body'), 'body_size' => $r['body_size'] ?: 'normal'];
                break;
            case 'photo':
                $b += ['photo' => export_photo($r['photo_id'], $ctx), 'caption' => $tx('subtitle'),
                       'aspect' => $r['frame'] ?: '3:2', 'width' => $r['photo_width'] ?: 'full'];
                break;
            case 'tiles':
                $wine = $r['tiles_kind'] === 'wine';
                $b += ['title' => $tx('title'), 'size' => $r['tiles_size'] ?: ($wine ? 'compact' : 'large'),
                       'aspect' => $wine ? '4:5' : ($r['frame'] ?: '4:5'), 'kind' => $wine ? 'wine' : 'normal',
                       'tiles' => export_tiles($id, $wine, $ctx)];
                break;
            case 'map':
                $b += ['title' => $tx('title')];
                break;
            case 'pay':
                $b += ['title' => $tx('title'), 'text' => $tx('body'), 'button' => $tx('button_label'),
                       'recipient' => $tx('recipient'), 'methods' => $ctx['methods'][$id] ?? []];
                break;
            case 'service':
                $b += ['title' => $tx('title'), 'text' => $tx('body'), 'price' => $r['price'] !== null ? (float) $r['price'] : null,
                       'price_note' => $tx('price_note'), 'button' => $tx('button_label'), 'url' => (string) $r['link_url'],
                       'recipient' => $tx('recipient')];
                break;
            case 'tabs':
                continue 2; // табы — этап 5
        }
        $out[] = $b;
    }
    return $out;
}

function export_tiles(int $blockId, bool $wine, array $ctx): array
{
    $out = [];
    foreach ($ctx['kids'][$blockId] ?? [] as $r) {
        $id = (int) $r['id'];
        $tx = fn(string $f) => (object) ($ctx['texts'][$id][$f] ?? []);
        $t = ['id' => $id, 'hidden' => (bool) $r['hidden'], 'slug' => $r['slug'], 'title' => $tx('title'),
              'subtitle' => $tx('subtitle'), 'text' => $tx('body'), 'photo' => export_photo($r['photo_id'], $ctx)];
        if ($wine) {
            $t += ['grape' => $tx('grape'), 'vintage' => $r['vintage'] !== null ? (int) $r['vintage'] : null,
                   'wine_color' => $r['wine_color'], 'wine_sweet' => $r['wine_sweet'],
                   'price' => $r['price'] !== null ? (float) $r['price'] : null];
        } else {
            $t += ['place' => $tx('place'), 'lat' => $r['lat'] !== null ? (float) $r['lat'] : null,
                   'lng' => $r['lng'] !== null ? (float) $r['lng'] : null, 'as_page' => (bool) $r['as_page'],
                   'seo_title' => $tx('seo_title'), 'seo_description' => $tx('seo_description'),
                   'blocks' => export_blocks($id, $ctx)];
        }
        $out[] = $t;
    }
    return $out;
}

function export_photo($photoId, array $ctx): ?array
{
    $p = $photoId !== null ? ($ctx['photos'][(int) $photoId] ?? null) : null;
    if (!$p) {
        return null;
    }
    $crop = $p['crop_w'] !== null ? ['x' => (float) $p['crop_x'], 'y' => (float) $p['crop_y'], 'w' => (float) $p['crop_w'], 'h' => (float) $p['crop_h']] : null;
    $head = $p['head_crop_w'] !== null ? ['x' => (float) $p['head_crop_x'], 'y' => (float) $p['head_crop_y'], 'w' => (float) $p['head_crop_w'], 'h' => (float) $p['head_crop_h']] : null;
    $paths = photo_paths($p);
    return ['id' => (int) $p['id'], 'aspect' => $p['aspect'], 'rotate' => (float) $p['rotate'],
            'crop' => $crop, 'head_crop' => $head, 'thumb' => '/uploads/' . $paths['s'], 'head_thumb' => '/uploads/' . $paths['hs']];
}

/* ---------------------------------------------------------------- проверки */

/**
 * Проверки перед записью (раздел 10.9). Ошибка блокирует сохранение, предупреждение — нет.
 * Каждая запись: ['id' => элемент или раздел, 'lang' => язык или null, 'field' => поле, 'code' => ключ подписи, 'n' => число].
 */
function site_validate(array $site): array
{
    $errors = [];
    $warnings = [];
    $on = array_values(array_intersect($site['languages']['on'] ?? [], LANGS)) ?: ['ru'];
    $main = $site['languages']['main'] ?? $on[0];
    $ctx = ['on' => $on, 'main' => $main, 'errors' => &$errors, 'warnings' => &$warnings];

    check_lengths('settings', 'settings', $site['settings'] ?? [], $ctx);
    if (!in_array($main, $on, true)) {
        $errors[] = ['id' => 'languages', 'code' => 'err.main_lang_off'];
    }
    foreach ($site['social'] ?? [] as $s) {
        $u = trim((string) ($s['url'] ?? ''));
        if ($u !== '' && !link_ok($u, $s['network'] === 'whatsapp' || $s['network'] === 'viber')) {
            $errors[] = ['id' => 'social', 'field' => $s['network'], 'code' => 'err.https'];
        }
    }
    foreach ($site['operators'] ?? [] as $o) {
        if (trim((string) ($o['name'] ?? '')) === '') {
            $errors[] = ['id' => 'operators', 'code' => 'err.operator_name'];
        } elseif (mb_strlen($o['name']) > 120) {
            $errors[] = ['id' => 'operators', 'code' => 'err.too_long', 'n' => 120];
        }
    }
    validate_blocks($site['blocks'] ?? [], 0, $ctx);
    return ['errors' => $errors, 'warnings' => $warnings];
}

function validate_blocks(array $blocks, int $level, array $ctx): void
{
    $once = [];
    foreach ($blocks as $b) {
        $type = $b['type'] ?? '';
        $id = $b['id'] ?? null;
        if (!in_array($type, ['text', 'photo', 'tiles', 'map', 'pay', 'service'], true)) {
            $ctx['errors'][] = ['id' => $id, 'code' => 'err.bad_type'];
            continue;
        }
        if (in_array($type, ['map', 'pay'], true)) {
            if (isset($once[$type])) {
                $ctx['errors'][] = ['id' => $id, 'code' => 'err.one_' . $type];
            }
            $once[$type] = true;
        }
        $hidden = !empty($b['hidden']);
        check_lengths($type, $id, $b, $ctx);
        if ($type === 'service') {
            $u = trim((string) ($b['url'] ?? ''));
            if ($u === '' && !$hidden) {
                $ctx['errors'][] = ['id' => $id, 'field' => 'url', 'code' => 'err.service_url'];
            } elseif ($u !== '' && !link_ok($u, false)) {
                $ctx['errors'][] = ['id' => $id, 'field' => 'url', 'code' => 'err.https'];
            }
            if (isset($b['price']) && $b['price'] !== null && (!is_numeric($b['price']) || $b['price'] < 0)) {
                $ctx['errors'][] = ['id' => $id, 'field' => 'price', 'code' => 'err.price'];
            }
        }
        if ($type === 'pay') {
            $kinds = [];
            $anyOn = false;
            foreach ($b['methods'] ?? [] as $m) {
                $k = $m['kind'] ?? '';
                if (in_array($k, ['qr', 'requisites'], true) && isset($kinds[$k])) {
                    $ctx['errors'][] = ['id' => $id, 'code' => 'err.one_' . $k];
                }
                $kinds[$k] = true;
                $anyOn = $anyOn || !empty($m['on']);
                if ($k === 'link' && trim((string) ($m['url'] ?? '')) !== '' && !link_ok($m['url'], false)) {
                    $ctx['errors'][] = ['id' => $id, 'field' => 'methods', 'code' => 'err.https'];
                }
                check_lengths('method', $id, $m, $ctx);
                if ($k === 'requisites' && !empty($m['on'])) {
                    foreach (req_warnings($m['req'] ?? []) as $w) {
                        $ctx['warnings'][] = ['id' => $id, 'field' => 'methods', 'code' => $w];
                    }
                }
            }
            if (!$hidden && !$anyOn) {
                $ctx['warnings'][] = ['id' => $id, 'code' => 'warn.pay_no_methods'];
            }
        }
        if ($type === 'tiles') {
            $wine = ($b['kind'] ?? 'normal') === 'wine';
            foreach ($b['tiles'] ?? [] as $t) {
                $tid = $t['id'] ?? null;
                check_lengths($wine ? 'wine' : 'tile', $tid, $t, $ctx);
                if (!$wine) {
                    check_coords($t, $ctx);
                    if (!empty($t['as_page']) && $level > 0) {
                        $ctx['errors'][] = ['id' => $tid, 'field' => 'as_page', 'code' => 'err.as_page_level2'];
                    }
                    if (!empty($t['blocks'])) {
                        if ($level > 0) {
                            $ctx['errors'][] = ['id' => $tid, 'code' => 'err.depth'];
                        } else {
                            validate_blocks($t['blocks'], 1, $ctx);
                        }
                    }
                }
                if ($wine) {
                    if (isset($t['vintage']) && $t['vintage'] !== null && $t['vintage'] !== '' && (!ctype_digit((string) $t['vintage']) || $t['vintage'] < 1800 || $t['vintage'] > 2100)) {
                        $ctx['errors'][] = ['id' => $tid, 'field' => 'vintage', 'code' => 'err.vintage'];
                    }
                    if (isset($t['price']) && $t['price'] !== null && $t['price'] !== '' && (!is_numeric($t['price']) || $t['price'] < 0)) {
                        $ctx['errors'][] = ['id' => $tid, 'field' => 'price', 'code' => 'err.price'];
                    }
                }
            }
        }
    }
}

/** Длина текстов по языкам и отсутствие перевода на включённые языки (предупреждение). */
function check_lengths(string $kind, $id, array $data, array $ctx): void
{
    $hasText = false;
    $langsWithText = [];
    foreach (FIELD_MAX[$kind] ?? [] as $field => $max) {
        $vals = $data[$field] ?? [];
        if (!is_array($vals)) {
            continue;
        }
        foreach ($vals as $lang => $v) {
            if (!is_string($v) || trim($v) === '') {
                continue;
            }
            $hasText = true;
            $langsWithText[$lang] = true;
            if (mb_strlen($v) > $max) {
                $ctx['errors'][] = ['id' => $id, 'lang' => $lang, 'field' => $field, 'code' => 'err.too_long', 'n' => $max];
            }
        }
    }
    if ($hasText && count($ctx['on']) > 1 && !in_array($kind, ['settings', 'method'], true)) {
        $missing = array_values(array_diff($ctx['on'], array_keys($langsWithText)));
        if ($missing) {
            $ctx['warnings'][] = ['id' => $id, 'code' => 'warn.no_translation', 'langs' => $missing];
        }
    }
}

function check_coords(array $t, array $ctx): void
{
    $lat = $t['lat'] ?? null;
    $lng = $t['lng'] ?? null;
    $has = fn($v) => $v !== null && $v !== '';
    if (!$has($lat) && !$has($lng)) {
        return;
    }
    $num = fn($v) => is_numeric(str_replace(',', '.', (string) $v)) ? (float) str_replace(',', '.', (string) $v) : null;
    $la = $has($lat) ? $num($lat) : null;
    $lo = $has($lng) ? $num($lng) : null;
    if ($la === null || $lo === null || $la < -90 || $la > 90 || $lo < -180 || $lo > 180) {
        $ctx['errors'][] = ['id' => $t['id'] ?? null, 'field' => 'lat', 'code' => 'err.coords'];
    }
}

/** Ссылки — только https://; WhatsApp и Viber — свои схемы (раздел 7.3). */
function link_ok(string $url, bool $messenger): bool
{
    if (preg_match('~^https://[^\s/]+\.[^\s]+$~i', $url)) {
        return true;
    }
    return $messenger && preg_match('~^(viber|whatsapp)://\S+$~i', $url);
}

/** Проверки реквизитов по формату (раздел 7.4) — только предупреждения. */
function req_warnings($req): array
{
    $req = (array) $req;
    $digits = fn($k) => preg_replace('/\D/', '', (string) ($req[$k] ?? ''));
    $out = [];
    if (($req['inn'] ?? '') !== '' && !in_array(strlen($digits('inn')), [10, 12], true)) {
        $out[] = 'warn.req_inn';
    }
    if (($req['bik'] ?? '') !== '' && strlen($digits('bik')) !== 9) {
        $out[] = 'warn.req_bik';
    }
    if (($req['account'] ?? '') !== '' && strlen($digits('account')) !== 20) {
        $out[] = 'warn.req_account';
    }
    $iban = strtoupper(preg_replace('/\s/', '', (string) ($req['iban'] ?? '')));
    if (str_starts_with($iban, 'GE') && strlen($iban) !== 22) {
        $out[] = 'warn.req_iban';
    }
    return $out;
}

/* ---------------------------------------------------------------- запись */

/**
 * Записать дерево в базу (вызывать внутри транзакции). Элементы, способы оплаты и владельцы
 * сохраняют свои id; у новых (id не число) id присваивается — карта соответствий в ответе.
 * $opts['photos_dir'] — загрузка из папки (photo.file); иначе фото ссылаются на записи photos по id.
 */
function site_write(array $site, array $opts = []): array
{
    if (($site['format'] ?? null) !== 3) {
        throw new InvalidArgumentException('Нужен JSON формата 3');
    }
    $pdo = db();
    $max = (int) $pdo->query('SELECT COALESCE(MAX(id), 0) FROM elements')->fetchColumn();
    $max = max($max, max_tree_id($site['blocks'] ?? []));
    $mMax = (int) $pdo->query('SELECT COALESCE(MAX(id), 0) FROM pay_methods')->fetchColumn();
    foreach (['element_i18n', 'pay_method_i18n', 'pay_methods', 'elements', 'settings_i18n', 'doc_i18n'] as $t) {
        $pdo->exec("DELETE FROM $t");
    }

    $langs = $site['languages'] ?? ['main' => 'ru', 'on' => ['ru']];
    $on = array_values(array_intersect($langs['on'] ?? [], LANGS));
    $main = in_array($langs['main'] ?? '', $on, true) ? $langs['main'] : ($on[0] ?? 'ru');
    $on = $on ?: [$main];
    $st = $pdo->prepare('UPDATE languages SET is_active = ?, is_default = ? WHERE code = ?');
    foreach (LANGS as $l) {
        $st->execute([in_array($l, $on, true) ? 1 : 0, $l === $main ? 1 : 0, $l]);
    }

    // Владельцы: свои id сохраняются, удалённые из списка — удаляются.
    $ids = [];
    $keep = [];
    foreach ($site['operators'] ?? [] as $op) {
        $vals = [trim((string) $op['name']), in_array($op['country'] ?? '', ['RU', 'GE', 'other'], true) ? $op['country'] : 'RU',
                 nn($op['tax_id'] ?? null), nn($op['reg_no'] ?? null), nn($op['address'] ?? null), nn($op['email'] ?? null)];
        $oid = $op['id'] ?? null;
        $exists = is_int($oid) && $pdo->query('SELECT 1 FROM operators WHERE id = ' . $oid)->fetchColumn();
        if ($exists) {
            $pdo->prepare('UPDATE operators SET name = ?, country = ?, tax_id = ?, reg_no = ?, address = ?, email = ? WHERE id = ?')
                ->execute([...$vals, $oid]);
            $new = $oid;
        } else {
            $pdo->prepare('INSERT INTO operators (name, country, tax_id, reg_no, address, email) VALUES (?, ?, ?, ?, ?, ?)')->execute($vals);
            $new = (int) $pdo->lastInsertId();
        }
        $keep[] = $new;
        $ids['op:' . ($oid ?? count($keep))] = $new;
    }
    $pdo->exec('DELETE FROM operators' . ($keep ? ' WHERE id NOT IN (' . implode(',', $keep) . ')' : ''));

    $s = $site['settings'] ?? [];
    $op = $s['operator'] ?? null;
    $opId = $op !== null && $op !== '' ? ($ids['op:' . $op] ?? null) : null;
    $plain = [
        'currency'      => in_array($s['currency'] ?? '', ['RUB', 'GEL', 'EUR', 'USD'], true) ? $s['currency'] : 'RUB',
        'req_format'    => in_array($s['req_format'] ?? '', ['RU', 'GE', 'other'], true) ? $s['req_format'] : 'RU',
        'maps'          => ($s['maps'] ?? '') === 'yandex' ? 'yandex' : 'google',
        'show_prices'   => ($s['show_prices'] ?? true) ? '1' : '0',
        'cookie_notice' => ($s['cookie_notice'] ?? true) ? '1' : '0',
        'operator_id'   => $opId !== null ? (string) $opId : null,
        'header_show'   => ($site['header']['show'] ?? true) ? '1' : '0',
        'header_burger' => in_array($site['header']['burger'] ?? '', ['auto', 'on', 'off'], true) ? $site['header']['burger'] : 'auto',
        'footer_show'   => ($site['footer']['show'] ?? true) ? '1' : '0',
        'footer_email'  => nn($site['footer']['email'] ?? null),
        'footer_phone'  => nn($site['footer']['phone'] ?? null),
    ];
    $st = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    foreach ($plain as $k => $v) {
        $st->execute([$k, $v]);
    }
    foreach (['site_title', 'seo_title', 'seo_description'] as $k) {
        put_i18n('settings_i18n', ['key' => $k], ['value' => $s[$k] ?? []]);
    }

    $pdo->exec('UPDATE social_links SET url = NULL');
    // Порядок задаёт только полный список из админки; в наполнении бывают одни заполненные.
    $full = count($site['social'] ?? []) === count(SOCIAL_NAMES);
    $pos = 0;
    $st = $pdo->prepare('UPDATE social_links SET url = ?, position = COALESCE(?, position) WHERE network = ?');
    foreach ($site['social'] ?? [] as $soc) {
        $st->execute([nn($soc['url'] ?? null), $full ? ++$pos : null, $soc['network']]);
    }

    foreach (['offer', 'privacy', 'cookies'] as $k) {
        $d = $site['docs'][$k] ?? null;
        $pdo->prepare('UPDATE docs SET hidden = ? WHERE key = ?')->execute([$d && ($d['show'] ?? false) ? 0 : 1, $k]);
        if ($d) {
            put_i18n('doc_i18n', ['key' => $k], ['title' => $d['title'] ?? [], 'body' => $d['body'] ?? []]);
        }
    }

    $ctx = ['main' => $main, 'photos_dir' => $opts['photos_dir'] ?? null, 'next' => $max, 'next_m' => $mMax, 'ids' => &$ids];
    $used = [];
    write_blocks($site['blocks'] ?? [], null, $ctx, $used);
    return $ids;
}

/** Пустая строка — NULL. */
function nn($v): ?string
{
    if ($v === null) {
        return null;
    }
    $v = trim((string) $v);
    return $v === '' ? null : $v;
}

function max_tree_id(array $blocks): int
{
    $max = 0;
    foreach ($blocks as $b) {
        $max = max($max, is_int($b['id'] ?? null) ? $b['id'] : 0);
        foreach ($b['tiles'] ?? [] as $t) {
            $max = max($max, is_int($t['id'] ?? null) ? $t['id'] : 0, max_tree_id($t['blocks'] ?? []));
        }
    }
    return $max;
}

/** id элемента: свой (число) или новый; новые запоминаются в карте соответствий. */
function element_id($id, array &$ctx): int
{
    if (is_int($id) && $id > 0) {
        return $id;
    }
    $new = ++$ctx['next'];
    if ($id !== null && $id !== '') {
        $ctx['ids'][(string) $id] = $new;
    }
    return $new;
}

/** Тексты по языкам в таблицу *_i18n: $fields = ['title' => ['ru' => …], …]. Пустое — без строки. */
function put_i18n(string $table, array $keys, array $fields): void
{
    $byLang = [];
    foreach ($fields as $col => $vals) {
        foreach ((array) $vals as $lang => $v) {
            if (in_array($lang, LANGS, true) && is_string($v) && trim($v) !== '') {
                $byLang[$lang][$col] = $v;
            }
        }
    }
    foreach ($byLang as $lang => $cols) {
        $all = $keys + ['lang' => $lang] + $cols;
        $sql = sprintf('INSERT INTO %s (%s) VALUES (%s)', $table, implode(', ', array_keys($all)),
                       implode(', ', array_fill(0, count($all), '?')));
        db()->prepare($sql)->execute(array_values($all));
    }
}

/** $used — занятые slug плиток этой страницы: slug уникален в пределах страницы (раздел 4.4). */
function write_blocks(array $blocks, ?int $parentId, array &$ctx, array &$used): void
{
    $pos = 0;
    foreach ($blocks as $b) {
        $type = $b['type'];
        if ($type === 'tabs') {
            continue; // табы — этап 5
        }
        $row = ['id' => element_id($b['id'] ?? null, $ctx), 'type' => $type, 'parent_id' => $parentId,
                'position' => ++$pos, 'hidden' => !empty($b['hidden']) ? 1 : 0];
        $i18n = ['title' => $b['title'] ?? []];
        $wine = false;
        switch ($type) {
            case 'text':
                $row += ['title_size' => in_array($b['title_size'] ?? '', ['l', 'm', 's'], true) ? $b['title_size'] : 'm',
                         'body_size' => in_array($b['body_size'] ?? '', ['lead', 'normal', 'small'], true) ? $b['body_size'] : 'normal'];
                $i18n += ['eyebrow' => $b['eyebrow'] ?? [], 'subtitle' => $b['subtitle'] ?? [], 'body' => $b['text'] ?? []];
                break;
            case 'photo':
                $aspect = ($b['aspect'] ?? '3:2') === '4:5' ? '4:5' : '3:2';
                $row += ['frame' => $aspect, 'photo_width' => ($b['width'] ?? 'full') === 'narrow' ? 'narrow' : 'full',
                         'photo_id' => write_photo($b['photo'] ?? null, $aspect, $ctx)];
                $i18n = ['subtitle' => $b['caption'] ?? []];
                break;
            case 'tiles':
                $wine = ($b['kind'] ?? 'normal') === 'wine';
                $row += ['tiles_kind' => $wine ? 'wine' : 'normal',
                         'tiles_size' => in_array($b['size'] ?? '', ['large', 'compact'], true) ? $b['size'] : ($wine ? 'compact' : 'large'),
                         'frame' => $wine ? '4:5' : (($b['aspect'] ?? '4:5') === '3:2' ? '3:2' : '4:5')];
                break;
            case 'pay':
                $i18n += ['body' => $b['text'] ?? [], 'button_label' => $b['button'] ?? [], 'recipient' => $b['recipient'] ?? []];
                break;
            case 'service':
                $row += ['price' => num_or_null($b['price'] ?? null), 'link_url' => nn($b['url'] ?? null)];
                $i18n += ['body' => $b['text'] ?? [], 'button_label' => $b['button'] ?? [], 'recipient' => $b['recipient'] ?? [],
                          'price_note' => $b['price_note'] ?? []];
                break;
        }
        $id = insert_element($row, $i18n);
        if ($type === 'tiles') {
            write_tiles($b['tiles'] ?? [], $id, $row['frame'], $wine, $ctx, $used);
        }
        if ($type === 'pay') {
            write_methods($b['methods'] ?? [], $id, $ctx);
        }
    }
}

function write_tiles(array $tiles, int $blockId, string $frame, bool $wine, array &$ctx, array &$used): void
{
    $pos = 0;
    foreach ($tiles as $t) {
        $isNew = !is_int($t['id'] ?? null);
        $title = (string) ($t['title'][$ctx['main']] ?? (is_array($t['title'] ?? null) ? (reset($t['title']) ?: '') : ''));
        // Slug создаётся из названия при первом сохранении и дальше не меняется сам (раздел 4.4).
        $slug = (!$isNew && !empty($t['slug'])) ? (string) $t['slug'] : ((string) ($t['slug'] ?? '') ?: slugify($title));
        $slug = unique_slug($slug, $used);
        $row = ['id' => element_id($t['id'] ?? null, $ctx), 'type' => 'tile', 'parent_id' => $blockId, 'position' => ++$pos,
                'hidden' => !empty($t['hidden']) ? 1 : 0, 'slug' => $slug,
                'photo_id' => write_photo($t['photo'] ?? null, $frame, $ctx)];
        $i18n = ['title' => $t['title'] ?? [], 'subtitle' => $t['subtitle'] ?? [], 'body' => $t['text'] ?? []];
        if ($wine) {
            $row += ['price' => num_or_null($t['price'] ?? null), 'wine_color' => $t['wine_color'] ?? null,
                     'wine_sweet' => $t['wine_sweet'] ?? null, 'vintage' => num_or_null($t['vintage'] ?? null)];
            $row['vintage'] = $row['vintage'] !== null ? (int) $row['vintage'] : null;
            $i18n += ['grape' => $t['grape'] ?? []];
        } else {
            $row += ['as_page' => !empty($t['as_page']) ? 1 : 0, 'lat' => num_or_null($t['lat'] ?? null), 'lng' => num_or_null($t['lng'] ?? null)];
            $i18n += ['place' => $t['place'] ?? [], 'seo_title' => $t['seo_title'] ?? [], 'seo_description' => $t['seo_description'] ?? []];
        }
        $id = insert_element($row, $i18n);
        if ($isNew && ($t['id'] ?? null) !== null) {
            $ctx['ids']['slug:' . $t['id']] = $slug;
        }
        $inner = [];
        write_blocks($wine ? [] : ($t['blocks'] ?? []), $id, $ctx, $inner);
    }
}

function num_or_null($v): ?float
{
    if ($v === null || $v === '') {
        return null;
    }
    $v = str_replace([',', ' '], ['.', ''], (string) $v);
    return is_numeric($v) ? (float) $v : null;
}

function insert_element(array $row, array $i18n): int
{
    $sql = sprintf('INSERT INTO elements (%s) VALUES (%s)', implode(', ', array_keys($row)),
                   implode(', ', array_fill(0, count($row), '?')));
    db()->prepare($sql)->execute(array_values($row));
    $id = (int) ($row['id'] ?? db()->lastInsertId());
    put_i18n('element_i18n', ['element_id' => $id], $i18n);
    return $id;
}

function write_methods(array $methods, int $elementId, array &$ctx): void
{
    $providers = require APP_DIR . '/pay_providers.php';
    $pos = 0;
    foreach ($methods as $m) {
        $provider = isset($providers[$m['provider'] ?? '']) ? $m['provider'] : ($m['kind'] ?? 'custom');
        $kind = $providers[$provider]['kind'] ?? 'link';
        $mid = $m['id'] ?? null;
        if (!is_int($mid) || $mid <= 0) {
            $new = ++$ctx['next_m'];
            if ($mid !== null) {
                $ctx['ids']['m:' . $mid] = $new;
            }
            $mid = $new;
        }
        $req = $m['req'] ?? null;
        $image = nn($m['image'] ?? null);
        if ($image !== null && !preg_match('~^qr/[A-Za-z0-9._-]+$~', $image) && empty($ctx['photos_dir'])) {
            $image = null; // QR — только файлы, загруженные через админку
        }
        db()->prepare('INSERT INTO pay_methods (id, element_id, position, kind, provider, enabled, url, qr_path, req_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$mid, $elementId, ++$pos, $kind, $provider, ($m['on'] ?? true) ? 1 : 0,
                       nn($m['url'] ?? null), $image, $req ? json_encode($req, JSON_UNESCAPED_UNICODE) : null]);
        put_i18n('pay_method_i18n', ['method_id' => $mid], ['label' => $m['label'] ?? []]);
    }
}

/**
 * Фото элемента. Из админки — запись photos по id (кадр и поворот обновляются, рамка — по блоку);
 * из папки (тестовое наполнение) — файл копируется в исходники и создаётся запись.
 */
function write_photo(?array $photo, string $aspect, array $ctx): ?int
{
    if (!$photo) {
        return null;
    }
    $c = $photo['crop'] ?? null;
    $h = $photo['head_crop'] ?? null;
    $crop = [$c['x'] ?? null, $c['y'] ?? null, $c['w'] ?? null, $c['h'] ?? null];
    $head = [$h['x'] ?? null, $h['y'] ?? null, $h['w'] ?? null, $h['h'] ?? null];
    $rotate = (float) ($photo['rotate'] ?? $c['rotate'] ?? 0);

    if (!empty($photo['file']) && !empty($ctx['photos_dir'])) {
        $src = $ctx['photos_dir'] . '/' . basename($photo['file']);
        if (!is_file($src)) {
            throw new RuntimeException('Нет файла фото: ' . $photo['file']);
        }
        $name = store_original($src, strtolower(pathinfo($src, PATHINFO_EXTENSION)));
        db()->prepare('INSERT INTO photos (original_path, aspect, crop_x, crop_y, crop_w, crop_h, rotate, head_crop_x, head_crop_y, head_crop_w, head_crop_h)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$name, $aspect, ...$crop, $rotate, ...$head]);
        $id = (int) db()->lastInsertId();
    } elseif (is_int($photo['id'] ?? null)) {
        $id = $photo['id'];
        $st = db()->prepare('SELECT aspect, crop_w FROM photos WHERE id = ?');
        $st->execute([$id]);
        $old = $st->fetch();
        if (!$old) {
            return null;
        }
        // Сменилась рамка блока, а кадр старый — режем заново по центру (раздел 10.5, «Смена рамки»).
        if ($old['aspect'] !== $aspect && ($photo['aspect'] ?? $old['aspect']) !== $aspect) {
            $crop = [null, null, null, null];
        }
        db()->prepare('UPDATE photos SET aspect = ?, crop_x = ?, crop_y = ?, crop_w = ?, crop_h = ?, rotate = ?,
                       head_crop_x = ?, head_crop_y = ?, head_crop_w = ?, head_crop_h = ? WHERE id = ?')
            ->execute([$aspect, ...$crop, $rotate, ...$head, $id]);
    } else {
        return null;
    }
    photo_store_paths($id);
    return $id;
}

/** Исходник в data/uploads/originals/ под именем по содержимому; одинаковые файлы не дублируются. */
function store_original(string $src, string $ext): string
{
    if (!is_dir(ORIGINALS_DIR)) {
        mkdir(ORIGINALS_DIR, 0775, true);
    }
    $name = substr(sha1_file($src), 0, 12) . '.' . $ext;
    if (!is_file(ORIGINALS_DIR . '/' . $name)) {
        copy($src, ORIGINALS_DIR . '/' . $name);
    }
    return $name;
}

/** Slug из названия: транслитерация, нижний регистр, дефисы (раздел 4.4). */
function slugify(string $title): string
{
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i','й'=>'y','к'=>'k',
            'л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts',
            'ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya',
            'ა'=>'a','ბ'=>'b','გ'=>'g','დ'=>'d','ე'=>'e','ვ'=>'v','ზ'=>'z','თ'=>'t','ი'=>'i','კ'=>'k','ლ'=>'l','მ'=>'m',
            'ნ'=>'n','ო'=>'o','პ'=>'p','ჟ'=>'zh','რ'=>'r','ს'=>'s','ტ'=>'t','უ'=>'u','ფ'=>'p','ქ'=>'k','ღ'=>'gh','ყ'=>'q',
            'შ'=>'sh','ჩ'=>'ch','ც'=>'ts','ძ'=>'dz','წ'=>'ts','ჭ'=>'ch','ხ'=>'kh','ჯ'=>'j','ჰ'=>'h'];
    $s = strtr(mb_strtolower($title), $map);
    if (function_exists('iconv')) {
        $s = (string) @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
    }
    $s = trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($s)), '-');
    return substr($s, 0, 60) ?: 'item';
}

function unique_slug(string $slug, array &$used): string
{
    $base = $slug;
    $n = 1;
    while (isset($used[$slug]) || in_array($slug, RESERVED_SLUGS, true)) {
        $slug = $base . '-' . ++$n;
    }
    $used[$slug] = true;
    return $slug;
}
