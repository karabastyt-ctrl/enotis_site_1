<?php
declare(strict_types=1);

/**
 * Фотосервис (спецификация 2.1, раздел 10.6.1). Командует движок: сервис только вырезает фон
 * или улучшает фото, а кадр под рамку ставит наш сервер (GD) по правилам рамки.
 * Код обращения к сервису — в app/photo_service/{claid,photoroom}.php.
 *
 * ENOTIS_PHOTO_FAKE=1 — сервис-заглушка без сети (проверки в CI).
 */

require APP_DIR . '/photo_service/claid.php';
require APP_DIR . '/photo_service/photoroom.php';

const PHOTO_SERVICE_TIMEOUT = 60;
const PHOTO_MODES = ['studio', 'enhance'];

/** Студийное фото: бутылка ~80 % высоты кадра, дно на 8 % выше нижнего края (раздел 10.6.1). */
const STUDIO_SIZE = [1200, 1500];
const STUDIO_BOTTLE_H = 0.80;
const STUDIO_BOTTOM = 0.08;
const STUDIO_MAX_W = 0.86;

function photo_service_name(): string
{
    return setting('photo_service', 'claid') === 'photoroom' ? 'photoroom' : 'claid';
}

/** Можно ли отправлять фото: есть ключ (или заглушка) и у сервера есть curl. */
function photo_service_ready(): bool
{
    if (getenv('ENOTIS_PHOTO_FAKE')) {
        return true;
    }
    return (string) setting('photo_api_key', '') !== '' && function_exists('curl_init');
}

/** Ключ в админке: только последние 4 знака. */
function photo_key_masked(): string
{
    $k = (string) setting('photo_api_key', '');
    return $k === '' ? '' : '••••' . substr($k, -4);
}

/**
 * Обработать фото. Ответ сервиса хранится: повторный вызов с тем же режимом
 * сервис не трогает, пока не попросили «Обработать заново» ($again).
 * Возвращает ['ok' => true, 'processed' => путь, 'width', 'height', 'crop', 'fits']
 * или ['ok' => false, 'error' => код подписи]. Исключения наружу не выходят.
 */
function photo_process(int $id, string $mode, string $aspect, bool $again = false): array
{
    if (!in_array($mode, PHOTO_MODES, true)) {
        return ['ok' => false, 'error' => 'photo.svc_failed'];
    }
    $st = db()->prepare('SELECT * FROM photos WHERE id = ?');
    $st->execute([$id]);
    $p = $st->fetch();
    if (!$p) {
        return ['ok' => false, 'error' => 'photo.svc_failed'];
    }
    $aspect = $mode === 'studio' ? '4:5' : ($aspect === '3:2' ? '3:2' : '4:5');

    $name = null;
    if (!$again && $p['processed_path'] && $p['process_mode'] === $mode && is_file(ORIGINALS_DIR . '/' . $p['processed_path'])) {
        $name = $p['processed_path'];
    } else {
        if (!photo_service_ready()) {
            return ['ok' => false, 'error' => 'photo.svc_failed'];
        }
        try {
            $name = photo_service_run(ORIGINALS_DIR . '/' . $p['original_path'], $mode);
        } catch (Throwable $e) {
            error_log('photo service: ' . $e->getMessage());
            return ['ok' => false, 'error' => 'photo.svc_failed'];
        }
        db()->prepare('UPDATE photos SET processed_path = ?, process_mode = ? WHERE id = ?')->execute([$name, $mode, $id]);
    }
    [$w, $h] = getimagesize(ORIGINALS_DIR . '/' . $name) ?: [0, 0];
    [$crop, $fits] = suggest_crop($w, $h, $aspect, $mode);
    return ['ok' => true, 'processed' => $name, 'mode' => $mode, 'width' => $w, 'height' => $h, 'crop' => $crop, 'fits' => $fits];
}

/** Отправить исходник в сервис и сохранить готовый файл среди исходников. Возвращает имя файла. */
function photo_service_run(string $src, string $mode): string
{
    if (getenv('ENOTIS_PHOTO_FAKE')) {
        $bytes = photo_fake($src, $mode);
    } elseif (photo_service_name() === 'photoroom') {
        $bytes = photoroom_process($src, $mode, (string) setting('photo_api_key', ''));
    } else {
        $bytes = claid_process($src, $mode, (string) setting('photo_api_key', ''));
    }
    $img = @imagecreatefromstring($bytes);
    if (!$img) {
        throw new RuntimeException('ответ сервиса — не картинка');
    }
    if ($mode === 'studio') {
        $img = studio_compose($img);
    }
    $tmp = tempnam(sys_get_temp_dir(), 'enp');
    imagejpeg($img, $tmp, 92);
    $name = store_original($tmp, 'jpg');
    @unlink($tmp);
    return $name;
}

