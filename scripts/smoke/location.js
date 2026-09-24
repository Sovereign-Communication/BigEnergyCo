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

  if (!(await actions.chooseHonolulu()))
    throw new Error("Honolulu suggestion missing");
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
  await evaluate(`(() => {
    Worker.prototype.postMessage = window.__locationOriginalPost;
    delete window.__locationOriginalPost;
    delete window.__locationPosts;
  })()`);
}
