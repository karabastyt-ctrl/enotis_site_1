<?php
declare(strict_types=1);

/** Экранирование для HTML. Весь пользовательский текст выводится только через e(). */
function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Служебные подписи интерфейса (принцип 1 спецификации: в lang/ru.php, не в базе). */
function t(string $key): string
{
    static $strings = null;
    $strings ??= require APP_DIR . '/lang/ru.php';
    return $strings[$key] ?? $key;
}

function render(string $page, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    ob_start();
    require APP_DIR . '/pages/' . $page . '.php';
    $content = ob_get_clean();
    require APP_DIR . '/layout.php';
}
