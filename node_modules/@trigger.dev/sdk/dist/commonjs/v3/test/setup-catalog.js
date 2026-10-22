"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v3_1 = require("@trigger.dev/core/v3");
const workers_1 = require("@trigger.dev/core/v3/workers");
/**
 * Installs an in-memory `StandardResourceCatalog` and seeds a fake file
 * context so task definitions (`task()`, `chat.agent()`, etc.) register
 * their run functions where the test harness can look them up.
 *
 * This is invoked as a side-effect of importing `@trigger.dev/sdk/ai/test`.
 *
 * Without this, `registerTaskMetadata` short-circuits on a missing
 * `_currentFileContext` and tasks silently fail to register.
 */
const catalog = new workers_1.StandardResourceCatalog();
v3_1.resourceCatalog.setGlobalResourceCatalog(catalog);
v3_1.resourceCatalog.setCurrentFileContext("__test__.ts", "__test__");
//# sourceMappingURL=setup-catalog.js.map