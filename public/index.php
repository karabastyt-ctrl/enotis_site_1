<?php
declare(strict_types=1);

// Встроенный сервер PHP (локальная проверка): существующие файлы отдаёт сам.
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if ($file !== __DIR__ . '/' && is_file($file)) {
        return false;
    }
}

// Идёт замена кода при обновлении (раздел 14.2): посетителям — «Сайт обновляется»,
// пока файлы меняются. Шаги обновления в админке проходят. Флаг старше 10 минут не действует.
$maint = (getenv('ENOTIS_DATA') ?: dirname(__DIR__) . '/data') . '/update/maintenance';
if (is_file($maint) && time() - (int) filemtime($maint) < 600
    && !str_starts_with((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/admin/api/update')) {
    http_response_code(503);
    header('Retry-After: 60');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>…</title>'
       . '<p style="font:16px sans-serif;margin:3em auto;max-width:30em;text-align:center">Сайт обновляется, зайдите через минуту.<br>'
       . 'Updating, please come back in a minute.</p>';
    return;
}

// Единая точка входа: все адреса сайта приходят сюда (см. .htaccess).
require dirname(__DIR__) . '/app/bootstrap.php';

route($_SERVER['REQUEST_URI'] ?? '/');
