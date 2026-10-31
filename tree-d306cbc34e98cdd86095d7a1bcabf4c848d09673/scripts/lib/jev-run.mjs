// What happened when the gate asked a judge, and how the report says so.
//
// One owner for the live-run state. Three rules live here and nowhere else:
//   • a judgment is only accepted when the provider names a concrete model
//     version (plan §8 P0.3(e): "The model version is pinned in the report");
//   • the run is classified so the plan's one-re-run rule is readable from the
//     report instead of remembered from the plan;
//   • every fact about the run is written from ONE value, so the report cannot
//     describe the same run two ways.
//
// The report carries two views, and they are not the same thing:
//   • `live`    — what the JUDGE said (primary_gap, its notes). Owned by the
//                 scorer, in lib/jev-complete.mjs.
//   • `live_jev`— what the CALL was (provider, model, tokens, cost, blocker).
//                 Owned here.
// The fields they share are written from one value by attachRunFacts, which is
// the whole point: a rehearsal caught a report reading "judgment" on one field
// while the other said no judgment had been accepted.
//
// No network and no filesystem: the wire itself is in lib/jev-live.mjs, and the
// report is assembled in scripts/validate-jev-complete.mjs.
import { jevCostUsd } from "../../worker/jev-price.mjs";
// Which kind of evidence the report consumed is the evidence module's to say.
import { evidenceSourceKind } from "./jev-evidence.mjs";

// The loose alias the request asks for. A response that only echoes it names no
// version, so nothing about that judgment is reproducible.
export const JEV_MODEL_ALIAS = "jev-latest";

/**
 * Accept a live judgment only when it names a concrete model version.
 *
 * Plan §8 P0.3(e): "The model version is pinned in the report." A score that
 * cannot be attributed to a model version is not evidence of anything, so an
 * unversioned answer is refused rather than recorded under the alias.
 */
export function acceptLiveJudgment(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      accepted: false,
      model: null,
      blocker: "provider returned a non-object body",
    };
  }
  const model = body.model;
  if (typeof model !== "string" || !model.trim()) {
    return {
      accepted: false,
      model: null,
      blocker: `provider named no model version, so the judgment cannot be pinned (plan §8 P0.3(e))`,
    };
  }
  const trimmed = model.trim();
  if (trimmed.toLowerCase() === JEV_MODEL_ALIAS) {
    return {
      accepted: false,
      model: trimmed,
      blocker: `provider echoed the unpinned alias "${JEV_MODEL_ALIAS}" instead of a version`,
    };
  }
  return { accepted: true, model: trimmed, blocker: null };
}

/**
 * The record of the call, assembled in one place.
 *
 * This used to be four hand-written object literals in the CLI, one per branch
 * (not attempted / accepted / refused / no answers), which meant the shape of
 * the live-run state was assembled by whoever was calling and could drift from
 * the shape the report reads. Its owner is here; the caller's job is to supply
 * the three things this module cannot know for itself:
 *
 *   `skipped` — no call was made at all (--local-only).
 *   `wire`    — what the provider returned, or null.
 *   `pin`     — acceptLiveJudgment's verdict on that response, or null.
 *   `parsed`  — the engine's own reading of the answers, or null.
 *
 * The last two are kept apart on purpose: a response can be pinned and still
 * unreadable, and each of those is a different reason to refuse it.
 */
export function liveRunRecord({
  skipped = false,
  wire = null,
  pin = null,
  parsed = null,
  modelRequested = JEV_MODEL_ALIAS,
} = {}) {
  if (skipped) {
    return {
      is_fallback: true,
      accepted: false,
      blocker: "not attempted (--local-only)",
    };
  }
  if (wire && wire.answers) {
    if (!(pin && pin.accepted && parsed)) {
      return {
        is_fallback: true,
        accepted: false,
        provider: wire.provider,
        model: pin ? pin.model : null,
        model_requested: modelRequested,
        blocker:
          (pin && pin.blocker) ||
          "response had no valid facet answers (0-hallucination: nothing invented)",
      };
    }
    // The pin is the CALLER's verdict, so this re-checks the one thing the
    // verdict itself is about rather than trusting it. `acceptLiveJudgment`
    // refuses the unpinned alias, and the CLI is its only caller — but the
    // record is the thing the judge reads, and a record builder that accepts
    // whatever `pin.accepted` says will happily publish a judgment attributed
    // to "jev-latest", which is the exact unreproducible artifact plan §8
    // P0.3(e) forbids. The alias is a known string, so refusing it here costs
    // nothing and closes the gap between "the pin said yes" and "the model is
    // pinned". Found by tests/gate-self-audit.test.mjs.
    const named = typeof pin.model === "string" ? pin.model.trim() : "";
    if (!named || named.toLowerCase() === JEV_MODEL_ALIAS) {
      return {
        is_fallback: true,
        accepted: false,
        provider: wire.provider,
        model: named || null,
        model_requested: modelRequested,
        blocker:
          (named
            ? `the pin named the unpinned alias "${named}" rather than a version `
            : "the pin named no model version, so nothing about this judgment is ") +
          "reproducible (plan §8 P0.3(e))",
      };
    }
    const inputTokens = Number(wire.usage?.input_tokens) || 0;
    return {
      is_fallback: false,
      accepted: true,
      provider: wire.provider,
      model: named,
      model_requested: modelRequested,
      input_tokens: inputTokens,
      // D-13's rate, from the one module that owns it (shared with the worker).
      cost_usd: jevCostUsd(inputTokens),
      notes: wire.notes,
    };
  }
  return {
    is_fallback: true,
    accepted: false,
    provider: null,
    model_requested: modelRequested,
    blocker:
      (wire && wire.notes ? wire.notes.join("; ") : "") ||
      "no provider reachable",
    ...(wire && wire.notes ? { notes: wire.notes } : {}),
  };
}

