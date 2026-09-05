// Size-My-System UI controller. Loaded as an ES module from index.html.

// All computation happens in sizing-worker.js; this file is DOM glue only.

//

// Load input is end-user-first: an appliance checklist with plain-language

// quantity and usage sliders, a monthly-bill mode, and a tucked-away

// direct-kWh mode for people who already know their numbers.


import { CITY_PRESETS } from "./nasa.js?v=20260904b";
import { CITY_CATALOG, searchCities, loadCityCatalog, lookupCityOnline, formatCityLabel, nearestCity, normalizeCityQuery, shouldAutoResolve } from "./cities.js?v=20260904b";

import { estimateTariff, CURRENCIES, fxMeta, DAYS_PER_MONTH, battOnlyCost } from "./pricing.js?v=20260905a";

import { savingsPanelState, seriesBreakdown } from "./money.js?v=20260905a";

import { buildBom, panelLayout, PANEL_WATTS_DEFAULT } from "./bom.js?v=20260905a";

import { BOM_ITEMS } from "../shared/content.js?v=20260905a";

import { applyI18n, initLangPicker, resolveLang } from "../shared/i18n.js?v=20260830b";

import { LOCALES } from "../shared/locales.js?v=20260830b";

import { renderFrontier, frontierVerdict, markerOffCurveNote } from "./frontier-chart.js?v=20260905a";

import { rescalePayload, scaleRecord, sameSiteOptions } from "./rescale.js?v=20260905a";

let worker = null;

let lastPayload = null;   // kept for share links + the printable summary
let prevFxSnapshot = null; // for tariff display conversion on currency switch

// Result detail level: "best" | "compare" | "matrix" (auto-chemistry runs only).
let resultLevel = "best";

// Quick (auto-run) mode shows only the location controls and sizes with
// defaults; Manual reveals the full form. Default is quick.
let quickMode = true;
let locationResolved = false;

// The monthly-bill slider stores the user's real input as consumed ENERGY
// (kWh/day, default 20) and re-expresses that as local currency whenever the
// tariff, currency, or location changes — so switching cities never silently
// changes what the user told us they use.
let billAnchorKwh = 20;
let billTouched = false;
let billUserNominal = null;

// Bill-cut slider (1–111%): the replacement for the old 60/80/95 dropdown.
let customCutFraction = 0.8;

// Which system the whole results pipeline (charts, BOM, export, share, print)
// shows: "best" | "focus" (adopted curve point) | "matrix:chem:colId" | "custom" |
// "adopted" (a curve point adopted instantly, without a full re-run).
let selectedKey = "best";

// The exact system the visitor just clicked on the price curve. Adopting it
// is instant (its full analysis rides along in the cached frontier point);
// only the SOC capture bands arrive later from a tiny background slice.
let adoptedEntry = null;

// A non-null value means the next worker run should adopt an EXACT (PV,
// battery, chemistry) system ("Use this system" from the curve modal).
let pendingFocus = null;

// Guards stale responses when sliders queue runs faster than the worker.
let runToken = 0;
let runTimer = null;
let lastRunAdoptsFocus = false;

// The last full-run inputs, kept so a bill-only change can compute the exact
// load factor for an instant rescale against the retained payload.
let lastRunInput = null;

// A quiet run (bill-slider refine after a rescale) must not spin the button,
// flash status, or scroll — the screen already shows the rescaled numbers.
let lastRunQuiet = false;

// Serial for incremental "reSlice" patches within one payload epoch.
// Epoch links every patch to the payload it was computed against: a full run
// bumps payloadEpoch, so a slice from older inputs can never merge into a
// newer payload (independent counters alone could not prevent that).
let sliceToken = 0;
let payloadEpoch = 0;

// PWA install prompt holder
let deferredInstallPrompt = null;

// SOC chart zoom state: null = full view; { start: number, end: number } = sliced
let socZoomRange = null;
let cachedChartState = null;

// Bill slider bounds, expressed in kWh/day and converted to local currency.
const BILL_MIN_KWH = 2;
const BILL_MAX_KWH = 200;

// Loads below this stay out of the instant-rescale path: the search's
// minimum-bank and lattice constraints shift the PV/battery optimum there,
// so a cached payload is only rescaled when both loads are at/above it.
const RESCALE_MIN_KWH = 15;

// True once the user applied the generator-fuel helper to the price field.
let generatorBasis = false;

// Translation helper with interpolation support (uses shared resolveLang so
// auto-detection matches the chrome i18n — no split-brain between panel and
// t() strings).
function t(key, params = {}) {

  const lang = resolveLang();

  const dict = LOCALES[lang] || LOCALES.en;

  let str = dict[key] || key;

  for (const [k, v] of Object.entries(params)) {

    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);

  }

  return str;

}

// -- Appliance library -------------------------------------------------------

// w = watts WHILE RUNNING. duty:true items (fridges, ACs, pumps) only run a

// fraction of the day - their slider means "hours it actually runs," capped

// to realistic compressor time, and the row shows the resulting average draw.

const APPLIANCES = [

  { g: "Keep food cold", items: [

    { n: "Refrigerator (modern, mid-size)", w: 100, h: 10, maxH: 16, duty: true },

    { n: "Refrigerator (old or large)", w: 150, h: 12, maxH: 18, duty: true },

    { n: "Chest freezer", w: 100, h: 10, maxH: 16, duty: true },

  ]},

  { g: "Cooling", items: [

    { n: "Ceiling or desk fan", w: 75, h: 8 },

    { n: "Window air conditioner (one room)", w: 500, h: 6, maxH: 20, duty: true },

    { n: "Split air conditioner (whole floor)", w: 1200, h: 6, maxH: 20, duty: true },

  ]},

  { g: "Kitchen & cooking", items: [

    { n: "Microwave", w: 1200, h: 0.33 },

    { n: "Electric kettle", w: 1500, h: 0.25 },

    { n: "Coffee maker", w: 900, h: 0.25 },

    { n: "Rice cooker", w: 700, h: 0.5 },

  ]},

  { g: "Lights & electronics", items: [

    { n: "LED light bulb", w: 10, h: 5 },

    { n: "LED TV", w: 100, h: 4 },

    { n: "Laptop or desktop computer", w: 65, h: 6 },

    { n: "Phone charger", w: 15, h: 3 },

    { n: "Internet router (always on)", w: 10, h: 24 },

  ]},

  { g: "Cleaning & water", items: [

    { n: "Washing machine", w: 500, h: 0.5 },

    { n: "Water pump (well or pressure tank)", w: 750, h: 0.5, maxH: 12, duty: true },

    { n: "Vacuum cleaner", w: 800, h: 0.25 },

    { n: "Clothes iron", w: 1100, h: 0.25 },

  ]},

  { g: "Big power users", items: [

    { n: "Space heater (small)", w: 1000, h: 4, maxH: 16, duty: true },

    { n: "Electric water heater", w: 3000, h: 1, maxH: 8, duty: true },

    { n: "Pool pump", w: 1000, h: 4, maxH: 12, duty: true },

  ]},

];

const CHEM_KEYS = new Set(["auto", "naion", "lfp", "agm"]);

function $(id) { return document.getElementById(id); }

function el(tag, attrs = {}, text) {

  const e = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {

    if (k === "style") e.style.cssText = v;

    else if (k === "class") e.className = v;

    else e.setAttribute(k, v);

  }

  if (text !== undefined) e.textContent = text;

  return e;

}

function setStatus(text) {

  const s = $("sizingStatus");

  if (s) s.textContent = text;

}

function fmtH(h) {

  if (h >= 24) return "all day (24 h)";

  if (h >= 1) return (Math.round(h * 2) / 2) + " h/day";

  return Math.round(h * 60) + " min/day";

}

function fmtKwh(x) { return (Math.round(x * 100) / 100).toString(); }

// -- Load-mode plumbing ------------------------------------------------------

// Auto-mode basis submenus: which reliability tier / bill-cut target the

// three chemistry cards represent. Visible only when chemistry = Auto.

function updateAutoRows() {

  const isAuto = $("chemSelect").value === "auto";

  const gt = $("systemGoal") ? $("systemGoal").value === "gridtie" : false;

  const tierRow = $("autoTierRow"), targetRow = $("autoTargetRow");

  if (tierRow) tierRow.style.display = isAuto && !gt ? "block" : "none";

  if (targetRow) targetRow.style.display = isAuto && gt ? "block" : "none";

}

function setLoadPanel() {

  const mode = $("loadMode").value;

  $("panelAppliances").style.display = mode === "appliances" ? "block" : "none";

  $("panelBill").style.display = mode === "bill" ? "block" : "none";

  $("panelKwh").style.display = mode === "kwh" ? "block" : "none";

  updateLoadReadout();

}

function applianceState() {

  // state lives in DOM: rows carry data attrs; read them.

  const rows = $("applianceList").querySelectorAll(".ap-row.on");

  let kwh = 0, peakW = 0;

  rows.forEach((row) => {

    const w = parseFloat(row.dataset.w);

    const qty = parseInt(row.dataset.qty, 10);

    const h = parseFloat(row.dataset.h);

    kwh += (w * qty * h) / 1000;

    peakW += w * qty;

  });

  return { kwh, peakW, count: rows.length };

}

function getTariff() {

  const v = parseFloat($("customRateVal")?.value);

  return Number.isFinite(v) && v > 0 ? v : null;

}

// ── Monthly-bill slider (local currency, anchored to kWh/day) ───────────────

// The slider speaks the same language as a bill: the local-currency monthly
// amount, derived from the user's kWh/day anchor and the active tariff.
function kwhFromBill(bill, rate) { return bill / (rate * DAYS_PER_MONTH); }

function billForKwh(kwh, rate) { return kwh * DAYS_PER_MONTH * rate; }

function fmtBill(v) {
  const fx = fxActive();
  if (!fx) return "$" + Math.round(v).toLocaleString() + "/mo";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: fx.code, maximumFractionDigits: 0 }).format(v) + "/mo";
  } catch {
    return (CURRENCIES[fx.code]?.symbol || "") + Math.round(v).toLocaleString() + "/mo";
  }
}

// Re-express the slider around the current rate/currency, preserving the
// user's kWh/day anchor. Runs whenever location/tariff/currency change.
function syncBillSlider() {
  const slider = $("billSlider");
  if (!slider) return;
  const rate = displayRate();
  const minBill = Math.max(1, Math.round(billForKwh(BILL_MIN_KWH, rate)));
  const maxBill = Math.max(minBill + 2, Math.round(billForKwh(BILL_MAX_KWH, rate)));

  let value;
  if (billTouched && Number.isFinite(billUserNominal) && billUserNominal > 0) {
    value = Math.min(maxBill, Math.max(minBill, Math.round(billUserNominal)));
    billAnchorKwh = kwhFromBill(value, rate);
  } else {
    value = Math.min(maxBill, Math.max(minBill, Math.round(billForKwh(billAnchorKwh, rate))));
  }

  slider.min = String(minBill);
  slider.max = String(maxBill);
  slider.step = String(Math.max(1, Math.round((maxBill - minBill) / 300)));
  slider.value = String(value);
  const out = $("billSliderVal");
  if (out) out.textContent = "~" + fmtBill(value);
  const note = $("quickBillNote");
  if (note) {
    note.textContent = quickMode
      ? "Auto-run starts from ~" + fmtBill(value) + ` (≈${Math.round(billAnchorKwh)} kWh/day). Slide the bill above to your real monthly cost — then one click on your location sizes everything against it. The bill-cut slider appears with results.`
      : "Quick estimate: ~" + fmtBill(value) + ` (starts from ~${Math.round(billAnchorKwh)} kWh/day) — switch to Manual to change your bill, appliances, or rate.`;
  }
  updateLoadReadout();
}

function displayRate() {
  return getTariff() || 0.28;
}

function updateLoadReadout() {

  const mode = $("loadMode").value;

  const out = $(mode === "appliances" ? "readoutAppliances" : mode === "bill" ? "readoutBill" : "readoutKwh");

  if (!out) return;

  if (mode === "appliances") {

    const { kwh, peakW, count } = applianceState();

    if (!count) {

      out.textContent = t("readoutAppliancesEmpty");

    } else {

      out.innerHTML = "";

      out.appendChild(el("span", {}, t("readoutAppliancesSummary", { kwh: fmtKwh(kwh), peakW: peakW.toLocaleString() })));

    }

  } else if (mode === "bill") {

    const bill = parseFloat($("billSlider")?.value);

    const rate = getTariff();

    if (Number.isFinite(bill) && bill > 0 && Number.isFinite(rate) && rate > 0) {

      const kwhDay = kwhFromBill(bill, rate);

      out.textContent = t("readoutBill", { kwhDay: fmtKwh(kwhDay) });

    } else {

      out.textContent = t("readoutBillIncomplete");

    }

  } else {

    const kwh = parseFloat($("dailyKwhInput").value);

    out.textContent = Number.isFinite(kwh) && kwh > 0

      ? t("readoutKwhReady", { kwh: fmtKwh(kwh) })

      : t("readoutKwhEmpty");

  }

}

function renderAppliances() {

  const list = $("applianceList");

  list.innerHTML = "";

  for (const grp of APPLIANCES) {

    const gEl = el("div", { style: "font-size:0.8rem;font-weight:700;color:var(--primary-accent);letter-spacing:0.4px;margin:0.9rem 0 0.35rem;text-transform:uppercase;" }, grp.g);

    list.appendChild(gEl);

    for (const it of grp.items) {

      const maxH = it.maxH || 24;

      const row = el("div", { class: "ap-row", "data-w": it.w, "data-qty": "1", "data-h": it.h, "data-duty": it.duty ? "1" : "", "data-item-name": it.n });

      row.style.cssText = "display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.5rem;border:1px solid transparent;border-radius:8px;flex-wrap:wrap;";

      const cb = el("input", { type: "checkbox", style: "width:auto;margin:0;transform:scale(1.2);cursor:pointer;" });

      const name = el("label", { style: "flex:1 1 200px;cursor:pointer;font-size:0.92rem;font-weight:500;margin:0;" }, it.n);

      name.prepend(cb);

      const watts = el("span", { style: "font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);background:rgba(255,255,255,0.05);padding:0.1rem 0.45rem;border-radius:10px;" },

        it.duty ? `~${it.w} W while running` : `~${it.w} W`);

      // quantity stepper (hidden until checked)

      const qtyWrap = el("span", { style: "display:none;align-items:center;gap:0.35rem;" });

      const minus = el("span", { class: "btn btn-outline", style: "padding:0.25rem 0.65rem;font-size:1rem;min-width:34px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:manipulation;" }, "-");

      const qtyVal = el("span", { style: "font-family:var(--font-mono);min-width:1.4rem;text-align:center;font-weight:700;" }, "1");

      const plus = el("span", { class: "btn btn-outline", style: "padding:0.25rem 0.65rem;font-size:1rem;min-width:34px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:manipulation;" }, "+");

      qtyWrap.append(minus, qtyVal, plus);

      // hours slider (hidden until checked)

      const hrsWrap = el("span", { style: "display:none;align-items:center;gap:0.5rem;flex:1 1 170px;min-width:170px;" });

      const hrs = el("input", { type: "range", min: "0.25", max: String(maxH), step: "0.25", style: "flex:1;cursor:pointer;" });

      hrs.value = String(it.h);

      const hrsLabel = el("span", { style: "font-size:0.8rem;color:var(--text-muted);font-family:var(--font-mono);min-width:6.5rem;text-align:right;" }, (it.duty ? "runs " : "") + fmtH(it.h));

      hrsWrap.append(hrs, hrsLabel);

      const sub = el("span", { style: "font-size:0.8rem;font-family:var(--font-mono);color:var(--text-muted);min-width:7.8rem;text-align:right;" }, "");

      row.append(name, watts, qtyWrap, hrsWrap, sub);

      function refresh() {

        const on = cb.checked;

        row.classList.toggle("on", on);

        row.style.background = on ? "rgba(0,230,153,0.06)" : "transparent";

        row.style.borderColor = on ? "var(--border-glow)" : "transparent";

        qtyWrap.style.display = on ? "inline-flex" : "none";

        hrsWrap.style.display = on ? "inline-flex" : "none";

        const h = parseFloat(row.dataset.h);

        const kwh = (it.w * parseInt(row.dataset.qty, 10) * h) / 1000;

        if (on) {

          let txt = fmtKwh(kwh) + " kWh/day";

          if (it.duty) txt += ` (~${Math.round((it.w * h) / 24)} W avg)`;

          sub.textContent = txt;

          sub.style.color = "var(--primary-accent)";

        } else {

          sub.textContent = "";

          sub.style.color = "var(--text-muted)";

        }

        updateLoadReadout();

      }

      cb.addEventListener("change", refresh);

      minus.addEventListener("click", () => {

        const q = Math.max(1, parseInt(row.dataset.qty, 10) - 1);

        row.dataset.qty = String(q); qtyVal.textContent = String(q); refresh();

      });

      plus.addEventListener("click", () => {

        const q = Math.min(30, parseInt(row.dataset.qty, 10) + 1);

        row.dataset.qty = String(q); qtyVal.textContent = String(q); refresh();

      });

      hrs.addEventListener("input", () => {

        row.dataset.h = hrs.value;

        hrsLabel.textContent = (it.duty ? "runs " : "") + fmtH(parseFloat(hrs.value));

        refresh();

      });

      list.appendChild(row);

    }

  }

}

function applyAppliancePreset(presetKey) {

  const rows = document.querySelectorAll("#applianceList .ap-row");

  if (!rows || !rows.length) return;

  const PRESETS = {
    cabin: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "LED light bulb": { qty: 4, h: 5 },
      "Phone charger": { qty: 2, h: 3 },
      "Laptop or desktop computer": { qty: 1, h: 4 },
      "Internet router (always on)": { qty: 1, h: 24 }
    },
    home: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "LED light bulb": { qty: 10, h: 5 },
      "LED TV": { qty: 1, h: 4 },
      "Microwave": { qty: 1, h: 0.33 },
      "Electric kettle": { qty: 1, h: 0.25 },
      "Laptop or desktop computer": { qty: 2, h: 6 },
      "Phone charger": { qty: 4, h: 3 },
      "Internet router (always on)": { qty: 1, h: 24 },
      "Washing machine": { qty: 1, h: 0.5 }
    },
    homestead: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "Chest freezer": { qty: 1, h: 10 },
      "Water pump (well or pressure tank)": { qty: 1, h: 1 },
      "LED light bulb": { qty: 12, h: 5 },
      "LED TV": { qty: 1, h: 4 },
      "Microwave": { qty: 1, h: 0.5 },
      "Laptop or desktop computer": { qty: 2, h: 8 },
      "Phone charger": { qty: 4, h: 4 },
      "Internet router (always on)": { qty: 1, h: 24 },
      "Washing machine": { qty: 1, h: 1 },
      "Space heater (small)": { qty: 1, h: 4 }
    },
    clear: {}
  };

  const target = PRESETS[presetKey] || {};

  rows.forEach((row) => {
    const name = row.dataset.itemName;
    const cb = row.querySelector("input[type='checkbox']");
    const qtyVal = row.querySelector("span[style*='font-family']");
    const hrsInput = row.querySelector("input[type='range']");
    if (!cb) return;

    if (target[name]) {
      const cfg = target[name];
      cb.checked = true;
      row.dataset.qty = String(cfg.qty);
      row.dataset.h = String(cfg.h);
      if (qtyVal) qtyVal.textContent = String(cfg.qty);
      if (hrsInput) hrsInput.value = String(cfg.h);
    } else {
      cb.checked = false;
    }
    cb.dispatchEvent(new Event("change"));
  });

  const loadModeEl = $("loadMode");
  if (loadModeEl && loadModeEl.value !== "appliances" && presetKey !== "clear") {
    loadModeEl.value = "appliances";
    setLoadPanel();
  }

}

function renderSunPath(lat) {

  const wrap = $("sunPathWrap");

  if (!wrap) return;

  if (!locationResolved && !lastPayload) {
    wrap.style.display = "none";
    return;
  }

  const validLat = Number.isFinite(lat) ? Math.max(-90, Math.min(90, lat)) : 21.31;

  const absLat = Math.abs(validLat);

  const isNorth = validLat >= 0;

  const deltaSummer = isNorth ? 23.44 : -23.44;

  const deltaWinter = isNorth ? -23.44 : 23.44;

  const elevSummer = Math.max(0, Math.min(90, 90 - Math.abs(validLat - deltaSummer)));

  const elevEquinox = Math.max(0, Math.min(90, 90 - absLat));

  const elevWinter = Math.max(0, Math.min(90, 90 - Math.abs(validLat - deltaWinter)));

  function calcDayLength(latitude, declinationDeg) {
    const phi = latitude * (Math.PI / 180);
    const delta = declinationDeg * (Math.PI / 180);
    const cosH = -Math.tan(phi) * Math.tan(delta);
    if (cosH <= -1) return 24;
    if (cosH >= 1) return 0;
    return (2 * (Math.acos(cosH) * 180 / Math.PI)) / 15;
  }

  const hoursSummer = calcDayLength(validLat, deltaSummer);

  const hoursEquinox = calcDayLength(validLat, 0);

  const hoursWinter = calcDayLength(validLat, deltaWinter);

  const tiltText = absLat < 5
    ? "Near Equator: ~10\u00B0 self-cleaning tilt"
    : `Face ${isNorth ? "South" : "North"} at ~${Math.round(absLat)}\u00B0 tilt (year-round optimal)`;

  const svgW = 460, svgH = 150;

  const groundY = 125;

  const cx = svgW / 2;

  const peakY = (deg) => groundY - (deg / 90) * (groundY - 20);

  const ySummer = peakY(elevSummer);

  const yEquinox = peakY(elevEquinox);

  const yWinter = peakY(elevWinter);

  const spreadX = (hrs) => Math.max(25, Math.min(210, (hrs / 12) * 160));

  const sSpread = spreadX(hoursSummer);

  const eSpread = spreadX(hoursEquinox);

  const wSpread = spreadX(hoursWinter);

  const arcPath = (yPeak, spread) => {
    const xLeft = cx - spread;
    const xRight = cx + spread;
    return `M ${xLeft} ${groundY} Q ${cx} ${yPeak - (groundY - yPeak) * 0.15} ${xRight} ${groundY}`;
  };

  wrap.style.display = "block";

  wrap.innerHTML = `
    <div class="sun-path-header">
      <span>&#9728;&#65039; Solar Sun-Path &amp; Seasonal Sky Arc (${validLat >= 0 ? validLat.toFixed(1) + "\u00B0N" : Math.abs(validLat).toFixed(1) + "\u00B0S"})</span>
      <span style="font-size:0.75rem;font-weight:500;color:var(--text-muted);">${tiltText}</span>
    </div>
    <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto;display:block;overflow:visible;">
      <line x1="20" y1="${groundY}" x2="${svgW - 20}" y2="${groundY}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
      <text x="35" y="${groundY + 16}" fill="var(--text-muted)" font-size="10" font-family="sans-serif">East (Sunrise)</text>
      <text x="${cx}" y="${groundY + 16}" fill="var(--text-muted)" font-size="10" font-family="sans-serif" text-anchor="middle">Solar Noon (${isNorth ? "South" : "North"})</text>
      <text x="${svgW - 35}" y="${groundY + 16}" fill="var(--text-muted)" font-size="10" font-family="sans-serif" text-anchor="end">West (Sunset)</text>

      <path d="${arcPath(ySummer, sSpread)}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
      <circle cx="${cx}" cy="${ySummer}" r="5" fill="#f59e0b" />
      <text x="${cx + 8}" y="${ySummer + 4}" fill="#fbbf24" font-size="10" font-weight="bold" font-family="monospace">${Math.round(elevSummer)}\u00B0</text>

      <path d="${arcPath(yEquinox, eSpread)}" fill="none" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="4 2" />
      <circle cx="${cx}" cy="${yEquinox}" r="4" fill="#10b981" />
      <text x="${cx + 8}" y="${yEquinox + 4}" fill="#34d399" font-size="10" font-weight="bold" font-family="monospace">${Math.round(elevEquinox)}\u00B0</text>

      <path d="${arcPath(yWinter, wSpread)}" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="${cx}" cy="${yWinter}" r="4" fill="#38bdf8" />
      <text x="${cx + 8}" y="${yWinter + 4}" fill="#7dd3fc" font-size="10" font-weight="bold" font-family="monospace">${Math.round(elevWinter)}\u00B0</text>
    </svg>
    <div class="sun-path-grid">
      <div class="sun-path-metric">
        <div class="sun-path-metric-title"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Summer Solstice</div>
        <div class="sun-path-metric-val" style="color:#fbbf24;">${Math.round(elevSummer)}\u00B0 noon &bull; ${hoursSummer.toFixed(1)}h daylight</div>
      </div>
      <div class="sun-path-metric">
        <div class="sun-path-metric-title"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span> Equinox</div>
        <div class="sun-path-metric-val" style="color:#34d399;">${Math.round(elevEquinox)}\u00B0 noon &bull; ~12.0h daylight</div>
      </div>
      <div class="sun-path-metric">
        <div class="sun-path-metric-title"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#38bdf8;"></span> Winter Solstice</div>
        <div class="sun-path-metric-val" style="color:#7dd3fc;">${Math.round(elevWinter)}\u00B0 noon &bull; ${hoursWinter.toFixed(1)}h daylight</div>
      </div>
    </div>
  `;

}

