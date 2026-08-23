// Materialize canonical content (assets/js/shared/content.js) into the
// offline Freenet page. The Freenet build must stay a self-contained single
// file, so shared data is injected between SYNC markers at author time.
// Run after changing any price or donation link:
//   node scripts/sync-freenet-content.mjs
// Idempotent: re-running produces no changes.
import { readFileSync, writeFileSync } from "node:fs";
import { BOM_ITEMS, DONATIONS } from "../assets/js/shared/content.js";

const file = new URL("../index-freenet.html", import.meta.url);
let html = readFileSync(file, "utf8");
let changed = 0;

function block(name, build) {
  const start = `<!--SYNC:${name}:START-->`;
  const end = `<!--SYNC:${name}:END-->`;
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1 || e < s) {
    console.error(`FATAL: ${name} markers missing in index-freenet.html`);
    process.exit(1);
  }
  const before = html.slice(0, s + start.length) + "\n";
  const after = html.slice(e);
  const next = before + build() + "\n      " + after;
  if (next !== html) changed++;
  html = next;
}

function esc(s) { return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;"); }

block("BOM", () => BOM_ITEMS.map((item) => [
  '        <div class="bom-card">',
  `          <div class="bom-badge">${esc(item.badge)}</div>`,
  `          <h3>${esc(item.name)}</h3>`,
  `          <p>${esc(item.desc)}</p>`,
  `          <div class="bom-price">${item.price} <span style="font-weight:400;font-size:0.8em;color:var(--text-muted);">(${esc(item.scope)})</span></div>`,
  '        </div>',
].join("\n")).join("\n\n"));

block("DONATE", () => DONATIONS.map((d) => [
  `            <a href="${d.href}" target="_blank" rel="noopener noreferrer"`,
  `               class="btn btn-outline" style="text-decoration: none;">${esc(d.label)}</a>`,
].join("\n")).join("\n"));

writeFileSync(file, html);
console.log(changed ? `synced ${changed} block(s) into index-freenet.html` : "already in sync (no changes)");
