// Importing this module installs an in-memory resource catalog so that
// chat.agent() calls (which run at import time) register their task
// functions where the test harness can find them.
//
// Users should import `@trigger.dev/sdk/ai/test` BEFORE their agent
// modules so the registration side-effect runs first.
import "./setup-catalog.js";
export { mockChatAgent, } from "./mock-chat-agent.js";
export { runTranscriptStorageTests, } from "./transcript-storage-tests.js";
// Re-export the lower-level task context harness so consumers can build
// their own test helpers without adding a separate `@trigger.dev/core`
// dependency to their reference projects.
export { runInMockTaskContext, } from "@trigger.dev/core/v3/test";
//# sourceMappingURL=index.js.map