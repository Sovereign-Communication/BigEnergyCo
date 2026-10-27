// Accessibility flow: the four things static markup checks cannot see.
//   1. keyboard — real Tab events reach the controls each surface STATE must
//      expose, phase by state: result stage (sliders), quick mode (document
//      default: structural CTA controls), manual mode (#fullControls), and
//      the kWh load panel (behind loadMode=kwh). systemGoal is a permanently
//      hidden compatibility select — the visible goal controls are the hero
//      segmented buttons, asserted in the quick phase. The walk seeds focus
//      at the first visible tabbable so its start is deterministic (Chrome
//      resumes sequential navigation from the last-focused element and
//      blur() does not reset it) and re-enters on BODY (headless focus
//      briefly leaves the document between the last element and the wrap).
//      Separately, role=button DIVs are proven OPERABLE: Enter and Space
//      must reach them through chat.js's global delegation — focusable but
//      inert would be a keyboard dead end.
//   2. names — every visible control has an accessible name; sampled in the
//      arrival state, with the manual panel open, and with the kWh panel
//      open, asserted as one union so no state's controls escape a check.
//   3. contrast — product text meets WCAG AA (4.5:1, or 3:1 for large text)
//      against the composited background chain; gradient/image backgrounds
//      are skipped as unknowable rather than guessed.
//   4. reduced motion — the two user-triggered scroll sites jump instantly
//      under prefers-reduced-motion and stay animated without it, measured
//      synchronously through the real scrollIntoView call sites.
// Requires a completed sizing run for the result-stage, contrast, and scroll
// checks (site A guards on lastPayload, site B only renders with results);
// callers place it after a results flow. Ordering note: the load-mode
// sub-phase runs LAST because its change event is the product's own
// invalidation (markPrecalcDirty hides the card by design) — everything
// card-dependent is finished before it. End state: arrival mode radios and
// loadMode value restored, regular (non-simple) display, no emulation; the
// card is intentionally left invalidated ("Inputs changed" status), which
// closing-flow gates do not assert on.
import { gate, sleep } from "./runtime.mjs";

// Serialized into the page: every function passed to page() must be
// self-contained or composed in dependency order — a module-scope reference
// does not exist inside the page (ReferenceError at evaluate time).
const page = (...fns) =>
  `(() => {\n${fns.map((f) => `const ${f.name} = ${f};`).join("\n")}\nreturn ${fns[fns.length - 1].name}();\n})()`;

function descOf(el) {
  if (!el || el === document.body) return "BODY";
  const name = (
    el.getAttribute("aria-label") ||
    el.textContent ||
    el.value ||
    ""
  )
    .trim()
    .slice(0, 40);
  return `${el.tagName}#${el.id || "?"}|${name}`;
}

function seedFirstTabbable() {
  const cands = [
    ...document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ];
  const el = cands.find((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      r.width > 0 &&
      r.height > 0 &&
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      !e.disabled
    );
  });
  if (!el) return "NONE";
  el.focus();
  return descOf(el);
}

function activeDesc() {
  return descOf(document.activeElement);
}

function accessibleName(e) {
  const al = (e.getAttribute("aria-label") || "").trim();
  if (al) return al;
  const lb = e.getAttribute("aria-labelledby");
  if (lb) {
    const text = lb
      .split(/\s+/)
      .map((id) => (document.getElementById(id) || {}).textContent || "")
      .join(" ")
      .trim();
    if (text) return text;
  }
  if (e.id) {
    const l = document.querySelector(`label[for="${CSS.escape(e.id)}"]`);
    if (l && l.textContent.trim()) return l.textContent.trim();
  }
  const wrap = e.closest("label");
  if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
  if ((e.textContent || "").trim()) return e.textContent.trim();
  if ((e.title || "").trim()) return e.title.trim();
  if ((e.type === "button" || e.type === "submit") && (e.value || "").trim()) {
    return e.value.trim();
  }
  return "";
}

function nameFailures() {
  const fails = [];
  for (const e of document.querySelectorAll(
    "button, input, select, textarea, a[href]",
  )) {
    if (e.type === "hidden") continue;
    if (e.getAttribute("aria-hidden") === "true") continue;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (!accessibleName(e)) {
      fails.push(
        `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}` +
          `${e.className ? "." + String(e.className).split(" ")[0] : ""}`,
      );
    }
  }
  return fails;
}

function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || "");
  if (!m) return null;
  const p = m[1].split(",").map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}

