// The heatmap: one canvas, 39,707 dots, and no per-point DOM node or Leaflet
// layer. See assets/js/sizing/heatmap-dots.js for why the dots are drawn here
// rather than as `L.circleMarker`s, and assets/js/sizing/heatmap-grid.js for
// the columnar payload both this page and the generator read.
import {
  dequantizeDeg,
  dequantizeTariff,
  dequantizeYear,
  dequantizeLcoe,
  YEAR_VALUES_PER_POINT,
  NO_YEAR,
} from "./sizing/heatmap-grid.js?v=20261001b";
import {
  dotTransform,
  projectDots,
  buildHitIndex,
  hitTest,
  HIT_CELL_PX,
} from "./sizing/heatmap-dots.js?v=20261001b";

const DOT_RADIUS = 3.5;

// ── State ──────────────────────────────────────────────────────────────
let header = null; // { count, countries, usageTiersKwhDay, ...columns }
let years = null; // the year matrix, fetched on demand
let yearsPending = null;
let map = null;
let dotLayer = null;
let usageIdx = 1; // 0=5kWh, 1=10kWh, 2=20kWh, 3=30kWh
let metric = "cost"; // "cost" = True Grid Cost, "p" = payback, "b" = break-even
let basis = "real"; // "real" = generator/unserved-aware, "grid" = nominal grid tariff only

// Scratch buffers, allocated once and refilled per redraw.
let xs = null;
let ys = null;
// Seven buckets, one per colour. `bucketXY` holds drawn positions and
// `bucketId` the point each position came from, because the hit test resolves
// a click to a POSITION and the caller needs the POINT behind it.
const bucketXY = [];
const bucketId = [];
let bucketLen = new Int32Array(7);
// The compacted, drawn-only view the hit index is built over.
let hitXs = null;
let hitYs = null;
let hitIds = null;
let hitIndex = null;

// ── Colour scales ──────────────────────────────────────────────────────
//
// The map's scale, read against Carto's dark basemap. `costTextColor` is a
// DIFFERENT palette for text on this page's own card; keeping them apart is
// what makes the ranking numbers legible (tests/a11y-markup.test.mjs).
const COST_PALETTE = [
  "#555",
  "#00e699",
  "#7ec850",
  "#c8b400",
  "#e68a00",
  "#e64545",
  "#991b1b",
];
const YEAR_PALETTE = [
  "#555",
  "#00e699",
  "#7ec850",
  "#c8b400",
  "#e68a00",
  "#e64545",
  "#888",
];
const BUCKETS = COST_PALETTE.length;

// The colour a point gets depends only on (metric, basis, usageIdx) — never on
// the view. Bucketing 39,707 points on every pan frame was 18ms of the load
// task for a value that cannot change between frames, so it is computed once
// per selection and the redraw reads the column.
let colorCol = null;
let colorColKey = "";

function colorColumn() {
  const key = `${metric}|${basis}|${usageIdx}`;
  if (colorCol && colorColKey === key) return colorCol;
  const n = header.count;
  const col = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    col[i] =
      metric === "cost"
        ? costBucket(costOfColumn(i))
        : yearBucket(columnYearAt(i));
  }
  colorCol = col;
  colorColKey = key;
  return col;
}

/** Drop the cached colours — the year matrix arriving changes what they mean. */
function invalidateColorColumn() {
  colorCol = null;
  colorColKey = "";
}

function costBucket(cost) {
  if (cost === null || cost === undefined || cost <= 0) return 0;
  if (cost <= 0.1) return 1;
  if (cost <= 0.18) return 2;
  if (cost <= 0.28) return 3;
  if (cost <= 0.4) return 4;
  if (cost <= 0.55) return 5;
  return 6;
}

function yearBucket(years_) {
  if (years_ === null || years_ === undefined || years_ <= 0) return 0;
  if (years_ <= 2) return 1;
  if (years_ <= 3) return 2;
  if (years_ <= 5) return 3;
  if (years_ <= 7) return 4;
  if (years_ <= 12) return 5;
  return 6;
}

function costLabel(cost) {
  if (cost === null || cost === undefined) return "N/A";
  return "$" + Number(cost).toFixed(2) + "/kWh";
}

