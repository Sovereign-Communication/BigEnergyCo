import assert from "node:assert/strict";
import test from "node:test";
import { byId, el } from "../assets/js/shared/dom.js";

function withDocument(run) {
  const created = [];
  const documentStub = {
    getElementById(id) {
      return { id };
    },
    createElement(tag) {
      const element = {
        tagName: tag,
        attributes: {},
        style: { cssText: "" },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
      };
      created.push(element);
      return element;
    },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentStub,
    writable: true,
  });
  try {
    run(created);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

test("shared DOM helpers preserve id lookup and element construction", () => {
  withDocument((created) => {
    assert.deepEqual(byId("citySearch"), { id: "citySearch" });

    const element = el(
      "button",
      { id: "pick", class: "choice", style: "display: block", role: "option" },
      "Choose city",
    );
    assert.equal(element.tagName, "button");
    assert.equal(element.attributes.id, "pick");
    assert.equal(element.className, "choice");
    assert.equal(element.style.cssText, "display: block");
    assert.equal(element.attributes.role, "option");
    assert.equal(element.textContent, "Choose city");
    assert.equal(created.length, 1);
  });
});

test("shared DOM helpers treat text as text, never as markup", () => {
  // `el` is the one element factory every widget uses, and the Jev audit flagged
  // it as an escape-output sink twice (location-picker.js:25, then the shared
  // copy). It is not one: the text argument goes to `textContent`, so a hostile
  // string is data. This test is the reason that reading can stay true — the
  // tempting "fix" for a missing bold word is `innerHTML +=`, and one such edit
  // anywhere in this helper turns every caller into a sink.
  withDocument((created) => {
    const hostile = "<img src=x onerror=alert(1)><script>alert(2)</script>";
    const element = el("p", { class: "note" }, hostile);

    assert.equal(
      element.textContent,
      hostile,
      "the string is preserved verbatim",
    );
    assert.equal(
      element.innerHTML,
      undefined,
      "`el` must not write innerHTML, not even to an empty string",
    );
    assert.equal(created.length, 1, "no markup is parsed into child elements");
    assert.equal(element.className, "note", "`class` still goes to className");
    assert.deepEqual(
      Object.keys(element.attributes),
      [],
      "nothing in the hostile string became an attribute",
    );
  });
});
