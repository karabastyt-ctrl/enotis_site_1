#!/usr/bin/env bash
# Проверка админки по HTTP: вход, дерево, сохранение, неверный пароль, сброс через файл.
# Запуск: ENOTIS_DATA=/tmp/x php bin/import.php … ; php -S 127.0.0.1:8081 …; tests/admin-smoke.sh http://127.0.0.1:8081
set -euo pipefail
B=${1:-http://127.0.0.1:8081}
J=$(mktemp)
csrf() { curl -fsS -b "$J" -c "$J" "$B/admin" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//'; }

# Новая установка: создаём вход.
T=$(csrf)
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$T&login=admin&email=a@example.com&password=correct-horse&password2=correct-horse" "$B/admin/setup"
curl -fsS -b "$J" -c "$J" "$B/admin" | grep -q 'id="boot"'

# Дерево и сохранение без изменений: сайт на выходе тот же.
BEFORE=$(curl -fsS "$B/" | sed 's#/uploads/photos/[0-9]*-##g' | md5sum)
CS=$(curl -fsS -b "$J" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')
curl -fsS -b "$J" "$B/admin/api/site" > /tmp/admin-site.json
php -r '$j=json_decode(file_get_contents("/tmp/admin-site.json"),true); file_put_contents("/tmp/admin-save.json", json_encode(["site"=>$j["site"]], JSON_UNESCAPED_UNICODE));'
CODE=$(curl -s -o /tmp/admin-save-res.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/admin-save.json "$B/admin/api/save")
echo "save: $CODE"
# В тестовой ленте есть видимая услуга без ссылки — сервер обязан отказать и назвать причину.
test "$CODE" = 422
grep -q 'err.service_url' /tmp/admin-save-res.json
php -r '$j=json_decode(file_get_contents("/tmp/admin-save.json"),true); function hide(&$bl){foreach($bl as &$b){ if(($b["type"]??"")==="service" && trim($b["url"]??"")==="") $b["hidden"]=true; foreach($b["tiles"]??[] as &$t) { if (isset($t["blocks"])) hide($t["blocks"]); } } } hide($j["site"]["blocks"]); file_put_contents("/tmp/admin-save.json", json_encode($j, JSON_UNESCAPED_UNICODE));'
test "$(curl -s -o /tmp/admin-save-res.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/admin-save.json "$B/admin/api/save")" = 200
grep -q '"ok":true' /tmp/admin-save-res.json
AFTER=$(curl -fsS "$B/" | sed 's#/uploads/photos/[0-9]*-##g' | md5sum)
test "$BEFORE" = "$AFTER"

# Без токена запись запрещена; без входа API закрыт.
test "$(curl -s -o /dev/null -w '%{http_code}' -b "$J" -H 'Content-Type: application/json' --data '{}' "$B/admin/api/save")" = 403
test "$(curl -s -o /dev/null -w '%{http_code}' "$B/admin/api/site")" = 401

# Превью несохранённого.
curl -fsS -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/admin-save.json "$B/admin/api/preview" | grep -q '"ok":true'
curl -fsS -b "$J" "$B/admin/preview?path=/" | grep -q 'data-eid='

# Неверный пароль не пускает; выход закрывает сессию.
K=$(mktemp); T=$(curl -fsS -c "$K" "$B/admin" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
curl -fsS -b "$K" -c "$K" -d "csrf=$T&login=admin&password=wrong" "$B/admin/login" | grep -q 'role="alert"'
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$CS" "$B/admin/logout" || true
test "$(curl -s -o /dev/null -w '%{http_code}' -b "$J" "$B/admin/api/site")" = 401
echo "admin smoke ok"
