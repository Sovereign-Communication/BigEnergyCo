// Live sanity sweep of the deployed site. Explicit UTF-8 everywhere.
const BASE = "https://bigenergyco.pages.dev/";
let failures = 0;
function check(name, ok) {
  console.log((ok ? "LIVE OK    " : "LIVE FAIL  ") + name);
  if (!ok) failures++;
}

const html = await (
  await fetch(BASE + "?sweep=" + Date.now(), { cache: "no-store" })
).text();

// 1. Characters render correctly.
// NOTE: emoji were deliberately stripped from the static HTML in commit
// 41933fc ("strip all emojis that cause mojibake"); the 🌍 hero tag lives in
// locales.js now, so the HTML checks below assert plain-ASCII copy instead.
check("hero CTA present", html.includes("Start a Free Estimate"));
check("hero tag i18n hook", html.includes('data-i18n="heroTag"'));
check("em-dashes present", html.includes("\u2014"));
check(
  "no mojibake residue",
  !/(\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00f0\u0178)/.test(html),
);
check("no replacement char U+FFFD", !html.includes("\uFFFD"));

// 2. Feature markers from every phase
for (const m of [
  'id="moneyBar"',
  'id="printSheet"',
  "btnShareResult",
  "@media print",
  'rel="canonical"',
  'id="systemGoal"',
  "Cut my bill, stay connected",
  'value="auto" selected',
  "compare all three chemistries by lifetime cost",
  'id="exportRate"',
  "Lead-Acid (AGM)",
  'id="langSelect"',
  // Cumulative 20-year cost chart (Aug 2026)
  'id="cumCostChartWrap"',
  'id="cumCostCanvas"',
  'id="cumCostCaption"',
  // PWA
  'rel="manifest"',
  "./sw.js",
  'name="theme-color"',
  // SEO
  'id="faq"',
  "application/ld+json",
  '"WebApplication"',
])
  check("marker: " + m.slice(0, 40), html.includes(m));

// stale artifacts absent
for (const m of ["$75,185", "netSavingsVal", "851.85", "\u00e2\u20ac"]) {
  check("absent: " + JSON.stringify(m), !html.includes(m));
}

// The entry module is cache-busted with a version token; assert the HTML
// points at one (a frozen token is exactly how stale code ships twice).
const uiUrlMatch = html.match(/assets\/js\/sizing\/ui\.js\?v=([0-9a-z]+)/);
check("ui.js served with a version token", !!uiUrlMatch);
const uiToken = uiUrlMatch ? uiUrlMatch[1] : "";

// 3. Modules serve + contain repaired strings
const mods = [
  ["assets/js/sizing/engine.js", "uprated from ~4500"],
  ["assets/js/sizing/run.js", "nameplateBands"],
  ["assets/js/sizing/sizing-worker.js", "runSizing"],
  ["assets/js/sizing/ui.js", "drawAutoChart"],
  ["assets/js/sizing/money.js", "cumulativeCostSeries"],
  ["assets/js/shared/i18n.js", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"],
  ["assets/js/shared/locales.js", "\u0627\u0644\u0644\u063a\u0629"],
];
for (const [path, needle] of mods) {
  const r = await fetch(BASE + path + "?v=" + (uiToken || Date.now()), {
    cache: "no-store",
  });
  const txt = r.status === 200 ? await r.text() : "";
  check(`module ${path} (+content)`, r.status === 200 && txt.includes(needle));
}
// The worker/run/money chain must carry the same token so the immutable
// HTTP cache and the service worker both miss on every changed asset.
for (const [path, needle] of [
  ["assets/js/sizing/ui.js", "sizing-worker.js?v=" + uiToken],
  ["assets/js/sizing/sizing-worker.js", "run.js?v=" + uiToken],
  ["assets/js/sizing/run.js", "money.js?v=" + uiToken],
]) {
  const r = await fetch(BASE + path + "?v=" + uiToken, { cache: "no-store" });
  const txt = r.status === 200 ? await r.text() : "";
  check(
    `cache chain ${path} (token ${uiToken})`,
    r.status === 200 && txt.includes(needle),
  );
}

// 4. Freenet page is intentionally NOT on Pages (allowlist ships it nowhere;
// it distributes via Freenet/launcher). Blog + 404 + PWA assets must serve.
for (const [p, want] of [
  ["index-freenet.html", 404],
  ["blog/", 200],
  ["404.html", 200],
  ["blog/off-grid-vs-grid-tie-payback/", 200],
  ["sw.js", 200],
  ["manifest.webmanifest", 200],
  ["assets/icon.svg", 200],
  ["assets/js/sizing/profiles.js", 200],
]) {
  const r = await fetch(BASE + p, { cache: "no-store" });
  check(`HTTP ${want}: ${p} (got ${r.status})`, r.status === want);
}

// 5. AI endpoint alive
try {
  const res = await fetch(
    "https://bigenergyco-api.bigenergyco.workers.dev/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", history: [] }),
    },
  );
  const j = await res.json();
  check(
    "AI endpoint reply (" + (j.reply ? j.reply.length : 0) + " chars, brief)",
    res.status === 200 && j.reply && j.reply.length < 1200,
  );
} catch {
  check("AI endpoint reply", false);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL LIVE CHECKS PASSED");
process.exit(failures ? 1 : 0);
