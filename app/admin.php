<?php
declare(strict_types=1);

/**
 * Админка (спецификация 2.1, раздел 10): вход, «Мой профиль», дерево сайта, превью, сохранение, фото.
 * Один вход без ролей. Страница админки — оболочка; дерево и формы рисует admin.js.
 */

const ADMIN_LOCK_TRIES = 5;
const ADMIN_LOCK_MINUTES = 15;
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const PREVIEW_DIR = DATA_DIR . '/preview';

function admin_route(string $path): void
{
    header('X-Frame-Options: SAMEORIGIN');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    admin_session_start();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Аварийный сброс без почты: data/reset-password.txt (раздел 10.10).
    $notice = admin_reset_from_file();

    if (!admin_exists()) {
        if ($method === 'POST' && $path === '/admin/setup') {
            admin_setup();
            return;
        }
        echo admin_page('admin/setup', ['error' => null]);
        return;
    }

    if ($path === '/admin/login' && $method === 'POST') {
        admin_login();
        return;
    }
    // «Забыли пароль?» (раздел 10.10).
    if ($path === '/admin/forgot') {
        $method === 'POST' ? admin_forgot() : print(admin_page('admin/forgot', ['error' => null, 'notice' => null]));
        return;
    }
    if ($path === '/admin/reset') {
        admin_reset($method);
        return;
    }
    if ($path === '/admin/logout' && $method === 'POST') {
        admin_check_csrf($_POST['csrf'] ?? '');
        $_SESSION = [];
        session_destroy();
        admin_redirect('/admin');
        return;
    }

    $admin = current_admin();
    if (!$admin) {
        if (str_starts_with($path, '/admin/api/') || str_starts_with($path, '/admin/preview')) {
            admin_json(['error' => 'auth'], 401);
            return;
        }
        echo admin_page('admin/login', ['error' => null, 'notice' => $notice, 'login' => '']);
        return;
    }

    if ($path === '/admin' || $path === '/admin/') {
        echo admin_page('admin/app', ['admin' => $admin]);
        return;
    }
    if ($path === '/admin/preview') {
        session_write_close();
        admin_preview_page();
        return;
    }
    if (str_starts_with($path, '/admin/api/')) {
        $name = substr($path, strlen('/admin/api/'));
        if ($method === 'POST') {
            admin_check_csrf($_SERVER['HTTP_X_CSRF'] ?? '');
        }
        session_write_close();
        admin_api($name, $method, $admin);
        return;
    }
    http_response_code(404);
    echo admin_page('admin/login', ['error' => null, 'notice' => null, 'login' => '']);
}

/* ---------------------------------------------------------------- вход */

function admin_session_start(): void
{
    $https = ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_name('enotis_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/admin', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(16));
}

function admin_check_csrf(string $token): void
{
    if (!hash_equals($_SESSION['csrf'] ?? '', $token)) {
        admin_json(['error' => 'csrf'], 403);
        exit;
    }
}

function admin_exists(): bool
{
    return (int) db()->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0;
}

function current_admin(): ?array
{
    $id = $_SESSION['admin_id'] ?? null;
    if (!$id) {
        return null;
    }
    $st = db()->prepare('SELECT * FROM admins WHERE id = ?');
    $st->execute([$id]);
    $a = $st->fetch();
    // Смена пароля закрывает прежние сессии: в сессии — отпечаток хеша пароля.
    if (!$a || !hash_equals(substr($a['password_hash'], -16), $_SESSION['pw'] ?? '')) {
        return null;
    }
    return $a;
}

/** Язык интерфейса: из профиля; до входа — язык браузера, если он из четырёх, иначе русский (раздел 10.14). */
function admin_lang(?array $admin = null): string
{
    if ($admin) {
        return $admin['ui_lang'];
    }
    foreach (explode(',', $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '') as $part) {
        $code = strtolower(substr(trim($part), 0, 2));
        if (in_array($code, LANGS, true)) {
            return $code;
        }
    }
    return 'ru';
}

