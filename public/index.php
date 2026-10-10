<?php
declare(strict_types=1);

// Встроенный сервер PHP (локальная проверка): существующие файлы отдаёт сам.
if (PHP_SAPI === 'cli-server') {
    $file = __DIR__ . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if ($file !== __DIR__ . '/' && is_file($file)) {
        return false;
    }
}

// Единая точка входа: все адреса сайта приходят сюда (см. .htaccess).
require dirname(__DIR__) . '/app/bootstrap.php';

route($_SERVER['REQUEST_URI'] ?? '/');
