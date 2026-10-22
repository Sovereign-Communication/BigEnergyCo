import assert from "node:assert/strict";
import { test } from "node:test";
import { liveJevComprehensionCall } from "../scripts/lib/jev-live.mjs";
import {
  Q12_EXPECTED,
  Q12_LOCALES,
  Q12_QUESTIONS,
  gradeQ12Answers,
} from "../scripts/lib/jev-comprehension.mjs";

test("Q-12 keeps the canonical six-locale, three-question scope", () => {
  assert.deepEqual(Q12_LOCALES, ["en", "es", "pt", "fr", "de", "ar"]);
  assert.deepEqual(Object.keys(Q12_QUESTIONS), [
    "billCut",
    "installerGap",
    "breakEvenYear",
  ]);
  assert.equal(Object.keys(Q12_EXPECTED).length, 3);
});

test("Q-12 grades only exact Jev choices and requires all three", () => {
  const good = gradeQ12Answers({
    billCut: { choice: "result_84", confidence: 0.91 },
    installerGap: { choice: "gap_5968", confidence: 0.87 },
    breakEvenYear: { choice: "recommended_year_3", confidence: 0.95 },
  });
  assert.equal(good.passed, true);
  assert.equal(good.correct, 3);
  assert.equal(good.total, 3);

  const oneWrong = gradeQ12Answers({
    billCut: { choice: "target_80" },
    installerGap: { choice: "gap_5968" },
    breakEvenYear: { choice: "recommended_year_3" },
  });
  assert.equal(oneWrong.passed, false);
  assert.equal(oneWrong.correct, 2);
});

test("Q-12 sends the accessibility snapshot verbatim as the entire TypeSafe state", async (t) => {
  const snapshot =
    '- heading "Résultat : 84 %"\n- paragraph: "Écart sur 20 ans : 5 968 $"';
  let request;
  let calls = 0;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls++;
    request = { url, options, body: JSON.parse(options.body) };
    return new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        answers: {},
        usage: { input_tokens: 12, output_tokens: 3 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await liveJevComprehensionCall(snapshot, Q12_QUESTIONS, {
    typesafeKey: "test-key",
  });
  assert.equal(request.url, "https://api.typesafe.ai/v1/systemone");
  assert.equal(calls, 1, "the direct probe must not retry or fail over");
  assert.deepEqual(Object.keys(request.body).sort(), [
    "model",
    "questions",
    "state",
  ]);
  assert.equal(request.body.state, snapshot);
  assert.deepEqual(request.body.questions, Q12_QUESTIONS);
  assert.equal(result.provider, "typesafe");
  assert.equal(result.model, "jev-1.13.0");
});

test("Q-12 refuses empty accessibility text without a network request", async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    calls++;
    throw new Error("must not run");
  };

  const result = await liveJevComprehensionCall("  ", Q12_QUESTIONS, {
    typesafeKey: "test-key",
  });
  assert.equal(calls, 0);
  assert.equal(result.answers, null);
  assert.match(result.notes[0], /accessibility-tree text is empty/);
});
