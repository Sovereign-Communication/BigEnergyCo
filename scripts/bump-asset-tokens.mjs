// Single-command asset cache-busting for the immutable /assets/* layer.
//
// Background: Cloudflare serves assets/* with `Cache-Control: immutable 1yr`,
// so every shipped JS/HTML/data change needs a NEW url (?v= token) plus a
// CACHE_VERSION bump in sw.js. Hand-editing tokens across 5+ files has missed
// before (see docs/DEPLOY_RUNBOOK.md) — run this instead:
//
//   node scripts/bump-asset-tokens.mjs [stamp]   # rewrite + bump (default stamp: today)
//   node scripts/bump-asset-tokens.mjs --check   # CI: verify, change nothing
//
// Stamp convention: YYYYMMDD + letter (20260906a). One stamp is applied to
// the WHOLE graph (simpler than per-file stamps, and a release invalidates
// the graph atomically so clients can never mix module versions).
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const CHECK = process.argv.includes("--check");
const stampArg = process.argv.find((a) => /^\d{8}[a-z]$/.test(a));

function jsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "city-data") jsFiles(p, out);
    } else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Browser module graph: every file whose relative-asset references must
// carry ?v=. HTML entry points plus the whole assets/js module tree.
const GRAPH_FILES = [
  join(ROOT, "index.html"),
  join(ROOT, "solar-heatmap", "index.html"),
  ...jsFiles(join(ROOT, "assets", "js")),
];

// First-party module references: static/dynamic imports, Worker URLs,
// classic script tags, stylesheet links. Captures [full, url, token?].
const MODULE_RES = [
  /\bfrom\s*["'](\.[^"']*?\.js)(\?v=([\w]+))?["']/g,
  /\bimport\(\s*["'](\.[^"']*?\.js)(\?v=([\w]+))?["']\s*\)/g,
  /\bnew\s+Worker\(\s*["']([^"']*?\.js)(\?v=([\w]+))?["']/g,
  /<script[^>]+src=["']([^"']*?\.js)(\?v=([\w]+))?["']/g,
  /<link[^>]+href=["']([^"']*?\.css)(\?v=([\w]+))?["']/g,
];
// Runtime data fetches under /assets (city partitions, heatmap grid).
const FETCH_RES = [
  /fetch(?:Impl)?\(\s*[`'"]([^`'"]*?assets\/[^`'"]*?\.json)(\?v=([\w]+))?/g,
];
const isFirstParty = (u) =>
  u.startsWith("./") ||
  u.startsWith("../") ||
  u.startsWith("assets/") ||
  u.startsWith("/assets/");

function currentTokens() {
  const tokens = new Set();
  for (const f of GRAPH_FILES) {
    const text = readFileSync(f, "utf8");
    for (const re of [...MODULE_RES, ...FETCH_RES]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)))
        if (m[3] && isFirstParty(m[1])) tokens.add(m[3]);
    }
  }
  return [...tokens];
}

function nextStamp() {
  if (stampArg) return stampArg;
  const d = new Date();
  const today = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const toks = currentTokens()
    .filter((t) => /^\d{8}[a-z]$/.test(t))
    .sort();
  const sameDay = toks.filter((t) => t.startsWith(today));
  if (!sameDay.length) return `${today}a`;
  const last = sameDay[sameDay.length - 1];
  const letter = String.fromCharCode(last.charCodeAt(8) + 1);
  if (letter > "z")
    throw new Error(
      `stamp letters exhausted for ${today}; pass an explicit stamp`,
    );
  return `${today}${letter}`;
}

function cacheVersion() {
  const sw = join(ROOT, "sw.js");
  const m = readFileSync(sw, "utf8").match(/CACHE_VERSION\s*=\s*"beco-v(\d+)"/);
  if (!m) throw new Error("sw.js CACHE_VERSION not found");
  return { file: sw, version: Number(m[1]) };
}

let failures = 0;
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  failures++;
};

if (CHECK) {
  // (a) no token-less first-party references anywhere in the graph
  for (const f of GRAPH_FILES) {
    const rel = f.replace(ROOT + "/", "");
    const text = readFileSync(f, "utf8");
    for (const re of [...MODULE_RES, ...FETCH_RES]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        if (!isFirstParty(m[1])) continue;
        if (!m[3]) fail(`${rel}: token-less asset reference ${m[1]}`);
      }
    }
  }
  // (b) single-stamp discipline: every token identical
  const toks = currentTokens();
  if (new Set(toks).size > 1)
    fail(`mixed ?v= stamps in graph: ${toks.join(", ")}`);
  if (!toks.length) fail("no ?v= tokens found in graph");
  // (c) CACHE_VERSION format + every SHELL entry exists on disk
  try {
    const { version } = cacheVersion();
    const shell = readFileSync(join(ROOT, "sw.js"), "utf8").match(
      /const SHELL = \[([\s\S]*?)\];/,
    );
    for (const m of (shell?.[1] ?? "").matchAll(/"(\.\/[^"]+)"/g)) {
      const p = join(ROOT, m[1].replace(/^\.\//, ""));
      if (!existsSync(p))
        fail(`sw.js SHELL entry missing on disk: ${m[1]} (beco-v${version})`);
    }
  } catch (e) {
    fail(e.message);
  }
  console.log(
    failures
      ? "asset-token check FAILED"
      : `asset-token check OK (stamp ${toks[0] ?? "n/a"})`,
  );
  process.exit(failures ? 1 : 0);
}

// Rewrite mode.
const stamp = nextStamp();
let touched = 0;
for (const f of GRAPH_FILES) {
  let text = readFileSync(f, "utf8");
  const before = text;
  // 1. unify existing tokens
  text = text.replace(/\?v=[\w]+/g, `?v=${stamp}`);
  // 2. token-less FIRST-PARTY module refs get the stamp (third-party CDN
  // URLs such as unpkg must never be touched)
  const FP = `(?:\\.\\/|\\.\\.\\/|assets\\/|\\/assets\\/)`;
  const modRes = [
    new RegExp(`(\\bfrom\\s*["']${FP}[^"']*?\\.js)(["'])`, "g"),
    new RegExp(`(\\bimport\\(\\s*["']${FP}[^"']*?\\.js)(["']\\s*\\))`, "g"),
    new RegExp(`(\\bnew\\s+Worker\\(\\s*["']${FP}[^"']*?\\.js)(["'])`, "g"),
    new RegExp(`(<script[^>]+src=["']${FP}[^"']*?\\.js)(["'])`, "g"),
    new RegExp(`(<link[^>]+href=["']${FP}[^"']*?\\.css)(["'])`, "g"),
  ];
  for (const re of modRes) text = text.replace(re, `$1?v=${stamp}$2`);
  // 3. token-less /assets data fetches (plain + ${template} URLs)
  text = text.replace(
    /(fetch(?:Impl)?\(\s*[`'"][^`'"]*?assets\/[^`'"]*?\.json)([`'"])/g,
    `$1?v=${stamp}$2`,
  );
  if (text !== before) {
    writeFileSync(f, text);
    touched++;
  }
}
const { file: swFile, version } = cacheVersion();
const swText = readFileSync(swFile, "utf8").replace(
  `beco-v${version}`,
  `beco-v${version + 1}`,
);
writeFileSync(swFile, swText);
console.log(
  `stamp ${stamp}: rewrote ${touched} graph files, sw.js beco-v${version} -> beco-v${version + 1}`,
);
