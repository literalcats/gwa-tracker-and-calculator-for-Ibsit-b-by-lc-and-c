# I-BSIT-B GWA Calculator and Grade Tracker (By Carl Ianne)

A static website (HTML + CSS + JavaScript, **no server code**) that works offline as an installable app (PWA).
Your grades are saved in your browser's **IndexedDB** (local storage on your device, never uploaded).
Excel (.xlsx) and JSON files act as restorable "saves" in case browser data is wiped.

New to the code? Start with the picture: `docs/how-it-works-flowchart.png` (6 short stories of how the app works).

## 1. One-time setup: the Excel library file
Download this one file and put it in `public/vendor/` (keep the name `xlsx.full.min.js`):
https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
Without it, the Excel buttons show a "library file is missing" message. Everything else (including JSON backup) works.
See `public/vendor/README.txt`.

## 2. Run it on your computer
    node tools/dev-server.mjs        # then open http://localhost:8000
(or: `python -m http.server 8000 --directory public`)

## 3. Tests
    npm test                          # needs Node 20+; 30 tests: math, data cleaning, Excel rows, saving/loading, size limits, offline file list

## 4. Deploy on Vercel
1. Put this folder in a GitHub repository.
2. Vercel -> Add New -> Project -> import the repo. Leave everything as is (`vercel.json` sets the Output Directory to `public`, no build step).
3. Deploy. Open the link on your phone and choose "Add to Home Screen" / "Install app".
Updating later: push to GitHub and Vercel redeploys. If you ADD a new file to the app, also add it to the `CORE` list in `public/sw.js`.

## Where things live (everything the site serves is inside `public/`)
| Folder / file | What it does |
|---|---|
| `index.html` | the one page; JavaScript draws the screens inside it |
| `js/config.js` | app name, file names, storage names (change the name here) |
| `js/models/schema.js` | data shapes + cleaning/validation (Course > Component > Item) |
| `js/models/presets.js` | course templates, grade-scale presets, sample data |
| `js/services/db.js` | tiny IndexedDB wrapper (get / put) |
| `js/services/store.js` | app memory: loads on start, saves on every change, syncs tabs |
| `js/services/calc.js` | ALL the grade math + the what-if solver |
| `js/services/excel-sheets.js` | grades <-> plain rows for Excel |
| `js/services/excel.js` | rows <-> .xlsx file using the SheetJS library |
| `js/services/backup.js` | file download + JSON backup |
| `js/views/` | the screens: dashboard, course (plus `what-if-card.js` and `components-card.js`), settings, course form |
| `js/ui/` | small helpers: building HTML, dialogs, toasts, icons, size-limit guard |
| `sw.js`, `manifest.webmanifest` | offline mode and "install as app" |
| `css/theme.css` | all colors (dark default, light with block colors) |

## Good to know
- **Moving from the old Flask/Render version:** browsers keep data per website address, so export from the old site
  (Settings -> Backup) and import on the new one. Old Excel exports import fine.
  If the new site happens to use the same address as the old one, the old saved data is copied in automatically.
- The theme choice is the only thing kept in `localStorage` (so it applies before the page paints).
- Excel headers are plain (the free SheetJS build cannot style cells). The data is identical.
