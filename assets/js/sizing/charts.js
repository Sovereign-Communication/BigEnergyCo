// Canvas-chart mechanics extracted from ui.js: the reliability (SOC) charts,
// the cumulative-cost chart, the auto-comparison chart, and the zoom/pan
// interaction machinery. Rendering only — every decision (which system is
// selected, what the visitor chose) arrives as arguments. Injected boundary:
// `$` (DOM lookup), `el` (element factory), `t` (i18n), `fmt` (number format),
// `money` (currency formatter). Chart state (socZoomRange, cachedChartState)
// lives here as the single owner.
import { savingsPanelState, seriesBreakdown } from "./money.js?v=20260925c";

// ── injected boundary (set once by ui.js via initCharts) ──────────────────
let _$;
let _el;
let _t;
let _fmt;
let _money;

export function initCharts({ $, el, t, fmt, money }) {
  _$ = $;
  _el = el;
  _t = t;
  _fmt = fmt;
  _money = money;
}

function $(id) {
  return _$(id);
}
function el(...args) {
  return _el(...args);
}
function t(key, params) {
  return _t(key, params);
}
function fmt(n) {
  return _fmt(n);
}
function money(usd) {
  return _money(usd);
}

// ── chart state: single owner (moved from ui.js verbatim) ──────────────────

// SOC chart zoom state: null = full view; { start: number, end: number } = sliced
let socZoomRange = null;
let cachedChartState = null;

// ── palette + names (moved verbatim) ───────────────────────────────────────

export const TIER_COLORS = {
  tier100: "#00e699",
  tier99: "#60a5fa",
  tier95: "#f59e0b",

  cut60: "#60a5fa",
  cut80: "#00e699",
  cut95: "#f59e0b",

  "auto-naion": "#60a5fa",
  "auto-lfp": "#00e699",
  "auto-agm": "#f59e0b",
};

export const TIER_NAMES = {
  tier100: "100% - never needs a generator",

  tier99: "99% - generator as rare backup",

  tier95: "95% - generator now and then",

  cut60: "~60% bill cut - grid covers the rest",

  cut80: "~80% bill cut - small grid top-ups",

  cut95: "~95% bill cut - near off-grid",

  "auto-naion": "Sodium-Ion bank over five real years",

  "auto-lfp": "LFP bank over five real years",
};

function drawSunStrip(ctx, pv, X, W, padL, padR, stripH) {
  const pvMax = Math.max(...pv, 0.1);

  const amp = stripH - 16;

  const plotW = W - padL - padR;

  ctx.save();

  ctx.beginPath();

  ctx.rect(padL, 0, plotW, stripH);

  ctx.clip();

  ctx.beginPath();

  ctx.moveTo(padL, stripH);

  for (let i = 0; i < pv.length; i++)
    ctx.lineTo(X(i), stripH - (pv[i] / pvMax) * amp);

  ctx.lineTo(W - padR, stripH);

  ctx.closePath();

  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#fbbf24";
  ctx.fill();

  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.globalAlpha = 1;

  ctx.restore();

  ctx.font = "10px ui-monospace, monospace";

  ctx.fillStyle = "#fcd34d";
  ctx.textAlign = "left";

  ctx.fillText(
    `daily sun - kWh per kW of panel - peak day ${pvMax.toFixed(1)}`,
    padL + 2,
    11,
  );
}

