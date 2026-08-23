// Size-My-System UI controller. Loaded as an ES module from index.html.
// All computation happens in sizing-worker.js; this file is DOM glue only.
//
// Load input is end-user-first: an appliance checklist with plain-language
// quantity and usage sliders, a monthly-bill mode, and a tucked-away
// direct-kWh mode for people who already know their numbers.

import { CITY_PRESETS } from "./nasa.js";

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
    worker = new Worker("./assets/js/sizing/sizing-worker.js", { type: "module" });
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

function drawSocChart(history, chemLabel) {
  const wrap = $("socChartWrap");
  const canvas = $("socCanvas");
  const legend = $("socLegend");
  if (!wrap || !canvas || !legend) return;

  const solvable = history.tiers;
  if (!solvable.length) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";

  legend.innerHTML = "";
  for (const t of solvable) {
    const chip = el("span", { style: "display:inline-flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:var(--text-muted);margin-right:1rem;" });
    const sw = el("span", { style: `display:inline-block;width:14px;height:4px;border-radius:2px;background:${TIER_COLORS[t.id] || "#888"};` });
    const name = t.id === "tier100" ? "100% (no generator)" : t.id === "tier99" ? "99% (rare generator)" : "95% (generator OK)";
    const full = Number.isFinite(t.fullPct) ? ` · full ${t.fullPct}% of hours` : "";
    chip.append(sw, el("span", {}, name + full));
    legend.appendChild(chip);
  }

  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(320, wrap.clientWidth || 640);
  const H = 240;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const padL = 34, padR = 8, padT = 8, padB = 22;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const buckets = history.buckets;
  const X = (i) => padL + (i / (buckets - 1)) * plotW;
  const Y = (soc) => padT + (1 - soc) * plotH; // soc 0..1

  // gridlines + y labels
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillStyle = "#6b7280";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let v = 0; v <= 100; v += 25) {
    const y = Y(v / 100);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(v + "%", padL - 5, y + 3);
  }
  // year ticks
  const span = history.endYear - history.startYear + 1;
  ctx.textAlign = "center";
  for (let yy = 0; yy < span; yy++) {
    const x = padL + ((yy + 0.5) / span) * plotW;
    ctx.fillText(String(history.startYear + yy), x, H - 6);
  }
  // empty-battery line
  ctx.strokeStyle = "rgba(239,68,68,0.55)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(W - padR, Y(0)); ctx.stroke();
  ctx.setLineDash([]);

  // draw order: tier100 last so its ceiling line stays visible on top
  const order = { tier95: 0, tier99: 1, tier100: 2 };
  for (const t of [...solvable].sort((a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9))) {
    const color = TIER_COLORS[t.id] || "#888";
    const env = t.env;
    if (!env || !env.length) continue;

    // Envelope fill: shows TIME SPENT at each charge level. Peaks that only
    // last an hour or two paint a thin sliver, so the hi/lo boundaries are
    // also stroked explicitly — every tier's max is visibly 100%.
    ctx.beginPath();
    ctx.moveTo(X(0), Y(env[0][1] / 100));
    for (let i = 1; i < env.length; i++) ctx.lineTo(X(i), Y(env[i][1] / 100));
    for (let i = env.length - 1; i >= 0; i--) ctx.lineTo(X(i), Y(env[i][0] / 100));
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = color;
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < env.length; i++) {
      const y = Y(env[i][1] / 100);
      if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < env.length; i++) {
      const y = Y(env[i][0] / 100);
      if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y);
    }
    ctx.stroke();

    // Mid line on top, slightly thicker
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < env.length; i++) {
      const y = Y(((env[i][0] + env[i][1]) / 2) / 100);
      if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  $("socCaption").textContent =
    `Hourly battery state of charge, ${history.startYear}–${history.endYear}, for the three systems above ` +
    `(${chemLabel}). Every system reaches 100% when the sun delivers — smaller banks simply fill and empty ` +
    `faster, so their bands sit lower on average even though their peaks touch the top; the legend shows how ` +
    `much of the year each spends essentially full. Where a line touches the red dashed line, that system would ` +
    `be dark without a generator. The 100% system never gets there in five years of real weather — that is what ` +
    `the extra hardware buys.`;
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
        ["Component cost est.", `~$${fmt(t.cost)}`],
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
  $("assumpText").textContent =
    `Data: ${a.source}, hourly ${a.dataYears}. Derates applied: soiling ${(a.derates.soiling * 100).toFixed(0)}%, ` +
    `wiring ${(a.derates.wiring * 100).toFixed(0)}%, mismatch ${(a.derates.mismatch * 100).toFixed(0)}%, ` +
    `MPPT ${(a.derates.mppt * 100).toFixed(0)}%. Cell temperature model: NOCT ${a.noctC}°C, ` +
    `power temperature coefficient ${(a.gammaPerC * 100).toFixed(2)}%/°C. Inverter efficiency ${(a.etaInverter * 100).toFixed(0)}%. ` +
    `Charging blocked below chemistry's cold limit (LFP 0°C). Load basis: ${inp.basis}. ` +
    `Cost basis: $0.35/W panels + battery per-kWh by chemistry.`;

  const tierLines = p.tiers.filter((t) => t.solvable)
    .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~$${fmt(t.cost)})`)
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
