/**
 * db.js -- a tiny wrapper around IndexedDB.
 * =========================================
 * IndexedDB is a small database that lives INSIDE the user's browser.
 *   - It survives closing the tab and restarting the phone/computer.
 *   - It stays on THIS device and THIS browser only. We never send it to a server.
 *   - It is erased if the user clears site data (or uses a private window).
 * (That last point is why the app also offers Excel / JSON backups.)
 *
 * IndexedDB's raw API is clunky (lots of callbacks), so this file hides it behind
 * two easy functions:
 *      await get("state")            -> read a value
 *      await put("state", someObject) -> save a value
 * We keep one "table" (object store) called "kv", which means key -> value.
 * Keys we use: "state" (all courses + settings), "meta" (small extras like last backup time).
 */
import { DB_NAME } from "../config.js";

const STORE = "kv";
let opening = null;

function openDatabase() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error("IndexedDB is not available in this browser."));
      const request = indexedDB.open(DB_NAME, 1);
      // Runs only the first time (or when the version number goes up): create our "table".
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    opening.catch(() => { opening = null; });   // allow a retry later if opening failed
  }
  return opening;
}

const realBackend = {
  async get(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async put(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};

let backend = realBackend;

export const get = (key) => backend.get(key);
export const put = (key, value) => backend.put(key, value);

/** Used by the automated tests to swap IndexedDB for a simple in-memory fake. */
export function useBackend(fake) { backend = fake || realBackend; }
