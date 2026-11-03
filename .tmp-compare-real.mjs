// Scratch (not committed): replays the REAL gate report through the old
// composer (HEAD) and the new one. The composed line and the omission report
// must be identical, and both must equal what the gate actually wrote.
import { readFileSync } from "node:fs";

const oldMod = await import("./scripts/lib/.tmp-old.mjs");
const newMod = await import("./scripts/lib/lighthouse-budgets.mjs");

const report = JSON.parse(readFileSync(".tmp-lh-report.json", "utf8"));

// The old composer is the accumulate-into-a-global one.
oldMod.facetLineOmitted.length = 0;
const oldLine = oldMod.composeFacetLine(report);
const oldOmitted = oldMod.facetLineOmitted.slice();

const { line: newLine, omitted: newOmitted } = newMod.composeFacetLineWithOmissions(report);

console.log("old line == new line           :", oldLine === newLine);
console.log("old omitted == new omitted     :", JSON.stringify(oldOmitted) === JSON.stringify(newOmitted));
console.log("new line == the gate's own line:", newLine === report.facet_line);
console.log("chars:", oldLine.length, newLine.length, report.facet_line.length);

// The thin adapter must return exactly the same string.
const adapter = newMod.composeFacetLine(report);
console.log("thin adapter == new line       :", adapter === newLine);

if (oldLine !== newLine || JSON.stringify(oldOmitted) !== JSON.stringify(newOmitted) || newLine !== report.facet_line)
  process.exit(1);
console.log("BYTE-IDENTICAL on the real report");
