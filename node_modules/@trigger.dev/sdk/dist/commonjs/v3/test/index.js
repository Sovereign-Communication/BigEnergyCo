"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInMockTaskContext = exports.runTranscriptStorageTests = exports.mockChatAgent = void 0;
// Importing this module installs an in-memory resource catalog so that
// chat.agent() calls (which run at import time) register their task
// functions where the test harness can find them.
//
// Users should import `@trigger.dev/sdk/ai/test` BEFORE their agent
// modules so the registration side-effect runs first.
require("./setup-catalog.js");
var mock_chat_agent_js_1 = require("./mock-chat-agent.js");
Object.defineProperty(exports, "mockChatAgent", { enumerable: true, get: function () { return mock_chat_agent_js_1.mockChatAgent; } });
var transcript_storage_tests_js_1 = require("./transcript-storage-tests.js");
Object.defineProperty(exports, "runTranscriptStorageTests", { enumerable: true, get: function () { return transcript_storage_tests_js_1.runTranscriptStorageTests; } });
// Re-export the lower-level task context harness so consumers can build
// their own test helpers without adding a separate `@trigger.dev/core`
// dependency to their reference projects.
var test_1 = require("@trigger.dev/core/v3/test");
Object.defineProperty(exports, "runInMockTaskContext", { enumerable: true, get: function () { return test_1.runInMockTaskContext; } });
//# sourceMappingURL=index.js.map