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
        // Копия базы раз в день — при первом запросе после полуночи (раздел 10.11).
        backup_daily();
        // Админка — до выбора языка сайта: превью само решает, какие языки включены в правке.
        $admin = $path === '/admin' || str_starts_with($path, '/admin/');
        if (!$admin) {
            current_lang(default_lang());
        }
    } catch (Throwable $ex) {
        error_log('[db] ' . $ex->getMessage());
        // Новый код не поднял базу сразу после замены файлов — вернуть прежнюю версию (раздел 14.2).
        update_recover_after_failure();
        http_response_code(503);
        header('Retry-After: 60');
        echo view('updating');
        return;
    }
    // Мастер установки (раздел 14.1): /install → /admin/install (там живёт сессия админки).
    // Чистая установка без наполнения: главная тоже ведёт в мастер.
    if ($path === '/install' || ($path === '/' && install_open() && site_is_empty())) {
        admin_redirect('/admin/install');
        return;
    }
    if ($admin) {
        admin_route($path);
        return;
    }

    if (str_starts_with($path, '/uploads/')) {
        if (!serve_missing_photo($path)) {
            http_response_code(404);
        }
        return;
    }

    if ($path === '/cron') {
        header('Content-Type: text/plain');
        echo "ok\n";
        return;
    }
    if ($path === '/favicon.svg') {
        favicon_svg();
        return;
    }
    if ($path === '/favicon.ico') {
        favicon_ico();
        return;
    }
    if ($path === '/site.webmanifest') {
        web_manifest();
        return;
    }
    if ($path === '/robots.txt') {
        robots_txt();
        return;
    }
    if ($path === '/sitemap.xml') {
        sitemap_xml();
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
    // Табы без перезагрузки: JS просит только ленту таба и шапку (раздел 5.4).
    if (isset($_GET['fragment']) && $page['view'] === 'page_home' && !$page['popup']) {
        tab_fragment($page);
        return;
    }
    render($page['view'], $page);
}

/**
 * Что показать по адресу без языкового префикса (разделы 4.1, 4.2, 4.5). null — 404.
 * Заодно выбирает активный таб и ленту, чьи настройки действуют на странице.
 */
function resolve_page(array $segs): ?array
{
    $n = count($segs);
    active_tab(null);
    feed(null);
    if ($n === 2 && $segs[0] === 'doc') {
        $d = doc($segs[1]);
        return $d ? page_base('page_doc', '/doc/' . $segs[1], null) + ['doc' => $d,
                     'title' => $d['title'] . ' — ' . site_title(), 'back' => url('/')] : null;
    }

    // Адрес одного таба: лента таба — это и есть сайт, адреса без префикса.
    if ($single = single_tab()) {
        if (!tab_visible($single)) {
            return null;
        }
        active_tab($single);
        feed($single['id']);
        return $n === 0 ? home_page(null) : resolve_in(root_blocks($single['id']), $segs);
    }

    $tabs = visible_tabs();
    if ($tabs && $n > 0) {
        foreach ($tabs as $tab) {
            if ($tab['slug'] === $segs[0]) {
                active_tab($tab);
                feed($tab['id']);
                return $n === 1 ? home_page(null) : resolve_in(root_blocks($tab['id']), array_slice($segs, 1));
            }
        }
    }
    // Главная и плитки общих блоков над табами: активен первый таб, адреса без префикса.
    active_tab($tabs[0] ?? null);
    return $n === 0 ? home_page(null) : resolve_in(root_blocks(0), $segs);
}

/** Плитка по адресу внутри ленты: страница, поп-ап на главной или поп-ап на странице плитки. */
function resolve_in(array $blocks, array $segs): ?array
{
    $n = count($segs);
    if ($n === 0 || $n > 2) {
        return null;
    }
    $tile = find_tile($blocks, $segs[0]);
    $opens = $tile ? tile_opens($tile) : null;
    if ($n === 1) {
        return match ($opens) {
            'page'  => tile_page($tile, null),
            'popup' => home_page($tile),
            default => null,
        };
    }
    if ($opens !== 'page') {
        return null;
    }
    $inner = find_tile(visible_children($tile), $segs[1]);
    return ($inner && tile_opens($inner) === 'popup') ? tile_page($tile, $inner) : null;
}

/** Общие поля страницы: адрес внутри ленты (local) и лента (section) — для ссылок, canonical и hreflang. */
function page_base(string $view, string $local, ?int $section): array
{
    return ['view' => $view, 'local' => $local, 'section' => $section, 'path' => join_path(feed_prefix($section), $local), 'popup' => null];
}

function home_page(?array $popup): array
{
    $tab = single_tab() ? null : (feed() !== null ? active_tab() : null);
    $title = $tab ? $tab['title'] . ' — ' . site_title() : (setting_text('seo_title') ?? site_title());
    $desc = $tab ? null : setting_text('seo_description');
    $blocks = home_blocks();
    if ($desc === null) {
        foreach (array_merge($blocks, active_tab() ? root_blocks(active_tab()['id']) : []) as $b) {
            if ($b['type'] === 'text' && $b['body']) {
                $desc = $b['body'];
                break;
            }
        }
    }
    $section = ($single = single_tab()) ? $single['id'] : ($tab ? $tab['id'] : null);
    $page = page_base('page_home', '/', $section)
          + ['blocks' => $blocks, 'title' => $title, 'description' => $desc, 'jsonld' => $tab ? null : 'website'];
    return $popup ? with_popup($page, $popup, null) : $page;
}

function tile_page(array $tile, ?array $popup): array
{
    $title = $tile['seo_title'] ?? ($tile['title'] . ' — ' . site_title());
    $tab = single_tab() ? null : ($tile['section_id'] !== null ? (sections()[$tile['section_id']] ?? null) : null);
    $page = page_base('page_tile', '/' . $tile['slug'], $tile['section_id'])
          + ['tile' => $tile, 'blocks' => visible_children($tile), 'title' => $title, 'tab' => $tab,
             'description' => $tile['seo_description'] ?? $tile['subtitle'] ?? $tile['body'],
             'back' => url($tab ? '/' . $tab['slug'] : '/'), 'image' => $tile['photo'], 'jsonld' => 'breadcrumbs'];
    return $popup ? with_popup($page, $popup, $tile) : $page;
}

/** Страница с открытым поп-апом: адрес, заголовок и описание — от плитки поп-апа (раздел 9.2). */
function with_popup(array $page, array $tile, ?array $owner): array
{
    $page['popup'] = $tile;
    $page['local'] = ($owner ? '/' . $owner['slug'] : '') . '/' . $tile['slug'];
    $page['section'] = $tile['section_id'];
    $page['path'] = join_path(feed_prefix($tile['section_id']), $page['local']);
    $page['title'] = $tile['seo_title']
        ?? implode(' — ', array_filter([$tile['title'], $owner['title'] ?? null, site_title()]));
    $page['description'] = $tile['seo_description'] ?? $tile['subtitle'] ?? $tile['body'];
    $page['image'] = $tile['photo'] ?? ($page['image'] ?? null);
    $page['jsonld'] = 'popup';
    return $page;
}

/** Лента таба для переключения без перезагрузки: JSON с заголовком, шапкой и лентой. */
function tab_fragment(array $page): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Vary: X-Requested-With');
    $tab = active_tab();
    $GLOBALS['h1_done'] = true; // <h1> страницы уже есть: над табами или скрытый
    $feed = $tab ? view('tabfeed', ['tab' => $tab, 'popup' => null]) : '';
    echo json_encode(['title' => $page['title'], 'header' => view('header', ['back' => null]), 'feed' => $feed],
                     JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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