function admin_login(): void
{
    admin_check_csrf($_POST['csrf'] ?? '');
    $login = trim((string) ($_POST['login'] ?? ''));
    $pass = (string) ($_POST['password'] ?? '');
    $st = db()->prepare('SELECT * FROM admins WHERE login = ? OR (email IS NOT NULL AND email = ?)');
    $st->execute([$login, $login]);
    $a = $st->fetch();
    $lang = admin_lang();
    if ($a && $a['locked_until'] && strtotime($a['locked_until']) > time()) {
        $min = (int) ceil((strtotime($a['locked_until']) - time()) / 60);
        echo admin_page('admin/login', ['error' => str_replace('{n}', (string) $min, ta('login.locked', $lang)), 'notice' => null, 'login' => $login]);
        return;
    }
    if (!$a || !password_verify($pass, $a['password_hash'])) {
        if ($a) {
            $fails = (int) $a['failed_count'] + 1;
            $until = $fails >= ADMIN_LOCK_TRIES ? date('Y-m-d H:i:s', time() + ADMIN_LOCK_MINUTES * 60) : null;
            db()->prepare('UPDATE admins SET failed_count = ?, locked_until = ? WHERE id = ?')
                ->execute([$until ? 0 : $fails, $until, $a['id']]);
        }
        usleep(300000);
        echo admin_page('admin/login', ['error' => ta('login.wrong', $lang), 'notice' => null, 'login' => $login]);
        return;
    }
    db()->prepare('UPDATE admins SET failed_count = 0, locked_until = NULL WHERE id = ?')->execute([$a['id']]);
    if (password_needs_rehash($a['password_hash'], PASSWORD_DEFAULT)) {
        $a['password_hash'] = password_hash($pass, PASSWORD_DEFAULT);
        db()->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([$a['password_hash'], $a['id']]);
    }
    admin_sign_in($a);
    admin_redirect('/admin');
}

function admin_sign_in(array $a): void
{
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int) $a['id'];
    $_SESSION['pw'] = substr($a['password_hash'], -16);
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

/** Первый вход на чистой установке: создать логин и пароль. Позже это сделает мастер установки (этап 8). */
function admin_setup(): void
{
    admin_check_csrf($_POST['csrf'] ?? '');
    $lang = admin_lang();
    $login = trim((string) ($_POST['login'] ?? ''));
    $email = trim((string) ($_POST['email'] ?? ''));
    $p1 = (string) ($_POST['password'] ?? '');
    $p2 = (string) ($_POST['password2'] ?? '');
    $error = admin_password_error($p1, $p2, $lang);
    if ($login === '' || mb_strlen($login) > 60) {
        $error = ta('setup.login_required', $lang);
    } elseif ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = ta('profile.email_bad', $lang);
    }
    if ($error) {
        echo admin_page('admin/setup', ['error' => $error]);
        return;
    }
    db()->prepare('INSERT INTO admins (login, password_hash, email, ui_lang) VALUES (?, ?, ?, ?)')
        ->execute([$login, password_hash($p1, PASSWORD_DEFAULT), $email ?: null, $lang]);
    $st = db()->prepare('SELECT * FROM admins WHERE login = ?');
    $st->execute([$login]);
    admin_sign_in($st->fetch());
    admin_redirect('/admin');
}

function admin_password_error(string $p1, string $p2, string $lang): ?string
{
    if (mb_strlen($p1) < 8) {
        return ta('profile.password_short', $lang);
    }
    if ($p1 !== $p2) {
        return ta('profile.password_mismatch', $lang);
    }
    return null;
}

/** data/reset-password.txt: одна строка — новый пароль; файл удаляется (раздел 10.10). */
function admin_reset_from_file(): ?string
{
    $file = DATA_DIR . '/reset-password.txt';
    if (!is_file($file)) {
        return null;
    }
    $pass = trim((string) file_get_contents($file));
    @unlink($file);
    if (mb_strlen($pass) < 8 || !admin_exists()) {
        return null;
    }
    db()->prepare('UPDATE admins SET password_hash = ?, failed_count = 0, locked_until = NULL')
        ->execute([password_hash($pass, PASSWORD_DEFAULT)]);
    $_SESSION = ['csrf' => bin2hex(random_bytes(16))];
    return ta('login.reset_by_file', admin_lang());
}

