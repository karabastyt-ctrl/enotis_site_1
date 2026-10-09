<?php
declare(strict_types=1);

// Проверка: во всех языковых файлах сайта и админки одинаковые ключи и нет пустых строк.
// Запуск: php bin/check-lang.php
$langs = ['ru', 'ka', 'en', 'fr'];
$dirs  = [__DIR__ . '/../app/lang', __DIR__ . '/../app/lang/admin'];
$fail  = false;

foreach ($dirs as $dir) {
    $base = array_keys(require "$dir/ru.php");
    foreach ($langs as $lang) {
        $file = "$dir/$lang.php";
        if (!is_file($file)) {
            echo "Нет файла $file\n";
            $fail = true;
            continue;
        }
        $strings = require $file;
        $keys = array_keys($strings);
        foreach (array_diff($base, $keys) as $k) { echo "$file: нет ключа $k\n"; $fail = true; }
        foreach (array_diff($keys, $base) as $k) { echo "$file: лишний ключ $k\n"; $fail = true; }
        foreach ($strings as $k => $v) {
            if (!is_string($v) || trim($v) === '') { echo "$file: пустой $k\n"; $fail = true; }
        }
    }
}

echo $fail ? "Ошибки в переводах\n" : "Переводы в порядке\n";
exit($fail ? 1 : 0);
