// Read-only probe: what template shapes do the a11y/visual matrices actually
// derive from the SHIPPED allowlist (the same inventory the stage copies)?
import { ALLOWLIST, ROOT } from "/c/tmp/gate-scope/scripts/lib/deploy-manifest.mjs";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { templateMatrix, matrixCells } from "/c/tmp/gate-scope/scripts/lib/quality-matrix.mjs";
import { visualCells } from "/c/tmp/gate-scope/scripts/lib/visual-budgets.mjs";

// Expand the allowlist exactly as the stage does: copy dirs recursively.
const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const files = [];
for (const entry of ALLOWLIST) {
  if (/\.[a-z0-9]+$/i.test(entry)) files.push(entry);
  else files.push(...tracked.filter((f) => f.startsWith(entry + "/")));
}
const read = (rel) => readFileSync(`${ROOT}/${rel}`);

const pages = files.filter((f) => f.endsWith(".html"));
console.log(`staged pages: ${pages.length}`);
const templates = templateMatrix({ files, read });
console.log("derived templates:", templates.map((t) => t.id).join(", "));
for (const t of templates) console.log(`  ${t.id}: ${t.path} (${t.pages} pages)`);

const flat = pages.filter((p) => /^[^/]+\.html$/.test(p));
console.log("flat root-level pages:", flat.join(", "));
const cityish = pages.filter((p) => /^solar-calculator\/[^/]+\/index\.html$/.test(p));
console.log(`nested city pages: ${cityish.length} (first: ${cityish.sort()[0]})`);

const m = matrixCells({ files, read });
const v = visualCells({ files, read });
console.log(`a11y cells: ${m.cells.length}; visual cells: ${v.cells.length}`);
console.log(
  "no template matched by any shape:",
  pages.filter((p) => {
    const single = templateMatrix({ files: [p], read });
    return single.length === 0 && read(p);
  }).length,
  "page(s) — e.g.",
  pages
    .filter((p) => templateMatrix({ files: [p], read }).length === 0)
    .slice(0, 3)
    .join(", "),
);
