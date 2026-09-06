// Renders the plausibility frontier as inline SVG.
//
// SVG rather than canvas on purpose: it stays crisp on the printable
// one-pager, needs no devicePixelRatio juggling, scales to any phone width,
// and its text is real text - so screen readers, translation tools and
// find-on-page all work. A matching data table ships alongside every chart
// for anyone who cannot use the picture.
//
// The module knows nothing about the app: strings arrive through `t`, money
// through `money`, so currency and locale are the caller's business.

// The results column is ~290px on a phone and ~465px on a laptop. A fixed
// 760-wide viewBox is scaled down to fit it, and every label shrinks with it -
// 13px type arrives as 5px, which is not a chart, it is a smudge. So the
// viewBox is built to match the element, and text renders at its stated size.
const VB_MIN = 300;
const VB_MAX = 900;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Geometry for one render, derived from the width actually available. */
export function chartBox(hostWidth) {
  const w = clamp(Math.round(hostWidth) || 720, VB_MIN, VB_MAX);
  // "narrow" means phone-narrow: too tight for the in-chart callouts, which
  // the legend and the verdict sentence say in words anyway. The results
  // column is only ~400px even on a laptop, so the threshold sits below that.
  const narrow = w < 360;
  // Squarer as it gets narrower, so the curve keeps its shape on a phone.
  const ratio = w < 520 ? 0.78 : 0.6;
  return {
    W: w,
    H: clamp(Math.round(w * ratio), 250, 430),
    pad: {
      l: narrow ? 44 : 58,
      r: narrow ? 12 : 18,
      t: narrow ? 16 : 22,
      b: narrow ? 44 : 50,
    },
    font: narrow ? 11.5 : 13,
    fontTag: narrow ? 12 : 13.5,
    xTicks: narrow ? 3 : 4,
    narrow,
  };
}

const C = {
  curve: "var(--primary-accent, #00e699)",
  band: "rgba(0, 230, 153, 0.13)",
  knee: "var(--warning-orange, #f59e0b)",
  marker: "var(--secondary-accent, #3b82f6)",
  ceiling: "var(--danger-red, #ef4444)",
  grid: "rgba(255, 255, 255, 0.10)",
  axis: "rgba(255, 255, 255, 0.28)",
  text: "var(--text-muted, #9ca3af)",
  textBright: "var(--text-main, #f3f4f6)",
  tailWash: "rgba(245, 158, 11, 0.08)",
};

// Rough advance width for the system UI stack at a given size. Good enough to
// decide which side of a marker a label fits on - which is the only thing
// standing between a callout and being sliced off at the plot edge.
function textWidth(str, fontSize) {
  return String(str).length * fontSize * 0.55;
}

/**
 * Put a callout beside `x` on whichever side it fits, and centre it inside
 * the plot when neither side has room.
 * @returns {{x:number, anchor:string}}
 */
export function placeLabel(x, text, fontSize, bounds, offset = 10) {
  const w = textWidth(text, fontSize);
  if (x + offset + w <= bounds.right) return { x: x + offset, anchor: "start" };
  if (x - offset - w >= bounds.left) return { x: x - offset, anchor: "end" };
  const half = w / 2;
  const mid = Math.min(Math.max(x, bounds.left + half), bounds.right - half);
  return { x: mid, anchor: "middle" };
}

function esc(v) {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// A dense ladder of round numbers. The classic 1/2/5 ladder rounds $3,200 up
// to $5,000 and leaves 40% of the plot empty - which visually flattens the
// curve and undersells exactly the shape this chart exists to show.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Smallest round number >= v, from a ladder fine enough to keep the plot full. */
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  for (const step of NICE_STEPS) if (n <= step + 1e-9) return step * base;
  return 10 * base;
}

/**
 * Ticks at round money values. Dividing the axis into equal parts gives
 * labels like "$1,333.333", which reads as a rounding bug rather than a
 * price, so the step itself is snapped to a round number first.
 */
