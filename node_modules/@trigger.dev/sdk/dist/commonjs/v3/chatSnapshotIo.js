"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__setReadChatSnapshotImplForTests = __setReadChatSnapshotImplForTests;
exports.__setWriteChatSnapshotImplForTests = __setWriteChatSnapshotImplForTests;
exports.readChatSnapshot = readChatSnapshot;
exports.writeChatSnapshot = writeChatSnapshot;
exports.__readChatSnapshotProductionPathForTests = __readChatSnapshotProductionPathForTests;
exports.__writeChatSnapshotProductionPathForTests = __writeChatSnapshotProductionPathForTests;
const v3_1 = require("@trigger.dev/core/v3");
let readChatSnapshotImpl;
function __setReadChatSnapshotImplForTests(impl) {
    readChatSnapshotImpl = impl;
}
let writeChatSnapshotImpl;
function __setWriteChatSnapshotImplForTests(impl) {
    writeChatSnapshotImpl = impl;
}
/**
 * Read the persisted snapshot for a session, in the version 2 shape
 * whatever version was stored. Returns `undefined` on:
 *   - missing object (404 from the presigned GET: fresh session, never persisted)
 *   - presign failure (network/auth issue)
 *   - malformed JSON
 *   - a version this runtime does not know
 *
 * Always swallows errors via `logger.warn`. The agent boot loop must stay
 * available even if S3 hiccups; the worst case is replaying more of
 * `session.out` than strictly necessary.
 * @internal
 */
async function readChatSnapshot(sessionId) {
    if (readChatSnapshotImpl) {
        const seeded = await readChatSnapshotImpl(sessionId);
        return seeded === undefined || seeded === null
            ? undefined
            : (0, v3_1.parseTranscriptSnapshot)(seeded);
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    let presignedUrl;
    try {
        const resp = await apiClient.getChatSnapshotUrl(sessionId);
        presignedUrl = resp.presignedUrl;
    }
    catch (error) {
        v3_1.logger.warn("chat.agent: snapshot presign (read) failed; continuing without snapshot", {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
        });
        return undefined;
    }
    let response;
    try {
        response = await fetch(presignedUrl, { method: "GET" });
    }
    catch (error) {
        v3_1.logger.warn("chat.agent: snapshot fetch failed; continuing without snapshot", {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
        });
        return undefined;
    }
    if (response.status === 404) {
        return undefined;
    }
    if (!response.ok) {
        v3_1.logger.warn("chat.agent: snapshot fetch returned non-OK; continuing without snapshot", {
            status: response.status,
            sessionId,
        });
        return undefined;
    }
    let body;
    try {
        body = await response.text();
    }
    catch (error) {
        v3_1.logger.warn("chat.agent: snapshot read failed; continuing without snapshot", {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
        });
        return undefined;
    }
    const snapshot = (0, v3_1.parseTranscriptBlob)(body);
    if (!snapshot) {
        v3_1.logger.warn("chat.agent: snapshot version/shape mismatch; ignoring", {
            sessionId,
        });
        return undefined;
    }
    return snapshot;
}
/**
 * Persist the snapshot for a session. Awaited by callers immediately after
 * `onTurnComplete`: the agent may suspend right after this point, and
 * fire-and-forget promises don't reliably complete on suspend.
 *
 * Errors are swallowed via `logger.warn`. A failed write means the next
 * boot replays slightly more of `session.out` (back to the previous
 * snapshot's cursor) instead of failing.
 * @internal
 */
async function writeChatSnapshot(sessionId, snapshot) {
    if (writeChatSnapshotImpl) {
        await writeChatSnapshotImpl(sessionId, snapshot);
        return;
    }
    const apiClient = v3_1.apiClientManager.clientOrThrow();
    let presignedUrl;
    try {
        const resp = await apiClient.createChatSnapshotUploadUrl(sessionId);
        presignedUrl = resp.presignedUrl;
    }
    catch (error) {
        v3_1.logger.warn("chat.agent: snapshot presign (write) failed; next run will replay further", {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
        });
        return;
    }
    let response;
    try {
        response = await fetch(presignedUrl, {
            method: "PUT",
            headers: { "content-type": v3_1.TRANSCRIPT_BLOB_CONTENT_TYPE },
            body: (0, v3_1.serializeTranscriptSnapshot)(snapshot),
        });
    }
    catch (error) {
        v3_1.logger.warn("chat.agent: snapshot upload failed; next run will replay further", {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
        });
        return;
    }
    if (!response.ok) {
        v3_1.logger.warn("chat.agent: snapshot upload returned non-OK; next run will replay further", {
            status: response.status,
            sessionId,
        });
    }
}
/**
 * Test-only entry point that bypasses `__setReadChatSnapshotImplForTests`
 * and reaches the real presign + `fetch` + parse path, so tests can drive
 * the production code by mocking global `fetch` and the api client.
 * @internal
 */
async function __readChatSnapshotProductionPathForTests(sessionId) {
    const saved = readChatSnapshotImpl;
    readChatSnapshotImpl = undefined;
    try {
        return await readChatSnapshot(sessionId);
    }
    finally {
        readChatSnapshotImpl = saved;
    }
}
/**
 * Test-only entry point that bypasses `__setWriteChatSnapshotImplForTests`
 * and reaches the real presign + `fetch` PUT path.
 * @internal
 */
async function __writeChatSnapshotProductionPathForTests(sessionId, snapshot) {
    const saved = writeChatSnapshotImpl;
    writeChatSnapshotImpl = undefined;
    try {
        await writeChatSnapshot(sessionId, snapshot);
    }
    finally {
        writeChatSnapshotImpl = saved;
    }
}
//# sourceMappingURL=chatSnapshotIo.js.map