function admin_redirect(string $to): void
{
    header('Location: ' . $to, true, 303);
}

function admin_json(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
}

function admin_page(string $view, array $vars): string
{
    $vars['ui'] = isset($vars['admin']) ? admin_lang($vars['admin']) : admin_lang();
    $vars['csrf'] = $_SESSION['csrf'];
    return view($view, $vars);
}

/** Тело запроса JSON. */
function admin_input(): array
{
    $raw = (string) file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ---------------------------------------------------------------- API */

function admin_api(string $name, string $method, array $admin): void
{
    switch ("$method $name") {
        case 'GET site':
            admin_json(['site' => site_export(), 'meta' => admin_meta(), 'private' => admin_private()]);
            return;
        case 'POST brand':
            admin_brand_upload();
            return;
        case 'POST mail_test':
            admin_mail_test($admin, admin_input());
            return;
        case 'GET backups':
            admin_json(['list' => backup_list()]);
            return;
        case 'POST backup_now':
            backup_now('manual');
            admin_json(['ok' => true, 'list' => backup_list()]);
            return;
        case 'POST backup_restore':
            $err = backup_restore((string) (admin_input()['name'] ?? ''));
            admin_json($err ? ['ok' => false, 'error' => $err] : ['ok' => true, 'list' => backup_list()], $err ? 422 : 200);
            return;
        case 'POST preview':
            admin_preview_store(admin_input());
            return;
        case 'POST save':
            admin_save(admin_input());
            return;
        case 'POST photo':
            admin_photo_upload();
            return;
        case 'GET original':
            admin_original((int) ($_GET['id'] ?? 0));
            return;
        case 'POST qr':
            admin_qr_upload();
            return;
        case 'POST profile':
            admin_profile($admin, admin_input());
            return;
        case 'GET export':
            admin_export();
            return;
        case 'POST import':
            admin_import(false);
            return;
        case 'POST import_tab':
            admin_import(true);
            return;
    }
    admin_json(['error' => 'not_found'], 404);
}

/** Справочники для форм: способы оплаты, соцсети, пределы длины. */
function admin_meta(): array
{
    $providers = require APP_DIR . '/pay_providers.php';
    $labels = [];
    foreach (LANGS as $l) {
        foreach ($providers as $code => $_) {
            $labels[$code][$l] = lang_strings('', $l)['pay.provider.' . $code] ?? '';
        }
    }
    return [
        'providers' => $providers,
        'provider_labels' => $labels,
        'social' => SOCIAL_NAMES,
        'social_icons' => array_map(fn($n) => social_icon($n), array_combine(array_keys(SOCIAL_NAMES), array_keys(SOCIAL_NAMES))),
        'max' => FIELD_MAX,
        'lang_names' => db()->query('SELECT code, name FROM languages ORDER BY position')->fetchAll(PDO::FETCH_KEY_PAIR),
        'engine' => ENGINE_VERSION,
        'schema' => schema_version(db()),
    ];
}

function admin_save(array $in): void
{
    $site = $in['site'] ?? null;
    if (!is_array($site)) {
        admin_json(['error' => 'bad_request'], 400);
        return;
    }
    $check = site_validate($site);
    $private = is_array($in['private'] ?? null) ? $in['private'] : null;
    if ($private) {
        $check['errors'] = array_merge($check['errors'], private_errors($private));
    }
    if ($check['errors']) {
        admin_json(['ok' => false] + $check, 422);
        return;
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $ids = site_write($site);
        if ($private) {
            private_write($private);
        }
        // Сайт правят в админке: тестовое наполнение demo/ больше его не перезаписывает.
        $pdo->exec("DELETE FROM settings WHERE key = 'demo_version'");
        $pdo->commit();
    } catch (Throwable $ex) {
        $pdo->rollBack();
        error_log('[save] ' . $ex->getMessage());
        admin_json(['ok' => false, 'errors' => [['id' => null, 'code' => 'err.save_failed']], 'warnings' => []], 500);
        return;
    }
    setting_reset();
    admin_json(['ok' => true, 'ids' => (object) $ids, 'warnings' => $check['warnings'], 'site' => site_export(), 'private' => admin_private()]);
}

/* ---------------------------------------------------------------- выгрузка и загрузка (раздел 13) */

function admin_export(): void
{
    $tab = isset($_GET['tab']) ? (int) $_GET['tab'] : null;
    $file = export_zip(!empty($_GET['structure']), $tab);
    if (!$file) {
        admin_json(['error' => 'not_found'], 404);
        return;
    }
    $host = request_host() ?: 'site';
    $name = $host . ($tab ? '-tab-' . $tab : '') . (!empty($_GET['structure']) ? '-structure' : '') . '-' . date('Y-m-d') . '.zip';
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $name . '"');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    unlink($file);
}

