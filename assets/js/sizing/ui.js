// Size-My-System UI controller. Loaded as an ES module from index.html.

// All computation happens in sizing-worker.js; this file is DOM glue only.

//

// Load input is end-user-first: an appliance checklist with plain-language

// quantity and usage sliders, a monthly-bill mode, and a tucked-away

// direct-kWh mode for people who already know their numbers.

import { CITY_PRESETS, } from "./nasa.js?v=20260826a";

import { estimateTariff, battOnlyCost, CURRENCIES, fxMeta, DAYS_PER_MONTH } from "./pricing.js?v=20260826a";

import { buildBom, panelLayout, PANEL_WATTS_DEFAULT } from "./bom.js?v=20260826a";

import { BOM_ITEMS } from "../shared/content.js?v=20260826a";

import { applyI18n, initLangPicker, resolveLang } from "../shared/i18n.js?v=20260826a";

import { LOCALES } from "../shared/locales.js?v=20260826a";

let worker = null;

let lastPayload = null;   // kept for share links + the printable summary
let prevFxSnapshot = null; // for tariff display conversion on currency switch

// Result detail level: "best" | "compare" | "matrix" (auto-chemistry runs only).
let resultLevel = "best";

// True once the user applied the generator-fuel helper to the price field.
let generatorBasis = false;

// The legacy storage-comparison script (classic inline JS) reads scoped

// prices through this bridge - pricing.js stays the single source of truth.

window.BECO_BATT_COST = battOnlyCost;

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

  const v = parseFloat($("customRateVal").value);

  return Number.isFinite(v) && v > 0 ? v : null;

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

    const bill = parseFloat($("billAmount").value);

    const rate = getTariff();

    if (Number.isFinite(bill) && bill > 0 && Number.isFinite(rate) && rate > 0) {

      const kwhDay = bill / (rate * DAYS_PER_MONTH);

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

      const row = el("div", { class: "ap-row", "data-w": it.w, "data-qty": "1", "data-h": it.h, "data-duty": it.duty ? "1" : "" });

      row.style.cssText = "display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.5rem;border:1px solid transparent;border-radius:8px;flex-wrap:wrap;";

      const cb = el("input", { type: "checkbox", style: "width:auto;margin:0;transform:scale(1.2);cursor:pointer;" });

      const name = el("label", { style: "flex:1 1 200px;cursor:pointer;font-size:0.92rem;font-weight:500;margin:0;" }, it.n);

      name.prepend(cb);

      const watts = el("span", { style: "font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);background:rgba(255,255,255,0.05);padding:0.1rem 0.45rem;border-radius:10px;" },

        it.duty ? `~${it.w} W while running` : `~${it.w} W`);

      // quantity stepper (hidden until checked)

      const qtyWrap = el("span", { style: "display:none;align-items:center;gap:0.35rem;" });

      const minus = el("span", { class: "btn btn-outline", style: "padding:0.05rem 0.55rem;font-size:0.9rem;cursor:pointer;user-select:none;" }, "-");

      const qtyVal = el("span", { style: "font-family:var(--font-mono);min-width:1.4rem;text-align:center;font-weight:700;" }, "1");

      const plus = el("span", { class: "btn btn-outline", style: "padding:0.05rem 0.55rem;font-size:0.9rem;cursor:pointer;user-select:none;" }, "+");

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

// -- Location plumbing -------------------------------------------------------

function setCoords(lat, lon, label) {

  const latEl = $("latInput");

  const lonEl = $("lonInput");

  const noteEl = $("locNote");

  if (latEl) latEl.value = Math.round(lat * 100) / 100;

  if (lonEl) lonEl.value = Math.round(lon * 100) / 100;

  if (noteEl) noteEl.textContent = label;

  applyEstimatedTariff(lat, lon);

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

  updateCurrencyUnitLabel();

}

function updateCurrencyUnitLabel() {

  const fx = fxActive();

  const label = document.querySelector('label[for="customRateVal"]');

  if (label) label.textContent = fx

    ? `Your price per kWh (${CURRENCIES[fx.code]?.symbol || fx.code}):`

    : "Your price per kWh ($):";

}

function applyEstimatedTariff(lat, lon) {

  if (tariffTouched) return;

  const est = estimateTariff(lat, lon);

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

  updateLoadReadout();

}

function renderCities() {

  const sel = $("cityPreset");

  if (!sel) {

    console.error("City select element not found");

    return;

  }

  if (!CITY_PRESETS || !CITY_PRESETS.length) {

    console.error("CITY_PRESETS not loaded");

    return;

  }

  sel.innerHTML = "";

  const regions = [...new Set(CITY_PRESETS.map((c) => c.r))];

  for (const r of regions) {

    const og = el("optgroup", { label: r });

    CITY_PRESETS.filter((c) => c.r === r).forEach((c) => {

      const idx = CITY_PRESETS.indexOf(c);

      const o = el("option", { value: String(idx) }, c.name);

      og.appendChild(o);

    });

    sel.appendChild(og);

  }

  sel.value = "0";

  sel.addEventListener("change", () => {

    const idx = parseInt(sel.value, 10);

    const c = CITY_PRESETS[idx];

    if (c) setCoords(c.lat, c.lon, `Sunshine data from ${c.name}`);

  });

  // initialize to first city

  const first = CITY_PRESETS[0];

  setCoords(first.lat, first.lon, `Sunshine data from ${first.name}`);

}

function locateMe() {

  if (!navigator.geolocation) {

    setStatus("Warning: Your browser can't share a location - pick the nearest big city instead.");

    return;

  }

  setStatus(" Asking your browser for your location…");

  navigator.geolocation.getCurrentPosition(

    (pos) => {

      setCoords(pos.coords.latitude, pos.coords.longitude, "Using your precise location");

      $("coordDetails").open = true;

      setStatus(" Location set. Now tell us your power use below, then run the sizing.");

    },

    () => setStatus("Warning: Couldn't get your location - pick the nearest big city instead."),

    { timeout: 8000 }

  );

}

// -- Inputs ? engine ---------------------------------------------------------

function readInputs() {

  const lat = parseFloat($("latInput").value);

  const lon = parseFloat($("lonInput").value);

  let dailyKwh;

  const mode = $("loadMode").value;

  if (mode === "appliances") {

    dailyKwh = applianceState().kwh;

  } else if (mode === "bill") {

    const bill = parseFloat($("billAmount").value);

    const rate = getTariff();

    dailyKwh = bill / (rate * DAYS_PER_MONTH);

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

      return Number.isFinite(v) && v > 0 ? v : null;

    })(),

    autoTier: $("autoTier")?.value || "tier99",

    autoTargetId: $("autoTarget")?.value || "cut80",

    mode: $("systemGoal") ? $("systemGoal").value : "offgrid",

    basis,

  };

}

