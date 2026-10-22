import { getGlobal, registerGlobal } from "../utils/globals.js";
import { NoopSessionStreamManager } from "./noopManager.js";
const API_NAME = "session-streams";
const NOOP_MANAGER = new NoopSessionStreamManager();
export class SessionStreamsAPI {
    static _instance;
    constructor() { }
    static getInstance() {
        if (!this._instance) {
            this._instance = new SessionStreamsAPI();
        }
        return this._instance;
    }
    setGlobalManager(manager) {
        return registerGlobal(API_NAME, manager);
    }
    #getManager() {
        return getGlobal(API_NAME) ?? NOOP_MANAGER;
    }
    on(sessionId, io, handler, channel) {
        return this.#getManager().on(sessionId, io, handler, channel);
    }
    onRecord(sessionId, io, handler, channel) {
        const manager = this.#getManager();
        if (!manager.onRecord) {
            throw new Error("The configured Session stream manager does not support record handlers");
        }
        return manager.onRecord(sessionId, io, handler, channel);
    }
    once(sessionId, io, options, channel) {
        return this.#getManager().once(sessionId, io, options, channel);
    }
    onceRecord(sessionId, io, options, channel) {
        const manager = this.#getManager();
        if (!manager.onceRecord) {
            throw new Error("The configured Session stream manager does not support record metadata");
        }
        return manager.onceRecord(sessionId, io, options, channel);
    }
    onceRecordWhere(sessionId, io, predicate, options, channel) {
        const manager = this.#getManager();
        if (!manager.onceRecordWhere) {
            throw new Error("The configured Session stream manager does not support selective records");
        }
        return manager.onceRecordWhere(sessionId, io, predicate, options, channel);
    }
    peek(sessionId, io, channel) {
        return this.#getManager().peek(sessionId, io, channel);
    }
    peekRecord(sessionId, io, channel) {
        const manager = this.#getManager();
        if (!manager.peekRecord) {
            throw new Error("The configured Session stream manager does not support record metadata");
        }
        return manager.peekRecord(sessionId, io, channel);
    }
    lastSeqNum(sessionId, io, channel) {
        return this.#getManager().lastSeqNum(sessionId, io, channel);
    }
    setLastSeqNum(sessionId, io, seqNum, channel) {
        this.#getManager().setLastSeqNum(sessionId, io, seqNum, channel);
    }
    consumeRecord(sessionId, io, seqNum, channel) {
        const manager = this.#getManager();
        if (!manager.consumeRecord) {
            throw new Error("The configured Session stream manager does not support exact consumption");
        }
        manager.consumeRecord(sessionId, io, seqNum, channel);
    }
    lastDispatchedSeqNum(sessionId, io, channel) {
        return this.#getManager().lastDispatchedSeqNum(sessionId, io, channel);
    }
    setLastDispatchedSeqNum(sessionId, io, seqNum, channel) {
        this.#getManager().setLastDispatchedSeqNum(sessionId, io, seqNum, channel);
    }
    setMinTimestamp(sessionId, io, minTimestamp, channel) {
        this.#getManager().setMinTimestamp(sessionId, io, minTimestamp, channel);
    }
    shiftBuffer(sessionId, io, channel) {
        return this.#getManager().shiftBuffer(sessionId, io, channel);
    }
    reconnectStream(sessionId, io, channel) {
        this.#getManager().reconnectStream?.(sessionId, io, channel);
    }
    disconnectStream(sessionId, io, channel) {
        this.#getManager().disconnectStream(sessionId, io, channel);
    }
    clearHandlers() {
        this.#getManager().clearHandlers();
    }
    reset() {
        this.#getManager().reset();
    }
    disconnect() {
        this.#getManager().disconnect();
    }
}
//# sourceMappingURL=index.js.map