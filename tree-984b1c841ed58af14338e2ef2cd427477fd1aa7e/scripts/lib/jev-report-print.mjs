// How a report reads to a person.
//
// One concern, and it is the only presentation code in the gate: it takes the
// report object and writes lines. It reads no state of its own, computes
// nothing that the report does not already say, and the JSON path
// (`--json`) bypasses it entirely — so the numbers a reviewer reads on a
// terminal come from the same object the artifact carries, with no second
// opinion.
//
// A SCOPED RUN IS A DIFFERENT VERDICT, AND IT USED TO READ LIKE THE OTHER ONE.
// `--scope P0.4` decides the exit code from four facets; the whole program is
// twenty-one. The old layout printed the whole-program score first, under the
// bare word "score", listed every facet below the bar under "blocking", and
// buried the scoped verdict in the middle — so a reader saw five P2/P4/P5/P8
// facets listed as the blockers of a P0.4 PR, with nothing in the output to
// say that none of them had anything to do with the exit. Running the real
// verdict function against a real CI report proved they contribute nothing to
// a scoped pass; this file now has to say so, because a gate whose own output
// misstates why it failed is a gate people stop reading.
//
// So on a scoped run: the scope is named before any number, the scoped verdict
// is printed first as the verdict, the conditions that decided the exit are
// laid out from the fields the scoped block already carries, and the
// whole-program figures follow under a heading that says outright they were
// not judged. Nothing is dropped — a reviewer who wants the whole program
// still gets all of it, correctly labelled. On a WHOLE-PROGRAM run the output
// is byte-for-byte what it always was; `tests/jev-report-print.test.mjs` pins
// that against the committed implementation, because a program-exit report
// that quietly changed shape is its own kind of regression.
export function printReport(report, out = process.stdout) {
  const write = (s) => out.write(s);
  const bar = (ok) => (ok ? "PASS" : "FAIL");
  const scoped = report.scoped || null;
  const inScope = scoped ? new Set(scoped.facets) : null;
  const scopeOf = (axis) =>
    !inScope ? "" : inScope.has(axis) ? " [in scope]" : " [out of scope]";
  const total = Object.keys(report.facets).length;

  write(`\n=== Jev complete gate: ${report.target} ===\n`);

  if (scoped) {
    // Named before any number, so nothing below can be mistaken for the
    // verdict by accident.
    write(
      `scope: ${scoped.scope} — THIS RUN'S VERDICT IS THE SCOPED ONE below.\n`,
    );
    write(
      `        The whole-program numbers further down are reported, not judged.\n\n`,
    );
    write(
      `scoped (${scoped.scope}): ${scoped.score.toFixed(2)} / 100  (target ${scoped.min_score})  [${bar(scoped.pass)}]\n`,
    );
    write(
      `  facets in scope (${scoped.facets.length}): ${scoped.facets.join(", ")}\n`,
    );
    write(
      `  short of proven (${scoped.facets_short_of_proven.length}): ${
        scoped.facets_short_of_proven.length
          ? scoped.facets_short_of_proven.join(", ")
          : "none"
      }\n`,
    );
    write(`  decided this run's exit code:\n`);
    // The same conjunction scripts/lib/jev-verdict.mjs evaluates, laid out
    // from the fields it already returns. The last two bind only from
    // COMPLETE_EXIT_RULE_FROM, and the block says whether that is this run.
    const line = (ok, text) => write(`    ${ok ? "✓" : "✗"} ${text}\n`);
    line(report.hard_gates_passed, "hard gates passed");
    line(scoped.ratchet.status === "met", `ratchet ${scoped.ratchet.status}`);
    if (scoped.exit_rule_binding) {
      line(
        scoped.score >= scoped.min_score,
        `score ${scoped.score.toFixed(2)} >= ${scoped.min_score}`,
      );
      line(
        scoped.facets_short_of_proven.length === 0,
        "every in-scope facet proven",
      );
    } else {
      write(
        `    · the >= ${scoped.min_score} and all-proven rules do not bind at ` +
          `${scoped.scope} (they bind from ${scoped.exit_rule_binds_from})\n`,
      );
    }
    for (const r of scoped.ratchet.regressions || []) {
      write(
        `      regression: ${r.axis} ${r.previous_ordinal} -> ${r.current_ordinal}\n`,
      );
    }
    write(
      `\nwhole program (reported only — NOT this run's exit criterion): ` +
        `${report.score.toFixed(2)} / 100  (target ${report.min_score})  [${bar(report.pass)}]\n`,
    );
    write(
      `  mechanical: ${report.mechanical_score}  semantic: ${report.semantic_score}\n`,
    );
    if (report.blocking_facets.length) {
      // Partitioned, not relabelled: an in-scope facet can be blocking too, and
      // claiming "all out of scope" when one is not would be a new claim.
      const inS = report.blocking_facets.filter((a) => inScope.has(a));
      const outS = report.blocking_facets.filter((a) => !inScope.has(a));
      if (inS.length) {
        write(`  blocking, in ${scoped.scope} scope: ${inS.join(", ")}\n`);
      }
      write(
        `  blocking, out of ${scoped.scope} scope (${outS.length}): ${
          outS.length ? outS.join(", ") : "none"
        }\n`,
      );
    }
    if (report.facets_not_proven && report.facets_not_proven.length) {
      write(
        `  not proven, whole program (${report.facets_not_proven.length}/${total}): ${report.facets_not_proven.join(", ")}\n`,
      );
    }
  } else {
    write(
      `score: ${report.score.toFixed(2)} / 100  (target ${report.min_score})  [${bar(report.pass)}]\n`,
    );
    write(
      `mechanical: ${report.mechanical_score}  semantic: ${report.semantic_score}\n`,
    );
  }

  write(`hard gates:\n`);
  for (const [k, v] of Object.entries(report.hard_gates)) {
    write(`  ${v ? "✓" : "✗"} ${k}\n`);
  }
  write(`facets (${total}):\n`);
  for (const [axis, f] of Object.entries(report.facets)) {
    const mark = f.index <= 0 ? "✗" : f.index < 3 ? "·" : "✓";
    write(
      `  ${mark} ${axis.padEnd(14)} ${f.level}  (ordinal ${f.ordinal}, ${f.source})${scopeOf(axis)}\n`,
    );
  }

  // On a whole-program run these two stay exactly where they always were,
  // unindented and after the facet list.
  if (!scoped) {
    if (report.blocking_facets.length) {
      write(`blocking: ${report.blocking_facets.join(", ")}\n`);
    }
    if (report.facets_not_proven && report.facets_not_proven.length) {
      write(
        `not proven (${report.facets_not_proven.length}/${total}): ${report.facets_not_proven.join(", ")}\n`,
      );
    }
  }

  if (report.required_work.length) {
    write(`required work (by severity):\n`);
    for (const item of report.required_work) {
      const star = item.primary ? "*" : " ";
      write(
        `  ${star} [${item.bucket}] ${item.label} — ${item.work_type}${scopeOf(item.axis)}\n` +
          `      ${item.suggested_next_action}\n`,
      );
    }
    write(`recommended actions by work type:\n`);
    for (const [workType, items] of Object.entries(
      report.recommended_actions,
    )) {
      write(`  ${workType} (${items.length}):\n`);
      for (const it of items) write(`    - ${it.suggested_next_action}\n`);
    }
  } else {
    write(`required work: none — every facet at or above the bar\n`);
  }
  if (report.blockers.length) {
    write(
      scoped
        ? `blockers (whole program — the scoped verdict above is what decided this run):\n`
        : `blockers:\n`,
    );
    for (const b of report.blockers) write(`  - ${b}\n`);
  }
  const live = report.live_jev || {};
  write(
    `live: provider=${live.provider || "none"} fallback=${live.is_fallback}` +
      (live.blocker ? ` blocker: ${live.blocker}` : "") +
      (live.cost_usd != null ? ` cost=$${live.cost_usd.toFixed(6)}` : "") +
      "\n",
  );
  write(`\n`);
}

