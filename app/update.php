<?php
declare(strict_types=1);

/**
 * Обновление движка (спецификация 2.1, разделы 10.12 и 14.2).
 * Сайт = движок (код) + данные (data/). Обновляется только код; data/ и public/uploads/ не трогаются.
 *
 * Шаги идут отдельными запросами (прогресс в админке, короткие запросы для хостинга):
 *   prepare  — требования, копия базы и текущего кода в data/backups/update_vX.Y.Z/;
 *   download — скачать ZIP по HTTPS, сверить sha256, распаковать во временную папку;
 *   replace  — заменить файлы кода (на это время сайт показывает «обновляется»);
 *   finish   — уже новый код: миграции прошли при старте запроса, проверить версию.
 * Ошибка на любом шаге — код и база возвращаются из копии.
 *
 * ENOTIS_UPDATE_URL — другой адрес latest.json (только проверки; разрешает http://127.0.0.1).
 */

const UPDATE_URL = 'https://update.enotis.ru/latest.json';
const UPDATE_DIR = DATA_DIR . '/update';
const UPDATE_MAINTENANCE = UPDATE_DIR . '/maintenance';
const UPDATE_CHECK_HOURS = 12;
/** Что считается кодом движка. Остальное (data/, demo/, docs/) обновление не трогает. */
const UPDATE_CODE = ['app', 'public', 'bin', '.htaccess'];
const UPDATE_KEEP_OUT = '~^public/uploads/~';

function update_url(): string
{
    return getenv('ENOTIS_UPDATE_URL') ?: UPDATE_URL;
}

/** Адрес скачивания: только HTTPS (проверочный адрес из ENOTIS_UPDATE_URL — и локальный http). */
function update_url_ok(string $url): bool
{
    if (str_starts_with($url, 'https://')) {
        return true;
    }
    return (bool) getenv('ENOTIS_UPDATE_URL') && str_starts_with($url, 'http://127.0.0.1');
}

/** Сравнение версий вида 1.2.3. */
function version_newer(string $a, string $b): bool
{
    return version_compare($a, $b, '>');
}

/**
 * Последняя версия. Сервер спрашиваем не чаще раза в 12 часов (или по «Проверить сейчас»);
 * не ответил — молча, остаётся прежний ответ.
 */
function update_latest(bool $force = false): ?array
{
    $checked = (int) setting('update_checked_at', '0');
    if ($force || time() - $checked > UPDATE_CHECK_HOURS * 3600) {
        set_setting('update_checked_at', (string) time());
        try {
            $j = json_decode(http_get(update_url(), 10), true);
            if (is_array($j) && is_string($j['version'] ?? null) && preg_match('~^\d+\.\d+\.\d+$~', $j['version'])) {
                set_setting('update_latest', json_encode($j, JSON_UNESCAPED_UNICODE));
            }
        } catch (Throwable $e) {
            error_log('[update] ' . $e->getMessage());
        }
    }
    $j = json_decode((string) setting('update_latest', ''), true);
    return is_array($j) ? $j : null;
}

/** Состояние для админки: версии, что нового, можно ли обновить автоматически, откат. */
function update_status(bool $force = false): array
{
    $latest = update_latest($force);
    $prev = update_rollback_info();
    return [
        'current'  => ENGINE_VERSION,
        'latest'   => $latest['version'] ?? null,
        'newer'    => $latest && version_newer($latest['version'], ENGINE_VERSION),
        'notes'    => $latest['notes'] ?? null,
        'zip'      => $latest['zip'] ?? null,
        'min_php'  => $latest['min_php'] ?? null,
        'writable' => update_writable(),
        'rollback' => $prev['from'] ?? null,
        'checked_at' => (int) setting('update_checked_at', '0'),
    ];
}

/** Может ли движок переписать свои файлы. */
function update_writable(): bool
{
    foreach (UPDATE_CODE as $p) {
        $f = ROOT_DIR . '/' . $p;
        if (file_exists($f) && !is_writable($f)) {
            return false;
        }
    }
    return is_writable(ROOT_DIR . '/app/bootstrap.php') && is_writable(DATA_DIR);
}

function update_state(): array
{
    $j = json_decode((string) @file_get_contents(UPDATE_DIR . '/state.json'), true);
    return is_array($j) ? $j : [];
}

