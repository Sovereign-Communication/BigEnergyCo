// Size-My-System UI controller. Loaded as an ES module from index.html.

// All computation happens in sizing-worker.js; this file is DOM glue only.

//

// Load input is end-user-first: an appliance checklist with plain-language

// quantity and usage sliders, a monthly-bill mode, and a tucked-away

// direct-kWh mode for people who already know their numbers.

// NOTE: nasa.js also exports CITY_PRESETS, but location search here uses the
// CITY_CATALOG in cities.js — importing the preset list would only bloat the
// bundle, so it is deliberately not imported.
import { APPLIANCES } from "./appliances.js?v=20260921f";
import {
  createRunChannel,
  staleRunAction,
  errorReleasesRunChannel,
  RUN_REPLY_DEADLINE_MS,
} from "./run-coordinator.js?v=20260921f";
import { CITY_CATALOG, nearestCity } from "./cities.js?v=20260921f";
import {
  drawAutoChart,
  drawCumCostChart,
  drawSocChart,
  drawSocChartForEntry,
  initCharts,
  setupChartInteractions,
  setupZoomButtons,
} from "./charts.js?v=20260921f";
import {
  locateMe,
  purgeLegacyCityCache,
  setupCitySearch,
} from "./location-picker.js?v=20260921f";

import {
  estimateTariff,
  CURRENCIES,
  fxMeta,
  DAYS_PER_MONTH,
  battOnlyCost,
} from "./pricing.js?v=20260921f";

import { savingsPanelState, seriesBreakdown } from "./money.js?v=20260921f";
import {
  leadAcidChipCopy,
  leadAcidComparison,
  leadAcidReferenceCopy,
} from "./lead-acid.js?v=20260921f";

import {
  buildBom,
  panelLayout,
  PANEL_WATTS_DEFAULT,
} from "./bom.js?v=20260921f";

import { BOM_ITEMS } from "../shared/content.js?v=20260921f";

import {
  applyI18n,
  initLangPicker,
  resolveLang,
} from "../shared/i18n.js?v=20260921f";

import { LOCALES } from "../shared/locales.js?v=20260921f";

import { escapeHtml, escapeAttr } from "../shared/escape.js?v=20260921f";
import { JARGON, explainElement } from "../shared/jargon-dict.js?v=20260921f";
import {
  isSimpleMode,
  initSimpleMode,
  setSimpleMode,
  onSimpleModeChange,
  modeLabel,
} from "../shared/simple-mode.js?v=20260921f";
import { buildSimpleView } from "../shared/simple-view.js?v=20260921f";
import {
  advisorJevContext,
  interpretSanity,
  sanityResponseIsCurrent,
  renderSanityBadge,
  requestSanity,
  sanityState,
} from "./validate.js?v=20260921f";
import {
  CUT_TARGET_PCT,
  targetForPct,
} from "../shared/cut-targets.js?v=20260921f";
import {
  SHARE_PREFIX,
  b64urlEncode,
  parseShareHash,
} from "./share-codec.js?v=20260921f";

import {
  renderFrontier,
  frontierVerdict,
  markerOffCurveNote,
} from "./frontier-chart.js?v=20260921f";

import {
  rescalePayload,
  scaleRecord,
  sameSiteOptions,
  relocalizeOversizeCallout,
} from "./rescale.js?v=20260921f";

import { coldCapacityScale, cycleLifeForDoD } from "./engine.js?v=20260921f";
import {
  createLeafletProvider,
  createMapProviderRegistry,
  rectangleAreaM2,
  manualRoofHint,
} from "./map-provider.js?v=20260921f";
import {
  createWizard,
  persistWizard,
  restoreWizard,
} from "./wizard.js?v=20260921f";
import { tiltValueSummary } from "./tilt-harvest.js?v=20260921f";
import { surplusAnchor, budgetSpanMax } from "./budget-span.js?v=20260921f";

// Charts own their own state (zoom range, cached series); the controller
// injects only the DOM/format/i18n/currency boundary.
initCharts({ $, el, t, fmt, money });
// Live, quiet feedback for the optional roof/yard area box: what it actually
// caps, and one-click disregard. Kept deliberately subtle — small muted text
// under the input — until the visitor has verified it behaves perfectly.
function updateRoofAreaCapNote() {
  const input = $("roofAreaM2");
  const note = $("roofAreaCapNote");
  if (!input || !note) return;
  const area = parseFloat(input.value);
  if (!Number.isFinite(area) || area <= 0) {
    note.style.display = "none";
    note.textContent = "";
    return;
  }
  const count = Math.floor(area / 6);
  const capKw = Math.floor(area / 6) * (PANEL_WATTS_DEFAULT / 1000);
  note.style.display = "block";
  // The cap assumes ~6 m² per panel (tilt rows plus walkways on a real
  // roof); the parts list quotes the tighter bare-panel footprint. Both are
  // honest — installed space vs hardware space — so the note says which.
  note.textContent =
    `Caps the search at ${count} × ${PANEL_WATTS_DEFAULT} W panels ≈ ${capKw.toFixed(1)} kW of solar (≈6 m² per panel with access space). ` +
    `Clear the box to remove the cap.`;
}

// Roof/yard area (m²): an optional input that silently caps the searched PV
// size. Live note + re-run, exactly like the other quiet-refresh inputs.
function setupRoofAreaInput() {
  const input = $("roofAreaM2");
  if (!input) return;
  input.addEventListener("input", () => {
    updateRoofAreaCapNote();
    markPrecalcDirty();
  });
  input.addEventListener("change", () => {
    updateRoofAreaCapNote();
    markPrecalcDirty();
  });
  updateRoofAreaCapNote();
}

import {
  batteryReplacements,
  lifetimeCostUsd,
  cumulativeCostSeries,
} from "./money.js?v=20260921f";

import { fullRange, landedMidBattKwhFor } from "./pricing.js?v=20260921f";

let worker = null;

let lastPayload = null; // kept for share links + the printable summary
let prevFxSnapshot = null; // for tariff display conversion on currency switch

// Result detail level: "best" | "compare" | "matrix" (auto-chemistry runs only).
let resultLevel = "best";

// Quick mode shows only the essential inputs; Manual reveals the full form.
// Both modes require the explicit sizing button before any calculation.
let quickMode = true;
// No sizing work is allowed until the visitor explicitly clicks the run button.
// After the first successful result, pre-calc changes may refresh it quietly.
let runAuthorized = false;
// Pre-calculation inputs are a deliberate checkpoint: changing one invalidates
// the result and waits for the visitor to click Size My System again. Result
// controls (the continuous cut/budget spectrum) use cached data instead.
let precalcDirty = true;
let locationResolved = false;
let coordinatesPending = false;
let coordDebounceTimer = null;
// Every user location choice gets a generation. Background GPS refinements
// carry their original generation and may only pin while it remains current.
let locationChoiceGeneration = 0;
let wizard = restoreWizard();
let roofMapRegistry = null;
let roofMapUnsubscribe = null;
let roofMapRectangle = null;
let roofMapFirstCorner = null;

// The monthly-bill slider stores the user's real input as consumed ENERGY
// (kWh/day, default 20) and re-expresses that as local currency whenever the
// tariff, currency, or location changes — so switching cities never silently
// changes what the user told us they use.
let billAnchorKwh = 20;
let billTouched = false;
let billUserNominal = null;

// Bill-cut slider (1–150%): the replacement for the old 60/80/95 dropdown.
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

let runTimer = null;
let lastRunAdoptsFocus = false;

// The worker runs one full sizing at a time and cannot be preempted: when a
// new run is requested while one is in flight, collapse it into a single
// trailing run instead of queueing seconds of stale engine work behind the
// slider. The screen already shows the rescaled numbers, so nothing is lost.
// The run channel (run-coordinator.js) is the single owner of that state:
// busy, the sequence that retires superseded replies, and the collapsed
// request. Every full-run reply is released through flushPendingRun().
const runChannel = createRunChannel();

// ── Worker reply deadline ────────────────────────────────────────────────
// A worker that never replies (challenge-tainted load, dead worker, lost
// reply) must surface an honest, retryable error instead of hanging forever
// on "running…" — reproduced live on production through the share-restore
// auto-run. The watch itself lives in run-coordinator.js: armed with
// begin(), retired by settle() inside the single flushPendingRun() funnel,
// so a fired callback whose token is no longer current belongs to a run
// already answered and reports nothing. Every run uses the fixed three-minute
// bound so visitors and public URLs cannot weaken the recovery timer.
let runDeadlineTimer = null;
let runDeadlineToken = 0;

function armRunDeadline(runSeq) {
  if (runDeadlineTimer !== null) clearTimeout(runDeadlineTimer);
  runDeadlineToken = runChannel.armDeadline(runSeq);
  runDeadlineTimer = setTimeout(handleRunDeadline, RUN_REPLY_DEADLINE_MS);
}

function handleRunDeadline() {
  runDeadlineTimer = null;
  if (!runChannel.deadlineCurrent(runDeadlineToken)) return;
  const current = runChannel.deadlineOwns(runChannel.latestSeq);
  const hasPendingRun = runChannel.pending;
  // A timed-out worker may still be blocked inside its current task; merely
  // posting a retry would queue behind that task forever. Terminate it and
  // clear the reference so the next explicit run creates a fresh worker.
  const stuckWorker = worker;
  worker = null;
  stuckWorker?.terminate();
  sliceBusy = false;
  pendingSlice = null;
  sliceToken++;

  // If inputs changed, preserve their newer status. A queued replacement is
  // retried against a fresh worker; otherwise retire the timed-out sequence
  // and leave recovery to the visitor. Every branch releases through the
  // same funnel.
  if (current) {
    setStatus(t("errorTimeout"));
    pipelineStop(false);
    if (!hasPendingRun) runChannel.invalidate();
  }
  flushPendingRun();
}

// The last full-run inputs, kept so a bill-only change can compute the exact
// load factor for an instant rescale against the retained payload.
let lastRunInput = null;

// JSON fingerprint of the inputs behind the last successful run: an identical
// next run is answered from the engine's payload cache in milliseconds, so
// the UI skips the loading choreography entirely (isInstantRepeat in run()).
let lastOkKey = null;

// A quiet run (bill-slider refine after a rescale) must not spin the button,
// flash status, or scroll — the screen already shows the rescaled numbers.
let lastRunQuiet = false;

// Serial for incremental "reSlice" patches within one payload epoch.
// Epoch links every patch to the payload it was computed against: a full run
// bumps payloadEpoch, so a slice from older inputs can never merge into a
// newer payload (independent counters alone could not prevent that).
// sliceBusy/pendingSlice collapse rapid slider edits the same way the run
// channel collapses full runs
// does for full runs (see run()).
let sliceToken = 0;
let payloadEpoch = 0;
let sliceBusy = false;
let pendingSlice = null; // { focusPvKw, focusBattKwh, focusChemistry }

// PWA install prompt holder
let deferredInstallPrompt = null;

// ── Unified curve selection state ─────────────────────────────────────────
// One curve, one selection. curvePreview is the slider drag-preview (amber
// ring + readout, highlight only, worker untouched); the committed selection
// lives in selectedKey / adoptedEntry / frontierSelected. focusFirst:
// grid-tie auto mode where the granular focus panel REPLACES the matrix and
// the recommendation card (everywhere else the curve stands with them).
let focusFirst = false;
let curvePreview = null;

// ── Slider cooperation ──────────────────────────────────────────────────────
// The bill-cut slider and the up-front budget slider are two views of ONE
// choice, and a live report described them "over-writing each other": the
// budget slider was re-seated onto the recommendation by every re-render, so a
// cut edit silently threw away the budget the visitor had just dialed in, and
// picking a budget point left the cut control (slider + form select) stale.
//
// Rule: whichever control the visitor just touched owns the truth, the other
// follows it, and only a genuinely new scenario resets both.
//   * budgetPinnedUsd — set while (and after) the visitor uses the budget
//     slider: re-renders keep that position instead of re-seating on the
//     marker. Cleared by a fresh run (new inputs/location/mode).
let budgetPinnedUsd = null;
// Set when the bill-cut slider is the control the visitor just moved: the
// recommendation is about to move, so the budget thumb follows it once.
let followMarkerOnce = false;

// Bill slider bounds, expressed in kWh/day and converted to local currency.
// Wide enough to fantasize (estate-scale loads); the engine, not the slider,
// is the honesty bound (envelope-limited / area-limited verdicts say so out
// loud).
const BILL_MIN_KWH = 2;
const BILL_MAX_KWH = 400;

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

  // English fallback before the raw key: a string added in one locale must
  // read as English everywhere else, never as key-ese.
  let str = dict[key] ?? LOCALES.en[key] ?? key;

  for (const [k, v] of Object.entries(params)) {
    // A function replacer, not a string: a value containing "$&" or "$n"
    // (any formatted money figure) would otherwise be read as a replacement
    // pattern and silently mangled — "$200" loses its dollars to the $2 rule.
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), () => v);
  }

  return str;
}

// -- Appliance library -------------------------------------------------------

// w = watts WHILE RUNNING. duty:true items (fridges, ACs, pumps) only run a

// fraction of the day - their slider means "hours it actually runs," capped

// to realistic compressor time, and the row shows the resulting average draw.

const CHEM_KEYS = new Set(["auto", "naion", "lfp", "agm"]);

function $(id) {
  return document.getElementById(id);
}

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

// Reduced-motion users get instant scrolling instead of JS smooth scroll.
// Same contract as chat.js's helper (a classic script can't share imports).
function scrollBehavior() {
  return window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function setStatus(text) {
  const s = $("sizingStatus");

  if (s) s.textContent = text;
}

// ── Staged loading pipeline ───────────────────────────────────────────────
// Data loading must be legible: a determinate stepper (City → Weather →
// Simulating → Rendering) with a live per-chunk weather bar and elapsed
// seconds. Weather chunk progress comes through the worker; simulation
// length is unknowable up front, so its bar is indeterminate by design.
const PIPELINE_STEP_IDS = ["pipeCity", "pipeWeather", "pipeSim", "pipeRender"];
let pipelineTimer = null;

function pipelineEl() {
  return $("loadingPipeline");
}

function pipelineStart(stage = "City") {
  const wrap = pipelineEl();
  if (!wrap) return;
  const started = Date.now();
  const note = $("pipeElapsed");
  wrap.style.display = "block";
  wrap.setAttribute("aria-busy", "true");
  if (note) note.textContent = "";
  if (pipelineTimer) clearInterval(pipelineTimer);
  pipelineTimer = setInterval(() => {
    if (note) {
      const s = ((Date.now() - started) / 1000).toFixed(1);
      note.textContent = t("pipelineElapsed", { s });
    }
  }, 250);
  pipelineStage(stage);
}

function pipelineKey(stage) {
  // Callers pass mixed case ("city", "City", "Weather", "Sim"); the step ids
  // are PascalCase ("pipeCity", "pipeWeather", ...), so normalize here instead
  // of trusting every call site. Returns null for unknown stages.
  const s = String(stage || "").trim();
  if (!s) return null;
  const key = "pipe" + s.charAt(0).toUpperCase() + s.slice(1);
  return PIPELINE_STEP_IDS.includes(key) ? key : null;
}

function pipelineStage(stage, weatherDone = 0, weatherTotal = 0) {
  const wrap = pipelineEl();
  if (!wrap) return;
  const key = pipelineKey(stage);
  if (!key) return;
  const order = PIPELINE_STEP_IDS.indexOf(key);
  PIPELINE_STEP_IDS.forEach((id, i) => {
    const node = $(id);
    if (!node) return;
    const state = i < order ? "done" : i === order ? "active" : "todo";
    node.dataset.state = state;
    if (id === "pipeWeather") {
      const bar = $("pipeWeatherBar");
      const txt = $("pipeWeatherTxt");
      if (bar && txt) {
        if (i === order && weatherTotal > 0) {
          bar.dataset.mode = "determinate";
          const pct = Math.round((weatherDone / weatherTotal) * 100);
          bar.style.setProperty("--pipe-pct", pct + "%");
          txt.textContent = t("pipelineChunks", {
            done: weatherDone,
            total: weatherTotal,
          });
        } else {
          bar.dataset.mode = "indeterminate";
          bar.style.setProperty("--pipe-pct", "0%");
          txt.textContent =
            i < order
              ? t("pipelineCached")
              : i === order
                ? t("pipelineReaching")
                : "";
        }
      }
    }
  });
}

function pipelineStop(success) {
  if (pipelineTimer) {
    clearInterval(pipelineTimer);
    pipelineTimer = null;
  }
  const wrap = pipelineEl();
  if (!wrap) return;
  wrap.setAttribute("aria-busy", "false");
  if (success) {
    wrap.style.display = "none";
  } else {
    // Keep the stepper visible on failure with a failure accent so the
    // visitor can see HOW FAR the pipeline got before the honest error.
    const active =
      $("pipeSim")?.dataset.state === "active" ? "pipeSim" : "pipeWeather";
    const node = $(active);
    if (node) node.dataset.state = "failed";
  }
}

// Speed note: a small honest badge explaining WHY a run was instant.
// Three flavors: repeat of this exact configuration (payload cache), cached
// weather for this site, or nothing (cold compute — no badge, no spin).
function showSpeedNote(kind, meta) {
  const note = $("speedNote");
  if (!note) return;
  // Fixed two decimals so "-157.9" and "-157.90" never disagree between the
  // badge, the inputs, and the share link.
  const lat = Number(meta?.latitude);
  const lon = Number(meta?.longitude);
  const where =
    meta &&
    (meta.offlineCity ||
      (Number.isFinite(lat) && Number.isFinite(lon)
        ? `${lat.toFixed(2)}, ${lon.toFixed(2)}`
        : ""));
  if (kind === "repeat") {
    note.textContent = t("speedNoteRepeat");
  } else if (kind === "cache") {
    const offline = Boolean(meta && meta.offline);
    const base = offline ? "speedNoteOffline" : "speedNoteCached";
    note.textContent = where
      ? t(offline ? "speedNoteOfflineWhere" : "speedNoteCachedWhere", {
          where,
        })
      : t(base);
  } else {
    note.textContent = "";
    return;
  }
  note.style.display = "block";
}

function hideSpeedNote() {
  const note = $("speedNote");
  if (note) note.style.display = "none";
}

// Background weather prefetch: called the moment a location resolves, so
// the ~2 MB satellite pull overlaps the visitor's form-filling instead of
// starting at the click. The prefetch runs INSIDE the sizing worker (same
// module instance as the runs): its own in-flight dedupe guarantees a
// single network pull even when a run starts mid-prefetch, and the warmed
// memo lands exactly where runSizing will look. Deduped per site on this
// side too (WARMED_SITES). Errors are silent here by design — the run path
// owns the honest fallback story.
const WARMED_SITES = new Set();
let prefetchSeq = 0;
function warmSiteWeather(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (WARMED_SITES.has(key)) return;
  WARMED_SITES.add(key);
  try {
    // Booting the worker here also pre-warms the engine module graph, so
    // the first run skips worker startup too.
    ensureWorker().postMessage({
      type: "prefetch",
      seq: ++prefetchSeq,
      latitude: lat,
      longitude: lon,
      years: 5,
    });
  } catch {
    /* worker unavailable: the run path fetches as before */
  }
}

function applySimpleMode() {
  const simpleMode = isSimpleMode();
  document.documentElement.dataset.displayMode = simpleMode
    ? "simple"
    : "technical";
  const toggle = $("simpleModeToggle");
  if (toggle) {
    toggle.checked = simpleMode;
    toggle.setAttribute("aria-label", `${modeLabel(simpleMode)} enabled`);
  }
  // Simple mode swaps the detail panels for one plain-language card: the
  // wrapper is only ever revealed with fresh content inside, so a stale card
  // can never masquerade as a fresh result.
  const simpleWrap = $("simpleResultsWrap");
  if (simpleWrap) {
    simpleWrap.innerHTML = "";
    simpleWrap.style.display = "none";
    if (simpleMode && lastPayload) renderSimpleResults(lastPayload);
  }
  // The badge must survive mode toggles in BOTH directions: each surface's
  // render re-mounts it through the same sanity owner (runSanityCheck), from
  // the state cache — never a second /api/jev request.
  if (lastPayload) runSanityCheck(lastPayload);
  document.querySelectorAll("[data-jargon]").forEach((node) => {
    if (simpleMode) {
      // Unknown/typo'd terms stay plain text: explainElement returns false
      // and no button semantics or handlers are attached to a dead tooltip.
      const lang = document.documentElement.lang || "en";
      if (!explainElement(node, node.dataset.jargon, lang)) return;
      node.setAttribute("role", "button");
      node.setAttribute("aria-expanded", "false");
      if (!node.dataset.eli5Wired) {
        node.dataset.eli5Wired = "true";
        const toggleExplanation = () => {
          const open = node.getAttribute("aria-expanded") === "true";
          node.setAttribute("aria-expanded", String(!open));
          node.classList.toggle("eli5-open", !open);
        };
        node.addEventListener("click", toggleExplanation);
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExplanation();
          }
        });
      }
    } else {
      node.removeAttribute("data-eli5");
      node.removeAttribute("title");
      node.removeAttribute("tabindex");
      node.removeAttribute("role");
      node.removeAttribute("aria-expanded");
      node.classList.remove("eli5-open");
    }
  });
}

function setupSimpleMode() {
  initSimpleMode();
  const toggle = $("simpleModeToggle");
  if (!toggle) return;
  toggle.checked = isSimpleMode();
  // The module owns the state; this listener only translates DOM events
  // into setSimpleMode() and re-renders through the subscription below.
  toggle.addEventListener("change", () => {
    setSimpleMode(toggle.checked);
  });
  onSimpleModeChange((simple) => {
    if (toggle.checked !== simple) toggle.checked = simple;
    applySimpleMode();
    if (simple && lastPayload) {
      document
        .getElementById("sizing")
        .scrollIntoView({ behavior: scrollBehavior() });
    }
  });
  applySimpleMode();
}

// Simple mode's single results surface. Reads the same payload and the same
// selected entry the technical cards render — the numbers cannot diverge.
function renderSimpleResults(p) {
  const wrap = $("simpleResultsWrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (p.unreachableReason) {
    wrap.style.display = "block";
    wrap.appendChild(
      el("p", { class: "simple-note", role: "status" }, t("simpleInfeasible")),
    );
    return;
  }

  const sel = resolveSelected(p);
  const entry = sel && sel.solvable ? sel : p.best;
  const series = (sel && sel.cumCostSeries) || p.best?.cumCostSeries;
  const bd = series ? seriesBreakdown(series) : null;
  const saved = bd ? bd.saved : NaN;
  const view = buildSimpleView({
    p,
    entry,
    saved,
    // Injected formatters keep number/currency policy in money.js.
    fmt: { fmt, money, moneyRange, fmtPaybackRange },
  });

  if (!view.feasible) return;

  const card = el("div", { class: "simple-results-card" });
  const goalText =
    p.mode === "gridtie"
      ? t("simpleGoalGrid", { pct: entry.cutPct ?? 0 })
      : t("simpleGoalOffgrid");
  card.appendChild(
    el(
      "div",
      { class: "simple-headline" },
      t("simpleHeadline", { goal: goalText }),
    ),
  );

  const dl = el("dl", { class: "simple-heroes" });
  for (const h of view.heroes) {
    const item = el("div");
    const dt = el("dt");
    dt.textContent = h.label;
    if (h.term && JARGON[h.term]) {
      explainElement(dt, h.term);
    }
    const dd = el("dd");
    dd.textContent = h.value;
    if (h.sub) {
      const sub = el("span", { class: "simple-sub" });
      sub.textContent = h.sub;
      dd.appendChild(sub);
    }
    item.append(dt, dd);
    dl.appendChild(item);
  }
  card.appendChild(dl);

  card.appendChild(
    el(
      "p",
      { class: "simple-note" },
      t("simpleWhatItMeans") + " " + t("simpleCaveat"),
    ),
  );

  const actions = el("div", { class: "simple-actions" });
  const details = el(
    "button",
    { type: "button", class: "btn btn-outline", id: "btnSimpleDetails" },
    t("simpleSeeDetails"),
  );
  details.addEventListener("click", () => {
    // One state setter; the mode subscription re-renders the whole surface.
    setSimpleMode(false);
    $("resultsRegion").scrollIntoView({ behavior: scrollBehavior() });
  });
  actions.appendChild(details);
  // The advisor is arguably MOST valuable in Simple mode — the visitor chose
  // fewer numbers, so plain-language questions deserve a path in. The result
  // row's advisor button is hidden by the mode's CSS, so the card carries its
  // own, wired to the same mode-aware askAdvisor() (ELI5 style when here).
  const advisor = el(
    "button",
    { type: "button", class: "btn btn-secondary", id: "btnSimpleAdvisor" },
    t("simpleAskAdvisor"),
  );
  advisor.addEventListener("click", askAdvisor);
  actions.appendChild(advisor);
  const bomBtn = el(
    "button",
    { type: "button", class: "btn btn-outline" },
    t("simpleDownloadBom"),
  );
  bomBtn.addEventListener("click", downloadBomCsv);
  actions.appendChild(bomBtn);
  card.appendChild(actions);

  wrap.style.display = "block";
  wrap.appendChild(card);
}

// Infeasibility banner: surfaces a structural (mode × hardware × target)
// reason above the cards so visitors know WHY nothing solved and what to
// change. Hides itself the moment a payload without a reason arrives (i.e.
// a normal run) so it never lingers across the page.
// Every reason maps to its locale keys — the copy lives in locales.js so a
// non-English visitor reads the failure in their own language, like the rest
// of the chrome.
const INFEASIBLE_HINTS = {
  // run.js emits this code only when an area cap was actually provided.
  "area-limited": {
    titleKey: "infeasibleAreaTitle",
    bodyKey: "infeasibleAreaBody",
  },
  // The search envelope, not any visitor input, is the limit here.
  "envelope-limited": {
    titleKey: "infeasibleEnvelopeTitle",
    bodyKey: "infeasibleEnvelopeBody",
  },
  "needs-battery": {
    titleKey: "infeasibleNeedsBatteryTitle",
    bodyKey: "infeasibleNeedsBatteryBody",
  },
  "needs-panels": {
    titleKey: "infeasibleNeedsPanelsTitle",
    bodyKey: "infeasibleNeedsPanelsBody",
  },
  "needs-pv-surplus": {
    titleKey: "infeasibleNeedsSurplusTitle",
    bodyKey: "infeasibleNeedsSurplusBody",
  },
};
function renderInfeasibleBanner(reason) {
  let banner = $("infeasibleBanner");
  // Created on demand, and only when there is something to say: clearing must
  // stay a no-op on a page whose runs were all solvable, so a normal visitor
  // never gets an empty banner node injected under the status line.
  if (!banner) {
    if (!reason) return;
    banner = el("div", { id: "infeasibleBanner", class: "infeasible-banner" });
    const target = $("sizingStatus") || document.body;
    if (target.parentNode) target.parentNode.insertBefore(banner, target);
  }
  // The visual banner is created on demand and toggled with display:none, which
  // is exactly the shape a screen reader will not announce. The reason is
  // mirrored into the sr-only region declared in the markup, which stays
  // rendered — so "why did nothing solve?" reaches assistive tech too.
  const live = $("infeasibleLive");
  if (!reason) {
    banner.style.display = "none";
    banner.innerHTML = "";
    if (live) live.textContent = "";
    return;
  }
  const hint = INFEASIBLE_HINTS[reason] || {
    titleKey: "infeasibleGenericTitle",
    bodyKey: "infeasibleGenericBody",
  };
  const title = t(hint.titleKey);
  const body = t(hint.bodyKey);
  banner.style.display = "block";
  banner.innerHTML = "";
  banner.appendChild(el("div", { class: "infeasible-title" }, title));
  banner.appendChild(el("div", { class: "infeasible-body" }, body));
  if (live) live.textContent = `${title}. ${body}`;
}

function fmtH(h) {
  if (h >= 24) return t("fmtAllDay");

  if (h >= 1) return t("fmtHoursDay", { h: Math.round(h * 2) / 2 });

  return t("fmtMinutesDay", { m: Math.round(h * 60) });
}

function fmtKwh(x) {
  if (!Number.isFinite(Number(x))) return "–";
  return (Math.round(x * 100) / 100).toString();
}

// -- Load-mode plumbing ------------------------------------------------------

// Auto-mode basis submenus: which reliability tier / bill-cut target the

// three chemistry cards represent. Visible only when chemistry = Auto.

function updateAutoRows() {
  const isAuto = $("chemSelect").value === "auto";

  const gt = $("systemGoal") ? $("systemGoal").value === "gridtie" : false;

  const tierRow = $("autoTierRow"),
    targetRow = $("autoTargetRow");

  if (tierRow) tierRow.style.display = isAuto && !gt ? "block" : "none";

  // Bill-cut is a continuous post-result control, not an upfront preset.
  // Keep the hidden select as the internal compatibility state for share links
  // and engine inputs; the visible results slider owns the spectrum.
  if (targetRow) targetRow.style.display = "none";
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

  let kwh = 0,
    peakW = 0,
    peakSurgeW = 0,
    requiresSplitPhase = false;

  rows.forEach((row) => {
    const w = parseFloat(row.dataset.w);
    const qty = parseInt(row.dataset.qty, 10);
    const h = parseFloat(row.dataset.h);
    const surge = parseFloat(row.dataset.surgeW) || w;
    if (row.dataset.splitPhase === "true") requiresSplitPhase = true;

    kwh += (w * qty * h) / 1000;
    peakW += w * qty;
    peakSurgeW += surge * qty;
  });

  return { kwh, peakW, peakSurgeW, requiresSplitPhase, count: rows.length };
}

function getTariff() {
  const v = parseFloat($("customRateVal")?.value);

  return Number.isFinite(v) && v > 0 ? v : null;
}

// Fixed monthly connection fee, display currency like the tariff (a number
// only the visitor knows — never auto-estimated, so no touched-flag needed).
function getFixedCharge() {
  const v = parseFloat($("fixedChargeVal")?.value);

  return Number.isFinite(v) && v >= 0 ? v : null;
}

function fixedDisplay() {
  return getFixedCharge() || 0;
}

// ── Monthly-bill slider (local currency, anchored to kWh/day) ───────────────

// The slider speaks the same language as a bill: the local-currency monthly
// amount, derived from the user's kWh/day anchor and the active tariff.
function kwhFromBill(bill, rate) {
  // A bill below the fixed connection charge would invert to a negative
  // anchor; clamp at zero so downstream notes never read "-3 kWh/day".
  if (!Number.isFinite(bill) || !Number.isFinite(rate) || rate <= 0) return 0;
  return Math.max(0, (bill - fixedDisplay()) / (rate * DAYS_PER_MONTH));
}

