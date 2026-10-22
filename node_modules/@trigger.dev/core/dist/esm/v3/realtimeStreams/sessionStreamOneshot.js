import { AppendInput, AppendRecord, S2 } from "@s2-dev/streamstore";
import { TRIGGER_CONTROL_HEADER, TRIGGER_CONTROL_SUBTYPE, } from "../sessionStreams/wireProtocol.js";
async function getS2Stream(apiClient, sessionId, io, channel) {
    const response = await apiClient.initializeSessionStream(sessionId, io, undefined, channel);
    const headers = response.headers ?? {};
    const accessToken = headers["x-s2-access-token"];
    const basin = headers["x-s2-basin"];
    const streamName = headers["x-s2-stream-name"];
    const endpoint = headers["x-s2-endpoint"];
    if (!accessToken || !basin || !streamName) {
        throw new Error("Session stream initialize did not return S2 credentials — server may be configured for v1 realtime streams, which sessions do not support.");
    }
    const s2 = new S2({
        accessToken,
        ...(endpoint
            ? {
                endpoints: {
                    account: endpoint,
                    basin: endpoint,
                },
            }
            : {}),
    });
    return s2.basin(basin).stream(streamName);
}
/**
 * Append a single Trigger control record to a Session channel. The record
 * carries a `trigger-control` header valued with `subtype`, plus any
 * sibling headers (e.g. `public-access-token` on `turn-complete`). Body is
 * always empty — control semantics live in the headers.
 *
 * Returns the ack's last seq_num as `lastEventId`, useful for trim chains.
 */
export async function writeSessionControlRecord(apiClient, sessionId, io, subtype, extraHeaders, channel) {
    const stream = await getS2Stream(apiClient, sessionId, io, channel);
    const headers = [
        [TRIGGER_CONTROL_HEADER, subtype],
        ...(extraHeaders ?? []),
    ];
    const record = AppendRecord.string({ body: "", headers });
    const ack = await stream.append(AppendInput.create([record]));
    // S2's `AppendAck.start` is the seq_num of the FIRST record in the batch
    // (inclusive); `end` is the seq AFTER the last record (exclusive, equal
    // to `tail`). For a single-record append they differ by one — `start` is
    // the seq we just wrote, `end` is the next vacant seq. Return `start`
    // here so the caller can chain trims against the actual record seq.
    return { lastEventId: ack.start.seqNum.toString() };
}
/**
 * Append an S2 `trim` command record to `session.out`, setting the new
 * earliest-readable seq_num. Idempotent and monotonic at S2 — the
 * effective trim point is `max(existing, min(provided, current_tail))`.
 *
 * Used after every `turn-complete` to keep `session.out` bounded to
 * approximately one turn of records at steady state.
 */
export async function trimSessionStream(apiClient, sessionId, earliestSeqNum, channel) {
    const stream = await getS2Stream(apiClient, sessionId, "out", channel);
    await stream.append(AppendInput.create([AppendRecord.trim(earliestSeqNum)]));
}
/**
 * Convenience: append a `turn-complete` control record. Carries an
 * optional refreshed `publicAccessToken` in a sibling header.
 */
export async function writeTurnCompleteRecord(apiClient, sessionId, publicAccessToken) {
    const extra = publicAccessToken
        ? [["public-access-token", publicAccessToken]]
        : [];
    return writeSessionControlRecord(apiClient, sessionId, "out", TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE, extra);
}
/**
 * Convenience: append an `upgrade-required` control record.
 */
export async function writeUpgradeRequiredRecord(apiClient, sessionId) {
    return writeSessionControlRecord(apiClient, sessionId, "out", TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED);
}
//# sourceMappingURL=sessionStreamOneshot.js.map