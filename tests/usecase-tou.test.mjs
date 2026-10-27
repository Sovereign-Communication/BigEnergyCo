import { test } from "node:test";
import assert from "node:assert/strict";
import { infeasibleReason } from "../assets/js/sizing/engine.js";
import { synthesizeFromProfile } from "../assets/js/sizing/nasa.js";
import { OFFLINE_PROFILES } from "../assets/js/sizing/profiles.js";
import { HORIZON_YEARS } from "../assets/js/sizing/money.js";
import { useCase } from "../assets/js/sizing/usecases.js";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../scripts/serve-static.mjs";
import { start as startBrowser } from "../scripts/smoke/runtime.mjs";
import {
  assertModeMatchesUseCase,
  assertUseCase,
  sizeUseCase,
} from "./usecase-fixture.mjs";

for (const [hardwareConfig, expected] of [
  ["solar", "needs-battery"],
  ["battery", null],
  ["both", null],
]) {
  test(`tou feasibility: ${hardwareConfig}`, () => {
    assert.equal(infeasibleReason({ mode: "tou", hardwareConfig }), expected);
  });
}

test("tou mode reaches battery-only peak-offset measurement, not an offgrid result", async () => {
  const p = await assertModeMatchesUseCase("tou");
  const m = assertUseCase(p, "tou");
  assert.equal(p.mode, "gridtie");
  assert.equal(p.hardwareConfig, "battery");
  assert.equal(p.focus.pvKw, 0);
  assert.ok(m.battKwh > 0);
  assert.ok(m.touPeakOffsetPct > 0 && m.touPeakOffsetPct <= 100);
  assert.equal(p.useCaseOutcome.value, m.touPeakOffsetPct);
  assert.equal(m.touSpreadPerKwh, 0.5);
  assert.ok(m.touSavingUsd20y > 0);
});

test("flat rates are declined by the shipped TOU outcome", async () => {
  const p = await sizeUseCase({
    mode: "tou",
    touPeakRate: 0.2,
    touOffPeakRate: 0.2,
  });
  const m = assertUseCase(p, "tou");
  assert.equal(m.touSavingUsd20y, 0);
  assert.equal(p.useCaseOutcome.status, "not-here");
});

test("reversed, negative, non-finite, or unrepresentable TOU rates never invent savings", async () => {
  for (const [touPeakRate, touOffPeakRate] of [
    [0.1, 0.15],
    [-0.1, -0.2],
    [0.6, -0.1],
    [-0.1, 0.2],
    [Infinity, 0.1],
    [0.6, NaN],
    [Number.MAX_VALUE, 0],
  ]) {
    const p = await sizeUseCase({ mode: "tou", touPeakRate, touOffPeakRate });
    const m = assertUseCase(p, "tou");
    assert.equal(m.touSpreadPerKwh, 0);
    assert.equal(m.touSavingUsd20y, 0);
    assert.equal(p.useCaseOutcome.status, "not-here");
  }
});