function admin_import(bool $tab): void
{
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
        admin_json(['ok' => false, 'error' => ($f['error'] ?? 0) === UPLOAD_ERR_INI_SIZE ? 'transfer.too_big' : 'transfer.failed'], 400);
        return;
    }
    try {
        $res = $tab ? import_zip_tab($f['tmp_name']) : import_zip_site($f['tmp_name']);
    } catch (Throwable $ex) {
        error_log('[import] ' . $ex->getMessage());
        $res = ['ok' => false, 'error' => 'transfer.failed'];
    }
    $bad = $tab ? !isset($res['tab']) : empty($res['ok']);
    admin_json($res, $bad ? 422 : 200);
}

/* ---------------------------------------------------------------- превью */

/**
 * Превью показывает несохранённое (раздел 10.8). Админка присылает дерево, сервер кладёт его во временный файл,
 * а окно превью открывает /admin/preview?path=… — дерево применяется в транзакции, страница рисуется, транзакция откатывается.
 */
function admin_preview_store(array $in): void
{
    $site = $in['site'] ?? null;
    if (!is_array($site)) {
        admin_json(['error' => 'bad_request'], 400);
        return;
    }
    if (!is_dir(PREVIEW_DIR)) {
        mkdir(PREVIEW_DIR, 0775, true);
    }
    $key = hash('sha256', session_id() ?: 'x');
    file_put_contents(PREVIEW_DIR . '/' . substr($key, 0, 32) . '.json', json_encode($site, JSON_UNESCAPED_UNICODE));
    // id и slug, которые получат новые элементы, чтобы превью и форма говорили об одном и том же.
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $ids = site_write($site);
    } catch (Throwable $ex) {
        $ids = [];
    } finally {
        $pdo->rollBack();
    }
    admin_json(['ok' => true, 'ids' => (object) $ids]);
}

function admin_preview_page(): void
{
    $file = PREVIEW_DIR . '/' . substr(hash('sha256', session_id() ?: 'x'), 0, 32) . '.json';
    $site = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
    $path = '/' . trim((string) ($_GET['path'] ?? '/'), '/');
    $lang = (string) ($_GET['lang'] ?? '');

    // Кадры фото до правки: новые размеры режем сразу, потому что сохранённых кадров ещё нет.
    $before = [];
    foreach (db()->query('SELECT * FROM photos')->fetchAll() as $p) {
        $before[(int) $p['id']] = $p;
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if (is_array($site)) {
            site_write($site);
        }
        setting_reset();
        preview_mode(true);
        // Над превью выбран адрес: сайт рисуется так, как на нём (раздел 4.5).
        $host = (string) ($_GET['host'] ?? '');
        if ($host !== '') {
            current_domain($host);
        }
        $langs = array_column(site_languages(), 'code');
        current_lang(in_array($lang, $langs, true) ? $lang : default_lang());
        $_SERVER['REQUEST_URI'] = url($path);
        $segs = $path === '/' ? [] : explode('/', substr($path, 1));
        $page = resolve_page($segs);
        ob_start();
        // Страницы нет на этом языке или она ещё без текста: в превью показываем главную.
        $page ??= resolve_page([]);
        render($page['view'], $page);
        $html = (string) ob_get_clean();
        preview_cut_photos($html, $before);
    } finally {
        $pdo->rollBack();
    }
    $inject = '<link rel="stylesheet" href="/assets/css/preview.css?v=' . ENGINE_VERSION . '">'
            . '<script src="/assets/js/preview.js?v=' . ENGINE_VERSION . '" defer></script>';
    echo str_replace('</head>', $inject . "\n</head>", $html);
}