/**
 * Бутылка без фона (PNG с прозрачностью) → кадр 4:5 на песочном фоне с мягкой тенью.
 * Наклон до ±5° выпрямляется, бутылка ставится по центру; не влезает по ширине — уменьшается,
 * поля заполняются тем же ровным фоном (это не дорисовка).
 */
function studio_compose(GdImage $cut): GdImage
{
    imagealphablending($cut, false);
    imagesavealpha($cut, true);
    $tilt = mask_tilt($cut);
    if (abs($tilt) >= 0.3 && abs($tilt) <= 5) {
        $clear = imagecolorallocatealpha($cut, 0, 0, 0, 127);
        $cut = imagerotate($cut, $tilt, $clear);
        imagealphablending($cut, false);
        imagesavealpha($cut, true);
    }
    $box = mask_box($cut);
    if (!$box) {
        throw new RuntimeException('сервис вернул пустую картинку');
    }
    [$bx, $by, $bw, $bh] = $box;
    [$W, $H] = STUDIO_SIZE;
    $s = $H * STUDIO_BOTTLE_H / $bh;
    if ($bw * $s > $W * STUDIO_MAX_W) {
        $s = $W * STUDIO_MAX_W / $bw;
    }
    $dw = (int) round($bw * $s);
    $dh = (int) round($bh * $s);
    $dx = (int) round(($W - $dw) / 2);
    $dy = (int) round($H * (1 - STUDIO_BOTTOM) - $dh);

    [$r, $g, $b] = wine_bg_rgb();
    $out = imagecreatetruecolor($W, $H);
    imagefill($out, 0, 0, imagecolorallocate($out, $r, $g, $b));
    imagealphablending($out, true);
    // Тень: несколько вложенных эллипсов, от светлого края к тёмному центру.
    $sw = $dw * 1.15;
    $sh = max(12, $dw * 0.16);
    $cy = $dy + $dh + $sh * 0.1;
    for ($i = 0; $i < 12; $i++) {
        $k = 1 - $i / 12;
        imagefilledellipse($out, (int) ($W / 2), (int) $cy, (int) ($sw * $k), (int) ($sh * $k), imagecolorallocatealpha($out, 40, 30, 25, 123 - $i * 3));
    }
    imagecopyresampled($out, $cut, $dx, $dy, $bx, $by, $dw, $dh, $bw, $bh);
    return $out;
}

/** Цвет фона карточки вина из темы (--c-wine-bg), чтобы фото и карточка совпадали. */
function wine_bg_rgb(): array
{
    $css = @file_get_contents(ROOT_DIR . '/public/assets/css/theme.css') ?: '';
    $hex = preg_match('~--c-wine-bg:\s*#([0-9A-Fa-f]{6})~', $css, $m) ? $m[1] : 'EAE0D2';
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

/** Уменьшенная копия маски для быстрых расчётов: [картинка, масштаб]. */
function mask_small(GdImage $img): array
{
    $w = imagesx($img);
    $h = imagesy($img);
    $k = min(1, 400 / max($w, $h));
    if ($k >= 1) {
        return [$img, 1.0];
    }
    $sm = imagecreatetruecolor(max(1, (int) ($w * $k)), max(1, (int) ($h * $k)));
    imagealphablending($sm, false);
    imagesavealpha($sm, true);
    imagecopyresampled($sm, $img, 0, 0, 0, 0, imagesx($sm), imagesy($sm), $w, $h);
    return [$sm, $k];
}

/** Рамка непрозрачной части: [x, y, w, h] в пикселях картинки или null. */
function mask_box(GdImage $img): ?array
{
    [$sm, $k] = mask_small($img);
    $w = imagesx($sm);
    $h = imagesy($sm);
    $x0 = $w; $y0 = $h; $x1 = -1; $y1 = -1;
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            if (((imagecolorat($sm, $x, $y) >> 24) & 0x7F) < 100) {
                $x0 = min($x0, $x); $x1 = max($x1, $x);
                $y0 = min($y0, $y); $y1 = max($y1, $y);
            }
        }
    }
    if ($x1 < 0) {
        return null;
    }
    $W = imagesx($img);
    $H = imagesy($img);
    $x = max(0, (int) floor($x0 / $k));
    $y = max(0, (int) floor($y0 / $k));
    return [$x, $y, min($W, (int) ceil(($x1 + 1) / $k)) - $x, min($H, (int) ceil(($y1 + 1) / $k)) - $y];
}

