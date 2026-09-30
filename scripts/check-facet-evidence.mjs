// Fail before Jev runs if any facet lacks a durable definition or a declared
// run-derived producer. The prose JSON is intentionally not an evidence source.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { COMPLETE_FACET_CLIP } from "./lib/jev-complete.mjs";
import { FACET_EVIDENCE } from "./lib/jev-facet-evidence.mjs";
import { EXPERIENCE_FACET_AXES } from "./lib/experience-budgets.mjs";
import { BYTE_BUDGET_FACET_AXES } from "./lib/byte-budgets.mjs";
import { LIGHTHOUSE_FACET_AXES } from "./lib/lighthouse-budgets.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(ROOT, "scripts", "lib", "jev-complete.pack.json");
const PROSE = join(ROOT, "evidence", "advisor-and-release.json");

export function validateFacetEvidence({
  axes,
  facetEvidence,
  derivedAxes,
  prose,
} = {}) {
  const required = new Set(Array.isArray(axes) ? axes : []);
  const derived = new Set(Array.isArray(derivedAxes) ? derivedAxes : []);
  const evidence =
    facetEvidence && typeof facetEvidence === "object" ? facetEvidence : {};
  const keys = Object.keys(evidence);
  const missing = [...required].filter(
    (axis) => !Object.hasOwn(evidence, axis) && !derived.has(axis),
  );
  const invalid = keys.filter(
    (axis) =>
      typeof evidence[axis] !== "string" ||
      !evidence[axis].trim() ||
      evidence[axis].length > COMPLETE_FACET_CLIP,
  );
  const unexpected = keys.filter((axis) => !required.has(axis));
  const unknownDerived = [...derived].filter((axis) => !required.has(axis));
  const legacyField = Boolean(
    prose &&
    typeof prose === "object" &&
    Object.hasOwn(prose, "facet_evidence"),
  );

  return { missing, invalid, unexpected, unknownDerived, legacyField };
}

export function main() {
  let pack;
  let prose;
  try {
    pack = JSON.parse(readFileSync(PACK, "utf8"));
    prose = JSON.parse(readFileSync(PROSE, "utf8"));
  } catch (error) {
    process.stderr.write(
      `check-facet-evidence: cannot read gate inputs: ${error.message}\n`,
    );
    return 1;
  }

  const axes = Object.keys(pack.axes || {});
  const derivedAxes = [
    ...LIGHTHOUSE_FACET_AXES,
    ...EXPERIENCE_FACET_AXES,
    ...BYTE_BUDGET_FACET_AXES,
  ];
  const result = validateFacetEvidence({
    axes,
    facetEvidence: FACET_EVIDENCE,
    derivedAxes,
    prose,
  });
  const problems = [];
  if (!Object.isFrozen(FACET_EVIDENCE))
    problems.push("FACET_EVIDENCE must be frozen");
  if (result.missing.length)
    problems.push(
      `missing facet definitions or producers: ${result.missing.join(", ")}`,
    );
  if (result.invalid.length)
    problems.push(
      `invalid code-owned evidence lines: ${result.invalid.join(", ")}`,
    );
  if (result.unexpected.length)
    problems.push(
      `evidence keys absent from the Jev pack: ${result.unexpected.join(", ")}`,
    );
  if (result.unknownDerived.length)
    problems.push(
      `derived axes absent from the Jev pack: ${result.unknownDerived.join(", ")}`,
    );
  if (result.legacyField)
    problems.push(
      "evidence/advisor-and-release.json still defines facet_evidence; move those lines to scripts/lib/jev-facet-evidence.mjs",
    );

  if (problems.length) {
    process.stderr.write(
      `check-facet-evidence: ${problems.length} problem(s):\n` +
        problems.map((problem) => `  - ${problem}\n`).join(""),
    );
    return 1;
  }

  const derivedOnly = axes.filter(
    (axis) =>
      !Object.hasOwn(FACET_EVIDENCE, axis) && derivedAxes.includes(axis),
  );
  process.stdout.write(
    `facet evidence guard: ${axes.length}/${axes.length} facets covered ` +
      `(${Object.keys(FACET_EVIDENCE).length} code-defined, ${derivedOnly.length} run-derived)\n`,
  );
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = main();
