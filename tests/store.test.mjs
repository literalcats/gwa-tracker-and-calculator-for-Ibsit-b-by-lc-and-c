// Saving/loading logic, with IndexedDB replaced by a simple in-memory fake.
import test from "node:test";
import assert from "node:assert/strict";
import * as db from "../public/js/services/db.js";

globalThis.BroadcastChannel = undefined;       // no cross-tab channel in tests (it would keep Node running)

function fakeBackend({ failWrites = false } = {}) {
  const map = new Map();
  const log = [];
  return { map, log,
    async get(k) { return map.get(k); },
    async put(k, v) { if (failWrites) throw new Error("disk full"); await new Promise((r) => setTimeout(r, 5)); map.set(k, v); log.push(k); } };
}
let n = 0;
const freshStore = () => import(`../public/js/services/store.js?run=${++n}`);   // a brand-new copy of the module each time
function fakeLocalStorage(data) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k) => data[k] ?? null } });
}

test("empty database starts with an empty save", async () => {
  db.useBackend(fakeBackend()); fakeLocalStorage({});
  const store = await freshStore();
  await store.init();
  assert.equal(store.getState().courses.length, 0);
  assert.equal(store.canSave(), true);
});

test("update() saves to the database, and quick edits are merged into few writes", async () => {
  const backend = fakeBackend(); db.useBackend(backend); fakeLocalStorage({});
  const store = await freshStore(); await store.init();
  let events = 0; store.onSaved(() => events++);
  for (let i = 0; i < 6; i++) store.update((s) => s.courses.push({ id: "c" + i, name: "C" + i, code: "", units: 3, components: [] }));
  await store.whenSaved();
  assert.equal(backend.map.get("state").courses.length, 6);
  assert.ok(backend.log.filter((k) => k === "state").length <= 2, "writes were merged");
  assert.equal(events, 1);
});

test("data survives a restart (init reads what was saved)", async () => {
  const backend = fakeBackend(); db.useBackend(backend); fakeLocalStorage({});
  const a = await freshStore(); await a.init();
  a.update((s) => s.courses.push({ id: "x", name: "Saved course", code: "", units: 3, components: [] }));
  await a.whenSaved();
  const b = await freshStore(); await b.init();
  assert.equal(b.getState().courses[0].name, "Saved course");
});

test("old localStorage save is copied into IndexedDB once", async () => {
  const backend = fakeBackend(); db.useBackend(backend);
  fakeLocalStorage({ "blockb.gradeTracker.v1": JSON.stringify({ courses: [{ name: "Old course", units: 3, components: [] }] }) });
  const store = await freshStore(); await store.init(); await store.whenSaved();
  assert.equal(store.initInfo.migrated, true);
  assert.equal(backend.map.get("state").courses[0].name, "Old course");
});

test("damaged data is kept as a copy, not thrown away", async () => {
  const backend = fakeBackend(); backend.map.set("state", "garbage"); db.useBackend(backend); fakeLocalStorage({});
  const store = await freshStore(); await store.init();
  assert.equal(store.initInfo.recoveredCorrupt, true);
  assert.equal(backend.map.get("corrupt-copy"), "garbage");
});

test("a failing database reports 'not saved' instead of crashing", async () => {
  db.useBackend(fakeBackend({ failWrites: true })); fakeLocalStorage({});
  const store = await freshStore(); await store.init();
  let last; store.onSaved((i) => (last = i));
  store.update((s) => s.courses.push({ name: "X", units: 3, components: [] }));
  await store.whenSaved();
  assert.equal(last.ok, false);
  assert.equal(store.canSave(), false);
});

test("replaceState rejects junk", async () => {
  db.useBackend(fakeBackend()); fakeLocalStorage({});
  const store = await freshStore(); await store.init();
  assert.throws(() => store.replaceState("nope"), /not a Grade Tracker save/);
});