function relativeLuminance(c) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

// First opaque (composited) background up the ancestor chain; null when a
// gradient/image makes the real background unknowable from computed styles.
function effectiveBg(el) {
  const layers = [];
  let node = el;
  while (node) {
    const cs = getComputedStyle(node);
    if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
    const c = parseColor(cs.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
    node = node.parentElement;
  }
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    base = {
      r: L.r * L.a + base.r * (1 - L.a),
      g: L.g * L.a + base.g * (1 - L.a),
      b: L.b * L.a + base.b * (1 - L.a),
      a: 1,
    };
  }
  return base;
}

function contrastFailures() {
  const groups = new Map();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[hidden], [aria-hidden='true'], .sr-only")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (Number(cs.opacity) < 0.1) continue;
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(" ");
    if (!text) continue;
    const fg = parseColor(cs.color);
    if (!fg || fg.a === 0) continue;
    const bg = effectiveBg(el);
    if (!bg) continue; // gradient/image background: skipped, not guessed
    const comp =
      fg.a < 1
        ? {
            r: fg.r * fg.a + bg.r * (1 - fg.a),
            g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a),
          }
        : fg;
    const l1 = relativeLuminance(comp);
    const l2 = relativeLuminance(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio >= need) continue;
    const sig = `${cs.color}|rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})|${size}|${bold}`;
    const hit = groups.get(sig);
    if (hit) hit.count++;
    else {
      groups.set(sig, {
        ratio: Math.round(ratio * 100) / 100,
        need,
        count: 1,
        example: text.slice(0, 60),
        selector: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${
          el.className && typeof el.className === "string"
            ? "." + el.className.split(" ")[0]
            : ""
        }`,
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.ratio - b.ratio);
}

function reduceMatches() {
  return (
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// One synchronous evaluate: reset to top, read y0, click the site's own
// trigger, read again before any animation frame — an instant jump is
// visible here while a smooth scroll still reads y0. Self-contained: the
// selector arrives as a parameter, never as a page-visible closure.
function fireAndSample(sel) {
  window.scrollTo({ top: 0, behavior: "instant" });
  const y0 = window.scrollY;
  const node = document.querySelector(sel);
  if (!node) return { fired: false, y0, yImmediate: y0 };
  node.click();
  return { fired: true, y0, yImmediate: window.scrollY };
}

async function tabWalk(ctx, label, expectIds) {
  const { evaluate, send } = ctx;
  const seed = await evaluate(page(descOf, seedFirstTabbable));
  if (seed === "NONE" || seed === "BODY") {
    gate(`keyboard ${label}: page has a tabbable`, false, seed);
    return;
  }
  const reached = new Set([(seed.split("#")[1] || "").split("|")[0]]);
  const seen = new Set([seed]);
  let wrapped = false;
  let bodyStrikes = 0;
  for (let i = 0; i < 120; i++) {
    for (const type of ["rawKeyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", {
        type,
        windowsVirtualKeyCode: 9,
        code: "Tab",
        key: "Tab",
      });
    }
    const desc = await evaluate(page(descOf, activeDesc));
    if (desc === "BODY") {
      // Headless focus stepped out of the document; the next Tab re-enters
      // at the top. Three consecutive BODY strikes means focus is genuinely
      // gone — stop rather than spin.
      if (++bodyStrikes > 2) break;
      continue;
    }
    bodyStrikes = 0;
    if (seen.has(desc)) {
      wrapped = true;
      break;
    }
    seen.add(desc);
    reached.add((desc.split("#")[1] || "").split("|")[0]);
  }
  const missing = expectIds.filter((id) => !reached.has(id));
  gate(
    `keyboard ${label}: reaches its controls`,
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${seen.size} stops`,
  );
  gate(
    `keyboard ${label}: tab order wraps (no trap)`,
    wrapped,
    `${seen.size} stops`,
  );
}

// Focusable DIV buttons must also be OPERABLE: Enter and Space must reach
// their click through chat.js's global role=button delegation. The instance
// click is shadow-counted first so the control's real side effect (scroll,
// modal, geolocation prompt) never fires — this gate asserts the keystroke
// path, not the effect.
const DIV_BUTTONS = [
  "btnHeroSizing",
  "btnNavSizeArray",
  "btnGeoLocate",
  "btnLegalTerms1",
];

async function assertDivButtonsOperable(ctx) {
  const { evaluate, send } = ctx;
  const failures = [];
  let checked = 0;
  for (const id of DIV_BUTTONS) {
    const prep = await evaluate(`(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) return false;
      el.__origClick = el.click;
      window.__kbc = 0;
      el.click = function () { window.__kbc += 1; };
      el.focus();
      return document.activeElement === el;
    })()`);
    if (!prep) {
      failures.push(`${id}: missing or unfocusable`);
      continue;
    }
    const counts = {};
    for (const [name, key, vk] of [
      ["Enter", "Enter", 13],
      ["Space", " ", 32],
    ]) {
      for (const type of ["rawKeyDown", "keyUp"]) {
        await send("Input.dispatchKeyEvent", {
          type,
          key,
          code: key === "Enter" ? "Enter" : "Space",
          windowsVirtualKeyCode: vk,
        });
      }
      counts[name] = await evaluate(`window.__kbc`);
    }
    await evaluate(`(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      el.click = el.__origClick;
      delete el.__origClick;
      return true;
    })()`);
    checked++;
    if (counts.Enter < 1 || counts.Space < 1) {
      failures.push(`${id}: Enter=${counts.Enter} Space=${counts.Space}`);
    }
  }
  gate(
    "role=button divs respond to Enter and Space",
    failures.length === 0 && checked > 0,
    failures.length ? failures.join("; ") : `${checked} controls × 2 keys`,
  );
}

async function measureSite(ctx, { label, sel, instant }) {
  const { evaluate } = ctx;
  const { fired, y0, yImmediate } = await evaluate(
    `(${fireAndSample})(${JSON.stringify(sel)})`,
  );
  if (!fired) {
    gate(`scroll site ${label}: trigger control exists`, false, "not found");
    return;
  }
  await sleep(700); // settle a smooth animation if one was started
  const yFinal = await evaluate(`window.scrollY`);
  const moved = Math.abs(yFinal - y0);
  const immediate = Math.abs(yImmediate - y0);
  const traveled = moved > 100;
  if (instant) {
    gate(
      `scroll site ${label}: jumps instantly under reduced motion`,
      traveled && immediate > moved * 0.75,
      `moved ${moved}px, ${immediate}px before first frame`,
    );
  } else {
    gate(
      `scroll site ${label}: stays animated when motion is allowed`,
      traveled && immediate < 10,
      `moved ${moved}px, ${immediate}px before first frame`,
    );
  }
}

// Always-visible structural controls (independent of mode/load state).
const STRUCTURAL = [
  "citySearch",
  "btnRunSizing",
  "simpleModeToggle",
  "btnGoalGridtie",
  "btnGoalOffgrid",
];
// Behind #fullControls — visible only with the manual radio checked.
// (dailyKwhInput is NOT asserted here: it also needs loadMode=kwh, which
// its own phase below guarantees deterministically. systemGoal is a
// permanently hidden compatibility select — never tabbable by design.)
const MANUAL_PANEL = [
  "loadMode",
  "chemSelect",
  "roofAreaM2",
  "customRateVal",
  "citySearch",
  "btnRunSizing",
];
// Behind panelKwh — only with loadMode=kwh.
const KWH_PANEL = ["dailyKwhInput"];
// Result-stage spectrum controls — only with a completed run.
const RESULTS = ["cutSlider", "budgetSlider"];

export async function runA11yFlow(ctx) {
  const { evaluate, send } = ctx;
  const setMode = (id) =>
    evaluate(`(() => { const r = document.getElementById(${JSON.stringify(id)});
      if (!r) return false;
      if (!r.checked) r.click();
      return r.checked; })()`);
  const setLoadMode = (value) =>
    evaluate(`(() => { const s = document.getElementById("loadMode");
      if (!s) return false;
      s.value = ${JSON.stringify(value)};
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return s.value; })()`);

  // Arrival state, so every phase below can restore it. Simple mode is
  // normalized off first: the scroll sites measure the Regular surface (the
  // Simple card is exercised by the sites themselves).
  const arrivalQuick = await evaluate(
    `document.getElementById("modeQuick")?.checked !== false`,
  );
  const arrivalLoadMode = await evaluate(
    `document.getElementById("loadMode")?.value || "bill"`,
  );
  if (await evaluate(`document.getElementById("simpleModeToggle")?.checked`)) {
    await evaluate(`document.getElementById("simpleModeToggle").click()`);
  }

  // Names in the arrival state (covers whatever is visible right now).
  const nameSets = [await evaluate(page(accessibleName, nameFailures))];

  // Result-stage keyboard + WCAG AA contrast (card surface).
  const cardVisible = await evaluate(
    `document.getElementById("resultsRegion")?.hidden !== true &&
     document.body.textContent.includes("Total 20-year cost")`,
  );
  gate("result card present for result-stage checks", cardVisible, "");
  if (cardVisible) {
    await tabWalk(ctx, "result stage", RESULTS);
    const contrastFails = await evaluate(
      page(parseColor, relativeLuminance, effectiveBg, contrastFailures),
    );
    gate(
      "product text meets WCAG AA contrast",
      contrastFails.length === 0,
      contrastFails.length
        ? contrastFails
            .slice(0, 5)
            .map(
              (f) =>
                `${f.ratio}:1 (needs ${f.need}) ${f.selector} "${f.example}"`,
            )
            .join(" | ")
        : "all pass",
    );
  } else {
    gate("scroll sites: result card present", false, "skipped — no card");
  }

  // Reduced-motion contract at the two user-triggered scroll sites.
  //    Site A: enabling Simple mode scrolls to #sizing (ui.js subscription).
  //    Site B: "See full details" scrolls to #resultsRegion (ui.js click).
  //    Each click flips the mode, so the pair self-balances back to Regular.
  if (cardVisible) {
    const SITE_A = "#simpleModeToggle";
    const SITE_B = "#btnSimpleDetails";
    const emulated = (value) =>
      send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value }],
      });
    try {
      const normalReduce = await evaluate(`(${reduceMatches})()`);
      gate(
        "matchMedia reports no reduced motion by default",
        normalReduce === false,
        String(normalReduce),
      );
      await measureSite(ctx, { label: "simple-mode", sel: SITE_A });
      // Site A left us in Simple mode; site B is only rendered there.
      await measureSite(ctx, { label: "see-details", sel: SITE_B });

      await emulated("reduce");
      const emulatedReduce = await evaluate(`(${reduceMatches})()`);
      gate(
        "matchMedia honors emulated reduced motion",
        emulatedReduce === true,
        String(emulatedReduce),
      );
      await measureSite(ctx, {
        label: "simple-mode",
        sel: SITE_A,
        instant: true,
      });
      await measureSite(ctx, {
        label: "see-details",
        sel: SITE_B,
        instant: true,
      });
    } finally {
      await emulated(""); // emulation must never leak past this flow
      const cleared = await evaluate(`(${reduceMatches})()`);
      gate(
        "reduced-motion emulation clears cleanly",
        cleared === false,
        String(cleared),
      );
      if (
        await evaluate(`document.getElementById("simpleModeToggle")?.checked`)
      ) {
        await evaluate(`document.getElementById("simpleModeToggle").click()`);
      }
    }
  }

  // Keyboard operability of the role=button DIVs (state-independent; runs
  // after the scroll measurements so nothing else is moving).
  await assertDivButtonsOperable(ctx);

  // Quick mode (document default): structural CTA controls.
  await setMode("modeQuick");
  await tabWalk(ctx, "quick mode", STRUCTURAL);

  // Manual mode: the #fullControls panel + its names sample.
  const manualOk = await setMode("modeManual");
  if (manualOk) {
    await tabWalk(ctx, "manual mode", MANUAL_PANEL);
    nameSets.push(await evaluate(page(accessibleName, nameFailures)));
  } else {
    gate("manual mode radio present for keyboard phase", false, "not found");
  }

  // kWh load panel — LAST pre-cleanup phase: its change event is the
  // product's own invalidation (markPrecalcDirty hides the card), so every
  // card-dependent check above has already run.
  const kwhSet = await setLoadMode("kwh");
  if (kwhSet === "kwh") {
    await tabWalk(ctx, "kWh load panel", KWH_PANEL);
    nameSets.push(await evaluate(page(accessibleName, nameFailures)));
  } else {
    gate("loadMode switch to kwh for keyboard phase", false, String(kwhSet));
  }
  await setLoadMode(arrivalLoadMode);

  // Restore arrival mode radios (loadMode value restored above).
  if (arrivalQuick) await setMode("modeQuick");
  else await setMode("modeManual");

  // One union across all sampled states — a control hidden in one state
  // must still be named when its state exposes it.
  const nameFails = [...new Set(nameSets.flat())];
  gate(
    "every visible control has an accessible name",
    nameFails.length === 0,
    nameFails.length ? nameFails.slice(0, 8).join(", ") : "all named",
  );
}
