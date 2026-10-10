#!/usr/bin/env bash
# Проверка этапа 8: мастер /install, «Обновить», «Откатить», авто-откат при упавшей миграции, плохой sha256.
# Обновление переписывает код, поэтому сайт запускается из копии во временной папке.
# Запуск: tests/update-smoke.sh 8085 8086
set -euo pipefail
P=${1:-8085}; PS=${2:-8086}
B=http://127.0.0.1:$P
REPO=$(cd "$(dirname "$0")/.." && pwd)
W=$(mktemp -d)
copy_code() { mkdir -p "$1"; (cd "$REPO" && tar cf - app public/index.php public/assets bin .htaccess) | (cd "$1" && tar xf -); mkdir -p "$1/public/uploads"; }
jget() { php -r '$j=json_decode(file_get_contents("php://stdin"),true); foreach(explode(".",$argv[1]) as $k) $j=$j[$k]??null; echo is_bool($j)?($j?"true":"false"):(is_array($j)?json_encode($j):(string)$j);' "$1"; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# Релиз «9.9.9»: та же копия, другая версия, новая миграция и новый файл.
release() { # версия, текст миграции
  local d="$W/rel-$1"; copy_code "$d"
  sed -i "s/const ENGINE_VERSION = '[0-9.]*'/const ENGINE_VERSION = '$1'/" "$d/app/bootstrap.php"
  printf '%s\n' "$2" > "$d/app/migrations/900_update_probe.sql"
  echo "<?php // новый файл релиза" > "$d/app/release_probe.php"
  mkdir -p "$W/srv"
  (cd "$d" && php -r '$z=new ZipArchive; $z->open($argv[1], ZipArchive::CREATE|ZipArchive::OVERWRITE);
     $it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator(".", FilesystemIterator::SKIP_DOTS));
     foreach($it as $f) if($f->isFile()) $z->addFile($f->getPathname(), substr($f->getPathname(),2));
     $z->addFromString("data/evil.txt","нельзя"); $z->close();' "$W/srv/enotis-$1.zip")
}
latest() { # версия, [sha]
  local sha=${2:-$(sha256sum "$W/srv/enotis-$1.zip" | cut -d' ' -f1)}
  printf '{"version":"%s","zip":"http://127.0.0.1:%s/enotis-%s.zip","sha256":"%s","min_php":"8.1","notes":{"ru":["Проверка"]}}' "$1" "$PS" "$1" "$sha" > "$W/srv/latest.json"
}
release 9.9.9 'CREATE TABLE update_probe (x INTEGER);'
release 9.9.8 'CREATE TABLE elements (x INTEGER);'
latest 9.9.9
php -S 127.0.0.1:$PS -t "$W/srv" >/dev/null 2>&1 &
SRV=$!

copy_code "$W/site"
mkdir -p "$W/data"
ENOTIS_DATA="$W/data" php "$W/site/bin/import.php" "$REPO/tests/fixtures/aggregator/site.json" >/dev/null
ENOTIS_DATA="$W/data" ENOTIS_UPDATE_URL="http://127.0.0.1:$PS/latest.json" php -S 127.0.0.1:$P -t "$W/site/public" "$W/site/public/index.php" >"$W/php.log" 2>&1 &
SITE=$!
trap 'kill $SRV $SITE 2>/dev/null || true; rm -rf "$W"' EXIT
sleep 1
OLD=$(curl -fsS "$B/health" | grep -o 'engine=[0-9.]*' | cut -d= -f2)

# Мастер установки: без администратора админка ведёт на /install; после — /install закрыт.
test "$(code "$B/admin")" = 303
J=$(mktemp)
curl -fsS -b "$J" -c "$J" -o "$W/install.html" "$B/admin/install"
grep -q 'PHP 8.1' "$W/install.html"
T=$(grep -o 'name="csrf" value="[^"]*"' "$W/install.html" | head -1 | sed 's/.*value="//;s/"//')
# Почта администратора обязательна.
curl -fsS -b "$J" -c "$J" -o "$W/install2.html" -d "csrf=$T&site_title=Тест&site_lang=ru&ui_lang=ru&login=admin&email=&password=correct-horse&password2=correct-horse" "$B/admin/install"
grep -q 'note--err' "$W/install2.html"
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$T&site_title=Тест&site_lang=ru&ui_lang=ru&login=admin&email=a@example.com&password=correct-horse&password2=correct-horse" "$B/admin/install"
test -f "$W/data/config.php"
test "$(code "$B/admin/install")" = 303
CS=$(curl -fsS -b "$J" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')
api() { curl -sS -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data "${2:-{\}}" "$B/admin/api/$1"; }
step() { api update_step "{\"step\":\"$1\"}"; }

# Есть новая версия.
curl -fsS -b "$J" "$B/admin/api/update" > "$W/u.json"
test "$(jget newer < "$W/u.json")" = true
test "$(jget latest < "$W/u.json")" = 9.9.9

# Обновление по шагам.
for s in prepare download replace; do test "$(step $s | jget ok)" = true; done
test "$(step finish | jget version)" = 9.9.9
curl -fsS "$B/health" | grep -q 'engine=9.9.9 schema=900'
test -f "$W/site/app/release_probe.php"
test ! -e "$W/data/evil.txt"
test "$(code "$B/")" = 200

# Откат: прежний код и база, новый файл удалён.
curl -fsS -b "$J" "$B/admin/api/update" | jget rollback | grep -qx "$OLD"
test "$(api update_rollback | jget ok)" = true
curl -fsS "$B/health" | grep -q "engine=$OLD"
curl -fsS "$B/health" | grep -q 'schema=1\b'
test ! -e "$W/site/app/release_probe.php"
test "$(code "$B/")" = 200

# Плохая контрольная сумма: код не тронут.
latest 9.9.9 0000000000000000000000000000000000000000000000000000000000000000
api update_check >/dev/null
test "$(step prepare | jget ok)" = true
test "$(step download | jget error)" = update.bad_sum
curl -fsS "$B/health" | grep -q "engine=$OLD"

# Миграция нового релиза падает: код и база возвращаются сами, сайт работает.
latest 9.9.8
api update_check >/dev/null
for s in prepare download replace; do test "$(step $s | jget ok)" = true; done
test "$(code -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data '{"step":"finish"}' "$B/admin/api/update_step")" = 503
test "$(step finish | jget rolled_back)" = true
curl -fsS "$B/health" | grep -q "engine=$OLD"
test ! -e "$W/site/app/release_probe.php"
test "$(code "$B/")" = 200
if grep -E 'PHP (Warning|Notice|Deprecated|Fatal)' "$W/php.log" | grep -v JIT; then exit 1; fi
echo "update-smoke: ok"