/** Наклон вытянутого объекта от вертикали, в градусах (по моментам маски; + — по часовой). */
function mask_tilt(GdImage $img): float
{
    [$sm] = mask_small($img);
    $w = imagesx($sm);
    $h = imagesy($sm);
    $n = $sx = $sy = $sxx = $syy = $sxy = 0.0;
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            if (((imagecolorat($sm, $x, $y) >> 24) & 0x7F) < 100) {
                $n++; $sx += $x; $sy += $y; $sxx += $x * $x; $syy += $y * $y; $sxy += $x * $y;
            }
        }
    }
    if ($n < 50) {
        return 0.0;
    }
    $mx = $sx / $n; $my = $sy / $n;
    $mu20 = $sxx / $n - $mx * $mx;
    $mu02 = $syy / $n - $my * $my;
    $mu11 = $sxy / $n - $mx * $my;
    if ($mu02 < $mu20 * 1.5) {
        return 0.0; // объект не вытянут по вертикали — наклон не определить
    }
    // Угол главной оси от вертикали; imagerotate крутит против часовой при положительном угле.
    return -rad2deg(0.5 * atan2(2 * $mu11, $mu02 - $mu20));
}

/**
 * Стартовый кадр редактора. Студийное фото уже собрано в 4:5 — кадр весь.
 * «Улучшить»: самый большой кадр рамки, по центру по горизонтали; по высоте — ближе к верху
 * (головы, купола и крыши не режутся). $fits = false, если срезано больше трети стороны.
 */
function suggest_crop(int $w, int $h, string $aspect, string $mode): array
{
    $ratio = $aspect === '3:2' ? 3 / 2 : 4 / 5;
    if ($w <= 0 || $h <= 0) {
        return [null, true];
    }
    if ($w / $h > $ratio) {
        $cw = $h * $ratio; $ch = $h;
        $cx = ($w - $cw) / 2; $cy = 0;
    } else {
        $cw = $w; $ch = $w / $ratio;
        $cx = 0; $cy = ($h - $ch) * ($mode === 'enhance' ? 0.3 : 0.5);
    }
    $fits = $mode === 'studio' || ($cw >= $w * 0.67 && $ch >= $h * 0.67);
    return [['x' => round($cx), 'y' => round($cy), 'w' => round($cw), 'h' => round($ch)], $fits];
}

/** Заглушка: светлый фон → прозрачный (студия), лёгкий контраст (улучшить). */
function photo_fake(string $src, string $mode): string
{
    $img = load_image($src);
    if (!$img) {
        throw new RuntimeException('нет исходника');
    }
    if ($mode === 'enhance') {
        imagefilter($img, IMG_FILTER_CONTRAST, -8);
        ob_start();
        imagejpeg($img, null, 92);
        return (string) ob_get_clean();
    }
    $w = imagesx($img);
    $h = imagesy($img);
    $out = imagecreatetruecolor($w, $h);
    imagealphablending($out, false);
    imagesavealpha($out, true);
    $clear = imagecolorallocatealpha($out, 0, 0, 0, 127);
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            $c = imagecolorat($img, $x, $y);
            $r = ($c >> 16) & 255; $g = ($c >> 8) & 255; $b = $c & 255;
            imagesetpixel($out, $x, $y, $r > 225 && $g > 225 && $b > 225 ? $clear : ($c & 0xFFFFFF));
        }
    }
    ob_start();
    imagepng($out);
    return (string) ob_get_clean();
}

/** POST multipart через curl; ответ — тело. Ошибка сети или код не 2xx — исключение. */
function photo_http(string $url, array $headers, array $fields): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => PHOTO_SERVICE_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false || $code < 200 || $code >= 300) {
        throw new RuntimeException("HTTP $code $err " . substr((string) $body, 0, 300));
    }
    return (string) $body;
}

function photo_http_get(string $url): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => PHOTO_SERVICE_TIMEOUT, CURLOPT_FOLLOWLOCATION => true]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code !== 200) {
        throw new RuntimeException("HTTP $code при скачивании результата");
    }
    return (string) $body;
}
