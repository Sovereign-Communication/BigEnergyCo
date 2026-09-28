#!/usr/bin/env node
// P0.4(b) quality-lab measurement base: Lighthouse, axe, cross-browser smoke
// scaffolding and baseline recording for all Q-metrics per plan §4.
// Run: node scripts/quality-lab-base.mjs --help
//
// Phases:
// 1. Lighthouse (mobile/desktop, median of 3 runs) on staged build
// 2. axe-core via Playwright on template × state × theme × direction matrix
// 3. Cross-browser smoke (Chromium, Firefox, WebKit)
// 4. Record baseline in LEDGER.jsonl with all Q-metrics

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import { chromium } from "@playwright/test";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");

const Q_METRICS = {
  // From plan §4: Quality metrics (Q-nn)
  // Q-01: Lighthouse Performance, Accessibility, Best Practices, SEO
  // Q-02: Lighthouse mobile and desktop
  // Q-03: axe violations per template/state/theme/direction
  // Q-04: Cross-browser smoke pass rate
};

function usage() {
  console.log(`
Usage: node scripts/quality-lab-base.mjs [--stage <dir>] [--out <path>]

Measures all Q-metrics on a staged build and records baseline.
Requires: @playwright/test, lighthouse, axe-core, @axe-core/playwright

Phases:
  --lighthouse    Run Lighthouse (3 runs, median)
  --axe          Run axe accessibility checks via Playwright
  --smoke         Cross-browser smoke tests
  --all          Run all phases (default)
  `);
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function findDeployedPages(stageDir) {
  // Recursively find all .html files in the staged build
  const pages = [];

  function walk(dir, prefix = "") {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        const relPath = prefix ? `${prefix}/${entry}` : entry;

        if (stat.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.endsWith(".html")) {
          // Skip certain paths
          if (!relPath.includes("node_modules")) {
            pages.push(relPath);
          }
        }
      }
    } catch (e) {
      // Skip unreadable directories
    }
  }

  walk(stageDir);
  return pages;
}

async function runLighthouse(url, config = {}) {
  // Run Lighthouse with given config and return audit scores
  const options = {
    logLevel: "error",
    output: "json",
    disableDeviceEmulation: false,
    ...config,
  };

  try {
    const runnerResult = await lighthouse(url, options);
    if (!runnerResult) return null;

    const scores = {
      performance: Math.round(
        runnerResult.lhr.categories.performance.score * 100,
      ),
      accessibility: Math.round(
        runnerResult.lhr.categories.accessibility.score * 100,
      ),
      best_practices: Math.round(
        runnerResult.lhr.categories["best-practices"].score * 100,
      ),
      seo: Math.round(runnerResult.lhr.categories.seo.score * 100),
    };
    return scores;
  } catch (e) {
    console.error(`Lighthouse run failed: ${e.message}`);
    return null;
  }
}

async function measureLighthouse(url) {
  // Measure Lighthouse on desktop and mobile, 3 runs each, report medians
  const runs = 3;
  const results = {
    desktop: { runs: [], medians: null },
    mobile: { runs: [], medians: null },
  };

  // Desktop runs
  console.log("Running Lighthouse desktop (3 runs)...");
  for (let i = 0; i < runs; i++) {
    console.log(`  Run ${i + 1}...`);
    const scores = await runLighthouse(url, {
      formFactor: "desktop",
      screenEmulation: false,
    });
    if (scores) results.desktop.runs.push(scores);
  }

  // Mobile runs
  console.log("Running Lighthouse mobile (3 runs)...");
  for (let i = 0; i < runs; i++) {
    console.log(`  Run ${i + 1}...`);
    const scores = await runLighthouse(url, {
      formFactor: "mobile",
    });
    if (scores) results.mobile.runs.push(scores);
  }

  // Calculate medians
  if (results.desktop.runs.length > 0) {
    const desktopMetrics = {};
    for (const metric of [
      "performance",
      "accessibility",
      "best_practices",
      "seo",
    ]) {
      desktopMetrics[metric] = median(
        results.desktop.runs.map((r) => r[metric]),
      );
    }
    results.desktop.medians = desktopMetrics;
  }

  if (results.mobile.runs.length > 0) {
    const mobileMetrics = {};
    for (const metric of [
      "performance",
      "accessibility",
      "best_practices",
      "seo",
    ]) {
      mobileMetrics[metric] = median(results.mobile.runs.map((r) => r[metric]));
    }
    results.mobile.medians = mobileMetrics;
  }

  return results;
}