function renderChemTempVisualizer(lat) {

  const wrap = $("chemTempVisualizer");

  if (!wrap) return;

  const chemSelect = $("chemSelect");

  const chem = chemSelect ? chemSelect.value : "auto";

  const validLat = Number.isFinite(lat) ? lat : (parseFloat($("latInput")?.value) || 21.31);

  const absLat = Math.abs(validLat);

  let estWinterLowC = 20;

  if (absLat >= 55) estWinterLowC = -22;
  else if (absLat >= 48) estWinterLowC = -15;
  else if (absLat >= 40) estWinterLowC = -8;
  else if (absLat >= 32) estWinterLowC = 1;
  else if (absLat >= 24) estWinterLowC = 10;
  else estWinterLowC = 19;

  const minT = -30, maxT = 45;

  const pinPct = Math.max(2, Math.min(98, ((estWinterLowC - minT) / (maxT - minT)) * 100));

  let statusHtml = "";

  if (chem === "lfp") {
    const isFreezingRisk = estWinterLowC <= 0;
    statusHtml = `
      <div class="chem-temp-status-box" style="background:${isFreezingRisk ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)'};border:1px solid ${isFreezingRisk ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'};">
        <strong style="color:${isFreezingRisk ? '#fca5a5' : 'var(--primary-accent)'};">${isFreezingRisk ? 'Winter Freezing Notice:' : 'Safe Operating Climate:'}</strong>
        ${isFreezingRisk
          ? `Local winter temps reach ~${estWinterLowC}\u00B0C (below 0\u00B0C / 32\u00B0F). LiFePO4 BMS cuts off charging below freezing to prevent permanent lithium plating. Install batteries indoors, in an insulated battery enclosure, or choose models with internal heating pads.`
          : `LiFePO4 charges safely above 0\u00B0C (32\u00B0F) and operates at 95%+ round-trip efficiency. Discharging is supported down to -20\u00B0C.`}
      </div>`;
  } else if (chem === "naion") {
    statusHtml = `
      <div class="chem-temp-status-box" style="background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.35);">
        <strong style="color:#7dd3fc;">Sub-Zero Resilient:</strong>
        Sodium-ion charges and discharges reliably from -20\u00B0C to +45\u00B0C without dendrite risk or thermal runaway. Retains 85%+ usable capacity in freezing weather without requiring heating pads.
      </div>`;
  } else if (chem === "agm") {
    statusHtml = `
      <div class="chem-temp-status-box" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);">
        <strong style="color:#fcd34d;">Cold Derating Warning:</strong>
        Lead-Acid (AGM) usable capacity drops severely below freezing (~50% at -10\u00B0C). Discharged electrolyte can freeze and crack the battery casing.
      </div>`;
  } else {
    const isFreezing = estWinterLowC <= 0;
    statusHtml = `
      <div class="chem-temp-status-box" style="background:rgba(255,255,255,0.04);border:1px solid var(--border-card);">
        <strong style="color:var(--text-main);">Climate Comparison at ~${estWinterLowC}\u00B0C Winter Low:</strong>
        ${isFreezing
          ? `<br>&bull; <span style="color:#7dd3fc;font-weight:700;">Sodium-Ion</span> charges directly in freezing weather down to -20\u00B0C.<br>&bull; <span style="color:#fbbf24;font-weight:700;">LiFePO4</span> needs indoor placement or heating pads below 0\u00B0C.<br>&bull; <span style="color:#f87171;font-weight:700;">Lead-Acid</span> suffers ~50% capacity loss in winter.`
          : `<br>&bull; <span style="color:var(--primary-accent);font-weight:700;">LiFePO4</span> provides the lowest 20-year lifetime cost in mild/warm climates.<br>&bull; <span style="color:#7dd3fc;font-weight:700;">Sodium-Ion</span> offers non-flammable chemistry and thermal headroom.<br>&bull; <span style="color:#f87171;font-weight:700;">Lead-Acid</span> has low upfront cost but shortest cycle life.`}
      </div>`;
  }

  wrap.innerHTML = `
    <div class="chem-temp-title">
      <span>Ambient Temperature &amp; Battery Chemistry Limits</span>
      <span style="font-size:0.75rem;font-weight:500;color:var(--text-muted);font-family:var(--font-mono);">-30\u00B0C to +45\u00B0C</span>
    </div>
    <div class="chem-temp-bar-wrap">
      <div class="chem-temp-pin" style="left:${pinPct}%;">
        <div class="chem-temp-pin-label">Site Low ~${estWinterLowC}\u00B0C</div>
        <div class="chem-temp-pin-arrow"></div>
      </div>
    </div>
    <div class="chem-temp-legend">
      <span>-30\u00B0C (Deep Freeze)</span>
      <span style="color:#38bdf8;">0\u00B0C (LFP Cutoff)</span>
      <span style="color:var(--primary-accent);">20\u00B0C (Ideal)</span>
      <span style="color:#ef4444;">45\u00B0C (Heat)</span>
    </div>
    ${statusHtml}
  `;

}

// -- Location plumbing -------------------------------------------------------

function setCoords(lat, lon, label, region, country) {

  locationResolved = true;

  const billWrap = $("billSliderWrap");
  if (billWrap) billWrap.style.display = "block";

  const note = $("quickBillNote");
  if (note && quickMode) note.style.display = "block";

  const latEl = $("latInput");

  const lonEl = $("lonInput");

  const noteEl = $("locNote");

  if (latEl) latEl.value = Math.round(lat * 100) / 100;

  if (lonEl) lonEl.value = Math.round(lon * 100) / 100;

  if (noteEl) noteEl.textContent = label;

  tariffTouched = false;

  currencyTouched = false;

  if (lastPayload && lastPayload.input &&
      (Math.abs(lastPayload.input.latitude - lat) > 0.05 || Math.abs(lastPayload.input.longitude - lon) > 0.05)) {
    lastPayload = null;
  }

  applyEstimatedTariff(lat, lon, region, country);

  updateFuelUnits();

  renderSunPath(lat);

  renderChemTempVisualizer(lat);

  updateShareHash(lastPayload, readInputs());

}

// Fill the bill-mode tariff from coordinates until the user overrides it.

let tariffTouched = false;

// Display currency auto-follows the matched country until the user types

// their own rate or code.

let currencyTouched = false;

function setCurrency(code) {

  const cur = CURRENCIES[code];

  if (!cur) return;

  if ($("fxCode")) $("fxCode").value = code;

  if ($("fxRate") && Number.isFinite(cur.perUSD)) $("fxRate").value = cur.perUSD;

  const oldFx = prevFxSnapshot;
  prevFxSnapshot = fxActive();

  // If the user explicitly set their monthly bill and currency
  // auto-switched to a new currency (e.g. USD -> CAD), convert the nominal bill amount
  if (billTouched && Number.isFinite(billUserNominal) && oldFx && prevFxSnapshot && oldFx.code !== prevFxSnapshot.code && oldFx.rate > 0) {
    const usd = billUserNominal / oldFx.rate;
    billUserNominal = Math.round(usd * prevFxSnapshot.rate);
  }

  updateCurrencyUnitLabel();

  syncBillSlider();

}

function updateCurrencyUnitLabel() {

  const fx = fxActive();

  const label = document.querySelector('label[for="customRateVal"]');

  if (label) label.textContent = fx

    ? `Your price per kWh (${CURRENCIES[fx.code]?.symbol || fx.code}):`

    : "Your price per kWh ($):";

  // Feed-in credit is entered in the same display currency as the tariff.

  const expSpan = document.querySelector('label[for="exportRate"] span');

  if (expSpan) expSpan.textContent = `(${fx ? (CURRENCIES[fx.code]?.symbol || fx.code) : "$"}/kWh, optional \u2014 grid-tie only)`;

  // The always-visible bill slider shows the resolved location's currency.

  const billCur = $("billSliderCur");

  if (billCur) billCur.textContent = fx ? (CURRENCIES[fx.code]?.symbol || fx.code) : "$";

  updateFuelUnits();

}

function applyEstimatedTariff(lat, lon, region, country) {

  if (tariffTouched) return;

  if (!region && !country && Number.isFinite(lat) && Number.isFinite(lon)) {
    const near = nearestCity(lat, lon, CITY_CATALOG, 80);
    if (near) { region = near.r; country = near.country; }
  }

  const est = estimateTariff(lat, lon, region, country);

  // Auto-select the country's currency first, then express the estimated
  // tariff in it - the two share one FX rate, so they round-trip exactly.
  if (est.currency && !currencyTouched && CURRENCIES[est.currency]) setCurrency(est.currency);

  const fx = fxActive();
  const shownRate = fx ? +(est.rate * fx.rate).toFixed(2) : est.rate;

  const input = $("customRateVal");
  if (input) input.value = String(shownRate);

  const note = el("div", { style: "font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;" },
    `Electricity price estimated for ${est.label}${fx ? ` (~ ${est.rate.toFixed(2)} US$/kWh)` : ""} - change it above if you know your rate.`);

  const existing = document.getElementById("tariffNote");
  if (existing) existing.remove();

  const host = input ? input.closest(".form-group") : null;
  if (host) host.appendChild(note);
  note.id = "tariffNote";

  syncBillSlider();

  // A location change auto-switches the display currency and tariff estimate;
  // refresh any existing results so the money figures follow immediately
  // instead of showing the previous location's currency.
  if (lastPayload) {
    renderResults(lastPayload);
    if (!quickMode) scheduleRun(true);
  }

}

function renderCities() {
  const search = $("citySearch");
  const list = $("citySuggestions");

  if (!search || !list) {
    console.error("City search elements not found");
    return;
  }

  if (search && list) {
    let active = -1;
    const draw = () => {
      const results = searchCities(search.value, CITY_CATALOG);
      list.innerHTML = "";
      list.hidden = !search.value.trim() || !results.length;
      results.forEach((c, i) => {
        const population = Number.isFinite(c.population) && c.population > 0 ? ` · population ${c.population.toLocaleString()}` : "";
        const button = el("button", { type: "button", role: "option", class: "city-suggestion" }, `${formatCityLabel(c)}${population}`);
        button.dataset.index = String(i);
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => { cancelAutoResolve(); setCoords(c.lat, c.lon, `Sunshine data from ${formatCityLabel(c)}`, c.r, c.country); lastResolvedQuery = normalizeCityQuery(search.value); search.value = formatCityLabel(c); list.hidden = true; search.setAttribute("aria-expanded", "false"); run(); });
        list.appendChild(button);
      });
      active = -1;
      search.setAttribute("aria-expanded", list.hidden ? "false" : "true");
    };
    search.addEventListener("input", draw);
    // Auto-lookup: 2s after the typing cadence stops, resolve the typed text
    // to coordinates without requiring Enter/Tab. Fires the same code path
    // Enter/Tab use, so behavior is identical — just hands-free.
    let autoResolveTimer = null;
    let lastResolvedQuery = "";
    const cancelAutoResolve = () => {
      if (autoResolveTimer !== null) { clearTimeout(autoResolveTimer); autoResolveTimer = null; }
    };
    search.addEventListener("input", (event) => {
      cancelAutoResolve();
      // IME composition (CJK input): keystrokes mid-composition are not the
      // final text — let composition finish before scheduling the lookup.
      if (event.isComposing) return;
      const query = search.value.trim();
      if (!shouldAutoResolve(query, lastResolvedQuery)) return;
      autoResolveTimer = setTimeout(() => {
        autoResolveTimer = null;
        const query = search.value.trim();
        if (!shouldAutoResolve(query, lastResolvedQuery)) return;
        // The user arrow-navigating an open suggestion list is actively
        // choosing — don't auto-resolve out from under them.
        if (!list.hidden && active >= 0) return;
        resolveTypedCity();
      }, 2000);
    });
    let lookupBusy = false;
    const resolveTypedCity = async () => {
      cancelAutoResolve();
      const query = search.value.trim();
      if (!query || lookupBusy) return;
      const local = searchCities(query, CITY_CATALOG, 1)[0];
      if (local) {
        lastResolvedQuery = query;
        setCoords(local.lat, local.lon, `Sunshine data from ${formatCityLabel(local)}`, local.r, local.country);
        search.value = formatCityLabel(local);
        list.hidden = true;
        search.setAttribute("aria-expanded", "false");
        run();
        return;
      }
      lookupBusy = true;
      setStatus("Looking up your city…");
      const match = await lookupCityOnline(query);
      lookupBusy = false;
      if (match) {
        lastResolvedQuery = query;
        setCoords(match.lat, match.lon, `Sunshine data from ${formatCityLabel(match)}`, match.r, match.country);
        search.value = formatCityLabel(match);
        list.hidden = true;
        search.setAttribute("aria-expanded", "false");
        run();
      }
    };
    search.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        // Let focus move naturally, but resolve the typed city first.
        // The explicit paths cancel the pending auto-lookup so it cannot
        // double-fire after an immediate resolution.
        cancelAutoResolve();
        resolveTypedCity();
        return;
      }
      if (event.key === "Enter") {
        cancelAutoResolve();
        const options = list.querySelectorAll("[role=option]");
        // If the user arrowed to a specific suggestion, let that handler pick it.
        if (!(active >= 0 && options.length)) {
          event.preventDefault();
          resolveTypedCity();
        }
      }
    });
    search.addEventListener("keydown", (event) => {
      const options = [...list.querySelectorAll("[role=option]")];
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); if (options.length) { active = (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length; options.forEach((o, i) => o.setAttribute("aria-selected", i === active ? "true" : "false")); options[active].focus(); } }
      else if (event.key === "Escape") { list.hidden = true; search.setAttribute("aria-expanded", "false"); }
      else if (event.key === "Enter" && active >= 0 && options[active]) { event.preventDefault(); options[active].click(); search.focus(); }
    });
    search.addEventListener("blur", () => { cancelAutoResolve(); setTimeout(() => { list.hidden = true; search.setAttribute("aria-expanded", "false"); }, 150); });
  }
}

async function expandCitySearch() {
  const expanded = await loadCityCatalog();
  if (expanded.length <= CITY_CATALOG.length) return;
  CITY_CATALOG.splice(0, CITY_CATALOG.length, ...expanded);
  const search = $("citySearch");
  if (search?.value.trim()) search.dispatchEvent(new Event("input"));
}

function locateMe() {

  if (!navigator.geolocation) {

    setStatus("Warning: Your browser can't share a location. Search for a city instead.");

    return;

  }

  setStatus(" Asking your browser for your location…");

  navigator.geolocation.getCurrentPosition(

    async (pos) => {

      const lat = pos.coords.latitude, lon = pos.coords.longitude;

      setCoords(lat, lon, "Using your precise location");

      if ($("coordDetails")) $("coordDetails").open = true;

      setStatus(" Location set. Resolving the nearest city for area prices…");

      // Proper area-price lookup: always resolve the nearest reference city

      // (no distance gate) so its state/region/country drives the tariff,

      // currency, and install-labor factors — the coordinate-box estimate is

      // only a fallback if the catalog never loads.

      try {

        const expanded = await loadCityCatalog();

        if (expanded.length > CITY_CATALOG.length) CITY_CATALOG.splice(0, CITY_CATALOG.length, ...expanded);

        const near = nearestCity(lat, lon, CITY_CATALOG, Infinity);

        if (near) {

          setCoords(lat, lon, `Using your precise location — prices based on ${formatCityLabel(near)}`, near.r, near.country);

        } else {

          setCoords(lat, lon, "Using your precise location");

        }

      } catch {

        setCoords(lat, lon, "Using your precise location");

      }

      // Auto-run is the default: the bill + cut sliders above were already
      // pre-configured (and stay adjustable), so location alone is enough.

      run();

    },

    () => setStatus("Warning: Couldn't get your location. Search for a city instead."),

    { timeout: 8000 }

  );

}

// Quick vs. Manual: quick hides everything except the location controls and

// sizes with defaults; Manual reveals the full form.

function setQuickMode(on) {

  quickMode = on;

  const extras = $("fullControls");

  if (extras) extras.style.display = on ? "none" : "block";

  const precise = $("coordDetails");

  if (precise) precise.style.display = on ? "none" : "block";

  const hint = $("locHint");

  if (hint) hint.style.display = on ? "none" : "block";

  const note = $("quickBillNote");

  if (note) note.style.display = on ? (locationResolved ? "block" : "none") : "none";

  const billWrap = $("billSliderWrap");

  if (billWrap) billWrap.style.display = on ? (locationResolved ? "block" : "none") : "block";

  const locBtn = $("btnGeoLocate");

  if (locBtn) {

    locBtn.classList.toggle("btn-geo-primary", on);

    locBtn.style.width = on ? "100%" : "auto";

    locBtn.style.justifyContent = "center";

  }

  const runBtn = $("btnRunSizing");

  if (runBtn) runBtn.style.display = on ? "none" : "";

}

// -- Inputs ? engine ---------------------------------------------------------

function readInputs() {

  const lat = parseFloat($("latInput").value);

  const lon = parseFloat($("lonInput").value);

  let dailyKwh;
  let peakLoadW = null;

  const mode = $("loadMode").value;

  if (mode === "appliances") {

    const ap = applianceState();
    dailyKwh = ap.kwh;
    // Real measured peak (running watts, incl. duty-cycle averages): the
    // engine sizes the inverter and its cost basis from this instead of the
    // daily average. Bill/kWh modes have no peak information (null = engine
    // falls back to the average and the BOM says so).
    peakLoadW = ap.peakW > 0 ? Math.round(ap.peakW) : null;

  } else if (mode === "bill") {

    const bill = parseFloat($("billSlider")?.value ?? $("billAmount")?.value);

    const rate = getTariff();

    dailyKwh = Number.isFinite(bill) && Number.isFinite(rate) && rate > 0 ? bill / (rate * DAYS_PER_MONTH) : billAnchorKwh;

    billAnchorKwh = Number.isFinite(dailyKwh) && dailyKwh > 0 ? dailyKwh : billAnchorKwh;

  } else {

    dailyKwh = parseFloat($("dailyKwhInput").value);

  }

  let basis = generatorBasis ? "generator fuel cost" : "direct kWh entry";

  if (mode === "appliances") basis = generatorBasis ? "appliance checklist + generator fuel" : "appliance checklist";

  else if (mode === "bill") basis = generatorBasis ? "monthly bill paid to a fuel station" : "monthly electric bill";

  return {

    latitude: lat,

    longitude: lon,

    dailyKwh,

    chemistry: $("chemSelect").value,

    years: 5,

    tariff: (() => {

      const t = getTariff();

      const fx = fxActive();

      // The tariff is entered in the DISPLAY currency; the engine prices

      // everything internally in USD, so convert once here (local ÷ units

      // per US$1). Outputs are converted back for display by money().

      return fx && Number.isFinite(t) ? t / fx.rate : t;

    })(),

    exportRate: (() => {

      const v = parseFloat($("exportRate")?.value);

      if (!(Number.isFinite(v) && v > 0)) return null;

      // Entered in the display currency (same as the tariff input); the engine

      // prices in USD, so convert once here just like the tariff is.

      const fx = fxActive();

      return fx && Number.isFinite(v) ? v / fx.rate : v;

    })(),

    autoTier: $("autoTier")?.value || "tier99",

    autoTargetId: $("autoTarget")?.value || "cut80",

    customCut: customCutFraction,

    mode: $("systemGoal") ? $("systemGoal").value : "offgrid",

    basis,

    hardwareConfig: $("hardwareConfig")?.value || "both",

    focusPvKw: pendingFocus ? pendingFocus.pvKw : null,

    focusBattKwh: pendingFocus ? pendingFocus.battKwh : null,

    focusChemistry: pendingFocus ? pendingFocus.chemistry : null,

    peakLoadW,

  };

}

function run(quiet = false) {

  if (runTimer) {
    clearTimeout(runTimer);
    runTimer = null;
  }

  const inp = readInputs();

  if (!Number.isFinite(inp.latitude) || !Number.isFinite(inp.longitude) ||
      Math.abs(inp.latitude) > 90 || Math.abs(inp.longitude) > 180) {
    setStatus(t("pickCity"));
    return;
  }

  if (!Number.isFinite(inp.dailyKwh) || inp.dailyKwh <= 0 || inp.dailyKwh > 500) {
    setStatus(t("tellPowerUse"));
    return;
  }

  if (!quiet) setStatus(inp.mode === "gridtie" ? t("statusGridtie") : t("statusOffgrid"));

  const btn = $("btnRunSizing");

  if (btn && !quiet) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">o</span> ${t("runningBtn")}`;
  }

  lastRunInput = inp;
  lastRunAdoptsFocus = pendingFocus !== null;
  lastRunQuiet = quiet;
  pendingFocus = null;
  const seq = ++runToken;
  // A new full run opens a new epoch: any in-flight slice from older inputs
  // is stale on arrival and will be dropped by the epoch check.
  const epoch = ++payloadEpoch;
  ensureWorker().postMessage({ type: "run", seq, epoch, ...inp });

}

