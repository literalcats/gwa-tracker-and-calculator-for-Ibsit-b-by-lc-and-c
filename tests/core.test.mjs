// Data cleaning + Excel rows + Excel library glue. (The real SheetJS library is replaced by a tiny fake here.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalize, emptyState, MAX_COURSES } from "../public/js/models/schema.js";
import { buildSheets, parseSheets } from "../public/js/services/excel-sheets.js";
import { writeWorkbook, readWorkbook } from "../public/js/services/excel.js";

const SAMPLE = {
  settings: { passingPercent: 75, failGrade: 5, roundPercent: true, scale: [{ min: 90, grade: 1 }, { min: 75, grade: 3 }] },
  courses: [
    { name: "Intro =cmd()", code: "IT 101", units: 3, components: [
      { name: "Quizzes", weight: 40, items: [{ name: "Q1", score: 8, max: 10 }, { name: "Q2", score: null, max: 10 }] },
      { name: "Final", weight: 60, items: [] },
    ] },
    { name: "Empty course", units: 2, components: [] },
  ],
};
const strip = (state) => JSON.parse(JSON.stringify(state, (k, v) => (k === "id" ? undefined : v)));

test("normalize cleans messy input", () => {
  const s = normalize({ courses: [{ name: "  Math  ", units: "3", components: [{ name: "Q", weight: 150, items: [{ score: "-4", max: "0" }] }] }] });
  assert.equal(s.courses[0].name, "Math");
  assert.equal(s.courses[0].units, 3);
  assert.equal(s.courses[0].components[0].weight, 100);          // squeezed to 100
  assert.equal(s.courses[0].components[0].items[0].score, 0);    // negative scores become 0
  assert.ok(s.courses[0].components[0].items[0].max > 0);        // max must be above 0
  assert.deepEqual(s.settings.scale.length, 9);                  // default scale filled in
});

test("normalize rejects things that are not saves, and caps huge input", () => {
  assert.throws(() => normalize(null), /not a Grade Tracker save/);
  assert.throws(() => normalize([1, 2]), /not a Grade Tracker save/);
  assert.throws(() => normalize({ courses: "nope" }), /not a Grade Tracker save/);
  const many = { courses: Array.from({ length: MAX_COURSES + 20 }, (_, i) => ({ name: `C${i}` })) };
  assert.equal(normalize(many).courses.length, MAX_COURSES);
});

test("Excel rows round-trip", () => {
  const sheets = buildSheets(normalize(SAMPLE));
  const back = normalize(parseSheets(sheets.data, sheets.settings));
  assert.deepEqual(strip(back), strip(normalize(SAMPLE)));
  assert.equal(sheets.summary.at(-1)[0], "GWA");
});

test("text starting with = stays text in the rows (never a formula object)", () => {
  const cell = buildSheets(normalize(SAMPLE)).data[1][0];
  assert.equal(cell, "Intro =cmd()");
  assert.equal(typeof cell, "string");
});

test("old Flask-version Excel exports still import", () => {
  const fx = JSON.parse(readFileSync(new URL("./fixtures/legacy-flask-export.json", import.meta.url)));
  const s = normalize(parseSheets(fx.data, fx.settings));
  assert.equal(s.courses.length, 2);
  assert.deepEqual(s.courses[0].components[0].items.map((i) => [i.score, i.max]), [[8, 10], [null, 10]]);
  assert.equal(s.courses[0].components[1].weight, 60);
  assert.deepEqual(s.settings.scale, [{ min: 90, grade: 1 }, { min: 75, grade: 3 }]);
});

test("import errors are friendly", () => {
  assert.throws(() => parseSheets(null), /no "Data" sheet/);
  assert.throws(() => parseSheets([["Course"]], null), /No courses were found/);
});

// ---- a tiny pretend SheetJS, just enough to test OUR glue code ----
const fakeX = {
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (rows) => ({ rows }),
    book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
    sheet_to_json: (ws) => ws.rows
      .map((r) => r.map((c) => (c && typeof c === "object" ? (c.v === "" ? null : c.v) : c)))
      .filter((r) => r.some((c) => c !== null && c !== undefined && c !== "")),
  },
  write: (wb) => new TextEncoder().encode(JSON.stringify(wb)).buffer,
  read: (buf) => JSON.parse(new TextDecoder().decode(buf)),
};

test("writeWorkbook -> readWorkbook round trip (with fake library)", () => {
  const bytes = writeWorkbook(fakeX, normalize(SAMPLE));
  const back = readWorkbook(fakeX, bytes);
  assert.deepEqual(strip(back), strip(normalize(SAMPLE)));
});

test("readWorkbook reports an unreadable file", () => {
  assert.throws(() => readWorkbook(fakeX, new TextEncoder().encode("not excel").buffer), /could not be read/);
});
