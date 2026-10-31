import fs from "node:fs";
const path = "scripts/smoke/results.js";
let source = fs.readFileSync(path, "utf8");
const eol = source.includes("\r\n") ? "\r\n" : "\n";
const start = source.indexOf("  // ── Slider cooperation (bill-cut target ⇄ up-front budget) ────────");
const end = source.indexOf("  // ── Controls that CSP no longer lets the markup wire", start);
if (start < 0 || end < 0) throw new Error("obsolete slider smoke section not found");
const lines = [
  "  // ── Independent cut target and up-front budget constraints ──────",
  "  // A budget choice selects an affordable system without changing the",
  "  // target the visitor chose. A later target edit keeps that budget pinned.",
  '  console.log("SMOKE      ── independent slider constraints ──");',
  "  const independence = await evaluate(`(() => {",
  "      const budget = document.getElementById(\"budgetSlider\");",
  "      const cut = document.getElementById(\"cutSlider\");",
  "      const budgetRow = document.getElementById(\"budgetSliderRow\");",
  "      const select = document.getElementById(\"autoTarget\");",
  "      if (!budget || !cut || !budgetRow || budgetRow.style.display === \"none\")",
  "        return { skip: \"no budget slider in this mode\" };",
  "      const cutBeforeBudget = Number(cut.value);",
  "      const targetBeforeBudget = select?.value ?? null;",
  "      budget.value = budget.max;",
  '      budget.dispatchEvent(new Event("input", { bubbles: true }));',
  '      budget.dispatchEvent(new Event("change", { bubbles: true }));',
  "      const cutStayedIndependent = Number(cut.value) === cutBeforeBudget;",
  "      const targetStayedIndependent = !select || select.value === targetBeforeBudget;",
  "      const pinnedBudget = Number(budget.value);",
  "      const requestedCut = cutBeforeBudget < 143 ? cutBeforeBudget + 7 : cutBeforeBudget - 7;",
  "      cut.value = String(requestedCut);",
  '      cut.dispatchEvent(new Event("input", { bubbles: true }));',
  '      cut.dispatchEvent(new Event("change", { bubbles: true }));',
  '      const expectedTarget = [60, 80, 95].includes(requestedCut) ? "cut" + requestedCut : "custom";',
  "      return {",
  "        cutStayedIndependent,",
  "        targetStayedIndependent,",
  "        cutMoved: Number(cut.value) === requestedCut,",
  "        budgetStayedPinned: Number(budget.value) === pinnedBudget,",
  "        selectMatches: !select || select.value === expectedTarget,",
  "        budgetWithinRange: Number(budget.value) >= Number(budget.min) && Number(budget.value) <= Number(budget.max),",
  "        cutBeforeBudget,",
  "        requestedCut,",
  "        pinnedBudget,",
  "      };",
  "    })()`);",
  "  if (independence && independence.skip) {",
  '    console.log(`SMOKE       ${independence.skip}`);',
  "  } else {",
  "    gate(",
  '      "budget change keeps the independent bill-cut target",',
  "      independence.cutStayedIndependent === true && independence.targetStayedIndependent === true,",
  "      JSON.stringify(independence),",
  "    );",
  '    gate("bill-cut target and the form select agree", independence.selectMatches === true);',
  '    gate("cut change keeps the chosen budget pinned", independence.cutMoved === true && independence.budgetStayedPinned === true, JSON.stringify(independence));',
  '    gate("budget thumb stays inside the curve\'s span", independence.budgetWithinRange === true, JSON.stringify(independence));',
  "  }",
  "",
].join(eol);
source = source.slice(0, start) + lines + source.slice(end);
fs.writeFileSync(path, source, "utf8");

const testPath = "tests/budget-target-independence.test.mjs";
let tests = fs.readFileSync(testPath, "utf8");
const append = [
  "",
  'const smoke = fs.readFileSync("scripts/smoke/results.js", "utf8");',
  "",
  'test("real-browser smoke asserts independent budget and cut selections", () => {',
  '  assert.match(smoke, /budget change keeps the independent bill-cut target/);',
  '  assert.match(smoke, /cut change keeps the chosen budget pinned/);',
  '  assert.doesNotMatch(smoke, /budgetFollowedCut|budget pick moves the bill-cut target/);',
  "});",
  "",
].join(eol);
if (/real-browser smoke asserts independent budget and cut selections/.test(tests)) throw new Error("smoke test already present");
tests += append;
fs.writeFileSync(testPath, tests, "utf8");
