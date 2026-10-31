import fs from "node:fs";
const file = "blog/index.html";
let html = fs.readFileSync(file, "utf8");
const url = "https://freeoffgridcalculator.com/blog/how-to-cut-electricity-bill-with-solar/";
const urlMarker = `"url": "${url}"`;
const urlIndex = html.indexOf(urlMarker);
if (urlIndex < 0 || html.indexOf(urlMarker, urlIndex + 1) >= 0) throw new Error("expected one matching BlogPosting URL");
const nodeStart = html.lastIndexOf("          {", urlIndex);
const nodeEndMarker = html.indexOf("          },", urlIndex);
if (nodeStart < 0 || nodeEndMarker < 0) throw new Error("BlogPosting boundaries not found");
const nodeEnd = nodeEndMarker + "          },".length;
let node = html.slice(nodeStart, nodeEnd);
for (const [oldValue, newValue, label] of [
  ['"headline": "How to Cut Your Electricity Bill With Solar: Honest Math (2026)"', '"headline": "How to Cut Your Electricity Bill With Solar (2026 Guide)"', "headline"],
  ['"name": "How to Cut Your Electricity Bill With Solar: Honest Math (2026)"', '"name": "How to Cut Your Electricity Bill With Solar (2026 Guide)"', "name"],
  ['"description": "How much of your electricity bill solar and battery can actually erase, with worked numbers for Honolulu, Lagos, and Germany from five years of NASA satellite weather."', '"description": "Compare solar options with your real utility bill, export-credit rules, storage needs, and full installed costs. No universal bill-cut or payback promise."', "description"],
  ['"dateModified": "2026-08-30T00:00:00Z"', '"dateModified": "2026-10-22T00:00:00Z"', "dateModified"],
]) {
  if (!node.includes(oldValue)) throw new Error(`old ${label} not found`);
  node = node.replace(oldValue, newValue);
}
html = html.slice(0, nodeStart) + node + html.slice(nodeEnd);
const marker = "        <!-- Article 3 -->";
const start = html.indexOf(marker);
const endMark = "        </article>";
const end = html.indexOf(endMark, start);
if (start < 0 || end < 0) throw new Error("visible card boundaries not found");
const card = `        <!-- Article 3 -->
        <article class="article-card">
          <div>
            <div class="card-tags">
              <span class="card-tag">Bill Cutting</span>
              <span class="card-tag">Payback</span>
              <span class="card-tag">Grid-Tie</span>
            </div>
            <h2 class="card-title">
              <a href="./how-to-cut-electricity-bill-with-solar/"
                >How to Cut Your Electricity Bill With Solar (2026 Guide)</a
              >
            </h2>
            <p class="card-excerpt">
              Compare solar options with your real utility bill, export-credit
              rules, storage needs, and full installed costs. No universal
              bill-cut or payback promise.
            </p>
          </div>
          <div class="card-footer">
            <span>Published Aug 30, 2026 &middot; Last reviewed Oct 22, 2026</span>
            <a
              href="./how-to-cut-electricity-bill-with-solar/"
              class="read-more"
              >Read Guide &rarr;</a
            >
          </div>
        </article>`;
html = html.slice(0, start) + card + html.slice(end + endMark.length);
fs.writeFileSync(file, html, "utf8");
