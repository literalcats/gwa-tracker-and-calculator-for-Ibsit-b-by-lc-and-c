/**
 * backup.js -- downloading files and the JSON backup (works fully offline).
 * The Excel backup is in excel.js.
 */
import { FILE_PREFIX } from "../config.js";
import { markBackedUp } from "./store.js";

export function todayStamp() { return new Date().toISOString().slice(0, 10); }

/** Save a Blob to the user's device by clicking an invisible download link. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportJson(state) {
  download(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `${FILE_PREFIX}-${todayStamp()}.json`);
  markBackedUp();
}

/** Read a .json backup file. (The caller cleans it with normalize() before using it.) */
export async function importJson(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error("That file is too large (max 2 MB).");
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
