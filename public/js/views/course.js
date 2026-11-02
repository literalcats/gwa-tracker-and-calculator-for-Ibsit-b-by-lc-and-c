/**
 * course.js -- one course page. This file is the "conductor": it builds the page skeleton,
 * draws the "Current standing" card, and hands the other two cards to their own files.
 *
 *   course.js            (this file) skeleton + standing card + weights note + edit/delete course
 *   what-if-card.js      the "What score do I need?" card
 *   components-card.js   the editable list of components and their scores
 *
 * Whenever a score or weight changes, components-card.js calls our drawAll(), which redraws
 * the standing card, the weights note and the what-if card. The inputs are never rebuilt
 * while you type, so your cursor never jumps.
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { getState, update } from "../services/store.js";
import { courseStanding } from "../services/calc.js";
import { num, pct, grade } from "../ui/format.js";
import { confirmDialog } from "../ui/modal.js";
import { openCourseForm } from "./course-form.js";
import { createWhatIfCard } from "./what-if-card.js";
import { createComponentsCard } from "./components-card.js";
import { toast } from "../ui/toast.js";

export function renderCourse(root, courseId, { navigate }) {
  const state = getState();
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) { navigate("#/"); return; }
  const settings = state.settings;

  // Containers that are redrawn on their own:
  const headStat = h("span", { class: "muted" });
  const weightNote = h("div", { class: "weights-note" });
  const compsBox = h("div", { class: "stack" });
  const quickBox = h("div", { class: "card card--flat" });
  const standingBox = h("section", { class: "card", "aria-label": "Current standing" });
  const whatIfBox = h("section", { class: "card", "aria-label": "What-if calculator" });

  const whatIf = createWhatIfCard({ course, settings, box: whatIfBox });
  const parts = createComponentsCard({ course, compsBox, quickBox, onChange: drawAll });

  // ---------- page skeleton ----------
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

  // ---------- edit / delete this course ----------
  async function editCourse() {
    const result = await openCourseForm(course);
    if (!result) return;
    if (result.remove) { await deleteCourse(); return; }
    update(() => Object.assign(course, { name: result.name, code: result.code, units: result.units }));
    renderCourse(root, courseId, { navigate });
  }

  async function deleteCourse() {
    const ok = await confirmDialog({
      title: "Delete this course?",
      message: `"${course.name}" and all of its scores will be removed from this device. Export a backup first if you might need it.`,
      confirmText: "Delete course", danger: true,
    });
    if (!ok) return;
    update((s) => { s.courses = s.courses.filter((c) => c.id !== course.id); });
    toast("Course deleted.", "warn");
    navigate("#/");
  }

  // ---------- the "Current standing" card ----------
  function drawStanding() {
    const s = courseStanding(course, settings);
    const share = s.totalWeight > 0 ? (s.gradedWeight / s.totalWeight) * 100 : 0;   // how much of the course is graded
    const secured = s.totalWeight > 0 ? (s.earned / s.totalWeight) * 100 : 0;       // course points already locked in
    const best = secured + (100 - share);                                            // if everything left is perfect

    const bar = h("div", { class: "progress" }, h("i", {}));
    bar.firstChild.style.width = `${Math.min(100, share)}%`;

    const status = s.passed === null ? h("span", { class: "chip" }, "No scores yet")
      : s.passed ? h("span", { class: "chip chip--good" }, "Passing")
      : h("span", { class: "chip chip--bad" }, "Below passing");
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

  // ---------- the "weights add up to ..." note ----------
  function drawWeights() {
    const total = course.components.reduce((sum, c) => sum + c.weight, 0);
    const ok = Math.abs(total - 100) < 0.01;
    mount(weightNote,
      h("span", { class: `chip ${ok ? "chip--good" : "chip--warn"}` }, ok ? "Weights add up to 100%" : `Weights add up to ${num(total, 2)}%`),
      !ok && course.components.length > 0 && h("span", { class: "muted small" }, "Most syllabi total 100%. The math still works by proportion."));
  }

  /** Redraw every card that depends on the numbers. */
  function drawAll() { drawStanding(); drawWeights(); whatIf.draw(); }

  // ---------- first draw ----------
  parts.draw();
  drawAll();
}
