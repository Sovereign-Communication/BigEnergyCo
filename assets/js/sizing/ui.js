// Size-My-System UI controller. Loaded as an ES module from index.html.
// All computation happens in sizing-worker.js; this file is DOM glue only.
//
// Load input is end-user-first: an appliance checklist with plain-language
// quantity and usage sliders, a monthly-bill mode, and a tucked-away
// direct-kWh mode for people who already know their numbers.

import { CITY_PRESETS } from "./nasa.js?v=20260823f";
import { PRICING_SCOPES } from "./pricing.js?v=20260823f";

let worker = null;

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
  if (sel.value === "custom") return parseFloat($("customRateVal").value);
  return parseFloat(sel.value);
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
    basis,
    pricingScope: $("pricingScope").value,
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
  setStatus("⏳ Fetching 5 years of hourly satellite weather and searching system sizes…");
  $("btnRunSizing").disabled = true;
  ensureWorker().postMessage({ type: "run", ...inp });
}

function ensureWorker() {
  if (!worker) {
    worker = new Worker("./assets/js/sizing/sizing-worker.js?v=20260823f", { type: "module" });
    worker.onmessage = (ev) => {
      if (ev.data?.type === "ok") renderResults(ev.data.payload);
      else if (ev.data?.type === "error") setStatus("⚠️ " + ev.data.message);
      $("btnRunSizing").disabled = false;
    };
    worker.onerror = () => {
      setStatus("⚠️ Sizing engine failed to load.");
      $("btnRunSizing").disabled = false;
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

const TIER_COLORS = { tier100: "#00e699", tier99: "#60a5fa", tier95: "#f59e0b" };
const TIER_NAMES = {
  tier100: "100% · never needs a generator",
  tier99: "99% · generator as rare backup",
  tier95: "95% · generator now and then",
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
    ctx.fillText("empty", W - padR - 38, Y(0) - 4);

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
      ? `${charged} · but hit empty on ${t.emptyDays} day${t.emptyDays === 1 ? "" : "s"}`
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

  $("socCaption").textContent =
    `Each band spans one day: top edge = fullest the battery got, bottom edge = deepest discharge, ` +
    `${history.startYear}–${history.endYear} of real satellite weather (${chemLabel}). Every healthy system ` +
    `charges all the way back to 100% on sunny days — the difference between systems is how far the bottom ` +
    `edge dives toward empty during bad weather. Touch the red line and a generator is covering you.`;
}

function renderResults(p) {
  const inp = readInputs();
  setStatus(`✅ ${p.meta.years} yr of hourly data (${p.meta.dataYears}) · ${fmt(p.annualYieldPerKw)} kWh/yr per kW of panel.`);
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
    } else {
      const rows = [
        ["Solar array", `${t.pvKw} kW`],
        ["Battery (usable)", `${fmt(t.battKwh)} kWh`],
        ["Component cost est.", `~$${fmt(t.costLo)}–${fmt(t.costHi)}`],
        ["  · panels + inverter", `~$${fmt(t.pvCostMid)}`],
        ["  · battery bank", `~$${fmt(t.battCostMid)} (≈$${Math.round(t.battCostMid / t.battKwh)}/kWh stored)`],
        ["Unmet hours", `${fmt(t.unmetHoursPerYear)} h/yr`],
        ["Longest gap", `${fmt(t.longestGapHours)} h`],
        ["Battery life est.", fmtLife(t.batteryLifeYears)],
        [`Cycles on the bank`, `~${fmt(t.cyclesPerYear)}/yr`],
      ];
      for (const [k, v] of rows) {
        const line = el("div", { style: "display:flex;justify-content:space-between;font-size:0.9rem;padding:0.2rem 0;border-bottom:1px solid var(--border-card);" });
        line.appendChild(el("span", { style: "color:var(--text-muted);" }, k));
        line.appendChild(el("span", {
          style: "font-family:var(--font-mono);font-weight:700;color:" + (k.startsWith("Cost") ? "var(--primary-accent)" : "var(--text-main)"),
        }, v));
        card.appendChild(line);
      }
      card.appendChild(el("p", { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },
        "Battery + panel component estimate only; excludes inverter, BOS, freight, labor."));
    }
    grid.appendChild(card);
  }

  const a = p.assumptions;
  const pr = p.pricing || {};
  $("assumpText").textContent =
    `Data: ${a.source}, hourly ${a.dataYears}. Derates applied: soiling ${(a.derates.soiling * 100).toFixed(0)}%, ` +
    `wiring ${(a.derates.wiring * 100).toFixed(0)}%, mismatch ${(a.derates.mismatch * 100).toFixed(0)}%, ` +
    `MPPT ${(a.derates.mppt * 100).toFixed(0)}%. Cell temperature model: NOCT ${a.noctC}°C, ` +
    `power temperature coefficient ${(a.gammaPerC * 100).toFixed(2)}%/°C. Inverter efficiency ${(a.etaInverter * 100).toFixed(0)}%. ` +
    `Charging blocked below chemistry's cold limit (LFP 0°C). Load basis: ${inp.basis}. ` +
    `Pricing basis: ${pr.scopeLabel || "budget retail"} (${pr.source || ""}) — ranges span realistic unit prices; ` +
    `battery figures are per usable kWh. ${pr.note || ""}` +
    (pr.catalog ? ` Catalog checked ${pr.catalog.checkedDate}.` : "");

  const tierLines = p.tiers.filter((t) => t.solvable)
    .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~$${fmt(t.costLo)}–${fmt(t.costHi)}, ${p.pricing?.scopeLabel || "budget retail"})`)
    .join("\n");
  window.lastSizingBrief =
    `I sized a system with your calculator for ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)}, ` +
    `${inp.dailyKwh.toFixed(1)} kWh/day from ${inp.basis}, ` +
    `${p.chemistry.toUpperCase()}:\n${tierLines}\n` +
    `[ADVISOR INSTRUCTION: These numbers were computed deterministically from NASA POWER hourly weather ` +
    `${p.meta.dataYears}. Do not recompute or invent different figures — explain, sanity-check and add caveats ` +
    `(seasonal variation, inverter/BOS costs, installation, degradation) around THESE results.]`;
  $("btnAskAdvisor").style.display = "inline-flex";

  if (p.history) drawSocChart(p.history, p.chemLabel || "battery");
}

function askAdvisor() {
  if (!window.lastSizingBrief) return;
  const input = document.getElementById("chatInput");
  if (input) input.value = window.lastSizingBrief;
  if (window.openSizingModal) window.openSizingModal();
  if (window.sendChatMsg) window.sendChatMsg();
}

export function initSizingUI() {
  renderCities();
  renderAppliances();

  // tariff select
  const tsel = $("tariffSelect");
  TARIFFS.forEach((t) => tsel.appendChild(el("option", { value: t.v === "custom" ? "custom" : String(t.v) }, t.n)));
  tsel.value = "0.28";
  tsel.addEventListener("change", () => {
    const custom = tsel.value === "custom";
    $("customRate").style.display = custom ? "block" : "none";
    updateLoadReadout();
  });
  $("customRateVal").addEventListener("input", updateLoadReadout);

  // pricing scope select
  const psel = $("pricingScope");
  PRICING_SCOPES.forEach((s) => psel.appendChild(el("option", { value: s.id }, s.label)));
  psel.value = "powmr";

  $("loadMode").addEventListener("change", setLoadPanel);
  $("billAmount").addEventListener("input", updateLoadReadout);
  $("dailyKwhInput").addEventListener("input", updateLoadReadout);
  $("btnGeoLocate").addEventListener("click", locateMe);
  $("btnRunSizing").addEventListener("click", run);
  $("btnAskAdvisor").addEventListener("click", askAdvisor);
  setLoadPanel();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSizingUI);
} else {
  initSizingUI();
}
