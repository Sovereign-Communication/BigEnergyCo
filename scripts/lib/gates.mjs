// Shared pure helpers for the quality gates.
//
// These live apart from the gate scripts on purpose: the scripts run their
// checks as a side effect of being loaded (that is what makes `node
// scripts/check-*.mjs` work), which would make their logic untestable. Keeping
// the parsing and resolution rules here means tests/quality-gates.test.mjs can
// prove each gate actually catches what it claims to — a gate that passes on
// broken input is worse than no gate at all.
import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { posix } from "node:path";
import { deployList } from "./deploy-manifest.mjs";

// ── deploy allowlist discovery ──────────────────────────────────────────────
/**
 * Every file the deploy will actually publish, straight from the single
 * source of truth (scripts/deploy-pages-local.mjs). Checking the working tree
 * instead would happily validate files users never receive.
 */
/**
 * Parse `deploy-pages-local.mjs --list` output. Pure, so the parsing can be
 * tested without spawning anything: every indented line is a deployed path,
 * and the only other output is the header and the closing note. (`_headers`
 * and `_redirects` have no dot, so a "contains a dot" heuristic used to drop
 * two real files.)
 */
export function deployedFilesFrom(stdout) {
  return String(stdout)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "Deployable files:" && !l.startsWith("--"));
}
export function deployedFiles() {
  // Single derivation of the deploy contract: the in-process manifest module.
  // CI runs proved the old CLI subprocess path could transiently return fewer
  // files than the contract (335, then 344, vs 352) — the verifier then
  // guarded a smaller site. The manifest wins; the CLI is kept only as a
  // cross-check whose divergence is captured (never printed to stderr, which
  // corrupts combined-output JSON consumers) and surfaced in verifier reports.
  const manifest = deployList();
  try {
    // --list, not --check: a pure query. --check BUILDS the staging directory
    // (deploy.yml depends on that), so calling it from several gates at once
    // raced on the shared dir and could fail with ENOTEMPTY.
    const out = execSync("node scripts/deploy-pages-local.mjs --list", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    const cli = deployedFilesFrom(out);
    if (
      cli.length !== manifest.length ||
      cli.some((f, i) => f !== manifest[i])
    ) {
      const missing = manifest.filter((f) => !cli.includes(f));
      deploymentDivergences.push({
        cli: cli.length,
        manifest: manifest.length,
        missingFromCli: missing.slice(0, 8),
        extraInCli:
          cli.length > manifest.length
            ? cli.filter((f) => !manifest.includes(f)).slice(0, 4)
            : undefined,
      });
    }
  } catch {
    deploymentDivergences.push({
      cli: null,
      manifest: manifest.length,
      error: true,
    });
  }
  return manifest;
}

/** Observed CLI/manifest divergences since module load (verifier JSON reports these). */
export const deploymentDivergences = [];

// ── tolerant HTML helpers ───────────────────────────────────────────────────
// Prettier puts attributes on their own lines, so everything here works across
// newlines and accepts double-quoted, single-quoted and bare attributes.

/** Attribute value, "" for a bare attribute, null when absent. */
export function attr(tag, name) {
  const dq = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag);
  if (dq) return dq[1];
  const sq = new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag);
  if (sq) return sq[1];
  return new RegExp(`\\b${name}(?=[\\s/>])`, "i").test(tag) ? "" : null;
}