export const RUN_CLASS_POLICY =
  "plan §8 P0.3(e): a provider error may be re-run once; a judgment may not.";

/**
 * Classify the run the report came from, so the re-run rule is readable from the
 * report instead of remembered from the plan.
 */
export function classifyRun({ attempted, accepted, hasKey = null } = {}) {
  if (attempted && accepted) {
    return {
      run_class: "judgment",
      rerun_allowed: false,
      policy: RUN_CLASS_POLICY,
    };
  }
  if (attempted) {
    return {
      run_class: "provider_error",
      rerun_allowed: true,
      policy: RUN_CLASS_POLICY,
    };
  }
  if (hasKey === false) {
    // Not a provider failure: a configuration gap. Re-running cannot conjure a
    // secret, so calling it re-runnable would invite a pointless retry loop.
    return {
      run_class: "no_key",
      rerun_allowed: false,
      policy: RUN_CLASS_POLICY,
    };
  }
  return {
    run_class: "not_attempted",
    rerun_allowed: false,
    policy: RUN_CLASS_POLICY,
  };
}

/**
 * Write the run's own facts onto the report — the live view, the run class, the
 * re-run permission, the evidence provenance, and the `--require-live` blocker.
 *
 * This lives here, in the pure core, rather than in the CLI because it is a rule
 * and not plumbing: ONE report must not be able to say "judgment" on one field
 * and "no judgment accepted" on another. A rehearsal caught exactly that — the
 * success path left `accepted` at its false default while `run_class` correctly
 * said "judgment".
 */
export function attachRunFacts(
  report,
  {
    liveMeta = {},
    attempted = false,
    hasKey = null,
    requireLive = false,
    evidence = null,
    evidenceSource = null,
  } = {},
) {
  const accepted = liveMeta.accepted === true;
  const live = {
    is_fallback: liveMeta.is_fallback !== false,
    accepted,
    model: liveMeta.model ?? null,
    model_requested: liveMeta.model_requested ?? JEV_MODEL_ALIAS,
    ...(liveMeta.blocker ? { blocker: liveMeta.blocker } : {}),
    ...(liveMeta.input_tokens != null
      ? { input_tokens: liveMeta.input_tokens }
      : {}),
    ...(liveMeta.cost_usd != null ? { cost_usd: liveMeta.cost_usd } : {}),
  };
  const classified = classifyRun({ attempted, accepted, hasKey });
  report.live_jev = { ...liveMeta, ...live };
  // The scorer owns `report.live` (what the judge said); these four fields are
  // the run's, and they are written from `live` above rather than recomputed, so
  // the two views can never disagree about whether a judgment was made.
  report.live = {
    ...(report.live || {}),
    is_fallback: live.is_fallback,
    accepted: live.accepted,
    model: live.model,
    model_requested: live.model_requested,
  };
  report.evidence_source = evidenceSource;
  // No evidence file at all is its own state: "hand-maintained" would imply
  // somebody maintained it, while the run records then default red.
  report.evidence_source_kind = evidenceSourceKind(evidence);
  report.run_class = classified.run_class;
  report.rerun_allowed = classified.rerun_allowed;
  report.rerun_policy = classified.policy;
  if (requireLive && !accepted) {
    // Fail closed: --require-live means this verdict only counts if a pinned
    // live judgment made it. Without one there is no verdict, whatever the
    // heuristic floors say.
    report.blockers.push(
      `--require-live: no accepted live judgment (${
        liveMeta.blocker || "none was attempted"
      }). A gate result without one is not a gate result.`,
    );
  }
  return report;
}

/** The exit code: the gate's own verdict, and --require-live can only subtract. */
export function gateExitCode({ gatePassed, accepted, requireLive }) {
  return gatePassed && !(requireLive && !accepted) ? 0 : 1;
}