// The tile scale read as TEXT: same buckets, colours that clear 4.5:1 on
// this page's card, where the tile palette's dark end measures 2.12:1.
function costTextColor(cost) {
  if (cost === null || cost === undefined || cost <= 0) return "#9aa4b2";
  if (cost <= 0.1) return "#4ade9b";
  if (cost <= 0.18) return "#a8e05f";
  if (cost <= 0.28) return "#f2d024";
  if (cost <= 0.4) return "#ffb14d";
  if (cost <= 0.55) return "#ff8f8f";
  return "#ff6b6b";
}

function yearLabel(years_) {
  if (years_ === null || years_ === undefined) return "N/A";
  if (years_ > 50) return ">50 yr";
  return Number(years_).toFixed(1) + " yr";
}

// ── Column access ──────────────────────────────────────────────────────
//
// One accessor, so the ranking and popup code below reads the field names it
// always did. The draw loop does NOT use it — 39,707 of these objects per
// redraw is exactly the object churn this page no longer has a budget for.
function yearSeries(i, s) {
  if (!years) return null;
  const out = [null, null, null, null];
  const base = i * YEAR_VALUES_PER_POINT + s * 4;
  for (let k = 0; k < 4; k++) {
    const q = years.yrs[base + k];
    out[k] = q === NO_YEAR ? null : dequantizeYear(q);
  }
  return out;
}

function pt(i) {
  return {
    lat: dequantizeDeg(header.lat[i]),
    lon: dequantizeDeg(header.lon[i]),
    n: header.names[i],
    c: header.countries[header.cc[i]],
    t: dequantizeTariff(header.tq[i]),
    tr: dequantizeTariff(header.trq[i]),
    y: header.yq[i],
    l: dequantizeLcoe(header.lq[i]),
    unserved: header.uns[i] < 0 ? undefined : header.uns[i],
    p: yearSeries(i, 0),
    pr: yearSeries(i, 1),
    b: yearSeries(i, 2),
    br: yearSeries(i, 3),
  };
}

// The year column index for the current metric and basis: p=0, b=2, and the
// real-basis variants sit one slot higher (pr=1, br=3).
function yearSlot() {
  const s = metric === "p" ? 0 : 2;
  return basis === "real" ? s + 1 : s;
}

function columnYearAt(i) {
  if (!years) return null;
  const q = years.yrs[i * YEAR_VALUES_PER_POINT + yearSlot() * 4 + usageIdx];
  return q === NO_YEAR ? null : dequantizeYear(q);
}

function costOfColumn(i) {
  if (basis === "real") {
    const tr = dequantizeTariff(header.trq[i]);
    if (tr !== null) return tr;
  }
  return dequantizeTariff(header.tq[i]);
}

function getPointCost(p) {
  if (basis === "real") {
    return p.tr !== null && p.tr !== undefined ? p.tr : p.t;
  }
  return p.t;
}

// ── Country code → name (compact) ──────────────────────────────────────
const CC = {
  IT: "Italy",
  AT: "Austria",
  DE: "Germany",
  AU: "Australia",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  ES: "Spain",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  PL: "Poland",
  CZ: "Czechia",
  GR: "Greece",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  CH: "Switzerland",
  IL: "Israel",
  TR: "Türkiye",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  ID: "Indonesia",
  PH: "Philippines",
  TH: "Thailand",
  VN: "Vietnam",
  MY: "Malaysia",
  SG: "Singapore",
  TW: "Taiwan",
  HK: "Hong Kong",
  BR: "Brazil",
  MX: "Mexico",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  EC: "Ecuador",
  BO: "Bolivia",
  VE: "Venezuela",
  CA: "Canada",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  EG: "Egypt",
  MA: "Morocco",
  GH: "Ghana",
  ET: "Ethiopia",
  TZ: "Tanzania",
  UG: "Uganda",
  SA: "Saudi Arabia",
  AE: "UAE",
  QA: "Qatar",
  RU: "Russia",
  UA: "Ukraine",
  NZ: "New Zealand",
  FJ: "Fiji",
  CU: "Cuba",
  DO: "Dominican Republic",
  PR: "Puerto Rico",
  HT: "Haiti",
  JM: "Jamaica",
  GT: "Guatemala",
  PA: "Panama",
  CR: "Costa Rica",
  SV: "El Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
  LB: "Lebanon",
  YE: "Yemen",
  CD: "DR Congo",
  SS: "South Sudan",
  TD: "Chad",
  NE: "Niger",
  CF: "Central African Rep",
  MW: "Malawi",
  BF: "Burkina Faso",
  SL: "Sierra Leone",
  LR: "Liberia",
  MG: "Madagascar",
};

