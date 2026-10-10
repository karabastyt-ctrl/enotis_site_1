<?php
declare(strict_types=1);

/**
 * База сайта: одно подключение на запрос, миграции применяются сами (спецификация 2.1, раздел 11.1).
 */

const DB_FILE        = DATA_DIR . '/site.sqlite';
const MIGRATIONS_DIR = APP_DIR . '/migrations';
const BACKUPS_DIR    = DATA_DIR . '/backups';
const BACKUPS_KEEP   = 10;

final class MigrationError extends RuntimeException {}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    if (!is_dir(DATA_DIR) && !mkdir(DATA_DIR, 0775, true) && !is_dir(DATA_DIR)) {
        throw new RuntimeException('Нет папки data/');
    }
    $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    migrate($pdo);
    return $pdo;
}

/** Номер последней миграции в коде: максимальный NNN из app/migrations/NNN_*.sql. */
function migrations(): array
{
    $list = [];
    foreach (glob(MIGRATIONS_DIR . '/[0-9][0-9][0-9]_*.sql') ?: [] as $file) {
        $list[(int) basename($file)] = $file;
    }
    ksort($list);
    return $list;
}

function schema_version(PDO $pdo): int
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    return (int) $pdo->query('SELECT COALESCE(MAX(version), 0) FROM schema_version')->fetchColumn();
}

function migrate(PDO $pdo): void
{
    $all = migrations();
    $latest = $all ? array_key_last($all) : 0;
    if (schema_version($pdo) >= $latest) {
        return;
    }

    // Два одновременных запроса не должны применять миграции дважды.
    $lock = fopen(DATA_DIR . '/migrate.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        $current = schema_version($pdo);
        if ($current >= $latest) {
            return;
        }
        if ($current > 0) {
            backup_before_migration($pdo, $current);
        }
        foreach ($all as $version => $file) {
            if ($version <= $current) {
                continue;
            }
            $pdo->beginTransaction();
            try {
                $pdo->exec((string) file_get_contents($file));
                $pdo->prepare('INSERT INTO schema_version (version) VALUES (?)')->execute([$version]);
                $pdo->commit();
            } catch (Throwable $ex) {
                $pdo->rollBack();
                $msg = basename($file) . ': ' . $ex->getMessage();
                error_log('[migrate] ' . $msg);
                throw new MigrationError($msg, 0, $ex);
            }
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Копия базы перед миграцией (раздел 11.1). */
function backup_before_migration(PDO $pdo, int $version): void
{
    // Упавшая миграция повторяется на каждом запросе: копию этой версии делаем один раз,
    // иначе повторы вытеснят более старые копии.
    if (!glob(BACKUPS_DIR . sprintf('/site_*_v%03d.sqlite', $version))) {
        db_backup($pdo, sprintf('v%03d', $version));
    }
}

/** Копия базы data/backups/site_ГГГГММДД-ЧЧММ_{метка}.sqlite; хранятся последние 10. */
function db_backup(PDO $pdo, string $tag): void
{
    if (!is_dir(BACKUPS_DIR)) {
        mkdir(BACKUPS_DIR, 0775, true);
    }
    $file = BACKUPS_DIR . sprintf('/site_%s_%s.sqlite', date('Ymd-Hi'), $tag);
    try {
        $pdo->exec('VACUUM INTO ' . $pdo->quote($file));
    } catch (PDOException) {
        // SQLite старше 3.27 на хостинге: сбрасываем журнал в файл базы и копируем его.
        $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        copy(DB_FILE, $file);
    }
    $old = glob(BACKUPS_DIR . '/site_*.sqlite') ?: [];
    sort($old);
    foreach (array_slice($old, 0, max(0, count($old) - BACKUPS_KEEP)) as $f) {
        unlink($f);
    }
}

function setting(string $key, ?string $default = null): ?string
{
    $cache = &setting_cache();
    $cache ??= db()->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    return $cache[$key] ?? $default;
}

function &setting_cache(): ?array
{
    static $cache = null;
    return $cache;
}

/** Сбросить кэш настроек после записи в базу. */
function setting_reset(): void
{
    $cache = &setting_cache();
    $cache = null;
}
