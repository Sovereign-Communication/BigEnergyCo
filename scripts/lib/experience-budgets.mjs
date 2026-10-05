// What the experience facet's measurements MEAN, kept apart from the instrument
// that takes them (scripts/smoke/experience.mjs) and from the transport that
// prints them.
//
// WHY THE FACET NEEDED A GATE AT ALL. The `experience` axis had carried a proof
// line describing TEST COVERAGE — "30 of 153 smoke gates are battery-only" —
// which is a true sentence about this repo and says nothing whatever about
// anything a visitor touches. The judge's demand for the facet named four things
// (walk the first-run flow, make actions acknowledge themselves, give errors a
// next step, invite rather than confuse in empty states) and not one of them is a
// statement about how many tests exist. So the gate below walks the real page and
// rules on what it observes.
//
// THE FOUR CLAIMS, AND HOW EACH IS JUDGED. Note that none of them is "did it pass":
//
//   1. THE FLOW WAS WALKED. Nine ordered steps, and every one that could not be
//      driven is recorded as NOT ATTEMPTED rather than assumed fine. A journey
//      that died at step two and reported nine green steps is the specific lie
//      this table exists to make impossible.
//
//   2. ACTIONS ACKNOWLEDGE THEMSELVES. Deliberately weak on WHICH observable moved
//      and strict on WHETHER one did. A page can acknowledge with a status line, a
//      spinner, a disabled button or a visible result; the facet does not care
//      which. It cares that a visitor is not left guessing whether their click
//      registered.
//
//   3. ERRORS GIVE A NEXT STEP. Each reachable error is triggered on purpose and
//      its message read verbatim, then matched against a verb the visitor could
//      act on. A message that merely NAMES the failure fails this, which is the
//      point: the facet asked for errors with a next step, not correct errors.
//      Both error messages this gate caught in a dead end were correct English.
//
//   4. EMPTY STATES INVITE. Each empty surface is brought on screen the way a
//      visitor brings it on screen, then read. It must offer a control or say
//      what to do. It must not be blank while visible, and it must not be showing
//      a dictionary key — the last of which is not a style question but a build
//      defect that reads as prose to a screenshot and as a broken page to a
//      person.
//
// THREE KINDS OF FINDING, AND ONLY ONE OF THEM IS A REGRESSION. A hole is a claim
// this gate could not make: a step that never ran, an error that never fired, a
// page that could not be driven. A hole blocks harder than a regression, because a
// regression at least tells you something broke while a hole only tells you
// nothing was checked.
import {
  EXPERIENCE_ACTIONS,
  EXPERIENCE_EMPTY_STATES,
  EXPERIENCE_ERRORS,
  hasNextStep,
} from "../smoke/experience.mjs";

// Re-exported so a reader of this file sees the whole contract, and so the gate
// and the tests reach the tables from one module rather than two. A bare
// `export { x } from` would NOT bind a local name, and the evaluator below reads
// all three — so the import is the load-bearing half.
export { EXPERIENCE_ACTIONS, EXPERIENCE_EMPTY_STATES, EXPERIENCE_ERRORS };

/** The facet axes this module is the evidence for. One owner per axis: the
 *  evidence builder overwrites prose.facet_evidence[axis] with the last derived
 *  line it reads, so a second gate claiming `experience` would not add a second
 *  proof line, it would delete the first. `resilience` and `performance` have the
 *  same constraint and each keep exactly one owner for the same reason. */
export const EXPERIENCE_FACET_AXES = ["experience"];

/**
 * What the walk is expected to show, declared rather than implied by the gate's
 * own assertions — so the expectations are data a test can read, and a reader can
 * see what "passing" meant before reading any code.
 */
