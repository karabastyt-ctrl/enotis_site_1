<?php
declare(strict_types=1);

/**
 * Оформление (спецификация 2.1, разделы 9.2, 10.5): логотип, значок вкладки, картинка для соцсетей.
 * Файлы — в public/uploads/brand/, в настройках путь «brand/имя». Имена по содержимому, поэтому кэш не мешает.
 */

const BRAND_DIR = PUBLIC_UPLOADS . '/brand';
const BRAND_RE = '~^(?:/uploads/)?(brand/[A-Za-z0-9._-]+)$~';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_SIZES = [192, 180, 32];

/** Ключ в JSON сайта → ключ настройки. */
const BRAND_KEYS = ['logo' => 'logo_path', 'favicon' => 'favicon_path', 'og_image' => 'og_image_path'];

/** «/uploads/brand/x.png» или «brand/x.png» → «brand/x.png», если такой файл есть. */
function brand_path(mixed $url): ?string
{
    if (!is_string($url) || !preg_match(BRAND_RE, $url, $m) || !is_file(PUBLIC_UPLOADS . '/' . $m[1])) {
        return null;
    }
    return $m[1];
}

/** Загрузка из админки: $kind = logo | favicon | og_image. Ответ: ['url' => …] или ['error' => ключ]. */
function brand_store(string $kind, string $tmp, string $clientName): array
{
    if (!is_dir(BRAND_DIR)) {
        mkdir(BRAND_DIR, 0775, true);
    }
    $hash = substr(sha1_file($tmp), 0, 12);
    if ($kind === 'logo') {
        if (filesize($tmp) > LOGO_MAX_BYTES) {
            return ['error' => 'brand.too_big'];
        }
        $head = (string) file_get_contents($tmp, false, null, 0, 1024);
        if (preg_match('~<svg[\s>]~i', $head) || str_ends_with(strtolower($clientName), '.svg')) {
            $svg = (string) file_get_contents($tmp);
            if (!preg_match('~<svg[\s>]~i', $svg)) {
                return ['error' => 'photo.bad_type'];
            }
            $name = 'logo-' . $hash . '.svg';
            file_put_contents(BRAND_DIR . '/' . $name, svg_clean($svg));
            return ['url' => '/uploads/brand/' . $name];
        }
        $ext = brand_ext($tmp);
        if (!$ext) {
            return ['error' => 'photo.bad_type'];
        }
        $name = 'logo-' . $hash . '.' . $ext;
        copy($tmp, BRAND_DIR . '/' . $name);
        return ['url' => '/uploads/brand/' . $name];
    }

    $img = load_image($tmp);
    if (!$img) {
        return ['error' => 'photo.bad_type'];
    }
    if ($kind === 'favicon') {
        if (min(imagesx($img), imagesy($img)) < 512) {
            return ['error' => 'brand.icon_small'];
        }
        $name = 'fav-' . $hash . '-512.png';
        if (!image_cover($img, 512, 512, BRAND_DIR . '/' . $name, 'png')) {
            return ['error' => 'photo.upload_failed'];
        }
        favicon_ensure('brand/' . $name);
        return ['url' => '/uploads/brand/' . $name];
    }
    if ($kind === 'og_image') {
        $name = 'og-' . $hash . '.jpg';
        if (!image_cover($img, 1200, 630, BRAND_DIR . '/' . $name, 'jpg')) {
            return ['error' => 'photo.upload_failed'];
        }
        return ['url' => '/uploads/brand/' . $name];
    }
    return ['error' => 'bad_request'];
}

