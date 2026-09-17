// Regression gates for the quality gate scripts themselves.
//
// A gate that passes on broken input is worse than no gate, so every helper is
// tested both ways: it must accept valid input AND reject the specific
// violation it exists to catch. The static server gets a hermetic end-to-end
// test (temp build dir + real HTTP) because it is what makes the pre-merge
// browser smoke run under the production `_headers` policy.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  attr,
  tags,
  deployedFiles,
  metaContent,
  bodyText,
  wrappedByLabel,
  resolveHref,
  aimsOutsideSite,
  resolvesToDeployed,
  parseCsp,
  cspAllowsHost,
  headersFor,
  parseHeadersFile,
  patternMatches,
  resolveRequestPath,
  placeholders,
  hookCoverage,
  familyGaps,
} from "../scripts/lib/gates.mjs";
import { serveStatic } from "../scripts/serve-static.mjs";

// ── tolerant HTML parsing ───────────────────────────────────────────────────

test("GATE: attr reads Prettier-wrapped, single-quoted and bare attributes", () => {
  const tag = `<meta\n      name="description"\n      content='multi\nline'\n      hidden\n    />`;
  assert.equal(attr(tag, "name"), "description");
  assert.equal(attr(tag, "content"), "multi\nline");
  assert.equal(attr(tag, "hidden"), "", "bare attribute reads as empty string");
  assert.equal(attr(tag, "missing"), null, "absent attribute is null, not ''");
});

test("GATE: tags finds multi-line opening tags", () => {
  const html = `<img\n  src="a.png"\n  alt="a" />\n<img src="b.png" alt="b">`;
  const imgs = tags(html, "img");
  assert.equal(imgs.length, 2);
  assert.match(imgs[0], /a\.png/);
  assert.match(imgs[1], /b\.png/);
});

test("GATE: metaContent ignores attribute order and case", () => {
  const a = `<meta name="description" content="one" />`;
  const b = `<meta CONTENT="two" NAME="Description" />`;
  assert.equal(metaContent(a, "name", "description"), "one");
  assert.equal(metaContent(b, "name", "description"), "two");
  assert.equal(metaContent(a, "name", "robots"), null);
});

test("GATE: bodyText drops script, style and comment content", () => {
  const html = `<h2>Real <b>text</b></h2><script>var x = "not text";</script>
    <style>.a { color: red }</style><!-- hidden -->`;
  const text = bodyText(html);
  assert.match(text, /Real text/);
  assert.doesNotMatch(text, /not text/);
  assert.doesNotMatch(text, /color: red/);
  assert.doesNotMatch(text, /hidden/);
});

test("GATE: wrappedByLabel accepts a wrapping label, rejects a sibling's", () => {
  const wrapping = `<label>Daytime load <input id="kwh" /></label>`;
  assert.equal(wrappedByLabel(wrapping, tags(wrapping, "input")[0]), true);
  const sibling = `<label for="other">Other</label><input id="kwh" />`;
  assert.equal(
    wrappedByLabel(sibling, tags(sibling, "input")[0]),
    false,
    "a closed label above the control must not count",
  );
});

// ── link resolution ─────────────────────────────────────────────────────────

const DEPLOYED = new Set([
  "index.html",
  "about/index.html",
  "solar-heatmap/index.html",
  "assets/site.css",
]);

test("GATE: resolveHref mirrors browser resolution for relative and root hrefs", () => {
  assert.equal(
    resolveHref("../", "about"),
    "",
    "'../' returns to the site root",
  );
  assert.equal(resolveHref("../solar-heatmap/", "about"), "solar-heatmap/");
  assert.equal(resolveHref("/blog/", "about"), "blog/");
  assert.equal(
    resolveHref("assets/site.css?x=1#top", "about"),
    "about/assets/site.css",
  );
  assert.equal(resolveHref("../../etc/passwd", "about"), "../etc/passwd");
});

