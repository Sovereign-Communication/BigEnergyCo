// Pure core of the master-plan pin — the guard that makes
// docs/plan/MASTER_PLAN.md immutable except through a recorded amendment.
//
// The contract (enforced by scripts/check-plan-pin.mjs in CI, tested
// hermetically by tests/plan-pin.test.mjs):
//   1. sha256(plan, LF-normalized, BOM-stripped) === lock.current_sha256.
//   2. The amendment chain is unbroken: A-001 starts from the genesis hash,
//      every entry starts where the previous one ended, the last one ends at
//      the current hash, ids are sequential, and every entry names who
//      approved it. No amendments => current === genesis.
//   3. Against the base branch (when the caller can supply it): the genesis
//      hash never changes, and AMENDMENTS.md and LEDGER.jsonl only ever grow
//      by appending — history cannot be rewritten in a PR.
//   4. Every LEDGER.jsonl line is a JSON object with a known kind.
//
// No I/O here; the CLI reads files and git objects and passes text in.
import { createHash } from "node:crypto";

export const PLAN_PATH = "docs/plan/MASTER_PLAN.md";
export const LOCK_PATH = "docs/plan/PLAN.lock.json";
export const AMENDMENTS_PATH = "docs/plan/AMENDMENTS.md";
export const LEDGER_PATH = "docs/plan/LEDGER.jsonl";

export const LEDGER_KINDS = [
  "adopted",
  "baseline",
  "phase-start",
  "item-done",
  "phase-done",
  "gate-run",
  "amendment",
  "note",
];

const HEX64 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** LF line endings, no BOM — a Windows checkout must hash identically. */
export function normalizeText(text) {
  return String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

export function sha256Hex(text) {
  return createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}

/** Parse and shape-check the lock file. Throws on a malformed lock. */
export function parseLock(text) {
  let lock;
  try {
    lock = JSON.parse(text);
  } catch (err) {
    throw new Error(`plan lock is not valid JSON: ${err.message}`);
  }
  if (typeof lock !== "object" || lock === null || Array.isArray(lock)) {
    throw new Error("plan lock must be a JSON object");
  }
  if (lock.version !== 1) throw new Error("plan lock version must be 1");
  if (lock.plan !== PLAN_PATH) {
    throw new Error(`plan lock must pin ${PLAN_PATH}`);
  }
  for (const key of ["genesis_sha256", "current_sha256"]) {
    if (!HEX64.test(String(lock[key] || ""))) {
      throw new Error(`plan lock ${key} must be 64 lowercase hex chars`);
    }
  }
  return lock;
}

const FIELD_NAMES = {
  date: "Date",
  approvedBy: "Approved-by",
  before: "Plan-SHA256-before",
  after: "Plan-SHA256-after",
  sections: "Sections",
  rationale: "Rationale",
};

/**
 * Parse AMENDMENTS.md. Entries are `## A-NNN: title` headings followed by
 * `- Field: value` bullets. Text before the first entry is preamble.
 */
export function parseAmendments(text) {
  const entries = [];
  const lines = normalizeText(text).split("\n");
  let current = null;
  for (const line of lines) {
    const head = line.match(/^## (A-(\d{3})):\s*(.+)$/);
    if (head) {
      current = { id: head[1], n: Number(head[2]), title: head[3].trim() };
      entries.push(current);
      continue;
    }
    if (/^## /.test(line)) {
      current = null; // a non-amendment section ends the entry
      continue;
    }
    if (!current) continue;
    const field = line.match(/^- ([A-Za-z0-9-]+):\s*(.*)$/);
    if (!field) continue;
    for (const [key, name] of Object.entries(FIELD_NAMES)) {
      if (field[1] === name) current[key] = field[2].trim();
    }
  }
  return entries;
}

/** Validate the amendment chain from genesis to current. Returns errors. */
export function checkAmendmentChain(entries, genesis, current) {
  const errors = [];
  if (entries.length === 0) {
    if (genesis !== current) {
      errors.push(
        "plan hash moved off genesis with no amendment recorded in " +
          AMENDMENTS_PATH,
      );
    }
    return errors;
  }
  let expectedBefore = genesis;
  entries.forEach((e, i) => {
    const want = i + 1;
    if (e.n !== want) {
      errors.push(`${e.id}: expected A-${String(want).padStart(3, "0")}`);
    }
    for (const [key, name] of Object.entries(FIELD_NAMES)) {
      if (!e[key]) errors.push(`${e.id}: missing "- ${name}:" field`);
    }
    if (e.date && !ISO_DATE.test(e.date)) {
      errors.push(`${e.id}: Date must be YYYY-MM-DD`);
    }
    if (e.approvedBy && !/^@[A-Za-z0-9-]+/.test(e.approvedBy)) {
      errors.push(`${e.id}: Approved-by must name a GitHub @handle`);
    }
    if (e.before && e.before !== expectedBefore) {
      errors.push(
        `${e.id}: Plan-SHA256-before ${e.before} does not continue the ` +
          `chain (expected ${expectedBefore})`,
      );
    }
    if (e.after && !HEX64.test(e.after)) {
      errors.push(`${e.id}: Plan-SHA256-after must be 64 lowercase hex`);
    }
    if (e.before && e.after && e.before === e.after) {
      errors.push(`${e.id}: an amendment must change the plan hash`);
    }
    expectedBefore = e.after || expectedBefore;
  });
  const last = entries[entries.length - 1];
  if (last.after && last.after !== current) {
    errors.push(
      `last amendment ${last.id} ends at ${last.after} but the lock pins ` +
        `${current}`,
    );
  }
  return errors;
}

/** Every non-blank ledger line must be a known-kind JSON object. */
export function checkLedger(text) {
  const errors = [];
  normalizeText(text)
    .split("\n")
    .forEach((line, i) => {
      if (!line.trim()) return;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        errors.push(`${LEDGER_PATH}:${i + 1}: not valid JSON`);
        return;
      }
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        errors.push(`${LEDGER_PATH}:${i + 1}: must be a JSON object`);
        return;
      }
      if (!ISO_DATE.test(String(row.ts || "").slice(0, 10))) {
        errors.push(`${LEDGER_PATH}:${i + 1}: ts must start with YYYY-MM-DD`);
      }
      if (!LEDGER_KINDS.includes(row.kind)) {
        errors.push(
          `${LEDGER_PATH}:${i + 1}: kind must be one of ${LEDGER_KINDS.join("|")}`,
        );
      }
      for (const key of ["ref", "summary"]) {
        if (typeof row[key] !== "string" || !row[key].trim()) {
          errors.push(
            `${LEDGER_PATH}:${i + 1}: ${key} must be a non-empty string`,
          );
        }
      }
    });
  return errors;
}