function brand_ext(string $file): ?string
{
    $info = @getimagesize($file);
    return [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
}

/** Вписать картинку «с обрезкой по центру» в $w×$h и сохранить. */
function image_cover(GdImage $img, int $w, int $h, string $dst, string $type): bool
{
    $iw = imagesx($img);
    $ih = imagesy($img);
    $ratio = $w / $h;
    $cw = $iw / $ih > $ratio ? (int) round($ih * $ratio) : $iw;
    $ch = (int) round($cw / $ratio);
    $out = imagecreatetruecolor($w, $h);
    if ($type === 'png') {
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
    }
    imagecopyresampled($out, $img, 0, 0, (int) (($iw - $cw) / 2), (int) (($ih - $ch) / 2), $w, $h, $cw, $ch);
    $tmp = $dst . '.tmp';
    $ok = $type === 'png' ? imagepng($out, $tmp, 9) : imagejpeg($out, $tmp, 85);
    return $ok && rename($tmp, $dst);
}

/** Из значка 512 — 192, 180, 32 и favicon.ico (PNG внутри ICO). Уже есть — ничего не делает. */
function favicon_ensure(string $path): void
{
    $base = PUBLIC_UPLOADS . '/' . preg_replace('~-512\.png$~', '', $path);
    if (!str_ends_with($path, '-512.png') || is_file($base . '.ico')) {
        return;
    }
    $img = @imagecreatefrompng(PUBLIC_UPLOADS . '/' . $path);
    if (!$img) {
        return;
    }
    imagesavealpha($img, true);
    foreach (FAVICON_SIZES as $s) {
        image_cover($img, $s, $s, $base . '-' . $s . '.png', 'png');
    }
    $png = (string) file_get_contents($base . '-32.png');
    // ICO: заголовок, одна запись 32×32 32 бита, данные PNG.
    $ico = pack('vvv', 0, 1, 1) . pack('CCCCvvVV', 32, 32, 0, 0, 1, 32, strlen($png), 22) . $png;
    file_put_contents($base . '.ico', $ico);
}

/** Теги значка вкладки для <head>. Своего нет — значок с первой буквой названия сайта (/favicon.svg). */
function favicon_tags(): string
{
    $path = setting('favicon_path');
    if ($path && is_file(PUBLIC_UPLOADS . '/' . $path)) {
        $base = '/uploads/' . preg_replace('~-512\.png$~', '', $path);
        return '<link rel="icon" href="' . e($base) . '.ico" sizes="any">' . "\n"
             . '  <link rel="icon" type="image/png" sizes="32x32" href="' . e($base) . '-32.png">' . "\n"
             . '  <link rel="apple-touch-icon" href="' . e($base) . '-180.png">' . "\n"
             . '  <link rel="manifest" href="/site.webmanifest">';
    }
    return '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=' . substr(md5(site_initial()), 0, 6) . '">';
}

function site_initial(): string
{
    $t = trim(setting_text('site_title') ?? '');
    return $t === '' ? 'E' : mb_strtoupper(mb_substr($t, 0, 1));
}

/** /favicon.svg — первая буква названия на цвете действия (раздел 10.5). */
function favicon_svg(): void
{
    header('Content-Type: image/svg+xml');
    header('Cache-Control: public, max-age=86400');
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#6E2230"/>'
       . '<text x="32" y="44" text-anchor="middle" font-family="Georgia,serif" font-size="38" font-weight="600" fill="#FBF8F4">'
       . e(site_initial()) . '</text></svg>';
}

/** /favicon.ico: свой значок, иначе 404 (браузер возьмёт значок из <link>). */
function favicon_ico(): void
{
    $path = setting('favicon_path');
    $file = $path ? PUBLIC_UPLOADS . '/' . preg_replace('~-512\.png$~', '', $path) . '.ico' : null;
    if (!$file || !is_file($file)) {
        http_response_code(404);
        return;
    }
    header('Content-Type: image/x-icon');
    header('Cache-Control: public, max-age=86400');
    readfile($file);
}

/** /site.webmanifest: иконки 192 и 512 для телефона. */
function web_manifest(): void
{
    $path = setting('favicon_path');
    $icons = [];
    if ($path) {
        $base = '/uploads/' . preg_replace('~-512\.png$~', '', $path);
        $icons = [['src' => $base . '-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                  ['src' => $base . '-512.png', 'sizes' => '512x512', 'type' => 'image/png']];
    }
    header('Content-Type: application/manifest+json');
    echo json_encode(['name' => site_title(), 'short_name' => mb_substr(site_title(), 0, 12), 'icons' => $icons,
                      'theme_color' => '#F4EDE6', 'background_color' => '#F4EDE6', 'display' => 'browser'],
                     JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
