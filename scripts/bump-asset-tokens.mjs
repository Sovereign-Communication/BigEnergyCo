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
//
// Why check (d) exists. Checks (a)-(c) only prove the token is PRESENT and
// CONSISTENT. None of them asks whether it is still TRUE — that is, whether the
// bytes behind `?v=20260929a` are the bytes that stamp was minted for. The
// consequence is silent and expensive: `/assets/*` is immutable for a year, so
// a merged change to a referenced asset under an unchanged token is not served
// to anyone whose cache already holds it. A release then reaches first-time
// visitors only, while returning visitors keep the old advisor rendering and
// the old locale dictionary — with every gate green.
//
// So (d) compares each referenced asset's content against the commit that
// minted the current stamp. Changed since? The token is stale and the release
// is refused. This is a content comparison, not a convention, so it cannot be
// satisfied by leaving the stamp alone.
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import {
  GRAPH_PATHSPEC,
  findStaleAssets,
  gitBlob,
  stampCommit,
} from "./lib/asset-tokens.mjs";

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

// Content pages carry no versioned refs today, but they are first-party HTML:
// the moment one gains a ?v= asset link, the single-stamp discipline must
// cover it, or the immutable /assets/* layer serves it stale for a year.
function htmlFiles(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "city-data") continue;
        out.push(...htmlFiles([p]));
      } else if (name.endsWith(".html")) out.push(p);
    }
  }
  return out;
}

// Browser module graph: every file whose relative-asset references must
// carry ?v=. HTML entry points plus the whole assets/js module tree.
const GRAPH_FILES = [
  join(ROOT, "index.html"),
  join(ROOT, "solar-heatmap", "index.html"),
  ...htmlFiles([
    join(ROOT, "about"),
    join(ROOT, "blog"),
    join(ROOT, "solar-calculator"),
  ]),
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

// Every first-party asset the graph points at, resolved to a repo-relative
// path. Returns a Map<assetPath, token> so a single asset referenced from many
// pages is reported once.
//
// Resolution mirrors how a browser resolves the URL: `./x` and `../x` are
// relative to the FILE THAT REFERENCES THEM, while `assets/…` and `/assets/…`
// are already root-relative.
function referencedAssets() {
  const out = new Map();
  for (const f of GRAPH_FILES) {
    if (!existsSync(f)) continue;
    const text = readFileSync(f, "utf8");
    for (const re of [...MODULE_RES, ...FETCH_RES]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const url = m[1];
        if (!isFirstParty(url)) continue;
        // Runtime-built URLs (city partitions) have no single file behind them,
        // so there is no blob to compare. Skipped deliberately rather than
        // guessed at.
        if (url.includes("${")) continue;
        let p;
        if (url.startsWith("/assets/")) p = url.slice(1);
        else if (url.startsWith("assets/")) p = url;
        else p = relative(ROOT, join(dirname(f), url));
        // MUST be repo-relative with forward slashes. An absolute Windows path
        // makes `git show <rev>:<path>` fail, which would silently classify
        // every asset as "new" and turn this whole check into a green light.
        const rel = p.split("\\").join("/");
        if (rel.startsWith("../") || !out.has(rel))
          out.set(rel, m[3] || "(token-less)");
      }
    }
  }
  return out;
}

// The stamp's setter and the blob accessor both live in lib/asset-tokens.mjs
// so they can be unit-tested without executing this rewriting script.

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
  // (d) STALENESS: the stamp must still describe the bytes behind it.
  //
  // Git blobs are compared to git blobs, never to the working tree: this repo
  // has core.autocrlf=true on Windows, so reading files from disk would report
  // every asset as changed and the gate would be unpassable on a contributor's
  // machine.
  const assets = referencedAssets();
  if (!assets.size) fail("no first-party asset references found to check");
  else {
    const { sha: setter, short, error } = stampCommit(ROOT, toks[0] ?? "");
    if (error) fail(`stamp staleness could not be determined — ${error}`);
    else {
      const stale = findStaleAssets(assets.keys(), setter, (rev, p) =>
        gitBlob(ROOT, rev, p),
      );
      if (stale.length)
        fail(
          `${stale.length} referenced asset(s) changed but the stamp stayed ` +
            `${toks[0]} (set at ${short}): ${stale.join(", ")}. The /assets/* ` +
            `layer is Cache-Control: immutable 1yr, so these stay stale for ` +
            `every returning visitor. Run: node scripts/bump-asset-tokens.mjs`,
        );
    }
  }
  console.log(
    failures
      ? "asset-token check FAILED"
      : `asset-token check OK (stamp ${toks[0] ?? "n/a"}, ${assets.size} referenced assets verified against the stamp commit)`,
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
