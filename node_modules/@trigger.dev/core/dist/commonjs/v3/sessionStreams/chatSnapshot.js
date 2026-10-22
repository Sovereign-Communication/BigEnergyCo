"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSCRIPT_BLOB_CONTENT_TYPE = exports.TRANSCRIPT_TRAILER_BYTES = exports.TranscriptSnapshotV2Schema = exports.ChatSnapshotV1Schema = void 0;
exports.parseTranscriptSnapshot = parseTranscriptSnapshot;
exports.pageTranscriptEntries = pageTranscriptEntries;
exports.chatSnapshotKeySuffix = chatSnapshotKeySuffix;
exports.serializeTranscriptSnapshot = serializeTranscriptSnapshot;
exports.readTranscriptTrailer = readTranscriptTrailer;
exports.parseTranscriptFooter = parseTranscriptFooter;
exports.planTranscriptPage = planTranscriptPage;
exports.parseTranscriptEntryLines = parseTranscriptEntryLines;
exports.parseTranscriptBlob = parseTranscriptBlob;
const v4_1 = require("zod/v4");
/**
 * Zod schema for `ChatSnapshotV1` with the message shape kept opaque
 * (`unknown[]`). The agent runtime types messages strictly via the
 * generic parameter; readers that need stricter validation can layer
 * their own UIMessage parser on top.
 */
exports.ChatSnapshotV1Schema = v4_1.z.object({
    version: v4_1.z.literal(1),
    savedAt: v4_1.z.number().optional(),
    messages: v4_1.z.array(v4_1.z.unknown()),
    lastOutEventId: v4_1.z.string().optional(),
    lastInEventId: v4_1.z.string().optional(),
});
exports.TranscriptSnapshotV2Schema = v4_1.z.object({
    version: v4_1.z.literal(2),
    savedAt: v4_1.z.number().optional(),
    messages: v4_1.z.array(v4_1.z.object({
        id: v4_1.z.string(),
        final: v4_1.z.boolean(),
        message: v4_1.z.unknown(),
    })),
    state: v4_1.z.unknown().nullable(),
    lastOutEventId: v4_1.z.string().optional(),
    lastInEventId: v4_1.z.string().optional(),
});
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
function parseTranscriptSnapshot(input) {
    const v2 = exports.TranscriptSnapshotV2Schema.safeParse(input);
    if (v2.success) {
        const messages = [];
        for (const entry of v2.data.messages) {
            if (entry.id.length === 0)
                continue;
            if (typeof entry.message !== "object" || entry.message === null)
                continue;
            if (entry.message.id !== entry.id)
                continue;
            messages.push({ id: entry.id, final: entry.final, message: entry.message });
        }
        return {
            version: 2,
            savedAt: v2.data.savedAt ?? 0,
            messages,
            state: v2.data.state ?? null,
            lastOutEventId: v2.data.lastOutEventId,
            lastInEventId: v2.data.lastInEventId,
        };
    }
    const v1 = exports.ChatSnapshotV1Schema.safeParse(input);
    if (v1.success) {
        const messages = [];
        for (const raw of v1.data.messages) {
            const id = raw?.id;
            if (typeof id !== "string" || id.length === 0)
                continue;
            messages.push({ id, final: true, message: raw });
        }
        return {
            version: 2,
            savedAt: v1.data.savedAt ?? 0,
            messages,
            state: null,
            lastOutEventId: v1.data.lastOutEventId,
            lastInEventId: v1.data.lastInEventId,
        };
    }
    return undefined;
}
/**
 * Select one page of transcript entries, newest last. `before` keeps only the
 * entries ordered before that id, and yields an empty page when the transcript
 * no longer holds that id; `limit` keeps the last that many. A
 * non-positive `limit` is treated as no limit (every entry, no cursor), so a
 * caller cannot mistake an empty page for the end of the transcript. The
 * returned `nextCursor` is the id to pass as `before` for the previous page,
 * absent when there is no earlier page.
 */
function pageTranscriptEntries(all, opts) {
    let entries = all;
    if (opts?.before !== undefined) {
        const idx = entries.findIndex((e) => e.id === opts.before);
        if (idx === -1)
            return { entries: [], nextCursor: undefined };
        entries = entries.slice(0, idx);
    }
    let nextCursor;
    if (opts?.limit !== undefined && opts.limit > 0 && entries.length > opts.limit) {
        entries = entries.slice(entries.length - opts.limit);
        nextCursor = entries[0]?.id;
    }
    return { entries, nextCursor };
}
/**
 * S3 key suffix for a session's snapshot blob. The webapp's presigned
 * URL routes prefix this with `packets/{projectRef}/{envSlug}/`.
 */
