// The FX notice's rule, in one place: where a converted figure's rate came
// from, what as-of date to show, and whether that date is old enough to call
// the conversion indicative (master plan P1.4, defect F-10).
//
// WHY THIS EXISTS AS A MODULE. The page had the sentence and did not print it:
// `fxNote()` computed an `asOf` local and returned a string that never used it,
// so a visitor reading a converted amount was told neither the source nor the
// date. The form-level field was worse - it was written only on a successful
// fetch, so the offline path (the static built-in table) showed nothing at all.
// Both surfaces now ask this one function, so they cannot disagree.
export const FX_SOURCE = "open.er-api.com";

// Seven days is the notice threshold, not a data-quality claim: the built-in
// table is already "indicative", and a week-old fetched rate is close enough
// for a planning estimate while a month-old one is not close enough to present
// without saying so.
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
 * The notice state for one as-of value.
 *
 * - `indicative`: no as-of at all - the live fetch never succeeded this session
 *   and the static table is pricing the page.
 * - `stale`: the provider's date parsed and is older than FX_STALE_DAYS.
 * - `live`: fresh, or present but unparseable (a provider format change must
 *   still show its own date rather than claim a freshness nobody measured).
 */
export function fxFreshness(asOf, now = Date.now()) {
  if (!asOf) return { state: "indicative", days: null, key: "fxIndicativeNote" };
  const days = fxAgeDays(asOf, now);
  if (days !== null && days > FX_STALE_DAYS)
    return { state: "stale", days, key: "fxStaleNote" };
  return { state: "live", days, key: "fxAsOfNote" };
}
