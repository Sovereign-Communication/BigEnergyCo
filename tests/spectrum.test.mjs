// Spectrum infographic: full cached landscape, no fixed thresholds.
// Pure data-shaping + SVG string tests (no engine, no DOM). The browser pass
// verifies real interaction; here we pin ids, pool membership and the
// selection-highlight contract.
// Run: node --test tests/spectrum.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spectrumDataset,
  nearestByBudget,
  nearestByOutcome,
  renderSpectrum,
  updateSpectrumSelection,
} from "../assets/js/sizing/spectrum.js";

function curvePoint(capexUsd, outcomePct, pvKw, battKwh) {
  return {
    capexUsd,
    outcomePct,
    pvKw,
    battKwh,
    detail: { chemistry: "lfp", chemLabel: "LFP", pvKw, battKwh },
  };
}

function gridtiePayload() {
  return {
    mode: "gridtie",
    auto: [{ solvable: true }],
    frontier: {
      chemistry: "lfp",
      chemLabel: "LFP",
      points: [
        curvePoint(1000, 40, 1.0, 2),
        curvePoint(2000, 60, 1.2, 3),
        curvePoint(3000, 80, 2.0, 5),
      ],
      marker: {
        chemistry: "lfp",
        capexUsd: 2100,
        outcomePct: 62,
        pvKw: 1.5,
        battKwh: 4,
        pointIndex: 1,
      },
    },
    customCut: {
      entries: [
        {
          solvable: true,
          chemistry: "lfp",
          chemLabel: "LFP",
          pvKw: 1.6,
          battKwh: 4,
          costLo: 1800,
          costHi: 2200,
          cutPct: 60,
        },
        {
          solvable: true,
          chemistry: "naion",
          chemLabel: "Sodium-Ion",
          pvKw: 1.7,
          battKwh: 5,
          costLo: 1900,
          costHi: 2300,
          cutPct: 61,
        },
      ],
    },
  };
}

function fakeHost() {
  return {
    innerHTML: "",
    getBoundingClientRect: () => ({ width: 720 }),
    querySelectorAll: () => [],
    querySelector: (sel) =>
      sel === "#spPreview"
        ? { style: {} }
        : sel === "#spPreviewRing"
          ? { setAttribute: () => {} }
          : null,
  };
}

test("SPECTRUM: dataset pools curve + target + off-lattice best star", () => {
  const d = spectrumDataset(gridtiePayload());
  assert.ok(d, "dataset built");
  const ids = d.points.map((q) => q.id);
  assert.deepEqual(ids.slice(0, 3), ["curve:0", "curve:1", "curve:2"]);
  assert.ok(ids.includes("custom:lfp"), "target diamond per chemistry");
  assert.ok(ids.includes("custom:naion"), "target diamond per chemistry");
  assert.ok(ids.includes("best"), "off-lattice recommendation gets a star");
  assert.equal(d.hasBest, true);
  const star = d.points.find((q) => q.id === "best");
  assert.equal(star.x, 2100);
  assert.equal(star.y, 62);
});

test("SPECTRUM: coinciding recommendation gets no extra star", () => {
  const p = gridtiePayload();
  p.frontier.marker = {
    chemistry: "lfp",
    capexUsd: 2000,
    outcomePct: 60,
    pvKw: 1.2,
    battKwh: 3,
    pointIndex: 1,
  };
  const d = spectrumDataset(p);
  assert.ok(!d.points.some((q) => q.id === "best"), "no duplicate star");
  assert.equal(d.hasBest, false);
});

test("SPECTRUM: degenerate payloads yield null", () => {
  assert.equal(spectrumDataset(null), null);
  assert.equal(spectrumDataset({}), null);
  assert.equal(
    spectrumDataset({ mode: "gridtie", frontier: { points: [{ x: 1 }] } }),
    null,
    "single point is not a spectrum",
  );
});

test("SPECTRUM: offgrid pools curve points without target diamonds", () => {
  const p = gridtiePayload();
  p.mode = "offgrid";
  delete p.customCut;
  delete p.auto;
  const d = spectrumDataset(p);
  assert.ok(d.points.every((q) => q.kind !== "target"), "no targets offgrid");
  assert.ok(d.points.some((q) => q.kind === "curve"), "backbone present");
});

test("SPECTRUM: nearest-by-budget and nearest-by-outcome", () => {
  const d = spectrumDataset(gridtiePayload());
  assert.equal(nearestByBudget(d, 2900).id, "curve:2");
  assert.equal(nearestByBudget(d, 1050).id, "curve:0");
  assert.equal(nearestByOutcome(d, 79).id, "curve:2");
  assert.equal(nearestByBudget(null, 5), null);
  assert.equal(nearestByOutcome(d, NaN), null);
});

test("SPECTRUM: render emits clickable points + star, highlight never throws", () => {
  const d = spectrumDataset(gridtiePayload());
  const host = fakeHost();
  const drew = renderSpectrum(host, d, { selectedId: "curve:1" });
  assert.equal(drew, true);
  for (const id of ["curve:0", "curve:1", "curve:2", "custom:lfp", "best"]) {
    assert.ok(
      host.innerHTML.includes(`data-sp="${id}"`),
      `${id} plotted`,
    );
  }
  assert.ok(host.innerHTML.includes("★"), "recommendation star drawn");
  assert.ok(host._spectrumGeom && host._spectrumData, "geometry cached");
  assert.doesNotThrow(() =>
    updateSpectrumSelection(host, "curve:1", "curve:2"),
  );
  assert.doesNotThrow(() => updateSpectrumSelection(host, null, null));
  assert.equal(renderSpectrum(null, d, {}), false);
  assert.equal(renderSpectrum(fakeHost(), null, {}), false);
});
