import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, escapeAttr } from "../assets/js/shared/escape.js";

test("escapeHtml neutralizes markup metacharacters", () => {
  assert.equal(
    escapeHtml("<script>alert(1)</script>"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  assert.equal(escapeHtml("a&b"), "a&amp;b");
  assert.equal(escapeHtml('"quoted"'), "&quot;quoted&quot;");
  assert.equal(escapeHtml("it's"), "it&#39;s");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
});

test("escapeAttr additionally neutralizes backticks", () => {
  assert.equal(escapeAttr("a`b"), "a&#96;b");
  assert.equal(escapeAttr("<x>"), "&lt;x&gt;");
});
