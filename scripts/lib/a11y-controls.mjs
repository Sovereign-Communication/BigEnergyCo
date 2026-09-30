// The `accessibility` facet, measured on the product's own controls.
//
// The judge used to read a hand-typed sentence here — "16 gates green: keyboard
// reaches and wraps with no trap at 64/64/81/47 stops across result, quick,
// manual and kWh panels; WCAG AA contrast all pass; reduced motion honored when
// emulated". Every number in it was a real reading: scripts/smoke/a11y.js walks
// those four surfaces with real Tab/Enter/Space events, resolves each visible
// control's accessible name, computes WCAG AA contrast against the composited
// background chain, and emulates prefers-reduced-motion at the two scroll sites.
// What was wrong is that the sentence was the ONLY source — a reader had to take
// it on trust, and a run that stopped measuring it could not be told apart from
// one that measured it green.
//
// This module is the same rule the `performance` facet already runs under: the
// gate that measures the facet composes the line from the run that produced it,
// so `facet_line` and the reading cannot drift apart, and no run means no line
// rather than a stale claim.
//
// What goes on the line, and what deliberately does not:
//
//   · The four things the axis asks about, each tied to the gate that measured
//     it: keyboard reachability (per-surface walks, with the stop counts the
//     walk itself counted), names on every visible control, WCAG AA contrast,
//     and reduced-motion respect.
//   · The surfaces BY NAME, including the result stage whose controls are the
//     slider pair, because "the calculator's controls" is not a measurement
//     unless it says which controls a Tab actually reached.
//   · Failures, named, IN PLACE OF the claims they undermine — a red walk never
//     rides along under a green sentence.
//   · Its own limit. This is one desktop Chrome with no screen reader driven
//     against it, and it exercises the calculator's own surfaces rather than
//     the template × state × theme × direction matrix (that is quality-lab's
//     axe run, a different gate with its own report). Saying so is what stops a
//     green line reading as proof of the facet.
//
// The line is bounded BY CONSTRUCTION (bounded failure names, bounded surface
// list) rather than trimmed: it is never sliced to fit. An over-long line is a
// named problem in the evidence builder, and a silent trim there would drop
// exactly the limit sentence this line exists to keep.
/** The one axis this gate speaks for; the builder discovers it from the report. */
export const A11Y_FACET_AXES = ["accessibility"];

// Bounded variable parts. FAILURES is small because a name the judge can read
// matters more than a long list of them (the full set is in the report), NAME is
// wide enough that every gate name this flow actually uses survives whole, and
// SURFACE is wide enough for the four surface names and no wider.
const MAX_FAILURES = 2;
const MAX_NAME = 52;
const MAX_SURFACE = 10;
const LIMIT = "1 Chrome, no screen reader, no theme/RTL matrix";

function clipTo(value, limit) {
  const text = String(value || "").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
const clipName = (name) => clipTo(name, MAX_NAME);

/**
 * "keyboard reaches sliders/quick/manual/kWh, wrapping with no trap (64/64/81/47
 * stops)" — or, when a surface was not walked, the hole by name. The stop counts
 * are the ones the walks counted, in walk order.
 */
function keyboardClause(walks) {
  const list = Array.isArray(walks) ? walks : [];
  if (!list.length) return "keyboard reach was not walked this run";
  // Bounded like the failure names, so the line is bounded by construction and
  // never has to be trimmed to fit.
  const name = (w) => clipTo(w?.surface || w?.state || "?", MAX_SURFACE);
  const complete = list.filter(
    (w) => w?.wrapped !== false && !(w?.missing || []).length,
  );
  if (complete.length !== list.length) {
    const holes = list
      .filter((w) => !complete.includes(w))
      .map(name)
      .slice(0, 4)
      .join("/");
    return `keyboard reached no wrap or missed controls on ${holes}`;
  }
  const stops = complete.map((w) => w.stops).filter(Number.isFinite);
  return (
    `keyboard reaches ${complete.map(name).join("/")}, wrapping with no trap` +
    (stops.length === complete.length ? ` (${stops.join("/")} stops)` : "")
  );
}

/**
 * Compose the `accessibility` facet line the judge reads, from the run.
 *
 * Three honest shapes, and no fourth:
 *   · not measured — the flow did not run: say so, claim nothing.
 *   · failed       — name the failing gates and withdraw the claims they sit
 *                    under, rather than reporting the ones that passed.
 *   · green        — the four claims, the surfaces, and the limit.
 */
export function composeA11yFacetLine(summary) {
  if (!summary || summary.ran !== true) {
    const why = summary?.error
      ? ` (${String(summary.error).slice(0, 60)})`
      : "";
    return (
      "the calculator's controls were NOT measured in a browser this run" +
      `${why}, so keyboard reach, control names, contrast and reduced motion ` +
      "rest on nothing from this run"
    );
  }

  const gates = Array.isArray(summary.gates) ? summary.gates : [];
  const failed = gates.filter((g) => !g.ok);
  if (failed.length) {
    const names = failed.slice(0, MAX_FAILURES).map((g) => clipName(g.name));
    const more =
      failed.length > MAX_FAILURES ? ` (+${failed.length - MAX_FAILURES})` : "";
    return (
      `real Chrome, calculator controls: ${failed.length}/${gates.length} ` +
      `a11y gates FAILED - ${names.join("; ")}${more}. Every keyboard, name, ` +
      "contrast and motion claim is unproven where those gates sit"
    );
  }

  const claims = [
    keyboardClause(summary.walks),
    summary.names?.checked && summary.names?.failures === 0
      ? "every visible control named"
      : "control names not fully sampled",
    summary.contrast?.checked && summary.contrast?.failures === 0
      ? "WCAG AA contrast"
      : "contrast not fully measured",
    summary.reduced_motion?.checked
      ? "reduced motion honored"
      : "reduced motion not measured",
  ];
  return `real Chrome, calculator controls: ${claims.join("; ")}. ${LIMIT}`;
}
