import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = join(ROOT, "scripts", "check-provenance.mjs");
const REGISTRY = join(ROOT, "assets", "data", "provenance.json");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const reg = JSON.parse(readFileSync(REGISTRY, "utf8"));

/** Run the gate against a mutated registry. */
function gateAgainst(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "beco-provenance-"));
  try {
    const copy = JSON.parse(readFileSync(REGISTRY, "utf8"));
    mutate(copy);
    const file = join(dir, "provenance.json");
    writeFileSync(file, JSON.stringify(copy, null, 2));
    try {
      execFileSync(process.execPath, [GATE], {
        cwd: ROOT,
        env: { ...process.env, PROVENANCE_OVERRIDE: file },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, out: "" };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the provenance gate reads the registry it is asked to read", () => {
  const src = readFileSync(GATE, "utf8");
  assert.match(
    src,
    /PROVENANCE_OVERRIDE/,
    "without an override the gate cannot be mutation-checked",
  );
});

// ── wiring ─────────────────────────────────────────────────────────────────
test("the provenance gate is wired into npm run seo and has its own script", () => {
  assert.match(pkg.scripts.seo, /check-provenance\.mjs/);
  assert.equal(
    pkg.scripts["gate:provenance"],
    "node scripts/check-provenance.mjs",
  );
});

// ── the committed registry passes its own gate ─────────────────────────────
test("the committed registry passes the provenance gate", () => {
  const out = execFileSync(process.execPath, [GATE], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.match(out, /provenance: OK/);
});

// ── the facet's own clauses, mutation-checked ──────────────────────────────
test("a value with no publisher must be graded unknown and say why", () => {
  const r = gateAgainst((c) => {
    const a = c.assumptions.find((x) => x.source === null);
    a.grade = "B";
  });
  assert.notEqual(r.code, 0, "an unsourced value cannot claim a grade");
  assert.match(r.out, /has no source but is graded/);
});

test("an unsourced value with no explanation fails", () => {
  const r = gateAgainst((c) => {
    const a = c.assumptions.find((x) => x.source === null);
    a.disclosure = "estimate";
  });
  assert.notEqual(r.code, 0, "silence is not an explanation");
  assert.match(r.out, /must say what it is instead/);
});

test("a citation missing its publisher fails — a link a visitor cannot check is not a citation", () => {
  const r = gateAgainst((c) => {
    c.sources.nasa_power.publisher = "";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /has no publisher/);
});

test("a citation with no date fails", () => {
  const r = gateAgainst((c) => {
    c.sources.nasa_power.as_of = "";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /has no as_of/);
});

test("a citation that is not an openable https URL fails", () => {
  const r = gateAgainst((c) => {
    c.sources.eia_retail.url = "EIA price tables";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /not an https URL/);
});

test("an assumption citing a source id that does not exist fails", () => {
  const r = gateAgainst((c) => {
    c.assumptions.find((x) => x.source !== null).source = "who_knows";
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /which the registry does not define/);
});

test("a source nobody cites fails, so the registry cannot grow decorative entries", () => {
  const r = gateAgainst((c) => {
    c.sources.decorative = {
      publisher: "Nobody",
      title: "Nothing",
      url: "https://example.com/",
      as_of: "2026-10-05",
      license: "none",
    };
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /is defined but no assumption cites it/);
});

// The drift clause, which is the one this cluster is really about.
test("a registry entry naming a symbol that no longer exists fails", () => {
  const r = gateAgainst((c) => {
    c.assumptions[0].used_by = ["assets/js/sizing/nasa.js:POWER_HOURLY_URL"];
    c.assumptions[1].used_by = ["assets/js/sizing/pricing.js:DELETED_SYMBOL"];
  });
  assert.notEqual(
    r.code,
    0,
    "a registry that outlived its code is a stale record",
  );
  assert.match(r.out, /is no longer in the file/);
});

test("an assumption family that lists nothing it is used by fails", () => {
  const r = gateAgainst((c) => {
    c.assumptions[0].used_by = [];
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /lists no used_by symbols/);
});

test("a repeated assumption id fails", () => {
  const r = gateAgainst((c) => {
    c.assumptions.push(JSON.parse(JSON.stringify(c.assumptions[0])));
  });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /repeats one/);
});

// ── the product has to point a visitor at the audit trail ──────────────────
test("a shipped page links the registry, so a visitor can open it", () => {
  const idx = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(
    idx,
    /href="\.\/assets\/data\/provenance\.json"/,
    "the provenance link is the whole point: an audit trail nobody is shown is not one",
  );
});

test("the sources card is translated in every locale", () => {
  const src = readFileSync(
    join(ROOT, "assets", "js", "shared", "locales.js"),
    "utf8",
  );
  for (const key of [
    "sourcesCardTitle",
    "sourcesCardBody",
    "sourcesCardLink",
  ]) {
    const n = (src.match(new RegExp(`${key}:`, "g")) || []).length;
    assert.equal(n, 6, `${key} must exist in all six locales, found ${n}`);
  }
});

// ── the registry itself, read rather than trusted ─────────────────────────
test("every assumption family names what a visitor actually sees", () => {
  for (const a of reg.assumptions) {
    assert.ok(
      a.shown_as && a.shown_as.length > 3,
      `${a.id} says what it is shown as`,
    );
  }
});

test("the registry grades its own citations, and A means the publisher's figure is ours", () => {
  assert.ok(reg.grades?.A?.includes("IS the value we ship"));
  for (const a of reg.assumptions) {
    if (a.grade !== "A") continue;
    const src = reg.sources[a.source];
    assert.ok(
      src && /^https:\/\//.test(src.url),
      `${a.id} claims the publisher's figure IS ours, so it must be openable`,
    );
  }
});
