import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { completeQuestionPack, parseLiveAnswers } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-complete.mjs";
import { resolveKeys, liveJevCall } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-live.mjs";
import { acceptLiveJudgment } from "file:///C:/tmp/beco-issue287-proven-criteria-20261023/scripts/lib/jev-run.mjs";
const path = "C:/tmp/beco-phase3-paired-results.json";
const result = JSON.parse(readFileSync(path, "utf8"));
const cwd = "C:/tmp/beco-issue287-proven-criteria-20261023";
const before = JSON.parse(execFileSync("git", ["show", "origin/main:scripts/lib/jev-complete.pack.json"], { cwd, encoding: "utf8" }));
const after = JSON.parse(readFileSync(`${cwd}/scripts/lib/jev-complete.pack.json`, "utf8"));
const questions = completeQuestionPack(before);
for (const [axis, spec] of Object.entries(after.axes)) questions[axis].instructions += ` For the proven level: ${spec.proven_criteria}`;
const wire = await liveJevCall(result.state, questions, resolveKeys("C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo"));
const pin = acceptLiveJudgment({ model: wire.model });
const judgment = pin.accepted && wire.answers ? parseLiveAnswers(wire.answers, before) : null;
result.instruction_variant = { questions, wire, pin, judgment };
writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ model: wire.model, accepted: pin.accepted,
  proven: Object.values(judgment?.live_levels || {}).filter((i) => i === 4).length,
  target: Object.fromEntries(["quality", "performance", "i18n", "translation"].map((a) => [a, { ordinal: before.sentiment.ordinals[judgment?.live_levels[a]], confidence: judgment?.live_confidence[a] }])),
  changed_from_baseline: Object.keys(before.axes).filter((a) => judgment?.live_levels[a] !== result.results[0].judgment?.live_levels[a]) }, null, 2));
