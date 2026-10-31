
# ---- HV-4: stage composition and the planning waist contract -------------
#
# Composition is a *selection* concern, not a reimplementation: the brief
# schema stays with ``brief``, the token arithmetic with ``token_budget``,
# plan validation with ``dag``, and Jev's dimensions with ``jev_policy``.
# This section only decides WHICH stages run, what each one may spend, and
# what the planning waist is allowed to emit.

STAGE_CONTEXT = "context"
STAGE_PLANNING = "planning"
STAGE_EXECUTION = "execution"
STAGE_VERIFICATION = "verification"
STAGE_ORDER = (STAGE_CONTEXT, STAGE_PLANNING,
               STAGE_EXECUTION, STAGE_VERIFICATION)
# Hourglass compatibility: with nothing declared, every stage runs, exactly
# as the lanes behaved before composition was selectable.
HOURGLASS_DEFAULT_STAGES = STAGE_ORDER

# A supplied artifact means its stage already happened upstream. Composition
# records the bypass instead of silently re-running or silently dropping it.
STAGE_BYPASS_REASONS = {
    STAGE_CONTEXT: "a brief was supplied; intake already ran",
    STAGE_PLANNING: "a plan was supplied; decomposition already ran",
}

# Successive stages plan over less than the one before: the brief is curated
# down as it is consumed, so a later stage's ceiling is the earlier stage's
# smaller share. This is a *narrowing* factor applied on top of the run
# budget, never a budget of its own.
STAGE_INPUT_DECAY = 0.5
STAGE_OUTPUT_DECAY = 0.5
MIN_STAGE_INPUT_TOKENS = 1024
MIN_STAGE_OUTPUT_TOKENS = 256

# The planning waist may stop, plan, ask, or defer -- and nothing else.
OUTCOME_SUFFICIENT = "sufficient"
OUTCOME_PLAN = "plan"
OUTCOME_EVIDENCE_REQUEST = "evidence_request"
OUTCOME_DEFER = "defer"
PLAN_OUTCOMES = (OUTCOME_SUFFICIENT, OUTCOME_PLAN,
                 OUTCOME_EVIDENCE_REQUEST, OUTCOME_DEFER)

MAX_EVIDENCE_QUESTIONS = 5
MAX_EVIDENCE_QUESTION_CHARS = 400
MAX_EVIDENCE_REQUEST_CHARS = MAX_EVIDENCE_QUESTIONS * MAX_EVIDENCE_QUESTION_CHARS
MAX_DEFER_REASON_CHARS = 400


def resolve_stages(declared: Optional[Sequence[str]] = None, *,
                   supplied_brief: bool = False,
                   supplied_plan: bool = False
                   ) -> Dict[str, Any]:
    """Select the stages that will actually run, in pipeline order.

    ``declared`` is the operator's (or config's) subset of ``STAGE_ORDER``;
    ``None`` keeps the Hourglass default of every stage. Order is the
    pipeline's, not the caller's -- a caller may drop a stage, never reorder
    one into a shape the lanes do not support.

    A supplied brief or plan bypasses the stage that would have produced it
    (see ``STAGE_BYPASS_REASONS``), which is how a caller reuses upstream
    work without paying for intake or decomposition twice. The bypass is
    returned, not hidden: a stage that did not run is visible evidence.
    """
    if declared is None:
        wanted = list(HOURGLASS_DEFAULT_STAGES)
    else:
        if isinstance(declared, str):
            raise HarnessError(
                "declared stages must be a sequence of stage names, not a "
                "string: {0!r}".format(declared))
        wanted = []
        for name in declared:
            stage = str(name or "").strip().lower()
            if not stage:
                raise HarnessError("declared stage names cannot be blank")
            if stage not in STAGE_ORDER:
                raise HarnessError(
                    "unknown stage {0!r}; the composable stages are {1}"
                    .format(stage, ", ".join(STAGE_ORDER)))
            if stage in wanted:
                raise HarnessError(
                    "stage {0!r} is declared twice; each stage composes at "
                    "most once per run".format(stage))
            wanted.append(stage)

    bypassed: Dict[str, str] = {}
    if supplied_brief and STAGE_CONTEXT in wanted:
        bypassed[STAGE_CONTEXT] = STAGE_BYPASS_REASONS[STAGE_CONTEXT]
    if supplied_plan and STAGE_PLANNING in wanted:
        bypassed[STAGE_PLANNING] = STAGE_BYPASS_REASONS[STAGE_PLANNING]

    stages = [s for s in STAGE_ORDER if s in wanted and s not in bypassed]
    return {"stages": stages, "bypassed": bypassed,
            "declared": list(wanted)}


def _narrow(previous: int, factor: float, floor: int) -> int:
    """The next stage's ceiling: strictly smaller, never larger."""
    nxt = int(previous * factor)
    if nxt >= previous:
        nxt = previous - 1
    if previous < floor:
        return max(1, nxt)
    return max(floor, nxt)