function run() {

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

  setStatus(inp.mode === "gridtie" ? t("statusGridtie") : t("statusOffgrid"));

  const btn = $("btnRunSizing");

  btn.disabled = true;

  btn.innerHTML = `<span class="spin">o</span> ${t("runningBtn")}`;

  ensureWorker().postMessage({ type: "run", ...inp });

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

    worker = new Worker("./assets/js/sizing/sizing-worker.js?v=20260826a", { type: "module" });

    worker.onmessage = (ev) => {

      if (ev.data?.type === "ok") {

        renderResults(ev.data.payload);

        // bring the results into view - the run button can be far above them

        const res = $("tierResults");

        if (res) { res.setAttribute("tabindex", "-1"); res.scrollIntoView({ behavior: "smooth", block: "start" }); }

      } else if (ev.data?.type === "error") setStatus("Warning: " + ev.data.message);

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

// User currency (optional): converts every displayed dollar AMOUNT at the

// user's rate. Price scopes themselves are USD-denominated, so unit rates

// ($/kWh stored) stay labeled $ - the arithmetic panel explains that.

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

function moneyRange(lo, hi) { return money(lo) + "\u2013" + money(hi); }

function fxNote() {

  const fx = fxActive();

  if (!fx) return null;

  const asOf = fxMeta.asOf

    ? ` Live rates as of ${fxMeta.asOf}.`

    : " Indicative built-in rates (live fetch unavailable).";

  return `Amounts shown in ${fx.code} at ${fx.rate} per US$1.${asOf} Battery unit rates stay in $/kWh because the underlying price scopes are USD-denominated.`;

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

  ctx.beginPath();

  ctx.moveTo(padL, stripH);

  for (let i = 0; i < pv.length; i++) ctx.lineTo(X(i), stripH - (pv[i] / pvMax) * amp);

  ctx.lineTo(W - padR, stripH);

  ctx.closePath();

  ctx.globalAlpha = 0.30; ctx.fillStyle = "#fbbf24"; ctx.fill();

  ctx.globalAlpha = 0.65; ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1; ctx.stroke();

  ctx.globalAlpha = 1;

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

    // Data arrived but in an unexpected shape - almost certainly a stale

    // cached module. Never fail silently: say so.

    wrap.style.display = "block";

    const cap = $("socCaption");

    if (cap) cap.textContent = "Warning: Chart data didn't match this page version - please refresh (Ctrl+F5 / ??R) and run the sizing again.";

    return;

  }

  wrap.style.display = "block";

  // hide the old legend row - labels live inside each band now

  const legend = $("socLegend");

  if (legend) legend.style.display = "none";

  const gt = history.kind === "gridtie";

  const dpr = window.devicePixelRatio || 1;

  const W = Math.max(320, wrap.clientWidth || 640);

  const BAND_H = 118, GAP = 14;

  const nDays = solvable.length ? solvable[0].dailyMin.length : 0;

  const pv = (history.pvDaily && nDays && history.pvDaily.length === nDays) ? history.pvDaily : null;

  const stripH = pv ? 64 : 0, stripGap = pv ? 10 : 0;

  const H = stripH + stripGap + solvable.length * BAND_H + (solvable.length - 1) * GAP + 20;

  canvas.width = W * dpr;

  canvas.height = H * dpr;

  canvas.style.width = W + "px";

  canvas.style.height = H + "px";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 34, padR = 10, padT = 26, padB = 8;

  const plotW = W - padL - padR;

  function drawBand(t, top) {

    const color = TIER_COLORS[t.id] || "#888";

    const plotH = BAND_H - padT - padB;

    const n = t.dailyMin.length;

    const X = (i) => padL + (i / (n - 1)) * plotW;

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

    // FULL daily range: fill between each day's highest and lowest charge.

    // The top edge is the battery charging back to full - every system's

    // band touches 100%; the bottom edge shows how deep the nights dig.

    ctx.beginPath();

    ctx.moveTo(X(0), Y(t.dailyMax[0]));

    for (let i = 1; i < n; i++) ctx.lineTo(X(i), Y(t.dailyMax[i]));

    for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(t.dailyMin[i]));

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

    for (let i = 0; i < n; i++) { const y = Y(t.dailyMin[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    // top edge thicker: "does it reach full?" should be unmistakable

    ctx.globalAlpha = 0.95;

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    for (let i = 0; i < n; i++) { const y = Y(t.dailyMax[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    ctx.globalAlpha = 1;

    // label: tier name + one-sentence verdict

    ctx.textAlign = "left";

    ctx.fillStyle = "#f3f4f6";

    ctx.font = "bold 12px system-ui, sans-serif";

    ctx.fillText(TIER_NAMES[t.id] || t.id, padL + 2, top + 13);

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

  if (pv) drawSunStrip(ctx, pv, (i) => padL + (i / (nDays - 1)) * plotW, W, padL, padR, stripH);

  solvable.forEach((t, idx) => drawBand(t, topOffset + idx * (BAND_H + GAP)));

  // shared x labels: years

  const span = history.endYear - history.startYear + 1;

  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";

  const daysTotal = history.days || solvable[0].dailyMin.length;

  for (let yy = 0; yy <= span; yy++) {

    const x = padL + (yy * 365.25 / daysTotal) * plotW;

    ctx.fillText(String(history.startYear + yy), Math.min(W - padR, Math.max(padL, x)), H - 2);

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

    const card = el("div", { class: "bom-card" });

    card.style.borderColor = a.chemistry === bestId ? "var(--border-glow)" : "var(--border-card)";

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

    rows.push(["Total 20-year cost", `~${money(a.lifetimeCostMid)}` + (a.chemistry === bestId ? " - cheapest" : "")]);

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
      rows.push(["Your power cost", `${(a.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh` +
        (p.tariff ? ` (grid is ${(p.tariff * 100).toFixed(0)}c)` : "")]);
    }

    appendRows(card, rows);

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
  for (const [lvl, id] of Object.entries(map)) {
    const btn = $(id);
    if (!btn) continue;
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
  const card = el("div", { class: "bom-card" });
  card.style.borderColor = "var(--border-glow)";
  card.appendChild(el("div", { class: "bom-badge" }, "Recommended \u2014 lowest true 20-year cost"));
  card.appendChild(el("h3", {}, `${b.chemLabel}: ${b.pvKw} kW solar + ${b.battKwh > 0 ? fmt(b.battKwh) + " kWh battery" : "no battery needed"}`));

  const rows = [
    ["Solar array", `${b.pvKw} kW`],
    ["Battery (usable)", b.battKwh > 0 ? `${fmt(b.battKwh)} kWh \u2014 ~${fmt(b.battNameplateKwh)} nameplate` : "none"],
  ];
  const foot = footprintText(b.pvKw);
  if (foot) rows.push(["Footprint", foot]);
  rows.push(["Cost to buy", `~${moneyRange(b.costLo, b.costHi)}`]);
  rows.push(["Battery swaps", b.replacementsHorizon > 0
    ? (b.batteryLifeYears ? `~${b.replacementsHorizon}x (about every ${fmtLife(b.batteryLifeYears)})` : `~${b.replacementsHorizon}x`)
    : "None in 20 years"]);
  if (b.swapsAndLaborUsd > 0) rows.push(["Swaps + labor add", `~${money(b.swapsAndLaborUsd)}`]);
  rows.push(["Total 20-year cost", `~${money(b.lifetimeCostMid)} \u2014 cheapest of the three`]);
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
    rows.push(["Your power cost", `${(b.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh` +
      (p.tariff ? ` (grid is ${(p.tariff * 100).toFixed(0)}c)` : "")]);
  }
  appendRows(card, rows);
  if (p.bestReason) {
    card.appendChild(el("p", { style: "font-size:0.85rem;color:var(--text-main);margin-top:0.7rem;line-height:1.55;" }, p.bestReason));
  }
  card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },
    `${p.autoNote}. Use the tabs above to compare every option side by side.`));
  wrap.appendChild(card);
}

/** Compact column labels for the matrix header. */
function matrixColShort(p, col) {
  if (p.mode === "gridtie") return col.id === "cut60" ? "\u221260% bill" : col.id === "cut80" ? "\u221280% bill" : "\u221295% bill";
  return col.label.split("\u2014")[0].trim();
}

/**
 * The full comparison table: every chemistry against every reliability
 * level. Green outline marks the cheapest true 20-year cost per column.
 */
function matrixHtml(p) {
  const m = p.matrix;
  if (!m) return "";
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
      const cell = m.cells[`${row.id}:${col.id}`];
      const cls = cell && cell.solvable && Number.isFinite(cell.lifetimeCostMid) && cell.lifetimeCostMid === colBest[col.id] ? ' class="matrix-best"' : "";
      if (!cell || !cell.solvable) {
        return `<td${cls}><span style="color:var(--text-muted);">not practical here</span></td>`;
      }
      const rel = p.mode === "offgrid"
        ? `${fmt(cell.unmetHoursPerYear)} h/yr unmet`
        : `-${cell.cutPct}% bill`;
      const lcoe = Number.isFinite(cell.lcoeUsdPerKwh)
        ? `<span style="color:var(--text-muted);">\u00B7 ${(cell.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh</span>` : "";
      return `<td${cls}>${cell.pvKw} kW PV<br>${cell.battKwh > 0 ? fmt(cell.battKwh) + " kWh batt" : "no battery"}` +
        `<br>~${moneyRange(cell.costLo, cell.costHi)}<br><strong>20-yr ~${money(cell.lifetimeCostMid)}</strong><br>${rel} ${lcoe}</td>`;
    }).join("");
    return `<tr><th>${row.label}</th>${cells}</tr>`;
  }).join("");
  return `<div class="matrix-wrap"><table class="matrix-table"><thead><tr><th>Battery \u2193 \u00B7 Goal \u2192</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.55;">Green outline = lowest true 20-year cost in that column (every bank swap counted). "Unmet" hours are covered by a generator or the grid.</p>`;
}

