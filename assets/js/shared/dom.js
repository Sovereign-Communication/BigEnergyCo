// The two DOM builders every widget module needs — ONE owner for what was
// twice-private copy. ui.js kept `$` and `el`, location-picker.js kept `byId`
// and `el`, and the two `el` bodies were byte-identical (the code-hygiene gate
// found them as a shared 8-line window; extract, don't retype). Classic
// scripts that cannot import — chat.js — keep their own helper by necessity;
// modules share this one.
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