export function drawSocChart(history, chemLabel, hasPv = true) {
  const wrap = $("socChartWrap");

  const canvas = $("socCanvas");

  if (!wrap || !canvas) return;

  const solvable = history.tiers.filter(
    (t) => t.dailyMin && t.dailyMax && t.dailyMin.length,
  );
  if (!solvable.length) {
    wrap.style.display = "none";
    return;
  }

  cachedChartState = { type: "soc", history, chemLabel };

  wrap.style.display = "block";

  // hide the old legend row - labels live inside each band now

  const legend = $("socLegend");

  if (legend) legend.style.display = "none";

  const gt = history.kind === "gridtie";

  const dpr = window.devicePixelRatio || 1;

  const W = Math.max(
    200,
    Math.min(
      wrap.clientWidth || 320,
      typeof window !== "undefined" && window.innerWidth
        ? window.innerWidth - 48
        : 640,
    ),
  );

  const BAND_H = 118,
    GAP = 14;

  const nDays = solvable.length ? solvable[0].dailyMin.length : 0;

  const zStart =
    socZoomRange && Number.isFinite(socZoomRange.start)
      ? Math.max(0, Math.min(nDays - 2, socZoomRange.start))
      : 0;

  const zEnd =
    socZoomRange && Number.isFinite(socZoomRange.end)
      ? Math.max(zStart + 1, Math.min(nDays - 1, socZoomRange.end))
      : nDays - 1;

  const visibleDays = Math.max(1, zEnd - zStart);

  // The strip is the SITE's daily harvest per kW of array, so the series exists
  // even when the run has no array at all. Drawing it for a battery-only build
  // put a solar signal on a panel-free chart and then explained it as what
  // drives that battery's recharge rhythm — nothing about this battery follows
  // the sun. `hasPv` is the run's own hardware, not the weather's.
  const pv =
    hasPv && history.pvDaily && nDays && history.pvDaily.length === nDays
      ? history.pvDaily
      : null;

  const stripH = pv ? 64 : 0,
    stripGap = pv ? 10 : 0;

  const H =
    stripH +
    stripGap +
    solvable.length * BAND_H +
    (solvable.length - 1) * GAP +
    20;

  canvas.width = Math.round(W * dpr);

  canvas.height = Math.round(H * dpr);

  canvas.style.width = "100%";

  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 34,
    padR = 10,
    padT = 26,
    padB = 8;

  const plotW = W - padL - padR;

  const X = (i) => padL + ((i - zStart) / visibleDays) * plotW;

  function drawBand(t, top) {
    const color = TIER_COLORS[t.id] || t.color || "#888";

    const plotH = BAND_H - padT - padB;

    const Y = (socPct) => top + padT + (1 - socPct / 100) * plotH;

    // frame

    ctx.strokeStyle = "rgba(255,255,255,0.10)";

    ctx.strokeRect(padL, top + padT, plotW, plotH);

    // gridlines at 50% and 100%, red dashed at empty

    ctx.font = "10px ui-monospace, monospace";

    for (const v of [20, 50, 100]) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";

      ctx.beginPath();
      ctx.moveTo(padL, Y(v));
      ctx.lineTo(W - padR, Y(v));
      ctx.stroke();

      ctx.fillStyle = "#6b7280";
      ctx.textAlign = "right";

      ctx.fillText(v + "%", padL - 5, Y(v) + 3);
    }

    const floorSOC = chemLabel.includes("AGM") ? 50 : 20;

    ctx.fillStyle = "rgba(100,100,100,0.08)";

    ctx.fillRect(padL, Y(floorSOC), plotW, Y(0) - Y(floorSOC));

    ctx.strokeStyle = "rgba(239,68,68,0.7)";

    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(padL, Y(0));
    ctx.lineTo(W - padR, Y(0));
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(239,68,68,0.85)";
    ctx.textAlign = "left";

    ctx.fillText(
      gt ? "bank empty" : "empty",
      W - padR - (gt ? 74 : 38),
      Y(0) - 4,
    );

    // Clip plotting area for zoom and pan
    ctx.save();

    ctx.beginPath();

    ctx.rect(padL, top + padT, plotW, plotH);

    ctx.clip();

    ctx.beginPath();

    ctx.moveTo(X(zStart), Y(t.dailyMax[zStart]));

    for (let i = zStart + 1; i <= zEnd; i++) ctx.lineTo(X(i), Y(t.dailyMax[i]));

    for (let i = zEnd; i >= zStart; i--) ctx.lineTo(X(i), Y(t.dailyMin[i]));

    ctx.closePath();

    ctx.globalAlpha = 0.22;

    ctx.fillStyle = color;

    ctx.fill();

    ctx.globalAlpha = 1;

    // stroke both edges so the range reads crisply

    ctx.strokeStyle = color;

    ctx.lineWidth = 1;

    ctx.globalAlpha = 0.6;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) {
      const y = Y(t.dailyMin[i]);
      if (i === zStart) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }

    ctx.stroke();

    // top edge thicker: "does it reach full?" should be unmistakable

    ctx.globalAlpha = 0.95;

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) {
      const y = Y(t.dailyMax[i]);
      if (i === zStart) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }

    ctx.stroke();

    ctx.restore();

    ctx.globalAlpha = 1;

    // label: tier name + one-sentence verdict

    ctx.textAlign = "left";

    ctx.fillStyle = "#f3f4f6";

    ctx.font = "bold 12px system-ui, sans-serif";

    ctx.fillText(TIER_NAMES[t.id] || t.chemLabel || t.id, padL + 2, top + 13);

    ctx.font = "11px system-ui, sans-serif";

    ctx.fillStyle = t.emptyDays > 0 ? "rgba(245,158,11,0.95)" : color;

    const charged = `charged to 100% on ${fmt(t.fullDays)} of ${fmt(t.totalDays)} days`;

    const verdict =
      t.emptyDays > 0
        ? gt
          ? `${charged} - but drained flat on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"} - the grid covered those`
          : `${charged} - but hit empty on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"}`
        : `${charged} - never went empty`;

    ctx.fillText(
      `lowest point ${Math.max(0, Math.round(t.minPct))}% - ${verdict}`,
      padL + 2,
      top + padT + 14,
    );
  }

  const topOffset = stripH + stripGap;

  if (pv) drawSunStrip(ctx, pv, X, W, padL, padR, stripH);

  solvable.forEach((t, idx) => drawBand(t, topOffset + idx * (BAND_H + GAP)));

  // shared x labels: years or day indices if zoomed in

  ctx.fillStyle = "#6b7280";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";

  if (socZoomRange && visibleDays < 365) {
    const step = Math.max(1, Math.floor(visibleDays / 6));

    for (let d = zStart; d <= zEnd; d += step) {
      const x = X(d);

      ctx.fillText(
        `Day ${d + 1}`,
        Math.min(W - padR - 16, Math.max(padL + 16, x)),
        H - 2,
      );
    }
  } else {
    const span = history.endYear - history.startYear + 1;

    const daysTotal = history.days || solvable[0].dailyMin.length;

    for (let yy = 0; yy <= span; yy++) {
      const dayIdx = Math.round(yy * 365.25);

      if (dayIdx >= zStart && dayIdx <= zEnd) {
        const x = X(dayIdx);

        ctx.fillText(
          String(history.startYear + yy),
          Math.min(W - padR, Math.max(padL, x)),
          H - 2,
        );
      }
    }
  }

  $("socCaption").textContent = gt
    ? `Each band spans one day: top edge = fullest the battery got, bottom edge = deepest discharge, ` +
      `${history.startYear}-${history.endYear} of real satellite weather. In grid-tie mode the red line isn't a blackout - ` +
      `when the band dives to it, the grid covered those hours instead (that's your remaining bill). Flat, high bands mean solar and battery are doing the work.`
    : `Each band spans one day: top edge = fullest the battery got, bottom edge = deepest discharge, ` +
      `${history.startYear}-${history.endYear} of real satellite weather (${chemLabel}). Every healthy system ` +
      `charges all the way back to 100% on sunny days - the difference between systems is how far the bottom ` +
      `edge dives toward empty during bad weather. Touch the red line and a generator is covering you.`;

  if (pv)
    $("socCaption").textContent +=
      " The amber strip on top is the daily solar harvest (kWh per kW of panel) - its long dips line up with the battery's lowest floors.";
}

