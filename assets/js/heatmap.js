(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────
  let gridData = null;
  let map = null;
  let dotLayer = null;
  let usageIdx = 1; // 0=5kWh, 1=10kWh, 2=20kWh, 3=30kWh
  let metric = "cost"; // "cost" = True Grid Cost, "p" = payback, "b" = break-even
  let basis = "real"; // "real" = generator/unserved-aware, "grid" = nominal grid tariff only

  // Get active metric key depending on basis for payback/break-even
  function getMetricKey() {
    if (basis === "real") {
      return metric === "p" ? "pr" : "br";
    }
    return metric; // "p" or "b"
  }

  // ── Color scales & helpers ─────────────────────────────────────────────
  function costColor(cost) {
    if (cost === null || cost === undefined || cost <= 0) return "#555";
    if (cost <= 0.1) return "#00e699";
    if (cost <= 0.18) return "#7ec850";
    if (cost <= 0.28) return "#c8b400";
    if (cost <= 0.4) return "#e68a00";
    if (cost <= 0.55) return "#e64545";
    return "#991b1b";
  }

  function costLabel(cost) {
    if (cost === null || cost === undefined) return "N/A";
    return "$" + Number(cost).toFixed(2) + "/kWh";
  }

  function getPointCost(pt) {
    if (basis === "real") {
      return pt.tr !== undefined ? pt.tr : pt.t;
    }
    return pt.t;
  }

  function getPointYears(pt, m) {
    const isReal = basis === "real";
    if (m === "p") {
      const series = isReal && pt.pr ? pt.pr : pt.p;
      return series ? series[usageIdx] : null;
    } else if (m === "b") {
      const series = isReal && pt.br ? pt.br : pt.b;
      return series ? series[usageIdx] : null;
    }
    return null;
  }

  function yearColor(years) {
    if (years === null || years === undefined || years <= 0) return "#555";
    if (years <= 2) return "#00e699";
    if (years <= 3) return "#7ec850";
    if (years <= 5) return "#c8b400";
    if (years <= 7) return "#e68a00";
    if (years <= 12) return "#e64545";
    return "#888";
  }

  function yearLabel(years) {
    if (years === null || years === undefined) return "N/A";
    if (years > 50) return ">50 yr";
    return Number(years).toFixed(1) + " yr";
  }

  function ratingText(years) {
    if (years === null) return "No data";
    if (years <= 2) return "Excellent";
    if (years <= 3) return "Very Good";
    if (years <= 5) return "Good";
    if (years <= 7) return "Moderate";
    if (years <= 12) return "Long";
    return "Very Long";
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

  // ── City slug for calculator link ──────────────────────────────────────
  function citySlug(name) {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // ── Legend ─────────────────────────────────────────────────────────────
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
          metric === "p"
            ? "Years to pay for itself"
            : "Years to true break-even";
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

  // ── Render dots ────────────────────────────────────────────────────────
  function renderDots() {
    if (!map || !gridData) return;
    if (dotLayer) map.removeLayer(dotLayer);

    const points = gridData.points;
    const markers = [];

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      let color;
      if (metric === "cost") {
        const cost = getPointCost(pt);
        color = costColor(cost);
      } else {
        const yrs = getPointYears(pt, metric);
        color = yearColor(yrs);
      }

      const marker = L.circleMarker([pt.lat, pt.lon], {
        radius: 3.5,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.75,
        interactive: true,
      });

      marker._heatIdx = i;
      markers.push(marker);
    }

    dotLayer = L.layerGroup(markers).addTo(map);

    // Use event delegation on the layer group
    dotLayer.eachLayer(function (layer) {
      layer.on("click", function () {
        const pt = points[layer._heatIdx];
        const isReal = basis === "real";
        const pSeries = isReal && pt.pr ? pt.pr : pt.p;
        const bSeries = isReal && pt.br ? pt.br : pt.b;
        const paybackYrs = pSeries ? pSeries[usageIdx] : null;
        const breakevenYrs = bSeries ? bSeries[usageIdx] : null;
        const usage = gridData.usageTiersKwhDay[usageIdx];
        const hasDeficit = pt.tr && pt.tr !== pt.t;

        const unservedPct = pt.unserved || 0;
        const coverageBadge = pt.unserved
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
                <td style="text-align:right;color:#00e699;font-weight:700;">$${pt.tr}/kWh <span style="font-size:.7rem;color:var(--muted);font-weight:normal;">(weighted)</span></td>
               </tr>
               <tr>
                <td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>
                <td style="text-align:right;color:var(--muted);font-size:.8rem;">$${pt.t}/kWh (when on)</td>
               </tr>`
            : `<tr style="${metric === "cost" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>
                <td style="text-align:right;color:#fff;font-weight:600;">$${pt.t}/kWh</td>
               </tr>
               <tr>
                <td style="color:var(--muted);padding:.15rem 0;">True Grid Cost</td>
                <td style="text-align:right;color:#00e699;font-size:.8rem;">$${pt.tr}/kWh (weighted)</td>
               </tr>`;
        } else {
          tariffRows = `
            <tr style="${metric === "cost" ? "background:rgba(0,230,153,0.12);" : ""}">
              <td style="color:var(--muted);padding:.15rem 0;">Grid tariff</td>
              <td style="text-align:right;color:#fff;font-weight:600;">$${pt.t}/kWh</td>
            </tr>
          `;
        }

        const popup = `
          <div style="min-width:220px;">
            <div style="font-weight:700;font-size:1rem;color:#fff;margin-bottom:.2rem;">${esc(pt.n)}</div>
            <div style="color:var(--muted);font-size:.8rem;margin-bottom:.5rem;">${esc(countryName(pt.c))} · ${pt.lat}°, ${pt.lon}°</div>
            ${coverageBadge}
            <table style="width:100%;font-size:.85rem;border-collapse:collapse;">
              ${tariffRows}
              <tr><td style="color:var(--muted);padding:.15rem 0;">Solar yield</td><td style="text-align:right;color:#fff;font-weight:600;">${pt.y} kWh/kWp/yr</td></tr>
              <tr style="${metric === "p" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">Payback (${basis === "real" ? "weighted" : "grid"})</td>
                <td style="text-align:right;color:${yearColor(paybackYrs)};font-weight:700;">${yearLabel(paybackYrs)}</td>
              </tr>
              <tr style="${metric === "b" ? "background:rgba(0,230,153,0.12);" : ""}">
                <td style="color:var(--muted);padding:.15rem 0;">True break-even</td>
                <td style="text-align:right;color:${yearColor(breakevenYrs)};font-weight:700;">${yearLabel(breakevenYrs)}</td>
              </tr>
              <tr><td style="color:var(--muted);padding:.15rem 0;">Usage assumed</td><td style="text-align:right;color:#fff;">${usage} kWh/day</td></tr>
            </table>
            <div style="margin-top:.6rem;text-align:center;">
              <a href="../#sizing" style="display:inline-block;background:linear-gradient(135deg,#00e699,#00b377);color:#04120c;font-weight:700;padding:.4rem .9rem;border-radius:6px;font-size:.85rem;">⚡ Run full simulation</a>
            </div>
          </div>
        `;
        layer.bindPopup(popup, { maxWidth: 300 }).openPopup();
      });
    });

    updateLegend();
    updateRankings();
  }

  // ── Rankings ────────────────────────────────────────────────────────────
  function updateRankings() {
    if (!gridData) return;
    const points = gridData.points;
    const usage = gridData.usageTiersKwhDay[usageIdx];
    const basisLabel = basis === "real" ? "weighted" : "grid-only";

    const bestCard = document.getElementById("best-card");
    const worstCard = document.getElementById("worst-card");

    if (metric === "cost") {
      const countryHighest = new Map();
      const countryLowest = new Map();

      for (const pt of points) {
        const cost = getPointCost(pt);
        if (cost === null || cost === undefined || cost <= 0) continue;

        const curHigh = countryHighest.has(pt.c)
          ? getPointCost(countryHighest.get(pt.c))
          : -Infinity;
        if (!countryHighest.has(pt.c) || cost > curHigh) {
          countryHighest.set(pt.c, pt);
        }

        const curLow = countryLowest.has(pt.c)
          ? getPointCost(countryLowest.get(pt.c))
          : Infinity;
        if (!countryLowest.has(pt.c) || cost < curLow) {
          countryLowest.set(pt.c, pt);
        }
      }

      const highestByCountry = [...countryHighest.values()]
        .sort((a, b) => getPointCost(b) - getPointCost(a))
        .slice(0, 10);

      const lowestByCountry = [...countryLowest.values()]
        .sort((a, b) => getPointCost(a) - getPointCost(b))
        .slice(0, 10);

      document.getElementById("best-list").innerHTML = highestByCountry
        .map((pt) => {
          const cost = getPointCost(pt);
          const splitText = pt.unserved
            ? `~${pt.unserved}% unserved`
            : "100% grid";
          return `<li><span class="years" style="color:${costColor(cost)}">${costLabel(cost)}</span> — ${esc(pt.n)}, ${esc(countryName(pt.c))} <span class="detail">(${splitText}, paper $${pt.t}/kWh)</span></li>`;
        })
        .join("");

      document.getElementById("worst-list").innerHTML = lowestByCountry
        .map((pt) => {
          const cost = getPointCost(pt);
          return `<li><span class="years" style="color:${costColor(cost)}">${costLabel(cost)}</span> — ${esc(pt.n)}, ${esc(countryName(pt.c))} <span class="detail">(${pt.y} kWh/kWp/yr)</span></li>`;
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

    const mKey = getMetricKey();
    const countryBest = new Map();
    const countryWorst = new Map();

    for (const pt of points) {
      const series = pt[mKey] || pt[metric];
      const yrs = series ? series[usageIdx] : null;
      if (yrs === null || yrs <= 0) continue;

      const bestSeries = countryBest.has(pt.c)
        ? countryBest.get(pt.c)[mKey] || countryBest.get(pt.c)[metric]
        : null;
      if (
        !countryBest.has(pt.c) ||
        (bestSeries && yrs < bestSeries[usageIdx])
      ) {
        countryBest.set(pt.c, pt);
      }

      const worstSeries = countryWorst.has(pt.c)
        ? countryWorst.get(pt.c)[mKey] || countryWorst.get(pt.c)[metric]
        : null;
      if (
        !countryWorst.has(pt.c) ||
        (worstSeries && yrs > worstSeries[usageIdx])
      ) {
        countryWorst.set(pt.c, pt);
      }
    }

    const bestByCountry = [...countryBest.values()]
      .sort((a, b) => {
        const sA = a[mKey] || a[metric],
          sB = b[mKey] || b[metric];
        return sA[usageIdx] - sB[usageIdx];
      })
      .slice(0, 10);

    const worstByCountry = [...countryWorst.values()]
      .filter((pt) => {
        const s = pt[mKey] || pt[metric];
        return s && s[usageIdx] !== null;
      })
      .sort((a, b) => {
        const sA = a[mKey] || a[metric],
          sB = b[mKey] || b[metric];
        return sB[usageIdx] - sA[usageIdx];
      })
      .slice(0, 10);

    const metricLabel = metric === "p" ? "payback" : "break-even";

    document.getElementById("best-list").innerHTML = bestByCountry
      .map((pt) => {
        const s = pt[mKey] || pt[metric];
        const rateDisplay =
          basis === "real" && pt.tr ? `$${pt.tr}` : `$${pt.t}`;
        return `<li><span class="years">${yearLabel(s[usageIdx])}</span> — ${esc(pt.n)}, ${esc(countryName(pt.c))} <span class="detail">(${rateDisplay}/kWh, ${pt.y} kWh/kWp)</span></li>`;
      })
      .join("");

    document.getElementById("worst-list").innerHTML = worstByCountry
      .map((pt) => {
        const s = pt[mKey] || pt[metric];
        const rateDisplay =
          basis === "real" && pt.tr ? `$${pt.tr}` : `$${pt.t}`;
        return `<li><span class="years">${yearLabel(s[usageIdx])}</span> — ${esc(pt.n)}, ${esc(countryName(pt.c))} <span class="detail">(${rateDisplay}/kWh, ${pt.y} kWh/kWp)</span></li>`;
      })
      .join("");

    document.querySelector("#best-card h3").textContent =
      `⚡ Fastest ${metricLabel} (${basisLabel}, ${usage} kWh/d)`;
    document.querySelector("#worst-card h3").textContent =
      `🔴 Slowest ${metricLabel} (${basisLabel}, ${usage} kWh/d)`;
  }

  // ── Controls ───────────────────────────────────────────────────────────
  document.getElementById("basis-btns").addEventListener("click", function (e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    document
      .querySelectorAll("#basis-btns button")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    basis = btn.dataset.basis;
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
    renderDots();
  });

  document
    .getElementById("metric-btns")
    .addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      document
        .querySelectorAll("#metric-btns button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      metric = btn.dataset.metric;
      renderDots();
    });

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch("../assets/data/heatmap-grid.json?v=20260917h");
      if (!res.ok) throw new Error("Failed to load heatmap data");
      gridData = await res.json();
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

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    // Use CartoDB Dark Matter for matching dark theme (no API key needed)
    renderDots();
  }

  init();
})();
