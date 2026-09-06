// Spectrum view: the full system landscape as one interactive infographic.
//
// The 3×3 matrix answered fixed thresholds (60/80/95%). This module answers
// the continuous question instead: every cached system plotted by budget
// (x, up-front $) against outcome (y, bill-cut % or coverage %), with no set
// thresholds anywhere. Clicking any point selects that exact system across
// every chart; sliders only move a highlight through CACHED points (never a
// worker), and the granular panel renders from the point's cached analysis.
//
// Pure data + SVG: no DOM globals, no network. ui.js owns the selection hub;
// this module only shapes payload data and draws it.
import { niceMax, axisTicks } from "./frontier-chart.js?v=20260906f";

export const SPECTRUM_CHEM_COLORS = {
  naion: "#60a5fa",
  lfp: "#00e699",
  agm: "#f59e0b",
};

const C = {
  curve: "var(--primary-accent, #00e699)",
  star: "var(--secondary-accent, #3b82f6)",
  preview: "#fbbf24",
  grid: "rgba(255, 255, 255, 0.10)",
  axis: "rgba(255, 255, 255, 0.28)",
  text: "var(--text-muted, #9ca3af)",
  textBright: "var(--text-main, #f3f4f6)",
};

function esc(v) {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function mid(lo, hi) {
  return Number.isFinite(lo) && Number.isFinite(hi)
    ? Math.round((lo + hi) / 2)
    : null;
}

/**
 * Flatten one runSizing payload into plottable spectrum points.
 * Pool (all cached, all clickable):
 *   curve:{i}  every frontier point (the continuous backbone)
 *   custom:{chem}  the "your target" column per chemistry (grid-tie auto)
 *   custom  the single custom target (fixed-chemistry grid-tie)
 *   best  the recommendation star at its true position (when off-lattice)
 * @returns {{points:Array, hasBest:boolean, mode:string}|null}
 */
export function spectrumDataset(p) {
  if (!p || !p.frontier || !Array.isArray(p.frontier.points)) return null;
  const pts = p.frontier.points;
  if (pts.length < 2) return null;
  const isGT = p.mode === "gridtie";
  const out = [];
  pts.forEach((pt, i) => {
    out.push({
      id: `curve:${i}`,
      x: pt.capexUsd,
      y: pt.outcomePct,
      pvKw: pt.pvKw,
      battKwh: pt.battKwh,
      chemistry: p.frontier.chemistry,
      chemLabel: p.frontier.chemLabel || p.frontier.chemistry,
      kind: "curve",
      index: i,
      detail: pt.detail || null,
    });
  });
  if (isGT && p.auto && p.customCut && Array.isArray(p.customCut.entries)) {
    for (const e of p.customCut.entries) {
      if (!e || !e.solvable) continue;
      const x = mid(e.costLo, e.costHi);
      if (x === null || !Number.isFinite(e.cutPct)) continue;
      out.push({
        id: `custom:${e.chemistry}`,
        x,
        y: e.cutPct,
        pvKw: e.pvKw,
        battKwh: e.battKwh,
        chemistry: e.chemistry,
        chemLabel: e.chemLabel,
        kind: "target",
        detail: e,
      });
    }
  }
  if (isGT && !p.auto && p.customTarget && p.customTarget.solvable) {
    const e = p.customTarget;
    const x = mid(e.costLo, e.costHi);
    if (x !== null && Number.isFinite(e.cutPct)) {
      out.push({
        id: "custom",
        x,
        y: e.cutPct,
        pvKw: e.pvKw,
        battKwh: e.battKwh,
        chemistry: e.chemistry,
        chemLabel: e.chemLabel,
        kind: "target",
        detail: e,
      });
    }
  }
  // Recommendation star: plotted at its true position so there is always one
  // icon that IS the card's system — even between lattice points.
  let hasBest = false;
  const m = p.frontier.marker;
  if (
    m &&
    Number.isFinite(m.capexUsd) &&
    Number.isFinite(m.outcomePct) &&
    Number.isFinite(m.pvKw) &&
    Number.isFinite(m.battKwh)
  ) {
    const coincides = out.some(
      (q) =>
        Math.abs((q.pvKw || 0) - (m.pvKw || 0)) < 0.06 &&
        Math.abs((q.battKwh || 0) - (m.battKwh || 0)) < 0.6 &&
        (q.chemistry || null) === (m.chemistry || q.chemistry),
    );
    if (!coincides) {
      out.push({
        id: "best",
        x: m.capexUsd,
        y: m.outcomePct,
        pvKw: m.pvKw,
        battKwh: m.battKwh,
        chemistry: m.chemistry,
        chemLabel: null,
        kind: "best",
        detail: null,
      });
      hasBest = true;
    }
  }
  if (!out.length) return null;
  return { points: out, hasBest, mode: p.mode || "offgrid" };
}

/** Nearest cached point to a budget (x) — budget-slider preview/commit. */
export function nearestByBudget(data, budgetUsd) {
  if (!data || !data.points.length || !Number.isFinite(budgetUsd)) return null;
  let best = data.points[0],
    gap = Infinity;
  for (const q of data.points) {
    const g = Math.abs((q.x || 0) - budgetUsd);
    if (g < gap) {
      gap = g;
      best = q;
    }
  }
  return best;
}

/** Nearest cached point to an outcome % (y) — cut-slider preview. */
export function nearestByOutcome(data, pct) {
  if (!data || !data.points.length || !Number.isFinite(pct)) return null;
  let best = data.points[0],
    gap = Infinity;
  for (const q of data.points) {
    const g = Math.abs((q.y || 0) - pct);
    if (g < gap) {
      gap = g;
      best = q;
    }
  }
  return best;
}

/**
 * Draw the spectrum SVG into host. Rebuild per payload; per-frame updates go
 * through updateSpectrumSelection (no rebuild on drag).
 */
export function renderSpectrum(host, data, opts = {}) {
  if (!host || !data || !data.points.length) return false;
  const money = opts.money || ((v) => "$" + Math.round(v).toLocaleString());
  const t = opts.t || ((k) => k);
  const pts = data.points;
  const gridTie = data.mode === "gridtie";

  const W = Math.max(
    300,
    Math.min(900, Math.round(opts.width || host.getBoundingClientRect().width || 720)),
  );
  const H = Math.max(250, Math.min(430, Math.round(W * (W < 520 ? 0.78 : 0.6))));
  const padL = 58,
    padR = 18,
    padT = 20,
    padB = 50;
  const xMax = niceMax(Math.max(...pts.map((q) => q.x || 0), 1) * 1.06);
  const yTop = Math.max(100, Math.max(...pts.map((q) => q.y || 0)));
  const yMax = yTop > 100 ? niceMax(yTop * 1.04) : 100;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const X = (usd) => padL + Math.min(1, (usd || 0) / xMax) * plotW;
  const Y = (pct) => padT + (1 - Math.min(1, (pct || 0) / yMax)) * plotH;

  const parts = [];
  for (const pct of [0, 25, 50, 75, 100]) {
    if (pct > yMax) continue;
    const y = Y(pct);
    parts.push(
      `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>` +
        `<text x="${(padL - 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="13" fill="${C.text}">${pct}%</text>`,
    );
  }
  for (const usd of axisTicks(xMax, 4)) {
    const x = X(usd);
    const isLast = usd >= xMax - 1e-9;
    parts.push(
      `<line x1="${x.toFixed(1)}" y1="${padT}" x2="${x.toFixed(1)}" y2="${(H - padB).toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>` +
        `<text x="${(isLast ? x + 4 : x).toFixed(1)}" y="${(H - padB + 20).toFixed(1)}" text-anchor="${isLast ? "end" : "middle"}" font-size="13" fill="${C.text}">${esc(money(usd))}</text>`,
    );
  }
  parts.push(
    `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${(H - padB).toFixed(1)}" stroke="${C.axis}" stroke-width="1"/>` +
      `<line x1="${padL}" y1="${(H - padB).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${(H - padB).toFixed(1)}" stroke="${C.axis}" stroke-width="1"/>`,
  );

  // Backbone: the curve family in order of budget.
  const curve = pts
    .filter((q) => q.kind === "curve")
    .sort((a, b) => a.x - b.x);
  if (curve.length >= 2) {
    parts.push(
      `<polyline points="${curve.map((q) => `${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${C.curve}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  }

  for (const q of pts) {
    const tip =
      typeof t === "function"
        ? t("frontierPointTip", {
            cost: money(q.x),
            pct: q.y,
            pv: q.pvKw,
            batt: q.battKwh,
          })
        : "";
    const chemColor = SPECTRUM_CHEM_COLORS[q.chemistry] || C.curve;
    const selRing = `<circle class="sp-selring" cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="10" fill="none" stroke="${C.star}" stroke-width="2.5" style="display:none"/>`;
    if (q.kind === "best") {
      parts.push(
        `<g data-sp="${esc(q.id)}" role="button" tabindex="0" style="cursor:pointer;" aria-label="${esc(tip)}">` +
          `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="11" fill="transparent"/>` +
          `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="7" fill="${C.star}" stroke="var(--bg-dark, #090d16)" stroke-width="2"/>` +
          `<text x="${X(q.x).toFixed(1)}" y="${(Y(q.y) + 4.5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="#04120c">★</text>` +
          selRing +
          `<title>${esc(tip)}</title></g>`,
      );
    } else if (q.kind === "target") {
      const s = 6;
      const cx = X(q.x),
        cy = Y(q.y);
      parts.push(
        `<g data-sp="${esc(q.id)}" role="button" tabindex="0" style="cursor:pointer;" aria-label="${esc(tip)}">` +
          `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="12" fill="transparent"/>` +
          `<polygon points="${cx.toFixed(1)},${(cy - s).toFixed(1)} ${(cx + s).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + s).toFixed(1)} ${(cx - s).toFixed(1)},${cy.toFixed(1)}" fill="${chemColor}" stroke="var(--bg-dark, #090d16)" stroke-width="1.5"/>` +
          selRing +
          `<title>${esc(tip)}</title></g>`,
      );
    } else {
      parts.push(
        `<g data-sp="${esc(q.id)}" role="button" tabindex="0" style="cursor:pointer;" aria-label="${esc(tip)}">` +
          `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="11" fill="transparent"/>` +
          `<circle cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="4.5" fill="rgba(9,13,22,0.9)" stroke="${C.curve}" stroke-width="2"/>` +
          selRing +
          `<title>${esc(tip)}</title></g>`,
      );
    }
  }

  // Drag-preview ring: hollow amber, moved without rebuild.
  parts.push(
    `<g id="spPreview" style="display:none;pointer-events:none">` +
      `<circle id="spPreviewRing" cx="0" cy="0" r="13" fill="none" stroke="${C.preview}" stroke-width="2.5" stroke-dasharray="4 3"/></g>`,
  );
  // Store plot geometry for the preview ring positioning.
  const geom = { xMax, yMax, padL, padR, padT, padB, W, H };

  const yLabel = gridTie ? "bill cut %" : "coverage %";
  const xLabel = opts.xLabel || "budget (up-front)";
  parts.push(
    `<text x="${(padL + plotW / 2).toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="13" fill="${C.textBright}">${esc(xLabel)}</text>`,
    `<text transform="translate(15 ${(padT + plotH / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="13" fill="${C.textBright}">${esc(yLabel)}</text>`,
  );

  host.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" dir="ltr" preserveAspectRatio="xMidYMid meet" style="direction:ltr;unicode-bidi:isolate;width:100%;height:auto;display:block;border:1px solid var(--border-card);border-radius:10px;background:rgba(9,13,22,0.85);">` +
    parts.join("") +
    `</svg>`;
  host._spectrumGeom = geom;
  host._spectrumData = data;

  if (opts.onSelect) {
    host.querySelectorAll("[data-sp]").forEach((g) => {
      const id = g.getAttribute("data-sp");
      const activate = () => opts.onSelect(id);
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }
  updateSpectrumSelection(host, opts.selectedId ?? null, opts.previewId ?? null);
  return true;
}

/**
 * Highlight committed selection + drag preview without rebuilding the SVG.
 * selectedId/previewId are spectrum point ids (or null).
 */
export function updateSpectrumSelection(host, selectedId, previewId) {
  if (!host || typeof host.querySelectorAll !== "function") return;
  host.querySelectorAll("[data-sp]").forEach((g) => {
    const ring = g.querySelector ? g.querySelector(".sp-selring") : null;
    if (ring) ring.style.display = g.getAttribute("data-sp") === selectedId ? "" : "none";
  });
  const prev = host.querySelector ? host.querySelector("#spPreview") : null;
  const ring = host.querySelector ? host.querySelector("#spPreviewRing") : null;
  const geom = host._spectrumGeom;
  const data = host._spectrumData;
  if (!prev || !ring || !geom || !data || !previewId) {
    if (prev) prev.style.display = "none";
    return;
  }
  const q = data.points.find((p) => p.id === previewId);
  if (!q) {
    prev.style.display = "none";
    return;
  }
  const plotW = geom.W - geom.padL - geom.padR;
  const plotH = geom.H - geom.padT - geom.padB;
  const cx = geom.padL + Math.min(1, (q.x || 0) / geom.xMax) * plotW;
  const cy = geom.padT + (1 - Math.min(1, (q.y || 0) / geom.yMax)) * plotH;
  ring.setAttribute("cx", cx.toFixed(1));
  ring.setAttribute("cy", cy.toFixed(1));
  prev.style.display = "";
}
