/**
 * store.js -- saving and loading. THIS is where "local web storage" is used.
 *
 * localStorage is a small key/value box that lives INSIDE the user's browser.
 *   - It survives closing the tab and restarting the phone/computer.
 *   - It stays on THIS device and THIS browser only. We never send it to a server.
 *   - It is erased if the user clears site data (or uses a private window).
 * That last point is why the app also offers Excel / JSON backups (see excel-io.js).
 *
 * The whole app state is ONE object, saved as JSON text under one key:
 *   { version, settings: {...}, courses: [ { id, name, code, units, components: [ {id, name, weight, items: [...] } ] } ] }
 */

const KEY = "blockb.gradeTracker.v1";
const BACKUP_KEY = "blockb.lastBackup";

export const DEFAULT_SCALE = [
  { min: 97, grade: 1.0 }, { min: 94, grade: 1.25 }, { min: 91, grade: 1.5 },
  { min: 88, grade: 1.75 }, { min: 85, grade: 2.0 }, { min: 82, grade: 2.25 },
  { min: 79, grade: 2.5 }, { min: 76, grade: 2.75 }, { min: 75, grade: 3.0 },
];

export const SCALE_PRESETS = {
  ph: { label: "Philippines 1.00 – 5.00", failGrade: 5, passingPercent: 75, scale: DEFAULT_SCALE },
  gpa: {
    label: "US 4.0 GPA", failGrade: 0, passingPercent: 60,
    scale: [
      { min: 93, grade: 4.0 }, { min: 90, grade: 3.7 }, { min: 87, grade: 3.3 }, { min: 83, grade: 3.0 },
      { min: 80, grade: 2.7 }, { min: 77, grade: 2.3 }, { min: 73, grade: 2.0 }, { min: 70, grade: 1.7 },
      { min: 67, grade: 1.3 }, { min: 63, grade: 1.0 }, { min: 60, grade: 0.7 },
    ],
  },
};

let state = null;
let storageWorks = true;
const saveListeners = new Set();

// ---------- helpers ----------
export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, "").slice(0, 10);
}

const toNum = (v, fallback = null) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
};
const text = (v, fallback = "", max = 80) => (v == null ? fallback : String(v).trim().slice(0, max) || fallback);

export function emptyState() {
  return {
    version: 1,
    settings: { passingPercent: 75, failGrade: 5, roundPercent: true, scale: structuredClone(DEFAULT_SCALE) },
    courses: [],
  };
}

/**
 * Take ANY object (from storage, a JSON backup, or the server) and return a clean, safe state.
 * Throws if it doesn't look like a save at all.
 */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.courses || [])) {
    throw new Error("That file is not a Grade Tracker save.");
  }
  const base = emptyState();
  const s = raw.settings || {};
  const scale = (Array.isArray(s.scale) ? s.scale : [])
    .map((r) => ({ min: toNum(r?.min), grade: toNum(r?.grade) }))
    .filter((r) => r.min !== null && r.grade !== null)
    .map((r) => ({ min: Math.min(100, Math.max(0, r.min)), grade: r.grade }))
    .sort((a, b) => b.min - a.min);
  base.settings = {
    passingPercent: toNum(s.passingPercent, 75),
    failGrade: toNum(s.failGrade, 5),
    roundPercent: s.roundPercent !== false,
    scale: scale.length ? scale : base.settings.scale,
  };
  base.courses = (raw.courses || []).filter((c) => c && typeof c === "object").map((c) => ({
    id: text(c.id, uid(), 40),
    name: text(c.name, "Untitled course"),
    code: text(c.code, "", 30),
    units: Math.max(0, toNum(c.units, 3)),
    components: (Array.isArray(c.components) ? c.components : []).filter(Boolean).map((k) => ({
      id: text(k.id, uid(), 40),
      name: text(k.name, "Component"),
      weight: Math.min(100, Math.max(0, toNum(k.weight, 0))),
      items: (Array.isArray(k.items) ? k.items : []).filter(Boolean).map((i) => ({
        id: text(i.id, uid(), 40),
        name: text(i.name, "Item"),
        score: toNum(i.score) === null ? null : Math.max(0, toNum(i.score)),
        max: Math.max(0.0001, toNum(i.max, 100)),
      })),
    })),
  }));
  return base;
}

// ---------- reading & writing localStorage ----------
export function load() {
  let saved = null;
  try {
    saved = localStorage.getItem(KEY);
    state = saved ? normalize(JSON.parse(saved)) : emptyState();
  } catch (error) {
    // Corrupt data or storage blocked: start fresh, but keep a copy of the bad text
    // under another key so nothing is lost for good.
    console.warn("Could not load saved data:", error);
    state = emptyState();
    storageWorks = storageProbe();
    try { if (saved) localStorage.setItem(KEY + ".corrupt-copy", saved); } catch { /* ignore */ }
  }
  return state;
}

function storageProbe() {
  try { localStorage.setItem("blockb.probe", "1"); localStorage.removeItem("blockb.probe"); return true; }
  catch { return false; }
}

export function getState() { return state; }

/** Save the current state to localStorage and tell the header chip about it. */
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageWorks = true;
    emitSaved({ ok: true, at: new Date() });
  } catch (error) {
    storageWorks = false;
    emitSaved({ ok: false, error });
  }
}

/** Change the state with a function, then save. Example: update(s => s.courses.push(...)) */
export function update(mutator) {
  mutator(state);
  save();
}

export function replaceState(next) {
  state = normalize(next);
  save();
}

export function onSaved(fn) { saveListeners.add(fn); }
function emitSaved(info) { saveListeners.forEach((fn) => fn(info)); }
export function canSave() { return storageWorks; }

/** If another tab changes the data, reload it here so the two tabs never overwrite each other. */
export function watchOtherTabs(callback) {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) { load(); callback(); }
  });
}

// ---------- backup reminders ----------
export function markBackedUp() { try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch { /* ignore */ } }
export function lastBackupAt() {
  try { const v = Number(localStorage.getItem(BACKUP_KEY)); return v || null; } catch { return null; }
}

/** Ask the browser not to delete our data when the device is low on space. */
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
export async function isPersisted() {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : false; } catch { return false; }
}