/**
 * The sentence under the cumulative-cost canvas, assembled from figures the
 * chart has already computed — so it can be read and tested without a canvas.
 *
 * Two things it must never do again:
 *   - describe a panel-free run as a solar one. With no PV the emerald line is
 *     still the system's own cost, but it is not a SOLAR system's, and the
 *     smaller bills are not the ones left "after solar";
 *   - call a NEGATIVE 20-year gap money the system "puts back in your pocket".
 *     That claimed a saving and then, one sentence later, said the system never
 *     pays for itself — the caption contradicting its own arithmetic in every
 *     mode, not only battery-only.
 */
export function cumCostCaptionText({
  seriesEntry = {},
  isBest = false,
  bd = {},
  beIdx = -1,
  nY = 0,
  grid = [],
  solar = [],
  residShown = false,
  residEnd = null,
  residAnnual = 0,
}) {
  const noPanels = !(Number(seriesEntry.pvKw) > 0);
  // One sentence per element, joined by a space: the locale strings carry no
  // leading whitespace, so concatenating them directly ran the sentences
  // together ("(~$65,237.00).The emerald line…").
  const parts = [
    t("cumCostCaptionHead", {
      which: t(isBest ? "cumCostRecommended" : "cumCostSelected"),
      label: seriesEntry.chemLabel || seriesEntry.label || "",
      gridTotal: money(bd.gridTotal),
    }),
    t(noPanels ? "cumCostCaptionOwnCostNoPanels" : "cumCostCaptionOwnCost", {
      systemTotal: money(bd.systemTotal),
    }),
  ];
  if (bd.residualBills !== null && bd.residualBills < 0) {
    parts.push(
      t("cumCostCaptionSurplusCredit", {
        withSolar:
          bd.withSolar < 0
            ? `\u2212${money(-bd.withSolar)}`
            : money(bd.withSolar),
        owed: money(-bd.residualBills),
      }),
    );
  } else if (bd.saved < 0) {
    parts.push(
      t("cumCostCaptionNetNegative", {
        residualBills: money(bd.residualBills),
        loss: money(-bd.saved),
      }),
    );
  } else {
    parts.push(
      t(noPanels ? "cumCostCaptionStackNoPanels" : "cumCostCaptionStack", {
        residualBills: money(bd.residualBills),
        saved: money(bd.saved),
      }),
    );
  }
  if (beIdx >= 0 && !(bd.saved < 0)) {
    const saved = (grid[nY - 1] || 0) - (solar[nY - 1] || 0);
    parts.push(
      t("cumCostCaptionRepaid", {
        year: beIdx + 1,
        perYear: money(Math.round(saved / (nY - beIdx))),
        saved: money(saved),
      }),
    );
  } else if (beIdx < 0) {
    parts.push(t("cumCostCaptionNeverRepays"));
  }
  // A curve that crosses break-even and then falls back under it (a late bank
  // swap can push the solar line above the grid line again) gets neither
  // sentence: "repaid by year N" would deny the loss, "never repays" would
  // deny the crossing, and the net-negative sentence above already states the
  // only thing that is true of the 20 years as a whole.
  if (residShown) {
    const kwh = seriesEntry.importedKwhPerYear || 0;
    parts.push(
      residEnd >= 0
        ? t("cumCostCaptionResidual", {
            annual: money(residAnnual),
            kwh: fmt(kwh),
            end: money(residEnd),
          })
        : t(
            kwh > 0
              ? "cumCostCaptionResidualCreditDraw"
              : "cumCostCaptionResidualCreditBill",
            { kwh: fmt(kwh), earned: money(-residEnd) },
          ),
    );
  }
  return parts.join(" ");
}

