// The master plan is immutable except through a recorded, owner-approved
// amendment. These tests pin the guard in both directions: every way to edit
// the plan silently must fail, and the one legitimate way must pass.
//
// Run: node --test tests/plan-pin.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  LOCK_PATH,
  PLAN_PATH,
  checkAmendmentChain,
  checkLedger,
  checkPlanPin,
  isAppendOnly,
  normalizeText,
  parseAmendments,
  parseLock,
  sha256Hex,
} from "../scripts/lib/plan-pin.mjs";

const PLAN_V1 = "# Plan\n\nDo the thing.\n";
const PLAN_V2 = "# Plan\n\nDo the thing, measured.\n";
const V1 = sha256Hex(PLAN_V1);
const V2 = sha256Hex(PLAN_V2);

const lockText = (genesis, current) =>
  JSON.stringify({
    version: 1,
    plan: PLAN_PATH,
    genesis_sha256: genesis,
    current_sha256: current,
  });

const amendment = (n, before, after, overrides = {}) => {
  const f = {
    Date: "2026-10-01",
    "Approved-by": "@Treystu",
    "Plan-SHA256-before": before,
    "Plan-SHA256-after": after,
    Sections: "§3",
    Rationale: "measured evidence",
    ...overrides,
  };
  const body = Object.entries(f)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  return `## A-${String(n).padStart(3, "0")}: tighten a budget\n\n${body}\n`;
};

const LEDGER_OK =
  '{"ts":"2026-09-25","kind":"adopted","ref":"plan","summary":"adopted"}\n';

const state = (over = {}) => ({
  plan: PLAN_V1,
  lock: lockText(V1, V1),
  amendments: "# Amendments\n",
  ledger: LEDGER_OK,
  ...over,
});

test("PIN: hashing ignores CRLF and a BOM, nothing else", () => {
  assert.equal(sha256Hex("a\r\nb\n"), sha256Hex("a\nb\n"));
  assert.equal(sha256Hex("﻿a\n"), sha256Hex("a\n"));
  assert.notEqual(sha256Hex("a\n"), sha256Hex("a \n"));
  assert.equal(normalizeText("x\ry"), "x\ny");
});

test("PIN: the adopted plan passes with no amendments", () => {
  const r = checkPlanPin(state());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.sha, V1);
});

test("PIN: a silent edit fails even when the lock is left alone", () => {
  const r = checkPlanPin(state({ plan: PLAN_V2 }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /immutable/);
});

test("PIN: re-pinning the lock without an amendment fails", () => {
  const r = checkPlanPin(state({ plan: PLAN_V2, lock: lockText(V1, V2) }));
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /no amendment recorded/);
});

test("PIN: a complete amendment chain is the one legitimate edit", () => {
  const r = checkPlanPin(
    state({
      plan: PLAN_V2,
      lock: lockText(V1, V2),
      amendments: `# Amendments\n\n${amendment(1, V1, V2)}`,
    }),
  );
  assert.deepEqual(r.errors, []);
});

test("PIN: broken chains, gaps and unapproved entries are rejected", () => {
  const V3 = sha256Hex("# Plan v3\n");
  // Chain does not start at genesis.
  let errs = checkAmendmentChain(parseAmendments(amendment(1, V2, V3)), V1, V3);
  assert.match(errs.join("\n"), /does not continue the chain/);
  // Numbering gap.
  errs = checkAmendmentChain(
    parseAmendments(amendment(1, V1, V2) + amendment(3, V2, V3)),
    V1,
    V3,
  );
  assert.match(errs.join("\n"), /expected A-002/);
  // Last entry does not end at the pinned hash.
  errs = checkAmendmentChain(parseAmendments(amendment(1, V1, V2)), V1, V3);
  assert.match(errs.join("\n"), /ends at/);
  // No approver / approver not a handle.
  errs = checkAmendmentChain(
    parseAmendments(amendment(1, V1, V2, { "Approved-by": null })),
    V1,
    V2,
  );
  assert.match(errs.join("\n"), /missing "- Approved-by:"/);
  errs = checkAmendmentChain(
    parseAmendments(amendment(1, V1, V2, { "Approved-by": "the owner" })),
    V1,
    V2,
  );
  assert.match(errs.join("\n"), /@handle/);
  // A no-op amendment.
  errs = checkAmendmentChain(parseAmendments(amendment(1, V1, V1)), V1, V1);
  assert.match(errs.join("\n"), /must change the plan hash/);
  // Bad date.
  errs = checkAmendmentChain(
    parseAmendments(amendment(1, V1, V2, { Date: "Oct 1" })),
    V1,
    V2,
  );
  assert.match(errs.join("\n"), /YYYY-MM-DD/);
});

