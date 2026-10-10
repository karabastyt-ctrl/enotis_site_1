<?php
declare(strict_types=1);

/**
 * Выгрузка и загрузка сайта и таба одним ZIP (спецификация 2.1, раздел 13).
 * В ZIP: site.json (формат 3, раздел 12) + photos/ (исходники фото) + qr/ (картинки QR) + brand/ (логотип и значки).
 * Секретов в выгрузке нет: site_export() их не знает (логин, пароль, почта администратора, ящик, ключ, счётчик).
 */

const TRANSFER_TMP = DATA_DIR . '/tmp';
const ZIP_MAX_UNPACKED = 1024 * 1024 * 1024;
/** Что может лежать в ZIP: имя проверяется целиком, вложенных папок нет. */
const ZIP_ALLOWED = '~^(site\.json|photos/[A-Za-z0-9._-]+|qr/[A-Za-z0-9._-]+|brand/[A-Za-z0-9._-]+)$~';
/** Тексты блоков и плиток: в «Только структура» они пустые. */
const TEXT_KEYS = ['eyebrow', 'title', 'subtitle', 'text', 'caption', 'place', 'grape', 'button', 'recipient', 'price_note',
                   'seo_title', 'seo_description'];

/* ---------------------------------------------------------------- выгрузка */

/** ZIP сайта целиком ($tabId = null) или одного таба как отдельного сайта. Путь к временному файлу или null. */
function export_zip(bool $structure, ?int $tabId): ?string
{
    $site = site_export();
    if ($tabId !== null) {
        $site = tab_as_site($site, $tabId);
        if ($site === null) {
            return null;
        }
    }
    if ($structure) {
        $site = structure_only($site);
    }
    $files = [];
    $site['blocks'] = export_files($site['blocks'], $files);
    foreach (array_keys(BRAND_KEYS) as $key) {
        $path = brand_path($site['settings'][$key]['url'] ?? null);
        if ($path && !$structure) {
            $files[$path] = PUBLIC_UPLOADS . '/' . $path;
            $site['settings'][$key]['url'] = $path;
        } else {
            $site['settings'][$key] = null;
        }
    }

    if (!is_dir(TRANSFER_TMP)) {
        mkdir(TRANSFER_TMP, 0775, true);
    }
    $zipFile = TRANSFER_TMP . '/export-' . bin2hex(random_bytes(6)) . '.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return null;
    }
    $zip->addFromString('site.json', json_encode($site, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION));
    foreach ($files as $name => $src) {
        $zip->addFile($src, $name);
    }
    $zip->close();
    return $zipFile;
}

/** Фото и QR дерева → файлы для ZIP; в JSON остаются имя файла и кадр. */
function export_files(array $blocks, array &$files): array
{
    foreach ($blocks as &$b) {
        if (isset($b['photo'])) {
            $b['photo'] = export_photo_file($b['photo'], $files);
        }
        foreach ($b['methods'] ?? [] as $i => $m) {
            $img = (string) ($m['image'] ?? '');
            if ($img !== '' && is_file(PUBLIC_UPLOADS . '/' . $img)) {
                $files[$img] = PUBLIC_UPLOADS . '/' . $img;
            } else {
                $b['methods'][$i]['image'] = '';
            }
        }
        foreach ($b['tabs'] ?? [] as $i => $tab) {
            $b['tabs'][$i]['blocks'] = export_files($tab['blocks'] ?? [], $files);
        }
        foreach ($b['tiles'] ?? [] as $i => $t) {
            $b['tiles'][$i]['photo'] = export_photo_file($t['photo'] ?? null, $files);
            if (isset($t['blocks'])) {
                $b['tiles'][$i]['blocks'] = export_files($t['blocks'], $files);
            }
        }
    }
    return $blocks;
}

