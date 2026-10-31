// Shared DOM builders for sizing modules.
export function byId(id) {
  return document.getElementById(id);
}

export function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") e.style.cssText = v;
    else if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }

  if (text !== undefined) e.textContent = text;

  return e;
}
