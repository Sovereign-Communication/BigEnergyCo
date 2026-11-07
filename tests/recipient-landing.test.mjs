// V2's recipient gap - a shared link lands on the sender's RESULT.
//
// The 2026-11-06 reprioritization named this gap in the owner's own words: a
// shared link carried the inputs, not the outcome, so the recipient's first
// screen was a prefilled form and seeing what the sender saw cost a click plus
// a full simulation. V2's closing receipt is a cold recipient drive.
//
// What is pinned here is the mechanism that makes that drive possible:
//   1. a restored link runs the engine once, on load, without a click;
//   2. only the codec-accepted link can reach that run - a malformed or
//      hostile hash returns false before any work, so an incoming link can
//      never start weather or engine work it did not pass the bounds gate for;
//   3. the run is `explicit`, so the authorization/dirty gates that exist to
//      stop silent background runs cannot swallow it;
//   4. the surface says whose result it is, in all seven locales.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const UI = readFileSync("assets/js/sizing/ui.js", "utf8");
const LOCALES_SRC = readFileSync("assets/js/shared/locales.js", "utf8");
const { LOCALES } = await import("../assets/js/shared/locales.js");

const LOCALE_IDS = ["en", "es", "pt", "fr", "de", "nl", "ar"];

test("a restored share link runs the engine once, on load, explicitly", () => {
  assert.match(
    UI,
    /if \(restoreFromShare\(\)\) run\(false, true\);/,
    "init must run only when restoreFromShare() reported a clean restore, and explicitly",
  );
  // Exactly one load-time call site: a second one would double-run the engine
  // (two weather fetches, two renders) on every opened link.
  const calls = UI.split("if (restoreFromShare())").length - 1;
  assert.equal(calls, 1, "the automatic run must have exactly one call site");
});

test("a malformed or hostile link cannot start work", () => {
  const start = UI.indexOf("function restoreFromShare() {");
  const end = UI.indexOf("// -- Printable summary", start);
  const restore = UI.slice(start, end);
  assert.ok(start > -1 && end > start, "restoreFromShare must exist");
  // The refuse paths return false BEFORE anything runs; the run lives at the
  // call site, gated on that boolean, never inside the restore.
  assert.match(
    restore,
    /if \(!location\.hash\.startsWith\(SHARE_PREFIX\)\) return false;/,
  );
  assert.match(
    restore,
    /if \(!o\) \{\s*setStatus\(t\("invalidShare"\)\);\s*return false;/,
  );
  assert.doesNotMatch(
    restore,
    /\brun\(/,
    "the restore itself must not run the engine; only its true return may",
  );
});

test("the landing says whose result it is, in all seven locales", () => {
  for (const id of LOCALE_IDS) {
    const copy = LOCALES[id]?.shareLoaded;
    assert.ok(copy, `${id}.shareLoaded is missing`);
    assert.ok(copy.trim().length > 20, `${id}.shareLoaded is too thin`);
    // The old copy told the recipient to press Calculate - exactly the
    // prefilled-form landing this test exists to prevent coming back.
    assert.doesNotMatch(
      copy,
      /\b(click|pulsa|clique|cliquez|klicke|klik|انقر)\b/i,
      `${id}.shareLoaded still instructs a click`,
    );
  }
  assert.match(LOCALES.en.shareLoaded, /shared with you/);
});

test("the note stays with the result, not just in the status line", () => {
  // Found by the 2026-11-07 cold recipient drive: the landing copy lived only
  // in the status line, which the run this link triggers replaces with its own
  // progress in under a second, so the reader never learned whose result it
  // was. The note now lives inside the results region and is filled there.
  const html = readFileSync("index.html", "utf8");
  const noteAt = html.indexOf('id="sharedResultNote"');
  const regionAt = html.indexOf('id="resultsRegion"');
  assert.ok(noteAt > -1, "the landing note must exist in the markup");
  assert.ok(
    noteAt > regionAt,
    "the note must live inside the results region, so it appears with them",
  );
  assert.match(
    html.slice(noteAt, noteAt + 80),
    /hidden/,
    "it must start hidden - only an opened share link reveals it",
  );
  const start = UI.indexOf("function restoreFromShare() {");
  const end = UI.indexOf("// -- Printable summary", start);
  const restore = UI.slice(start, end);
  assert.match(restore, /note\.textContent = t\("shareLoaded"\)/);
  assert.match(restore, /note\.hidden = false/);
});

test("the copy is actually wired to the restore event", () => {
  // shareLoaded is the status the recipient sees after a restore, so it is the
  // one string that must describe the new behaviour.
  const start = UI.indexOf("function restoreFromShare() {");
  const end = UI.indexOf("// -- Printable summary", start);
  const restore = UI.slice(start, end);
  assert.match(restore, /setStatus\(t\("shareLoaded"\)\)/);
  // And the key exists once per locale in the source, not just in the export.
  const occurrences = [...LOCALES_SRC.matchAll(/^[ \t]*shareLoaded:/gm)].length;
  assert.equal(occurrences, LOCALE_IDS.length);
});
