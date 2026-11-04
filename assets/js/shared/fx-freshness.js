// The FX notice rule (plan P1.4, F-10): the source, the as-of date, and
// whether a fetched rate is old enough to call the conversion indicative.
// Both surfaces - the assumptions paragraph and the #fxAsOf field - ask this
// one function, so they cannot disagree. Before it, fxNote() computed the
// as-of sentence and returned a string that never used it.
export const FX_SOURCE = "open.er-api.com";

// A week-old fetched rate is close enough for a planning estimate; an older
// one is not close enough to present without saying so.
export const FX_STALE_DAYS = 7;

const DAY_MS = 86400000;

/** Whole days from the provider's as-of date to `now`; null when unreadable. */
export function fxAgeDays(asOf, now = Date.now()) {
  if (!asOf) return null;
  const t = Date.parse(String(asOf));
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now - t) / DAY_MS);
  return days > 0 ? days : 0;
}

/**
 * live: fresh, or a date we cannot parse (show it rather than invent an age).
 * stale: parsed and older than FX_STALE_DAYS.
 * indicative: no as-of at all - the static table is pricing the page.
 */
export function fxFreshness(asOf, now = Date.now()) {
  if (!asOf)
    return { state: "indicative", days: null, key: "fxIndicativeNote" };
  const days = fxAgeDays(asOf, now);
  if (days !== null && days > FX_STALE_DAYS)
    return { state: "stale", days, key: "fxStaleNote" };
  return { state: "live", days, key: "fxAsOfNote" };
}