test("PIN: the lock itself is shape-checked", () => {
  assert.throws(() => parseLock("{"), /not valid JSON/);
  assert.throws(() => parseLock("[]"), /JSON object/);
  assert.throws(
    () => parseLock(JSON.stringify({ version: 2 })),
    /version must be 1/,
  );
  assert.throws(
    () =>
      parseLock(
        JSON.stringify({
          version: 1,
          plan: "PLAN.md",
          genesis_sha256: V1,
          current_sha256: V1,
        }),
      ),
    /must pin/,
  );
  assert.throws(() => parseLock(lockText("abc", V1)), /64 lowercase hex/);
  const r = checkPlanPin(state({ lock: "nope" }));
  assert.equal(r.ok, false);
});

test("LEDGER: each line is a known-kind JSON object", () => {
  assert.deepEqual(checkLedger(LEDGER_OK + "\n"), []);
  assert.match(checkLedger("not json\n").join(), /not valid JSON/);
  assert.match(checkLedger("[1]\n").join(), /JSON object/);
  assert.match(
    checkLedger(
      '{"ts":"2026-09-25","kind":"party","ref":"x","summary":"y"}',
    ).join(),
    /kind must be one of/,
  );
  assert.match(
    checkLedger(
      '{"ts":"yesterday","kind":"note","ref":"x","summary":"y"}',
    ).join(),
    /ts must start/,
  );
  assert.match(
    checkLedger(
      '{"ts":"2026-09-25","kind":"note","ref":"","summary":"y"}',
    ).join(),
    /ref must be/,
  );
});

test("BASE: history is append-only and genesis never moves", () => {
  assert.equal(isAppendOnly("a\nb\n", "a\nb\nc\n"), true);
  assert.equal(isAppendOnly("a\nb", "a\nb\n"), true, "trailing newline ok");
  assert.equal(isAppendOnly("a\nb\n", "a\nc\n"), false);

  const base = {
    lock: lockText(V1, V1),
    amendments: "# Amendments\n",
    ledger: LEDGER_OK,
  };
  // Appending a ledger row is fine.
  let r = checkPlanPin(
    state({
      ledger:
        LEDGER_OK +
        '{"ts":"2026-09-26","kind":"note","ref":"P0","summary":"started"}\n',
    }),
    base,
  );
  assert.deepEqual(r.errors, []);
  // Rewriting a ledger row is not.
  r = checkPlanPin(
    state({ ledger: LEDGER_OK.replace('adopted"}', 'rewritten"}') }),
    base,
  );
  assert.match(r.errors.join("\n"), /LEDGER.jsonl must be append-only/);
  // Moving genesis is not, even with a self-consistent new chain.
  r = checkPlanPin(state({ plan: PLAN_V2, lock: lockText(V2, V2) }), base);
  assert.match(r.errors.join("\n"), /genesis_sha256 changed/);
  // Deleting an amendment is not.
  r = checkPlanPin(state({ amendments: "# Amendments (trimmed)\n" }), {
    ...base,
    amendments: `# Amendments\n\n${amendment(1, V1, V2)}`,
  });
  assert.match(r.errors.join("\n"), /AMENDMENTS.md must be append-only/);
  // No base copy (the adoption PR) is a note, not a failure.
  r = checkPlanPin(state(), { lock: null, amendments: null, ledger: null });
  assert.equal(r.ok, true);
  assert.match(r.notes.join(), /no base plan/);
});

test("REPO: the committed plan is pinned and its history consistent", () => {
  const r = spawnSync(process.execPath, ["scripts/check-plan-pin.mjs"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  assert.equal(sha256Hex(readFileSync(PLAN_PATH, "utf8")), lock.current_sha256);
});

test("CLI: usage errors exit 2, never look green", () => {
  const r = spawnSync(process.execPath, ["scripts/check-plan-pin.mjs", "--x"], {
    encoding: "utf8",
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
  const b = spawnSync(
    process.execPath,
    ["scripts/check-plan-pin.mjs", "--base", "no-such-ref-xyz"],
    { encoding: "utf8" },
  );
  assert.equal(b.status, 2);
});