function update_state_save(array $s): void
{
    if (!is_dir(UPDATE_DIR)) {
        mkdir(UPDATE_DIR, 0775, true);
    }
    file_put_contents(UPDATE_DIR . '/state.json', json_encode($s, JSON_UNESCAPED_UNICODE));
}

/**
 * Один шаг «Обновить». Возвращает ['ok' => true, 'next' => шаг|null, 'version' => …]
 * или ['ok' => false, 'error' => код подписи, 'rolled_back' => bool].
 */
function update_step(string $step): array
{
    try {
        return match ($step) {
            'prepare'  => update_prepare(),
            'download' => update_download(),
            'replace'  => update_replace(),
            'finish'   => update_finish(),
            default    => ['ok' => false, 'error' => 'update.failed'],
        };
    } catch (Throwable $e) {
        error_log('[update] ' . $step . ': ' . $e->getMessage());
        $back = in_array($step, ['replace', 'finish'], true) && update_restore(update_state()['backup'] ?? '');
        @unlink(UPDATE_MAINTENANCE);
        return ['ok' => false, 'error' => $e instanceof UpdateError ? $e->getMessage() : 'update.failed', 'rolled_back' => $back];
    }
}

final class UpdateError extends RuntimeException
{
}

function update_prepare(): array
{
    $latest = update_latest(true);
    if (!$latest || !version_newer($latest['version'], ENGINE_VERSION)) {
        throw new UpdateError('update.none');
    }
    if (version_compare(PHP_VERSION, (string) ($latest['min_php'] ?? '8.1'), '<')) {
        throw new UpdateError('update.php_old');
    }
    if (!update_writable() || !class_exists('ZipArchive')) {
        throw new UpdateError('update.not_writable');
    }
    if (!update_url_ok((string) ($latest['zip'] ?? '')) || !preg_match('~^[0-9a-f]{64}$~', (string) ($latest['sha256'] ?? ''))) {
        throw new UpdateError('update.failed');
    }
    // Хранится одна предыдущая версия: прежние копии обновлений стираются.
    foreach (glob(BACKUPS_DIR . '/update_v*', GLOB_ONLYDIR) ?: [] as $old) {
        rrmdir($old);
    }
    $dir = BACKUPS_DIR . '/update_v' . $latest['version'];
    mkdir($dir, 0775, true);
    backup_make($dir . '/site.sqlite');
    code_zip($dir . '/code.zip');
    file_put_contents($dir . '/info.json', json_encode(['from' => ENGINE_VERSION, 'to' => $latest['version'], 'at' => date('c')]));
    update_state_save(['target' => $latest, 'backup' => $dir, 'step' => 'prepare']);
    return ['ok' => true, 'next' => 'download'];
}

function update_download(): array
{
    $s = update_state();
    $t = $s['target'] ?? null;
    if (!$t || ($s['step'] ?? '') !== 'prepare') {
        throw new UpdateError('update.failed');
    }
    $zip = UPDATE_DIR . '/release.zip';
    file_put_contents($zip, http_get($t['zip'], 120));
    if (!hash_equals($t['sha256'], hash_file('sha256', $zip))) {
        @unlink($zip);
        throw new UpdateError('update.bad_sum');
    }
    $new = UPDATE_DIR . '/new';
    rrmdir($new);
    zip_extract_code($zip, $new);
    if (!is_file($new . '/app/bootstrap.php') || !is_file($new . '/public/index.php')) {
        throw new UpdateError('update.failed');
    }
    $s['step'] = 'download';
    update_state_save($s);
    return ['ok' => true, 'next' => 'replace'];
}

function update_replace(): array
{
    $s = update_state();
    if (($s['step'] ?? '') !== 'download') {
        throw new UpdateError('update.failed');
    }
    $new = UPDATE_DIR . '/new';
    touch(UPDATE_MAINTENANCE);
    code_replace_from($new);
    $s['step'] = 'replace';
    update_state_save($s);
    if (function_exists('opcache_reset')) {
        opcache_reset();
    }
    return ['ok' => true, 'next' => 'finish'];
}