function renderMatrix(p) {
  const grid = $("tierResults");
  if (!grid) return;
  grid.style.display = "block";
  grid.innerHTML = p.matrix ? matrixHtml(p) : "";
}

// ── Hardware list panel (BOM) ────────────────────────────────────────────────

function currentPanelWatts() {
  const v = parseFloat($("panelWatts")?.value);
  return Number.isFinite(v) && v >= 50 ? v : PANEL_WATTS_DEFAULT;
}

function buildFocusBom() {
  const f = lastPayload && lastPayload.focus;
  if (!f) return null;
  const watts = currentPanelWatts();
  return buildBom({
    pvKw: f.pvKw,
    battNameplateKwh: f.battNameplateKwh,
    chemistry: f.chemistry,
    peakLoadW: f.peakLoadW,
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

  const f = lastPayload.focus;
  section("Panels", [
    ["Array", `${f.pvKw} kW \u2192 ${bom.panels.count} \u00D7 ${bom.panels.panelWatts} W = ${bom.panels.kwActual} kW`],
    ["Space needed", `about ${bom.panels.areaM2} m\u00B2 of roof or ground (mounting gaps included)`],
  ]);
  if (bom.voltage) {
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
  const f = lastPayload && lastPayload.focus;
  if (!bom || !f) return;
  const rows = [
    ["BigEnergyCo hardware list - educational estimate, not a quote"],
    ["Generated", new Date().toISOString().slice(0, 10)],
    ["System", `${f.pvKw} kW PV + ${f.battNameplateKwh} kWh nameplate (${bom.chemLabel})`],
    ["Location", `${lastPayload.meta.latitude.toFixed(2)}, ${lastPayload.meta.longitude.toFixed(2)}`],
    [],
    ["Section", "Item", "Quantity / size", "Notes"],
    ["Panels", `${bom.panels.panelWatts} W mono panels`, bom.panels.count, `${bom.panels.kwActual} kW array, about ${bom.panels.areaM2} sq m`],
  ];
  if (bom.voltage && bom.battery) {
    rows.push(
      ["Bank", "System voltage", `${bom.voltage.volts} V`, bom.voltage.rationale],
      ["Bank (DIY)", bom.battery.diy.unitLabel, `${bom.battery.diy.stringsParallel} string(s), ${bom.battery.diy.blocksTotal} cells`, `${bom.battery.diy.stringKwh} kWh per string`],
      ["Bank (retail alt.)", bom.battery.retail.unitLabel, bom.battery.retail.modules, "BMS and enclosure included"],
    );
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

// Typical partial-load fuel burn for small gensets (fuel cost only).
const GEN_L_PER_KWH = { petrol: 0.5, diesel: 0.35 };

function genRateUsd() {
  const type = $("genFuelType")?.value || "petrol";
  const price = parseFloat($("genFuelPrice")?.value);
  if (!(price > 0)) return null;
  return price * (GEN_L_PER_KWH[type] || GEN_L_PER_KWH.petrol);
}

function updateGenHelper() {
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
  const lpk = GEN_L_PER_KWH[$("genFuelType").value] || GEN_L_PER_KWH.petrol;
  readout.textContent = `${typeSel} at this price works out to about $${rate.toFixed(2)} per kWh` +
    ` (${$("genFuelPrice").value} \u00F7 ${lpk} L/kWh \u2014 fuel alone; oil, filters and engine wear push the real number higher).` +
    ` Typical grid power runs $0.10\u20130.30.`;
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
  updateLoadReadout();
  setStatus(` Your generator fuel works out to about $${rate.toFixed(2)}/kWh \u2014 entered as your electricity price, so every payback figure below compares against what you burn today.`);
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

    ? t("tariffSpendLine", { tariff: p.tariff.toFixed(2), annual: money(p.annualGridSpendUsd) })

    : t("tariffSpendOffgrid", { tariff: p.tariff.toFixed(2), annual: money(p.annualGridSpendUsd) });

}

function renderTierCards(p) {

  const grid = $("tierResults");

  grid.innerHTML = "";

  for (const t of p.tiers) {

    const card = el("div", { class: "bom-card" });

    card.style.borderColor = t.id === "tier100" ? "var(--border-glow)" : "var(--border-card)";

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

      ["  - battery unit price", `~$${t.battPerKwhLo}-${t.battPerKwhHi}/kWh stored`],

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
      rows.push(["Your power cost", `${(t.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh` +
        (p.tariff ? ` (grid is ${(p.tariff * 100).toFixed(0)}c)` : "")]);
    }

    if (t.replacementsHorizon > 0) {

      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`]);

    }

    rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);

    appendRows(card, rows);

    card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },

      "Battery + panel component estimate only; excludes inverter, BOS, freight, labor."));

    grid.appendChild(card);

  }

}

function renderTargetCards(p) {

  const grid = $("tierResults");

  grid.innerHTML = "";

  for (const t of p.targets) {

    const card = el("div", { class: "bom-card" });

    card.style.borderColor = t.id === "cut80" ? "var(--border-glow)" : "var(--border-card)";

    card.appendChild(el("div", { class: "bom-badge" }, t.solvable ? `Bill -${t.cutPct}%` : "Not reachable"));

    card.appendChild(el("h3", {}, t.label));

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
      rows.push(["Your power cost", `${(t.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh` +
        (p.tariff ? ` (grid is ${(p.tariff * 100).toFixed(0)}c)` : "")]);
    }

    if (t.replacementsHorizon > 0 && t.battKwh > 0) {

      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`]);

    }

    if (t.battKwh > 0) {

      rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);

    }

    appendRows(card, rows);

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
}

/**

 * AUTO-comparison chart: one panel, each bank drawn against ITS OWN

 * nameplate. Same-job systems deliver similar energy, so the honest visual

 * difference is the reserve each chemistry must carry: lead-acid's entire

 * working range lives in the bottom half of its hardware; lithium/sodium

 * use nearly all of theirs.

 */

function drawAutoChart(p) {

  const wrap = $("socChartWrap");

  const canvas = $("socCanvas");

  const legend = $("socLegend");

  if (!wrap || !canvas) return;

  const raw = p.auto || [];

  if (!raw.length) { wrap.style.display = "none"; return; }

  const entries = raw.filter((a) => a.solvable && a.socNameplatePct && a.socNameplatePct.min && a.socNameplatePct.min.length);

  if (!entries.length) {

    // Data arrived but lacks the expected shape - almost certainly a stale

    // cached module from before this page version. Never fail silently.

    wrap.style.display = "block";

    if (legend) legend.style.display = "none";

    const cap = $("socCaption");

    if (cap) cap.textContent = "\u26A0\uFE0F Chart data didn't match this page version \u2014 please refresh (Ctrl+F5 / \u2318\u21E7R) and run the sizing again.";

    return;

  }

  wrap.style.display = "block";

  const dpr = window.devicePixelRatio || 1;

  const W = Math.max(320, wrap.clientWidth || 640);

  const n = entries[0].socNameplatePct.min.length;

  const pv = (p.history && Array.isArray(p.history.pvDaily) && p.history.pvDaily.length === n) ? p.history.pvDaily : null;

  const stripH = pv ? 64 : 0, stripGap = pv ? 8 : 0;

  const H = 300 + stripH + stripGap;

  canvas.width = W * dpr;

  canvas.height = H * dpr;

  canvas.style.width = W + "px";

  canvas.style.height = H + "px";

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const padL = 46, padR = 12, padT = 16, padB = 22;

  const plotW = W - padL - padR, plotH = H - stripH - stripGap - padT - padB;

  const yMax = 100;

  const panelTop = stripH + stripGap;

  const X = (i) => padL + (i / (n - 1)) * plotW;

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

    // Envelope fill: the full daily range, deepest discharge to fullest.

    ctx.beginPath();

    ctx.moveTo(X(0), Y(max[0]));

    for (let i = 1; i < n; i++) ctx.lineTo(X(i), Y(max[i]));

    for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(i), Y(min[i]));

    ctx.closePath();

    ctx.globalAlpha = 0.2; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;

    // Dashed FULL mark: this bank's own ceiling as % of its nameplate.

    // Lead-acid's sits at ~42% (50% DoD rule x rate derate) - without this

    // line the bank reads as "always nearly empty" when it is at ITS full.

    const fullPct = Math.max(...max);

    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.5; ctx.setLineDash([2, 4]);

    ctx.beginPath(); ctx.moveTo(padL, Y(fullPct)); ctx.lineTo(W - padR, Y(fullPct)); ctx.stroke();

    ctx.setLineDash([]); ctx.globalAlpha = 1;

    // Top edge bold: "does it reach its full mark?" must be unmistakable.

    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.95;

    ctx.beginPath();

    for (let i = 0; i < n; i++) { const y = Y(max[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    // Floor edge thin: how deep the nights and bad stretches dig.

    ctx.lineWidth = 1; ctx.globalAlpha = 0.6;

    ctx.beginPath();

    for (let i = 0; i < n; i++) { const y = Y(min[i]); if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y); }

    ctx.stroke();

    ctx.globalAlpha = 1;

  }

  // x labels: years

  const span = p.history.endYear - p.history.startYear + 1;

  ctx.fillStyle = "#6b7280"; ctx.font = "10px ui-monospace, monospace"; ctx.textAlign = "center";

  for (let yy = 0; yy <= span; yy++) {

    const x = padL + (yy * 365.25 / n) * plotW;

    ctx.fillText(String(p.history.startYear + yy), Math.min(W - padR, Math.max(padL, x)), H - 6);

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

const PAYLOAD_CONTRACT = 5;

function renderResults(p) {

  const inp = readInputs();

  lastPayload = p;

  const isGT = p.mode === "gridtie";

  if (p.contract !== undefined && p.contract !== PAYLOAD_CONTRACT) {

    setStatus("\u26A0\uFE0F This result came from an older engine version \u2014 refresh the page (Ctrl+F5 / \u2318\u21E7R) and run again for complete, current figures.");

  } else {

    setStatus(t("statusSuccess", { years: p.meta.years, dataYears: p.assumptions.dataYears, yield: fmt(p.annualYieldPerKw), offline: p.meta.offline ? t("offlineNote") : "" }));

  }

  renderMoneyBar(p);

  const hasAuto = !!(p.auto && p.auto.length);

  const ladder = $("resultLadder");

  if (ladder) ladder.style.display = hasAuto ? "flex" : "none";

  const bpWrap = $("bestPickWrap");

  if (bpWrap) bpWrap.innerHTML = "";

  const tierGrid = $("tierResults");

  if (tierGrid) tierGrid.style.display = "grid";

  if (hasAuto) {

    syncLadderTabs();

    if (resultLevel === "matrix") renderMatrix(p);

    else if (resultLevel === "compare") renderAutoCards(p);

    else renderBestPick(p);

  }

  else if (isGT) renderTargetCards(p);

  else renderTierCards(p);

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

    (inp.tariff ? `Grid spend assumes $${inp.tariff}/kWh at ${fmtKwh(inp.dailyKwh)} kWh/day.` : "No tariff entered, so payback is not shown.");

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

  window.lastSizingBrief =

    `I sized a system with your calculator for ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)}, ` +

    `${inp.dailyKwh.toFixed(1)} kWh/day from ${inp.basis}, ${p.chemistry === "auto" ? "AUTO chemistry comparison" : p.chemistry.toUpperCase()}` +

    `${p.auto && p.auto.length ? ` (${p.autoNote})` : ""}, ` +

    `${isGT ? "staying connected to the grid (no export" + (inp.exportRate ? ", feed-in credit entered)" : ")") : "fully off-grid"}:\n${recLine}${briefLines.join("\n")}\n` +

    `[ADVISOR INSTRUCTION: These numbers were computed deterministically from NASA POWER hourly weather ` +

    `${p.assumptions.dataYears}. Do not recompute or invent different figures - explain, sanity-check and add caveats ` +

    `(seasonal variation, inverter/BOS costs, installation, degradation) around THESE results. Keep it SHORT: a brief verdict, not an essay.]`;

  $("btnAskAdvisor").style.display = "inline-flex";

  const shareBtn = $("btnShareResult");

  if (shareBtn) shareBtn.style.display = "inline-flex";

  const printBtn = $("btnPrintResult");

  if (printBtn) printBtn.style.display = "inline-flex";

  updateShareHash(p, inp);

  populatePrintSheet(p, inp);

  renderBomPanel();

  if (hasAuto && resultLevel !== "matrix") drawAutoChart(p);

  else if (!hasAuto && p.history && p.history.tiers && p.history.tiers.length) drawSocChart(p.history, p.chemLabel || "battery");

  else $("socChartWrap").style.display = "none";

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

    if (inp.chemistry === "auto") o.a = 1;

    if (inp.chemistry === "auto" && inp.mode !== "gridtie" && $("autoTier")) o.at = $("autoTier").value;

    if (inp.chemistry === "auto" && inp.mode === "gridtie" && $("autoTarget")) o.ac = $("autoTarget").value;

    if (inp.tariff) o.tf = inp.tariff;

    if (inp.exportRate) o.xr = inp.exportRate;

    const sized = p.auto && p.auto.length

      ? p.auto.filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh])

      : p.mode === "gridtie"

        ? p.targets.filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh])

        : p.tiers.filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh]);

    if (sized.length) o.t = sized;

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

  $("coordDetails").open = true;

  setCoords(lat, lon, "Shared result loaded - sunshine data for this location");

  $("loadMode").value = "kwh";

  setLoadPanel();

  if ($("systemGoal")) $("systemGoal").value = o.g === 1 ? "gridtie" : "offgrid";

  $("dailyKwhInput").value = String(kw);

  if (o.a === 1) $("chemSelect").value = "auto";

  else if (o.ch && CHEM_KEYS.has(o.ch)) $("chemSelect").value = o.ch;

  if (o.at && ["tier100", "tier99", "tier95"].includes(o.at) && $("autoTier")) $("autoTier").value = o.at;

  if (o.ac && ["cut60", "cut80", "cut95"].includes(o.ac) && $("autoTarget")) $("autoTarget").value = o.ac;

  if (Number.isFinite(o.xr) && o.xr > 0 && $("exportRate")) $("exportRate").value = String(o.xr);

  if (Number.isFinite(o.tf) && o.tf > 0) {

    tariffTouched = true;

    const cv = $("customRateVal");

    if (cv) {
      const fx = fxActive();
      const display = fx ? o.tf * fx.rate : o.tf;
      cv.value = String(+display.toFixed(4));
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

        Number.isFinite(t.lcoeUsdPerKwh) ? `~${(t.lcoeUsdPerKwh * 100).toFixed(1)}c/kWh` : "n/a",

      ].join("</td><td>") + "</td></tr>"

    ).join("");

  }

  // Hardware summary (focus system) + full options matrix for the printout.
  let hwHtml = "";
  if (p.focus) {
    const bom = buildBom({
      pvKw: p.focus.pvKw,
      battNameplateKwh: p.focus.battNameplateKwh,
      chemistry: p.focus.chemistry,
      peakLoadW: p.focus.peakLoadW,
      panelWatts: PANEL_WATTS_DEFAULT,
    });
    const hwRows = [
      ["Solar panels", `${PANEL_WATTS_DEFAULT} W mono`, `${bom.panels.count} pcs`, `${bom.panels.kwActual} kW · ~${bom.panels.areaM2} m²`],
    ];
    if (bom.voltage && bom.battery) {
      hwRows.push(
        ["Bank voltage", `${bom.voltage.volts} V`, "-", ""],
        ["Battery (DIY)", bom.battery.diy.unitLabel, `${bom.battery.diy.stringsParallel} string(s)`, `${bom.battery.diy.blocksTotal} cells total`],
        ["Battery (retail alt.)", bom.battery.retail.unitLabel, `${bom.battery.retail.modules} pcs`, "BMS included"],
      );
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
    hwHtml = `
      <h2 style="font-size:12pt;margin:10pt 0 4pt;">Hardware list for the recommended system (${bom.chemLabel})</h2>
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

      ${p.chemistry.toUpperCase()} battery - location ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)} -

      ${p.focus ? footprintText(p.focus.pvKw) + " - " : ""}${p.tariff ? `grid price $${p.tariff}/kWh (~$${fmt(p.annualGridSpendUsd)}/yr)` : "no grid price entered"}</p>

    ${hwHtml}

    ${mx ? `<h2 style="font-size:12pt;margin:10pt 0 4pt;">All options compared</h2>${mx}` : ""}

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

  const done = () => setStatus(" Link copied - anyone who opens it gets this same result, re-computed on their device.");

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

  try { document.execCommand("copy"); done(); } catch { setStatus("Copy failed - select the address bar and copy the link manually."); }

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

export function initSizingUI() {

  try {

    renderCities();

    renderAppliances();

    renderBom();

  // tariff input is a single $/kWh field (auto-estimated from location until the user overrides)

  const customVal = $("customRateVal");

  if (customVal) customVal.addEventListener("input", () => { tariffTouched = true; updateLoadReadout(); });

  $("loadMode").addEventListener("change", setLoadPanel);

  $("billAmount").addEventListener("input", updateLoadReadout);

  $("dailyKwhInput").addEventListener("input", updateLoadReadout);

  $("btnGeoLocate").addEventListener("click", locateMe);

  $("btnRunSizing").addEventListener("click", run);

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
      const curVal = parseFloat($("customRateVal")?.value);
      if (Number.isFinite(curVal) && prevFxSnapshot && prevFxSnapshot.rate) {
        const usd = curVal / prevFxSnapshot.rate;
        const nextFx = fxActive();
        if (nextFx && nextFx.rate) {
          $("customRateVal").value = String(+(usd * nextFx.rate).toFixed(4));
        } else if (!nextFx) {
          $("customRateVal").value = String(+usd.toFixed(4));
        }
      }

      currencyTouched = true;

      updateCurrencyUnitLabel();
      prevFxSnapshot = fxActive();

      if (lastPayload) renderResults(lastPayload);

    });

  }

  // Auto-mode basis submenus: switching basis changes the result ? re-run

  // (weather is cached, so this is fast). Visibility follows mode+chemistry.

  $("chemSelect").addEventListener("change", () => { updateAutoRows(); });

  if ($("systemGoal")) $("systemGoal").addEventListener("change", () => { updateAutoRows(); });

  for (const id of ["autoTier", "autoTarget"]) {

    const elNode = $(id);

    if (elNode) elNode.addEventListener("change", () => { if (lastPayload) run(); });

  }

  updateAutoRows();

  setLoadPanel();

  // Interface language (auto-detected, user-overridable in the footer).

  applyI18n();

  initLangPicker($("langSelect"));

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

    if (lastPayload) renderResults(lastPayload);

  } catch { /* offline - static defaults remain */ }

}

// Ensure DOM is ready before initializing

function whenDOMReady(cb) {

  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", cb, { once: true });

  } else {

    // DOMContentLoaded already fired, but element might not be ready yet

    // Poll for the cityPreset element to ensure it exists

    let attempts = 0;

    const maxAttempts = 100; // ~5 seconds at 50ms intervals

    const checkReady = () => {

      const sel = document.getElementById("cityPreset");

      if (sel) {

        cb();

      } else if (attempts < maxAttempts) {

        attempts++;

        setTimeout(checkReady, 50);

      } else {

        console.error("cityPreset element not found after", maxAttempts * 50, "ms");

        cb(); // proceed anyway to avoid deadlock

      }

    };

    checkReady();

  }

}

whenDOMReady(initSizingUI);