async function measureAxeCore(stageDir) {
  // Measure accessibility violations via axe-core per page
  // Returns matrix of violations by page, severity, and type
  // Q-03: axe violations per template × state × theme × direction

  const pages = findDeployedPages(stageDir);
  const results = {
    pages: pages.length,
    violations_by_page: {},
    severity_summary: {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    },
    total_violations: 0,
  };

  console.log(`Found ${pages.length} HTML pages for axe scanning`);
  console.log(
    "axe-core scanning requires Playwright + browser automation - implementation pending",
  );
  console.log("Expected: violations per page, per severity, rules affected");

  return results;
}

async function measureCrossBrowserSmoke(stageDir) {
  // Cross-browser smoke testing via Playwright
  // Tests that critical pages load successfully in Chromium, Firefox, WebKit
  // Q-04: Cross-browser smoke pass rate

  const pages = findDeployedPages(stageDir);
  const testPages = pages
    .filter(
      (p) =>
        p === "index.html" ||
        p.includes("/index.html") ||
        p === "solar-heatmap/index.html",
    )
    .slice(0, 5); // Test a representative subset

  const results = {
    browsers: {
      chromium: { runs: 0, passed: 0, failed: 0 },
      firefox: { runs: 0, passed: 0, failed: 0 },
      webkit: { runs: 0, passed: 0, failed: 0 },
    },
    test_pages: testPages.length,
    pass_rate: 0,
  };

  console.log(`Testing ${testPages.length} representative pages`);
  console.log("Browsers to test: Chromium, Firefox, WebKit");
  console.log(
    "Playwright browser automation required - implementation pending",
  );
  console.log("Expected: page load success per browser, performance markers");

  return results;
}

async function main(argv) {
  let stageDir = "_pages_staging";
  let outPath = null;
  let phases = ["all"];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help") return usage();
    else if (argv[i] === "--stage") stageDir = argv[++i];
    else if (argv[i] === "--out") outPath = argv[++i];
    else if (argv[i].startsWith("--")) phases = [argv[i].slice(2)];
  }

  const stagePath = join(rootDir, stageDir);
  if (!existsSync(stagePath)) {
    console.error(`Stage directory not found: ${stagePath}`);
    process.exit(1);
  }

  console.log(`Quality-Lab Measurement (P0.4b)`);
  console.log(`Stage: ${stagePath}`);
  console.log(`Phases: ${phases.join(", ")}`);

  const metrics = {
    lighthouse: null,
    axe_violations: null,
    cross_browser_smoke: null,
  };

  // Lighthouse phase
  if (phases.includes("all") || phases.includes("lighthouse")) {
    console.log("\n=== Phase: Lighthouse ===");
    try {
      // For now, log that Lighthouse phase is pending full implementation
      console.log("Lighthouse measurement phase - implementation pending");
      console.log(
        "Requires: static server integration, Chrome/CDP session management",
      );
    } catch (e) {
      console.error(`Lighthouse phase failed: ${e.message}`);
    }
  }

  // axe phase
  if (phases.includes("all") || phases.includes("axe")) {
    console.log("\n=== Phase: axe-core ===");
    try {
      const axeResults = await measureAxeCore(stagePath);
      metrics.axe_violations = axeResults;
      console.log(`Results: ${axeResults.pages} pages scanned`);
      console.log(
        `Violations by severity: ${JSON.stringify(axeResults.severity_summary)}`,
      );
    } catch (e) {
      console.error(`axe-core phase failed: ${e.message}`);
    }
  }

  // Cross-browser smoke phase
  if (phases.includes("all") || phases.includes("smoke")) {
    console.log("\n=== Phase: Cross-Browser Smoke ===");
    try {
      const smokeResults = await measureCrossBrowserSmoke(stagePath);
      metrics.cross_browser_smoke = smokeResults;
      console.log(`Pages tested: ${smokeResults.test_pages}`);
      console.log(
        `Browser coverage: ${Object.keys(smokeResults.browsers).join(", ")}`,
      );
    } catch (e) {
      console.error(`Cross-browser smoke phase failed: ${e.message}`);
    }
  }

  if (outPath) {
    console.log(`\nOutput will be written to: ${outPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`quality-lab-base: ${e.message}`);
    process.exit(2);
  });
}

export { Q_METRICS };
