"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopSessionStreamManager = void 0;
const types_js_1 = require("../inputStreams/types.js");
class NoopSessionStreamManager {
    on(_sessionId, _io, _handler) {
        return { off: () => { } };
    }
    onRecord(_sessionId, _io, _handler) {
        return { off: () => { } };
    }
    once(_sessionId, _io, _options) {
        return new types_js_1.InputStreamOncePromise(() => {
            // Never resolves in noop mode.
        });
    }
    onceRecord(_sessionId, _io, _options) {
        return new types_js_1.InputStreamOncePromise(() => {
            // Never resolves in noop mode.
        });
    }
    onceRecordWhere(_sessionId, _io, _predicate, _options) {
        return new types_js_1.InputStreamOncePromise(() => {
            // Never resolves in noop mode.
        });
    }
    peek(_sessionId, _io) {
        return undefined;
    }
    peekRecord(_sessionId, _io) {
        return undefined;
    }
    lastSeqNum(_sessionId, _io) {
        return undefined;
    }
    setLastSeqNum(_sessionId, _io, _seqNum) { }
    consumeRecord(_sessionId, _io, _seqNum) { }
    lastDispatchedSeqNum(_sessionId, _io) {
        return undefined;
    }
    setLastDispatchedSeqNum(_sessionId, _io, _seqNum) { }
    setMinTimestamp(_sessionId, _io, _minTimestamp) { }
    shiftBuffer(_sessionId, _io) {
        return false;
    }
    disconnectStream(_sessionId, _io) { }
    reconnectStream(_sessionId, _io) { }
    clearHandlers() { }
    reset() { }
    disconnect() { }
}
exports.NoopSessionStreamManager = NoopSessionStreamManager;
//# sourceMappingURL=noopManager.js.map