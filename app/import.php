<?php
declare(strict_types=1);

/**
 * Загрузка сайта из JSON формата 3 (спецификация 2.1, раздел 12) в базу.
 * Сейчас — для тестового наполнения; на этапе 5 сюда же придёт «Загрузить сайт» из ZIP.
 * Всё в одной транзакции: ошибка — в базе ничего не меняется.
 */

const RESERVED_SLUGS = ['admin', 'assets', 'uploads', 'doc', 'install', 'sitemap.xml', 'robots.txt', 'ru', 'ka', 'en', 'fr'];

/** $photosDir — папка, где лежат файлы фото из JSON (photo.file). */
function import_site(array $site, string $photosDir): void
{
    if (($site['format'] ?? null) !== 3) {
        throw new InvalidArgumentException('Нужен JSON формата 3');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach (['element_i18n', 'pay_method_i18n', 'pay_methods', 'elements', 'photos', 'settings_i18n',
                  'section_i18n', 'domain_i18n', 'domains', 'sections', 'doc_i18n', 'operators'] as $t) {
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

        $opIds = [];
        foreach ($site['operators'] ?? [] as $op) {
            $pdo->prepare('INSERT INTO operators (name, country, tax_id, reg_no, address, email) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$op['name'], $op['country'] ?? 'RU', $op['tax_id'] ?? null, $op['reg_no'] ?? null,
                           $op['address'] ?? null, $op['email'] ?? null]);
            $opIds[$op['id'] ?? count($opIds) + 1] = (int) $pdo->lastInsertId();
        }

        $s = $site['settings'] ?? [];
        $plain = [
            'currency'      => $s['currency'] ?? 'RUB',
            'req_format'    => $s['req_format'] ?? 'RU',
            'maps'          => $s['maps'] ?? 'google',
            'show_prices'   => ($s['show_prices'] ?? true) ? '1' : '0',
            'cookie_notice' => ($s['cookie_notice'] ?? true) ? '1' : '0',
            'operator_id'   => isset($s['operator'], $opIds[$s['operator']]) ? (string) $opIds[$s['operator']] : null,
            'header_show'   => ($site['header']['show'] ?? true) ? '1' : '0',
            'header_burger' => $site['header']['burger'] ?? 'auto',
            'footer_show'   => ($site['footer']['show'] ?? true) ? '1' : '0',
            'footer_email'  => $site['footer']['email'] ?? null,
            'footer_phone'  => $site['footer']['phone'] ?? null,
        ];
        $st = $pdo->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        foreach ($plain as $k => $v) {
            $st->execute([$k, $v]);
        }
        foreach (['site_title', 'seo_title', 'seo_description'] as $k) {
            put_i18n('settings_i18n', ['key' => $k], ['value' => $s[$k] ?? []]);
        }

        $pdo->exec('UPDATE social_links SET url = NULL');
        $st = $pdo->prepare('UPDATE social_links SET url = ? WHERE network = ?');
        foreach ($site['social'] ?? [] as $soc) {
            $st->execute([$soc['url'], $soc['network']]);
        }

        foreach (['offer', 'privacy', 'cookies'] as $k) {
            $d = $site['docs'][$k] ?? null;
            $pdo->prepare('UPDATE docs SET hidden = ? WHERE key = ?')->execute([$d && ($d['show'] ?? false) ? 0 : 1, $k]);
            if ($d) {
                put_i18n('doc_i18n', ['key' => $k], ['title' => $d['title'] ?? [], 'body' => $d['body'] ?? []]);
            }
        }

        $ctx = ['main' => $main, 'photos' => $photosDir];
        $used = [];
        import_blocks($site['blocks'] ?? [], null, $ctx, $used);
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        throw $ex;
    }
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
function import_blocks(array $blocks, ?int $parentId, array $ctx, array &$used): void
{
    $pos = 0;
    foreach ($blocks as $b) {
        $type = $b['type'];
        if ($type === 'tabs') {
            continue; // табы — этап 5
        }
        $row = ['type' => $type, 'parent_id' => $parentId, 'position' => ++$pos, 'hidden' => !empty($b['hidden']) ? 1 : 0];
        $i18n = ['title' => $b['title'] ?? []];
        switch ($type) {
            case 'text':
                $row += ['title_size' => $b['title_size'] ?? 'm', 'body_size' => $b['body_size'] ?? 'normal'];
                $i18n += ['eyebrow' => $b['eyebrow'] ?? [], 'subtitle' => $b['subtitle'] ?? [], 'body' => $b['text'] ?? []];
                break;
            case 'photo':
                $row += ['frame' => $b['aspect'] ?? '3:2', 'photo_width' => $b['width'] ?? 'full',
                         'photo_id' => import_photo($b['photo'] ?? null, $b['aspect'] ?? '3:2', $ctx)];
                $i18n += ['subtitle' => $b['caption'] ?? []];
                break;
            case 'tiles':
                $wine = ($b['kind'] ?? 'normal') === 'wine';
                $row += ['tiles_kind' => $wine ? 'wine' : 'normal', 'tiles_size' => $b['size'] ?? ($wine ? 'compact' : 'large'),
                         'frame' => $wine ? '4:5' : ($b['aspect'] ?? '4:5')];
                break;
            case 'pay':
                $i18n += ['body' => $b['text'] ?? [], 'button_label' => $b['button'] ?? [], 'recipient' => $b['recipient'] ?? []];
                break;
            case 'service':
                $row += ['price' => $b['price'] ?? null, 'link_url' => $b['url'] ?? null];
                $i18n += ['body' => $b['text'] ?? [], 'button_label' => $b['button'] ?? [], 'recipient' => $b['recipient'] ?? [],
                          'price_note' => $b['price_note'] ?? []];
                break;
        }
        $id = insert_element($row, $i18n);
        if ($type === 'tiles') {
            import_tiles($b['tiles'] ?? [], $id, $row['frame'], $wine, $ctx, $used);
        }
        if ($type === 'pay') {
            import_methods($b['methods'] ?? [], $id);
        }
    }
}

function import_tiles(array $tiles, int $blockId, string $frame, bool $wine, array $ctx, array &$used): void
{
    $pos = 0;
    foreach ($tiles as $t) {
        $title = $t['title'][$ctx['main']] ?? (is_array($t['title'] ?? null) ? (reset($t['title']) ?: '') : '');
        $slug = unique_slug($t['slug'] ?? slugify($title), $used);
        $row = ['type' => 'tile', 'parent_id' => $blockId, 'position' => ++$pos, 'hidden' => !empty($t['hidden']) ? 1 : 0,
                'slug' => $slug, 'as_page' => !empty($t['as_page']) ? 1 : 0,
                'lat' => $t['lat'] ?? null, 'lng' => $t['lng'] ?? null,
                'photo_id' => import_photo($t['photo'] ?? null, $frame, $ctx)];
        $i18n = ['title' => $t['title'] ?? [], 'subtitle' => $t['subtitle'] ?? [], 'body' => $t['text'] ?? [],
                 'place' => $t['place'] ?? [], 'seo_title' => $t['seo_title'] ?? [], 'seo_description' => $t['seo_description'] ?? []];
        if ($wine) {
            $row += ['price' => $t['price'] ?? null, 'wine_color' => $t['wine_color'] ?? null,
                     'wine_sweet' => $t['wine_sweet'] ?? null, 'vintage' => $t['vintage'] ?? null];
            $i18n += ['grape' => $t['grape'] ?? []];
        }
        $id = insert_element($row, $i18n);
        $inner = [];
        import_blocks($t['blocks'] ?? [], $id, $ctx, $inner);
    }
}

function insert_element(array $row, array $i18n): int
{
    $sql = sprintf('INSERT INTO elements (%s) VALUES (%s)', implode(', ', array_keys($row)),
                   implode(', ', array_fill(0, count($row), '?')));
    db()->prepare($sql)->execute(array_values($row));
    $id = (int) db()->lastInsertId();
    put_i18n('element_i18n', ['element_id' => $id], $i18n);
    return $id;
}

function import_methods(array $methods, int $elementId): void
{
    $pos = 0;
    foreach ($methods as $m) {
        $req = $m['req'] ?? null;
        db()->prepare('INSERT INTO pay_methods (element_id, position, kind, provider, enabled, url, qr_path, req_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$elementId, ++$pos, $m['kind'], $m['provider'] ?? null, ($m['on'] ?? true) ? 1 : 0,
                       $m['url'] ?? null, $m['image'] ?? null, $req ? json_encode($req, JSON_UNESCAPED_UNICODE) : null]);
        put_i18n('pay_method_i18n', ['method_id' => (int) db()->lastInsertId()], ['label' => $m['label'] ?? []]);
    }
}