test("TOU rates cross the browser-to-worker boundary in USD after a currency switch", async (t) => {
  const server = await serveStatic({
    dir: fileURLToPath(new URL("..", import.meta.url)),
    applyHeaders: false,
  });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  });
  browser = await startBrowser();
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      window.__runMessages = [];
      const postMessage = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...args) {
        if (message?.type === "run") window.__runMessages.push(message);
        return postMessage.call(this, message, ...args);
      };
    })();`,
  });
  await browser.send("Page.navigate", { url: server.url });
  const { evaluate, poll } = browser;
  assert.equal(
    await poll(
      () => evaluate('document.getElementById("useCaseRow")?.hidden === false'),
      15000,
      100,
    ),
    true,
    "the use-case controls should initialize",
  );
  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "Honolulu";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  })()`);
  assert.equal(
    await poll(
      () =>
        evaluate('!!document.querySelector("#citySuggestions [role=option]")'),
      15000,
      100,
    ),
    true,
    "Honolulu should be offered as a city suggestion",
  );
  await evaluate(
    'document.querySelector("#citySuggestions [role=option]").click()',
  );
  await evaluate(`(() => {
    const useCase = document.getElementById("useCase");
    useCase.value = "tou";
    useCase.dispatchEvent(new Event("change", { bubbles: true }));
    const tariff = document.getElementById("customRateVal");
    tariff.value = "0.4";
    tariff.dispatchEvent(new Event("input", { bubbles: true }));
    for (const [id, value] of [["touPeakRate", "0.9"], ["touOffPeakRate", "0.2"]]) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const code = document.getElementById("fxCode");
    code.value = "EUR";
    code.dispatchEvent(new Event("input", { bubbles: true }));
    const fxRate = document.getElementById("fxRate");
    fxRate.value = "2";
    fxRate.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await evaluate('document.getElementById("btnRunSizing").click()');
  assert.equal(
    await poll(
      () => evaluate("window.__runMessages.length === 1"),
      120000,
      200,
    ),
    true,
    "the real sizing worker should receive the run",
  );
  const message = await evaluate("window.__runMessages[0]");
  assert.equal(message.tariff, 0.4);
  assert.equal(message.touPeakRate, 0.9);
  assert.equal(message.touOffPeakRate, 0.2);
  assert.equal(
    await evaluate('document.getElementById("touPeakRate").value'),
    "1.8",
  );
  assert.equal(
    await evaluate('document.getElementById("touOffPeakRate").value'),
    "0.4",
  );
  assert.deepEqual(browser.errors, []);
});

test("live FX refresh preserves manual rates and recovers an invalid rate without changing USD prices", async (t) => {
  const server = await serveStatic({
    dir: fileURLToPath(new URL("..", import.meta.url)),
    applyHeaders: false,
  });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  });
  browser = await startBrowser();
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const originalFetch = window.fetch.bind(window);
      window.__fxRefreshRequestCount = 0;
      window.__fxRefreshState = { resolvers: [] };
      window.fetch = (input, ...args) => {
        const url = typeof input === "string" ? input : input.url;
        if (!url.startsWith("https://open.er-api.com/"))
          return originalFetch(input, ...args);
        window.__fxRefreshRequestCount += 1;
        return new Promise((resolve) => {
          window.__fxRefreshState.resolvers.push(() =>
            resolve(
              new Response(
                JSON.stringify({
                  result: "success",
                  rates: { EUR: 3.5, GBP: 0.8 },
                  time_last_update_utc: "test-rate-refresh",
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            ),
          );
        });
      };
      window.__runMessages = [];
      const postMessage = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...args) {
        if (message?.type === "run") window.__runMessages.push(message);
        return postMessage.call(this, message, ...args);
      };
    })();`,
  });
  await browser.send("Page.navigate", { url: server.url });
  const { evaluate, poll } = browser;
  assert.equal(
    await poll(
      () =>
        evaluate(
          'document.getElementById("useCaseRow")?.hidden === false && window.__fxRefreshRequestCount === 1',
        ),
      15000,
      100,
    ),
    true,
    "the UI and deferred FX refresh should initialize",
  );
  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "Madrid";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  })()`);
  assert.equal(
    await poll(
      () =>
        evaluate('!!document.querySelector("#citySuggestions [role=option]")'),
      15000,
      100,
    ),
    true,
    "Madrid should be offered as a city suggestion",
  );
  await evaluate(
    'document.querySelector("#citySuggestions [role=option]").click()',
  );
  assert.equal(
    await evaluate('document.getElementById("fxCode").value'),
    "EUR",
  );
  await evaluate(`(() => {
    const select = document.getElementById("useCase");
    select.value = "tou";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const tariff = document.getElementById("customRateVal");
    tariff.value = "0.4";
    tariff.dispatchEvent(new Event("input", { bubbles: true }));
    for (const [id, value] of [["touPeakRate", "0.9"], ["touOffPeakRate", "0.2"]]) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  })()`);
  const manualRates = await evaluate(`(() => {
    const fx = document.getElementById("fxRate");
    const initialRate = Number(fx.value);
    fx.value = "2";
    fx.dispatchEvent(new Event("input", { bubbles: true }));
    return {
      peakLocal: Number(document.getElementById("touPeakRate").value),
      offPeakLocal: Number(document.getElementById("touOffPeakRate").value),
      tariffLocal: Number(document.getElementById("customRateVal").value),
      initialRate,
    };
  })()`);
  assert.ok(manualRates.initialRate > 0 && manualRates.initialRate !== 2);
  const expectedUsd = {
    peak: manualRates.peakLocal / 2,
    offPeak: manualRates.offPeakLocal / 2,
    tariff: manualRates.tariffLocal / 2,
  };
  assert.ok(
    Math.abs(expectedUsd.peak - 0.9 / manualRates.initialRate) < 0.0001,
  );
  assert.ok(
    Math.abs(expectedUsd.offPeak - 0.2 / manualRates.initialRate) < 0.0001,
  );

  await evaluate("window.__fxRefreshState.resolvers[0]()");
  assert.equal(
    await poll(
      () =>
        evaluate(
          'document.getElementById("fxRate").value === "2" && document.getElementById("fxAsOf").textContent.includes("test-rate-refresh")',
        ),
      15000,
      100,
    ),
    true,
    "the live FX refresh should preserve the manually entered rate",
  );
  const localizedRates = await evaluate(`({
    peak: Number(document.getElementById("touPeakRate").value),
    offPeak: Number(document.getElementById("touOffPeakRate").value),
  })`);
  assert.equal(localizedRates.peak, manualRates.peakLocal);
  assert.equal(localizedRates.offPeak, manualRates.offPeakLocal);

  await evaluate('document.getElementById("btnRunSizing").click()');
  assert.equal(
    await poll(
      () => evaluate("window.__runMessages.length === 1"),
      120000,
      200,
    ),
    true,
    "the sizing worker should receive the refreshed TOU prices",
  );
  const message = await evaluate("window.__runMessages[0]");
  assert.ok(Math.abs(message.touPeakRate - expectedUsd.peak) < 0.0001);
  assert.ok(Math.abs(message.touOffPeakRate - expectedUsd.offPeak) < 0.0001);
  assert.ok(Math.abs(message.tariff - expectedUsd.tariff) < 0.0001);
  assert.deepEqual(browser.errors, []);

  const previousTimeOrigin = await evaluate("performance.timeOrigin");
  await browser.send("Page.reload", { ignoreCache: true });
  assert.equal(
    await poll(
      () =>
        evaluate(
          `performance.timeOrigin !== ${previousTimeOrigin} && document.getElementById("useCaseRow")?.hidden === false && window.__fxRefreshRequestCount === 1`,
        ),
      15000,
      100,
    ),
    true,
    "the reloaded UI should initialize",
  );
  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "Madrid";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  })()`);
  assert.equal(
    await poll(
      () =>
        evaluate('!!document.querySelector("#citySuggestions [role=option]")'),
      15000,
      100,
    ),
    true,
    "Madrid should be offered after the page reload",
  );
  await evaluate(
    'document.querySelector("#citySuggestions [role=option]").click()',
  );
  await evaluate(`(() => {
    const select = document.getElementById("useCase");
    select.value = "tou";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    const tariff = document.getElementById("customRateVal");
    tariff.value = "0.4";
    tariff.dispatchEvent(new Event("input", { bubbles: true }));
    for (const [id, value] of [["touPeakRate", "0.9"], ["touOffPeakRate", "0.2"]]) {
      const input = document.getElementById(id);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const code = document.getElementById("fxCode");
    code.value = "EUR";
    code.dispatchEvent(new Event("input", { bubbles: true }));
    const rate = document.getElementById("fxRate");
    rate.value = "0";
    rate.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const usdBeforeRefresh = await evaluate(`({
    peak: Number(document.getElementById("touPeakRate").value),
    offPeak: Number(document.getElementById("touOffPeakRate").value),
    tariff: Number(document.getElementById("customRateVal").value),
  })`);
  assert.equal(await evaluate('document.getElementById("fxRate").value'), "0");

  // Change the selected currency while the one live response is still
  // pending. Recovery must use GBP from the latest code, not stale EUR.
  await evaluate(`(() => {
    const code = document.getElementById("fxCode");
    code.value = "GBP";
    code.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await evaluate("window.__fxRefreshState.resolvers.at(-1)()");
  assert.equal(
    await poll(
      () =>
        evaluate(
          'document.getElementById("fxRate").value === "0.8" && document.getElementById("fxAsOf").textContent.includes("test-rate-refresh")',
        ),
      15000,
      100,
    ),
    true,
    "refresh should apply the latest selected currency's rate",
  );
  const recoveredDisplayRates = await evaluate(`({
    code: document.getElementById("fxCode").value,
    peak: Number(document.getElementById("touPeakRate").value),
    offPeak: Number(document.getElementById("touOffPeakRate").value),
    tariff: Number(document.getElementById("customRateVal").value),
  })`);
  assert.equal(recoveredDisplayRates.code, "GBP");
  assert.ok(
    Math.abs(recoveredDisplayRates.peak - usdBeforeRefresh.peak * 0.8) < 0.0001,
  );
  assert.ok(
    Math.abs(recoveredDisplayRates.offPeak - usdBeforeRefresh.offPeak * 0.8) <
      0.0001,
  );
  assert.ok(
    Math.abs(recoveredDisplayRates.tariff - usdBeforeRefresh.tariff * 0.8) <
      0.0001,
  );
  assert.deepEqual(browser.errors, []);
});

test("TOU savings subtract the off-peak energy needed to cover round-trip losses", async () => {
  const p = await sizeUseCase({
    mode: "tou",
    chemistry: "lfp",
    focusPvKw: 0,
    focusBattKwh: 8,
    touPeakRate: 0.6,
    touOffPeakRate: 0.1,
  });
  const m = assertUseCase(p, "tou");
  const noOffPeakCost = await sizeUseCase({
    mode: "tou",
    chemistry: "lfp",
    focusPvKw: 0,
    focusBattKwh: 8,
    touPeakRate: 0.6,
    touOffPeakRate: 0,
  });
  const zeroRate = assertUseCase(noOffPeakCost, "tou");
  assert.ok(
    m.touSavingUsd20y < zeroRate.touSavingUsd20y,
    "charging energy and round-trip losses must be charged at the off-peak rate",
  );
  assert.ok(zeroRate.touSavingUsd20y - m.touSavingUsd20y > 0);
  assert.equal(m.touPeakOffsetPct, zeroRate.touPeakOffsetPct);
  assert.equal(HORIZON_YEARS, 20);
});

test("TOU horizon is invariant for identical one- and five-year weather records", async () => {
  const annual = synthesizeFromProfile(
    OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu")),
  );
  const outcomes = [];
  for (const years of [1, 5]) {
    const p = await sizeUseCase(
      { mode: "tou", years },
      {
        hours: Array.from({ length: years }, () => annual).flat(),
        meta: { years },
      },
    );
    outcomes.push(p.useCaseOutcome);
  }
  const [one, five] = outcomes;
  assert.ok(
    one.measurement.touSavingUsd20y > 0,
    "the annualized 20-year ToU saving should stay positive for the documented rates",
  );
  assert.ok(
    Math.abs(
      one.measurement.touSavingUsd20y - five.measurement.touSavingUsd20y,
    ) < 2,
  );
  assert.equal(one.status, "works");
  assert.equal(five.status, one.status);
  assert.equal(HORIZON_YEARS, 20);
});

for (const chemistry of ["lfp", "auto"]) {
  test(`TOU prices its measured bank, not a preset target (${chemistry})`, async () => {
    const p = await sizeUseCase({
      mode: "tou",
      chemistry,
      focusPvKw: 0,
      focusBattKwh: 8,
      focusChemistry: "lfp",
    });
    const exact = await sizeUseCase({
      mode: "tou",
      chemistry: "lfp",
      focusPvKw: 0,
      focusBattKwh: 8,
    });
    const m = assertUseCase(p, "tou");
    assert.equal(m.battKwh, 8);
    assert.equal(m.touBatteryCostUsd20y, exact.focusSystem.lifetimeCostMid);
    assert.ok(m.touBatteryCostUsd20y > 0);
    assert.ok(m.touSavingUsd20y >= 0);
    assert.notEqual(m.touBatteryCostUsd20y, p.targets?.[0]?.lifetimeCostMid);
  });
}

test("default Auto TOU has a positive lifetime cost and a payable verdict", async () => {
  const hours = synthesizeFromProfile(
    OFFLINE_PROFILES.find((p) => p.name.includes("Honolulu")),
  );
  const p = await sizeUseCase({ mode: "tou", chemistry: "auto" }, { hours });
  const m = assertUseCase(p, "tou");
  assert.equal(m.battKwh, p.focus.battKwh);
  // The held reserve reduces cycling: this bank needs one swap, whereas
  // the preset target (priced without that floor) needs two. Do not borrow it.
  assert.equal(m.touBatteryCostUsd20y, 827);
  assert.ok(m.touSavingUsd20y >= 0);
  assert.equal(p.best.lifetimeCostMid, 1190);
  const noReserve = await sizeUseCase(
    { mode: "tou", chemistry: "auto", reservePct: 0 },
    { hours },
  );
  assert.equal(
    noReserve.useCaseOutcome.measurement.touBatteryCostUsd20y,
    noReserve.best.lifetimeCostMid,
  );
  assert.ok(m.touBatteryCostUsd20y > 0);
  assert.equal(p.useCaseOutcome.status, "works");
});

test("rendered TOU verdict never claims an unknown-cost battery is free", async (t) => {
  const server = await serveStatic({
    dir: fileURLToPath(new URL("..", import.meta.url)),
    applyHeaders: false,
  });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  });
  browser = await startBrowser();
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");
  await browser.send("Log.enable");
  await browser.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const costs = ["null", "undefined", "nan", "infinity", "negative", "zero"];
      let nextCost = 0;
      const original = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage");
      Object.defineProperty(Worker.prototype, "onmessage", {
        configurable: true,
        enumerable: original.enumerable,
        get: original.get,
        set(handler) {
          const worker = this;
          return original.set.call(worker, (event) => {
            const outcome = event.data?.payload?.useCaseOutcome;
            if (event.data?.type === "ok" && outcome?.useCase === "tou") {
              const cost = costs[nextCost];
              outcome.measurement.touSavingUsd20y = 1000;
              outcome.measurement.touPeakOffsetPct = 100;
              outcome.measurement.touBatteryCostUsd20y =
                cost === "null" ? null : cost === "undefined" ? undefined :
                  cost === "nan" ? NaN : cost === "infinity" ? Infinity :
                    cost === "negative" ? -1 : 0;
              outcome.status = "not-here";
              outcome.reasonKey = "verdictTou";
            }
            handler.call(worker, event);
            if (event.data?.type === "ok" && outcome?.useCase === "tou") {
              window.__unknownTouRenders.push({
                index: nextCost++,
                text: document.getElementById("useCaseOutcomeWrap").innerText,
              });
            }
          });
        },
      });
      window.__unknownTouRenders = [];
    })();`,
  });
  await browser.send("Page.navigate", { url: server.url });
  const { evaluate, poll } = browser;
  assert.equal(
    await poll(
      () => evaluate('document.getElementById("useCaseRow")?.hidden === false'),
      15000,
      100,
    ),
    true,
    "the use-case controls should initialize",
  );

  // Use the ordinary city and use-case controls. The real worker, sequence
  // checks, renderResults, and outcome renderer stay in the path; only each
  // completed TOU reply's measured cost is varied before the UI handler.
  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "Honolulu";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  })()`);
  assert.equal(
    await poll(
      () =>
        evaluate(
          "!!document.querySelector('#citySuggestions [role=\"option\"]')",
        ),
      15000,
      100,
    ),
    true,
    "Honolulu should be offered as a city suggestion",
  );
  await evaluate(
    "document.querySelector('#citySuggestions [role=\"option\"]').click()",
  );
  await evaluate(`(() => {
    const select = document.getElementById("useCase");
    select.value = "tou";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  for (let index = 0; index < 6; index++) {
    await evaluate('document.getElementById("btnRunSizing").click()');
    assert.equal(
      await poll(
        () => evaluate(`window.__unknownTouRenders.length > ${index}`),
        120000,
        200,
      ),
      true,
      `worker result ${index} should render`,
    );
    const rendered = await evaluate(`window.__unknownTouRenders[${index}]`);
    assert.equal(rendered.index, index);
    assert.match(rendered.text, /unknown/i);
    assert.match(rendered.text, /\$1,000\b/);
    assert.doesNotMatch(
      rendered.text,
      /(?:worth about|against a) \$0(?:\.00)?\b/,
    );
    assert.doesNotMatch(rendered.text, /free/i);
    assert.doesNotMatch(rendered.text, /against of\b/i);
    assert.match(rendered.text, /battery's cost is unknown/i);
  }
  assert.deepEqual(browser.errors, []);
});

test("rendered use-case footer is clean and TOU verdict amounts include currency", async (t) => {
  const server = await serveStatic({
    dir: fileURLToPath(new URL("..", import.meta.url)),
    applyHeaders: false,
  });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  });
  browser = await startBrowser();
  await browser.send("Page.enable");
  await browser.send("Runtime.enable");
  await browser.send("Log.enable");
  await browser.send("Page.navigate", { url: server.url });
  const { evaluate, poll } = browser;
  assert.equal(
    await poll(
      () => evaluate('document.getElementById("useCaseRow")?.hidden === false'),
      15000,
      100,
    ),
    true,
    "the use-case controls should initialize",
  );
  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "Honolulu";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
  })()`);
  assert.equal(
    await poll(
      () =>
        evaluate('!!document.querySelector("#citySuggestions [role=option]")'),
      15000,
      100,
    ),
    true,
    "Honolulu should be offered as a city suggestion",
  );
  await evaluate(
    'document.querySelector("#citySuggestions [role=option]").click()',
  );
  for (const [useCase, forbidden] of [
    ["tou", /against of|Measured for .* against/i],
    ["backup", /against of|Measured for .* against/i],
    ["portable", /against of|Measured for .* against/i],
    ["reserve", /against what holding/i],
  ]) {
    await evaluate(`(() => {
      const select = document.getElementById("useCase");
      select.value = ${JSON.stringify(useCase)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("btnRunSizing").click();
    })()`);
    assert.equal(
      await poll(
        () =>
          evaluate(
            `document.getElementById("useCaseOutcomeWrap")?.innerText.includes("${
              useCase === "tou"
                ? "Save with a battery"
                : useCase === "backup"
                  ? "Keep essentials"
                  : useCase === "portable"
                    ? "Portable power"
                    : "Keep a backup reserve"
            }")`,
          ),
        120000,
        200,
      ),
      true,
      `${useCase} result should render`,
    );
    const result = await evaluate(`(() => {
      const wrap = document.getElementById("useCaseOutcomeWrap");
      return {
        text: wrap?.innerText || "",
        footer: wrap?.lastElementChild?.lastElementChild?.innerText || "",
        pending: document.getElementById("btnRunSizing")?.disabled === true,
      };
    })()`);
    assert.equal(result.pending, false, `${useCase} run must settle`);
    assert.match(
      result.text,
      /Measured for /,
      `${useCase} outcome must be rendered`,
    );
    const footer = result.footer;
    assert.match(footer, /^Measured for /);
    assert.doesNotMatch(footer, forbidden);
    if (useCase === "tou") {
      assert.match(
        result.text,
        /worth about \$[\d,.]+ over 20 years against a \$[\d,.]+ battery/,
      );
      assert.match(result.text, /spread here is \$[\d,.]+ per kWh/);
    }
  }
  assert.deepEqual(browser.errors, []);
});

test("a measured system without a bank does not borrow a battery price", async () => {
  const p = await sizeUseCase({ mode: "tou", focusPvKw: 4, focusBattKwh: 0 });
  const m = assertUseCase(p, "tou");
  assert.equal(m.battKwh, 0);
  assert.equal(m.touBatteryCostUsd20y, null);
  assert.equal(p.useCaseOutcome.status, "not-here");
});

test("TOU payback verdict includes equality at the cost boundary", () => {
  for (const [saving, status] of [
    [645.99, "not-here"],
    [646, "works"],
    [646.01, "works"],
  ]) {
    assert.equal(
      useCase("tou").verdict({
        touPeakOffsetPct: 40,
        touSavingUsd20y: saving,
        touBatteryCostUsd20y: 646,
      }).status,
      status,
    );
  }
});

test("legacy gridtie battery-only requests retain the canonical TOU outcome", async () => {
  const p = await sizeUseCase({ mode: "gridtie", hardwareConfig: "battery" });
  assertUseCase(p, "tou");
  assert.equal(p.mode, "gridtie");
  assert.equal(p.hardwareConfig, "battery");
});