/** Нарезать размеры фото с новым кадром, пока правка ещё в транзакции. */
function preview_cut_photos(string $html, array $before): void
{
    if (!preg_match_all('~/uploads/photos/(\d+)-([0-9a-f]{8})-(h?)([lms])\.jpg~', $html, $mm, PREG_SET_ORDER)) {
        return;
    }
    $st = db()->prepare('SELECT * FROM photos WHERE id = ?');
    foreach ($mm as $m) {
        $file = PUBLIC_UPLOADS . '/photos/' . substr($m[0], strlen('/uploads/photos/'));
        if (is_file($file)) {
            continue;
        }
        $id = (int) $m[1];
        $head = $m[3] === 'h';
        if (isset($before[$id]) && photo_hash($before[$id], $head) === $m[2]) {
            continue; // кадр не менялся — отрежет обычный показ
        }
        $st->execute([$id]);
        $p = $st->fetch();
        if ($p) {
            photo_cut($p, $head, $m[4], $file);
        }
    }
}

/* ---------------------------------------------------------------- фото */

function admin_photo_upload(): void
{
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
        admin_json(['error' => ($f['error'] ?? 0) === UPLOAD_ERR_INI_SIZE ? 'photo.too_big' : 'photo.upload_failed'], 400);
        return;
    }
    if ($f['size'] > UPLOAD_MAX_BYTES) {
        admin_json(['error' => 'photo.too_big'], 400);
        return;
    }
    $info = @getimagesize($f['tmp_name']);
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
    if (!$ext) {
        admin_json(['error' => 'photo.bad_type'], 400);
        return;
    }
    // Фото с телефона: поворот из EXIF применяется сразу, чтобы редактор и нарезка видели одно и то же.
    $src = $f['tmp_name'];
    if ($ext === 'jpg' && function_exists('exif_read_data') && (int) (@exif_read_data($src)['Orientation'] ?? 1) > 1) {
        $img = load_image($src);
        $tmp = $src . '.jpg';
        if ($img && imagejpeg($img, $tmp, 95)) {
            $src = $tmp;
        }
    }
    $name = store_original($src, $ext);
    $aspect = ($_POST['aspect'] ?? '') === '3:2' ? '3:2' : '4:5';
    db()->prepare('INSERT INTO photos (original_path, aspect) VALUES (?, ?)')->execute([$name, $aspect]);
    $id = (int) db()->lastInsertId();
    photo_store_paths($id);
    [$w, $h] = getimagesize(ORIGINALS_DIR . '/' . $name) ?: [0, 0];
    admin_json(['photo' => admin_photo_json($id), 'width' => $w, 'height' => $h]);
}

function admin_photo_json(int $id): ?array
{
    $st = db()->prepare('SELECT * FROM photos WHERE id = ?');
    $st->execute([$id]);
    $p = $st->fetch();
    return $p ? export_photo($id, ['photos' => [$id => $p]]) : null;
}