function export_photo_file(?array $photo, array &$files): ?array
{
    if (!$photo || !is_int($photo['id'] ?? null)) {
        return null;
    }
    $st = db()->prepare('SELECT original_path FROM photos WHERE id = ?');
    $st->execute([$photo['id']]);
    $orig = $st->fetchColumn();
    if (!$orig || !is_file(ORIGINALS_DIR . '/' . $orig)) {
        return null;
    }
    $files['photos/' . $orig] = ORIGINALS_DIR . '/' . $orig;
    return ['file' => $orig, 'aspect' => $photo['aspect'], 'rotate' => $photo['rotate'] ?? 0,
            'crop' => $photo['crop'] ?? null, 'head_crop' => $photo['head_crop'] ?? null];
}

/**
 * Таб как отдельный сайт без блока Табы (раздел 13): настройки таба — настройки сайта, владелец — с ним.
 * В source_tab — подпись и slug, чтобы «Загрузить таб» вернул их как были.
 */
function tab_as_site(array $site, int $tabId): ?array
{
    $tab = null;
    foreach ($site['blocks'] as $b) {
        foreach ($b['type'] === 'tabs' ? $b['tabs'] : [] as $t) {
            if ($t['id'] === $tabId) {
                $tab = $t;
            }
        }
    }
    if (!$tab) {
        return null;
    }
    foreach (['currency', 'req_format', 'operator', 'maps', 'show_prices'] as $k) {
        $site['settings'][$k] = $tab[$k];
    }
    $site['operators'] = array_values(array_filter($site['operators'], fn($o) => $o['id'] === $tab['operator']));
    $site['domains'] = [];
    $site['blocks'] = $tab['blocks'];
    $site['source_tab'] = ['slug' => $tab['slug'], 'title' => $tab['title']];
    return $site;
}

/** «Только структура»: блоки, плитки и настройки без текстов, фото, координат, ссылок оплаты и реквизитов. */
function structure_only(array $site): array
{
    foreach (['site_title', 'seo_title', 'seo_description'] as $k) {
        $site['settings'][$k] = (object) [];
    }
    $site['settings']['operator'] = null;
    $site['operators'] = [];
    $site['domains'] = [];
    $site['social'] = [];
    $site['footer']['email'] = '';
    $site['footer']['phone'] = '';
    foreach ($site['docs'] as $k => $d) {
        $site['docs'][$k] = ['show' => false, 'title' => (object) [], 'body' => (object) []];
    }
    $site['blocks'] = structure_blocks($site['blocks']);
    return $site;
}

function structure_blocks(array $blocks): array
{
    foreach ($blocks as &$b) {
        $b = strip_texts($b);
        if (($b['type'] ?? '') === 'service') {
            $b['url'] = '';
            $b['price'] = null;
            $b['hidden'] = true; // без ссылки видимая услуга не сохраняется (раздел 10.9)
        }
        foreach ($b['methods'] ?? [] as $i => $m) {
            $b['methods'][$i] = ['kind' => $m['kind'], 'provider' => $m['provider'], 'on' => false, 'url' => '', 'image' => '',
                                 'label' => (object) [], 'req' => $m['kind'] === 'requisites' ? ['purpose' => (object) []] : null];
        }
        foreach ($b['tabs'] ?? [] as $i => $tab) {
            $b['tabs'][$i]['operator'] = null;
            $b['tabs'][$i]['blocks'] = structure_blocks($tab['blocks'] ?? []);
        }
        foreach ($b['tiles'] ?? [] as $i => $t) {
            $t = strip_texts($t);
            $t['photo'] = null;
            foreach (['lat', 'lng', 'price', 'vintage'] as $k) {
                if (array_key_exists($k, $t)) {
                    $t[$k] = null;
                }
            }
            if (isset($t['blocks'])) {
                $t['blocks'] = structure_blocks($t['blocks']);
            }
            $b['tiles'][$i] = $t;
        }
    }
    return $blocks;
}

