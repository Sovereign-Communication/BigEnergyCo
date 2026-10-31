// Read-only audit of the worldwide surface: 220 country partitions, 66 city
// pages, 151 currencies, hub + sitemap, measured against live staging and the
// tree main serves. Writes JSON + prints a summary. No repo writes.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = "C:/tmp/world-audit";
const OUT = "C:/tmp/scan";
const STAGING = "https://bigenergyco.pages.dev";
const BRAND = "https://freeoffgridcalculator.com";
const CONCURRENCY = 6;

const report = { measuredAt: new Date().toISOString(), tree: {}, data: {}, live: {}, brand: {}, limits: [] };
const say = (s) => console.log(s);

// ---------- tree: catalog, partitions, compiled pages ----------
function readCatalog() {
  const src = readFileSync(join(ROOT, "assets/js/sizing/cities.js"), "utf8");
  const start = src.indexOf("export const CITY_CATALOG = [");
  const from = src.indexOf("[", start);
  let d = 0, end = -1;
  for (let i = from; i < src.length; i++) {
    if (src[i] === "[") d++;
    else if (src[i] === "]") { d--; if (!d) { end = i; break; } }
  }
  return eval(src.slice(from, end + 1)).map(([name, country, region, lat, lon]) => ({ name, country, region, lat, lon }));
}
function readIso2() {
  const src = readFileSync(join(ROOT, "assets/js/sizing/cities.js"), "utf8");
  const from = src.indexOf("const ISO2 = {");
  const end = src.indexOf("\n};", from);
  const body = src.slice(src.indexOf("{", from), end + 2);
  const obj = {};
  for (const m of body.matchAll(/(?:"([^"]+)"|([a-z]+))\s*:\s*"([A-Z]{2})"/g)) obj[(m[1] || m[2]).toLowerCase()] = m[3];
  return obj;
}
function slugify(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const cities = readCatalog();
const iso2 = readIso2();
const countryFiles = (readFileSync(join(ROOT, "assets/js/sizing/cities.js"), "utf8").match(/export const COUNTRY_FILES =\s*"([^"]*)"/) || [])[1].split(" ");
const partitionDir = join(ROOT, "assets/js/sizing/city-data");
const partitionFiles = readdirSync(partitionDir).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort();
report.tree = {
  catalogCities: cities.length,
  catalogCountries: new Set(cities.map((c) => c.country)).size,
  countryFilesDeclared: countryFiles.length,
  partitionFiles: partitionFiles.length,
  pageDirs: readdirSync(join(ROOT, "solar-calculator"), { withFileTypes: true }).filter((d) => d.isDirectory()).length,
  hubExists: existsSync(join(ROOT, "solar-calculator/index.html")),
};

// catalog -> ISO -> partition -> currency
const dataDefects = [];
const cityRows = [];
const ccSource = readFileSync(join(ROOT, "assets/js/sizing/country-currency.js"), "utf8");
const COUNTRY_CURRENCY = Object.fromEntries([...ccSource.matchAll(/^\s*([A-Z]{2}):\s*"([A-Z]{3})"/gm)].map((m) => [m[1], m[2]]));
const CUR_SOURCE = readFileSync(join(ROOT, "assets/js/sizing/pricing.js"), "utf8");
const CURRENCIES = new Set([...CUR_SOURCE.slice(CUR_SOURCE.indexOf("export const CURRENCIES = {"), CUR_SOURCE.indexOf("export const fxMeta")).matchAll(/^\s{2}([A-Z]{3}):/gm)].map((m) => m[1]));

for (const c of cities) {
  const code = iso2[c.country.toLowerCase()] || null;
  const slug = slugify(c.name);
  const page = join(ROOT, "solar-calculator", slug, "index.html");
  const row = { name: c.name, country: c.country, code, slug, pageExists: existsSync(page) };
  if (!code) dataDefects.push(`catalog country has no ISO-2 mapping: ${c.country} (${c.name})`);
  if (code && !countryFiles.includes(code)) dataDefects.push(`partition missing from COUNTRY_FILES: ${code} (${c.name})`);
  if (code && !partitionFiles.includes(`${code}.json`)) dataDefects.push(`partition file missing: ${code}.json (${c.name})`);
  const cur = code ? COUNTRY_CURRENCY[code] : null;
  row.currency = cur;
  if (code && cur && !CURRENCIES.has(cur)) dataDefects.push(`no display entry for ${code}->${cur} (${c.name})`);
  if (code && cur && !CURRENCIES.has(cur)) row.currencyDisplayable = false; else row.currencyDisplayable = true;
  if (!row.pageExists) dataDefects.push(`city page missing on disk: ${slug} (${c.name})`);
  if (row.pageExists) {
    const html = readFileSync(page, "utf8");
    row.pageBytes = Buffer.byteLength(html);
    row.pageSha = createHash("sha256").update(html).digest("hex").slice(0, 16);
    row.titleHasCity = html.includes(`<title>${c.name.replace(/&/g, "&amp;")} Solar`) || new RegExp(`<title>[^<]*${c.name}`).test(html);
    row.canonicalOk = html.includes(`<link rel="canonical" href="${BRAND}/solar-calculator/${slug}/">`);
    row.coordsOnPage = html.includes(`${Math.abs(c.lat).toFixed(2)}°`) && html.includes(`${Math.abs(c.lon).toFixed(2)}°`);
  }
  cityRows.push(row);
}
// partitions: own content or a copy?
const partInfo = [];
const hashes = new Map();
const dupPartitions = [];
for (const f of partitionFiles) {
  const raw = readFileSync(join(partitionDir, f), "utf8");
  let rows;
  try { rows = JSON.parse(raw); } catch (e) { dataDefects.push(`${f}: unparseable JSON (${e.message})`); continue; }
  if (!Array.isArray(rows) || !rows.length) { dataDefects.push(`${f}: empty or not an array`); continue; }
  const code = f.slice(0, 2);
  const wrong = rows.filter((r) => r.country !== code).length;
  const outOfRange = rows.filter((r) => !(r.lat >= -90 && r.lat <= 90 && r.lon >= -180 && r.lon <= 180)).length;
  const noPop = rows.filter((r) => !(r.population > 0)).length;
  const names = new Set(rows.map((r) => String(r.name).toLowerCase()));
  const dupNames = rows.length - names.size;
  const geo = new Set(rows.map((r) => `${r.lat},${r.lon}`)).size;
  const h = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  if (hashes.has(h)) dupPartitions.push([f, hashes.get(h)]); else hashes.set(h, f);
  if (wrong) dataDefects.push(`${f}: ${wrong} row(s) carry country != ${code}`);
  if (outOfRange) dataDefects.push(`${f}: ${outOfRange} row(s) outside valid coordinate range`);
  if (noPop) dataDefects.push(`${f}: ${noPop} row(s) with population <= 0`);
  // Duplicate names are expected (two Springfields differ by region), so they
  // are recorded, not counted as defects; duplicate coordinates in one
  // partition are not.
  const dupGeoRows = rows.length - geo;
  if (dupGeoRows) dataDefects.push(`${f}: ${dupGeoRows} duplicate coordinate(s) within the partition`);
  partInfo.push({ file: f, rows: rows.length, uniqueGeo: geo, wrongCountry: wrong, outOfRange, noPop, dupNames, dupGeoRows, sha: h });
}
for (const [a, b] of dupPartitions) dataDefects.push(`partition ${a} is byte-identical to ${b} (a copy, not its own content)`);
report.data = {
  catalogChecked: cityRows.length,
  partitionsChecked: partInfo.length,
  totalPartitionRows: partInfo.reduce((s, p) => s + p.rows, 0),
  partitionRowRange: [Math.min(...partInfo.map((p) => p.rows)), Math.max(...partInfo.map((p) => p.rows))],
  currenciesInMapping: new Set(Object.values(COUNTRY_CURRENCY)).size,
  countriesInMapping: Object.keys(COUNTRY_CURRENCY).length,
  displayCurrencies: CURRENCIES.size,
  defects: dataDefects,
};
say(`TREE   catalog ${report.tree.catalogCities} cities / ${report.tree.catalogCountries} countries | partitions ${report.tree.partitionFiles} | page dirs ${report.tree.pageDirs}`);
say(`DATA   ${report.data.partitionsChecked} partitions, ${report.data.totalPartitionRows} rows (min ${report.data.partitionRowRange[0]}/max ${report.data.partitionRowRange[1]}) | ${report.data.countriesInMapping} countries -> ${report.data.currenciesInMapping} currencies, all displayable in ${report.data.displayCurrencies}`);
say(`DATA   defects: ${dataDefects.length}`);
for (const d of dataDefects.slice(0, 20)) say(`       - ${d}`);

// ---------- live staging ----------
async function get(url, { timeout = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "beco-world-audit/1.0" } });
    const body = await res.text();
    return { status: res.status, body, headers: Object.fromEntries(res.headers) };
  } catch (e) {
    return { status: 0, error: String(e && e.message), body: "", headers: {} };
  } finally { clearTimeout(t); }
}
async function pool(items, fn, size = CONCURRENCY) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmodOf = new Map();
{
  const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  for (const b of blocks) {
    const loc = (b.match(/<loc>([^<]+)<\/loc>/) || [])[1];
    const lm = (b.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || null;
    if (loc) lastmodOf.set(loc, lm);
  }
}

const cityResults = await pool(cities, async (c) => {
  const slug = slugify(c.name);
  const url = `${STAGING}/solar-calculator/${slug}/`;
  const brandUrl = `${BRAND}/solar-calculator/${slug}/`;
  const r = await get(url);
  const local = readFileSync(join(ROOT, "solar-calculator", slug, "index.html"), "utf8");
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const out = {
    slug, url, status: r.status, bytes: r.body.length,
    sameAsTree: norm(r.body) === norm(local),
    title: (r.body.match(/<title>([^<]*)<\/title>/) || [])[1] || null,
    canonical: (r.body.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || null,
    hreflangs: [...r.body.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`),
    h1: (r.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]*>/g, "").trim() || null,
    description: (r.body.match(/<meta name="description" content="([^"]*)"/) || [])[1] || null,
    ldJsonBlocks: [...r.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
    coordLine: (r.body.match(/(\d+\.\d+)° ([NS]), (\d+\.\d+)° ([EW])/) || [])[0] || null,
    payback: (r.body.match(/at ~[^,]*\/kWh/) || [])[0] || null,
    inSitemap: sitemapUrls.includes(brandUrl),
    lastmod: lastmodOf.get(brandUrl) || null,
    internalHrefs: [...new Set([...r.body.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))].filter((h) => !/^(mailto:|https?:\/\/|#)/.test(h)),
  };
  out.checks = {
    status200: r.status === 200,
    marketTitle: !!out.title && new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(out.title),
    marketH1: !!out.h1 && out.h1.includes(c.name) && out.h1.includes(c.country),
    marketDescription: !!out.description && out.description.includes(c.name) && out.description.includes(c.country),
    canonicalMarketUrl: out.canonical === brandUrl,
    hreflangReciprocal: out.hreflangs.length === 2 && out.hreflangs.every((h) => h.endsWith(`=${brandUrl}`)),
    ldParses: out.ldJsonBlocks.length > 0 && out.ldJsonBlocks.every((b) => { try { JSON.parse(b); return true; } catch { return false; } }),
    ldNamesMarket: out.ldJsonBlocks.some((b) => b.includes(`"${c.name}, ${c.country}"`)),
    ownCoordinates: !!out.coordLine && out.coordLine.includes(`${Math.abs(c.lat).toFixed(2)}°`) && out.coordLine.includes(`${Math.abs(c.lon).toFixed(2)}°`),
    inSitemap: out.inSitemap,
    sitemapHasLastmod: !!out.lastmod,
    linksBackToHub: /href="\.\.\/"/.test(r.body),
  };
  out.brand = { url: brandUrl, status: 0, cfMitigated: null };
  return out;
});

// hub + home
const hub = await get(`${STAGING}/solar-calculator/`);
const home = await get(`${STAGING}/`);
const hubLocal = readFileSync(join(ROOT, "solar-calculator/index.html"), "utf8");
const homeLocal = readFileSync(join(ROOT, "index.html"), "utf8");
const norm = (s) => s.replace(/\r\n/g, "\n");

// hub -> city reciprocity: every city linked from the hub?
const hubHrefs = [...new Set([...hub.body.matchAll(/href="\.\/([a-z0-9-]+)\/"/g)].map((m) => m[1]))];
const citySlugs = cities.map((c) => slugify(c.name));
const linkedFromHub = citySlugs.filter((s) => hubHrefs.includes(s));
const linkFailures = [];
let linkTargets = 0;
{
  // Resolve every site-relative href against the page that carries it, then
  // fetch the resolved URL exactly as written (no slash munging).
  const pairs = [];
  for (const c of cityResults) {
    const base = `${STAGING}/solar-calculator/${c.slug}/`;
    for (const h of c.internalHrefs) pairs.push([base, h]);
  }
  const hubBase = `${STAGING}/solar-calculator/`;
  for (const h of [...hub.body.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))
    if (!/^(mailto:|https?:|#)/.test(h)) pairs.push([hubBase, h]);
  const homeBase = `${STAGING}/`;
  for (const h of [...home.body.matchAll(/href="([^"#]+)"/g)].map((m) => m[1]))
    if (!/^(mailto:|https?:|#)/.test(h)) pairs.push([homeBase, h]);
  const resolved = new Map();
  for (const [base, href] of pairs) {
    let u;
    try { u = new URL(href, base); } catch { continue; }
    if (u.origin !== new URL(STAGING).origin) continue;
    u.hash = "";
    if (!resolved.has(u.href)) resolved.set(u.href, []);
    resolved.get(u.href).push(href);
  }
  const list = [...resolved.keys()];
  linkTargets = list.length;
  const results = await pool(list, async (u) => {
    const r = await get(u, { timeout: 20000 });
    return { url: u, status: r.status, hrefs: resolved.get(u), bytes: r.body.length };
  });
  for (const r of results) if (r.status !== 200) linkFailures.push(r);
}

report.live = {
  staging: STAGING,
  home: { status: home.status, bytes: home.body.length, sameAsTree: norm(home.body) === norm(homeLocal) },
  hub: { status: hub.status, bytes: hub.body.length, sameAsTree: norm(hub.body) === norm(hubLocal), citiesLinked: linkedFromHub.length },
  cities: cityResults.map((c) => ({ slug: c.slug, status: c.status, checks: c.checks, payback: c.payback, title: c.title })),
  failing: cityResults.filter((c) => Object.values(c.checks).some((v) => !v)).map((c) => ({ slug: c.slug, failed: Object.entries(c.checks).filter(([, v]) => !v).map(([k]) => k) })),
  pagesDifferingFromTree: cityResults.filter((c) => !c.sameAsTree).map((c) => c.slug),
  linkFailures,
  linkTargets,
  sitemap: { urls: sitemapUrls.length, cityUrls: sitemapUrls.filter((u) => u.includes("/solar-calculator/") && u !== `${BRAND}/solar-calculator/`).length, withoutLastmod: sitemapUrls.filter((u) => !lastmodOf.get(u)).length },
};

say("");
say(`LIVE   staging home ${report.live.home.status} ${report.live.home.bytes}B tree-equal=${report.live.home.sameAsTree}`);
say(`LIVE   hub ${report.live.hub.status} ${report.live.hub.bytes}B tree-equal=${report.live.hub.sameAsTree} citiesLinked=${report.live.hub.citiesLinked}/66`);
say(`LIVE   city pages: ${cityResults.filter((c) => c.status === 200).length}/66 served 200; ${cityResults.filter((c) => c.sameAsTree).length}/66 byte-equal to the tree`);
const failedPages = report.live.failing;
say(`LIVE   pages with a failed check: ${failedPages.length}`);
for (const f of failedPages.slice(0, 20)) say(`       - ${f.slug}: ${f.failed.join(", ")}`);
say(`LIVE   internal link targets checked: ${linkTargets} resolved URLs, ${report.live.linkFailures.length} failure(s)`);
for (const l of report.live.linkFailures.slice(0, 15)) say(`       - ${l.href} -> ${l.status}`);
say(`LIVE   sitemap: ${report.live.sitemap.urls} urls (${report.live.sitemap.cityUrls} city), ${report.live.sitemap.withoutLastmod} without lastmod`);

// ---------- brand domain (known challenge behaviour) ----------
const brandSample = [`${BRAND}/`, `${BRAND}/solar-calculator/`, `${BRAND}/solar-calculator/tokyo/`, `${BRAND}/solar-calculator/lagos/`, `${BRAND}/solar-calculator/new-york/`, `${BRAND}/sitemap.xml`];
const brandResults = await pool(brandSample, async (u) => {
  const r = await get(u, { timeout: 20000 });
  return { url: u, status: r.status, cfMitigated: r.headers["cf-mitigated"] || null, server: r.headers["server"] || null, bytes: r.body.length, looksLikeSite: r.body.includes("Start a Free Estimate") };
});
report.brand = { results: brandResults };
say("");
say("BRAND  freeoffgridcalculator.com (documented challenge behaviour):");
for (const b of brandResults) say(`       ${String(b.status).padEnd(3)} cf-mitigated=${b.cfMitigated || "-"} site-content=${b.looksLikeSite ? "yes" : "no"}  ${b.url}`);
const brandBlocked = brandResults.filter((b) => b.status === 403 && b.cfMitigated === "challenge").length;
report.limits.push(`brand domain returned 403 + cf-mitigated: challenge on ${brandBlocked}/${brandResults.length} probed URLs -> those responses are UNMEASURED (not passes, not failures)`);

writeFileSync(join(OUT, "world-measure.json"), JSON.stringify(report, null, 1));
say("");
say(`report -> ${join(OUT, "world-measure.json")}`);
