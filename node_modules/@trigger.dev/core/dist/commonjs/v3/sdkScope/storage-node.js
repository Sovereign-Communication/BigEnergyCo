"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_async_hooks_1 = require("node:async_hooks");
const index_js_1 = require("./index.js");
const als = new node_async_hooks_1.AsyncLocalStorage();
(0, index_js_1._installSdkScopeStorage)({
    getStore: () => als.getStore(),
    run: (scope, fn) => als.run(scope, fn),
});
//# sourceMappingURL=storage-node.js.map