import { readFileSync, writeFileSync } from "node:fs";

const patch = (path, pairs) => {
  const raw = readFileSync(path, "utf8");
  let text = raw.replace(/\r\n/g, "\n");
  for (const [from, to] of pairs) {
    const count = text.split(from).length - 1;
    if (count !== 1) {
      console.error(`FAILED ${path}: ${count} occurrences of ${JSON.stringify(from.slice(0, 70))}`);
      process.exit(1);
    }
    text = text.replace(from, to);
  }
  writeFileSync(path, text.replace(/\n/g, "\r\n"), "utf8");
  console.log("patched", path);
};

patch("C:/tmp/gate-freshness/package.json", [
  [
    '    "verify:staging": "node scripts/verify-staging.mjs",',
    '    "verify:staging": "node scripts/verify-staging.mjs",\n' +
      '    "probe:production": "node scripts/probe-production.mjs",',
  ],
]);

patch("C:/tmp/gate-freshness/docs/DEPLOY_RUNBOOK.md", [
  [
    `Then verify what the brand domain actually serves. The automated form is
\`node scripts/verify-staging.mjs --base https://freeoffgridcalculator.com/\`
(byte parity over the whole deploy allowlist, the served asset stamp, platform
surface rules, and a real-browser smoke). The by-hand spot check, which bypasses
immutable asset caching with a query string, is:`,
    `Then verify what production actually serves. \`node scripts/probe-production.mjs\`
measures both production surfaces and writes \`evidence/production-probe.json\` —
the artifact the record's \`production\` block mirrors and
\`scripts/check-evidence-freshness.mjs\` checks it against (and against this
tree's stamp, so a stale probe is a named failure rather than a quiet one).

- \`https://bigenergyco.pages.dev/\` is the Pages deployment itself, and
  everything about it is measurable without a browser: the served asset stamp,
  byte parity over the whole deploy allowlist (edge rewrites canonicalised), the
  platform surface rules, and a real-browser smoke.
- \`https://freeoffgridcalculator.com/\` is the brand domain on the same Pages
  project. Since 2026-09-23 its zone answers a NON-BROWSER client with a managed
  challenge — HTTP 403, \`cf-mitigated: challenge\` — and a spoofed browser
  User-Agent is refused the same way, so this is not a header gate and
  \`node scripts/verify-staging.mjs --base <brand>\` cannot fetch its bytes at
  all. Its functional half is still measured, in the one client the zone admits:
  \`node scripts/browser-smoke.mjs https://freeoffgridcalculator.com/\`. Its BYTE
  PARITY is not measured, and the probe records that as a named gap rather than
  leaving it to be assumed. The release ledger's promote rows say
  \`brand: unreachable: HTTP 403\` for the same reason.

The by-hand spot check, which bypasses immutable asset caching with a query
string, is:`,
  ],
  [
    `\`\`\`bash
node scripts/verify-staging.mjs --base https://freeoffgridcalculator.com/
node scripts/verify-staging.mjs --base https://bigenergyco.pages.dev/
\`\`\``,
    `\`\`\`bash
node scripts/verify-staging.mjs --base https://bigenergyco.pages.dev/
\`\`\`

The policy is applied by the zone on the Pages project, so the Pages URL is
where a non-browser client can read it; the brand URL is the one the zone
guards with a challenge (HTTP 403 for anything that is not a real browser, see
Production verification below), and \`npm run probe:production\` records what
each surface is and is not measured for.`,
  ],
]);
