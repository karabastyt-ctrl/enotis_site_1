<?php
declare(strict_types=1);

// Загрузить сайт из JSON формата 3: php bin/import.php site.json [папка_с_фото]
// Текущее содержимое сайта заменяется. Перед этим — копия базы в data/backups/.
require __DIR__ . '/../app/bootstrap.php';

$json = $argv[1] ?? null;
if (!$json || !is_file($json)) {
    fwrite(STDERR, "Использование: php bin/import.php site.json [папка_с_фото]\n");
    exit(1);
}
$photos = $argv[2] ?? dirname($json) . '/photos';
db();
db_backup(db(), "import");
import_site(json_decode((string) file_get_contents($json), true, 64, JSON_THROW_ON_ERROR), $photos);
db()->exec("DELETE FROM settings WHERE key = 'demo_version'");
echo "Готово\n";