test("GATE: link targets must be in the deploy allowlist, not just on disk", () => {
  assert.equal(resolvesToDeployed("../", "about", DEPLOYED), true);
  assert.equal(
    resolvesToDeployed("../solar-heatmap/", "about", DEPLOYED),
    true,
  );
  assert.equal(resolvesToDeployed("/assets/site.css", "about", DEPLOYED), true);
  assert.equal(
    resolvesToDeployed("/admin.html", "about", DEPLOYED),
    false,
    "a file that exists locally but is NOT deployed must fail",
  );
  assert.equal(resolvesToDeployed("/nowhere/", "about", DEPLOYED), false);
});

test("GATE: hrefs climbing above the site root are flagged as external", () => {
  assert.equal(aimsOutsideSite("../../etc/passwd", "about"), true);
  assert.equal(aimsOutsideSite("../solar-heatmap/", "about"), false);
  assert.equal(aimsOutsideSite("/blog/", "about"), false);
});

// ── CSP parsing and host allowlisting ───────────────────────────────────────

test("GATE: parseCsp splits directives into source lists", () => {
  const csp = parseCsp(
    "default-src 'self'; script-src 'self' https://unpkg.com; object-src 'none'",
  );
  assert.deepEqual(csp["default-src"], ["'self'"]);
  assert.deepEqual(csp["script-src"], ["'self'", "https://unpkg.com"]);
  assert.deepEqual(csp["object-src"], ["'none'"]);
  assert.deepEqual(parseCsp(""), {});
});

test("GATE: cspAllowsHost honors exact hosts and *-wildcards only", () => {
  const sources = [
    "'self'",
    "https://power.larc.nasa.gov",
    "https://*.workers.dev",
  ];
  assert.equal(cspAllowsHost(sources, "power.larc.nasa.gov"), true);
  assert.equal(cspAllowsHost(sources, "api.bigenergyco.workers.dev"), true);
  assert.equal(
    cspAllowsHost(sources, "workers.dev"),
    false,
    "a wildcard does not match its own apex",
  );
  assert.equal(cspAllowsHost(sources, "evil.example"), false);
  assert.equal(
    cspAllowsHost(sources, "power.larc.nasa.gov.evil.example"),
    false,
  );
});

test("GATE: _headers rules parse and later rules win per header name", () => {
  const rules = parseHeadersFile(
    [
      "# comment",
      "/assets/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Cache-Control: public, max-age=0, must-revalidate",
    ].join("\n"),
  );
  assert.equal(rules.length, 2);
  assert.equal(rules[0].pattern, "/assets/*");
  const assetHeaders = headersFor("/assets/js/ui.js", rules);
  assert.equal(assetHeaders.get("x-content-type-options"), "nosniff");
  assert.equal(
    assetHeaders.get("cache-control"),
    "public, max-age=0, must-revalidate",
    "the later /* rule overrides the asset rule for the same header",
  );
  assert.equal(headersFor("/blog/", rules).has("cache-control"), true);
});

test("GATE: header patterns match the way the host matches them", () => {
  assert.equal(patternMatches("/assets/*", "/assets/js/sizing/ui.js"), true);
  assert.equal(patternMatches("/*", "/"), true, "the root path must match");
  assert.equal(patternMatches("/*.html", "/blog/index.html"), true);
  assert.equal(patternMatches("/blog/*", "/about/index.html"), false);
});

test("GATE: request paths can never escape the served build root", () => {
  const root = join(tmpdir(), "beco-root-probe");
  assert.equal(resolveRequestPath(root, "/%2e%2e%2fsecret.txt"), null);
  assert.equal(resolveRequestPath(root, "/../secret.txt"), null);
});

// ── i18n helpers ────────────────────────────────────────────────────────────

test("GATE: placeholders compares sets, not order", () => {
  assert.equal(placeholders("{a} of {b}"), placeholders("{b}/{a}"));
  assert.notEqual(placeholders("{a}"), placeholders("{a}{b}"));
  assert.equal(placeholders("no placeholders"), "");
});

