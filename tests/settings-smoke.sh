#!/usr/bin/env bash
# Проверка этапа 6: оформление, почта и «Забыли пароль?», резервные копии, счётчик.
# Сервер запущен с ENOTIS_MAIL_FILE — письма пишутся в файл. Запуск: tests/settings-smoke.sh http://127.0.0.1:8083 /tmp/mail.txt
set -euo pipefail
B=${1:-http://127.0.0.1:8083}
MAIL=${2:-/tmp/enotis-mail.txt}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
has() { grep -q -- "$1" "$2"; }
csrf_form() { curl -fsS -b "$1" -c "$1" "$B$2" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//'; }

# Вход и токен API.
J=$(mktemp)
T=$(csrf_form "$J" /admin)
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$T&login=admin&email=admin@example.com&password=correct-horse&password2=correct-horse" "$B/admin/setup"
CS=$(curl -fsS -b "$J" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')

# Значок без своего: буква на цвете действия.
curl -fsS -o /tmp/st-home.html "$B/"
has 'href="/favicon.svg' /tmp/st-home.html
test "$(code "$B/favicon.svg")" = 200

# Оформление: значок 512 → ico, 32, 180, 192; картинка для соцсетей 1200×630.
php -r '$i=imagecreatetruecolor(600,600); imagepng($i,"/tmp/st-icon.png"); $i=imagecreatetruecolor(1400,800); imagejpeg($i,"/tmp/st-og.jpg"); $i=imagecreatetruecolor(100,100); imagepng($i,"/tmp/st-small.png");'
curl -fsS -b "$J" -H "X-CSRF: $CS" -F kind=favicon -F file=@/tmp/st-icon.png -o /tmp/st-fav.json "$B/admin/api/brand"
curl -fsS -b "$J" -H "X-CSRF: $CS" -F kind=og_image -F file=@/tmp/st-og.jpg -o /tmp/st-og.json "$B/admin/api/brand"
test "$(code -b "$J" -H "X-CSRF: $CS" -F kind=favicon -F file=@/tmp/st-small.png "$B/admin/api/brand")" = 400
printf '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><circle r="5"/></svg>' > /tmp/st-logo.svg
curl -fsS -b "$J" -H "X-CSRF: $CS" -F kind=logo -F file=@/tmp/st-logo.svg -o /tmp/st-logo.json "$B/admin/api/brand"
FAV=$(php -r 'echo json_decode(file_get_contents("/tmp/st-fav.json"))->url;')
OG=$(php -r 'echo json_decode(file_get_contents("/tmp/st-og.json"))->url;')
LOGO=$(php -r 'echo json_decode(file_get_contents("/tmp/st-logo.json"))->url;')
curl -fsS -o /tmp/st-logo-file.svg "$B$LOGO"
if grep -qi 'script\|onload' /tmp/st-logo-file.svg; then exit 1; fi
php -r '[$w,$h]=getimagesize($argv[1]); exit($w===1200 && $h===630 ? 0 : 1);' "public$OG"

# Сохранение: оформление в дереве, почта и счётчик — отдельно (не выгружаются).
curl -fsS -b "$J" "$B/admin/api/site" > /tmp/st-site.json
php -r '$j=json_decode(file_get_contents("/tmp/st-site.json"),true); $s=$j["site"];
  $s["settings"]["favicon"]=["url"=>$argv[1]]; $s["settings"]["og_image"]=["url"=>$argv[2]]; $s["settings"]["logo"]=["url"=>$argv[3],"with_title"=>true];
  $p=$j["private"]; $p["counter_code"]="<script>window.__cnt=1</script>"; $p["smtp_user"]="box-user"; $p["smtp_pass"]="box-secret";
  file_put_contents("/tmp/st-save.json", json_encode(["site"=>$s,"private"=>$p], JSON_UNESCAPED_UNICODE));' "$FAV" "$OG" "$LOGO"
test "$(curl -s -o /tmp/st-save-res.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/st-save.json "$B/admin/api/save")" = 200
curl -fsS -o /tmp/st-home.html "$B/"
has '<script>window.__cnt=1</script>' /tmp/st-home.html
has 'rel="apple-touch-icon"' /tmp/st-home.html
has 'og:image" content="[^"]*/uploads/brand/og-' /tmp/st-home.html
test "$(code "$B/favicon.ico")" = 200
# В превью счётчика нет; пароль ящика наружу не отдаётся.
curl -fsS -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/st-save.json -o /dev/null "$B/admin/api/preview"
curl -fsS -b "$J" -o /tmp/st-prev.html "$B/admin/preview?path=/"
if grep -q '__cnt' /tmp/st-prev.html; then exit 1; fi
curl -fsS -b "$J" -o /tmp/st-site2.json "$B/admin/api/site"
if grep -q 'box-secret' /tmp/st-site2.json; then exit 1; fi
has '"smtp_pass_set":true' /tmp/st-site2.json
# В ZIP: файлы оформления есть, счётчика, ящика и почты администратора нет.
curl -fsS -b "$J" -o /tmp/st.zip "$B/admin/api/export"
php -r '$z=new ZipArchive; $z->open($argv[1]); $s=$z->getFromName("site.json");
  foreach (["__cnt","box-secret","box-user","admin@example.com","smtp"] as $bad) if (str_contains($s,$bad)) { fwrite(STDERR,"leak $bad\n"); exit(1); }
  $names=[]; for($i=0;$i<$z->numFiles;$i++) $names[]=$z->getNameIndex($i);
  exit(count(preg_grep("~^brand/fav-.*-512\.png$~",$names)) && count(preg_grep("~^brand/og-~",$names)) ? 0 : 1);' /tmp/st.zip

# Тестовое письмо — на почту администратора.
rm -f "$MAIL"
curl -fsS -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data '{}' -o /tmp/st-mail.json "$B/admin/api/mail_test"
has '"ok":true' /tmp/st-mail.json
has 'To: admin@example.com' "$MAIL"

# «Забыли пароль?»: ответ одинаковый, ссылка одноразовая, старые сессии закрываются.
K=$(mktemp)
T=$(csrf_form "$K" /admin/forgot)
curl -fsS -b "$K" -c "$K" -d "csrf=$T&login=nobody" -o /tmp/st-f1.html "$B/admin/forgot"
curl -fsS -b "$K" -c "$K" -d "csrf=$T&login=admin" -o /tmp/st-f2.html "$B/admin/forgot"
test "$(grep -o 'note--ok[^<]*' /tmp/st-f1.html)" = "$(grep -o 'note--ok[^<]*' /tmp/st-f2.html)"
LINK=$(grep -o 'http[^ ]*/admin/reset?token=[0-9a-f]*' "$MAIL" | tail -1)
TOK=${LINK##*=}
test -n "$TOK"
test "$(code -b "$K" -c "$K" -d "csrf=$T&token=$TOK&password=new-pass-1234&password2=new-pass-1234" "$B/admin/reset")" = 303
test "$(code -b "$J" "$B/admin/api/site")" = 401
curl -fsS -o /tmp/st-f3.html "$B/admin/reset?token=$TOK"
has 'role="alert"' /tmp/st-f3.html
# Не больше 3 писем в час.
rm -f "$MAIL"
T=$(csrf_form "$K" /admin/forgot)
for i in 1 2 3 4; do curl -fsS -b "$K" -c "$K" -d "csrf=$T&login=admin" -o /dev/null "$B/admin/forgot"; done
test "$(grep -c '^To: ' "$MAIL")" = 2   # одно уже ушло в этот час

# Резервные копии: сегодняшняя есть, «Вернуть» возвращает прежнее состояние.
CS=$(curl -fsS -b "$K" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')
curl -fsS -b "$K" -o /tmp/st-bk.json "$B/admin/api/backups"
NAME=$(php -r '$l=json_decode(file_get_contents("/tmp/st-bk.json"),true)["list"]; foreach($l as $b) if($b["kind"]==="daily") { echo $b["name"]; break; }')
test -n "$NAME"
curl -fsS -o /tmp/st-before.html "$B/"
if grep -q '__cnt' /tmp/st-before.html; then :; else exit 1; fi
test "$(curl -s -o /tmp/st-rs.json -w '%{http_code}' -b "$K" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data "{\"name\":\"$NAME\"}" "$B/admin/api/backup_restore")" = 200
curl -fsS -o /tmp/st-after.html "$B/"
if grep -q '__cnt' /tmp/st-after.html; then exit 1; fi     # копия утренняя — счётчика ещё не было
test "$(code -b "$K" "$B/admin/api/site")" = 200           # вход остался свой
has '"kind":"restore"' /tmp/st-rs.json
test "$(code -b "$K" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data '{"name":"../site.sqlite"}' "$B/admin/api/backup_restore")" = 422
echo "settings smoke ok"
