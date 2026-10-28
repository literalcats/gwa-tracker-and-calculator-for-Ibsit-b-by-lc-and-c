# Block B Grade Tracker

Flask + vanilla JS app. Grades are saved in the browser's **local web storage** (never on the server).
Excel/JSON exports act as restorable "saves". Installable as a PWA. Dark mode default, light mode with block colors.

New to the code? Start with the picture: `docs/how-it-works-flowchart.png` (5 short stories of how the app works).

## Run locally
    pip install -r requirements.txt
    python app.py            # http://127.0.0.1:5000

## Tests
    python -m unittest discover -s tests
    node tests/calc.test.mjs

## Deploy on Render
Push to GitHub -> Render: New + -> Blueprint -> pick the repo (uses render.yaml). Start command: `gunicorn app:app`.
PWA install needs HTTPS, which Render provides. On iPhone: Safari -> Share -> Add to Home Screen.

## Where things live
- `tracker/models.py`   data shapes + validation (Course > Component > Item)
- `tracker/grading.py`  grade math (Python copy, used for the Excel Summary)
- `tracker/excel.py`    .xlsx export/import (openpyxl)
- `tracker/routes/`     pages.py (page, manifest, service worker), api.py (export/import)
- `tracker/templates/`  Jinja HTML; `tracker/static/css/` theme tokens + styles
- `tracker/static/js/`  store.js (localStorage), calc.js (math + what-if), views/ (screens)

Note: the Block B hub can mount `pages_bp` / `api_bp` under a prefix such as `/grades`.