test("GATE: hookCoverage separates untranslated hooks from markup typos", () => {
  const { gaps, unresolved } = hookCoverage(
    { en: {}, es: { a: "uno" }, de: { a: "eins" } },
    ["a", "typo"],
  );
  assert.deepEqual(gaps.es, ["typo"], "the translated hook is not a gap");
  assert.deepEqual(gaps.de, ["typo"]);
  assert.deepEqual(
    unresolved,
    ["typo"],
    "a hook no locale defines is a typo in the markup, not a translation gap",
  );

  // Non-vacuity: one missing translation must surface for that locale only.
  const partial = hookCoverage({ en: {}, es: { a: "uno" }, de: {} }, ["a"]);
  assert.deepEqual(partial.gaps.de, ["a"]);
  assert.deepEqual(partial.gaps.es, []);
  assert.deepEqual(partial.unresolved, []);
});

test("GATE: familyGaps catches a runtime mode missing in one locale", () => {
  const gaps = familyGaps({
    en: { baseGrid: "g", baseOffgrid: "o" },
    es: { baseGrid: "g", baseOffgrid: "o" },
    de: { baseGrid: "g" }, // the Offgrid verdict was never translated
  });
  assert.deepEqual(gaps.de, ["baseOffgrid"]);
  assert.deepEqual(gaps.es, []);
  assert.equal(
    gaps.en,
    undefined,
    "en is the source markup for hooks, so it is exempt",
  );
});

// ── CSP hardening invariants (the shipped tree, not a fixture) ──────────────
// These read the real deploy allowlist and the real _headers, because the
// thing being protected is "no page may ever need 'unsafe-inline' again".

/** Every executable inline script block in a document (JSON-LD is data). */
const inlineScripts = (html) =>
  tags(html, "script").filter((tag) => {
    if (attr(tag, "src")) return false;
    return (attr(tag, "type") || "").toLowerCase() !== "application/ld+json";
  });

/** Every on* event-handler attribute in a document. */
const inlineHandlers = (html) => html.match(/\son[a-z]+\s*=/gi) || [];

test("GATE: no deployed page ships an inline script or an on* handler", () => {
  const pages = deployedFiles().filter((f) => f.endsWith(".html"));
  assert.ok(pages.length > 50, "page discovery must not silently go empty");
  const offenders = [];
  for (const page of pages) {
    const html = readFileSync(page, "utf8");
    for (const tag of inlineScripts(html))
      offenders.push(`${page}: ${tag.replace(/\s+/g, " ").slice(0, 60)}`);
    for (const attrText of inlineHandlers(html))
      offenders.push(`${page}: ${attrText.trim()}`);
  }
  assert.deepEqual(offenders, []);

  // Non-vacuity: the detectors must actually fire on markup that has them.
  assert.equal(inlineScripts("<script>run()</script>").length, 1);
  assert.equal(
    inlineScripts('<script type="application/ld+json">{}</script>').length,
    0,
    "JSON-LD is data, not an executable block",
  );
  assert.equal(inlineScripts('<script src="./a.js?v=1"></script>').length, 0);
  assert.equal(inlineHandlers('<button onclick="go()">x</button>').length, 1);
  assert.equal(
    inlineHandlers('<button aria-expanded="false">x</button>').length,
    0,
  );
});

test("GATE: the shipped CSP closes script-src and sets cross-origin isolation", () => {
  const rules = parseHeadersFile(readFileSync("_headers", "utf8"));
  const csp = parseCsp(headersFor("/", rules).get("content-security-policy"));
  assert.ok(csp["script-src"]?.length, "script-src must be declared");
  assert.equal(
    csp["script-src"].includes("'unsafe-inline'"),
    false,
    "'unsafe-inline' must not come back into script-src",
  );
  assert.equal(csp["script-src"].includes("'unsafe-eval'"), false);
  const headers = headersFor("/", rules);
  assert.match(
    headers.get("cross-origin-opener-policy") || "",
    /^same-origin$/i,
  );
  assert.match(
    headers.get("cross-origin-resource-policy") || "",
    /^same-origin$/i,
  );

  // Style attributes still need the style-src exception, and that must not be
  // confused with script-src being open again.
  assert.equal(csp["style-src"].includes("'unsafe-inline'"), true);
});

