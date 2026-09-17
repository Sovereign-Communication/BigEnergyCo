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

// ── deploy allowlist discovery ──────────────────────────────────────────────
/**
 * Every file the deploy will actually publish, straight from the single
 * source of truth (scripts/deploy-pages-local.mjs). Checking the working tree
 * instead would happily validate files users never receive.
 */
export function deployedFiles() {
  try {
    const out = execSync("node scripts/deploy-pages-local.mjs --check", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.includes(".") && !l.startsWith("--"));
  } catch {
    return [];
  }
}

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
      return attr(tag, "content");
  }
  return null;
}

/**
 * Decode the entities that change what a human reads. `&amp;` is decoded last so
 * `&amp;lt;` cannot become a tag.
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
    .join(",");

/**
 * Strings only — `rtl` is a boolean layout flag, not translatable text. The
 * union of the translated locales is the vocabulary the app is able to render
 * in a non-English language, so it is the yardstick each locale is held to.
 */
export function translatedVocabulary(locales) {
  return new Set(
    ["es", "pt", "fr", "ar"]
      .filter((l) => locales[l])
      .flatMap((l) =>
        Object.entries(locales[l])
          .filter(([, value]) => typeof value === "string")
          .map(([key]) => key),
      ),
  );
}
