<?php
declare(strict_types=1);

function route(string $uri): void
{
    $path = rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/');
    $path = '/' . trim($path, '/');

    // Проверка живости работает, даже если база не поднялась.
    if ($path === '/health') {
        health();
        return;
    }

    try {
        db();
        current_lang(default_lang());
    } catch (Throwable $ex) {
        error_log('[db] ' . $ex->getMessage());
        http_response_code(503);
        header('Retry-After: 60');
        render('updating', ['title' => t('site.updating_title')]);
        return;
    }

    // Карта маршрутов наполняется на этапах 3–5 (лента, страницы плиток, табы, админка).
    $routes = [
        '/' => fn() => render('home', ['title' => t('site.placeholder_title')]),
    ];

    if (isset($routes[$path])) {
        $routes[$path]();
        return;
    }

    http_response_code(404);
    render('404', ['title' => t('error.not_found')]);
}

/** /health: версии PHP, движка и схемы базы. Чистая база создаётся здесь же при первом запросе. */
function health(): void
{
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    $line = 'php=' . PHP_VERSION . ' sqlite=' . (extension_loaded('pdo_sqlite') ? 'yes' : 'no')
          . ' engine=' . ENGINE_VERSION;
    try {
        $line = 'ok ' . $line . ' schema=' . schema_version(db());
    } catch (Throwable $ex) {
        error_log('[health] ' . $ex->getMessage());
        http_response_code(503);
        $line = 'error ' . $line . ' db=' . ($ex instanceof MigrationError ? 'migration-failed' : 'unavailable');
    }
    echo $line, "\n";
}
