/**
 * course-form.js -- the pop-up used to add a course or edit its details.
 * Used by both the dashboard ("Add course") and the course page ("Edit").
 */
import { h } from "../ui/dom.js";
import { openModal } from "../ui/modal.js";
import { COURSE_TEMPLATES } from "../presets.js";

/**
 * openCourseForm()          -> add a new course (shows the template picker)
 * openCourseForm(course)    -> edit an existing course (shows a Delete button)
 * Resolves to { name, code, units, template } | { remove: true } | null (cancelled)
 */
export function openCourseForm(course = null) {
  const name = h("input", { class: "input", value: course?.name ?? "", placeholder: "e.g. Introduction to Computing", maxlength: 80, required: true, "aria-label": "Course name" });
  const code = h("input", { class: "input", value: course?.code ?? "", placeholder: "e.g. IT 101", maxlength: 30, "aria-label": "Course code" });
  const units = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 30, step: "any", value: course?.units ?? 3, "aria-label": "Units" });
  const template = h("select", { class: "select", "aria-label": "Starting components" },
    COURSE_TEMPLATES.map((t) => h("option", { value: t.id }, t.label)));
  template.value = "typical";

  const body = [
    h("label", { class: "field" }, h("span", {}, "Course name"), name),
    h("div", { class: "field-grid" },
      h("label", { class: "field" }, h("span", {}, "Code (optional)"), code),
      h("label", { class: "field" }, h("span", {}, "Units (used for GWA)"), units)),
    course ? null : h("label", { class: "field" }, h("span", {}, "Start with these components"), template),
    course ? null : h("p", { class: "muted small" }, "You can rename components and change every weight afterwards to match your syllabus."),
  ];

  const actions = [
    ...(course ? [{ label: "Delete course", kind: "ghost", value: { remove: true } }] : []),
    { label: "Cancel", kind: "ghost", value: null },
    {
      label: course ? "Save" : "Add course", kind: "primary",
      get: () => {
        if (!name.value.trim()) { name.focus(); return undefined; }   // keep the dialog open
        return { name: name.value.trim(), code: code.value.trim(), units: Math.max(0, parseFloat(units.value) || 0), template: template.value };
      },
    },
  ];
  return openModal({ title: course ? "Edit course" : "Add a course", body, actions });
}