// Slider updates queue a debounced re-run so dragging never stacks runs.
function scheduleRun(quiet = false) {

  if (runTimer) clearTimeout(runTimer);

  runTimer = setTimeout(() => { runTimer = null; run(quiet); }, 350);

}

// ── Bill-cut slider (1–111%) ────────────────────────────────────────────────

function syncCutLabel() {

  const slider = $("cutSlider");
  const out = $("cutSliderVal");

  if (!slider) return;
  const v = parseInt(slider.value, 10) || 80;

  if (out) out.textContent = v > 100
    ? `Produce ~${v}% of your bill — bill gone, sellable surplus sizeable above`
    : `Cut ~${v}% of your bill`;

}

function setupCutSlider() {

  const slider = $("cutSlider");
  if (!slider) return;
  slider.value = String(Math.round(customCutFraction * 100));
  syncCutLabel();

  slider.addEventListener("input", () => {
    customCutFraction = (parseInt(slider.value, 10) || 1) / 100;
    syncCutLabel();
    // Drag the blue dot along the curve live, so the slider and the
    // highlighted point move together while the visitor is still dragging.
    if (lastPayload && lastPayload.mode === "gridtie") {
      frontierSelected = null;
      renderFrontierPanel(lastPayload);
    }
  });

  slider.addEventListener("change", () => {
    customCutFraction = (parseInt(slider.value, 10) || 1) / 100;
    if (!lastPayload) return;
    if (lastPayload.mode === "gridtie") {
      // A cut edit only touches the slider's own column — reconcile it in the
      // background instead of re-running the fixed columns and frontier. In a
      // fixed-chemistry session the custom target IS the selected system.
      if (!lastPayload.auto) selectedKey = "custom";
      requestIncrementalCut();
    }
  });

}

// ── Incremental cut (slider / curve edits) ──────────────────────────────────

// Ask the worker for just the matrix "your target" column (and, when a curve
// point was just adopted, that system's SOC capture bands). Everything else in
// the payload is untouched by a customCut edit, so this is a few simulations,
// not a full engine run — and the response only re-renders the matrix table.
function requestIncrementalCut(focusPvKw = null, focusBattKwh = null, focusChemistry = null) {
  const p = lastPayload;
  if (!p) return;
  const inp = readInputs();
  const seq = ++sliceToken;
  ensureWorker().postMessage({ type: "reSlice", seq, epoch: payloadEpoch, incrementalCut: true, ...inp, focusPvKw, focusBattKwh, focusChemistry });
}

// Merge an incremental slice into the retained payload and refresh only what
// it touched: the matrix table, the custom column label, and — for an adopted
// curve point — its SOC chart once the capture bands arrive.
function mergeReSlice(result) {
  const p = lastPayload;
  if (!p || !result) return;
  if (result.customCut) p.customCut = result.customCut;
  if (result.cells && p.matrix && p.matrix.cells) Object.assign(p.matrix.cells, result.cells);
  if (result.customTarget) {
    p.customTarget = result.customTarget;
    // Fixed-chemistry grid-tie session: the slider's target IS the selected
    // system, so the card, charts, BOM, export and share link all follow it.
    if (!p.auto && p.mode === "gridtie") {
      renderTargetCards(p, [p.customTarget]);
      if (selectedKey === "custom" || selectedKey === "best" || !selectedKey) refreshSelectionOutputs(p);
    }
  }
  // Auto grid-tie: the recommendation follows the bill-cut slider. The worker
  // re-derives the banner and focus from the custom target column, so the
  // headline savings and "recommended" system describe the visitor's CURRENT
  // cut — not the fixed 80% one — unless they've explicitly picked a system.
  if (result.best && p.auto && p.mode === "gridtie") {
    p.best = result.best;
    if (result.bestReason) p.bestReason = result.bestReason;
    if (result.focus) p.focus = result.focus;
    renderBestPick(p);
    renderMoneyBar(p);
    if (!selectedKey || selectedKey === "best" || selectedKey === "focus") refreshSelectionOutputs(p);
  }
  // Keep the custom column header in lockstep with the slider.
  const label = result.customCut
    ? `Your ~${Math.round(result.customCut.fraction * 100)}% target`
    : result.customTarget
      ? `Your ~${Math.round(p.customCut ? p.customCut.fraction * 100 : 0)}% target`
      : null;
  if (label && p.matrix) {
    const col = p.matrix.cols && p.matrix.cols.find((c) => c.id === "custom");
    if (col) col.label = label;
  }
  // The adopted point's SOC bands: chart appears the moment they land.
  // Tolerances match engine quantization (PV 2 decimals, whole-kWh banks)
  // with headroom for rescale rounding, so a rescaled adopted point still
  // matches its freshly simulated bands.
  if (result.focusSoc && selectedKey === "adopted" && adoptedEntry &&
      adoptedEntry.chemistry === result.focusSoc.chemistry &&
      Math.abs(adoptedEntry.pvKw - result.focusSoc.pvKw) < 0.06 &&
      Math.abs(adoptedEntry.battKwh - result.focusSoc.battKwh) < 0.6) {
    adoptedEntry.socNameplatePct = result.focusSoc.socNameplatePct;
  }
  if (p.matrix && (p.mode === "gridtie" || resultLevel === "matrix")) renderMatrix(p);
  if (selectedKey === "adopted" && adoptedEntry && adoptedEntry.socNameplatePct && adoptedEntry.socNameplatePct.min && adoptedEntry.socNameplatePct.min.length) {
    drawSocChartForEntry(p, adoptedEntry);
  }
  syncCutLabel();
  // The cut changed, so any link copied right now must carry it.
  updateShareHash(p, readInputs());
}

// ── Monthly-bill slider (local currency, kWh/day anchor) ────────────────────

function setupBillSlider() {

  const slider = $("billSlider");
  if (!slider) return;
  syncBillSlider();

  // While dragging, only the label tracks the thumb — the value must not be
  // re-rounded against the anchor mid-drag.
  slider.addEventListener("input", () => {
    billTouched = true;
    billUserNominal = parseFloat(slider.value);
    const bill = billUserNominal;
    const rate = displayRate();
    if (Number.isFinite(bill) && rate > 0) billAnchorKwh = kwhFromBill(bill, rate);
    const out = $("billSliderVal");
    if (out) out.textContent = "~" + fmtBill(bill);
    updateLoadReadout();
  });

  slider.addEventListener("change", () => {
    if (!lastPayload) return;
    const inp = readInputs();
    // Same site and options already on screen? Re-express the cached payload
    // for the new bill in pure arithmetic — the engine's answers scale with
    // the load, so the numbers stay exact-in-shape and the page updates
    // instantly (no engine search, no weather re-fetch). A quiet full run
    // then refines the rescaled numbers to exact search results.
    //
    // Below ~15 kWh/day the search leaves the scaling regime (minimum-bank
    // and lattice constraints bend the PV/battery mix), so only rescale when
    // BOTH the existing and the new load are in the stable range.
    if (lastPayload.mode === "gridtie" &&
        lastRunInput && lastRunInput.dailyKwh >= RESCALE_MIN_KWH &&
        inp.dailyKwh >= RESCALE_MIN_KWH &&
        sameSiteOptions(lastRunInput, inp) &&
        lastPayload.annualGridSpendUsd !== null) {
      const k = inp.dailyKwh / lastRunInput.dailyKwh;
      if (Number.isFinite(k) && Math.abs(k - 1) > 0.001) {
        // Keep a curve/cell adoption through the rescale, at its new scale,
        // and re-adopt it on the background refine so the user's choice sticks.
        const hadAdoption = adoptedEntry !== null;
        pendingFocus = hadAdoption
          ? { pvKw: Math.round(adoptedEntry.pvKw * k * 100) / 100, battKwh: Math.round(adoptedEntry.battKwh * k), chemistry: adoptedEntry.chemistry }
          : null;
        lastPayload = rescalePayload(lastPayload, k);
        lastRunInput = inp;                 // base for the next rescale
        renderResults(lastPayload);
        if (hadAdoption) {
          adoptedEntry = scaleRecord(adoptedEntry, k);
          selectedKey = "adopted";
          refreshSelectionOutputs(lastPayload);
        }
        updateShareHash(lastPayload, inp);
        scheduleRun(true);                  // quiet refine to exact numbers
        return;
      }
    }
    scheduleRun();
  });

}

// ── Clickable matrix cells (grid-tie) ───────────────────────────────────────

function setupMatrixSelection() {

  const grid = $("tierResults");
  if (!grid) return;
  const pick = (key) => {
    const p = lastPayload;
    if (!p) return;
    frontierSelected = null;
    selectedKey = "matrix:" + key;
    renderResults(p);
    // Cells open the same full-analysis modal as curve points, with
    // "Use this system" to adopt the exact system into every chart, the BOM,
    // export data, share link, and print sheet.
    const cell = p.matrix && p.matrix.cells[key];
    if (cell && cell.solvable) {
      showSystemModal(p, { ...cell, chemistry: p.matrix.rows.find((r) => r.id === key.split(":")[0])?.id || cell.chemistry }, true);
    }
  };
  grid.addEventListener("click", (e) => {
    const td = e.target && e.target.closest ? e.target.closest("td[data-sel]") : null;
    if (td) pick(td.getAttribute("data-sel"));
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const td = e.target && e.target.closest ? e.target.closest("td[data-sel]") : null;
    if (td) { e.preventDefault(); pick(td.getAttribute("data-sel")); }
  });

}

function restoreRunButton() {

  const btn = $("btnRunSizing");

  if (btn) {

    btn.disabled = false;

    btn.innerHTML = t("runBtnReady");

  }

}

function ensureWorker() {

  if (!worker) {



    worker = new Worker("./assets/js/sizing/sizing-worker.js?v=20260905b", { type: "module" });

    worker.onmessage = (ev) => {

      if (ev.data?.type === "ok") {

        // A stale response from an older queued run must never clobber the
        // latest slider position's results.

        if (ev.data.seq !== undefined && ev.data.seq !== runToken) return;

        if (lastRunAdoptsFocus) { selectedKey = "focus"; lastRunAdoptsFocus = false; }

        renderResults(ev.data.payload);

        // bring the results into view - the run button can be far above them
        // (instant scroll for reduced-motion users)

        const res = $("tierResults");

        if (res && !lastRunQuiet) {

          res.setAttribute("tabindex", "-1");

          const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          res.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

        }

      } else if (ev.data?.type === "reSlice") {

        // Incremental cut patch: only the slider's "your target" column (and
        // SOC bands for an adopted curve point) — no full re-render, no scroll,
        // no status churn. A patch is only merged when it belongs to the
        // CURRENT payload epoch: a slice computed from pre-edit inputs that
        // lands after a full run for newer inputs is dropped, never merged.

        if (ev.data.seq !== sliceToken) return;

        if (ev.data.epoch !== undefined && ev.data.epoch !== payloadEpoch) return;

        mergeReSlice(ev.data.result);

      } else if (ev.data?.type === "error") {

        // Stale errors must not overwrite a newer success: only the latest
        // run or slice in each stream may report.
        const s = ev.data.seq;
        const fresh = ev.data.stream === "slice" ? s === sliceToken : s === runToken;
        if (s !== undefined && !fresh) return;
        setStatus("Warning: " + ev.data.message);

      }

      restoreRunButton();

    };

    worker.onerror = () => {

      setStatus(t("errorSim") + "Sizing engine failed to load.");

      restoreRunButton();

    };

  }

  return worker;

}

function fmt(n) { return Number(n).toLocaleString(); }

function fmtLife(years) {

  if (!Number.isFinite(years) || years <= 0) return "-";

  if (years >= 2) return "~" + Math.round(years) + " yrs";

  const months = Math.max(1, Math.round(years * 12));

  return "~" + months + " mo";

}

function fmtPaybackOne(y) {

  if (!Number.isFinite(y)) return null;

  if (y < 1) return `~${Math.max(1, Math.round(y * 12))} mo`;

  return `~${Math.round(y)} yr`;

}

function fmtPaybackRange(lo, hi) {

  const a = fmtPaybackOne(lo), b = fmtPaybackOne(hi);

  if (!a || !b) return "-";

  return a === b ? a : `${a}-${b.replace("~", "")}`;

}

// User currency (optional): converts every displayed dollar amount AND unit
// rate at the user's rate, so a EUR user never sees a stray $ row.

function fxActive() {

  const rate = parseFloat($("fxRate")?.value);

  const code = ($("fxCode")?.value || "").trim().toUpperCase();

  if (!/^[A-Z]{3,4}$/.test(code)) return null;

  if (!Number.isFinite(rate) || rate <= 0) return null;

  // Sanity bounds: a USD-based rate outside this range is a typo, not an FX rate.

  if (rate < 1e-4 || rate > 1e6) return null;

  return { rate, code };

}

function money(usd) {

  const fx = fxActive();

  if (!fx) return "$" + Number(usd).toLocaleString();

  const local = usd * fx.rate;

  try {

    return new Intl.NumberFormat(undefined, { style: "currency", currency: fx.code }).format(local);

  } catch {

    const sym = CURRENCIES[fx.code]?.symbol || "";

    return sym + Math.round(local).toLocaleString() + " " + fx.code;

  }

}

// All energy-cost figures are stored by the engine in USD/kWh. Convert the
// rate, not just the dollar totals, so the headline metric remains honest when
// a user changes currency.
function localRate(usdPerKwh) {
  if (!Number.isFinite(usdPerKwh)) return "n/a";
  const fx = fxActive();
  const amount = usdPerKwh * (fx ? fx.rate : 1);
  const code = fx?.code || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function energyRate(usdPerKwh) {
  const r = localRate(usdPerKwh);
  return r === "n/a" ? r : r + "/kWh";
}

function gridRate(usdPerKwh) {
  return Number.isFinite(usdPerKwh) ? ` (grid ${energyRate(usdPerKwh)})` : "";
}

function moneyRange(lo, hi) { return money(lo) + "\u2013" + money(hi); }

function fxNote() {

  const fx = fxActive();

  if (!fx) return null;

  const asOf = fxMeta.asOf

    ? ` Live rates as of ${fxMeta.asOf}.`

    : " Indicative built-in rates (live fetch unavailable).";

  return `Amounts shown in ${fx.code} at ${fx.rate} per US$1. Energy cost rates and recommendations are converted to ${fx.code}; source price scopes remain USD-denominated.`;

}

const TIER_COLORS = {

  tier100: "#00e699", tier99: "#60a5fa", tier95: "#f59e0b",

  cut60: "#60a5fa", cut80: "#00e699", cut95: "#f59e0b",

  "auto-naion": "#60a5fa", "auto-lfp": "#00e699", "auto-agm": "#f59e0b",

};

const TIER_NAMES = {

  tier100: "100% - never needs a generator",

  tier99: "99% - generator as rare backup",

  tier95: "95% - generator now and then",

  cut60: "~60% bill cut - grid covers the rest",

  cut80: "~80% bill cut - small grid top-ups",

  cut95: "~95% bill cut - near off-grid",

  "auto-naion": "Sodium-Ion bank over five real years",

  "auto-lfp": "LFP bank over five real years",

  "auto-agm": "Lead-Acid (AGM) bank over five real years",

};

/**

 * Sun strip: the site's daily solar harvest per kW of panel, drawn on the

 * same time axis as the battery charts. This is the "solar panels" half of

 * the story - its long winter valleys are why the battery floor dips.

 */

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

  for (let i = 0; i < pv.length; i++) ctx.lineTo(X(i), stripH - (pv[i] / pvMax) * amp);

  ctx.lineTo(W - padR, stripH);

  ctx.closePath();

  ctx.globalAlpha = 0.30; ctx.fillStyle = "#fbbf24"; ctx.fill();

  ctx.globalAlpha = 0.65; ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1; ctx.stroke();

  ctx.globalAlpha = 1;

  ctx.restore();

  ctx.font = "10px ui-monospace, monospace";

  ctx.fillStyle = "#fcd34d"; ctx.textAlign = "left";

  ctx.fillText(`daily sun - kWh per kW of panel - peak day ${pvMax.toFixed(1)}`, padL + 2, 11);

}

/**

 * Reliability chart, deliberately simple: one stacked panel per system, one

 * line per panel - the LOWEST the battery got each day over five years.

 * Flat and high = dependable. Dives to the red line = generator territory.

 */

function drawSocChart(history, chemLabel) {

  const wrap = $("socChartWrap");

  const canvas = $("socCanvas");

  if (!wrap || !canvas) return;

  const solvable = history.tiers.filter((t) => t.dailyMin && t.dailyMax && t.dailyMin.length);
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

  const W = Math.max(200, Math.min(wrap.clientWidth || 320, (typeof window !== "undefined" && window.innerWidth ? window.innerWidth - 48 : 640)));

  const BAND_H = 118, GAP = 14;

  const nDays = solvable.length ? solvable[0].dailyMin.length : 0;

  const zStart = (socZoomRange && Number.isFinite(socZoomRange.start)) ? Math.max(0, Math.min(nDays - 2, socZoomRange.start)) : 0;

  const zEnd = (socZoomRange && Number.isFinite(socZoomRange.end)) ? Math.max(zStart + 1, Math.min(nDays - 1, socZoomRange.end)) : nDays - 1;

  const visibleDays = Math.max(1, zEnd - zStart);

  const pv = (history.pvDaily && nDays && history.pvDaily.length === nDays) ? history.pvDaily : null;

  const stripH = pv ? 64 : 0, stripGap = pv ? 10 : 0;

  const H = stripH + stripGap + solvable.length * BAND_H + (solvable.length - 1) * GAP + 20;

  canvas.width = Math.round(W * dpr);

  canvas.height = Math.round(H * dpr);

  canvas.style.width = "100%";

  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 34, padR = 10, padT = 26, padB = 8;

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

      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();

      ctx.fillStyle = "#6b7280"; ctx.textAlign = "right";

      ctx.fillText(v + "%", padL - 5, Y(v) + 3);

    }

    const floorSOC = chemLabel.includes("AGM") ? 50 : 20;

    ctx.fillStyle = "rgba(100,100,100,0.08)";

    ctx.fillRect(padL, Y(floorSOC), plotW, Y(0) - Y(floorSOC));

    ctx.strokeStyle = "rgba(239,68,68,0.7)";

    ctx.setLineDash([4, 4]);

    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(239,68,68,0.85)"; ctx.textAlign = "left";

    ctx.fillText(gt ? "bank empty" : "empty", W - padR - (gt ? 74 : 38), Y(0) - 4);

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

    for (let i = zStart; i <= zEnd; i++) { const y = Y(t.dailyMin[i]); if (i === zStart) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    // top edge thicker: "does it reach full?" should be unmistakable

    ctx.globalAlpha = 0.95;

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) { const y = Y(t.dailyMax[i]); if (i === zStart) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

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

    const verdict = t.emptyDays > 0

      ? (gt ? `${charged} - but drained flat on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"} - the grid covered those`

            : `${charged} - but hit empty on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"}`)

      : `${charged} - never went empty`;

    ctx.fillText(`lowest point ${Math.max(0, Math.round(t.minPct))}% - ${verdict}`, padL + 2, top + padT + 14);

  }

  const topOffset = stripH + stripGap;

  if (pv) drawSunStrip(ctx, pv, X, W, padL, padR, stripH);

  solvable.forEach((t, idx) => drawBand(t, topOffset + idx * (BAND_H + GAP)));

  // shared x labels: years or day indices if zoomed in

  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";

  if (socZoomRange && visibleDays < 365) {

    const step = Math.max(1, Math.floor(visibleDays / 6));

    for (let d = zStart; d <= zEnd; d += step) {

      const x = X(d);

      ctx.fillText(`Day ${d + 1}`, Math.min(W - padR - 16, Math.max(padL + 16, x)), H - 2);

    }

  } else {

    const span = history.endYear - history.startYear + 1;

    const daysTotal = history.days || solvable[0].dailyMin.length;

    for (let yy = 0; yy <= span; yy++) {

      const dayIdx = Math.round(yy * 365.25);

      if (dayIdx >= zStart && dayIdx <= zEnd) {

        const x = X(dayIdx);

        ctx.fillText(String(history.startYear + yy), Math.min(W - padR, Math.max(padL, x)), H - 2);

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

  if (pv) $("socCaption").textContent += " The amber strip on top is the daily solar harvest (kWh per kW of panel) - its long dips line up with the battery's lowest floors.";

}

function renderAutoCards(p) {

  const grid = $("tierResults");

  grid.innerHTML = "";

  const isGT = p.mode === "gridtie";

  // Highlight the cheapest bank over its true lifetime (swaps + labor).

  let bestLife = Infinity, bestId = null;

  for (const a of p.auto) {

    if (a.solvable && a.lifetimeCostMid < bestLife) { bestLife = a.lifetimeCostMid; bestId = a.chemistry; }

  }

  for (const a of p.auto) {

    const isSelected = selectedKey === "auto:" + a.chemistry;

    const card = el("div", {
      class: "bom-card" + (a.solvable ? " card-selectable" : "") + (isSelected ? " bom-card-selected" : "")
    });

    if (a.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = "auto:" + a.chemistry;
        refreshSelectionOutputs(p);
        renderAutoCards(p);
      };
      card.addEventListener("click", selectCard);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard();
        }
      });
    }

    card.style.borderColor = isSelected
      ? "var(--primary-accent)"
      : (a.chemistry === bestId ? "var(--border-glow)" : "var(--border-card)");

    card.appendChild(el("div", { class: "bom-badge" }, isGT && a.cutPct ? `Bill -${a.cutPct}%` : "Same job done"));

    card.appendChild(el("h3", {}, a.chemLabel));

    if (!a.solvable) {

      card.appendChild(el("p", {}, "Not practical at this site/load within search limits."));

      grid.appendChild(card);

      continue;

    }

    const rows = [
      ["Solar", `${a.pvKw} kW`],
      ["Battery", `${fmt(a.battKwh)} kWh usable`],
      ["Cost to buy", `~${moneyRange(a.costLo, a.costHi)}`],
      ["Battery swaps", a.replacementsHorizon > 0 ? (a.batteryLifeYears ? `~${a.replacementsHorizon}x (about every ${fmtLife(a.batteryLifeYears)})` : `~${a.replacementsHorizon}x`) : "None in 20 years"],
    ];

    const footAuto = footprintText(a.pvKw);

    if (footAuto) rows.splice(2, 0, ["Footprint", footAuto]);

    if (a.swapsAndLaborUsd > 0) {

      rows.push(["Swaps + labor add", `~${money(a.swapsAndLaborUsd)}`]);

    }

    rows.push(["Total 20-year cost", `~${money(a.lifetimeCostMid)}` + (a.chemistry === bestId && p.auto.filter((x) => x.solvable).length >= 2 ? " - cheapest" : "")]);

    pushSeriesBreakdown(rows, a);

    if (isGT) {

      rows.push(["Bill after solar", a.billAfterMonthlyUsd !== null ? `~${money(a.billAfterMonthlyUsd)}/mo` : "needs your tariff"]);

      rows.push(["Sun clipped (no export)", `${fmt(a.clippedKwhPerYear)} kWh/yr`]);

      if (a.exportValueAnnualUsd > 0) {

        rows.push(["Feed-in credit on clipped sun", `+${money(a.exportValueAnnualUsd)}/yr`]);

      }

    }

    // Headline economics: TRUE break-even counts every swap. When a bank

    // wears out fast enough that it never catches up, say so outright.

    // undefined = stale payload (contract warning already shown) ? omit row.

    if (p.tariff && a.trueBreakEvenYear !== undefined) {

      if (typeof a.trueBreakEvenYear === "number") {

        rows.push(["Pays for itself", `Year ${a.trueBreakEvenYear}`]);

        if (a.replacementsHorizon > 0 && a.paybackYearsLo !== null) {

          rows.push(["  - first cost alone pays back in", fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi)]);

        }

      } else {

        rows.push(["True 20-yr break-even", "never - replacements outpace savings"]);

      }

    } else if (!p.tariff && a.paybackYearsLo !== null) {

      rows.push(["Pays for itself in", fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi)]);

    }

    if (Number.isFinite(a.lcoeUsdPerKwh)) {
      rows.push(["Your power cost", energyRate(a.lcoeUsdPerKwh) + gridRate(p.tariff)]);
    }

    appendRows(card, rows);

    if (a.bestPriceCallout) {
      card.appendChild(el("div", { class: "best-price-callout" }, `💡 ${a.bestPriceCallout}`));
    }

    if (a.cardNote) {

      card.appendChild(el("p", { style: "font-size:0.8rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.5;" }, a.cardNote));

    }

    card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },

      `${p.autoNote}. Lifetime cost includes install labor on the first bank and every swap.`));

    grid.appendChild(card);

  }

}

