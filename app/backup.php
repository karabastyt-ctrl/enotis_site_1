<?php
declare(strict_types=1);

/**
 * Резервные копии (спецификация 2.1, раздел 10.11).
 * Каждый день — копия базы в data/backups/daily/site_ГГГГ-ММ-ДД.sqlite, хранятся последние 14.
 * Копия делается при первом запросе после полуночи (или по /cron). «Сделать копию сейчас» и копия
 * «перед восстановлением» лежат там же со временем и меткой; их хранится по 5.
 * Исходники фото, на которые больше нет ссылок, уходят в data/uploads/.trash/ и стираются через 15 дней.
 */

const DAILY_DIR = BACKUPS_DIR . '/daily';
const DAILY_KEEP = 14;
const EXTRA_KEEP = 5;
const TRASH_DIR = DATA_DIR . '/uploads/.trash';
const TRASH_DAYS = 15;
const BACKUP_NAME_RE = '~^site_(\d{4}-\d{2}-\d{2})(?:_(\d{4})_(manual|restore))?\.sqlite$~';

/** Раз в день: копия базы и уборка фото. Дёшево, если сегодня уже было. */
function backup_daily(bool $force = false): void
{
    $today = date('Y-m-d');
    if (!$force && setting('backup_last_day') === $today) {
        return;
    }
    $lock = @fopen(DATA_DIR . '/backup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        return; // делает другой запрос
    }
    try {
        setting_reset();
        if (!$force && setting('backup_last_day') === $today) {
            return;
        }
        $file = DAILY_DIR . '/site_' . $today . '.sqlite';
        if (!is_file($file)) {
            backup_make($file);
        }
        backup_prune();
        set_setting('backup_last_day', $today);
        photos_to_trash();
    } catch (Throwable $ex) {
        error_log('[backup] ' . $ex->getMessage());
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function backup_make(string $file): void
{
    if (!is_dir(DAILY_DIR)) {
        mkdir(DAILY_DIR, 0775, true);
    }
    $pdo = db();
    try {
        $pdo->exec('VACUUM INTO ' . $pdo->quote($file));
    } catch (PDOException) {
        $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        copy(DB_FILE, $file);
    }
}

/** «Сделать копию сейчас» или «перед восстановлением». Возвращает имя файла. */
function backup_now(string $kind): string
{
    $name = 'site_' . date('Y-m-d_Hi') . '_' . $kind . '.sqlite';
    $file = DAILY_DIR . '/' . $name;
    if (is_file($file)) {
        unlink($file);
    }
    backup_make($file);
    backup_prune();
    return $name;
}

/** Последние 14 ежедневных и по 5 ручных и «перед восстановлением». */
function backup_prune(): void
{
    $groups = [];
    foreach (glob(DAILY_DIR . '/site_*.sqlite') ?: [] as $f) {
        if (preg_match(BACKUP_NAME_RE, basename($f), $m)) {
            $groups[$m[3] ?? 'daily'][] = $f;
        }
    }
    foreach ($groups as $kind => $files) {
        sort($files);
        foreach (array_slice($files, 0, max(0, count($files) - ($kind === 'daily' ? DAILY_KEEP : EXTRA_KEEP))) as $f) {
            unlink($f);
        }
    }
}

/** Список копий, новые сверху: имя, дата, время, вид, размер. */
function backup_list(): array
{
    $out = [];
    foreach (glob(DAILY_DIR . '/site_*.sqlite') ?: [] as $f) {
        if (!preg_match(BACKUP_NAME_RE, basename($f), $m)) {
            continue;
        }
        $time = isset($m[2]) && $m[2] !== '' ? substr($m[2], 0, 2) . ':' . substr($m[2], 2) : null;
        $out[] = ['name' => basename($f), 'date' => $m[1], 'time' => $time, 'kind' => $m[3] ?? 'daily', 'size' => filesize($f),
                  'sort' => $m[1] . ($time ?? '00:00')];
    }
    usort($out, fn($a, $b) => strcmp($b['sort'], $a['sort']) ?: strcmp($b['kind'], $a['kind']));
    return array_map(function ($r) {
        unset($r['sort']);
        return $r;
    }, $out);
}

/**
 * «Вернуть»: копия текущего состояния → содержимое базы из копии (вход администратора остаётся свой)
 * → недостающие фото из .trash. Копия старой схемы сначала доводится миграциями.
 */
function backup_restore(string $name): ?string
{
    if (!preg_match(BACKUP_NAME_RE, $name) || !is_file(DAILY_DIR . '/' . $name)) {
        return 'backup.not_found';
    }
    $tmp = DAILY_DIR . '/.restore-' . bin2hex(random_bytes(4)) . '.sqlite';
    copy(DAILY_DIR . '/' . $name, $tmp);
    try {
        $src = new PDO('sqlite:' . $tmp, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        if ($src->query("SELECT COUNT(*) FROM sqlite_master WHERE name = 'elements'")->fetchColumn() == 0) {
            return 'backup.bad_file';
        }
        migrate($src);
        $src = null;

        backup_now('restore');
        $pdo = db();
        $keepDay = setting('backup_last_day');
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                               AND name NOT IN ('schema_version', 'admins')")->fetchAll(PDO::FETCH_COLUMN);
        $pdo->exec('PRAGMA foreign_keys = OFF');
        $pdo->exec('ATTACH DATABASE ' . $pdo->quote($tmp) . ' AS b');
        $pdo->beginTransaction();
        try {
            foreach ($tables as $t) {
                $cols = array_column($pdo->query('PRAGMA b.table_info(' . $pdo->quote($t) . ')')->fetchAll(), 'name');
                $pdo->exec('DELETE FROM main."' . $t . '"');
                if ($cols) {
                    $list = '"' . implode('","', $cols) . '"';
                    $pdo->exec('INSERT INTO main."' . $t . '" (' . $list . ') SELECT ' . $list . ' FROM b."' . $t . '"');
                }
            }
            $pdo->prepare("INSERT INTO settings (key, value) VALUES ('backup_last_day', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                ->execute([$keepDay]);
            $pdo->commit();
        } catch (Throwable $ex) {
            $pdo->rollBack();
            throw $ex;
        } finally {
            $pdo->exec('DETACH DATABASE b');
            $pdo->exec('PRAGMA foreign_keys = ON');
        }
        setting_reset();
        photos_from_trash();
        return null;
    } catch (Throwable $ex) {
        error_log('[restore] ' . $ex->getMessage());
        return 'backup.failed';
    } finally {
        @unlink($tmp);
    }
}

/** Исходники фото, на которые нет ссылок в базе, — в .trash; старше 15 дней в .trash — стереть. */
function photos_to_trash(): void
{
    $used = [];
    foreach (db()->query('SELECT original_path, processed_path FROM photos')->fetchAll() as $p) {
        $used[$p['original_path']] = true;
        if ($p['processed_path']) {
            $used[$p['processed_path']] = true;
        }
    }
    if (!is_dir(TRASH_DIR)) {
        mkdir(TRASH_DIR, 0775, true);
    }
    foreach (glob(ORIGINALS_DIR . '/*') ?: [] as $f) {
        if (is_file($f) && !isset($used[basename($f)]) && filemtime($f) < time() - 3600) {
            rename($f, TRASH_DIR . '/' . basename($f));
            touch(TRASH_DIR . '/' . basename($f));
        }
    }
    foreach (glob(TRASH_DIR . '/*') ?: [] as $f) {
        if (is_file($f) && filemtime($f) < time() - TRASH_DAYS * 86400) {
            unlink($f);
        }
    }
}

/** После восстановления: исходники, на которые снова есть ссылки, — обратно из .trash. */
function photos_from_trash(): void
{
    foreach (db()->query('SELECT original_path, processed_path FROM photos')->fetchAll() as $p) {
        foreach ([$p['original_path'], $p['processed_path']] as $name) {
            if ($name && !is_file(ORIGINALS_DIR . '/' . $name) && is_file(TRASH_DIR . '/' . basename($name))) {
                rename(TRASH_DIR . '/' . basename($name), ORIGINALS_DIR . '/' . $name);
            }
        }
    }
}

function set_setting(string $key, ?string $value): void
{
    db()->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        ->execute([$key, $value]);
    setting_reset();
}
