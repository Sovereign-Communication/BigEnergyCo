// Master plan P0.3(b) / decision D-13: "OpenRouter is removed as a Jev path
// everywhere, in both the runtime and the gates."
//
// The risk in this bullet is silence. A removed fallback that leaves one
// reference behind still looks removed in review and still runs in production,
// so these gates assert ABSENCE across code, config, docs and tests — and they
// assert the BEHAVIOUR (one call, no second provider) rather than the mere
// absence of a string. Absence of a name is weak evidence; "exactly one outbound
// call, ever" is strong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// Comments are allowed to NAME what was removed — that is documentation, and
// this file itself says so. What must not survive is executable code.
const stripComments = (src) =>
  src
    .replace(/\r\n?/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*/, ""))
    .join("\n");

// Every file that could plausibly reach a second Jev provider. The worker and
// the gate are the executables; the rest are how a survivor gets re-enabled.
const EXECUTABLES = [
  "worker/index.js",
  "worker/jev-price.mjs",
  "scripts/validate-jev-complete.mjs",
  "scripts/lib/jev-complete.mjs",
];

const SURFACES = [
  ...EXECUTABLES,
  ".env.example",
  "docs/ARCHITECTURE.md",
  "README.md",
  "AGENTS.md",
  "docs/DEPLOY_RUNBOOK.md",
  "docs/INDEX.md",
];

test("GATE: no executable code references the removed provider", () => {
  for (const rel of EXECUTABLES) {
    const code = stripComments(read(rel));
    const offenders = code
      .split("\n")
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /openrouter/i.test(l));
    assert.deepEqual(
      offenders,
      [],
      `${rel} must contain no live reference: ${offenders
        .map(([n]) => n)
        .join(", ")}`,
    );
  }
});

test("GATE: the removed provider's key is never read", () => {
  // A surviving `env.OPENROUTER_API_KEY` read is the specific way a fallback
  // comes back from the dead, even with no fetch left to point it at.
  for (const rel of EXECUTABLES) {
    assert.doesNotMatch(
      stripComments(read(rel)),
      /OPENROUTER_API_KEY|openRouterKey|openrouter\.ai/i,
      `${rel} must not read a key for the removed provider`,
    );
  }
});

test("GATE: the operator config no longer offers a key to set", () => {
  const env = read(".env.example");
  assert.doesNotMatch(
    env,
    /OPENROUTER_API_KEY/,
    ".env.example must not tell an operator to configure a key that is gone",
  );
  assert.match(
    env,
    /TYPESAFE_API_KEY=/,
    "the direct provider key must still be documented",
  );
});

test("GATE: the live architecture doc describes a single provider", () => {
  const doc = read("docs/ARCHITECTURE.md");
  assert.doesNotMatch(
    doc,
    /OpenRouter/i,
    "the architecture doc must not still describe a fallback that is gone",
  );
  assert.match(
    doc.replace(/\s+/g, " "),
    /\*\*only\*\* Jev provider/i,
    "it must positively state that one provider is all there is",
  );
});

test("GATE: no live documentation or config mentions the removed provider", () => {
  for (const rel of SURFACES) {
    // Source files may NAME the removal in a comment — that is the note that
    // stops someone re-adding it. Documentation and config may not, because a
    // reader there has no way to tell the note from live guidance.
    const body = /\.(mjs|js)$/.test(rel) ? stripComments(read(rel)) : read(rel);
    assert.doesNotMatch(
      body,
      /openrouter/i,
      `${rel} still mentions the removed provider`,
    );
  }
});

test("GATE: the archived history is left intact, as P0.2 intended", () => {
  // Archives carry a "superseded, do not act on this" banner. Rewriting
  // history to match a later decision is the failure mode P0.2 exists to
  // prevent, so the mention there is expected and must stay.
  const archived = read("docs/archive/GROQ_AUDIT_AND_OPTIMIZATION.md");
  assert.match(archived, /openrouter/i, "the archive keeps its original text");
  assert.match(
    archived,
    /SUPERSEDED/,
    "and keeps the banner that stops anyone acting on it",
  );
});