export function drawCumCostChart(p, chosenEntry = null) {
  const wrap = $("cumCostChartWrap");
  const canvas = $("cumCostCanvas");
  if (!wrap || !canvas) return;

  // The section's own question, decided by the RUN rather than by whatever the
  // chart ends up showing. "What does solar really save you?" is the right
  // question for a run with panels; a battery-only run builds none, so the
  // panel asks what the bank it DID build changes. Set here, before the
  // infeasible/unavailable branches return, so no path can leave the other
  // mode's question above a battery-only panel. #cumCostTitle is markup, so the
  // alternate wording is swapped in rather than duplicated.
  const hasPvRun = p.hardwareConfig !== "battery";
  const title = $("cumCostTitle");
  if (title) {
    title.textContent = hasPvRun
      ? "What does solar really save you? (cumulative 20-year cost)"
      : "What does the battery do to your 20-year cost? (cumulative 20-year cost)";
  }

  // Pick the system the chart talks about: the selected one, else the
  // recommended one, else the focus system, else the first solvable entry.
  const pool =
    p.auto && p.auto.length
      ? p.auto
      : p.targets && p.targets.length
        ? p.targets
        : p.tiers || [];
  // The chart follows the selected system when one is chosen and it carries a
  // comparable series (matrix cells, custom cuts and adopted curve points all
  // do); otherwise fall back to the recommendation logic.
  const entry =
    chosenEntry &&
    chosenEntry.cumCostSeries &&
    chosenEntry.cumCostSeries.grid &&
    chosenEntry.cumCostSeries.grid.length
      ? chosenEntry
      : p.best ||
        (p.focus &&
          pool.find(
            (x) =>
              x &&
              x.chemistry === p.focus.chemistry &&
              x.pvKw === p.focus.pvKw &&
              x.battKwh === p.focus.battKwh,
          )) ||
        (pool || []).find((x) => x && x.solvable) ||
        null;
  const seriesEntry =
    entry?.cumCostSeries?.grid?.length && entry?.cumCostSeries?.solar?.length
      ? entry
      : null;
  const series = seriesEntry?.cumCostSeries || null;
  const panel = savingsPanelState(series, p.tariff, p.unreachableReason);
  if (panel.kind === "infeasible") {
    // Structural no-answer (off-grid + solar-only, etc.). The infeasible
    // banner up top is the right answer; the savings panel is a distraction
    // here, so collapse it and let the chart heading stay visible (the
    // frontier below it still tells the site story).
    if (wrap) wrap.style.display = "block";
    if (canvas) canvas.style.display = "none";
    if (canvas)
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    const box = $("cumSavingsBox");
    const cap = $("cumCostCaption");
    const leg = $("cumCostLegend");
    if (cap) cap.textContent = "";
    if (leg) {
      leg.style.display = "none";
      leg.textContent = "";
    }
    if (box) box.style.display = "none";
    return;
  }
  if (panel.kind === "unavailable") {
    // Either the intentional no-tariff state or a result with no comparable
    // series. Tear down any leftover chart and caption from a previous run
    // so the message box is the only thing on screen, then say why.
    wrap.style.display = "block";
    canvas.style.display = "none";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    const box = $("cumSavingsBox");
    const num = $("cumSavingsTotal");
    const sub = $("cumSavingsSub");
    const cap = $("cumCostCaption");
    if (cap) cap.textContent = "";
    const leg = $("cumCostLegend");
    if (leg) {
      leg.style.display = "none";
      leg.textContent = "";
    }
    if (box && num && sub) {
      box.style.display = "block";
      num.textContent = panel.title;
      num.style.color = "var(--text-main)";
      sub.textContent = panel.sub;
      sub.style.color = "var(--text-muted)";
    }
    return;
  }

  wrap.style.display = "block";
  canvas.style.display = "";
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(
    200,
    Math.min(
      wrap.clientWidth || 320,
      typeof window !== "undefined" && window.innerWidth
        ? window.innerWidth - 48
        : 640,
    ),
  );
  const COST_H = 280,
    SAVE_H = 150,
    GAP = 14;
  const H = COST_H + GAP + SAVE_H;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const padL = 62,
    padR = 58,
    padT = 26,
    padB = 24;
  const plotW = W - padL - padR,
    plotH = COST_H - padT - padB;
  const nY = series.years || series.grid.length;
  const hasSystem = Array.isArray(series.system) && series.system.length === nY;
  // Residual grid cost (slate line): the running width of the bills wedge,
  // solar − system. On grid-tie it is the money still handed to the utility
  // each year net of the feed-in credit; when net metering makes the credit
  // out-earn the bill, the line (and its 20-year total) goes negative, so
  // the axis gains a little headroom below $0 to show it.
  const residLine = hasSystem
    ? series.solar.map((s, i) => s - series.system[i])
    : null;
  const residEnd = residLine ? residLine[nY - 1] : null;
  const residAnnual =
    residLine && nY > 1 ? residLine[nY - 1] - residLine[nY - 2] : 0;
  const residShown = !!(
    residLine &&
    seriesEntry &&
    typeof seriesEntry.importedKwhPerYear === "number" &&
    residAnnual !== 0
  );
  const maxCost = Math.max(
    series.grid[nY - 1] || 0,
    series.solar[nY - 1] || 0,
    residShown ? residEnd : 0,
    1,
  );
  const minCost = residShown ? Math.min(0, ...residLine) : 0;
  const bd = seriesBreakdown(series) || {};
  const X = (i) => padL + (i / (nY - 1)) * plotW;
  const Y = (v) => padT + (1 - (v - minCost) / (maxCost - minCost)) * plotH;

  // ── headline callout (HTML, above the canvas) ────────────────────────
  const diff = series.grid.map((g, i) => g - series.solar[i]);
  let beIdx = -1;
  for (let i = 0; i < nY; i++) {
    if (series.grid[i] >= series.solar[i]) {
      beIdx = i;
      break;
    }
  }
  const totalSaved = diff[nY - 1] || 0;
  const servedKwh = seriesEntry.servedKwhPerYear || 0;
  const box = $("cumSavingsBox"),
    num = $("cumSavingsTotal"),
    sub = $("cumSavingsSub");
  if (box && num && sub) {
    box.style.display = "block";
    if (totalSaved > 0) {
      num.textContent = `+~${money(totalSaved)} saved over 20 years`;
      num.style.color = "var(--primary-accent)";
      const kwhBits =
        servedKwh > 0
          ? ` · ~${fmt(servedKwh)} kWh/yr served by the sun instead of the grid`
          : "";
      sub.textContent = `Break-even in year ${beIdx + 1} \u2014 every year after puts money back in your pocket${kwhBits}`;
      sub.style.color = "var(--text-muted)";
    } else {
      num.textContent = "Never breaks even within 20 years";
      num.style.color = "var(--danger-red)";
      sub.textContent = `Battery replacements outpace bill savings at this site — the honest shortfall is ~${money(Math.abs(totalSaved))}.`;
      sub.style.color = "var(--text-muted)";
    }
  }

  // ── top panel: the two running cost sums ─────────────────────────────
  // gridlines (light)
  ctx.font = "10px ui-monospace, monospace";
  for (let k = 0; k <= 4; k++) {
    const v = (maxCost * k) / 4;
    const y = Y(v);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";
    ctx.fillText(money(Math.round(v)), padL - 6, y + 3);
  }

  // ── stacked bands, bottom → top: system cost → remaining bills → savings ──
  // The amber line is drawn as a literal stack so nobody can misread the
  // figures as additive: the emerald band (0 → system) is VISIBLY inside the
  // slate wedge (system → solar — the bills that remain after solar), which
  // is inside the amber total. Red fills the pre-break-even region where the
  // grid total dips BELOW the with-solar stack (money still owed); green is
  // the savings wedge after break-even.
  const baseline = new Array(nY).fill(0);
  const bandFill = (lo, hi, colorFor) => {
    for (let i = 0; i < nY - 1; i++) {
      // Skip hairline inversions (the emerald line leads the bills wedge by
      // the first-install labor for the opening segment) rather than paint a
      // twisted quad — the boundary lines still tell the truth.
      if (lo[i] > hi[i] || lo[i + 1] > hi[i + 1]) continue;
      ctx.fillStyle = colorFor(i);
      ctx.beginPath();
      ctx.moveTo(X(i), Y(lo[i]));
      ctx.lineTo(X(i + 1), Y(lo[i + 1]));
      ctx.lineTo(X(i + 1), Y(hi[i + 1]));
      ctx.lineTo(X(i), Y(hi[i]));
      ctx.closePath();
      ctx.fill();
    }
  };
  if (hasSystem) {
    bandFill(baseline, series.system, () => "rgba(52,211,153,0.16)");
    bandFill(series.system, series.solar, () => "rgba(148,163,184,0.22)");
  }
  bandFill(series.solar, series.grid, (i) =>
    series.grid[i] >= series.solar[i]
      ? "rgba(16,185,129,0.28)"
      : "rgba(239,68,68,0.22)",
  );

  // break-even marker: dashed vertical + label to the RIGHT at mid-height,
  // clear of the curve and the axis labels
  if (beIdx >= 0) {
    const beVal = series.solar[beIdx];
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.beginPath();
    ctx.moveTo(X(beIdx), padT);
    ctx.lineTo(X(beIdx), padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    const beLblX = Math.min(X(beIdx) + 6, W - padR - 84);
    ctx.fillText(`break-even yr ${beIdx + 1}`, beLblX, padT + plotH * 0.3);
    ctx.beginPath();
    ctx.arc(X(beIdx), Y(beVal), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f9fafb";
    ctx.fill();
  }

  // the two lines: amber = grid, emerald = the system alone (ends on the
  // recommendation's total)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fbbf24";
  ctx.beginPath();
  for (let i = 0; i < nY; i++) {
    const y = Y(series.grid[i]);
    if (i === 0) ctx.moveTo(X(i), y);
    else ctx.lineTo(X(i), y);
  }
  ctx.stroke();
  if (hasSystem) {
    ctx.strokeStyle = "#34d399";
    ctx.beginPath();
    for (let i = 0; i < nY; i++) {
      const y = Y(series.system[i]);
      if (i === 0) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }
    ctx.stroke();
  }
  // Residual grid cost: slate, thinner. Normally it rides low (the bills that
  // remain accumulate toward their 20-year total); under net metering — when
  // the feed-in credit out-earns the bill — it runs below the $0 line.
  if (residShown && residLine) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < nY; i++) {
      const y = Y(residLine[i]);
      if (i === 0) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }
    ctx.stroke();
    ctx.lineWidth = 2.5;
  }

  // ── legend: the figures live under the chart, never on it ────────────
  // The line-end totals used to sit at the plot's right edge, colored like
  // their lines, and collided wherever the curves converged. They now live
  // in a color-keyed legend beneath the canvas — same colors as the lines
  // (amber grid, emerald system) — so each figure is unambiguous and can
  // never overlap a line or another label.
  const legend = $("cumCostLegend");
  if (legend) {
    const swatch = (color) => {
      const box = el("span", {
        style:
          "display:inline-block;width:22px;height:10px;margin-inline-end:7px;vertical-align:middle;position:relative;",
        "aria-hidden": "true",
      });
      box.appendChild(
        el("span", {
          style: `position:absolute;top:4px;left:0;width:22px;height:2.5px;background:${color};border-radius:2px;`,
        }),
      );
      return box;
    };
    const rows = [
      ["#fbbf24", `Grid without solar: ${money(series.grid[nY - 1])}`],
    ];
    // The emerald line is this system's own cost, and for a panel-free run this
    // system is not a solar one — the same chart's caption says "the system's
    // own cost" two lines under a legend that called it the solar system. The
    // no-panel key matches the wording the frontier chart already uses.
    const hasPv = Number(seriesEntry && seriesEntry.pvKw) > 0;
    if (hasSystem)
      rows.push([
        "#34d399",
        `${hasPv ? "Solar system" : "Battery only"}: ${money(series.system[nY - 1])}`,
      ]);
    if (residShown && residEnd !== null) {
      rows.push([
        "#94a3b8",
        residEnd >= 0
          ? `Residual grid cost after feed-in: ${money(residEnd)}`
          : `Residual grid cost after feed-in: \u2212${money(-residEnd)} (net-metering credit)`,
      ]);
    }
    legend.textContent = "";
    for (const [color, label] of rows) {
      const row = el("span", { style: "display:flex;align-items:center;" });
      row.appendChild(swatch(color));
      row.appendChild(el("span", {}, label));
      legend.appendChild(row);
    }
    legend.style.display = "flex";
  }

  // ── bottom panel: your pocket, as growing bars ───────────────────────
  const sTop = COST_H + GAP + 10,
    sPadT = 16,
    sPadB = 6;
  const sH = SAVE_H - sPadT - sPadB - 16; // 16px reserved for the year labels
  const dMin = Math.min(...diff, 0),
    dMax = Math.max(...diff, 1);
  // headroom above the tallest bar: keeps the total label and the panel
  // title on separate rows instead of colliding
  const sTop2 = dMax + (dMax - dMin) * 0.12;
  const D = (v) => sTop + sPadT + (1 - (v - dMin) / (sTop2 - dMin || 1)) * sH;
  const zeroY = D(0);

  // zero baseline
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath();
  ctx.moveTo(padL, zeroY);
  ctx.lineTo(W - padR, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText("$0", padL - 6, zeroY + 3);

  // bars: red while unpaid, green once the system is ahead
  const bw2 = (plotW / nY) * 0.66;
  for (let i = 0; i < nY; i++) {
    const v = diff[i];
    const bx = X(i) - bw2 / 2;
    if (v < 0) {
      ctx.fillStyle = "rgba(239,68,68,0.45)";
      ctx.fillRect(bx, zeroY, bw2, D(v) - zeroY);
    } else {
      const grad = ctx.createLinearGradient(0, D(v), 0, zeroY);
      grad.addColorStop(0, "rgba(52,211,153,0.95)");
      grad.addColorStop(1, "rgba(16,185,129,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(bx, D(v), bw2, zeroY - D(v));
    }
  }

  // panel title (left, short) + the total crowns the tallest bar (right)
  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText("your pocket, year by year", padL + 2, sTop + 9);
  ctx.textAlign = "right";
  ctx.fillStyle = "#34d399";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillText(`+${money(dMax)}`, W - padR - 4, D(dMax) - 8);

  // break-even tick rides just ABOVE the zero line — the early years have
  // empty space there (their bars sit below zero), so nothing collides
  if (beIdx >= 0) {
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `\u25B2 yr ${beIdx + 1}`,
      Math.max(padL + 16, X(beIdx)),
      zeroY - 8,
    );
  }

  // x labels: years 1..20 (every 2nd to avoid clutter), shared bottom axis
  ctx.fillStyle = "#6b7280";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (let y = 0; y < nY; y += 2) {
    ctx.fillText(String(y + 1), X(y), H - 4);
  }

  // caption
  const cap = $("cumCostCaption");
  if (cap)
    cap.textContent = cumCostCaptionText({
      seriesEntry,
      isBest:
        !!p.best &&
        seriesEntry.chemistry === p.best.chemistry &&
        seriesEntry.pvKw === p.best.pvKw &&
        seriesEntry.battKwh === p.best.battKwh,
      bd,
      beIdx,
      nY,
      grid: series.grid,
      solar: series.solar,
      residShown,
      residEnd,
      residAnnual,
    });
}

export function drawSocChartForEntry(p, entry) {
  const wrap = $("socChartWrap");
  if (!wrap) return;
  const b = entry && entry.socNameplatePct;
  if (!b || !b.min || !b.min.length) {
    wrap.style.display = "none";
    return;
  }
  const days = b.min.length;
  let emptyDays = 0,
    fullDays = 0,
    minPct = 100;
  for (let i = 0; i < days; i++) {
    if (b.min[i] < 5) emptyDays++;
    if (b.max[i] >= 99.5) fullDays++;
    if (b.min[i] < minPct) minPct = b.min[i];
  }
  const tier = {
    id: entry.chemistry + ":selected",
    chemLabel: entry.chemLabel || entry.chemistry,
    color: TIER_COLORS["auto-" + entry.chemistry] || "#00e699",
    dailyMin: b.min,
    dailyMax: b.max,
    minPct: Math.round(minPct),
    emptyDays,
    fullDays,
    totalDays: days,
  };
  const hist = {
    kind: "gridtie",
    startYear: p.history && p.history.startYear,
    endYear: p.history && p.history.endYear,
    days,
    pvDaily: p.history && p.history.pvDaily,
    tiers: [tier],
  };
  drawSocChart(hist, tier.chemLabel);
}

export function drawAutoChart(p) {
  const wrap = $("socChartWrap");

  const canvas = $("socCanvas");

  const legend = $("socLegend");

  if (!wrap || !canvas) return;

  const raw = p.auto || [];

  if (!raw.length) {
    wrap.style.display = "none";
    return;
  }

  const entries = raw.filter(
    (a) =>
      a.solvable &&
      a.socNameplatePct &&
      a.socNameplatePct.min &&
      a.socNameplatePct.min.length,
  );

  if (!entries.length) {
    wrap.style.display = "none";
    return;
  }

  cachedChartState = { type: "auto", p };

  wrap.style.display = "block";

  const dpr = window.devicePixelRatio || 1;

  const W = Math.max(
    200,
    Math.min(
      wrap.clientWidth || 320,
      typeof window !== "undefined" && window.innerWidth
        ? window.innerWidth - 48
        : 640,
    ),
  );

  const n = entries[0].socNameplatePct.min.length;

  const zStart =
    socZoomRange && Number.isFinite(socZoomRange.start)
      ? Math.max(0, Math.min(n - 2, socZoomRange.start))
      : 0;

  const zEnd =
    socZoomRange && Number.isFinite(socZoomRange.end)
      ? Math.max(zStart + 1, Math.min(n - 1, socZoomRange.end))
      : n - 1;

  const visibleDays = Math.max(1, zEnd - zStart);

  const pv =
    p.hardwareConfig !== "battery" &&
    p.history &&
    Array.isArray(p.history.pvDaily) &&
    p.history.pvDaily.length === n
      ? p.history.pvDaily
      : null;

  const stripH = pv ? 64 : 0,
    stripGap = pv ? 8 : 0;

  const H = 300 + stripH + stripGap;

  canvas.width = Math.round(W * dpr);

  canvas.height = Math.round(H * dpr);

  canvas.style.width = "100%";

  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 46,
    padR = 12,
    padT = 16,
    padB = 22;

  const plotW = W - padL - padR,
    plotH = H - stripH - stripGap - padT - padB;

  const yMax = 100;

  const panelTop = stripH + stripGap;

  const X = (i) => padL + ((i - zStart) / visibleDays) * plotW;

  const Y = (pct) => panelTop + padT + (1 - pct / yMax) * plotH;

  // frame + gridlines

  ctx.font = "10px ui-monospace, monospace";

  for (const v of [0, 20, 50, 75, 100]) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";

    ctx.beginPath();
    ctx.moveTo(padL, Y(v));
    ctx.lineTo(W - padR, Y(v));
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";

    ctx.fillText(v + "%", padL - 6, Y(v) + 3);
  }

  // Reserve shading to make LFP/Na advantage obvious
  ctx.fillStyle = "rgba(100,100,100,0.08)";
  ctx.fillRect(padL, Y(20), plotW, Y(0) - Y(20));
  ctx.fillStyle = "rgba(239,68,68,0.06)";
  ctx.fillRect(padL, Y(50), plotW, Y(20) - Y(50));
  ctx.save();

  ctx.translate(11, panelTop + padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);

  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";

  ctx.fillText("charge as % of that bank's nameplate", 0, 0);

  ctx.restore();

  if (pv) drawSunStrip(ctx, pv, X, W, padL, padR, stripH);

  for (const a of entries) {
    const color = TIER_COLORS[`auto-${a.chemistry}`] || "#888";

    const { min, max } = a.socNameplatePct;

    ctx.save();

    ctx.beginPath();

    ctx.rect(padL, panelTop + padT, plotW, plotH);

    ctx.clip();

    // Envelope fill: the full daily range, deepest discharge to fullest.

    ctx.beginPath();

    ctx.moveTo(X(zStart), Y(max[zStart]));

    for (let i = zStart + 1; i <= zEnd; i++) ctx.lineTo(X(i), Y(max[i]));

    for (let i = zEnd; i >= zStart; i--) ctx.lineTo(X(i), Y(min[i]));

    ctx.closePath();

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Dashed FULL mark: this bank's own ceiling as % of its nameplate.

    const fullPct = Math.max(...max);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([2, 4]);

    ctx.beginPath();
    ctx.moveTo(padL, Y(fullPct));
    ctx.lineTo(W - padR, Y(fullPct));
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Top edge bold: "does it reach its full mark?" must be unmistakable.

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.95;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) {
      const y = Y(max[i]);
      if (i === zStart) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }

    ctx.stroke();

    // Floor edge thin: how deep the nights and bad stretches dig.

    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) {
      const y = Y(min[i]);
      if (i === zStart) ctx.moveTo(X(i), y);
      else ctx.lineTo(X(i), y);
    }

    ctx.stroke();

    ctx.restore();

    ctx.globalAlpha = 1;
  }

  // x labels: years or day indices

  ctx.fillStyle = "#6b7280";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";

  if (socZoomRange && visibleDays < 365) {
    const step = Math.max(1, Math.floor(visibleDays / 6));

    for (let d = zStart; d <= zEnd; d += step) {
      const x = X(d);

      ctx.fillText(
        `Day ${d + 1}`,
        Math.min(W - padR - 16, Math.max(padL + 16, x)),
        H - 4,
      );
    }
  } else {
    const span = p.history.endYear - p.history.startYear + 1;

    for (let yy = 0; yy <= span; yy++) {
      const dayIdx = Math.round(yy * 365.25);

      if (dayIdx >= zStart && dayIdx <= zEnd) {
        const x = X(dayIdx);

        ctx.fillText(
          String(p.history.startYear + yy),
          Math.min(W - padR, Math.max(padL, x)),
          H - 4,
        );
      }
    }
  }

  // legend chips

  if (legend) {
    legend.style.display = "flex";

    legend.style.flexWrap = "wrap";

    legend.style.gap = "0.75rem";

    legend.innerHTML = "";

    for (const a of entries) {
      const chip = el("span", {
        style:
          "display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-main);",
      });

      chip.appendChild(
        el("span", {
          style: `width:10px;height:10px;border-radius:50%;background:${TIER_COLORS[`auto-${a.chemistry}`]};display:inline-block;`,
        }),
      );

      chip.appendChild(
        el(
          "span",
          {},

          `${a.chemLabel.replace(/ \(.*\)/, "")} - ${fmt(a.battNameplateKwh)} kWh nameplate` +
            (a.replacementsHorizon > 0
              ? ` - ~${a.replacementsHorizon} swaps/20yr`
              : " - no swaps"),
        ),
      );

      legend.appendChild(chip);
    }
  }

  const ceilings = entries

    .map(
      (a) =>
        `${a.chemLabel.replace(/ \(.*\)/, "")} ${Math.round(Math.max(...a.socNameplatePct.max))}%`,
    )

    .join(" - ");

  $("socCaption").textContent =
    `How to read it: the shaded area is each bank's daily range - the bold top edge is the fullest it got, the thin lower edge the deepest it sank, and the dashed line is that bank's FULL mark (${ceilings} of nameplate). ` +
    `Every chemistry carries similar nameplate for the same job; the real difference is usable energy - LFP and Sodium give you 80% usable (20-100%), Lead-Acid only 50% (50-100%), so LFP/Sodium deliver far more kWh per kWh of nameplate and need fewer swaps - lithium and sodium may use ~90% of theirs, lead-acid only its bottom half (the 50% rule, times its discharge-rate derate). ` +
    `Sodium rides standard LFP voltage settings: slightly less capacity, gentler discharge, longer life. ` +
    `Dips to the floor during ${p.history.startYear}-${p.history.endYear}'s worst weather are the moments a generator or the grid would cover you.`;

  if (pv)
    $("socCaption").textContent +=
      " The amber strip on top is the daily solar harvest (kWh per kW of panel) - its dips line up with every bank's recharge rhythm.";
}

