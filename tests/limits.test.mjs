// Tests for the "you've reached the limit" guard (public/js/ui/limits.js) and for the rule behind it:
// schema.js trims saves to a maximum size, so a screen must never add past that maximum.
import test from "node:test";
import assert from "node:assert/strict";
import { normalize, emptyState, MAX_COMPONENTS_PER_COURSE, MAX_ITEMS_PER_COMPONENT, MAX_COURSES, MAX_SCALE_ROWS } from "../public/js/models/schema.js";

// A very small fake page, so toast() can run in Node without a browser.
const toasts = [];
globalThis.Node = class {};
globalThis.document = {
  createElement: () => ({ setAttribute() {}, addEventListener() {}, append(child) { this.text = (this.text || "") + (child.text ?? child); }, remove() {}, className: "" }),
  createTextNode: (t) => ({ text: t }),
  getElementById: () => ({ append(el) { toasts.push(el.text); } }),
};
const { canAdd } = await import("../public/js/ui/limits.js");

test("canAdd allows adding while there is room and stays silent", () => {
  toasts.length = 0;
  assert.equal(canAdd(19, MAX_COMPONENTS_PER_COURSE, "components"), true);
  assert.equal(toasts.length, 0);
});

test("canAdd refuses at the limit and tells the student why", () => {
  toasts.length = 0;
  assert.equal(canAdd(MAX_COMPONENTS_PER_COURSE, MAX_COMPONENTS_PER_COURSE, "components"), false);
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /limit of 20 components/);
});

test("a save exactly at every limit survives a reload with nothing lost", () => {
  const s = emptyState();
  s.settings.scale = Array.from({ length: MAX_SCALE_ROWS }, (_, i) => ({ min: i, grade: i }));
  s.courses = Array.from({ length: MAX_COURSES }, (_, c) => ({
    id: "c" + c, name: "C" + c, code: "", units: 3,
    components: Array.from({ length: MAX_COMPONENTS_PER_COURSE }, (_, k) => ({
      id: `k${c}-${k}`, name: "K" + k, weight: 5,
      items: k === 0 ? Array.from({ length: MAX_ITEMS_PER_COMPONENT }, (_, i) => ({ id: `i${i}`, name: "I", score: 1, max: 2 })) : [],
    })),
  }));
  const back = normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(back.courses.length, MAX_COURSES);
  assert.equal(back.courses[0].components.length, MAX_COMPONENTS_PER_COURSE);
  assert.equal(back.courses[0].components[0].items.length, MAX_ITEMS_PER_COMPONENT);
  assert.equal(back.settings.scale.length, MAX_SCALE_ROWS);
});

test("one over the limit IS trimmed on reload (why the screens must refuse it)", () => {
  const s = emptyState();
  s.courses = [{ id: "a", name: "A", code: "", units: 3, components: Array.from({ length: MAX_COMPONENTS_PER_COURSE + 1 }, (_, k) => ({ id: "k" + k, name: "K", weight: 1, items: [] })) }];
  assert.equal(normalize(JSON.parse(JSON.stringify(s))).courses[0].components.length, MAX_COMPONENTS_PER_COURSE);
});