// ── Score explanation ──────────────────────────────────────────────────────
// WHY THIS EXISTS. `printReport` above says WHAT failed; on a red gate the
// next question is always "why is the score low and where do I focus", and
// answering it used to mean downloading the artifact and reading JSON. The
// explanation below is built by scripts/lib/jev-explain.mjs — a pure function
// of the report and the evidence — so these two functions stay presentation
// only: they arrange fields that already exist, and invent no buckets, no
// reasons, and no actions.

function explanationLines(expl, md) {
  const lines = [];
  const b = (s) => (md ? `**${s}**` : s);
  const code = (s) => (md ? `\`${s}\`` : s);
  lines.push(
    md
      ? `## Why the score is ${expl.score} (target ${expl.target})`
      : `why the score is ${expl.score} (target ${expl.target}):`,
  );
  if (expl.scoped) {
    const s = expl.scoped;
    const shorts = s.short_of_proven
      .map((f) => `${code(f.axis)} (${f.level})`)
      .join(", ");
    lines.push(
      md
        ? `**Scoped gate (${s.scope}): ${s.score}/${s.target} — ${s.gap} points short.** ` +
            `Short of proven: ${shorts || "none"}. Ratchet: ${s.ratchet}.`
        : `  scoped (${s.scope}): ${s.score}/${s.target}, ${s.gap} short — ` +
            `short of proven: ${shorts || "none"}; ratchet: ${s.ratchet}`,
    );
    for (const f of s.short_of_proven) {
      lines.push(
        md
          ? `- ${code(f.axis)}: ${f.level} (ordinal ${f.ordinal}, ${f.source})`
          : `    - ${f.axis}: ${f.level} (ordinal ${f.ordinal}, ${f.source})`,
      );
      for (const r of f.reasons)
        lines.push(md ? `  - _why:_ ${r}` : `        why: ${r}`);
      if (f.proof)
        lines.push(
          md
            ? `  - _what the judge saw:_ "${f.proof}"`
            : `        judge saw: "${f.proof}"`,
        );
    }
  }
  expl.buckets.forEach((bucket, i) => {
    const head = md
      ? `### ${i + 1}. ${bucket.primary ? "⭐ PRIMARY " : ""}${code(bucket.bucket)} — ${bucket.label} _(work type: ${bucket.work_type})_`
      : `  ${i + 1}. ${bucket.primary ? "*PRIMARY* " : ""}[${bucket.bucket}] ${bucket.label} (${bucket.work_type})`;
    lines.push(head);
    for (const f of bucket.facets) {
      const name = f.axis || "hard gate";
      lines.push(
        md
          ? `- ${b(name)}: ${f.level} (ordinal ${f.ordinal}, source: ${f.source})`
          : `    - ${name}: ${f.level} (ordinal ${f.ordinal}, source: ${f.source})`,
      );
      for (const r of f.reasons)
        lines.push(md ? `  - _why:_ ${r}` : `        why: ${r}`);
      if (f.proof)
        lines.push(
          md
            ? `  - _what the judge saw:_ "${f.proof}"`
            : `        judge saw: "${f.proof}"`,
        );
    }
    lines.push(
      md ? `- **Focus:** ${bucket.focus}` : `    focus: ${bucket.focus}`,
    );
  });
  return lines;
}

/**
 * Console rendering of a score explanation (goes to the job log, right
 * after printReport, when the verdict failed).
 */
export function printExplanation(explanation, out = process.stdout) {
  const write = (s) => out.write(s);
  write(`\n`);
  for (const line of explanationLines(explanation, false)) write(`${line}\n`);
}

/**
 * Markdown rendering of a score explanation (written to a file the workflow
 * appends to $GITHUB_STEP_SUMMARY, so the buckets read on the run page
 * itself — no artifact download needed to learn where to focus).
 */
export function renderExplanationMarkdown(explanation) {
  return explanationLines(explanation, true).join("\n") + "\n";
}