// ── Result detail ladder / best pick / options matrix ───────────────────────

function footprintText(pvKw, panelWatts = PANEL_WATTS_DEFAULT) {
  const lay = panelLayout(pvKw, panelWatts);
  if (!lay) return null;
  return `~${lay.count} \u00D7 ${lay.panelWatts} W panels \u00B7 about ${lay.areaM2} m\u00B2 of roof or ground`;
}

function syncLadderTabs() {
  const map = { best: "lvlBest", compare: "lvlCompare", matrix: "lvlMatrix" };
  const solvable = lastPayload && lastPayload.auto
    ? lastPayload.auto.filter((a) => a.solvable && Number.isFinite(a.lifetimeCostMid)).length
    : 0;
  const canCompare = solvable >= 2;
  for (const [lvl, id] of Object.entries(map)) {
    const btn = $(id);
    if (!btn) continue;
    if (lvl === "compare") {
      btn.style.display = canCompare ? "" : "none";
      if (!canCompare && resultLevel === "compare") resultLevel = "best";
    }
    const active = resultLevel === lvl;
    btn.classList.toggle("ladder-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function setLevel(lvl) {
  resultLevel = lvl;
  syncLadderTabs();
  if (lastPayload && lastPayload.auto && lastPayload.auto.length) renderResults(lastPayload);
}

/** The one system we'd build here, stated plainly, with the why. */
function renderBestPick(p) {
  const wrap = $("bestPickWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const grid = $("tierResults");
  if (grid) { grid.style.display = "grid"; grid.innerHTML = ""; }
  if (!p.best) {
    wrap.appendChild(el("p", { style: "color:var(--text-muted);font-size:0.9rem;" },
      "No chemistry produced a practical system at this site and load. Try lowering the reliability target or the daily kWh."));
    return;
  }
  const b = p.best;
  const isGT = p.mode === "gridtie";
  const solvableCount = (p.auto || []).filter((a) => a.solvable && Number.isFinite(a.lifetimeCostMid)).length;
  const bestSuffix = solvableCount >= 2 ? " — cheapest compared" : "";
  const card = el("div", { class: "bom-card" });
  card.style.borderColor = "var(--border-glow)";
  const title = (b.pvKw === 0 && b.battKwh > 0)
    ? `${b.chemLabel}: ${fmt(b.battKwh)} kWh battery (peak-hour offset)`
    : (b.battKwh === 0)
      ? `${b.chemLabel}: ${b.pvKw} kW solar (no battery needed)`
      : `${b.chemLabel}: ${b.pvKw} kW solar + ${fmt(b.battKwh)} kWh battery`;
  card.appendChild(el("div", { class: "bom-badge" }, "Recommended \u2014 lowest true 20-year cost"));
  card.appendChild(el("h3", {}, title));
  const rows = [
    ["Solar array", b.pvKw > 0 ? `${b.pvKw} kW` : "None (Battery-only)"],
    ["Battery (usable)", b.battKwh > 0 ? `${fmt(b.battKwh)} kWh \u2014 ~${fmt(b.battNameplateKwh)} nameplate` : "None (Solar-only)"],
  ];
  const foot = b.pvKw > 0 ? footprintText(b.pvKw) : null;
  if (foot) rows.push(["Footprint", foot]);
  rows.push(["Cost to buy", `~${moneyRange(b.costLo, b.costHi)}`]);
  rows.push(["Battery swaps", b.replacementsHorizon > 0
    ? (b.batteryLifeYears ? `~${b.replacementsHorizon}x (about every ${fmtLife(b.batteryLifeYears)})` : `~${b.replacementsHorizon}x`)
    : "None in 20 years"]);
  if (b.swapsAndLaborUsd > 0) rows.push(["Swaps + labor add", `~${money(b.swapsAndLaborUsd)}`]);
  rows.push(["Total 20-year cost", `~${money(b.lifetimeCostMid)}${bestSuffix}`]);
  pushSeriesBreakdown(rows, b);
  if (!isGT) {
    rows.push(["Unmet hours", `${fmt(b.unmetHoursPerYear ?? 0)} h/yr \u00B7 longest gap ${fmt(b.longestGapHours ?? 0)} h`]);
  } else if (b.billAfterMonthlyUsd !== null) {
    rows.push(["Bill after solar", `~${money(b.billAfterMonthlyUsd)}/mo`]);
  }
  if (p.tariff && typeof b.trueBreakEvenYear === "number") {
    rows.push(["Pays for itself", `Year ${b.trueBreakEvenYear}`]);
    if (b.replacementsHorizon > 0 && b.paybackYearsLo !== null) {
      rows.push(["  \u2014 first cost alone pays back in", fmtPaybackRange(b.paybackYearsLo, b.paybackYearsHi)]);
    }
  } else if (p.tariff && b.trueBreakEvenYear === null && b.replacementsHorizon > 0) {
    rows.push(["True 20-yr break-even", "never \u2014 replacements outpace savings"]);
  } else if (!p.tariff && b.paybackYearsLo !== null) {
    rows.push(["Pays for itself in", fmtPaybackRange(b.paybackYearsLo, b.paybackYearsHi)]);
  }
  if (Number.isFinite(b.lcoeUsdPerKwh)) {
    rows.push(["Your power cost", energyRate(b.lcoeUsdPerKwh) + gridRate(p.tariff)]);
  }
  appendRows(card, rows);
  if (p.bestReason) {
    card.appendChild(el("p", { style: "font-size:0.85rem;color:var(--text-main);margin-top:0.7rem;line-height:1.55;" }, p.bestReason));
  }    const compareHint = isGT
    ? (solvableCount >= 2
      ? " Click any cell in the matrix below to see that exact system in every chart and the hardware list."
      : " The matrix shows why the other chemistries weren't practical at this site.")
    : (solvableCount >= 2
      ? " Use the tabs above to compare every option side by side."
      : " The matrix shows why the other chemistries weren't practical at this site.");
  card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },
    `${p.autoNote}.${compareHint}`));
  wrap.appendChild(card);
}

/** Compact column labels for the matrix header. */
function matrixColShort(p, col) {
  if (p.mode === "gridtie") {
    if (col.custom) return col.label || `Your ~${p.customCut ? Math.round(p.customCut.fraction * 100) : 80}% target`;
    return col.id === "cut60" ? "\u221260% bill" : col.id === "cut80" ? "\u221280% bill" : col.id === "cut95" ? "\u221295% bill" : (col.label ? col.label.split("\u2014")[0].trim() : `\u2212${col.id.replace("cut", "")}% bill`);
  }
  return col.label.split("\u2014")[0].trim();
}

/**
 * The full comparison table: every chemistry against every cut level. Green
 * outline marks the cheapest true 20-year cost per column. In grid-tie mode
 * every cell is the SELECTION UI: click (or Tab to and Enter) a cell and the
 * whole results pipeline — banner, curves, charts, hardware list, export
 * figures, share link — switches to that system.
 */
function matrixHtml(p) {
  const m = p.matrix;
  if (!m) return "";
  const selectable = p.mode === "gridtie";
  const selKey = selectedKey || "best";
  const surplusCol = !!(p.customCut && p.customCut.surplus);
  // Cheapest lifetime cost per column (among solvable cells)
  const colBest = {};
  for (const col of m.cols) {
    let min = Infinity;
    for (const row of m.rows) {
      const c = m.cells[`${row.id}:${col.id}`];
      if (c && c.solvable && Number.isFinite(c.lifetimeCostMid) && c.lifetimeCostMid < min) min = c.lifetimeCostMid;
    }
    colBest[col.id] = min;
  }
  const head = m.cols.map((c) => `<th>${matrixColShort(p, c)}</th>`).join("");
  const body = m.rows.map((row) => {
    const cells = m.cols.map((col) => {
      const key = `${row.id}:${col.id}`;
      const cell = m.cells[key];
      const bestCls = cell && cell.solvable && Number.isFinite(cell.lifetimeCostMid) && cell.lifetimeCostMid === colBest[col.id] ? " matrix-best" : "";
      const selCls = selectable && selKey === "matrix:" + key ? " matrix-sel" : "";
      const cls = (bestCls || selCls) ? ` class="${(bestCls + selCls).trim()}"` : "";
      const clickable = selectable
        ? ` data-sel="${key}" role="button" tabindex="0" aria-label="Select ${row.label} at ${col.label}" style="cursor:pointer;"`
        : "";
      if (!cell || !cell.solvable) {
        return `<td${cls}><span style="color:var(--text-muted);">not practical here</span></td>`;
      }
      let rel;
      if (p.mode === "offgrid") rel = `${fmt(cell.unmetHoursPerYear)} h/yr unmet`;
      else if (col.id === "custom" && surplusCol) rel = "bill gone + surplus";
      else rel = `-${cell.cutPct}% bill`;
      const lcoe = Number.isFinite(cell.lcoeUsdPerKwh)
        ? `<span style="color:var(--text-muted);">\u00B7 ${energyRate(cell.lcoeUsdPerKwh)}</span>` : "";
      return `<td${cls}${clickable}>${cell.pvKw} kW PV<br>${cell.battKwh > 0 ? fmt(cell.battKwh) + " kWh batt" : "no battery"}` +
        `<br>~${moneyRange(cell.costLo, cell.costHi)}<br><strong>20-yr ~${money(cell.lifetimeCostMid)}</strong><br>${rel} ${lcoe}</td>`;
    }).join("");
    return `<tr><th>${row.label}</th>${cells}</tr>`;
  }).join("");
  const hint = p.mode === "gridtie"
    ? "Green outline = lowest true 20-year cost in that column. Click any cell to make it the system shown in every chart, the hardware list, and the export figures below. The \u201Cyour target\u201D column follows the slider."
    : "Green outline = lowest true 20-year cost in that column (every bank swap counted). \"Unmet\" hours are covered by a generator or the grid.";
  return `<div class="matrix-wrap"><table class="matrix-table"><thead><tr><th>Battery \u2193 \u00B7 Goal \u2192</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.55;">${hint}</p>`;
}

function renderMatrix(p) {
  const grid = $("tierResults");
  if (!grid) return;
  grid.style.display = "block";
  grid.innerHTML = p.matrix ? matrixHtml(p) : "";
}

// ── Selected system ─────────────────────────────────────────────────────────
// One system drives everything below the run (charts, hardware list, export
// figures, share link, print). This resolves whichever the visitor picked
// last; it falls back to the recommendation.
function resolveSelected(p) {
  if (!p) return null;
  const key = selectedKey || "best";
  if (key === "adopted" && adoptedEntry) return adoptedEntry;
  if (key === "focus" && p.focusSystem) return p.focusSystem;
  if (key === "custom") {
    const c = p.customCut;
    return (c && c.best) || (c && c.entries && c.entries[0]) || p.customTarget || null;
  }
  if (key.indexOf("matrix:") === 0 && p.matrix) {
    const cell = p.matrix.cells[key.slice("matrix:".length)];
    if (cell && cell.solvable) return cell;
  }
  if (key.indexOf("auto:") === 0 && p.auto) {
    const chem = key.slice("auto:".length);
    const entry = p.auto.find((a) => a.chemistry === chem);
    if (entry && entry.solvable) return entry;
  }
  if (key.indexOf("tier:") === 0 && p.tiers) {
    const tid = key.slice("tier:".length);
    const entry = p.tiers.find((t) => t.id === tid);
    if (entry && entry.solvable) return entry;
  }
  if (key.indexOf("target:") === 0 && (p.targets || p.customTarget)) {
    const tid = key.slice("target:".length);
    const pool = (p.targets || []).concat(p.customTarget ? [p.customTarget] : []);
    const entry = pool.find((t) => t.id === tid);
    if (entry && entry.solvable) return entry;
  }
  return p.best ||
    (p.auto && p.auto.find((a) => a.solvable)) ||
    (p.targets && (p.targets.find((t) => t.id === "cut80" && t.solvable) || p.targets.find((t) => t.solvable))) ||
    (p.tiers && (p.tiers.find((t) => t.id === "tier99" && t.solvable) || p.tiers.find((t) => t.solvable))) ||
    (p.customCut && p.customCut.best) || p.customTarget || p.focusSystem || null;
}

// If the entry carries a full 20-year cost series, append the bills-split so
// the card tells the same story as the chart: system + remaining bills =
// all-in. Silent when there is no tariff/series.
function pushSeriesBreakdown(rows, entry) {
  const bd = entry && entry.cumCostSeries ? seriesBreakdown(entry.cumCostSeries) : null;
  if (!bd || bd.systemTotal === null || bd.residualBills === 0) return;
  if (bd.residualBills > 0) {
    rows.push(["Remaining 20-yr bills", `~${money(bd.residualBills)}`]);
    rows.push(["All-in over 20 yrs (system + bills)", `~${money(bd.withSolar)}`]);
  } else {
    // Net metering: the feed-in credit on surplus out-earns the remaining
    // bill, so the residual is negative — present it as the credit it is.
    rows.push(["Net feed-in credit over 20 yrs", `~${money(-bd.residualBills)}`]);
    rows.push(["All-in over 20 yrs (system \u2212 credit)", bd.withSolar < 0
      ? `~\u2212${money(-bd.withSolar)}`
      : `~${money(bd.withSolar)}`]);
  }
}

// The tooltip/table rows for ANY selectable system — full money story, export
// economics and 20-year picture. Shared by the curve-point modal and the
// selected-system banner.
function entryDetailRows(p, e) {
  const rows = [];
  const chemLabel = e.chemLabel
    || (p.matrix && p.matrix.rows && p.matrix.rows.find((r) => r.id === e.chemistry)?.label)
    || e.chemistry
    || "—";
  rows.push(["Chemistry", chemLabel]);
  rows.push(["Solar array", `${e.pvKw} kW`]);
  rows.push(["Battery (usable)", e.battKwh > 0 ? `${fmt(e.battKwh)} kWh${e.battNameplateKwh ? ` — ~${fmt(e.battNameplateKwh)} nameplate` : ""}` : "none needed"]);
  const foot = footprintText(e.pvKw);
  if (foot) rows.push(["Footprint", foot]);
  if (e.cutPct !== undefined && e.cutPct !== null) {
    rows.push([p.mode === "gridtie" ? "Bill cut" : "Coverage", p.mode === "gridtie" ? `-${e.cutPct}%` : `${e.cutPct}%`]);
  }
  rows.push(["Component cost", `~${moneyRange(e.costLo, e.costHi)}`]);
  if (e.billAfterMonthlyUsd !== null && e.billAfterMonthlyUsd !== undefined) {
    rows.push(["Bill after solar", `~${money(e.billAfterMonthlyUsd)}/mo`]);
  }
  if (e.importedKwhPerYear !== undefined && e.importedKwhPerYear !== null) {
    rows.push(["Imported from grid", `${fmt(e.importedKwhPerYear)} kWh/yr`]);
  }
  if (e.clippedKwhPerYear !== undefined && e.clippedKwhPerYear !== null) {
    const feed = e.exportValueAnnualUsd > 0 ? ` · feed-in +${money(e.exportValueAnnualUsd)}/yr` : " · enter a feed-in credit to value it";
    rows.push([p.mode === "gridtie" ? "Surplus clipped" : "Sun clipped", `${fmt(e.clippedKwhPerYear)} kWh/yr${feed}`]);
  }
  if (e.paybackYearsLo !== null && e.paybackYearsLo !== undefined) {
    rows.push(["Pays back its first cost in", fmtPaybackRange(e.paybackYearsLo, e.paybackYearsHi)]);
  }
  if (typeof e.trueBreakEvenYear === "number") {
    rows.push(["True 20-yr break-even", `Year ${e.trueBreakEvenYear}`]);
  } else if (e.trueBreakEvenYear === null && e.replacementsHorizon > 0) {
    rows.push(["True 20-yr break-even", "never — swaps outpace savings"]);
  }
  if (e.replacementsHorizon > 0 && e.battKwh > 0) {
    rows.push(["Battery swaps over 20 yr", `~${e.replacementsHorizon}x — adds ~${money(e.swapsAndLaborUsd)} with labor`]);
  }
  if (Number.isFinite(e.lifetimeCostMid)) {
    rows.push(["Total 20-year cost", `~${money(e.lifetimeCostMid)}`]);
  }
  pushSeriesBreakdown(rows, e);
  if (Number.isFinite(e.lcoeUsdPerKwh)) {
    rows.push(["Your power cost", energyRate(e.lcoeUsdPerKwh) + gridRate(p.tariff)]);
  }
  if (e.unmetHoursPerYear !== undefined && e.unmetHoursPerYear !== null) {
    rows.push(["Unmet hours", `${fmt(e.unmetHoursPerYear)} h/yr · longest gap ${fmt(e.longestGapHours ?? 0)} h`]);
  }
  if (e.bestPriceCallout) {
    rows.push(["Scenario note", e.bestPriceCallout]);
  }
  return rows;
}

// Opening the full-analysis modal for a chosen system (curve point, matrix
// cell, etc). ``adopt`` makes the primary button re-run the engine with this
// EXACT system so the live charts and hardware list follow it.
function showSystemModal(p, entry, adopt) {
  const overlay = $("systemModal");
  if (!overlay) return;
  const body = $("systemModalBody");
  const chemLabel = entry.chemLabel
    || (p.matrix && p.matrix.rows && p.matrix.rows.find((r) => r.id === entry.chemistry)?.label)
    || entry.chemistry
    || "system";
  const headPct = entry.cutPct !== undefined && entry.cutPct !== null ? ` — ${entry.cutPct}%` : "";
  const title = $("systemModalTitle");
  if (title) {
    title.textContent = `${p.mode === "gridtie" ? "Full bill-cut analysis" : "Full system analysis"}${headPct}: ${chemLabel}`;
  }
  if (body) {
    body.innerHTML = "";
    const card = el("div", { class: "bom-card" });
    card.style.borderColor = "var(--border-glow)";
    appendRows(card, entryDetailRows(p, entry));
    body.appendChild(card);
    body.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.7rem;line-height:1.5;" },
      "Every figure is computed from the same hourly weather simulation as the cards — nothing here is estimated by eye." +
      (p.tariff ? "" : " Enter your grid price above to see payback vs. your bill.")));
  }
  const adoptBtn = $("systemModalUse");
  if (adoptBtn) {
    adoptBtn.style.display = adopt ? "inline-flex" : "none";
    adoptBtn._adopt = () => {
      if (!adopt) return;
      pendingFocus = { pvKw: entry.pvKw, battKwh: entry.battKwh, chemistry: entry.chemistry };
      closeSystemModal();
      run();
    };
  }
  overlay.style.display = "flex";
  const closer = $("btnCloseSystem");
  if (closer) closer.focus();
}

function closeSystemModal() {
  const overlay = $("systemModal");
  if (overlay) overlay.style.display = "none";
}

// ── Hardware list panel (BOM) ────────────────────────────────────────────────

function currentPanelWatts() {
  const v = parseFloat($("panelWatts")?.value);
  return Number.isFinite(v) && v >= 50 ? v : PANEL_WATTS_DEFAULT;
}

function buildFocusBom() {
  const p = lastPayload;
  // The hardware list follows the SELECTED system, not just the default pick.
  const f = resolveSelected(p) || (p && p.focus);
  if (!f) return null;
  const watts = currentPanelWatts();
  // peakIsAverage propagates so the BOM can warn that the inverter class
  // came from the daily average, not a measured peak.
  const peakIsAverage = p.peakIsAverage !== false;
  return buildBom({
    pvKw: f.pvKw,
    battNameplateKwh: f.battNameplateKwh,
    chemistry: f.chemistry,
    peakLoadW: f.peakLoadW || (p.focus && p.focus.peakLoadW) || Math.round((p.dailyKwh || 0) * 1000 / 24),
    peakIsAverage,
    meanTempC: (p.assumptions && p.assumptions.meanTempC) ?? null,
    panelWatts: watts,
  });
}

