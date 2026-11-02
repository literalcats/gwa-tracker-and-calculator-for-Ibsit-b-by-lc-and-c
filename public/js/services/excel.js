/**
 * excel.js -- Excel (.xlsx) export and import, done entirely in the browser.
 * ==========================================================================
 * Creating and reading real .xlsx files is complicated (an .xlsx is a zipped bundle of XML),
 * so we use a ready-made library called SheetJS. It is ONE file you put in the project:
 *      public/vendor/xlsx.full.min.js        (see vendor/README.txt)
 * It is loaded only when you press an Excel button, and the service worker saves it so
 * Excel export/import also works offline.
 *
 * The work is split in 3 layers (easy to follow and to test):
 *   excel-sheets.js  grades <-> plain rows (no library needed)
 *   this file        rows <-> .xlsx file, using the SheetJS library
 *   backup.js        saving the file to the device
 */
import { FILE_PREFIX, XLSX_LIBRARY_PATH } from "../config.js";
import { normalize } from "../models/schema.js";
import { buildSheets, parseSheets } from "./excel-sheets.js";
import { download, todayStamp } from "./backup.js";
import { markBackedUp } from "./store.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const COLUMN_WIDTHS = {
  Summary: [34, 12, 8, 12, 8, 16, 16],
  Data: [34, 12, 8, 22, 10, 24, 10, 10, 10],
  Settings: [28, 14],
};

// ---------- load the library (only when needed) ----------
let loading = null;

function libraryMissing() {
  return new Error("The Excel library file is missing (or you are offline). Put xlsx.full.min.js in the vendor folder, see vendor/README.txt. The JSON backup still works.");
}

export function loadLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL(XLSX_LIBRARY_PATH, document.baseURI).href;
      script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(libraryMissing()));
      script.onerror = () => reject(libraryMissing());
      document.head.append(script);
    }).catch((error) => { loading = null; throw error; });   // allow trying again later
  }
  return loading;
}

// ---------- the library-facing parts (take the library `X` as an argument so tests can fake it) ----------

/** state -> .xlsx file contents */
export function writeWorkbook(X, state) {
  const sheets = buildSheets(state);
  const workbook = X.utils.book_new();
  for (const [name, rows] of [["Summary", sheets.summary], ["Data", sheets.data], ["Settings", sheets.settings]]) {
    const sheet = X.utils.aoa_to_sheet(rows);
    sheet["!cols"] = COLUMN_WIDTHS[name].map((wch) => ({ wch }));
    X.utils.book_append_sheet(workbook, sheet, name);
  }
  return X.write(workbook, { bookType: "xlsx", type: "array" });
}

/** .xlsx file contents -> a clean save object */
export function readWorkbook(X, arrayBuffer) {
  let workbook;
  try { workbook = X.read(arrayBuffer, { type: "array" }); }
  catch { throw new Error("That file could not be read as an Excel (.xlsx) workbook."); }

  const rowsOf = (wanted) => {
    const name = workbook.SheetNames.find((n) => n.trim().toLowerCase() === wanted);
    return name ? X.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }) : null;
  };
  return normalize(parseSheets(rowsOf("data"), rowsOf("settings")));
}

// ---------- what the buttons call ----------
export async function exportExcel(state) {
  const X = await loadLibrary();
  const data = writeWorkbook(X, state);
  download(new Blob([data], { type: XLSX_MIME }), `${FILE_PREFIX}-${todayStamp()}.xlsx`);
  markBackedUp();
}

export async function importExcel(file) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx files are supported.");
  if (file.size > 2 * 1024 * 1024) throw new Error("That file is too large (max 2 MB).");
  const X = await loadLibrary();
  return readWorkbook(X, await file.arrayBuffer());
}
