<?php
declare(strict_types=1);

const LANGS = ['ru', 'ka', 'en', 'fr'];

/** Экранирование для HTML. Весь пользовательский текст выводится только через e(). */
function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Язык текущего запроса. На этапе 2 — основной язык сайта; префиксы /ka/… появятся на этапе 3. */
function current_lang(?string $set = null): string
{
    static $lang = null;
    if ($set !== null && in_array($set, LANGS, true)) {
        $lang = $set;
    }
    return $lang ?? 'ru';
}

/** Включённые языки сайта в порядке position; основной — первым ключом is_default. */
function site_languages(): array
{
    static $list = null;
    return $list ??= db()->query('SELECT code, name, is_default FROM languages WHERE is_active = 1 ORDER BY position')->fetchAll();
}

function default_lang(): string
{
    foreach (site_languages() as $l) {
        if ($l['is_default']) {
            return $l['code'];
        }
    }
    return 'ru';
}

/** Подписи из app/lang/{язык}.php или app/lang/admin/{язык}.php; нет перевода — берём русскую. */
function lang_strings(string $dir, string $lang): array
{
    static $cache = [];
    $file = APP_DIR . '/lang/' . ($dir === '' ? '' : $dir . '/') . $lang . '.php';
    return $cache[$file] ??= (is_file($file) ? require $file : []);
}

/** Служебная подпись сайта (принцип 1 спецификации). */
function t(string $key): string
{
    return lang_strings('', current_lang())[$key] ?? lang_strings('', 'ru')[$key] ?? $key;
}

/** Подпись админки на языке интерфейса администратора (раздел 10.14). */
function ta(string $key, string $uiLang = 'ru'): string
{
    return lang_strings('admin', $uiLang)[$key] ?? lang_strings('admin', 'ru')[$key] ?? $key;
}

/** Адрес на текущем (или указанном) языке: основной язык без префикса, остальные — /ka/… (раздел 4.6). */
function url(string $path = '/', ?string $lang = null): string
{
    $lang ??= current_lang();
    $path = '/' . ltrim($path, '/');
    if ($lang === default_lang()) {
        return $path;
    }
    return '/' . $lang . ($path === '/' ? '/' : $path);
}

/** Полный адрес для canonical, og:url и hreflang. */
function abs_url(string $path): string
{
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host = preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https' : 'http') . '://' . $host . $path;
}

/** Превью админки: страница рисуется с пометками data-eid, чтобы нажатие открывало элемент в форме (раздел 10.8). */
function preview_mode(?bool $set = null): bool
{
    static $on = false;
    if ($set !== null) {
        $on = $set;
    }
    return $on;
}

/** Атрибут data-eid для превью; на обычном сайте — пусто. */
function eid(int|string $id): string
{
    return preview_mode() ? ' data-eid="' . e((string) $id) . '"' : '';
}

/** Шаблон из app/views/ с переменными; возвращает HTML. */
function view(string $name, array $vars = []): string
{
    extract($vars, EXTR_SKIP);
    ob_start();
    require APP_DIR . '/views/' . $name . '.php';
    return (string) ob_get_clean();
}

/** Страница целиком: содержимое в общем макете (шапка, подвал). */
function render(string $page, array $vars = []): void
{
    $vars['content'] = view($page, $vars);
    echo view('layout', $vars);
}
