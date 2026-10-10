#!/usr/bin/env bash
# Проверка этапа 7: фотосервис (раздел 10.6.1) на заглушке без сети.
# Сервер запущен с ENOTIS_PHOTO_FAKE=1. Запуск: tests/photo-smoke.sh http://127.0.0.1:8084
set -euo pipefail
B=${1:-http://127.0.0.1:8084}
csrf_form() { curl -fsS -b "$1" -c "$1" "$B$2" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//'; }
jget() { php -r '$j=json_decode(file_get_contents($argv[1]),true); foreach(explode(".",$argv[2]) as $k) $j=$j[$k]??null; echo is_bool($j)?($j?"true":"false"):(is_array($j)?json_encode($j):$j);' "$1" "$2"; }

J=$(mktemp)
T=$(curl -fsS -b "$J" -c "$J" "$B/admin/install" | grep -o 'name="csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//')
curl -fsS -b "$J" -c "$J" -o /dev/null -d "csrf=$T&site_title=Test&site_lang=ru&ui_lang=ru&login=admin&email=admin@example.com&password=correct-horse&password2=correct-horse" "$B/admin/install"
CS=$(curl -fsS -b "$J" "$B/admin" | grep -o '"csrf":"[^"]*"' | head -1 | sed 's/"csrf":"//;s/"//')
post() { curl -fsS -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data "$2" "$B/admin/api/$1"; }

# Бутылка на белом фоне, наклон 3°, стоит не по центру; и пейзаж для «Улучшить».
php -r '$i=imagecreatetruecolor(900,1200); imagefill($i,0,0,imagecolorallocate($i,255,255,255));
  $b=imagecreatetruecolor(160,700); imagefill($b,0,0,imagecolorallocate($b,40,60,30));
  imagefilledrectangle($b,0,0,159,10,imagecolorallocate($b,40,60,30));
  imagecopy($i,$b,250,300,0,0,160,700); $w=imagecolorallocate($i,255,255,255); $i=imagerotate($i,3,$w);
  imagejpeg($i,"/tmp/ph-bottle.jpg",95);
  $l=imagecreatetruecolor(1200,800); imagefill($l,0,0,imagecolorallocate($l,90,120,160)); imagejpeg($l,"/tmp/ph-land.jpg",90);'

curl -fsS -b "$J" -H "X-CSRF: $CS" -F aspect=4:5 -F file=@/tmp/ph-bottle.jpg -o /tmp/ph-up.json "$B/admin/api/photo"
ID=$(jget /tmp/ph-up.json photo.id)

# Ключа нет, но заглушка включена — сервис готов.
curl -fsS -b "$J" -o /tmp/ph-site.json "$B/admin/api/site"
test "$(jget /tmp/ph-site.json private.photo_ready)" = true

# Студийное фото: 1200×1500 на песочном фоне, бутылка ~80 % высоты, дно на 8 % выше края, по центру, ровно.
post photo_process "{\"id\":$ID,\"mode\":\"studio\",\"aspect\":\"4:5\"}" > /tmp/ph-st.json
test "$(jget /tmp/ph-st.json ok)" = true
test "$(jget /tmp/ph-st.json width)x$(jget /tmp/ph-st.json height)" = 1200x1500
PROC=$(jget /tmp/ph-st.json processed)
curl -fsS -b "$J" -o /tmp/ph-proc.jpg "$B/admin/api/original?id=$ID&src=proc"
php -r '$i=imagecreatefromjpeg($argv[1]); $c=imagecolorat($i,10,10);
  if (abs(($c>>16&255)-0xEA)>4 || abs(($c>>8&255)-0xE0)>4 || abs(($c&255)-0xD2)>4) { fwrite(STDERR,"фон не песочный\n"); exit(1); }
  $x0=9e9;$x1=-1;$y0=9e9;$y1=-1; $left=[];
  for($y=0;$y<1500;$y+=2) for($x=0;$x<1200;$x+=2){ $c=imagecolorat($i,$x,$y); if((($c>>16)&255)<90 && (($c>>8)&255)<110){ $x0=min($x0,$x);$x1=max($x1,$x);$y0=min($y0,$y);$y1=max($y1,$y); $left[$y]=min($left[$y]??9e9,$x);} }
  $h=$y1-$y0; $cx=($x0+$x1)/2;
  $tilt=abs($left[$y0+40]-$left[$y1-40]);
  printf("бутылка: высота %d, дно %d, центр %.0f, сдвиг края %d\n",$h,$y1,$cx,$tilt);
  exit(abs($h-1200)<50 && abs($y1-1380)<25 && abs($cx-600)<20 && $tilt<14 ? 0 : 1);' /tmp/ph-proc.jpg

# Ответ хранится: второй вызов не обращается к сервису и отдаёт тот же файл.
post photo_process "{\"id\":$ID,\"mode\":\"studio\",\"aspect\":\"4:5\"}" > /tmp/ph-st2.json
test "$(jget /tmp/ph-st2.json processed)" = "$PROC"
# Оригинал на месте.
curl -fsS -b "$J" -o /tmp/ph-orig.jpg "$B/admin/api/original?id=$ID&src=orig"
php -r '[$w,$h]=getimagesize($argv[1]); exit($w>=900 && $w<1000 ? 0 : 1);' /tmp/ph-orig.jpg

# «Улучшить» в рамке 3:2: кадр по центру, во весь кадр.
curl -fsS -b "$J" -H "X-CSRF: $CS" -F aspect=3:2 -F file=@/tmp/ph-land.jpg -o /tmp/ph-up2.json "$B/admin/api/photo"
ID2=$(jget /tmp/ph-up2.json photo.id)
post photo_process "{\"id\":$ID2,\"mode\":\"enhance\",\"aspect\":\"3:2\"}" > /tmp/ph-en.json
test "$(jget /tmp/ph-en.json ok)" = true
test "$(jget /tmp/ph-en.json fits)" = true
# Ошибка — ok:false с подписью, без падения.
post photo_process '{"id":999999,"mode":"studio","aspect":"4:5"}' > /tmp/ph-bad.json
test "$(jget /tmp/ph-bad.json error)" = photo.svc_failed

# Сохранение: первое вино получает обработанное фото; ключ API — только в установке.
php -r '$j=json_decode(file_get_contents("/tmp/ph-site.json"),true); $s=$j["site"]; $st=json_decode(file_get_contents("/tmp/ph-st.json"),true);
  $done=false;
  $walk=function(&$blocks) use (&$walk,&$done,$argv,$st){ foreach($blocks as &$b){ if($done) return;
    if(($b["type"]??"")==="tiles" && ($b["kind"]??"")==="wine" && $b["tiles"]){ $b["tiles"][0]["photo"]=["id"=>(int)$argv[1],"aspect"=>"4:5","rotate"=>0,"crop"=>$st["crop"],"head_crop"=>null,"use_processed"=>true]; $done=true; return; }
    if(($b["type"]??"")==="tabs") foreach($b["tabs"] as &$t) $walk($t["blocks"]);
    if(isset($b["tiles"])) foreach($b["tiles"] as &$tl) if(isset($tl["blocks"])) $walk($tl["blocks"]); } };
  $walk($s["blocks"]); if(!$done){ fwrite(STDERR,"нет блока вин\n"); exit(1); }
  $p=$j["private"]; $p["photo_api_key"]="sk-test-SECRET-abcd"; $p["photo_service"]="photoroom";
  file_put_contents("/tmp/ph-save.json", json_encode(["site"=>$s,"private"=>$p], JSON_UNESCAPED_UNICODE));' "$ID"
test "$(curl -s -o /tmp/ph-save-res.json -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/ph-save.json "$B/admin/api/save")" = 200
curl -fsS -b "$J" -o /tmp/ph-site2.json "$B/admin/api/site"
if grep -q 'SECRET' /tmp/ph-site2.json; then echo "ключ наружу"; exit 1; fi
grep -q '"photo_key_masked":"••••abcd"' /tmp/ph-site2.json
grep -q '"photo_service":"photoroom"' /tmp/ph-site2.json
grep -q "\"use_processed\":true,\"pv\":\"$PROC\"" /tmp/ph-site2.json
# На сайте нарезка идёт из обработанного файла: угол песочный.
TH=$(php -r '$j=json_decode(file_get_contents($argv[1]),true); $f=function($x) use (&$f,$argv){ if(is_array($x)){ if(($x["id"]??null)===(int)$argv[2] && isset($x["thumb"])) { echo $x["thumb"]; exit; } foreach($x as $v) $f($v);} }; $f($j["site"]);' /tmp/ph-site2.json "$ID")
curl -fsS -o /tmp/ph-thumb.jpg "$B$TH"
php -r '$i=imagecreatefromjpeg($argv[1]); $c=imagecolorat($i,3,3); exit(abs(($c>>16&255)-0xEA)<6 ? 0 : 1);' /tmp/ph-thumb.jpg
# В ZIP — обработанный файл, ключа нет.
curl -fsS -b "$J" -o /tmp/ph.zip "$B/admin/api/export"
php -r '$z=new ZipArchive; $z->open($argv[1]); $s=$z->getFromName("site.json");
  if (str_contains($s,"SECRET") || str_contains($s,"photo_api_key")) exit(1);
  exit($z->locateName("photos/".$argv[2])!==false ? 0 : 1);' /tmp/ph.zip "$PROC"
# «Вернуть оригинал»: сохранение без use_processed → сайт режет из оригинала.
php -r '$s=file_get_contents("/tmp/ph-save.json"); $s=str_replace("\"use_processed\":true","\"use_processed\":false",$s); $j=json_decode($s,true); unset($j["private"]); file_put_contents("/tmp/ph-save2.json",json_encode($j,JSON_UNESCAPED_UNICODE));'
test "$(curl -s -o /dev/null -w '%{http_code}' -b "$J" -H "X-CSRF: $CS" -H 'Content-Type: application/json' --data @/tmp/ph-save2.json "$B/admin/api/save")" = 200
curl -fsS -b "$J" -o /tmp/ph-site3.json "$B/admin/api/site"
grep -q "\"use_processed\":false,\"pv\":\"$PROC\"" /tmp/ph-site3.json
echo "photo-smoke: ok"
