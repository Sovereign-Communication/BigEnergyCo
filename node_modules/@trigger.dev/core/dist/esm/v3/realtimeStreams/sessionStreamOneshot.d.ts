import type { ApiClient } from "../apiClient/index.js";
import { type TriggerControlSubtype } from "../sessionStreams/wireProtocol.js";
import type { StreamWriteResult } from "./types.js";
/**
 * One-shot S2 writes against a Session channel. Used for Trigger control
 * records (turn-complete, upgrade-required) and S2 command records (trim).
 *
 * These differ from the streaming writer (`SessionStreamInstance` /
 * `StreamsWriterV2`) in two ways: they emit a single record per call, and
 * they need precise control over the record's `headers` + `body` shape —
 * which the streaming writer's JSON-envelope encoding doesn't expose.
 *
 * Each call fetches a fresh S2 access token via `initializeSessionStream`
 * and opens a new client. Cheap enough at the rate these are emitted
 * (~one of each per turn).
 */
type IO = "out" | "in";
/**
 * Append a single Trigger control record to a Session channel. The record
 * carries a `trigger-control` header valued with `subtype`, plus any
 * sibling headers (e.g. `public-access-token` on `turn-complete`). Body is
 * always empty — control semantics live in the headers.
 *
 * Returns the ack's last seq_num as `lastEventId`, useful for trim chains.
 */
export declare function writeSessionControlRecord(apiClient: ApiClient, sessionId: string, io: IO, subtype: TriggerControlSubtype | string, extraHeaders?: ReadonlyArray<readonly [string, string]>, channel?: string): Promise<StreamWriteResult>;
/**
 * Append an S2 `trim` command record to `session.out`, setting the new
 * earliest-readable seq_num. Idempotent and monotonic at S2 — the
 * effective trim point is `max(existing, min(provided, current_tail))`.
 *
 * Used after every `turn-complete` to keep `session.out` bounded to
 * approximately one turn of records at steady state.
 */
export declare function trimSessionStream(apiClient: ApiClient, sessionId: string, earliestSeqNum: number, channel?: string): Promise<void>;
/**
 * Convenience: append a `turn-complete` control record. Carries an
 * optional refreshed `publicAccessToken` in a sibling header.
 */
export declare function writeTurnCompleteRecord(apiClient: ApiClient, sessionId: string, publicAccessToken?: string): Promise<StreamWriteResult>;
/**
 * Convenience: append an `upgrade-required` control record.
 */
export declare function writeUpgradeRequiredRecord(apiClient: ApiClient, sessionId: string): Promise<StreamWriteResult>;
export {};
