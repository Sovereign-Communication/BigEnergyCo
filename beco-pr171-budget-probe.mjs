import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { serveStatic } from "file:///C:/tmp/beco-pr171-rebase-20261023/scripts/serve-static.mjs";
import { start } from "file:///C:/tmp/beco-pr171-rebase-20261023/scripts/smoke/runtime.mjs";
import { createActions } from "file:///C:/tmp/beco-pr171-rebase-20261023/scripts/smoke/actions.mjs";
import { jevHealthAtDocumentStart } from "file:///C:/tmp/beco-pr171-rebase-20261023/scripts/smoke/jev.js";

const server = await serveStatic({ dir: "C:/tmp/beco-pr171-rebase-20261023/_pages_staging" });
let ctx;
try {
  ctx = await start();
  await ctx.send("Page.addScriptToEvaluateOnNewDocument", { source: jevHealthAtDocumentStart });
  const actions = createActions(ctx);
  await actions.navigate(server.url);
  assert.ok(await actions.chooseHonolulu());
  await actions.setInputs("gridtie");
  assert.ok(await actions.runAndWaitCard(), "initial calculator result required");
  const cap = await ctx.evaluate(`(() => {
    const b = document.getElementById("budgetSlider");
    b.value = b.max;
    const requested = Number(b.value);
    b.dispatchEvent(new Event("input", { bubbles: true }));
    b.dispatchEvent(new Event("change", { bubbles: true }));
    return { requested, afterCommit: Number(b.value) };
  })()`);
  assert.equal(cap.afterCommit, cap.requested, "committing an affordable system preserves the cap");
  const observations = [];
  for (const cut of [87, 121]) {
    const preview = await ctx.evaluate(`(() => {
      const c = document.getElementById("cutSlider"); c.value = "${cut}";
      c.dispatchEvent(new Event("input", { bubbles: true }));
      c.dispatchEvent(new Event("change", { bubbles: true }));
      return Number(document.getElementById("budgetSlider").value);
    })()`);
    assert.equal(preview, cap.requested, `${cut}% preview preserves the cap`);
    assert.ok(await ctx.poll(async () => (await ctx.evaluate("document.body.textContent")).includes(`Your ~${cut}% target`), 120000, 500), `${cut}% worker response`);
    const settled = await ctx.evaluate(`(() => { const b = document.getElementById("budgetSlider"); return { value: Number(b.value), min: Number(b.min), max: Number(b.max), step: Number(b.step) }; })()`);
    observations.push({ cut, preview, settled });
    assert.equal(settled.value, cap.requested, `${cut}% confirmed slice preserves the cap`);
    assert.ok(settled.min <= settled.value && settled.max >= settled.value);
  }
  const result = { passed: true, scope: "local allowlisted build; real worker; Jev endpoint fixture only", cap, observations };
  writeFileSync("C:/tmp/beco-pr171-budget-probe-result.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await ctx?.close();
  await server.close();
}
