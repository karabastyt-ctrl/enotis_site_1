# Инструкция по админке

- `admin-manual.html` — инструкция (печать А4 из браузера или `admin-manual.pdf`).
- `img/` — скриншоты с метками. Снимаются с макета `docs/mockups/admin-2.0.html`.
- `shots.js` — пересъёмка: `node docs/manual/shots.js` (нужен playwright с Chromium).
- `pdf.js` — сборка PDF: `node docs/manual/pdf.js`.

Макет собирается из `docs/mockups/src/`: `python3 docs/mockups/src/build.py docs/mockups/src docs/mockups/admin-2.0.html`
(`v8.css` берётся из `docs/mockups/admin-v8.html`, см. начало `build.py`).

Поменялся макет или настоящая админка → пересняли `shots.js` → пересобрали `pdf.js`. Номера меток в `shots.js` должны совпадать с номерами в тексте.
