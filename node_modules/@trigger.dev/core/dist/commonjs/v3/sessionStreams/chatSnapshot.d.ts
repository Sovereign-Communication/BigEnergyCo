/**
 * Persisted chat-snapshot blob. Written by `chat.agent` to S3 after every
 * turn completes (when no `hydrateMessages` hook is registered) and read
 * back at the start of the next run to seed the accumulator. Also read by
 * the Sessions dashboard to render the full conversation transcript
 * without re-streaming `session.out` from `seq_num=0`.
 *
 * S3 key suffix: `sessions/{sessionId}/snapshot.json`. The webapp's
 * presigned-URL service prefixes this with `packets/{projectRef}/{envSlug}/`.
 *
 * `lastOutEventId` is the S2 seq_num (as a string) of the snapshot's
 * final `turn-complete` control record. Used to resume `session.out`
 * replay from precisely after the snapshot, and as the trim-chain seed
 * for the agent's next turn.
 *
 * The `version` field is a forward-compat lever: readers that don't
 * recognise a version silently fall back to no-snapshot behaviour.
 */
import { z } from "zod/v4";
import type { UIMessage } from "ai";
export type ChatSnapshotV1<TUIMessage = unknown> = {
    version: 1;
    savedAt: number;
    messages: TUIMessage[];
    lastOutEventId?: string;
    /**
     * Committed `.in` consume cursor (S2 seq_num, stringified) as of this
     * snapshot's turn-complete. Lets the next boot seed the `.in` resume
     * cursor without scanning `session.out` for the latest turn-complete
     * header. Absent on snapshots written before this field existed —
     * readers fall back to the scan.
     */
    lastInEventId?: string;
};
/**
 * Zod schema for `ChatSnapshotV1` with the message shape kept opaque
 * (`unknown[]`). The agent runtime types messages strictly via the
 * generic parameter; readers that need stricter validation can layer
 * their own UIMessage parser on top.
 */
export declare const ChatSnapshotV1Schema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    savedAt: z.ZodOptional<z.ZodNumber>;
    messages: z.ZodArray<z.ZodUnknown>;
    lastOutEventId: z.ZodOptional<z.ZodString>;
    lastInEventId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * One transcript entry in a version 2 snapshot. `id` duplicates
 * `message.id` so a reader can address entries without inspecting the
 * message body; `final` is false for a partial assistant message captured
 * by an errored or stopped turn.
 */
export type TranscriptSnapshotEntry<TUIMessage extends UIMessage = UIMessage> = {
    id: string;
    final: boolean;
    message: TUIMessage;
};
/**
 * Version 2 of the persisted transcript blob. Entries are ordered by array
 * position. `state` is an opaque record the runtime uses for compaction and
 * other cross-run bookkeeping; `null` when nothing has been recorded.
 *
 * Readers must accept version 1 as well; writers only emit version 2. Use
 * {@link parseTranscriptSnapshot} to read either.
 */
export type TranscriptSnapshotV2<TUIMessage extends UIMessage = UIMessage> = {
    version: 2;
    savedAt: number;
    messages: TranscriptSnapshotEntry<TUIMessage>[];
    state: unknown | null;
    lastOutEventId?: string;
    lastInEventId?: string;
};
export declare const TranscriptSnapshotV2Schema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    savedAt: z.ZodOptional<z.ZodNumber>;
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        final: z.ZodBoolean;
        message: z.ZodUnknown;
    }, z.core.$strip>>;
    state: z.ZodNullable<z.ZodUnknown>;
    lastOutEventId: z.ZodOptional<z.ZodString>;
    lastInEventId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/**
 * Parse a fetched snapshot blob of any known version into the version 2
 * shape. A version 1 blob is upgraded in memory: every message becomes a
 * `final: true` entry keyed by its `id` and `state` is `null`. In both
 * versions, entries without a non-empty string `id` or a non-null object
 * `message` are dropped; a version 2 entry whose `message.id` disagrees with
 * the envelope `id` is dropped too, since a reader keys by one and renders by
 * the other. A caller never sees an entry it would crash on or mis-order.
 * A missing `savedAt` defaults to `0` rather than rejecting the whole blob:
 * the field only orders snapshot history before live chunks, and dropping a
 * whole conversation over an absent timestamp is the wrong failure mode.
 * Returns `undefined` for an unknown version or a body that is not a
 * snapshot; callers treat that as "no snapshot".
 */
export declare function parseTranscriptSnapshot<TUIMessage extends UIMessage = UIMessage>(input: unknown): TranscriptSnapshotV2<TUIMessage> | undefined;
/**
 * Select one page of transcript entries, newest last. `before` keeps only the
 * entries ordered before that id, and yields an empty page when the transcript
 * no longer holds that id; `limit` keeps the last that many. A
 * non-positive `limit` is treated as no limit (every entry, no cursor), so a
 * caller cannot mistake an empty page for the end of the transcript. The
 * returned `nextCursor` is the id to pass as `before` for the previous page,
 * absent when there is no earlier page.
 */