function getActiveChartLength() {
  if (!cachedChartState) return 0;

  if (
    cachedChartState.type === "soc" &&
    cachedChartState.history &&
    cachedChartState.history.tiers &&
    cachedChartState.history.tiers[0] &&
    cachedChartState.history.tiers[0].dailyMin
  ) {
    return cachedChartState.history.tiers[0].dailyMin.length;
  }

  if (
    cachedChartState.type === "auto" &&
    cachedChartState.p &&
    cachedChartState.p.auto &&
    cachedChartState.p.auto[0] &&
    cachedChartState.p.auto[0].socNameplatePct &&
    cachedChartState.p.auto[0].socNameplatePct.min
  ) {
    return cachedChartState.p.auto[0].socNameplatePct.min.length;
  }

  return 0;
}

function redrawSocChart() {
  if (!cachedChartState) return;

  if (cachedChartState.type === "soc") {
    drawSocChart(cachedChartState.history, cachedChartState.chemLabel);
  } else if (cachedChartState.type === "auto") {
    drawAutoChart(cachedChartState.p);
  }
}

/**
 * Exact pure core of zoomChart: given the current span boundaries, the
 * axis length, a multiplicative factor, and a fractional center, return the
 * next span — or null when the visitor zoomed back out to full view.
 */
export function computeZoomSpan(prev, n, factor, centerRatio = 0.5) {
  const currStart = prev && Number.isFinite(prev.start) ? prev.start : 0;

  const currEnd = prev && Number.isFinite(prev.end) ? prev.end : n - 1;

  const span = currEnd - currStart;

  const newSpan = Math.max(14, Math.min(n - 1, Math.round(span * factor)));

  const center = currStart + span * centerRatio;

  let newStart = Math.round(center - newSpan * centerRatio);

  let newEnd = newStart + newSpan;

  if (newStart < 0) {
    newStart = 0;
    newEnd = newSpan;
  }

  if (newEnd > n - 1) {
    newEnd = n - 1;
    newStart = Math.max(0, newEnd - newSpan);
  }

  return newSpan >= n - 2 ? null : { start: newStart, end: newEnd };
}