function chatSnapshotKeySuffix(sessionId) {
    return `sessions/${sessionId}/snapshot.json`;
}
/**
 * Byte length of the fixed trailer that ends a version 2 blob:
 * `#tt2:` + 16 zero-padded digits + `\n`. Fixed width so a reader can fetch
 * exactly this many bytes from the end of the object and learn where the
 * footer starts without a second guess.
 */
exports.TRANSCRIPT_TRAILER_BYTES = 22;
/**
 * Media type a version 2 blob is stored under. Object stores return this on a
 * ranged read, so a reader learns the format from the response it already made
 * instead of inferring it from the bytes.
 */
exports.TRANSCRIPT_BLOB_CONTENT_TYPE = "application/vnd.trigger.transcript+ndjson";
const TRAILER_PREFIX = "#tt2:";
const V2_LINE_PREFIX = '{"v":2';
function utf8Length(value) {
    return new TextEncoder().encode(value).length;
}
/**
 * Serialize a snapshot to the version 2 blob format: a header line carrying
 * the cursors and the private runtime `state`, one JSON entry per line, an
 * entry-index footer line, and the fixed trailer.
 *
 * The header holds `state`, so a reader that fetches only the end of the
 * object to serve a transcript page cannot receive the model lane even by
 * accident.
 */
function serializeTranscriptSnapshot(snapshot) {
    const header = JSON.stringify({
        v: 2,
        savedAt: snapshot.savedAt,
        lastOutEventId: snapshot.lastOutEventId,
        lastInEventId: snapshot.lastInEventId,
        state: snapshot.state ?? null,
    });
    const ids = [];
    const offsets = [];
    const lines = [];
    let cursor = utf8Length(header) + 1;
    for (const entry of snapshot.messages) {
        const line = JSON.stringify({ id: entry.id, final: entry.final, message: entry.message });
        ids.push(entry.id);
        offsets.push(cursor);
        lines.push(line);
        cursor += utf8Length(line) + 1;
    }
    offsets.push(cursor);
    const footer = JSON.stringify({
        ids,
        offsets,
        savedAt: snapshot.savedAt,
        lastOutEventId: snapshot.lastOutEventId,
        lastInEventId: snapshot.lastInEventId,
    });
    const trailer = `${TRAILER_PREFIX}${String(utf8Length(footer)).padStart(16, "0")}\n`;
    return `${header}\n${lines.map((line) => `${line}\n`).join("")}${footer}\n${trailer}`;
}
/**
 * Read the fixed trailer from the last {@link TRANSCRIPT_TRAILER_BYTES} bytes
 * of a version 2 blob. Returns the footer line's byte length, or `undefined`
 * when the bytes are not a trailer (a version 1 blob, or a truncated write).
 */