/** Head must equal base plus appended text (append-only history). */
export function isAppendOnly(baseText, headText) {
  const base = normalizeText(baseText).replace(/\n+$/, "");
  const head = normalizeText(headText);
  return head.startsWith(base);
}

/**
 * Full check. `head` = {plan, lock, amendments, ledger} texts at HEAD;
 * `base` = same shape from the base branch, or null when unavailable (the
 * PR that introduces the plan has no base copy to compare against).
 */
export function checkPlanPin(head, base = null) {
  const errors = [];
  const notes = [];
  let lock;
  try {
    lock = parseLock(head.lock);
  } catch (err) {
    return { ok: false, errors: [err.message], notes, sha: null };
  }
  const sha = sha256Hex(head.plan);
  if (sha !== lock.current_sha256) {
    errors.push(
      `${PLAN_PATH} hashes to ${sha} but ${LOCK_PATH} pins ` +
        `${lock.current_sha256} — the plan is immutable; change it only ` +
        `through a recorded amendment (see ${AMENDMENTS_PATH})`,
    );
  }
  errors.push(
    ...checkAmendmentChain(
      parseAmendments(head.amendments),
      lock.genesis_sha256,
      lock.current_sha256,
    ),
  );
  errors.push(...checkLedger(head.ledger));

  if (base && base.lock) {
    let baseLock = null;
    try {
      baseLock = parseLock(base.lock);
    } catch {
      notes.push("base lock unreadable; genesis comparison skipped");
    }
    if (baseLock && baseLock.genesis_sha256 !== lock.genesis_sha256) {
      errors.push(
        "genesis_sha256 changed — the adopted plan's origin is fixed",
      );
    }
    if (
      base.amendments != null &&
      !isAppendOnly(base.amendments, head.amendments)
    ) {
      errors.push(`${AMENDMENTS_PATH} must be append-only relative to base`);
    }
    if (base.ledger != null && !isAppendOnly(base.ledger, head.ledger)) {
      errors.push(`${LEDGER_PATH} must be append-only relative to base`);
    }
  } else {
    notes.push("no base plan to compare (adoption PR or no --base given)");
  }
  return { ok: errors.length === 0, errors, notes, sha };
}