/** Every `<tag ...>` opening tag in the document. */
export function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[\\s\\S]*?>`, "gi"))].map(
    (m) => m[0],
  );
}

/** Content of a <meta> whose `key` attribute equals `value`, case-insensitive. */
export function metaContent(html, key, value) {
  for (const tag of tags(html, "meta")) {
    if ((attr(tag, key) || "").toLowerCase() === value.toLowerCase())
      return decodeEntities(attr(tag, "content"));
  }
  return null;
}

/**
 * Decode the entities that change what a reader actually sees: both the text
 * measured for length (title/description) and the text checked for an
 * accessible name. `&amp;` is decoded last so `&amp;lt;` cannot become a tag.
 */
export function decodeEntities(text) {
  return String(text ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * The title as a search result renders it: entities decoded, whitespace
 * collapsed, trimmed. Measuring the raw markup instead would count Prettier's
 * line wrapping and `&amp;` as characters a human never sees — which is how a
 * 59-character title reads as 76 and a healthy page gets flagged.
 */
export function documentTitle(html) {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "";
  return decodeEntities(raw).replace(/\s+/g, " ").trim();
}

/**
 * Visible text of a fragment, for accessible-name checks: markup is skipped and
 * the contents of <script>, <style> and comments are dropped, because none of
 * that is painted or announced to assistive tech.
 *
 * Written as a scanner rather than chained `replace()` calls. Regex
 * tag-stripping is incomplete by nature (unclosed <script>, `>` inside an
 * attribute) and static analysis correctly treats that shape as sanitization —
 * a false alarm for this helper, which only ever answers "is there any
 * user-visible text?", but a real hazard the moment someone reuses it for
 * something that matters. The scanner is both correct here and quiet to CodeQL.
 */
export function bodyText(html) {
  const source = String(html ?? "");
  const SKIPPED = new Set(["script", "style"]);

  /** Index just past the closing tag of `name`, or the end of input. */
  const skipElement = (name, from) => {
    const close = source.toLowerCase().indexOf(`</${name}`, from);
    if (close < 0) return source.length;
    const gt = source.indexOf(">", close);
    return gt < 0 ? source.length : gt + 1;
  };

  let out = "";
  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt < 0) {
      out += source.slice(i);
      break;
    }
    out += source.slice(i, lt);

    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      i = end < 0 ? source.length : end + 3;
      continue;
    }

    const gt = source.indexOf(">", lt);
    if (gt < 0) {
      i = source.length; // unterminated tag: nothing below it is text
      break;
    }
    const inner = source.slice(lt + 1, gt).trim();
    const closing = inner.startsWith("/");
    const name = (closing ? inner.slice(1) : inner)
      .split(/[\s/>]/)[0]
      .toLowerCase();
    i = gt + 1;
    if (!closing && SKIPPED.has(name)) i = skipElement(name, i);
  }

  return decodeEntities(out).replace(/\s+/g, " ").trim();
}

/**
 * A control is properly named when a <label> element wraps it — no `for`
 * needed. The window looks back far enough for Prettier-wrapped markup and
 * stops at the previous </label>, so a sibling control's label can never be
 * mistaken for this one's.
 */
export function wrappedByLabel(html, tag) {
  const idx = html.indexOf(tag);
  if (idx < 0) return false;
  const open = html.lastIndexOf("<label", idx);
  if (open < 0) return false;
  return !/<\/label>/i.test(html.slice(open, idx));
}

// ── link resolution ─────────────────────────────────────────────────────────
/**
 * Resolve an internal href the way a browser does: root-relative against the
 * site root, everything else against the containing page's directory.
 */
export function resolveHref(href, pageDir) {
  const clean = String(href).split("#")[0].split("?")[0];
  const joined = clean.startsWith("/")
    ? clean.slice(1)
    : posix.normalize(posix.join(pageDir === "." ? "" : pageDir, clean || "."));
  return joined.replace(/^\.\//, "").replace(/^\.$/, "").replace(/^\/+/, "");
}

/** True when an href climbs above the site root (outside our tree). */
export function aimsOutsideSite(href, pageDir) {
  return resolveHref(href, pageDir).startsWith("..");
}

/** True when the link target exists in the deploy allowlist. */
export function resolvesToDeployed(href, pageDir, deployed) {
  const target = resolveHref(href, pageDir);
  if (!target) return deployed.has("index.html");
  if (deployed.has(target)) return true;
  return deployed.has(`${target.replace(/\/+$/, "")}/index.html`);
}

// ── security headers / CSP ──────────────────────────────────────────────────
/**
 * Parse a Netlify/Cloudflare-Pages `_headers` file into ordered rules.
 * An unindented line is a URL path pattern; indented `Name: value` lines are
 * its headers. Later rules override earlier ones for the same header name,
 * matching the platform's last-write-wins behavior.
 */
export function parseHeadersFile(text) {
  const rules = [];
  let current = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
      continue;
    }
    const m = line.match(/^\s+([^:]+):\s*(.*)$/);
    if (m && current) current.headers[m[1].trim()] = m[2].trim();
  }
  return rules;
}

/** Parse a CSP header value into { directive: [sources] }. */
export function parseCsp(value) {
  const out = {};
  for (const part of String(value).split(";")) {
    const bits = part.trim().split(/\s+/).filter(Boolean);
    if (!bits.length) continue;
    out[bits[0].toLowerCase()] = bits.slice(1);
  }
  return out;
}

/** `*.example.com` matches `api.example.com` but not `example.com` itself. */
export function cspAllowsHost(sources = [], host) {
  return sources.some((s) => {
    const src = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (src === host) return true;
    if (src.startsWith("*.")) return host.endsWith(src.slice(1));
    return false;
  });
}

/** Resolve every header rule that matches a URL path (later rules win). */
export function headersFor(urlPath, ruleset = []) {
  const out = new Map();
  for (const rule of ruleset) {
    if (!patternMatches(rule.pattern, urlPath)) continue;
    for (const [k, v] of Object.entries(rule.headers))
      out.set(k.toLowerCase(), v);
  }
  return out;
}

/**
 * The headers Cloudflare must serve on every response. `_headers` is applied
 * by the platform and ignored by GitHub Pages, so these can only ever be
 * asserted on the Cloudflare surface.
 */
export const SECURITY_HEADER_SET = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "strict-transport-security",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
];

/** The source list of one CSP directive, lower-cased directive name. */
export function cspDirective(csp, name) {
  const sources = parseCsp(csp)[String(name).toLowerCase()];
  return sources || [];
}

/**
 * What the served response owes us on a given surface.
 *
 * Pure and injected on purpose: the policy is the part of verification that
 * cannot be re-derived from the artifact, so it has to be provable offline —
 * drop a directive from `_headers` and this must fail, with no network and no
 * Cloudflare account in the loop.
 *
 * @param {{"gh-pages"|"cloudflare"|"local"}} surface
 * @param {(name:string) => (string|null)} getHeader
 * @returns {{checks:{name:string,ok:boolean,detail:string}[], notes:string[]}}
 */
export function securityPolicyVerdict(surface, getHeader) {
  const checks = [];
  const notes = [];

  if (surface !== "cloudflare") {
    const served = [
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
    ].filter((h) => getHeader(h));
    notes.push(
      `surface ${surface}: ${served.length ? "some" : "no"} security headers served — ${
        surface === "gh-pages"
          ? "GitHub Pages serves the artifact verbatim and ignores `_headers`, so CSP/X-Frame-Options/nosniff are only provable on the Cloudflare surface"
          : "this surface does not apply `_headers`"
      }`,
    );
    return { checks, notes };
  }

  const missing = SECURITY_HEADER_SET.filter((h) => !getHeader(h));
  checks.push({
    name: "cloudflare serves the full security header set",
    ok: missing.length === 0,
    detail: missing.length ? `missing ${missing.join(", ")}` : "",
  });

  const csp = getHeader("content-security-policy") || "";
  const scriptSrc = cspDirective(csp, "script-src").join(" ");
  checks.push({
    name: "cloudflare serves script-src without 'unsafe-inline'",
    ok: !!scriptSrc && !scriptSrc.includes("'unsafe-inline'"),
    detail: scriptSrc
      ? `script-src ${scriptSrc}`.slice(0, 80)
      : "no script-src directive",
  });

  // Strictly stronger than the two checks above, and cheap: a policy that
  // reopens eval, allows a wildcard script source or drops the containment
  // directives is a regression even though the two checks above would pass.
  const loosened = [];
  if (scriptSrc.includes("'unsafe-eval'"))
    loosened.push("script-src allows 'unsafe-eval'");
  if (scriptSrc.split(/\s+/).includes("*"))
    loosened.push("script-src allows any host");
  for (const [directive, want] of [
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["frame-ancestors", "'none'"],
  ]) {
    if (!cspDirective(csp, directive).includes(want))
      loosened.push(`${directive} is not ${want}`);
  }
  checks.push({
    name: "cloudflare keeps object-src/base-uri/frame-ancestors closed",
    ok: loosened.length === 0,
    detail: loosened.join("; "),
  });

  return { checks, notes };
}

/** `*` matches any characters (including `/`), as on Cloudflare Pages. */
export function patternMatches(pattern, urlPath) {
  const rx = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return rx.test(urlPath);
}

/** Resolve a request path to a file inside the root, or null. Never escapes. */
export function resolveRequestPath(root, urlPath) {
  let p = decodeURIComponent(String(urlPath).split("?")[0].split("#")[0]);
  if (p.endsWith("/")) p += "index.html";
  const candidate = posix.join(root.split("\\").join("/"), p);
  if (
    candidate !== root &&
    !candidate.startsWith(root.split("\\").join("/") + "/")
  )
    return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  const asDir = posix.join(candidate, "index.html");
  if (existsSync(asDir) && statSync(asDir).isFile()) return asDir;
  return null;
}

export function readText(path) {
  return readFileSync(path, "utf8");
}

// ── i18n helpers ────────────────────────────────────────────────────────────
/** Sorted placeholder names, so `{a}{b}` and `{b}{a}` compare equal. */
export const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(","); /**
 * Every `data-i18n` hook a shipped page declares must resolve in every
 * non-English locale. English is exempt on purpose: the English string IS the
 * markup, so an `en` entry would be a second source of truth that can drift.
 *
 * A hook that resolves in NO locale is a typo in the markup (the element would
 * silently keep its English default and the typo would never be noticed), so
 * that case is returned separately.
 */
export function hookCoverage(locales, hooks) {
  const langs = Object.keys(locales);
  const gaps = {};
  for (const l of langs) {
    if (l === "en") continue;
    gaps[l] = [...hooks].filter((h) => locales[l][h] === undefined);
  }
  const unresolved = [...hooks].filter((h) =>
    langs.every((l) => locales[l][h] === undefined),
  );
  return { gaps, unresolved };
}

/**
 * The frontier verdict strings are composed at runtime as
 * `base + ("Grid" | "Offgrid")`, so a variant that exists in one locale but not
 * another silently renders English (or the raw key) for that mode — exactly the
 * class of gap a vocabulary-size comparison cannot see. Compare the families.
 */
export function familyGaps(locales, suffixes = ["Grid", "Offgrid"]) {
  const langs = Object.keys(locales).filter((l) => l !== "en");
  const families = new Set();
  for (const l of Object.keys(locales)) {
    for (const key of Object.keys(locales[l] || {})) {
      for (const s of suffixes)
        if (key.endsWith(s)) families.add(key.slice(0, -s.length));
    }
  }
  const gaps = {};
  for (const l of langs) {
    gaps[l] = [];
    for (const base of families) {
      for (const s of suffixes) {
        const key = base + s;
        const present = locales[l][key] !== undefined;
        const elsewhere = Object.keys(locales).some(
          (x) => locales[x]?.[key] !== undefined,
        );
        if (!present && elsewhere) gaps[l].push(key);
      }
    }
  }
  return gaps;
}

// ── URL identity ────────────────────────────────────────────────────────────
// `url.startsWith(ORIGIN)` and `sitemap.some((u) => u.includes(path))` both
// answer "does this string mention that host?" rather than "is this OUR page?".
// A lookalike host (`https://freeoffgridcalculator.com.evil.example/…`) or a
// neighbouring path (`/blog/escape-load-shedding-2/`) satisfied those tests, so
// a sitemap entry pointing at another site would have passed validation. Both
// checks now compare real URLs. Pure, so both can be unit-tested.

/** @returns {null} when the URL is unparseable or not on `origin`. */
export function sameOriginPath(url, origin) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  return parsed.pathname;
}

/**
 * Sitemap completeness: every public page needs its OWN entry, compared as an
 * exact URL — never as a substring.
 *
 * @param {string[]} pages deploy-allowlist page paths (`blog/x/index.html`)
 * @param {string[]} urls sitemap `<loc>` values
 * @param {string} site absolute origin with a trailing slash
 * @returns {{missing:string[], extra:string[]}}
 */
export function sitemapGaps(pages, urls, site) {
  const listed = new Set(urls);
  const expected = pages
    .filter((p) => p.endsWith(".html"))
    .map((p) =>
      p === "index.html" ? site : site + p.replace(/\/index\.html$/, "/"),
    );
  const expectedSet = new Set(expected);
  return {
    missing: [...expectedSet].filter((u) => !listed.has(u)),
    extra: urls.filter((u) => !expectedSet.has(u)),
  };
}
