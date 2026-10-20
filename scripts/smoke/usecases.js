// Exercise the six published use cases through the shipped browser UI.
import {
  USE_CASE_IDS,
  USE_CASES,
  inputsFor,
} from "../../assets/js/sizing/usecases.js";
import { LOCALES } from "../../assets/js/shared/locales.js";
import {
  gate,
  gateCheckpoint,
  gatesSince,
  writeFacetReport,
} from "./runtime.mjs";

const visible = (el) =>
  Boolean(
    el &&
    !el.closest("[hidden]") &&
    getComputedStyle(el).display !== "none" &&
    getComputedStyle(el).visibility !== "hidden" &&
    el.getClientRects().length,
  );

const STATUS_LABELS = {
  works: "works",
  partial: "partial",
  notHere: "not-here",
};

function compactOutcomeValue(item) {
  const percentages = [
    ...String(item.value).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g),
  ];
  if (!percentages.length) return "value-shown";
  const first = percentages[0][1].replace(",", ".");
  if (item.id !== "reserve") return `${first}%`;
  const hours = String(item.value).match(/(\d+(?:[.,]\d+)?)\s*h\b/i)?.[1];
  return `${first}% savings${hours ? `/${hours.replace(",", ".")}h cover` : ""}`;
}

export function composeUseCaseFacetLine({
  cases,
  city,
  uniqueMetrics,
  visibleControls,
  expectedControls,
  flatRateTou,
  equalRate,
  passedGates,
  totalGates,
}) {
  const outcomes = cases
    .map(
      (item) =>
        `${item.id} ${compactOutcomeValue(item)} ${STATUS_LABELS[item.status] || "unclassified"}`,
    )
    .join("; ");
  const touBoundary = equalRate
    ? `ToU at equal $${equalRate.toFixed(2)}/kWh gives ${flatRateTou ? "not-here" : "a benefit"}`
    : `ToU flat-rate check ${flatRateTou ? "passed" : "failed"}`;
  return (
    `Chrome ${city}: ${outcomes}; ${uniqueMetrics ? "six distinct metrics" : "duplicate metrics"}, ` +
    `${visibleControls}/${expectedControls} inputs visible; ${touBoundary}; ${passedGates}/${totalGates} gates.`
  );
}

