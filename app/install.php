<?php
declare(strict_types=1);

/**
 * Мастер установки /install (спецификация 2.1, раздел 14.1). Открыт, пока в базе нет администратора;
 * после установки пишет data/config.php (когда и какой версией поставлено) и отключается сам.
 * База создаётся сама при первом запросе (app/db.php).
 */

const INSTALL_CONFIG = DATA_DIR . '/config.php';

/** Требования к хостингу: [ключ => [выполнено, обязательно]]. */
function install_checks(): array
{
    return [
        'php'    => [version_compare(PHP_VERSION, '8.1', '>='), true],
        'sqlite' => [extension_loaded('pdo_sqlite'), true],
        'gd'     => [extension_loaded('gd'), true],
        'data'   => [is_dir(DATA_DIR) && is_writable(DATA_DIR), true],
        'http'   => [function_exists('curl_init') || (bool) ini_get('allow_url_fopen'), false],
        'zip'    => [class_exists('ZipArchive'), false],
        'code'   => [update_writable(), false],
    ];
}

/** Мастер открыт, пока нет администратора. */
function install_open(): bool
{
    return !admin_exists();
}

function site_is_empty(): bool
{
    return (int) db()->query('SELECT COUNT(*) FROM elements')->fetchColumn() === 0;
}

/** Вызывается из admin_route (сессия админки уже открыта). */
function install_route(): void
{
    if (!install_open()) {
        admin_redirect('/admin');
        return;
    }
    $ui = in_array($_POST['ui_lang'] ?? $_GET['ui'] ?? '', LANGS, true) ? ($_POST['ui_lang'] ?? $_GET['ui']) : admin_lang();
    $checks = install_checks();
    $blocked = (bool) array_filter($checks, fn ($c) => $c[1] && !$c[0]);
    $error = null;
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && !$blocked) {
        admin_check_csrf($_POST['csrf'] ?? '');
        $error = install_submit($_POST, $ui);
        if ($error === null) {
            admin_redirect('/admin');
            return;
        }
    }
    echo view('admin/install', ['ui' => $ui, 'csrf' => $_SESSION['csrf'], 'checks' => $checks, 'blocked' => $blocked,
                                'error' => $error, 'v' => $_SERVER['REQUEST_METHOD'] === 'POST' ? $_POST : []]);
}

/** Создать вход и первые настройки сайта. Возвращает текст ошибки или null. */
function install_submit(array $in, string $ui): ?string
{
    $title = trim((string) ($in['site_title'] ?? ''));
    $lang = in_array($in['site_lang'] ?? '', LANGS, true) ? $in['site_lang'] : 'ru';
    $login = trim((string) ($in['login'] ?? ''));
    $email = trim((string) ($in['email'] ?? ''));
    $p1 = (string) ($in['password'] ?? '');
    $p2 = (string) ($in['password2'] ?? '');
    if ($title === '' || mb_strlen($title) > 40) {
        return ta('install.title_required', $ui);
    }
    if ($login === '' || mb_strlen($login) > 60) {
        return ta('setup.login_required', $ui);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ta('profile.email_bad', $ui);
    }
    if ($e = admin_password_error($p1, $p2, $ui)) {
        return $e;
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Название и язык — только на пустом сайте; уже наполненный (тестовый) сайт не трогаем.
        if (site_is_empty()) {
            $pdo->prepare('UPDATE languages SET is_default = (code = ?), is_active = (code = ?)')->execute([$lang, $lang]);
            $pdo->prepare('INSERT INTO settings_i18n (key, lang, value) VALUES (\'site_title\', ?, ?)
                           ON CONFLICT(key, lang) DO UPDATE SET value = excluded.value')->execute([$lang, $title]);
        }
        $pdo->prepare('INSERT INTO admins (login, password_hash, email, ui_lang) VALUES (?, ?, ?, ?)')
            ->execute([$login, password_hash($p1, PASSWORD_DEFAULT), $email, $ui]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    setting_reset();
    file_put_contents(INSTALL_CONFIG, "<?php\n// Мастер установки отработал. Файл можно не трогать.\nreturn " .
        var_export(['installed_at' => date('c'), 'engine' => ENGINE_VERSION], true) . ";\n");
    $st = $pdo->prepare('SELECT * FROM admins WHERE login = ?');
    $st->execute([$login]);
    admin_sign_in($st->fetch());
    return null;
}
