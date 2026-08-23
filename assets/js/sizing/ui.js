// Size-My-System UI controller. Loaded as an ES module from index.html.
// All computation happens in sizing-worker.js; this file is DOM glue only.

const CITY_PRESETS = [
  { name: "Pahoa, Hawaiʻi", lat: 19.5, lon: -155.0 },
  { name: "Denver, USA", lat: 39.74, lon: -104.99 },
  { name: "Berlin, Germany", lat: 52.52, lon: 13.41 },
  { name: "Lagos, Nigeria", lat: 6.52, lon: 3.38 },
  { name: "Delhi, India", lat: 28.61, lon: 77.21 },
  { name: "Cusco, Peru", lat: -13.53, lon: -71.97 },
];

let worker = null;

function $(id) { return document.getElementById(id); }

function ensureWorker() {
  if (!worker) {
    worker = new Worker("./assets/js/sizing/sizing-worker.js", { type: "module" });
    worker.onmessage = (ev) => {
      if (ev.data?.type === "ok") renderResults(ev.data.payload);
      else if (ev.data?.type === "error") setStatus("⚠️ " + ev.data.message);
      $("btnRunSizing").disabled = false;
    };
    worker.onerror = (e) => {
      setStatus("⚠️ Sizing engine failed to load.");
      $("btnRunSizing").disabled = false;
    };
  }
  return worker;
}

function setStatus(text) {
  const el = $("sizingStatus");
  if (el) el.textContent = text;
}

function readInputs() {
  const preset = $("cityPreset").value;
  let lat, lon;
  if (preset === "custom") {
    lat = parseFloat($("latInput").value);
    lon = parseFloat($("lonInput").value);
  } else {
    const c = CITY_PRESETS[parseInt(preset, 10)];
    lat = c.lat; lon = c.lon;
  }
  return {
    latitude: lat,
    longitude: lon,
    dailyKwh: parseFloat($("dailyKwhInput").value),
    chemistry: $("chemSelect").value,
    years: 5,
  };
}

function run() {
  const inp = readInputs();
  if (!Number.isFinite(inp.latitude) || !Number.isFinite(inp.longitude) ||
      Math.abs(inp.latitude) > 90 || Math.abs(inp.longitude) > 180) {
    setStatus("⚠️ Enter a valid latitude (−90…90) and longitude (−180…180), or pick a city.");
    return;
  }
  if (!Number.isFinite(inp.dailyKwh) || inp.dailyKwh <= 0 || inp.dailyKwh > 500) {
    setStatus("⚠️ Enter your daily energy use in kWh/day (for example 10).");
    return;
  }
  setStatus("⏳ Fetching 5 years of hourly satellite weather and searching system sizes…");
  $("btnRunSizing").disabled = true;
  ensureWorker().postMessage({ type: "run", ...inp });
}

function fmt(n) { return Number(n).toLocaleString(); }

