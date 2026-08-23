// Live sanity sweep of the deployed site. Explicit UTF-8 everywhere.
const BASE = "https://sovereign-communication.github.io/BigEnergyCo/";
let failures = 0;
function check(name, ok) { console.log((ok ? "LIVE OK    " : "LIVE FAIL  ") + name); if (!ok) failures++; }

const html = await (await fetch(BASE + "?sweep=" + Date.now(), { cache: "no-store" })).text();

// 1. Emoji / characters render correctly
check("🤖 Start a Free Estimate", html.includes("\u{1F916} Start a Free Estimate"));
check("⚡ logo", html.includes("\u26A1 BigEnergy"));
check("🌍 hero tag", html.includes("\u{1F30D} Free for everyone"));
check("em-dashes present", html.includes("\u2014"));
check("no mojibake residue", !/(\u00e2\u20ac|\u00c3[\u0080-\u00ff]|\u00f0\u0178)/.test(html));
check("no replacement char U+FFFD", !html.includes("\uFFFD"));

// 2. Feature markers from every phase
for (const m of [
  'id="moneyBar"', 'id="printSheet"', 'btnShareResult', "@media print",
  'rel="canonical"', 'id="systemGoal"', "Cut my grid bill",
  'value="auto" selected', "compare all three by lifetime cost",
  'id="exportRate"', "Lead-Acid (AGM)", 'data-i18n="heroTag"', 'id="langSelect"',
  "ui.js?v=20260823l",
]) check("marker: " + m.slice(0, 40), html.includes(m));

// stale artifacts absent
for (const m of ["$75,185", "netSavingsVal", "851.85", "\u00e2\u20ac"]) {
  check("absent: " + JSON.stringify(m), !html.includes(m));
}

// 3. Modules serve + contain repaired strings
const mods = [
  ["assets/js/sizing/engine.js", "uprated from ~4500"],
  ["assets/js/sizing/sizing-worker.js", "nameplateBands"],
  ["assets/js/sizing/ui.js", "drawAutoChart"],
  ["assets/js/sizing/money.js", "lifetimeCostUsd"],
  ["assets/js/shared/i18n.js", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"],
  ["assets/js/shared/locales.js", "\u0627\u0644\u0644\u063a\u0629"],
];
for (const [path, needle] of mods) {
  const r = await fetch(BASE + path + "?v=" + Date.now(), { cache: "no-store" });
  const txt = r.status === 200 ? await r.text() : "";
  check(`module ${path} (+content)`, r.status === 200 && txt.includes(needle));
}

// 4. Freenet page is intentionally NOT on Pages (allowlist ships it nowhere;
// it distributes via Freenet/launcher). Blog + 404 must serve.
for (const [p, want] of [["index-freenet.html", 404], ["blog/", 200], ["404.html", 200]]) {
  const r = await fetch(BASE + p, { cache: "no-store" });
  check(`HTTP ${want}: ${p} (got ${r.status})`, r.status === want);
}

// 5. AI endpoint alive
try {
  const res = await fetch("https://bigenergyco-api.bigenergyco.workers.dev/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "hi", history: [] }),
  });
  const j = await res.json();
  check("AI endpoint reply (" + (j.reply ? j.reply.length : 0) + " chars, brief)", res.status === 200 && j.reply && j.reply.length < 1200);
} catch { check("AI endpoint reply", false); }

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL LIVE CHECKS PASSED");
process.exit(failures ? 1 : 0);