def compose_stages(*, budget, declared: Optional[Sequence[str]] = None,
                   supplied_brief: bool = False, supplied_plan: bool = False,
                   brief_tokens: Optional[int] = None) -> Dict[str, Any]:
    """Compose the run's stages against ONE ``TokenBudget`` (HV-3).

    ``budget`` is the run's own budget object -- composition never invents an
    allowance, it only asks each stage to narrow the one above it, which is
    what makes "a stage cannot raise its own limits" a structural property
    rather than a promise. Successive stages get strictly smaller ceilings,
    and when the caller measured the curated brief it just produced
    (``brief_tokens``) each later stage is additionally capped at that brief,
    so planning is preflighted against the evidence it will actually read.

    Returns the stage list, the bypassed stages with their reasons, and each
    stage's child budget, so a caller reserves from exactly the right one.
    """
    if budget is None:
        raise HarnessError(
            "stage composition needs the run's TokenBudget; it does not "
            "create one (harness/token_budget.py is the one owner)")
    selection = resolve_stages(declared, supplied_brief=supplied_brief,
                               supplied_plan=supplied_plan)
    if brief_tokens is not None:
        brief_tokens = int(brief_tokens)
        if brief_tokens < 0:
            raise HarnessError(
                "brief_tokens cannot be negative: {0}".format(brief_tokens))

    stages: List[Dict[str, Any]] = []
    prev_in = budget.max_input_tokens
    prev_out = budget.max_output_tokens
    for stage in selection["stages"]:
        if not stages:
            # The first stage inherits the run's own ceilings; it is the
            # parent, so it cannot exceed them by construction.
            want_in, want_out = prev_in, prev_out
        else:
            want_in = _narrow(prev_in, STAGE_INPUT_DECAY,
                              MIN_STAGE_INPUT_TOKENS)
            want_out = _narrow(prev_out, STAGE_OUTPUT_DECAY,
                               MIN_STAGE_OUTPUT_TOKENS)
            if brief_tokens is not None:
                # Plan over the brief that exists, not over a guess of it.
                want_in = min(want_in,
                              max(brief_tokens, MIN_STAGE_INPUT_TOKENS))
        if want_in > prev_in or want_out > prev_out:
            raise HarnessError(
                "stage {0!r} asked for ({1}, {2}) above its own ceiling "
                "({3}, {4}); a stage may not raise its own limits"
                .format(stage, want_in, want_out, prev_in, prev_out))
        child = budget.stage(stage, max_input_tokens=want_in,
                             max_output_tokens=want_out)
        stages.append({"stage": stage, "budget": child,
                       "max_input_tokens": want_in,
                       "max_output_tokens": want_out})
        prev_in, prev_out = want_in, want_out

    return {"stages": stages, "bypassed": selection["bypassed"],
            "declared": selection["declared"],
            "run_budget": budget.label}


def stage_budget(composition: Dict[str, Any], stage: str):
    """The child budget for one stage, or ``None`` when it did not run."""
    for entry in composition.get("stages") or []:
        if entry.get("stage") == stage:
            return entry.get("budget")
    return None


def plan_outcome(kind: str, *, plan: Optional[Dict[str, Any]] = None,
                 questions: Optional[Sequence[str]] = None,
                 reason: Optional[str] = None) -> Dict[str, Any]:
    """The planning waist's terminal contract, fail-closed on every branch.

    Planning either stops (``sufficient``), emits a validated bounded plan,
    asks a bounded evidence request, or defers honestly. A plan is validated
    by ``dag.TaskDAG`` -- the one owner -- so composition cannot bless a DAG
    the executor would reject. A defer must say why: a silent empty plan is
    not an outcome, it is a swallowed failure.
    """
    outcome = str(kind or "").strip().lower()
    if outcome not in PLAN_OUTCOMES:
        raise HarnessError(
            "unknown planning outcome {0!r}; the waist may only stop, plan, "
            "request evidence, or defer".format(kind))
    if outcome == OUTCOME_SUFFICIENT:
        return {"outcome": OUTCOME_SUFFICIENT}
    if outcome == OUTCOME_PLAN:
        if not isinstance(plan, dict) or not plan.get("nodes"):
            raise HarnessError(
                "a plan outcome must carry a non-empty plan; an empty plan is "
                "a defer with a reason, not a plan")
        dag = TaskDAG.from_dict(plan)  # validates; raises on a bad DAG
        return {"outcome": OUTCOME_PLAN, "plan": dag.to_dict()}
    if outcome == OUTCOME_EVIDENCE_REQUEST:
        asked = [str(q or "").strip() for q in (questions or [])]
        asked = [q for q in asked if q]
        if not asked:
            raise HarnessError(
                "an evidence request must actually ask something; use a defer "
                "with a reason when there is nothing to ask about")
        if len(asked) > MAX_EVIDENCE_QUESTIONS:
            raise HarnessError(
                "evidence request asks {0} questions, over the bound of {1}"
                .format(len(asked), MAX_EVIDENCE_QUESTIONS))
        for question in asked:
            if len(question) > MAX_EVIDENCE_QUESTION_CHARS:
                raise HarnessError(
                    "evidence question is {0} chars, over the bound of {1}"
                    .format(len(question), MAX_EVIDENCE_QUESTION_CHARS))
        if sum(len(q) for q in asked) > MAX_EVIDENCE_REQUEST_CHARS:
            raise HarnessError(
                "evidence request is over its total character bound")
        return {"outcome": OUTCOME_EVIDENCE_REQUEST, "questions": asked}
    why = str(reason or "").strip()
    if not why:
        raise HarnessError(
            "a defer must state why it deferred; an unexplained defer is a "
            "silent failure")
    if len(why) > MAX_DEFER_REASON_CHARS:
        raise HarnessError(
            "defer reason is {0} chars, over the bound of {1}"
            .format(len(why), MAX_DEFER_REASON_CHARS))
    return {"outcome": OUTCOME_DEFER, "reason": why}
