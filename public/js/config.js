/**
 * config.js -- names and keys used in many places. Change them here, once.
 */
export const APP_NAME = "I-BSIT-B GWA Calculator and Grade Tracker (By Carl Ianne)";
export const APP_SHORT_NAME = "I-BSIT-B GWA";

// Used in downloaded file names, e.g. ibsit-b-gwa-tracker-save-2026-11-01.xlsx
export const FILE_PREFIX = "ibsit-b-gwa-tracker-save";

// Browser storage names (IndexedDB database + the one tiny localStorage setting for the theme).
export const DB_NAME = "ibsit-b-gwa-tracker";
export const THEME_KEY = "ibsitb.theme";

// The old version of this app saved to localStorage under this key. We copy it over once.
export const LEGACY_LOCALSTORAGE_KEY = "blockb.gradeTracker.v1";

// Where the Excel library file must be (see vendor/README.txt). Relative to index.html.
export const XLSX_LIBRARY_PATH = "vendor/xlsx.full.min.js";