function countryName(code) {
  return CC[code] || code;
}

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ── Legend ──────────────────────────────────────────────────────────────
function updateLegend() {
  const titleEl = document.getElementById("legend-title");
  const labelsEl = document.getElementById("legend-labels");
  const lastBarEl = document.getElementById("legend-bar-last");
  const usageWrap = document.getElementById("usage-control-wrap");

  if (metric === "cost") {
    if (usageWrap) usageWrap.style.display = "none";
    if (titleEl) {
      titleEl.textContent =
        basis === "real"
          ? "True Grid Cost ($/kWh, weighted)"
          : "Official Grid Tariff ($/kWh)";
    }
    if (lastBarEl) lastBarEl.style.background = "#991b1b";
    if (labelsEl) {
      labelsEl.innerHTML = `
          <span>&le;$0.10</span>
          <span>$0.18</span>
          <span>$0.28</span>
          <span>$0.40</span>
          <span>$0.55</span>
          <span>&gt;$0.55</span>
        `;
    }
  } else {
    if (usageWrap) usageWrap.style.display = "block";
    if (titleEl) {
      titleEl.textContent =
        metric === "p" ? "Years to pay for itself" : "Years to true break-even";
    }
    if (lastBarEl) lastBarEl.style.background = "#888";
    if (labelsEl) {
      labelsEl.innerHTML = `
          <span>&lt;2yr</span>
          <span>3</span>
          <span>5</span>
          <span>7</span>
          <span>12+</span>
        `;
    }
  }
}

// ── The dot layer ──────────────────────────────────────────────────────
//
// One canvas, seven paths. Every visible dot is `arc()`ed into the path for
// its colour and each bucket is filled once, so the fill cost is seven draw
// calls rather than 39,707, and there is no per-point Leaflet layer to
// project, register or redraw. It is still a Leaflet Layer, so the map owns
// its lifetime and its pane.
const DotLayer = L.Layer.extend({
  onAdd() {
    this._canvas = L.DomUtil.create(
      "canvas",
      "heat-dots",
      this._map.getPane("overlayPane"),
    );
    this._ctx = this._canvas.getContext("2d");
    this._frame = 0;
    this._map.on("move zoom resize zoomanim", this._schedule, this);
    this._redraw();
  },

  onRemove() {
    this._map.off("move zoom resize zoomanim", this._schedule, this);
    if (this._frame) cancelAnimationFrame(this._frame);
    if (this._canvas) L.DomUtil.remove(this._canvas);
  },

  // Panning repaints on the next frame rather than synchronously, so a drag
  // costs one redraw per displayed frame instead of one per pointer event.
  _schedule() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this._redraw();
    });
  },

  _redraw() {
    if (!map || !header) return;
    const size = map.getSize();
    const centre = map.getCenter();

    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const dpr = window.devicePixelRatio || 1;
    this._canvas.width = Math.round(size.x * dpr);
    this._canvas.height = Math.round(size.y * dpr);
    this._canvas.style.width = size.x + "px";
    this._canvas.style.height = size.y + "px";
    const ctx = this._ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    const count = header.count;
    const t = dotTransform({
      centerLat: centre.lat,
      centerLng: centre.lng,
      zoom: map.getZoom(),
      width: size.x,
      height: size.y,
    });
    projectDots(header.lat, header.lon, count, t, xs, ys);

    // Bucket into colours, culling what the viewport cannot show. At world zoom
    // that is most of the grid, and this runs on the pan path.
    bucketLen.fill(0);
    const r = DOT_RADIUS;
    const useCost = metric === "cost";
    const col = colorColumn();
    for (let i = 0; i < count; i++) {
      const x = xs[i];
      const y = ys[i];
      if (x < -r || y < -r || x > size.x + r || y > size.y + r) continue;
      const b = col[i];
      const k = bucketLen[b];
      bucketXY[b][k * 2] = x;
      bucketXY[b][k * 2 + 1] = y;
      bucketId[b][k] = i;
      bucketLen[b] = k + 1;
    }

    const palette = useCost ? COST_PALETTE : YEAR_PALETTE;
    for (let b = 0; b < BUCKETS; b++) {
      const len = bucketLen[b];
      if (!len) continue;
      const arr = bucketXY[b];
      ctx.beginPath();
      for (let k = 0; k < len; k++) {
        const x = arr[k * 2];
        const y = arr[k * 2 + 1];
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = palette[b];
      ctx.fill();
    }

    // The index is over the DRAWN points only — a dot scrolled off screen is
    // not clickable, so indexing it would only cost time.
    let total = 0;
    for (let b = 0; b < BUCKETS; b++) total += bucketLen[b];
    if (hitXs === null || hitXs.length < total) {
      hitXs = new Float32Array(Math.max(total, 1024));
      hitYs = new Float32Array(Math.max(total, 1024));
      hitIds = new Int32Array(Math.max(total, 1024));
    }
    let m = 0;
    for (let b = 0; b < BUCKETS; b++) {
      const len = bucketLen[b];
      const xy = bucketXY[b];
      const ids = bucketId[b];
      for (let k = 0; k < len; k++) {
        hitXs[m] = xy[k * 2];
        hitYs[m] = xy[k * 2 + 1];
        hitIds[m] = ids[k];
        m++;
      }
    }
    hitIndex = buildHitIndex(
      hitXs.subarray(0, m),
      hitYs.subarray(0, m),
      m,
      HIT_CELL_PX,
    );
  },
});

