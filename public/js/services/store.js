/**
 * store.js -- the app's memory. Saving and loading happens here.
 * ==============================================================
 * How it works (read this once, it is the heart of the "save" feature):
 *
 *   1. When the app starts, init() reads everything from IndexedDB into a normal
 *      JavaScript object called `state`. The screens read from `state` (fast, instant).
 *   2. Whenever something changes, update() changes `state` AND saves a copy into
 *      IndexedDB. Saving is asynchronous (takes a few milliseconds), so we save in the
 *      background and the header chip shows "Saved" when it is done.
 *   3. If you have the app open in two tabs, BroadcastChannel tells the other tab to
 *      reload its data, so the two tabs never overwrite each other.
 */
import { LEGACY_LOCALSTORAGE_KEY } from "../config.js";
import { emptyState, normalize } from "../models/schema.js";
import * as db from "./db.js";

let state = emptyState();
let meta = { lastBackup: null };       // small extras saved under the "meta" key
let storageWorks = true;
let writing = null;                    // the save in progress (a Promise), or null
let dirty = false;                     // true if something changed while we were saving
let channel = null;
const savedListeners = new Set();

export const initInfo = { migrated: false, recoveredCorrupt: false };

// ---------- loading ----------

/** Read the old localStorage save (from the previous version of this app), if there is one. */
function readLegacySave() {
  try {
    const old = globalThis.localStorage?.getItem(LEGACY_LOCALSTORAGE_KEY);
    return old ? normalize(JSON.parse(old)) : null;
  } catch { return null; }
}

/** Call once when the app starts. Always resolves (even if storage is blocked). */
export async function init() {
  try {
    const saved = await db.get("state");
    if (saved) {
      try {
        state = normalize(saved);
      } catch (error) {
        // The saved data is damaged. Keep a copy of it instead of throwing it away.
        console.warn("Saved data was damaged:", error);
        await db.put("corrupt-copy", saved).catch(() => {});
        state = emptyState();
        initInfo.recoveredCorrupt = true;
      }
    } else {
      const legacy = readLegacySave();       // first run: copy over data from the old localStorage version
      if (legacy && legacy.courses.length) { state = legacy; initInfo.migrated = true; save(); }
    }
    meta = { ...meta, ...((await db.get("meta")) || {}) };
    storageWorks = true;
  } catch (error) {
    console.warn("IndexedDB is not usable:", error);
    storageWorks = false;                    // the app still runs, but nothing can be saved
    state = emptyState();
  }
  openChannel();
  return state;
}

/** Re-read the data from IndexedDB (used when another tab changed it). */
async function reload() {
  try {
    const saved = await db.get("state");
    if (saved) state = normalize(saved);
  } catch (error) { console.warn("Could not reload:", error); }
}

// ---------- reading & writing ----------
export function getState() { return state; }

/** Save the current state. Many quick changes are merged into as few writes as possible. */
export function save() {
  dirty = true;
  if (!writing) writing = flush();
  return writing;
}

async function flush() {
  let result;
  try {
    while (dirty) {
      dirty = false;
      await db.put("state", structuredClone(state));   // copy, so later edits can't sneak in mid-write
    }
    storageWorks = true;
    result = { ok: true, at: new Date() };
  } catch (error) {
    dirty = false;
    storageWorks = false;
    result = { ok: false, error };
  }
  writing = null;                                      // done: the next save() may start a new write
  emitSaved(result);
  if (result.ok) channel?.postMessage("changed");
}

/** Resolves when every pending save has reached IndexedDB. */
export async function whenSaved() { while (writing) await writing; }

/** Change the state with a function, then save. Example: update(s => s.courses.push(...)) */
export function update(mutator) {
  mutator(state);
  save();
}

/** Replace everything (used by import and "delete all"). Throws if `next` isn't a valid save. */
export function replaceState(next) {
  state = normalize(next);
  save();
}

export function onSaved(fn) { savedListeners.add(fn); }
function emitSaved(info) { savedListeners.forEach((fn) => fn(info)); }
export function canSave() { return storageWorks; }

// ---------- other tabs ----------
function openChannel() {
  try { channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("ibsit-b-gwa-tracker") : null; }
  catch { channel = null; }
}

/** If another tab changes the data, reload it here and call `callback` so the screen redraws. */
export function watchOtherTabs(callback) {
  if (!channel) return;
  channel.onmessage = async () => { await whenSaved(); await reload(); callback(); };
}

// ---------- backup reminders ----------
export function markBackedUp() {
  meta.lastBackup = Date.now();
  db.put("meta", meta).catch(() => {});
}
export function lastBackupAt() { return meta.lastBackup || null; }

// ---------- ask the browser to keep our data ----------
/** Ask the browser not to delete our data when the device is low on space. */
export async function requestPersistence() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}
export async function isPersisted() {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : false; } catch { return false; }
}
