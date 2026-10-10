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
        demo_autoload();
        current_lang(default_lang());
    } catch (Throwable $ex) {
        error_log('[db] ' . $ex->getMessage());
        http_response_code(503);
        header('Retry-After: 60');
        echo view('updating');
        return;
    }

    if (str_starts_with($path, '/uploads/')) {
        if (!serve_missing_photo($path)) {
            http_response_code(404);
        }
        return;
    }

    $segs = $path === '/' ? [] : explode('/', substr($path, 1));

    // Язык из префикса: /ka/…, /en/…; основной язык — без префикса (раздел 4.6).
    if ($segs && in_array($segs[0], LANGS, true)) {
        $active = array_column(site_languages(), 'code');
        if ($segs[0] === default_lang()) {
            redirect(url('/' . implode('/', array_slice($segs, 1))), 301);
            return;
        }
        if (!in_array($segs[0], $active, true)) {
            not_found();
            return;
        }
        current_lang(array_shift($segs));
    }

    $page = resolve_page($segs);
    if ($page === null) {
        // Переключатель языков: страницы нет на этом языке — на главную языка (раздел 4.6).
        if (isset($_GET['switch'])) {
            redirect(url('/'), 302);
            return;
        }
        not_found();
        return;
    }
    if (isset($_GET['switch'])) {
        redirect(url($page['path']), 302);
        return;
    }
    render($page['view'], $page);
}

/** Что показать по адресу без языкового префикса. null — 404. */
function resolve_page(array $segs): ?array
{
    $home = home_blocks();
    $n = count($segs);

    if ($n === 0) {
        return home_page($home, null);
    }
    if ($n === 2 && $segs[0] === 'doc') {
        $d = doc($segs[1]);
        return $d ? ['view' => 'page_doc', 'doc' => $d, 'path' => '/doc/' . $segs[1],
                     'title' => $d['title'] . ' — ' . site_title(), 'back' => url('/')] : null;
    }
    if ($n > 2) {
        return null;
    }

    $tile = find_tile($home, $segs[0]);
    $opens = $tile ? tile_opens($tile) : null;
    if ($n === 1) {
        return match ($opens) {
            'page'  => tile_page($tile, null),
            'popup' => home_page($home, $tile),
            default => null,
        };
    }
    if ($opens !== 'page') {
        return null;
    }
    $inner = find_tile(visible_children($tile), $segs[1]);
    return ($inner && tile_opens($inner) === 'popup') ? tile_page($tile, $inner) : null;
}

function home_page(array $blocks, ?array $popup): array
{
    $title = setting_text('seo_title') ?? site_title();
    $desc = setting_text('seo_description');
    if ($desc === null) {
        foreach ($blocks as $b) {
            if ($b['type'] === 'text' && $b['body']) {
                $desc = $b['body'];
                break;
            }
        }
    }
    $page = ['view' => 'page_home', 'blocks' => $blocks, 'path' => '/', 'title' => $title,
             'description' => $desc, 'popup' => null];
    return $popup ? with_popup($page, $popup, null) : $page;
}

function tile_page(array $tile, ?array $popup): array
{
    $title = $tile['seo_title'] ?? ($tile['title'] . ' — ' . site_title());
    $page = ['view' => 'page_tile', 'tile' => $tile, 'blocks' => visible_children($tile),
             'path' => '/' . $tile['slug'], 'title' => $title,
             'description' => $tile['seo_description'] ?? $tile['subtitle'] ?? $tile['body'],
             'back' => url('/'), 'popup' => null];
    return $popup ? with_popup($page, $popup, $tile) : $page;
}

/** Страница с открытым поп-апом: адрес, заголовок и описание — от плитки поп-апа (раздел 9.2). */
function with_popup(array $page, array $tile, ?array $owner): array
{
    $page['popup'] = $tile;
    $page['path'] = ($owner ? '/' . $owner['slug'] : '') . '/' . $tile['slug'];
    $page['title'] = $tile['seo_title']
        ?? implode(' — ', array_filter([$tile['title'], $owner['title'] ?? null, site_title()]));
    $page['description'] = $tile['seo_description'] ?? $tile['subtitle'] ?? $tile['body'];
    return $page;
}

function not_found(): void
{
    http_response_code(404);
    render('404', ['title' => t('error.not_found'), 'path' => null, 'back' => url('/')]);
}

function redirect(string $to, int $code): void
{
    $qs = $_GET;
    unset($qs['switch']);
    header('Location: ' . $to . ($qs ? '?' . http_build_query($qs) : ''), true, $code);
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
