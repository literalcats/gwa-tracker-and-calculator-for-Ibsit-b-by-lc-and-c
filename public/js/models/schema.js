/**
 * schema.js -- The "shape" of our data, plus the functions that CLEAN it.
 * =====================================================================
 * (This replaces the old Python file models.py.)
 *
 * Every student's grades are saved in THEIR OWN browser (IndexedDB), so there is
 * no database on a server. These functions describe the data and make sure that
 * anything coming in from outside (a backup file, an Excel file, old saved data)
 * is safe before the app uses it. Never trust data you did not create!
 *
 * Vocabulary used everywhere in this project:
 *   Course     -> a subject, e.g. "IT 101 - Intro to Computing" (has units)
 *   Component  -> a graded category of a course, e.g. "Quizzes" worth 20%
 *   Item       -> one single score inside a component, e.g. "Quiz 1: 8 / 10"
 *   Settings   -> passing percentage + the grade scale (percent -> 1.00, 1.25, ...)
 *
 * The whole app state is ONE object:
 *   { version, settings: {...}, courses: [ { id, name, code, units, components: [ { id, name, weight, items: [...] } ] } ] }
 */

// Limits keep a bad or huge file from freezing the app.
export const MAX_COURSES = 60;
export const MAX_COMPONENTS_PER_COURSE = 20;
export const MAX_ITEMS_PER_COMPONENT = 200;
export const MAX_SCALE_ROWS = 40;

/** Default grade scale (Philippine style: 1.00 best, 5.00 failing). Editable in Settings. */
export const DEFAULT_SCALE = [
  { min: 97, grade: 1.0 }, { min: 94, grade: 1.25 }, { min: 91, grade: 1.5 },
  { min: 88, grade: 1.75 }, { min: 85, grade: 2.0 }, { min: 82, grade: 2.25 },
  { min: 79, grade: 2.5 }, { min: 76, grade: 2.75 }, { min: 75, grade: 3.0 },
];

// ---------- small "cleaner" helpers ----------

/** Make a short random id such as "a3f9c01b2e". Used to tell items apart. */
export function uid() {
  const raw = globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
  return raw.replace(/-/g, "").slice(0, 10);
}

/** Anything -> a real number, or `fallback` if it is not one. ("12,5" and " 7 " are accepted too.) */
export function toNum(value, fallback = null) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return fallback;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Anything -> a trimmed string no longer than `max` characters (or `fallback` if empty). */
export function text(value, fallback = "", max = 80) {
  if (value === null || value === undefined) return fallback;
  return String(value).trim().slice(0, max) || fallback;
}

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/** A brand-new, empty save. */
export function emptyState() {
  return {
    version: 1,
    settings: { passingPercent: 75, failGrade: 5, roundPercent: true, scale: structuredClone(DEFAULT_SCALE) },
    courses: [],
  };
}

/**
 * Take ANY object (from IndexedDB, a JSON backup, or an Excel file) and return a clean, safe state.
 * Throws an Error with a friendly message if it doesn't look like a save at all.
 */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || (raw.courses !== undefined && !Array.isArray(raw.courses))) {
    throw new Error("That file is not a Grade Tracker save.");
  }
  const base = emptyState();
  const s = raw.settings || {};

  const scale = (Array.isArray(s.scale) ? s.scale : [])
    .map((r) => ({ min: toNum(r?.min), grade: toNum(r?.grade) }))
    .filter((r) => r.min !== null && r.grade !== null)
    .map((r) => ({ min: clamp(r.min, 0, 100), grade: r.grade }))
    .sort((a, b) => b.min - a.min)
    .slice(0, MAX_SCALE_ROWS);

  base.settings = {
    passingPercent: clamp(toNum(s.passingPercent, 75), 0, 100),
    failGrade: toNum(s.failGrade, 5),
    roundPercent: s.roundPercent !== false,
    scale: scale.length ? scale : base.settings.scale,
  };

  base.courses = (raw.courses || []).filter((c) => c && typeof c === "object").slice(0, MAX_COURSES).map((c) => ({
    id: text(c.id, uid(), 40),
    name: text(c.name, "Untitled course"),
    code: text(c.code, "", 30),
    units: clamp(toNum(c.units, 3), 0, 30),
    components: (Array.isArray(c.components) ? c.components : []).filter(Boolean).slice(0, MAX_COMPONENTS_PER_COURSE).map((k) => ({
      id: text(k.id, uid(), 40),
      name: text(k.name, "Component"),
      weight: clamp(toNum(k.weight, 0), 0, 100),
      items: (Array.isArray(k.items) ? k.items : []).filter(Boolean).slice(0, MAX_ITEMS_PER_COMPONENT).map((i) => ({
        id: text(i.id, uid(), 40),
        name: text(i.name, "Item"),
        score: toNum(i.score) === null ? null : Math.max(0, toNum(i.score)),
        max: Math.max(0.0001, toNum(i.max, 100)),
      })),
    })),
  }));
  return base;
}
