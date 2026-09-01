import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchHourlySeries, FETCH_TIMEOUT_MS } from "../assets/js/sizing/nasa.js";

// A fetch that never settles on its own but rejects when its abort signal
// fires — exactly how the real browser fetch behaves.
const hangingFetch = () => (url, init) => new Promise((resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
});

test("NASA fetch honors the timeout: a hung request aborts with a clear error", async () => {
  await assert.rejects(
    fetchHourlySeries({ latitude: 21.31, longitude: -157.86, years: 1, fetchImpl: hangingFetch(), timeoutMs: 80 }),
    /timed out/,
    "a silent NASA request must not hold the sizing hostage forever"
  );
});

test("FETCH_TIMEOUT_MS is sane (20-90s)", () => {
  assert.ok(FETCH_TIMEOUT_MS >= 20000 && FETCH_TIMEOUT_MS <= 90000);
});