function strip_texts(array $n): array
{
    foreach (TEXT_KEYS as $k) {
        if (array_key_exists($k, $n)) {
            $n[$k] = (object) [];
        }
    }
    if (array_key_exists('photo', $n)) {
        $n['photo'] = null;
    }
    return $n;
}

/* ---------------------------------------------------------------- загрузка */

/**
 * Распаковать ZIP во временную папку: только site.json, photos/, qr/, brand/ с плоскими именами.
 * Возвращает [папка, дерево] или строку-код ошибки.
 */
function unpack_zip(string $zipFile): array|string
{
    $zip = new ZipArchive();
    if ($zip->open($zipFile) !== true) {
        return 'transfer.bad_zip';
    }
    $dir = TRANSFER_TMP . '/import-' . bin2hex(random_bytes(6));
    foreach (['', '/photos', '/qr', '/brand'] as $sub) {
        mkdir($dir . $sub, 0775, true);
    }
    $total = 0;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $st = $zip->statIndex($i);
        $name = (string) $st['name'];
        if (str_ends_with($name, '/') || !preg_match(ZIP_ALLOWED, $name)) {
            continue;
        }
        $total += (int) $st['size'];
        if ($total > ZIP_MAX_UNPACKED) {
            $zip->close();
            remove_dir($dir);
            return 'transfer.too_big';
        }
        $in = $zip->getStream($name);
        $out = fopen($dir . '/' . $name, 'wb');
        stream_copy_to_stream($in, $out);
        fclose($in);
        fclose($out);
    }
    $zip->close();
    $json = is_file($dir . '/site.json') ? json_decode((string) file_get_contents($dir . '/site.json'), true) : null;
    if (!is_array($json) || ($json['format'] ?? null) !== 3) {
        remove_dir($dir);
        return 'transfer.no_site';
    }
    return [$dir, $json];
}

/** Картинки QR и оформления — в public/uploads, только настоящие картинки. */
function import_images(string $dir): void
{
    foreach (['qr', 'brand'] as $sub) {
        foreach (glob($dir . '/' . $sub . '/*') ?: [] as $f) {
            $isSvg = str_ends_with(strtolower($f), '.svg');
            if (!$isSvg && !@getimagesize($f)) {
                continue;
            }
            if ($isSvg) {
                file_put_contents($f, svg_clean((string) file_get_contents($f)));
            }
            if (!is_dir(PUBLIC_UPLOADS . '/' . $sub)) {
                mkdir(PUBLIC_UPLOADS . '/' . $sub, 0775, true);
            }
            copy($f, PUBLIC_UPLOADS . '/' . $sub . '/' . basename($f));
        }
    }
}

/** SVG без скриптов, обработчиков событий и внешних ссылок (разделы 10.5, 10.6). */
function svg_clean(string $svg): string
{
    $svg = preg_replace('~<\s*(script|foreignObject)\b.*?<\s*/\s*\1\s*>~is', '', $svg);
    $svg = preg_replace('~<\s*(script|foreignObject)\b[^>]*/>~is', '', $svg);
    $svg = preg_replace('~\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)~i', '', $svg);
    $svg = preg_replace('~(href\s*=\s*["\'])\s*(javascript|data):[^"\']*~i', '$1#', $svg);
    return (string) $svg;
}

function remove_dir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $f) {
        $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
    }
    rmdir($dir);
}

/**
 * «Загрузить сайт»: проверки как при сохранении; ошибка — ничего не записывается.
 * Перед заменой — копия базы в data/backups/ (раздел 13).
 */
