// Q-12's fixed answer set for the Honolulu 10 kWh/day result-page probe.
// The alternatives deliberately include nearby values visible on the same
// result page, so the reader has to distinguish the headline, 20-year route
// gap, and recommended system from the target, upfront-only gap, and payment
// route break-even years.
export const Q12_LOCALES = Object.freeze(["en", "es", "pt", "fr", "de", "ar"]);

export const Q12_QUESTIONS = Object.freeze({
  billCut: Object.freeze({
    type: "choice",
    instructions:
      "Which percentage does the main result headline say it removes from the electric bill over 20 years? Choose the headline result, not the target or an option-matrix percentage.",
    criteria: Object.freeze({
      result_84: "84%",
      target_80: "80%",
      option_85: "85%",
      other: "another percentage or not stated",
    }),
  }),
  installerGap: Object.freeze({
    type: "choice",
    instructions:
      "Over 20 years, how much cheaper is the 'You buy the parts' route than the 'Installer, turnkey' route? Use the difference between those route cards, not the separate upfront-only quote gap.",
    criteria: Object.freeze({
      gap_5968: "$5,968",
      upfront_gap_4968: "$4,968",
      other: "another amount or not stated",
    }),
  }),
  breakEvenYear: Object.freeze({
    type: "choice",
    instructions:
      "What break-even year does the main result give for the recommended system? Do not use the separate break-even years for the installer and self-purchase payment routes.",
    criteria: Object.freeze({
      recommended_year_3: "Year 3",
      self_purchase_year_6: "Year 6",
      installer_year_10: "Year 10",
      other: "another year or not stated",
    }),
  }),
});

export const Q12_EXPECTED = Object.freeze({
  billCut: "result_84",
  installerGap: "gap_5968",
  breakEvenYear: "recommended_year_3",
});

/** Grade only Jev's three structured answer choices; translation quality is out of scope. */
export function gradeQ12Answers(answers) {
  const checks = Object.entries(Q12_EXPECTED).map(([id, expected]) => {
    const actual = answers?.[id]?.choice;
    return {
      id,
      expected,
      actual: typeof actual === "string" ? actual : null,
      confidence: Number.isFinite(answers?.[id]?.confidence)
        ? answers[id].confidence
        : null,
      correct: actual === expected,
    };
  });
  const correct = checks.filter((check) => check.correct).length;
  return {
    checks,
    correct,
    total: checks.length,
    passed: correct === checks.length,
  };
}
