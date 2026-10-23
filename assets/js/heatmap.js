import {
  dequantizeDeg,
  dequantizeTariff,
  dequantizeYear,
  dequantizeLcoe,
  decodeGrid,
  decodeYears,
  YEAR_VALUES_PER_POINT,
} from "./sizing/heatmap-grid.js?v=20261023a";
import {
  dotTransform,
  projectDots,
  buildHitIndex,
  hitTest,
  HIT_CELL_PX,
} from "./sizing/heatmap-dots.js?v=20261023a";
import { applyLeafletStyles } from "./sizing/leaflet-styles.js?v=20261023a";

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

  // ── State ──────────────────────────────────────────────────────────────
  var map = null;
  var imageLayer = null;
  var dotLayer = null;
  var yearsData = null;
  var yearsLoading = null;
  var namesData = null;
  var namesLoading = null;
  var pointColors = null;
  var dotPalette = [];
  var CanvasDotLayer = function () {};
  var gridData = null; // fetched on demand (first click / zoom threshold)
  var dataLoading = null; // in-flight fetch promise
  var manifest = null;
  var rankings = null;

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

  // ── On-demand data ───────────────────────────────────────────────────────
  function ensureData() {
    if (gridData) return Promise.resolve(gridData);
    if (dataLoading) return dataLoading;
    dataLoading = fetch("/assets/data/heatmap-grid.bin?v=20261023a")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load heatmap data");
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        var data = decodeGrid(buffer);
        if (
          !Number.isInteger(data.count) ||
          data.lat.length !== data.count ||
          data.lon.length !== data.count
        ) {
          throw new Error("Heatmap grid is incomplete");
        }
        gridData = data;
        enableCanvasDots();
        return data;
      })
      .catch(function (err) {
        dataLoading = null;
        throw err;
      });
    return dataLoading;
  }

  function ensureNames() {
    if (namesData) return Promise.resolve(namesData);
    if (namesLoading) return namesLoading;
    namesLoading = fetch("/assets/data/heatmap-names.json?v=20261023a")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load heatmap point details");
        return res.json();
      })
      .then(function (data) {
        if (
          !gridData ||
          data.count !== gridData.count ||
          data.names.length !== data.count ||
          data.lq.length !== data.count
        ) {
          throw new Error("Heatmap point details do not match the grid");
        }
        namesData = data;
        namesLoading = null;
        return data;
      })
      .catch(function (err) {
        namesLoading = null;
        throw err;
      });
    return namesLoading;
  }

  function ensureYears() {
    if (yearsData) return Promise.resolve(yearsData);
    if (yearsLoading) return yearsLoading;
    yearsLoading = fetch("/assets/data/heatmap-years.bin?v=20261023a")
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load heatmap year data");
        return res.arrayBuffer();
      })
      .then(function (buffer) {
        var data = decodeYears(buffer);
        if (
          !gridData ||
          data.count !== gridData.count ||
          data.yrs.length !== data.count * YEAR_VALUES_PER_POINT
        ) {
          throw new Error("Heatmap year data does not match the grid");
        }
        yearsData = data;
        yearsLoading = null;
        return data;
      })
      .catch(function (err) {
        yearsLoading = null;
        throw err;
      });
    return yearsLoading;
  }

  function yearSeries(index, seriesIndex) {
    if (!yearsData) return null;
    var values = [];
    var offset = index * YEAR_VALUES_PER_POINT + seriesIndex * 4;
    for (var i = 0; i < 4; i++)
      values.push(dequantizeYear(yearsData.yrs[offset + i]));
    return values;
  }

  function pointAt(index) {
    return {
      lat: dequantizeDeg(gridData.lat[index]),
      lon: dequantizeDeg(gridData.lon[index]),
      c: gridData.countries[gridData.cc[index]],
      t: dequantizeTariff(gridData.tq[index]),
      tr: dequantizeTariff(gridData.trq[index]),
      y: gridData.yq[index],
      l: dequantizeLcoe(namesData.lq[index]),
      unserved: gridData.uns[index] < 0 ? 0 : gridData.uns[index],
      u: gridData.uns[index] < 0 ? 0 : gridData.uns[index],
      n: namesData.names[index],
      p: yearSeries(index, 0),
      pr: yearSeries(index, 1),
      b: yearSeries(index, 2),
      br: yearSeries(index, 3),
    };
  }

  function nearestPoint(lat, lng) {
    if (!gridData) return null;
    var bestIndex = -1;
    var bestD = Infinity;
    for (var i = 0; i < gridData.count; i++) {
      var dLat = dequantizeDeg(gridData.lat[i]) - lat;
      var dLng = dequantizeDeg(gridData.lon[i]) - lng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      var d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        bestIndex = i;
      }
    }
    return bestIndex < 0 ? null : pointAt(bestIndex);
  }

  function showPopup(pt, latlng) {
    var isReal = basis === "real";
    var pYrs = getPointYears(pt, "p");
    var bYrs = getPointYears(pt, "b");
    var tiers = gridData.usageTiersKwhDay || gridData.tiers;
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

  // ── Canvas dots (hybrid mode, after data loads) ──────────────────────────
  function costColorAt(index) {
    var tariff = basis === "real" ? gridData.trq[index] : gridData.tq[index];
    return P.costColor(dequantizeTariff(tariff));
  }

  function yearColorAt(index) {
    if (!yearsData) return P.yearColor(null);
    var seriesIndex =
      metric === "p" ? (basis === "real" ? 1 : 0) : basis === "real" ? 3 : 2;
    var offset = index * YEAR_VALUES_PER_POINT + seriesIndex * 4 + usageIdx;
    return P.yearColor(dequantizeYear(yearsData.yrs[offset]));
  }

  function enableCanvasDots() {
    if (!map || !gridData || dotLayer) return;
    if (!CanvasDotLayer.prototype.addTo) initializeCanvasDotLayer();
    dotLayer = new CanvasDotLayer();
    dotLayer.addTo(map);
    refreshCanvasColors();
  }

  function initializeCanvasDotLayer() {
    CanvasDotLayer.prototype = Object.create(L.Layer.prototype);
    CanvasDotLayer.prototype.constructor = CanvasDotLayer;
    CanvasDotLayer.prototype.onAdd = function (leafletMap) {
      this._map = leafletMap;
      this._canvas = L.DomUtil.create(
        "canvas",
        "heat-dots",
        leafletMap.getPane("overlayPane"),
      );
      this._canvas.style.position = "absolute";
      this._canvas.style.pointerEvents = "none";
      this._ctx = this._canvas.getContext("2d");
      this._frame = 0;
      leafletMap.on("move zoom resize zoomanim", this._schedule, this);
      this._redraw();
    };
    CanvasDotLayer.prototype.onRemove = function (leafletMap) {
      leafletMap.off("move zoom resize zoomanim", this._schedule, this);
      if (this._frame) cancelAnimationFrame(this._frame);
      if (this._canvas) L.DomUtil.remove(this._canvas);
    };
    CanvasDotLayer.prototype._schedule = function () {
      if (this._frame) return;
      this._frame = requestAnimationFrame(
        function () {
          this._frame = 0;
          this._redraw();
        }.bind(this),
      );
    };
    CanvasDotLayer.prototype.redraw = function () {
      this._schedule();
    };
    CanvasDotLayer.prototype.bringToFront = function () {
      var pane = this._map && this._map.getPane("overlayPane");
      if (pane && this._canvas) pane.appendChild(this._canvas);
    };
    CanvasDotLayer.prototype._redraw = function () {
      if (!this._map || !gridData || !pointColors) return;
      var size = this._map.getSize();
      var center = this._map.getCenter();
      L.DomUtil.setPosition(
        this._canvas,
        this._map.containerPointToLayerPoint([0, 0]),
      );
      var dpr = window.devicePixelRatio || 1;
      this._canvas.width = Math.round(size.x * dpr);
      this._canvas.height = Math.round(size.y * dpr);
      this._canvas.style.width = size.x + "px";
      this._canvas.style.height = size.y + "px";
      this._canvas.style.opacity = this._map.getZoom() >= 5 ? "0.85" : "0";
      var ctx = this._ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      var count = gridData.count;
      var transform = dotTransform({
        centerLat: center.lat,
        centerLng: center.lng,
        zoom: this._map.getZoom(),
        width: size.x,
        height: size.y,
        projection: "epsg4326",
      });
      var xs = this._xs || (this._xs = new Float32Array(count));
      var ys = this._ys || (this._ys = new Float32Array(count));
      projectDots(gridData.lat, gridData.lon, count, transform, xs, ys);
      var bucketXY = this._bucketXY;
      var bucketLen = this._bucketLen;
      if (!bucketXY || bucketXY.length !== dotPalette.length) {
        bucketXY = this._bucketXY = dotPalette.map(function () {
          return new Float32Array(count * 2);
        });
        bucketLen = this._bucketLen = new Int32Array(dotPalette.length);
      }
      bucketLen.fill(0);
      var radius = 3.5;
      var hitXs = this._hitXs || (this._hitXs = new Float32Array(count));
      var hitYs = this._hitYs || (this._hitYs = new Float32Array(count));
      var hitIds = this._hitIds || (this._hitIds = new Int32Array(count));
      var visible = 0;
      for (var i = 0; i < count; i++) {
        var x = xs[i],
          y = ys[i];
        if (
          x < -radius ||
          y < -radius ||
          x > size.x + radius ||
          y > size.y + radius
        )
          continue;
        var bucket = pointColors[i],
          slot = bucketLen[bucket];
        bucketXY[bucket][slot * 2] = x;
        bucketXY[bucket][slot * 2 + 1] = y;
        bucketLen[bucket] = slot + 1;
        hitXs[visible] = x;
        hitYs[visible] = y;
        hitIds[visible] = i;
        visible++;
      }
      for (var b = 0; b < dotPalette.length; b++) {
        var length = bucketLen[b];
        if (!length) continue;
        var coords = bucketXY[b];
        ctx.beginPath();
        for (var j = 0; j < length; j++) {
          var px = coords[j * 2],
            py = coords[j * 2 + 1];
          ctx.moveTo(px + radius, py);
          ctx.arc(px, py, radius, 0, Math.PI * 2);
        }
        ctx.fillStyle = dotPalette[b];
        ctx.fill();
      }
      this._visibleCount = visible;
      this._hitIndex = buildHitIndex(
        hitXs.subarray(0, visible),
        hitYs.subarray(0, visible),
        visible,
        HIT_CELL_PX,
      );
    };
    CanvasDotLayer.prototype.nearestVisible = function (latlng) {
      if (!this._hitIndex) return -1;
      var container = this._map.latLngToContainerPoint(latlng);
      var slot = hitTest(
        this._hitIndex,
        this._hitXs.subarray(0, this._visibleCount),
        this._hitYs.subarray(0, this._visibleCount),
        container.x,
        container.y,
        7.5,
      );
      return slot < 0 ? -1 : this._hitIds[slot];
    };
  }

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
    if (!gridData) return Promise.resolve();
    if (metric !== "cost" && !yearsData) {
      return ensureYears()
        .then(function () {
          return refreshCanvasColors();
        })
        .catch(function (err) {
          console.error(err);
        });
    }
    var colors = new Uint8Array(gridData.count);
    var palette = [];
    var indexes = new Map();
    for (var i = 0; i < gridData.count; i++) {
      var color = metric === "cost" ? costColorAt(i) : yearColorAt(i);
      var bucket = indexes.get(color);
      if (bucket === undefined) {
        bucket = palette.length;
        palette.push(color);
        indexes.set(color, bucket);
      }
      colors[i] = bucket;
    }
    pointColors = colors;
    dotPalette = palette;
    if (dotLayer) dotLayer.redraw();
    return Promise.resolve();
  }

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

    var stylesReady = applyLeafletStyles();
    var boot = Promise.all([
      fetch("../assets/img/heatmap/manifest.json?v=20261023a").then(
        function (r) {
          if (!r.ok) throw new Error("manifest");
          return r.json();
        },
      ),
      fetch("../assets/data/heatmap-rankings.json?v=20261023a").then(
        function (r) {
          if (!r.ok) throw new Error("rankings");
          return r.json();
        },
      ),
    ]);

    boot
      .then(async function (parts) {
        manifest = parts[0];
        rankings = parts[1];

        await stylesReady;
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
              return Promise.all([ensureYears(), ensureNames()]).then(
                function () {
                  var pt = nearestPoint(e.latlng.lat, e.latlng.lng);
                  if (pt) showPopup(pt, e.latlng);
                },
              );
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
