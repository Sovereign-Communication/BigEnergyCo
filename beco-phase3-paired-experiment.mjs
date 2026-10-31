import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { buildStateText, completeQuestionPack, mergeEvidence, parseLiveAnswers } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-complete.mjs";
import { resolveKeys, liveJevCall } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-live.mjs";
import { acceptLiveJudgment } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-run.mjs";

const cwd = "C:/tmp/beco-issue287-proven-criteria-20261023";
const records = JSON.parse(readFileSync("C:/tmp/beco-phase3-baseline39914620664/jev-evidence.json", "utf8"));
const original = JSON.parse(readFileSync("C:/tmp/beco-phase3-baseline39914620664/jev-report.json", "utf8"));
const beforePack = JSON.parse(execFileSync("git", ["show", "origin/main:scripts/lib/jev-complete.pack.json"], { cwd, encoding: "utf8" }));
const afterPack = JSON.parse(readFileSync(`${cwd}/scripts/lib/jev-complete.pack.json`, "utf8"));
const auto = { sha: records.run.sha, treeClean: original.auto_facts.tree_clean,
  secretsClean: original.auto_facts.secrets_clean, envIgnored: original.auto_facts.env_ignored,
  dirtyPaths: original.auto_facts.dirty_paths };
const state = buildStateText(mergeEvidence(records, auto), auto, Object.keys(beforePack.axes));
const keys = resolveKeys("C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo");
if (!keys.typesafeKey) throw new Error("No local Jev key; no experiment performed");
const results = await Promise.all([beforePack, afterPack].map(async (pack) => {
  const wire = await liveJevCall(state, completeQuestionPack(pack), keys);
  const pin = acceptLiveJudgment({ model: wire.model });
  return { wire, pin, judgment: pin.accepted && wire.answers ? parseLiveAnswers(wire.answers, pack) : null };
}));
const comparisons = Object.fromEntries(Object.keys(beforePack.axes).map((axis) => [axis,
  results.map((r) => ({ ordinal: afterPack.sentiment.ordinals[r.judgment?.live_levels[axis]] ?? null,
    confidence: r.judgment?.live_confidence[axis] ?? null }))]));
const record = { source_main: records.run.sha, source_run: records.run.run_id,
  state_sha256: createHash("sha256").update(state).digest("hex"), state,
  comparison_scope: "one paired prompt experiment; not a main check-run or stability proof",
  generated_at: new Date().toISOString(), comparisons, results };
writeFileSync("C:/tmp/beco-phase3-paired-results.json", JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify({ source_main: record.source_main, state_sha256: record.state_sha256,
  models: results.map((r) => r.wire.model), accepted: results.map((r) => r.pin.accepted),
  proven: results.map((r) => Object.values(r.judgment?.live_levels || {}).filter((i) => i === 4).length),
  targeted: Object.fromEntries(["quality", "performance", "i18n", "translation"].map((a) => [a, comparisons[a]])),
  changed: Object.keys(comparisons).filter((a) => comparisons[a][0].ordinal !== comparisons[a][1].ordinal) }, null, 2));