/** Фото: файл копируется в data/uploads/originals/, размеры режутся при первом показе. */
function import_photo(?array $photo, string $aspect, array $ctx): ?int
{
    if (!$photo || empty($photo['file'])) {
        return null;
    }
    $src = $ctx['photos'] . '/' . basename($photo['file']);
    if (!is_file($src)) {
        throw new RuntimeException('Нет файла фото: ' . $photo['file']);
    }
    if (!is_dir(ORIGINALS_DIR)) {
        mkdir(ORIGINALS_DIR, 0775, true);
    }
    $name = substr(sha1_file($src), 0, 12) . '.' . strtolower(pathinfo($src, PATHINFO_EXTENSION));
    if (!is_file(ORIGINALS_DIR . '/' . $name)) {
        copy($src, ORIGINALS_DIR . '/' . $name);
    }
    $c = $photo['crop'] ?? [];
    $h = $photo['head_crop'] ?? [];
    db()->prepare('INSERT INTO photos (original_path, aspect, crop_x, crop_y, crop_w, crop_h, rotate, head_crop_x, head_crop_y, head_crop_w, head_crop_h)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([$name, $aspect, $c['x'] ?? null, $c['y'] ?? null, $c['w'] ?? null, $c['h'] ?? null, $c['rotate'] ?? 0,
                   $h['x'] ?? null, $h['y'] ?? null, $h['w'] ?? null, $h['h'] ?? null]);
    $id = (int) db()->lastInsertId();
    photo_store_paths($id);
    return $id;
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
