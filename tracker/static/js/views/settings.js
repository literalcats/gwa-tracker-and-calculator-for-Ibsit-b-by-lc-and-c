/**
 * settings.js -- grading rules, grade scale, and backup / restore.
 */
import { h, mount } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { getState, update, replaceState, normalize, uid, lastBackupAt, isPersisted, emptyState, SCALE_PRESETS, canSave } from "../store.js";
import { exportExcel, importExcel, exportJson, importJson, pickFile } from "../excel-io.js";
import { confirmDialog, choiceDialog } from "../ui/modal.js";
import { toast } from "../ui/toast.js";
import { num } from "../ui/format.js";

export function renderSettings(root, { navigate }) {
  const state = getState();
  const settings = state.settings;
  const scaleBox = h("div");
  const persistNote = h("span", { class: "muted small" });

  // ---------- grade scale editor ----------
  function drawScale() {
    const rows = [...settings.scale].sort((a, b) => b.min - a.min);
    mount(scaleBox,
      h("div", { class: "scale-row" }, h("span", { class: "label" }, "From % and up"), h("span", { class: "label" }, "Grade equivalent"), h("span", {})),
      rows.map((row) => {
        const minIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: row.min, "aria-label": "Minimum percent" });
        const gradeIn = h("input", { class: "input input--num", type: "number", inputmode: "decimal", step: "any", value: row.grade, "aria-label": "Grade equivalent" });
        minIn.addEventListener("change", () => { update(() => { row.min = Math.min(100, Math.max(0, parseFloat(minIn.value) || 0)); }); drawScale(); });
        gradeIn.addEventListener("change", () => update(() => { row.grade = parseFloat(gradeIn.value) || 0; }));
        return h("div", { class: "scale-row" }, minIn, gradeIn,
          h("button", { class: "icon-btn icon-btn--danger", "aria-label": "Remove this row", onClick: () => { update(() => { settings.scale = settings.scale.filter((r) => r !== row); }); drawScale(); } }, icon("trash")));
      }),
      h("button", { class: "btn btn--ghost btn--small", onClick: () => { update(() => settings.scale.push({ min: 0, grade: 0 })); drawScale(); } }, icon("plus"), "Add row"));
  }

  // ---------- backup / restore ----------
  async function run(task, success) {
    try { await task(); if (success) toast(success); }
    catch (error) { toast(error.message || "Something went wrong.", "bad", 6000); }
  }

  /** Ask: replace everything, or add the imported courses to what's already here? */
  async function applyImport(incoming) {
    const clean = normalize(incoming);
    if (!clean.courses.length) throw new Error("That save has no courses in it.");
    const hasData = state.courses.length > 0;
    let mode = "replace";
    if (hasData) {
      mode = await choiceDialog({
        title: "Import this save",
        message: `It contains ${clean.courses.length} course(s). What should happen to the ${state.courses.length} course(s) already on this device?`,
        choices: [
          { label: "Add to existing", kind: "ghost", value: "merge" },
          { label: "Replace everything", kind: "danger", value: "replace" },
        ],
      });
      if (!mode) return;
    }
    if (mode === "merge") {
      update((s) => { for (const c of clean.courses) s.courses.push({ ...c, id: uid() }); });
    } else {
      replaceState(clean);
    }
    toast(`Imported ${clean.courses.length} course(s).`);
    navigate("#/");
  }

  const importExcelBtn = h("button", { class: "btn btn--ghost", onClick: async () => {
    const file = await pickFile("file-xlsx");
    if (file) run(async () => applyImport(await importExcel(file)));
  } }, icon("upload"), "Import Excel");

  const importJsonBtn = h("button", { class: "btn btn--ghost", onClick: async () => {
    const file = await pickFile("file-json");
    if (file) run(async () => applyImport(await importJson(file)));
  } }, icon("upload"), "Restore JSON");

  const last = lastBackupAt();
  isPersisted().then((p) => { persistNote.textContent = p ? "Your browser has marked this data as protected from automatic cleanup." : "Your browser may clear this data if the device runs very low on space, so keep a backup."; });

  mount(root,
    h("div", { class: "page-head" }, h("div", { class: "page-head__title" }, h("h1", {}, "Settings"), h("p", { class: "muted" }, "Grading rules and backups."))),
    h("div", { class: "stack" },

      // ----- Backup first: it's the most important part.
      h("section", { class: "card" },
        h("h2", { class: "card__title" }, icon("download"), "Backup & restore"),
        h("div", { class: `banner ${canSave() ? "banner--info" : "banner--bad"}`, style: "margin-bottom:14px" },
          h("div", {},
            h("strong", {}, canSave() ? "Your data is saved in this browser's local web storage." : "Saving is blocked in this browser."),
            h("p", { class: "small", style: "margin:4px 0 0" },
              canSave()
                ? "It stays on this device only and is never uploaded. If you clear your browser data, use a private window, or switch phones, it will be gone. An Excel or JSON backup lets you restore everything."
                : "Local web storage looks disabled (private window or blocked site data). Your work will be lost when you close the tab. Export a backup before you leave."))),
        h("p", { class: "muted small" }, last ? `Last backup: ${new Date(last).toLocaleString()}` : "You have not made a backup yet."),
        h("div", { class: "row", style: "margin:10px 0" },
          h("button", { class: "btn", onClick: () => run(() => exportExcel(getState()), "Excel save downloaded.") }, icon("download"), "Export Excel"),
          importExcelBtn),
        h("div", { class: "row" },
          h("button", { class: "btn btn--ghost", onClick: () => run(async () => exportJson(getState()), "JSON backup downloaded.") }, icon("file"), "Download JSON"),
          importJsonBtn),
        h("p", { class: "muted small", style: "margin-top:12px" },
          "Excel is easy to read and edit (the Data sheet is what gets re-imported). JSON also works offline. ", persistNote)),

      h("section", { class: "card" },
        h("h2", { class: "card__title" }, icon("settings"), "Grading rules"),
        gradingRules(settings)),

      h("section", { class: "card" },
        h("h2", { class: "card__title" }, "Grade scale"),
        h("p", { class: "muted small" }, "Schools differ, so match this to your school's table. Percent in, grade out."),
        h("div", { class: "row", style: "margin-bottom:12px" },
          Object.entries(SCALE_PRESETS).map(([key, p]) => h("button", { class: "btn btn--ghost btn--small", onClick: async () => {
            if (!(await confirmDialog({ title: `Use "${p.label}"?`, message: "This replaces your current scale, passing percent and failing grade. Your scores are not touched.", confirmText: "Use preset" }))) return;
            update(() => { settings.scale = structuredClone(p.scale); settings.failGrade = p.failGrade; settings.passingPercent = p.passingPercent; });
            renderSettings(root, { navigate });
          } }, p.label))),
        scaleBox),

      h("section", { class: "card" },
        h("h2", { class: "card__title" }, "Danger zone"),
        h("p", { class: "muted small" }, "Deletes every course and score stored in this browser. Export a backup first!"),
        h("button", { class: "btn btn--danger", onClick: async () => {
          if (!(await confirmDialog({ title: "Delete ALL data?", message: "All courses and scores on this device will be erased. This cannot be undone unless you have a backup.", confirmText: "Delete everything", danger: true }))) return;
          replaceState(emptyState());
          toast("All data deleted.", "warn");
          navigate("#/");
        } }, icon("trash"), "Delete all data"))));
  drawScale();
}

function gradingRules(settings) {
  const pass = h("input", { class: "input input--num", type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: settings.passingPercent, "aria-label": "Passing percent" });
  const fail = h("input", { class: "input input--num", type: "number", inputmode: "decimal", step: "any", value: settings.failGrade, "aria-label": "Failing grade" });
  const round = h("input", { type: "checkbox", checked: settings.roundPercent });
  pass.addEventListener("change", () => update(() => { settings.passingPercent = Math.min(100, Math.max(0, parseFloat(pass.value) || 0)); }));
  fail.addEventListener("change", () => update(() => { settings.failGrade = parseFloat(fail.value) || 0; }));
  round.addEventListener("change", () => update(() => { settings.roundPercent = round.checked; }));
  return h("div", { class: "stack", style: "gap:12px" },
    h("div", { class: "field-grid" },
      h("label", { class: "field" }, h("span", {}, "Passing percent"), pass),
      h("label", { class: "field" }, h("span", {}, "Grade when below the scale"), fail)),
    h("label", { class: "check" }, round, h("span", {}, "Round the percent to a whole number before finding the grade (74.5 becomes 75)")));
}