function billForKwh(kwh, rate) {
  return kwh * DAYS_PER_MONTH * rate + fixedDisplay();
}

function fmtBill(v) {
  const fx = fxActive();
  if (!fx) return "$" + Math.round(v).toLocaleString() + t("billPerMonth");
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: fx.code,
        maximumFractionDigits: 0,
      }).format(v) + t("billPerMonth")
    );
  } catch {
    return (
      (CURRENCIES[fx.code]?.symbol || "") +
      Math.round(v).toLocaleString() +
      t("billPerMonth")
    );
  }
}

// Re-express the slider around the current rate/currency, preserving the
// user's kWh/day anchor. Runs whenever location/tariff/currency change.
function syncBillSlider() {
  const slider = $("billSlider");
  if (!slider) return;
  const rate = displayRate();
  const minBill = Math.max(1, Math.round(billForKwh(BILL_MIN_KWH, rate)));
  const maxBill = Math.max(
    minBill + 2,
    Math.round(billForKwh(BILL_MAX_KWH, rate)),
  );

  let value;
  if (billTouched && Number.isFinite(billUserNominal) && billUserNominal > 0) {
    value = Math.min(maxBill, Math.max(minBill, Math.round(billUserNominal)));
    billAnchorKwh = kwhFromBill(value, rate);
  } else {
    value = Math.min(
      maxBill,
      Math.max(minBill, Math.round(billForKwh(billAnchorKwh, rate))),
    );
  }

  slider.min = String(minBill);
  slider.max = String(maxBill);
  // 1-2-5 ladder step ≈ range/300 stops: coarse currencies step in thousands,
  // USD in whole dollars, and tiny ranges keep cents (the old Math.max(1, …)
  // floor forced $1 jumps on cent-scale ranges).
  const rawStep = Math.max((maxBill - minBill) / 300, 0.01);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  slider.step = String((norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag);
  slider.value = String(value);
  const out = $("billSliderVal");
  if (out) out.textContent = "~" + fmtBill(value);

  // Keep offgridKwhSlider tied in parity with the bill's kWh anchor
  const offSlider = $("offgridKwhSlider");
  const offOut = $("offgridKwhVal");
  const kwhInput = $("dailyKwhInput");
  if (offSlider && Number.isFinite(billAnchorKwh) && billAnchorKwh > 0) {
    const roundedKwh = Math.round(billAnchorKwh * 10) / 10;
    const clampedKwh = Math.min(
      parseFloat(offSlider.max) || 60,
      Math.max(parseFloat(offSlider.min) || 1, roundedKwh),
    );
    offSlider.value = String(clampedKwh);
    if (offOut)
      offOut.textContent = t("offgridKwhReadout", { kwh: clampedKwh });
    if (kwhInput) kwhInput.value = String(clampedKwh);
  }

  const note = $("quickBillNote");
  if (note) {
    const params = {
      bill: fmtBill(value),
      kwh: Math.round(billAnchorKwh),
    };
    note.textContent = quickMode
      ? t("quickBillStarts", params)
      : t("quickBillManual", params);
  }
  updateLoadReadout();
}

function displayRate() {
  return getTariff() || 0.28;
}

function updateLoadReadout() {
  const mode = $("loadMode").value;

  const out = $(
    mode === "appliances"
      ? "readoutAppliances"
      : mode === "bill"
        ? "readoutBill"
        : "readoutKwh",
  );

  if (!out) return;

  if (mode === "appliances") {
    const { kwh, peakW, count } = applianceState();

    if (!count) {
      out.textContent = t("readoutAppliancesEmpty");
    } else {
      out.innerHTML = "";

      out.appendChild(
        el(
          "span",
          {},
          t("readoutAppliancesSummary", {
            kwh: fmtKwh(kwh),
            peakW: peakW.toLocaleString(),
          }),
        ),
      );
    }
  } else if (mode === "bill") {
    const bill = parseFloat($("billSlider")?.value);

    const rate = getTariff();

    if (
      Number.isFinite(bill) &&
      bill > 0 &&
      Number.isFinite(rate) &&
      rate > 0
    ) {
      const kwhDay = Math.max(0, kwhFromBill(bill, rate));

      out.textContent = t("readoutBill", { kwhDay: fmtKwh(kwhDay) });
    } else {
      out.textContent = t("readoutBillIncomplete");
    }
  } else {
    const kwh = parseFloat($("dailyKwhInput").value);

    out.textContent =
      Number.isFinite(kwh) && kwh > 0
        ? t("readoutKwhReady", { kwh: fmtKwh(kwh) })
        : t("readoutKwhEmpty");
  }
}

function renderAppliances() {
  const list = $("applianceList");

  list.innerHTML = "";

  for (const grp of APPLIANCES) {
    const gEl = el(
      "div",
      {
        style:
          "font-size:0.8rem;font-weight:700;color:var(--primary-accent);letter-spacing:0.4px;margin:0.9rem 0 0.35rem;text-transform:uppercase;",
      },
      grp.g,
    );

    list.appendChild(gEl);

    for (const it of grp.items) {
      const maxH = it.maxH || 24;

      const row = el("div", {
        class: "ap-row",
        "data-w": it.w,
        "data-qty": "1",
        "data-h": it.h,
        "data-duty": it.duty ? "1" : "",
        "data-item-name": it.n,
        "data-surge-w": it.surgeW || it.w,
        "data-split-phase": it.splitPhase ? "true" : "false",
      });

      row.style.cssText =
        "display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0.5rem;border:1px solid transparent;border-radius:8px;flex-wrap:wrap;";

      const cb = el("input", {
        type: "checkbox",
        style: "width:auto;margin:0;transform:scale(1.2);cursor:pointer;",
      });

      const labelText = it.splitPhase ? `${it.n} ⚡240V` : it.n;
      const name = el(
        "label",
        {
          style:
            "flex:1 1 200px;cursor:pointer;font-size:0.92rem;font-weight:500;margin:0;",
        },
        labelText,
      );

      name.prepend(cb);

      const watts = el(
        "span",
        {
          style:
            "font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);background:rgba(255,255,255,0.05);padding:0.1rem 0.45rem;border-radius:10px;",
        },

        it.duty ? t("apWattsRunning", { w: it.w }) : t("apWatts", { w: it.w }),
      );

      // quantity stepper (hidden until checked)

      const qtyWrap = el("span", {
        style: "display:none;align-items:center;gap:0.35rem;",
      });

      const minus = el(
        "span",
        {
          class: "btn btn-outline",
          style:
            "padding:0.25rem 0.65rem;font-size:1rem;min-width:34px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:manipulation;",
        },
        "-",
      );

      const qtyVal = el(
        "span",
        {
          style:
            "font-family:var(--font-mono);min-width:1.4rem;text-align:center;font-weight:700;",
        },
        "1",
      );

      const plus = el(
        "span",
        {
          class: "btn btn-outline",
          style:
            "padding:0.25rem 0.65rem;font-size:1rem;min-width:34px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;touch-action:manipulation;",
        },
        "+",
      );

      qtyWrap.append(minus, qtyVal, plus);

      // hours slider (hidden until checked)

      const hrsWrap = el("span", {
        style:
          "display:none;align-items:center;gap:0.5rem;flex:1 1 170px;min-width:170px;",
      });

      const hrs = el("input", {
        type: "range",
        min: "0.25",
        max: String(maxH),
        step: "0.25",
        style: "flex:1;cursor:pointer;",
      });

      hrs.value = String(it.h);

      const hrsLabel = el(
        "span",
        {
          style:
            "font-size:0.8rem;color:var(--text-muted);font-family:var(--font-mono);min-width:6.5rem;text-align:right;",
        },
        (it.duty ? "runs " : "") + fmtH(it.h),
      );

      hrsWrap.append(hrs, hrsLabel);

      const sub = el(
        "span",
        {
          style:
            "font-size:0.8rem;font-family:var(--font-mono);color:var(--text-muted);min-width:7.8rem;text-align:right;",
        },
        "",
      );

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
          let txt = t("apKwhDay", { kwh: fmtKwh(kwh) });

          if (it.duty) txt += t("apAvgW", { w: Math.round((it.w * h) / 24) });

          sub.textContent = txt;

          sub.style.color = "var(--primary-accent)";
        } else {
          sub.textContent = "";

          sub.style.color = "var(--text-muted)";
        }

        updateLoadReadout();
        if (lastPayload) markPrecalcDirty();
      }

      cb.addEventListener("change", refresh);

      minus.addEventListener("click", () => {
        const q = Math.max(1, parseInt(row.dataset.qty, 10) - 1);

        row.dataset.qty = String(q);
        qtyVal.textContent = String(q);
        refresh();
      });

      plus.addEventListener("click", () => {
        const q = Math.min(30, parseInt(row.dataset.qty, 10) + 1);

        row.dataset.qty = String(q);
        qtyVal.textContent = String(q);
        refresh();
      });

      hrs.addEventListener("input", () => {
        row.dataset.h = hrs.value;

        hrsLabel.textContent =
          (it.duty ? "runs " : "") + fmtH(parseFloat(hrs.value));

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
      "Internet router (always on)": { qty: 1, h: 24 },
    },
    van: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 8 },
      "Ceiling or desk fan": { qty: 1, h: 8 },
      "LED light bulb": { qty: 4, h: 4 },
      "Phone charger": { qty: 2, h: 3 },
      "Laptop or desktop computer": { qty: 1, h: 4 },
      "Internet router (always on)": { qty: 1, h: 16 },
    },
    home: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "LED light bulb": { qty: 10, h: 5 },
      "LED TV": { qty: 1, h: 4 },
      Microwave: { qty: 1, h: 0.33 },
      "Electric kettle": { qty: 1, h: 0.25 },
      "Laptop or desktop computer": { qty: 2, h: 6 },
      "Phone charger": { qty: 4, h: 3 },
      "Internet router (always on)": { qty: 1, h: 24 },
      "Washing machine": { qty: 1, h: 0.5 },
    },
    homestead: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "Chest freezer": { qty: 1, h: 10 },
      "Deep well pump (submersible, 240V)": { qty: 1, h: 0.75 },
      "LED light bulb": { qty: 12, h: 5 },
      "LED TV": { qty: 1, h: 4 },
      Microwave: { qty: 1, h: 0.5 },
      "Laptop or desktop computer": { qty: 2, h: 8 },
      "Phone charger": { qty: 4, h: 4 },
      "Internet router (always on)": { qty: 1, h: 24 },
      "Washing machine": { qty: 1, h: 1 },
      "Space heater (small)": { qty: 1, h: 4 },
    },
    backup: {
      "Refrigerator (modern, mid-size)": { qty: 1, h: 10 },
      "Chest freezer": { qty: 1, h: 8 },
      "Water pump (shallow/pressure tank 120V)": { qty: 1, h: 0.5 },
      "LED light bulb": { qty: 6, h: 4 },
      "Phone charger": { qty: 4, h: 3 },
      "Internet router (always on)": { qty: 1, h: 24 },
      "Laptop or desktop computer": { qty: 1, h: 4 },
    },
    clear: {},
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
  if (
    loadModeEl &&
    loadModeEl.value !== "appliances" &&
    presetKey !== "clear"
  ) {
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

  const validLat = Number.isFinite(lat)
    ? Math.max(-90, Math.min(90, lat))
    : 21.31;

  const absLat = Math.abs(validLat);
  const isNorth = validLat >= 0;
  const isEquator = absLat < 5;

  const deltaSummer = isNorth ? 23.44 : -23.44;
  const deltaWinter = isNorth ? -23.44 : 23.44;

  const elevSummer = Math.max(
    0,
    Math.min(90, 90 - Math.abs(validLat - deltaSummer)),
  );
  const elevEquinox = Math.max(0, Math.min(90, 90 - absLat));
  const elevWinter = Math.max(
    0,
    Math.min(90, 90 - Math.abs(validLat - deltaWinter)),
  );

  function calcDayLength(latitude, declinationDeg) {
    const phi = latitude * (Math.PI / 180);
    const delta = declinationDeg * (Math.PI / 180);
    const cosH = -Math.tan(phi) * Math.tan(delta);
    if (cosH <= -1) return 24;
    if (cosH >= 1) return 0;
    return (2 * ((Math.acos(cosH) * 180) / Math.PI)) / 15;
  }

  const hoursSummer = Math.max(
    0,
    Math.min(24, calcDayLength(validLat, deltaSummer)),
  );
  const hoursWinter = Math.max(
    0,
    Math.min(24, calcDayLength(validLat, deltaWinter)),
  );

  const yrTilt = isEquator
    ? 10
    : Math.min(70, Math.max(10, Math.round(absLat * 0.9)));
  const wtrTilt = isEquator
    ? 10
    : Math.min(75, Math.max(15, Math.round(absLat + 15)));
  const smrTilt = isEquator ? 10 : Math.max(10, Math.round(absLat - 15));

  let compassHeading = "True South (180\u00B0)";
  let compassShort = "South";
  let headingDetail = "Face Due South (180\u00B0) toward the Equator";
  if (isEquator) {
    compassHeading = "South or North (~10\u00B0 self-cleaning tilt)";
    compassShort = "Flat / 10\u00B0";
    headingDetail =
      "Slight ~10\u00B0 tilt in either direction for rain self-cleaning";
  } else if (!isNorth) {
    compassHeading = "True North (0\u00B0)";
    compassShort = "North";
    headingDetail = "Face Due North (0\u00B0) toward the Equator";
  }

  const svgW = 460,
    svgH = 150;
  const groundY = 120;
  const x0 = 105,
    y0 = groundY;

  const tiltRad = (yrTilt * Math.PI) / 180;
  const L = 55;
  const x1 = x0 - L * Math.cos(tiltRad);
  const y1 = y0 - L * Math.sin(tiltRad);

  const R_s = 100;
  const radS = (elevSummer * Math.PI) / 180;
  const sx_s = x0 + R_s * Math.cos(radS);
  const sy_s = y0 - R_s * Math.sin(radS);

  const R_w = 88;
  const radW = (elevWinter * Math.PI) / 180;
  const sx_w = x0 + R_w * Math.cos(radW);
  const sy_w = y0 - R_w * Math.sin(radW);

  const rArc = 28;
  const arcX = x0 - rArc * Math.cos(tiltRad);
  const arcY = y0 - rArc * Math.sin(tiltRad);

  // Quantify WHY the tilt matters: what a flat mount forfeits here, and how
  // many extra panels a flat roof needs to match the tilted harvest.
  const tiltValue = tiltValueSummary(validLat, yrTilt);
  const extraPanels = tiltValue.panelsFlatPerTenTilted - 10;
  const tiltValueCard = `
      <div class="sun-path-metric">
        <div class="sun-path-metric-title">\uD83D\uDCB0 Value of the Right Angle</div>
        <div class="sun-path-metric-val" style="color:#f59e0b;">${tiltValue.flatLossPct > 0 ? "\u2212" + tiltValue.flatLossPct + "%" : "~0%"}</div>
        <div class="sun-path-metric-sub">${
          tiltValue.flatLossPct > 0
            ? `What a flat roof forfeits here — it takes ~${tiltValue.panelsFlatPerTenTilted} flat panels to match 10 at ~${yrTilt}°`
            : "Flat mounting captures essentially the full harvest at your latitude"
        }</div>
      </div>`;

  wrap.style.display = "block";

  wrap.innerHTML = `
    <div class="sun-path-header">
      <span>\uD83D\uDCD0 Solar Orientation &amp; Array Tilt Guide (${validLat >= 0 ? validLat.toFixed(1) + "\u00B0N" : Math.abs(validLat).toFixed(1) + "\u00B0S"})</span>
      <span style="font-size:0.75rem;font-weight:600;color:var(--primary-accent);background:rgba(0,230,153,0.1);padding:0.15rem 0.55rem;border-radius:4px;border:1px solid rgba(0,230,153,0.25);">Optimal Year-Round Tilt: ~${yrTilt}\u00B0</span>
    </div>

    <svg viewBox="0 0 ${svgW} ${svgH}" role="img" aria-label="Sun-path diagram: face ${compassShort} at about ${yrTilt} degrees tilt" style="width:100%;height:auto;display:block;overflow:visible;">
      <title>Sun path for ${compassShort}-facing panels at ${yrTilt}° tilt</title>
      <!-- Ground line -->
      <line x1="15" y1="${groundY}" x2="${svgW - 15}" y2="${groundY}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
      <text x="20" y="${groundY + 16}" fill="var(--text-muted)" font-size="10" font-family="sans-serif">Ground / Horizon</text>
      <text x="${svgW - 20}" y="${groundY + 16}" fill="var(--primary-accent)" font-size="10.5" font-weight="bold" font-family="sans-serif" text-anchor="end">\uD83E\uDDED Facing ${compassShort}</text>

      <!-- Mount bracket -->
      <path d="M 68 ${groundY} L ${(x1 + (x0 - x1) * 0.45).toFixed(1)} ${(y1 + (y0 - y1) * 0.45).toFixed(1)} L 95 ${groundY}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linejoin="round" />

      <!-- Solar panel array silhouette -->
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x0}" y2="${y0}" stroke="#00e699" stroke-width="5" stroke-linecap="round" />
      <circle cx="${x0}" cy="${y0}" r="3" fill="#04120c" stroke="#00e699" stroke-width="1.5" />

      <!-- Tilt angle arc & text -->
      <path d="M ${x0 - rArc} ${groundY} A ${rArc} ${rArc} 0 0 1 ${arcX.toFixed(1)} ${arcY.toFixed(1)}" fill="none" stroke="#34d399" stroke-width="1.5" stroke-dasharray="3 2" />
      <text x="${x0 - rArc - 4}" y="${groundY - 8}" fill="#34d399" font-size="10" font-weight="bold" font-family="monospace" text-anchor="end">~${yrTilt}\u00B0 Tilt</text>

      <!-- Seasonal sky swing arc -->
      <path d="M ${sx_s.toFixed(1)} ${sy_s.toFixed(1)} A ${R_s} ${R_s} 0 0 1 ${sx_w.toFixed(1)} ${sy_w.toFixed(1)}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-dasharray="3 3" />

      <!-- Winter normal ray directly into tilted array -->
      <line x1="${sx_w.toFixed(1)}" y1="${sy_w.toFixed(1)}" x2="${((x0 + x1) / 2).toFixed(1)}" y2="${((y0 + y1) / 2).toFixed(1)}" stroke="rgba(56,189,248,0.45)" stroke-width="1.5" stroke-dasharray="4 2" />

      <!-- Summer Midday Sun -->
      <circle cx="${sx_s.toFixed(1)}" cy="${sy_s.toFixed(1)}" r="7" fill="#f59e0b" stroke="#fbbf24" stroke-width="1.5" />
      <text x="${Math.min(svgW - 10, sx_s + 11).toFixed(1)}" y="${(sy_s + 4).toFixed(1)}" fill="#fbbf24" font-size="10.5" font-weight="bold" font-family="sans-serif">\u2600\uFE0F Summer Noon: ${Math.round(elevSummer)}\u00B0 (${hoursSummer.toFixed(1)}h)</text>

      <!-- Winter Midday Sun -->
      <circle cx="${sx_w.toFixed(1)}" cy="${sy_w.toFixed(1)}" r="6" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.5" />
      <text x="${Math.min(svgW - 10, sx_w + 11).toFixed(1)}" y="${(sy_w + 4).toFixed(1)}" fill="#7dd3fc" font-size="10.5" font-weight="bold" font-family="sans-serif">\u2744\uFE0F Winter Noon: ${Math.round(elevWinter)}\u00B0 (${hoursWinter.toFixed(1)}h)</text>
    </svg>

    <div class="sun-path-grid">
      <div class="sun-path-metric">
        <div class="sun-path-metric-title">\uD83E\uDDED Compass Heading</div>
        <div class="sun-path-metric-val" style="color:var(--primary-accent);">${compassShort}</div>
        <div class="sun-path-metric-sub">${headingDetail}</div>
      </div>
      <div class="sun-path-metric">
        <div class="sun-path-metric-title">\uD83D\uDCD0 Year-Round Fixed Tilt</div>
        <div class="sun-path-metric-val" style="color:#34d399;">~${yrTilt}\u00B0</div>
        <div class="sun-path-metric-sub">Optimal set-and-forget angle for fixed roofs</div>
      </div>
      <div class="sun-path-metric">
        <div class="sun-path-metric-title">\u2744\uFE0F Winter Boost Tilt</div>
        <div class="sun-path-metric-val" style="color:#7dd3fc;">~${wtrTilt}\u00B0</div>
        <div class="sun-path-metric-sub">Sheds snow &amp; captures low winter midday sun</div>
      </div>
      <div class="sun-path-metric">
        <div class="sun-path-metric-title">\u2600\uFE0F Daylight &amp; Seasonal Swing</div>
        <div class="sun-path-metric-val" style="color:#fbbf24;">${hoursSummer.toFixed(1)}h \u2794 ${hoursWinter.toFixed(1)}h</div>
        <div class="sun-path-metric-sub">Sun drops ${Math.round(elevSummer - elevWinter)}\u00B0 between summer and winter noon</div>
      </div>
      ${tiltValueCard}
    </div>

    <div class="sun-path-takeaway">
      <strong>\uD83D\uDCA1 How much does the angle really matter?</strong>
      ${
        isEquator
          ? `Near the equator the sun sits almost overhead year-round, so angle barely changes the harvest — a modest ~10\u00B0 tilt exists mainly so tropical rain washes off dust. Spend your effort on keeping panels clean, not on precision aiming. (Flat loses only ~${Math.max(0, tiltValue.flatLossPct)}% here.)`
          : absLat >= 66.5 && elevWinter <= 0
            ? `At high latitude (${absLat.toFixed(1)}\u00B0), winter brings polar night (0h direct sun). A steep array (~${wtrTilt}\u00B0) sheds snow and catches low shoulder rays — flat panels would forfeit ~${tiltValue.flatLossPct}% of the year's harvest, so precise mounting genuinely pays off here, backed by adequate battery reserve.`
            : `Here a flat roof forfeits about ${tiltValue.flatLossPct}% of the annual harvest versus the optimal ~${yrTilt}\u00B0 tilt — roughly ${extraPanels > 0 ? extraPanels + " extra panel" + (extraPanels > 1 ? "s" : "") + " per 10" : "the same panels tilted properly"} to make up the difference. Precision is forgiving, though: within \u00B110\u00B0 of optimal you keep nearly all of it, so "close" is genuinely good enough on most roofs. Our simulation already assumes the recommended tilt when sizing your array and battery.`
      }
    </div>
  `;
}

function renderChemTempVisualizer(lat) {
  const wrap = $("chemTempVisualizer");

  if (!wrap) return;

  const chemSelect = $("chemSelect");

  const chem = chemSelect ? chemSelect.value : "auto";

  const validLat = Number.isFinite(lat)
    ? lat
    : parseFloat($("latInput")?.value) || 21.31;

  const absLat = Math.abs(validLat);

  let estWinterLowC = 20;

  if (absLat >= 55) estWinterLowC = -22;
  else if (absLat >= 48) estWinterLowC = -15;
  else if (absLat >= 40) estWinterLowC = -8;
  else if (absLat >= 32) estWinterLowC = 1;
  else if (absLat >= 24) estWinterLowC = 10;
  else estWinterLowC = 19;

  const minT = -30,
    maxT = 45;

  const pinPct = Math.max(
    2,
    Math.min(98, ((estWinterLowC - minT) / (maxT - minT)) * 100),
  );

  let statusHtml = "";

  if (chem === "lfp") {
    const isFreezingRisk = estWinterLowC <= 0;
    statusHtml = `
      <div class="chem-temp-status-box" style="background:${isFreezingRisk ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.1)"};border:1px solid ${isFreezingRisk ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"};">
        <strong style="color:${isFreezingRisk ? "#fca5a5" : "var(--primary-accent)"};">${isFreezingRisk ? "Winter Freezing Notice:" : "Safe Operating Climate:"}</strong>
        ${
          isFreezingRisk
            ? `Local winter temps reach ~${estWinterLowC}\u00B0C (below 0\u00B0C / 32\u00B0F). LiFePO4 BMS cuts off charging below freezing to prevent permanent lithium plating. Install batteries indoors, in an insulated battery enclosure, or choose models with internal heating pads.`
            : `LiFePO4 charges safely above 0\u00B0C (32\u00B0F) and operates at 95%+ round-trip efficiency. Discharging is supported down to -20\u00B0C.`
        }
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
        ${
          isFreezing
            ? `<br>&bull; <span style="color:#7dd3fc;font-weight:700;">Sodium-Ion</span> charges directly in freezing weather down to -20\u00B0C.<br>&bull; <span style="color:#fbbf24;font-weight:700;">LiFePO4</span> needs indoor placement or heating pads below 0\u00B0C.<br>&bull; <span style="color:#f87171;font-weight:700;">Lead-Acid</span> suffers ~50% capacity loss in winter.`
            : `<br>&bull; <span style="color:var(--primary-accent);font-weight:700;">LiFePO4</span> provides the lowest 20-year lifetime cost in mild/warm climates.<br>&bull; <span style="color:#7dd3fc;font-weight:700;">Sodium-Ion</span> offers non-flammable chemistry and thermal headroom.<br>&bull; <span style="color:#f87171;font-weight:700;">Lead-Acid</span> has low upfront cost but shortest cycle life.`
        }
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

function cancelCoordinateResolution() {
  if (coordDebounceTimer !== null) {
    clearTimeout(coordDebounceTimer);
    coordDebounceTimer = null;
  }
  coordinatesPending = false;
}

let resetCitySearch = null;

function markPrecalcDirty() {
  precalcDirty = true;
  if (runTimer) {
    clearTimeout(runTimer);
    runTimer = null;
  }
  // Invalidate any in-flight calculation immediately; changing a pre-calc
  // input must never let the old response repaint the new form. invalidate()
  // retires the in-flight run WITHOUT queueing a replacement: the very
  // inputs it carries are now stale.
  runChannel.invalidate();
  payloadEpoch++;
  lastRunInput = null;
  lastOkKey = null;
  if (lastPayload) {
    lastPayload = null;
    adoptedEntry = null;
    pendingFocus = null;
    selectedKey = "best";
    setResultsHidden(true);
  }
  const btn = $("btnRunSizing");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span>${t("runBtn")}</span>`;
  }
  setStatus(t("inputsChanged"));
}

function setCoords(lat, lon, label, region, country, skipShareUpdate = false) {
  cancelCoordinateResolution();
  markPrecalcDirty();
  locationResolved = true;
  wizard.setValue("latitude", lat);
  wizard.setValue("longitude", lon);
  if (wizard.state.step === "location") wizard.next();
  persistWizard(wizard);
  updateGuidedProgress();

  const isOffgrid = $("systemGoal")
    ? $("systemGoal").value === "offgrid"
    : false;
  const billWrap = $("billSliderWrap");
  if (billWrap) billWrap.style.display = isOffgrid ? "none" : "block";
  const offgridWrap = $("offgridLoadWrap");
  if (offgridWrap) offgridWrap.style.display = isOffgrid ? "block" : "none";

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

  // Location selection only fills the pre-calc inputs. Weather is fetched
  // after the visitor explicitly clicks the sizing button.
  if (
    lastPayload &&
    lastPayload.input &&
    (Math.abs(lastPayload.input.latitude - lat) > 0.05 ||
      Math.abs(lastPayload.input.longitude - lon) > 0.05)
  ) {
    lastPayload = null;
  }

  applyEstimatedTariff(lat, lon, region, country);

  updateFuelUnits();

  renderSunPath(lat);

  renderChemTempVisualizer(lat);

  if (!skipShareUpdate) updateShareHash(lastPayload, readInputs());
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

  if ($("fxRate") && Number.isFinite(cur.perUSD))
    $("fxRate").value = cur.perUSD;

  const oldFx = prevFxSnapshot;
  prevFxSnapshot = fxActive();

  // If the user explicitly set their monthly bill and currency
  // auto-switched to a new currency (e.g. USD -> CAD), convert the nominal bill amount
  if (
    billTouched &&
    Number.isFinite(billUserNominal) &&
    oldFx &&
    prevFxSnapshot &&
    oldFx.code !== prevFxSnapshot.code &&
    oldFx.rate > 0
  ) {
    const usd = billUserNominal / oldFx.rate;
    billUserNominal = Math.round(usd * prevFxSnapshot.rate);
  }

  updateCurrencyUnitLabel();

  syncBillSlider();
}

function updateCurrencyUnitLabel() {
  const fx = fxActive();

  const label = document.querySelector('label[for="customRateVal"]');

  if (label)
    label.textContent = fx
      ? `Your price per kWh (${CURRENCIES[fx.code]?.symbol || fx.code}):`
      : "Your price per kWh ($):";

  // Feed-in credit is entered in the same display currency as the tariff.

  const expSpan = document.querySelector('label[for="exportRate"] span');

  if (expSpan)
    expSpan.textContent = `(${fx ? CURRENCIES[fx.code]?.symbol || fx.code : "$"}/kWh, optional \u2014 grid-tie only)`;

  // The fixed charge is entered in the same display currency.
  const fixedCur = document.querySelector('label[for="fixedChargeVal"] span');

  if (fixedCur)
    fixedCur.textContent = `(${fx ? CURRENCIES[fx.code]?.symbol || fx.code : "$"}/mo, optional)`;

  // The always-visible bill slider shows the resolved location's currency.

  const billCur = $("billSliderCur");

  if (billCur)
    billCur.textContent = fx ? CURRENCIES[fx.code]?.symbol || fx.code : "$";

  updateFuelUnits();
}

function applyEstimatedTariff(lat, lon, region, country) {
  if (tariffTouched) return;

  if (!region && !country && Number.isFinite(lat) && Number.isFinite(lon)) {
    const near = nearestCity(lat, lon, CITY_CATALOG, 80);
    if (near) {
      region = near.r;
      country = near.country;
    }
  }

  const est = estimateTariff(lat, lon, region, country);

  // Auto-select the country's currency first, then express the estimated
  // tariff in it - the two share one FX rate, so they round-trip exactly.
  if (est.currency && !currencyTouched && CURRENCIES[est.currency])
    setCurrency(est.currency);

  const fx = fxActive();
  // Four decimals: sub-cent tariffs (e.g. $0.0725/kWh) must survive the
  // display-input round-trip instead of collapsing to the cent.
  const shownRate = fx ? +(est.rate * fx.rate).toFixed(4) : est.rate;

  const input = $("customRateVal");
  if (input) input.value = String(shownRate);

  const note = el(
    "div",
    { style: "font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;" },
    `Electricity price estimated for ${est.label}${fx ? ` (~ ${est.rate.toFixed(2)} US$/kWh)` : ""} - change it above if you know your rate.`,
  );

  const existing = document.getElementById("tariffNote");
  if (existing) existing.remove();

  const host = input ? input.closest(".form-group") : null;
  if (host) host.appendChild(note);
  note.id = "tariffNote";

  syncBillSlider();

  // Location changes are pre-calculation inputs. They update the form and
  // pricing context now, but never start weather or sizing work by themselves.
}

// Quick vs. Manual: quick hides everything except the location controls and

// sizes with defaults; Manual reveals the full form.

function updateGuidedProgress(step = wizard.state.step) {
  const progress = $("guidedProgress");
  if (!progress) return;
  const labels = {
    location: "1. Location",
    load: "2. What you power",
    tariff: "3. Electricity price",
    result: "4. Your result",
  };
  progress.textContent = labels[step] || labels.location;
  progress.dataset.step = step;
}

// One owner for the results region: hidden until a successful render, so
// old numbers can never masquerade as fresh after a failed or invalid run.
// The infeasible banner explains why that region is empty, so it is retracted
// with it — otherwise a reason from an earlier run keeps explaining a result
// area that is no longer on screen.
function setResultsHidden(hidden) {
  const region = $("resultsRegion");
  if (region) region.hidden = hidden;
  if (hidden) renderInfeasibleBanner(null);
}

function setupRoofMap() {
  const open = $("btnOpenRoofMap");
  const close = $("btnCloseRoofMap");
  const panel = $("roofMapPanel");
  const mapElement = $("roofMap");
  const status = $("roofMapStatus");
  const areaInput = $("roofAreaM2");
  const areaHint = $("roofAreaHint");
  if (!open || !panel || !mapElement) return;

  const closeMap = () => {
    roofMapUnsubscribe?.();
    roofMapUnsubscribe = null;
    roofMapRegistry?.cleanup();
    roofMapRegistry = null;
    roofMapRectangle?.remove?.();
    roofMapRectangle = null;
    roofMapFirstCorner = null;
    panel.hidden = true;
    status.textContent = "";
  };
  close?.addEventListener("click", closeMap);
  open.addEventListener("click", async () => {
    const latitude = parseFloat($("latInput")?.value);
    const longitude = parseFloat($("lonInput")?.value);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      status.textContent = "Choose a city or use your location first.";
      return;
    }
    panel.hidden = false;
    status.textContent = "Loading the optional map…";
    if (!roofMapRegistry) {
      roofMapRegistry = createMapProviderRegistry([createLeafletProvider()]);
      try {
        const map = await roofMapRegistry.init({
          element: mapElement,
          latitude,
          longitude,
          zoom: 19,
        });
        if (!map) throw new Error("No optional map provider is available");
        status.textContent =
          "Tap one corner, then the opposite corner of your roof or yard.";
        roofMapUnsubscribe = roofMapRegistry.onClick((lat, lon) => {
          if (!roofMapFirstCorner) {
            roofMapFirstCorner = [lat, lon];
            status.textContent = "Now tap the opposite corner.";
            return;
          }
          const second = [lat, lon];
          const area = rectangleAreaM2(roofMapFirstCorner, second);
          roofMapRectangle?.remove?.();
          roofMapRectangle = roofMapRegistry.drawRectangle([
            [
              Math.min(roofMapFirstCorner[0], second[0]),
              Math.min(roofMapFirstCorner[1], second[1]),
            ],
            [
              Math.max(roofMapFirstCorner[0], second[0]),
              Math.max(roofMapFirstCorner[1], second[1]),
            ],
          ]);
          roofMapFirstCorner = null;
          if (areaInput) {
            areaInput.value = String(Math.round(area * 10) / 10);
            areaInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (areaHint)
            areaHint.textContent = `${manualRoofHint(area)} This caps the searched PV size; it does not certify structural or shading suitability.`;
          status.textContent = `${Math.round(area * 10) / 10} m² selected. You can close the map or tap two new corners.`;
        });
      } catch (error) {
        status.textContent = `${error?.message || "The optional map could not load."} Use the manual area box below instead.`;
        roofMapRegistry?.cleanup();
        roofMapRegistry = null;
      }
    }
  });
  window.addEventListener("beforeunload", closeMap, { once: true });
}

function setQuickMode(on) {
  quickMode = on;

  const extras = $("fullControls");

  if (extras) extras.style.display = on ? "none" : "block";

  const precise = $("coordDetails");

  if (precise) precise.style.display = on ? "none" : "block";

  const hint = $("locHint");

  if (hint) hint.style.display = on ? "none" : "block";

  const note = $("quickBillNote");

  if (note)
    note.style.display = on ? (locationResolved ? "block" : "none") : "none";

  const isOffgrid = $("systemGoal")
    ? $("systemGoal").value === "offgrid"
    : false;
  const billWrap = $("billSliderWrap");
  const offgridWrap = $("offgridLoadWrap");

  if (billWrap) billWrap.style.display = !isOffgrid ? "block" : "none";

  if (offgridWrap) offgridWrap.style.display = isOffgrid ? "block" : "none";

  const locBtn = $("btnGeoLocate");

  if (locBtn) {
    locBtn.classList.toggle("btn-geo-primary", on);

    locBtn.style.width = on ? "100%" : "auto";

    locBtn.style.justifyContent = "center";
  }

  const runBtn = $("btnRunSizing");

  if (runBtn) runBtn.style.display = "";
}

// -- Inputs ? engine ---------------------------------------------------------

function readInputs() {
  const lat = parseFloat($("latInput").value);

  const lon = parseFloat($("lonInput").value);

  let dailyKwh;
  let peakLoadW = null;
  let peakSurgeW = null;
  let requiresSplitPhase = false;

  const mode = $("loadMode").value;
  const isOffgrid = $("systemGoal")
    ? $("systemGoal").value === "offgrid"
    : false;

  if (mode === "appliances") {
    const ap = applianceState();
    dailyKwh = ap.kwh;
    // Real measured peak (running watts, incl. duty-cycle averages): the
    // engine sizes the inverter and its cost basis from this instead of the
    // daily average. Bill/kWh modes have no peak information (null = engine
    // falls back to the average and the BOM says so).
    peakLoadW = ap.peakW > 0 ? Math.round(ap.peakW) : null;
    peakSurgeW = ap.peakSurgeW > 0 ? Math.round(ap.peakSurgeW) : null;
    requiresSplitPhase = ap.requiresSplitPhase;
  } else if (isOffgrid) {
    // For off-grid, energy basis is always daily kWh (from off-grid slider or numeric dailyKwhInput)
    const offSliderVal = parseFloat($("offgridKwhSlider")?.value);
    const kwhInputVal = parseFloat($("dailyKwhInput")?.value);
    dailyKwh =
      Number.isFinite(offSliderVal) && offSliderVal > 0
        ? offSliderVal
        : Number.isFinite(kwhInputVal) && kwhInputVal > 0
          ? kwhInputVal
          : NaN;
  } else if (mode === "bill") {
    const bill = parseFloat($("billSlider")?.value ?? $("billAmount")?.value);

    const rate = getTariff();

    dailyKwh =
      Number.isFinite(bill) && Number.isFinite(rate) && rate > 0
        ? kwhFromBill(bill, rate)
        : billAnchorKwh;
  } else if (mode === "kwh") {
    const kwhInputVal = parseFloat($("dailyKwhInput")?.value);
    dailyKwh =
      Number.isFinite(kwhInputVal) && kwhInputVal > 0 ? kwhInputVal : NaN;
  }

  if (Number.isFinite(dailyKwh) && dailyKwh > 0) {
    billAnchorKwh = dailyKwh;
  }

  let basis = generatorBasis ? "generator fuel cost" : "direct kWh entry";

  if (mode === "appliances")
    basis = generatorBasis
      ? "appliance checklist + generator fuel"
      : "appliance checklist";
  else if (mode === "bill")
    basis = isOffgrid
      ? "daily off-grid load slider"
      : generatorBasis
        ? "monthly bill paid to a fuel station"
        : "monthly electric bill";

  const result = {
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

    fixedMonthlyUsd: (() => {
      const v = getFixedCharge();

      const fx = fxActive();

      // Same display-currency treatment as the tariff: local ÷ units per
      // US$1, always a number (0 = none) so option comparison never trips
      // on undefined.
      if (!Number.isFinite(v)) return 0;

      return fx ? v / fx.rate : v;
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
    peakSurgeW,
    requiresSplitPhase,
    climateAware: $("climateAwareToggle")?.checked === true,
    soilingOverride: null,
    wiringOverride: readPercentInput("wiringOverride"),
    mpptOverride: readPercentInput("mpptOverride"),
    pvMaxOverride: (() => {
      const area = parseFloat($("roofAreaM2")?.value);
      if (!Number.isFinite(area) || area <= 0) return null;
      return Math.floor(area / 6) * (PANEL_WATTS_DEFAULT / 1000);
    })(),
  };

  window.lastInputs = result;
  return result;
}

function readPercentInput(id) {
  const raw = parseFloat($(id)?.value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw / 100;
}

function run(quiet = false, explicit = false) {
  if (!runAuthorized && !explicit) return;
  if (precalcDirty && !explicit) return;
  if (runTimer) {
    clearTimeout(runTimer);
    runTimer = null;
  }

  const inp = readInputs();

  if (
    !locationResolved ||
    !Number.isFinite(inp.latitude) ||
    !Number.isFinite(inp.longitude) ||
    Math.abs(inp.latitude) > 90 ||
    Math.abs(inp.longitude) > 180
  ) {
    runChannel.dropPending();
    setResultsHidden(true);
    const invalidCoords =
      Number.isFinite(inp.latitude) &&
      Number.isFinite(inp.longitude) &&
      (Math.abs(inp.latitude) > 90 || Math.abs(inp.longitude) > 180);
    setStatus(
      coordinatesPending
        ? t("resolvingCoords")
        : invalidCoords
          ? t("invalidCoordinates")
          : $("citySearch")?.value.trim()
            ? t("chooseCityMatch")
            : t("pickCity"),
    );
    return;
  }

  const directKwh = $("loadMode")?.value === "kwh";
  if (
    !Number.isFinite(inp.dailyKwh) ||
    inp.dailyKwh <= 0 ||
    (directKwh && inp.dailyKwh < 0.5) ||
    inp.dailyKwh > 500
  ) {
    runChannel.dropPending();
    setResultsHidden(true);
    setStatus(
      directKwh || inp.dailyKwh > 500
        ? t("invalidDailyKwh")
        : t("tellPowerUse"),
    );
    return;
  }

  precalcDirty = false;

  // A site/option change invalidates an adopted curve point (its hardware was
  // simulated for the old site and load); a bill-only change keeps it — the
  // rescale path already re-based it and the quiet refine re-simulates it.
  if (lastRunInput && !sameSiteOptions(lastRunInput, inp)) {
    adoptedEntry = null;
    if (selectedKey === "adopted") selectedKey = "best";
    frontierSelected = null;
  }

  if (runChannel.isBusy) {
    // Collapse: only the latest inputs matter, re-read fresh when flushed.
    // A non-quiet request wins so an explicit run still scrolls + spins.
    // Retire the in-flight run FIRST (the sequence bump) — without this its
    // stale response would still pass the seq check on arrival and clobber
    // the screen — e.g. an off-grid response landing mid grid-tie run and
    // hiding the cut slider under it.
    runChannel.collapse(quiet);
    // The epoch bump retires any in-flight slice from the superseded
    // payload, exactly as the old collapse path did.
    payloadEpoch++;
    return;
  }

  // Weather warming begins only after explicit sizing consent.
  warmSiteWeather(inp.latitude, inp.longitude);

  // A repeat of the exact previous configuration is answered from the
  // engine's payload cache in milliseconds — skip the loading choreography
  // (status line, stepper, elapsed timer) so the refresh is genuinely
  // instant instead of flashing "Loading…" for 40 ms.
  const isInstantRepeat =
    !!lastPayload && lastOkKey !== null && JSON.stringify(inp) === lastOkKey;

  if (!quiet && !isInstantRepeat) {
    setStatus(inp.mode === "gridtie" ? t("statusGridtie") : t("statusOffgrid"));
    hideSpeedNote();
    pipelineStart("city");
    pipelineStage("Weather");
  }

  const btn = $("btnRunSizing");

  if (btn && !quiet) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">o</span> ${t("runningBtn")}`;
  }

  lastRunInput = inp;
  wizard.setValue("dailyKwh", inp.dailyKwh);
  wizard.setValue("tariff", inp.tariff);
  wizard.setValue("mode", inp.mode);
  while (wizard.state.step !== "result")
    wizard.next({ allowNoTariff: wizard.state.step === "tariff" });
  persistWizard(wizard);
  updateGuidedProgress("result");
  lastRunAdoptsFocus = pendingFocus !== null;
  lastRunQuiet = quiet;
  pendingFocus = null;
  // A new full run opens a new epoch: any in-flight slice from older inputs
  // is stale on arrival and will be dropped by the epoch check.
  const epoch = ++payloadEpoch;
  const seq = runChannel.begin();
  armRunDeadline(seq);
  ensureWorker().postMessage({ type: "run", seq, epoch, ...inp });
}