function ensureScratch(count) {
  xs = new Float32Array(count);
  ys = new Float32Array(count);
  bucketXY.length = 0;
  bucketId.length = 0;
  for (let b = 0; b < BUCKETS; b++) {
    bucketXY.push(new Float32Array(count * 2));
    bucketId.push(new Int32Array(count));
  }
  bucketLen = new Int32Array(BUCKETS);
}

// ── Popups ─────────────────────────────────────────────────────────────
function popupHtml(p) {
  const isReal = basis === "real";
  const pSeries = isReal && p.pr ? p.pr : p.p;
  const bSeries = isReal && p.br ? p.br : p.b;
  const paybackYrs = pSeries ? pSeries[usageIdx] : null;
  const breakevenYrs = bSeries ? bSeries[usageIdx] : null;
  const usage = header.usageTiersKwhDay[usageIdx];
  const hasDeficit = p.tr && p.tr !== p.t;

  const unservedPct = p.unserved || 0;
  const coverageBadge = p.unserved
    ? `<div style="background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);border-radius:4px;padding:4px 7px;font-size:.75rem;color:#ffaa00;margin-bottom:.5rem;line-height:1.4;">
              ⚠️ <strong>Area Grid Split:</strong> ~${100 - unservedPct}% grid / ~${unservedPct}% unserved (generators)
            </div>`
    : `<div style="background:rgba(0,230,153,0.08);border:1px solid rgba(0,230,153,0.2);border-radius:4px;padding:3px 6px;font-size:.75rem;color:var(--accent);margin-bottom:.5rem;">
              ✓ ~100% grid-connected population
            </div>`;

  let tariffRows = "";
  if (hasDeficit) {
    tariffRows = isReal
      ? `<tr style="${metric === "cost" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">True Grid Cost</td>
                <td style="text-align:right;color:#00e699;font-weight:700;">$${p.tr}/kWh <span style="font-size:.7rem;color:var(--muted);font-weight:normal;">(weighted)</span></td>
               </tr>
               <tr>
                <td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>
                <td style="text-align:right;color:var(--muted);font-size:.8rem;">$${p.t}/kWh (when on)</td>
               </tr>`
      : `<tr style="${metric === "cost" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>
                <td style="text-align:right;color:#fff;font-weight:600;">$${p.t}/kWh</td>
               </tr>
               <tr>
                <td style="color:var(--muted);padding:.15rem 0;">True Grid Cost</td>
                <td style="text-align:right;color:#00e699;font-size:.8rem;">$${p.tr}/kWh (weighted)</td>
               </tr>`;
  } else {
    tariffRows = `
            <tr style="${metric === "cost" ? "background:rgba(0,230,153,0.12);" : ""}">
              <td style="color:var(--muted);padding:.15rem 0;">Grid tariff</td>
              <td style="text-align:right;color:#fff;font-weight:600;">$${p.t}/kWh</td>
            </tr>
          `;
  }

  return `
          <div style="min-width:220px;">
            <div style="font-weight:700;font-size:1rem;color:#fff;margin-bottom:.2rem;">${esc(p.n)}</div>
            <div style="color:var(--muted);font-size:.8rem;margin-bottom:.5rem;">${esc(countryName(p.c))} · ${p.lat}°, ${p.lon}°</div>
            ${coverageBadge}
            <table style="width:100%;font-size:.85rem;border-collapse:collapse;">
              ${tariffRows}
              <tr><td style="color:var(--muted);padding:.15rem 0;">Solar yield</td><td style="text-align:right;color:#fff;font-weight:600;">${p.y} kWh/kWp/yr</td></tr>
              <tr style="${metric === "p" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">Payback (${basis === "real" ? "weighted" : "grid"})</td>
                <td style="text-align:right;color:${YEAR_PALETTE[yearBucket(paybackYrs)]};font-weight:700;">${yearLabel(paybackYrs)}</td>
              </tr>
              <tr style="${metric === "b" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">True break-even</td>
                <td style="text-align:right;color:${YEAR_PALETTE[yearBucket(breakevenYrs)]};font-weight:700;">${yearLabel(breakevenYrs)}</td>
              </tr>
              <tr><td style="color:var(--muted);padding:.15rem 0;">Usage assumed</td><td style="text-align:right;color:#fff;">${usage} kWh/day</td></tr>
            </table>
            <div style="margin-top:.6rem;text-align:center;">
              <a href="../#sizing" style="display:inline-block;background:linear-gradient(135deg,#00e699,#00b377);color:#04120c;font-weight:700;padding:.4rem .9rem;border-radius:6px;font-size:.85rem;">⚡ Run full simulation</a>
            </div>
          </div>
        `;
}