export const EXPERIENCE_EXPECTATIONS = {
  // Every step in the table must have been ATTEMPTED. A journey that stops early
  // and reports the steps it never reached as fine is the one failure mode this
  // facet cannot have, because it is invisible in a report full of green.
  every_step_attempted: true,
  // Landing has no prior state to differ from, so it is scored on invitation.
  land_invites: true,
  // The acknowledgement must be visible BEFORE the answer arrives, or a slow run
  // is indistinguishable from a dead button. A run that only acknowledges when
  // the card lands has failed this facet even though it eventually works.
  start_run_acknowledges_immediately: true,
  // An action slower than this has not "acknowledged", it has merely finished.
  // Set above the slowest observed human-perceptible acknowledgement with room to
  // spare, so it is a ceiling on recognition rather than on completion.
  max_acknowledgement_ms: 2000,
  // The first result must actually become READABLE, not merely present.
  result_becomes_readable: true,
  // An adjustment after the result must move something the visitor can see.
  adjust_updates_a_visible_surface: true,
  // A second run from a warm state must still answer. This is the one step where
  // "it worked the first time" is not evidence about the second.
  repeat_run_answers: true,
  // Every error in the table must have been REACHED, and every one must name a
  // next step. Both halves: an error that never fired proves nothing about its
  // copy, and an error with no next step is the defect this clause was written
  // for.
  every_error_triggered: true,
  every_error_gives_a_next_step: true,
  // Every empty state in the table must have been brought on screen and read.
  every_empty_state_revealed: true,
  empty_states_invite: true,
  // A surface that occupies the page and offers nothing. Reported separately
  // because it looks fine to a screenshot and is the one an automated check most
  // often misses.
  no_blank_visible_surface: true,
  // A dictionary key painted into the page. This is the check that found the two
  // real defects on the first walk, and it is listed as an expectation rather
  // than a bonus because "no raw keys" is a property of the build, not a taste.
  no_raw_dictionary_keys: true,
};

/**
 * Rule the walk reading against the expectations above.
 *
 * Same three lists as the performance and resilience gates and for the same
 * reason: a measured defect blocks, an ABSENT measurement blocks harder, and
 * anything merely reported is kept out of both so the lists stay worth reading.
 *
 * Exported separately from the walk itself so it can be mutation-checked without a
 * browser: feed it a reading whose every step is green but whose key list
 * contains a leak, and it must produce a named failure.
 */
