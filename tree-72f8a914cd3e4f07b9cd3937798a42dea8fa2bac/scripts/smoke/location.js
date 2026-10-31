// Reproduced location-input failures: typing a new city must not inherit the
// old coordinates, and edited/cleared coordinates must retire old results.
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runLocationFlow(ctx, actions) {
  const { evaluate } = ctx;
  console.log("SMOKE      ── location edits ──");
  await actions.navigate(`${ctx.base}?location-playtest=${Date.now()}`);
  await evaluate(`(() => {
    window.__locationPosts = [];
    window.__locationOriginalPost = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message) {
      if (message?.type === "run") window.__locationPosts.push(message);
      return window.__locationOriginalPost.apply(this, arguments);
    };
  })()`);

  // The five slots the generator fuel helper writes: the label phrase (the unit
  // word lives inside the translated string), the example price, both unit
  // suffixes, and the two footnote figures. Which unit system applies is derived
  // from the site's coordinates, so the location flow is where it changes.
  const fuelHelper = () =>
    evaluate(`({
      label: document.querySelector('label[for="genFuelPrice"]')?.textContent || "",
      placeholder: document.getElementById("genFuelPrice")?.placeholder || "",
      unit: document.getElementById("genBurnUnit")?.textContent || "",
      unit2: document.getElementById("genBurnUnit2")?.textContent || "",
      petrol: document.getElementById("genPetrolBurn")?.textContent || "",
      diesel: document.getElementById("genDieselBurn")?.textContent || "",
    })`);

  if (!(await actions.chooseHonolulu()))
    throw new Error("Honolulu suggestion missing");
  const honoluluSwitched = await ctx.poll(
    async () => (await fuelHelper()).unit === "gal",
    5000,
    250,
  );
  const honoluluFuel = await fuelHelper();
  gate(
    "Honolulu switches the fuel helper to gallons",
    honoluluSwitched &&
      /per gallon/.test(honoluluFuel.label) &&
      honoluluFuel.placeholder === "e.g. 3.90" &&
      honoluluFuel.unit === "gal" &&
      honoluluFuel.unit2 === "gal" &&
      honoluluFuel.petrol === "0.13" &&
      honoluluFuel.diesel === "0.09",
    JSON.stringify(honoluluFuel),
  );
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  let completed = await ctx.poll(
    async () =>
      evaluate(
        `!document.getElementById("resultsRegion")?.hidden && !document.getElementById("btnRunSizing")?.disabled`,
      ),
    RUN_TIMEOUT_MS,
    500,
  );
  let posts = await evaluate(`window.__locationPosts.length`);
  gate(
    "explicit Honolulu run completes",
    completed && posts === 1,
    `posts=${posts}`,
  );

  await evaluate(`(() => {
    const search = document.getElementById("citySearch");
    search.value = "New York";
    search.dispatchEvent(new InputEvent("input", { bubbles: true }));
    document.getElementById("btnRunSizing").click();
  })()`);
  const unresolvedCity = await evaluate(`({
    status: document.getElementById("sizingStatus")?.textContent || "",
    note: document.getElementById("locNote")?.textContent || "",
    hidden: document.getElementById("resultsRegion")?.hidden,
    posts: window.__locationPosts.length,
  })`);
  gate(
    "editing a city blocks the old coordinates and explains the wait",
    unresolvedCity.hidden &&
      unresolvedCity.posts === 1 &&
      unresolvedCity.note === "" &&
      /choose a city suggestion|wait for lookup/i.test(unresolvedCity.status),
    JSON.stringify(unresolvedCity),
  );
  const suggested = await ctx.poll(
    async () =>
      evaluate(
        `document.querySelectorAll('#citySuggestions [role="option"]').length > 0`,
      ),
    15000,
    250,
  );
  if (!suggested) throw new Error("New York suggestion missing");
  await evaluate(
    `document.querySelector('#citySuggestions [role="option"]').click()`,
  );
  const newYork = await evaluate(`({
    city: document.getElementById("citySearch")?.value || "",
    latitude: Number(document.getElementById("latInput")?.value),
    longitude: Number(document.getElementById("lonInput")?.value),
    note: document.getElementById("locNote")?.textContent || "",
  })`);
  gate(
    "city label, note, and coordinates agree",
    /New York/i.test(newYork.city) &&
      /New York/i.test(newYork.note) &&
      Math.abs(newYork.latitude - 40.71) < 0.02 &&
      Math.abs(newYork.longitude + 74.01) < 0.02,
    JSON.stringify(newYork),
  );
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  completed = await ctx.poll(
    async () =>
      evaluate(
        `!document.getElementById("resultsRegion")?.hidden && !document.getElementById("btnRunSizing")?.disabled`,
      ),
    RUN_TIMEOUT_MS,
    500,
  );
  let lastPost = await evaluate(`window.__locationPosts.at(-1)`);
  gate(
    "New York run uses the selected coordinates",
    completed && lastPost?.latitude === 40.71 && lastPost?.longitude === -74.01,
    JSON.stringify(lastPost),
  );

  // The public example action must resolve from the bundled seed data. Its
  // former "Honolulu, HI" query did not match that catalog and stayed pending
  // on the online geocoder. Starting from New York also proves the example
  // replaces stale coordinates/results instead of merely changing its text.
  await evaluate(`document.getElementById("btnSeeExample").click()`);
  const exampleInput = await evaluate(`(() => {
    const slider = document.getElementById("billSlider");
    const value = Number(slider?.value);
    const step = Number(slider?.step);
    const min = Number(slider?.min);
    const shown = Number((document.getElementById("billSliderVal")?.textContent || "").replace(/[^0-9.]/g, ""));
    return {
      city: document.getElementById("citySearch")?.value || "",
      value,
      step,
      min,
      stepAligned: step > 0 && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-7,
      labelMatches: Number.isFinite(shown) && shown === value,
      resultsHidden: document.getElementById("resultsRegion")?.hidden,
      posts: window.__locationPosts.length,
    };
  })()`);
  gate(
    "See an example sets an approximate bill without starting a run",
    exampleInput.city === "Honolulu" &&
      exampleInput.stepAligned &&
      exampleInput.labelMatches &&
      exampleInput.resultsHidden &&
      exampleInput.posts === 2 &&
      Math.abs(exampleInput.value - 250) <= exampleInput.step / 2 + 0.01,
    JSON.stringify(exampleInput),
  );
  const exampleResolved = await ctx.poll(
    async () =>
      evaluate(`(() => {
        const lat = Number(document.getElementById("latInput")?.value);
        const lon = Number(document.getElementById("lonInput")?.value);
        return /Honolulu/i.test(document.getElementById("citySearch")?.value || "") &&
          /Honolulu/i.test(document.getElementById("locNote")?.textContent || "") &&
          Math.abs(lat - 21.31) < 0.03 && Math.abs(lon + 157.86) < 0.03;
      })()`),
    6000,
    100,
  );
  const exampleState = await evaluate(`({
    city: document.getElementById("citySearch")?.value || "",
    note: document.getElementById("locNote")?.textContent || "",
    latitude: Number(document.getElementById("latInput")?.value),
    longitude: Number(document.getElementById("lonInput")?.value),
    bill: Number(document.getElementById("billSlider")?.value),
    billLabel: document.getElementById("billSliderVal")?.textContent || "",
    billLabelMatches: Number((document.getElementById("billSliderVal")?.textContent || "").replace(/[^0-9.]/g, "")) === Number(document.getElementById("billSlider")?.value),
    resultsHidden: document.getElementById("resultsRegion")?.hidden,
    posts: window.__locationPosts.length,
  })`);
  gate(
    "See an example resolves Honolulu locally and retires the old result",
    exampleResolved &&
      exampleState.billLabelMatches &&
      exampleState.resultsHidden &&
      exampleState.posts === 2,
    JSON.stringify(exampleState),
  );

  await evaluate(`(() => {
    document.getElementById("coordDetails").open = true;
    const lat = document.getElementById("latInput");
    const lon = document.getElementById("lonInput");
    lat.value = "34.05";
    lat.dispatchEvent(new Event("input", { bubbles: true }));
    lon.value = "-118.24";
    lon.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("btnRunSizing").click();
  })()`);
  const pendingCoords = await evaluate(`({
    status: document.getElementById("sizingStatus")?.textContent || "",
    hidden: document.getElementById("resultsRegion")?.hidden,
    note: document.getElementById("locNote")?.textContent || "",
    posts: window.__locationPosts.length,
  })`);
  gate(
    "click during coordinate debounce cannot run stale results",
    pendingCoords.hidden &&
      pendingCoords.posts === 2 &&
      pendingCoords.note === "" &&
      /checking those coordinates/i.test(pendingCoords.status),
    JSON.stringify(pendingCoords),
  );
  const coordsReady = await ctx.poll(
    async () =>
      evaluate(
        `/Using custom coordinates \\(34\\.05, -118\\.24\\)/.test(document.getElementById("locNote")?.textContent || "")`,
      ),
    10000,
    100,
  );
  gate("custom coordinates are confirmed after the debounce", coordsReady);
  await evaluate(`(() => {
    document.getElementById("btnRunSizing").click();
    document.getElementById("btnRunSizing").click();
    document.getElementById("btnRunSizing").click();
  })()`);
  completed = await ctx.poll(
    async () =>
      evaluate(
        `!document.getElementById("resultsRegion")?.hidden && !document.getElementById("btnRunSizing")?.disabled`,
      ),
    RUN_TIMEOUT_MS,
    500,
  );
  lastPost = await evaluate(`window.__locationPosts.at(-1)`);
  posts = await evaluate(`window.__locationPosts.length`);
  gate(
    "custom-coordinate run uses current coordinates despite rapid clicks",
    completed &&
      posts === 3 &&
      lastPost?.latitude === 34.05 &&
      lastPost?.longitude === -118.24,
    JSON.stringify({ posts, run: lastPost }),
  );

  await evaluate(`(() => {
    const lat = document.getElementById("latInput");
    lat.value = "";
    lat.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const cleared = await evaluate(`({
    status: document.getElementById("sizingStatus")?.textContent || "",
    hidden: document.getElementById("resultsRegion")?.hidden,
    posts: window.__locationPosts.length,
  })`);
  gate(
    "clearing a coordinate immediately hides stale results",
    cleared.hidden &&
      cleared.posts === 3 &&
      /pick a city/i.test(cleared.status),
    JSON.stringify(cleared),
  );

  await evaluate(`(() => {
    const lat = document.getElementById("latInput");
    lat.value = "91";
    lat.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("btnRunSizing").click();
  })()`);
  const invalidCoordinates = await evaluate(`({
    status: document.getElementById("sizingStatus")?.textContent || "",
    hidden: document.getElementById("resultsRegion")?.hidden,
    posts: window.__locationPosts.length,
  })`);
  gate(
    "out-of-range coordinates explain the valid bounds and never run",
    invalidCoordinates.hidden &&
      invalidCoordinates.posts === 3 &&
      /latitude.*-?90.*90.*longitude.*-?180.*180/i.test(
        invalidCoordinates.status,
      ),
    JSON.stringify(invalidCoordinates),
  );

  await evaluate(`(() => {
    const lat = document.getElementById("latInput");
    lat.value = "34.05";
    lat.dispatchEvent(new Event("input", { bubbles: true }));
    const lon = document.getElementById("lonInput");
    lon.value = "-118.24";
    lon.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await sleep(600);
  await evaluate(`(() => {
    const mode = document.getElementById("loadMode");
    mode.value = "kwh";
    mode.dispatchEvent(new Event("change", { bubbles: true }));
    const kwh = document.getElementById("dailyKwhInput");
    kwh.value = "";
    kwh.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("btnRunSizing").click();
  })()`);
  await sleep(600);
  const emptyKwh = await evaluate(`({
    status: document.getElementById("sizingStatus")?.textContent || "",
    hidden: document.getElementById("resultsRegion")?.hidden,
    posts: window.__locationPosts.length,
  })`);
  gate(
    "empty kWh entry stays on the form with an actionable range hint",
    emptyKwh.hidden &&
      emptyKwh.posts === 3 &&
      /0\.5.*500 kWh/i.test(emptyKwh.status),
    JSON.stringify(emptyKwh),
  );
  for (const invalidKwh of ["0.1", "501"]) {
    await evaluate(`(() => {
      const kwh = document.getElementById("dailyKwhInput");
      kwh.value = "${invalidKwh}";
      kwh.dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("btnRunSizing").click();
    })()`);
    const invalidLoad = await evaluate(`({
      status: document.getElementById("sizingStatus")?.textContent || "",
      hidden: document.getElementById("resultsRegion")?.hidden,
      posts: window.__locationPosts.length,
    })`);
    gate(
      `${invalidKwh} kWh/day is rejected before starting the worker`,
      invalidLoad.hidden &&
        invalidLoad.posts === 3 &&
        /0\.5.*500 kWh/i.test(invalidLoad.status),
      JSON.stringify(invalidLoad),
    );
  }
  // Back to a metric site: the same five slots must follow the second switch in
  // the other direction, with the exact pre-refactor strings.
  await evaluate(`(() => {
    const lat = document.getElementById("latInput");
    const lon = document.getElementById("lonInput");
    lat.value = "48.85";
    lat.dispatchEvent(new Event("input", { bubbles: true }));
    lon.value = "2.35";
    lon.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  const parisSettled = await ctx.poll(
    async () =>
      evaluate(
        `/Using custom coordinates \\(48\\.85, 2\\.35\\)/.test(document.getElementById("locNote")?.textContent || "")`,
      ),
    10000,
    100,
  );
  const parisFuel = await fuelHelper();
  gate(
    "a metric site switches the fuel helper back to litres",
    parisSettled &&
      /per liter/.test(parisFuel.label) &&
      parisFuel.placeholder === "e.g. 1.20" &&
      parisFuel.unit === "L" &&
      parisFuel.unit2 === "L" &&
      parisFuel.petrol === "0.5" &&
      parisFuel.diesel === "0.35",
    JSON.stringify({ settled: parisSettled, ...parisFuel }),
  );

  // The Camper Van preset is fractional, so prove the range, both labels and
  // the actual sizing-worker payload preserve its advertised 2.5 kWh/day.
  await evaluate(`document.getElementById("btnSeeExample").click()`);
  const exampleRestored = await ctx.poll(
    async () =>
      evaluate(`(() => {
        const lat = Number(document.getElementById("latInput")?.value);
        const lon = Number(document.getElementById("lonInput")?.value);
        return Math.abs(lat - 21.31) < 0.03 && Math.abs(lon + 157.86) < 0.03;
      })()`),
    6000,
    100,
  );
  await evaluate(`(() => {
    document.getElementById("btnGoalOffgrid").click();
    document.querySelector('.offgrid-preset-btn[data-kwh="2.5"]').click();
  })()`);
  const camperPreset = await evaluate(`(() => {
    const numberIn = (text) => Number((text || "").replace(/[^0-9.]/g, ""));
    const range = document.getElementById("offgridKwhSlider");
    const bill = document.getElementById("billSlider");
    return {
      goal: document.getElementById("systemGoal")?.value,
      range: Number(range?.value),
      kwhLabel: numberIn(document.getElementById("offgridKwhVal")?.textContent),
      kwhInput: Number(document.getElementById("dailyKwhInput")?.value),
      bill: Number(bill?.value),
      billLabel: numberIn(document.getElementById("billSliderVal")?.textContent),
    };
  })()`);
  gate(
    "Camper Van preset keeps its advertised load across the controls",
    exampleRestored &&
      camperPreset.goal === "offgrid" &&
      camperPreset.range === 2.5 &&
      camperPreset.kwhLabel === 2.5 &&
      camperPreset.kwhInput === 2.5 &&
      camperPreset.billLabel === camperPreset.bill,
    JSON.stringify({ exampleRestored, camperPreset }),
  );
  const beforeCamperRun = await evaluate(`window.__locationPosts.length`);
  await evaluate(`document.getElementById("btnRunSizing").click()`);
  const camperRunCompleted = await ctx.poll(
    async () =>
      evaluate(`!document.getElementById("resultsRegion")?.hidden &&
        !document.getElementById("btnRunSizing")?.disabled &&
        window.__locationPosts.length > ${beforeCamperRun}`),
    RUN_TIMEOUT_MS,
    500,
  );
  const camperRun = await evaluate(`window.__locationPosts.at(-1)`);
  gate(
    "Camper Van sizing worker receives the selected 2.5 kWh/day",
    camperRunCompleted &&
      camperRun?.type === "run" &&
      camperRun?.dailyKwh === 2.5 &&
      camperRun?.mode === "offgrid",
    JSON.stringify({ completed: camperRunCompleted, run: camperRun }),
  );

  await evaluate(`(() => {
    Worker.prototype.postMessage = window.__locationOriginalPost;
    delete window.__locationOriginalPost;
    delete window.__locationPosts;
  })()`);
}
