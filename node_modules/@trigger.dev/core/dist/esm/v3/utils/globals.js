import { _globalThis } from "./platform.js";
const GLOBAL_TRIGGER_DOT_DEV_KEY = Symbol.for(`dev.trigger.ts.api`);
const _global = _globalThis;
export function registerGlobal(type, instance, allowOverride = false) {
    let api = _global[GLOBAL_TRIGGER_DOT_DEV_KEY];
    if (!api) {
        api = {};
        _global[GLOBAL_TRIGGER_DOT_DEV_KEY] = api;
    }
    if (!allowOverride && api[type]) {
        // already registered an API of this type
        const _err = new Error(`trigger.dev: Attempted duplicate registration of API: ${type}`);
        return false;
    }
    api[type] = instance;
    return true;
}
export function getGlobal(type) {
    return _global[GLOBAL_TRIGGER_DOT_DEV_KEY]?.[type];
}
export function unregisterGlobal(type) {
    const api = _global[GLOBAL_TRIGGER_DOT_DEV_KEY];
    if (api) {
        delete api[type];
    }
}
//# sourceMappingURL=globals.js.map