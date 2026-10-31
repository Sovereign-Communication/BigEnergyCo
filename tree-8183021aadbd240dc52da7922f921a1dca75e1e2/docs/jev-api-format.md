# Jev API Format — Lessons Learned

Canonical reference for calling the TypeSafe Jev API (`POST https://api.typesafe.ai/v1/systemone`).
Learned 2026-10-18 from live iteration; these mistakes cost real debugging time.

## Request structure

```json
{
  "model": "jev-latest",
  "state": "<the document to assess, as a string>",
  "questions": {
    "facet_name": {
      "type": "score",
      "instructions": "How...?",
      "criteria": ["...", "...", "...", "..."]
    }
  }
}
```

## Hard rules

1. **Score `criteria` is a LIST**, not a dict. A dict (`{"0": "...", "1": "..."}`) returns HTTP 422.
   Choice `criteria` is a DICT. Noul `criteria` is `{"true": "...", "false": "..."}`.
2. **UUID nonce goes INSIDE `state`**, not as a top-level field. A top-level `nonce` returns HTTP 400.
   Include it in the state string or object to prevent response caching.
3. **≤5 levels** in a score question's criteria array. The API rejects more.
4. **Top-level `model` and `state` are required.** `model: "jev-latest"` is the standard pin.
5. **Response uses `answers` key**, not `questions`. Score is `0..(n-1)`; with 4 levels, percent = score/3×100.

## Call pattern

Sequential Noul → Score → Choice beats batching. Ask Noul "Is [X] the reason for [Y]?"
for deferral rationale. Ask Jev about itself via Choice (confidence 0.91–0.92 observed).

## Plan scoring

Score a plan AS a plan — plan-quality aspects (completeness, soundness, risk_coverage,
examples_sufficient) CAN reach 90+. Never use predictive aspects ("will this work")
as gate criteria — they plateau below 90 by design.
