#!/usr/bin/env node
// Browser checks for the translated calculator's narrow-screen layout and
// glyph fallback. Run after installing the locked Playwright browsers.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { LOCALE_IDS, LOCALES } from "./lib/locale-data.mjs";
import { isAllowedUnitOrBrand } from "./lib/gates.mjs";
import { directionForLocale } from "../assets/js/shared/direction.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = createServer(async (request, response) => {
  let path;
  try {
    path = resolve(
      root,
      `.${decodeURIComponent(new URL(request.url, "http://local").pathname)}`,
    );
  } catch {
    response.writeHead(400).end("bad path");
    return;
  }
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end("outside repo");
    return;
  }
  try {
    const body = await readFile(path);
    response.writeHead(200, {
      "content-type": types[extname(path)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
let failures = 0;
const fail = (message) => {
  console.error(`FAIL ${message}`);
  failures++;
};

async function checkAsyncLocaleBehavior(browser, engineName) {
  let context;
  try {
    context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => {
      localStorage.setItem("beco-lang", "en");
      window.becoLangEvents = [];
      window.addEventListener("beco:lang", () => {
        window.becoLangEvents.push(document.documentElement.lang);
      });
    });
    const page = await context.newPage();
    let releaseStarted;
    let releaseSettled;
    const spanishStarted = new Promise((resolve) => {
      releaseStarted = resolve;
    });
    const spanishSettled = new Promise((resolve) => {
      releaseSettled = resolve;
    });
    await context.route("**/assets/i18n/es.json*", async (route) => {
      releaseStarted();
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
      releaseSettled();
    });
    await page.goto(`${origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#langSelect").waitFor();
    await page.locator("#langSelect").selectOption("es");
    await spanishStarted;
    await page.locator("#langSelect").selectOption("ar");
    await page.waitForFunction(
      () => document.documentElement.lang === "ar",
      undefined,
      { timeout: 10000 },
    );
    await spanishSettled;
    const raced = await page.evaluate(() => ({
      selected: document.querySelector("#langSelect").value,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      title: document.title,
      expectedTitle: window.becoT("pageTitle"),
      events: window.becoLangEvents,
    }));
    if (
      raced.selected !== "ar" ||
      raced.lang !== "ar" ||
      raced.dir !== "rtl" ||
      raced.title !== raced.expectedTitle ||
      raced.events.length !== 1 ||
      raced.events[0] !== "ar"
    )
      fail(`${engineName} stale locale response overwrote Arabic: ${JSON.stringify(raced)}`);
    else console.log(`OK ${engineName} stale locale response is ignored`);
    await context.close();

    context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("beco-lang", "en"));
    const retryPage = await context.newPage();
    let spanishRequests = 0;
    let releaseFirstFailure;
    const firstFailure = new Promise((resolve) => {
      releaseFirstFailure = resolve;
    });
    await context.route("**/assets/i18n/es.json*", async (route) => {
      spanishRequests++;
      if (spanishRequests === 1) {
        releaseFirstFailure();
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await retryPage.goto(`${origin}/index.html`, {
      waitUntil: "domcontentloaded",
    });
    await retryPage.locator("#langSelect").waitFor();
    await retryPage.locator("#langSelect").selectOption("es");
    await firstFailure;
    await retryPage.waitForFunction(
      () => document.documentElement.lang === "es",
      undefined,
      { timeout: 10000 },
    );
    await retryPage.locator("#langSelect").selectOption("ar");
    await retryPage.waitForFunction(
      () => document.documentElement.lang === "ar",
      undefined,
      { timeout: 10000 },
    );
    await retryPage.locator("#langSelect").selectOption("es");
    try {
      await retryPage.waitForFunction(
        (expectedTitle) =>
          document.documentElement.lang === "es" &&
          document.title === expectedTitle,
        LOCALES.es.pageTitle,
        { timeout: 10000 },
      );
    } catch {
      fail(
        `${engineName} rejected Spanish dictionary was not retried: requests=${spanishRequests}`,
      );
    }
    if (spanishRequests !== 2)
      fail(`${engineName} expected two Spanish loads, got ${spanishRequests}`);
    else console.log(`OK ${engineName} failed locale load can be retried`);
  } catch (error) {
    fail(`${engineName} async locale regression check errored: ${error.message}`);
  } finally {
    await context?.close();
  }
}

async function captureRuntimeText(page) {
  return page.evaluate(() => {
    const values = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (
        !parent ||
        parent.closest("[data-i18n-slot], [data-i18n='operatorName']") ||
        (typeof parent.checkVisibility === "function" &&
          !parent.checkVisibility({ contentVisibilityAuto: true }))
      )
        continue;
      const link = parent.closest("a[href]");
      if (link?.getAttribute("href")?.startsWith("mailto:")) continue;
      if (/^[@$][\w.-]+$/u.test(walker.currentNode.nodeValue.trim())) continue;
      let ancestor = parent;
      let brandOnly = false;
      while (ancestor && ancestor !== document.body) {
        const compact = ancestor.textContent
          .replace(/[\s\p{P}\p{S}]/gu, "")
          .toLowerCase();
        if (compact === "bigenergyco") {
          brandOnly = true;
          break;
        }
        if (ancestor.matches("p,h1,h2,h3,h4,h5,h6,a,button")) break;
        ancestor = ancestor.parentElement;
      }
      if (brandOnly) continue;
      const value = walker.currentNode.nodeValue.trim().replace(/\s+/g, " ");
      if (/[\p{L}]{2}/u.test(value)) values.push(value);
    }
    return values;
  });
}

try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
    await checkAsyncLocaleBehavior(browser, engine.name());
      const englishByScenario = new Map();
      for (const locale of LOCALE_IDS) {
        const compareEnglishRuntime = (scenario, textNodes) => {
          const current = new Set(textNodes);
          if (locale === "en") {
            englishByScenario.set(scenario, current);
            return;
          }
          const english = englishByScenario.get(scenario) || new Set();
          const leaked = [...current].filter(
            (value) => english.has(value) && !isAllowedUnitOrBrand(value),
          );
          if (leaked.length)
            fail(
              `${engine.name()} ${locale} ${scenario}: English-equal runtime text: ${leaked.slice(0, 30).join(" | ")}`,
            );
        };
        const context = await browser.newContext({
          viewport: { width: 320, height: 900 },
          deviceScaleFactor: 1,
        });
        await context.addInitScript((language) => {
          localStorage.setItem("beco-lang", language);
        }, locale);
        await context.route("**/*", (route) => {
          try {
            if (new URL(route.request().url()).origin !== origin)
              return route.abort();
          } catch {
            return route.abort();
          }
          return route.continue();
        });
        const page = await context.newPage();
        await page.goto(`${origin}/index.html`, {
          waitUntil: "domcontentloaded",
        });
        const expectedDirection = directionForLocale(locale);
        try {
          await page.waitForFunction(
            ({ language, direction }) =>
              document.documentElement.lang === language &&
              document.documentElement.dir === direction,
            { language: locale, direction: expectedDirection },
            { timeout: 10000 },
          );
        } catch {
          fail(`${engine.name()} ${locale}: runtime did not apply lang/dir`);
          await context.close();
          continue;
        }
        await page.waitForFunction(
          () =>
            !document.querySelector(".bom-card h3")?.hasAttribute("data-i18n"),
          undefined,
          { timeout: 10000 },
        );
        await page.evaluate(() => document.fonts.ready);
        const copyChecks = await page.evaluate(() => {
          const el = (key) =>
            document.querySelector('[data-i18n="' + key + '"]');
          const t = (key, vars) => window.becoT(key, vars || {});
          const quick = el("quickModeLabel");
          const manual = el("manualModeLabel");
          const goalGridtie = el("goalGridtie");
          const goalOffgrid = el("goalOffgrid");
          const van = el("offgridPresetVan");
          const gift = el("supportGiftNotice");
          const footer = el("footerNotice");
          const terms = el("termsSectionWhatThisIs");
          const expectedDate = new Intl.DateTimeFormat(
            document.documentElement.lang,
            { day: "numeric", month: "long", year: "numeric" },
          ).format(new Date("2026-08-01T12:00:00Z"));
          const expectedBom = [
            [
              "bomCellBadge",
              "bomCellTitle",
              "bomCellsDescription",
              "bomCellPrice",
              43.5,
              "bomUnitCell",
              "bomExwDetails",
            ],
            [
              "bomBmsBadge",
              "bomBmsTitle",
              "bomBmsDescription",
              "bomBmsPrice",
              92,
              "bomUnitItem",
              "bomExwDetails",
            ],
            [
              "bomFuseBadge",
              "bomFuseTitle",
              "bomFuseDescription",
              "bomFusePrice",
              14.5,
              "bomUnitItem",
              "bomIndicativeDetails",
            ],
            [
              "bomRackBadge",
              "bomRackTitle",
              "bomRackDescription",
              "bomRackPrice",
              28,
              "bomUnitRack",
              "bomIndicativeDetails",
            ],
          ];
          const bomCards = [...document.querySelectorAll("#bom .bom-card")];
          const bomRuntime =
            bomCards.length === expectedBom.length &&
            expectedBom.every(
              (
                [
                  badgeKey,
                  titleKey,
                  descriptionKey,
                  priceKey,
                  amount,
                  unitKey,
                  scopeKey,
                ],
                index,
              ) => {
                const card = bomCards[index];
                return (
                  card.querySelector(".bom-badge")?.textContent.trim() ===
                    t(badgeKey) &&
                  card.querySelector("h3")?.textContent.trim() ===
                    t(titleKey) &&
                  card.querySelector("p")?.textContent.trim() ===
                    t(descriptionKey) &&
                  card.querySelector(".bom-price")?.textContent.trim() ===
                    t(priceKey, {
                      amount: window.becoFormatCurrency(amount, "USD", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      unit: t(unitKey),
                      details: t(scopeKey, { date: expectedDate }),
                    })
                );
              },
            );
          return {
            pageTitle: document.title === t("pageTitle"),
            intro:
              el("sizingSectionIntro")?.textContent.trim() ===
              t("sizingSectionIntro"),
            quickInput: Boolean(quick?.querySelector("#modeQuick")),
            manualInput: Boolean(manual?.querySelector("#modeManual")),
            gridGoalIcon: Boolean(
              goalGridtie?.querySelector('[data-i18n-slot="icon"]'),
            ),
            offgridGoalIcon: Boolean(
              goalOffgrid?.querySelector('[data-i18n-slot="icon"]'),
            ),
            vanAmount:
              van?.querySelector('[data-i18n-slot="amount"]')?.textContent ===
              t("offgridAmountVan"),
            billCurrency: Boolean(
              el("monthlyBillLabel")?.querySelector("#billSliderCur"),
            ),
            generatorValues: [
              "genPetrolBurn",
              "genBurnUnit",
              "genDieselBurn",
              "genBurnUnit2",
            ].every((id) =>
              el("generatorFuelAssumption")?.querySelector("#" + id),
            ),
            paymentHandle:
              el("paymentVenmoAccount")?.textContent.trim() ===
              t("paymentVenmoAccount", { handle: "@lucas-ballek" }),
            giftSlots: gift?.querySelectorAll("[data-i18n-slot]").length === 2,
            footerLinks:
              footer?.querySelectorAll("a[data-i18n-slot]").length === 7,
            termsNumber:
              terms?.querySelector('[data-i18n-slot="number"]')?.textContent ===
              t("termsSectionNumber1"),
            installAria:
              document
                .querySelector("#btnInstallApp")
                ?.getAttribute("aria-label") === t("installWebAppAria"),
            roofMapAria:
              document
                .querySelector("#btnCloseRoofMap")
                ?.getAttribute("aria-label") === t("closeRoofMapAria"),
            cityPlaceholder:
              document.querySelector("#citySearch")?.placeholder ===
              t("searchLocationPlaceholder"),
            chartAria:
              document
                .querySelector("#socCanvas")
                ?.getAttribute("aria-label") === t("batteryChargeChartAria"),
            socZoomTitle:
              document.querySelector("#btnSocZoomReset")?.title ===
              t("socZoomFullTitle"),
            guidedStep:
              document.querySelector("#guidedProgress")?.textContent.trim() ===
              t("guidedStepLocation"),
            fuelOption:
              document
                .querySelector('#genFuelType option[value="petrol"]')
                ?.textContent.trim() === t("fuelPetrolOption"),
            offgridOption:
              document
                .querySelector('#systemGoal option[value="offgrid"]')
                ?.textContent.trim() === t("systemGoalOffgridOption"),
            bomRuntime,
            termsDate:
              document.querySelector(
                '[data-i18n="termsLastUpdated"] [data-i18n-slot="date"]',
              )?.textContent === expectedDate,
          };
        });
        const failedCopyChecks = Object.entries(copyChecks)
          .filter(([, pass]) => !pass)
          .map(([name]) => name);
        if (failedCopyChecks.length)
          fail(
            engine.name() +
              " " +
              locale +
              ": translated copy/slot check failed: " +
              failedCopyChecks.join(", "),
          );

        // JavaScript-generated copy does not pass through check-i18n's static
        // HTML parser. Compare every rendered text node with the English
        // baseline so an untranslated runtime block is visible to this gate.
        // The only canonical exceptions are standalone brand names and units.
        compareEnglishRuntime("home", await captureRuntimeText(page));

        // Exercise the translated appliance chooser, not merely its hidden
        // initial markup. Locale changes must update labels without losing the
        // checked rows, counts or hour values.
        await page.locator("#modeManual").click();
        await page.locator("#loadMode").selectOption("appliances");
        compareEnglishRuntime("appliances", await captureRuntimeText(page));

        await page.locator("#btnGoalOffgrid").click();
        const offgridCopy = await page.evaluate(() => ({
          heading: document.querySelector(".section-title")?.textContent.trim(),
          description: document
            .querySelector(".section-desc")
            ?.textContent.trim(),
          input: document.querySelector("#optLoadBill")?.textContent.trim(),
          expectedHeading: window.becoT("offgridSizingHeading"),
          expectedDescription: window.becoT("offgridSizingDescription"),
          expectedInput: window.becoT("dailyEnergyNeed"),
        }));
        if (
          offgridCopy.heading !== offgridCopy.expectedHeading ||
          offgridCopy.description !== offgridCopy.expectedDescription ||
          offgridCopy.input !== offgridCopy.expectedInput
        )
          fail(`${engine.name()} ${locale}: off-grid runtime copy leaked`);

        await page.locator("#btnGoalGridtie").click();
        const gridCopy = await page.evaluate(() => ({
          heading: document.querySelector(".section-title")?.textContent.trim(),
          description: document
            .querySelector(".section-desc")
            ?.textContent.trim(),
          input: document.querySelector("#optLoadBill")?.textContent.trim(),
          expectedHeading: window.becoT("systemPathHeading"),
          expectedDescription: window.becoT("gridSizingDescription"),
          expectedInput: window.becoT("monthlyBillInputOption"),
        }));
        if (
          gridCopy.heading !== gridCopy.expectedHeading ||
          gridCopy.description !== gridCopy.expectedDescription ||
          gridCopy.input !== gridCopy.expectedInput
        )
          fail(`${engine.name()} ${locale}: grid-tied runtime copy leaked`);

        await context.setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
        try {
          await page.waitForFunction(
            () =>
              document.querySelector("#offlineBadge")?.textContent.trim() ===
              window.becoT("offlineReadyLabel"),
            undefined,
            { timeout: 2000 },
          );
          const offlineCopy = await page.evaluate(() => ({
            text: document.querySelector("#offlineBadge")?.textContent.trim(),
            title: document.querySelector("#offlineBadge")?.title,
            expectedText: window.becoT("offlineReadyLabel"),
            expectedTitle: window.becoT("offlineBadgeTitle"),
          }));
          if (
            offlineCopy.text !== offlineCopy.expectedText ||
            offlineCopy.title !== offlineCopy.expectedTitle
          )
            fail(`${engine.name()} ${locale}: offline status copy leaked`);
        } catch {
          fail(`${engine.name()} ${locale}: offline status did not render`);
        } finally {
          await context.setOffline(false);
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
        }

        const layout = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const offenders = [...document.querySelectorAll("body *")]
            .filter((node) => !node.matches(".skip-link"))
            .map((node) => ({
              node: node.tagName.toLowerCase(),
              id: node.id,
              className: String(node.className || "").slice(0, 60),
              left: Math.round(node.getBoundingClientRect().left),
              right: Math.round(node.getBoundingClientRect().right),
              display: getComputedStyle(node).display,
              visibility: getComputedStyle(node).visibility,
            }))
            .filter(
              (node) =>
                node.display !== "none" &&
                node.visibility !== "hidden" &&
                (node.left < -1 || node.right > width + 1),
            )
            .slice(0, 6);
          return {
            width,
            scrollWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            offenders,
          };
        });
        if (
          layout.width !== 320 ||
          layout.scrollWidth > 320 ||
          layout.offenders.length
        )
          fail(
            `${engine.name()} ${locale}: 320px overflow ${JSON.stringify(layout)}`,
          );

        const strings = Object.values(LOCALES[locale]).filter(
          (value) => typeof value === "string",
        );
        const glyphs = await page.evaluate((values) => {
          const text = values.join("\n");
          const chars = [
            ...new Set([...text].filter((char) => /[\p{L}\p{M}]/u.test(char))),
          ];
          const sample = document.createElement("canvas");
          sample.width = 72;
          sample.height = 72;
          const ctx = sample.getContext("2d", { willReadFrequently: true });
          ctx.font = `40px ${getComputedStyle(document.body).fontFamily}`;
          ctx.textBaseline = "alphabetic";
          ctx.fillStyle = "#000";
          const signature = (char) => {
            ctx.clearRect(0, 0, sample.width, sample.height);
            ctx.fillText(char, 4, 54);
            const pixels = ctx.getImageData(
              0,
              0,
              sample.width,
              sample.height,
            ).data;
            let out = "";
            for (let i = 3; i < pixels.length; i += 4)
              out += pixels[i] ? "1" : "0";
            return out;
          };
          const tofu = signature("\u{10ffff}");
          const noInk = signature(" ");
          const missing = chars.filter((char) => {
            const shape = signature(char);
            return shape !== noInk && shape === tofu;
          });
          return { checked: chars.length, missing: missing.slice(0, 20) };
        }, strings);
        if (glyphs.missing.length)
          fail(
            `${engine.name()} ${locale}: system stack tofu for ${glyphs.missing.join(" ")}`,
          );
        else
          console.log(
            `OK ${engine.name()} ${locale}: 320px layout, ${glyphs.checked} letter glyphs`,
          );
        if (
          process.argv.includes("--screenshot") &&
          engine.name() === "chromium" &&
          locale === "ar"
        ) {
          const screenshot = join(tmpdir(), "bigenergyco-p5-4-ar-320.png");
          await page.screenshot({ path: screenshot, fullPage: true });
          console.log(`CAPTURE ${screenshot}`);
        }
        await context.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

console.log(
  failures ? `\n${failures} visual i18n failure(s)` : "\nvisual i18n OK",
);
process.exit(failures ? 1 : 0);
