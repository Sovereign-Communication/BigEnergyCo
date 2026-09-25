// Share-link flow: the serialized state must survive a fresh page — inputs
// restore, sizing still requires the explicit button, then it completes.
import { gate } from "./runtime.mjs";
import { RUN_TIMEOUT_MS } from "./actions.mjs";

export async function runShareFlow(ctx, actions) {
  const { evaluate } = ctx;

  console.log("SMOKE      ── share link ──");
  const shareHash = await evaluate(`(() => {
      document.getElementById("btnShareResult").click();
      return location.hash.startsWith("#s=") ? location.hash : null;
    })()`);
  gate(
    "share click leaves a #s= link in the URL",
    !!shareHash,
    String(shareHash || "").slice(0, 24),
  );
  if (shareHash) {
    await actions.navigate(`${ctx.base}${shareHash}`);
    const restoredInputs = await ctx.poll(
      async () =>
        evaluate(
          `!!document.getElementById("dailyKwhInput")?.value && document.getElementById("resultsRegion")?.hidden === true`,
        ),
      10000,
    );
    const beforeRun = await evaluate(
      `(() => ({ kwh: document.getElementById("dailyKwhInput")?.value, results: !document.getElementById("resultsRegion")?.hidden, hash: location.hash }))()`,
    );
    const sharedState = JSON.parse(
      Buffer.from(shareHash.slice(3), "base64url").toString("utf8"),
    );
    const restoreStatus = await evaluate(
      `document.getElementById("sizingStatus")?.textContent || ""`,
    );
    gate(
      "share link restores inputs and explains it is waiting for a click",
      !!restoredInputs &&
        beforeRun.results === false &&
        Number(beforeRun.kwh) === sharedState.kw &&
        beforeRun.hash === shareHash &&
        /review the inputs/i.test(restoreStatus) &&
        /click Size My System/i.test(restoreStatus),
      JSON.stringify({
        ...beforeRun,
        expectedKwh: sharedState.kw,
        status: restoreStatus,
      }),
    );
    await evaluate(`document.getElementById("btnRunSizing").click()`);
    const restored = await ctx.poll(
      async () => evaluate(`!document.getElementById("resultsRegion")?.hidden`),
      RUN_TIMEOUT_MS,
    );
    gate("share link sizes after the explicit click", !!restored);

    // Careless reload while another calculation is visibly in progress: hold
    // exactly one real Worker message, then reload the same share URL. The
    // new page must restore the exact link inputs without auto-running.
    await evaluate(`(() => {
      window.__reloadRunHeld = false;
      window.__reloadRunPosts = 0;
      const original = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message) {
        if (message?.type === "run") {
          window.__reloadRunPosts += 1;
          if (!window.__reloadRunHeld) {
            window.__reloadRunHeld = true;
            return;
          }
        }
        return original.apply(this, arguments);
      };
      document.getElementById("btnRunSizing").click();
    })()`);
    const held = await ctx.poll(
      async () =>
        evaluate(
          `window.__reloadRunHeld === true && document.getElementById("btnRunSizing")?.disabled === true`,
        ),
      5000,
      50,
    );
    gate("reload fixture holds a real in-flight sizing message", held);
    if (held) {
      // Wait for the NEW document, not merely for "a document that is
      // complete": the first poll tick can still evaluate against the page
      // being navigated away from, which is complete and has the button. On CI
      // that sampled a mid-load fresh document (readyState still "loading",
      // default inputs on screen) and reported the share as lost while the same
      // build passed locally. `performance.timeOrigin` identifies the document,
      // so the navigation must have committed before anything is measured.
      const originBefore = await evaluate(`performance.timeOrigin`);
      await ctx.send("Page.reload", { ignoreCache: false });
      const loaded = await ctx.poll(
        async () => {
          try {
            return await evaluate(
              `performance.timeOrigin !== ${JSON.stringify(originBefore)} && ` +
                `document.readyState === "complete" && !!document.getElementById("btnRunSizing")`,
            );
          } catch {
            return false;
          }
        },
        15000,
        250,
      );
      await evaluate(`(() => {
        window.__reloadPostsAfterLoad = 0;
        const original = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message) {
          if (message?.type === "run") window.__reloadPostsAfterLoad += 1;
          return original.apply(this, arguments);
        };
      })()`);
      // Sample the SETTLED state, never the first frame after load. The
      // restore is asynchronous (the shared site's weather has to resolve
      // before the form is final), so on a slow runner the sample landed while
      // the defaults were still on screen — reported as "the share was lost"
      // on CI while the same build passed locally. Every post-condition is
      // unchanged; only the timing assumption is gone, and a run posted at any
      // point after the hook is installed still fails the gate.
      let afterReload = { loaded: false };
      const settled = await ctx.poll(
        async () => {
          try {
            afterReload = await evaluate(`({
              loaded: document.readyState === "complete",
              kwh: document.getElementById("dailyKwhInput")?.value || "",
              hash: location.hash,
              resultsHidden: document.getElementById("resultsRegion")?.hidden,
              status: document.getElementById("sizingStatus")?.textContent || "",
              posts: window.__reloadPostsAfterLoad,
            })`);
          } catch {
            return false; // a navigation is still in flight
          }
          return (
            afterReload.loaded &&
            Number(afterReload.kwh) === sharedState.kw &&
            afterReload.hash === shareHash &&
            afterReload.resultsHidden === true &&
            /review the inputs/i.test(afterReload.status) &&
            afterReload.posts === 0
          );
        },
        15000,
        250,
      );
      gate(
        "reload during sizing preserves share inputs and waits for explicit consent",
        settled && loaded,
        JSON.stringify(afterReload),
      );
      const retry = await actions.runAndWaitCard();
      gate("explicit sizing recovers after a mid-run reload", retry);
    }

    const malformedCases = [
      { label: "latitude", state: { v: 1, la: 91, lo: 10, kw: 16 } },
      { label: "longitude", state: { v: 1, la: 10, lo: 181, kw: 16 } },
      { label: "daily-kWh", state: { v: 1, la: 21.31, lo: -157.86, kw: 501 } },
    ];
    for (const { label, state } of malformedCases) {
      const malformedHash =
        "#s=" +
        Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
      await actions.navigate(
        `${ctx.base}?malformed-share=${encodeURIComponent(label)}#${malformedHash.slice(1)}`,
      );
      const ready = await ctx.poll(
        async () =>
          evaluate(
            `document.readyState === "complete" && !!document.getElementById("btnRunSizing")`,
          ),
        10000,
        100,
      );
      const before = ready
        ? await evaluate(`(() => ({
            lat: document.getElementById("latInput")?.value || "",
            lon: document.getElementById("lonInput")?.value || "",
            kwh: document.getElementById("dailyKwhInput")?.value || "",
            hash: location.hash,
          }))()`)
        : null;
      await evaluate(`(() => {
        window.__invalidShareOriginalPost = Worker.prototype.postMessage;
        window.__invalidSharePosts = 0;
        Worker.prototype.postMessage = function (message) {
          if (message?.type === "run") window.__invalidSharePosts += 1;
          return window.__invalidShareOriginalPost.apply(this, arguments);
        };
        document.getElementById("btnRunSizing").click();
      })()`);
      const afterReady = await ctx.poll(
        async () => evaluate(`!!document.getElementById("sizingStatus")`),
        5000,
        50,
      );
      const after = afterReady
        ? await evaluate(`(() => ({
            lat: document.getElementById("latInput")?.value || "",
            lon: document.getElementById("lonInput")?.value || "",
            kwh: document.getElementById("dailyKwhInput")?.value || "",
            hash: location.hash,
            hidden: document.getElementById("resultsRegion")?.hidden,
            status: document.getElementById("sizingStatus")?.textContent || "",
            posts: window.__invalidSharePosts,
          }))()`)
        : null;
      gate(
        `malformed share ${label} is rejected before mutating the form or starting a worker`,
        ready &&
          before &&
          after &&
          after.lat === before.lat &&
          after.lon === before.lon &&
          after.kwh === before.kwh &&
          after.hash === malformedHash &&
          after.hidden === true &&
          after.posts === 0 &&
          /pick a city|choose a city|latitude must|daily energy use/i.test(
            after.status,
          ),
        JSON.stringify({ label, before, after }),
      );
      await evaluate(`(() => {
        Worker.prototype.postMessage = window.__invalidShareOriginalPost;
        delete window.__invalidShareOriginalPost;
        delete window.__invalidSharePosts;
      })()`);
    }

    // Leave the shared browser session on the valid result for the following
    // result-surface flow; the malformed-link probes are isolated navigations.
    await actions.navigate(`${ctx.base}${shareHash}`);
    gate(
      "valid share flow recovers after malformed-link probes",
      await actions.runAndWaitCard(),
    );
  }
}
