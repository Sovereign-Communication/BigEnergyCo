// Size-My-System UI controller. Loaded as an ES module from index.html.
// All computation happens in sizing-worker.js; this file is DOM glue only.
//
// Load input is end-user-first: an appliance checklist with plain-language
// quantity and usage sliders, a monthly-bill mode, and a tucked-away
// direct-kWh mode for people who already know their numbers.

import { CITY_PRESETS, } from "./nasa.js?v=20260825d";
import { estimateTariff, battOnlyCost, CURRENCIES, fxMeta } from "./pricing.js?v=20260825d";
import { BOM_ITEMS } from "../shared/content.js?v=20260825d";
import { applyI18n, initLangPicker } from "../shared/i18n.js?v=20260825d";

let worker = null;
let lastPayload = null;   // kept for share links + the printable summary

// The legacy storage-comparison script (classic inline JS) reads scoped
// prices through this bridge — pricing.js stays the single source of truth.
window.BECO_BATT_COST = battOnlyCost;

// ── Appliance library ───────────────────────────────────────────────────────
// w = watts WHILE RUNNING. duty:true items (fridges, ACs, pumps) only run a
// fraction of the day — their slider means "hours it actually runs," capped
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

const TARIFFS = [
  { n: "Global average — about $0.28 per kWh", v: 0.28 },
  { n: "US average — about $0.16 per kWh", v: 0.16 },
  { n: "Europe / UK — about $0.38 per kWh", v: 0.38 },
  { n: "Hawaii / islands — about $0.42 per kWh", v: 0.42 },
  { n: "I'll type my own rate", v: "custom" },
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

// ── Load-mode plumbing ──────────────────────────────────────────────────────

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
  const sel = $("tariffSelect");
  const v = sel.value === "custom" ? parseFloat($("customRateVal").value) : parseFloat(sel.value);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function updateLoadReadout() {
  const mode = $("loadMode").value;
  const out = $(mode === "appliances" ? "readoutAppliances" : mode === "bill" ? "readoutBill" : "readoutKwh");
  if (!out) return;
  if (mode === "appliances") {
    const { kwh, peakW, count } = applianceState();
    if (!count) {
      out.textContent = "Tick the things you want to power, and your daily energy shows up here.";
    } else {
      out.innerHTML = "";
      out.appendChild(el("span", {}, `Estimated use: about ${fmtKwh(kwh)} kWh/day`));
      out.appendChild(el("span", { style: "color:var(--text-muted);font-weight:400;" },
        `  ·  everything running at once ≈ ${peakW.toLocaleString()} W (your inverter should be bigger than this)`));
    }
  } else if (mode === "bill") {
    const bill = parseFloat($("billAmount").value);
    const rate = getTariff();
    if (Number.isFinite(bill) && bill > 0 && Number.isFinite(rate) && rate > 0) {
      const kwhDay = bill / (rate * 30.44);
      out.textContent = `That works out to about ${fmtKwh(kwhDay)} kWh/day of average use.`;
    } else {
      out.textContent = "Enter your monthly bill amount to see the daily energy estimate.";
    }
  } else {
    const kwh = parseFloat($("dailyKwhInput").value);
    out.textContent = Number.isFinite(kwh) && kwh > 0
      ? `Using ${kwh} kWh/day directly.`
      : "Enter a daily kWh figure.";
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
      const minus = el("span", { class: "btn btn-outline", style: "padding:0.05rem 0.55rem;font-size:0.9rem;cursor:pointer;user-select:none;" }, "−");
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
          if (it.duty) txt += ` (≈${Math.round((it.w * h) / 24)} W avg)`;
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

// ── Location plumbing ───────────────────────────────────────────────────────

function setCoords(lat, lon, label) {
  $("latInput").value = Math.round(lat * 100) / 100;
  $("lonInput").value = Math.round(lon * 100) / 100;
  $("locNote").textContent = label;
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
  const sel = $("tariffSelect");
  // Auto-select the country's currency first, then express the estimated
  // tariff in it — the two share one FX rate, so they round-trip exactly.
  if (est.currency && !currencyTouched && CURRENCIES[est.currency]) setCurrency(est.currency);
  const fx = fxActive();
  const shownRate = fx ? +(est.rate * fx.rate).toFixed(2) : est.rate;
  const match = [...sel.options].find((o) => o.value === String(shownRate));
  if (match) {
    sel.value = shownRate.toFixed(2);
  } else {
    sel.value = "custom";
    $("customRateVal").value = String(shownRate);
    $("customRate").style.display = "block";
  }
  const note = el("div", { style: "font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;" },
    `Electricity price estimated for ${est.label}${fx ? ` (≈ ${est.rate.toFixed(2)} US$/kWh)` : ""} — change it above if you know your rate.`);
  const existing = document.getElementById("tariffNote");
  if (existing) existing.remove();
  sel.closest(".form-group").appendChild(note);
  note.id = "tariffNote";
  updateLoadReadout();
}

function renderCities() {
  const sel = $("cityPreset");
  sel.innerHTML = "";
  const regions = [...new Set(CITY_PRESETS.map((c) => c.r))];
  for (const r of regions) {
    const og = el("optgroup", { label: r });
    CITY_PRESETS.filter((c) => c.r === r).forEach((c, i) => {
      const o = el("option", { value: String(CITY_PRESETS.indexOf(c)) }, c.name);
      og.appendChild(o);
    });
    sel.appendChild(og);
  }
  sel.value = "0";
  sel.addEventListener("change", () => {
    const c = CITY_PRESETS[parseInt(sel.value, 10)];
    if (c) setCoords(c.lat, c.lon, `Sunshine data from ${c.name}`);
  });
  // initialize to first city
  const first = CITY_PRESETS[0];
  setCoords(first.lat, first.lon, `Sunshine data from ${first.name}`);
}

function locateMe() {
  if (!navigator.geolocation) {
    setStatus("⚠️ Your browser can't share a location — pick the nearest big city instead.");
    return;
  }
  setStatus("⏳ Asking your browser for your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setCoords(pos.coords.latitude, pos.coords.longitude, "Using your precise location");
      $("coordDetails").open = true;
      setStatus("📍 Location set. Now tell us your power use below, then run the sizing.");
    },
    () => setStatus("⚠️ Couldn't get your location — pick the nearest big city instead."),
    { timeout: 8000 }
  );
}

// ── Inputs → engine ─────────────────────────────────────────────────────────

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
    dailyKwh = bill / (rate * 30.44);
  } else {
    dailyKwh = parseFloat($("dailyKwhInput").value);
  }

  let basis = "direct kWh entry";
  if (mode === "appliances") basis = "appliance checklist";
  else if (mode === "bill") basis = "monthly electric bill";

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
    setStatus("⚠️ Pick a city (or use 📍 My location) so we know your sunshine.");
    return;
  }
  if (!Number.isFinite(inp.dailyKwh) || inp.dailyKwh <= 0 || inp.dailyKwh > 500) {
    setStatus("⚠️ Tell us your power use — tick some appliances, or enter a bill or kWh figure.");
    return;
  }
  setStatus(inp.mode === "gridtie"
    ? "⏳ Fetching five years of satellite weather and searching bill-cutting system sizes…"
    : "⏳ Fetching 5 years of hourly satellite weather and searching system sizes…");
  const btn = $("btnRunSizing");
  btn.disabled = true;
  btn.innerHTML = '<span class="spin">◐</span> Running 5-year simulation…';
  ensureWorker().postMessage({ type: "run", ...inp });
}

