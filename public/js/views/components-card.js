/**
 * components-card.js -- the editable list on a course page: each component (Quizzes, Midterm...)
 * with its weight and its scored items, plus the "Add a component" buttons.
 *
 * How course.js uses it:
 *     const parts = createComponentsCard({ course, compsBox, quickBox, onChange });
 *     parts.draw();             // build the whole list
 *     parts.updateInPlace();    // refresh only the numbers (averages, item %)
 *
 * `onChange` is a function from course.js that redraws the cards that depend on the numbers
 * (standing, weights note, what-if). We call it after every edit.
 *
 * Two rules in this file:
 *   - Typing a score must NOT rebuild the inputs (your cursor would jump), so scores use
 *     updateInPlace() which only changes text.
 *   - Adding something is checked against the app's limits first (see ui/limits.js).
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { update } from "../services/store.js";
import { uid, MAX_COMPONENTS_PER_COURSE, MAX_ITEMS_PER_COMPONENT } from "../models/schema.js";
import { componentStats } from "../services/calc.js";
import { pct } from "../ui/format.js";
import { QUICK_COMPONENTS } from "../models/presets.js";
import { confirmDialog } from "../ui/modal.js";
import { canAdd } from "../ui/limits.js";

export function createComponentsCard({ course, compsBox, quickBox, onChange }) {

  // ---------- adding and removing ----------
  function addComponent(name = "New component") {
    if (!canAdd(course.components.length, MAX_COMPONENTS_PER_COURSE, "components")) return;
    const comp = { id: uid(), name, weight: 0, items: [] };
    update(() => course.components.push(comp));
    draw();
    onChange();
    const weightBox = compsBox.querySelector(`[data-weight="${comp.id}"]`);
    weightBox?.focus(); weightBox?.select();   // jump to the weight, the next thing to fill in
  }

  /** `focus` says which box of the new item gets the cursor: "name" or "score". */
  function addItem(comp, focus = "name") {
    if (!canAdd(comp.items.length, MAX_ITEMS_PER_COMPONENT, "items in one component")) return;
    const last = comp.items[comp.items.length - 1];
    const item = { id: uid(), name: `Item ${comp.items.length + 1}`, score: null, max: last ? last.max : 100 };
    update(() => comp.items.push(item));
    draw();
    refresh();
    const box = compsBox.querySelector(`[data-${focus}="${item.id}"]`);
    box?.focus(); box?.select();
  }

  async function removeComponent(comp) {
    if (comp.items.length) {
      const ok = await confirmDialog({
        title: `Delete "${comp.name}"?`, message: `Its ${comp.items.length} score(s) will be removed too.`,
        confirmText: "Delete", danger: true,
      });
      if (!ok) return;
    }
    update(() => { course.components = course.components.filter((c) => c.id !== comp.id); });
    draw();
    onChange();
  }

  function removeItem(comp, item) {
    update(() => { comp.items = comp.items.filter((i) => i.id !== item.id); });
    draw();
    refresh();
  }

  // ---------- one item row (name, score, max, %) ----------
  function itemRow(comp, item) {
    const nameIn = h("input", { class: "input input--bare", value: item.name, maxlength: 80, "data-name": item.id, "aria-label": "Item name" });
    const scoreIn = h("input", {
      class: "input input--num js-score", type: "number", inputmode: "decimal", min: 0, step: "any",
      value: item.score ?? "", placeholder: "—", "data-score": item.id, "aria-label": `Score for ${item.name}`,
    });
    const maxIn = h("input", {
      class: "input input--num", type: "number", inputmode: "decimal", min: 0, step: "any",
      value: item.max, "data-max": item.id, "aria-label": `Maximum score for ${item.name}`,
    });
    const pctEl = h("span", { class: "item__pct", "data-item": item.id });

    nameIn.addEventListener("change", () => update(() => { item.name = nameIn.value.trim() || "Item"; }));

    scoreIn.addEventListener("change", () => {
      const typed = scoreIn.value.trim() === "" ? null : Math.max(0, parseFloat(scoreIn.value));
      update(() => { item.score = Number.isFinite(typed) ? typed : null; });
      refresh();
    });

    maxIn.addEventListener("change", () => {
      const typed = parseFloat(maxIn.value);
      if (typed > 0) update(() => { item.max = typed; });
      else maxIn.value = item.max;                 // the maximum must be above 0, so put the old one back
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

    const deleteBtn = h("button", {
      class: "icon-btn icon-btn--danger", "aria-label": `Delete ${item.name}`, title: "Delete item",
      onClick: () => removeItem(comp, item),
    }, icon("trash"));

    return h("div", { class: "item" }, nameIn, scoreIn, h("span", { class: "item__slash" }, "/"), maxIn, pctEl, deleteBtn);
  }

  // ---------- one component card ----------
  function componentCard(comp, index) {
    const nameIn = h("input", { class: "input input--bare cat__name", value: comp.name, maxlength: 80, "aria-label": "Component name" });
    const weightIn = h("input", {
      class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any",
      value: comp.weight, "data-weight": comp.id, "aria-label": `Weight of ${comp.name} in percent`,
    });

    nameIn.addEventListener("change", () => { update(() => { comp.name = nameIn.value.trim() || "Component"; }); onChange(); });
    weightIn.addEventListener("change", () => {
      const weight = Math.min(100, Math.max(0, parseFloat(weightIn.value) || 0));
      weightIn.value = weight;
      update(() => { comp.weight = weight; });
      refresh();
    });

    const head = h("div", { class: "cat__head" },
      nameIn,
      h("label", { class: "weight" }, weightIn, "%"),
      h("span", { class: "cat__avg", "data-avg": comp.id, title: "Average of this component" }),
      h("button", {
        class: "icon-btn icon-btn--danger", "aria-label": `Delete component ${comp.name}`, title: "Delete component",
        onClick: () => removeComponent(comp),
      }, icon("trash")));

    const body = comp.items.length
      ? h("div", { class: "items" },
          h("div", { class: "item item--head" }, h("span", {}, "Item"), h("span", {}, "Score"), h("span", {}), h("span", {}, "Max"), h("span", {}, "%"), h("span", {})),
          comp.items.map((item) => itemRow(comp, item)))
      : h("p", { class: "cat__empty" }, "No scores yet. Add quizzes, activities or exams below.");

    const foot = h("div", { class: "cat__foot" },
      h("button", { class: "btn btn--ghost btn--small", onClick: () => addItem(comp) }, icon("plus"), "Add item"),
      h("span", { class: "muted small" }, "Leave a score empty for work that is still upcoming."));

    const card = h("article", { class: "cat" }, head, body, foot);
    card.style.setProperty("--cat", `var(--cat-${(index % 5) + 1})`);   // cycles through the 5 block colours
    return card;
  }

  // ---------- drawing ----------
  function draw() {
    if (!course.components.length) {
      mount(compsBox, h("div", { class: "empty" },
        h("h2", {}, "No components yet"),
        h("p", {}, "Add the parts of your grade below (Quizzes, Midterm, Finals…) and set each weight from your syllabus.")));
    } else {
      mount(compsBox, course.components.map(componentCard));
    }
    drawQuickAdd();
    updateInPlace();   // freshly built cards have empty average / % labels, so fill them straight away
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

  /** Change only the numbers that are shown (component averages and item %), never the inputs. */
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

  /** Refresh the numbers here, then let course.js refresh the other cards. */
  function refresh() { updateInPlace(); onChange(); }

  return { draw, updateInPlace };
}
