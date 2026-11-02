// Checks the service worker's file list (CORE in public/sw.js) against the files that really exist.
//
// Why: if CORE names a file that is missing, the browser refuses to install the worker and offline
// mode silently stops working. If a new .js file is NOT listed, it still works online but may be
// missing when the app is opened offline for the first time. Both mistakes are easy to make when
// adding a file, so this test catches them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = new URL("../public/", import.meta.url).pathname;

/** Read the CORE array out of sw.js (the quoted names between `const CORE = [` and `];`). */
function readCore() {
  const source = readFileSync(join(PUBLIC, "sw.js"), "utf8");
  const block = source.match(/const CORE = \[([\s\S]*?)\];/);
  assert.ok(block, "could not find `const CORE = [...]` in sw.js");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** Every file under a folder, as paths relative to public/. */
function filesUnder(folder) {
  return readdirSync(join(PUBLIC, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`;
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

test("every file listed in CORE exists", () => {
  const missing = readCore().filter((f) => f !== "./" && !existsSync(join(PUBLIC, f)));
  assert.deepEqual(missing, [], `listed in sw.js but not on disk: ${missing.join(", ")}`);
});

test("every JavaScript and CSS file is listed in CORE", () => {
  const core = new Set(readCore());
  const files = [...filesUnder("js"), ...filesUnder("css")];
  const unlisted = files.filter((f) => !core.has(f));
  assert.deepEqual(unlisted, [], `on disk but missing from CORE in sw.js: ${unlisted.join(", ")}`);
});

test("CORE has no duplicates", () => {
  const core = readCore();
  assert.equal(new Set(core).size, core.length);
});
