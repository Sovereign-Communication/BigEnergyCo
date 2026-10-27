// Measure what a visitor in a given market actually gets from the deployed
// calculator: currency (code + symbol + formatting), the tariff/rate data used,
// units, and the payback and 20-year figures — then compare against that
// market's static city page. Read-only: launches Chromium, drives staging.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const STAGING = "https://bigenergyco.pages.dev";
const BRAND = "https://freeoffgridcalculator.com";
const ONLY = process.argv[2] || null;

const MARKETS = [
  { slug: "new-york", city: "New York", locale: "en-US", tz: "America/New_York", note: "baseline USD" },
  { slug: "london", city: "London", locale: "en-GB", tz: "Europe/London", note: "non-USD non-EU (GBP, pence-quoted tariffs)" },
  { slug: "berlin", city: "Berlin", locale: "de-DE", tz: "Europe/Berlin", note: "EUR" },
  { slug: "tokyo", city: "Tokyo", locale: "ja-JP", tz: "Asia/Tokyo", note: "JPY, large nominal rates" },
  { slug: "lagos", city: "Lagos", locale: "en-NG", tz: "Africa/Lagos", note: "NGN, banded/subsidised tariff structure" },
  { slug: "delhi", city: "Delhi", locale: "en-IN", tz: "Asia/Kolkata", note: "INR, slab tariff structure" },
  { slug: "santiago", city: "Santiago", locale: "es-CL", tz: "America/Santiago", note: "CLP, ~950/USD" },
  { slug: "ho-chi-minh-city", city: "Ho Chi Minh City", locale: "vi-VN", tz: "Asia/Ho_Chi_Minh", note: "VND, 5-digit rates" },
  { slug: "suva", city: "Suva", locale: "en-FJ", tz: "Pacific/Fiji", note: "small market (FJD)" },
  { slug: "papeete", city: "Papeete", locale: "fr-PF", tz: "Pacific/Tahiti", note: "edge market (XPF)" },
  { slug: "kathmandu", city: "Kathmandu", locale: "ne-NP", tz: "Asia/Kathmandu", note: "edge market (NPR)" },
];

const out = { measuredAt: new Date().toISOString(), staging: STAGING, markets: [], limits: [] };

const browser = await chromium.launch();

for (const m of MARKETS) {
  if (ONLY && m.slug !== ONLY) continue;
  const ctx = await browser.newContext({
    locale: m.locale,
    timezoneId: m.tz,
    viewport: { width: 1280, height: 1000 },
    serviceWorkers: "block",
  });
  const page = await ctx.newPage();
  const rec = { ...m, picked: null, setup: null, tariff: null, results: null, errors: [] };
  page.on("pageerror", (e) => rec.errors.push(String(e.message).slice(0, 200)));
  try {
    await page.goto(`${STAGING}/?lang=en`, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(5000);

    // 1. resolve the market through the same location picker a visitor uses
    await page.evaluate((city) => {
      const s = document.getElementById("citySearch");
      s.focus();
      s.value = city;
      s.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }, m.city);
    await page
      .waitForFunction(
        (city) => [...document.querySelectorAll('#citySuggestions [role="option"]')].some((o) =>
          o.textContent.trim().toLowerCase().startsWith(city.toLowerCase()),
        ),
        m.city,
        { timeout: 25000 },
      )
      .catch(() => {});
    rec.picked = await page.evaluate((city) => {
      const opts = [...document.querySelectorAll('#citySuggestions [role="option"]')];
      const hit = opts.find((o) => o.textContent.trim().toLowerCase().startsWith(city.toLowerCase())) || opts[0];
      if (!hit) return null;
      const text = hit.textContent.trim();
      hit.click();
      return text;
    }, m.city);
    await page.waitForTimeout(3000);

    // 2. the same inputs the static page's worked example uses: 10 kWh/day, 60% cut
    rec.setup = await page.evaluate(() => {
      const set = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return null;
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return el.value;
      };
      set("loadMode", "kwh");
      set("dailyKwhInput", "10");
      set("systemGoal", "gridtie");
      const at = document.getElementById("autoTarget");
      const options = at ? [...at.options].map((o) => o.value) : [];
      let target = null;
      if (at && options.includes("cut60")) {
        set("autoTarget", "cut60");
        target = "autoTarget=cut60";
      }
      const cs = document.getElementById("cutSlider");
      if (cs) {
        set("cutSlider", "60");
        target = (target ? target + " + " : "") + `cutSlider=${cs.value}`;
      }
      return {
        autoTargetOptions: options,
        target,
        dailyKwh: document.getElementById("dailyKwhInput")?.value,
        goal: document.getElementById("systemGoal")?.value,
        mode: document.getElementById("loadMode")?.value,
      };
    });

    // 3. what the app resolved for this location: currency + tariff
    rec.tariff = await page.evaluate(() => {
      const t = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
      const v = (id) => document.getElementById(id)?.value ?? null;
      return {
        locationLabel: t("pipeCity") || t("locHint") || t("locNote"),
        lat: v("lat"),
        lon: v("lon"),
        fxCode: v("fxCode"),
        fxRate: v("fxRate"),
        tariffLocal: v("customRateVal"),
        tariffLabel: document.querySelector('label[for="customRateVal"]')?.textContent?.trim() ?? null,
        billCurrencySymbol: t("billSliderCur"),
        exportUnit: document.querySelector('label[for="exportRate"] span')?.textContent?.trim() ?? null,
      };
    });

    // 4. run it and read the figures
    await page.click("#btnRunSizing");
    await page
      .waitForFunction(() => document.body.textContent.includes("Total 20-year cost"), null, { timeout: 180000 })
      .catch(() => rec.errors.push("no result card within 180s"));
    await page.waitForTimeout(4000);

    rec.results = await page.evaluate(() => {
      const text = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
      const rows = [...document.querySelectorAll("table tr")].map((tr) =>
        [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()).filter(Boolean),
      ).filter((r) => r.length);
      const pick = (needle) => rows.filter((r) => r.some((c) => c.toLowerCase().includes(needle)));
      return {
        cumSavingsTotal: text("cumSavingsTotal"),
        cumSavingsSub: text("cumSavingsSub"),
        cumCaption: text("cumCostCaption"),
        cumTitle: text("cumCostTitle"),
        gridtieHeader: pick("bill cut")[0] || null,
        gridtieRows: pick("bill cut").slice(1, 4),
        paybackRows: pick("payback").slice(0, 4),
        twentyYearRows: pick("20-year").slice(0, 6),
        powerCostRows: pick("power cost").slice(0, 3),
        allTableRowCount: rows.length,
      };
    });
    await page.screenshot({ path: `/c/tmp/scan/world-calc-${m.slug}.png`, fullPage: false }).catch(() => {});
    rec.bodyText = (await page.evaluate(() => document.body.innerText)).slice(0, 4000);
  } catch (e) {
    rec.errors.push(String(e && e.message).slice(0, 300));
  }
  out.markets.push(rec);
  console.log(`--- ${m.slug}: picked=${rec.picked} fx=${rec.tariff?.fxCode} rate=${rec.tariff?.tariffLocal} errors=${rec.errors.length}`);
  await ctx.close();
}

await browser.close();
writeFileSync("/c/tmp/scan/world-calc-measure.json", JSON.stringify(out, null, 1));
console.log("wrote /c/tmp/scan/world-calc-measure.json");