// A finished worker run hands back to the latest superseding request, if any.
// THE one release path for the run channel: every full-run reply funnels
// through here, so the channel can never leak behind a finished worker.
function flushPendingRun() {
  if (runDeadlineTimer !== null) {
    clearTimeout(runDeadlineTimer);
    runDeadlineTimer = null;
  }
  const next = runChannel.settle();
  restoreRunButton();
  if (next) run(next.quiet);
}

// Slider updates queue a debounced re-run so dragging never stacks runs.
function scheduleRun(quiet = false) {
  if (!runAuthorized || precalcDirty) return;
  if (runTimer) clearTimeout(runTimer);

  runTimer = setTimeout(() => {
    runTimer = null;
    run(quiet);
  }, 350);
}

// ── Bill-cut slider (1–150%) ────────────────────────────────────────────────

// The form's "Bill-cut target" select offers exactly the grid-tie columns the
// engine sizes, plus a disabled "custom" option that mirrors whatever
// arbitrary cut the results slider holds. One decision, two controls; the
// target policy itself is single-owner in shared/cut-targets.js.

function syncCutLabel() {
  const slider = $("cutSlider");
  const out = $("cutSliderVal");

  if (!slider) return;
  const v = parseInt(slider.value, 10) || 80;

  if (out)
    out.textContent =
      v > 100
        ? `Produce ~${v}% of your bill — bill gone, sellable surplus sizeable above`
        : `Cut ~${v}% of your bill`;
}

// ONE place that writes the bill-cut target, so the slider, the form's
// "Bill-cut target" select and the sizing input can never disagree. Picking a
// point on the budget curve IS choosing a cut %, so that path calls this too.
function syncCutControls(pct) {
  const v = Math.min(150, Math.max(1, Math.round(pct)));
  customCutFraction = v / 100;
  const slider = $("cutSlider");
  if (slider) slider.value = String(v);
  syncCutLabel();
  const agSelect = $("autoTarget");
  if (agSelect) {
    // The select mirrors the slider exactly — a real target when it is one,
    // the honest "custom" state otherwise. Never a stale preset.
    agSelect.value = targetForPct(v);
  }
}

function setupCutSlider() {
  const slider = $("cutSlider");
  if (!slider) return;
  slider.value = String(Math.round(customCutFraction * 100));
  // The select starts in sync too ("custom" until a preset is actually chosen,
  // since the restored fraction may be arbitrary).
  syncCutControls(Math.round(customCutFraction * 100));
  syncCutLabel();

  slider.addEventListener("input", () => {
    customCutFraction = (parseInt(slider.value, 10) || 1) / 100;
    syncCutLabel();
    if (lastPayload && lastPayload.mode === "gridtie") {
      frontierSelected = null;
      // Cached-only drag preview: the nearest curve system at this %.
      previewCurvePoint(
        nearestCurvePoint(parseInt(slider.value, 10) || 1, "y"),
      );
    }
  });

  slider.addEventListener("change", () => {
    // The slider, the form select and the sizing input are ONE control in
    // three places: syncCutControls writes all of them so a fresh run can't
    // disagree with what is on screen.
    syncCutControls(parseInt(slider.value, 10) || 1);
    // A cut edit is the visitor choosing the target, so the budget slider is
    // released from any pin and follows the resulting recommendation once.
    budgetPinnedUsd = null;
    followMarkerOnce = true;
    // No results yet: fall back to a full run so the cut is honored instead
    // of silently dropped.
    if (!lastPayload) {
      scheduleRun();
      return;
    }
    if (lastPayload.mode === "gridtie") {
      // Release sizes the slider's % precisely in the background; the drag
      // preview already showed the neighborhood from cache.
      curvePreview = null;
      clearPlayReadout();
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
function requestIncrementalCut(
  focusPvKw = null,
  focusBattKwh = null,
  focusChemistry = null,
) {
  const focus = { focusPvKw, focusBattKwh, focusChemistry };
  // Slices queue behind each other in the worker like full runs do: collapse
  // rapid slider edits into one trailing slice instead of burning seconds of
  // superseded engine work. The latest focus coordinates always win.
  if (sliceBusy) {
    pendingSlice = focus;
    return;
  }
  postSlice(focus);
}

function postSlice(focus) {
  const p = lastPayload;
  if (!p) {
    pendingSlice = null;
    return;
  }
  const inp = readInputs();
  const seq = ++sliceToken;
  ensureWorker().postMessage({
    type: "reSlice",
    seq,
    epoch: payloadEpoch,
    incrementalCut: true,
    ...inp,
    focusPvKw: focus.focusPvKw,
    focusBattKwh: focus.focusBattKwh,
    focusChemistry: focus.focusChemistry,
  });
  sliceBusy = true;
}

function flushPendingSlice() {
  if (!pendingSlice) return;
  const f = pendingSlice;
  pendingSlice = null;
  postSlice(f);
}

// Merge an incremental slice into the retained payload and refresh only what
// it touched: the matrix table, the custom column label, and — for an adopted
// curve point — its SOC chart once the capture bands arrive.
function mergeReSlice(result) {
  const p = lastPayload;
  if (!p || !result) return;
  if (result.customCut) p.customCut = result.customCut;
  if ("agmReference" in result) p.agmReference = result.agmReference;
  if (result.cells && p.matrix && p.matrix.cells)
    Object.assign(p.matrix.cells, result.cells);
  if (result.customTarget) {
    p.customTarget = result.customTarget;
    // Fixed-chemistry grid-tie session: the slider's target IS the selected
    // system, so the card, charts, BOM, export and share link all follow it.
    if (!p.auto && p.mode === "gridtie") {
      renderTargetCards(p, [p.customTarget]);
      if (selectedKey === "custom" || selectedKey === "best" || !selectedKey) {
        renderFrontierPanel(p);
        refreshSelectionOutputs(p);
      }
    }
  } else if (
    "customTarget" in result &&
    result.customTarget === null &&
    p.customTarget &&
    !p.auto &&
    p.mode === "gridtie"
  ) {
    // Fixed-chemistry: nothing solves at the new cut — retire the stale
    // custom card instead of leaving the previous target's system up.
    p.customTarget = null;
    if (selectedKey === "custom") {
      const fallback = (p.targets || []).find((t) => t && t.solvable) || null;
      selectedKey = fallback ? "target:" + fallback.id : "custom";
    }
    renderTargetCards(p, []);
    renderFrontierPanel(p);
    refreshSelectionOutputs(p);
  }
  // Auto grid-tie: the recommendation follows the bill-cut slider. The worker
  // re-derives the banner and focus from the custom target column, so the
  // headline savings and "recommended" system describe the visitor's CURRENT
  // cut — not the fixed 80% one — unless they've explicitly picked a system.
  // An explicitly null best means nothing solves at this cut: retire the stale
  // recommendation NOW ("best" key falls through to the honest empty state)
  // rather than leaving the previous target's system on screen.
  if (p.auto && p.mode === "gridtie" && "best" in result) {
    p.best = result.best || null;
    p.bestReason = result.bestReason || null;
    p.focus = result.focus || null;
    if (selectedKey === "best" || selectedKey === "focus") {
      selectedKey = p.best ? "best" : "custom";
    }
    // The blue dot must move with the recommendation BEFORE the chart
    // re-renders below — and vanish (marker cleared) when nothing solves.
    if (p.frontier) {
      if (result.best) {
        p.frontier.marker = {
          chemistry: result.best.chemistry,
          capexUsd: Number.isFinite(result.best.costMid)
            ? result.best.costMid
            : (Number(result.best.costLo) + Number(result.best.costHi)) / 2,
          outcomePct:
            result.customCut && result.customCut.fraction > 1
              ? Math.round(result.customCut.fraction * 100)
              : Number.isFinite(result.best.cutPct)
                ? result.best.cutPct
                : p.frontier.marker
                  ? p.frontier.marker.outcomePct
                  : 100,
          pvKw: result.best.pvKw,
          battKwh: result.best.battKwh,
          pointIndex: null,
        };
      } else {
        p.frontier.marker = null;
      }
      frontierSelected = null;
    }
    renderBestPick(p);
    renderMoneyBar(p);
    // "adopted" included: after a curve click the banner must keep showing
    // the adopted system (with a fresh "recommendation stays …" line), not
    // get stuck on the custom-best card while the charts show the adoption.
    if (
      !selectedKey ||
      selectedKey === "best" ||
      selectedKey === "focus" ||
      selectedKey === "adopted"
    ) {
      renderFrontierPanel(p);
      refreshSelectionOutputs(p);
    }
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
  if (
    result.focusSoc &&
    selectedKey === "adopted" &&
    adoptedEntry &&
    adoptedEntry.chemistry === result.focusSoc.chemistry &&
    Math.abs(adoptedEntry.pvKw - result.focusSoc.pvKw) < 0.06 &&
    Math.abs(adoptedEntry.battKwh - result.focusSoc.battKwh) < 0.6
  ) {
    adoptedEntry.socNameplatePct = result.focusSoc.socNameplatePct;
  }
  if (p.matrix && (p.mode === "gridtie" || resultLevel === "matrix"))
    renderMatrix(p);
  if (
    selectedKey === "adopted" &&
    adoptedEntry &&
    adoptedEntry.socNameplatePct &&
    adoptedEntry.socNameplatePct.min &&
    adoptedEntry.socNameplatePct.min.length
  ) {
    drawSocChartForEntry(p, adoptedEntry);
  }
  syncCutLabel();
  // The cut changed, so any link copied right now must carry it.
  updateShareHash(p, readInputs());
  // The merged column can shift the curve's span (a surplus target extends it
  // above the curve's 100% top): resync the budget range (visitor position
  // preserved).
  if (curveReady()) syncBudgetRange();
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
    if (Number.isFinite(bill) && rate > 0)
      billAnchorKwh = kwhFromBill(bill, rate);
    const out = $("billSliderVal");
    if (out) out.textContent = "~" + fmtBill(bill);

    // Keep offgridKwhSlider tied in parity with the bill's kWh anchor
    const offSlider = $("offgridKwhSlider");
    const offOut = $("offgridKwhVal");
    const kwhInput = $("dailyKwhInput");
    if (offSlider && Number.isFinite(billAnchorKwh) && billAnchorKwh > 0) {
      const roundedKwh = Math.round(billAnchorKwh * 10) / 10;
      const clampedKwh = Math.min(
        parseFloat(offSlider.max) || 60,
        Math.max(parseFloat(offSlider.min) || 1, roundedKwh),
      );
      offSlider.value = String(clampedKwh);
      if (offOut)
        offOut.textContent = t("offgridKwhReadout", { kwh: clampedKwh });
      if (kwhInput) kwhInput.value = String(clampedKwh);
    }
    updateLoadReadout();
  });

  slider.addEventListener("change", () => {
    // Monthly bill is an upfront load assumption. Show the changed input now,
    // but do not replace the result or fetch weather until the explicit size
    // button is clicked.
    markPrecalcDirty();
  });
}

// ── Clickable matrix cells (grid-tie) ───────────────────────────────────────

// Matrix-cell selection: everything downstream re-renders from the cached
// payload — no worker, no wait.
function selectMatrixCell(key) {
  const p = lastPayload;
  if (!p) return;
  frontierSelected = null;
  curvePreview = null;
  selectedKey = "matrix:" + key;
  renderResults(p);
  // Cells open the same full-analysis modal as curve points, with
  // "Use this system" to adopt the exact system into every chart, the BOM,
  // export data, share link, and print sheet.
  const cell = p.matrix && p.matrix.cells[key];
  if (cell && cell.solvable) {
    showSystemModal(
      p,
      {
        ...cell,
        chemistry:
          p.matrix.rows.find((r) => r.id === key.split(":")[0])?.id ||
          cell.chemistry,
      },
      true,
    );
  }
}

function setupGoalControls() {
  const btnGt = $("btnGoalGridtie");
  const btnOff = $("btnGoalOffgrid");
  const sysGoal = $("systemGoal");
  if (!btnGt || !btnOff) return;

  const setGoal = (goal) => {
    const isGt = goal === "gridtie";
    if (isGt) {
      btnGt.classList.add("active");
      btnOff.classList.remove("active");
      if (sysGoal) sysGoal.value = "gridtie";
      const title = document.querySelector(".section-title");
      if (title) title.textContent = "Find your cheapest path to lower bills";
      const desc = document.querySelector(".section-desc");
      if (desc)
        desc.textContent =
          "Set your monthly electric bill and location, then click Size My System to compare the optimal solar and battery paths. The results cover chemistries, 20-year true costs, and wholesale hardware savings.";
      const optBill = $("optLoadBill");
      if (optBill) optBill.textContent = "I know my monthly electric bill";
    } else {
      btnOff.classList.add("active");
      btnGt.classList.remove("active");
      if (sysGoal) sysGoal.value = "offgrid";
      const title = document.querySelector(".section-title");
      if (title) title.textContent = "Size your off-grid solar & battery bank";
      const desc = document.querySelector(".section-desc");
      if (desc)
        desc.textContent =
          "Size a self-reliant solar and battery storage system for your cabin, camper van, backup, or homestead. Enter your daily kWh or pick your appliances — hourly weather simulations ensure you never run out of power.";
      const optBill = $("optLoadBill");
      if (optBill) optBill.textContent = t("dailyEnergyNeed");
    }
    updateAutoRows();
    setQuickMode(quickMode);
    syncBillSlider();
    // A goal change is a pre-calc change only after a successful result; the
    // first calculation still belongs to the explicit sizing button.
    markPrecalcDirty();
  };

  btnGt.addEventListener("click", () => setGoal("gridtie"));
  btnOff.addEventListener("click", () => setGoal("offgrid"));

  if (sysGoal) {
    sysGoal.addEventListener("change", () => {
      setGoal(sysGoal.value);
    });
  }
}

function setupOffgridControls() {
  const slider = $("offgridKwhSlider");
  const out = $("offgridKwhVal");
  const kwhInput = $("dailyKwhInput");
  if (!slider) return;

  const syncToBill = (kwh) => {
    billAnchorKwh = kwh;
    const rate = displayRate();
    const minBill = parseFloat($("billSlider")?.min) || 1;
    const maxBill = parseFloat($("billSlider")?.max) || 2000;
    const bill = Math.min(
      maxBill,
      Math.max(minBill, Math.round(billForKwh(kwh, rate))),
    );
    billUserNominal = bill;
    billTouched = true;
    const billSlider = $("billSlider");
    if (billSlider) billSlider.value = String(bill);
    const billOut = $("billSliderVal");
    if (billOut) billOut.textContent = "~" + fmtBill(bill);
    updateLoadReadout();
  };

  const syncToVal = (val) => {
    slider.value = String(val);
    if (out) out.textContent = t("offgridKwhReadout", { kwh: val });
    if (kwhInput) kwhInput.value = String(val);
    syncToBill(val);
  };

  slider.addEventListener("input", () => {
    const val = parseFloat(slider.value);
    if (out) out.textContent = t("offgridKwhReadout", { kwh: val });
    if (kwhInput) kwhInput.value = String(val);
    syncToBill(val);
  });

  slider.addEventListener("change", () => {
    markPrecalcDirty();
  });

  if (kwhInput) {
    kwhInput.addEventListener("input", () => {
      const val = parseFloat(kwhInput.value);
      if (Number.isFinite(val) && val >= 1 && val <= 60) {
        slider.value = String(val);
        if (out) out.textContent = t("offgridKwhReadout", { kwh: val });
        syncToBill(val);
      }
    });
    kwhInput.addEventListener("change", () => {
      markPrecalcDirty();
    });
  }

  document.querySelectorAll(".offgrid-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kwh = parseFloat(btn.dataset.kwh);
      if (Number.isFinite(kwh) && kwh > 0) {
        syncToVal(kwh);
        markPrecalcDirty();
      }
    });
  });
}

function setupMatrixSelection() {
  const grid = $("tierResults");
  if (!grid) return;
  const pick = (key) => selectMatrixCell(key);
  grid.addEventListener("click", (e) => {
    const td =
      e.target && e.target.closest ? e.target.closest("td[data-sel]") : null;
    if (td) pick(td.getAttribute("data-sel"));
  });
  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const td =
      e.target && e.target.closest ? e.target.closest("td[data-sel]") : null;
    if (td) {
      e.preventDefault();
      pick(td.getAttribute("data-sel"));
    }
  });
}

// ── Unified selection hub ───────────────────────────────────────────────────
// One selection drives every chart: the curve's blue dot, the
// SOC + savings charts, the hardware list and the granular icon panel. Slider
// drags only move a highlight through CACHED points (preview); release
// commits the nearest cached system instantly. The single on-demand worker
// lookup (SOC capture bands after a curve adoption, exact column after a cut
// edit) reconciles in the background.

