// Regression: a price that cannot be a price must never be silently replaced.
//
// The 2026-11-01 site audit found it live: typing -5 into the electricity-price
// field was accepted with no visible error — the HTML `min` marked the input
// :invalid for CSS, and nothing else. The run continued, getTariff() returned
// null, readInputs() fell back to the bill anchor, and the visitor got results
// that had ignored their number without a word about it.
//
// The cure is two-sided and both sides are pinned here:
//   1. the predicate that decides "wrong" (empty stays valid: an empty field
//      means "use the local estimate", which is the documented behaviour);
//   2. the single paint function that writes the aria state AND the message,
//      so the visible text and the announced state cannot disagree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ui = readFileSync("assets/js/sizing/ui.js", "utf8");

function between(start, end) {
  const from = ui.indexOf(start);
  assert.notEqual(from, -1, `${start} must exist`);
  const to = ui.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} must follow ${start}`);
  return ui.slice(from, to);
}

function load(fields = {}) {
  const sandbox = {
    $(id) {
      return fields[id] ?? null;
    },
    t(key, vars) {
      return `${key}|${vars?.min ?? ""}`;
    },
  };
  vm.createContext(sandbox);
  return vm.runInContext(
    `${between("const TARIFF_MIN", "function getFixedCharge()")}
     ({ TARIFF_MIN, tariffFieldInvalid, showTariffError });`,
    sandbox,
  );
}

function field(value) {
  return {
    value,
    attrs: {},
    setAttribute(name, v) {
      this.attrs[name] = v;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
  };
}

function messageBox() {
  return { textContent: "", hidden: true };
}

test("an empty price stays valid — clearing it means 'use the local estimate'", () => {
  const input = field("");
  const { tariffFieldInvalid } = load({ customRateVal: input });
  assert.equal(tariffFieldInvalid(), false);
});

test("a negative, zero, or non-numeric price is invalid", () => {
  for (const bad of ["-5", "0", "0.00", "abc", "0,31"]) {
    const input = field(bad);
    const { tariffFieldInvalid } = load({ customRateVal: input });
    assert.equal(tariffFieldInvalid(), true, `${JSON.stringify(bad)}`);
  }
});

test("a real price is valid, including sub-cent prices", () => {
  for (const good of ["0.31", "0.0725", "1", "99.5"]) {
    const input = field(good);
    const { tariffFieldInvalid } = load({ customRateVal: input });
    assert.equal(tariffFieldInvalid(), false, `${JSON.stringify(good)}`);
  }
});

test("the error paints the message, the aria state, and clears both", () => {
  const input = field("-5");
  const box = messageBox();
  const { showTariffError, TARIFF_MIN } = load({
    customRateVal: input,
    rateError: box,
  });

  showTariffError(true);
  assert.equal(input.attrs["aria-invalid"], "true");
  assert.equal(box.hidden, false);
  assert.equal(box.textContent, `invalidTariff|${TARIFF_MIN.toFixed(2)}`);

  showTariffError(false);
  assert.equal(input.attrs["aria-invalid"], undefined);
  assert.equal(box.hidden, true);
  assert.equal(box.textContent, "");
});

test("the run gate checks the price before it reads any input", () => {
  const runBody = between("function run(quiet = false", "// Weather warming");
  const gate = runBody.indexOf("if (tariffFieldInvalid())");
  const read = runBody.indexOf("const inp = readInputs();");
  assert.notEqual(gate, -1, "run() must gate on the price field");
  assert.notEqual(read, -1, "run() must still read its inputs");
  assert.ok(
    gate < read,
    "the price gate must run before readInputs(), so no run starts on a rejected price",
  );
});

test("the input carries a described-by pointing at the error line", () => {
  const html = readFileSync("index.html", "utf8");
  const inputTag = html.slice(
    html.indexOf('id="customRateVal"') - 400,
    html.indexOf('id="customRateVal"') + 400,
  );
  assert.match(inputTag, /aria-describedby="rateError"/);
  assert.match(html, /id="rateError"[\s\S]{0,80}role="alert"/);
  assert.match(html, /id="rateError"[\s\S]{0,120}hidden/);
});
