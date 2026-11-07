// V2 (ask + share at the value moment) - the three doors, at the moment.
//
// The 2026-11-06 flush-out named the primary cause of zero donations: the
// results flow contained no donation, contact or email element at all, and the
// only ask lived ~81% down the DOM after results, hardware list and FAQ. The
// gratitude existed at the outcome card; nothing on it could receive it.
//
// This pins the line itself, not the campaign: three doors under the outcome
// card, in all seven locales, revealed only once a result exists, and the send
// door reusing the one share path rather than growing a second one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const HTML = readFileSync("index.html", "utf8");
const UI = readFileSync("assets/js/sizing/ui.js", "utf8");
const CSS = readFileSync("assets/site.css", "utf8");
const LOCALES = readFileSync("assets/js/shared/locales.js", "utf8");

const LOCALE_IDS = ["en", "es", "pt", "fr", "de", "nl", "ar"];

function occurrences(key) {
  const re = new RegExp(`^[ \\t]*${key}:`, "gm");
  return [...LOCALES.matchAll(re)].length;
}

test("the ask exists where the value moment is, and only after a result", () => {
  assert.match(
    HTML,
    /id="valueMomentAsk"/,
    "the line must exist in the markup",
  );
  // Hidden in markup: an ask that greets the visitor before their result is a
  // banner, and this is deliberately not a banner.
  const tag = HTML.slice(
    HTML.indexOf('id="valueMomentAsk"') - 200,
    HTML.indexOf('id="valueMomentAsk"') + 200,
  );
  assert.match(tag, /hidden/, "it must start hidden");
  assert.match(
    UI,
    /vmAsk\.hidden = false;/,
    "renderResults must reveal it with the result",
  );
});

test("it carries exactly the three doors, wired to real destinations", () => {
  // chip in -> the support section that already exists
  assert.match(HTML, /id="vmAskChipIn"[^>]*href="#support"/s);
  assert.match(HTML, /id="support"|id='support'/, "the anchor target exists");
  // tell me it worked -> a real mailbox
  assert.match(
    HTML,
    /id="vmAskWorked"[\s\S]{0,160}mailto:lucasballek@gmail\.com/,
    "the worked door opens a real mailbox",
  );
  // send this result -> the existing share path, not a new one
  assert.match(HTML, /id="vmAskSend"/);
  assert.match(
    UI,
    /vmSend\.addEventListener\("click", copyShareLink\)/,
    "the send door must reuse copyShareLink",
  );
});

test("the ask sells nothing and collects nothing", () => {
  // The house rule is not decoration: no lead capture, no gate, no tracking.
  const start = HTML.indexOf('id="valueMomentAsk"');
  const block = HTML.slice(start, HTML.indexOf("</p>", start));
  assert.doesNotMatch(block, /<form|type="email"|name="email"/i);
  assert.doesNotMatch(block, /utm_|dataLayer|gtag\(/);
  // Exactly three doors.
  assert.equal((block.match(/<(a|button)\b/g) || []).length, 3);
});

test("every locale has the line and its doors", () => {
  for (const key of [
    "valueMomentAskLead",
    "valueMomentAskChipIn",
    "valueMomentAskWorked",
    "valueMomentAskSend",
  ]) {
    assert.equal(
      occurrences(key),
      LOCALE_IDS.length,
      `${key} must exist in all seven locales`,
    );
  }
  // A door translated to an empty string is a door that vanished for that
  // visitor; the lead must still read as an invitation, not a demand.
  const values = [
    ...LOCALES.matchAll(/^[ \t]*valueMomentAsk\w+:[ \t]*\n?[ \t]*"([^"]*)"/gm),
  ].map((m) => m[1]);
  assert.equal(values.length, LOCALE_IDS.length * 4);
  for (const v of values) {
    assert.ok(v.trim().length > 0, "an empty translation loses a door");
  }
});

test("the line is quiet, and hidden until revealed", () => {
  assert.match(CSS, /\.vma\s*\{[\s\S]*?text-muted/);
  // `hidden` works natively here only because .vma sets no display of its own;
  // a display rule would silently out-rank the attribute and show the ask
  // before any result exists.
  const block = CSS.slice(CSS.indexOf(".vma {"));
  const rule = block.slice(0, block.indexOf("}"));
  assert.doesNotMatch(rule, /display\s*:/);
});