export declare function pageTranscriptEntries<TUIMessage extends UIMessage = UIMessage>(all: TranscriptSnapshotEntry<TUIMessage>[], opts: {
    limit?: number;
    before?: string;
} | undefined): {
    entries: TranscriptSnapshotEntry<TUIMessage>[];
    nextCursor: string | undefined;
};
/**
 * S3 key suffix for a session's snapshot blob. The webapp's presigned
 * URL routes prefix this with `packets/{projectRef}/{envSlug}/`.
 */
export declare function chatSnapshotKeySuffix(sessionId: string): string;
/**
 * Byte length of the fixed trailer that ends a version 2 blob:
 * `#tt2:` + 16 zero-padded digits + `\n`. Fixed width so a reader can fetch
 * exactly this many bytes from the end of the object and learn where the
 * footer starts without a second guess.
 */
export declare const TRANSCRIPT_TRAILER_BYTES = 22;
/**
 * Media type a version 2 blob is stored under. Object stores return this on a
 * ranged read, so a reader learns the format from the response it already made
 * instead of inferring it from the bytes.
 */
export declare const TRANSCRIPT_BLOB_CONTENT_TYPE = "application/vnd.trigger.transcript+ndjson";
/**
 * Entry index at the end of a version 2 blob. Carries the stream cursors too,
 * so serving a transcript page never has to fetch the header — which is where
 * the private runtime state lives. `offsets` holds `ids.length + 1`
 * byte offsets: entry `i` occupies `[offsets[i], offsets[i + 1] - 1)`, and the
 * final sentinel is where the footer line itself begins. Carrying the sentinel
 * means a reader can bound every entry, including the last, without knowing the
 * object's total size.
 */
export type TranscriptFooter = {
    ids: string[];
    offsets: number[];
    savedAt?: number;
    lastOutEventId?: string;
    lastInEventId?: string;
};
/**
 * Serialize a snapshot to the version 2 blob format: a header line carrying
 * the cursors and the private runtime `state`, one JSON entry per line, an
 * entry-index footer line, and the fixed trailer.
 *
 * The header holds `state`, so a reader that fetches only the end of the
 * object to serve a transcript page cannot receive the model lane even by
 * accident.
 */
export declare function serializeTranscriptSnapshot<TUIMessage extends UIMessage>(snapshot: TranscriptSnapshotV2<TUIMessage>): string;
/**
 * Read the fixed trailer from the last {@link TRANSCRIPT_TRAILER_BYTES} bytes
 * of a version 2 blob. Returns the footer line's byte length, or `undefined`
 * when the bytes are not a trailer (a version 1 blob, or a truncated write).
 */
export declare function readTranscriptTrailer(trailer: string): {
    footerLength: number;
} | undefined;
/** Parse a version 2 footer line into its entry index. */
export declare function parseTranscriptFooter(line: string): TranscriptFooter | undefined;
/**
 * Byte window covering one page of entries within a single object, computed
 * from its footer alone. Mirrors {@link pageTranscriptEntries}: newest last,
 * `before` excludes that id and everything after it, `limit` keeps the last
 * that many.
 *
 * `undefined` means the page is empty: the transcript is empty, `before` names
 * its first entry, or `before` names an entry the transcript no longer holds
 * (history trimmed since the caller last read it). Returning the newest entries
 * for a cursor that cannot be found would present recent messages as older ones.
 */
export type TranscriptPagePlan = {
    start: number;
    end: number;
    ids: string[];
    /** Set when the transcript still holds entries before the page. */
    nextCursor: string | undefined;
    /** Position of the page's first entry in the whole transcript. */
    startIndex: number;
    /** Entries in the whole transcript, so a caller can order pages against each other. */
    totalEntries: number;
};
export declare function planTranscriptPage(footer: TranscriptFooter, opts: {
    limit?: number;
    before?: string;
} | undefined): TranscriptPagePlan | undefined;
/**
 * Parse a run of whole entry lines, e.g. the byte window
 * {@link planTranscriptPage} selected. Malformed lines are dropped, matching
 * {@link parseTranscriptSnapshot}: a caller never sees an entry it would crash
 * on or mis-order.
 */
export declare function parseTranscriptEntryLines<TUIMessage extends UIMessage = UIMessage>(text: string): TranscriptSnapshotEntry<TUIMessage>[];
/**
 * Parse a whole fetched blob of any known format. Version 2 is the line-based
 * format {@link serializeTranscriptSnapshot} writes; anything else is handed to
 * {@link parseTranscriptSnapshot}, which still reads the version 1 blobs
 * written by released SDKs.
 */
export declare function parseTranscriptBlob<TUIMessage extends UIMessage = UIMessage>(text: string): TranscriptSnapshotV2<TUIMessage> | undefined;
