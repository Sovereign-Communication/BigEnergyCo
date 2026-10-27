// Shared heatmap color palette — UMD module.
//
// Used by BOTH:
//   - assets/js/heatmap.js (browser, via window.HeatmapPalette)
//   - scripts/build-heatmap-images.mjs (Node, via module.exports)
//
// Single source of truth for dot colors. The build script renders PNGs with
// these exact functions; the live map uses them for canvas dots. Color parity
// is guaranteed by construction and verified by tests/heatmap-palette.test.mjs.
//
// The data accessors take explicit (metric, basis, usageIdx) params so they are
// pure functions with no module state — the build script renders 18
// combinations by varying the params.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    (root || {}).HeatmapPalette = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ── Cost colors (True Grid Cost / tariff $/kWh) ──────────────────────────
  function costColor(cost) {
    if (cost === null || cost === undefined || cost <= 0) return "#555555";
    if (cost <= 0.1) return "#00e699";
    if (cost <= 0.18) return "#7ec850";
    if (cost <= 0.28) return "#c8b400";
    if (cost <= 0.4) return "#e68a00";
    if (cost <= 0.55) return "#e64545";
    return "#991b1b";
  }

  // Text-safe variant: same buckets, colors that clear 4.5:1 on dark cards.
  function costTextColor(cost) {
    if (cost === null || cost === undefined || cost <= 0) return "#9aa4b2";
    if (cost <= 0.1) return "#4ade9b";
    if (cost <= 0.18) return "#a8e05f";
    if (cost <= 0.28) return "#f2d024";
    if (cost <= 0.4) return "#ffb14d";
    if (cost <= 0.55) return "#ff8f8f";
    return "#ff6b6b";
  }

  // ── Payback / break-even year colors ─────────────────────────────────────
  function yearColor(years) {
    if (years === null || years === undefined || years <= 0) return "#555555";
    if (years <= 2) return "#00e699";
    if (years <= 3) return "#7ec850";
    if (years <= 5) return "#c8b400";
    if (years <= 7) return "#e68a00";
    if (years <= 12) return "#e64545";
    return "#888888";
  }

  // ── Labels ───────────────────────────────────────────────────────────────
  function costLabel(cost) {
    if (cost === null || cost === undefined) return "N/A";
    return "$" + Number(cost).toFixed(2) + "/kWh";
  }

  function yearLabel(years) {
    if (years === null || years === undefined) return "N/A";
    if (years > 50) return ">50 yr";
    return Number(years).toFixed(1) + " yr";
  }

  // ── Data accessors (pure: explicit params, no module state) ──────────────
  // Supports both the original format (lat/lon/tr/pr/br/unserved) and the
  // compressed format (a/o/r/q/s/u with collapsed scalar-or-array series).
  function pickSeries(v, usageIdx) {
    return Array.isArray(v) ? v[usageIdx] : v;
  }

  function pointLat(pt) {
    return pt.a !== undefined ? pt.a : pt.lat;
  }

  function pointLon(pt) {
    return pt.o !== undefined ? pt.o : pt.lon;
  }

  function getPointCost(pt, basis) {
    if (basis === "real") {
      const tr = pt.r !== undefined ? pt.r : pt.tr;
      return tr !== undefined ? tr : pt.t;
    }
    return pt.t;
  }

  function getPointYears(pt, metric, basis, usageIdx) {
    const isReal = basis === "real";
    if (metric === "p") {
      const q = pt.q !== undefined ? pt.q : pt.pr;
      const series = isReal && q !== undefined ? q : pt.p;
      return series !== undefined ? pickSeries(series, usageIdx) : null;
    }
    if (metric === "b") {
      const s = pt.s !== undefined ? pt.s : pt.br;
      const series = isReal && s !== undefined ? s : pt.b;
      return series !== undefined ? pickSeries(series, usageIdx) : null;
    }
    return null;
  }

  // Resolve the dot color for a point under a given view configuration.
  function dotColor(pt, metric, basis, usageIdx) {
    if (metric === "cost") {
      return costColor(getPointCost(pt, basis));
    }
    return yearColor(getPointYears(pt, metric, basis, usageIdx));
  }

  // ── Hex → RGB ────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  return {
    costColor,
    costTextColor,
    yearColor,
    costLabel,
    yearLabel,
    getPointCost,
    getPointYears,
    dotColor,
    hexToRgb,
    pointLat,
    pointLon,
  };
});