function restoreRunButton() {
  const btn = $("btnRunSizing");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = "☀️ Size My System (5-yr simulation)";
  }
}

function ensureWorker() {
  if (!worker) {
    worker = new Worker("./assets/js/sizing/sizing-worker.js?v=20260825d", { type: "module" });
    worker.onmessage = (ev) => {
      if (ev.data?.type === "ok") {
        renderResults(ev.data.payload);
        // bring the results into view — the run button can be far above them
        const res = $("tierResults");
        if (res) { res.setAttribute("tabindex", "-1"); res.scrollIntoView({ behavior: "smooth", block: "start" }); }
      } else if (ev.data?.type === "error") setStatus("⚠️ " + ev.data.message);
      restoreRunButton();
    };
    worker.onerror = () => {
      setStatus("⚠️ Sizing engine failed to load.");
      restoreRunButton();
    };
  }
  return worker;
}

function fmt(n) { return Number(n).toLocaleString(); }

function fmtLife(years) {
  if (!Number.isFinite(years) || years <= 0) return "—";
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
  if (!a || !b) return "—";
  return a === b ? a : `${a}–${b.replace("~", "")}`;
}

// User currency (optional): converts every displayed dollar AMOUNT at the
// user's rate. Price scopes themselves are USD-denominated, so unit rates
// ($/kWh stored) stay labeled $ — the arithmetic panel explains that.
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
  tier100: "100% · never needs a generator",
  tier99: "99% · generator as rare backup",
  tier95: "95% · generator now and then",
  cut60: "~60% bill cut · grid covers the rest",
  cut80: "~80% bill cut · small grid top-ups",
  cut95: "~95% bill cut · near off-grid",
  "auto-naion": "Sodium-Ion bank over five real years",
  "auto-lfp": "LFP bank over five real years",
  "auto-agm": "Lead-Acid (AGM) bank over five real years",
};