function zoomChart(factor, centerRatio = 0.5) {
  const n = getActiveChartLength();

  if (!n) return;

  socZoomRange = computeZoomSpan(socZoomRange, n, factor, centerRatio);

  redrawSocChart();
}

export function findWorstStreak(dailyMins, windowSize = 30) {
  if (!dailyMins || dailyMins.length <= windowSize) return 0;

  let worstIdx = 0,
    lowestMin = Infinity,
    lowestSum = Infinity;

  for (let i = 0; i <= dailyMins.length - windowSize; i++) {
    let sum = 0,
      localMin = Infinity;
    for (let j = 0; j < windowSize; j++) {
      const v = dailyMins[i + j];
      sum += v;
      if (v < localMin) localMin = v;
    }
    if (localMin < lowestMin || (localMin === lowestMin && sum < lowestSum)) {
      lowestMin = localMin;
      lowestSum = sum;
      worstIdx = i;
    }
  }

  return worstIdx;
}

export function setupChartInteractions() {
  const canvas = $("socCanvas");

  if (!canvas) return;

  let isDragging = false;

  let dragStartX = 0;

  let startRange = null;

  let touchDistStart = 0;

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    const n = getActiveChartLength();
    startRange = socZoomRange ? { ...socZoomRange } : { start: 0, end: n - 1 };
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging || !startRange) return;
    const dx = e.clientX - dragStartX;
    const rect = canvas.getBoundingClientRect();
    const plotW = rect.width - 44;
    if (plotW <= 0) return;
    const span = startRange.end - startRange.start;
    const dayShift = Math.round((-dx / plotW) * span);
    const n = getActiveChartLength();
    let newStart = Math.max(
      0,
      Math.min(n - 1 - span, startRange.start + dayShift),
    );
    let newEnd = newStart + span;
    socZoomRange = { start: newStart, end: newEnd };
    redrawSocChart();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  // NOTE: Wheel event listener intentionally omitted. Intercepting wheel events
  // with e.preventDefault() trapped users trying to scroll down the page on desktop.
  // Zooming is handled via the dedicated +, −, Worst Month, and Full 5-Yr buttons,
  // with click-drag panning when zoomed in.

  let dragStartY = 0;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        if (!socZoomRange) return;
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        startRange = { ...socZoomRange };
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchDistStart = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        const n = getActiveChartLength();
        startRange = socZoomRange
          ? { ...socZoomRange }
          : { start: 0, end: n - 1 };
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 1 && isDragging && startRange) {
        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;
        if (Math.abs(dy) > Math.abs(dx)) return;
        const rect = canvas.getBoundingClientRect();
        const plotW = rect.width - 44;
        if (plotW <= 0) return;
        const span = startRange.end - startRange.start;
        const dayShift = Math.round((-dx / plotW) * span);
        const n = getActiveChartLength();
        let newStart = Math.max(
          0,
          Math.min(n - 1 - span, startRange.start + dayShift),
        );
        let newEnd = newStart + span;
        socZoomRange = { start: newStart, end: newEnd };
        redrawSocChart();
      } else if (e.touches.length === 2 && touchDistStart > 0 && startRange) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (currentDist > 5) {
          const factor = touchDistStart / currentDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const rect = canvas.getBoundingClientRect();
          const ratio = Math.max(
            0,
            Math.min(1, (midX - rect.left) / rect.width),
          );
          zoomChart(factor, ratio);
        }
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    "touchend",
    () => {
      isDragging = false;
      touchDistStart = 0;
    },
    { passive: true },
  );
}

