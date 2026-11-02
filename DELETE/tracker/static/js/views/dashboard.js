/**
 * dashboard.js -- the home screen: GWA, a card for each course, and a backup reminder.
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { getState, update, uid, lastBackupAt } from "../store.js";
import { courseStanding, gwa, averagePercent } from "../calc.js";
import { COURSE_TEMPLATES, sampleCourse } from "../presets.js";
import { num, pct, grade } from "../ui/format.js";
import { openCourseForm } from "./course-form.js";
import { exportExcel } from "../excel-io.js";
import { toast } from "../ui/toast.js";

const DAY = 86400000;

/** Build a full course object (with ids) from a plain description. */
export function buildCourse({ name, code = "", units = 3, components = [] }) {
  return {
    id: uid(), name, code, units,
    components: components.map((c) => ({
      id: uid(), name: c.name, weight: c.weight,
      items: (c.items || []).map((i) => ({ id: uid(), name: i.name, score: i.score, max: i.max })),
    })),
  };
}

export async function addCourseFlow(navigate) {
  const result = await openCourseForm();
  if (!result) return;
  const tpl = COURSE_TEMPLATES.find((t) => t.id === result.template);
  const course = buildCourse({
    name: result.name, code: result.code, units: result.units,
    components: (tpl?.components || []).map(([name, weight]) => ({ name, weight })),
  });
  update((s) => s.courses.push(course));
  navigate(`#/course/${course.id}`);
}

export function renderDashboard(root, { navigate }) {
  const { courses, settings } = getState();
  const overall = gwa(courses, settings);
  const avg = averagePercent(courses, settings);
  const units = courses.reduce((sum, c) => sum + c.units, 0);
  const standings = courses.map((c) => courseStanding(c, settings));
  const atRisk = standings.filter((s) => s.passed === false).length;

  const lastBackup = lastBackupAt();
  const needsBackup = courses.length > 0 && (!lastBackup || Date.now() - lastBackup > 14 * DAY);

  const addBtn = h("button", { class: "btn", onClick: () => addCourseFlow(navigate) }, icon("plus"), "Add course");

  mount(root,
    h("div", { class: "page-head" },
      h("div", { class: "page-head__title" }, h("h1", {}, "My grades"), h("p", { class: "muted" }, "Log scores, watch your standing, plan your finals.")),
      h("div", { class: "page-head__actions" }, addBtn)),

    needsBackup && h("div", { class: "banner banner--info", style: "margin-bottom:16px" },
      h("span", {}, lastBackup
        ? "It has been a while since your last backup. "
        : "Tip: your data lives only in this browser's local web storage. "),
      h("button", { class: "btn btn--small", onClick: () => exportExcel(getState()).then(() => { toast("Excel save downloaded."); navigate("#/"); }).catch((e) => toast(e.message, "bad", 6000)) },
        icon("download"), "Export Excel save")),

    courses.length === 0 ? emptyState(navigate) : [
      h("section", { class: "hero", "aria-label": "Overall standing" },
        h("div", {}, h("div", { class: "hero__label" }, "Current GWA"), h("div", { class: "hero__value" }, grade(overall))),
        h("div", {},
          h("div", { class: "stats" },
            stat(courses.length, "courses"),
            stat(num(units, 1), "units"),
            stat(pct(avg), "average"),
            stat(atRisk, atRisk === 1 ? "course below passing" : "courses below passing")),
          h("p", { class: "muted small", style: "margin-top:10px" }, "Based on graded work so far. Courses with no scores yet are not counted."))),
      h("div", { class: "grid-cards" }, courses.map((c, i) => courseCard(c, standings[i], i, settings))),
    ]);
}

function stat(value, label) {
  return h("div", { class: "stat" }, h("b", {}, value), h("span", {}, label));
}

function courseCard(course, s, index, settings) {
  const share = s.totalWeight > 0 ? (s.gradedWeight / s.totalWeight) * 100 : 0;
  const status = s.passed === null ? h("span", { class: "chip" }, "No scores yet")
    : s.passed ? h("span", { class: "chip chip--good" }, "Passing") : h("span", { class: "chip chip--bad" }, "Below passing");
  const bar = h("div", { class: "progress", role: "progressbar", "aria-valuenow": Math.round(share), "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Share of course graded" }, h("i", {}));
  bar.firstChild.style.width = `${Math.min(100, share)}%`;
  const card = h("a", { class: "course-card", href: `#/course/${course.id}` },
    h("div", { class: "course-card__code" }, [course.code, `${num(course.units)} units`].filter(Boolean).join(" · ")),
    h("div", { class: "course-card__name" }, course.name),
    h("div", { class: "course-card__score" },
      h("span", { class: "course-card__pct" }, pct(s.percent)),
      s.grade !== null && h("span", { class: "chip chip--accent" }, `Grade ${grade(s.grade)}`),
      status),
    h("div", {}, bar, h("p", { class: "muted small", style: "margin:6px 0 0" }, `${num(share, 0)}% of the course graded`)));
  card.style.setProperty("--cat", `var(--cat-${(index % 5) + 1})`);
  return card;
}

function emptyState(navigate) {
  return h("div", { class: "empty" },
    h("h2", {}, "Start by adding your first course"),
    h("p", {}, "Pick a template, then adjust the weights to match your syllabus."),
    h("div", { class: "row", style: "justify-content:center;margin-top:14px" },
      h("button", { class: "btn", onClick: () => addCourseFlow(navigate) }, icon("plus"), "Add course"),
      h("button", { class: "btn btn--ghost", onClick: () => {
        const course = buildCourse(sampleCourse());
        update((s) => s.courses.push(course));
        navigate(`#/course/${course.id}`);
      } }, "Try with sample data")),
    h("p", { class: "small", style: "margin-top:16px" }, "Already have a save? Go to Settings → Backup to import your Excel or JSON file."));
}