/**
 * Reliability chart, deliberately simple: one stacked panel per system, one
 * line per panel — the LOWEST the battery got each day over five years.
 * Flat and high = dependable. Dives to the red line = generator territory.
 */
function drawSocChart(history, chemLabel) {
  const wrap = $("socChartWrap");
  const canvas = $("socCanvas");
  if (!wrap || !canvas) return;

  const solvable = history.tiers.filter((t) => t.dailyMin && t.dailyMax && t.dailyMin.length);
  if (!solvable.length) {
    // Data arrived but in an unexpected shape — almost certainly a stale
    // cached module. Never fail silently: say so.
    wrap.style.display = "block";
    const cap = $("socCaption");
    if (cap) cap.textContent = "⚠️ Chart data didn't match this page version — please refresh (Ctrl+F5 / ⌘⇧R) and run the sizing again.";
    return;
  }
  wrap.style.display = "block";

  // hide the old legend row — labels live inside each band now
  const legend = $("socLegend");
  if (legend) legend.style.display = "none";

  const gt = history.kind === "gridtie";
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, wrap.clientWidth || 640);
  const BAND_H = 118, GAP = 14;
  const H = solvable.length * BAND_H + (solvable.length - 1) * GAP + 20;
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
    for (const v of [50, 100]) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
      ctx.fillStyle = "#6b7280"; ctx.textAlign = "right";
      ctx.fillText(v + "%", padL - 5, Y(v) + 3);
    }
    ctx.strokeStyle = "rgba(239,68,68,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(239,68,68,0.85)"; ctx.textAlign = "left";
    ctx.fillText(gt ? "bank empty" : "empty", W - padR - (gt ? 74 : 38), Y(0) - 4);

    // FULL daily range: fill between each day's highest and lowest charge.
    // The top edge is the battery charging back to full — every system's
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
      ? (gt ? `${charged} · but drained flat on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"} — the grid covered those`
            : `${charged} · but hit empty on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"}`)
      : `${charged} · never went empty`;
    ctx.fillText(`lowest point ${Math.max(0, Math.round(t.minPct))}% — ${verdict}`, padL + 2, top + padT + 14);
  }

  solvable.forEach((t, idx) => drawBand(t, idx * (BAND_H + GAP)));

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
      `${history.startYear}–${history.endYear} of real satellite weather. In grid-tie mode the red line isn't a blackout — ` +
      `when the band dives to it, the grid covered those hours instead (that's your remaining bill). Flat, high bands mean solar and battery are doing the work.`
    : `Each band spans one day: top edge = fullest the battery got, bottom edge = deepest discharge, ` +
      `${history.startYear}–${history.endYear} of real satellite weather (${chemLabel}). Every healthy system ` +
      `charges all the way back to 100% on sunny days — the difference between systems is how far the bottom ` +
      `edge dives toward empty during bad weather. Touch the red line and a generator is covering you.`;
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
    card.appendChild(el("div", { class: "bom-badge" }, isGT && a.cutPct ? `Bill −${a.cutPct}%` : "Same job done"));
    card.appendChild(el("h3", {}, a.chemLabel));

    if (!a.solvable) {
      card.appendChild(el("p", {}, "Not practical at this site/load within search limits."));
      grid.appendChild(card);
      continue;
    }

    const rows = [
      ["Solar array", `${a.pvKw} kW`],
      ["Bank usable", `${fmt(a.battKwh)} kWh · ≈${fmt(a.battNameplateKwh)} kWh nameplate`],
      ["Depth-of-discharge window", `uses ${(a.usableDod * 100).toFixed(0)}% of nameplate`],
      ["First cost", `~${moneyRange(a.costLo, a.costHi)}`],
      ["Bank swaps over 20 yr", a.replacementsHorizon > 0 ? `~${a.replacementsHorizon}× (life ≈ ${fmtLife(a.batteryLifeYears)})` : "none expected"],
    ];
    if (a.swapsAndLaborUsd > 0) {
      rows.push(["Swaps + labor add", `≈${money(a.swapsAndLaborUsd)}`]);
    }
    rows.push(["True 20-yr cost", `≈${money(a.lifetimeCostMid)}` + (a.chemistry === bestId ? " ← cheapest bank" : "")]);
    if (isGT) {
      rows.push(["Bill after solar", a.billAfterMonthlyUsd !== null ? `≈${money(a.billAfterMonthlyUsd)}/mo` : "needs your tariff"]);
      rows.push(["Sun clipped (no export)", `${fmt(a.clippedKwhPerYear)} kWh/yr`]);
      if (a.exportValueAnnualUsd > 0) {
        rows.push(["Feed-in credit on clipped sun", `+${money(a.exportValueAnnualUsd)}/yr`]);
      }
    }
    // Headline economics: TRUE break-even counts every swap. When a bank
    // wears out fast enough that it never catches up, say so outright.
    // undefined = stale payload (contract warning already shown) → omit row.
    if (p.tariff && a.trueBreakEvenYear !== undefined) {
      if (typeof a.trueBreakEvenYear === "number") {
        rows.push(["Breaks even on true cost in", `≈ year ${a.trueBreakEvenYear} of ownership`]);
        if (a.replacementsHorizon > 0 && a.paybackYearsLo !== null) {
          rows.push(["  · first cost alone pays back in", fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi)]);
        }
      } else {
        rows.push(["True 20-yr break-even", "never — replacements outpace savings"]);
      }
    } else if (!p.tariff && a.paybackYearsLo !== null) {
      rows.push(["Pays for itself in", fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi)]);
    }
    if (Number.isFinite(a.lcoeUsdPerKwh)) {
      rows.push(["Your solar power costs", `≈${(a.lcoeUsdPerKwh * 100).toFixed(1)}¢/kWh` +
        (p.tariff ? ` (grid: ${(p.tariff * 100).toFixed(0)}¢)` : "")]);
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

function renderMoneyBar(p) {
  const moneyBar = $("moneyBar");
  if (!moneyBar) return;
  if (!p.annualGridSpendUsd || !p.tariff) {
    moneyBar.style.display = "none";
    return;
  }
  moneyBar.style.display = "block";
  moneyBar.textContent = p.mode === "gridtie"
    ? `At $${p.tariff.toFixed(2)}/kWh, your power costs about ${money(p.annualGridSpendUsd)} per year today. Each option below shows the bill after solar and how fast it repays itself out of the savings.`
    : `At $${p.tariff.toFixed(2)}/kWh, this use costs about ${money(p.annualGridSpendUsd)} per year in grid power. Payback figures below compare system cost against that spend.`;
}

function renderTierCards(p) {
  const grid = $("tierResults");
  grid.innerHTML = "";
  for (const t of p.tiers) {
    const card = el("div", { class: "bom-card" });
    card.style.borderColor = t.id === "tier100" ? "var(--border-glow)" : "var(--border-card)";

    card.appendChild(el("div", { class: "bom-badge" },
      t.id === "tier100" ? "No generator" : t.id === "tier99" ? "Rare generator" : "Generator OK"));

    card.appendChild(el("h3", {}, t.label.split("—")[1]?.trim() || t.label));

    if (!t.solvable) {
      card.appendChild(el("p", {}, "No system found within search limits for this load — the daily consumption may be too high for a practical off-grid build at this site."));
      grid.appendChild(card);
      continue;
    }

    const rows = [
      ["Solar array", `${t.pvKw} kW`],
      ["Battery (usable)", `${fmt(t.battKwh)} kWh · ≈${fmt(t.battNameplateKwh)} nameplate`],
      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],
      ["  · panels + inverter", `~${moneyRange(t.pvCostLo, t.pvCostHi)}`],
      ["  · battery bank", `~${moneyRange(t.battCostLo, t.battCostHi)}`],
      ["  · battery unit price", `≈$${t.battPerKwhLo}–${t.battPerKwhHi}/kWh stored`],
      ["Unmet hours", `${fmt(t.unmetHoursPerYear)} h/yr`],
      ["Longest gap", `${fmt(t.longestGapHours)} h`],
      ["Battery life est.", fmtLife(t.batteryLifeYears)],
      [`Cycles on the bank`, `~${fmt(t.cyclesPerYear)}/yr`],
    ];
    if (t.paybackYearsLo !== null && t.paybackYearsHi !== null) {
      rows.push(["Pays back its first cost in", fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi)]);
    }
    if (typeof t.trueBreakEvenYear === "number" || (t.trueBreakEvenYear === null && t.replacementsHorizon > 0)) {
      rows.push(["Breaks even on true 20-yr cost", typeof t.trueBreakEvenYear === "number"
        ? `\u2248 year ${t.trueBreakEvenYear} (every swap counted)`
        : "never \u2014 swaps outpace savings"]);
    }
    if (Number.isFinite(t.lcoeUsdPerKwh)) {
      rows.push(["Your solar power costs", `≈${(t.lcoeUsdPerKwh * 100).toFixed(1)}¢/kWh` +
        (p.tariff ? ` (grid: ${(p.tariff * 100).toFixed(0)}¢)` : "")]);
    }
    if (t.replacementsHorizon > 0) {
      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}× · adds ≈${money(t.swapsAndLaborUsd)} with labor`]);
    }
    rows.push(["True 20-yr cost", `≈${money(t.lifetimeCostMid)}`]);
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
    card.appendChild(el("div", { class: "bom-badge" }, t.solvable ? `Bill −${t.cutPct}%` : "Not reachable"));
    card.appendChild(el("h3", {}, t.label));

    if (!t.solvable) {
      card.appendChild(el("p", {}, "Even a large array can't cut the bill this far at this location — check the off-grid sizer instead."));
      grid.appendChild(card);
      continue;
    }

    const rows = [
      ["Solar array", `${t.pvKw} kW`],
      ["Battery (usable)", t.battKwh > 0 ? `${fmt(t.battKwh)} kWh · ≈${fmt(t.battNameplateKwh)} nameplate` : "none needed"],
      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],
      ["Bill after solar", t.billAfterMonthlyUsd !== null ? `≈${money(t.billAfterMonthlyUsd)}/mo (was ≈${money(Math.round(p.annualGridSpendUsd / 12))})` : "needs your tariff"],
      ["Imported from grid", `${fmt(t.importedKwhPerYear)} kWh/yr`],
    ];
    const exportActive = t.exportValueAnnualUsd > 0;
    if (exportActive) {
      rows.push(["Feed-in credit on clipped sun", `+${money(t.exportValueAnnualUsd)}/yr (${fmt(t.clippedKwhPerYear)} kWh clipped)`]);
    } else if (t.clippedKwhPerYear > 50) {
      rows.push(["Sun clipped (no export)", `${fmt(t.clippedKwhPerYear)} kWh/yr — enter a feed-in credit to value it`]);
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
      rows.push(["Your solar power costs", `≈${(t.lcoeUsdPerKwh * 100).toFixed(1)}¢/kWh` +
        (p.tariff ? ` (grid: ${(p.tariff * 100).toFixed(0)}¢)` : "")]);
    }
    if (t.replacementsHorizon > 0 && t.battKwh > 0) {
      rows.push(["Battery swaps over 20 yr", `~${t.replacementsHorizon}× · adds ≈${money(t.swapsAndLaborUsd)} with labor`]);
    }
    if (t.battKwh > 0) {
      rows.push(["True 20-yr cost", `≈${money(t.lifetimeCostMid)}`]);
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
    const accent = /^(Cost|Pays|Your solar|Bill|Breaks even|True )/.test(k) && !danger;
    const line = el("div", { style: "display:flex;justify-content:space-between;font-size:0.9rem;padding:0.2rem 0;border-bottom:1px solid var(--border-card);" });
    line.appendChild(el("span", { style: "color:var(--text-muted);" }, k));
    line.appendChild(el("span", {
      style: "font-family:var(--font-mono);font-weight:700;color:" + (danger ? "var(--danger-red)" : accent ? "var(--primary-accent)" : "var(--text-main)"),
    }, v));
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
    // Data arrived but lacks the expected shape — almost certainly a stale
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
  const H = 300;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const padL = 46, padR = 12, padT = 16, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = entries[0].socNameplatePct.min.length;
  const yMax = 100;
  const X = (i) => padL + (i / (n - 1)) * plotW;
  const Y = (pct) => padT + (1 - pct / yMax) * plotH;

  // frame + gridlines
  ctx.font = "10px ui-monospace, monospace";
  for (const v of [0, 25, 50, 75, 100]) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
    ctx.fillStyle = "#6b7280"; ctx.textAlign = "right";
    ctx.fillText(v + "%", padL - 6, Y(v) + 3);
  }
  ctx.save();
  ctx.translate(11, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.fillStyle = "#9ca3af";
  ctx.fillText("charge as % of that bank's nameplate", 0, 0);
  ctx.restore();

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
    // Lead-acid's sits at ~42% (50% DoD rule × rate derate) — without this
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
        `${a.chemLabel.replace(/ \(.*\)/, "")} · ${fmt(a.battNameplateKwh)} kWh nameplate` +
        (a.replacementsHorizon > 0 ? ` · ~${a.replacementsHorizon} swaps/20yr` : " · no swaps")));
      legend.appendChild(chip);
    }
  }

  const ceilings = entries
    .map((a) => `${a.chemLabel.replace(/ \(.*\)/, "")} ${Math.round(Math.max(...a.socNameplatePct.max))}%`)
    .join(" · ");
  $("socCaption").textContent =
    `How to read it: the shaded area is each bank's daily range — the bold top edge is the fullest it got, the thin lower edge the deepest it sank, and the dashed line is that bank's FULL mark (${ceilings} of nameplate). ` +
    `Every chemistry carries similar nameplate for the same job; the real difference is the usable slice — lithium and sodium may use ~90% of theirs, lead-acid only its bottom half (the 50% rule, times its discharge-rate derate). ` +
    `Sodium rides standard LFP voltage settings: slightly less capacity, gentler discharge, longer life. ` +
    `Dips to the floor during ${p.history.startYear}–${p.history.endYear}'s worst weather are the moments a generator or the grid would cover you.`;
}

