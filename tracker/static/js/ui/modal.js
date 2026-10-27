/**
 * modal.js -- one reusable pop-up dialog (uses the built-in <dialog> element).
 *
 * openModal({ title, body, actions })
 *   body:    an element (or elements) to show inside
 *   actions: buttons, e.g. { label: "Save", kind: "primary", get: () => value }
 *            `get` runs when clicked; whatever it returns is what the promise gives back.
 *            Return `undefined` from `get` to keep the dialog open (e.g. the form is invalid).
 * Returns a Promise that resolves with that value, or `null` if the user cancelled.
 */
import { h, mount } from "./dom.js";

export function openModal({ title, body, actions }) {
  const dialog = document.getElementById("modal");
  const form = document.getElementById("modal-form");
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const buttons = actions.map((a) =>
      h("button", {
        type: "button",
        class: `btn ${a.kind === "primary" ? "" : a.kind === "danger" ? "btn--danger-fill" : "btn--ghost"}`,
        onClick: () => {
          const value = a.get ? a.get() : ("value" in a ? a.value : true);
          if (value !== undefined) finish(value);
        },
      }, a.label)
    );
    const primary = buttons[actions.findIndex((a) => a.kind === "primary" || a.kind === "danger")];

    mount(document.getElementById("modal-title"), title);
    mount(document.getElementById("modal-body"), body);
    mount(document.getElementById("modal-actions"), buttons);

    form.onsubmit = (event) => { event.preventDefault(); primary?.click(); };  // Enter key = primary button
    dialog.onclose = () => finish(null);                                      // Esc key / backdrop = cancel
    dialog.onclick = (event) => { if (event.target === dialog) finish(null); };
    dialog.showModal();
    const first = dialog.querySelector("input, select");
    if (first) first.focus();
  });
}

/** Ask "Are you sure?". Resolves to true / false. */
export async function confirmDialog({ title, message, confirmText = "Confirm", danger = false }) {
  const result = await openModal({
    title,
    body: h("p", { class: "muted" }, message),
    actions: [
      { label: "Cancel", kind: "ghost", value: false },
      { label: confirmText, kind: danger ? "danger" : "primary", value: true },
    ],
  });
  return result === true;
}

/** Let the user pick one of several buttons. Resolves to that button's `value`, or null. */
export function choiceDialog({ title, message, choices }) {
  return openModal({
    title,
    body: h("p", { class: "muted" }, message),
    actions: [{ label: "Cancel", kind: "ghost", value: null }, ...choices],
  });
}