// ── Unified curve walk (budget + cut sliders) ─────────────────────────────
// One curve, no second chart: both sliders walk the frontier's own cached
// points (plus the recommendation marker). Drag previews — amber ring,
// readout, focus chips, worker untouched; release commits instantly.
function curvePool() {
  const p = lastPayload;
  if (!p || !p.frontier || !Array.isArray(p.frontier.points)) return [];
  const pool = p.frontier.points.map((pt, i) => ({
    kind: "point",
    index: i,
    x: pt.capexUsd,
    y: pt.outcomePct,
    pvKw: pt.pvKw,
    battKwh: pt.battKwh,
    chem: (pt.detail && pt.detail.chemistry) || p.frontier.chemistry,
    chemLabel: (pt.detail && pt.detail.chemLabel) || p.frontier.chemLabel,
    entry: pt.detail || null,
  }));
  const m = p.frontier.marker;
  if (
    p.best &&
    m &&
    Number.isFinite(m.capexUsd) &&
    Number.isFinite(m.outcomePct)
  ) {
    pool.push({
      kind: "best",
      index: -1,
      x: m.capexUsd,
      y: m.outcomePct,
      pvKw: p.best.pvKw,
      battKwh: p.best.battKwh,
      chem: p.best.chemistry,
      chemLabel: p.best.chemLabel,
      entry: p.best,
    });
  }
  // The surplus system (>100% cut) is walkable even though it is not a curve
  // point: dragging the budget slider past the 100% system lands on it.
  const anchor = surplusAnchor(p);
  if (anchor && Number.isFinite(anchor.capexUsd)) {
    pool.push({
      kind: "custom",
      index: -1,
      x: anchor.capexUsd,
      y: anchor.outcomePct,
      pvKw: anchor.pvKw,
      battKwh: anchor.battKwh,
      chem: anchor.chemistry,
      chemLabel: anchor.chemLabel,
      entry:
        resolveSelected(p) &&
        resolveSelected(p).pvKw === anchor.pvKw &&
        resolveSelected(p).battKwh === anchor.battKwh
          ? resolveSelected(p)
          : p.customCut && p.customCut.best
            ? p.customCut.best
            : p.customTarget,
    });
  }
  return pool;
}

function nearestCurvePoint(value, axis) {
  const pool = curvePool();
  if (!pool.length || !Number.isFinite(value)) return null;
  let best = pool[0],
    gap = Infinity;
  for (const q of pool) {
    const g = Math.abs(((axis === "y" ? q.y : q.x) || 0) - value);
    if (g < gap) {
      gap = g;
      best = q;
    }
  }
  return best;
}

function previewCurvePoint(q) {
  curvePreview = q ? { capexUsd: q.x, outcomePct: q.y } : null;
  renderPlayReadout(q);
  if (
    lastPayload &&
    q &&
    (q.entry || (q.kind === "best" && lastPayload.best))
  ) {
    renderSelectedBanner(lastPayload, q.entry || lastPayload.best);
  }
  if (lastPayload && focusFirst && q && q.entry)
    renderFocusPanel(lastPayload, q.entry, true);
  if (lastPayload) renderFrontierPanel(lastPayload);
}

function commitCurvePreview(q, opts = {}) {
  if (!q) return;
  curvePreview = null;
  clearPlayReadout();
  // The visitor just chose by budget: that choice now owns the position.
  if (Number.isFinite(q.x)) budgetPinnedUsd = q.x;
  if (!opts.keepSlider) {
    const slider = $("budgetSlider");
    if (slider && Number.isFinite(q.x)) {
      slider.value = String(Math.round(q.x));
      syncBudgetLabel();
    }
  }
  if (q.kind === "best") {
    const p = lastPayload;
    if (!p) return;
    adoptedEntry = null;
    frontierSelected = null;
    selectedKey = "best";
    renderFrontierPanel(p);
    refreshSelectionOutputs(p);
  } else if (q.kind === "custom") {
    // The >100% surplus system: not a curve point (index −1), so selection
    // goes through the payload's own custom-target state, which renderers
    // already resolve (resolveSelected's "custom" branch).
    adoptedEntry = null;
    frontierSelected = null;
    selectedKey = "custom";
    const p = lastPayload;
    if (p) {
      renderFrontierPanel(p);
      refreshSelectionOutputs(p);
    }
  } else {
    adoptFrontierPoint(q.index, { showModal: false, keepSlider: true });
  }
}

function chemShort(entry) {
  if (!entry) return "";
  const label = entry.chemLabel || entry.chemistry || "";
  return label.replace(/ \(.*\)/, "");
}

function renderPlayReadout(q) {
  const out = $("playReadout");
  if (!out) return;
  if (!q) {
    out.textContent = "";
    return;
  }
  out.textContent =
    `🔎 ☀️ ${q.pvKw} kW + 🔋 ${fmt(q.battKwh)} kWh ${chemShort(q)} ≈ ${money(Math.round(q.x))} → ` +
    (lastPayload && lastPayload.mode === "gridtie"
      ? `⚡ −${Math.round(q.y)}% bill`
      : `☁️ ${Math.round(q.y)}% covered`);
}

function clearPlayReadout() {
  const out = $("playReadout");
  if (out) out.textContent = "";
}

// Granular icon panel: the selected system as icons + big numbers. Renders
// purely from the entry's cached analysis — the "singular granular record"
// for the point, with no lookup.
// Net-metered monthly residual, one definition for every view: a negative
// residual means the utility pays the household, framed as the credit it
// is — never "~-$X/mo". Null-safe (missing tariff stays missing).
function fmtBillAfter(usd) {
  if (usd === null || usd === undefined) return null;
  return usd < 0 ? `−${money(-usd)}/mo credit` : `~${money(usd)}/mo`;
}

function renderFocusPanel(p, entry, isPreview) {
  const wrap = $("focusPanel");
  if (!wrap) return;
  if (!entry) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  const isGT = p.mode === "gridtie";
  const sel = resolveSelected(p);
  const isRec = !isPreview && (!sel || !p.best || sameSystem(sel, p.best));
  $("focusTitle").textContent = isPreview
    ? "🔎 Preview — release to select"
    : isRec
      ? "★ Recommended"
      : "👆 Selected system";
  const chips = $("focusChips");
  chips.innerHTML = "";
  const chip = (icon, big, small) => {
    const s = el("span", {
      style:
        "display:inline-flex;align-items:baseline;gap:0.3rem;white-space:nowrap;",
    });
    s.appendChild(el("span", { style: "font-size:1.15rem;" }, icon));
    s.appendChild(
      el("strong", { style: "font-size:1.05rem;color:var(--text-main);" }, big),
    );
    if (small)
      s.appendChild(
        el(
          "span",
          { style: "font-size:0.75rem;color:var(--text-muted);" },
          small,
        ),
      );
    chips.appendChild(s);
  };
  if (entry.pvKw > 0) chip("☀️", `${entry.pvKw} kW`, "solar");
  if (entry.battKwh > 0)
    chip("🔋", `${fmt(entry.battKwh)} kWh`, chemShort(entry) || "battery");
  if (Number.isFinite(entry.costLo) && Number.isFinite(entry.costHi))
    chip("💵", `~${moneyRange(entry.costLo, entry.costHi)}`, "up-front");
  if (isGT && Number.isFinite(entry.cutPct))
    chip("⚡", `−${entry.cutPct}%`, "bill cut");
  if (
    entry.billAfterMonthlyUsd !== null &&
    entry.billAfterMonthlyUsd !== undefined
  ) {
    const baText = fmtBillAfter(entry.billAfterMonthlyUsd);
    chip("🧾", baText, entry.billAfterMonthlyUsd < 0 ? "" : "bill after");
  }
  if (!isGT && Number.isFinite(entry.unmetHoursPerYear))
    chip("🔌", `${fmt(entry.unmetHoursPerYear)} h/yr`, "generator cover");
  if (entry.paybackYearsLo !== null && entry.paybackYearsHi !== null)
    chip(
      "⏳",
      fmtPaybackRange(entry.paybackYearsLo, entry.paybackYearsHi),
      "payback",
    );
  else if (typeof entry.trueBreakEvenYear === "number")
    chip("⏳", `yr ${entry.trueBreakEvenYear}`, "breaks even");
  if (entry.replacementsHorizon > 0)
    chip("🔁", `~${entry.replacementsHorizon}×`, "bank swaps");
  else if (entry.replacementsHorizon === 0) chip("🔁", "no swaps", "20 yrs");
  if (Number.isFinite(entry.lifetimeCostMid))
    chip("🏁", `~${money(entry.lifetimeCostMid)}`, "20-yr true cost");
  // Lead-acid savings indicator (reference only — never recommended).
  // leadAcidComparison owns WHEN this is a real comparison (both designs need
  // a battery, and the selection must not itself be lead-acid) and what the
  // copy may claim, so the chip can never contradict the footnote or the
  // comparison tab.
  const leadAcid = leadAcidChipCopy(
    leadAcidComparison(entry, p.agmReference),
    money,
  );
  if (leadAcid) chip("🏚️", leadAcid.big, leadAcid.small);
  const note = $("focusNote");
  if (note) {
    if (!isPreview && !isRec && p.best)
      note.textContent =
        `Recommendation stays ${chemShort(p.best) || p.best.chemistry} ` +
        `${p.best.pvKw} kW + ${fmt(p.best.battKwh)} kWh ` +
        `(~${money(p.best.lifetimeCostMid)} over 20 years).`;
    else if (!isPreview && isRec && p.bestReason)
      note.textContent = p.bestReason;
    else note.textContent = "";
  }
}

// ── Budget slider (cached curve walk) ─────────────────────────────────────

function showBudgetRow() {
  const row = $("budgetSliderRow");
  if (row) row.style.display = "block";
}

function hideBudgetRow() {
  const row = $("budgetSliderRow");
  if (row) row.style.display = "none";
}

// Budget slider range = the curve's own capex span (plus the marker, which
// can sit off-lattice). Shown whenever the curve is drawable, any mode.
function curveReady() {
  const p = lastPayload;
  return !!(
    p &&
    p.frontier &&
    Array.isArray(p.frontier.points) &&
    p.frontier.points.length >= 2
  );
}

function syncBudgetRange(seat = false) {
  const slider = $("budgetSlider");
  const p = lastPayload;
  const pts = (p && p.frontier && p.frontier.points) || [];
  if (!slider || pts.length < 2) return;
  const m = p.frontier.marker;
  // A surplus target (>100% cut) sizes a system beyond the curve's 100% top;
  // budgetSpanMax extends the slider's ceiling with its cost so the budget
  // slider can actually reach what the cut slider just asked for. The floor
  // stays the curve's own cheapest system.
  const anchor = surplusAnchor(p);
  const xs = pts.map((q) => q.capexUsd).filter(Number.isFinite);
  if (m && Number.isFinite(m.capexUsd)) xs.push(m.capexUsd);
  if (!xs.length) return;
  const lo = Math.min(...xs),
    hi = budgetSpanMax(pts, m ? m.capexUsd : null, anchor);
  slider.min = String(Math.floor(lo));
  slider.max = String(Math.ceil(hi));
  slider.step = String(Math.max(1, Math.round((hi - lo) / 200)));
  // Who owns the truth right now?
  //   * a fresh scenario (seat) → the recommendation, and the pin is released;
  //   * the visitor's own budget choice → THEIR position, clamped into the new
  //     span if a cut edit moved it (never silently re-seated on the marker);
  //   * otherwise → keep the current value while it still fits.
  const pinned = budgetPinnedUsd;
  const cur = parseFloat(slider.value);
  let next = null;
  if (seat) {
    budgetPinnedUsd = null;
    next = m && Number.isFinite(m.capexUsd) ? m.capexUsd : (lo + hi) / 2;
  } else if (followMarkerOnce) {
    followMarkerOnce = false;
    next = m && Number.isFinite(m.capexUsd) ? m.capexUsd : (lo + hi) / 2;
  } else if (Number.isFinite(pinned)) {
    next = pinned;
  } else if (!Number.isFinite(cur) || cur < lo || cur > hi) {
    next = m && Number.isFinite(m.capexUsd) ? m.capexUsd : (lo + hi) / 2;
  }
  if (next !== null)
    slider.value = String(Math.min(hi, Math.max(lo, Math.round(next))));
  syncBudgetLabel();
}

function syncBudgetLabel() {
  const slider = $("budgetSlider");
  const out = $("budgetSliderVal");
  if (!slider || !out) return;
  const v = parseFloat(slider.value);
  out.textContent = Number.isFinite(v) ? `≈ ${money(Math.round(v))}` : "";
}

function setupBudgetSlider() {
  const slider = $("budgetSlider");
  if (!slider) return;
  slider.addEventListener("input", () => {
    if (!curveReady()) return;
    // Pinned even mid-drag: a background reconciliation must not yank the
    // thumb out from under the pointer.
    budgetPinnedUsd = parseFloat(slider.value);
    syncBudgetLabel();
    previewCurvePoint(nearestCurvePoint(parseFloat(slider.value), "x"));
  });
  slider.addEventListener("change", () => {
    if (!curveReady()) return;
    budgetPinnedUsd = parseFloat(slider.value);
    commitCurvePreview(nearestCurvePoint(parseFloat(slider.value), "x"));
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
    const runWorker = new Worker(
      "./assets/js/sizing/sizing-worker.js?v=20260921f",
      {
        type: "module",
      },
    );
    worker = runWorker;

    runWorker.onmessage = (ev) => {
      // A timed-out/failed worker may have a message already queued while a
      // replacement worker is starting. Old instances no longer own UI state.
      if (worker !== runWorker) return;
      // Prefetch completion is informational only: it must NEVER fall
      // through to the run-completion bookkeeping below (that would free the
      // run channel while a real run is still computing).
      if (ev.data?.type === "prefetchDone") return;
      // Weather progress from the worker: chunk-level counts drive the
      // determinate bar; the resolved signal moves the stepper onto the
      // simulation stage. Gated on the same seq/epoch staleness checks as
      // payloads, so superseded runs can never paint the current pipeline.
      // Progress never holds or frees the worker.
      if (ev.data?.type === "progress") {
        if (
          ev.data.seq === runChannel.latestSeq &&
          ev.data.epoch === payloadEpoch
        ) {
          if (ev.data.stage === "weatherChunk")
            pipelineStage("Weather", ev.data.done, ev.data.total);
          else if (ev.data.stage === "weather") pipelineStage("Sim");
        }
        return;
      }
      if (ev.data?.type === "ok") {
        const staleAction = staleRunAction(
          ev.data.seq,
          runChannel.latestSeq,
          runChannel.pending,
        );
        if (staleAction !== "current") {
          // The inputs or request were superseded, so never paint this payload.
          // The worker has replied; settle through the shared funnel so the
          // channel cannot remain busy behind completed stale work.
          flushPendingRun();
          return;
        }

        if (lastRunAdoptsFocus) {
          selectedKey = "focus";
          lastRunAdoptsFocus = false;
        }

        // Done loading: fold the stepper away and explain the speed honestly
        // (repeat configuration → payload replay; cached weather → instant
        // site; fresh fetch → no badge, the run simply took its time).
        pipelineStop(true);
        if (ev.data.payload?.repeat) showSpeedNote("repeat");
        else if (
          ev.data.payload?.meta?.fromCache ||
          ev.data.payload?.meta?.offline
        )
          showSpeedNote("cache", ev.data.payload.meta);
        else hideSpeedNote();
        // Remember this run's input fingerprint so an identical next run
        // (there-and-back slider moves, re-clicks) skips the loading UI.
        lastOkKey = lastRunInput ? JSON.stringify(lastRunInput) : null;

        renderResults(ev.data.payload);

        // bring the results into view - the run button can be far above them
        // (instant scroll for reduced-motion users)

        const res = $("tierResults");

        if (res && !lastRunQuiet) {
          res.setAttribute("tabindex", "-1");

          res.scrollIntoView({
            behavior: scrollBehavior(),
            block: "start",
          });
        }
      } else if (ev.data?.type === "reSlice") {
        // Incremental cut patch: only the slider's "your target" column (and
        // SOC bands for an adopted curve point) — no full re-render, no scroll,
        // no status churn. A patch is only merged when it belongs to the
        // CURRENT payload epoch: a slice computed from pre-edit inputs that
        // lands after a full run for newer inputs is dropped, never merged.
        // A superseded patch (a newer slider edit already collapsed behind
        // it) is likewise dropped in favor of the trailing slice.

        sliceBusy = false;
        if (pendingSlice) {
          flushPendingSlice();
          return;
        }

        if (ev.data.seq !== sliceToken) return;

        if (ev.data.epoch !== undefined && ev.data.epoch !== payloadEpoch)
          return;

        mergeReSlice(ev.data.result);
      } else if (ev.data?.type === "error") {
        // A failed slice frees the channel like a finished one; a trailing
        // collapsed edit still goes out (once — the retry consumes it).
        if (ev.data.stream === "slice") {
          sliceBusy = false;
          if (pendingSlice) {
            flushPendingSlice();
            return;
          }
        }
        // Only the latest run/slice error in each stream may report — a
        // stale one must not overwrite a newer reply's status.
        const s = ev.data.seq;
        const fresh =
          ev.data.stream === "slice"
            ? s === sliceToken
            : s === runChannel.latestSeq;
        if (!(s !== undefined && !fresh)) {
          setStatus("Warning: " + ev.data.message);
          // A failed run stops the stepper with a failure accent so the
          // visitor sees how far the pipeline got.
          if (ev.data.stream !== "slice") pipelineStop(false);
        }
        // Slice errors never release the full-run channel: the full run can
        // still be computing behind them. Every run error reaches the shared
        // release funnel, including stale replies, so a completed worker
        // cannot leave the next explicit click queued behind a ghost.
        if (!errorReleasesRunChannel(ev.data.stream)) return;
      }

      // ReSlice replies never hold the run channel; every other non-prefetch
      // reply (ok, error, unknown) releases it exactly once through the
      // single funnel.
      if (ev.data?.type === "reSlice") {
        restoreRunButton();
        return;
      }
      flushPendingRun();
    };

    runWorker.onerror = () => {
      if (worker !== runWorker) return;
      worker = null;
      runWorker.terminate();
      // The whole message (warning glyph, what failed, what to do next) is one
      // locale value: concatenating English onto a translated emoji prefix is
      // how an error ends up half-translated in five of six locales.
      setStatus(t("errorSim"));

      setResultsHidden(true);
      pipelineStop(false);
      sliceBusy = false;
      pendingSlice = null;
      sliceToken++;
      restoreRunButton();
      flushPendingRun();
    };
  }

  return worker;
}

function fmt(n) {
  // Any unsolved cell (undefined/null tariff, empty option) renders as an
  // em dash, never the literal strings "NaN"/"undefined" in the results.
  if (!Number.isFinite(Number(n))) return "–";
  return Number(n).toLocaleString();
}

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
  const a = fmtPaybackOne(lo),
    b = fmtPaybackOne(hi);

  if (!a || !b) return "-";

  if (a === b) return a;
  // One leading ~ and an en dash: "~3–11 yr", never "~3 yr-11 yr".
  return `~${a.replace("~", "")}–${b.replace("~", "")}`;
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
  if (!Number.isFinite(Number(usd))) return "–";
  const fx = fxActive();

  if (!fx) return "$" + Number(usd).toLocaleString();

  const local = usd * fx.rate;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: fx.code,
    }).format(local);
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
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
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

function moneyRange(lo, hi) {
  if (!Number.isFinite(Number(lo)) || !Number.isFinite(Number(hi))) return "–";
  return money(lo) + "–" + money(hi);
}

// Oversize notes are generated in USD by the engine; re-render the savings
// figure through money() so non-USD readers see their own currency. USD
// readers (or no-FX) get the original prose byte-identical.
function bestPriceNote(text) {
  const fx = fxActive();
  if (!fx || fx.code === "USD") return text;
  return relocalizeOversizeCallout(text, money);
}

function fxNote() {
  const fx = fxActive();

  if (!fx) return null;

  const asOf = fxMeta.asOf
    ? ` Live rates as of ${fxMeta.asOf}.`
    : " Indicative built-in rates (live fetch unavailable).";

  return `Amounts shown in ${fx.code} at ${fx.rate} per US$1. Energy cost rates and recommendations are converted to ${fx.code}; source price scopes remain USD-denominated.`;
}

function renderAutoCards(p) {
  const grid = $("tierResults");

  grid.innerHTML = "";

  const isGT = p.mode === "gridtie";

  // Highlight the recommended bank (sodium-first on safety; LFP only when
  // genuinely cheaper — see pickBest), falling back to cheapest when the
  // payload carries no recommendation.
  let bestId = (p.best && p.best.chemistry) || null;
  if (!bestId) {
    let bestLife = Infinity;
    for (const a of p.auto) {
      if (a.solvable && a.lifetimeCostMid < bestLife) {
        bestLife = a.lifetimeCostMid;
        bestId = a.chemistry;
      }
    }
  }

  for (const a of p.auto) {
    const isSelected = selectedKey === "auto:" + a.chemistry;

    const card = el("div", {
      class:
        "bom-card" +
        (a.solvable ? " card-selectable" : "") +
        (isSelected ? " bom-card-selected" : ""),
    });

    if (a.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = "auto:" + a.chemistry;
        renderFrontierPanel(p);
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
      : a.chemistry === bestId
        ? "var(--border-glow)"
        : "var(--border-card)";

    card.appendChild(
      el(
        "div",
        { class: "bom-badge" },
        isGT && a.cutPct ? `Bill -${a.cutPct}%` : "Same job done",
      ),
    );

    card.appendChild(el("h3", {}, a.chemLabel));

    if (!a.solvable) {
      card.appendChild(
        el("p", {}, "Not practical at this site/load within search limits."),
      );

      grid.appendChild(card);

      continue;
    }

    const rows = [
      ["Solar", `${a.pvKw} kW`],
      ["Battery", `${fmt(a.battKwh)} kWh usable`],
      ["Cost to buy", `~${moneyRange(a.costLo, a.costHi)}`],
      [
        "Battery swaps",
        a.replacementsHorizon > 0
          ? a.batteryLifeYears
            ? `~${a.replacementsHorizon}x (about every ${fmtLife(a.batteryLifeYears)})`
            : `~${a.replacementsHorizon}x`
          : "None in 20 years",
      ],
    ];

    const footAuto = footprintText(a.pvKw);

    if (footAuto) rows.splice(2, 0, ["Footprint", footAuto]);

    if (a.swapsAndLaborUsd > 0) {
      rows.push(["Swaps + labor add", `~${money(a.swapsAndLaborUsd)}`]);
    }

    rows.push([
      "Total 20-year cost",
      `~${money(a.lifetimeCostMid)}` +
        (a.chemistry === bestId && p.auto.filter((x) => x.solvable).length >= 2
          ? " — recommended"
          : ""),
    ]);

    pushSeriesBreakdown(rows, a);

    if (isGT) {
      rows.push([
        "Bill after solar",
        fmtBillAfter(a.billAfterMonthlyUsd) ?? "needs your tariff",
      ]);

      rows.push([
        "Sun clipped (no export)",
        `${fmt(a.clippedKwhPerYear)} kWh/yr`,
      ]);

      if (a.exportValueAnnualUsd > 0) {
        rows.push([
          "Feed-in credit on clipped sun",
          `+${money(a.exportValueAnnualUsd)}/yr`,
        ]);
      }
    }

    // Headline economics: TRUE break-even counts every swap. When a bank

    // wears out fast enough that it never catches up, say so outright.

    // undefined = stale payload (contract warning already shown) ? omit row.

    if (p.tariff && a.trueBreakEvenYear !== undefined) {
      if (typeof a.trueBreakEvenYear === "number") {
        rows.push(["Pays for itself", `Year ${a.trueBreakEvenYear}`]);

        if (a.replacementsHorizon > 0 && a.paybackYearsLo !== null) {
          rows.push([
            "  - first cost alone pays back in",
            fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi),
          ]);
        }
      } else {
        rows.push([
          "True 20-yr break-even",
          "never - replacements outpace savings",
        ]);
      }
    } else if (!p.tariff && a.paybackYearsLo !== null) {
      rows.push([
        "Pays for itself in",
        fmtPaybackRange(a.paybackYearsLo, a.paybackYearsHi),
      ]);
    }

    if (Number.isFinite(a.lcoeUsdPerKwh)) {
      rows.push([
        "Your power cost",
        energyRate(a.lcoeUsdPerKwh) + gridRate(p.tariff),
      ]);
    }

    appendRows(card, rows);

    if (a.bestPriceCallout) {
      card.appendChild(
        el(
          "div",
          { class: "best-price-callout" },
          `💡 ${bestPriceNote(a.bestPriceCallout)}`,
        ),
      );
    }

    if (a.cardNote) {
      card.appendChild(
        el(
          "p",
          {
            style:
              "font-size:0.8rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.5;",
          },
          a.cardNote,
        ),
      );
    }

    card.appendChild(
      el(
        "p",
        {
          style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;",
        },

        `${p.autoNote}. Lifetime cost includes install labor on the first bank and every swap.`,
      ),
    );

    grid.appendChild(card);
  }

  // Lead-acid savings indicator (reference only — never recommended).
  // Skipped when it is literally the same system (bank-free designs share one
  // PV-only system, so there is no comparison to draw) and whenever the shared
  // helper says no honest comparison exists.
  const agm = p.agmReference;
  const agmIdentical =
    agm &&
    agm.battKwh > 0 &&
    agm.solvable &&
    agm.replacementsHorizon === 0 &&
    (p.auto || []).some(
      (a) => a.solvable && a.lifetimeCostMid === agm.lifetimeCostMid,
    );
  const agmRef = agmIdentical ? null : leadAcidReferenceCopy(agm);
  if (agmRef) {
    const ref = el("p", {
      style:
        "font-size:0.8rem;color:var(--text-muted);margin-top:0.9rem;line-height:1.55;grid-column:1/-1;",
    });
    ref.textContent =
      `🏚️ Lead-acid reference (not recommended): ~${money(agmRef.lifetimeCostUsd)} over 20 years` +
      (agmRef.swaps > 0
        ? ` with ~${agmRef.swaps} bank swaps`
        : ` with a ${fmt(agmRef.battKwh)} kWh bank oversized to avoid swaps`) +
      ` — shown only so you can see what the recommended chemistries save you.`;
    grid.appendChild(ref);
  }
}