/** Запрос уже на новом коде: база обновилась при старте (db() → migrate). */
function update_finish(): array
{
    $s = update_state();
    if (($s['step'] ?? '') === 'failed') {
        @unlink(UPDATE_DIR . '/state.json');
        return ['ok' => false, 'error' => 'update.failed', 'rolled_back' => true];
    }
    if (($s['step'] ?? '') !== 'replace') {
        throw new UpdateError('update.failed');
    }
    if (ENGINE_VERSION !== $s['target']['version']) {
        throw new UpdateError('update.failed');
    }
    db()->query('SELECT COUNT(*) FROM elements')->fetchColumn();
    @unlink(UPDATE_MAINTENANCE);
    rrmdir(UPDATE_DIR . '/new');
    @unlink(UPDATE_DIR . '/release.zip');
    @unlink(UPDATE_DIR . '/state.json');
    return ['ok' => true, 'next' => null, 'version' => ENGINE_VERSION];
}

/** Запрос на новом коде упал до шага finish (например, миграция): откат к прежнему коду и базе. */
function update_recover_after_failure(): void
{
    $s = update_state();
    if (($s['step'] ?? '') !== 'replace' || empty($s['backup'])) {
        return;
    }
    $s['step'] = 'failed';
    update_state_save($s);
    // db() не открылась (упала миграция) — базу возвращаем через отдельное соединение без миграций.
    try {
        $raw = new PDO('sqlite:' . DB_FILE, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        db_replace_from($s['backup'] . '/site.sqlite', $raw);
        $raw = null;
        $tmp = UPDATE_DIR . '/old';
        rrmdir($tmp);
        zip_extract_code($s['backup'] . '/code.zip', $tmp);
        code_replace_from($tmp);
        rrmdir($tmp);
        if (function_exists('opcache_reset')) {
            opcache_reset();
        }
    } catch (Throwable $e) {
        error_log('[update] аварийный откат: ' . $e->getMessage());
    }
    @unlink(UPDATE_MAINTENANCE);
}

/** Копия, с которой можно откатиться: ['from' => версия, 'dir' => папка] или null. */
function update_rollback_info(): ?array
{
    foreach (glob(BACKUPS_DIR . '/update_v*/info.json') ?: [] as $f) {
        $j = json_decode((string) file_get_contents($f), true);
        if (is_array($j) && ($j['to'] ?? '') === ENGINE_VERSION && is_file(dirname($f) . '/code.zip')) {
            return ['from' => $j['from'], 'dir' => dirname($f)];
        }
    }
    return null;
}

/** «Откатить к версии X»: код и база на момент обновления. */
function update_rollback(): array
{
    $info = update_rollback_info();
    if (!$info) {
        return ['ok' => false, 'error' => 'update.no_rollback'];
    }
    touch_dir(UPDATE_DIR);
    touch(UPDATE_MAINTENANCE);
    $ok = update_restore($info['dir']);
    @unlink(UPDATE_MAINTENANCE);
    if ($ok) {
        rrmdir($info['dir']);
    }
    return $ok ? ['ok' => true, 'version' => $info['from']] : ['ok' => false, 'error' => 'update.failed'];
}

/** Вернуть код и базу из копии обновления. */
function update_restore(string $dir): bool
{
    if ($dir === '' || !is_file($dir . '/code.zip') || !is_file($dir . '/site.sqlite')) {
        return false;
    }
    try {
        $tmp = UPDATE_DIR . '/old';
        rrmdir($tmp);
        zip_extract_code($dir . '/code.zip', $tmp);
        code_replace_from($tmp);
        rrmdir($tmp);
        db_replace_from($dir . '/site.sqlite');
        if (function_exists('opcache_reset')) {
            opcache_reset();
        }
        @unlink(UPDATE_DIR . '/state.json');
        return true;
    } catch (Throwable $e) {
        error_log('[update] откат: ' . $e->getMessage());
        return false;
    }
}

/* ---------------------------------------------------------------- файлы кода */

/** Все файлы кода движка (пути от корня проекта). */
function code_files(string $root): array
{
    $out = [];
    foreach (UPDATE_CODE as $p) {
        $f = $root . '/' . $p;
        if (is_file($f)) {
            $out[] = $p;
        } elseif (is_dir($f)) {
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($f, FilesystemIterator::SKIP_DOTS));
            foreach ($it as $file) {
                $rel = substr($file->getPathname(), strlen($root) + 1);
                if ($file->isFile() && !preg_match(UPDATE_KEEP_OUT, $rel)) {
                    $out[] = str_replace('\\', '/', $rel);
                }
            }
        }
    }
    sort($out);
    return $out;
}

