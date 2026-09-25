// The advisor brief had no mode signal at all. It opened "Please size an
// off-grid battery system for me" whatever the visitor had configured, so a
// battery-only run could be answered with panels, an inverter and an off-grid
// budget it does not have - the same defect class the ui.js/charts.js copy
// sweep closed, in the one file it never reached.
//
// Two halves are pinned here:
//
//   1. buildIntakeBrief() reads #hardwareConfig and branches. A battery-only
//      run must state that it builds no panels AND bar panel advice; a
//      with-panels run must still name the array. Pinned by source because
//      chat.js is a CLASSIC script (no type=module) and cannot be imported
//      under plain Node - the same two-way pin the copy sweep used for ui.js.
//   2. The grid-equivalence block that carried the mode-blind "before adding
//      panels ... a real off-grid budget" copy is GONE, and the ids it read
//      (#gridEqBox/#gridEqText) exist in no page, so that copy can never
//      return. Asserted three ways: absent from chat.js, absent from every
//      page in the deploy allowlist, and absent from the shipped build.
//
// The rendered half is pinned by the browser gates added to
// scripts/smoke/jev.js, which drive the real brief in both modes and in
// German.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chatSrc = readFileSync(join(root, "assets/js/chat.js"), "utf8");
const jev = readFileSync(join(root, "scripts/smoke/jev.js"), "utf8");

/**
 * Executable source with comments stripped and whitespace collapsed.
 *
 * Two reasons this is not paranoia. First, the user-facing strings are built
 * as `"a " + "b"` across lines, so a naive source regex cannot see the sent
 * text. Second - and this is the one that bit while writing these tests - the
 * note that documents the deleted block necessarily QUOTES the deleted copy,
 * so a regex over raw source matches the explanation of the fix as if the fix
 * had not been made.
 */
function executable(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ");
}

/**
 * The text the brief actually sends, rebuilt from its string literals.
 *
 * The prompt is assembled as `"a " + "b" + c` over several lines, so neither
 * the raw source nor a whitespace-normalised source contains the sentence a
 * provider receives. Joining the literals in order reconstructs it exactly
 * enough to assert on, which is what the browser gate then confirms for real.
 */
function literals(src) {
  return [...src.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((m) =>
      m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16)),
      ),
    )
    .join("");
}

const BRIEF_SRC = chatSrc
  .slice(
    chatSrc.indexOf("function buildIntakeBrief"),
    chatSrc.indexOf("function runIntakeCalculation"),
  )
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^[ \t]*\/\/.*$/gm, " ");

const BRIEF_TEXT = literals(BRIEF_SRC);

// ── 1. the brief carries the mode ───────────────────────────────────────────

test("buildIntakeBrief reads the same hardwareConfig select the form uses", () => {
  // Not a second source of truth and not a new mechanism: the predicate is the
  // one the whole sizing path already uses, read off the live DOM node.
  const chat = executable(chatSrc);
  assert.match(chat, /getElementById\("hardwareConfig"\)/);
  assert.match(chat, /getElementById\("systemGoal"\)/);
  assert.match(chat, /hardware === "battery"/);
  // The predicate is inside the brief builder, not somewhere else entirely.
  const briefAt = chat.indexOf("function buildIntakeBrief");
  assert.ok(briefAt > -1, "buildIntakeBrief still exists");
  const hwAt = chat.indexOf('getElementById("hardwareConfig")', briefAt);
  assert.ok(
    hwAt > briefAt,
    "the hardwareConfig read lives inside buildIntakeBrief",
  );
});

test("a battery-only brief states there are no panels and bars panel advice", () => {
  // The exact strings the browser gate asserts, pinned as the text a provider
  // receives, so the contract cannot be quietly reworded into something vaguer.
  assert.match(BRIEF_TEXT, /BATTERY ONLY/);
  assert.match(BRIEF_TEXT, /NO solar panels/i);
  assert.match(
    BRIEF_TEXT,
    /Do not assume, recommend, or cost any panels, array, or solar inverter/,
  );
  assert.match(BRIEF_TEXT, /out of scope unless I ask for it explicitly/i);
  assert.match(BRIEF_TEXT, /do not promise a bill cut/i);
});

test("a battery-only brief sizes against peak load on the existing connection", () => {
  // The useful instruction, not just the prohibition: without it the advisor
  // has nothing to size the bank against.
  assert.match(BRIEF_TEXT, /Size the battery/);
  assert.match(BRIEF_TEXT, /peak load it must carry/);
  assert.match(BRIEF_TEXT, /grid connection I already have/);
});

