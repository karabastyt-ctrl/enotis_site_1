<?php
declare(strict_types=1);

/**
 * Тестовое наполнение для test.enotis.ru: папка demo/ (site.json формата 3 + photos/).
 * Грузится само, если база пустая, и перезагружается, когда меняется demo/VERSION.
 * Сайт, наполненный не из demo/, не трогается. В релиз для клиентов папка demo/ не входит.
 */

const DEMO_DIR = ROOT_DIR . '/demo';

function demo_autoload(): void
{
    $verFile = DEMO_DIR . '/VERSION';
    if (!is_file($verFile)) {
        return;
    }
    $version = trim((string) file_get_contents($verFile));
    $loaded = setting('demo_version');
    if ($loaded === $version) {
        return;
    }
    $empty = (int) db()->query('SELECT COUNT(*) FROM elements')->fetchColumn() === 0;
    if ($loaded === null && !$empty) {
        return;
    }

    $lock = fopen(DATA_DIR . '/demo.lock', 'c');
    flock($lock, LOCK_EX);
    try {
        $st = db()->prepare("SELECT value FROM settings WHERE key = 'demo_version'");
        $st->execute();
        if ($st->fetchColumn() === $version) {
            return;
        }
        $site = json_decode((string) file_get_contents(DEMO_DIR . '/site.json'), true, 64, JSON_THROW_ON_ERROR);
        import_site($site, DEMO_DIR . '/photos');
        db()->prepare("INSERT INTO settings (key, value) VALUES ('demo_version', ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value")->execute([$version]);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    setting_reset();
}
