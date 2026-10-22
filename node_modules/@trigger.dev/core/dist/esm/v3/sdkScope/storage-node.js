import { AsyncLocalStorage } from "node:async_hooks";
import { _installSdkScopeStorage } from "./index.js";
const als = new AsyncLocalStorage();
_installSdkScopeStorage({
    getStore: () => als.getStore(),
    run: (scope, fn) => als.run(scope, fn),
});
//# sourceMappingURL=storage-node.js.map