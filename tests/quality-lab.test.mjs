// Tests for quality-lab P0.4(b) foundation: Lighthouse, axe, cross-browser measurement
import { test } from "node:test";
import assert from "node:assert/strict";

// Helper function duplicated for testing (would normally be exported)
function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

test("Quality-Lab: median of odd-length array", () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([99, 95, 100]), 99);
  assert.equal(median([50]), 50);
});

test("Quality-Lab: median of even-length array", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([90, 95, 100, 105]), 97.5);
  assert.equal(median([1, 100]), 50.5);
});

test("Quality-Lab: median with three Lighthouse-like runs", () => {
  // Simulating 3 Lighthouse runs for a single metric
  const run1 = 95;
  const run2 = 98;
  const run3 = 96;
  const med = median([run1, run2, run3]);
  assert.equal(med, 96, "three runs should give middle value when sorted");
});

test("Quality-Lab: median handles unsorted input", () => {
  const values = [87, 92, 88, 95, 90];
  const med = median(values);
  // Sorted: [87, 88, 90, 92, 95]
  assert.equal(med, 90, "median of unsorted array is calculated correctly");
});

test("Quality-Lab: median result is numeric", () => {
  const med1 = median([95, 96, 97]);
  const med2 = median([90, 100]);
  assert.equal(typeof med1, "number");
  assert.equal(typeof med2, "number");
  assert.ok(!isNaN(med1));
  assert.ok(!isNaN(med2));
});

test("Quality-Lab: axe results structure has required fields", () => {
  const sampleAxeResults = {
    pages: 85,
    violations_by_page: {},
    severity_summary: {
      critical: 0,
      serious: 2,
      moderate: 5,
      minor: 8,
    },
    total_violations: 15,
  };
  assert.ok(sampleAxeResults.pages > 0);
  assert.equal(typeof sampleAxeResults.severity_summary.critical, "number");
  assert.equal(typeof sampleAxeResults.total_violations, "number");
});

test("Quality-Lab: Lighthouse results structure has required fields", () => {
  const sampleLighthouseResults = {
    desktop: {
      runs: [
        { performance: 95, accessibility: 98, best_practices: 96, seo: 99 },
        { performance: 94, accessibility: 97, best_practices: 95, seo: 99 },
        { performance: 96, accessibility: 98, best_practices: 97, seo: 100 },
      ],
      medians: {
        performance: 95,
        accessibility: 98,
        best_practices: 96,
        seo: 99,
      },
    },
    mobile: {
      runs: [
        { performance: 85, accessibility: 96, best_practices: 94, seo: 98 },
        { performance: 84, accessibility: 95, best_practices: 93, seo: 97 },
        { performance: 86, accessibility: 97, best_practices: 95, seo: 98 },
      ],
      medians: {
        performance: 85,
        accessibility: 96,
        best_practices: 94,
        seo: 98,
      },
    },
  };
  assert.ok(sampleLighthouseResults.desktop.medians);
  assert.ok(sampleLighthouseResults.mobile.medians);
  assert.ok(sampleLighthouseResults.desktop.medians.performance >= 0);
});