/** Исходник для редактора фото. */
function admin_original(int $id): void
{
    $st = db()->prepare('SELECT original_path, processed_path, use_processed FROM photos WHERE id = ?');
    $st->execute([$id]);
    $p = $st->fetch();
    $file = $p ? ORIGINALS_DIR . '/' . ((int) $p['use_processed'] === 1 && $p['processed_path'] ? $p['processed_path'] : $p['original_path']) : null;
    if (!$file || !is_file($file)) {
        http_response_code(404);
        return;
    }
    header('Content-Type: ' . (getimagesize($file)['mime'] ?? 'application/octet-stream'));
    header('Cache-Control: private, max-age=86400');
    readfile($file);
}

/** QR оплаты: картинка как есть, без обрезки (раздел 10.6). SVG — позже, с очисткой от скриптов. */
function admin_qr_upload(): void
{
    $f = $_FILES['file'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || $f['size'] > 5 * 1024 * 1024) {
        admin_json(['error' => 'photo.upload_failed'], 400);
        return;
    }
    $info = @getimagesize($f['tmp_name']);
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
    if (!$ext) {
        admin_json(['error' => 'photo.bad_type'], 400);
        return;
    }
    $dir = PUBLIC_UPLOADS . '/qr';
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $name = substr(sha1_file($f['tmp_name']), 0, 12) . '.' . $ext;
    move_uploaded_file($f['tmp_name'], $dir . '/' . $name);
    admin_json(['image' => 'qr/' . $name]);
}

/* ---------------------------------------------------------------- профиль */

function admin_profile(array $admin, array $in): void
{
    $lang = in_array($in['ui_lang'] ?? '', LANGS, true) ? $in['ui_lang'] : $admin['ui_lang'];
    $login = trim((string) ($in['login'] ?? $admin['login']));
    $email = trim((string) ($in['email'] ?? (string) $admin['email']));
    $errors = [];
    if ($login === '' || mb_strlen($login) > 60) {
        $errors['login'] = 'setup.login_required';
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'profile.email_bad';
    }
    $hash = $admin['password_hash'];
    if (($in['password_new'] ?? '') !== '') {
        if (!password_verify((string) ($in['password_current'] ?? ''), $admin['password_hash'])) {
            $errors['password_current'] = 'profile.password_wrong';
        } elseif (mb_strlen((string) $in['password_new']) < 8) {
            $errors['password_new'] = 'profile.password_short';
        } elseif ($in['password_new'] !== ($in['password_new2'] ?? '')) {
            $errors['password_new2'] = 'profile.password_mismatch';
        } else {
            $hash = password_hash((string) $in['password_new'], PASSWORD_DEFAULT);
        }
    }
    if ($errors) {
        admin_json(['ok' => false, 'errors' => $errors], 422);
        return;
    }
    db()->prepare('UPDATE admins SET login = ?, email = ?, ui_lang = ?, password_hash = ? WHERE id = ?')
        ->execute([$login, $email ?: null, $lang, $hash, $admin['id']]);
    if ($hash !== $admin['password_hash']) {
        // Другие сессии закрываются, эта остаётся.
        session_start();
        $_SESSION['pw'] = substr($hash, -16);
        session_write_close();
    }
    admin_json(['ok' => true]);
}

/* ---------------------------------------------------------------- настройки установки (не выгружаются, раздел 13) */

const COUNTER_MAX = 5000;

/** Почта, код счётчика, ручная галочка оплаты. Пароль ящика не отдаётся — только «задан или нет». */
function admin_private(): array
{
    return [
        'mail_from'        => (string) setting('mail_from', ''),
        'mail_from_default' => mail_from_default(),
        'smtp_host'        => (string) setting('smtp_host', ''),
        'smtp_port'        => (string) setting('smtp_port', ''),
        'smtp_secure'      => setting('smtp_secure', 'tls') === 'ssl' ? 'ssl' : 'tls',
        'smtp_user'        => (string) setting('smtp_user', ''),
        'smtp_pass'        => null,
        'smtp_pass_set'    => (string) setting('smtp_pass', '') !== '',
        'mail_test_ok'     => (string) setting('mail_test_ok', ''),
        'counter_code'     => (string) setting('counter_code', ''),
        'payment_checked'  => setting('launch_payment_checked') === '1',
    ];
}