export function axisTicks(max, count = 5) {
  if (!(max > 0) || count < 1) return [0];
  // Smallest round step that still fits inside `count` intervals - so the
  // axis is as informative as it can be while every label stays round.
  const exp = Math.floor(Math.log10(max / count));
  let step = 0;
  outer: for (let k = exp - 1; k <= exp + 2; k++) {
    for (const m of [1, 2, 2.5, 5]) {
      const cand = m * Math.pow(10, k);
      if (cand > 0 && max / cand <= count + 1e-9) {
        step = cand;
        break outer;
      }
    }
  }
  if (!step) step = max / count;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

/**
 * @param {HTMLElement} host        element to fill
 * @param {object} frontier         payload.frontier from run.js
 * @param {object} opts
 *   t(key, params)   -> localized string
 *   money(usd)       -> localized currency string
 *   tableHost        -> optional element for the accessible data table
 */
export function renderFrontier(host, frontier, opts = {}) {
  if (!host) return;
  const t = opts.t || ((k, p) => (p && p.fallback) || k);
  const money = opts.money || ((v) => "$" + Math.round(v).toLocaleString());
  const pts = (frontier && frontier.points) || [];

  if (pts.length < 2) {
    host.innerHTML = "";
    return false;
  }

  const gridTie = frontier.mode === "gridtie";
  const yLabel = gridTie ? t("frontierYGrid") : t("frontierYOffgrid");
  const xLabel = t("frontierX");

  const box = chartBox(opts.width || host.getBoundingClientRect().width);
  const VB_W = box.W,
    VB_H = box.H,
    PAD = box.pad;
  const FS = box.font,
    FS_TAG = box.fontTag;

  // Scale to the mid curve, not the top of the price band: the band's upper
  // edge is a sourcing scenario, not the answer, and letting it set the axis
  // pushes the whole curve into the left third.
  const marker = frontier.marker;
  // The point that is highlighted = the visitor's pick when they click one of
  // the dots, otherwise the RECOMMENDED system at its TRUE position — not the
  // nearest curve point. A lifetime-optimal pick can sit off the capex-optimal
  // curve (cheap bank, counted swaps); snapping the dot onto the line would
  // quietly display a different system than the card being read.
  const selExplicit =
    typeof opts.selected === "number" &&
    opts.selected >= 0 &&
    pts[opts.selected];
  const sel = selExplicit
    ? pts[opts.selected]
    : marker &&
        Number.isFinite(marker.capexUsd) &&
        Number.isFinite(marker.outcomePct)
      ? {
          pvKw: marker.pvKw,
          battKwh: marker.battKwh,
          outcomePct: marker.outcomePct,
          capexUsd: marker.capexUsd,
        }
      : null;
  const lastMid = pts[pts.length - 1].capexUsd;
  const needed = Math.max(
    lastMid,
    marker && Number.isFinite(marker.capexUsd) ? marker.capexUsd : 0,
  );
  const xMax = niceMax(needed * 1.06);
  // Net-metered outcomes can exceed 100% (surplus sold back), so the axis
  // grows instead of clamping dots onto the top frame.
  const yTop = Math.max(
    100,
    ...pts.map((p) => (Number.isFinite(p.outcomePct) ? p.outcomePct : 0)),
    marker && Number.isFinite(marker.outcomePct) ? marker.outcomePct : 0,
  );
  const yMax = yTop > 100 ? Math.ceil(yTop / 10) * 10 : 100;
  const yTicks = yMax > 100 ? [0, 25, 50, 75, 100, yMax] : [0, 25, 50, 75, 100];
  const plotW = VB_W - PAD.l - PAD.r;
  const plotH = VB_H - PAD.t - PAD.b;
  const X = (usd) => PAD.l + Math.min(1, usd / xMax) * plotW;
  const Y = (pct) => PAD.t + (1 - Math.min(1, pct / yMax)) * plotH;

  const parts = [];
  const push = (s) => parts.push(s);

  // ── gridlines + axes ──────────────────────────────────────────────────
  for (const pct of yTicks) {
    const y = Y(pct);
    push(
      `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${(VB_W - PAD.r).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`,
    );
    push(
      `<text x="${(PAD.l - (box.narrow ? 7 : 10)).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="${FS}" fill="${C.text}">${pct}%</text>`,
    );
  }
  for (const usd of axisTicks(xMax, box.xTicks)) {
    const x = X(usd);
    push(
      `<line x1="${x.toFixed(1)}" y1="${PAD.t}" x2="${x.toFixed(1)}" y2="${(VB_H - PAD.b).toFixed(1)}" stroke="${C.grid}" stroke-width="1"/>`,
    );
    const isLast = usd >= xMax - 1e-9;
    push(
      `<text x="${(isLast ? x + 4 : x).toFixed(1)}" y="${(VB_H - PAD.b + 20).toFixed(1)}" text-anchor="${isLast ? "end" : "middle"}" font-size="${FS}" fill="${C.text}">${esc(money(usd))}</text>`,
    );
  }
  push(
    `<line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${(VB_H - PAD.b).toFixed(1)}" stroke="${C.axis}" stroke-width="1"/>`,
  );
  push(
    `<line x1="${PAD.l}" y1="${(VB_H - PAD.b).toFixed(1)}" x2="${(VB_W - PAD.r).toFixed(1)}" y2="${(VB_H - PAD.b).toFixed(1)}" stroke="${C.axis}" stroke-width="1"/>`,
  );

  // ── diminishing-returns wash, drawn behind the curve ──────────────────
  const kneeIdx = frontier.kneeIndex;
  const knee = kneeIdx >= 0 ? pts[kneeIdx] : null;
  if (knee) {
    const kx = X(knee.capexUsd);
    push(
      `<rect x="${kx.toFixed(1)}" y="${PAD.t}" width="${(VB_W - PAD.r - kx).toFixed(1)}" height="${plotH.toFixed(1)}" fill="${C.tailWash}"/>`,
    );
  }

  // ── price-uncertainty band (cheap DIY sourcing .. shipped retail) ──────
  const bandFwd = pts.map(
    (p) =>
      `${X(p.capexLoUsd ?? p.capexUsd).toFixed(1)},${Y(p.outcomePct).toFixed(1)}`,
  );
  const bandBack = [...pts]
    .reverse()
    .map(
      (p) =>
        `${X(p.capexHiUsd ?? p.capexUsd).toFixed(1)},${Y(p.outcomePct).toFixed(1)}`,
    );
  push(
    `<polygon points="${bandFwd.concat(bandBack).join(" ")}" fill="${C.band}"/>`,
  );

  // ── the frontier itself ───────────────────────────────────────────────
  const line = pts
    .map((p) => `${X(p.capexUsd).toFixed(1)},${Y(p.outcomePct).toFixed(1)}`)
    .join(" ");
  push(
    `<polyline points="${line}" fill="none" stroke="${C.curve}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`,
  );
  // Every point is a real option and is clickable: a transparent hit-area ring
  // sits under the visible dot so small targets stay easy to grab, and each is
  // keyboard-focusable (role=button) so a keyboard or screen-reader user can
  // step through the systems too. Selecting a point moves the blue marker and
  // its readout to that system.
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const tip = t("frontierPointTip", {
      cost: money(p.capexUsd),
      pct: p.outcomePct,
      pv: p.pvKw,
      batt: p.battKwh,
    });
    push(
      `<g data-pt="${i}" role="button" tabindex="0" style="cursor:pointer;" aria-label="${esc(tip)}">` +
        `<circle cx="${X(p.capexUsd).toFixed(1)}" cy="${Y(p.outcomePct).toFixed(1)}" r="10" fill="transparent"/>` +
        `<circle cx="${X(p.capexUsd).toFixed(1)}" cy="${Y(p.outcomePct).toFixed(1)}" r="3.1" fill="${C.curve}"/>` +
        `<title>${esc(tip)}</title></g>`,
    );
  }

  // ── ceiling line when full coverage is out of reach at any price ───────
  const reach = frontier.reach || {};
  // Drawn whenever the sweep hit its own edge below full coverage - the line
  // marks the top of what was SEARCHED, which is a different claim from the
  // top of what is possible.
  const sweepLimited = reach.boundLimited && reach.ceilingPct < 99;
  if (sweepLimited) {
    const y = Y(reach.ceilingPct);
    push(
      `<line x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${(VB_W - PAD.r).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.ceiling}" stroke-width="1.5" stroke-dasharray="6 4"/>`,
    );
    // Above the line by default; below it when the line is close enough to the
    // top that the label would sit on the frame.
    const tagY = y - PAD.t < 20 ? y + 16 : y - 8;
    push(
      `<text x="${(VB_W - PAD.r - 6).toFixed(1)}" y="${tagY.toFixed(1)}" text-anchor="end" font-size="${FS}" font-weight="700" fill="${C.ceiling}">${esc(t("frontierCeilingTag", { pct: reach.ceilingPct }))}</text>`,
    );
  }

  // ── knee marker ───────────────────────────────────────────────────────
  if (knee) {
    const kx = X(knee.capexUsd),
      ky = Y(knee.outcomePct);
    push(
      `<line x1="${kx.toFixed(1)}" y1="${ky.toFixed(1)}" x2="${kx.toFixed(1)}" y2="${(VB_H - PAD.b).toFixed(1)}" stroke="${C.knee}" stroke-width="1.2" stroke-dasharray="4 4"/>`,
    );
    push(
      `<circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="6" fill="none" stroke="${C.knee}" stroke-width="2.4"/>`,
    );
    // Label at the foot of the dashed line, not beside the dot: down here it
    // can never overlap the curve or the other callout, however flat the
    // curve is or wherever the chosen option lands.
    if (!box.narrow) {
      const label = t("frontierKneeTag");
      const at = placeLabel(
        kx,
        label,
        FS_TAG,
        { left: PAD.l + 2, right: VB_W - PAD.r - 2 },
        8,
      );
      push(
        `<text x="${at.x.toFixed(1)}" y="${(VB_H - PAD.b - 9).toFixed(1)}" text-anchor="${at.anchor}" font-size="${FS_TAG}" font-weight="700" fill="${C.knee}">${esc(label)}</text>`,
      );
    }
  }

  // ── the selected option (click a point to change it) ──────────────────
  // The blue dot is the system currently being shown, i.e. the recommended one
  // until the visitor picks another. Beside it is the concrete readout — panel
  // kW, battery kWh, coverage and cost — not a vague "the option you're
  // reading", so there is no ambiguity about which solar/battery option is on
  // display. Clicking any dot (or Tab to it and pressing Enter) reselects.
  if (sel) {
    const sx = X(sel.capexUsd),
      sy = Y(sel.outcomePct);
    push(
      `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7.5" fill="${C.marker}" stroke="var(--bg-dark, #090d16)" stroke-width="2"/>`,
    );
    if (!box.narrow) {
      const label =
        sel.pvKw <= 0
          ? `Battery only: ${sel.battKwh} kWh (${sel.outcomePct}% peak offset, ${money(sel.capexUsd)})`
          : sel.battKwh > 0
            ? t("frontierSelTag", {
                pv: sel.pvKw,
                batt: sel.battKwh,
                pct: sel.outcomePct,
                cost: money(sel.capexUsd),
              })
            : t("frontierSelNoBatt", {
                pv: sel.pvKw,
                pct: sel.outcomePct,
                cost: money(sel.capexUsd),
              });
      const bounds = { left: PAD.l + 2, right: VB_W - PAD.r - 2 };
      let at = placeLabel(sx, label, FS_TAG, bounds, 13);
      // Prefer the side away from the knee ring when both sides would fit.
      const kneeX = knee ? X(knee.capexUsd) : null;
      if (
        kneeX !== null &&
        at.anchor === "start" &&
        kneeX > sx &&
        kneeX - sx < 70
      ) {
        if (sx - 13 - textWidth(label, FS_TAG) >= bounds.left)
          at = { x: sx - 13, anchor: "end" };
      }
      const ty = sy < PAD.t + 26 ? sy + 24 : sy - 16;
      const lw = textWidth(label, FS_TAG);
      const bgX =
        at.anchor === "end"
          ? at.x - lw
          : at.anchor === "start"
            ? at.x
            : at.x - lw / 2;
      // Dark plate under the readout keeps it readable over the curve.
      push(
        `<rect x="${bgX.toFixed(1)}" y="${(ty - FS_TAG - 2).toFixed(1)}" width="${(lw + 8).toFixed(1)}" height="${(FS_TAG + 7).toFixed(1)}" rx="4" fill="rgba(9,13,22,0.9)" stroke="${C.marker}" stroke-width="1"/>`,
      );
      push(
        `<text x="${at.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${at.anchor}" font-size="${FS_TAG}" font-weight="700" fill="${C.marker}">${esc(label)}</text>`,
      );
    }
  }

  // ── drag-preview ring (spectrum/budget sliders): a hollow amber marker at
  // a cached system's true position. Distinct from the blue selection dot so
  // a preview can never be mistaken for the system being read.
  const pv = opts.preview;
  if (
    pv &&
    Number.isFinite(pv.capexUsd) &&
    Number.isFinite(pv.outcomePct)
  ) {
    const px = X(pv.capexUsd),
      py = Y(pv.outcomePct);
    push(
      `<g style="pointer-events:none">` +
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="12" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="4 3"/></g>`,
    );
  }

  // ── axis captions ─────────────────────────────────────────────────────
  // Axis captions are constrained by the run they sit along: the x caption by
  // the plot's width, the (rotated) y caption by its height. Shrink to fit,
  // never overflow - a clipped word reads as a broken page.
  const fitFont = (text, run) =>
    Math.max(
      9.5,
      Math.min(FS_TAG, run / Math.max(1, String(text).length * 0.56)),
    );
  const xFs = fitFont(xLabel, plotW);
  const yFs = fitFont(yLabel, plotH);
  push(
    `<text x="${(PAD.l + plotW / 2).toFixed(1)}" y="${(VB_H - (box.narrow ? 6 : 8)).toFixed(1)}" text-anchor="middle" font-size="${xFs.toFixed(1)}" fill="${C.textBright}">${esc(xLabel)}</text>`,
  );
  push(
    `<text transform="translate(${box.narrow ? 12 : 15} ${(PAD.t + plotH / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="${yFs.toFixed(1)}" fill="${C.textBright}">${esc(yLabel)}</text>`,
  );

  const titleId = "frontierSvgTitle";
  const descId = "frontierSvgDesc";
  const desc = t("frontierSvgDesc", {
    n: pts.length,
    lowCost: money(pts[0].capexUsd),
    lowPct: pts[0].outcomePct,
    highCost: money(pts[pts.length - 1].capexUsd),
    highPct: pts[pts.length - 1].outcomePct,
  });

  const swatch = (inner) =>
    `<span aria-hidden="true" style="display:inline-block;width:22px;height:10px;margin-inline-end:7px;` +
    `vertical-align:middle;position:relative;">${inner}</span>`;
  const legendItems = [
    [
      swatch(
        `<span style="position:absolute;top:4px;left:0;width:22px;height:2.5px;background:${C.curve};border-radius:2px;"></span>`,
      ),
      t("frontierLegendCurve"),
    ],
    [
      swatch(
        `<span style="position:absolute;top:1px;left:0;width:22px;height:8px;background:${C.band};border-radius:2px;"></span>`,
      ),
      t("frontierLegendBand"),
    ],
    [
      swatch(
        `<span style="position:absolute;top:0;left:10px;width:0;height:11px;border-left:2px dashed ${C.knee};"></span>`,
      ),
      t("frontierLegendKnee"),
    ],
  ];
  if (sel)
    legendItems.push([
      swatch(
        `<span style="position:absolute;top:1px;left:6px;width:9px;height:9px;border-radius:50%;background:${C.marker};"></span>`,
      ),
      t("frontierLegendSel"),
    ]);
  if (sweepLimited)
    legendItems.push([
      swatch(
        `<span style="position:absolute;top:4px;left:0;width:22px;height:0;border-top:2px dashed ${C.ceiling};"></span>`,
      ),
      t("frontierLegendCeiling"),
    ]);

  const legend =
    `<ul style="list-style:none;display:flex;flex-wrap:wrap;gap:0.35rem 1.15rem;margin:0.6rem 0 0;padding:0;` +
    `font-size:0.8rem;color:var(--text-muted);line-height:1.5;">` +
    legendItems
      .map(
        ([sw, label]) =>
          `<li style="display:flex;align-items:center;">${sw}<span>${esc(label)}</span></li>`,
      )
      .join("") +
    `</ul>`;

  host.innerHTML =
    `<svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" dir="ltr" aria-labelledby="${titleId} ${descId}" ` +
    // direction, not dir: the HTML dir attribute does not govern SVG text, and
    // under an RTL document `text-anchor="end"` resolves to the LEFT - which
    // sent the right-hand axis label off the edge of the plot in Arabic. The
    // chart itself stays left-to-right in every locale, as charts do.
    `preserveAspectRatio="xMidYMid meet" style="direction:ltr;unicode-bidi:isolate;width:100%;height:auto;display:block;` +
    `border:1px solid var(--border-card);border-radius:10px;background:rgba(9,13,22,0.85);">` +
    `<title id="${titleId}">${esc(t("frontierSvgTitle"))}</title>` +
    `<desc id="${descId}">${esc(desc)}</desc>` +
    parts.join("") +
    `</svg>` +
    legend;

  // Wire the clickable points. Each re-render creates fresh elements, so the
  // listeners are attached here, after the SVG is in the DOM. Keyboard users
  // Tab to a point and press Enter/Space to pick it — same as a button.
  if (opts.onSelect) {
    host.querySelectorAll("[data-pt]").forEach((g) => {
      const i = Number(g.getAttribute("data-pt"));
      const activate = () => opts.onSelect(i);
      g.addEventListener("click", activate);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
          g.focus();
        }
      });
    });
  }

  if (opts.tableHost) renderFrontierTable(opts.tableHost, frontier, opts);
  return true;
}

