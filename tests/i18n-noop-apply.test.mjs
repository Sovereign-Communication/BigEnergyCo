import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const I18N_URL = new URL("../assets/js/shared/i18n.js", import.meta.url);
const SRC = readFileSync(I18N_URL, "utf8");

function makeElement(attributeName, key, property, initialValue = "") {
  let currentValue = initialValue;
  let writes = 0;
  const attributes = { [attributeName]: key };
  if (property === "aria-label") attributes["aria-label"] = initialValue;
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
    },
  };
}

test("applyI18n skips unchanged DOM writes and still updates changed translations", async () => {
  const mod = await import(I18N_URL.href + "?no-op=" + Date.now());
  await mod.localesReady;
  let selectedLanguage = "en";
  const text = makeElement("data-i18n", "advisorTitle", "textContent", mod.translate("advisorTitle", {}, "en"));
  const placeholder = makeElement(
    "data-i18n-placeholder",
    "advisorPlaceholder",
    "placeholder",
    mod.translate("advisorPlaceholder", {}, "en"),
  );
  const aria = makeElement(
    "data-i18n-aria-label",
    "advisorClose",
    "aria-label",
    mod.translate("advisorClose", {}, "en"),
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
    assert.deepEqual([text.writes, placeholder.writes, aria.writes], [0, 0, 0]);
    assert.equal(text.read(), mod.translate("advisorTitle", {}, "en"));
    assert.equal(
      placeholder.read(),
      mod.translate("advisorPlaceholder", {}, "en"),
    );
    assert.equal(aria.read(), mod.translate("advisorClose", {}, "en"));

    await mod.applyI18n();
    assert.deepEqual(
      [text.writes, placeholder.writes, aria.writes],
      [0, 0, 0],
      "applying the same locale must not write unchanged DOM values",
    );

    selectedLanguage = "es";
    await mod.applyI18n();
    assert.deepEqual([text.writes, placeholder.writes, aria.writes], [1, 1, 1]);
    assert.equal(text.read(), mod.translate("advisorTitle", {}, "es"));
    assert.equal(
      placeholder.read(),
      mod.translate("advisorPlaceholder", {}, "es"),
    );
    assert.equal(aria.read(), mod.translate("advisorClose", {}, "es"));

    assert.match(SRC, /if \(node\.textContent !== value\) node\.textContent = value/);
    assert.match(SRC, /elNode\.placeholder !== value/);
    assert.match(SRC, /getAttribute\("aria-label"\) !== value/);
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