// One handler for 39,707 dots: resolve the click to the nearest drawn point
// and open its popup there. This replaces 39,707 per-layer handlers.
//
// `map.openPopup(latlng, html)` looks like the call for this and is not: its
// second argument is an OPTIONS object, so passing markup made Leaflet throw
// `appendChild: parameter 1 is not of type 'Node'` and no popup ever opened.
// The supported form is a popup instance, so there is ONE here, reused — which
// is also what the per-layer version did, 39,707 times over.
let popup = null;

function onMapClick(e) {
  if (!hitIndex) return;
  const container = map.latLngToContainerPoint(e.latlng);
  const slot = hitTest(
    hitIndex,
    hitXs,
    hitYs,
    container.x,
    container.y,
    DOT_RADIUS + 4,
  );
  if (slot < 0) return;
  if (!popup) popup = L.popup({ maxWidth: 300 });
  // `openOn` is `map.addLayer`, and `addLayer` returns early when the layer is
  // already there — so reusing one popup would leave the previous city's
  // content on screen. Close it first, then open at the new position.
  if (map.hasLayer(popup)) map.removeLayer(popup);
  popup
    .setLatLng(e.latlng)
    .setContent(popupHtml(pt(hitIds[slot])))
    .openOn(map);
}

// ── Render dots ────────────────────────────────────────────────────────
//
// The load path used to be one unbroken task: parse 1.7 MB, build the map,
// project and fill 39,707 dots, then run the ranking pass. That measured
// 53-95ms of blocked main thread on an idle machine and 141-212ms of TBT under
// the gate's CPU throttling, against a 100ms ceiling, with every one of those
// milliseconds spent before the reader could see or touch anything.
//
// So the phases are separated by a real yield. Each phase still runs exactly
// once — nothing is re-run, nothing is dropped, and the ranking pass is not
// deferred out of the session, it simply happens after the map is on screen.
// A rAF is a task boundary, so the browser paints and can respond between
// them.
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

function renderDots() {
  if (!map || !header) return;
  updateLegend();
  if (dotLayer) dotLayer._redraw();
  // The map is drawn by the time this resolves; the lists are built after.
  nextFrame().then(updateRankings);
}

