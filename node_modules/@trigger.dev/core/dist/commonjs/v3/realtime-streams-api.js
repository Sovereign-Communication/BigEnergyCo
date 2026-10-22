"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeUpgradeRequiredRecord = exports.writeTurnCompleteRecord = exports.writeSessionControlRecord = exports.trimSessionStream = exports.SessionStreamInstance = exports.realtimeStreams = void 0;
// Split module-level variable definition into separate files to allow
// tree-shaking on each api instance.
const index_js_1 = require("./realtimeStreams/index.js");
exports.realtimeStreams = index_js_1.RealtimeStreamsAPI.getInstance();
__exportStar(require("./realtimeStreams/types.js"), exports);
var sessionStreamInstance_js_1 = require("./realtimeStreams/sessionStreamInstance.js");
Object.defineProperty(exports, "SessionStreamInstance", { enumerable: true, get: function () { return sessionStreamInstance_js_1.SessionStreamInstance; } });
var sessionStreamOneshot_js_1 = require("./realtimeStreams/sessionStreamOneshot.js");
Object.defineProperty(exports, "trimSessionStream", { enumerable: true, get: function () { return sessionStreamOneshot_js_1.trimSessionStream; } });
Object.defineProperty(exports, "writeSessionControlRecord", { enumerable: true, get: function () { return sessionStreamOneshot_js_1.writeSessionControlRecord; } });
Object.defineProperty(exports, "writeTurnCompleteRecord", { enumerable: true, get: function () { return sessionStreamOneshot_js_1.writeTurnCompleteRecord; } });
Object.defineProperty(exports, "writeUpgradeRequiredRecord", { enumerable: true, get: function () { return sessionStreamOneshot_js_1.writeUpgradeRequiredRecord; } });
//# sourceMappingURL=realtime-streams-api.js.map