// Must match run.js PAYLOAD_CONTRACT. Mismatch = stale cached module.
const PAYLOAD_CONTRACT = 3;

function renderResults(p) {
  const inp = readInputs();
  lastPayload = p;
  const isGT = p.mode === "gridtie";
  if (p.contract !== undefined && p.contract !== PAYLOAD_CONTRACT) {
    setStatus("\u26A0\uFE0F This result came from an older engine version \u2014 refresh the page (Ctrl+F5 / \u2318\u21E7R) and run again for complete, current figures.");
  } else {
    setStatus(`\u2705 ${p.meta.years} yr of hourly data (${p.assumptions.dataYears}) \u00b7 ${fmt(p.annualYieldPerKw)} kWh/yr per kW of panel.` +
      (p.meta.offline ? " \u00b7 \uD83D\uDDF4 offline typical-year mode" : ""));
  }

  renderMoneyBar(p);
  if (p.auto && p.auto.length) renderAutoCards(p);
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
    `Costs span ${pr.basisLabel || "ex-factory China to PowMr-class budget retail"} (${pr.source || "cell market indications through PowMr catalog, Aug 2026"}) — ` +
    `the low end is components before freight/duty/BMS, the high end is shipped retail with BMS and enclosure included. ` +
    (a.money ? a.money + " " : "") +
    (a.capacityNote ? a.capacityNote + " " : "") +
    (fxNote() ? fxNote() + " " : "") +
    (a.offline ? "OFFLINE MODE: this run used the bundled typical-year profile for " + p.meta.offlineCity + " — a close approximation, not your exact site. Re-run online for five years of point-specific weather. " : "") +
    (inp.tariff ? `Grid spend assumes $${inp.tariff}/kWh at ${fmtKwh(inp.dailyKwh)} kWh/day.` : "No tariff entered, so payback is not shown.");

  let briefLines;
  if (p.auto && p.auto.length) {
    briefLines = p.auto.filter((t) => t.solvable).map((t) =>
      `- ${t.chemLabel}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (≈${fmt(t.battNameplateKwh)} kWh nameplate at ${(t.usableDod * 100).toFixed(0)}% DoD), first cost ~${moneyRange(t.costLo, t.costHi)}, ` +
      `${t.replacementsHorizon > 0 ? `${t.replacementsHorizon} bank swaps (+${money(t.swapsAndLaborUsd)} with labor)` : "no swaps expected"} → true 20-yr cost ≈${money(t.lifetimeCostMid)}`);
  } else if (isGT) {
    briefLines = p.targets.filter((t) => t.solvable)
      .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${t.battKwh > 0 ? fmt(t.battKwh) + " kWh usable" : "no battery"} (~${moneyRange(t.costLo, t.costHi)}) → bill −${t.cutPct}%` +
        (t.billAfterMonthlyUsd !== null ? `, ≈${money(t.billAfterMonthlyUsd)}/mo after` : ""));
  } else {
    briefLines = p.tiers.filter((t) => t.solvable)
      .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~${moneyRange(t.costLo, t.costHi)}, ex-factory to budget-retail range)`);
  }
  window.lastSizingBrief =
    `I sized a system with your calculator for ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)}, ` +
    `${inp.dailyKwh.toFixed(1)} kWh/day from ${inp.basis}, ${p.chemistry === "auto" ? "AUTO chemistry comparison" : p.chemistry.toUpperCase()}` +
    `${p.auto && p.auto.length ? ` (${p.autoNote})` : ""}, ` +
    `${isGT ? "staying connected to the grid (no export" + (inp.exportRate ? ", feed-in credit entered)" : ")") : "fully off-grid"}:\n${briefLines.join("\n")}\n` +
    `[ADVISOR INSTRUCTION: These numbers were computed deterministically from NASA POWER hourly weather ` +
    `${p.assumptions.dataYears}. Do not recompute or invent different figures — explain, sanity-check and add caveats ` +
    `(seasonal variation, inverter/BOS costs, installation, degradation) around THESE results. Keep it SHORT: a brief verdict, not an essay.]`;
  $("btnAskAdvisor").style.display = "inline-flex";
  const shareBtn = $("btnShareResult");
  if (shareBtn) shareBtn.style.display = "inline-flex";
  const printBtn = $("btnPrintResult");
  if (printBtn) printBtn.style.display = "inline-flex";

  updateShareHash(p, inp);
  populatePrintSheet(p, inp);

  if (p.auto && p.auto.length) drawAutoChart(p);
  else if (p.history && p.history.tiers && p.history.tiers.length) drawSocChart(p.history, p.chemLabel || "battery");
  else $("socChartWrap").style.display = "none";
}