function renderBomPanel() {
  const panel = $("bomPanel");
  const body = $("bomBody");
  if (!panel || !body) return;
  const bom = buildFocusBom();
  panel.style.display = bom ? "block" : "none";
  if (!bom) { body.innerHTML = ""; return; }
  body.innerHTML = "";

  const section = (title, rows) => {
    if (!rows || !rows.length) return;
    const card = el("div", { class: "bom-card", style: "margin-bottom:0.8rem;" });
    card.appendChild(el("h3", {}, title));
    appendRows(card, rows);
    body.appendChild(card);
  };

  const f = resolveSelected(lastPayload) || lastPayload.focus;
  if (f && f.bestPriceCallout) {
    const callout = el("div", {
      class: "best-price-callout",
      style: "margin-bottom:0.8rem;padding:0.75rem 1rem;border-radius:8px;background:rgba(0,230,153,0.08);border:1px solid rgba(0,230,153,0.3);font-size:0.85rem;line-height:1.45;color:var(--text-color);"
    }, `💡 ${f.bestPriceCallout}`);
    body.appendChild(callout);
  }
  if (bom.panels) {
    section("Panels", [
      ["Array", `${f.pvKw} kW \u2192 ${bom.panels.count} \u00D7 ${bom.panels.panelWatts} W = ${bom.panels.kwActual} kW`],
      ["Space needed", `about ${bom.panels.areaM2} m\u00B2 of roof or ground (mounting gaps included)`],
    ]);
  } else {
    section("Panels", [
      ["Array", "None (Battery-only configuration \u2014 ToU grid arbitrage / peak-offset)"],
    ]);
  }
  if (bom.voltage && bom.battery) {
    section("Battery bank", [
      ["System voltage", `${bom.voltage.volts} V \u2014 ${bom.voltage.rationale}`],
      bom.battery.diy
        ? ["DIY build", `${bom.battery.diy.unitLabel} \u00D7 ${bom.battery.diy.stringsParallel} parallel string(s) = ${bom.battery.diy.blocksTotal} cells`]
        : null,
      bom.battery.retail
        ? ["Prebuilt alternative", `${bom.battery.retail.modules} \u00D7 ${bom.battery.retail.unitLabel}`]
        : null,
      ["Nameplate target", `~${fmt(f.battNameplateKwh)} kWh at ${(bom.battery.usableDod * 100).toFixed(0)}% usable depth of discharge`],
    ].filter(Boolean));
  } else {
    section("Battery bank", [
      ["Storage", "None (Solar-only configuration \u2014 direct consumption + grid export)"],
    ]);
  }
  section("Inverter", [
    ["Your peak demand", `~${fmt(bom.inverter.peakLoadKw)} kW at once`],
    ["Suggested class", `${bom.inverter.recommendedKw} kW continuous minimum`],
    ["Reference unit (only an example)", bom.inverter.referenceUnit],
    ["Surge rule", bom.inverter.surgeNote],
  ]);
  if (bom.controller) {
    section("Charge controller & protection", [
      ["Controller capacity", `${bom.controller.ampsRequired} A total \u2014 ${bom.controller.suggestion}`],
      ["Controller note", bom.controller.note],
      ["Main battery fuse/breaker", `${bom.protection.mainFuseAmps} A (bank can pull ~${bom.protection.batteryDischargeAmps} A at full load)`],
      ["PV disconnect", `${bom.protection.pvBreakerAmps} A`],
    ]);
  }
  if (bom.cable) {
    section("Battery-to-inverter cable (copper)", bom.cable.map((c) =>
      [`${c.meters} m run`, c.mm2 ? `${c.awg} (${c.mm2} mm\u00B2) or larger` : `larger than ${c.awg} \u2014 shorten the run`] ));
  }
  if (bom.notes.length) {
    body.appendChild(el("p", { style: "font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem;line-height:1.5;" }, bom.notes.join(" ")));
  }
}

function csvField(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function downloadBomCsv() {
  const bom = buildFocusBom();
  // Label row describes the SELECTED system the BOM was built from — never
  // the default focus when the visitor adopted or picked another system.
  const f = (lastPayload && resolveSelected(lastPayload)) || (lastPayload && lastPayload.focus);
  if (!bom || !f) return;
  const rows = [
    ["BigEnergyCo hardware list - educational estimate, not a quote"],
    ["Generated", new Date().toISOString().slice(0, 10)],
    ["System", `${f.pvKw || 0} kW PV + ${f.battNameplateKwh || 0} kWh nameplate (${bom.chemLabel || "Solar"})`],
    ["Location", `${lastPayload.meta.latitude.toFixed(2)}, ${lastPayload.meta.longitude.toFixed(2)}`],
    [],
    ["Section", "Item", "Quantity / size", "Notes"],
  ];
  if (bom.panels) {
    rows.push(["Panels", `${bom.panels.panelWatts} W mono panels`, bom.panels.count, `${bom.panels.kwActual} kW array, about ${bom.panels.areaM2} sq m`]);
  } else {
    rows.push(["Panels", "None", 0, "Battery-only configuration"]);
  }
  if (bom.voltage && bom.battery) {
    rows.push(
      ["Bank", "System voltage", `${bom.voltage.volts} V`, bom.voltage.rationale],
      ["Bank (DIY)", bom.battery.diy.unitLabel, `${bom.battery.diy.stringsParallel} string(s), ${bom.battery.diy.blocksTotal} cells`, `${bom.battery.diy.stringKwh} kWh per string`],
      ["Bank (retail alt.)", bom.battery.retail.unitLabel, bom.battery.retail.modules, "BMS and enclosure included"],
    );
  } else {
    rows.push(["Bank", "None", 0, "Solar-only configuration"]);
  }
  rows.push(
    ["Inverter", `${bom.inverter.recommendedKw} kW class continuous`, 1, bom.inverter.referenceUnit],
  );
  if (bom.controller) {
    rows.push(
      ["Charging", `MPPT controller capacity`, `${bom.controller.ampsRequired} A total`, bom.controller.suggestion],
      ["Protection", "Main battery fuse/breaker", `${bom.protection.mainFuseAmps} A`, `bank draws ~${bom.protection.batteryDischargeAmps} A at full load`],
      ["Protection", "PV disconnect/breaker", `${bom.protection.pvBreakerAmps} A`, ""],
    );
  }
  if (bom.cable) {
    for (const c of bom.cable) {
      rows.push(["Cable", `Battery-to-inverter run ${c.meters} m`, c.mm2 ? `${c.awg} (${c.mm2} sq mm) copper` : `larger than ${c.awg}`, "2% max drop, conservative ampacity"]);
    }
  }
  rows.push([], ["Disclaimer", "Educational estimate only. Verify everything with a licensed electrician or engineer before purchasing or energizing."]);
  const csv = "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url;
  aEl.download = "bigenergyco-parts-list.csv";
  document.body.appendChild(aEl);
  aEl.click();
  aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  setStatus(" Parts list downloaded \u2014 take it to your supplier or electrician as a starting point.");
}

// ── Generator fuel helper ────────────────────────────────────────────────────

// Typical partial-load fuel burn for small gensets (fuel cost only), in the
// site's native L/kWh and in US gallons/kWh. The input unit follows the
// selected location: US / Hawaii / Alaska buy fuel by the gallon, everywhere
// else by the litre, and the price is entered in the SAME currency the
// results display, not hard-coded dollars.
const GEN_L_PER_KWH = { petrol: 0.5, diesel: 0.35 };
const LITRES_PER_GALLON = 3.785411784;
const GEN_GAL_PER_KWH = {
  petrol: GEN_L_PER_KWH.petrol / LITRES_PER_GALLON,
  diesel: GEN_L_PER_KWH.diesel / LITRES_PER_GALLON,
};
// The parts of the world that sell fuel by the gallon (the US plus its
// outlying states); everything else is metric.
const IMPERIAL_BOXES = [
  [24, 50, -125, -66],        // US mainland
  [18.5, 28.5, -179, -154],   // Hawaii
  [50.5, 72, -168, -129],     // Alaska
];
let fuelImperial = false;

function usesImperialUnits() {
  const lat = parseFloat($("latInput")?.value);
  const lon = parseFloat($("lonInput")?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return IMPERIAL_BOXES.some(([latMin, latMax, lonMin, lonMax]) =>
    lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax);
}

// Fuel price -> effective USD cost per kWh. The user types a local-currency
// price (the same unit the results use); this converts to USD, and also
// converts volume liters <-> gallons when the country buys by the gallon.
function genRateUsd() {
  const type = $("genFuelType")?.value || "petrol";
  const local = parseFloat($("genFuelPrice")?.value);
  if (!(local > 0)) return null;
  const fx = fxActive();
  const priceUsd = fx && fx.rate ? local / fx.rate : local;   // local -> USD
  const perKwh = fuelImperial
    ? GEN_GAL_PER_KWH[type] ?? GEN_GAL_PER_KWH.petrol
    : GEN_L_PER_KWH[type] ?? GEN_L_PER_KWH.petrol;
  return priceUsd * perKwh;
}

// Reflect the selected location + currency onto the helper's labels: the unit
// word (liter/gallon), the money symbol, an example placeholder, and the
// footnote's litres/gallons-per-kWh numbers.
function updateFuelUnits() {
  const newImp = usesImperialUnits();
  const changed = newImp !== fuelImperial;
  fuelImperial = newImp;
  const fx = fxActive();
  const sym = fx ? (CURRENCIES[fx.code]?.symbol || fx.code) : "$";
  const label = document.querySelector('label[for="genFuelPrice"]');
  if (label) label.textContent = `${t(fuelImperial ? "fuelGalLabel" : "fuelLitLabel")} (${sym}):`;
  const input = $("genFuelPrice");
  if (input) input.placeholder = fuelImperial ? "e.g. 3.90" : "e.g. 1.20";
  for (const id of ["genBurnUnit", "genBurnUnit2"]) {
    const ue = $(id);
    if (ue) ue.textContent = fuelImperial ? "gal" : "L";
  }
  const petrolEl = $("genPetrolBurn");
  if (petrolEl) petrolEl.textContent = fuelImperial ? "0.13" : "0.5";
  const dieselEl = $("genDieselBurn");
  if (dieselEl) dieselEl.textContent = fuelImperial ? "0.09" : "0.35";
  if (changed) updateGenHelper();
}

function updateGenHelper() {
  updateFuelUnits();
  const readout = $("genReadout");
  const applyBtn = $("btnApplyGenRate");
  if (!readout || !applyBtn) return;
  const rate = genRateUsd();
  if (rate === null) {
    readout.style.display = "none";
    applyBtn.style.display = "none";
    return;
  }
  const typeSel = $("genFuelType").value === "diesel" ? "Diesel" : "Petrol";
  const entry = $("genFuelPrice").value;
  const burn = fuelImperial
    ? GEN_GAL_PER_KWH[$("genFuelType").value] ?? GEN_GAL_PER_KWH.petrol
    : GEN_L_PER_KWH[$("genFuelType").value] ?? GEN_L_PER_KWH.petrol;
  const unit = fuelImperial ? "gal" : "L";
  readout.textContent =
    t("fuelReadoutRate", { type: typeSel, rate: localRate(rate) }) + " " +
    t("fuelReadoutBurn", { entry, burn: burn.toFixed(2), unit }) + " " +
    t("fuelReadoutGrid", { lo: localRate(0.1), hi: localRate(0.3) });
  readout.style.display = "block";
  applyBtn.style.display = "inline-flex";
}

function applyGenRate() {
  const rate = genRateUsd();
  if (rate === null || !$("customRateVal")) return;
  const fx = fxActive();
  const display = fx && fx.rate ? +(rate * fx.rate).toFixed(4) : +rate.toFixed(4);
  $("customRateVal").value = String(display);
  generatorBasis = true;
  tariffTouched = true;
  syncBillSlider();
  if (lastPayload) scheduleRun(true);
  setStatus(t("fuelApplyOk", { rate: money(rate) }));
}

function renderMoneyBar(p) {

  const moneyBar = $("moneyBar");

  if (!moneyBar) return;

  if (!p.annualGridSpendUsd || !p.tariff) {

    moneyBar.style.display = "none";

    return;

  }

  moneyBar.style.display = "block";

  moneyBar.textContent = p.mode === "gridtie"

    ? t("tariffSpendLine", { tariff: localRate(p.tariff), annual: money(p.annualGridSpendUsd) })

    : t("tariffSpendOffgrid", { tariff: localRate(p.tariff), annual: money(p.annualGridSpendUsd) });

}

function renderTierCards(p) {

  const grid = $("tierResults");

  grid.innerHTML = "";

  for (const t of p.tiers) {

    const isSelected = selectedKey === "tier:" + t.id;

    const card = el("div", {
      class: "bom-card" + (t.solvable ? " card-selectable" : "") + (isSelected ? " bom-card-selected" : "")
    });

    if (t.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = "tier:" + t.id;
        refreshSelectionOutputs(p);
        renderTierCards(p);
      };
      card.addEventListener("click", selectCard);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard();
        }
      });
    }

    card.style.borderColor = isSelected
      ? "var(--primary-accent)"
      : (t.id === "tier100" ? "var(--border-glow)" : "var(--border-card)");

    card.appendChild(el("div", { class: "bom-badge" },

      t.id === "tier100" ? "No generator" : t.id === "tier99" ? "Rare generator" : "Generator OK"));

    card.appendChild(el("h3", {}, t.label.split("-")[1]?.trim() || t.label));

    if (!t.solvable) {

      card.appendChild(el("p", {}, "No system found within search limits for this load - the daily consumption may be too high for a practical off-grid build at this site."));

      grid.appendChild(card);

      continue;

    }

    const rows = [

      ["Solar array", `${t.pvKw} kW`],

      ["Battery (usable)", `${fmt(t.battKwh)} kWh - ~${fmt(t.battNameplateKwh)} nameplate`],

      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],

      ["  - panels + inverter", `~${moneyRange(t.pvCostLo, t.pvCostHi)}`],

      ["  - battery bank", `~${moneyRange(t.battCostLo, t.battCostHi)}`],

      ["  - battery unit price", `~${localRate(t.battPerKwhLo)}-${localRate(t.battPerKwhHi)}/kWh stored`],

      ["Unmet hours", `${fmt(t.unmetHoursPerYear)} h/yr`],

      ["Longest gap", `${fmt(t.longestGapHours)} h`],

      ["Battery life est.", fmtLife(t.batteryLifeYears)],

      [`Cycles on the bank`, `~${fmt(t.cyclesPerYear)}/yr`],

    ];

    const footTier = footprintText(t.pvKw);

    if (footTier) rows.splice(2, 0, ["Footprint", footTier]);

    if (t.paybackYearsLo !== null && t.paybackYearsHi !== null) {

      rows.push(["Pays back its first cost in", fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi)]);

    }

    if (typeof t.trueBreakEvenYear === "number" || (t.trueBreakEvenYear === null && t.replacementsHorizon > 0)) {

      rows.push(["Breaks even on true 20-yr cost", typeof t.trueBreakEvenYear === "number"

        ? `\u2248 year ${t.trueBreakEvenYear} (every swap counted)`

        : "never \u2014 swaps outpace savings"]);

    }

    if (Number.isFinite(t.lcoeUsdPerKwh)) {
      rows.push(["Your power cost", energyRate(t.lcoeUsdPerKwh) + gridRate(p.tariff)]);
    }

    if (t.replacementsHorizon > 0) {

      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`]);

    }

    rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);

    pushSeriesBreakdown(rows, t);

    appendRows(card, rows);

    if (t.bestPriceCallout) {
      card.appendChild(el("div", { class: "best-price-callout" }, `💡 ${t.bestPriceCallout}`));
    }

    card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },

      "Battery + panel component estimate only; excludes inverter, BOS, freight, labor."));

    grid.appendChild(card);

  }

}

function renderTargetCards(p, extraTargets = []) {

  const grid = $("tierResults");

  grid.innerHTML = "";

  for (const t of (p.targets || []).concat(extraTargets)) {

    const isCustom = t.id === "custom";

    const targetKey = isCustom ? "custom" : "target:" + t.id;

    const isSelected = selectedKey === targetKey;

    const card = el("div", {
      class: "bom-card" + (t.solvable ? " card-selectable" : "") + (isSelected ? " bom-card-selected" : "")
    });

    if (t.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = targetKey;
        refreshSelectionOutputs(p);
        renderTargetCards(p, extraTargets);
      };
      card.addEventListener("click", selectCard);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCard();
        }
      });
    }

    card.style.borderColor = isSelected
      ? "var(--primary-accent)"
      : ((isCustom || t.id === "cut80") ? "var(--border-glow)" : "var(--border-card)");

    card.appendChild(el("div", { class: "bom-badge" }, t.solvable

      ? (isCustom ? `Your target \u2014 bill -${t.cutPct}%` : `Bill -${t.cutPct}%`)

      : "Not reachable"));

    card.appendChild(el("h3", {}, isCustom ? `Your ~${Math.round((t.minFraction || 1) * 100)}% target` : t.label));

    if (!t.solvable) {

      card.appendChild(el("p", {}, "Even a large array can't cut the bill this far at this location - check the off-grid sizer instead."));

      grid.appendChild(card);

      continue;

    }

    const rows = [

      ["Solar array", `${t.pvKw} kW`],

      ["Battery (usable)", t.battKwh > 0 ? `${fmt(t.battKwh)} kWh - ~${fmt(t.battNameplateKwh)} nameplate` : "none needed"],

      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],

      ["Bill after solar", t.billAfterMonthlyUsd !== null ? `~${money(t.billAfterMonthlyUsd)}/mo (was ~${money(Math.round(p.annualGridSpendUsd / 12))})` : "needs your tariff"],

      ["Imported from grid", `${fmt(t.importedKwhPerYear)} kWh/yr`],

    ];

    const footTarget = t.pvKw > 0 ? footprintText(t.pvKw) : null;

    if (footTarget) rows.splice(2, 0, ["Footprint", footTarget]);

    const exportActive = t.exportValueAnnualUsd > 0;

    if (exportActive) {

      rows.push(["Feed-in credit on clipped sun", `+${money(t.exportValueAnnualUsd)}/yr (${fmt(t.clippedKwhPerYear)} kWh clipped)`]);

    } else if (t.clippedKwhPerYear > 50) {

      rows.push(["Sun clipped (no export)", `${fmt(t.clippedKwhPerYear)} kWh/yr - enter a feed-in credit to value it`]);

    }

    if (t.paybackYearsLo !== null && t.paybackYearsHi !== null) {

      rows.push(["Pays back its first cost in", fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) + (exportActive ? " incl. feed-in" : "")]);

    }

    if (t.battKwh > 0 && (typeof t.trueBreakEvenYear === "number" || (t.trueBreakEvenYear === null && t.replacementsHorizon > 0))) {

      rows.push(["Breaks even on true 20-yr cost", typeof t.trueBreakEvenYear === "number"

        ? `\u2248 year ${t.trueBreakEvenYear} (every swap counted)`

        : "never \u2014 swaps outpace savings"]);

    }

    if (Number.isFinite(t.lcoeUsdPerKwh)) {
      rows.push(["Your power cost", energyRate(t.lcoeUsdPerKwh) + gridRate(p.tariff)]);
    }

    if (t.replacementsHorizon > 0 && t.battKwh > 0) {

      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`]);

    }

    if (t.battKwh > 0) {

      rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);

    }

    pushSeriesBreakdown(rows, t);

    appendRows(card, rows);

    if (t.bestPriceCallout) {
      card.appendChild(el("div", { class: "best-price-callout" }, `💡 ${t.bestPriceCallout}`));
    }

    card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },

      "Simulated hour-by-hour across five years of real weather. The system never exports; surplus beyond storage is clipped."));

    grid.appendChild(card);

  }

}

function appendRows(card, rows) {
  for (const [k, v] of rows) {
    const danger = typeof v === "string" && v.startsWith("never");
    const accent = /^(Cost|Total|Pays|Your power|Bill|Battery swaps)/.test(k) && !danger;
    const line = el("div", { style: "display:flex;justify-content:space-between;font-size:0.9rem;padding:0.2rem 0;border-bottom:1px solid var(--border-card);" });
    line.appendChild(el("span", { style: "color:var(--text-muted);" }, k));
    const valSpan = el("span", { style: "font-family:var(--font-mono);font-weight:700;" });
    if (accent && typeof v === "string") {
      const parts = v.split(/(\d[\d,\.]*)/g);
      for (const part of parts) {
        if (/^\d/.test(part)) {
          valSpan.appendChild(el("span", { style: "color:var(--primary-accent);font-weight:800;" }, part));
        } else if (part) {
          valSpan.appendChild(document.createTextNode(part));
        }
      }
    } else {
      valSpan.textContent = v;
      valSpan.style.color = danger ? "var(--danger-red)" : accent ? "var(--primary-accent)" : "var(--text-main)";
    }
    line.appendChild(valSpan);
    card.appendChild(line);
  }
}/**
 * Cumulative 20-year cost chart — the headline money story, drawn as three
 * running sums for the recommended system:
 *   - amber line:   cumulative grid spend if you had stayed on the grid
 *   - emerald line: cumulative cost of the SYSTEM alone (capex + first labor
 *                   + every swap) — it ends exactly on the recommendation's
 *                   "Total 20-year cost" figure, so chart and card agree.
 *   - slate line:   the residual grid cost (the bills you still pay, net of
 *                   the feed-in credit on surplus) — it goes NEGATIVE under
 *                   net metering, when the credit out-earns the bill.
 * The amber figure is a literal STACK — emerald system cost, then the residual
 * bills that remain after solar (the slate wedge), then your saving — so the
 * emerald figure is visibly a slice of the amber total: 25K system + 50K bills
 * + 25K saving = 100K grid, never additive on top of it. Red fills the region
 * where the amber total sits BELOW the with-solar stack (before break-even).
 * A lower panel plots the running difference (grid - solar) as bars — red
 * while the capex is not yet repaid, then growing green bars to the final
 * 20-year total, and a bold HTML callout above the chart carries the
 * headline number (solar-served kWh lives there too).
 */
