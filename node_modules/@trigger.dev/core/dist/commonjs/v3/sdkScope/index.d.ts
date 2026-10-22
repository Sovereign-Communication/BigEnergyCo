import type { SdkScope, SdkScopeStorage } from "./types.js";
export type { SdkScope, SdkScopeStorage } from "./types.js";
export declare function _installSdkScopeStorage(storage: SdkScopeStorage): void;
export declare const sdkScope: {
    hasStorage(): boolean;
    getStore(): SdkScope | undefined;
    withScope<R>(scope: SdkScope, fn: () => R): R;
};
