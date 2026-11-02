/**
 * what-if-card.js -- the "What score do I need?" card on a course page.
 *
 * The student picks a target (just pass / a grade / a custom %), picks which upcoming component
 * the score will go into (e.g. the Final Exam) and how many points it is worth. The actual
 * math is in calc.js (whatIf); this file only draws the card and reads the student's choices.
 *
 * How course.js uses it:
 *     const whatIf = createWhatIfCard({ course, settings, box });
 *     whatIf.draw();        // call again whenever the course changes
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { componentStats, whatIf, effectiveTarget } from "../services/calc.js";
import { num, pct, grade } from "../ui/format.js";

// The student's choices are remembered per course while the app is open (not saved to storage).
const choicesByCourse = {};

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const NOTE_STYLE = "margin:6px 0 0";

export function createWhatIfCard({ course, settings, box }) {
  const choice = (choicesByCourse[course.id] ??= { target: "pass", custom: 90, compId: null, newMax: 100, assume: 0 });

  // ---------- small helpers ----------

  /** Components that can receive the upcoming score (weight above 0). */
  const usableComponents = () => course.components.filter((c) => c.weight > 0);

  /** Prefer a "Final" component, then any "Exam", otherwise the last one. */
  function defaultComponentId() {
    const usable = usableComponents();
    const best = usable.find((c) => /final/i.test(c.name)) || usable.find((c) => /exam/i.test(c.name)) || usable[usable.length - 1];
    return best?.id || null;
  }

  /**
   * Every target the student can pick:
   *   value = the course % the math must reach (already adjusted for "rounds to whole %")
   *   shown = the number the student recognises (75, not 74.5)
   */
  function targetOptions() {
    const list = [{
      key: "pass", label: `Just pass (${num(settings.passingPercent)}%)`,
      value: effectiveTarget(settings.passingPercent, settings), shown: settings.passingPercent,
    }];
    for (const row of settings.scale) {
      list.push({
        key: `g${row.min}`, label: `Grade ${grade(row.grade)} (${num(row.min)}% and up)`,
        value: effectiveTarget(row.min, settings), shown: row.min,
      });
    }
    return list;
  }

  // ---------- drawing ----------
  function draw() {
    const usable = usableComponents();
    if (!usable.length) {
      mount(box,
        h("h2", { class: "card__title" }, icon("target"), "What score do I need?"),
        h("p", { class: "muted" }, "Add at least one component with a weight above 0% and this calculator will work."));
      return;
    }
    if (!usable.some((c) => c.id === choice.compId)) choice.compId = defaultComponentId();

    const targets = targetOptions();
    const isCustom = () => choice.target === "custom";
    const pickedOption = () => targets.find((t) => t.key === choice.target) || targets[0];

    // The target the math must reach. A custom % gets the same rounding adjustment as the scale rows,
    // so "custom 90" and "Grade 1.25 (90% and up)" always give the same answer.
    const targetValue = () => (isCustom() ? effectiveTarget(clamp(choice.custom, 0, 100), settings) : pickedOption().value);
    const targetShown = () => (isCustom() ? clamp(choice.custom, 0, 100) : pickedOption().shown);
    const solve = (target) => whatIf(course, settings, {
      compId: choice.compId, target, newMax: choice.newMax, assumeOther: choice.assume,
    });

    // --- the form controls ---
    const targetSel = h("select", { class: "select", "aria-label": "Target grade" },
      targets.map((t) => h("option", { value: t.key }, t.label)),
      h("option", { value: "custom" }, "Custom percent…"));
    targetSel.value = isCustom() || targets.some((t) => t.key === choice.target) ? choice.target : "pass";

    const customIn = numberInput({ min: 0, max: 100, value: choice.custom, label: "Custom target percent" });
    const customField = h("label", { class: "field", hidden: !isCustom() }, h("span", {}, "Custom target (final course %)"), customIn);

    const compSel = h("select", { class: "select", "aria-label": "Upcoming component" },
      usable.map((c) => h("option", { value: c.id }, `${c.name} (${num(c.weight)}%)`)));
    compSel.value = choice.compId;
    const maxIn = numberInput({ min: 1, value: choice.newMax, label: "Maximum points of the upcoming item" });

    // Only ask for an assumed average when some OTHER component has no scores yet.
    const hasUngradedOthers = course.components.some((c) => c.id !== choice.compId && c.weight > 0 && componentStats(c).pct === null);
    const assumeIn = numberInput({ min: 0, max: 100, value: choice.assume, label: "Assumed percent for ungraded components" });
    const assumeField = h("label", { class: "field" }, h("span", {}, "Assume other ungraded components average (%)"), assumeIn);

    const resultBox = h("div", { "aria-live": "polite" });
    const tableBox = h("div", { style: "margin-top:14px" });

    function drawResult() {
      const comp = course.components.find((c) => c.id === choice.compId);
      const r = solve(targetValue());
      const targetText = pct(targetShown(), 1);   // show 75%, not the rounding-adjusted 74.5% used inside the math

      const answer = answerBox(r, comp, targetText);
      const notes = [];
      if (r.assumed?.length) notes.push(`Not graded yet, assumed at ${num(choice.assume)}%: ${r.assumed.join(", ")}.`);
      if (settings.roundPercent) notes.push("Your school rounds to the nearest whole percent, so for example 84.5% counts as 85% (change this in Settings).");
      if (notes.length) answer.append(h("ul", {}, notes.map((n) => h("li", {}, n))));
      mount(resultBox, answer);

      mount(tableBox, targetTable(comp, targets, solve));
    }

    /** The big coloured box with the answer. */
    function answerBox(r, comp, targetText) {
      if (r.status === "secured") {
        return h("div", { class: "result result--good" },
          h("div", { class: "result__big" }, "You already have it!"),
          h("p", { style: NOTE_STYLE }, `Even a 0 on the upcoming ${comp.name} keeps you at ${pct(r.worst)} or better, above the ${targetText} target.`));
      }
      if (r.status === "impossible") {
        return h("div", { class: "result result--bad" },
          h("div", { class: "result__big" }, "Out of reach"),
          h("p", { style: NOTE_STYLE }, `A perfect score on ${comp.name} would give you ${pct(r.best)}, but the target is ${targetText}. Try a lower target.`));
      }
      if (r.status === "needed") {
        return h("div", { class: "result result--need" },
          h("div", { class: "muted small" }, `To finish at ${targetText} or better you need at least`),
          h("div", { class: "result__big" }, `${num(r.needed, 2)} / ${num(choice.newMax, 2)}`),
          h("p", { style: NOTE_STYLE }, `That is ${pct(r.neededPct)} on the upcoming ${comp.name}.`));
      }
      return h("div", { class: "result" }, "Set the % weights of your components first.");
    }

    /** The table: what you would need for every grade on the scale. */
    function targetTable(comp, options, solveFor) {
      // Skip the "pass" row when the passing % already is a row of the scale (it would repeat).
      const rows = options.filter((t) => t.key !== "pass" || !settings.scale.some((x) => x.min === settings.passingPercent));
      return h("div", {},
        h("h3", { style: "margin-bottom:6px" }, `Score needed on ${comp.name} for each grade`),
        h("table", { class: "table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Target"), h("th", { class: "num" }, "Need"))),
          h("tbody", {}, rows.map((t) => {
            const x = solveFor(t.value);
            const cell = x.status === "secured" ? "Secured"
              : x.status === "impossible" ? "Not reachable"
              : `${num(x.needed, 2)} / ${num(choice.newMax, 2)}`;
            return h("tr", { class: choice.target === t.key ? "is-hit" : "" },
              h("td", {}, t.label),
              h("td", { class: `num ${x.status === "impossible" ? "dim" : ""}` }, cell));
          }))));
    }

    // --- react to the student's changes ---
    targetSel.addEventListener("change", () => { choice.target = targetSel.value; customField.hidden = !isCustom(); drawResult(); });
    customIn.addEventListener("input", () => { choice.custom = parseFloat(customIn.value) || 0; drawResult(); });
    compSel.addEventListener("change", () => { choice.compId = compSel.value; draw(); });   // redraw: the "assume" box may appear or disappear
    maxIn.addEventListener("input", () => { choice.newMax = Math.max(1, parseFloat(maxIn.value) || 100); drawResult(); });
    assumeIn.addEventListener("input", () => { choice.assume = clamp(parseFloat(assumeIn.value) || 0, 0, 100); drawResult(); });

    mount(box,
      h("h2", { class: "card__title" }, icon("target"), "What score do I need?"),
      h("div", { class: "stack", style: "gap:12px" },
        h("label", { class: "field" }, h("span", {}, "I want to get"), targetSel),
        customField,
        h("div", { class: "field-grid" },
          h("label", { class: "field" }, h("span", {}, "On my upcoming"), compSel),
          h("label", { class: "field" }, h("span", {}, "Worth (max points)"), maxIn)),
        hasUngradedOthers && assumeField),
      resultBox, tableBox);
    drawResult();
  }

  return { draw };
}

/** A number box with the attributes every box in this card shares. */
function numberInput({ min, max, value, label }) {
  return h("input", {
    class: "input input--num", type: "number", inputmode: "decimal", step: "any",
    min, max, value, "aria-label": label,
  });
}
