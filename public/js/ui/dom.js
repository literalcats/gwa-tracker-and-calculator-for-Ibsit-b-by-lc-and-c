/**
 * dom.js -- a tiny helper for building HTML elements in JavaScript.
 *
 * Instead of writing  document.createElement("div")  and setting ten properties,
 * we write:   h("div", { class: "card" }, "Hello")
 *
 * h(tag, props, ...children)
 *   props:    { class, value, onClick, "aria-label", ... }  ("onClick" -> a click listener)
 *   children: strings, numbers, other elements, or arrays of them
 *
 * Because we use text nodes (never innerHTML) for user-typed text, a course named
 * "<script>" is shown as plain text and can't break or hack the page.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "value") el.value = value;
    else if (key === "checked") el.checked = Boolean(value);
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else el.setAttribute(key, value === true ? "" : value);
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children) {
    if (Array.isArray(child)) append(parent, child);
    else if (child === null || child === undefined || child === false) continue;
    else parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Remove everything inside `el`, then put `children` in. */
export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}
