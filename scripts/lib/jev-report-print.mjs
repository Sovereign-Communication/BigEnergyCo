// How a report reads to a person.
//
// One concern, and it is the only presentation code in the gate: it takes the
// report object and writes lines. It reads no state of its own, computes
// nothing that the report does not already say, and the JSON path
// (`--json`) bypasses it entirely — so the numbers a reviewer reads on a
// terminal come from the same object the artifact carries, with no second
// opinion.
export function printReport(report, out = process.stdout) {
  const write = (s) => out.write(s);
  const bar = (ok) => (ok ? "PASS" : "FAIL");
  write(`\n=== Jev complete gate: ${report.target} ===\n`);
  write(
    `score: ${report.score.toFixed(2)} / 100  (target ${report.min_score})  [${bar(report.pass)}]\n`,
  );
  write(
    `mechanical: ${report.mechanical_score}  semantic: ${report.semantic_score}\n`,
  );
  write(`hard gates:\n`);
  for (const [k, v] of Object.entries(report.hard_gates)) {
    write(`  ${v ? "✓" : "✗"} ${k}\n`);
  }
  write(`facets (${Object.keys(report.facets).length}):\n`);
  for (const [axis, f] of Object.entries(report.facets)) {
    const mark = f.index <= 0 ? "✗" : f.index < 3 ? "·" : "✓";
    write(
      `  ${mark} ${axis.padEnd(14)} ${f.level}  (ordinal ${f.ordinal}, ${f.source})\n`,
    );
  }
  if (report.blocking_facets.length) {
    write(`blocking: ${report.blocking_facets.join(", ")}\n`);
  }
  if (report.facets_not_proven && report.facets_not_proven.length) {
    write(
      `not proven (${report.facets_not_proven.length}/${Object.keys(report.facets).length}): ${report.facets_not_proven.join(", ")}\n`,
    );
  }
  if (report.scoped) {
    const s = report.scoped;
    write(
      `\nscoped (${s.scope}): ${s.score.toFixed(2)} / 100  (target ${s.min_score})  [${bar(s.pass)}]\n`,
    );
    write(`  facets in scope: ${s.facets.join(", ")}\n`);
    write(
      `  short of proven: ${s.facets_short_of_proven.length ? s.facets_short_of_proven.join(", ") : "none"}\n`,
    );
    write(
      `  ratchet: ${s.ratchet.status}${
        s.ratchet.regressions && s.ratchet.regressions.length
          ? ` — ${s.ratchet.regressions.length} regression(s): ` +
            s.ratchet.regressions
              .map(
                (r) => `${r.axis} ${r.previous_ordinal}->${r.current_ordinal}`,
              )
              .join(", ")
          : ""
      }\n`,
    );
  }
  if (report.required_work.length) {
    write(`required work (by severity):\n`);
    for (const item of report.required_work) {
      const star = item.primary ? "*" : " ";
      write(
        `  ${star} [${item.bucket}] ${item.label} — ${item.work_type}\n` +
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
    write(`blockers:\n`);
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
