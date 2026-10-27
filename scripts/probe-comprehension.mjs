// Manual P6.9 / Q-12 live probe. It sizes once through the local product UI,
// renders that completed result in each shipped locale, and sends only the
// result region's browser accessibility snapshot to Jev as the request state.
// This checks comprehension, not translation quality.
import { chromium } from "playwright";
import { serveStatic, ROOT } from "./serve-static.mjs";
import { acceptLiveJudgment } from "./lib/jev-run.mjs";
import { resolveKeys, liveJevComprehensionCall } from "./lib/jev-live.mjs";
import {
  Q12_LOCALES,
  Q12_QUESTIONS,
  gradeQ12Answers,
} from "./lib/jev-comprehension.mjs";
import { jevCostUsd } from "../worker/jev-price.mjs";

const SIZING_TIMEOUT_MS = 180_000;
const LOCALE_TIMEOUT_MS = 15_000;

async function completeSizing(page) {
  const home = await page.goto(new URL("/", page.url()).href, {
    waitUntil: "domcontentloaded",
  });
  if (home?.status() !== 200) throw new Error(`home page HTTP ${home?.status()}`);

  // Enter through the page's CTA and select the same visible controls as a
  // visitor. Honolulu + 10 kWh/day is the fixed Q-12 scenario.
  await page.locator("#btnHeroSizing").evaluate((node) => node.click());
  await page.locator("#modeManual").click();
  await page.locator("#simpleModeToggle").evaluate((node) => {
    node.checked = false;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#citySearch").fill("Honolulu");
  const suggestion = page.locator('#citySuggestions [role="option"]').first();
  await suggestion.waitFor({ state: "visible", timeout: LOCALE_TIMEOUT_MS });
  await suggestion.evaluate((node) => node.click());
  await page.locator("#loadMode").selectOption("kwh");
  await page.locator("#dailyKwhInput").fill("10");

  // Invoke the real button handler after the browser's scroll-to-modal layout
  // settles. This is the same explicit UI action used by the existing smoke.
  await page.locator("#btnRunSizing").evaluate((node) => node.click());
  await page.waitForFunction(
    () => {
      const region = document.querySelector("#resultsRegion");
      const button = document.querySelector("#btnRunSizing");
      return region && !region.hidden && button && !button.disabled;
    },
    { timeout: SIZING_TIMEOUT_MS },
  );
}

async function renderLocale(page, locale) {
  await page.evaluate(
    ({ lang, timeoutMs }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`locale ${lang} did not finish rendering`)),
          timeoutMs,
        );
        window.addEventListener(
          "beco:lang",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
        const picker = document.querySelector("#langSelect");
        if (!picker) {
          clearTimeout(timer);
          reject(new Error("language picker is missing"));
          return;
        }
        picker.value = lang;
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }),
    { lang: locale, timeoutMs: LOCALE_TIMEOUT_MS },
  );

  if ((await page.locator("html").getAttribute("lang")) !== locale) {
    throw new Error(`document lang did not become ${locale}`);
  }
  const tree = await page.locator("#resultsRegion").ariaSnapshot();
  if (typeof tree !== "string" || !tree.trim()) {
    throw new Error(`empty rendered accessibility tree for ${locale}`);
  }
  return tree;
}

async function main() {
  const keys = resolveKeys(ROOT);
  if (!keys.typesafeKey) {
    throw new Error("TypeSafe key unavailable; set the existing Jev key source");
  }

  const server = await serveStatic({ dir: ROOT });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await completeSizing(page);

    // Collect all six actual rendered accessibility snapshots before spending
    // on Jev, so an incomplete locale pass cannot produce partial acceptance.
    const snapshots = [];
    for (const locale of Q12_LOCALES) {
      snapshots.push({ locale, state: await renderLocale(page, locale) });
    }

    const results = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCost = 0;
    for (const { locale, state } of snapshots) {
      const started = Date.now();
      const live = await liveJevComprehensionCall(state, Q12_QUESTIONS, keys);
      const elapsedMs = Date.now() - started;
      if (!live.answers) {
        results.push({ locale, passed: false, blocker: live.notes.join("; ") });
        break;
      }
      const pin = acceptLiveJudgment(live);
      if (!pin.accepted) {
        results.push({ locale, passed: false, blocker: pin.blocker });
        break;
      }
      const grade = gradeQ12Answers(live.answers);
      const usage = live.usage || {};
      inputTokens += Number(usage.input_tokens) || 0;
      outputTokens += Number(usage.output_tokens) || 0;
      totalCost += jevCostUsd(Number(usage.input_tokens) || 0);
      results.push({
        locale,
        model: pin.model,
        elapsedMs,
        answers: grade.checks,
        correct: grade.correct,
        total: grade.total,
        passed: grade.passed,
      });
    }

    const totalCorrect = results.reduce((sum, result) => sum + (result.correct || 0), 0);
    const totalQuestions = snapshots.length * 3;
    const passed =
      results.length === Q12_LOCALES.length &&
      results.every((result) => result.passed) &&
      totalCorrect === totalQuestions;
    console.log(
      JSON.stringify(
        {
          probe: "Q-12 comprehension",
          scenario: "Honolulu, Hawaii; 10 kWh/day; completed grid-tied sizing",
          input: "only each locale's rendered #resultsRegion accessibility snapshot",
          locales: results,
          score: `${totalCorrect}/${totalQuestions}`,
          required: "18/18 (100%)",
          passed,
          usage: { inputTokens, outputTokens, costUsd: Number(totalCost.toFixed(10)) },
        },
        null,
        2,
      ),
    );
    if (!passed) process.exitCode = 1;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  await main();
}