// ── Shareable results ───────────────────────────────────────────────────────
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
  setCoords(lat, lon, "Shared result loaded — sunshine data for this location");
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
    const sel = $("tariffSelect");
    const match = [...sel.options].find((opt) => opt.value === String(o.tf));
    if (match) { sel.value = String(o.tf); $("customRate").style.display = "none"; }
    else { sel.value = "custom"; $("customRateVal").value = String(o.tf); $("customRate").style.display = "block"; }
  }
  setStatus("🔗 Loaded a shared result — running the simulation for this location…");
  return true;
}

// ── Printable summary ───────────────────────────────────────────────────────
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
        `${fmt(t.battKwh)} kWh (≈${fmt(t.battNameplateKwh)})`,
        moneyRange(t.costLo, t.costHi),
        t.replacementsHorizon > 0 ? `~${t.replacementsHorizon}×` : "none",
        t.swapsAndLaborUsd > 0 ? `≈${money(t.swapsAndLaborUsd)}` : "—",
        `≈${money(t.lifetimeCostMid)}`,
        typeof t.trueBreakEvenYear === "number" ? `≈ year ${t.trueBreakEvenYear}`
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
        `−${t.cutPct}% bill`,
        t.billAfterMonthlyUsd !== null ? `≈${money(t.billAfterMonthlyUsd)}/mo` : "n/a",
        t.paybackYearsLo !== null ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) : "n/a",
      ].join("</td><td>") + "</td></tr>"
    ).join("");
  } else {
    title = "Off-Grid System Estimate";
    head = "<tr><th>System</th><th>Solar</th><th>Battery (usable)</th><th>Component cost</th><th>Payback vs. grid</th><th>Energy cost</th></tr>";
    rows = p.tiers.filter((t) => t.solvable).map((t) =>
      "<tr><td>" + [
        t.label.replace(/—/g, "·"),
        `${t.pvKw} kW`,
        `${fmt(t.battKwh)} kWh`,
        moneyRange(t.costLo, t.costHi),
        t.paybackYearsLo !== null ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) : "n/a",
        Number.isFinite(t.lcoeUsdPerKwh) ? `≈${(t.lcoeUsdPerKwh * 100).toFixed(1)}¢/kWh` : "n/a",
      ].join("</td><td>") + "</td></tr>"
    ).join("");
  }
  sheet.innerHTML = `
    <h1 style="font-size:20pt;margin-bottom:2pt;">BigEnergyCo — ${title}</h1>
    <p style="font-size:9pt;color:#444;margin-bottom:10pt;">
      Generated ${new Date().toISOString().slice(0, 10)} · free educational estimate ·
      ${location.origin + location.pathname}
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:10pt;margin-bottom:10pt;">
      <tr style="background:#eef2f7;">${head}</tr>
      ${rows}
    </table>
    <p style="font-size:9.5pt;margin:0 0 4pt;"><strong>Basis:</strong> ${inp.basis} · ${fmtKwh(inp.dailyKwh)} kWh/day ·
      ${p.chemistry.toUpperCase()} battery · location ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)} ·
      ${p.tariff ? `grid price $${p.tariff}/kWh (≈$${fmt(p.annualGridSpendUsd)}/yr)` : "no grid price entered"}</p>
    <p style="font-size:9.5pt;margin:0 0 4pt;"><strong>Method:</strong> hourly simulation of ${p.assumptions.dataYears} of
      NASA POWER satellite weather (${p.meta.source})${isGT ? "; the system never exports power to the grid" : ""}.
      Derates: soiling ${(p.assumptions.derates.soiling * 100).toFixed(0)}%,
      wiring ${(p.assumptions.derates.wiring * 100).toFixed(0)}%, mismatch ${(p.assumptions.derates.mismatch * 100).toFixed(0)}%,
      MPPT ${(p.assumptions.derates.mppt * 100).toFixed(0)}%; cell-temp model NOCT ${p.assumptions.noctC}°C,
      ${(p.assumptions.gammaPerC * 100).toFixed(2)}%/°C; inverter ${(p.assumptions.etaInverter * 100).toFixed(0)}%.
      Costs are components only (ex-factory China through shipped budget retail) and exclude freight, duty, labor,
      permits, and mounting.${p.auto && p.auto.length ? ` ${p.autoNote}.` : ""}</p>
    <p style="font-size:8.5pt;color:#333;border-top:1px solid #999;padding-top:5pt;margin-top:8pt;">
      Educational estimate only — not engineering, not a quote, no warranty. Battery banks, high DC current and
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
  const done = () => setStatus("🔗 Link copied — anyone who opens it gets this same result, re-computed on their device.");
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
  try { document.execCommand("copy"); done(); } catch { setStatus("Copy failed — select the address bar and copy the link manually."); }
  ta.remove();
}

// ── Hardware reference (BOM) — rendered from the shared content module ─────

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
  renderCities();
  renderAppliances();
  renderBom();

  // tariff select (auto-estimated from location until the user overrides)
  const tsel = $("tariffSelect");
  TARIFFS.forEach((t) => tsel.appendChild(el("option", { value: t.v === "custom" ? "custom" : String(t.v) }, t.n)));
  tsel.value = "0.28";
  tsel.addEventListener("change", () => {
    tariffTouched = true;
    const custom = tsel.value === "custom";
    $("customRate").style.display = custom ? "block" : "none";
    updateLoadReadout();
  });
  $("customRateVal").addEventListener("input", () => { tariffTouched = true; updateLoadReadout(); });

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

  // Currency inputs re-render the existing result instantly — no re-run
  // needed, since FX is a display-only transform on the same numbers.
  for (const id of ["fxRate", "fxCode"]) {
    const elNode = $(id);
    if (elNode) elNode.addEventListener("input", () => {
      currencyTouched = true;
      updateCurrencyUnitLabel();
      if (lastPayload) renderResults(lastPayload);
    });
  }

  // Auto-mode basis submenus: switching basis changes the result → re-run
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
  } catch { /* offline — static defaults remain */ }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSizingUI);
} else {
  initSizingUI();
}
