// Heatmap: pre-rendered image + on-demand data architecture.
//
// DESIGN (2026-10-14, issue #216):
//   - Build time renders 18 dot PNGs (metric × basis × usage) via
//     scripts/build-heatmap-images.mjs. Each ~130KB, content-hashed.
//   - Page load shows a single PNG via L.imageOverlay. No JSON fetch, no
//     markers. Initial payload ~500KB vs ~8MB before (plan budget ≤300KB
//     for the heatmap payload itself; the PNG is 133KB).
//   - The dark background is baked into the PNG: no tile layer needed for
//     the default view (also resolves #218 CARTO watermark for that view).
//   - First map click lazy-fetches the compressed dataset once, finds the
//     nearest point, and shows the popup. Data downloads only on demand.
//   - Metric/basis/usage controls swap the pre-rendered image URL.
//   - Rankings come from pre-rendered assets/data/heatmap-rankings.json.
//   - After data loads, a canvas dot layer enables sharp zoomed interaction
//     (single L.canvas() renderer, never 39k DOM markers).
//
// Colors come from assets/js/heatmap-palette.js (UMD, window.HeatmapPalette)
// — the same module the build script uses, so PNG and canvas colors match.

(function () {
  "use strict";

  var P = window.HeatmapPalette;
  if (!P) {
    document.getElementById("loading").innerHTML =
      '<div style="text-align:center;color:#e64545;">Heatmap palette failed to load. <a href="" style="color:var(--accent);">Reload</a></div>';
    return;
  }

  // Asset version: read from our own <script src="?v="> so the manifest and
  // data URLs bust the immutable cache in lockstep with the code. Works with
  // deferred scripts (document.currentScript is set during execution).
  function assetVersion() {
    try {
      var s = document.currentScript;
      if (s && s.src) {
        var m = s.src.match(/[?&]v=([^&]+)/);
        if (m) return m[1];
      }
    } catch (e) {
      /* ignore */
    }
    return "dev";
  }
  var ASSET_V = assetVersion();

  // ── State ──────────────────────────────────────────────────────────────
  var map = null;
  var imageLayer = null;
  var dotLayer = null;
  var dotRenderer = null;
  // The grid is fetched per viewport, not in one piece (R-PERF-04, P1.5):
  // 39,707 points in a 4.9 MB file was the whole payload for a click on one
  // city. gridMeta is the chunk manifest; loadedPoints holds only the chunks
  // the visitor's view needed, and every marker keeps its own point so the
  // colour refresh no longer depends on array order.
  var gridMeta = null;
  var gridPaths = []; // chunkCache key -> manifest entry
  var chunkPromises = {};
  var loadedPoints = [];
  var dataLoading = null; // in-flight manifest/fallback load
  var manifest = null;
  var rankings = null;
  var usageTiers = null;

  var usageIdx = 1; // 0=5kWh, 1=10kWh, 2=20kWh, 3=30kWh
  var metric = "cost"; // "cost" | "p" | "b"
  var basis = "real"; // "real" | "grid"

  var WORLD_BOUNDS = [
    [-90, -180],
    [90, 180],
  ];

  // ── Helpers (delegating to the shared palette) ───────────────────────────
  function getPointCost(pt) {
    return P.getPointCost(pt, basis);
  }
  function getPointYears(pt, m) {
    return P.getPointYears(pt, m || metric, basis, usageIdx);
  }
  function dotColor(pt) {
    return P.dotColor(pt, metric, basis, usageIdx);
  }

  // Country names (compact) — unchanged from previous implementation.
  var CC = {
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
  var esc = function (v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // ── Image manifest ───────────────────────────────────────────────────────
  function manifestKey() {
    if (metric === "cost") return "cost-" + basis;
    return metric + "-" + basis + "-u" + usageIdx;
  }

  function imageUrl(key) {
    if (!manifest || !manifest[key]) return null;
    return "../assets/img/heatmap/" + manifest[key];
  }

  function swapImage() {
    if (!map || !manifest) return;
    var url = imageUrl(manifestKey());
    if (!url) return;
    if (imageLayer) map.removeLayer(imageLayer);
    imageLayer = L.imageOverlay(url, WORLD_BOUNDS, { opacity: 1 }).addTo(map);
    // Keep the dot layer on top if it exists.
    if (dotLayer) dotLayer.bringToFront();
  }

  // ── Legend ───────────────────────────────────────────────────────────────
  function updateLegend() {
    var titleEl = document.getElementById("legend-title");
    var labelsEl = document.getElementById("legend-labels");
    var lastBarEl = document.getElementById("legend-bar-last");
    var usageWrap = document.getElementById("usage-control-wrap");
    if (metric === "cost") {
      if (usageWrap) usageWrap.style.display = "none";
      if (titleEl)
        titleEl.textContent =
          basis === "real"
            ? "True Grid Cost ($/kWh, weighted)"
            : "Official Grid Tariff ($/kWh)";
      if (lastBarEl) lastBarEl.style.background = "#991b1b";
      if (labelsEl)
        labelsEl.innerHTML =
          "<span>&le;$0.10</span><span>$0.18</span><span>$0.28</span>" +
          "<span>$0.40</span><span>$0.55</span><span>&gt;$0.55</span>";
    } else {
      if (usageWrap) usageWrap.style.display = "block";
      if (titleEl)
        titleEl.textContent =
          metric === "p"
            ? "Years to pay for itself"
            : "Years to true break-even";
      if (lastBarEl) lastBarEl.style.background = "#888888";
      if (labelsEl)
        labelsEl.innerHTML =
          "<span>&lt;2yr</span><span>3</span><span>5</span><span>7</span><span>12+</span>";
    }
  }

  // ── Rankings (pre-rendered, no dataset needed) ───────────────────────────
  function updateRankings() {
    if (!rankings) return;
    var r = rankings[manifestKey()];
    if (!r) return;
    var bestList = document.getElementById("best-list");
    var worstList = document.getElementById("worst-list");
    var bestCard = document.getElementById("best-card");
    var worstCard = document.getElementById("worst-card");
    if (!bestList || !worstList) return;

    if (metric === "cost") {
      var basisLabel = basis === "real" ? "weighted" : "grid-only";
      bestList.innerHTML = r.high
        .map(function (pt) {
          var splitText = pt.u ? "~" + pt.u + "% unserved" : "100% grid";
          return (
            '<li><span class="years" style="color:' +
            P.costTextColor(pt.v) +
            '">' +
            P.costLabel(pt.v) +
            "</span> — " +
            esc(pt.n) +
            ", " +
            esc(countryName(pt.c)) +
            ' <span class="detail">(' +
            splitText +
            ", paper $" +
            pt.t +
            "/kWh)</span></li>"
          );
        })
        .join("");
      worstList.innerHTML = r.low
        .map(function (pt) {
          return (
            '<li><span class="years" style="color:' +
            P.costTextColor(pt.v) +
            '">' +
            P.costLabel(pt.v) +
            "</span> — " +
            esc(pt.n) +
            ", " +
            esc(countryName(pt.c)) +
            ' <span class="detail">(' +
            pt.y +
            " kWh/kWp/yr)</span></li>"
          );
        })
        .join("");
      if (bestCard) bestCard.className = "rank-card worst";
      if (worstCard) worstCard.className = "rank-card";
      var bh = document.querySelector("#best-card h3");
      var wh = document.querySelector("#worst-card h3");
      if (bh)
        bh.textContent = "🔴 Highest Electricity Cost (" + basisLabel + ")";
      if (wh)
        wh.textContent = "⚡ Lowest Electricity Cost (" + basisLabel + ")";
      return;
    }

    if (bestCard) bestCard.className = "rank-card";
    if (worstCard) worstCard.className = "rank-card worst";
    var metricLabel = metric === "p" ? "payback" : "break-even";
    var usage = r.usage;
    bestList.innerHTML = r.best
      .map(function (pt) {
        return (
          '<li><span class="years">' +
          P.yearLabel(pt.v) +
          "</span> — " +
          esc(pt.n) +
          ", " +
          esc(countryName(pt.c)) +
          ' <span class="detail">($' +
          pt.t +
          "/kWh, " +
          pt.y +
          " kWh/kWp)</span></li>"
        );
      })
      .join("");
    worstList.innerHTML = r.worst
      .map(function (pt) {
        return (
          '<li><span class="years">' +
          P.yearLabel(pt.v) +
          "</span> — " +
          esc(pt.n) +
          ", " +
          esc(countryName(pt.c)) +
          ' <span class="detail">($' +
          pt.t +
          "/kWh, " +
          pt.y +
          " kWh/kWp)</span></li>"
        );
      })
      .join("");
    var bh2 = document.querySelector("#best-card h3");
    var wh2 = document.querySelector("#worst-card h3");
    if (bh2)
      bh2.textContent = "⚡ Fastest " + metricLabel + " (" + usage + " kWh/d)";
    if (wh2)
      wh2.textContent = "🔴 Slowest " + metricLabel + " (" + usage + " kWh/d)";
  }

  // ── On-demand data, per viewport ─────────────────────────────────────────
  function bump(url) {
    return url + "?v=" + ASSET_V;
  }

  // The single-file grid stays shipped as the fallback. A manifest or chunk
  // that fails to fetch must not leave the map interactive-but-empty: a
  // visitor on a stale service worker, or on a network that loses one request,
  // gets the old behaviour rather than a silent dead map.
  function loadMonolith() {
    return fetch(bump("../assets/data/heatmap-grid.min.json"))
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load heatmap data");
        return res.json();
      })
      .then(function (data) {
        resetDots();
        usageTiers = data.usageTiersKwhDay || data.tiers;
        addDots(data.points || []);
        return data;
      });
  }

  function loadManifest() {
    return fetch(bump("../assets/data/heatmap-grid/index.min.json"))
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load heatmap manifest");
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.chunks) throw new Error("no chunks in manifest");
        gridMeta = data;
        gridPaths = data.chunks;
        usageTiers = data.tiers;
        return data;
      });
  }

  function loadChunk(entry) {
    if (!entry) return Promise.resolve();
    if (chunkPromises[entry.k]) return chunkPromises[entry.k];
    var p = fetch(bump("../assets/data/heatmap-grid/" + entry.f))
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load chunk " + entry.k);
        return res.json();
      })
      .then(function (data) {
        addDots(data.points || []);
      })
      .catch(function (err) {
        delete chunkPromises[entry.k];
        throw err;
      });
    chunkPromises[entry.k] = p;
    return p;
  }

  function viewBounds() {
    try {
      var b = map.getBounds();
      // Half a chunk of padding: a point just outside the viewport is still the
      // nearest point to a click near the edge, and a marker drawn one square
      // beyond the edge is cheap compared with a popup naming a distant city.
      return HeatmapChunks.padBounds(
        {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        },
        HeatmapChunks.CHUNK_DEG / 2,
      );
    } catch (e) {
      return null;
    }
  }

  function ensureViewportChunks() {
    var bounds = viewBounds();
    if (!bounds) return Promise.resolve();
    var wanted = HeatmapChunks.chunksForBounds(bounds, gridPaths);
    var loads = [];
    for (var i = 0; i < wanted.length; i++) loads.push(loadChunk(wanted[i]));
    return Promise.all(loads);
  }

  function ensureData() {
    // Guard the global (R-OFF-02): the chunk module ships next to this file, but
    // a build that lost it, or a cache that served an older HTML, must still
    // produce a working map rather than a ReferenceError in the click handler.
    if (
      typeof HeatmapChunks === "undefined" ||
      !HeatmapChunks.chunksForBounds
    ) {
      if (!chunkLoadAttempted) {
        chunkLoadAttempted = true;
        dataLoading = loadMonolith().catch(function (err) {
          chunkLoadAttempted = false;
          dataLoading = null;
          throw err;
        });
      }
      return dataLoading || Promise.resolve();
    }
    if (chunkLoadAttempted) return ensureViewportChunks();
    if (dataLoading) return dataLoading;
    chunkLoadAttempted = true;
    dataLoading = loadManifest()
      .then(function () {
        return ensureViewportChunks();
      })
      .catch(function (err) {
        // Manifest or first chunk failed: fall back to the whole file once.
        // eslint-disable-next-line no-console
        console.warn(
          "heatmap chunk load failed, using the single-file grid",
          err,
        );
        return loadMonolith();
      })
      .catch(function (err) {
        chunkLoadAttempted = false;
        dataLoading = null;
        throw err;
      });
    return dataLoading;
  }

  var chunkLoadAttempted = false;

  function nearestPoint(lat, lng) {
    if (!loadedPoints.length) return null;
    var best = null;
    var bestD = Infinity;
    var pts = loadedPoints;
    for (var i = 0; i < pts.length; i++) {
      var pt = pts[i];
      var dLat = P.pointLat(pt) - lat;
      var dLng = P.pointLon(pt) - lng;
      // Wrap longitude distance.
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      var d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    return best;
  }

  function showPopup(pt, latlng) {
    var isReal = basis === "real";
    var pYrs = getPointYears(pt, "p");
    var bYrs = getPointYears(pt, "b");
    var tiers = usageTiers || [5, 10, 20, 30];
    var usage = tiers[usageIdx];
    var t = pt.t;
    var tr = pt.r !== undefined ? pt.r : pt.tr;
    var hasDeficit = tr && tr !== t;
    var unservedPct = pt.u || 0;
    var lat = P.pointLat(pt);
    var lon = P.pointLon(pt);

    var coverageBadge = pt.u
      ? '<div style="background:rgba(255,170,0,0.15);border:1px solid rgba(255,170,0,0.3);border-radius:4px;padding:4px 7px;font-size:.75rem;color:#ffaa00;margin-bottom:.5rem;line-height:1.4;">' +
        "⚠️ <strong>Area Grid Split:</strong> ~" +
        (100 - unservedPct) +
        "% grid / ~" +
        unservedPct +
        "% unserved (generators)</div>"
      : '<div style="background:rgba(0,230,153,0.08);border:1px solid rgba(0,230,153,0.2);border-radius:4px;padding:3px 6px;font-size:.75rem;color:var(--accent);margin-bottom:.5rem;">✓ ~100% grid-connected population</div>';

    var tariffRows;
    if (hasDeficit) {
      tariffRows = isReal
        ? '<tr style="' +
          (metric === "cost" ? "background:rgba(0,230,153,0.12);" : "") +
          '">' +
          '<td style="color:var(--muted);padding:.15rem 0;">True Grid Cost</td>' +
          '<td style="text-align:right;color:#00e699;font-weight:700;">$' +
          tr +
          '/kWh <span style="font-size:.7rem;color:var(--muted);font-weight:normal;">(weighted)</span></td></tr>' +
          '<tr><td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>' +
          '<td style="text-align:right;color:var(--muted);font-size:.8rem;">$' +
          t +
          "/kWh (when on)</td></tr>"
        : '<tr style="' +
          (metric === "cost" ? "background:rgba(0,230,153,0.12);" : "") +
          '">' +
          '<td style="color:var(--muted);padding:.15rem 0;">Paper grid tariff</td>' +
          '<td style="text-align:right;color:#fff;font-weight:600;">$' +
          t +
          "/kWh</td></tr>" +
          '<tr><td style="color:var(--muted);padding:.15rem 0;">True Grid Cost</td>' +
          '<td style="text-align:right;color:#00e699;font-size:.8rem;">$' +
          tr +
          "/kWh (weighted)</td></tr>";
    } else {
      tariffRows =
        '<tr style="' +
        (metric === "cost" ? "background:rgba(0,230,153,0.12);" : "") +
        '">' +
        '<td style="color:var(--muted);padding:.15rem 0;">Grid tariff</td>' +
        '<td style="text-align:right;color:#fff;font-weight:600;">$' +
        t +
        "/kWh</td></tr>";
    }

    var popup =
      '<div style="min-width:220px;">' +
      '<div style="font-weight:700;font-size:1rem;color:#fff;margin-bottom:.2rem;">' +
      esc(pt.n) +
      "</div>" +
      '<div style="color:var(--muted);font-size:.8rem;margin-bottom:.5rem;">' +
      esc(countryName(pt.c)) +
      " · " +
      lat +
      "°, " +
      lon +
      "°</div>" +
      coverageBadge +
      '<table style="width:100%;font-size:.85rem;border-collapse:collapse;">' +
      tariffRows +
      '<tr><td style="color:var(--muted);padding:.15rem 0;">Solar yield</td><td style="text-align:right;color:#fff;font-weight:600;">' +
      pt.y +
      " kWh/kWp/yr</td></tr>" +
      '<tr style="' +
      (metric === "p" ? "background:rgba(0,230,153,0.12);" : "") +
      '">' +
      '<td style="color:var(--muted);padding:.15rem 0;">Payback (' +
      (isReal ? "weighted" : "grid") +
      ")</td>" +
      '<td style="text-align:right;color:' +
      P.yearColor(pYrs) +
      ';font-weight:700;">' +
      P.yearLabel(pYrs) +
      "</td></tr>" +
      '<tr style="' +
      (metric === "b" ? "background:rgba(0,230,153,0.12);" : "") +
      '">' +
      '<td style="color:var(--muted);padding:.15rem 0;">True break-even</td>' +
      '<td style="text-align:right;color:' +
      P.yearColor(bYrs) +
      ';font-weight:700;">' +
      P.yearLabel(bYrs) +
      "</td></tr>" +
      '<tr><td style="color:var(--muted);padding:.15rem 0;">Usage assumed</td><td style="text-align:right;color:#fff;">' +
      usage +
      " kWh/day</td></tr>" +
      "</table>" +
      '<div style="margin-top:.6rem;text-align:center;">' +
      '<a href="../#sizing" style="display:inline-block;background:linear-gradient(135deg,#00e699,#00b377);color:#04120c;font-weight:700;padding:.4rem .9rem;border-radius:6px;font-size:.85rem;">⚡ Run full simulation</a>' +
      "</div></div>";

    L.popup({ maxWidth: 300 }).setLatLng(latlng).setContent(popup).openOn(map);
  }

  // ── Canvas dots, added as their chunk arrives ────────────────────────────
  // Each marker keeps its own point (`layer._pt`), so changing metric, basis or
  // usage recolours every marker without assuming it sits at a fixed index in
  // one global array - which chunked loading makes impossible anyway.
  function addDots(points) {
    if (!map || !points || !points.length) return;
    if (!dotRenderer) dotRenderer = L.canvas({ padding: 0.5 });
    if (!dotLayer) {
      dotLayer = L.layerGroup().addTo(map);
      // Past zoom 5 the PNG pixels stretch; fade canvas dots in for sharpness.
      map.on("zoomend", function () {
        if (!dotLayer) return;
        var sharp = map.getZoom() >= 5;
        dotLayer.eachLayer(function (layer) {
          layer.setStyle({ fillOpacity: sharp ? 0.85 : 0.0 });
        });
      });
    }
    var sharpNow = map.getZoom() >= 5;
    for (var i = 0; i < points.length; i++) {
      (function (pt) {
        var m = L.circleMarker([P.pointLat(pt), P.pointLon(pt)], {
          radius: 3.5,
          weight: 0,
          fillColor: dotColor(pt),
          fillOpacity: sharpNow ? 0.85 : 0.0, // hidden until zoomed; the PNG shows dots
          interactive: true,
          renderer: dotRenderer,
        });
        m._pt = pt;
        m.on("click", function (e) {
          showPopup(pt, e.latlng);
        });
        dotLayer.addLayer(m);
        loadedPoints.push(pt);
      })(points[i]);
    }
  }

  // The fallback path loads the whole file, so anything the chunk path already
  // drew has to go first or every point that overlapped would appear twice.
  function resetDots() {
    if (dotLayer) dotLayer.clearLayers();
    loadedPoints = [];
  }

  // ── Controls ─────────────────────────────────────────────────────────────
  function setupControls() {
    var basisBtns = document.getElementById("basis-btns");
    if (basisBtns)
      basisBtns.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        basisBtns.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        basis = btn.dataset.basis;
        swapImage();
        updateLegend();
        updateRankings();
        refreshCanvasColors();
      });

    var usageBtns = document.getElementById("usage-btns");
    if (usageBtns)
      usageBtns.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        usageBtns.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        usageIdx = parseInt(btn.dataset.idx, 10);
        swapImage();
        updateLegend();
        updateRankings();
        refreshCanvasColors();
      });

    var metricBtns = document.getElementById("metric-btns");
    if (metricBtns)
      metricBtns.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        metricBtns.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        metric = btn.dataset.metric;
        swapImage();
        updateLegend();
        updateRankings();
        refreshCanvasColors();
      });
  }

  function refreshCanvasColors() {
    if (!dotLayer) return;
    dotLayer.eachLayer(function (layer) {
      if (layer._pt) layer.setStyle({ fillColor: dotColor(layer._pt) });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    if (!window.L || typeof window.L.map !== "function") {
      var loading = document.getElementById("loading");
      if (loading) {
        loading.textContent =
          "The interactive map library failed to load. Reload this page to try again.";
        loading.setAttribute("role", "alert");
      }
      return;
    }
    // WebGL detection for the fallback notice (P1-1).
    try {
      var _c = document.createElement("canvas");
      var _gl = _c.getContext("webgl") || _c.getContext("experimental-webgl");
      if (!_gl) {
        var _fb = document.getElementById("webgl-fallback");
        if (_fb) _fb.style.display = "";
        var _ld = document.getElementById("loading");
        if (_ld) _ld.style.display = "none";
      }
    } catch (e) {
      /* leave default loading state */
    }

    var boot = Promise.all([
      fetch("../assets/img/heatmap/manifest.json?v=20261107e").then(
        function (r) {
          if (!r.ok) throw new Error("manifest");
          return r.json();
        },
      ),
      fetch("../assets/data/heatmap-rankings.json?v=20261107e").then(
        function (r) {
          if (!r.ok) throw new Error("rankings");
          return r.json();
        },
      ),
    ]);

    boot
      .then(function (parts) {
        manifest = parts[0];
        rankings = parts[1];

        document.getElementById("loading").style.display = "none";
        document.getElementById("map").style.display = "block";
        document.getElementById("controls").style.display = "block";

        // Equirectangular CRS: matches the PNG projection exactly, so the
        // imageOverlay aligns pixel-perfect with no tile layer needed.
        map = L.map("map", {
          crs: L.CRS.EPSG4326,
          center: [20, 0],
          zoom: 2,
          minZoom: 2,
          maxZoom: 12,
          zoomControl: true,
          attributionControl: false,
          worldCopyJump: true,
        });

        var url = imageUrl(manifestKey());
        if (!url) throw new Error("missing default image");
        imageLayer = L.imageOverlay(url, WORLD_BOUNDS).addTo(map);

        // Click-to-load: first click fetches the dataset, then shows the
        // nearest point's popup. Zoom past 5 also triggers the fetch so
        // canvas dots are ready for sharp interaction.
        var hintShown = false;
        map.on("click", function (e) {
          ensureData()
            .then(function () {
              var pt = nearestPoint(e.latlng.lat, e.latlng.lng);
              if (pt) showPopup(pt, e.latlng);
            })
            .catch(function () {
              if (!hintShown) {
                hintShown = true;
                L.popup()
                  .setLatLng(e.latlng)
                  .setContent(
                    "Couldn't load point data. Check your connection and try again.",
                  )
                  .openOn(map);
              }
            });
        });
        map.on("zoomend", function () {
          if (map.getZoom() >= 5) ensureData().catch(function () {});
        });
        // Panning to a square whose chunk is not loaded yet must fill it in, or
        // the data would silently stop at whatever the first view needed.
        map.on("moveend", function () {
          if (chunkLoadAttempted && gridMeta)
            ensureViewportChunks().catch(function () {});
        });

        setupControls();
        updateLegend();
        updateRankings();
      })
      .catch(function (err) {
        document.getElementById("loading").innerHTML =
          '<div style="text-align:center;color:#e64545;">Failed to load heatmap images. <a href="" style="color:var(--accent);">Reload</a></div>';
        // eslint-disable-next-line no-console
        console.error(err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
