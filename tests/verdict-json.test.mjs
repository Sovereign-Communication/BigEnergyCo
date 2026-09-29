// The extractor that replaces `JSON.parse(out.slice(out.indexOf("{")))` in the
// tests that read a child's verdict out of its combined output.
//
// Fixtures here are the shapes that actually broke it. The load-bearing one is
// a multi-line `util.inspect` dump on stderr — unquoted keys, a `{` on its own
// line — arriving before the verdict: that is what a `console.error(someObject)`
// looks like, and the old slice-from-the-first-brace parsed it as the JSON.
import { test } from "node:test";
import assert from "node:assert/strict";

import { endOfJsonValue, extractVerdict } from "./verdict-json.mjs";

/** What the tests used to do. Kept so each fixture can prove it is a real trap. */
const oldHeuristic = (out) => JSON.parse(out.slice(out.indexOf("{")));

const VERDICT = {
  base: "http://127.0.0.1:58770/",
  budgetMs: 8000,
  verified: false,
  transientRetries: [
    { step: "parity index.html", attempt: 1, detail: "HTTP 500" },
  ],
  failures: ["verification budget (8s) exhausted"],
};
const printed = (v, eol = "\n") =>
  JSON.stringify(v, null, 2).replaceAll("\n", eol);

// ── the bug this exists for ─────────────────────────────────────────────────

test("a line-leading inspect dump before the verdict no longer eats it", () => {
  // util.inspect of a nested object: a `{` alone on its line, then unquoted keys.
  const dump = ["{", "  step: 'parity index.html',", "  attempt: 1", "}"].join(
    "\n",
  );
  const out = `${dump}\n${printed(VERDICT)}\n`;
  assert.throws(
    () => oldHeuristic(out),
    SyntaxError,
    "the fixture must still be a trap, or this test proves nothing",
  );
  assert.deepEqual(extractVerdict(out, ["verified", "budgetMs"]), VERDICT);
});

test("the same trap with CRLF endings is handled too", () => {
  // Windows is where this was seen, and the CRLF shifts the reported parse
  // position by one — which is the only clue the error ever gave.
  const out = `{\r\n  step: 'parity index.html',\r\n  attempt: 1\r\n}\r\n${printed(VERDICT, "\r\n")}\r\n`;
  assert.throws(() => oldHeuristic(out), SyntaxError);
  assert.deepEqual(extractVerdict(out, ["verified", "budgetMs"]), VERDICT);
});

test("an unbalanced brace on its own line is skipped, not adopted", () => {
  // A log line that opens an object and never closes it would swallow the real
  // verdict under the old rule, because the first brace is all it ever looked at.
  const out = `{ retry budget nearly out\n${printed(VERDICT)}\n`;
  assert.throws(() => oldHeuristic(out), SyntaxError);
  assert.deepEqual(extractVerdict(out, ["verified"]), VERDICT);
});

test("a brace inside an ordinary log line is ignored", () => {
  const out =
    `VERIFY FAIL parity {a,b} of 358 checked\n` +
    `warning: unexpected token { in /tmp/x.mjs\n` +
    `${printed(VERDICT)}\n`;
  assert.throws(() => oldHeuristic(out), SyntaxError);
  assert.deepEqual(extractVerdict(out, ["verified"]), VERDICT);
});

// ── the cases that make it correct, not merely different ────────────────────

test("braces inside strings do not close the document", () => {
  const v = { note: 'a } then a { then " done', path: "C:\\a\\b\\", ok: true };
  const out = `log line\n${printed(v)}\ntrailing log line\n`;
  assert.deepEqual(extractVerdict(out, ["note", "path"]), v);
});

test("an escaped quote does not end the string early", () => {
  const v = { note: 'he said "hi" and left {', ok: true };
  const out = printed(v);
  assert.deepEqual(extractVerdict(out, ["note"]), v);
});

test("nested objects and arrays are returned whole", () => {
  const v = {
    a: { b: { c: [1, 2, { d: "}" }] } },
    verified: true,
  };
  assert.deepEqual(extractVerdict(printed(v), ["a"]), v);
});

