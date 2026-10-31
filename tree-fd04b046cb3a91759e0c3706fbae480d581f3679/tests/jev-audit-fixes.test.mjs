// Jev-audit-backed fixes: validate-early guards. Run: node --test tests/
// Covers the audit findings applied to PR #171's quality gap:
// - charts.js::drawSunStrip (validate-early, 0.82)
// - frontier-chart.js::textWidth (validate-early, 0.92)
// (engine.js::downsampleEnvelope tests live in tests/engine.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSunStrip } from "../assets/js/sizing/charts.js";
import { textWidth } from "../assets/js/sizing/frontier-chart.js";


// ── drawSunStrip ──────────────────────────────────────────────────────────

// Minimal canvas-2d mock: records calls, never throws.
function mockCtx() {
  const calls = [];
  return {
    calls,
    save() { calls.push("save"); },
    beginPath() { calls.push("beginPath"); },
    rect() { calls.push("rect"); },
    clip() { calls.push("clip"); },
    moveTo() { calls.push("moveTo"); },
    lineTo() { calls.push("lineTo"); },
    closePath() { calls.push("closePath"); },
    fill() { calls.push("fill"); },
    stroke() { calls.push("stroke"); },
    restore() { calls.push("restore"); },
    fillText() { calls.push("fillText"); },
    set font(v) { calls.push(`font=${v}`); },
    set lineWidth(v) { calls.push(`lineWidth=${v}`); },
    set strokeStyle(v) { calls.push(`strokeStyle=${v}`); },
    set textAlign(v) { calls.push(`textAlign=${v}`); },
    set globalAlpha(v) { calls.push(`globalAlpha=${v}`); },
    set fillStyle(v) { calls.push(`fillStyle=${v}`); },
  };
}

const X = (i) => i * 10;

test("drawSunStrip: null pv returns early without throwing", () => {
  const ctx = mockCtx();
  assert.doesNotThrow(() => drawSunStrip(ctx, null, X, 100, 5, 5, 40));
  assert.deepEqual(ctx.calls, []);
});

test("drawSunStrip: undefined pv returns early without throwing", () => {
  const ctx = mockCtx();
  assert.doesNotThrow(() => drawSunStrip(ctx, undefined, X, 100, 5, 5, 40));
  assert.deepEqual(ctx.calls, []);
});

test("drawSunStrip: empty pv returns early without throwing", () => {
  const ctx = mockCtx();
  assert.doesNotThrow(() => drawSunStrip(ctx, [], X, 100, 5, 5, 40));
  assert.deepEqual(ctx.calls, []);
});

test("drawSunStrip: null ctx returns early without throwing", () => {
  assert.doesNotThrow(() => drawSunStrip(null, [1, 2, 3], X, 100, 5, 5, 40));
});

test("drawSunStrip: valid input draws the strip", () => {
  const ctx = mockCtx();
  drawSunStrip(ctx, [1, 2, 3, 4], X, 100, 5, 5, 40);
  assert.ok(ctx.calls.includes("save"));
  assert.ok(ctx.calls.includes("clip"));
  assert.ok(ctx.calls.includes("fill"));
  // 4 data points → 4 lineTo calls for the curve, plus closing
  const lineTos = ctx.calls.filter((c) => c === "lineTo").length;
  assert.ok(lineTos >= 4, `expected >=4 lineTo, got ${lineTos}`);
});

// ── textWidth ─────────────────────────────────────────────────────────────

test("textWidth: basic width calculation", () => {
  // "hello" = 5 chars × 10px × 0.55 ≈ 27.5 (float arithmetic)
  const w = textWidth("hello", 10);
  assert.ok(Math.abs(w - 27.5) < 1e-9, `expected ≈27.5, got ${w}`);
});

test("textWidth: undefined fontSize returns 0, not NaN", () => {
  const w = textWidth("hello", undefined);
  assert.equal(w, 0);
  assert.ok(!Number.isNaN(w));
});

test("textWidth: NaN fontSize returns 0, not NaN", () => {
  const w = textWidth("hello", NaN);
  assert.equal(w, 0);
  assert.ok(!Number.isNaN(w));
});

test("textWidth: zero/negative fontSize returns 0", () => {
  assert.equal(textWidth("hello", 0), 0);
  assert.equal(textWidth("hello", -5), 0);
});

test("textWidth: non-string input is coerced, never NaN", () => {
  const w = textWidth(null, 10);
  assert.ok(Number.isFinite(w), `expected finite, got ${w}`);
});
