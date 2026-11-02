// theme-init.js -- runs first (in <head>) so the saved theme is applied before the page paints.
// Dark is the default. The choice is remembered in local web storage under "blockb.theme".
(function () {
  var theme = "dark";
  try { theme = localStorage.getItem("blockb.theme") === "light" ? "light" : "dark"; } catch (e) { /* storage blocked: keep dark */ }
  document.documentElement.setAttribute("data-theme", theme);
})();
