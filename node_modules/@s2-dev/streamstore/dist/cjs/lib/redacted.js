"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsafeWipe = exports.value = exports.make = void 0;
const redactedRegistry = new WeakMap();
const NodeInspectSymbol = Symbol.for("nodejs.util.inspect.custom");
const proto = Object.freeze({
    toString() {
        return "<redacted>";
    },
    toJSON() {
        return "<redacted>";
    },
    [NodeInspectSymbol]() {
        return "<redacted>";
    },
});
const make = (value) => {
    const redacted = Object.create(proto);
    redactedRegistry.set(redacted, value);
    return redacted;
};
exports.make = make;
const value = (self) => {
    if (redactedRegistry.has(self)) {
        return redactedRegistry.get(self);
    }
    else {
        throw new Error("Unable to get redacted value");
    }
};
exports.value = value;
const unsafeWipe = (self) => redactedRegistry.delete(self);
exports.unsafeWipe = unsafeWipe;
//# sourceMappingURL=redacted.js.map