/**
 * app.js -- the starting point. Loads saved data, switches between screens, wires the header.
 *
 * "Routing" here is simple: the part of the address after # decides the screen.
 *     #/              -> dashboard
 *     #/course/abc123 -> that course
 *     #/settings      -> settings
 * Changing the # does not reload the page, so the app feels instant (and works offline).
 */
import { init, initInfo, onSaved, canSave, watchOtherTabs, requestPersistence } from "./services/store.js";
import { THEME_KEY } from "./config.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderCourse } from "./views/course.js";
import { renderSettings } from "./views/settings.js";
import { icon } from "./ui/icons.js";
import { timeOf } from "./ui/format.js";
import { toast } from "./ui/toast.js";

const root = document.getElementById("view");

function navigate(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function render() {
  const [, page, id] = location.hash.split("/");
  const ctx = { navigate };
  if (page === "course" && id) renderCourse(root, id, ctx);
  else if (page === "settings") renderSettings(root, ctx);
  else renderDashboard(root, ctx);

  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = (a.dataset.nav === "settings") === (page === "settings");
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

// ---------- theme (dark by default; remembered in the browser) ----------
// The theme is the one tiny setting kept in localStorage instead of IndexedDB, because
// localStorage can be read instantly, before the page paints (no white flash).
const themeBtn = document.getElementById("theme-btn");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "dark" ? "#1d2022" : "#ffffff");
  themeBtn.replaceChildren(icon(theme === "dark" ? "sun" : "moon"));
  themeBtn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
}
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  applyTheme(next);
});

// ---------- "Saved" chip in the header ----------
const chip = document.getElementById("save-chip");
const chipText = document.getElementById("save-chip-text");
const chipShort = document.getElementById("save-chip-short");   // shorter text for phones
function showChip(info) {
  chip.classList.toggle("is-error", !info.ok);
  chip.classList.remove("is-saving"); void chip.offsetWidth; chip.classList.add("is-saving");
  chipText.textContent = info.ok
    ? `Saved on this device (IndexedDB)${info.at ? " · " + timeOf(info.at) : ""}`
    : "Not saved: storage blocked";
  chipShort.textContent = info.ok ? "Saved · IndexedDB" : "Not saved";
}
onSaved(showChip);

// ---------- install button (PWA) ----------
let installEvent = null;
const installBtn = document.getElementById("install-btn");
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installEvent = event; installBtn.hidden = false; });
installBtn.addEventListener("click", async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; installBtn.hidden = true; });
window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

// ---------- offline support (service worker, see sw.js) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* the app still works online */ });
  });
}

// ---------- start ----------
async function start() {
  document.querySelectorAll("[data-icon]").forEach((el) => el.replaceChildren(icon(el.dataset.icon)));
  applyTheme(document.documentElement.getAttribute("data-theme"));

  await init();                                   // read saved data from IndexedDB
  showChip({ ok: canSave() });
  if (initInfo.migrated) toast("Moved your saved data from the old version into IndexedDB.");
  if (initInfo.recoveredCorrupt) toast("Your saved data was damaged, so the app started empty. A copy was kept; restore from a backup if you have one.", "warn", 8000);
  if (!canSave()) toast("This browser blocks IndexedDB (private window?). Your work can't be saved. Export a backup before leaving.", "warn", 8000);

  requestPersistence();
  watchOtherTabs(render);
  window.addEventListener("hashchange", render);
  render();
}
start();
