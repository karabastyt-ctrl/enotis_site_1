<?php
declare(strict_types=1);

function route(string $uri): void
{
    $path = rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/');
    $path = '/' . trim($path, '/');

    // Карта маршрутов наполняется на этапах 3–5 (лента, страницы плиток, табы, админка).
    $routes = [
        '/'       => fn() => render('home', ['title' => t('site.placeholder_title')]),
        '/health' => function (): void {
            header('Content-Type: text/plain; charset=utf-8');
            echo 'ok php=' . PHP_VERSION . ' sqlite=' . (extension_loaded('pdo_sqlite') ? 'yes' : 'no');
        },
    ];

    if (isset($routes[$path])) {
        $routes[$path]();
        return;
    }

    http_response_code(404);
    render('404', ['title' => t('error.not_found')]);
}
