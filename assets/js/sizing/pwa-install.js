// Which install control the page may show, as a pure decision.
//
// WHY THIS IS ITS OWN MODULE: the decision was previously implicit in two
// `style.display` assignments inside `beforeinstallprompt`, and those two
// assignments were the whole defect. Chromium fires `beforeinstallprompt`
// roughly 800ms AFTER first paint, so revealing both controls then reflowed the
// header CTA row 109px sideways and pushed `section.hero` down: measured CLS
// 0.121 on home/mobile against the plan's 0.02 ceiling. Decomposed, that is an
// impact fraction of 0.95 times a distance fraction of 109/844 — it is
// HORIZONTAL reflow of the header, not the 7px vertical hero shift the
// header-height change also caused.
//
// The fix is a rule, and a rule is worth having only if it is stated: the
// install affordance belongs to exactly one layout. On a narrow screen that is
// the drawer button, which is already in the DOM inside a closed
// `display: none` container, so revealing it moves nothing at all. On a wide
// screen it is the header button, where the same reveal measures 0.004 — under
// the ceiling, so it needs no reserved slot and no permanent empty gap in the
// navigation.
//
// Pure, so it can be tested without a browser. The end-to-end half is the
// Lighthouse gate, which reports CLS for all 14 templates on every run.
export const INSTALL_NAV_BREAKPOINT_PX = 830;

/**
 * The `display` value for each install control.
 *
 * Exactly one of the two is ever non-`none`, and which one is a function of
 * the viewport, never of "has the prompt fired yet" alone. Returning both as
 * hidden when nothing should show is the same call the install-accepted and
 * appinstalled paths make, so there is one rule rather than three.
 */
export function installReveal(narrow, available) {
  if (!available) return { header: "none", drawer: "none" };
  return narrow
    ? { header: "none", drawer: "flex" }
    : { header: "inline-flex", drawer: "none" };
}
