let installedStorage;
export function _installSdkScopeStorage(storage) {
    installedStorage = storage;
}
export const sdkScope = {
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