/**
 * The curve ranks systems by up-front price. The recommendation on the cards
 * is chosen on TRUE 20-year cost, so it can legitimately sit to the right of
 * the curve - a cheaper bank that gets replaced twice is cheaper today and
 * dearer by 2046. Rather than snapping the marker onto the line and quietly
 * misstating its price, say so when the gap is big enough to notice.
 * @returns {string} note text, or "" when the marker sits on the curve
 */
export function markerOffCurveNote(frontier, opts = {}) {
  const t = opts.t || ((k) => k);
  const m = frontier && frontier.marker;
  const pts = (frontier && frontier.points) || [];
  if (
    !m ||
    !pts.length ||
    !Number.isFinite(m.capexUsd) ||
    !Number.isFinite(m.outcomePct)
  )
    return "";
  // Same coverage for less money, by more than a rounding error?
  const cheaperSame = pts.find(
    (q) => q.outcomePct >= m.outcomePct - 0.6 && q.capexUsd < m.capexUsd * 0.97,
  );
  if (cheaperSame) return t("frontierMarkerOffCurve");
  // Or simply not ON the line in either direction: nearest-cost curve point
  // more than ~2 points away in coverage means the recommendation is not a
  // curve system at all (lifetime-optimal vs capex-optimal picks differ).
  let nearest = null,
    bestGap = Infinity;
  for (const q of pts) {
    const gap = Math.abs(q.capexUsd - m.capexUsd);
    if (gap < bestGap) {
      bestGap = gap;
      nearest = q;
    }
  }
  if (nearest && Math.abs(nearest.outcomePct - m.outcomePct) > 2)
    return t("frontierMarkerOffCurve");
  return "";
}

