// Shared HTML-escaping helpers (canonical home — do not fork).
// Use whenever interpolating data (labels, reasons, place names, or anything
// fetched) into innerHTML/template strings. Pure, dependency-free, tested in
// tests/escape.test.mjs. Callers importing this module must add it to the
// ?v= token graph (see scripts/bump-asset-tokens.mjs --check).
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
