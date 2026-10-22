import { InputStreamOncePromise } from "./types.js";
export class NoopInputStreamManager {
    setRunId(_runId, _streamsVersion) { }
    on(_streamId, _handler) {
        return { off: () => { } };
    }
    once(_streamId, _options) {
        return new InputStreamOncePromise(() => {
            // Never resolves in noop mode
        });
    }
    peek(_streamId) {
        return undefined;
    }
    lastSeqNum(_streamId) {
        return undefined;
    }
    setLastSeqNum(_streamId, _seqNum) { }
    shiftBuffer(_streamId) {
        return false;
    }
    disconnectStream(_streamId) { }
    clearHandlers() { }
    reset() { }
    disconnect() { }
    connectTail(_runId, _fromSeq) { }
}
//# sourceMappingURL=noopManager.js.map