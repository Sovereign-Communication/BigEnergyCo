"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdkScope = void 0;
exports._installSdkScopeStorage = _installSdkScopeStorage;
let installedStorage;
function _installSdkScopeStorage(storage) {
    installedStorage = storage;
}
exports.sdkScope = {
    hasStorage() {
        return installedStorage !== undefined;
    },
    getStore() {
        return installedStorage?.getStore();
    },
    withScope(scope, fn) {
        return installedStorage ? installedStorage.run(scope, fn) : fn();
    },
};
//# sourceMappingURL=index.js.map