/**
 * Does the frontier marker name the same system as a curve point? The marker
 * carries the recommendation's exact hardware; the pointIndex is only the
 * nearest by up-front cost. Tagging the row on cost proximity alone is how
 * the table ended up naming a different battery than the blue dot. Both the
 * hardware (same tolerances as the adopted-point SOC match) AND the chemistry
 * must agree before the "selected" tag is printed.
 */
export function markerMatchesPoint(marker, point, frontierChemistry) {
  if (!marker || !point) return false;
  if (
    !Number.isFinite(marker.pvKw) ||
    !Number.isFinite(marker.battKwh) ||
    !Number.isFinite(point.pvKw) ||
    !Number.isFinite(point.battKwh)
  )
    return false;
  if (
    marker.chemistry &&
    frontierChemistry &&
    marker.chemistry !== frontierChemistry
  )
    return false;
  return (
    Math.abs((point.pvKw || 0) - (marker.pvKw || 0)) < 0.06 &&
    Math.abs((point.battKwh || 0) - (marker.battKwh || 0)) < 0.6
  );
}
/**
 * The same numbers as a table. Not a fallback nobody sees - it is inside a
 * <details> on the page, so anyone who wants the figures can read them, and
 * it is what a screen reader or a printed page gets.
 */
export function renderFrontierTable(host, frontier, opts = {}) {
  if (!host) return;
  const t = opts.t || ((k) => k);
  const money = opts.money || ((v) => "$" + Math.round(v).toLocaleString());
  const pts = (frontier && frontier.points) || [];
  if (!pts.length) {
    host.innerHTML = "";
    return;
  }

  const gridTie = frontier.mode === "gridtie";
  // Tag the row that matches the same selection the chart highlights, so the
  // numbers table and the blue dot always name the same system. An explicit
  // click always tags. The marker fallback tags ONLY when the nearest-cost
  // row really is the marker's system (same hardware, same chemistry) —
  // otherwise the tag stays off and the off-curve note explains why the
  // recommendation floats beside the line, instead of the table naming a
  // different battery than the dot.
  let selTable =
    typeof opts.selected === "number" &&
    opts.selected >= 0 &&
    pts[opts.selected]
      ? opts.selected
      : -1;
  if (selTable < 0) {
    const m = frontier.marker;
    const idx =
      m && Number.isFinite(m.pointIndex) && pts[m.pointIndex]
        ? m.pointIndex
        : -1;
    if (idx >= 0 && markerMatchesPoint(m, pts[idx], frontier.chemistry))
      selTable = idx;
  }
  const rows = pts.map((p, i) => {
    const tags = [];
    if (i === frontier.kneeIndex) tags.push(esc(t("frontierKneeTag")));
    if (i === selTable) tags.push(`<b>${esc(t("frontierTagSel"))}</b>`);
    return (
      `<tr><th scope="row" style="text-align:left;font-weight:600;">${esc(money(p.capexUsd))}</th>` +
      `<td>${esc(money(p.capexLoUsd))} &ndash; ${esc(money(p.capexHiUsd))}</td>` +
      `<td>${p.outcomePct}%</td>` +
      `<td>${p.pvKw} kW</td>` +
      `<td>${p.battKwh > 0 ? p.battKwh + " kWh" : esc(t("frontierNoBattery"))}</td>` +
      `<td>${tags.join(", ")}</td></tr>`
    );
  });

  host.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">` +
    `<caption style="text-align:left;color:var(--text-muted);padding-bottom:0.4rem;">${esc(t("frontierTableCaption"))}</caption>` +
    `<thead><tr>` +
    `<th scope="col" style="text-align:left;">${esc(t("frontierColCost"))}</th>` +
    `<th scope="col" style="text-align:left;">${esc(t("frontierColRange"))}</th>` +
    `<th scope="col" style="text-align:left;">${esc(gridTie ? t("frontierColCut") : t("frontierColCover"))}</th>` +
    `<th scope="col" style="text-align:left;">${esc(t("frontierColPv"))}</th>` +
    `<th scope="col" style="text-align:left;">${esc(t("frontierColBatt"))}</th>` +
    `<th scope="col" style="text-align:left;">&nbsp;</th>` +
    `</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

/**
 * One sentence that says what the curve means. Built from ids and numbers so
 * every locale phrases it natively - no English is assembled here.
 */
export function frontierVerdict(frontier, opts = {}) {
  const t = opts.t || ((k) => k);
  const money = opts.money || ((v) => "$" + Math.round(v).toLocaleString());
  const r = (frontier && frontier.reach) || {};
  const gridTie = frontier && frontier.mode === "gridtie";
  const params = {
    ceilingPct: r.ceilingPct,
    ceilingCost:
      r.ceilingCostUsd === null || r.ceilingCostUsd === undefined
        ? ""
        : money(r.ceilingCostUsd),
    kneePct: r.kneePct,
    kneeCost:
      r.kneeCostUsd === null || r.kneeCostUsd === undefined
        ? ""
        : money(r.kneeCostUsd),
    headCost:
      r.headCostPerPoint === null || r.headCostPerPoint === undefined
        ? ""
        : money(r.headCostPerPoint),
    tailCost:
      r.tailCostPerPoint === null || r.tailCostPerPoint === undefined
        ? ""
        : money(r.tailCostPerPoint),
    ratio: r.tailRatio,
    pvMax: r.pvMaxKw ?? "",
    battMax: r.battMaxKwh ?? "",
    pv: r.entryPvKw ?? "",
    batt: r.entryBattKwh ?? "",
    cost:
      r.entryCostUsd === null || r.entryCostUsd === undefined
        ? ""
        : money(r.entryCostUsd),
  };
  const suffix = gridTie ? "Grid" : "Offgrid";
  if (r.id === "already-covered")
    return t("frontierVerdictCovered" + suffix, params);
  if (r.id === "beyond-sweep")
    return t("frontierVerdictBeyondSweep" + suffix, params);
  if (r.id === "steep-tail") return t("frontierVerdictSteep" + suffix, params);
  if (r.id === "tapering") return t("frontierVerdictTapering" + suffix, params);
  return t("frontierVerdictLinear" + suffix, params);
}