test("a compact JSON log line does not outrank the printed verdict", () => {
  // Both are valid documents, so this is the one case keys cannot separate.
  // The verdict is the LAST thing the child prints, so that is the rule.
  const out = `{"level":"warn","msg":"retrying"}\n${printed(VERDICT)}\n`;
  assert.throws(() => oldHeuristic(out), SyntaxError);
  assert.deepEqual(extractVerdict(out), VERDICT);
});

test("a single-line JSON print is found when it is the only document", () => {
  const out = `all good\n${JSON.stringify(VERDICT)}\nbye\n`;
  assert.deepEqual(extractVerdict(out, ["verified"]), VERDICT);
});

test("a bare object at the very start of the buffer is found", () => {
  assert.deepEqual(extractVerdict(printed(VERDICT), ["verified"]), VERDICT);
});

test("a field inside the verdict is not itself a verdict", () => {
  // The payload's last array is a complete JSON document too. Returning it
  // would leave `report.verified` undefined and read as a failed gate rather
  // than a mis-parse, which is the quietest way this can go wrong.
  const v = { verified: true, failures: ["a", "b"], retries: [{ n: 1 }] };
  assert.deepEqual(extractVerdict(printed(v), ["verified"]), v);
  assert.deepEqual(extractVerdict(printed(v)), v);
});

test("a well-formed JSON line that is not the verdict is passed over", () => {
  // A log line that happens to be valid JSON, with none of the verdict's
  // fields: the key requirement is what tells the two apart.
  const out = `{"level":"warn","msg":"retrying"}\n${printed(VERDICT)}\n`;
  assert.deepEqual(extractVerdict(out, ["verified", "budgetMs"]), VERDICT);
});

test("a truncated verdict is not returned as a verdict", () => {
  // The payload is cut off mid-document. Returning the parseable prefix would
  // let a half-read report satisfy the assertions that follow.
  const truncated = printed(VERDICT).slice(0, 60);
  assert.throws(
    () => extractVerdict(truncated, ["verified"]),
    /no JSON verdict/,
  );
});

test("an unparseable document on its own is not a verdict", () => {
  // Balanced braces, invalid JSON: the shape util.inspect prints. Substituting
  // an empty object for a failed parse would hand the assertions an object
  // with every field undefined and call it a report.
  const out = [
    "{",
    "  step: 'parity index.html',",
    "  attempt: 1",
    "}",
    "",
  ].join("\n");
  assert.throws(() => extractVerdict(out, ["verified"]), /no JSON verdict/);
  assert.throws(() => extractVerdict(out), /no JSON verdict/);
});

test("no verdict at all throws and shows what it was looking at", () => {
  assert.throws(
    () => extractVerdict("VERIFY OK  stamp\nnothing here\n", ["verified"]),
    (e) =>
      /no JSON verdict/.test(e.message) &&
      /verified/.test(e.message) &&
      /VERIFY OK/.test(e.message),
  );
});

test("a missing key is a failure, never a silent default", () => {
  // The payload is there and parses, but it is the wrong report. Returning it
  // would let `report.verified` be undefined and read as a falsy verdict.
  const out = printed({ filesChecked: 3, matched: 3 });
  assert.throws(
    () => extractVerdict(out, ["verified", "filesChecked"]),
    /no JSON verdict/,
  );
});

test("a JSON scalar is not a verdict", () => {
  assert.throws(() => extractVerdict("42\nnull\ntrue\n"), /no JSON verdict/);
});

test("the input must be the child's output as a string", () => {
  assert.throws(() => extractVerdict(undefined), TypeError);
  assert.throws(() => extractVerdict(Buffer.from("{}")), TypeError);
});

// ── the scanner underneath, which the extractor is only the front of ───────

test("endOfJsonValue finds the end of a value, or says it cannot", () => {
  const text = '{"a":{"b":[1,2]}} trailing';
  assert.equal(text.slice(0, endOfJsonValue(text, 0)), '{"a":{"b":[1,2]}}');
  assert.equal(
    endOfJsonValue(text, 1),
    -1,
    "a bare string start is not a value",
  );
  assert.equal(endOfJsonValue("{\n  unterminated", 0), -1);
  assert.equal(endOfJsonValue('{"a":1]', 0), -1, "crossed brackets");
  assert.equal(endOfJsonValue("", 0), -1);
  assert.equal(endOfJsonValue("[1,2]", 0), 5, "arrays are values too");
});
