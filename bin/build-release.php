<?php
declare(strict_types=1);

/**
 * Релиз движка (спецификация 2.1, разделы 14.1–14.2): php bin/build-release.php [папка] [адрес_папки_обновлений]
 * Собирает в папку (по умолчанию dist/):
 *   enotis-X.Y.Z.zip   — код движка без data/ (кроме data/.htaccess), без demo/, docs/, tests/;
 *   latest.json        — версия, ссылка на ZIP, sha256, min_php, «Что нового» из docs/releases/X.Y.Z.json;
 *   palomnik-site.zip  — наполнение «Паломника» для «Загрузить сайт» (site.json + photos/).
 * Файлы берутся из git (только то, что в репозитории).
 */

$root = dirname(__DIR__);
$out = rtrim($argv[1] ?? $root . '/dist', '/');
$base = rtrim($argv[2] ?? 'https://update.enotis.ru', '/');

$src = (string) file_get_contents($root . '/app/bootstrap.php');
if (!preg_match("~const ENGINE_VERSION = '(\d+\.\d+\.\d+)'~", $src, $m)) {
    fwrite(STDERR, "Не найдена ENGINE_VERSION\n");
    exit(1);
}
$version = $m[1];
if (!is_dir($out)) {
    mkdir($out, 0775, true);
}

exec('git -C ' . escapeshellarg($root) . ' ls-files app public bin .htaccess data/.htaccess', $files, $rc);
if ($rc !== 0 || !$files) {
    fwrite(STDERR, "git ls-files не сработал\n");
    exit(1);
}
$files = array_values(array_filter($files, fn ($f) => !preg_match('~^public/uploads/(?!\.gitkeep$)~', $f)));

$zipFile = "$out/enotis-$version.zip";
@unlink($zipFile);
$z = new ZipArchive();
$z->open($zipFile, ZipArchive::CREATE);
foreach ($files as $f) {
    $z->addFile("$root/$f", $f);
}
$z->addFromString('data/.gitkeep', '');
$z->close();

$notesFile = "$root/docs/releases/$version.json";
$notes = is_file($notesFile) ? json_decode((string) file_get_contents($notesFile), true) : null;
$latest = [
    'version' => $version,
    'zip'     => "$base/enotis-$version.zip",
    'sha256'  => hash_file('sha256', $zipFile),
    'min_php' => '8.1',
    'notes'   => is_array($notes) ? $notes : ['ru' => [], 'ka' => [], 'en' => [], 'fr' => []],
];
file_put_contents("$out/latest.json", json_encode($latest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");

// «Паломник» — тем же форматом, что «Выгрузить сайт» (раздел 13).
$pal = "$out/palomnik-site.zip";
@unlink($pal);
$z = new ZipArchive();
$z->open($pal, ZipArchive::CREATE);
$z->addFile("$root/demo/site.json", 'site.json');
foreach (glob("$root/demo/photos/*") ?: [] as $p) {
    $z->addFile($p, 'photos/' . basename($p));
}
$z->close();

echo "enotis-$version.zip (" . count($files) . " файлов), latest.json, palomnik-site.zip → $out\n";