export async function runUseCasesFlow(ctx, actions) {
  const checkpoint = gateCheckpoint();
  const { evaluate } = ctx;

  await actions.navigate(`${ctx.base}?smoke=use-cases-${Date.now()}`);
  const locationReady = await actions.chooseHonolulu();
  gate("use-case flow starts from a resolved Honolulu location", locationReady);

  const language = await evaluate(`document.documentElement.lang || "en"`);
  const locale = LOCALES[language] || LOCALES.en;
  const setValue = (id, value) =>
    evaluate(`(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) return null;
      el.value = ${JSON.stringify(String(value))};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return el.value;
    })()`);
  const registryMetrics = USE_CASE_IDS.map((id) => USE_CASES[id].metric.id);
  const uniqueMetrics = new Set(registryMetrics).size === USE_CASE_IDS.length;
  gate(
    "use-case registry assigns six unique outcome metrics",
    uniqueMetrics,
    registryMetrics.join(", "),
  );

  const optionValues = await evaluate(
    `Array.from(document.querySelectorAll("#useCase option"), o => o.value)`,
  );
  gate(
    "reader-visible chooser offers all six declared cases",
    JSON.stringify(optionValues) === JSON.stringify(USE_CASE_IDS),
    `${optionValues.length} options: ${optionValues.join(", ")}`,
  );

  const manualMode = await evaluate(`(() => {
    const radio = document.getElementById("modeManual");
    if (!radio) return false;
    if (!radio.checked) radio.click();
    return radio.checked;
  })()`);
  gate("manual sizing controls are available to the use-case flow", manualMode);

  const cases = [];
  for (const id of USE_CASE_IDS) {
    const config = USE_CASES[id];
    const useCaseLabel = locale[config.labelKey];
    const expectedTitle = locale.useCaseOutcomeTitle.replace(
      "{useCase}",
      useCaseLabel,
    );

    const selected = await evaluate(`(() => {
      const select = document.getElementById("useCase");
      const row = document.getElementById("useCaseRow");
      if (!select || !row || row.hidden) return false;
      select.value = ${JSON.stringify(id)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const blurb = document.getElementById("useCaseBlurb");
      return select.value === ${JSON.stringify(id)} && Boolean(blurb?.textContent.trim());
    })()`);
    gate(
      `${id}: chooser selects the case and renders its explanation`,
      selected,
    );

    await setValue("loadMode", id === "billcut" ? "bill" : "kwh");
    if (id !== "billcut") await setValue("dailyKwhInput", 10);
    await setValue("customRateVal", 0.42);
    if (id === "tou") {
      await setValue("touPeakRate", 0.42);
      await setValue("touOffPeakRate", 0.42);
    }

    const runButton = await evaluate(`(() => {
      const button = document.getElementById("btnRunSizing");
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`);
    gate(`${id}: run button accepts the selected case`, runButton);

    const rendered = await ctx.poll(
      () =>
        evaluate(`(() => {
          const region = document.getElementById("resultsRegion");
          const card = document.querySelector("#useCaseOutcomeWrap > div");
          if (!region || region.hidden || !card) return false;
          const title = card.children[0]?.textContent.trim() || "";
          const metric = card.children[2]?.textContent.trim() || "";
          return title === ${JSON.stringify(expectedTitle)} &&
            metric === ${JSON.stringify(locale[config.metric.labelKey])} &&
            Boolean(card.children[1]?.textContent.trim()) &&
            Boolean(card.children[3]?.textContent.trim());
        })()`),
      60000,
      1000,
    );

    const row = await evaluate(`(() => {
      const card = document.querySelector("#useCaseOutcomeWrap > div");
      if (!card) return null;
      const parts = Array.from(card.children, el => el.innerText.replace(/\\s+/g, " ").trim());
      const statusSet = ${JSON.stringify({
        works: locale.statusWorks,
        partial: locale.statusPartial,
        notHere: locale.statusNotHere,
      })};
      const verdict = parts[3] || "";
      const status = Object.entries(statusSet).find(([, word]) => word && verdict.includes(word))?.[0] || null;
      return {
        title: parts[0] || "",
        value: parts[1] || "",
        metric: parts[2] || "",
        verdict,
        footer: parts[4] || "",
        status,
        touRates: {
          peak: Number(document.getElementById("touPeakRate")?.value),
          offPeak: Number(document.getElementById("touOffPeakRate")?.value),
        },
        controls: ${JSON.stringify(inputsFor(id).map((input) => input.control))}.map(control => {
          const el = document.getElementById(control);
          return { id: control, visible: (${visible.toString()})(el) };
        }),
        regionVisible: document.getElementById("resultsRegion")?.hidden === false,
        runDisabled: document.getElementById("btnRunSizing")?.disabled ?? null,
        pageStatus: document.getElementById("statusText")?.innerText || "",
      };
    })()`);
    const expectedControls = inputsFor(id).map((input) => input.control);
    const visibleControls =
      row?.controls?.filter((control) => control.visible).length || 0;
    const controlCoverage = visibleControls === expectedControls.length;
    gate(
      `${id}: every declared input is reader-visible after its run`,
      controlCoverage,
      `${visibleControls}/${expectedControls.length}: ${expectedControls.join(", ")}`,
    );

    const expectedMetric = locale[config.metric.labelKey];
    const validOutcome = Boolean(
      rendered &&
      row?.regionVisible &&
      row.title === expectedTitle &&
      row.metric === expectedMetric &&
      row.value &&
      row.verdict &&
      row.footer &&
      !/[{}]/.test(
        `${row.title}${row.value}${row.metric}${row.verdict}${row.footer}`,
      ) &&
      row.status,
    );
    gate(
      `${id}: rendered result uses its own translated metric, value and verdict`,
      validOutcome,
      `${row?.metric || "no metric"} = ${row?.value || "no value"}; ${row?.status || "no status"}; runDisabled=${row?.runDisabled}; status=${row?.pageStatus || "n/a"}`,
    );
    cases.push({
      id,
      metric_id: config.metric.id,
      metric_label: row?.metric || "",
      value: row?.value || "",
      verdict: row?.verdict || "",
      status: row?.status || null,
      tou_rates: row?.touRates || null,
      declared_controls: row?.controls || [],
      rendered: Boolean(rendered),
      control_coverage: controlCoverage,
      outcome_valid: validOutcome,
    });
  }

  const tou = cases.find((item) => item.id === "tou");
  const flatRateTou =
    tou?.status === "notHere" &&
    Number.isFinite(tou.tou_rates?.peak) &&
    tou.tou_rates.peak > 0 &&
    tou.tou_rates.peak === tou.tou_rates.offPeak;
  gate(
    "flat-rate time-of-use case gives an honest no-benefit verdict",
    flatRateTou,
    `${tou?.tou_rates?.peak ?? "?"}/${tou?.tou_rates?.offPeak ?? "?"}: ${tou?.verdict || "no rendered verdict"}`,
  );

  const measurements = gatesSince(checkpoint);
  const passed = measurements.filter((item) => item.passed).length;
  const expectedControls = cases.reduce(
    (sum, item) => sum + item.declared_controls.length,
    0,
  );
  const visibleControls = cases.reduce(
    (sum, item) =>
      sum + item.declared_controls.filter((control) => control.visible).length,
    0,
  );
  const complete =
    cases.length === USE_CASE_IDS.length &&
    cases.every(
      (item) => item.rendered && item.control_coverage && item.outcome_valid,
    ) &&
    uniqueMetrics &&
    flatRateTou;
  gate(
    "use-case browser evidence covers all six reader-visible outcomes",
    complete,
    `${cases.length}/6 rendered; ${visibleControls}/${expectedControls} declared controls visible; flat-rate ToU=${flatRateTou}`,
  );
  const finalMeasurements = gatesSince(checkpoint);
  const line = composeUseCaseFacetLine({
    cases,
    city: "Honolulu",
    uniqueMetrics,
    visibleControls,
    expectedControls,
    flatRateTou,
    equalRate:
      tou?.tou_rates?.peak === tou?.tou_rates?.offPeak
        ? tou.tou_rates.peak
        : null,
    passedGates: finalMeasurements.filter((item) => item.passed).length,
    totalGates: finalMeasurements.length,
  });
  writeFacetReport("usecases", line, {
    browser: "Chrome",
    locale: language,
    gates: finalMeasurements,
    unique_metric_ids: uniqueMetrics,
    declared_controls_visible: visibleControls,
    declared_controls_total: expectedControls,
    flat_rate_tou_not_here: flatRateTou,
    cases,
    complete,
  });
}
