# Сборка макета админки 2.0: python3 build.py <папка src> <выходной html>
import sys
d=sys.argv[1]; out=sys.argv[2]
import os
v8=open(os.path.join(d,'..','admin-v8.html')).read()
css=v8[v8.find('<style>')+7:v8.find('</style>')]+open(d+'/mock.css').read()
js=open(d+'/mock.js').read()
html=f'''<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Админка сайта-ленты 2.0</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Golos+Text:wght@400;500;600&display=swap" rel="stylesheet">
<style>{css}</style></head><body>
<div class="top"><div class="logo">Э</div><span class="nm" id="nm"></span><span class="st" id="st">Все изменения сохранены</span><span class="sp"></span><button class="btn" id="open">Открыть сайт</button><button class="btn pri" id="save">Сохранить</button></div>
<div class="cols"><aside class="tree" id="tree"></aside><section class="form" id="form"></section>
<section class="pvcol"><div class="pvbar"><span id="pvhint">Так увидит посетитель. Нажмите на любой элемент, чтобы изменить его</span><span class="sp"></span><span>Адрес:</span><select id="pvdom" class="btn sm"></select><div class="dv" id="dv"><button data-w="1280" class="on">Компьютер</button><button data-w="768">Планшет</button><button data-w="390">Телефон</button></div></div>
<div class="pvst" id="pvst"><div class="frm" id="frm"><div id="pv" style="height:100%"></div></div></div></section></div>
<div class="foot"><span>Движок 2.0 · макет админки по спецификации 2.0</span><span>Данные тестовые, сохранение имитируется</span></div>
<script>{js}</script></body></html>'''
open(out,'w').write(html)