// ── Rankings ────────────────────────────────────────────────────────────
function updateRankings() {
  if (!header) return;
  const count = header.count;
  const usage = header.usageTiersKwhDay[usageIdx];
  const basisLabel = basis === "real" ? "weighted" : "grid-only";

  const bestCard = document.getElementById("best-card");
  const worstCard = document.getElementById("worst-card");

  if (metric === "cost") {
    // One pass, one cost per point. The previous shape re-derived a point's
    // cost inside each of the two comparisons, so the 39,707-point loop paid
    // for up to three dequantizations per point; `costCol` is filled once and
    // read back for the comparisons.
    const countryHighest = new Map();
    const countryLowest = new Map();
    const costCol = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const cost = costOfColumn(i);
      if (cost === null || cost === undefined || cost <= 0) continue;
      costCol[i] = cost;
      const c = header.countries[header.cc[i]];

      const hi = countryHighest.get(c);
      if (hi === undefined || cost > costCol[hi]) countryHighest.set(c, i);
      const lo = countryLowest.get(c);
      if (lo === undefined || cost < costCol[lo]) countryLowest.set(c, i);
    }

    const highestByCountry = [...countryHighest.values()]
      .map((i) => ({ i, cost: costCol[i] }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    const lowestByCountry = [...countryLowest.values()]
      .map((i) => ({ i, cost: costCol[i] }))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 10);

    document.getElementById("best-list").innerHTML = highestByCountry
      .map(({ i, cost }) => {
        const p = pt(i);
        const splitText = p.unserved ? `~${p.unserved}% unserved` : "100% grid";
        return `<li><span class="years" style="color:${costTextColor(cost)}">${costLabel(cost)}</span> — ${esc(p.n)}, ${esc(countryName(p.c))} <span class="detail">(${splitText}, paper $${p.t}/kWh)</span></li>`;
      })
      .join("");

    document.getElementById("worst-list").innerHTML = lowestByCountry
      .map(({ i, cost }) => {
        const p = pt(i);
        return `<li><span class="years" style="color:${costTextColor(cost)}">${costLabel(cost)}</span> — ${esc(p.n)}, ${esc(countryName(p.c))} <span class="detail">(${p.y} kWh/kWp/yr)</span></li>`;
      })
      .join("");

    if (bestCard) bestCard.className = "rank-card worst";
    if (worstCard) worstCard.className = "rank-card";

    document.querySelector("#best-card h3").textContent =
      `🔴 Highest Electricity Cost (${basisLabel})`;
    document.querySelector("#worst-card h3").textContent =
      `⚡ Lowest Electricity Cost (${basisLabel})`;
    return;
  }

  if (bestCard) bestCard.className = "rank-card";
  if (worstCard) worstCard.className = "rank-card worst";

  const countryBest = new Map();
  const countryWorst = new Map();

  for (let i = 0; i < count; i++) {
    const yrs = columnYearAt(i);
    if (yrs === null || yrs <= 0) continue;
    const c = header.countries[header.cc[i]];

    if (!countryBest.has(c)) countryBest.set(c, i);
    else if (yrs < columnYearAt(countryBest.get(c))) countryBest.set(c, i);

    if (!countryWorst.has(c)) countryWorst.set(c, i);
    else if (yrs > columnYearAt(countryWorst.get(c))) countryWorst.set(c, i);
  }

  const bestByCountry = [...countryBest.values()]
    .map((i) => ({ i, yrs: columnYearAt(i) }))
    .filter((e) => e.yrs !== null)
    .sort((a, b) => a.yrs - b.yrs)
    .slice(0, 10);

  const worstByCountry = [...countryWorst.values()]
    .map((i) => ({ i, yrs: columnYearAt(i) }))
    .filter((e) => e.yrs !== null)
    .sort((a, b) => b.yrs - a.yrs)
    .slice(0, 10);

  const metricLabel = metric === "p" ? "payback" : "break-even";

  document.getElementById("best-list").innerHTML = bestByCountry
    .map(({ i, yrs }) => {
      const p = pt(i);
      const rateDisplay = basis === "real" && p.tr ? `$${p.tr}` : `$${p.t}`;
      return `<li><span class="years">${yearLabel(yrs)}</span> — ${esc(p.n)}, ${esc(countryName(p.c))} <span class="detail">(${rateDisplay}/kWh, ${p.y} kWh/kWp)</span></li>`;
    })
    .join("");

  document.getElementById("worst-list").innerHTML = worstByCountry
    .map(({ i, yrs }) => {
      const p = pt(i);
      const rateDisplay = basis === "real" && p.tr ? `$${p.tr}` : `$${p.t}`;
      return `<li><span class="years">${yearLabel(yrs)}</span> — ${esc(p.n)}, ${esc(countryName(p.c))} <span class="detail">(${rateDisplay}/kWh, ${p.y} kWh/kWp)</span></li>`;
    })
    .join("");

  document.querySelector("#best-card h3").textContent =
    `⚡ Fastest ${metricLabel} (${basisLabel}, ${usage} kWh/d)`;
  document.querySelector("#worst-card h3").textContent =
    `🔴 Slowest ${metricLabel} (${basisLabel}, ${usage} kWh/d)`;
}

