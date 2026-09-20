// Jev sanity check — client side.
//
// The deterministic engine remains the single source of truth for every
// number on screen. This module reads the finished result, asks the worker's
// /api/jev route (TypeSafe's System One model — typed probabilities, no
// prose) for an independent plausibility judgment, and renders a badge. It
// can fail in every possible way — network, key, upstream, shape — and every
// failure mode is the same: no badge, nothing else changes.
//
// The interpretation thresholds below were set from measured jev-1.13.0
// calibration probes (textbook / German-winter / broken-PV cases): the noul
// "plausible" probability separates good from broken sizing cleanly, while
// the "verdict" choice carries a conservative bias and may only ever *add*
// a flag, never grant a pass on its own.
const API_FALLBACK = "https://bigenergyco-api.bigenergyco.workers.dev";
const FETCH_TIMEOUT_MS = 3500; // quoted 70-500ms; badge must never hang the UI

export const SANITY_THRESHOLDS = {
  flagPlausibleMax: 0.3,
  flagRedFlagMin: 1.5,
  flagImpossibleConfidence: 0.6,
  passPlausibleMin: 0.6,
  passRedFlagMax: 1.0,
};

/**
 * Numbers only — no location names, no free text (nothing to inject, nothing
 * that identifies the visitor). Optional climate fields are omitted when the
 * payload lacks them; the worker treats them as optional.
 */
export function sanityState(p, entry) {
  if (!p || !entry) return null;
  const a = p.assumptions || {};
  const payback =
    typeof entry.paybackYearsHi === "number" &&
    typeof entry.paybackYearsLo === "number"
      ? (entry.paybackYearsLo + entry.paybackYearsHi) / 2
      : entry.paybackYears;
  return {
    mode: p.mode,
    dailyKwh: +p.dailyKwh,
    pvKw: +entry.pvKw,
    battKwh: +entry.battKwh,
    costLo: +entry.costLo,
    costHi: +entry.costHi,
    cutPct: +(entry.cutPct ?? 0),
    paybackYears: +payback,
    specificYieldKwhPerKwDay: p.annualYieldPerKw
      ? +(p.annualYieldPerKw / 365).toFixed(3)
      : undefined,
    worstMonthGhi: a.worstMonth
      ? +a.worstMonth.averageDailyGhi.toFixed(3)
      : undefined,
    meanTempC: typeof a.meanTempC === "number" ? a.meanTempC : undefined,
  };
}

/**
 * Confidence-gated interpretation. Returns { level, ...data } with level one
 * of "pass" | "flag" | "uncertain", or null when there is nothing to show.
 */
export function interpretSanity(data) {
  if (!data || data.available !== true) return null;
  const p = data.plausible;
  if (typeof p !== "number" || !Number.isFinite(p)) return null;
  const impossibleConfident =
    data.verdict === "impossible" &&
    (data.verdictConfidence ?? 0) >= SANITY_THRESHOLDS.flagImpossibleConfidence;
  const flag =
    p <= SANITY_THRESHOLDS.flagPlausibleMax ||
    (data.redFlag ?? 0) >= SANITY_THRESHOLDS.flagRedFlagMin ||
    impossibleConfident;
  if (flag) return { ...data, level: "flag" };
  const pass =
    p >= SANITY_THRESHOLDS.passPlausibleMin &&
    (data.redFlag ?? 0) <= SANITY_THRESHOLDS.passRedFlagMax &&
    data.verdict !== "impossible";
  return { ...data, level: pass ? "pass" : "uncertain" };
}

/**
 * Feature gate: the badge only ever asks the worker when the deployed worker
 * says the Jev route is live (/api/health carries jevSanity:true only with
 * the key present). Checked per render — one ~60-byte GET, every disabled
 * state stays completely silent (no POST, no failed requests, no console
 * noise), and activating the feature server-side needs no client redeploy.
 */
export async function jevEnabled(base) {
  try {
    const res = await fetch(base + "/api/health", { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data && data.jevSanity === true;
  } catch {
    return false;
  }
}

/** Fire-and-forget probe. Any failure resolves to null — never throws. */
export async function requestSanity(state) {
  if (!state) return null;
  const local =
    typeof location !== "undefined" &&
    (location.hostname === "127.0.0.1" || location.hostname === "localhost");
  const base = local
    ? ""
    : (typeof window !== "undefined" && window.CF_API_URL) || API_FALLBACK;
  if (!(await jevEnabled(base))) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(base + "/api/jev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Renders the badge. `t` is the locale lookup, `onAsk` (optional) wires the
 * flag case's advisor button to the same askAdvisor flow the results row
 * uses. Returns the element (or null when nothing was rendered).
 */
export function renderSanityBadge(container, interp, t, onAsk) {
  if (!container || !interp || typeof t !== "function") return null;
  const badge = document.createElement("p");
  badge.className = "sanity-badge sanity-" + interp.level;
  badge.setAttribute("role", "status");
  if (interp.level === "flag") {
    badge.textContent = t("sanityFlag");
    if (typeof onAsk === "function") {
      const ask = document.createElement("button");
      ask.type = "button";
      ask.className = "sanity-ask btn btn-outline";
      ask.textContent = t("sanityAskAdvisor");
      ask.addEventListener("click", onAsk);
      badge.appendChild(ask);
    }
  } else if (interp.level === "pass") {
    badge.textContent = t("sanityOk");
  } else {
    // uncertain: the model was inconclusive. Live calibration puts even
    // textbook systems here, so silence is the honest render — absence is
    // invisible and the site's trust is never spent on a non-verdict.
    return null;
  }
  badge.title = t("sanityTooltip");
  container.appendChild(badge);
  return badge;
}