// ── Battery Chemistry Comparison (Compare Batteries tab) ────────────────────
// Uses the selected system as baseline, comparing LFP, Sodium-ion, and AGM
// across required nameplate sizes (DoD + cold derate), cold weather limits,
// 20-year battery swap counts vs oversizing trade-off, and total 20-year cost.
// The most cost-effective chemistry is badged.
function renderBatteryComparison(p, selectedSystem) {
  const grid = $("tierResults");
  if (!grid) return;
  grid.style.display = "grid";
  grid.innerHTML = "";

  const sel =
    selectedSystem || resolveSelected(p) || p.best || (p.auto && p.auto[0]);
  const targetBattKwh =
    sel && sel.battKwh > 0
      ? sel.battKwh
      : p.dailyKwh
        ? Math.round(p.dailyKwh * 1.5 * 10) / 10
        : 10;
  const pvKw = sel && Number.isFinite(sel.pvKw) ? sel.pvKw : 5;
  const meanTempC = Number.isFinite(p.meanTempC)
    ? p.meanTempC
    : p.assumptions && Number.isFinite(p.assumptions.meanTempC)
      ? p.assumptions.meanTempC
      : 15;
  const isCold = meanTempC < 10;
  const landedF = (p.assumptions && p.assumptions.landedF) || 1;

  // Overview banner
  const header = el("div", {
    style:
      "grid-column: 1 / -1; margin-bottom: 0.75rem; padding: 0.9rem 1.1rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.35); border-radius: 10px;",
  });
  header.innerHTML = `
    <div style="font-weight: 700; color: #fff; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
      <span>🔋 Battery Chemistry Comparison</span>
      <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted); background: rgba(255,255,255,0.08); padding: 0.15rem 0.5rem; border-radius: 6px;">
        Sized for ~${fmt(targetBattKwh)} kWh Usable Storage
      </span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem; line-height: 1.55;">
      Comparing chemistries to deliver the same <strong>${fmt(targetBattKwh)} kWh usable power</strong> at your site's climate
      (<strong>${Math.round(meanTempC)}°C / ${Math.round(meanTempC * 1.8 + 32)}°F</strong> average).
      Examines required bank sizes, cold weather limits, 20-year battery swaps vs. oversizing, and true lifetime costs.
    </div>
    <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.4rem; line-height: 1.55;">
      These figures are a same-usable-kWh <strong>nameplate model</strong> (minimum
      bank for the DoD ceiling, swapped on cycle life). A live run's lead-acid
      reference is sized by the site simulation instead and can differ, usually
      in your favour because it may oversize the bank to skip swaps.
    </div>
  `;
  grid.appendChild(header);

  const agmColdScale = coldCapacityScale("agm", meanTempC);
  const chemConfigs = [
    {
      id: "lfp",
      label: "LFP / LiFePO₄",
      tagline: "Standard lithium (6,000 cycles at 80% DoD)",
      dod: 0.8,
      cyclesTo80: 6000,
      coldScale: 1.0,
      coldNotes: isCold
        ? "⚠️ Charge blocked <0°C (32°F). In freezing weather, requires a heated enclosure or internal heating pads to charge without lithium plating."
        : "✅ Excellent in moderate/warm climates. Normal operation 0°C to 45°C.",
      safety: "Very safe, stable lithium iron phosphate chemistry.",
      dodNote:
        "80% DoD preserves the full 6,000+ cycle rating (cycling daily to 90%+ accelerates degradation to ~3,500–4,500 cycles).",
    },
    {
      id: "naion",
      label: "Sodium-ion (Na-ion)",
      tagline:
        "Extreme cold & ultra-safe (95% cell window, ~85% inverter utilized)",
      dod: 0.85,
      cyclesTo80: 5500,
      coldScale: 1.0,
      coldNotes:
        "🛡️ Cold Champion: Zero capacity loss down to −20°C (−4°F). Safely charges below freezing without heating pads or battery warmers.",
      safety:
        "Non-flammable electrolyte, zero thermal runaway risk, can safely discharge to 0V for transport.",
      dodNote:
        "Inherent 95%+ cell window (safely discharges to 0V). Standard 48V inverters cut off at ~40–42V, using ~85% in practice; this shallow cycling protects the cells and delivers 5,500+ cycles.",
    },
    {
      id: "agm",
      label: "Lead-Acid (AGM)",
      tagline: "Low upfront sticker / Short life (50% DoD limit)",
      dod: 0.5,
      cyclesTo80: 500,
      coldScale: agmColdScale,
      coldNotes: isCold
        ? `❄️ Severe cold drop: loses ~${Math.round((1 - agmColdScale) * 100)}% capacity in winter. Freezes if discharged in sub-zero temps.`
        : "Loses 20% to 35% capacity in cold snaps; requires ventilation for hydrogen.",
      safety:
        "Acid spill risk, sulfation degradation, explosive hydrogen off-gassing.",
      dodNote:
        "Strict 50% DoD ceiling; discharging deeper causes rapid, irreversible plate sulfation.",
    },
  ];

  // Compute costs and swaps for each chemistry
  const estCyclesPerYr = Math.max(
    150,
    Math.min(450, Math.round(((p.dailyKwh || 10) * 365) / targetBattKwh)),
  );
  const results = chemConfigs.map((c) => {
    const effectiveDod = c.dod * c.coldScale;
    const nameplateKwh = +(targetBattKwh / effectiveDod).toFixed(1);
    const cost = fullRange(pvKw, nameplateKwh, c.id, landedF);
    const battMid = landedMidBattKwhFor(c.id, landedF);
    const swaps = batteryReplacements(estCyclesPerYr, c.cyclesTo80, 20);
    const life = lifetimeCostUsd({
      capexMidUsd: cost.objectiveMid,
      battKwhUsable: targetBattKwh,
      battPriceMidPerKwh: battMid,
      replacements: swaps,
      laborPerKwh: [12, 30],
    });
    return { ...c, nameplateKwh, cost, swaps, life };
  });

  // Badge winner: sodium in cold sites, LFP otherwise (AGM never recommended)
  const recommended = isCold ? "naion" : "lfp";

  for (const r of results) {
    const isWinner = r.id === recommended;
    const isAGM = r.id === "agm";
    const card = el("div", {
      class: "bom-card",
      style: `border-color: ${isWinner ? "var(--border-glow)" : isAGM ? "rgba(239,68,68,0.35)" : "var(--border-card)"};`,
    });

    if (isWinner) {
      card.appendChild(
        el(
          "div",
          { class: "bom-badge" },
          isCold
            ? "❄️ Cold Champion — Recommended"
            : "✅ Best Value — Recommended",
        ),
      );
    } else if (isAGM) {
      card.appendChild(
        el(
          "div",
          {
            class: "bom-badge",
            style:
              "background: rgba(239,68,68,0.15); color: rgb(239,68,68); border-color: rgba(239,68,68,0.35);",
          },
          "⚠️ Reference Only — Not Recommended",
        ),
      );
    }

    card.appendChild(el("h3", {}, r.label));
    card.appendChild(
      el(
        "p",
        {
          style:
            "font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.6rem;",
        },
        r.tagline,
      ),
    );

    appendRows(card, [
      ["Usable target", `${fmt(targetBattKwh)} kWh`],
      ["Usable DoD", `${Math.round(r.dod * 100)}%`],
      ["DoD details", r.dodNote],
      [
        "Cold derate",
        r.coldScale < 1
          ? `−${Math.round((1 - r.coldScale) * 100)}% in winter`
          : "None",
      ],
      ["Nameplate needed", `${r.nameplateKwh} kWh`],
      [
        "20-yr bank swaps",
        r.swaps === 0
          ? "None (outlasts horizon)"
          : `~${r.swaps} swap${r.swaps > 1 ? "s" : ""}`,
      ],
      ["System first cost", moneyRange(r.cost.lo, r.cost.hi)],
      ["True 20-yr cost", money(r.life.total)],
      ["Cold weather", r.coldNotes],
      ["Safety", r.safety],
    ]);

    // Adopt this chemistry button
    const btn = el(
      "button",
      {
        type: "button",
        class:
          "btn " +
          (r.id === (sel && sel.chemistry) ? "btn-outline" : "btn-primary"),
        style:
          "width: 100%; justify-content: center; margin-top: auto; cursor: pointer;",
      },
      r.id === (sel && sel.chemistry)
        ? "✓ Active Chemistry"
        : "Use This Chemistry",
    );

    if (r.id !== (sel && sel.chemistry) && sel) {
      btn.addEventListener("click", () => {
        const baseGridSpend = p.annualGridSpendUsd || 0;
        const annualSavingsUsd =
          p.mode === "offgrid"
            ? baseGridSpend
            : sel.displacedBillAnnualUsd !== undefined
              ? sel.displacedBillAnnualUsd
              : baseGridSpend;
        const residualAnnualUsd =
          p.mode === "offgrid"
            ? 0
            : sel.residualBillAnnualUsd !== undefined
              ? sel.residualBillAnnualUsd
              : 0;

        const cumCost = cumulativeCostSeries({
          capexMidUsd: r.cost.objectiveMid,
          annualSavingsUsd,
          residualAnnualUsd,
          swapsAndLaborTotalUsd: r.life.swapsAndLabor,
          replacements: r.swaps,
          batteryLifeYears: r.swaps > 0 ? 20 / (r.swaps + 1) : 20,
          firstLaborUsd: r.life.firstLabor,
        });

        adoptedEntry = {
          ...sel,
          chemistry: r.id,
          chemLabel: r.label,
          battNameplateKwh: r.nameplateKwh,
          costLo: r.cost.lo,
          costHi: r.cost.hi,
          costMid: r.cost.objectiveMid,
          lifetimeCostMid: r.life.total,
          swapsAndLaborUsd: r.life.swapsAndLabor,
          replacementsHorizon: r.swaps,
          cumCostSeries: cumCost,
          // These figures come from this tab's own nameplate/DoD model, not
          // from the site simulation. The flag keeps the lead-acid comparison
          // from subtracting a modelled figure from a simulated one — that
          // cross-model delta is what produced "lead-acid ~€X less" next to a
          // comparison card showing lead-acid an order of magnitude dearer.
          estimatedFromTab: true,
        };
        selectedKey = "adopted";
        if (p.frontier) {
          p.frontier.marker = {
            chemistry: r.id,
            capexUsd: r.cost.objectiveMid,
            outcomePct:
              sel.cutPct !== undefined
                ? sel.cutPct
                : p.frontier.marker
                  ? p.frontier.marker.outcomePct
                  : 100,
            pvKw,
            battKwh: targetBattKwh,
            pointIndex: null,
          };
          frontierSelected = null;
        }
        refreshSelectionOutputs(p);
        renderResults(p);
        requestIncrementalCut(pvKw, targetBattKwh, r.id);
      });
    }

    card.appendChild(btn);
    grid.appendChild(card);
  }

  const refFooter = el("div", {
    style:
      "grid-column: 1 / -1; margin-top: 0.5rem; padding: 0.75rem 1rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; font-size: 0.85rem;",
  });
  refFooter.innerHTML = `
    <span style="color: var(--text-muted);">
      🔬 <strong>DoD &amp; Zero-Swap Degradation Physics:</strong> Want to explore the empirical W&ouml;hler power-law curves and zero-swap oversizing math?
    </span>
    <a href="/blog/battery-longevity-and-dod-reference/" style="color: var(--secondary-accent, #3b82f6); text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
      Read Technical Reference &amp; Citations &rarr;
    </a>
  `;
  grid.appendChild(refFooter);
}

