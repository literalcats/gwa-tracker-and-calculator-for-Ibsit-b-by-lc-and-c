// format.js -- turn numbers into friendly text.

/** 86.2345 -> "86.2"   |   90 -> "90"   |   null -> "—" */
export function num(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(Number(value.toFixed(decimals)));
}

export function pct(value, decimals = 1) {
  return value === null || value === undefined ? "—" : `${num(value, decimals)}%`;
}

/** Grades are shown with 2 decimals (1.00, 2.75) like most school systems. */
export function grade(value) {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

export function timeOf(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
