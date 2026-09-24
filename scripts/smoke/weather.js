// Weather-persistence + location-consent flow: the 17s defect class. After
// one location load, a same-location reload must perform ZERO network weather
// pulls; selecting a location must never start sizing on its own.
import { gate, sleep } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

// Network counting must see worker sessions too: sizing runs fetch from the
// dedicated worker, invisible to the page's Network domain alone.
export function attachNetworkCounter(ctx) {
  const { send, ws } = ctx;
  let nasaPulls = 0;
  const baseOnmessage = ws.onmessage;
  ws.onmessage = (ev) => {
    baseOnmessage(ev);
    try {
      const m = JSON.parse(ev.data);
      if (m.method === "Target.attachedToTarget" && m.params?.sessionId) {
        // Every attached worker needs its own Network domain to be seen.
        send("Network.enable", {}, m.params.sessionId).catch(() => {});
      }
      if (
        m.method === "Network.responseReceived" &&
        /power\.larc\.nasa\.gov/.test(m.params?.response?.url || "") &&
        !m.params.response.fromDiskCache
      )
        nasaPulls += 1;
    } catch {}
  };
  return {
    enable: () => send("Network.enable"),
    reset: () => {
      nasaPulls = 0;
    },
    get count() {
      return nasaPulls;
    },
  };
}

export async function runWeatherFlow(ctx, actions) {
  const { send, evaluate } = ctx;
  const nasa = attachNetworkCounter(ctx);
  // Worker sessions must be attached (flatten mode) before the first run, or
  // the counter never sees the sizing worker's fetches.
  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });
  await nasa.enable();

  console.log("SMOKE      ── weather persistence ──");
  // Pick a site before the first real worker request; the separate location
  // regression flow exercises a first click with no location selected.
  await actions.chooseHonolulu();
  await evaluate(`document.getElementById("btnRunSizing")?.click()`);
  const firstRun = await ctx.poll(
    async () =>
      evaluate(`document.body.textContent.includes("Total 20-year cost")`),
    RUN_TIMEOUT_MS,
  );
  gate("first-load run completes", firstRun);

  // Cold reload: wipe every persistence layer first, so the run MUST fetch.
  await evaluate(`localStorage.clear()`);
  await evaluate(`indexedDB.deleteDatabase("beco-weather-v2")`);
  await evaluate(`caches.delete("beco-weather-v1")`);
  nasa.reset();
  await send("Page.reload", { ignoreCache: false }).catch(() => {});
  await sleep(5000);
  gate("cold reload run completes", await actions.runAfterReload());
  await sleep(2000); // let straggler chunk responses land
  const coldPulls = nasa.count;
  gate(
    "cold load pulls weather (counter has teeth)",
    coldPulls > 0,
    `${coldPulls} NASA network pulls on the cold load`,
  );
  // Warm reload: persistence layers intact, same location — zero pulls.
  nasa.reset();
  await send("Page.reload", { ignoreCache: false }).catch(() => {});
  await sleep(5000);
  gate(
    "same-location reload pulls zero weather data",
    (await actions.runAfterReload()) && (await sleep(2000), nasa.count === 0),
    `${nasa.count} NASA network pulls after reload (expect 0)`,
  );

  // ── Explicit location consent (location selection never sizes by itself)
  console.log("SMOKE      ── auto-location ──");
  let geoGranted = true;
  try {
    await send("Browser.grantPermissions", {
      origin: new URL(ctx.base).origin,
      permissions: ["geolocation"],
    });
    await send("Emulation.setGeolocationOverride", {
      latitude: 21.31,
      longitude: -157.86,
      accuracy: 100,
    });
  } catch (e) {
    geoGranted = false;
    gate(
      "geolocation emulation granted",
      false,
      String((e && e.message) || e).slice(0, 150),
    );
  }
  if (geoGranted) {
    await evaluate(`document.getElementById("btnGeoLocate").click()`);
    const geoOk = await ctx.poll(
      async () => {
        const lat = await evaluate(
          `document.getElementById("latInput")?.value`,
        );
        const note = await evaluate(
          `document.getElementById("locNote")?.textContent || ""`,
        );
        return lat === "21.31" && /precise location/i.test(note);
      },
      60000,
      1000,
    );
    gate(
      "location resolves without starting sizing",
      geoOk &&
        !(await evaluate(`!document.getElementById("resultsRegion")?.hidden`)),
    );
  }
}