// ── zoom-button wiring (moved verbatim from ui.js setupPwaControls) ────────

export function setupZoomButtons() {
  // Wire up chart zoom buttons
  const btnZoomReset = $("btnSocZoomReset");
  if (btnZoomReset)
    btnZoomReset.addEventListener("click", () => {
      socZoomRange = null;
      redrawSocChart();
    });
  const btnZoomWorst = $("btnSocZoomWorst");
  if (btnZoomWorst)
    btnZoomWorst.addEventListener("click", () => {
      const n = getActiveChartLength();
      if (!n) return;
      let worstIdx = 0;
      if (
        cachedChartState?.type === "soc" &&
        cachedChartState.history?.tiers?.[0]?.dailyMin
      ) {
        worstIdx = findWorstStreak(
          cachedChartState.history.tiers[0].dailyMin,
          30,
        );
      } else if (
        cachedChartState?.type === "auto" &&
        cachedChartState.p?.auto?.[0]?.socNameplatePct?.min
      ) {
        worstIdx = findWorstStreak(
          cachedChartState.p.auto[0].socNameplatePct.min,
          30,
        );
      }
      socZoomRange = { start: worstIdx, end: Math.min(n - 1, worstIdx + 30) };
      redrawSocChart();
    });
  const btnZoomIn = $("btnSocZoomIn");
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => zoomChart(0.5));
  const btnZoomOut = $("btnSocZoomOut");
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => zoomChart(2.0));
}