function import_zip_site(string $zipFile): array
{
    $r = unpack_zip($zipFile);
    if (is_string($r)) {
        return ['ok' => false, 'error' => $r];
    }
    [$dir, $site] = $r;
    try {
        unset($site['source_tab']);
        $check = site_validate($site);
        if ($check['errors']) {
            return ['ok' => false, 'errors' => $check['errors']];
        }
        // Оформление: только файлы, которые есть в архиве (brand/имя).
        foreach (array_keys(BRAND_KEYS) as $key) {
            $v = $site['settings'][$key]['url'] ?? null;
            if (!is_string($v) || !preg_match('~^brand/[A-Za-z0-9._-]+$~', $v) || !is_file($dir . '/' . $v)) {
                $site['settings'][$key] = null;
            }
        }
        db_backup(db(), 'import');
        import_images($dir);
        import_site($site, $dir . '/photos');
        db()->exec("DELETE FROM settings WHERE key = 'demo_version'");
        setting_reset();
        return ['ok' => true];
    } finally {
        remove_dir($dir);
    }
}

/**
 * «Загрузить таб»: ZIP сайта без табов → новый таб для админки (раздел 13). В базу пишутся только фото;
 * таб появляется в дереве скрытым и сохраняется кнопкой «Сохранить».
 */
function import_zip_tab(string $zipFile): array
{
    $r = unpack_zip($zipFile);
    if (is_string($r)) {
        return ['error' => $r];
    }
    [$dir, $site] = $r;
    try {
        foreach ($site['blocks'] ?? [] as $b) {
            if (($b['type'] ?? '') === 'tabs') {
                return ['error' => 'transfer.has_tabs'];
            }
        }
        $check = site_validate($site);
        if ($check['errors']) {
            return ['errors' => $check['errors']];
        }
        import_images($dir);
        $s = $site['settings'] ?? [];
        $main = $site['languages']['main'] ?? 'ru';
        $title = $site['source_tab']['title'] ?? ($s['site_title'] ?? []);
        $op = null;
        foreach ($site['operators'] ?? [] as $o) {
            if (($o['id'] ?? null) === ($s['operator'] ?? false)) {
                unset($o['id']);
                $op = $o;
            }
        }
        $tab = [
            'slug'       => (string) ($site['source_tab']['slug'] ?? substr(slugify((string) ($title[$main] ?? reset($title) ?: '')), 0, 40)),
            'title'      => (object) $title,
            'currency'   => $s['currency'] ?? 'RUB', 'req_format' => $s['req_format'] ?? 'RU',
            'maps'       => $s['maps'] ?? 'google', 'show_prices' => $s['show_prices'] ?? true,
            'blocks'     => store_tree_photos($site['blocks'] ?? [], $dir . '/photos'),
        ];
        return ['tab' => $tab, 'operator' => $op];
    } finally {
        remove_dir($dir);
    }
}

/** Фото из папки → записи photos; в дереве остаётся запись фото, как у элементов из админки. */
function store_tree_photos(array $blocks, string $photosDir): array
{
    $one = function (?array $p, string $aspect) use ($photosDir): ?array {
        if (!$p || empty($p['file'])) {
            return null;
        }
        $ctx = ['photos_dir' => $photosDir];
        try {
            $id = write_photo($p, $aspect, $ctx);
        } catch (RuntimeException) {
            return null;
        }
        return $id ? admin_photo_json($id) : null;
    };
    foreach ($blocks as &$b) {
        if (($b['type'] ?? '') === 'photo') {
            $b['photo'] = $one($b['photo'] ?? null, ($b['aspect'] ?? '3:2') === '4:5' ? '4:5' : '3:2');
        }
        if (($b['type'] ?? '') === 'tiles') {
            $aspect = ($b['kind'] ?? '') === 'wine' ? '4:5' : (($b['aspect'] ?? '4:5') === '3:2' ? '3:2' : '4:5');
            foreach ($b['tiles'] ?? [] as $i => $t) {
                $b['tiles'][$i]['photo'] = $one($t['photo'] ?? null, $aspect);
                if (isset($t['blocks'])) {
                    $b['tiles'][$i]['blocks'] = store_tree_photos($t['blocks'], $photosDir);
                }
            }
        }
    }
    return $blocks;
}