function private_errors(array $p): array
{
    $err = [];
    $from = trim((string) ($p['mail_from'] ?? ''));
    if ($from !== '' && !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $err[] = ['id' => 'mail', 'field' => 'mail_from', 'code' => 'err.email'];
    }
    $port = trim((string) ($p['smtp_port'] ?? ''));
    if ($port !== '' && (!ctype_digit($port) || (int) $port < 1 || (int) $port > 65535)) {
        $err[] = ['id' => 'mail', 'field' => 'smtp_port', 'code' => 'err.port'];
    }
    if (trim((string) ($p['smtp_host'] ?? '')) !== '' && !preg_match('~^[A-Za-z0-9.-]+$~', trim((string) $p['smtp_host']))) {
        $err[] = ['id' => 'mail', 'field' => 'smtp_host', 'code' => 'err.host'];
    }
    if (mb_strlen((string) ($p['counter_code'] ?? '')) > COUNTER_MAX) {
        $err[] = ['id' => 'advanced', 'field' => 'counter_code', 'code' => 'err.too_long', 'n' => COUNTER_MAX];
    }
    return $err;
}

function private_write(array $p): void
{
    $vals = [
        'mail_from'   => trim((string) ($p['mail_from'] ?? '')),
        'smtp_host'   => trim((string) ($p['smtp_host'] ?? '')),
        'smtp_port'   => trim((string) ($p['smtp_port'] ?? '')),
        'smtp_secure' => ($p['smtp_secure'] ?? '') === 'ssl' ? 'ssl' : 'tls',
        'smtp_user'   => trim((string) ($p['smtp_user'] ?? '')),
        'counter_code' => (string) ($p['counter_code'] ?? ''),
        'launch_payment_checked' => !empty($p['payment_checked']) ? '1' : '0',
    ];
    // Пароль ящика: null — не меняли; пустая строка — стереть.
    if (array_key_exists('smtp_pass', $p) && $p['smtp_pass'] !== null) {
        $vals['smtp_pass'] = (string) $p['smtp_pass'];
    }
    $before = mail_config();
    foreach ($vals as $k => $v) {
        set_setting($k, $v);
    }
    // Почту поменяли — прежняя отметка «тестовое письмо дошло» больше не верна.
    if (mail_config() !== $before) {
        set_setting('mail_test_ok', null);
    }
}

/** «Отправить тестовое письмо» — на почту администратора, с настройками из формы (ещё не сохранёнными). */
function admin_mail_test(array $admin, array $in): void
{
    $lang = admin_lang($admin);
    if (!$admin['email']) {
        admin_json(['ok' => false, 'error' => ta('mail.no_admin_email', $lang)], 422);
        return;
    }
    $over = [];
    foreach (MAIL_KEYS as $k) {
        if (array_key_exists($k, $in) && $in[$k] !== null) {
            $over[$k] = (string) $in[$k];
        }
    }
    $err = send_mail($admin['email'], ta('mail.test_subject', $lang), ta('mail.test_body', $lang), $over);
    if ($err === null && mail_config($over) === mail_config()) {
        set_setting('mail_test_ok', date('Y-m-d H:i'));
    }
    admin_json($err === null ? ['ok' => true, 'to' => $admin['email'], 'saved' => mail_config($over) === mail_config()]
                             : ['ok' => false, 'error' => $err], $err === null ? 200 : 422);
}

/* ---------------------------------------------------------------- оформление */

