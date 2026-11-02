/**
 * course.js -- one course: its components, its scores, current standing, and the what-if calculator.
 *
 * How this file is organised (read it top to bottom):
 *   1. renderCourse()   builds the page skeleton and wires the buttons
 *   2. drawStanding()   the "Current standing" card
 *   3. drawWhatIf()     the "What score do I need?" card
 *   4. drawComponents() the editable list of components and their scores
 *   5. refresh()        re-calculates numbers WITHOUT rebuilding the inputs
 *                       (so your cursor never jumps while you type scores)
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { getState, update, uid } from "../store.js";
import { componentStats, courseStanding, whatIf, effectiveTarget } from "../calc.js";
import { num, pct, grade } from "../ui/format.js";
import { QUICK_COMPONENTS } from "../presets.js";
import { confirmDialog } from "../ui/modal.js";
import { openCourseForm } from "./course-form.js";
import { toast } from "../ui/toast.js";

// What-if choices are remembered per course while the app is open (not saved to storage).
const whatIfChoices = {};

export function renderCourse(root, courseId, { navigate }) {
  const state = getState();
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) { navigate("#/"); return; }
  const settings = state.settings;
  const colorIndex = state.courses.indexOf(course);
  const choice = (whatIfChoices[courseId] ??= { target: "pass", custom: 90, compId: null, newMax: 100, assume: 0 });

  // Containers we redraw on their own:
  const headStat = h("span", { class: "muted" });
  const weightNote = h("div", { class: "weights-note" });
  const compsBox = h("div", { class: "stack" });
  const quickBox = h("div", { class: "card card--flat" });
  const standingBox = h("section", { class: "card", "aria-label": "Current standing" });
  const whatIfBox = h("section", { class: "card", "aria-label": "What-if calculator" });

  // ------------------------------------------------------------------ 1. page skeleton
  mount(root,
    h("a", { class: "crumb", href: "#/" }, icon("back"), "All courses"),
    h("div", { class: "page-head" },
      h("div", { class: "page-head__title" },
        h("h1", {}, course.name),
        h("p", { class: "muted" }, [course.code, `${num(course.units)} units`].filter(Boolean).join(" · "), " · ", headStat)),
      h("div", { class: "page-head__actions" },
        h("button", { class: "btn btn--ghost", onClick: editCourse }, icon("edit"), "Edit course"))),
    h("div", { class: "layout-course" },
      h("div", { class: "stack" }, weightNote, compsBox, quickBox),
      h("div", { class: "layout-course__side" }, standingBox, whatIfBox)));

  async function editCourse() {
    const result = await openCourseForm(course);
    if (!result) return;
    if (result.remove) {
      const ok = await confirmDialog({ title: "Delete this course?", message: `"${course.name}" and all of its scores will be removed from this device. Export a backup first if you might need it.`, confirmText: "Delete course", danger: true });
      if (!ok) return;
      update((s) => { s.courses = s.courses.filter((c) => c.id !== course.id); });
      toast("Course deleted.", "warn");
      navigate("#/");
      return;
    }
    update(() => Object.assign(course, { name: result.name, code: result.code, units: result.units }));
    renderCourse(root, courseId, { navigate });
  }

  // ------------------------------------------------------------------ 2. standing card
  function drawStanding() {
    const s = courseStanding(course, settings);
    const share = s.totalWeight > 0 ? (s.gradedWeight / s.totalWeight) * 100 : 0;
    const secured = s.totalWeight > 0 ? (s.earned / s.totalWeight) * 100 : 0;   // course points already locked in
    const best = secured + (100 - share);                                        // if everything left is perfect
    const bar = h("div", { class: "progress" }, h("i", {}));
    bar.firstChild.style.width = `${Math.min(100, share)}%`;
    const status = s.passed === null ? h("span", { class: "chip" }, "No scores yet")
      : s.passed ? h("span", { class: "chip chip--good" }, "Passing") : h("span", { class: "chip chip--bad" }, "Below passing");
    headStat.textContent = s.percent === null ? "no scores yet" : `${pct(s.percent)} · grade ${grade(s.grade)}`;

    mount(standingBox,
      h("h2", { class: "card__title" }, icon("check"), "Current standing"),
      h("div", { class: "standing" },
        h("div", { class: "standing__main" },
          h("span", { class: "standing__pct" }, pct(s.percent)),
          s.grade !== null && h("span", { class: "standing__grade" }, `Grade ${grade(s.grade)}`),
          status),
        h("div", {}, bar, h("p", { class: "muted small", style: "margin:6px 0 0" }, `${num(share, 0)}% of the course is graded so far`)),
        h("p", { class: "small muted", style: "margin:0" },
          `Secured: ${num(secured)} of 100 course points. Best case if you ace everything left: ${pct(best)}.`)));
  }

  function drawWeights() {
    const total = course.components.reduce((sum, c) => sum + c.weight, 0);
    const ok = Math.abs(total - 100) < 0.01;
    mount(weightNote,
      h("span", { class: `chip ${ok ? "chip--good" : "chip--warn"}` }, ok ? "Weights add up to 100%" : `Weights add up to ${num(total, 2)}%`),
      !ok && course.components.length > 0 && h("span", { class: "muted small" }, "Most syllabi total 100%. The math still works by proportion."));
  }

  // ------------------------------------------------------------------ 3. what-if card
  function defaultComponent() {
    const usable = course.components.filter((c) => c.weight > 0);
    return (usable.find((c) => /final/i.test(c.name)) || usable.find((c) => /exam/i.test(c.name)) || usable[usable.length - 1])?.id || null;
  }

  function targetOptions() {
    const list = [{ key: "pass", label: `Just pass (${num(settings.passingPercent)}%)`, value: effectiveTarget(settings.passingPercent, settings), shown: settings.passingPercent }];
    for (const row of settings.scale) {
      list.push({ key: `g${row.min}`, label: `Grade ${grade(row.grade)} (${num(row.min)}% and up)`, value: effectiveTarget(row.min, settings), shown: row.min });
    }
    return list;
  }

  function drawWhatIf() {
    const usable = course.components.filter((c) => c.weight > 0);
    if (!usable.length) {
      mount(whatIfBox, h("h2", { class: "card__title" }, icon("target"), "What score do I need?"),
        h("p", { class: "muted" }, "Add at least one component with a weight above 0% and this calculator will work."));
      return;
    }
    if (!usable.some((c) => c.id === choice.compId)) choice.compId = defaultComponent();

    const targets = targetOptions();
    const targetSel = h("select", { class: "select", "aria-label": "Target grade" },
      targets.map((t) => h("option", { value: t.key }, t.label)), h("option", { value: "custom" }, "Custom percent…"));
    targetSel.value = targets.some((t) => t.key === choice.target) || choice.target === "custom" ? choice.target : "pass";
    const customIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: choice.custom, "aria-label": "Custom target percent" });
    const customField = h("label", { class: "field", hidden: choice.target !== "custom" }, h("span", {}, "Custom target (final course %)"), customIn);

    const compSel = h("select", { class: "select", "aria-label": "Upcoming component" },
      usable.map((c) => h("option", { value: c.id }, `${c.name} (${num(c.weight)}%)`)));
    compSel.value = choice.compId;
    const maxIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 1, step: "any", value: choice.newMax, "aria-label": "Maximum points of the upcoming item" });

    const hasUngradedOthers = course.components.some((c) => c.id !== choice.compId && c.weight > 0 && componentStats(c).pct === null);
    const assumeIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: choice.assume, "aria-label": "Assumed percent for ungraded components" });
    const assumeField = h("label", { class: "field" }, h("span", {}, "Assume other ungraded components average (%)"), assumeIn);

    const resultBox = h("div", { "aria-live": "polite" });
    const tableBox = h("div", { style: "margin-top:14px" });

    const currentTarget = () => {
      if (choice.target === "custom") return Math.min(100, Math.max(0, choice.custom));
      return (targets.find((t) => t.key === choice.target) || targets[0]).value;
    };
    const solve = (target) => whatIf(course, settings, { compId: choice.compId, target, newMax: choice.newMax, assumeOther: choice.assume });

    function drawResult() {
      const comp = course.components.find((c) => c.id === choice.compId);
      const r = solve(currentTarget());
      // Show the number the student picked (e.g. 75%), not the rounding-adjusted 74.5% used inside the math.
      const picked = choice.target === "custom" ? currentTarget() : (targets.find((t) => t.key === choice.target) || targets[0]).shown;
      const targetText = pct(picked, 1);
      let box;
      if (r.status === "secured") {
        box = h("div", { class: "result result--good" },
          h("div", { class: "result__big" }, "You already have it!"),
          h("p", { style: "margin:6px 0 0" }, `Even a 0 on the upcoming ${comp.name} keeps you at ${pct(r.worst)} or better, above the ${targetText} target.`));
      } else if (r.status === "impossible") {
        box = h("div", { class: "result result--bad" },
          h("div", { class: "result__big" }, "Out of reach"),
          h("p", { style: "margin:6px 0 0" }, `A perfect score on ${comp.name} would give you ${pct(r.best)}, but the target is ${targetText}. Try a lower target.`));
      } else if (r.status === "needed") {
        box = h("div", { class: "result result--need" },
          h("div", { class: "muted small" }, `To finish at ${targetText} or better you need at least`),
          h("div", { class: "result__big" }, `${num(r.needed, 2)} / ${num(choice.newMax, 2)}`),
          h("p", { style: "margin:6px 0 0" }, `That is ${pct(r.neededPct)} on the upcoming ${comp.name}.`));
      } else {
        box = h("div", { class: "result" }, "Set the % weights of your components first.");
      }
      const notes = [];
      if (r.assumed?.length) notes.push(`Not graded yet, assumed at ${num(choice.assume)}%: ${r.assumed.join(", ")}.`);
      if (settings.roundPercent) notes.push("Your school rounds to the nearest whole percent, so for example 84.5% counts as 85% (change this in Settings).");
      if (notes.length) box.append(h("ul", {}, notes.map((n) => h("li", {}, n))));
      mount(resultBox, box);

      // Table: what you'd need for every grade on the scale.
      const rows = targets.filter((t) => t.key !== "pass" || !settings.scale.some((x) => x.min === settings.passingPercent));
      mount(tableBox,
        h("h3", { style: "margin-bottom:6px" }, `Score needed on ${comp.name} for each grade`),
        h("table", { class: "table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Target"), h("th", { class: "num" }, "Need"))),
          h("tbody", {}, rows.map((t) => {
            const x = solve(t.value);
            const cell = x.status === "secured" ? "Secured" : x.status === "impossible" ? "Not reachable" : `${num(x.needed, 2)} / ${num(choice.newMax, 2)}`;
            return h("tr", { class: choice.target === t.key ? "is-hit" : "" },
              h("td", {}, t.label), h("td", { class: `num ${x.status === "impossible" ? "dim" : ""}` }, cell));
          }))));
    }

    targetSel.addEventListener("change", () => { choice.target = targetSel.value; customField.hidden = choice.target !== "custom"; drawResult(); });
    customIn.addEventListener("input", () => { choice.custom = parseFloat(customIn.value) || 0; drawResult(); });
    compSel.addEventListener("change", () => { choice.compId = compSel.value; drawWhatIf(); });   // redraw: "assume" box may appear/disappear
    maxIn.addEventListener("input", () => { choice.newMax = Math.max(1, parseFloat(maxIn.value) || 100); drawResult(); });
    assumeIn.addEventListener("input", () => { choice.assume = Math.min(100, Math.max(0, parseFloat(assumeIn.value) || 0)); drawResult(); });

    mount(whatIfBox,
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

  // ------------------------------------------------------------------ 4. components + items
  function addComponent(name = "New component") {
    const comp = { id: uid(), name, weight: 0, items: [] };
    update(() => course.components.push(comp));
    drawComponents();
    drawAll();
    const input = compsBox.querySelector(`[data-weight="${comp.id}"]`);
    input?.focus(); input?.select();
  }

  function addItem(comp, focus = "name") {
    const last = comp.items[comp.items.length - 1];
    const item = { id: uid(), name: `Item ${comp.items.length + 1}`, score: null, max: last ? last.max : 100 };
    update(() => comp.items.push(item));
    drawComponents();
    refresh();
    const input = compsBox.querySelector(`[data-${focus}="${item.id}"]`);
    input?.focus(); input?.select();
  }

  async function removeComponent(comp) {
    if (comp.items.length) {
      const ok = await confirmDialog({ title: `Delete "${comp.name}"?`, message: `Its ${comp.items.length} score(s) will be removed too.`, confirmText: "Delete", danger: true });
      if (!ok) return;
    }
    update(() => { course.components = course.components.filter((c) => c.id !== comp.id); });
    drawComponents(); drawAll();
  }

  function itemRow(comp, item) {
    const nameIn = h("input", { class: "input input--bare", value: item.name, maxlength: 80, "data-name": item.id, "aria-label": "Item name" });
    const scoreIn = h("input", { class: "input input--num js-score", type: "number", inputmode: "decimal", min: 0, step: "any", value: item.score ?? "", placeholder: "—", "data-score": item.id, "aria-label": `Score for ${item.name}` });
    const maxIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, step: "any", value: item.max, "data-max": item.id, "aria-label": `Maximum score for ${item.name}` });
    const pctEl = h("span", { class: "item__pct", "data-item": item.id });

    nameIn.addEventListener("change", () => update(() => { item.name = nameIn.value.trim() || "Item"; }));
    scoreIn.addEventListener("change", () => {
      const v = scoreIn.value.trim() === "" ? null : Math.max(0, parseFloat(scoreIn.value));
      update(() => { item.score = Number.isFinite(v) ? v : null; });
      refresh();
    });
    maxIn.addEventListener("change", () => {
      const v = parseFloat(maxIn.value);
      if (v > 0) update(() => { item.max = v; }); else maxIn.value = item.max;   // max must be above 0
      refresh();
    });
    // Enter in a score box jumps to the next item's score (or adds a new item after the last one).
    scoreIn.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      scoreIn.dispatchEvent(new Event("change"));
      const boxes = [...scoreIn.closest(".cat").querySelectorAll(".js-score")];
      const next = boxes[boxes.indexOf(scoreIn) + 1];
      if (next) { next.focus(); next.select(); } else addItem(comp, "score");
    });

    return h("div", { class: "item" }, nameIn, scoreIn, h("span", { class: "item__slash" }, "/"), maxIn, pctEl,
      h("button", { class: "icon-btn icon-btn--danger", "aria-label": `Delete ${item.name}`, title: "Delete item", onClick: () => {
        update(() => { comp.items = comp.items.filter((i) => i.id !== item.id); });
        drawComponents(); refresh();
      } }, icon("trash")));
  }

  function componentCard(comp, index) {
    const nameIn = h("input", { class: "input input--bare cat__name", value: comp.name, maxlength: 80, "aria-label": "Component name" });
    const weightIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: comp.weight, "data-weight": comp.id, "aria-label": `Weight of ${comp.name} in percent` });
    nameIn.addEventListener("change", () => { update(() => { comp.name = nameIn.value.trim() || "Component"; }); drawWhatIf(); });
    weightIn.addEventListener("change", () => {
      const v = Math.min(100, Math.max(0, parseFloat(weightIn.value) || 0));
      weightIn.value = v;
      update(() => { comp.weight = v; });
      refresh();
    });

    const card = h("article", { class: "cat" },
      h("div", { class: "cat__head" },
        nameIn,
        h("label", { class: "weight" }, weightIn, "%"),
        h("span", { class: "cat__avg", "data-avg": comp.id, title: "Average of this component" }),
        h("button", { class: "icon-btn icon-btn--danger", "aria-label": `Delete component ${comp.name}`, title: "Delete component", onClick: () => removeComponent(comp) }, icon("trash"))),
      comp.items.length
        ? h("div", { class: "items" },
            h("div", { class: "item item--head" }, h("span", {}, "Item"), h("span", {}, "Score"), h("span", {}), h("span", {}, "Max"), h("span", {}, "%"), h("span", {})),
            comp.items.map((item) => itemRow(comp, item)))
        : h("p", { class: "cat__empty" }, "No scores yet. Add quizzes, activities or exams below."),
      h("div", { class: "cat__foot" },
        h("button", { class: "btn btn--ghost btn--small", onClick: () => addItem(comp) }, icon("plus"), "Add item"),
        h("span", { class: "muted small" }, "Leave a score empty for work that is still upcoming.")));
    card.style.setProperty("--cat", `var(--cat-${(index % 5) + 1})`);
    return card;
  }

  function drawComponents() {
    if (!course.components.length) {
      mount(compsBox, h("div", { class: "empty" }, h("h2", {}, "No components yet"), h("p", {}, "Add the parts of your grade below (Quizzes, Midterm, Finals…) and set each weight from your syllabus.")));
    } else {
      mount(compsBox, course.components.map(componentCard));
    }
    drawQuickAdd();
  }

  function drawQuickAdd() {
    const have = new Set(course.components.map((c) => c.name.toLowerCase()));
    mount(quickBox,
      h("h3", { style: "margin-bottom:8px" }, "Add a component"),
      h("div", { class: "quick-add" },
        QUICK_COMPONENTS.filter((n) => !have.has(n.toLowerCase())).map((n) =>
          h("button", { class: "btn btn--ghost btn--small", onClick: () => addComponent(n) }, icon("plus"), n)),
        h("button", { class: "btn btn--small", onClick: () => addComponent() }, icon("plus"), "Custom")));
  }

  // ------------------------------------------------------------------ 5. refresh numbers in place
  function updateInPlace() {
    for (const comp of course.components) {
      const avgEl = compsBox.querySelector(`[data-avg="${comp.id}"]`);
      if (avgEl) avgEl.textContent = pct(componentStats(comp).pct);
      for (const item of comp.items) {
        const el = compsBox.querySelector(`[data-item="${item.id}"]`);
        if (el) el.textContent = item.score !== null && item.max > 0 ? pct((item.score / item.max) * 100) : "—";
      }
    }
  }
  function drawAll() { drawStanding(); drawWeights(); drawWhatIf(); }
  function refresh() { updateInPlace(); drawAll(); }

  drawComponents();
  updateInPlace();
  drawAll();
}