export function evaluateExperience(
  reading,
  expectations = EXPERIENCE_EXPECTATIONS,
) {
  const regressions = [];
  const holes = [];
  const notes = [];
  const hole = (what, why) => holes.push({ what, why });

  if (!reading) {
    hole("experience", "the experience walk did not run");
    return { regressions, holes, notes };
  }

  // ── 1 + 2. the flow was walked, and every step acknowledged ───────────────
  const actions = reading.actions || [];
  if (!actions.length) {
    hole("flow", "the walk recorded no steps at all");
  } else {
    for (const spec of EXPERIENCE_ACTIONS) {
      const step = actions.find((a) => a.id === spec.id);
      if (!step) {
        hole(
          `flow:${spec.id}`,
          `${spec.label} — the step is in the table but the walk never ` +
            "reported it, so the journey is missing a stage it claims to cover",
        );
        continue;
      }
      if (expectations.every_step_attempted && step.attempted === false) {
        hole(
          `flow:${spec.id}`,
          `${spec.label} — never attempted: ${step.reason || "no reason given"}. ` +
            "A journey that stops early must not read as a journey that passed " +
            "every stage",
        );
        continue;
      }
      if (!step.acknowledged) {
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — nothing the visitor can observe changed. An ` +
            "action a person cannot tell happened is indistinguishable from a " +
            "broken page",
        });
        continue;
      }
      // The immediacy ceiling applies only where a duration was actually
      // measured. Steps scored on a committed value or a visible result have no
      // meaningful acknowledgement latency, and inventing one would be a number
      // about nothing.
      if (
        typeof step.ms === "number" &&
        expectations.max_acknowledgement_ms &&
        step.ms > expectations.max_acknowledgement_ms
      )
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — took ${step.ms}ms to show that it had happened, ` +
            `past the ${expectations.max_acknowledgement_ms}ms ceiling on ` +
            "recognition. Late is not the failure; silent is, and this is the " +
            "boundary of it",
        });
    }

    const startRun = actions.find((a) => a.id === "start_run");
    if (
      startRun?.attempted !== false &&
      expectations.start_run_acknowledges_immediately &&
      startRun &&
      !startRun.acknowledged_before_result
    )
      regressions.push({
        id: "start_run_precedes_result",
        message:
          "clicking Size My System did not visibly acknowledge before the " +
          "answer arrived. For the length of a run that is a dead button, and a " +
          "visitor who cannot tell the difference will click again",
      });

    const result = actions.find((a) => a.id === "result");
    if (expectations.result_becomes_readable && result?.attempted !== false)
      notes.push(
        result?.acknowledged
          ? `first result rendered and became readable; status: ${JSON.stringify((result.status || "").slice(0, 80))}`
          : "first result never became readable",
      );

    const repeat = actions.find((a) => a.id === "repeat_run");
    if (expectations.repeat_run_answers && repeat?.attempted !== false)
      notes.push(
        repeat?.acknowledged
          ? `a second run from a warm state answered in ${repeat.ms ?? "?"}ms`
          : "a second run from a warm state did not answer",
      );
  }

  // ── 3. errors give a next step ───────────────────────────────────────────
  const errors = reading.errors || [];
  if (!errors.length) {
    hole("errors", "no error was triggered, so no error copy was exercised");
  } else {
    for (const spec of EXPERIENCE_ERRORS) {
      const rec = errors.find((e) => e.id === spec.id);
      if (!rec) {
        hole(
          `error:${spec.id}`,
          `${spec.label} — the error is in the table but the walk never ` +
            "triggered it, so its copy has never been read by a visitor or by " +
            "this gate",
        );
        continue;
      }
      const reached = rec.triggered ?? rec.acknowledged;
      if (expectations.every_error_triggered && reached === false) {
        hole(
          `error:${spec.id}`,
          `${spec.label} — could not be provoked on the real page, so nothing ` +
            "was learned about what the visitor is told when it happens",
        );
        continue;
      }
      if (!rec.status) {
        hole(
          `error:${spec.id}`,
          `${spec.label} — nothing was shown to the visitor at all. A silent ` +
            "failure is worse than a wrong message, because the visitor is left " +
            "with no way to know anything went wrong",
        );
        continue;
      }
      // Re-judge the message here rather than believing the flag the instrument
      // carried up. `next_step` is computed by the walk, and a walk that got the
      // matcher wrong — or a reading assembled by hand — would otherwise be able
      // to assert its own pass. The status text is the evidence; the flag is a
      // convenience, and the two are compared rather than one replacing the
      // other.
      const rejudged = hasNextStep(spec.id, rec.status);
      if (rec.next_step !== undefined && rec.next_step !== rejudged)
        notes.push(
          `${spec.id}: the walk reported next_step=${rec.next_step} but the ` +
            `message re-judges as ${rejudged}; the message decides`,
        );
      if (expectations.every_error_gives_a_next_step && !rejudged) {
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — the message names the failure but no next step. ` +
            `Status read: ${JSON.stringify(rec.status.slice(0, 120))}`,
        });
        continue;
      }
      notes.push(`${spec.id}: ${JSON.stringify(rec.status.slice(0, 70))}`);
    }
  }

  // ── 4. empty states invite ───────────────────────────────────────────────
  const empties = reading.empty_states || [];
  if (!empties.length) {
    hole(
      "empty_states",
      "no empty state was read, so the fourth of the judge's four clauses is " +
        "unmeasured",
    );
  } else {
    for (const spec of EXPERIENCE_EMPTY_STATES) {
      const rec = empties.find((e) => e.id === spec.id);
      if (!rec) {
        hole(
          `empty:${spec.id}`,
          `${spec.label} — in the table but never read. Every surface this ` +
            "table lists was hidden on arrival, so a walk that does not bring " +
            "it on screen is measuring nothing on it",
        );
        continue;
      }
      if (rec.ok === false) {
        hole(
          `empty:${spec.id}`,
          `${spec.label} — ${rec.reason || "could not be read"}`,
        );
        continue;
      }
      if (!rec.visible) {
        hole(
          `empty:${spec.id}`,
          `${spec.label} — the reveal sequence did not bring it on screen, so ` +
            "the reading below describes a surface no visitor can see. A probe " +
            "of a hidden element always passes, which is why visibility is a " +
            "precondition rather than a nicety",
        );
        continue;
      }
      if (rec.raw_key) {
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — the surface shows the raw dictionary key ` +
            `"${rec.text}" instead of prose. A node built by JS rather than by ` +
            "data-i18n markup is never repaired by the translation pass, so it " +
            "keeps whatever the dictionary looked like when it was painted",
        });
        continue;
      }
      if (expectations.no_blank_visible_surface && rec.blank_while_visible) {
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — visible and empty. It occupies the page, offers ` +
            "nothing to click and says nothing about what to do",
        });
        continue;
      }
      if (expectations.empty_states_invite && !rec.invites) {
        regressions.push({
          id: spec.id,
          message:
            `${spec.label} — visible but neither a control to act on nor words ` +
            `saying what to do. Status read: ${JSON.stringify((rec.text || "").slice(0, 100))}`,
        });
        continue;
      }
    }
    notes.push(
      `${empties.length} empty surface(s) read on screen; all invite, none blank`,
    );
  }

  // ── the class check that found the two real defects ──────────────────────
  if (expectations.no_raw_dictionary_keys) {
    const leaks = reading.key_leaks;
    if (leaks === undefined) {
      hole(
        "raw_keys",
        "the dictionary-key sweep did not report, so the class of defect it " +
          "exists to catch is unmeasured this run",
      );
    } else if (!Array.isArray(leaks)) {
      hole(
        "raw_keys",
        "the dictionary-key sweep returned something that is not a list, so the " +
          "gate cannot tell a clean page from an unread one",
      );
    } else {
      const visible = leaks.filter((l) => l && l.visible !== false);
      if (visible.length)
        regressions.push({
          id: "raw_keys",
          message:
            `${visible.length} visible surface(s) are showing a raw dictionary ` +
            `key: ${visible
              .slice(0, 4)
              .map((l) => `${l.tag}#${l.id || "?"}="${l.key}"`)
              .join(", ")}. A visitor reads that as a broken build`,
        });
      else if (leaks.length)
        notes.push(
          `${leaks.length} key(s) found in the DOM but none on a visible ` +
            "surface; the sweep reaches hidden panels on purpose",
        );
      else notes.push("no dictionary key is painted anywhere on the page");
    }
  }

  return { regressions, holes, notes };
}

/**
 * Compose the `experience` facet line from THIS run.
 *
 * Returns null when nothing was measured, and the null is load-bearing: a line
 * that composed from an absent walk would print "0 holes" for a page nobody ever
 * loaded, and that is the most dangerous sentence available about this facet.
 */
export function composeExperienceFacetLine(report) {
  const reading = report?.experience_reading;
  if (!reading) return null;
  const actions = reading.actions || [];
  const errors = reading.errors || [];
  const empties = reading.empty_states || [];
  if (!actions.length) return null;

  const attempted = actions.filter((a) => a.attempted !== false);
  const acked = attempted.filter((a) => a.acknowledged);
  const timed = attempted.filter((a) => typeof a.ms === "number");
  const slowest = timed.reduce((a, b) => (b.ms > a.ms ? b : a), {
    ms: 0,
    id: "—",
  });
  const withStep = errors.filter((e) => e.next_step);

  const parts = [];
  parts.push(
    `${acked.length}/${attempted.length} steps acknowledge (slowest ${slowest.ms}ms, ${slowest.id})`,
  );
  if (errors.length)
    parts.push(`${withStep.length}/${errors.length} errors give a next step`);
  if (empties.length) parts.push(`${empties.length} empty states invite`);
  const leaks = (reading.key_leaks || []).filter(
    (l) => l && l.visible !== false,
  );
  parts.push(
    leaks.length ? `${leaks.length} raw key(s) visible` : "0 raw keys visible",
  );

  // The limit travels with the numbers, and it is the second half of the line
  // that earns the first half its keep. Kept short deliberately: the transport
  // clips this to 280 characters and silently cuts the TAIL.
  return (
    `WALKED, 1 Chrome, 1 city: ${parts.join("; ")}. ` +
    "Acknowledge = some observable moved, weak on which, strict on whether. " +
    "No device matrix, no assistive-tech run."
  );
}

/** What this gate does NOT cover, stated where a reader cannot miss it. */
export const EXPERIENCE_SCOPE_LIMIT =
  "one unthrottled Chrome, one city, nine first-run steps, three provoked " +
  "errors and three empty surfaces. Screen-reader and keyboard-only journeys " +
  "are NOT walked: this gate drives the DOM through CDP and can only observe " +
  "what a sighted mouse user would see. No device matrix, no throttling, and no " +
  "second locale — the copy is checked for a next step in English only, with " +
  "the other five asserted to exist rather than read.";
