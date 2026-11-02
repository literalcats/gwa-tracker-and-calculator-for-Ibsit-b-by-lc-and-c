/**
 * calc.js -- ALL the grade math. Pure functions: numbers in, numbers out.
 * (No screen code in here, which makes it easy to test and to understand.)
 *
 * Words used:
 *   component = a category like "Quizzes" that is worth some % of the course
 *   weight    = how many % of the whole course a component is worth
 *
 * Rules (the Python copy in tracker/grading.py follows the exact same rules):
 *   1. A component's average = total score / total max score (items with no score are skipped).
 *   2. Current course % = weighted average of the components that already have scores.
 *   3. Grade equivalent = look the % up in the grade scale from Settings.
 *   4. GWA = sum(grade * units) / sum(units).
 */

/** Average of one component. Returns { score, max, pct } where pct is null if nothing is graded. */
export function componentStats(component) {
  let score = 0, max = 0;
  for (const item of component.items) {
    if (item.score !== null && item.score !== undefined && item.max > 0) {
      score += item.score;
      max += item.max;
    }
  }
  return { score, max, pct: max > 0 ? (score / max) * 100 : null };
}

/** The % that is used for looking up grades (rounded if the setting says so). */
export function lookupValue(percent, settings) {
  return settings.roundPercent ? Math.round(percent + 1e-9) : percent;
}

export function gradeFromPercent(percent, settings) {
  const value = lookupValue(percent, settings);
  const rows = [...settings.scale].sort((a, b) => b.min - a.min);
  for (const row of rows) if (value >= row.min) return row.grade;
  return settings.failGrade;
}

/** Where does a course stand right now? */
export function courseStanding(course, settings) {
  const totalWeight = course.components.reduce((sum, c) => sum + c.weight, 0);
  let gradedWeight = 0, earned = 0;
  for (const comp of course.components) {
    const { pct } = componentStats(comp);
    if (pct !== null) {
      gradedWeight += comp.weight;
      earned += (comp.weight * pct) / 100;
    }
  }
  const percent = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
  return {
    percent,
    grade: percent === null ? null : gradeFromPercent(percent, settings),
    passed: percent === null ? null : lookupValue(percent, settings) >= settings.passingPercent,
    totalWeight, gradedWeight, earned,
  };
}

export function gwa(courses, settings) {
  let points = 0, units = 0;
  for (const course of courses) {
    const s = courseStanding(course, settings);
    if (s.grade !== null && course.units > 0) { points += s.grade * course.units; units += course.units; }
  }
  return units > 0 ? points / units : null;
}

export function averagePercent(courses, settings) {
  const list = courses.map((c) => courseStanding(c, settings).percent).filter((p) => p !== null);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

/**
 * The overall % you must reach to "earn" a threshold.
 * With rounding ON, 85 is reached at 84.5 (because 84.5 rounds up to 85).
 */
export function effectiveTarget(minPercent, settings) {
  return settings.roundPercent ? minPercent - 0.5 : minPercent;
}

/**
 * WHAT-IF: what score do I need on an upcoming item to reach `target` (course %)?
 *
 * options = {
 *   compId:      which component the upcoming item belongs to (e.g. "Final Exam"),
 *   target:      the course % you want to finish with,
 *   newMax:      the max points of the upcoming item (e.g. 100),
 *   assumeOther: % to assume for OTHER components that have no scores yet (default 0)
 * }
 *
 * The idea, step by step:
 *   a) Each component's share of the course = weight / total weight  (so it works even if weights don't add to 100).
 *   b) Points already secured from the OTHER components = share * their current average.
 *   c) Whatever is still missing must come from the chosen component.
 *   d) Convert "missing" into a score on the upcoming item, counting the scores already in that component.
 */
export function whatIf(course, settings, { compId, target, newMax = 100, assumeOther = 0 }) {
  const total = course.components.reduce((sum, c) => sum + c.weight, 0);
  const comp = course.components.find((c) => c.id === compId);
  if (!comp || total <= 0) return { status: "noweights" };
  const share = (comp.weight / total) * 100;       // this component's % of the course
  if (share <= 0) return { status: "noweight" };

  let secured = 0;                                    // course-% points secured outside this component
  const assumed = [];                                 // components counted with an assumed average
  for (const other of course.components) {
    if (other.id === comp.id) continue;
    const otherShare = (other.weight / total) * 100;
    let avg = componentStats(other).pct;
    if (avg === null) { if (otherShare > 0) assumed.push(other.name); avg = assumeOther; }
    secured += (otherShare * avg) / 100;
  }

  const have = componentStats(comp);                  // scores already inside this component
  const needAvg = ((target - secured) / share) * 100; // average this component must reach
  const needed = (needAvg / 100) * (have.max + newMax) - have.score;
  const best = secured + (share * (have.score + newMax)) / (have.max + newMax);
  const worst = secured + (share * have.score) / (have.max + newMax);

  let status = "needed";
  if (needed <= 1e-9) status = "secured";
  else if (needed > newMax + 1e-9) status = "impossible";

  return {
    status,
    needed: Math.ceil(needed * 100 - 1e-9) / 100,    // round UP to 2 decimals so you never fall short
    neededPct: (needed / newMax) * 100,
    best, worst, assumed, target, newMax,
  };
}