function drawCumCostChart(p, chosenEntry = null) {
  const wrap = $("cumCostChartWrap");
  const canvas = $("cumCostCanvas");
  if (!wrap || !canvas) return;

  // Pick the system the chart talks about: the selected one, else the
  // recommended one, else the focus system, else the first solvable entry.
  const pool = (p.auto && p.auto.length) ? p.auto
    : (p.targets && p.targets.length) ? p.targets
    : (p.tiers || []);
  // The chart follows the selected system when one is chosen and it carries a
  // comparable series (matrix cells, custom cuts and adopted curve points all
  // do); otherwise fall back to the recommendation logic.
  const entry = (chosenEntry && chosenEntry.cumCostSeries && chosenEntry.cumCostSeries.grid && chosenEntry.cumCostSeries.grid.length)
    ? chosenEntry
    : (p.best || (p.focus && pool.find((x) => x &&
        x.chemistry === p.focus.chemistry && x.pvKw === p.focus.pvKw && x.battKwh === p.focus.battKwh)) ||
      (pool || []).find((x) => x && x.solvable) || null);
  const seriesEntry = entry?.cumCostSeries?.grid?.length && entry?.cumCostSeries?.solar?.length
    ? entry
    : null;
  const series = seriesEntry?.cumCostSeries || null;
  const panel = savingsPanelState(series, p.tariff);
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
    if (leg) { leg.style.display = "none"; leg.textContent = ""; }
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
  const W = Math.max(200, Math.min(wrap.clientWidth || 320, (typeof window !== "undefined" && window.innerWidth ? window.innerWidth - 48 : 640)));
  const COST_H = 280, SAVE_H = 150, GAP = 14;
  const H = COST_H + GAP + SAVE_H;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const padL = 62, padR = 58, padT = 26, padB = 24;
  const plotW = W - padL - padR, plotH = COST_H - padT - padB;
  const nY = series.years || series.grid.length;
  const hasSystem = Array.isArray(series.system) && series.system.length === nY;
  // Residual grid cost (slate line): the running width of the bills wedge,
  // solar − system. On grid-tie it is the money still handed to the utility
  // each year net of the feed-in credit; when net metering makes the credit
  // out-earn the bill, the line (and its 20-year total) goes negative, so
  // the axis gains a little headroom below $0 to show it.
  const residLine = hasSystem ? series.solar.map((s, i) => s - series.system[i]) : null;
  const residEnd = residLine ? residLine[nY - 1] : null;
  const residAnnual = residLine && nY > 1 ? residLine[nY - 1] - residLine[nY - 2] : 0;
  const residShown = !!(residLine && seriesEntry &&
    typeof seriesEntry.importedKwhPerYear === "number" && residAnnual !== 0);
  const maxCost = Math.max(series.grid[nY - 1] || 0, series.solar[nY - 1] || 0,
    residShown ? residEnd : 0, 1);
  const minCost = residShown ? Math.min(0, ...residLine) : 0;
  const bd = seriesBreakdown(series) || {};
  const X = (i) => padL + (i / (nY - 1)) * plotW;
  const Y = (v) => padT + (1 - (v - minCost) / (maxCost - minCost)) * plotH;

  // ── headline callout (HTML, above the canvas) ────────────────────────
  const diff = series.grid.map((g, i) => g - series.solar[i]);
  let beIdx = -1;
  for (let i = 0; i < nY; i++) {
    if (series.grid[i] >= series.solar[i]) { beIdx = i; break; }
  }
  const totalSaved = diff[nY - 1] || 0;
  const servedKwh = seriesEntry.servedKwhPerYear || 0;
  const box = $("cumSavingsBox"), num = $("cumSavingsTotal"), sub = $("cumSavingsSub");
  if (box && num && sub) {
    box.style.display = "block";
    if (totalSaved > 0) {
      num.textContent = `+~${money(totalSaved)} saved over 20 years`;
      num.style.color = "var(--primary-accent)";
      const kwhBits = servedKwh > 0
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
    const v = maxCost * k / 4;
    const y = Y(v);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = "#6b7280"; ctx.textAlign = "right";
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
    series.grid[i] >= series.solar[i] ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.22)");

  // break-even marker: dashed vertical + label to the RIGHT at mid-height,
  // clear of the curve and the axis labels
  if (beIdx >= 0) {
    const beVal = series.solar[beIdx];
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.beginPath(); ctx.moveTo(X(beIdx), padT); ctx.lineTo(X(beIdx), padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e5e7eb"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "left";
    const beLblX = Math.min(X(beIdx) + 6, W - padR - 84);
    ctx.fillText(`break-even yr ${beIdx + 1}`, beLblX, padT + plotH * 0.30);
    ctx.beginPath(); ctx.arc(X(beIdx), Y(beVal), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f9fafb"; ctx.fill();
  }

  // the two lines: amber = grid, emerald = the system alone (ends on the
  // recommendation's total)
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fbbf24";
  ctx.beginPath();
  for (let i = 0; i < nY; i++) { const y = Y(series.grid[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }
  ctx.stroke();
  if (hasSystem) {
    ctx.strokeStyle = "#34d399";
    ctx.beginPath();
    for (let i = 0; i < nY; i++) { const y = Y(series.system[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }
    ctx.stroke();
  }
  // Residual grid cost: slate, thinner. Normally it rides low (the bills that
  // remain accumulate toward their 20-year total); under net metering — when
  // the feed-in credit out-earns the bill — it runs below the $0 line.
  if (residShown && residLine) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < nY; i++) { const y = Y(residLine[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }
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
        style: "display:inline-block;width:22px;height:10px;margin-inline-end:7px;vertical-align:middle;position:relative;",
        "aria-hidden": "true",
      });
      box.appendChild(el("span", {
        style: `position:absolute;top:4px;left:0;width:22px;height:2.5px;background:${color};border-radius:2px;`,
      }));
      return box;
    };
    const rows = [
      ["#fbbf24", `Grid without solar: ${money(series.grid[nY - 1])}`],
    ];
    if (hasSystem) rows.push(["#34d399", `Solar system: ${money(series.system[nY - 1])}`]);
    if (residShown && residEnd !== null) {
      rows.push(["#94a3b8", residEnd >= 0
        ? `Residual grid cost after feed-in: ${money(residEnd)}`
        : `Residual grid cost after feed-in: \u2212${money(-residEnd)} (net-metering credit)`]);
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
  const sTop = COST_H + GAP + 10, sPadT = 16, sPadB = 6;
  const sH = SAVE_H - sPadT - sPadB - 16; // 16px reserved for the year labels
  const dMin = Math.min(...diff, 0), dMax = Math.max(...diff, 1);
  // headroom above the tallest bar: keeps the total label and the panel
  // title on separate rows instead of colliding
  const sTop2 = dMax + (dMax - dMin) * 0.12;
  const D = (v) => sTop + sPadT + (1 - (v - dMin) / (sTop2 - dMin || 1)) * sH;
  const zeroY = D(0);

  // zero baseline
  ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(W - padR, zeroY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "right";
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
  ctx.fillStyle = "#9ca3af"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "left";
  ctx.fillText("your pocket, year by year", padL + 2, sTop + 9);
  ctx.textAlign = "right";
  ctx.fillStyle = "#34d399"; ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillText(`+${money(dMax)}`, W - padR - 4, D(dMax) - 8);

  // break-even tick rides just ABOVE the zero line — the early years have
  // empty space there (their bars sit below zero), so nothing collides
  if (beIdx >= 0) {
    ctx.fillStyle = "#e5e7eb"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(`\u25B2 yr ${beIdx + 1}`, Math.max(padL + 16, X(beIdx)), zeroY - 8);
  }

  // x labels: years 1..20 (every 2nd to avoid clutter), shared bottom axis
  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";
  for (let y = 0; y < nY; y += 2) {
    ctx.fillText(String(y + 1), X(y), H - 4);
  }

  // caption
  const label = seriesEntry.chemLabel || seriesEntry.label || "";
  const cap = $("cumCostCaption");
  if (cap) {
    const isBest = !!p.best && seriesEntry.chemistry === p.best.chemistry &&
      seriesEntry.pvKw === p.best.pvKw && seriesEntry.battKwh === p.best.battKwh;
    let txt = `Running 20-year cost for the ${isBest ? "recommended" : "selected"} system (${label}): the amber line is what you` +
      ` pay the utility if you stay on the grid (${money(bd.gridTotal)}). The emerald line is the solar system's` +
      ` own cost (~${money(bd.systemTotal)}), matching the \u201CTotal 20-year cost\u201D row for this system.` +
      (bd.residualBills !== null && bd.residualBills < 0
        ? ` The with-solar total (${bd.withSolar < 0 ? `~\u2212${money(-bd.withSolar)}` : `~${money(bd.withSolar)}`}) sits BELOW` +
          ` the system's own cost: your feed-in credit on surplus out-earns the small bill that remains, so the` +
          ` stack runs negative and the utility owes you ~${money(-bd.residualBills)} in the 20-year picture.`
        : ` The amber figure is a stack — the system, then the smaller bills that remain after solar (~${money(bd.residualBills)}),` +
          ` then your saving — so the gap between amber and emerald at year 20 (${money(bd.saved)}) is what the` +
          ` system puts back in your pocket.`);
    if (beIdx >= 0) {
      const saved = (series.grid[nY - 1] || 0) - (series.solar[nY - 1] || 0);
      txt += ` The system has repaid its cost by year ${beIdx + 1} \u2014 every year after puts ~${money(Math.round(saved / (nY - beIdx)))} back in your pocket. ` +
        `Total saving over 20 years: ~${money(saved)}. The lower bars are your running net position: red until break-even, then climbing.`;
    } else {
      txt += ` Within 20 years the system never repays its cost \u2014 battery replacements outpace bill savings, so the honest answer is: it does not pay for itself here.`;
    }
    if (residShown) {
      const kwh = seriesEntry.importedKwhPerYear || 0;
      txt += residEnd >= 0
        ? ` The slate line is the residual grid cost itself — about ${money(residAnnual)}/yr for the ${fmt(kwh)}` +
          ` kWh/yr still drawn from the grid (net of your feed-in credit), ${money(residEnd)} over the full 20 years.`
        : ` The slate line runs below $0 — net metering: the feed-in value of your surplus exceeds` +
          (kwh > 0 ? ` even the small ${fmt(kwh)} kWh/yr you still draw` : ` the tiny bill you still pay`) +
          `, so you earn ~${money(-residEnd)} over the full 20 years.`;
    }
    cap.textContent = txt;
  }
}

/**
 * AUTO-comparison chart: one panel, each bank drawn against ITS OWN
 * nameplate. Same-job systems deliver similar energy, so the honest visual
 * difference is the reserve each chemistry must carry: lead-acid's entire
 * working range lives in the bottom half of its hardware; lithium/sodium
 * use nearly all of theirs.
 */
/**
 * SOC reliability chart for ONE selected system: the same daily min/max band
 * machinery as the multi-tier chart, from the entry's nameplate bands.
 */
function drawSocChartForEntry(p, entry) {
  const wrap = $("socChartWrap");
  if (!wrap) return;
  const b = entry && entry.socNameplatePct;
  if (!b || !b.min || !b.min.length) { wrap.style.display = "none"; return; }
  const days = b.min.length;
  let emptyDays = 0, fullDays = 0, minPct = 100;
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
    emptyDays, fullDays, totalDays: days,
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

function drawAutoChart(p) {

  const wrap = $("socChartWrap");

  const canvas = $("socCanvas");

  const legend = $("socLegend");

  if (!wrap || !canvas) return;

  const raw = p.auto || [];

  if (!raw.length) { wrap.style.display = "none"; return; }

  const entries = raw.filter((a) => a.solvable && a.socNameplatePct && a.socNameplatePct.min && a.socNameplatePct.min.length);

  if (!entries.length) {
    wrap.style.display = "none";
    return;
  }

  cachedChartState = { type: "auto", p };

  wrap.style.display = "block";

  const dpr = window.devicePixelRatio || 1;

  const W = Math.max(200, Math.min(wrap.clientWidth || 320, (typeof window !== "undefined" && window.innerWidth ? window.innerWidth - 48 : 640)));

  const n = entries[0].socNameplatePct.min.length;

  const zStart = (socZoomRange && Number.isFinite(socZoomRange.start)) ? Math.max(0, Math.min(n - 2, socZoomRange.start)) : 0;

  const zEnd = (socZoomRange && Number.isFinite(socZoomRange.end)) ? Math.max(zStart + 1, Math.min(n - 1, socZoomRange.end)) : n - 1;

  const visibleDays = Math.max(1, zEnd - zStart);

  const pv = (p.history && Array.isArray(p.history.pvDaily) && p.history.pvDaily.length === n) ? p.history.pvDaily : null;

  const stripH = pv ? 64 : 0, stripGap = pv ? 8 : 0;

  const H = 300 + stripH + stripGap;

  canvas.width = Math.round(W * dpr);

  canvas.height = Math.round(H * dpr);

  canvas.style.width = "100%";

  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 46, padR = 12, padT = 16, padB = 22;

  const plotW = W - padL - padR, plotH = H - stripH - stripGap - padT - padB;

  const yMax = 100;

  const panelTop = stripH + stripGap;

  const X = (i) => padL + ((i - zStart) / visibleDays) * plotW;

  const Y = (pct) => panelTop + padT + (1 - pct / yMax) * plotH;

  // frame + gridlines

  ctx.font = "10px ui-monospace, monospace";

  for (const v of [0, 20, 50, 75, 100]) {

    ctx.strokeStyle = "rgba(255,255,255,0.08)";

    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();

    ctx.fillStyle = "#6b7280"; ctx.textAlign = "right";

    ctx.fillText(v + "%", padL - 6, Y(v) + 3);

  }

  // Reserve shading to make LFP/Na advantage obvious
  ctx.fillStyle = "rgba(100,100,100,0.08)";
  ctx.fillRect(padL, Y(20), plotW, Y(0) - Y(20));
  ctx.fillStyle = "rgba(239,68,68,0.06)";
  ctx.fillRect(padL, Y(50), plotW, Y(20) - Y(50));
  ctx.save();

  ctx.translate(11, panelTop + padT + plotH / 2); ctx.rotate(-Math.PI / 2);

  ctx.textAlign = "center"; ctx.fillStyle = "#9ca3af";

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

    ctx.globalAlpha = 0.2; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;

    // Dashed FULL mark: this bank's own ceiling as % of its nameplate.

    const fullPct = Math.max(...max);

    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.5; ctx.setLineDash([2, 4]);

    ctx.beginPath(); ctx.moveTo(padL, Y(fullPct)); ctx.lineTo(W - padR, Y(fullPct)); ctx.stroke();

    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // Top edge bold: "does it reach its full mark?" must be unmistakable.

    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.95;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) { const y = Y(max[i]); if (i === zStart) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    // Floor edge thin: how deep the nights and bad stretches dig.

    ctx.lineWidth = 1; ctx.globalAlpha = 0.6;

    ctx.beginPath();

    for (let i = zStart; i <= zEnd; i++) { const y = Y(min[i]); if (i === zStart) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    ctx.restore();

    ctx.globalAlpha = 1;

  }

  // x labels: years or day indices

  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";

  if (socZoomRange && visibleDays < 365) {

    const step = Math.max(1, Math.floor(visibleDays / 6));

    for (let d = zStart; d <= zEnd; d += step) {

      const x = X(d);

      ctx.fillText(`Day ${d + 1}`, Math.min(W - padR - 16, Math.max(padL + 16, x)), H - 4);

    }

  } else {

    const span = p.history.endYear - p.history.startYear + 1;

    for (let yy = 0; yy <= span; yy++) {

      const dayIdx = Math.round(yy * 365.25);

      if (dayIdx >= zStart && dayIdx <= zEnd) {

        const x = X(dayIdx);

        ctx.fillText(String(p.history.startYear + yy), Math.min(W - padR, Math.max(padL, x)), H - 4);

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

      const chip = el("span", { style: "display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-main);" });

      chip.appendChild(el("span", { style: `width:10px;height:10px;border-radius:50%;background:${TIER_COLORS[`auto-${a.chemistry}`]};display:inline-block;` }));

      chip.appendChild(el("span", {},

        `${a.chemLabel.replace(/ \(.*\)/, "")} - ${fmt(a.battNameplateKwh)} kWh nameplate` +

        (a.replacementsHorizon > 0 ? ` - ~${a.replacementsHorizon} swaps/20yr` : " - no swaps")));

      legend.appendChild(chip);

    }

  }

  const ceilings = entries

    .map((a) => `${a.chemLabel.replace(/ \(.*\)/, "")} ${Math.round(Math.max(...a.socNameplatePct.max))}%`)

    .join(" - ");

  $("socCaption").textContent =

    `How to read it: the shaded area is each bank's daily range - the bold top edge is the fullest it got, the thin lower edge the deepest it sank, and the dashed line is that bank's FULL mark (${ceilings} of nameplate). ` +

    `Every chemistry carries similar nameplate for the same job; the real difference is usable energy - LFP and Sodium give you 80% usable (20-100%), Lead-Acid only 50% (50-100%), so LFP/Sodium deliver far more kWh per kWh of nameplate and need fewer swaps - lithium and sodium may use ~90% of theirs, lead-acid only its bottom half (the 50% rule, times its discharge-rate derate). ` +

    `Sodium rides standard LFP voltage settings: slightly less capacity, gentler discharge, longer life. ` +

    `Dips to the floor during ${p.history.startYear}-${p.history.endYear}'s worst weather are the moments a generator or the grid would cover you.`;

  if (pv) $("socCaption").textContent += " The amber strip on top is the daily solar harvest (kWh per kW of panel) - its dips line up with every bank's recharge rhythm.";

}

// Must match run.js PAYLOAD_CONTRACT. Mismatch = stale cached module.

const PAYLOAD_CONTRACT = 11;

// -- Plausibility frontier ---------------------------------------------------

// The cards answer "what does this target cost?". This answers "what does any

// budget buy?" - the shape that tells someone whether their goal is easy,

// expensive, or impossible where they live.

// Which curve point the blue dot defaults to when the visitor hasn't clicked
// one: for grid-tie it's the point nearest the bill-cut slider's %, so the
// slider and the highlighted point move together; otherwise the chart falls
// back to its marker (the recommended system).
function frontierDefaultSelection(f) {
  if (!f || !Array.isArray(f.points) || !f.points.length) return undefined;
  const p = lastPayload;
  if (!p) return undefined;
  const sel = resolveSelected(p);
  if (sel && (Number.isFinite(sel.pvKw) || Number.isFinite(sel.battKwh))) {
    let best = 0, bestDist = Infinity;
    f.points.forEach((pt, i) => {
      const dPv = Math.abs((pt.pvKw || 0) - (sel.pvKw || 0));
      const dBatt = Math.abs((pt.battKwh || 0) - (sel.battKwh || 0));
      const dist = dPv * 10 + dBatt;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }
  if (p.mode === "gridtie") {
    const target = Math.min(111, Math.max(1, Math.round(customCutFraction * 100)));
    let best = 0, gap = Infinity;
    f.points.forEach((pt, i) => {
      const g = Math.abs((pt.outcomePct || 0) - target);
      if (g < gap) { gap = g; best = i; }
    });
    return best;
  }
  return undefined;
}

function renderFrontierPanel(p) {

  const wrap = $("frontierWrap");

  if (!wrap) return;

  const f = p.frontier;

  if (!f || !Array.isArray(f.points) || !f.points.length) {

    wrap.style.display = "none";

    return;

  }

  // On a small enough load the smallest buildable system already covers

  // everything, so there is no curve - but "sizing is not your constraint"

  // is the most useful thing this panel can tell that visitor. Say it,

  // rather than silently disappearing.

  const covered = f.reach && f.reach.id === "already-covered";

  if (f.points.length < 2 && !covered) {

    wrap.style.display = "none";

    return;

  }

  // Show the panel BEFORE drawing: the chart is built at the width of its

  // container, and a display:none container measures zero.

  wrap.style.display = "block";

  // One source of truth for the blue dot: the visitor's click wins, but with
  // no click the dot sits on the curve point nearest the bill-cut slider
  // (grid-tie) — so the slider, the matrix "your target" column, and the
  // highlighted curve point always agree.

  const defaultSel = frontierDefaultSelection(f);

  const opts = {

    t, money, tableHost: $("frontierTable"),

    selected: frontierSelected ?? defaultSel,

    // Clicking a point re-renders the panel (chart + table) around that pick.

    onSelect: (i) => {
      frontierSelected = i;
      renderFrontierPanel(lastPayload);
      const p = lastPayload;
      const f = p && p.frontier;
      const pt = f && f.points[i];
      if (!p || !pt) return;
      // INSTANT adoption: the clicked point already carries its full analysis
      // (money story, export economics, 20-yr cumulative series) in the cached
      // payload, so every downstream panel follows it immediately — no engine
      // re-run, no re-render storm, no scroll jump. Only its SOC capture bands
      // arrive a moment later from a tiny background slice.
      adoptedEntry = { ...pt.detail, chemistry: pt.detail.chemistry || f.chemistry };
      selectedKey = "adopted";
      // Unify with the bill-cut slider FIRST (before the selection snapshot):
      // choosing a point on the curve IS choosing your cut %, so the share
      // link and the matrix "your target" label must record the snapped value,
      // not the pre-click one.
      if (p.mode === "gridtie" && Number.isFinite(pt.outcomePct)) {
        const pct = Math.min(111, Math.max(1, Math.round(pt.outcomePct)));
        customCutFraction = pct / 100;
        const slider = $("cutSlider");
        if (slider) slider.value = String(pct);
        syncCutLabel();
      }
      refreshSelectionOutputs(p);
      showSystemModal(p, adoptedEntry, true);
      // Background reconciliation: re-size the matrix's "your target" column
      // for ALL chemistries at the snapped cut (the curve itself only knows
      // one chemistry), and capture the adopted system's SOC bands.
      requestIncrementalCut(adoptedEntry.pvKw, adoptedEntry.battKwh, adoptedEntry.chemistry);
    },

  };

  const drew = renderFrontier($("frontierChart"), f, opts);

  if (!drew && !covered) {

    wrap.style.display = "none";

    return;

  }

  // No curve to show, so hide the chart furniture and let the sentence stand.

  const details = wrap.querySelector("details");

  if (details) details.style.display = drew ? "" : "none";

  const verdict = $("frontierVerdict");

  if (verdict) verdict.textContent = frontierVerdict(f, opts);

  // Only shown when the recommended system really is off a curve that was

  // actually drawn - the note talks about "the curve", so it makes no sense

  // on a load small enough that there is no curve to be off.

  const note = $("frontierNote");

  if (note) {

    const text = drew ? markerOffCurveNote(f, opts) : "";

    note.textContent = text;

    note.style.display = text ? "block" : "none";

  }

}



// Redraw the frontier when the column width changes: the SVG is built at the

// size of its container so labels stay readable, which means a resize needs a

// fresh render rather than a rescale.

let frontierResizeTimer = null;

// Which dot on the frontier is picked. null = follow the recommended system

// (frontier.marker); once the visitor clicks a point this holds the index and

// the blue dot + its readout move to it. Reset on every new sizing run.

let frontierSelected = null;

window.addEventListener("resize", () => {

  if (!lastPayload || !lastPayload.frontier) return;

  clearTimeout(frontierResizeTimer);

  frontierResizeTimer = setTimeout(() => renderFrontierPanel(lastPayload), 180);

});



function renderResults(p) {

  const inp = readInputs();

  lastPayload = p;

  if (selectedKey !== "adopted") {
    adoptedEntry = null;
  }

  frontierSelected = null;   // new result -> blue dot follows the new recommendation

  const isGT = p.mode === "gridtie";

  if (p.contract !== undefined && p.contract !== PAYLOAD_CONTRACT) {

    setStatus("\u26A0\uFE0F This result came from an older engine version \u2014 refresh the page (Ctrl+F5 / \u2318\u21E7R) and run again for complete, current figures.");

  } else {

    setStatus(t("statusSuccess", { years: p.meta.years, dataYears: p.assumptions.dataYears, yield: fmt(p.annualYieldPerKw), offline: p.meta.offline ? t("offlineNote") : "" }));

  }

  // The cut slider (grid-tie only) lives in the results panel.
  const cutRow = $("cutSliderRow");
  if (cutRow) cutRow.style.display = isGT ? "block" : "none";
  syncCutLabel();

  // Validate and preserve selection
  let selValid = false;
  if (selectedKey === "best" && p.best) selValid = true;
  else if (selectedKey === "focus" && p.focusSystem) selValid = true;
  else if (selectedKey === "custom" && ((p.customCut && p.customCut.entries && p.customCut.entries.length) || p.customTarget)) selValid = true;
  else if (selectedKey === "adopted" && adoptedEntry) selValid = true;
  else if (selectedKey.indexOf("matrix:") === 0 && p.matrix && p.matrix.cells && p.matrix.cells[selectedKey.slice(7)] && p.matrix.cells[selectedKey.slice(7)].solvable) selValid = true;
  else if (selectedKey.indexOf("auto:") === 0 && p.auto && p.auto.some((a) => "auto:" + a.chemistry === selectedKey && a.solvable)) selValid = true;
  else if (selectedKey.indexOf("tier:") === 0 && p.tiers && p.tiers.some((t) => "tier:" + t.id === selectedKey && t.solvable)) selValid = true;
  else if (selectedKey.indexOf("target:") === 0 && (p.targets || p.customTarget) &&
    (p.targets || []).concat(p.customTarget ? [p.customTarget] : []).some((t) => "target:" + t.id === selectedKey && t.solvable)) selValid = true;

  if (!selValid) {
    if (p.best) selectedKey = "best";
    else if (p.auto && p.auto.some((a) => a.solvable)) selectedKey = "auto:" + p.auto.find((a) => a.solvable).chemistry;
    else if (p.targets && p.targets.some((t) => t.solvable)) selectedKey = "target:" + (p.targets.find((t) => t.id === "cut80" && t.solvable) || p.targets.find((t) => t.solvable)).id;
    else if (p.tiers && p.tiers.some((t) => t.solvable)) selectedKey = "tier:" + (p.tiers.find((t) => t.id === "tier99" && t.solvable) || p.tiers.find((t) => t.solvable)).id;
    else if (p.customTarget && p.customTarget.solvable) selectedKey = "custom";
    else selectedKey = "best";
  }

  renderSunPath(p.input?.latitude ?? parseFloat($("latInput")?.value));

  renderMoneyBar(p);

  const hasAuto = !!(p.auto && p.auto.length);

  const ladder = $("resultLadder");

  if (ladder) ladder.style.display = (hasAuto && !isGT) ? "flex" : "none";

  const bpWrap = $("bestPickWrap");

  if (bpWrap) bpWrap.innerHTML = "";

  const tierGrid = $("tierResults");

  if (tierGrid) tierGrid.style.display = "grid";

  if (hasAuto) {

    if (isGT) {

      // Grid-tie auto: banner + the full 3×3 matrix (plus the slider's

      // "your target" column) as the main view — no ladder needed.

      renderBestPick(p);

      renderMatrix(p);

    } else {

      syncLadderTabs();

      if (resultLevel === "matrix") renderMatrix(p);

      else if (resultLevel === "compare") renderAutoCards(p);

      else renderBestPick(p);

    }

  }

  else if (isGT) renderTargetCards(p, p.customTarget ? [p.customTarget] : []);

  else renderTierCards(p);

  // A heavy load at a dark site can leave every card "not solvable", which

  // would render as a blank grid. Say why instead of leaving empty space -

  // the frontier below already shows exactly how far this location can get.

  const anySolvable = hasAuto

    ? p.auto.some((a) => a && a.solvable)

    : ((isGT ? p.targets : p.tiers) || []).some((t) => t && t.solvable);

  if (!anySolvable) {

    const box = $("tierResults");

    if (box) {

      box.innerHTML = "";

      box.appendChild(el("div", { class: "no-solvable", style: "grid-column:1/-1;padding:1.1rem;border:1px solid var(--border-card);border-radius:10px;color:var(--text-muted);" }, t("frontierNoSystem")));

    }

  }

  const a = p.assumptions;

  const pr = p.pricing || {};

  $("assumpText").textContent =

    `Data: ${a.source}, hourly ${a.dataYears}. Derates applied: soiling ${(a.derates.soiling * 100).toFixed(0)}%, ` +

    `wiring ${(a.derates.wiring * 100).toFixed(0)}%, mismatch ${(a.derates.mismatch * 100).toFixed(0)}%, ` +

    `MPPT ${(a.derates.mppt * 100).toFixed(0)}%. Cell temperature model: NOCT ${a.noctC}°C, ` +

    `power temperature coefficient ${(a.gammaPerC * 100).toFixed(2)}%/°C. Inverter efficiency ${(a.etaInverter * 100).toFixed(0)}%. ` +

    `Charging blocked below chemistry's cold limit (LFP 0°C). Load basis: ${inp.basis}. ` +

    `Costs span ${pr.basisLabel || "ex-factory China to PowMr-class budget retail"} (${pr.source || "cell market indications through PowMr catalog, Aug 2026"}) - ` +

    `the low end is components before freight/duty/BMS, the high end is shipped retail with BMS and enclosure included. ` +

    (a.money ? a.money + " " : "") +

    (a.capacityNote ? a.capacityNote + " " : "") +

    (fxNote() ? fxNote() + " " : "") +

    (a.offline ? "OFFLINE MODE: this run used the bundled typical-year profile for " + p.meta.offlineCity + " - a close approximation, not your exact site. Re-run online for five years of point-specific weather. " : "") +

    (p.tariff ? `Grid spend assumes ${energyRate(p.tariff)} at ${fmtKwh(p.dailyKwh ?? inp.dailyKwh)} kWh/day.` : "No tariff entered, so payback is not shown.");

  let briefLines;

  if (p.auto && p.auto.length) {

    briefLines = p.auto.filter((t) => t.solvable).map((t) =>

      `- ${t.chemLabel}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~${fmt(t.battNameplateKwh)} kWh nameplate at ${(t.usableDod * 100).toFixed(0)}% DoD), first cost ~${moneyRange(t.costLo, t.costHi)}, ` +

      `${t.replacementsHorizon > 0 ? `${t.replacementsHorizon} bank swaps (+${money(t.swapsAndLaborUsd)} with labor)` : "no swaps expected"} ? true 20-yr cost ~${money(t.lifetimeCostMid)}`);

  } else if (isGT) {

    briefLines = p.targets.filter((t) => t.solvable)

      .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${t.battKwh > 0 ? fmt(t.battKwh) + " kWh usable" : "no battery"} (~${moneyRange(t.costLo, t.costHi)}) ? bill -${t.cutPct}%` +

        (t.billAfterMonthlyUsd !== null ? `, ~${money(t.billAfterMonthlyUsd)}/mo after` : ""));

  } else {

    briefLines = p.tiers.filter((t) => t.solvable)

      .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~${moneyRange(t.costLo, t.costHi)}, ex-factory to budget-retail range)`);

  }

  const recLine =

    p.best && Number.isFinite(p.best.lifetimeCostMid)

      ? `RECOMMENDED (lowest true 20-year cost): ${p.best.chemLabel} - ${p.best.pvKw} kW PV + ${fmt(p.best.battKwh)} kWh usable. Why: ${p.bestReason || "cheapest over the horizon."}\n`

      : "";

  const fr = p.frontier && p.frontier.reach;

  const frontierLine = fr && Number.isFinite(fr.ceilingPct)

    ? `SPEND-vs-COVERAGE CURVE (computed, do not recompute): ceiling ${fr.ceilingPct}% at ~${money(fr.ceilingCostUsd)}` +

      (fr.kneePct !== null ? `; best value stops at ${fr.kneePct}% for ~${money(fr.kneeCostUsd)}` : "") +

      (fr.headCostPerPoint !== null && fr.tailCostPerPoint !== null

        ? `; marginal cost rises from ~${money(fr.headCostPerPoint)} to ~${money(fr.tailCostPerPoint)} per extra percentage point`

        : "") + ".\n"

    : "";

  window.lastSizingBrief =

    `I sized a system with your calculator for ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)}, ` +

    `${inp.dailyKwh.toFixed(1)} kWh/day from ${inp.basis}, ${p.chemistry === "auto" ? "AUTO chemistry comparison" : p.chemistry.toUpperCase()}` +

    `${p.auto && p.auto.length ? ` (${p.autoNote})` : ""}, ` +

    `${isGT ? "staying connected to the grid (no export" + (inp.exportRate ? ", feed-in credit entered)" : ")") : "fully off-grid"}:\n${recLine}${frontierLine}${briefLines.join("\n")}\n` +

    `[ADVISOR INSTRUCTION: These numbers were computed deterministically from NASA POWER hourly weather ` +

    `${p.assumptions.dataYears}. Do not recompute or invent different figures - explain, sanity-check and add caveats ` +

    `(seasonal variation, inverter/BOS costs, installation, degradation) around THESE results. Keep it SHORT: a brief verdict, not an essay.]`;

  $("btnAskAdvisor").style.display = "inline-flex";

  const shareBtn = $("btnShareResult");

  if (shareBtn) shareBtn.style.display = "inline-flex";

  const printBtn = $("btnPrintResult");

  if (printBtn) printBtn.style.display = "inline-flex";

  updateShareHash(p, inp);

  renderFrontierPanel(p);

  refreshSelectionOutputs(p);

}

function sameSystem(a, b) {
  return !!a && !!b && a.chemistry === b.chemistry && a.pvKw === b.pvKw && a.battKwh === b.battKwh;
}

// The banner follows the selection too: when the visitor picks a system that
// is NOT the recommendation (adopted curve point, matrix cell, ladder tab),
// the banner names and prices the selected system instead of silently
// describing a different one than the charts, BOM and blue dot below it.
function renderSelectedBanner(p, sel) {
  const wrap = $("bestPickWrap");
  if (!wrap || !sel || sameSystem(sel, p.best)) return false;
  wrap.innerHTML = "";
  const card = el("div", { class: "bom-card" });
  card.style.borderColor = "var(--secondary-accent, #3b82f6)";
  const title = (sel.pvKw === 0 && sel.battKwh > 0)
    ? `${sel.chemLabel || sel.chemistry}: ${fmt(sel.battKwh)} kWh battery (peak-hour offset)`
    : (sel.battKwh === 0)
      ? `${sel.chemLabel || sel.chemistry}: ${sel.pvKw} kW solar (no battery)`
      : `${sel.chemLabel || sel.chemistry}: ${sel.pvKw} kW solar + ${fmt(sel.battKwh)} kWh battery`;
  card.appendChild(el("div", { class: "bom-badge" }, "Selected system"));
  card.appendChild(el("h3", {}, title));
  appendRows(card, entryDetailRows(p, sel));
  if (p.best) {
    const b = p.best;
    card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },
      `Recommendation stays ${b.chemLabel || b.chemistry} ${b.pvKw} kW + ${fmt(b.battKwh)} kWh (lowest true 20-year cost, ~${money(b.lifetimeCostMid)}).`));
  }
  wrap.appendChild(card);
  return true;
}

// Everything below the run that must follow the SELECTED system (charts,
// hardware list, export figures, share link, print sheet, matrix highlight).
// Called from renderResults on a full run and straight from curve-point/
// matrix-cell clicks so a selection change is instant — all of this data is
// already sitting in the cached payload.
function refreshSelectionOutputs(p) {
  if (!p) return;
  const isGT = p.mode === "gridtie";
  const hasAuto = !!(p.auto && p.auto.length);
  const sel = resolveSelected(p);
  // Banner follows the selection (no-op when the selection IS the best —
  // the recommendation banner from the full render already stands).
  renderSelectedBanner(p, sel);
  // The matrix highlight tracks the selection — but only where the matrix IS
  // the main view (grid-tie auto, or an off-grid auto session on its matrix
  // tab). Card and ladder views keep their own chrome, untouched.
  if (p.matrix && (isGT || resultLevel === "matrix")) renderMatrix(p);
  renderBomPanel();
  if (sel && sel.socNameplatePct && sel.socNameplatePct.min && sel.socNameplatePct.min.length) {
    drawSocChartForEntry(p, sel);
  } else if (hasAuto && !isGT && resultLevel !== "matrix") {
    drawAutoChart(p);
  } else if (!hasAuto && p.history && p.history.tiers && p.history.tiers.length) {
    drawSocChart(p.history, p.chemLabel || "battery");
  } else {
    const w = $("socChartWrap");
    if (w) w.style.display = "none";
  }

  drawCumCostChart(p, sel);
  renderFrontierPanel(p);

  const inp = readInputs();
  updateShareHash(p, inp);
  populatePrintSheet(p, inp);

}

// -- Shareable results -------------------------------------------------------

// Inputs + headline results are encoded into the URL hash. Opening such a

// link restores the form and re-runs the simulation locally (weather data is

// cached per site, and the engine is deterministic, so results reproduce).

function b64urlEncode(obj) {

  const json = JSON.stringify(obj);

  const bytes = new TextEncoder().encode(json);

  let bin = "";

  for (const b of bytes) bin += String.fromCharCode(b);

  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

}

function b64urlDecode(str) {

  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));

  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);

  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));

  return JSON.parse(new TextDecoder().decode(bytes));

}

function updateShareHash(p, inp) {

  try {

    const o = {

      v: 1,

      la: Math.round(inp.latitude * 100) / 100,

      lo: Math.round(inp.longitude * 100) / 100,

      kw: Math.round(inp.dailyKwh * 100) / 100,

      ch: inp.chemistry,

    };

    if (inp.mode === "gridtie") o.g = 1;

    if (inp.hardwareConfig && inp.hardwareConfig !== "both") o.hw = inp.hardwareConfig;

    if (inp.chemistry === "auto") o.a = 1;

    if (inp.chemistry === "auto" && inp.mode !== "gridtie" && $("autoTier")) o.at = $("autoTier").value;

    if (inp.chemistry === "auto" && inp.mode === "gridtie" && $("autoTarget")) o.ag = $("autoTarget").value;

    if (inp.mode === "gridtie") {
      o.cc = inp.customCut;
    }

    if (selectedKey) o.sel = selectedKey;

    // Focus/adopted systems live only in memory — encode the exact hardware
    // so a shared link re-adopts it instead of silently reopening as "best".
    // (Matrix/auto/tier/target/custom selections re-resolve from the payload.)
    if (selectedKey === "adopted" && adoptedEntry) {
      o.fp = adoptedEntry.pvKw; o.fb = adoptedEntry.battKwh; o.fc = adoptedEntry.chemistry;
    } else if (selectedKey === "focus" && p && p.focusSystem) {
      o.fp = p.focusSystem.pvKw; o.fb = p.focusSystem.battKwh; o.fc = p.focusSystem.chemistry;
    }

    if ($("loadMode") && $("loadMode").value === "bill") o.lm = "bill";

    if (inp.tariff) o.tf = inp.tariff;

    if (inp.exportRate) o.xr = inp.exportRate;

    if (p) {
      const sized = p.auto && p.auto.length
        ? p.auto.filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh])
        : p.mode === "gridtie"
          ? (p.targets || []).filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh])
          : (p.tiers || []).filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh]);

      if (sized && sized.length) o.t = sized;
    }

    history.replaceState(null, "", "#s=" + b64urlEncode(o));

  } catch { /* sharing is best-effort; never block a result on it */ }

}

