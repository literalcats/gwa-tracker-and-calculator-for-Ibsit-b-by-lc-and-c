// Grade math tests. Run all tests with:  npm test   (or: node --test tests/)
import test from "node:test";
import assert from "node:assert/strict";
import { componentStats, courseStanding, gradeFromPercent, gwa, whatIf, effectiveTarget } from "../public/js/services/calc.js";

const settings = { passingPercent: 75, failGrade: 5, roundPercent: true, scale: [{ min: 90, grade: 1 }, { min: 75, grade: 3 }] };
const course = () => ({
  units: 3,
  components: [
    { id: "q", name: "Quizzes", weight: 40, items: [{ score: 8, max: 10 }, { score: null, max: 10 }] },
    { id: "f", name: "Final", weight: 60, items: [] },
  ],
});

test("component average ignores items with no score", () => {
  assert.equal(componentStats(course().components[0]).pct, 80);
});

test("course standing uses only graded components", () => {
  const s = courseStanding(course(), settings);
  assert.equal(s.percent, 80); assert.equal(s.grade, 3); assert.equal(s.passed, true);
});

test("grade lookup rounds to a whole percent first", () => {
  assert.equal(gradeFromPercent(74.4, settings), 5);
  assert.equal(gradeFromPercent(74.5, settings), 3);
});

test("GWA is weighted by units", () => {
  assert.equal(gwa([course()], settings), 3);
});

test("what-if: score needed on the final", () => {
  // Quizzes secure 0.4*80 = 32 points. To reach 75 the final must give 43 of its 60 points => 71.67%.
  const r = whatIf(course(), settings, { compId: "f", target: 75, newMax: 100 });
  assert.equal(r.status, "needed");
  assert.ok(Math.abs(r.needed - 71.67) < 0.011);
  assert.ok(whatIf(course(), settings, { compId: "f", target: effectiveTarget(75, settings), newMax: 100 }).needed < r.needed);
});

test("what-if: unreachable and already-secured targets", () => {
  assert.equal(whatIf(course(), settings, { compId: "f", target: 95, newMax: 100 }).status, "impossible");
  assert.equal(whatIf(course(), settings, { compId: "f", target: 30, newMax: 100 }).status, "secured");
});

test("what-if: a component that already has scores", () => {
  const q = whatIf(course(), settings, { compId: "q", target: 80, newMax: 10, assumeOther: 100 });
  assert.equal(q.status, "needed");
  assert.equal(q.needed, 2);
});

test("rounding rule: with rounding on, a target is reached half a percent early (used by scale rows AND custom targets)", () => {
  assert.equal(effectiveTarget(90, settings), 89.5);
  assert.equal(effectiveTarget(90, { ...settings, roundPercent: false }), 90);
  // The same course needs a smaller final score when the rounding-adjusted target is used.
  const withRounding = whatIf(course(), settings, { compId: "f", target: effectiveTarget(85, settings), newMax: 100 }).needed;
  const withoutRounding = whatIf(course(), settings, { compId: "f", target: 85, newMax: 100 }).needed;
  assert.ok(withRounding < withoutRounding);
});