function renderResults(p) {
  setStatus(`✅ ${p.meta.years} yr of hourly data (${p.meta.dataYears}) · ${fmt(p.annualYieldPerKw)} kWh/yr per kW of panel.`);
  const grid = $("tierResults");
  grid.innerHTML = "";

  for (const t of p.tiers) {
    const card = document.createElement("div");
    card.className = "bom-card";
    card.style.borderColor = t.id === "tier100" ? "var(--border-glow)" : "var(--border-card)";

    const badge = document.createElement("div");
    badge.className = "bom-badge";
    badge.textContent = t.id === "tier100" ? "No generator" : t.id === "tier99" ? "Rare generator" : "Generator OK";
    card.appendChild(badge);

    const h = document.createElement("h3");
    h.textContent = t.label.split("—")[1]?.trim() || t.label;
    card.appendChild(h);

    if (!t.solvable) {
      const msg = document.createElement("p");
      msg.textContent = "No system found within search limits for this load — the daily consumption may be too high for a practical off-grid build at this site.";
      card.appendChild(msg);
    } else {
      const rows = [
        ["Solar array", `${t.pvKw} kW`],
        ["Battery (usable)", `${fmt(t.battKwh)} kWh`],
        ["Component cost est.", `~$${fmt(t.cost)}`],
        ["Unmet hours", `${fmt(t.unmetHoursPerYear)} h/yr`],
        ["Longest gap", `${fmt(t.longestGapHours)} h`],
        ["Battery cycles", `~${fmt(t.cyclesPerYear)}/yr`],
      ];
      for (const [k, v] of rows) {
        const line = document.createElement("div");
        line.style.cssText = "display:flex;justify-content:space-between;font-size:0.9rem;padding:0.2rem 0;border-bottom:1px solid var(--border-card);";
        const kEl = document.createElement("span");
        kEl.style.color = "var(--text-muted)";
        kEl.textContent = k;
        const vEl = document.createElement("span");
        vEl.style.cssText = "font-family:var(--font-mono);font-weight:700;color:" + (k.startsWith("Cost") ? "var(--primary-accent)" : "var(--text-main)");
        vEl.textContent = v;
        line.append(kEl, vEl);
        card.appendChild(line);
      }
      const costNote = document.createElement("p");
      costNote.style.cssText = "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;";
      costNote.textContent = "Battery + panel component estimate only; excludes inverter, BOS, freight, labor.";
      card.appendChild(costNote);
    }
    grid.appendChild(card);
  }

  // Assumptions / show-the-arithmetic
  const a = p.assumptions;
  $("assumpText").textContent =
    `Data: ${a.source}, hourly ${a.dataYears}. Derates applied: soiling ${(a.derates.soiling * 100).toFixed(0)}%, ` +
    `wiring ${(a.derates.wiring * 100).toFixed(0)}%, mismatch ${(a.derates.mismatch * 100).toFixed(0)}%, ` +
    `MPPT ${(a.derates.mppt * 100).toFixed(0)}%. Cell temperature model: NOCT ${a.noctC}°C, ` +
    `power temperature coefficient ${(a.gammaPerC * 100).toFixed(2)}%/°C. Inverter efficiency ${(a.etaInverter * 100).toFixed(0)}%. ` +
    `Charging blocked below chemistry's cold limit (LFP 0°C). Cost basis: $0.35/W panels + battery per-kWh by chemistry.`;

  // Advisor grounding brief
  const tierLines = p.tiers.filter((t) => t.solvable)
    .map((t) => `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~$${fmt(t.cost)})`)
    .join("\n");
  window.lastSizingBrief =
    `I sized a system with your calculator for ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)}, ` +
    `${readInputs().dailyKwh} kWh/day, ${p.chemistry.toUpperCase()}:\n${tierLines}\n` +
    `[ADVISOR INSTRUCTION: These numbers were computed deterministically from NASA POWER hourly weather ` +
    `${p.meta.dataYears}. Do not recompute or invent different figures — explain, sanity-check and add caveats ` +
    `(seasonal variation, inverter/BOS costs, installation, degradation) around THESE results.]`;
  $("btnAskAdvisor").style.display = "inline-flex";
}

function askAdvisor() {
  if (!window.lastSizingBrief) return;
  const input = document.getElementById("chatInput");
  if (input) input.value = window.lastSizingBrief;
  if (window.openSizingModal) window.openSizingModal();
  if (window.sendChatMsg) window.sendChatMsg();
}

export function initSizingUI() {
  const sel = $("cityPreset");
  CITY_PRESETS.forEach((c, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.name;
    sel.appendChild(o);
  });
  sel.addEventListener("change", () => {
    const custom = sel.value === "custom";
    $("latInput").disabled = !custom;
    $("lonInput").disabled = !custom;
    if (!custom) {
      const c = CITY_PRESETS[parseInt(sel.value, 10)];
      $("latInput").value = c.lat;
      $("lonInput").value = c.lon;
    }
  });

  $("btnRunSizing").addEventListener("click", run);
  $("btnAskAdvisor").addEventListener("click", askAdvisor);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSizingUI);
} else {
  initSizingUI();
}