// ── Relative Capacity Spectrum (All Options tab) ─────────────────────────────
// Uses the selected system as the baseline (0% delta), compares 5 capacity
// tiers relative to the baseline — LFP and Sodium-ion only (no AGM).
function renderRelativeOptions(p, selectedSystem) {
  const grid = $("tierResults");
  if (!grid) return;
  grid.style.display = "grid";
  grid.innerHTML = "";

  const sel = selectedSystem || resolveSelected(p) || p.best;
  if (!sel) return;

  // Preserve the baseline anchor across relative adoptions so capacity ratios
  // don't compound exponentially (e.g. 1.75 × 1.75 = 3.06×).
  const base =
    (adoptedEntry && adoptedEntry._relativeAnchor) ||
    (sel && sel._relativeAnchor ? sel._relativeAnchor : sel);
  const activeTierId =
    (adoptedEntry && adoptedEntry._relativeTierId) || "baseline";

  // Cost-efficient chemistries only — NOT AGM
  const rawChem = base.chemistry || "lfp";
  const chem = rawChem === "sodium" || rawChem === "naion" ? "naion" : "lfp";
  const chemLabel = chem === "naion" ? "Sodium-ion" : "LFP";
  const baseBattKwh = Math.max(2, base.battKwh || (p.dailyKwh || 10) * 1.5);
  const basePvKw = Math.max(1, base.pvKw || (p.dailyKwh || 10) * 0.6);
  const landedF = (p.assumptions && p.assumptions.landedF) || 1;
  const isGT = p.mode === "gridtie";

  const ratedDoD = chem === "naion" ? 0.85 : 0.8;
  const baseDailyKwh = p.dailyKwh || 10;
  const baseEffectiveDod = Math.min(
    ratedDoD,
    Math.max(0.1, (baseDailyKwh / baseBattKwh) * ratedDoD),
  );
  const baseRatedCycles = cycleLifeForDoD(chem, baseEffectiveDod);

  const baseCost = fullRange(basePvKw, baseBattKwh, chem, landedF);
  const baseBattMid = landedMidBattKwhFor(chem, landedF);
  const baseCycles = Math.max(
    150,
    Math.min(450, Math.round((baseDailyKwh * 365) / baseBattKwh)),
  );
  const baseSwaps = batteryReplacements(baseCycles, baseRatedCycles, 20);
  const baseLife = lifetimeCostUsd({
    capexMidUsd: baseCost.objectiveMid,
    battKwhUsable: baseBattKwh,
    battPriceMidPerKwh: baseBattMid,
    replacements: baseSwaps,
    laborPerKwh: [12, 30],
  });

  const baseGridSpend = p.annualGridSpendUsd || 0;
  const totalAnnualSpend =
    (base.cumCostSeries &&
      base.cumCostSeries.grid &&
      base.cumCostSeries.grid[0]) ||
    baseGridSpend;

  const baseAnnualSavings = !isGT
    ? totalAnnualSpend
    : base.displacedBillAnnualUsd !== undefined
      ? base.displacedBillAnnualUsd
      : base.billAfterMonthlyUsd !== undefined
        ? Math.max(0, totalAnnualSpend - base.billAfterMonthlyUsd * 12)
        : Math.round(totalAnnualSpend * 0.8);

  const baseResidualAnnual = !isGT
    ? 0
    : base.residualBillAnnualUsd !== undefined
      ? base.residualBillAnnualUsd
      : base.billAfterMonthlyUsd !== undefined
        ? Math.max(0, base.billAfterMonthlyUsd * 12)
        : Math.max(0, totalAnnualSpend - baseAnnualSavings);

  const baseCumCost =
    base.cumCostSeries ||
    cumulativeCostSeries({
      capexMidUsd: baseCost.objectiveMid,
      annualSavingsUsd: baseAnnualSavings,
      residualAnnualUsd: baseResidualAnnual,
      swapsAndLaborTotalUsd: baseLife.swapsAndLabor,
      replacements: baseSwaps,
      batteryLifeYears: baseSwaps > 0 ? 20 / (baseSwaps + 1) : 20,
      firstLaborUsd: baseLife.firstLabor,
    });

  const header = el("div", {
    style:
      "grid-column: 1 / -1; margin-bottom: 0.75rem; padding: 0.9rem 1.1rem; background: rgba(0, 230, 153, 0.06); border: 1px solid var(--border-glow); border-radius: 10px;",
  });
  header.innerHTML = `
    <div style="font-weight: 700; color: var(--primary-accent); font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
      <span>📊 Capacity Spectrum (Relative to Your Selection)</span>
      <span style="font-size: 0.8rem; font-weight: 600; color: #fff; background: rgba(255,255,255,0.08); padding: 0.15rem 0.5rem; border-radius: 6px;">
        Baseline: ${basePvKw} kW Solar + ${fmt(baseBattKwh)} kWh ${chemLabel}
      </span>
    </div>
    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem; line-height: 1.55;">
      Comparing larger and smaller configurations around your baseline of <strong>${basePvKw} kW solar + ${fmt(baseBattKwh)} kWh ${chemLabel} battery</strong>.
      Includes <em>only cost-efficient chemistries</em> (excluding AGM). Evaluate upfront investment, storm buffer, and 20-year costs to find your ideal capacity.
    </div>
  `;
  grid.appendChild(header);

  const fmtDelta = (val, prefix = "$") => {
    if (Math.abs(val) < 1) return "Baseline";
    return val > 0
      ? `+${prefix}${Math.round(val).toLocaleString()}`
      : `\u2212${prefix}${Math.abs(Math.round(val)).toLocaleString()}`;
  };

  const tiers = [
    {
      id: "compact",
      label: "Compact / Essential",
      badge: "Starter / Essential Loads",
      battRatio: 0.6,
      pvRatio: 0.7,
    },
    {
      id: "lean",
      label: "Lean / Moderate",
      badge: "Most Loads Covered",
      battRatio: 0.8,
      pvRatio: 0.85,
    },
    {
      id: "baseline",
      label: "Current Selection",
      badge: "Active Baseline (0%)",
      battRatio: 1.0,
      pvRatio: 1.0,
      isBaseline: true,
    },
    {
      id: "high",
      label: "High Resilience",
      badge: "+35% More Capacity",
      battRatio: 1.35,
      pvRatio: 1.25,
    },
    {
      id: "max",
      label: "Maximum Independence",
      badge: "+75% More Capacity",
      battRatio: 1.75,
      pvRatio: 1.5,
    },
  ];

  for (const t of tiers) {
    const battKwh = Math.round(baseBattKwh * t.battRatio * 10) / 10;
    const pvKw = Math.round(basePvKw * t.pvRatio * 10) / 10;
    const cost = t.isBaseline
      ? baseCost
      : fullRange(pvKw, battKwh, chem, landedF);
    const battMid = landedMidBattKwhFor(chem, landedF);
    const cycles = Math.max(
      150,
      Math.min(450, Math.round((baseDailyKwh * 365) / battKwh)),
    );
    const effectiveDod = Math.min(
      ratedDoD,
      Math.max(0.1, (baseDailyKwh / battKwh) * ratedDoD),
    );
    const ratedCycles = cycleLifeForDoD(chem, effectiveDod);
    const swaps = batteryReplacements(cycles, ratedCycles, 20);
    const life = t.isBaseline
      ? baseLife
      : lifetimeCostUsd({
          capexMidUsd: cost.objectiveMid,
          battKwhUsable: battKwh,
          battPriceMidPerKwh: battMid,
          replacements: swaps,
          laborPerKwh: [12, 30],
        });
    const autonomy = battKwh / Math.max(0.1, baseDailyKwh);
    const baseAutonomy = baseBattKwh / Math.max(0.1, baseDailyKwh);

    const isSelected = activeTierId === t.id;

    let tierAnnualSavings = baseAnnualSavings;
    let tierResidualAnnual = baseResidualAnnual;
    if (isGT && !t.isBaseline) {
      const scaledFraction = Math.min(
        1.0,
        Math.max(
          0.2,
          (baseAnnualSavings / Math.max(1, totalAnnualSpend)) *
            Math.min(t.pvRatio, t.battRatio),
        ),
      );
      tierAnnualSavings = Math.round(totalAnnualSpend * scaledFraction);
      tierResidualAnnual = Math.max(0, totalAnnualSpend - tierAnnualSavings);
    }
    const cumCost =
      t.isBaseline && base.cumCostSeries
        ? base.cumCostSeries
        : cumulativeCostSeries({
            capexMidUsd: cost.objectiveMid,
            annualSavingsUsd: tierAnnualSavings,
            residualAnnualUsd: tierResidualAnnual,
            swapsAndLaborTotalUsd: life.swapsAndLabor,
            replacements: swaps,
            batteryLifeYears: swaps > 0 ? 20 / (swaps + 1) : 20,
            firstLaborUsd: life.firstLabor,
          });

    const approxSoc =
      base.socNameplatePct && base.socNameplatePct.min
        ? {
            min: base.socNameplatePct.min.map((v) =>
              Math.max(
                0,
                Math.min(100, Math.round(100 - (100 - v) / t.battRatio)),
              ),
            ),
            max: base.socNameplatePct.max.slice(),
          }
        : null;

    const card = el("div", {
      class: "bom-card" + (isSelected ? " bom-card-selected" : ""),
      style: isSelected ? "border-color: var(--border-glow);" : "",
    });

    card.appendChild(el("div", { class: "bom-badge" }, t.badge));
    card.appendChild(el("h3", {}, t.label));
    card.appendChild(
      el(
        "p",
        {
          style:
            "font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.6rem;",
        },
        `${pvKw} kW solar + ${fmt(battKwh)} kWh ${chemLabel} battery`,
      ),
    );

    appendRows(card, [
      ["PV array", `${pvKw} kW (${fmtDelta(pvKw - basePvKw, "")} kW)`],
      [
        "Battery bank",
        `${fmt(battKwh)} kWh (${fmtDelta(battKwh - baseBattKwh, "")} kWh)`,
      ],
      [
        "Autonomy",
        `~${autonomy.toFixed(1)} days (${fmtDelta(autonomy - baseAutonomy, "")} d)`,
      ],
      [
        "System first cost",
        `${moneyRange(cost.lo, cost.hi)} (${fmtDelta(cost.objectiveMid - baseCost.objectiveMid)})`,
      ],
      [
        "True 20-yr cost",
        `${money(life.total)} (${fmtDelta(life.total - baseLife.total)})`,
      ],
      [
        "20-yr swaps",
        swaps === 0 ? "None" : `~${swaps} swap${swaps > 1 ? "s" : ""}`,
      ],
    ]);

    let btnText = "Select This System";
    let btnClass = "btn btn-primary";
    if (isSelected) {
      btnText = t.isBaseline ? "✓ Active Baseline" : "✓ Active Selection";
      btnClass = "btn btn-outline";
    } else if (t.isBaseline) {
      btnText = "Reset to Baseline";
      btnClass = "btn btn-outline";
    }

    const btn = el(
      "button",
      {
        type: "button",
        class: btnClass,
        style:
          "width: 100%; justify-content: center; margin-top: auto; cursor: pointer;",
      },
      btnText,
    );

    if (!isSelected) {
      btn.addEventListener("click", () => {
        if (t.isBaseline) {
          adoptedEntry = {
            ...base,
            _relativeAnchor: base,
            _relativeTierId: "baseline",
            cumCostSeries: baseCumCost,
            socNameplatePct: base.socNameplatePct || null,
          };
          selectedKey = "adopted";
          if (p.frontier) {
            p.frontier.marker = {
              chemistry: base.chemistry || chem,
              capexUsd: baseCost.objectiveMid,
              outcomePct:
                base.cutPct !== undefined
                  ? base.cutPct
                  : p.frontier.marker
                    ? p.frontier.marker.outcomePct
                    : 100,
              pvKw: basePvKw,
              battKwh: baseBattKwh,
              pointIndex: null,
            };
            frontierSelected = null;
          }
          refreshSelectionOutputs(p);
          renderResults(p);
          requestIncrementalCut(basePvKw, baseBattKwh, chem);
        } else {
          adoptedEntry = {
            ...base,
            _relativeAnchor: base,
            _relativeTierId: t.id,
            pvKw,
            battKwh,
            costLo: cost.lo,
            costHi: cost.hi,
            costMid: cost.objectiveMid,
            lifetimeCostMid: life.total,
            swapsAndLaborUsd: life.swapsAndLabor,
            replacementsHorizon: swaps,
            chemistry: chem,
            chemLabel,
            battNameplateKwh: +(
              battKwh / (chem === "naion" ? 0.85 : 0.8)
            ).toFixed(1),
            cumCostSeries: cumCost,
            socNameplatePct: approxSoc,
          };
          selectedKey = "adopted";
          if (p.frontier) {
            p.frontier.marker = {
              chemistry: chem,
              capexUsd: cost.objectiveMid,
              outcomePct:
                base.cutPct !== undefined
                  ? Math.min(
                      100,
                      Math.round(
                        base.cutPct * Math.min(t.pvRatio, t.battRatio),
                      ),
                    )
                  : p.frontier.marker
                    ? p.frontier.marker.outcomePct
                    : 100,
              pvKw,
              battKwh,
              pointIndex: null,
            };
            frontierSelected = null;
          }
          refreshSelectionOutputs(p);
          renderResults(p);
          requestIncrementalCut(pvKw, battKwh, chem);
        }
      });
    }

    card.appendChild(btn);
    grid.appendChild(card);
  }

  // Expandable technical cross-matrix if available
  if (p.matrix) {
    const details = el("details", {
      style:
        "grid-column: 1 / -1; margin-top: 1.5rem; border: 1px solid var(--border-card); border-radius: 10px; padding: 0.85rem 1rem; background: var(--bg-card);",
    });
    details.innerHTML = `
      <summary style="cursor: pointer; font-weight: 700; color: var(--text-main); font-size: 0.9rem;">
        🔍 Technical Cross-Matrix (All Cut Targets × Chemistries)
      </summary>
      <div style="margin-top: 1rem; overflow-x: auto;">
        ${matrixHtml(p)}
      </div>
    `;
    grid.appendChild(details);
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
    btn.style.display = "";
    const active = resultLevel === lvl;
    btn.classList.toggle("ladder-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function setLevel(lvl) {
  resultLevel = lvl;
  syncLadderTabs();
  if (lastPayload) renderResults(lastPayload);
}

/** The one system we'd build here, stated plainly, with the why. */
function renderBestPick(p) {
  const wrap = $("bestPickWrap");
  if (!wrap) return;
  wrap.innerHTML = "";
  const grid = $("tierResults");
  if (grid) {
    grid.style.display = "grid";
    grid.innerHTML = "";
  }
  if (!p.best) {
    // Name the binding constraint when the matrix recorded one (e.g. the
    // optional roof-area cap) — otherwise this reads as a site problem when
    // the visitor's own input caused it.
    const envNote = p.matrix
      ? Object.values(p.matrix.cells || {}).find((c) => c && c.envelopeNote)
      : null;
    wrap.appendChild(
      el(
        "p",
        { style: "color:var(--text-muted);font-size:0.9rem;" },
        envNote && envNote.envelopeNote
          ? `No chemistry can reach this target here: ${envNote.envelopeNote}. Clear the roof/yard area box to search the full envelope, or lower the target.`
          : "No chemistry produced a practical system at this site and load. Try lowering the reliability target or the daily kWh.",
      ),
    );
    return;
  }
  const b = p.best;
  const isGT = p.mode === "gridtie";
  const solvablePool = (p.auto || []).filter(
    (a) => a.solvable && Number.isFinite(a.lifetimeCostMid),
  );
  // Sodium-first preference means the pick is not always the cheapest —
  // only say so when its lifetime cost actually is the minimum.
  const cheapestLife = solvablePool.length
    ? Math.min(...solvablePool.map((a) => a.lifetimeCostMid))
    : Infinity;
  const bestSuffix =
    solvablePool.length >= 2 && b.lifetimeCostMid <= cheapestLife + 1e-9
      ? " — cheapest compared"
      : solvablePool.length >= 2
        ? " — safest pick"
        : "";
  const card = el("div", { class: "bom-card" });
  card.style.borderColor = "var(--border-glow)";
  const title =
    b.pvKw === 0 && b.battKwh > 0
      ? `${b.chemLabel}: ${fmt(b.battKwh)} kWh battery (peak-hour offset)`
      : b.battKwh === 0
        ? `${b.chemLabel}: ${b.pvKw} kW solar (no battery needed)`
        : `${b.chemLabel}: ${b.pvKw} kW solar + ${fmt(b.battKwh)} kWh battery`;
  card.appendChild(
    el(
      "div",
      { class: "bom-badge" },
      "Recommended \u2014 safety-first true-cost pick",
    ),
  );
  card.appendChild(el("h3", {}, title));
  const rows = [
    ["Solar array", b.pvKw > 0 ? `${b.pvKw} kW` : "None (Battery-only)"],
    [
      "Battery (usable)",
      b.battKwh > 0
        ? `${fmt(b.battKwh)} kWh \u2014 ~${fmt(b.battNameplateKwh)} nameplate`
        : "None (Solar-only)",
    ],
  ];
  const foot = b.pvKw > 0 ? footprintText(b.pvKw) : null;
  if (foot) rows.push(["Footprint", foot]);
  rows.push(["Cost to buy", `~${moneyRange(b.costLo, b.costHi)}`]);
  rows.push([
    "Battery swaps",
    b.replacementsHorizon > 0
      ? b.batteryLifeYears
        ? `~${b.replacementsHorizon}x (about every ${fmtLife(b.batteryLifeYears)})`
        : `~${b.replacementsHorizon}x`
      : "None in 20 years",
  ]);
  if (b.swapsAndLaborUsd > 0)
    rows.push(["Swaps + labor add", `~${money(b.swapsAndLaborUsd)}`]);
  rows.push([
    "Total 20-year cost",
    `~${money(b.lifetimeCostMid)}${bestSuffix}`,
  ]);
  pushSeriesBreakdown(rows, b);
  if (!isGT) {
    if (b.battKwh > 0 && p.dailyKwh > 0) {
      const autonomyDays = (b.battKwh / p.dailyKwh).toFixed(1);
      rows.push([
        "Battery autonomy",
        `~${autonomyDays} days of storage with zero sun`,
      ]);
    }
    rows.push([
      "Unmet hours",
      `${fmt(b.unmetHoursPerYear ?? 0)} h/yr \u00B7 longest gap ${fmt(b.longestGapHours ?? 0)} h`,
    ]);
  } else {
    const baBest = fmtBillAfter(b.billAfterMonthlyUsd);
    if (baBest !== null) rows.push(["Bill after solar", baBest]);
  }
  if (p.tariff && typeof b.trueBreakEvenYear === "number") {
    rows.push(["Pays for itself", `Year ${b.trueBreakEvenYear}`]);
    if (b.replacementsHorizon > 0 && b.paybackYearsLo !== null) {
      rows.push([
        "  \u2014 first cost alone pays back in",
        fmtPaybackRange(b.paybackYearsLo, b.paybackYearsHi),
      ]);
    }
  } else if (
    p.tariff &&
    b.trueBreakEvenYear === null &&
    b.replacementsHorizon > 0
  ) {
    rows.push([
      "True 20-yr break-even",
      "never \u2014 replacements outpace savings",
    ]);
  } else if (!p.tariff && b.paybackYearsLo !== null) {
    rows.push([
      "Pays for itself in",
      fmtPaybackRange(b.paybackYearsLo, b.paybackYearsHi),
    ]);
  }
  if (Number.isFinite(b.lcoeUsdPerKwh)) {
    rows.push([
      "Your power cost",
      energyRate(b.lcoeUsdPerKwh) + gridRate(p.tariff),
    ]);
  }
  appendRows(card, rows);
  if (p.bestReason) {
    card.appendChild(
      el(
        "p",
        {
          style:
            "font-size:0.85rem;color:var(--text-main);margin-top:0.7rem;line-height:1.55;",
        },
        p.bestReason,
      ),
    );
  }
  const compareHint = isGT
    ? solvablePool.length >= 2
      ? " Click any cell in the matrix below to see that exact system in every chart and the hardware list."
      : " The matrix shows why the other chemistries weren't practical at this site."
    : solvablePool.length >= 2
      ? " Use the tabs above to compare every option side by side."
      : " The matrix shows why the other chemistries weren't practical at this site.";
  card.appendChild(
    el(
      "p",
      { style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;" },
      `${p.autoNote}.${compareHint}`,
    ),
  );
  wrap.appendChild(card);
}

/** Renders the Plain-English ELI5 breakdown into its dedicated container. */
function renderEli5Section(p, sys) {
  const wrap = $("eli5CardWrap");
  if (!wrap) return;
  if (!sys || !p || sys.solvable === false) {
    wrap.innerHTML = "";
    wrap.style.display = "none";
    return;
  }
  wrap.innerHTML = "";
  const card = renderEli5Card(p, sys);
  if (card) {
    wrap.appendChild(card);
    wrap.style.display = "block";
  } else {
    wrap.style.display = "none";
  }
}

/**
 * Real-world turnkey quotes vary VASTLY with market, competition, and sales
 * model — so instead of quoting a fixed "$20k–$40k" for every size, we scale
 * from the user's own hardware estimate:
 *
 *   - the CHEAPEST hardware build corresponds to the cheapest fair-ish
 *     turnkey market (highly competitive, thin margin): ~10× hardware cost;
 *   - the EXPENSIVE hardware build corresponds to boutique retail pricing:
 *     ~5× hardware cost (premium hardware still dilutes the sales markup).
 *
 * The result: a proportional "market spread" band that grows with system
 * size, plus a hardware-relative savings statement that stays honest at every
 * scale. Exported for regression tests.
 */
export const TURNKEY_MULTIPLIER_LOW = 10;
export const TURNKEY_MULTIPLIER_HIGH = 5;

export function estimateTurnkeyQuotes(costLo, costHi) {
  const lo = Number(costLo);
  const hi = Number(costHi);
  if (
    !Number.isFinite(lo) ||
    lo <= 0 ||
    !Number.isFinite(hi) ||
    hi <= 0 ||
    lo > hi
  )
    return null;
  const quoteLo = Math.round((lo * TURNKEY_MULTIPLIER_LOW) / 100) * 100;
  const quoteHi = Math.round((hi * TURNKEY_MULTIPLIER_HIGH) / 100) * 100;
  return { quoteLo, quoteHi };
}

export function turnkeyQuoteText(sys, moneyFn = money, rangeFn = moneyRange) {
  const directCost =
    Number.isFinite(sys?.costLo) && Number.isFinite(sys?.costHi)
      ? rangeFn(sys.costLo, sys.costHi)
      : Number.isFinite(sys?.costMid)
        ? moneyFn(sys.costMid)
        : "wholesale";
  const q = estimateTurnkeyQuotes(sys?.costLo, sys?.costHi);
  if (!q)
    return `DIY or direct hardware cost is ~${directCost}. Full-service installers quote this size at several times the hardware price once commissions, permits, and markups are added. Ordering direct and hiring a licensed electrician for the final hookup (~$1,500\u2013$3,000) keeps most of that spread in your pocket.`;
  const quotes = rangeFn(q.quoteLo, q.quoteHi);
  const allInLo = Math.round(((Number(sys.costLo) + 1500) / 100) * 100);
  const allInHi = Math.round(((Number(sys.costHi) + 3000) / 100) * 100);
  const saved =
    Math.round(((q.quoteLo + q.quoteHi) / 2 - (allInLo + allInHi) / 2) / 100) *
    100;
  return `DIY or direct hardware cost is ~${directCost}. For this system size, full-service quotes typically run ${quotes} \u2014 the cheapest competitive markets land near the low end, high-commission sales outfits near the top \u2014 driven by commissions, permits, and markups. Ordering direct and hiring a licensed electrician for the final hookup (~$1,500\u2013$3,000) puts your all-in cost near ${rangeFn(allInLo, allInHi)} \u2014 roughly ${moneyFn(saved)} below a typical quote.`;
}

/** Plain-English ELI5 breakdown for beginners and non-engineers. */
function renderEli5Card(p, sys) {
  if (!sys) return null;
  const eli5 = el("div", { class: "eli5-card" });
  eli5.appendChild(
    el(
      "div",
      { class: "eli5-title" },
      "📖 What This System Actually Looks Like in Real Life (Plain English)",
    ),
  );

  const eli5Grid = el("div", { class: "eli5-grid" });

  // 1. Solar Panels
  const watts = currentPanelWatts();
  const lay = sys.pvKw > 0 ? panelLayout(sys.pvKw, watts) : null;
  const panelDesc = lay
    ? `~${lay.count} standard rooftop or ground panels (${lay.panelWatts} W each). Needs about ${lay.areaM2} m\u00B2 (~${Math.round(lay.areaM2 * 10.764)} sq ft) of unshaded space. On a clear sunny day, this harvests around ${fmt(sys.pvKw * 4.5)} kWh of free electricity.`
    : "No solar panels are included in this battery-only configuration (charges during cheap off-peak hours to avoid expensive peak electricity).";

  const itemPanels = el("div", { class: "eli5-item" });
  itemPanels.appendChild(
    el("div", { class: "eli5-item-label" }, "🌞 The Solar Array"),
  );
  itemPanels.appendChild(el("div", { class: "eli5-item-desc" }, panelDesc));
  eli5Grid.appendChild(itemPanels);

  // 2. Battery Storage
  let battDesc =
    "No battery bank selected. Power generated during the day is consumed immediately or sent to the grid.";
  if (sys.battKwh > 0) {
    const rackUnits = Math.max(
      1,
      Math.round((sys.battNameplateKwh || sys.battKwh) / 5.12),
    );
    const autonomy =
      p.dailyKwh > 0 ? (sys.battKwh / p.dailyKwh).toFixed(1) : "2-3";
    battDesc = `${fmt(sys.battKwh)} kWh usable (~${fmt(sys.battNameplateKwh || sys.battKwh)} kWh total). That provides ~${autonomy} full days of normal power with zero sunlight. In physical size, this is about ${rackUnits} standard server-rack battery module(s) (about the size of small desktop PC cases).`;
  }
  const itemBatt = el("div", { class: "eli5-item" });
  itemBatt.appendChild(
    el("div", { class: "eli5-item-label" }, "🔋 The Battery Bank"),
  );
  itemBatt.appendChild(el("div", { class: "eli5-item-desc" }, battDesc));
  eli5Grid.appendChild(itemBatt);

  // 3. Inverter / Brain
  const splitWarning = window.lastInputs?.requiresSplitPhase
    ? " Native 240V split-phase is required for your selected 240V appliances (e.g. well pump, EV, or heat pump)."
    : " Supplies standard 120V household power.";
  const peakW =
    window.lastInputs?.peakLoadW || Math.round(((p.dailyKwh || 0) * 1000) / 24);
  const invContinuous = Math.max(3, Math.ceil((peakW * 1.25) / 1000));
  const invDesc =
    sys.battKwh === 0
      ? `A grid-tied string inverter (~${Math.max(3, Math.ceil(sys.pvKw))} kW). It converts daytime solar DC electricity directly into 120V/240V AC power for your home appliances and sends excess to the grid.`
      : sys.pvKw === 0
        ? `A bidirectional battery inverter / charger (~${invContinuous} kW). It quietly charges your batteries during cheap off-peak hours and discharges during peak-rate periods to eliminate expensive utility power.`
        : `A wall-mounted hybrid inverter / charger (~${invContinuous} to ${Math.max(invContinuous, 6)} kW continuous). It quietly converts DC power from solar and batteries into clean AC power for your outlets.${splitWarning}`;

  const itemInv = el("div", { class: "eli5-item" });
  itemInv.appendChild(
    el("div", { class: "eli5-item-label" }, "⚡ The Inverter (System Brain)"),
  );
  itemInv.appendChild(el("div", { class: "eli5-item-desc" }, invDesc));
  eli5Grid.appendChild(itemInv);

  // 4. Sourcing & Cost Reality
  const directCost =
    Number.isFinite(sys.costLo) && Number.isFinite(sys.costHi)
      ? moneyRange(sys.costLo, sys.costHi)
      : Number.isFinite(sys.costMid)
        ? money(sys.costMid)
        : "wholesale";
  const costDesc = turnkeyQuoteText(sys);
  const itemCost = el("div", { class: "eli5-item" });
  itemCost.appendChild(
    el("div", { class: "eli5-item-label" }, "💰 Wholesale vs Turnkey Quotes"),
  );
  itemCost.appendChild(el("div", { class: "eli5-item-desc" }, costDesc));
  eli5Grid.appendChild(itemCost);

  eli5.appendChild(eli5Grid);
  return eli5;
}

/** Compact column labels for the matrix header. */
function matrixColShort(p, col) {
  if (p.mode === "gridtie") {
    if (col.custom)
      return (
        col.label ||
        `Your ~${p.customCut ? Math.round(p.customCut.fraction * 100) : 80}% target`
      );
    return col.id === "cut60"
      ? "\u221260% bill"
      : col.id === "cut80"
        ? "\u221280% bill"
        : col.id === "cut95"
          ? "\u221295% bill"
          : col.label
            ? col.label.split("\u2014")[0].trim()
            : `\u2212${col.id.replace("cut", "")}% bill`;
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
      if (
        c &&
        c.solvable &&
        Number.isFinite(c.lifetimeCostMid) &&
        c.lifetimeCostMid < min
      )
        min = c.lifetimeCostMid;
    }
    colBest[col.id] = min;
  }
  const head = m.cols.map((c) => `<th>${matrixColShort(p, c)}</th>`).join("");
  const body = m.rows
    .map((row) => {
      const cells = m.cols
        .map((col) => {
          const key = `${row.id}:${col.id}`;
          const cell = m.cells[key];
          const bestCls =
            cell &&
            cell.solvable &&
            Number.isFinite(cell.lifetimeCostMid) &&
            cell.lifetimeCostMid === colBest[col.id]
              ? " matrix-best"
              : "";
          const selCls =
            selectable && selKey === "matrix:" + key ? " matrix-sel" : "";
          const cls =
            bestCls || selCls ? ` class="${(bestCls + selCls).trim()}"` : "";
          const clickable = selectable
            ? ` data-sel="${key}" role="button" tabindex="0" aria-label="Select ${escapeAttr(row.label)} at ${escapeAttr(col.label)}" style="cursor:pointer;"`
            : "";
          if (!cell || !cell.solvable) {
            const hint =
              cell && cell.reason ? INFEASIBLE_HINTS[cell.reason] : null;
            const reasonText = hint
              ? hint.title
              : cell && cell.reason
                ? cell.reason
                : "not practical here";
            const detail =
              cell && cell.envelopeNote
                ? ` — ${escapeHtml(cell.envelopeNote)}`
                : hint && hint.body
                  ? `<br><span style="font-size:0.7rem;opacity:0.85;">${escapeHtml(hint.body)}</span>`
                  : "";
            return `<td${cls}><span style="color:var(--text-muted);font-size:0.78rem;line-height:1.35;">${escapeHtml(reasonText)}${detail}</span></td>`;
          }
          let rel;
          if (p.mode === "offgrid")
            rel = `${fmt(cell.unmetHoursPerYear)} h/yr unmet`;
          else if (col.id === "custom" && surplusCol)
            rel = "bill gone + surplus";
          else rel = `-${cell.cutPct}% bill`;
          const lcoe = Number.isFinite(cell.lcoeUsdPerKwh)
            ? `<span style="color:var(--text-muted);">\u00B7 ${energyRate(cell.lcoeUsdPerKwh)}</span>`
            : "";
          return (
            `<td${cls}${clickable}>${cell.pvKw} kW PV<br>${cell.battKwh > 0 ? fmt(cell.battKwh) + " kWh batt" : "no battery"}` +
            `<br>~${moneyRange(cell.costLo, cell.costHi)}<br><strong>20-yr ~${money(cell.lifetimeCostMid)}</strong><br>${rel} ${lcoe}</td>`
          );
        })
        .join("");
      return `<tr><th>${escapeHtml(row.label)}</th>${cells}</tr>`;
    })
    .join("");
  const hint =
    p.mode === "gridtie"
      ? "Green outline = lowest true 20-year cost in that column. Click any cell to make it the system shown in every chart, the hardware list, and the export figures below. The \u201Cyour target\u201D column follows the slider."
      : 'Green outline = lowest true 20-year cost in that column (every bank swap counted). "Unmet" hours are covered by a generator or the grid.';
  return (
    `<div class="matrix-wrap"><table class="matrix-table"><thead><tr><th>Battery \u2193 \u00B7 Goal \u2192</th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;line-height:1.55;">${hint}</p>`
  );
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
// ── Jev sanity check ───────────────────────────────────────────────────────────
// One probe per distinct result state: the interpretation is cached by the
// state fingerprint, so mode toggles and re-renders re-mount the badge from
// cache instead of re-asking the model. A confident "impossible" verdict on
// our deterministic engine's output would mean a rescale/merge bug — so the
// on-the-spot response is one full engine re-run (deterministic self-heal);
// a flag on the re-run renders as-is (refinedPayloads guards the loop).
let sanityCache = { key: null, state: null, interp: null };
let sanityStatus = "idle";
let sanityRequestSeq = 0;
let sanityInFlight = null;
const sanityRefined = new WeakSet();

function clearSanityBadges() {
  for (const id of ["resultsRegion", "simpleResultsWrap"]) {
    const container = $(id);
    if (container)
      container.querySelectorAll(".sanity-badge").forEach((b) => b.remove());
  }
}

function runSanityCheck(p) {
  if (!p || p.unreachableReason) {
    sanityStatus = "unavailable";
    clearSanityBadges();
    return;
  }
  const sel = resolveSelected(p);
  const entry = sel && sel.solvable ? sel : p.best;
  const state = sanityState(p, entry);
  if (!state) {
    sanityStatus = "unavailable";
    clearSanityBadges();
    return;
  }
  const key = JSON.stringify(state);

  const mount = () => {
    clearSanityBadges();
    if (!sanityCache.interp) return;
    const container = isSimpleMode()
      ? $("simpleResultsWrap")
      : $("resultsRegion");
    if (container)
      renderSanityBadge(container, sanityCache.interp, t, askAdvisor);
  };

  if (sanityCache.key === key && sanityCache.interp) {
    sanityStatus = "available";
    mount();
    return;
  }
  // A selection change or a fresh payload supersedes every older request.
  // Without this, a slow response for system A can mount its verdict on
  // system B and the advisor can explain the wrong deterministic result.
  if (sanityInFlight && sanityInFlight.key === key) {
    sanityStatus = "pending";
    return;
  }
  const requestId = ++sanityRequestSeq;
  sanityInFlight = { id: requestId, key, state };
  sanityCache = { key, state, interp: null };
  sanityStatus = "pending";
  clearSanityBadges();

  requestSanity(state)
    .then((data) => {
      // Ignore late responses after a selection/payload change. Checking both
      // the request identity and the current state also covers selection edits
      // that happen while the same payload object is being re-rendered.
      const currentEntry = lastPayload ? resolveSelected(lastPayload) : null;
      const currentState = lastPayload
        ? sanityState(
            lastPayload,
            currentEntry && currentEntry.solvable
              ? currentEntry
              : lastPayload.best,
          )
        : null;
      if (
        !sanityResponseIsCurrent(
          requestId,
          sanityInFlight?.id,
          key,
          currentState ? JSON.stringify(currentState) : null,
        )
      )
        return;
      const interp = interpretSanity(data);
      sanityInFlight = null;
      sanityCache = { key, state, interp };
      sanityStatus = interp ? "available" : "unavailable";
      mount();
      if (
        interp &&
        interp.level === "flag" &&
        interp.verdict === "impossible" &&
        !sanityRefined.has(p)
      ) {
        sanityRefined.add(p);
        run(); // on-the-spot full deterministic re-run — never an AI number
      }
    })
    .catch(() => {
      if (sanityInFlight && sanityInFlight.id === requestId) {
        sanityInFlight = null;
        sanityStatus = "unavailable";
      }
    });
}

function resolveSelected(p) {
  if (!p) return null;
  const key = selectedKey || "best";
  if (key === "adopted" && adoptedEntry) return adoptedEntry;
  if (key === "focus" && p.focusSystem) return p.focusSystem;
  if (key === "custom") {
    const c = p.customCut;
    return (
      (c && c.best) ||
      (c && c.entries && c.entries[0]) ||
      p.customTarget ||
      null
    );
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
    const pool = (p.targets || []).concat(
      p.customTarget ? [p.customTarget] : [],
    );
    const entry = pool.find((t) => t.id === tid);
    if (entry && entry.solvable) return entry;
  }
  return (
    p.best ||
    (p.auto && p.auto.find((a) => a.solvable)) ||
    (p.targets &&
      (p.targets.find((t) => t.id === "cut80" && t.solvable) ||
        p.targets.find((t) => t.solvable))) ||
    (p.tiers &&
      (p.tiers.find((t) => t.id === "tier99" && t.solvable) ||
        p.tiers.find((t) => t.solvable))) ||
    (p.customCut && p.customCut.best) ||
    p.customTarget ||
    p.focusSystem ||
    null
  );
}

// If the entry carries a full 20-year cost series, append the bills-split so
// the card tells the same story as the chart: system + remaining bills =
// all-in. Silent when there is no tariff/series.
function pushSeriesBreakdown(rows, entry) {
  const bd =
    entry && entry.cumCostSeries ? seriesBreakdown(entry.cumCostSeries) : null;
  if (!bd || bd.systemTotal === null || bd.residualBills === 0) return;
  if (bd.residualBills > 0) {
    rows.push(["Remaining 20-yr bills", `~${money(bd.residualBills)}`]);
    rows.push([
      "All-in over 20 yrs (system + bills)",
      `~${money(bd.withSolar)}`,
    ]);
  } else {
    // Net metering: the feed-in credit on surplus out-earns the remaining
    // bill, so the residual is negative — present it as the credit it is.
    rows.push([
      "Net feed-in credit over 20 yrs",
      `~${money(-bd.residualBills)}`,
    ]);
    rows.push([
      "All-in over 20 yrs (system \u2212 credit)",
      bd.withSolar < 0
        ? `~\u2212${money(-bd.withSolar)}`
        : `~${money(bd.withSolar)}`,
    ]);
  }
}

// The tooltip/table rows for ANY selectable system — full money story, export
// economics and 20-year picture. Shared by the curve-point modal and the
// selected-system banner.
function entryDetailRows(p, e) {
  const rows = [];
  const chemLabel =
    e.chemLabel ||
    (p.matrix &&
      p.matrix.rows &&
      p.matrix.rows.find((r) => r.id === e.chemistry)?.label) ||
    e.chemistry ||
    "—";
  rows.push(["Chemistry", chemLabel]);
  rows.push(["Solar array", `${e.pvKw} kW`]);
  rows.push([
    "Battery (usable)",
    e.battKwh > 0
      ? `${fmt(e.battKwh)} kWh${e.battNameplateKwh ? ` — ~${fmt(e.battNameplateKwh)} nameplate` : ""}`
      : "none needed",
  ]);
  const foot = footprintText(e.pvKw);
  if (foot) rows.push(["Footprint", foot]);
  if (e.cutPct !== undefined && e.cutPct !== null) {
    rows.push([
      p.mode === "gridtie" ? "Bill cut" : "Coverage",
      p.mode === "gridtie" ? `-${e.cutPct}%` : `${e.cutPct}%`,
    ]);
  }
  rows.push(["Component cost", `~${moneyRange(e.costLo, e.costHi)}`]);
  const baEntry = fmtBillAfter(e.billAfterMonthlyUsd);
  if (baEntry !== null) {
    rows.push(["Bill after solar", baEntry]);
  }
  if (e.importedKwhPerYear !== undefined && e.importedKwhPerYear !== null) {
    rows.push(["Imported from grid", `${fmt(e.importedKwhPerYear)} kWh/yr`]);
  }
  if (e.clippedKwhPerYear !== undefined && e.clippedKwhPerYear !== null) {
    const feed =
      e.exportValueAnnualUsd > 0
        ? ` · feed-in +${money(e.exportValueAnnualUsd)}/yr`
        : " · enter a feed-in credit to value it";
    rows.push([
      p.mode === "gridtie" ? "Surplus clipped" : "Sun clipped",
      `${fmt(e.clippedKwhPerYear)} kWh/yr${feed}`,
    ]);
  }
  if (e.paybackYearsLo !== null && e.paybackYearsLo !== undefined) {
    rows.push([
      "Pays back its first cost in",
      fmtPaybackRange(e.paybackYearsLo, e.paybackYearsHi),
    ]);
  }
  if (typeof e.trueBreakEvenYear === "number") {
    rows.push(["True 20-yr break-even", `Year ${e.trueBreakEvenYear}`]);
  } else if (e.trueBreakEvenYear === null && e.replacementsHorizon > 0) {
    rows.push(["True 20-yr break-even", "never — swaps outpace savings"]);
  }
  if (e.replacementsHorizon > 0 && e.battKwh > 0) {
    rows.push([
      "Battery swaps over 20 yr",
      `~${e.replacementsHorizon}x — adds ~${money(e.swapsAndLaborUsd)} with labor`,
    ]);
  }
  if (Number.isFinite(e.lifetimeCostMid)) {
    rows.push(["Total 20-year cost", `~${money(e.lifetimeCostMid)}`]);
  }
  pushSeriesBreakdown(rows, e);
  if (Number.isFinite(e.lcoeUsdPerKwh)) {
    rows.push([
      "Your power cost",
      energyRate(e.lcoeUsdPerKwh) + gridRate(p.tariff),
    ]);
  }
  if (e.unmetHoursPerYear !== undefined && e.unmetHoursPerYear !== null) {
    rows.push([
      "Unmet hours",
      `${fmt(e.unmetHoursPerYear)} h/yr · longest gap ${fmt(e.longestGapHours ?? 0)} h`,
    ]);
  }
  if (e.bestPriceCallout) {
    rows.push(["Scenario note", bestPriceNote(e.bestPriceCallout)]);
  }
  return rows;
}

// Opening the full-analysis modal for a chosen system (curve point, matrix
// cell, etc). ``adopt`` makes the primary button re-run the engine with this
// EXACT system so the live charts and hardware list follow it.
let systemModalOpener = null;
function showSystemModal(p, entry, adopt) {
  const overlay = $("systemModal");
  if (!overlay) return;
  if (
    overlay.style.display !== "flex" &&
    document.activeElement &&
    document.activeElement !== document.body
  ) {
    systemModalOpener = document.activeElement;
  }
  const body = $("systemModalBody");
  const chemLabel =
    entry.chemLabel ||
    (p.matrix &&
      p.matrix.rows &&
      p.matrix.rows.find((r) => r.id === entry.chemistry)?.label) ||
    entry.chemistry ||
    "system";
  const headPct =
    entry.cutPct !== undefined && entry.cutPct !== null
      ? ` — ${entry.cutPct}%`
      : "";
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
    body.appendChild(
      el(
        "p",
        {
          style:
            "font-size:0.78rem;color:var(--text-muted);margin-top:0.7rem;line-height:1.5;",
        },
        "Every figure is computed from the same hourly weather simulation as the cards — nothing here is estimated by eye." +
          (p.tariff
            ? ""
            : " Enter your grid price above to see payback vs. your bill."),
      ),
    );
  }
  const adoptBtn = $("systemModalUse");
  if (adoptBtn) {
    adoptBtn.style.display = adopt ? "inline-flex" : "none";
    adoptBtn._adopt = () => {
      if (!adopt) return;
      pendingFocus = {
        pvKw: entry.pvKw,
        battKwh: entry.battKwh,
        chemistry: entry.chemistry,
      };
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
  // Hand focus back to whatever opened the modal (curve point, matrix cell).
  if (systemModalOpener && document.contains(systemModalOpener)) {
    try {
      systemModalOpener.focus();
    } catch {
      /* focus is best-effort */
    }
  }
  systemModalOpener = null;
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
    peakLoadW:
      f.peakLoadW ||
      (p.focus && p.focus.peakLoadW) ||
      Math.round(((p.dailyKwh || 0) * 1000) / 24),
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
  if (!bom) {
    body.innerHTML = "";
    return;
  }
  body.innerHTML = "";

  const section = (title, rows) => {
    if (!rows || !rows.length) return;
    const card = el("div", {
      class: "bom-card",
      style: "margin-bottom:0.8rem;",
    });
    card.appendChild(el("h3", {}, title));
    appendRows(card, rows);
    body.appendChild(card);
  };

  const f = resolveSelected(lastPayload) || lastPayload.focus;
  if (f && f.bestPriceCallout) {
    const callout = el(
      "div",
      {
        class: "best-price-callout",
        style:
          "margin-bottom:0.8rem;padding:0.75rem 1rem;border-radius:8px;background:rgba(0,230,153,0.08);border:1px solid rgba(0,230,153,0.3);font-size:0.85rem;line-height:1.45;color:var(--text-color);",
      },
      `💡 ${bestPriceNote(f.bestPriceCallout)}`,
    );
    body.appendChild(callout);
  }
  if (bom.panels) {
    section("Panels", [
      [
        "Array",
        `${f.pvKw} kW \u2192 ${bom.panels.count} \u00D7 ${bom.panels.panelWatts} W = ${bom.panels.kwActual} kW`,
      ],
      [
        "Space needed",
        `about ${bom.panels.areaM2} m\u00B2 of roof or ground (mounting gaps included)`,
      ],
    ]);
  } else {
    section("Panels", [
      [
        "Array",
        "None (Battery-only configuration \u2014 ToU grid arbitrage / peak-offset)",
      ],
    ]);
  }
  if (bom.voltage && bom.battery) {
    section(
      "Battery bank",
      [
        [
          "System voltage",
          `${bom.voltage.volts} V \u2014 ${bom.voltage.rationale}`,
        ],
        bom.battery.diy
          ? [
              "DIY build",
              `${bom.battery.diy.unitLabel} \u00D7 ${bom.battery.diy.stringsParallel} parallel string(s) = ${bom.battery.diy.blocksTotal} cells`,
            ]
          : null,
        bom.battery.retail
          ? [
              "Prebuilt alternative",
              `${bom.battery.retail.modules} \u00D7 ${bom.battery.retail.unitLabel}`,
            ]
          : null,
        [
          "Nameplate target",
          `~${fmt(f.battNameplateKwh)} kWh at ${(bom.battery.usableDod * 100).toFixed(0)}% usable depth of discharge`,
        ],
      ].filter(Boolean),
    );
  } else {
    section("Battery bank", [
      [
        "Storage",
        "None (Solar-only configuration \u2014 direct consumption + grid export)",
      ],
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
      [
        "Controller capacity",
        `${bom.controller.ampsRequired} A total \u2014 ${bom.controller.suggestion}`,
      ],
      ["Controller note", bom.controller.note],
      [
        "Main battery fuse/breaker",
        `${bom.protection.mainFuseAmps} A (bank can pull ~${bom.protection.batteryDischargeAmps} A at full load)`,
      ],
      ["PV disconnect", `${bom.protection.pvBreakerAmps} A`],
    ]);
  }
  if (bom.cable) {
    section(
      "Battery-to-inverter cable (copper)",
      bom.cable.map((c) => [
        `${c.meters} m run`,
        c.mm2
          ? `${c.awg} (${c.mm2} mm\u00B2) or larger`
          : `larger than ${c.awg} \u2014 shorten the run`,
      ]),
    );
  }
  if (bom.panels && lastPayload?.meta?.latitude != null) {
    const lat = lastPayload.meta.latitude;
    const absLat = Math.abs(lat);
    const facing = lat >= 0 ? "True South (180\u00B0)" : "True North (0\u00B0)";
    const yrTilt = Math.round(absLat * 0.9);
    const wtrTilt = Math.min(70, Math.round(absLat + 15));
    const smrTilt = Math.max(10, Math.round(absLat - 15));
    section("Array Mounting & Optimal Tilt", [
      ["Array orientation", `Face ${facing} for maximum annual solar harvest`],
      ["Year-round fixed tilt", `~${yrTilt}\u00B0 from horizontal`],
      [
        "Winter steep tilt (critical for off-grid)",
        `~${wtrTilt}\u00B0 \u2014 sheds snow & captures low winter sun`,
      ],
      ["Summer tilt (optional)", `~${smrTilt}\u00B0`],
      [
        "Mounting recommendation",
        absLat > 40
          ? "Ground mount strongly recommended for easy snow clearing & seasonal tilt adjustment"
          : "Roof mount (flush/racked) or ground mount",
      ],
    ]);
  }
  const bosCard = el("div", {
    class: "bom-card bos-checklist-card",
    style: "margin-bottom:0.8rem;",
  });
  bosCard.appendChild(
    el(
      "h3",
      {},
      "\uD83D\uDEE1\uFE0F Essential Balance-of-System (BOS) & Safety Checklist",
    ),
  );
  const bosRows = [
    [
      "DC Battery Disconnect",
      `Heavy-duty rotary disconnect switch + Class-T fuse (or DC-rated breaker) sized to ${bom.protection?.mainFuseAmps || 200} A near battery positive terminal.`,
    ],
    [
      "PV Array Isolator + SPD",
      "DC-rated 2-pole breaker and DC Surge Protective Device (lightning arrestor) before the charge controller.",
    ],
    [
      "Battery Shunt / Monitor",
      "Precision 500 A shunt on main battery negative for exact State-of-Charge (SoC) tracking (voltage alone is inaccurate on lithium).",
    ],
    [
      "Copper Busbars & Cables",
      "Solid copper busbars for multi-battery paralleling; hydraulic hex crimps with dual-wall adhesive heatshrink on all battery cable lugs.",
    ],
    [
      "Equipment Grounding",
      "Common earth ground bonding for panel mounting rails, lightning arrestors, and inverter chassis to ground rod.",
    ],
  ];
  if (window.lastInputs?.requiresSplitPhase) {
    bosRows.push([
      "\u26A1 240V Split-Phase Alert",
      "Your selected appliances (e.g. deep well pump, heat pump, or EV charger) require 240V split-phase (L1 + L2 + N). Ensure your inverter is a native 120/240V split-phase unit or two identical 120V inverters stacked with a communication cable.",
    ]);
  }
  appendRows(bosCard, bosRows);
  body.appendChild(bosCard);
  if (bom.notes.length) {
    body.appendChild(
      el(
        "p",
        {
          style:
            "font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem;line-height:1.5;",
        },
        bom.notes.join(" "),
      ),
    );
  }
}

function csvField(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function downloadBomCsv() {
  const bom = buildFocusBom();
  // Label row describes the SELECTED system the BOM was built from — never
  // the default focus when the visitor adopted or picked another system.
  const f =
    (lastPayload && resolveSelected(lastPayload)) ||
    (lastPayload && lastPayload.focus);
  if (!bom || !f) return;
  const rows = [
    ["BigEnergyCo hardware list - educational estimate, not a quote"],
    ["Generated", new Date().toISOString().slice(0, 10)],
    [
      "System",
      `${f.pvKw || 0} kW PV + ${f.battNameplateKwh || 0} kWh nameplate (${bom.chemLabel || "Solar"})`,
    ],
    [
      "Location",
      `${lastPayload.meta.latitude.toFixed(2)}, ${lastPayload.meta.longitude.toFixed(2)}`,
    ],
    [],
    ["Section", "Item", "Quantity / size", "Notes"],
  ];
  if (bom.panels) {
    rows.push([
      "Panels",
      `${bom.panels.panelWatts} W mono panels`,
      bom.panels.count,
      `${bom.panels.kwActual} kW array, about ${bom.panels.areaM2} sq m`,
    ]);
  } else {
    rows.push(["Panels", "None", 0, "Battery-only configuration"]);
  }
  if (bom.voltage && bom.battery) {
    rows.push(
      [
        "Bank",
        "System voltage",
        `${bom.voltage.volts} V`,
        bom.voltage.rationale,
      ],
      [
        "Bank (DIY)",
        bom.battery.diy.unitLabel,
        `${bom.battery.diy.stringsParallel} string(s), ${bom.battery.diy.blocksTotal} cells`,
        `${bom.battery.diy.stringKwh} kWh per string`,
      ],
      [
        "Bank (retail alt.)",
        bom.battery.retail.unitLabel,
        bom.battery.retail.modules,
        "BMS and enclosure included",
      ],
    );
  } else {
    rows.push(["Bank", "None", 0, "Solar-only configuration"]);
  }
  rows.push([
    "Inverter",
    `${bom.inverter.recommendedKw} kW class continuous`,
    1,
    bom.inverter.referenceUnit,
  ]);
  if (bom.controller) {
    rows.push(
      [
        "Charging",
        `MPPT controller capacity`,
        `${bom.controller.ampsRequired} A total`,
        bom.controller.suggestion,
      ],
      [
        "Protection",
        "Main battery fuse/breaker",
        `${bom.protection.mainFuseAmps} A`,
        `bank draws ~${bom.protection.batteryDischargeAmps} A at full load`,
      ],
      [
        "Protection",
        "PV disconnect/breaker",
        `${bom.protection.pvBreakerAmps} A`,
        "",
      ],
    );
  }
  if (bom.cable) {
    for (const c of bom.cable) {
      rows.push([
        "Cable",
        `Battery-to-inverter run ${c.meters} m`,
        c.mm2 ? `${c.awg} (${c.mm2} sq mm) copper` : `larger than ${c.awg}`,
        "2% max drop, conservative ampacity",
      ]);
    }
  }
  if (bom.panels && lastPayload?.meta?.latitude != null) {
    const lat = lastPayload.meta.latitude;
    const absLat = Math.abs(lat);
    const facing = lat >= 0 ? "True South (180 deg)" : "True North (0 deg)";
    rows.push([
      "Mounting",
      "Array Tilt & Orientation",
      `Facing: ${facing}`,
      `Year-round fixed: ~${Math.round(absLat * 0.9)} deg | Winter steep: ~${Math.min(70, Math.round(absLat + 15))} deg`,
    ]);
  }
  rows.push(
    [
      "BOS Safety",
      "DC Battery Disconnect & Fuse",
      `Class-T fuse / DC breaker ${bom.protection?.mainFuseAmps || 200} A`,
      "Mandatory overcurrent protection near positive terminal",
    ],
    [
      "BOS Safety",
      "PV DC Isolator & Surge Device",
      "DC-rated breaker + SPD",
      "Protects charge controller / inverter from PV lightning surges",
    ],
    [
      "BOS Safety",
      "Battery Shunt / Monitor",
      "500 A precision current shunt",
      "Tracks true SoC via Coulomb counting",
    ],
    [
      "BOS Safety",
      "Equipment Grounding & Bonding",
      "Copper ground rod + bonding bus",
      "Single common earth bond for frame rails, SPDs, and inverter chassis",
    ],
  );
  if (window.lastInputs?.requiresSplitPhase) {
    rows.push([
      "BOS Notice",
      "240V Split-Phase Required",
      "L1 + L2 + Neutral (120/240V)",
      "Required for 240V well pump, mini-split, or EV charger",
    ]);
  }
  rows.push(
    [],
    [
      "Disclaimer",
      "Educational estimate only. Verify everything with a licensed electrician or engineer before purchasing or energizing.",
    ],
  );
  const csv =
    "\uFEFF" + rows.map((r) => r.map(csvField).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url;
  aEl.download = "bigenergyco-parts-list.csv";
  document.body.appendChild(aEl);
  aEl.click();
  aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  setStatus(
    " Parts list downloaded \u2014 take it to your supplier or electrician as a starting point.",
  );
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
  [24, 50, -125, -66], // US mainland
  [18.5, 28.5, -179, -154], // Hawaii
  [50.5, 72, -168, -129], // Alaska
];
let fuelImperial = false;

function usesImperialUnits() {
  const lat = parseFloat($("latInput")?.value);
  const lon = parseFloat($("lonInput")?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return IMPERIAL_BOXES.some(
    ([latMin, latMax, lonMin, lonMax]) =>
      lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax,
  );
}

// Fuel price -> effective USD cost per kWh. The user types a local-currency
// price (the same unit the results use); this converts to USD, and also
// converts volume liters <-> gallons when the country buys by the gallon.
function genRateUsd() {
  const type = $("genFuelType")?.value || "petrol";
  const local = parseFloat($("genFuelPrice")?.value);
  if (!(local > 0)) return null;
  const fx = fxActive();
  const priceUsd = fx && fx.rate ? local / fx.rate : local; // local -> USD
  const perKwh = fuelImperial
    ? (GEN_GAL_PER_KWH[type] ?? GEN_GAL_PER_KWH.petrol)
    : (GEN_L_PER_KWH[type] ?? GEN_L_PER_KWH.petrol);
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
  const sym = fx ? CURRENCIES[fx.code]?.symbol || fx.code : "$";
  const label = document.querySelector('label[for="genFuelPrice"]');
  if (label)
    label.textContent = `${t(fuelImperial ? "fuelGalLabel" : "fuelLitLabel")} (${sym}):`;
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
    ? (GEN_GAL_PER_KWH[$("genFuelType").value] ?? GEN_GAL_PER_KWH.petrol)
    : (GEN_L_PER_KWH[$("genFuelType").value] ?? GEN_L_PER_KWH.petrol);
  const unit = fuelImperial ? "gal" : "L";
  readout.textContent =
    t("fuelReadoutRate", { type: typeSel, rate: localRate(rate) }) +
    " " +
    t("fuelReadoutBurn", { entry, burn: burn.toFixed(2), unit }) +
    " " +
    t("fuelReadoutGrid", { lo: localRate(0.1), hi: localRate(0.3) });
  readout.style.display = "block";
  applyBtn.style.display = "inline-flex";
}

function applyGenRate() {
  const rate = genRateUsd();
  if (rate === null || !$("customRateVal")) return;
  const fx = fxActive();
  const display =
    fx && fx.rate ? +(rate * fx.rate).toFixed(4) : +rate.toFixed(4);
  $("customRateVal").value = String(display);
  generatorBasis = true;
  tariffTouched = true;
  syncBillSlider();
  markPrecalcDirty();
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

  const feeNote =
    p.fixedMonthlyUsd > 0
      ? t("tariffSpendFixed", { fixed: money(p.fixedMonthlyUsd) })
      : "";
  moneyBar.textContent =
    (p.mode === "gridtie"
      ? t("tariffSpendLine", {
          tariff: localRate(p.tariff),
          annual: money(p.annualGridSpendUsd),
        })
      : t("tariffSpendOffgrid", {
          tariff: localRate(p.tariff),
          annual: money(p.annualGridSpendUsd),
        })) + feeNote;
}

function renderTierCards(p) {
  const grid = $("tierResults");

  grid.innerHTML = "";

  for (const t of p.tiers) {
    const isSelected = selectedKey === "tier:" + t.id;

    const card = el("div", {
      class:
        "bom-card" +
        (t.solvable ? " card-selectable" : "") +
        (isSelected ? " bom-card-selected" : ""),
    });

    if (t.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = "tier:" + t.id;
        renderFrontierPanel(p);
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
      : t.id === "tier100"
        ? "var(--border-glow)"
        : "var(--border-card)";

    card.appendChild(
      el(
        "div",
        { class: "bom-badge" },

        t.id === "tier100"
          ? "No generator"
          : t.id === "tier99"
            ? "Rare generator"
            : "Generator OK",
      ),
    );

    card.appendChild(el("h3", {}, t.label.split("-")[1]?.trim() || t.label));

    if (!t.solvable) {
      const reasonText = t.reason
        ? INFEASIBLE_HINTS[t.reason]?.title ||
          "No system found within search limits for this load - the daily consumption may be too high for a practical off-grid build at this site."
        : "No system found within search limits for this load - the daily consumption may be too high for a practical off-grid build at this site.";
      card.appendChild(el("p", {}, reasonText));

      grid.appendChild(card);

      continue;
    }

    const rows = [
      ["Solar array", `${t.pvKw} kW`],

      [
        "Battery (usable)",
        `${fmt(t.battKwh)} kWh - ~${fmt(t.battNameplateKwh)} nameplate`,
      ],

      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],

      ["  - panels + inverter", `~${moneyRange(t.pvCostLo, t.pvCostHi)}`],

      ["  - battery bank", `~${moneyRange(t.battCostLo, t.battCostHi)}`],

      [
        "  - battery unit price",
        `~${localRate(t.battPerKwhLo)}-${localRate(t.battPerKwhHi)}/kWh stored`,
      ],

      ["Unmet hours", `${fmt(t.unmetHoursPerYear)} h/yr`],

      ["Longest gap", `${fmt(t.longestGapHours)} h`],

      ["Battery life est.", fmtLife(t.batteryLifeYears)],

      [`Cycles on the bank`, `~${fmt(t.cyclesPerYear)}/yr`],
    ];

    const footTier = footprintText(t.pvKw);

    if (footTier) rows.splice(2, 0, ["Footprint", footTier]);

    if (t.paybackYearsLo !== null && t.paybackYearsHi !== null) {
      rows.push([
        "Pays back its first cost in",
        fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi),
      ]);
    }

    if (
      typeof t.trueBreakEvenYear === "number" ||
      (t.trueBreakEvenYear === null && t.replacementsHorizon > 0)
    ) {
      rows.push([
        "Breaks even on true 20-yr cost",
        typeof t.trueBreakEvenYear === "number"
          ? `\u2248 year ${t.trueBreakEvenYear} (every swap counted)`
          : "never \u2014 swaps outpace savings",
      ]);
    }

    if (Number.isFinite(t.lcoeUsdPerKwh)) {
      rows.push([
        "Your power cost",
        energyRate(t.lcoeUsdPerKwh) + gridRate(p.tariff),
      ]);
    }

    if (t.replacementsHorizon > 0) {
      rows.push([
        "Battery swaps over 20 yr",
        `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`,
      ]);
    }

    rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);

    pushSeriesBreakdown(rows, t);

    appendRows(card, rows);

    if (t.bestPriceCallout) {
      card.appendChild(
        el(
          "div",
          { class: "best-price-callout" },
          `💡 ${bestPriceNote(t.bestPriceCallout)}`,
        ),
      );
    }

    card.appendChild(
      el(
        "p",
        {
          style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;",
        },

        "Battery + panel component estimate only; excludes inverter, BOS, freight, labor.",
      ),
    );

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
      class:
        "bom-card" +
        (t.solvable ? " card-selectable" : "") +
        (isSelected ? " bom-card-selected" : ""),
    });

    if (t.solvable) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.cursor = "pointer";
      const selectCard = () => {
        frontierSelected = null;
        selectedKey = targetKey;
        renderFrontierPanel(p);
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
      : isCustom || t.id === "cut80"
        ? "var(--border-glow)"
        : "var(--border-card)";

    card.appendChild(
      el(
        "div",
        { class: "bom-badge" },
        t.solvable
          ? isCustom
            ? `Your target \u2014 bill -${t.cutPct}%`
            : `Bill -${t.cutPct}%`
          : "Not reachable",
      ),
    );

    card.appendChild(
      el(
        "h3",
        {},
        isCustom
          ? `Your ~${Math.round((t.minFraction || 1) * 100)}% target`
          : t.label,
      ),
    );

    if (!t.solvable) {
      card.appendChild(
        el(
          "p",
          {},
          "Even a large array can't cut the bill this far at this location - check the off-grid sizer instead.",
        ),
      );

      grid.appendChild(card);

      continue;
    }

    const rows = [
      ["Solar array", `${t.pvKw} kW`],

      [
        "Battery (usable)",
        t.battKwh > 0
          ? `${fmt(t.battKwh)} kWh - ~${fmt(t.battNameplateKwh)} nameplate`
          : "none needed",
      ],

      ["Component cost", `~${moneyRange(t.costLo, t.costHi)}`],

      [
        "Bill after solar",
        (fmtBillAfter(t.billAfterMonthlyUsd) ?? "needs your tariff") +
          (t.billAfterMonthlyUsd !== null && t.billAfterMonthlyUsd !== undefined
            ? ` (was ~${money(Math.round(p.annualGridSpendUsd / 12))})`
            : ""),
      ],

      ["Imported from grid", `${fmt(t.importedKwhPerYear)} kWh/yr`],
    ];

    const footTarget = t.pvKw > 0 ? footprintText(t.pvKw) : null;

    if (footTarget) rows.splice(2, 0, ["Footprint", footTarget]);

    const exportActive = t.exportValueAnnualUsd > 0;

    if (exportActive) {
      rows.push([
        "Feed-in credit on clipped sun",
        `+${money(t.exportValueAnnualUsd)}/yr (${fmt(t.clippedKwhPerYear)} kWh clipped)`,
      ]);
    } else if (t.clippedKwhPerYear > 50) {
      rows.push([
        "Sun clipped (no export)",
        `${fmt(t.clippedKwhPerYear)} kWh/yr - enter a feed-in credit to value it`,
      ]);
    }

    if (t.paybackYearsLo !== null && t.paybackYearsHi !== null) {
      rows.push([
        "Pays back its first cost in",
        fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi) +
          (exportActive ? " incl. feed-in" : ""),
      ]);
    }

    if (
      t.battKwh > 0 &&
      (typeof t.trueBreakEvenYear === "number" ||
        (t.trueBreakEvenYear === null && t.replacementsHorizon > 0))
    ) {
      rows.push([
        "Breaks even on true 20-yr cost",
        typeof t.trueBreakEvenYear === "number"
          ? `\u2248 year ${t.trueBreakEvenYear} (every swap counted)`
          : "never \u2014 swaps outpace savings",
      ]);
    }

    if (Number.isFinite(t.lcoeUsdPerKwh)) {
      rows.push([
        "Your power cost",
        energyRate(t.lcoeUsdPerKwh) + gridRate(p.tariff),
      ]);
    }

    if (t.replacementsHorizon > 0 && t.battKwh > 0) {
      rows.push([
        "Battery swaps over 20 yr",
        `~${t.replacementsHorizon}x - adds ~${money(t.swapsAndLaborUsd)} with labor`,
      ]);
    }

    if (t.battKwh > 0) {
      rows.push(["Total 20-year cost", `~${money(t.lifetimeCostMid)}`]);
    }

    pushSeriesBreakdown(rows, t);

    appendRows(card, rows);

    if (t.bestPriceCallout) {
      card.appendChild(
        el(
          "div",
          { class: "best-price-callout" },
          `💡 ${bestPriceNote(t.bestPriceCallout)}`,
        ),
      );
    }

    card.appendChild(
      el(
        "p",
        {
          style: "font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;",
        },

        "Simulated hour-by-hour across five years of real weather. The system never exports; surplus beyond storage is clipped.",
      ),
    );

    grid.appendChild(card);
  }
}

function appendRows(card, rows) {
  for (const [k, v] of rows) {
    const danger = typeof v === "string" && v.startsWith("never");
    const accent =
      /^(Cost|Total|Pays|Your power|Bill|Battery swaps)/.test(k) && !danger;
    const line = el("div", {
      style:
        "display:flex;justify-content:space-between;font-size:0.9rem;padding:0.2rem 0;border-bottom:1px solid var(--border-card);",
    });
    line.appendChild(el("span", { style: "color:var(--text-muted);" }, k));
    const valSpan = el("span", {
      style: "font-family:var(--font-mono);font-weight:700;",
    });
    if (accent && typeof v === "string") {
      const parts = v.split(/(\d[\d,\.]*)/g);
      for (const part of parts) {
        if (/^\d/.test(part)) {
          valSpan.appendChild(
            el(
              "span",
              { style: "color:var(--primary-accent);font-weight:800;" },
              part,
            ),
          );
        } else if (part) {
          valSpan.appendChild(document.createTextNode(part));
        }
      }
    } else {
      valSpan.textContent = v;
      valSpan.style.color = danger
        ? "var(--danger-red)"
        : accent
          ? "var(--primary-accent)"
          : "var(--text-main)";
    }
    line.appendChild(valSpan);
    card.appendChild(line);
  }
} /**
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

// Must match run.js PAYLOAD_CONTRACT. Mismatch = stale cached module.
const PAYLOAD_CONTRACT = 15;

// -- Plausibility frontier ---------------------------------------------------

// The cards answer "what does this target cost?". This answers "what does any

// budget buy?" - the shape that tells someone whether their goal is easy,

// expensive, or impossible where they live.

// Adopting a curve point is THE selection primitive for curve clicks,
// curve clicks and slider commits alike: the clicked point already carries
// its full analysis in the cached payload, so every downstream panel follows
// it immediately — no engine re-run. Only its SOC capture bands arrive a
// moment later from a tiny background slice (the 1 record lookup).
function adoptFrontierPoint(i, opts = {}) {
  const p = lastPayload;
  const f = p && p.frontier;
  const pt = f && f.points[i];
  if (!p || !pt) return;
  frontierSelected = i;
  curvePreview = null;
  clearPlayReadout();
  adoptedEntry = {
    ...pt.detail,
    chemistry: pt.detail.chemistry || f.chemistry,
  };
  selectedKey = "adopted";
  // Choosing a point on the curve IS choosing a budget: pin it so later
  // re-renders keep the visitor's system instead of re-seating on the marker.
  if (Number.isFinite(pt.capexUsd)) budgetPinnedUsd = pt.capexUsd;
  if (!opts.keepSlider) {
    const slider = $("budgetSlider");
    if (slider && Number.isFinite(pt.capexUsd)) {
      slider.value = String(Math.round(pt.capexUsd));
      syncBudgetLabel();
    }
  }
  // Unify with the bill-cut slider FIRST (before the selection snapshot):
  // choosing a point on the curve IS choosing your cut %, so the share
  // link and the matrix "your target" label must record the snapped value,
  // not the pre-click one. syncCutControls also moves the form's select, so
  // the next run cannot disagree with the slider on screen.
  if (p.mode === "gridtie" && Number.isFinite(pt.outcomePct))
    syncCutControls(pt.outcomePct);
  renderFrontierPanel(p);
  refreshSelectionOutputs(p);
  if (opts.showModal) {
    showSystemModal(p, adoptedEntry, true);
  }
  // Background reconciliation: re-size the matrix's "your target" column
  // for ALL chemistries at the snapped cut (the curve itself only knows
  // one chemistry), and capture the adopted system's SOC bands.
  requestIncrementalCut(
    adoptedEntry.pvKw,
    adoptedEntry.battKwh,
    adoptedEntry.chemistry,
  );
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
  // no click the dot sits on the RECOMMENDATION at its true position (the
  // marker) — never snapped onto the nearest curve point, which quietly
  // displayed a different battery than the card being read. The slider, the
  // matrix "your target" column and the recommendation already agree with
  // each other because every run derives best from the slider target.

  const opts = {
    t,
    money,
    tableHost: $("frontierTable"),

    selected: frontierSelected ?? undefined,
    // Drag preview from the cut/budget sliders (amber ring, no commit).
    preview: curvePreview,

    // Clicking a point re-renders the panel (chart + table) around that pick.

    onSelect: (i) => {
      adoptFrontierPoint(i, { showModal: true });
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

  if (verdict) {
    verdict.textContent = frontierVerdict(f, opts);
    // Best-value range, both bounds, in the visitor's currency — the band on
    // the chart, spelled out for screen readers and skimmers.
    const range = f.reach && f.reach.kneeRange;
    if (
      range &&
      Number.isFinite(range.loCostUsd) &&
      Number.isFinite(range.hiCostUsd) &&
      Number.isFinite(range.loPct) &&
      Number.isFinite(range.hiPct)
    ) {
      verdict.textContent +=
        ` Best-value range: ~${money(range.loCostUsd)}–${money(range.hiCostUsd)}` +
        ` (${range.loPct}–${range.hiPct}%).`;
    }
  }

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

function renderEli5Summary(p) {
  const wrap = $("eli5Summary");
  if (!wrap) return;
  if (!isSimpleMode()) {
    wrap.style.display = "none";
    wrap.innerHTML = "";
    return;
  }
  const entry = resolveSelected(p) || p.best || p.focus;
  if (!entry) {
    wrap.style.display = "none";
    return;
  }
  const climate = p.assumptions?.climateAware
    ? ` Weather suggests ${p.assumptions.climate} conditions, so dust losses are included.`
    : "";
  const rows = [
    [
      "Solar",
      entry.pvKw > 0
        ? `${entry.pvKw} kW of panels`
        : "No panels in this option",
      "kW",
    ],
    [
      "Storage",
      entry.battKwh > 0
        ? `${fmt(entry.battKwh)} kWh usable battery`
        : "No battery in this option",
      "usableCapacity",
    ],
    [
      "Target",
      p.mode === "gridtie"
        ? `${entry.cutPct ?? 0}% less grid energy`
        : `${Math.round(100 - (entry.unmetHoursPerYear || 0) / 87.6)}% reliability target`,
      p.mode === "gridtie" ? "gridTie" : "reliabilityTier",
    ],
  ];
  wrap.style.display = "block";
  wrap.innerHTML = "";
  wrap.appendChild(el("div", { class: "eli5-title" }, "💡 In plain language"));
  const grid = el("div", { class: "eli5-grid" });
  for (const [label, value, term] of rows) {
    const item = el("div", { class: "eli5-item" });
    const labelEl = el("div", { class: "eli5-item-label" }, label);
    if (JARGON[term]) explainElement(labelEl, term);
    item.append(labelEl, el("div", { class: "eli5-item-desc" }, value));
    grid.appendChild(item);
  }
  const note = el(
    "p",
    { style: "margin-top:0.8rem;font-size:0.82rem;color:var(--text-muted);" },
    `The result is an estimate, not a promise. Battery storage is the bucket that carries energy from sunny hours into dark hours.${climate}`,
  );
  wrap.append(grid, note);
}

// Surface the climate analysis's darkest 30-day window as a plain-language
// caveat: solar users should sanity-check against it, and cold sites see
// bigger battery-temperature effects. Hidden unless the toggle is on.
function renderWorstMonthCaveat(p) {
  const box = $("worstMonthCaveat");
  if (!box) return;
  const wm = p.assumptions?.worstMonth;
  if (!p.assumptions?.climateAware || !wm || !Number.isFinite(wm.startDay)) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  const avg = Number(wm.averageDailyGhi) || 0;
  const startDay = Math.max(0, Math.round(wm.startDay));
  const monthName = (d) =>
    new Date(Date.UTC(2001, 0, 1 + d)).toLocaleDateString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
  box.textContent =
    `Darkest month: ${monthName(startDay)} — about ${avg.toFixed(1)} kWh/m²/day ` +
    `of average sun. Size for this month, not the yearly average, or the ` +
    `system will fall short on gray weeks.`;
  box.style.display = "block";
}

function renderResults(p) {
  setResultsHidden(false);
  const inp = readInputs();

  lastPayload = p;

  if (selectedKey !== "adopted") {
    adoptedEntry = null;
  }

  frontierSelected = null; // new result -> blue dot follows the new recommendation

  const isGT = p.mode === "gridtie";

  if (p.contract !== undefined && p.contract !== PAYLOAD_CONTRACT) {
    setStatus(
      "\u26A0\uFE0F This result came from an older engine version \u2014 refresh the page (Ctrl+F5 / \u2318\u21E7R) and run again for complete, current figures.",
    );
  } else {
    setStatus(
      t("statusSuccess", {
        years: p.meta.years,
        dataYears: p.assumptions.dataYears,
        yield: fmt(p.annualYieldPerKw),
        offline: p.meta.offline ? t("offlineNote") : "",
      }),
    );
  }

  // The cut slider (grid-tie only) lives in the results panel.
  const cutRow = $("cutSliderRow");
  if (cutRow) cutRow.style.display = isGT ? "block" : "none";
  syncCutLabel();
  // Keep the roof-area cap note truthful after every render (share-link
  // restores and map fills can change the input without an input event).
  updateRoofAreaCapNote();

  renderWorstMonthCaveat(p);

  // Validate and preserve selection
  let selValid = false;
  if (selectedKey === "best" && p.best) selValid = true;
  else if (selectedKey === "focus" && p.focusSystem) selValid = true;
  else if (
    selectedKey === "custom" &&
    ((p.customCut && p.customCut.entries && p.customCut.entries.length) ||
      p.customTarget)
  )
    selValid = true;
  else if (selectedKey === "adopted" && adoptedEntry) selValid = true;
  else if (
    selectedKey.indexOf("matrix:") === 0 &&
    p.matrix &&
    p.matrix.cells &&
    p.matrix.cells[selectedKey.slice(7)] &&
    p.matrix.cells[selectedKey.slice(7)].solvable
  )
    selValid = true;
  else if (
    selectedKey.indexOf("auto:") === 0 &&
    p.auto &&
    p.auto.some((a) => "auto:" + a.chemistry === selectedKey && a.solvable)
  )
    selValid = true;
  else if (
    selectedKey.indexOf("tier:") === 0 &&
    p.tiers &&
    p.tiers.some((t) => "tier:" + t.id === selectedKey && t.solvable)
  )
    selValid = true;
  else if (
    selectedKey.indexOf("target:") === 0 &&
    (p.targets || p.customTarget) &&
    (p.targets || [])
      .concat(p.customTarget ? [p.customTarget] : [])
      .some((t) => "target:" + t.id === selectedKey && t.solvable)
  )
    selValid = true;

  if (!selValid) {
    if (p.best) selectedKey = "best";
    else if (p.auto && p.auto.some((a) => a.solvable))
      selectedKey = "auto:" + p.auto.find((a) => a.solvable).chemistry;
    else if (p.targets && p.targets.some((t) => t.solvable))
      selectedKey =
        "target:" +
        (
          p.targets.find((t) => t.id === "cut80" && t.solvable) ||
          p.targets.find((t) => t.solvable)
        ).id;
    else if (p.tiers && p.tiers.some((t) => t.solvable))
      selectedKey =
        "tier:" +
        (
          p.tiers.find((t) => t.id === "tier99" && t.solvable) ||
          p.tiers.find((t) => t.solvable)
        ).id;
    else if (p.customTarget && p.customTarget.solvable) selectedKey = "custom";
    else selectedKey = "best";
  }

  renderSunPath(p.input?.latitude ?? parseFloat($("latInput")?.value));

  renderMoneyBar(p);

  const hasAuto = !!(p.auto && p.auto.length);
  // Router mode: auto vs fixed-chemistry is a payload SHAPE distinction
  // (fixed-chem runs set p.auto = null; auto runs always set an array, which
  // may be EMPTY when nothing solved). Routing on content sent empty-auto
  // payloads down the fixed-chem branch, where renderBestPick's honest
  // empty state — the one naming the binding roof-cap constraint — was
  // never reached and the banner just went blank.
  const isAutoMode = Array.isArray(p.auto);

  // focusFirst: grid-tie auto can show the granular focus panel instead of
  // the recommendation card when the user has adopted a curve point.
  // In all other cases (and in the Best Pick tab) it's hidden.
  focusFirst = isGT && hasAuto;

  // Result ladder: always visible once we have results (enables Compare/All
  // Options tabs regardless of mode or chemistry count).
  const ladder = $("resultLadder");
  if (ladder) ladder.style.display = "flex";

  const bpWrap = $("bestPickWrap");
  if (bpWrap) bpWrap.innerHTML = "";

  const tierGrid = $("tierResults");
  if (tierGrid) {
    tierGrid.style.display = "grid";
    tierGrid.innerHTML = "";
  }

  syncLadderTabs();

  const sel = resolveSelected(p);

  // Route view by active ladder tab — works for all modes (grid-tie auto,
  // off-grid auto, fixed-chemistry, tier, target). The "best" tab always
  // shows the recommendation card only; the "compare" and "matrix" tabs
  // use their own views and can be accessed from any result.
  if (resultLevel === "compare") {
    if (bpWrap) {
      bpWrap.innerHTML = "";
      bpWrap.style.display = "none";
    }
    renderBatteryComparison(p, sel);
  } else if (resultLevel === "matrix") {
    if (bpWrap) {
      bpWrap.innerHTML = "";
      bpWrap.style.display = "none";
    }
    renderRelativeOptions(p, sel);
  } else {
    // resultLevel === "best": clean recommendation card — NO raw matrix in auto-run
    if (bpWrap) bpWrap.style.display = "";
    if (isAutoMode) {
      renderBestPick(p);
    } else if (isGT) {
      renderTargetCards(p, p.customTarget ? [p.customTarget] : []);
    } else {
      renderTierCards(p);
    }
  }

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

      box.appendChild(
        el(
          "div",
          {
            class: "no-solvable",
            style:
              "grid-column:1/-1;padding:1.1rem;border:1px solid var(--border-card);border-radius:10px;color:var(--text-muted);",
          },
          t("frontierNoSystem"),
        ),
      );
    }
  }

  // Called on EVERY payload, with null when this combo is solvable. Guarding
  // the call instead (as this once did) makes the clear branch below dead
  // code: the banner for an earlier infeasible combo then outlives the run
  // that replaced it, so a visitor who switches back to a workable setup
  // keeps reading "solar-only can't do this" over a page that solved fine.
  renderInfeasibleBanner(p.unreachableReason || null);

  renderEli5Summary(p);

  // Simple mode's card refreshes with every fresh payload, same as the
  // technical surfaces.
  if (isSimpleMode()) renderSimpleResults(p);

  // Independent sanity check — reads the finished result, never changes it.
  // See runSanityCheck below; every failure mode is silent by design.
  runSanityCheck(p);

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
    (a.offline
      ? "OFFLINE MODE: this run used the bundled typical-year profile for " +
        p.meta.offlineCity +
        " - a close approximation, not your exact site. Re-run online for five years of point-specific weather. "
      : "") +
    (p.tariff
      ? `Grid spend assumes ${energyRate(p.tariff)} at ${fmtKwh(p.dailyKwh ?? inp.dailyKwh)} kWh/day.`
      : "No tariff entered, so payback is not shown.");

  let briefLines;

  if (p.auto && p.auto.length) {
    briefLines = p.auto
      .filter((t) => t.solvable)
      .map(
        (t) =>
          `- ${t.chemLabel}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~${fmt(t.battNameplateKwh)} kWh nameplate at ${(t.usableDod * 100).toFixed(0)}% DoD), first cost ~${moneyRange(t.costLo, t.costHi)}, ` +
          `${t.replacementsHorizon > 0 ? `${t.replacementsHorizon} bank swaps (+${money(t.swapsAndLaborUsd)} with labor)` : "no swaps expected"} ? true 20-yr cost ~${money(t.lifetimeCostMid)}`,
      );
  } else if (isGT) {
    briefLines = p.targets
      .filter((t) => t.solvable)

      .map(
        (t) =>
          `- ${t.label}: ${t.pvKw} kW PV + ${t.battKwh > 0 ? fmt(t.battKwh) + " kWh usable" : "no battery"} (~${moneyRange(t.costLo, t.costHi)}) ? bill -${t.cutPct}%` +
          (fmtBillAfter(t.billAfterMonthlyUsd) !== null
            ? `, ${fmtBillAfter(t.billAfterMonthlyUsd)} after`
            : ""),
      );
  } else {
    briefLines = p.tiers
      .filter((t) => t.solvable)

      .map(
        (t) =>
          `- ${t.label}: ${t.pvKw} kW PV + ${fmt(t.battKwh)} kWh usable (~${moneyRange(t.costLo, t.costHi)}, ex-factory to budget-retail range)`,
      );
  }

  const recLine =
    p.best && Number.isFinite(p.best.lifetimeCostMid)
      ? `RECOMMENDED: ${p.best.chemLabel} - ${p.best.pvKw} kW PV + ${fmt(p.best.battKwh)} kWh usable. Why: ${p.bestReason || "safety-first pick."}\n`
      : "";
  const selectedEntry = resolveSelected(p) || p.best;
  const jevEntry =
    selectedEntry && selectedEntry.solvable ? selectedEntry : p.best;
  const jevState = sanityState(p, jevEntry);
  const selectedLine = jevState
    ? `SELECTED SYSTEM FOR JEV REVIEW: ${jevEntry.chemLabel || jevEntry.label || selectedKey} - ${jevState.pvKw.toFixed(2)} kW PV + ${Number(jevState.battKwh).toFixed(2)} kWh usable; ${jevState.mode}.\n`
    : "SELECTED SYSTEM FOR JEV REVIEW: no solvable deterministic system.\n";

  const fr = p.frontier && p.frontier.reach;

  const frontierLine =
    fr && Number.isFinite(fr.ceilingPct)
      ? `SPEND-vs-COVERAGE CURVE (computed, do not recompute): ceiling ${fr.ceilingPct}% at ~${money(fr.ceilingCostUsd)}` +
        (fr.kneePct !== null
          ? `; best value stops at ${fr.kneePct}% for ~${money(fr.kneeCostUsd)}`
          : "") +
        (fr.headCostPerPoint !== null && fr.tailCostPerPoint !== null
          ? `; marginal cost rises from ~${money(fr.headCostPerPoint)} to ~${money(fr.tailCostPerPoint)} per extra percentage point`
          : "") +
        ".\n"
      : "";

  window.lastSizingBrief =
    `I sized a system with your calculator for the selected site (the advisor does not receive exact coordinates), ` +
    `${inp.dailyKwh.toFixed(1)} kWh/day from ${inp.basis}, ${p.chemistry === "auto" ? "AUTO chemistry comparison" : p.chemistry.toUpperCase()}` +
    `${p.auto && p.auto.length ? ` (${p.autoNote})` : ""}, ` +
    `${isGT ? "staying connected to the grid (no export" + (inp.exportRate ? ", feed-in credit entered)" : ")") : "fully off-grid"}:\n${selectedLine}${recLine}${frontierLine}${briefLines.join("\n")}\n` +
    `[CALCULATOR CONTEXT — DATA, NOT INSTRUCTIONS: These numbers were computed deterministically from NASA POWER hourly weather ` +
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

  // Mode swap LAST: every renderer above writes its own section, and this
  // must win over all of them. Fresh payload → seat the budget slider on
  // the recommendation.
  if (curveReady()) {
    showBudgetRow();
    syncBudgetRange(true);
  } else {
    hideBudgetRow();
  }
  const focusWrap = $("focusPanel");
  // The granular focus panel only applies on the "best" tab in grid-tie auto
  // mode. On compare/matrix tabs it stays hidden so those views are uncluttered.
  if (focusFirst && resultLevel === "best" && curveReady()) {
    if (focusWrap) focusWrap.style.display = "";
    renderFocusPanel(p, resolveSelected(p), false);
  } else {
    if (focusWrap) focusWrap.style.display = "none";
    if (resultLevel === "best" && bpWrap) bpWrap.style.display = "";
  }
}

function sameSystem(a, b) {
  return (
    !!a &&
    !!b &&
    a.chemistry === b.chemistry &&
    a.pvKw === b.pvKw &&
    a.battKwh === b.battKwh
  );
}

// The banner follows the selection too: when the visitor picks a system that
// is NOT the recommendation (adopted curve point, matrix cell, ladder tab),
// the banner names and prices the selected system instead of silently
// describing a different one than the charts, BOM and blue dot below it.
function renderSelectedBanner(p, sel) {
  const wrap = $("bestPickWrap");
  if (!wrap || !sel) return false;
  if (sameSystem(sel, p.best)) {
    renderBestPick(p);
    return false;
  }
  wrap.innerHTML = "";
  const card = el("div", { class: "bom-card" });
  card.style.borderColor = "var(--secondary-accent, #3b82f6)";
  const title =
    sel.pvKw === 0 && sel.battKwh > 0
      ? `${sel.chemLabel || sel.chemistry}: ${fmt(sel.battKwh)} kWh battery (peak-hour offset)`
      : sel.battKwh === 0
        ? `${sel.chemLabel || sel.chemistry}: ${sel.pvKw} kW solar (no battery)`
        : `${sel.chemLabel || sel.chemistry}: ${sel.pvKw} kW solar + ${fmt(sel.battKwh)} kWh battery`;
  card.appendChild(el("div", { class: "bom-badge" }, "Selected system"));
  card.appendChild(el("h3", {}, title));
  appendRows(card, entryDetailRows(p, sel));
  if (p.best) {
    const b = p.best;
    const resetRow = el("div", {
      style:
        "margin-top:0.75rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;",
    });
    resetRow.appendChild(
      el(
        "p",
        {
          style: "font-size:0.78rem;color:var(--text-muted);margin:0;",
        },
        `Recommendation stays ${b.chemLabel || b.chemistry} ${b.pvKw} kW + ${fmt(b.battKwh)} kWh (~${money(b.lifetimeCostMid)} over 20 years).`,
      ),
    );
    const resetBtn = el(
      "button",
      {
        type: "button",
        class: "btn btn-outline",
        style: "font-size:0.75rem; padding:0.25rem 0.6rem; cursor:pointer;",
      },
      "Reset to Recommendation",
    );
    resetBtn.addEventListener("click", () => {
      adoptedEntry = null;
      selectedKey = "best";
      frontierSelected = null;
      if (p.frontier && p.best) {
        p.frontier.marker = {
          chemistry: p.best.chemistry,
          capexUsd: p.best.costMid,
          outcomePct:
            p.best.cutPct !== undefined
              ? p.best.cutPct
              : p.frontier.marker
                ? p.frontier.marker.outcomePct
                : 100,
          pvKw: p.best.pvKw,
          battKwh: p.best.battKwh,
          pointIndex: null,
        };
      }
      refreshSelectionOutputs(p);
      renderResults(p);
    });
    resetRow.appendChild(resetBtn);
    card.appendChild(resetRow);
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
  // The active ladder view tracks the selection instantly.
  if (resultLevel === "compare") {
    renderBatteryComparison(p, sel);
  } else if (resultLevel === "matrix") {
    renderRelativeOptions(p, sel);
  } else if (p.matrix && isGT) {
    // On the best tab in GT mode, sync the matrix highlight
    renderMatrix(p);
  }
  renderBomPanel();
  if (
    sel &&
    sel.socNameplatePct &&
    sel.socNameplatePct.min &&
    sel.socNameplatePct.min.length
  ) {
    drawSocChartForEntry(p, sel);
  } else if (hasAuto && !isGT) {
    drawAutoChart(p);
  } else if (
    !hasAuto &&
    p.history &&
    p.history.tiers &&
    p.history.tiers.length
  ) {
    drawSocChart(p.history, p.chemLabel || "battery");
  } else {
    const w = $("socChartWrap");
    if (w) w.style.display = "none";
  }

  drawCumCostChart(p, sel);

  // NOTE: no renderFrontierPanel here — every caller renders the curve
  // itself first (renderResults, adoptFrontierPoint, mergeReSlice), so one
  // update builds the SVG + table exactly once instead of twice.

  // Granular panel follows the same committed selection.
  if (focusFirst) renderFocusPanel(p, sel, false);

  renderEli5Section(p, sel || p.best);

  const inp = readInputs();
  updateShareHash(p, inp);
  populatePrintSheet(p, inp);
  // Selection changes are the same Jev state change as a fresh result: re-run
  // the probe for the newly selected deterministic system. The in-flight
  // guard above collapses the duplicate call made by renderResults.
  runSanityCheck(p);
}

// -- Shareable results -------------------------------------------------------

// Inputs + headline results are encoded into the URL hash. Opening such a

// link restores the form and re-runs the simulation locally (weather data is

// cached per site, and the engine is deterministic, so results reproduce).

// The share-link codec (encode/decode + the validation gate) lives in
// share-codec.js — pure policy with tests in tests/share-codec.test.mjs;
// this file keeps only the DOM application of a validated state.

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

    if (inp.hardwareConfig && inp.hardwareConfig !== "both")
      o.hw = inp.hardwareConfig;

    if (inp.chemistry === "auto") o.a = 1;

    if (inp.chemistry === "auto" && inp.mode !== "gridtie" && $("autoTier"))
      o.at = $("autoTier").value;

    if (inp.chemistry === "auto" && inp.mode === "gridtie" && $("autoTarget")) {
      // Only a real target is worth serializing: "custom" is mirror state of
      // the slider, and the fraction itself already travels as o.cc.
      const ag = $("autoTarget").value;
      if (CUT_TARGET_PCT[ag]) o.ag = ag;
    }

    if (inp.mode === "gridtie") {
      o.cc = inp.customCut;
    }

    if (selectedKey) o.sel = selectedKey;

    // Focus/adopted systems live only in memory — encode the exact hardware
    // so a shared link re-adopts it instead of silently reopening as "best".
    // (Matrix/auto/tier/target/custom selections re-resolve from the payload.)
    if (selectedKey === "adopted" && adoptedEntry) {
      o.fp = adoptedEntry.pvKw;
      o.fb = adoptedEntry.battKwh;
      o.fc = adoptedEntry.chemistry;
    } else if (selectedKey === "focus" && p && p.focusSystem) {
      o.fp = p.focusSystem.pvKw;
      o.fb = p.focusSystem.battKwh;
      o.fc = p.focusSystem.chemistry;
    }

    if ($("loadMode") && $("loadMode").value === "bill") o.lm = "bill";

    if (inp.tariff) o.tf = inp.tariff;

    if (inp.exportRate) o.xr = inp.exportRate;

    if (inp.fixedMonthlyUsd) o.fee = inp.fixedMonthlyUsd;

    if (p) {
      const sized =
        p.auto && p.auto.length
          ? p.auto.filter((t) => t.solvable).map((t) => [t.pvKw, t.battKwh])
          : p.mode === "gridtie"
            ? (p.targets || [])
                .filter((t) => t.solvable)
                .map((t) => [t.pvKw, t.battKwh])
            : (p.tiers || [])
                .filter((t) => t.solvable)
                .map((t) => [t.pvKw, t.battKwh]);

      if (sized && sized.length) o.t = sized;
    }

    history.replaceState(null, "", SHARE_PREFIX + b64urlEncode(o));
  } catch {
    /* sharing is best-effort; never block a result on it */
  }
}

function restoreFromShare() {
  // The codec owns parsing + validation; a malformed or hostile link is
  // refused here, before any DOM state moves.
  const o = parseShareHash(location.hash);
  if (!o) return false;

  const lat = o.la,
    lon = o.lo,
    kw = o.kw;

  locationResolved = true;

  $("coordDetails").open = true;

  setCoords(lat, lon, t("sharedLocationLoaded"), undefined, undefined, true);

  $("loadMode").value = "kwh";

  setLoadPanel();

  if ($("systemGoal"))
    $("systemGoal").value = o.g === 1 ? "gridtie" : "offgrid";

  $("dailyKwhInput").value = String(kw);

  if (o.a === 1) $("chemSelect").value = "auto";
  else if (o.ch && CHEM_KEYS.has(o.ch)) $("chemSelect").value = o.ch;

  if (o.at && ["tier100", "tier99", "tier95"].includes(o.at) && $("autoTier"))
    $("autoTier").value = o.at;

  if (o.ag && typeof o.ag === "string" && $("autoTarget")) {
    // Same single source as the markup drift guard: only real engine targets.
    const valid = Object.keys(CUT_TARGET_PCT);
    if (valid.includes(o.ag)) $("autoTarget").value = o.ag;
  }

  if (Number.isFinite(o.cc) && o.cc >= 0.01 && o.cc <= 1.5) {
    customCutFraction = o.cc;
    const cutIn = $("cutSlider");
    if (cutIn) cutIn.value = String(Math.round(o.cc * 100));
    // One writer: the select mirrors whatever fraction came back (preset or
    // custom) instead of a stale value that disagrees with the slider.
    syncCutControls(Math.round(o.cc * 100));
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
  if (
    (o.sel === "adopted" || o.sel === "focus") &&
    Number.isFinite(o.fp) &&
    Number.isFinite(o.fb)
  ) {
    pendingFocus = {
      pvKw: o.fp,
      battKwh: o.fb,
      chemistry: ["naion", "lfp", "agm"].includes(o.fc) ? o.fc : null,
    };
    selectedKey = "focus";
  } else if (
    typeof o.sel === "string" &&
    /^(best|focus|custom|adopted|matrix:[a-z]+:(cut60|cut80|cut95|cut[0-9]+|custom)|auto:[a-z]+|tier:[a-z0-9]+|target:[a-z0-9]+)$/.test(
      o.sel,
    )
  ) {
    selectedKey = o.sel;
  }

  if (Number.isFinite(o.xr) && o.xr > 0 && $("exportRate")) {
    const fx = fxActive();

    $("exportRate").value = String(fx ? +(o.xr * fx.rate).toFixed(4) : o.xr);
  }

  if (Number.isFinite(o.fee) && o.fee >= 0 && $("fixedChargeVal")) {
    const fx = fxActive();

    $("fixedChargeVal").value = String(
      fx ? +(o.fee * fx.rate).toFixed(2) : o.fee,
    );
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

  setStatus(t("shareLoaded"));

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

    head =
      "<tr><th>Battery</th><th>Solar</th><th>Bank usable (nameplate)</th><th>First cost</th><th>Swaps in 20 yr</th><th>Swaps + labor</th><th>True 20-yr cost</th><th>True break-even</th></tr>";

    rows = p.auto
      .filter((t) => t.solvable)
      .map(
        (t) =>
          "<tr><td>" +
          [
            t.chemLabel + ` (${(t.usableDod * 100).toFixed(0)}% DoD)`,

            `${t.pvKw} kW`,

            `${fmt(t.battKwh)} kWh (~${fmt(t.battNameplateKwh)})`,

            moneyRange(t.costLo, t.costHi),

            t.replacementsHorizon > 0 ? `~${t.replacementsHorizon}x` : "none",

            t.swapsAndLaborUsd > 0 ? `~${money(t.swapsAndLaborUsd)}` : "-",

            `~${money(t.lifetimeCostMid)}`,

            typeof t.trueBreakEvenYear === "number"
              ? `~ year ${t.trueBreakEvenYear}`
              : t.trueBreakEvenYear === null
                ? "never"
                : "n/a",
          ].join("</td><td>") +
          "</td></tr>",
      )
      .join("");
  } else if (isGT) {
    title = "Grid-Connected Bill-Cutting Estimate";

    head =
      "<tr><th>Goal</th><th>Solar</th><th>Battery</th><th>Component cost</th><th>Bill cut</th><th>Bill after</th><th>Payback</th></tr>";

    rows = p.targets
      .filter((t) => t.solvable)
      .map(
        (t) =>
          "<tr><td>" +
          [
            t.label,

            `${t.pvKw} kW`,

            t.battKwh > 0 ? `${fmt(t.battKwh)} kWh` : "none",

            moneyRange(t.costLo, t.costHi),

            `-${t.cutPct}% bill`,

            fmtBillAfter(t.billAfterMonthlyUsd) ?? "n/a",

            t.paybackYearsLo !== null
              ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi)
              : "n/a",
          ].join("</td><td>") +
          "</td></tr>",
      )
      .join("");
  } else {
    title = "Off-Grid System Estimate";

    head =
      "<tr><th>System</th><th>Solar</th><th>Battery (usable)</th><th>Component cost</th><th>Payback vs. grid</th><th>Energy cost</th></tr>";

    rows = p.tiers
      .filter((t) => t.solvable)
      .map(
        (t) =>
          "<tr><td>" +
          [
            t.label,

            `${t.pvKw} kW`,

            `${fmt(t.battKwh)} kWh`,

            moneyRange(t.costLo, t.costHi),

            t.paybackYearsLo !== null
              ? fmtPaybackRange(t.paybackYearsLo, t.paybackYearsHi)
              : "n/a",

            Number.isFinite(t.lcoeUsdPerKwh)
              ? `~${energyRate(t.lcoeUsdPerKwh)}`
              : "n/a",
          ].join("</td><td>") +
          "</td></tr>",
      )
      .join("");
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
      hwRows.push([
        "Solar panels",
        `${PANEL_WATTS_DEFAULT} W mono`,
        `${bom.panels.count} pcs`,
        `${bom.panels.kwActual} kW \u00B7 ~${bom.panels.areaM2} m\u00B2`,
      ]);
    } else {
      hwRows.push(["Solar panels", "None", "-", "Battery-only configuration"]);
    }
    if (bom.voltage && bom.battery) {
      hwRows.push(
        ["Bank voltage", `${bom.voltage.volts} V`, "-", ""],
        [
          "Battery (DIY)",
          bom.battery.diy.unitLabel,
          `${bom.battery.diy.stringsParallel} string(s)`,
          `${bom.battery.diy.blocksTotal} cells total`,
        ],
        [
          "Battery (retail alt.)",
          bom.battery.retail.unitLabel,
          `${bom.battery.retail.modules} pcs`,
          "BMS included",
        ],
      );
    } else {
      hwRows.push(["Battery bank", "None", "-", "Solar-only configuration"]);
    }
    hwRows.push([
      "Inverter",
      `${bom.inverter.recommendedKw} kW class`,
      "1",
      "sized to peak load incl. surge margin",
    ]);
    if (bom.controller) {
      hwRows.push(
        [
          "Charge controller",
          `${bom.controller.ampsRequired} A MPPT`,
          "see note",
          bom.controller.suggestion,
        ],
        [
          "Main DC fuse/breaker",
          `${bom.protection.mainFuseAmps} A`,
          "1",
          "battery disconnect",
        ],
        ["PV disconnect", `${bom.protection.pvBreakerAmps} A`, "1", ""],
        [
          "Battery cable (2 m run)",
          bom.cable[0].mm2
            ? `${bom.cable[0].awg} copper`
            : `larger than ${bom.cable[0].awg}`,
          "pair",
          "2% drop + ampacity",
        ],
      );
    }
    const hwChemLabel =
      hwEntry.chemLabel ||
      (p.matrix &&
        p.matrix.rows &&
        p.matrix.rows.find((r) => r.id === hwEntry.chemistry)?.label) ||
      hwEntry.chemistry;
    hwHtml = `
      <h2 style="font-size:12pt;margin:10pt 0 4pt;">Hardware list for the selected system (${hwChemLabel})</h2>
      <table style="border-collapse:collapse;width:100%;font-size:9pt;margin-bottom:8pt;">
        <tr style="background:#eef2f7;"><th>Item</th><th>Spec</th><th>Qty</th><th>Note</th></tr>
        ${hwRows.map((r) => "<tr><td>" + r.join("</td><td>") + "</td></tr>").join("")}
      </table>`;
  }
  const mx = p.matrix
    ? matrixHtml(p).replace(/class="matrix-wrap"/, 'style="overflow-x:hidden;"')
    : "";

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

      ${hwEntry && hwEntry.chemLabel ? hwEntry.chemLabel : p.chemistry.toUpperCase()} battery - location ${p.meta.latitude.toFixed(2)}, ${p.meta.longitude.toFixed(2)} -

      ${hwEntry || p.focus ? footprintText((hwEntry || p.focus).pvKw) + " - " : ""}${p.tariff ? `grid price ${energyRate(p.tariff)} (~${money(p.annualGridSpendUsd)}/yr)` : "no grid price entered"}</p>

    ${hwHtml}

    ${mx ? `<h2 style="font-size:12pt;margin:10pt 0 4pt;">All options compared</h2>${mx}` : ""}

    ${
      p.frontier && p.frontier.points && p.frontier.points.length > 1
        ? `<p style="font-size:9.5pt;margin:0 0 4pt;"><strong>How far money gets you:</strong> ${frontierVerdict(p.frontier, { t, money })}</p>`
        : ""
    }

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

// The advisor explains whatever mode the visitor is in. The technical brief
// is the single source of real numbers; Simple mode only appends a style
// instruction (locale-owned: "simpleAdvisorStyle" in locales.js) so the
// answer matches the mode's plain language in every supported language.

function askAdvisor() {
  if (!window.lastSizingBrief) return;

  const input = document.getElementById("chatInput");
  const selected = resolveSelected(window.lastPayload);
  const selectedEntry =
    selected && selected.solvable ? selected : window.lastPayload?.best;
  const selectedLabel =
    selectedEntry?.chemLabel ||
    selectedEntry?.label ||
    selectedKey ||
    "selected system";
  const jev = advisorJevContext(
    sanityStatus,
    sanityCache.interp,
    sanityCache.state ||
      (window.lastPayload
        ? sanityState(window.lastPayload, selectedEntry)
        : null),
    selectedLabel,
  );
  const instructions = [jev, isSimpleMode() ? t("simpleAdvisorStyle") : null]
    .filter(Boolean)
    .join("\n");
  if (input)
    input.value =
      window.lastSizingBrief + (instructions ? "\n" + instructions : "");

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
    setStatus(
      " Link copied - anyone who opens it gets this same result, re-computed on their device.",
    );
    setFeedback("✓ Link Copied!");
  };

  const url = location.href;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(url)
      .then(done, () => fallbackCopy(url, done));
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

  try {
    document.execCommand("copy");
  } catch {}

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

    price.appendChild(
      el(
        "span",
        { style: "font-weight:400;font-size:0.8em;color:var(--text-muted);" },
        `(${item.scope})`,
      ),
    );

    card.appendChild(price);

    grid.appendChild(card);
  }
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
      badge.title =
        "Working offline using cached app data & local weather simulation";
    } else {
      if (
        badge.style.display !== "none" &&
        !badge.classList.contains("online-flash")
      ) {
        badge.className = "offline-badge online-flash";
        badge.innerHTML = `<span class="offline-dot"></span> Back Online`;
        setTimeout(() => {
          badge.style.display = "none";
        }, 3000);
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
      window.BECO_BATT_COST = (kwh) =>
        battOnlyCost(Math.max(0, Number(kwh) || 0), "lfp");
    } catch {
      /* non-browser test env */
    }

    resetCitySearch = setupCitySearch({
      onPick: setCoords,
      onQueryChange: (query) => {
        locationChoiceGeneration += 1;
        cancelCoordinateResolution();
        locationResolved = false;
        markPrecalcDirty();
        const note = $("locNote");
        if (note) note.textContent = "";
        setStatus(query ? t("resolvingCity") : t("pickCity"));
      },
      setStatus,
    });
    purgeLegacyCityCache();

    renderAppliances();
    setupSimpleMode();
    setupRoofMap();
    setupRoofAreaInput();
    // Demote a stored "result" step: a fresh load has no results to show.
    if (wizard.state.step === "result") {
      wizard = createWizard({ step: "location" });
      persistWizard(wizard);
    }
    updateGuidedProgress();
    const climateToggle = $("climateAwareToggle");
    if (climateToggle)
      climateToggle.addEventListener("change", () => {
        markPrecalcDirty();
      });

    // Advanced derate inputs re-run when they differ from the honest defaults.
    for (const derateId of ["wiringOverride", "mpptOverride"]) {
      const input = $(derateId);
      if (input)
        input.addEventListener("change", () => {
          markPrecalcDirty();
        });
    }

    renderBom();

    // tariff input is a single $/kWh field (auto-estimated from location until the user overrides)

    const customVal = $("customRateVal");
    if (customVal)
      customVal.addEventListener("input", () => {
        tariffTouched = true;
        syncBillSlider();
        markPrecalcDirty();
      });

    const fixedVal = $("fixedChargeVal");
    if (fixedVal)
      fixedVal.addEventListener("input", () => {
        syncBillSlider();
        markPrecalcDirty();
      });

    $("loadMode").addEventListener("change", () => {
      setLoadPanel();
      markPrecalcDirty();
    });

    $("dailyKwhInput").addEventListener("input", () => {
      updateLoadReadout();
      markPrecalcDirty();
    });

    $("btnGeoLocate").addEventListener("click", () => {
      const choice = ++locationChoiceGeneration;
      locateMe({
        onPick: setCoords,
        setStatus,
        isCurrent: () => locationChoiceGeneration === choice,
      });
    });

    // The click event must not leak into run()'s `quiet` parameter (a truthy
    // Event object would silently suppress the status, spinner, and scroll).
    $("btnRunSizing").addEventListener("click", () => {
      runAuthorized = true;
      run(false, true);
    });

    $("btnAskAdvisor").addEventListener("click", askAdvisor);

    const shareBtn = $("btnShareResult");

    if (shareBtn) shareBtn.addEventListener("click", copyShareLink);

    const printBtn = $("btnPrintResult");

    if (printBtn) printBtn.addEventListener("click", () => window.print());

    // Result detail ladder (Best pick / Compare batteries / All options)
    for (const [id, lvl] of [
      ["lvlBest", "best"],
      ["lvlCompare", "compare"],
      ["lvlMatrix", "matrix"],
    ]) {
      const tab = $(id);
      if (tab) tab.addEventListener("click", () => setLevel(lvl));
    }

    // Hardware list panel: live panel-wattage tweaks + CSV download
    const panelWattsInput = $("panelWatts");
    if (panelWattsInput)
      panelWattsInput.addEventListener("input", () => {
        renderBomPanel();
        if (lastPayload) markPrecalcDirty();
      });
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

      if (elNode)
        elNode.addEventListener("input", () => {
          // Preserve USD value of tariff when currency switches: convert display
          // value from old rate to new so $0.42 doesn't become 0.46$ after toggle.
          // The export rate and generator fuel price are entered in the same
          // display currency, so they convert identically — otherwise switching
          // currency silently changes their effective USD value.
          const convertField = (id) => {
            const node = $(id);
            const curVal = parseFloat(node?.value);
            if (
              !node ||
              !Number.isFinite(curVal) ||
              !prevFxSnapshot ||
              !prevFxSnapshot.rate
            )
              return;
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
          convertField("fixedChargeVal");
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
      if (
        selectedKey &&
        (selectedKey === "best" || selectedKey.startsWith("auto:"))
      ) {
        selectedKey = "best";
      }
      markPrecalcDirty();
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
        if (
          selectedKey &&
          (selectedKey === "best" || selectedKey.startsWith("auto:"))
        ) {
          selectedKey = "best";
        }
        markPrecalcDirty();
      });
    }

    if ($("systemGoal"))
      $("systemGoal").addEventListener("change", () => {
        updateAutoRows();
        markPrecalcDirty();
      });

    const autoTierNode = $("autoTier");
    if (autoTierNode)
      autoTierNode.addEventListener("change", () => {
        markPrecalcDirty();
      });

    const autoTargetNode = $("autoTarget");
    if (autoTargetNode)
      autoTargetNode.addEventListener("change", () => {
        // One cut target, two controls: choosing a target in the form must
        // move the results slider to the same cut (and vice versa), so the
        // "your target" column, the recommendation and the select can never
        // disagree after a fresh run. "custom" is read-only state (it only
        // ever mirrors the slider), so it never drives a run.
        const pct = CUT_TARGET_PCT[autoTargetNode.value];
        if (pct) {
          customCutFraction = pct / 100;
          const cutIn = $("cutSlider");
          if (cutIn) cutIn.value = String(pct);
          syncCutLabel();
        }
        markPrecalcDirty();
      });

    // Quick / Manual mode: quick hides advanced inputs but always leaves the
    // explicit sizing button available; it never runs from location alone.

    const modeQuick = $("modeQuick");
    const modeManual = $("modeManual");
    const applyMode = () =>
      setQuickMode(modeManual ? !modeManual.checked : true);
    if (modeQuick) modeQuick.addEventListener("change", applyMode);
    if (modeManual) modeManual.addEventListener("change", applyMode);

    // Goal control + Offgrid slider + Monthly-bill slider + bill-cut slider.
    setupGoalControls();
    setupOffgridControls();
    setupBillSlider();
    setupCutSlider();
    setupBudgetSlider();

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

    // Chart zoom buttons: wiring moved to charts.js (single owner).
    setupZoomButtons();

    // Initialize Sun-path and Chemistry Temperature visualizers
    const initLat = parseFloat($("latInput")?.value) || 21.31;
    renderSunPath(initLat);
    renderChemTempVisualizer(initLat);
    const latEl = $("latInput");
    const lonEl = $("lonInput");
    const onCoordChange = () => {
      locationChoiceGeneration += 1;
      const lat = parseFloat(latEl?.value);
      const lon = parseFloat(lonEl?.value);
      if (Number.isFinite(lat)) {
        renderSunPath(lat);
        renderChemTempVisualizer(lat);
      }
      cancelCoordinateResolution();
      locationResolved = false;
      coordinatesPending =
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180;
      markPrecalcDirty();
      const locNote = $("locNote");
      resetCitySearch?.();
      locationResolved = false;
      if (locNote) locNote.textContent = "";
      if (coordinatesPending) {
        setStatus(t("resolvingCoords"));
        coordDebounceTimer = setTimeout(() => {
          coordDebounceTimer = null;
          if (
            lat !== parseFloat(latEl.value) ||
            lon !== parseFloat(lonEl.value)
          )
            return;
          locationResolved = true;
          coordinatesPending = false;
          applyEstimatedTariff(lat, lon);
          setStatus(t("inputsChanged"));
          if (locNote)
            locNote.textContent = t("customCoordsLocation", {
              lat: lat.toFixed(2),
              lon: lon.toFixed(2),
            });
          updateShareHash(null, readInputs());
        }, 500);
      } else {
        coordinatesPending = false;
        setStatus(t("pickCity"));
      }
    };
    if (latEl) latEl.addEventListener("input", onCoordChange);
    if (lonEl) lonEl.addEventListener("input", onCoordChange);

    // Price-point analysis modal: "Use this system" adopts the exact system.
    const closeSys = $("btnCloseSystem");
    if (closeSys) {
      closeSys.addEventListener("click", closeSystemModal);
      // The closer is a styled div (role=button in markup): mirror the click
      // on Enter/Space so keyboard users can dismiss the modal too.
      closeSys.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          closeSys.click();
        }
      });
    }
    const useSys = $("systemModalUse");
    if (useSys)
      useSys.addEventListener("click", () => {
        const b = $("systemModalUse");
        if (b && b._adopt) b._adopt();
      });

    updateAutoRows();

    setLoadPanel();

    setQuickMode(true); // Quick mode is the default form, not an auto-run

    syncBillSlider();

    updateCurrencyUnitLabel(); // bill-slider currency + tariff labels on first paint

    // Interface language (auto-detected, user-overridable in the footer).

    applyI18n();
    applySimpleMode();

    initLangPicker($("langSelect"));

    // Re-render unit/currency labels (fuel helper, tariff) the moment the

    // language changes, since those live outside the data-i18n scan.

    window.addEventListener("beco:lang", () => {
      updateFuelUnits();
      updateGenHelper();
    });

    updateFuelUnits();

    // A shared link restores its inputs; sizing still requires an explicit
    // click so opening a link never starts weather or engine work silently.
    restoreFromShare();

    // Background FX refresh: keeps auto-selected currencies accurate.

    refreshFxRates();
  } catch (err) {
    // A single init failure must never silently kill the whole UI.

    console.error("Sizing UI failed to initialize:", err);

    setStatus(t("uiInitFailed"));
  }
}

