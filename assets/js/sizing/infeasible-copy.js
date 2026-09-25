// Which locale keys explain why nothing solved.
//
// Deciding WHICH code applies belongs to the sizing engine (engine.js
// infeasibleReason, plus the two search-limit codes run.js adds). The copy
// belongs to locales.js, in all six languages. The mapping between them had no
// owner: it lived as a table inside the DOM controller, so the only way to
// check it was to regex that file's source, and a code with no mapping would
// surface as a generic message nobody had reviewed. It is a value now, in a
// module with no DOM and no globals, so a test can call it.

/**
 * reason code -> {titleKey, bodyKey}. Unknown codes get the generic pair rather
 * than an empty banner: an unrecognised reason is still a reason worth telling
 * the visitor about.
 */
const COPY_KEYS = {
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

const GENERIC = {
  titleKey: "infeasibleGenericTitle",
  bodyKey: "infeasibleGenericBody",
};

export function infeasibleCopyKeys(reason) {
  // hasOwnProperty, not a truthiness read: a code that collides with an
  // Object.prototype member ("toString", "constructor") would otherwise
  // resolve to an inherited function and reach the banner as a value.
  return hasInfeasibleCopy(reason) ? COPY_KEYS[reason] : GENERIC;
}

/**
 * Whether this code has reviewed copy of its own, as opposed to falling back
 * to the generic pair. Callers that label an individual cell need the
 * difference: an unknown code is worth showing raw, because the code itself is
 * the only honest thing known about it.
 */
export function hasInfeasibleCopy(reason) {
  return Object.prototype.hasOwnProperty.call(COPY_KEYS, reason);
}

/** Every code this module has reviewed copy for — the contract's own list. */
export function infeasibleReasonCodes() {
  return Object.keys(COPY_KEYS);
}

/** The pair used when a code arrives that no one has written copy for. */
export function infeasibleGenericKeys() {
  return { ...GENERIC };
}
