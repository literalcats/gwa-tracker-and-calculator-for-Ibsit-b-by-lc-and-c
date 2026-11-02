// theme-init.js -- runs first (in <head>) so the saved theme is applied before the page paints.
// Dark is the default. The choice is remembered in localStorage under "ibsitb.theme".
// (Kept as a plain script, not a module, so it can run instantly.)
(function () {
  var theme = "dark";
  try { theme = localStorage.getItem("ibsitb.theme") === "light" ? "light" : "dark"; } catch (e) { /* storage blocked: keep dark */ }
  document.documentElement.setAttribute("data-theme", theme);
})();