// Refresh the built-in FX defaults in the background so an auto-selected

// currency is accurate rather than indicative. Never blocks the page; on

// failure (offline) the static table simply stays in use.

async function refreshFxRates() {
  try {
    // Bound the FX refresh: on captive portals that hang instead of failing,
    // an unbounded fetch would stall init and leave stale currency defaults.
    const timeoutSignal =
      typeof AbortSignal !== "undefined" && AbortSignal.timeout
        ? AbortSignal.timeout(10000)
        : undefined;
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    });

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
        for (const id of [
          "customRateVal",
          "exportRate",
          "fixedChargeVal",
          "genFuelPrice",
        ]) {
          const node = $(id);
          const v = parseFloat(node?.value);
          if (node && Number.isFinite(v))
            node.value = String(+((v / oldRate) * newRate).toFixed(4));
        }
      }
      fxInput.value = String(newRate);
      prevFxSnapshot = fxActive();
    }

    if (lastPayload) renderResults(lastPayload);
  } catch {
    /* offline - static defaults remain */
  }
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
        console.error(
          "citySearch element not found after",
          maxAttempts * 50,
          "ms",
        );

        cb(); // proceed anyway to avoid deadlock
      }
    };

    checkReady();
  }
}

whenDOMReady(initSizingUI);