function restoreFromShare() {

  if (!location.hash.startsWith("#s=")) return false;

  let o;

  try { o = b64urlDecode(location.hash.slice(3)); } catch { return false; }

  if (!o || o.v !== 1) return false;

  const lat = parseFloat(o.la), lon = parseFloat(o.lo), kw = parseFloat(o.kw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(kw)) return false;

  locationResolved = true;

  $("coordDetails").open = true;

  setCoords(lat, lon, "Shared result loaded - sunshine data for this location");

  $("loadMode").value = "kwh";

  setLoadPanel();

  if ($("systemGoal")) $("systemGoal").value = o.g === 1 ? "gridtie" : "offgrid";

  $("dailyKwhInput").value = String(kw);

  if (o.a === 1) $("chemSelect").value = "auto";

  else if (o.ch && CHEM_KEYS.has(o.ch)) $("chemSelect").value = o.ch;

  if (o.at && ["tier100", "tier99", "tier95"].includes(o.at) && $("autoTier")) $("autoTier").value = o.at;

  if (o.ag && typeof o.ag === "string" && $("autoTarget")) {
    const valid = ["cut10", "cut15", "cut20", "cut25", "cut30", "cut60", "cut80", "cut95"];
    if (valid.includes(o.ag)) $("autoTarget").value = o.ag;
  }

  if (Number.isFinite(o.cc) && o.cc >= 0.01 && o.cc <= 1.11) {
    customCutFraction = o.cc;
    const cutIn = $("cutSlider");
    if (cutIn) cutIn.value = String(Math.round(o.cc * 100));
    syncCutLabel();
  }

  if (o.hw && ["both", "solar", "battery"].includes(o.hw)) {
    const hwEl = $("hardwareConfig");
    if (hwEl) {
      hwEl.value = o.hw;
      const chemRow = $("chemSelect")?.closest(".form-group");
      if (o.hw === "solar" && chemRow) chemRow.style.opacity = "0.4";
      else if (chemRow) chemRow.style.opacity = "1";
    }
  }

  // An adopted/focus selection re-runs the engine with the EXACT shared
  // hardware (pendingFocus), landing on "focus" — the same system, same
  // charts. Anything else re-resolves from the fresh payload below.
  if ((o.sel === "adopted" || o.sel === "focus") && Number.isFinite(o.fp) && Number.isFinite(o.fb)) {
    pendingFocus = {
      pvKw: o.fp, battKwh: o.fb,
      chemistry: ["naion", "lfp", "agm"].includes(o.fc) ? o.fc : null,
    };
    selectedKey = "focus";
  } else if (typeof o.sel === "string" && /^(best|focus|custom|adopted|matrix:[a-z]+:(cut60|cut80|cut95|cut[0-9]+|custom)|auto:[a-z]+|tier:[a-z0-9]+|target:[a-z0-9]+)$/.test(o.sel)) {
    selectedKey = o.sel;
  }

  if (Number.isFinite(o.xr) && o.xr > 0 && $("exportRate")) {

    const fx = fxActive();

    $("exportRate").value = String(fx ? +(o.xr * fx.rate).toFixed(4) : o.xr);

  }

  if (Number.isFinite(o.tf) && o.tf > 0) {

    tariffTouched = true;

    const cv = $("customRateVal");

    if (cv) {
      const fx = fxActive();
      const display = fx ? o.tf * fx.rate : o.tf;
      cv.value = String(+display.toFixed(4));
    }

  }

  // Bill mode round-trips through the kWh value (appliance checklists cannot
  // be encoded): re-anchor the bill slider from the shared kWh and the rate
  // now in the form, so the basis line still reads "monthly electric bill".
  if (o.lm === "bill" && $("loadMode") && $("billSlider")) {
    $("loadMode").value = "bill";
    setLoadPanel();
    const rate = displayRate();
    if (rate > 0) {
      billAnchorKwh = kw;
      billTouched = false;
      billUserNominal = null;
      syncBillSlider();
    }
  }

  setStatus(" Loaded a shared result - running the simulation for this location…");

  return true;

}

// -- Printable summary -------------------------------------------------------

// One light-themed sheet: inputs, the three systems, money figures, key

// assumptions, and the disclaimer. Everything else is hidden at print time.

function populatePrintSheet(p, inp) {

  const sheet = $("printSheet");

  if (!sheet) return;

  const isGT = p.mode === "gridtie";

  let rows, head, title;

  if (p.auto && p.auto.length) {

    title = `Battery Lifetime Comparison (${isGT ? "Grid-Connected" : "Off-Grid"})`;

    head = "<tr><th>Battery</th><th>Solar</th><th>Bank usable (nameplate)</th><th>First cost</th><th>Swaps in 20 yr</th><th>Swaps + labor</th><th>True 20-yr cost</th><th>True break-even</th></tr>";

    rows = p.auto.filter((t) => t.solvable).map((t) =>

      "<tr><td>" + [

        t.chemLabel + ` (${(t.usableDod * 100).toFixed(0)}% DoD)`,

        `${t.pvKw} kW`,

        `${fmt(t.battKwh)} kWh (~${fmt(t.battNameplateKwh)})`,

        moneyRange(t.costLo, t.costHi),

        t.replacementsHorizon > 0 ? `~${t.replacementsHorizon}x` : "none",

        t.swapsAndLaborUsd > 0 ? `~${money(t.swapsAndLaborUsd)}` : "-",

        `~${money(t.lifetimeCostMid)}`,

        typeof t.trueBreakEvenYear === "number" ? `~ year ${t.trueBreakEvenYear}`

          : t.trueBreakEvenYear === null ? "never"

          : "n/a",

      ].join("</td><td>") + "</td></tr>"

    ).join("");

  } else if (isGT) {

    title = "Grid-Connected Bill-Cutting Estimate";

    head = "<tr><th>Goal</th><th>Solar</th><th>Battery</th><th>Component cost</th><th>Bill cut</th><th>Bill after</th><th>Payback</th></tr>";

    rows = p.targets.filter((t) => t.solvable).map((t) =>

      "<tr><td>" + [

        t.label,

        `${t.pvKw} kW`,

        t.battKwh > 0 ? `${fmt(t.battKwh)} kWh` : "none",

        moneyRange(t.costLo, t.costHi),

        `-${t.cutPct}% bill`,

        t.billAfterMonthlyUsd !== null ? `~${money(t.billAfterMonthlyUsd)}/mo` : "n/a",

        t.paybackYearsLo !== null ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) : "n/a",

      ].join("</td><td>") + "</td></tr>"

    ).join("");

  } else {

    title = "Off-Grid System Estimate";

    head = "<tr><th>System</th><th>Solar</th><th>Battery (usable)</th><th>Component cost</th><th>Payback vs. grid</th><th>Energy cost</th></tr>";

    rows = p.tiers.filter((t) => t.solvable).map((t) =>

      "<tr><td>" + [

        t.label.replace(/-/g, "-"),

        `${t.pvKw} kW`,

        `${fmt(t.battKwh)} kWh`,

        moneyRange(t.costLo, t.costHi),

        t.paybackYearsLo !== null ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) : "n/a",

        Number.isFinite(t.lcoeUsdPerKwh) ? `~${energyRate(t.lcoeUsdPerKwh)}` : "n/a",

      ].join("</td><td>") + "</td></tr>"

    ).join("");

  }

  // Hardware summary (SELECTED system) + full options matrix for the printout.
  let hwHtml = "";
  const hwEntry = resolveSelected(p) || p.focus;
  if (hwEntry) {
    const bom = buildBom({
      pvKw: hwEntry.pvKw,
      battNameplateKwh: hwEntry.battNameplateKwh,
      chemistry: hwEntry.chemistry,
      peakLoadW: hwEntry.peakLoadW || (p.focus && p.focus.peakLoadW) || 0,
      peakIsAverage: p.peakIsAverage !== false,
      meanTempC: (p.assumptions && p.assumptions.meanTempC) ?? null,
      panelWatts: PANEL_WATTS_DEFAULT,
    });
    const hwRows = [];
    if (bom.panels) {
      hwRows.push(["Solar panels", `${PANEL_WATTS_DEFAULT} W mono`, `${bom.panels.count} pcs`, `${bom.panels.kwActual} kW \u00B7 ~${bom.panels.areaM2} m\u00B2`]);
    } else {
      hwRows.push(["Solar panels", "None", "-", "Battery-only configuration"]);
    }
    if (bom.voltage && bom.battery) {
      hwRows.push(
        ["Bank voltage", `${bom.voltage.volts} V`, "-", ""],
        ["Battery (DIY)", bom.battery.diy.unitLabel, `${bom.battery.diy.stringsParallel} string(s)`, `${bom.battery.diy.blocksTotal} cells total`],
        ["Battery (retail alt.)", bom.battery.retail.unitLabel, `${bom.battery.retail.modules} pcs`, "BMS included"],
      );
    } else {
      hwRows.push(["Battery bank", "None", "-", "Solar-only configuration"]);
    }
    hwRows.push(["Inverter", `${bom.inverter.recommendedKw} kW class`, "1", "sized to peak load incl. surge margin"]);
    if (bom.controller) {
      hwRows.push(
        ["Charge controller", `${bom.controller.ampsRequired} A MPPT`, "see note", bom.controller.suggestion],
        ["Main DC fuse/breaker", `${bom.protection.mainFuseAmps} A`, "1", "battery disconnect"],
        ["PV disconnect", `${bom.protection.pvBreakerAmps} A`, "1", ""],
        ["Battery cable (2 m run)", bom.cable[0].mm2 ? `${bom.cable[0].awg} copper` : `larger than ${bom.cable[0].awg}`, "pair", "2% drop + ampacity"],
      );
    }
    const hwChemLabel = hwEntry.chemLabel
      || (p.matrix && p.matrix.rows && p.matrix.rows.find((r) => r.id === hwEntry.chemistry)?.label)
      || hwEntry.chemistry;
    hwHtml = `
      <h2 style="font-size:12pt;margin:10pt 0 4pt;">Hardware list for the selected system (${hwChemLabel})</h2>
      <table style="border-collapse:collapse;width:100%;font-size:9pt;margin-bottom:8pt;">
        <tr style="background:#eef2f7;"><th>Item</th><th>Spec</th><th>Qty</th><th>Note</th></tr>
        ${hwRows.map((r) => "<tr><td>" + r.join("</td><td>") + "</td></tr>").join("")}
      </table>`;
  }
  const mx = p.matrix ? matrixHtml(p).replace(/class="matrix-wrap"/, 'style="overflow-x:hidden;"') : "";

  sheet.innerHTML = `

    <h1 style="font-size:20pt;margin-bottom:2pt;">BigEnergyCo - ${title}</h1>

    <p style="font-size:9pt;color:#444;margin-bottom:10pt;">

      Generated ${new Date().toISOString().slice(0, 10)} - free educational estimate -

      ${location.origin + location.pathname}

    </p>

    <table style="border-collapse:collapse;width:100%;font-size:10pt;margin-bottom:10pt;">

      <tr style="background:#eef2f7;">${head}</tr>

      ${rows}

    </table>

    <p style="font-size:9.5pt;margin:0 0 4pt;"><strong>Basis:</strong> ${inp.basis} - ${fmtKwh(inp.dailyKwh)} kWh/day -

      ${(hwEntry && hwEntry.chemLabel ? hwEntry.chemLabel : p.chemistry.toUpperCase())} battery - location ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)} -

      ${(hwEntry || p.focus) ? footprintText((hwEntry || p.focus).pvKw) + " - " : ""}${p.tariff ? `grid price ${energyRate(p.tariff)} (~${money(p.annualGridSpendUsd)}/yr)` : "no grid price entered"}</p>

    ${hwHtml}

    ${mx ? `<h2 style="font-size:12pt;margin:10pt 0 4pt;">All options compared</h2>${mx}` : ""}

    ${p.frontier && p.frontier.points && p.frontier.points.length > 1

      ? `<p style="font-size:9.5pt;margin:0 0 4pt;"><strong>How far money gets you:</strong> ${frontierVerdict(p.frontier, { t, money })}</p>`

      : ""}

    <p style="font-size:9.5pt;margin:0 0 4pt;"><strong>Method:</strong> hourly simulation of ${p.assumptions.dataYears} of

      NASA POWER satellite weather (${p.meta.source})${isGT ? "; the system never exports power to the grid" : ""}.

      Derates: soiling ${(p.assumptions.derates.soiling * 100).toFixed(0)}%,

      wiring ${(p.assumptions.derates.wiring * 100).toFixed(0)}%, mismatch ${(p.assumptions.derates.mismatch * 100).toFixed(0)}%,

      MPPT ${(p.assumptions.derates.mppt * 100).toFixed(0)}%; cell-temp model NOCT ${p.assumptions.noctC}°C,

      ${(p.assumptions.gammaPerC * 100).toFixed(2)}%/°C; inverter ${(p.assumptions.etaInverter * 100).toFixed(0)}%.

      Costs are components only (ex-factory China through shipped budget retail) and exclude freight, duty, labor,

      permits, and mounting.${p.auto && p.auto.length ? ` ${p.autoNote}.` : ""}</p>

    <p style="font-size:8.5pt;color:#333;border-top:1px solid #999;padding-top:5pt;margin-top:8pt;">

      Educational estimate only - not engineering, not a quote, no warranty. Battery banks, high DC current and

      mains wiring can cause fire, injury, and death. Verify every figure with a licensed electrician or engineer

      in your jurisdiction before purchasing or energizing anything.</p>`;

}

