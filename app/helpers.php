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

function render(string $page, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    ob_start();
    require APP_DIR . '/pages/' . $page . '.php';
    $content = ob_get_clean();
    require APP_DIR . '/layout.php';
}
