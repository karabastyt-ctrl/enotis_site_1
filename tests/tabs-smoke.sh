#!/usr/bin/env bash
# Проверка этапа 5 на агрегаторе: табы, адреса, SEO, выгрузка и загрузка ZIP.
# Запуск: ENOTIS_DATA=/tmp/x php bin/import.php tests/fixtures/aggregator/site.json; php -S 127.0.0.1:8082 …; tests/tabs-smoke.sh http://127.0.0.1:8082
set -euo pipefail
B=${1:-http://127.0.0.1:8082}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
has() { grep -q -- "$1" "$2"; }

# Табы: общая лента, свой адрес у каждого таба, поп-ап только внутри своего таба.
test "$(code "$B/")" = 200
test "$(code "$B/gruziya")" = 200
test "$(code "$B/gruziya/alaverdi")" = 200
test "$(code "$B/alaverdi")" = 404
test "$(code "$B/ka/gruziya")" = 200
test "$(code "$B/ka/serbiya")" = 404     # нет перевода
curl -fsS -o /tmp/tabs-home.html "$B/"
has 'class="tabs' /tmp/tabs-home.html
curl -fsS -o /tmp/tabs-frag.json "$B/serbiya?fragment=1"
has '"feed"' /tmp/tabs-frag.json

# Адрес одного таба: только он, без полосы табов, canonical на свой домен.
curl -fsS -H 'Host: georgia.obiteli.site' -o /tmp/tabs-one.html "$B/"
has 'Монастыри Грузии' /tmp/tabs-one.html
if grep -q 'class="tabs' /tmp/tabs-one.html; then exit 1; fi
has 'rel="canonical" href="http[s]*://georgia.obiteli.site/"' /tmp/tabs-one.html
test "$(code -H 'Host: georgia.obiteli.site' "$B/alaverdi")" = 200

# SEO: sitemap и robots.
curl -fsS -H 'Host: obiteli.site' -o /tmp/tabs-sitemap.xml "$B/sitemap.xml"
has "://obiteli.site/serbiya" /tmp/tabs-sitemap.xml
if grep -q 'obiteli.site/gruziya<' /tmp/tabs-sitemap.xml; then exit 1; fi   # у таба свой домен
curl -fsS -H 'Host: obiteli.site' -o /tmp/tabs-robots.txt "$B/robots.txt"
has 'Sitemap: http[s]*://obiteli.site/sitemap.xml' /tmp/tabs-robots.txt

# Выгрузка ZIP и загрузка обратно: сайт тот же, личных данных в архиве нет.
J=$(mktemp)
T=$(curl -fsS -b "$J" -c "$J" "$B/admin" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$T&login=admin&email=secret@example.com&password=correct-horse&password2=correct-horse" "$B/admin/setup"
CS=$(curl -fsS -b "$J" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')
BEFORE=$(curl -fsS "$B/gruziya" | sed -E 's#[0-9]+#N#g' | md5sum)   # id после загрузки другие
curl -fsS -b "$J" -o /tmp/tabs-site.zip "$B/admin/api/export"
curl -fsS -b "$J" -o /tmp/tabs-tab.zip "$B/admin/api/export?tab=1"
curl -fsS -b "$J" -o /tmp/tabs-struct.zip "$B/admin/api/export?structure=1"
php -r '$z=new ZipArchive; $z->open($argv[1]); $s=$z->getFromName("site.json"); if (!$s || str_contains($s, "secret@example.com") || str_contains($s, "password")) exit(1);' /tmp/tabs-site.zip
php -r '$z=new ZipArchive; $z->open($argv[1]); $j=json_decode($z->getFromName("site.json"), true); if (($j["source_tab"]["slug"] ?? "") !== "gruziya") exit(1);' /tmp/tabs-tab.zip
test "$(curl -s -o /tmp/tabs-imp.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -F file=@/tmp/tabs-site.zip "$B/admin/api/import")" = 200
has '"ok":true' /tmp/tabs-imp.json
AFTER=$(curl -fsS "$B/gruziya" | sed -E 's#[0-9]+#N#g' | md5sum)
test "$BEFORE" = "$AFTER"
test "$(curl -s -o /tmp/tabs-imptab.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -F file=@/tmp/tabs-tab.zip "$B/admin/api/import_tab")" = 200
has '"slug":"gruziya"' /tmp/tabs-imptab.json
# Чужой файл в архиве не распаковывается.
php -r '$z=new ZipArchive; $z->open($argv[1], ZipArchive::CREATE); $z->addFromString("site.json", "{}"); $z->addFromString("../evil.php", "<?php"); $z->close();' /tmp/tabs-bad.zip
test "$(code -b "$J" -H "X-CSRF: $CS" -F file=@/tmp/tabs-bad.zip "$B/admin/api/import")" = 422
test ! -e "$(dirname "$0")/../evil.php"
echo "tabs smoke ok"