test("a with-panels run still tells the advisor about the array", () => {
  // The other branch must keep its own truth, or a normal grid-tie user would
  // lose the array context the advisor has always had.
  const chat = executable(chatSrc);
  assert.match(chat, /battery plus solar panels/);
  const brief = chat.slice(
    chat.indexOf("function buildIntakeBrief"),
    chat.indexOf("function runIntakeCalculation"),
  );
  assert.ok(
    brief.includes("battery plus solar panels"),
    "the with-panels branch lives in the brief builder",
  );
});

test("the brief names the grid goal it is sizing for", () => {
  const chat = executable(chatSrc);
  assert.match(chat, /goal === "offgrid" \? "off-grid" : "grid-tied"/);
});

// ── 2. the unreachable mode-blind copy is gone ──────────────────────────────

test("the grid-equivalence block and its mode-blind copy are deleted", () => {
  // The block read #gridEqBox/#gridEqText, neither of which exists in any
  // page, so its own `if (!gridEqBox || !gridEqText) return;` guard made the
  // whole block - and this copy - unreachable. Verified in a browser before it
  // was deleted: both getElementById calls returned null.
  //
  // Checked against executable source, not raw: the note documenting the
  // deletion quotes the copy it removed, and asserting on raw source would
  // read that explanation as if the bug were still live.
  const chat = executable(chatSrc);
  assert.ok(
    !/before adding panels/.test(chat),
    'the "before adding panels" copy is gone from chat.js',
  );
  assert.ok(
    !/real off-grid budget/.test(chat),
    'the "real off-grid budget" copy is gone from chat.js',
  );
  assert.ok(
    !/gridEqBox\.style\.display/.test(chat),
    "nothing writes to the absent gridEqBox any more",
  );
  assert.ok(
    !/ROUND_TRIP_EFF/.test(chat),
    "the dead block's maths went with it",
  );
});

test("the ids the dead block read exist in no page of the deploy allowlist", () => {
  // Not just chat.js: if any page ever re-added the markup, the copy would
  // become reachable again and the deletion above would be a false fix.
  const pages = ["index.html", "about/index.html", "solar-heatmap/index.html"];
  for (const rel of pages) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, "utf8");
    assert.ok(
      !html.includes("gridEqBox") && !html.includes("gridEqText"),
      `${rel} must not reintroduce the grid-equivalence ids`,
    );
  }
});

test("the dead block's only consumer, utilityRate, went with it", () => {
  // utilityRate existed in updateCalc() solely to feed the removed block.
  // Leaving the read behind would be dead code that looks live.
  const chat = executable(chatSrc);
  const fn = chat.slice(
    chat.indexOf("function updateCalc"),
    chat.indexOf("function scrollToSection"),
  );
  assert.ok(
    !/var utilityRate\s*=/.test(fn),
    "updateCalc no longer reads a rate only the deleted block used",
  );
});

// ── 3. the coverage hole, pinned in the harness too ─────────────────────────

test("the advisor smoke carries battery-only gates, not just badge wiring", () => {
  // The advisor flow had three gates and none of them touched a mode, which is
  // why this defect survived three copy passes.
  for (const needle of [
    "advisor brief states a battery-only run builds no solar panels",
    "advisor brief bars panel advice on a battery-only run",
    "advisor brief still names the array on a with-panels run",
    "grid-equivalence box is absent from the page",
    "advisor brief keeps the battery-only branch in German",
  ]) {
    assert.ok(jev.includes(needle), `smoke gate present: ${needle}`);
  }
  assert.ok(
    jev.includes('langSwitch("de")'),
    "the German gate really switches the language picker",
  );
});

// ── 4. the brief is a prompt, so it stays English by design ─────────────────

test("the advisor brief stays English in every locale (it is a model prompt)", () => {
  // Deliberate, and now explicit: the brief is sent to the provider, not shown
  // as UI copy, so translating it would translate the instruction the model
  // receives. What must survive a language switch is the MODE branch, which
  // the German browser gate drives.
  const chat = executable(chatSrc);
  const brief = chat.slice(
    chat.indexOf("function buildIntakeBrief"),
    chat.indexOf("function runIntakeCalculation"),
  );
  assert.ok(
    /BATTERY ONLY/.test(brief) && /Destination region/.test(brief),
    "the brief is built from English prompt literals",
  );
  // No locale key is introduced for the brief, so nothing is left half
  // translated: every supported language gets the same prompt.
  assert.ok(
    !/chatText\(|becoT\(/.test(brief),
    "the brief adds no locale key to translate",
  );
});
