// Cloudflare's Email Address Obfuscation rewrites HTML at the edge, which made
// byte parity fail forever on the brand domain. The fix has to be narrow: undo
// exactly the rewrite we have observed and keep failing on everything else.
//
// The two fragments below are VERBATIM from freeoffgridcalculator.com on
// 2026-09-18 (CRLF as served) and from the checkout it was built from, so these
// tests cannot drift into tolerating a rewrite we never actually saw.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalizeHtml,
  decodeCloudflareEmail,
} from "../scripts/lib/platform-rewrites.mjs";

const SERVED_FRAGMENT =
  `<p style="margin-bottom: 1rem">\r\n                You're welcome to email me:\r\n\r\n                ` +
  `<a href="/cdn-cgi/l/email-protection#6e021b0d0f1d0c0f02020b052e09030f0702400d0103" style="color: var(--primary-accent)">` +
  `<span class="__cf_email__" data-cfemail="335f4650524051525f5f565873545e525a5f1d505c5e">[email&#160;protected]</span></a\r\n                >\r\n              </p>`;

const LOCAL_FRAGMENT =
  `<p style="margin-bottom: 1rem">\r\n                You're welcome to email me:\r\n\r\n                ` +
  `<a\r\n                  href="mailto:lucasballek@gmail.com"\r\n                  style="color: var(--primary-accent)"\r\n                  >` +
  `lucasballek@gmail.com</a\r\n                >\r\n              </p>`;

const SERVED_SCRIPT = `<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>`;

const canon = (html, surface = "cloudflare") => canonicalizeHtml(html, surface);

test("REWRITE: the edge's rewrite and our markup canonicalise to one form", () => {
  const served = canon(SERVED_FRAGMENT + SERVED_SCRIPT);
  const local = canon(LOCAL_FRAGMENT);
  assert.equal(
    served.text,
    local.text,
    "the same content either side of the edge must compare equal",
  );
  assert.deepEqual(served.tolerated.sort(), [
    "injected email-decode script",
    "obfuscated mailto link",
  ]);
  assert.deepEqual(
    local.tolerated,
    [],
    "our own markup is not a platform rewrite and must not be reported as one",
  );
});

test("REWRITE: the tolerance is scoped to the rewriting surface", () => {
  // Off Cloudflare there is no rewrite to undo, so the same two fragments must
  // still differ. Without this the change would be a blanket HTML exemption.
  const served = canon(SERVED_FRAGMENT, "gh-pages");
  const local = canon(LOCAL_FRAGMENT, "gh-pages");
  assert.notEqual(served.text, local.text);
  assert.deepEqual(served.tolerated, []);
  assert.deepEqual(canon(SERVED_SCRIPT, "local").tolerated, []);
});

test("REWRITE: the email address is still compared, not skipped", () => {
  const changedAddress = LOCAL_FRAGMENT.replace(
    /mailto:[^"]+/,
    "mailto:someone-else@example.com",
  );
  assert.notEqual(
    canon(SERVED_FRAGMENT).text,
    canon(changedAddress).text,
    "a different address on one side must fail, obfuscation or not",
  );
});

test("REWRITE: an edge transform we have not seen is NOT forgiven", () => {
  const unknownScript = `${SERVED_FRAGMENT}<script src="/scary/unknown-injector.js"></script>`;
  assert.ok(
    /\.js/.test(unknownScript) && !unknownScript.includes("/cdn-cgi/scripts/"),
    "the mutation must add a script the canonicaliser cannot recognise",
  );
  assert.notEqual(
    canon(unknownScript).text,
    canon(LOCAL_FRAGMENT).text,
    "only the observed rewrite may be tolerated",
  );
  // Nor a real content change next to the rewritten anchor.
  const edited = SERVED_FRAGMENT.replace(
    "You're welcome to email me:",
    "Email me:",
  );
  assert.notEqual(canon(edited).text, canon(LOCAL_FRAGMENT).text);
});

test("REWRITE: an undecodable payload is left alone so it fails", () => {
  const garbled = SERVED_FRAGMENT.replace(
    /email-protection#[0-9a-f]+/,
    "email-protection#zzzz",
  );
  assert.notEqual(canon(garbled).text, canon(LOCAL_FRAGMENT).text);
});

test("REWRITE: the application's own markup is never touched", () => {
  // Over-removal is the other way this could go wrong: stripping the app's
  // module or an unrelated anchor would make two different builds compare equal.
  const html =
    `<script type="module" src="./assets/js/sizing/ui.js?v=20260917h"></script>` +
    `<script src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script>` +
    `<a href="./blog/">Blog</a><a href="mailto:lucasballek@gmail.com">mail</a>`;
  const out = canonicalizeHtml(html, "cloudflare");
  assert.equal((out.text.match(/<script/g) || []).length, 1);
  assert.match(out.text, /ui\.js\?v=20260917h/);
  assert.match(out.text, /<a href="\.\/blog\/">Blog<\/a>/);
  assert.deepEqual(
    out.tolerated,
    ["injected email-decode script"],
    "only the platform's own injection may be reported",
  );
  // An unclosed element is left alone rather than guessed at.
  const truncated = `${html}<script src="/cdn-cgi/scripts/x/email-decode.min.js">`;
  assert.equal(
    canonicalizeHtml(truncated, "cloudflare").text.includes(
      'email-decode.min.js">',
    ),
    true,
  );
});

test("REWRITE: only HTML is canonicalised — assets keep byte semantics", () => {
  const js = "const a = 1;\r\nconst b = 2;\r\n";
  assert.equal(canon(js).text, "const a = 1;\nconst b = 2;\n");
  assert.deepEqual(canon(js).tolerated, []);
});

test("REWRITE: decoding follows Cloudflare's key-XOR scheme and rejects junk", () => {
  assert.equal(
    decodeCloudflareEmail("6e021b0d0f1d0c0f02020b052e09030f0702400d0103"),
    "lucasballek@gmail.com",
  );
  // The span payload encodes the same address independently.
  assert.equal(
    decodeCloudflareEmail("335f4650524051525f5f565873545e525a5f1d505c5e"),
    "lucasballek@gmail.com",
  );
  for (const junk of ["", "abc", "zz", "6e0", "00", "0011223344"])
    assert.equal(
      decodeCloudflareEmail(junk),
      null,
      `${junk} must not decode to something plausible`,
    );
});
