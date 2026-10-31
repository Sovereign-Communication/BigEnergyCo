<<<<<<< HEAD
import assert from "node:assert/strict";
import test from "node:test";

const I18N_URL = new URL("../assets/js/shared/i18n.js", import.meta.url);

function makeElement(attributeName, key, property, initialValue = "") {
  let currentValue = initialValue;
  let writes = 0;
  const attributes = { [attributeName]: key };
  return {
    get writes() {
      return writes;
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    get textContent() {
      return property === "textContent" ? currentValue : undefined;
    },
    set textContent(value) {
      if (property === "textContent") {
        currentValue = value;
        writes += 1;
      }
    },
    get placeholder() {
      return property === "placeholder" ? currentValue : undefined;
    },
    set placeholder(value) {
      if (property === "placeholder") {
        currentValue = value;
        writes += 1;
      }
    },
    setAttribute(name, value) {
      attributes[name] = value;
      if (property === "aria-label" && name === "aria-label") {
        currentValue = value;
        writes += 1;
      }
    },
    read() {
      return currentValue;
=======
// The i18n applier must not rewrite text it is only going to write the same
// value back into.
//
// WHY THIS IS A PERFORMANCE TEST, NOT A TIDY-ONE: `applyI18n` runs on every
// page load. It used to assign `elNode.textContent = dict[key]` unconditionally,
// which on the default locale assigned the string the server had already sent —
// destroying and recreating every translated text node to produce an identical
// tree. Assigning textContent dirties layout for the whole subtree, and on the
// staged build that forced a style/layout/paint pass of `section.hero` roughly a
// second AFTER first paint. `section.hero` is the largest contentful element, so
// the wasted write produced a SECOND LCP candidate: a visitor who chose no
// language was paying, in a delayed LCP, to be re-measured.
//
// The guard is exact rather than clever — compare, write only on a difference —
// so this file pins the three things that must hold: the default-locale pass
// writes nothing, a language the user actually chose still writes everything,
// and the source keeps the comparison so a future edit cannot quietly drop it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync("assets/js/shared/i18n.js", "utf8");

/** A DOM small enough to count writes, and faithful enough to expose them. */
function makeNode(attrs = {}, text = "") {
  return {
    attrs,
    textContent: text,
    placeholder: attrs.placeholder ?? "",
    getAttribute: (k) => attrs[k],
    setAttribute(k, v) {
      attrs[k] = v;
>>>>>>> 1129d652 (perf(home): stop the default-locale pass from rewriting text it already has)
    },
  };
}

<<<<<<< HEAD
test("applyI18n skips unchanged DOM writes and still updates changed translations", async () => {
  const mod = await import(I18N_URL.href + "?no-op=" + Date.now());
  await mod.localesReady;
  let selectedLanguage = "en";
  const text = makeElement("data-i18n", "advisorTitle", "textContent");
  const placeholder = makeElement(
    "data-i18n-placeholder",
    "advisorPlaceholder",
    "placeholder",
  );
  const aria = makeElement(
    "data-i18n-aria-label",
    "advisorClose",
    "aria-label",
  );
  const globals = {
    localStorage: { getItem: () => selectedLanguage },
    document: {
      documentElement: {},
      querySelectorAll(selector) {
        if (selector === "[data-i18n]") return [text];
        if (selector === "[data-i18n-placeholder]") return [placeholder];
        if (selector === "[data-i18n-aria-label]") return [aria];
        return [];
      },
    },
    window: {},
  };
  const previous = new Map();
  try {
    for (const [name, value] of Object.entries(globals)) {
      previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value,
        writable: true,
      });
    }

    await mod.applyI18n();
    assert.deepEqual([text.writes, placeholder.writes, aria.writes], [1, 1, 1]);
    assert.equal(text.read(), mod.translate("advisorTitle", {}, "en"));
    assert.equal(
      placeholder.read(),
      mod.translate("advisorPlaceholder", {}, "en"),
    );
    assert.equal(aria.read(), mod.translate("advisorClose", {}, "en"));

    await mod.applyI18n();
    assert.deepEqual(
      [text.writes, placeholder.writes, aria.writes],
      [1, 1, 1],
      "applying the same locale must not write unchanged DOM values",
    );

    selectedLanguage = "es";
    await mod.applyI18n();
    assert.deepEqual([text.writes, placeholder.writes, aria.writes], [2, 2, 2]);
    assert.equal(text.read(), mod.translate("advisorTitle", {}, "es"));
    assert.equal(
      placeholder.read(),
      mod.translate("advisorPlaceholder", {}, "es"),
    );
    assert.equal(aria.read(), mod.translate("advisorClose", {}, "es"));
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
=======
/** Install a document/window/localStorage pair for one call. */
function withDom(nodes, { lang = "en", browserLang = "en-US" } = {}) {
  const keys = ["document", "window", "navigator", "localStorage"];
  // `navigator` is a getter-only property on the Node global, so plain
  // assignment throws. defineProperty for all four keeps the save/restore
  // symmetrical and restores the original descriptors rather than plain values.
  const saved = keys.map((k) => [
    k,
    Object.getOwnPropertyDescriptor(globalThis, k),
  ]);
  const install = (key, value) =>
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  install("document", {
    documentElement: { lang: "", dir: "" },
    querySelectorAll: (sel) =>
      nodes.filter((n) =>
        sel === "[data-i18n]"
          ? n.attrs["data-i18n"] !== undefined
          : sel === "[data-i18n-placeholder]"
            ? n.attrs["data-i18n-placeholder"] !== undefined
            : n.attrs["data-i18n-aria-label"] !== undefined,
      ),
  });
  install("window", {});
  install("navigator", { language: browserLang });
  install("localStorage", {
    getItem: () => (lang === "auto" ? null : lang),
    setItem: () => {},
  });
  return () => {
    for (const [k, desc] of saved) {
      if (desc) Object.defineProperty(globalThis, k, desc);
      else delete globalThis[k];
    }
  };
}

const { applyI18n } = await import("../assets/js/shared/i18n.js");
const { LOCALES } = await import("../assets/js/shared/locales.js");

test("the default locale writes nothing, because nothing differs", async () => {
  const key = Object.keys(LOCALES.en)[0];
  const english = LOCALES.en[key];
  const nodes = [makeNode({ "data-i18n": key }, english)];
  // Record every assignment, so a rewrite of the same value is still visible.
  let writes = 0;
  let current = english;
  Object.defineProperty(nodes[0], "textContent", {
    get: () => current,
    set: (v) => {
      writes++;
      current = v;
    },
    configurable: true,
  });
  const restore = withDom(nodes);
  try {
    await applyI18n();
  } finally {
    restore();
  }
  assert.equal(
    writes,
    0,
    `applyI18n rewrote a node that already held ${JSON.stringify(english)}; ` +
      "that dirties layout for the whole subtree and produced a second LCP " +
      "candidate on the hero",
  );
});

test("a language the visitor actually chose still writes every string", async () => {
  const key = Object.keys(LOCALES.en).find(
    (k) => LOCALES.es?.[k] && LOCALES.es[k] !== LOCALES.en[k],
  );
  assert.ok(
    key,
    "the es dictionary must differ from en for this to be provable",
  );
  const nodes = [makeNode({ "data-i18n": key }, LOCALES.en[key])];
  const restore = withDom(nodes, { lang: "es" });
  try {
    await applyI18n();
  } finally {
    restore();
  }
  assert.equal(
    nodes[0].textContent,
    LOCALES.es[key],
    "choosing a language must still translate; the guard is for identical " +
      "values, not for skipping translation",
  );
});

test("the guard is in the source, on all three attribute kinds", () => {
  // A behavioural test alone would pass if someone deleted the guard and the
  // fixtures happened to match. Pin the comparison itself.
  assert.match(
    SRC,
    /if \(node\.textContent !== value\) node\.textContent = value/,
    "the text guard must compare before writing",
  );
  assert.match(
    SRC,
    /elNode\.placeholder !== dict\[key\]/,
    "the placeholder guard must compare before writing",
  );
  assert.match(
    SRC,
    /getAttribute\("aria-label"\) !== dict\[key\]/,
    "the aria-label guard must compare before writing",
  );
  assert.doesNotMatch(
    SRC,
    /elNode\.textContent = dict\[key\];/,
    "an unconditional textContent assignment is exactly the defect this file " +
      "exists to prevent",
  );
>>>>>>> 1129d652 (perf(home): stop the default-locale pass from rewriting text it already has)
});
