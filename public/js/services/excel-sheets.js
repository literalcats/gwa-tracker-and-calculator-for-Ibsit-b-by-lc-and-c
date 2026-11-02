/**
 * excel-sheets.js -- turns grades into "rows" for Excel, and rows back into grades.
 * ================================================================================
 * (This replaces the old Python file excel.py.)
 *
 * This file only deals with plain arrays of rows ("array of arrays"), for example:
 *      [ ["Course", "Code", "Units"], ["IT 101", "", 3] ]
 * It does NOT create the .xlsx file itself. That is done by the Excel library
 * (see excel.js). Keeping the two jobs apart makes this part easy to test.
 *
 * The workbook has 3 sheets:
 *   "Summary"  -> for READING: each course's current %, grade and the GWA.
 *   "Data"     -> for RESTORING: one row per score. This is what Import reads back.
 *                 You may edit it in Excel too!
 *   "Settings" -> passing percent and the grade scale.
 * Because "Data" is a plain table, the exported file works as a "save file".
 */
import { courseStanding, gwa } from "./calc.js";
import { MAX_COURSES, text, toNum } from "../models/schema.js";

export const DATA_HEADERS = ["Course", "Code", "Units", "Component", "Weight %", "Item", "Score", "Max", "Percent"];
export const SUMMARY_HEADERS = ["Course", "Code", "Units", "Current %", "Grade", "Status", "Graded weight %"];
export const SETTINGS_HEADERS = ["Setting", "Value"];
export const MAX_IMPORT_ROWS = 5000;

const round2 = (n) => Math.round(n * 100) / 100;
const isBlank = (v) => v === null || v === undefined || v === "";

// ============================================================ EXPORT: state -> rows
export function buildSheets(state) {
  const { courses, settings } = state;

  // ---- Summary ----
  const summary = [SUMMARY_HEADERS];
  for (const course of courses) {
    const s = courseStanding(course, settings);
    const status = s.passed === null ? "No scores yet" : s.passed ? "Passing" : "Below passing";
    summary.push([
      course.name, course.code, course.units,
      s.percent === null ? null : round2(s.percent),
      s.grade, status, round2(s.gradedWeight),
    ]);
  }
  const overall = gwa(courses, settings);
  summary.push([]);
  summary.push(["GWA", null, null, null, overall === null ? null : Number(overall.toFixed(4))]);

  // ---- Data ----
  const data = [DATA_HEADERS];
  for (const course of courses) {
    const comps = course.components.length ? course.components : [{ name: "", weight: 0, items: [] }];
    for (const comp of comps) {
      const items = comp.items.length ? comp.items : [null];       // keep empty components in the file too
      for (const item of items) {
        const excelRow = data.length + 1;                          // Excel counts rows from 1
        data.push([
          course.name, course.code, course.units, comp.name, comp.weight,
          item ? item.name : null,
          item && item.score !== null ? item.score : null,
          item ? item.max : null,
          item ? percentCell(excelRow, item) : null,
        ]);
      }
    }
  }

  // ---- Settings ----
  const settingsRows = [
    SETTINGS_HEADERS,
    ["Passing percent", settings.passingPercent],
    ["Failing grade", settings.failGrade],
    ["Round percent", settings.roundPercent ? "yes" : "no"],
    [],
    ["Grade scale: from percent", "Grade"],
    ...settings.scale.map((r) => [r.min, r.grade]),
  ];

  return { summary, data, settings: settingsRows };
}

/** A live Excel formula so the % updates if you edit scores in Excel (cell-object format of the library). */
function percentCell(row, item) {
  const formula = `IF(AND(ISNUMBER(G${row}),ISNUMBER(H${row}),H${row}>0),G${row}/H${row},"")`;
  return item.score === null
    ? { t: "s", f: formula, v: "" }
    : { t: "n", f: formula, v: item.score / item.max, z: "0.0%" };
}

// ============================================================ IMPORT: rows -> state
/**
 * dataRows / settingsRows are arrays of rows (settingsRows may be missing).
 * Returns a plain save object. The caller should still run it through normalize().
 */
export function parseSheets(dataRows, settingsRows) {
  if (!dataRows) throw new Error('This workbook has no "Data" sheet. Use a file exported from this app.');

  const courses = new Map();
  const comps = new Map();

  dataRows.slice(1).forEach((row, index) => {                      // slice(1) skips the header row
    if (index + 2 > MAX_IMPORT_ROWS) throw new Error(`Too many rows (limit ${MAX_IMPORT_ROWS}).`);
    const [courseName, code, units, compName, weight, itemName, score, max] = row;
    if (!text(courseName)) return;                                 // blank line

    const courseKey = `${text(courseName).toLowerCase()}|${text(code, "", 30).toLowerCase()}`;
    if (!courses.has(courseKey)) {
      if (courses.size >= MAX_COURSES) throw new Error(`Too many courses (limit ${MAX_COURSES}).`);
      courses.set(courseKey, { name: text(courseName), code: text(code, "", 30), units: toNum(units, 3), components: [] });
    }
    const course = courses.get(courseKey);

    if (text(compName)) {
      const compKey = `${courseKey}|${text(compName).toLowerCase()}`;
      if (!comps.has(compKey)) {
        const comp = { name: text(compName), weight: toNum(weight, 0), items: [] };
        comps.set(compKey, comp);
        course.components.push(comp);
      }
      const comp = comps.get(compKey);
      if (text(itemName) || !isBlank(score)) {
        comp.items.push({ name: text(itemName, `Item ${comp.items.length + 1}`), score: toNum(score), max: toNum(max, 100) });
      }
    }
  });

  if (!courses.size) throw new Error("No courses were found in the Data sheet.");

  const settings = {};
  if (settingsRows) {
    const scale = [];
    let inScale = false;
    for (const [a, b] of settingsRows) {
      const label = text(a).toLowerCase();
      if (label.startsWith("grade scale")) inScale = true;
      else if (inScale) {
        const min = toNum(a), grade = toNum(b);
        if (min !== null && grade !== null) scale.push({ min, grade });
      }
      else if (label === "passing percent") settings.passingPercent = toNum(b, 75);
      else if (label === "failing grade") settings.failGrade = toNum(b, 5);
      else if (label === "round percent") settings.roundPercent = !["no", "false", "0"].includes(text(b).toLowerCase());
    }
    if (scale.length) settings.scale = scale;
  }
  return { version: 1, settings, courses: [...courses.values()] };
}
