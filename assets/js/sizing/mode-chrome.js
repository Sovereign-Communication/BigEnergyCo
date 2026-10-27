// Mode chrome: the pure visibility and generator decisions the UI paints.
//
// Why this module exists. The bill-cut slider row in the results panel had
// two writers with two different state holders: the results render wrote it
// from the LAST RESULT's mode, and applyUseCase wrote it from the use-case
// select. The goal buttons changed neither at the right time, so clicking
// "Off-grid / Backup" after a grid-tie result left "Cut ~80% of your bill"
// on screen for a user with no bill (owner report, 2026-10-19). The cure is
// not a third writer: it is one decision, stated here as a pure function of
// current state, that the single UI writer applies on every state change.
//
// The generator decisions live here for the same reason. The off-grid flow
// asks how often a generator may run (0% / 1% / 2%+); that answer IS the
// independence tier the engine already sizes to, and the mapping between
// the two vocabularies belongs to exactly one place.

/**
 * The bill-cut row is visible exactly when ALL of these hold:
 *   - the current goal is grid-tie (the user has a bill to cut);
 *   - the result on screen is a grid-tie result (not a stale one from
 *     another mode, and not none at all);
 *   - the current use case is billcut (the only case that reports a bill
 *     cut; time-of-use sizes a battery, it does not cut a bill by target).
 *
 * Any other combination hides it. In particular goal="offgrid" hides it no
 * matter what result or use case is lying around — that is the regression
 * this function exists to pin.
 */
export function cutRowVisible({ goal, resultMode, useCaseId }) {
  return (
    goal === "gridtie" && resultMode === "gridtie" && useCaseId === "billcut"
  );
}

/** The generator-runtime answers, in the order the off-grid flow asks. */
export const GENERATOR_RUNTIMES = ["gen0", "gen1", "gen2"];

/** The independence tier each generator answer sizes to. */
const TIER_FOR_RUNTIME = {
  gen0: "tier100", // 0% — never: full independence, no generator at all
  gen1: "tier99", // 1% — a few days a year: generator as rare backup
  gen2: "tier95", // 2%+ — fine when needed: generator runs now and then
};

const RUNTIME_FOR_TIER = {
  tier100: "gen0",
  tier99: "gen1",
  tier95: "gen2",
};

/** Generator answer -> engine independence tier. Unknown -> the default. */
export function tierForGeneratorRuntime(runtime) {
  return TIER_FOR_RUNTIME[runtime] || "tier99";
}

/** Engine independence tier -> generator answer (share-link restore). */
export function generatorRuntimeForTier(tier) {
  return RUNTIME_FOR_TIER[tier] || "gen1";
}

/** A generator is in play for every answer except "never". */
export function generatorAllowedForRuntime(runtime) {
  return runtime !== "gen0";
}
