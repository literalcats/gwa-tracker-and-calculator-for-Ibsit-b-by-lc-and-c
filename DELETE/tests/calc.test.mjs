// Front-end math tests. Run with:  node tests/calc.test.mjs
import assert from "node:assert/strict";
import { componentStats, courseStanding, gradeFromPercent, gwa, whatIf, effectiveTarget } from "../tracker/static/js/calc.js";

const settings = { passingPercent: 75, failGrade: 5, roundPercent: true, scale: [{ min: 90, grade: 1 }, { min: 75, grade: 3 }] };
const course = {
  units: 3,
  components: [
    { id: "q", name: "Quizzes", weight: 40, items: [{ score: 8, max: 10 }, { score: null, max: 10 }] },
    { id: "f", name: "Final", weight: 60, items: [] },
  ],
};

assert.equal(componentStats(course.components[0]).pct, 80);
const s = courseStanding(course, settings);
assert.equal(s.percent, 80); assert.equal(s.grade, 3); assert.equal(s.passed, true);
assert.equal(gradeFromPercent(74.4, settings), 5);
assert.equal(gradeFromPercent(74.5, settings), 3);
assert.equal(gwa([course], settings), 3);

// What-if: Quizzes secure 0.4*80 = 32 pts. To reach 75 overall the final must give 43 of its 60 pts => 71.67%.
const r = whatIf(course, settings, { compId: "f", target: 75, newMax: 100 });
assert.equal(r.status, "needed");
assert.ok(Math.abs(r.needed - 71.67) < 0.011, `needed ${r.needed}`);
// Using the rounding-aware target (74.5) is slightly easier.
assert.ok(whatIf(course, settings, { compId: "f", target: effectiveTarget(75, settings), newMax: 100 }).needed < r.needed);
assert.equal(whatIf(course, settings, { compId: "f", target: 95, newMax: 100 }).status, "impossible");   // max possible = 32+60 = 92
assert.equal(whatIf(course, settings, { compId: "f", target: 30, newMax: 100 }).status, "secured");      // 32 already >= 30
// A component that already has scores: quizzes (8/10 so far) + a new 10-pt quiz.
const q = whatIf(course, settings, { compId: "q", target: 80, newMax: 10, assumeOther: 100 });
assert.equal(q.status, "needed");   // secured from Final(assumed 100)=60; need 20 more from 40% quizzes => avg 50% => (0.5*20)-8=2
assert.equal(q.needed, 2);
console.log("calc tests passed");
