// toast.js -- small pop-up messages ("Saved!", "Import failed...").
import { h } from "./dom.js";

export function toast(message, kind = "good", ms = 3500) {
  const box = document.getElementById("toasts");
  const el = h("div", { class: `toast toast--${kind === "good" ? "ok" : kind}`, role: "status" }, message);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}
