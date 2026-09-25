// Structural feasibility + grid-tie result flow: the infeasible banner for
// off-grid + solar-only (reason up top, no broken fallback box), then the
// full grid-tie run with its chart/canvas contract.
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runGridTieFlow(ctx, actions) {
  const { evaluate } = ctx;

  // ── Structural infeasibility (off-grid + solar-only) ───────────────
  // Reports a reason up top and hides the broken savings-unavailable box.
  console.log("SMOKE      ── infeasible off-grid + solar-only ──");
  // Settle first: a click landing on a disabled Run button (previous run
  // still in flight, e.g. from auto-location) is silently swallowed, and
  // input changes made before the first payload never trigger their quiet
  // run — either way no new run starts and the banner can never appear.
  await ctx.poll(
    async () =>
      !(await evaluate(`document.getElementById("btnRunSizing")?.disabled`)),
    180000,
    2000,
  );
  await evaluate(`(() => {
      document.getElementById("systemGoal").value = "offgrid";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      const hw = document.getElementById("hardwareConfig");
      hw.value = "solar";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  // Re-click while idle: guarantees a run actually started even if the
  // first click hit a disabled button. Repeated clicks are harmless —
  // same inputs, stale responses are dropped by seq.
  let infeasibleShown = false;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    if (
      await evaluate(
        `document.getElementById("infeasibleBanner")?.style.display === "block"`,
      )
    ) {
      infeasibleShown = true;
      break;
    }
    if (
      !(await evaluate(`document.getElementById("btnRunSizing")?.disabled`))
    ) {
      await evaluate(`document.getElementById("btnRunSizing").click()`);
    }
  }
  gate(
    "infeasible banner shown for offgrid+solar-only",
    infeasibleShown,
    String(
      await evaluate(
        `document.getElementById("infeasibleBanner")?.style.display ?? "absent"`,
      ),
    ),
  );
  gate(
    "no savings-unavailable fallback on infeasible run",
    !(await evaluate(
      `document.body.textContent.includes("Savings data unavailable for this result")`,
    )),
  );
  // Restore default hardware for downstream gates.
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "both";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("systemGoal").value = "gridtie";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  gate(
    "chat bridge loaded (extracted classic script)",
    await evaluate(`typeof window.sendChatMsg === "function"`),
  );
  const loadMs = await evaluate(
    `(() => { const t = performance.timing; return (t.loadEventEnd || Date.now()) - t.navigationStart; })()`,
  );
  gate(
    "page load under 60s",
    Number.isFinite(loadMs) && loadMs < 60000,
    `${loadMs} ms`,
  );

  // ── Full grid-tie run: card + charts ───────────────────────────────
  if (!(await actions.chooseHonolulu()))
    throw new Error("city select failed; aborting run");
  const tariff = await actions.setInputs("gridtie");
  gate(
    "positive grid price",
    Number.isFinite(tariff) && tariff > 0,
    `$${tariff}/kWh`,
  );
  gate("result card has Total 20-year cost", await actions.runAndWaitCard());
  // This session showed a real infeasible banner above, so a stale one would
  // still be sitting here. The reason explains the payload on screen, and the
  // run that replaced it solved — so both the banner and the sr-only region
  // that mirrors it must be retracted, while the region itself stays rendered
  // (display:none is exactly what a screen reader will not announce, so
  // "clearing" it by hiding it would silently disable the feature).
  const bannerAfter = await evaluate(`(() => {
      const b = document.getElementById("infeasibleBanner");
      const live = document.getElementById("infeasibleLive");
      return {
        display: b ? getComputedStyle(b).display : "absent",
        htmlEmpty: b ? b.innerHTML === "" : true,
        liveEmpty: live ? live.textContent === "" : true,
        liveRendered: live ? getComputedStyle(live).display !== "none" : false,
      };
    })()`);
  gate(
    "solvable run retracts the previous infeasible reason",
    bannerAfter.display !== "block" &&
      bannerAfter.htmlEmpty &&
      bannerAfter.liveEmpty,
    JSON.stringify(bannerAfter),
  );
  gate(
    "infeasible live region stays rendered while empty",
    bannerAfter.liveRendered,
    JSON.stringify(bannerAfter),
  );
  gate(
    "savings chart heading present",
    await evaluate(
      `document.body.textContent.includes("What does solar really save you?")`,
    ),
  );
  gate(
    "no savings-unavailable fallback",
    !(await evaluate(
      `document.body.textContent.includes("Savings data unavailable")`,
    )),
  );
  const canvasBox = await evaluate(
    `(() => { const c = document.getElementById("cumCostCanvas"); if (!c) return null; const r = c.getBoundingClientRect(); return { w: r.width, h: r.height }; })()`,
  );
  gate(
    "cumCostCanvas non-zero",
    !!canvasBox && canvasBox.w > 0 && canvasBox.h > 0,
    JSON.stringify(canvasBox),
  );
  const caption = await evaluate(
    `(document.getElementById("cumCostCaption")?.textContent || "").trim().length`,
  );
  gate(
    "cumCostCaption explains running cost",
    (caption || 0) > 20,
    `${caption} chars`,
  );
  // The mode-aware copy must not have softened a correct surface. Every one of
  // these is right for a run WITH panels, and each has a no-panel counterpart
  // asserted further down: if a fix ever collapses the two into one wording,
  // exactly one of the pair fails.
  const panelSurface = await evaluate(`(() => {
      const clean = (id) => {
        const e = document.getElementById(id);
        return e ? e.textContent.replace(/\\s+/g, " ").trim() : "";
      };
      return {
        legend: clean("cumCostLegend"),
        method: clean("frontierMethodNote"),
        methodHook: document.getElementById("frontierMethodNote")
          ? document.getElementById("frontierMethodNote").getAttribute("data-i18n")
          : "",
        region: clean("resultsRegion"),
        tilt: document.getElementById("sunPathWrap")
          ? document.getElementById("sunPathWrap").style.display
          : "missing",
      };
    })()`);
  gate(
    "with-panels cumulative legend still names the solar system",
    /Solar system:/.test(panelSurface.legend),
    panelSurface.legend.slice(0, 170),
  );
  gate(
    "with-panels curve method note still describes panel-and-battery",
    panelSurface.methodHook === "frontierMethod" &&
      /panel-and-battery/.test(panelSurface.method),
    panelSurface.method.slice(0, 160),
  );
  gate(
    "with-panels power-cost row is still the power cost",
    /Your power cost/.test(panelSurface.region) &&
      !/Cost per shifted kWh/.test(panelSurface.region),
    (panelSurface.region.match(/Your power cost[^A-Z]{0,40}/) || [""])
      .join("")
      .slice(0, 120),
  );
  gate(
    "with-panels keeps the tilt guide and its PV safety item",
    panelSurface.tilt === "block" &&
      /PV Array Isolator/.test(panelSurface.region),
    `sunPathWrap display=${panelSurface.tilt}`,
  );

  // ── Battery-only (no panels): peak offset must not be sold as a bill cut ──
  // run.js stores the peak-offset fraction in cutPct when pvKw is 0. The chip,
  // the money bar and the matrix all labelled that a "bill cut" and promised a
  // payback, while the panel beside them reported "never" break-even and 20-year
  // bills identical to staying on the grid. This gate is what fails on that.
  console.log("SMOKE      ── battery-only: peak offset, not a bill cut ──");
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "battery";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("systemGoal").value = "gridtie";
      document.getElementById("systemGoal").dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  // Wait for the BATTERY-ONLY payload specifically, not merely for some result
  // card. The previous grid-tie card is still on screen, so a generic card
  // check returns instantly and reads the solar system's surfaces — which is
  // how a time-based version of this gate would pass while proving nothing.
  const battRan = await ctx.poll(
    async () =>
      evaluate(`(() => {
          const p = document.getElementById("resultsRegion");
          // textContent, not innerText: innerText is "" for a hidden
          // subtree, so an innerText-based poll can never observe the state
          // it is waiting for and just burns its whole timeout.
          return !!p && p.textContent.includes("None (Battery-only)");
        })()`),
    RUN_TIMEOUT_MS,
    2000,
  );
  gate("battery-only run renders a no-panel result", battRan);
  await sleep(1200);
  const battSurfaces = await evaluate(`(() => {
      const clean = (id) => {
        const e = document.getElementById(id);
        return e ? e.innerText.replace(/\\s+/g, " ").trim() : "";
      };
      return {
        chips: clean("focusChips"),
        money: clean("moneyBar"),
        simple: clean("simpleResultsWrap"),
        panel: clean("resultsRegion"),
      };
    })()`);
  gate(
    "battery-only chip says peak offset, not bill cut",
    /peak offset/.test(battSurfaces.chips) &&
      !/bill cut/.test(battSurfaces.chips),
    battSurfaces.chips.replace(/\s+/g, " ").slice(0, 160),
  );
  gate(
    "battery-only money bar promises no payback",
    /no panels/.test(battSurfaces.money) &&
      !/repays itself|bill after solar/i.test(battSurfaces.money),
    battSurfaces.money.slice(0, 160),
  );
  gate(
    "battery-only panel still reports no break-even",
    /break-even/.test(battSurfaces.panel) && /never/.test(battSurfaces.panel),
  );
  gate(
    "battery-only build has no solar array",
    /Solar array None/.test(battSurfaces.panel),
  );
  gate(
    "no surface claims a bill cut for a battery-only build",
    !/bill cut|off your bill/.test(
      battSurfaces.chips + " " + battSurfaces.money,
    ),
  );
  const frontierText = await evaluate(`(() => {
      const e = document.getElementById("frontierVerdict");
      return e ? e.innerText.replace(/\\s+/g, " ") : "";
    })()`);
  gate(
    "battery-only frontier verdict does not call the ceiling a share of the bill",
    frontierText.length > 0 && !/your bill/i.test(frontierText),
    frontierText.slice(0, 170),
  );
  gate(
    "battery-only frontier verdict describes shifting peak hours",
    /peak hours|shift/i.test(frontierText),
  );

  // Two more surfaces phrase the same offset as a bill cut in this mode: the
  // frontier chart's Y axis, and the target control that drives the run.
  const control = await evaluate(`(() => {
      const label = document.querySelector('label[for="cutSlider"]');
      const val = document.getElementById("cutSliderVal");
      return {
        label: label ? label.textContent.replace(/\\s+/g, " ").trim() : "",
        value: val ? val.textContent.replace(/\\s+/g, " ").trim() : "",
      };
    })()`);
  gate(
    "battery-only target control offers a peak offset, not a bill cut",
    /peak/i.test(control.label) &&
      /peak/i.test(control.value) &&
      !/bill/i.test(control.label + " " + control.value),
    `${control.label} | ${control.value}`.slice(0, 160),
  );
  const sizedFor = await evaluate(`(() => {
      const m = document.body.innerText.match(/[^\\n]*sized for[^\\n]*/);
      return m ? m[0].replace(/\\s+/g, " ").trim() : "";
    })()`);
  gate(
    "battery-only auto note describes the peak-hour offset, not a bill cut",
    sizedFor.length > 0 &&
      /offset/i.test(sizedFor) &&
      !/bill cut|bill-cut/i.test(sizedFor),
    sizedFor.slice(0, 150),
  );

  // The cumulative-cost caption: it explained the emerald line as "the solar
  // system's own cost" in a panel-free run, and called a NEGATIVE 20-year gap
  // money the system "puts back in your pocket" — then said, one sentence
  // later, that the system never pays for itself.
  const cumCaption = await evaluate(`(() => {
      const e = document.getElementById("cumCostCaption");
      return e ? e.textContent.replace(/\\s+/g, " ").trim() : "";
    })()`);
  gate(
    "battery-only cumulative caption never names the sun",
    cumCaption.length > 40 && !/solar/i.test(cumCaption),
    cumCaption.slice(0, 200),
  );
  gate(
    "battery-only cumulative caption states the 20-year gap as a cost",
    /MORE than staying on the grid/i.test(cumCaption) &&
      !/puts [^.]*back in your pocket/i.test(cumCaption),
    cumCaption.slice(-200),
  );

  // The rest of the cumulative-cost panel, and every other surface that named
  // the array: "What does solar really save you?", an emerald legend keyed
  // "Solar system", a method note about panel-and-battery combinations, a LCOE
  // row called "your power cost" (five times below the tariff, beside a card
  // that never breaks even), a tilt guide advising on "your array", a PV
  // isolator on a parts list whose Panels row says None, and a print sheet that
  // printed the word null where the footprint was missing.
  const noPanelSurface = await evaluate(`(() => {
      const clean = (id) => {
        const e = document.getElementById(id);
        return e ? e.textContent.replace(/\\s+/g, " ").trim() : "";
      };
      const label = document.querySelector('label[for="cutSlider"]');
      return {
        title: clean("cumCostTitle"),
        legend: clean("cumCostLegend"),
        method: clean("frontierMethodNote"),
        region: clean("resultsRegion"),
        sheet: clean("printSheet"),
        tilt: document.getElementById("sunPathWrap")
          ? document.getElementById("sunPathWrap").style.display
          : "missing",
        cutLabel: label ? label.textContent.trim() : "",
      };
    })()`);
  gate(
    "battery-only cumulative panel asks what the battery changes",
    /battery/i.test(noPanelSurface.title) &&
      !/solar/i.test(noPanelSurface.title),
    noPanelSurface.title.slice(0, 140),
  );
  gate(
    "battery-only cumulative legend does not call the run a solar system",
    /Battery only:/.test(noPanelSurface.legend) &&
      !/Solar system:/.test(noPanelSurface.legend),
    noPanelSurface.legend.slice(0, 170),
  );
  gate(
    "battery-only curve method note describes a battery-only sweep",
    /every battery size/i.test(noPanelSurface.method) &&
      !/panel-and-battery/i.test(noPanelSurface.method),
    noPanelSurface.method.slice(0, 160),
  );
  gate(
    "battery-only power-cost row is named for what it measures",
    /Cost per shifted kWh/.test(noPanelSurface.region) &&
      !/Your power cost/.test(noPanelSurface.region),
    (noPanelSurface.region.match(/Cost per shifted kWh[^A-Z]{0,70}/) || [""])
      .join("")
      .slice(0, 150),
  );
  gate(
    "battery-only tilt guide is not advice about an array it does not build",
    noPanelSurface.tilt === "none" &&
      !/Tilt Guide|Value of the Right Angle/i.test(noPanelSurface.region),
    `sunPathWrap display=${noPanelSurface.tilt}`,
  );
  gate(
    "battery-only BOS checklist carries no PV-only item",
    !/PV Array Isolator|PV DC Isolator/.test(noPanelSurface.region) &&
      /battery rack, the inverter chassis/.test(noPanelSurface.region),
    (noPanelSurface.region.match(/Equipment Grounding[^A-Z]{0,90}/) || [""])
      .join("")
      .slice(0, 150),
  );
  gate(
    "battery-only print sheet carries no bare null",
    noPanelSurface.sheet.length > 100 && !/\bnull\b/.test(noPanelSurface.sheet),
    (noPanelSurface.sheet.match(/Basis:[^A-Z]{0,150}/) || [""])
      .join("")
      .slice(0, 190),
  );

  await evaluate(`(() => {
      const b = document.getElementById("lvlMatrix");
      if (b) b.click();
      return true;
    })()`);
  // Gate on the spectrum badge existing rather than on a fixed delay, so a slow
  // render cannot be mistaken for a copy failure (textContent, not innerText:
  // innerText is "" for a hidden subtree and would burn the whole timeout).
  await ctx.poll(
    async () =>
      evaluate(`(() => {
          const region = document.getElementById("resultsRegion");
          if (!region) return false;
          return [...region.querySelectorAll("span")].some((s) =>
            (s.textContent || "").trim().startsWith("Baseline:"),
          );
        })()`),
    RUN_TIMEOUT_MS,
    1000,
  );
  // Read the two baseline phrases out of the spectrum header itself. Searching
  // the whole region is not enough: the money bar above contributes its own
  // "a battery with no panels..." sentence, so a region-wide /no panels/ check
  // passes even while the header still advertises a solar baseline.
  const baseHeader = await evaluate(`(() => {
      const region = document.getElementById("resultsRegion");
      if (!region) return { badge: "", subtitle: "" };
      const norm = (e) =>
        e ? (e.textContent || "").replace(/\\s+/g, " ").trim() : "";
      const badgeEl = [...region.querySelectorAll("span")].find((s) =>
        (s.textContent || "").trim().startsWith("Baseline:"),
      );
      const subEl = [...region.querySelectorAll("div")].find((d) =>
        (d.textContent || "")
          .trim()
          .startsWith("Comparing larger and smaller configurations"),
      );
      return { badge: norm(badgeEl), subtitle: norm(subEl) };
    })()`);
  gate(
    "battery-only capacity spectrum baseline badge has no phantom solar array",
    /^Baseline: no panels/i.test(baseHeader.badge) &&
      !/kW\s+Solar/i.test(baseHeader.badge),
    baseHeader.badge.slice(0, 120),
  );
  gate(
    "battery-only capacity spectrum baseline subtitle has no phantom solar array",
    /around your baseline of [^.]*battery with no panels/i.test(
      baseHeader.subtitle,
    ) && !/kW\s+solar/i.test(baseHeader.subtitle),
    baseHeader.subtitle.slice(0, 170),
  );
  // The five tier cards scaled a PV axis this mode never builds, and offered
  // "Select This System" on a 17.9 kW array the run's own envelope (pvMax: 0)
  // says cannot exist. They now scale the battery alone.
  const tiers = await evaluate(`(() => {
      const region = document.getElementById("resultsRegion");
      if (!region) return [];
      return [...region.querySelectorAll(".bom-card")]
        .map((c) => {
          const h = c.querySelector("h3");
          const sub = c.querySelector("p");
          return h && sub
            ? { title: h.textContent.trim(), sub: sub.textContent.replace(/\\s+/g, " ").trim() }
            : null;
        })
        .filter((c) => c && /battery with no panels|kW solar/.test(c.sub));
    })()`);
  gate(
    "battery-only capacity spectrum tiers build no panels",
    tiers.length >= 4 &&
      tiers.every(
        (c) =>
          /battery with no panels$/.test(c.sub) && !/kW\s+solar/i.test(c.sub),
      ),
    JSON.stringify(tiers.map((c) => c.sub).slice(0, 2)),
  );
  const tierRegionText = await evaluate(`(() => {
      const region = document.getElementById("resultsRegion");
      return region ? region.innerText.replace(/\\s+/g, " ") : "";
    })()`);
  gate(
    "no battery-only surface reports a solar array with a size",
    /None \(Battery-only\)/.test(tierRegionText) &&
      !/Solar array\s+\d/.test(tierRegionText),
    (tierRegionText.match(/Solar array[^|]{0,26}/g) || [])
      .slice(0, 3)
      .join(" / "),
  );
  // The frontier chart lives on this same All-options surface, and its Y axis
  // plotted the outcome fraction under a "share of your power bill cut" label.
  const axis = await evaluate(`(() => {
      const host = document.getElementById("frontierChart");
      if (!host) return "";
      return [...host.querySelectorAll("text, title, desc")]
        .map((n) => n.textContent)
        .join(" | ")
        .replace(/\\s+/g, " ")
        .trim();
    })()`);
  gate(
    "battery-only frontier chart axis says peak hours, not a bill cut",
    // Name the axis wording itself: a bare /peak/ could be satisfied by any
    // other label in the chart, which is how a soft version of this gate would
    // pass while the axis still read "share of your power bill cut".
    /of your peak hours shifted/i.test(axis) && !/bill/i.test(axis),
    axis.slice(0, 220),
  );
  // A language switch translated the data-i18n markup and left every
  // JS-assembled sentence — the caption, the tariff line, the frontier verdict,
  // the method note — in the previous language, so one page showed two. The
  // re-render must also keep the MODE's variant, which is why the method note's
  // hook is asserted alongside the translated text.
  const langBefore = await evaluate(`(() => {
      const e = document.getElementById("cumCostCaption");
      return e ? e.textContent.replace(/\\s+/g, " ").trim().slice(0, 80) : "";
    })()`);
  await evaluate(`(() => {
      const s = document.getElementById("langSelect");
      s.value = "de";
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await sleep(1500);
  const langAfter = await evaluate(`(() => {
      const cap = document.getElementById("cumCostCaption");
      const method = document.getElementById("frontierMethodNote");
      const label = document.querySelector('label[for="cutSlider"]');
      return {
        caption: cap ? cap.textContent.replace(/\\s+/g, " ").trim().slice(0, 130) : "",
        methodHook: method ? method.getAttribute("data-i18n") : "",
        methodText: method
          ? method.textContent.replace(/\\s+/g, " ").trim().slice(0, 80)
          : "",
        cutLabel: label ? label.textContent.trim() : "",
      };
    })()`);
  gate(
    "language switch re-renders the results instead of half-translating them",
    langAfter.caption.length > 40 &&
      langAfter.caption !== langBefore &&
      !/Running 20-year cost/i.test(langAfter.caption) &&
      langAfter.methodHook === "frontierMethodBattery" &&
      !/^The curve comes from/.test(langAfter.methodText) &&
      /peak|Spitzen/i.test(langAfter.cutLabel),
    `${langAfter.caption.slice(0, 90)} | ${langAfter.cutLabel}`,
  );
  await evaluate(`(() => {
      const s = document.getElementById("langSelect");
      s.value = "en";
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  await sleep(1500);
  const langBack = await evaluate(`(() => {
      const e = document.getElementById("cumCostCaption");
      return e ? e.textContent.replace(/\\s+/g, " ").trim().slice(0, 90) : "";
    })()`);
  gate(
    "switching back restores the English panel",
    /Running 20-year cost/i.test(langBack),
    langBack.slice(0, 120),
  );

  // Back to the Best-pick tab so downstream flows see the familiar view.
  await evaluate(`(() => {
      const b = document.getElementById("lvlBest");
      if (b) b.click();
      return true;
    })()`);
  await sleep(600);

  // Leave the default hardware behind for every downstream flow.
  await evaluate(`(() => {
      const hw = document.getElementById("hardwareConfig");
      hw.value = "both";
      hw.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
}