function askAdvisor() {

  if (!window.lastSizingBrief) return;

  const input = document.getElementById("chatInput");

  if (input) input.value = window.lastSizingBrief;

  if (window.openSizingModal) window.openSizingModal();

  if (window.sendChatMsg) window.sendChatMsg();

}

function copyShareLink() {

  const btn = $("btnShareResult");

  const origText = btn ? btn.textContent : " Copy share link";

  const setFeedback = (msg) => {
    if (btn) {
      btn.textContent = msg;
      btn.style.borderColor = "var(--primary-accent)";
      btn.style.color = "var(--primary-accent)";
      setTimeout(() => {
        if (btn) {
          btn.textContent = origText;
          btn.style.borderColor = "";
          btn.style.color = "";
        }
      }, 2500);
    }
  };

  const done = () => {
    setStatus(" Link copied - anyone who opens it gets this same result, re-computed on their device.");
    setFeedback("✓ Link Copied!");
  };

  const url = location.href;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
  } else {
    fallbackCopy(url, done);
  }

}

function fallbackCopy(text, done) {

  const ta = document.createElement("textarea");

  ta.value = text;

  ta.style.position = "fixed";

  ta.style.opacity = "0";

  document.body.appendChild(ta);

  ta.select();

  try { document.execCommand("copy"); } catch {}

  done();

  ta.remove();

}

// -- Hardware reference (BOM) - rendered from the shared content module -----

function renderBom() {

  const grid = document.querySelector("#bom .bom-grid");

  if (!grid) return;

  grid.innerHTML = "";

  for (const item of BOM_ITEMS) {

    const card = el("div", { class: "bom-card" });

    card.appendChild(el("div", { class: "bom-badge" }, item.badge));

    card.appendChild(el("h3", {}, item.name));

    card.appendChild(el("p", {}, item.desc));

    const price = el("div", { class: "bom-price" }, item.price + " ");

    price.appendChild(el("span", { style: "font-weight:400;font-size:0.8em;color:var(--text-muted);" }, `(${item.scope})`));

    card.appendChild(price);

    grid.appendChild(card);

  }

}

function getActiveChartLength() {

  if (!cachedChartState) return 0;

  if (cachedChartState.type === "soc" && cachedChartState.history && cachedChartState.history.tiers && cachedChartState.history.tiers[0] && cachedChartState.history.tiers[0].dailyMin) {
    return cachedChartState.history.tiers[0].dailyMin.length;
  }

  if (cachedChartState.type === "auto" && cachedChartState.p && cachedChartState.p.auto && cachedChartState.p.auto[0] && cachedChartState.p.auto[0].socNameplatePct && cachedChartState.p.auto[0].socNameplatePct.min) {
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

function findWorstStreak(dailyMins, windowSize = 30) {

  if (!dailyMins || dailyMins.length <= windowSize) return 0;

  let worstIdx = 0, lowestMin = Infinity, lowestSum = Infinity;

  for (let i = 0; i <= dailyMins.length - windowSize; i++) {
    let sum = 0, localMin = Infinity;
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

function zoomChart(factor, centerRatio = 0.5) {

  const n = getActiveChartLength();

  if (!n) return;

  const currStart = (socZoomRange && Number.isFinite(socZoomRange.start)) ? socZoomRange.start : 0;

  const currEnd = (socZoomRange && Number.isFinite(socZoomRange.end)) ? socZoomRange.end : n - 1;

  const span = currEnd - currStart;

  const newSpan = Math.max(14, Math.min(n - 1, Math.round(span * factor)));

  const center = currStart + span * centerRatio;

  let newStart = Math.round(center - newSpan * centerRatio);

  let newEnd = newStart + newSpan;

  if (newStart < 0) { newStart = 0; newEnd = newSpan; }

  if (newEnd > n - 1) { newEnd = n - 1; newStart = Math.max(0, newEnd - newSpan); }

  socZoomRange = (newSpan >= n - 2) ? null : { start: newStart, end: newEnd };

  redrawSocChart();

}

function setupChartInteractions() {

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
    let newStart = Math.max(0, Math.min(n - 1 - span, startRange.start + dayShift));
    let newEnd = newStart + span;
    socZoomRange = { start: newStart, end: newEnd };
    redrawSocChart();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    zoomChart(e.deltaY > 0 ? 1.3 : 0.7, ratio);
  }, { passive: false });

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      const n = getActiveChartLength();
      startRange = socZoomRange ? { ...socZoomRange } : { start: 0, end: n - 1 };
    } else if (e.touches.length === 2) {
      isDragging = false;
      touchDistStart = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const n = getActiveChartLength();
      startRange = socZoomRange ? { ...socZoomRange } : { start: 0, end: n - 1 };
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && isDragging && startRange) {
      const dx = e.touches[0].clientX - dragStartX;
      const rect = canvas.getBoundingClientRect();
      const plotW = rect.width - 44;
      if (plotW <= 0) return;
      const span = startRange.end - startRange.start;
      const dayShift = Math.round((-dx / plotW) * span);
      const n = getActiveChartLength();
      let newStart = Math.max(0, Math.min(n - 1 - span, startRange.start + dayShift));
      let newEnd = newStart + span;
      socZoomRange = { start: newStart, end: newEnd };
      redrawSocChart();
    } else if (e.touches.length === 2 && touchDistStart > 0 && startRange) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (currentDist > 5) {
        const factor = touchDistStart / currentDist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (midX - rect.left) / rect.width));
        zoomChart(factor, ratio);
      }
    }
  }, { passive: true });

  canvas.addEventListener("touchend", () => {
    isDragging = false;
    touchDistStart = 0;
  }, { passive: true });

}

function setupPwaControls() {

  const btnH = $("btnInstallApp");

  const btnM = $("btnInstallAppMobile");

  const badge = $("offlineBadge");

  const triggerInstall = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const res = await deferredInstallPrompt.userChoice;
    if (res && res.outcome === "accepted") {
      if (btnH) btnH.style.display = "none";
      if (btnM) btnM.style.display = "none";
    }
    deferredInstallPrompt = null;
  };

  if (btnH) btnH.addEventListener("click", triggerInstall);

  if (btnM) btnM.addEventListener("click", triggerInstall);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (btnH) btnH.style.display = "inline-flex";
    if (btnM) btnM.style.display = "flex";
  });

  window.addEventListener("appinstalled", () => {
    if (btnH) btnH.style.display = "none";
    if (btnM) btnM.style.display = "none";
    deferredInstallPrompt = null;
  });

  function updateNetworkStatus() {
    if (!badge) return;
    if (!navigator.onLine) {
      badge.className = "offline-badge";
      badge.innerHTML = `<span class="offline-dot"></span> Offline Ready`;
      badge.style.display = "inline-flex";
      badge.title = "Working offline using cached app data & local weather simulation";
    } else {
      if (badge.style.display !== "none" && !badge.classList.contains("online-flash")) {
        badge.className = "offline-badge online-flash";
        badge.innerHTML = `<span class="offline-dot"></span> Back Online`;
        setTimeout(() => { badge.style.display = "none"; }, 3000);
      } else if (!badge.classList.contains("online-flash")) {
        badge.style.display = "none";
      }
    }
  }

  window.addEventListener("online", updateNetworkStatus);

  window.addEventListener("offline", updateNetworkStatus);

  updateNetworkStatus();

}

export function initSizingUI() {

  try {

    // Landing-page storage widget reads through this hook (same pricing
    // module the engine uses — no second source of truth).
    try {
      window.BECO_BATT_COST = (kwh) => battOnlyCost(Math.max(0, Number(kwh) || 0), "lfp");
    } catch { /* non-browser test env */ }

    renderCities();
    expandCitySearch();

    renderAppliances();

    renderBom();

  // tariff input is a single $/kWh field (auto-estimated from location until the user overrides)

  const customVal = $("customRateVal");
  if (customVal) customVal.addEventListener("input", () => {
    tariffTouched = true;
    syncBillSlider();
    if (lastPayload) scheduleRun(true);
  });

  $("loadMode").addEventListener("change", setLoadPanel);

  $("dailyKwhInput").addEventListener("input", updateLoadReadout);

  $("btnGeoLocate").addEventListener("click", locateMe);

  // The click event must not leak into run()'s `quiet` parameter (a truthy
  // Event object would silently suppress the status, spinner, and scroll).
  $("btnRunSizing").addEventListener("click", () => run());

  $("btnAskAdvisor").addEventListener("click", askAdvisor);

  const shareBtn = $("btnShareResult");

  if (shareBtn) shareBtn.addEventListener("click", copyShareLink);

  const printBtn = $("btnPrintResult");

  if (printBtn) printBtn.addEventListener("click", () => window.print());

  // Result detail ladder (Best pick / Compare batteries / All options)
  for (const [id, lvl] of [["lvlBest", "best"], ["lvlCompare", "compare"], ["lvlMatrix", "matrix"]]) {
    const tab = $(id);
    if (tab) tab.addEventListener("click", () => setLevel(lvl));
  }

  // Hardware list panel: live panel-wattage tweaks + CSV download
  const panelWattsInput = $("panelWatts");
  if (panelWattsInput) panelWattsInput.addEventListener("input", renderBomPanel);
  const bomDl = $("btnDownloadBom");
  if (bomDl) bomDl.addEventListener("click", downloadBomCsv);

  // Generator fuel helper: fuel price -> effective $/kWh
  const genType = $("genFuelType");
  if (genType) genType.addEventListener("change", updateGenHelper);
  const genPrice = $("genFuelPrice");
  if (genPrice) genPrice.addEventListener("input", updateGenHelper);
  const genApply = $("btnApplyGenRate");
  if (genApply) genApply.addEventListener("click", applyGenRate);

  // Currency inputs re-render the existing result instantly - no re-run

  // needed, since FX is a display-only transform on the same numbers.

  prevFxSnapshot = fxActive();
  for (const id of ["fxRate", "fxCode"]) {

    const elNode = $(id);

    if (elNode) elNode.addEventListener("input", () => {
      // Preserve USD value of tariff when currency switches: convert display
      // value from old rate to new so $0.42 doesn't become 0.46$ after toggle.
      // The export rate and generator fuel price are entered in the same
      // display currency, so they convert identically — otherwise switching
      // currency silently changes their effective USD value.
      const convertField = (id) => {
        const node = $(id);
        const curVal = parseFloat(node?.value);
        if (!node || !Number.isFinite(curVal) || !prevFxSnapshot || !prevFxSnapshot.rate) return;
        const usd = curVal / prevFxSnapshot.rate;
        const nextFx = fxActive();
        if (nextFx && nextFx.rate) {
          node.value = String(+(usd * nextFx.rate).toFixed(4));
        } else if (!nextFx) {
          node.value = String(+usd.toFixed(4));
        }
      };
      convertField("customRateVal");
      convertField("exportRate");
      convertField("genFuelPrice");

      currencyTouched = true;

      updateCurrencyUnitLabel();
      prevFxSnapshot = fxActive();
      syncBillSlider();

      if (lastPayload) {
        // Render from the same USD payload using the newly selected display FX.
        // The engine's recommendation is currency-invariant; every displayed
        // amount and energy rate is recalculated here.
        renderResults(lastPayload);
      }

    });

  }

  // Auto-mode basis submenus: switching basis changes the result ? re-run

  // (weather is cached, so this is fast). Visibility follows mode+chemistry.

  $("chemSelect").addEventListener("change", () => {
    updateAutoRows();
    renderChemTempVisualizer();
    if (selectedKey && (selectedKey === "best" || selectedKey.startsWith("auto:"))) {
      selectedKey = "best";
    }
    if (lastPayload) run(true);
  });

  const hwConfigNode = $("hardwareConfig");
  if (hwConfigNode) {
    hwConfigNode.addEventListener("change", () => {
      const val = hwConfigNode.value;
      const chemRow = $("chemSelect")?.closest(".form-group");
      if (val === "solar") {
        if (chemRow) chemRow.style.opacity = "0.4";
      } else {
        if (chemRow) chemRow.style.opacity = "1";
      }
      if (selectedKey && (selectedKey === "best" || selectedKey.startsWith("auto:"))) {
        selectedKey = "best";
      }
      if (lastPayload) run(true);
    });
  }

  if ($("systemGoal")) $("systemGoal").addEventListener("change", () => { updateAutoRows(); });

  const autoTierNode = $("autoTier");

  if (autoTierNode) autoTierNode.addEventListener("change", () => { if (lastPayload) run(); });

  // Quick / Manual mode: quick hides everything except location and auto-runs.

  const modeQuick = $("modeQuick");
  const modeManual = $("modeManual");
  const applyMode = () => setQuickMode(modeManual ? !modeManual.checked : true);
  if (modeQuick) modeQuick.addEventListener("change", applyMode);
  if (modeManual) modeManual.addEventListener("change", applyMode);

  // Monthly-bill slider (local currency) + bill-cut slider (1–111%).
  setupBillSlider();
  setupCutSlider();

  // Clickable grid-tie matrix cells.
  setupMatrixSelection();

  setupPwaControls();
  setupChartInteractions();

  // Wire up preset buttons
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset) applyAppliancePreset(preset);
    });
  });

  // Wire up chart zoom buttons
  const btnZoomReset = $("btnSocZoomReset");
  if (btnZoomReset) btnZoomReset.addEventListener("click", () => { socZoomRange = null; redrawSocChart(); });
  const btnZoomWorst = $("btnSocZoomWorst");
  if (btnZoomWorst) btnZoomWorst.addEventListener("click", () => {
    const n = getActiveChartLength();
    if (!n) return;
    let worstIdx = 0;
    if (cachedChartState?.type === "soc" && cachedChartState.history?.tiers?.[0]?.dailyMin) {
      worstIdx = findWorstStreak(cachedChartState.history.tiers[0].dailyMin, 30);
    } else if (cachedChartState?.type === "auto" && cachedChartState.p?.auto?.[0]?.socNameplatePct?.min) {
      worstIdx = findWorstStreak(cachedChartState.p.auto[0].socNameplatePct.min, 30);
    }
    socZoomRange = { start: worstIdx, end: Math.min(n - 1, worstIdx + 30) };
    redrawSocChart();
  });
  const btnZoomIn = $("btnSocZoomIn");
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => zoomChart(0.5));
  const btnZoomOut = $("btnSocZoomOut");
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => zoomChart(2.0));

  // Initialize Sun-path and Chemistry Temperature visualizers
  const initLat = parseFloat($("latInput")?.value) || 21.31;
  renderSunPath(initLat);
  renderChemTempVisualizer(initLat);
  const latEl = $("latInput");
  const lonEl = $("lonInput");
  let coordDebounceTimer = null;
  const onCoordChange = () => {
    const lat = parseFloat(latEl?.value);
    const lon = parseFloat(lonEl?.value);
    if (Number.isFinite(lat)) {
      renderSunPath(lat);
      renderChemTempVisualizer(lat);
    }
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (coordDebounceTimer) clearTimeout(coordDebounceTimer);
      coordDebounceTimer = setTimeout(() => {
        locationResolved = true;
        applyEstimatedTariff(lat, lon);
        updateShareHash(lastPayload, readInputs());
        if (lastPayload) scheduleRun(true);
      }, 500);
    }
  };
  if (latEl) latEl.addEventListener("input", onCoordChange);
  if (lonEl) lonEl.addEventListener("input", onCoordChange);

  // Price-point analysis modal: "Use this system" adopts the exact system.
  const closeSys = $("btnCloseSystem");
  if (closeSys) closeSys.addEventListener("click", closeSystemModal);
  const useSys = $("systemModalUse");
  if (useSys) useSys.addEventListener("click", () => { const b = $("systemModalUse"); if (b && b._adopt) b._adopt(); });

  updateAutoRows();

  setLoadPanel();

  setQuickMode(true);   // Auto-run is the default experience

  syncBillSlider();

  updateCurrencyUnitLabel(); // bill-slider currency + tariff labels on first paint

  // Interface language (auto-detected, user-overridable in the footer).

  applyI18n();

  initLangPicker($("langSelect"));

  // Re-render unit/currency labels (fuel helper, tariff) the moment the

  // language changes, since those live outside the data-i18n scan.

  window.addEventListener("beco:lang", () => { updateFuelUnits(); updateGenHelper(); });

  updateFuelUnits();

  // A shared link restores its inputs and re-runs the deterministic engine.

  if (restoreFromShare()) setTimeout(run, 50);

  // Background FX refresh: keeps auto-selected currencies accurate.

  refreshFxRates();

  } catch (err) {

    // A single init failure must never silently kill the whole UI.

    console.error("Sizing UI failed to initialize:", err);

    setStatus("Warning: Interface failed to load - please refresh the page (Ctrl+F5).");

  }

}

// Refresh the built-in FX defaults in the background so an auto-selected

// currency is accurate rather than indicative. Never blocks the page; on

// failure (offline) the static table simply stays in use.

async function refreshFxRates() {

  try {

    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });

    if (!res.ok) return;

    const json = await res.json();

    if (!json || json.result !== "success" || !json.rates) return;

    for (const code of Object.keys(CURRENCIES)) {

      const r = json.rates[code];

      if (Number.isFinite(r) && r > 0) CURRENCIES[code].perUSD = r;

    }

    fxMeta.asOf = json.time_last_update_utc || new Date().toUTCString();

    const elN = $("fxAsOf");

    if (elN) elN.textContent = `Live rates as of ${fxMeta.asOf}.`;

    // fxActive() reads the fxRate INPUT, not the CURRENCIES table — without
    // syncing it, the live fetch changes nothing on screen. Display-currency
    // fields convert with it so their USD meaning is preserved.
    const fxInput = $("fxRate");
    const code = ($("fxCode")?.value || "").trim().toUpperCase();
    if (fxInput && code && Number.isFinite(CURRENCIES[code]?.perUSD)) {
      const oldRate = parseFloat(fxInput.value);
      const newRate = CURRENCIES[code].perUSD;
      if (Number.isFinite(oldRate) && oldRate > 0 && oldRate !== newRate) {
        for (const id of ["customRateVal", "exportRate", "genFuelPrice"]) {
          const node = $(id);
          const v = parseFloat(node?.value);
          if (node && Number.isFinite(v)) node.value = String(+((v / oldRate) * newRate).toFixed(4));
        }
      }
      fxInput.value = String(newRate);
      prevFxSnapshot = fxActive();
    }

    if (lastPayload) renderResults(lastPayload);

  } catch { /* offline - static defaults remain */ }

}

// Ensure DOM is ready before initializing

function whenDOMReady(cb) {

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", cb, { once: true });

  } else {

    // DOMContentLoaded already fired, but element might not be ready yet

    // Poll for the city search element to ensure it exists

    let attempts = 0;

    const maxAttempts = 100; // ~5 seconds at 50ms intervals

    const checkReady = () => {

      const search = document.getElementById("citySearch");

      if (search) {

        cb();

      } else if (attempts < maxAttempts) {

        attempts++;

        setTimeout(checkReady, 50);

      } else {

        console.error("citySearch element not found after", maxAttempts * 50, "ms");

        cb(); // proceed anyway to avoid deadlock

      }

    };

    checkReady();

  }

}

whenDOMReady(initSizingUI);

