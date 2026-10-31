import { readFileSync, writeFileSync } from "node:fs";

const file = "C:/tmp/gate-freshness/scripts/build-jev-evidence.mjs";
const raw = readFileSync(file, "utf8");
const text = raw.replace(/\r\n/g, "\n");

const oldBlock = `/**
 * Replace \`{{name}}\` in the composable prose fields with what the run measured.
 *
 * Fails closed, and this is the important part: a placeholder no artifact
 * answered is a NAMED problem, and the literal is left visible rather than
 * silently blanked or quietly dropped. A judge reading "the browser smoke runs
 * {{smoke_gates_total}} gates" learns the record is unfinished; a judge reading
 * a smoothed-over sentence learns nothing at all.
 */
export function composeMeasuredCounts(prose, artifacts) {
  const measured = {};
  for (const art of Object.values(artifacts || {})) {
    for (const [k, v] of Object.entries(art.measurements || {}))
      measured[k] = v;
  }
  const problems = [];
  const filled = { ...prose };
  for (const field of COMPOSABLE_FIELDS) {
    const text = filled[field];
    if (typeof text !== "string" || !PLACEHOLDER.test(text)) {
      PLACEHOLDER.lastIndex = 0;
      continue;
    }
    PLACEHOLDER.lastIndex = 0;
    filled[field] = text.replace(PLACEHOLDER, (whole, name) => {
      if (Object.hasOwn(measured, name) && measured[name] !== null)
        return String(measured[name]);
      problems.push(
        \`\\\`\${field}\\\` quotes {{$\{name}}}, which no artifact on this run \` +
          "measured, so the record would reach the judge with the number still " +
          "unresolved — write the number the run measured, or drop the claim",
      );
      return whole;
    });
  }
  return { prose: filled, problems, measured };
}`;

const newBlock = `/**
 * Replace \`{{name}}\` in the record's prose with what the run measured.
 *
 * EVERY string in the record, not a list of fields. A facet proof line quotes
 * measured numbers too — the \`testing\` line quotes the test and smoke-gate
 * counts — and a number typed there is exactly as able to outlive the suite as
 * one typed at the top: measured on the 2026-10-13 audit tree, that line still
 * said "794 tests green ... 153 gates" while the tree ran 1668 and the smoke
 * reported 166. A field the walk misses is a field where a measurement can rot,
 * so the walk is the record rather than a list that has to be kept in step with
 * it.
 *
 * Fails closed, and this is the important part: a placeholder no artifact
 * answered is a NAMED problem, and the literal is left visible rather than
 * silently blanked or quietly dropped. A judge reading "the browser smoke runs
 * {{smoke_gates_total}} gates" learns the record is unfinished; a judge reading
 * a smoothed-over sentence learns nothing at all.
 */
export function composeMeasuredCounts(prose, artifacts) {
  const measured = {};
  for (const art of Object.values(artifacts || {})) {
    for (const [k, v] of Object.entries(art.measurements || {}))
      measured[k] = v;
  }
  const problems = [];
  const fill = (value, path) => {
    if (typeof value === "string") {
      if (!value.includes("{{")) return value;
      return value.replace(/\\{\\{([a-z0-9_]+)\\}\\}/g, (whole, name) => {
        if (Object.hasOwn(measured, name) && measured[name] !== null)
          return String(measured[name]);
        problems.push(
          \`\\\`\${path}\\\` quotes {{$\{name}}}, which no artifact on this run \` +
            "measured, so the record would reach the judge with the number still " +
            "unresolved — write the number the run measured, or drop the claim",
        );
        return whole;
      });
    }
    if (Array.isArray(value))
      return value.map((v, i) => fill(v, \`\${path}[\${i}]\`));
    if (value && typeof value === "object") {
      const out = {};
      for (const [k, v] of Object.entries(value))
        out[k] = fill(v, path ? \`\${path}.\${k}\` : k);
      return out;
    }
    return value;
  };
  return { prose: fill(prose, ""), problems, measured };
}`;

if (!text.includes(oldBlock)) {
  console.error("PATCH FAILED: the composer block was not found verbatim");
  process.exit(1);
}
let next = text.replace(oldBlock, newBlock);

// PLACEHOLDER is still used by main()? It was only used here. Keep the
// declaration but re-point it at the shared shape so no reader is misled.
const oldDecl = "const PLACEHOLDER = /\\{\\{([a-z0-9_]+)\\}\\}/g;\n";
if (next.includes(oldDecl)) {
  next = next.replace(
    oldDecl,
    "// The placeholder shape, owned here so the composer and anything that reads\n" +
      "// the record check the same thing.\nexport const PLACEHOLDER = /\\{\\{([a-z0-9_]+)\\}\\}/g;\n",
  );
}
writeFileSync(file, next.replace(/\n/g, "\r\n"), "utf8");
console.log("patched", file);
