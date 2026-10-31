#!/usr/bin/env node
// Master-plan pin gate: docs/plan/MASTER_PLAN.md is immutable unless the same
// change records an amendment. See scripts/lib/plan-pin.mjs for the contract.
//
//   node scripts/check-plan-pin.mjs                 self-consistency only
//   node scripts/check-plan-pin.mjs --base <ref>    + append-only vs <ref>
//   node scripts/check-plan-pin.mjs --print-sha     hash of the plan as-is
//
// Exit 0 = pinned and consistent, 1 = violation, 2 = usage error.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  AMENDMENTS_PATH,
  LEDGER_PATH,
  LOCK_PATH,
  PLAN_PATH,
  checkPlanPin,
  sha256Hex,
} from "./lib/plan-pin.mjs";

function usage(msg) {
  process.stderr.write(`check-plan-pin: ${msg}\n`);
  process.stderr.write(
    "usage: node scripts/check-plan-pin.mjs [--base <git-ref>] [--print-sha]\n",
  );
  process.exit(2);
}

let baseRef = null;
let printSha = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--base") baseRef = argv[++i] ?? usage("--base needs a ref");
  else if (argv[i] === "--print-sha") printSha = true;
  else usage(`unknown argument ${argv[i]}`);
}

const readHead = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

if (!existsSync(PLAN_PATH))
  usage(`${PLAN_PATH} not found (run from repo root)`);
if (printSha) {
  process.stdout.write(`${sha256Hex(readFileSync(PLAN_PATH, "utf8"))}\n`);
  process.exit(0);
}

const head = {
  plan: readHead(PLAN_PATH),
  lock: readHead(LOCK_PATH) ?? "",
  amendments: readHead(AMENDMENTS_PATH) ?? "",
  ledger: readHead(LEDGER_PATH) ?? "",
};

function gitShow(ref, path) {
  const r = spawnSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
}

let base = null;
if (baseRef) {
  const probe = spawnSync(
    "git",
    ["rev-parse", "--verify", `${baseRef}^{commit}`],
    {
      encoding: "utf8",
    },
  );
  if (probe.status !== 0) usage(`base ref ${baseRef} is not a commit`);
  base = {
    lock: gitShow(baseRef, LOCK_PATH),
    amendments: gitShow(baseRef, AMENDMENTS_PATH),
    ledger: gitShow(baseRef, LEDGER_PATH),
  };
}

const result = checkPlanPin(head, base);
for (const n of result.notes) console.log(`note: ${n}`);
if (!result.ok) {
  for (const e of result.errors) console.error(`PLAN PIN: ${e}`);
  console.error(
    `\nTo amend the plan: edit ${PLAN_PATH}, append an A-NNN entry to ` +
      `${AMENDMENTS_PATH} (before/after hashes from --print-sha, owner ` +
      `approval), and set current_sha256 in ${LOCK_PATH}.`,
  );
  process.exit(1);
}
console.log(`PLAN PIN OK: ${PLAN_PATH} sha256 ${result.sha}`);
