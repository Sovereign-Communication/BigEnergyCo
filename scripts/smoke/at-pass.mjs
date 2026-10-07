// The assistive-technology pass for the experience gate.
//
// WHY THIS FILE EXISTS. The experience facet's proof line ended with "No AT
// run." — an honest admission that no assistive-technology pass had ever been
// walked. The judge reads that as an unmeasured claim about the facet. This
// module runs axe-core over the page the experience walk just finished, on the
// same staged build, through the same CDP wire, so the facet line can say an
// AT run happened and what it found.
//
// WHY VIOLATIONS DO NOT BLOCK HERE. scripts/check-a11y-matrix.mjs already
// ratchets axe violations against its baseline — that gate owns them. This
// pass REPORTS what axe found (counted, named) so the facet line is truthful;
// a violation is a note in the evaluator, never a regression here. What
// blocks is the ABSENCE of a run: an unexercised claim is a hole, never a
// pass.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { AXE_TAGS } from "../lib/quality-matrix.mjs";

const require = createRequire(import.meta.url);

// Pinned devDependency, resolved exactly the way check-a11y-matrix.mjs
// resolves it: require.resolve against the installed package, not a path
// typed by hand that drifts when the pin moves.
let axeSource = null;
function getAxeSource() {
  if (!axeSource)
    axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  return axeSource;
}

/**
 * Run axe-core over the page the walk just finished.
 *
 * `ctx` is the CDP runtime from scripts/smoke/runtime.mjs ({ send, evaluate,
 * poll }). The page is already loaded in its final walked state; axe audits
 * THAT document, not a fresh load.
 *
 * Returns { ran: true, violations, counts, incomplete } on success, or
 * { ran: false, error } when the injection or the run failed. A failed run is
 * a visible not-ran, never a silent green.
 */
export async function runAtPass(ctx) {
  const { evaluate } = ctx;
  try {
    // Injected via CDP Runtime.evaluate, which executes below the page's
    // Content-Security-Policy: the staged build ships a strict script-src and
    // a <script> tag would be refused. This is the same bypass the walk uses
    // for its Jev stub — DevTools driving the page is not the page loading a
    // script.
    await evaluate(getAxeSource());
    if (!(await evaluate("typeof window.axe !== 'undefined'")))
      return {
        ran: false,
        error: "axe-core injected but window.axe is undefined",
      };
    // Same rule set as check-a11y-matrix.mjs: the runOnly tag filter from
    // AXE_TAGS, so the two gates judge the same violations.
    const result = await evaluate(`(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: "tag", values: ${JSON.stringify(AXE_TAGS)} },
      });
      // Serialised inside the page: axe results hold DOM nodes, which
      // returnByValue cannot carry. check-a11y-matrix.mjs maps the same way
      // for the same reason.
      return JSON.parse(JSON.stringify({
        violations: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          example:
            (v.nodes[0] && v.nodes[0].target && v.nodes[0].target.join(" ")) ||
            "",
        })),
        incomplete: r.incomplete.length,
      }));
    })()`);
    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of result.violations || [])
      if (v.impact && counts[v.impact] !== undefined) counts[v.impact] += 1;
    return {
      ran: true,
      violations: result.violations || [],
      counts,
      incomplete: result.incomplete || 0,
    };
  } catch (err) {
    // A failed AT run must be visible, never silently green. The evaluator
    // turns this into a hole with the error attached.
    return { ran: false, error: String(err?.message || err) };
  }
}
