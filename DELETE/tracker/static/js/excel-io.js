/**
 * excel-io.js -- backups: Excel (.xlsx) and JSON files.
 *
 * Excel export/import is done by the Flask server (tracker/excel.py), so we `fetch` it.
 * The server does NOT keep your data: it converts it and sends the result straight back.
 * JSON backup works fully offline because it never talks to the server.
 */
import { markBackedUp } from "./store.js";
import { todayStamp } from "./ui/format.js";

const body = document.body.dataset;

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportExcel(state) {
  let response;
  try {
    response = await fetch(body.exportUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    throw new Error("Excel export needs an internet connection. Use the JSON backup while offline.");
  }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Export failed.");
  download(await response.blob(), `grade-tracker-save-${todayStamp()}.xlsx`);
  markBackedUp();
}

export async function importExcel(file) {
  const form = new FormData();
  form.append("file", file);
  let response;
  try {
    response = await fetch(body.importUrl, { method: "POST", body: form });
  } catch {
    throw new Error("Excel import needs an internet connection. Use a JSON backup while offline.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Import failed.");
  return data; // a plain save object; store.normalize() cleans it before use
}

export function exportJson(state) {
  download(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `grade-tracker-save-${todayStamp()}.json`);
  markBackedUp();
}

export async function importJson(file) {
  try { return JSON.parse(await file.text()); }
  catch { throw new Error("That file is not valid JSON."); }
}

/** Open the hidden file picker and resolve with the chosen file (or null). */
export function pickFile(inputId) {
  return new Promise((resolve) => {
    const input = document.getElementById(inputId);
    input.value = "";
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}