function readTranscriptTrailer(trailer) {
    if (!trailer.startsWith(TRAILER_PREFIX) || trailer.length !== exports.TRANSCRIPT_TRAILER_BYTES) {
        return undefined;
    }
    const digits = trailer.slice(TRAILER_PREFIX.length, exports.TRANSCRIPT_TRAILER_BYTES - 1);
    if (!/^\d{16}$/.test(digits))
        return undefined;
    const footerLength = Number(digits);
    return Number.isSafeInteger(footerLength) && footerLength >= 0 ? { footerLength } : undefined;
}
/** Parse a version 2 footer line into its entry index. */
function parseTranscriptFooter(line) {
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== "object")
        return undefined;
    const { ids, offsets } = parsed;
    if (!Array.isArray(ids) || !Array.isArray(offsets))
        return undefined;
    if (offsets.length !== ids.length + 1)
        return undefined;
    if (!ids.every((id) => typeof id === "string"))
        return undefined;
    if (!offsets.every((offset) => typeof offset === "number" && Number.isSafeInteger(offset))) {
        return undefined;
    }
    // Offsets must strictly increase. Every entry is a non-empty JSON line plus a
    // newline, so consecutive offsets always differ; equal or descending ones mean
    // corrupt metadata. Accepting equality would hand the reader a zero-length
    // window, which decodes to no entry at all and drops a message from the page
    // while the cursor advances past it, instead of declining here so the caller
    // takes the whole-object fallback.
    const numeric = offsets;
    if (numeric[0] < 0)
        return undefined;
    for (let i = 1; i < numeric.length; i++) {
        if (numeric[i] <= numeric[i - 1])
            return undefined;
    }
    const { savedAt, lastOutEventId, lastInEventId } = parsed;
    return {
        ids: ids,
        offsets: offsets,
        savedAt: typeof savedAt === "number" ? savedAt : undefined,
        lastOutEventId: typeof lastOutEventId === "string" ? lastOutEventId : undefined,
        lastInEventId: typeof lastInEventId === "string" ? lastInEventId : undefined,
    };
}
function planTranscriptPage(footer, opts) {
    let endIndex = footer.ids.length;
    if (opts?.before !== undefined) {
        const idx = footer.ids.indexOf(opts.before);
        if (idx === -1)
            return undefined;
        endIndex = idx;
    }
    const limit = opts?.limit !== undefined && opts.limit > 0 ? opts.limit : undefined;
    let startIndex = 0;
    let nextCursor;
    if (limit !== undefined && endIndex > limit) {
        startIndex = endIndex - limit;
        nextCursor = footer.ids[startIndex];
    }
    if (endIndex <= startIndex)
        return undefined;
    return {
        start: footer.offsets[startIndex],
        end: footer.offsets[endIndex],
        ids: footer.ids.slice(startIndex, endIndex),
        nextCursor,
        startIndex,
        totalEntries: footer.ids.length,
    };
}
function parseEntryLine(line) {
    let parsed;
    try {
        parsed = JSON.parse(line);
    }
    catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== "object")
        return undefined;
    const { id, final, message } = parsed;
    if (typeof id !== "string" || id.length === 0)
        return undefined;
    if (typeof message !== "object" || message === null)
        return undefined;
    if (message.id !== id)
        return undefined;
    return { id, final: final === true, message: message };
}
/**
 * Parse a run of whole entry lines, e.g. the byte window
 * {@link planTranscriptPage} selected. Malformed lines are dropped, matching
 * {@link parseTranscriptSnapshot}: a caller never sees an entry it would crash
 * on or mis-order.
 */
function parseTranscriptEntryLines(text) {
    const entries = [];
    for (const line of text.split("\n")) {
        if (line.length === 0)
            continue;
        const entry = parseEntryLine(line);
        if (entry)
            entries.push(entry);
    }
    return entries;
}
/**
 * Parse a whole fetched blob of any known format. Version 2 is the line-based
 * format {@link serializeTranscriptSnapshot} writes; anything else is handed to
 * {@link parseTranscriptSnapshot}, which still reads the version 1 blobs
 * written by released SDKs.
 */
function parseTranscriptBlob(text) {
    if (!text.startsWith(V2_LINE_PREFIX)) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            return undefined;
        }
        return parseTranscriptSnapshot(parsed);
    }
    const newline = text.indexOf("\n");
    if (newline === -1)
        return undefined;
    let header;
    try {
        header = JSON.parse(text.slice(0, newline));
    }
    catch {
        return undefined;
    }
    const { savedAt, lastOutEventId, lastInEventId, state } = (header ?? {});
    const trailerStart = text.length - exports.TRANSCRIPT_TRAILER_BYTES;
    const trailer = trailerStart >= 0 ? readTranscriptTrailer(text.slice(trailerStart)) : undefined;
    let body = text.slice(newline + 1);
    if (trailer) {
        // Drop the footer line and the trailer; the entries are everything between
        // the header and them.
        const footerLine = text.lastIndexOf("\n", trailerStart - 2);
        if (footerLine > newline)
            body = text.slice(newline + 1, footerLine + 1);
    }
    return {
        version: 2,
        savedAt: typeof savedAt === "number" ? savedAt : 0,
        messages: parseTranscriptEntryLines(body),
        state: state ?? null,
        lastOutEventId: typeof lastOutEventId === "string" ? lastOutEventId : undefined,
        lastInEventId: typeof lastInEventId === "string" ? lastInEventId : undefined,
    };
}
//# sourceMappingURL=chatSnapshot.js.map