function code_zip(string $file): void
{
    $z = new ZipArchive();
    if ($z->open($file, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        throw new RuntimeException('не создать ' . $file);
    }
    foreach (code_files(ROOT_DIR) as $rel) {
        $z->addFile(ROOT_DIR . '/' . $rel, $rel);
    }
    $z->close();
}

/** Распаковать только файлы кода, без «..» и абсолютных путей. */
function zip_extract_code(string $zip, string $to): void
{
    $z = new ZipArchive();
    if ($z->open($zip) !== true) {
        throw new UpdateError('update.bad_zip');
    }
    $top = '~^(' . implode('|', array_map('preg_quote', UPDATE_CODE)) . ')(/|$)~';
    for ($i = 0; $i < $z->numFiles; $i++) {
        $name = (string) $z->getNameIndex($i);
        if (str_ends_with($name, '/')) {
            continue;
        }
        if (str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, '\\') || !preg_match($top, $name) || preg_match(UPDATE_KEEP_OUT, $name)) {
            continue; // лишнее в архиве (data/, demo/ и т. п.) не распаковывается
        }
        $dst = $to . '/' . $name;
        if (!is_dir(dirname($dst))) {
            mkdir(dirname($dst), 0775, true);
        }
        if (file_put_contents($dst, (string) $z->getFromIndex($i)) === false) {
            throw new RuntimeException('не записать ' . $dst);
        }
    }
    $z->close();
}

/** Заменить код содержимым папки $src: новые и изменённые файлы — записать, лишние — удалить. */
function code_replace_from(string $src): void
{
    $want = code_files($src);
    foreach ($want as $rel) {
        $dst = ROOT_DIR . '/' . $rel;
        if (!is_dir(dirname($dst))) {
            mkdir(dirname($dst), 0775, true);
        }
        if (!is_file($dst) || hash_file('sha1', $dst) !== hash_file('sha1', $src . '/' . $rel)) {
            $tmp = $dst . '.upd-tmp';
            if (!copy($src . '/' . $rel, $tmp) || !rename($tmp, $dst)) {
                throw new RuntimeException('не заменить ' . $rel);
            }
        }
    }
    $keep = array_flip($want);
    foreach (code_files(ROOT_DIR) as $rel) {
        if (!isset($keep[$rel])) {
            @unlink(ROOT_DIR . '/' . $rel);
        }
    }
}

/** База целиком из файла копии, в одной транзакции (схема и данные, включая версию схемы). */
function db_replace_from(string $file, ?PDO $pdo = null): void
{
    $pdo ??= db();
    $pdo->exec('PRAGMA foreign_keys = OFF');
    $pdo->exec('ATTACH DATABASE ' . $pdo->quote($file) . ' AS b');
    $pdo->beginTransaction();
    try {
        foreach ($pdo->query("SELECT type, name FROM main.sqlite_master WHERE type IN ('view','table') AND name NOT LIKE 'sqlite_%'")->fetchAll() as $r) {
            $pdo->exec('DROP ' . strtoupper($r['type']) . ' IF EXISTS main."' . $r['name'] . '"');
        }
        $objs = $pdo->query("SELECT type, name, sql FROM b.sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
                             ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END")->fetchAll();
        foreach ($objs as $o) {
            $pdo->exec($o['sql']);
            if ($o['type'] === 'table') {
                $pdo->exec('INSERT INTO main."' . $o['name'] . '" SELECT * FROM b."' . $o['name'] . '"');
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    } finally {
        $pdo->exec('DETACH DATABASE b');
        $pdo->exec('PRAGMA foreign_keys = ON');
        setting_reset();
    }
}

/* ---------------------------------------------------------------- мелочи */

/** GET по HTTPS: curl или allow_url_fopen. */
function http_get(string $url, int $timeout): string
{
    if (!update_url_ok($url)) {
        throw new RuntimeException('адрес не HTTPS: ' . $url);
    }
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => $timeout]]);
        $body = @file_get_contents($url, false, $ctx);
        $code = $body === false ? 0 : 200;
    }
    if ($body === false || $code !== 200) {
        throw new RuntimeException("HTTP $code: $url");
    }
    return (string) $body;
}

function touch_dir(string $d): void
{
    if (!is_dir($d)) {
        mkdir($d, 0775, true);
    }
}

function rrmdir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) {
        $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
    }
    @rmdir($dir);
}
