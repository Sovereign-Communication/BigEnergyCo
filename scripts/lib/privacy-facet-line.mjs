// The privacy facet's proof line, composed from one run's measurement.
//
// WHY IT IS HERE AND NOT IN THE GATE. `check-privacy-browser.mjs` is a script
// that starts a browser the moment it is imported, so a test cannot import it
// and nothing composed inside it can be asserted directly. That is not a
// theoretical problem: the first version of this composer lived in the gate,
// and the test that was supposed to check it fell through to source greps in
// CI, because `jev-artifacts/` is gitignored and the artifact it wanted was
// never there. The test passed while proving nothing.
//
// So the composer is a pure function over a measurement, living where a test
// can reach it — the same split `check-lighthouse.mjs` already uses for its
// own `composeFacetLine` in `lib/lighthouse-budgets.mjs`.
//
// WHAT THE LINE MAY CLAIM. Every number in it is read out of the measurement
// passed in. Nothing here is typed: a run that measured 3 cookies produces a
// line saying 3, and the gate is red anyway, so the line cannot flatter a bad
// run.

/**
 * The proof line for the privacy facet, composed from `measured`.
 *
 * @param {object} measured  the `runPrivacyFlow` payload.
 * @param {number} clip      `COMPLETE_FACET_CLIP`, injected rather than
 *                           imported so the caller owns the budget.
 * @returns {{line: string, overflow: number}} `overflow` is 0, or how many
 *   characters over `clip` the line ran — non-zero is a hard failure the caller
 *   must report, never a silent truncation.
 */
export function composePrivacyFacetLine(measured, clip) {
  const m = measured || {};
  const origins = m.thirdPartyOrigins || [];
  const keys =
    (m.localStorageKeys || []).length + (m.sessionStorageKeys || []).length;
  const line =
    `CDP browser, ${(m.journeysDriven || []).length + 1} journeys, ` +
    `${m.requestCount} requests: ` +
    `${m.cookieCount} cookies (${m.httpOnlyCount} HttpOnly), ` +
    `${keys} local/session storage keys, ` +
    `${(m.identifying || []).length} requests carrying an identifier, ` +
    `${(m.coordinateFindings || []).length} carrying a coordinate finer than ` +
    `0.01 deg; third-party egress ` +
    (origins.length
      ? `${origins.map((o) => o.replace(/^https?:\/\//, "")).join(" + ")}, ` +
        `all declared in connect-src`
      : "none") +
    ".";
  return { line, overflow: Math.max(0, line.length - clip) };
}