void getPointCost;

// ── Controls ───────────────────────────────────────────────────────────
document.getElementById("basis-btns").addEventListener("click", function (e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  document
    .querySelectorAll("#basis-btns button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  basis = btn.dataset.basis;
  invalidateColorColumn();
  renderDots();
});

document.getElementById("usage-btns").addEventListener("click", function (e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  document
    .querySelectorAll("#usage-btns button")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  usageIdx = parseInt(btn.dataset.idx, 10);
  invalidateColorColumn();
  renderDots();
});

document
  .getElementById("metric-btns")
  .addEventListener("click", async function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    document
      .querySelectorAll("#metric-btns button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    metric = btn.dataset.metric;
    // The year matrix lives in its own file and is only read by the two year
    // metrics. Fetch on the switch rather than during the load window.
    if (metric !== "cost") await ensureYears();
    invalidateColorColumn();
    renderDots();
  });

// ── Init ───────────────────────────────────────────────────────────────
async function ensureYears() {
  if (years) return years;
  if (yearsPending) return yearsPending;
  yearsPending = fetch("../assets/data/heatmap-years.json?v=20261001b")
    .then((r) => {
      if (!r.ok) throw new Error("Failed to load heatmap year data");
      return r.json();
    })
    .then((d) => {
      years = d;
      yearsPending = null;
      // The colour column was built while the year matrix was still absent, so
      // every year metric would have painted bucket 0.
      invalidateColorColumn();
      return d;
    })
    .catch((err) => {
      yearsPending = null;
      console.error(err);
      return null;
    });
  return yearsPending;
}

async function init() {
  try {
    const res = await fetch("../assets/data/heatmap-grid.json?v=20261001b");
    if (!res.ok) throw new Error("Failed to load heatmap data");
    header = await res.json();
    ensureScratch(header.count);
    // Parsing 39,707 columns and drawing them are each a sizeable task; run
    // them separately so neither blocks the main thread for their sum.
    await nextFrame();
  } catch (err) {
    document.getElementById("loading").innerHTML =
      `<div style="text-align:center;color:#e64545;">Failed to load heatmap data. <a href="" style="color:var(--accent);">Reload</a></div>`;
    console.error(err);
    return;
  }

  // Show map, hide loading
  document.getElementById("loading").style.display = "none";
  document.getElementById("map").style.display = "block";
  document.getElementById("controls").style.display = "block";

  // Bucket the whole grid once, on its own task. It is 39,707 colour
  // decisions, and folding it into the first draw pushed that draw to 70ms.
  colorColumn();
  await nextFrame();

  // Init Leaflet
  map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 12,
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  dotLayer = new DotLayer();
  // `addTo` runs the layer's `onAdd`, which draws. Calling renderDots() here as
  // well drew every one of the 39,707 dots a second time for nothing.
  dotLayer.addTo(map);
  map.on("click", onMapClick);
  updateLegend();

  // The lists last, on their own task: the map is already on screen and
  // clickable by the time this runs.
  nextFrame().then(updateRankings);

  // Pull the year matrix in while the reader is still reading the map, so the
  // first switch to a year metric is instant rather than a spinner.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
  idle(() => {
    ensureYears();
  });
}

init();