function admin_brand_upload(): void
{
    $f = $_FILES['file'] ?? null;
    $kind = (string) ($_POST['kind'] ?? '');
    if (!$f || $f['error'] !== UPLOAD_ERR_OK || !isset(BRAND_KEYS[$kind])) {
        admin_json(['error' => ($f['error'] ?? 0) === UPLOAD_ERR_INI_SIZE ? 'photo.too_big' : 'photo.upload_failed'], 400);
        return;
    }
    if ($f['size'] > UPLOAD_MAX_BYTES) {
        admin_json(['error' => 'photo.too_big'], 400);
        return;
    }
    $res = brand_store($kind, $f['tmp_name'], (string) $f['name']);
    admin_json($res, isset($res['url']) ? 200 : 400);
}

/* ---------------------------------------------------------------- «Забыли пароль?» (раздел 10.10) */

const RESET_PER_HOUR = 3;

function admin_forgot(): void
{
    admin_check_csrf($_POST['csrf'] ?? '');
    $lang = admin_lang();
    $who = trim((string) ($_POST['login'] ?? ''));
    $st = db()->prepare('SELECT * FROM admins WHERE login = ? OR (email IS NOT NULL AND email = ?)');
    $st->execute([$who, $who]);
    $a = $who !== '' ? $st->fetch() : null;
    if ($a && $a['email']) {
        $sent = array_values(array_filter(json_decode((string) $a['reset_sent'], true) ?: [], fn($t) => $t > time() - 3600));
        if (count($sent) < RESET_PER_HOUR) {
            $token = bin2hex(random_bytes(32));
            $sent[] = time();
            db()->prepare('UPDATE admins SET reset_hash = ?, reset_until = ?, reset_sent = ? WHERE id = ?')
                ->execute([hash('sha256', $token), date('Y-m-d H:i:s', time() + 3600), json_encode($sent), $a['id']]);
            $ui = $a['ui_lang'];
            $link = abs_url('/admin/reset?token=' . $token);
            $err = send_mail($a['email'], ta('reset.mail_subject', $ui),
                             str_replace(['{site}', '{link}', '{login}'], [site_title(), $link, $a['login']], ta('reset.mail_body', $ui)));
            if ($err !== null) {
                error_log('[mail] reset: ' . $err);
            }
        }
    } else {
        usleep(300000);
    }
    // Ответ всегда одинаковый: по нему нельзя узнать, есть ли такой логин.
    echo admin_page('admin/forgot', ['error' => null, 'notice' => ta('forgot.sent', $lang)]);
}

/** Действующая ссылка сброса → запись администратора. */
function reset_admin(string $token): ?array
{
    if (!preg_match('~^[0-9a-f]{64}$~', $token)) {
        return null;
    }
    $st = db()->prepare('SELECT * FROM admins WHERE reset_hash = ?');
    $st->execute([hash('sha256', $token)]);
    $a = $st->fetch();
    return $a && $a['reset_until'] && strtotime($a['reset_until']) > time() ? $a : null;
}

function admin_reset(string $method): void
{
    $lang = admin_lang();
    $token = (string) ($method === 'POST' ? ($_POST['token'] ?? '') : ($_GET['token'] ?? ''));
    $a = reset_admin($token);
    if (!$a) {
        echo admin_page('admin/forgot', ['error' => ta('reset.invalid', $lang), 'notice' => null]);
        return;
    }
    if ($method !== 'POST') {
        echo admin_page('admin/reset', ['error' => null, 'token' => $token]);
        return;
    }
    admin_check_csrf($_POST['csrf'] ?? '');
    $p1 = (string) ($_POST['password'] ?? '');
    $error = admin_password_error($p1, (string) ($_POST['password2'] ?? ''), $lang);
    if ($error) {
        echo admin_page('admin/reset', ['error' => $error, 'token' => $token]);
        return;
    }
    // Ссылка одноразовая; новый хеш пароля закрывает все прежние сессии.
    $hash = password_hash($p1, PASSWORD_DEFAULT);
    db()->prepare('UPDATE admins SET password_hash = ?, reset_hash = NULL, reset_until = NULL, failed_count = 0, locked_until = NULL WHERE id = ?')
        ->execute([$hash, $a['id']]);
    $a['password_hash'] = $hash;
    admin_sign_in($a);
    admin_redirect('/admin');
}
