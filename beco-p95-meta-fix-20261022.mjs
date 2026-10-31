import fs from "node:fs";
const path = "blog/how-to-cut-electricity-bill-with-solar/index.html";
let html = fs.readFileSync(path, "utf8");
if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);
const oldMeta = `        <p class="meta">\r\n          Published Aug 30, 2026 &middot; Last reviewed Oct 22, 2026 &middot; Lucas Ballek\r\n        </p>`;
const newMeta = `        <p class="meta">\r\n          Published Aug 30, 2026 &middot;\r\n          <time datetime="2026-10-22">Last reviewed: October 22, 2026</time>\r\n          &middot; Lucas Ballek\r\n        </p>`;
if (!html.includes(oldMeta)) throw new Error("article metadata block not found");
html = html.replace(oldMeta, newMeta);
fs.writeFileSync(path, html, "utf8");
