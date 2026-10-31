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