test("GATE: the heatmap app runs from a versioned module, not the markup", () => {
  const page = readFileSync("solar-heatmap/index.html", "utf8");
  assert.deepEqual(inlineScripts(page), []);
  const ref = tags(page, "script")
    .map((tag) => attr(tag, "src"))
    .find((src) => src && src.includes("heatmap.js"));
  assert.ok(ref, "the page must load the extracted app");
  assert.match(ref, /^\.[^?]*\/assets\/js\/heatmap\.js\?v=\d{8}[a-z]$/);
  // If the module is not the app, the extraction was vacuous.
  const app = readFileSync("assets/js/heatmap.js", "utf8");
  assert.match(
    app,
    /L\.map\(/,
    "the extracted module must still build the map",
  );
  assert.match(app, /heatmap-grid\.json\?v=/);
});

// ── static server: the policy the smoke test runs under ─────────────────────

test("GATE: serve-static applies _headers, serves assets, blocks traversal", async () => {
  const root = mkdtempSync(join(tmpdir(), "beco-serve-"));
  const outside = mkdtempSync(join(tmpdir(), "beco-outside-"));
  writeFileSync(join(outside, "secret.txt"), "TOP SECRET");
  try {
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html lang="en"><body>hello build</body></html>',
    );
    writeFileSync(join(root, "assets", "x.js"), "console.log(1);");
    writeFileSync(
      join(root, "404.html"),
      "<!doctype html><html><body>not found page</body></html>",
    );
    writeFileSync(
      join(root, "_headers"),
      [
        "/assets/*",
        "  Cache-Control: public, max-age=31536000, immutable",
        "/*.html",
        "  Cache-Control: public, max-age=0, must-revalidate",
        "/*",
        "  Content-Security-Policy: default-src 'self'; script-src 'self'",
        "  X-Content-Type-Options: nosniff",
      ].join("\n"),
    );

    const srv = await serveStatic({
      dir: root,
      headersFile: join(root, "_headers"),
    });
    try {
      const home = await fetch(srv.url);
      const homeBody = await home.text();
      assert.equal(home.status, 200);
      assert.match(homeBody, /hello build/);
      assert.match(
        home.headers.get("content-security-policy") || "",
        /default-src 'self'/,
        "the production policy must be applied to local runs",
      );
      assert.equal(home.headers.get("x-content-type-options"), "nosniff");
      assert.match(home.headers.get("cache-control") || "", /must-revalidate/);

      const asset = await fetch(srv.url + "assets/x.js");
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get("content-type") || "", /javascript/);
      assert.match(asset.headers.get("cache-control") || "", /immutable/);

      const missing = await fetch(srv.url + "nope/");
      assert.equal(missing.status, 404);
      assert.match(await missing.text(), /not found page/);

      // Encoded traversal must be refused even though the target exists.
      const escaped = await fetch(srv.url + "%2e%2e/" + "secret.txt");
      assert.equal(escaped.status, 404);
      assert.doesNotMatch(await escaped.text(), /TOP SECRET/);
    } finally {
      await srv.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("GATE: serve-static binds an OS-assigned free port by default", async () => {
  const root = mkdtempSync(join(tmpdir(), "beco-port-"));
  try {
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html lang="en"></html>',
    );
    const a = await serveStatic({ dir: root });
    const b = await serveStatic({ dir: root });
    try {
      assert.ok(a.port > 0 && b.port > 0);
      assert.notEqual(a.port, b.port, "parallel runs must never collide");
    } finally {
      await a.close();
      await b.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
