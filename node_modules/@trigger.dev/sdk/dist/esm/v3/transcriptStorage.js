import { apiClientManager, pageTranscriptEntries, } from "@trigger.dev/core/v3";
import { readChatSnapshot, writeChatSnapshot } from "./chatSnapshotIo.js";
export function emptyTranscriptState() {
    return { entries: [], state: null };
}
/**
 * Apply changes to a transcript, in order. Pure: returns a new state and
 * never mutates the input. Replaying the same changes converges, which is
 * what lets a storage retry a failed write without checking what landed.
 */
export function reduceTranscriptChanges(prev, changes) {
    let entries = prev.entries.slice();
    let state = prev.state;
    for (const change of changes) {
        switch (change.op) {
            case "put": {
                const message = change.message;
                const entry = { id: message.id, final: change.final ?? true, message };
                const idx = entries.findIndex((e) => e.id === message.id);
                if (idx === -1)
                    entries.push(entry);
                else
                    entries[idx] = entry;
                break;
            }
            case "remove": {
                entries = entries.filter((e) => e.id !== change.id);
                break;
            }
            case "truncateAfter": {
                const idx = entries.findIndex((e) => e.id === change.afterId);
                if (idx !== -1)
                    entries = entries.slice(0, idx + 1);
                break;
            }
            case "state": {
                state = change.value ?? null;
                break;
            }
        }
    }
    return { entries, state };
}
/**
 * The content identity the transcript shadow compares messages by. @internal
 */
export function fingerprintMessage(message) {
    return JSON.stringify(message);
}
/**
 * Build the shadow for `messages`. An id is non-final when this save says so
 * (`nonFinalIds`) or when it was non-final before and its content has not
 * changed: a partial answer stays partial until the message itself changes.
 */
export function createTranscriptShadow(messages, nonFinalIds, previous) {
    const ids = [];
    const fingerprints = new Map();
    const nonFinal = new Set();
    for (const message of messages) {
        const fingerprint = fingerprintMessage(message);
        ids.push(message.id);
        fingerprints.set(message.id, fingerprint);
        if (nonFinalIds?.has(message.id) ||
            (previous?.nonFinal.has(message.id) && previous.fingerprints.get(message.id) === fingerprint)) {
            nonFinal.add(message.id);
        }
    }
    return { ids, fingerprints, nonFinal };
}
/**
 * Derive the changes that take `shadow` to `next`.
 *
 * The common prefix (by id) is compared message by message and a changed
 * message becomes an in-place `put`. Past the prefix, everything the shadow
 * still had is dropped with one `truncateAfter` on the last common id (or
 * one `remove` per message when there is no common prefix) and everything
 * `next` has is appended with `put`, in order. Applying the result with
 * {@link reduceTranscriptChanges} reproduces `next` exactly, including
 * order, for any two lists.
 */
export function diffTranscript(shadow, next, options = {}) {
    const nextShadow = createTranscriptShadow(next, options.nonFinalIds, shadow);
    const changes = [];
    const put = (message) => {
        const final = nextShadow.nonFinal.has(message.id) ? false : undefined;
        changes.push(final === undefined ? { op: "put", message } : { op: "put", message, final });
    };
    let lcp = 0;
    while (lcp < shadow.ids.length && lcp < next.length && shadow.ids[lcp] === next[lcp].id) {
        lcp++;
    }
    for (let i = 0; i < lcp; i++) {
        const message = next[i];
        if (shadow.fingerprints.get(message.id) !== nextShadow.fingerprints.get(message.id) ||
            shadow.nonFinal.has(message.id) !== nextShadow.nonFinal.has(message.id)) {
            put(message);
        }
    }
    if (shadow.ids.length > lcp) {
        if (lcp > 0) {
            changes.push({ op: "truncateAfter", afterId: shadow.ids[lcp - 1] });
        }
        else {
            for (const id of shadow.ids)
                changes.push({ op: "remove", id });
        }
    }
    for (let i = lcp; i < next.length; i++) {
        put(next[i]);
    }
    return { changes, shadow: nextShadow };
}
/**
 * Roughly how many messages the snapshot keeps once a conversation has
 * compacted. Raising it costs bytes on every save; lowering it shortens how far
 * back a conversation can be rendered from the platform's own store.
 */
const SNAPSHOT_KEEP_MESSAGES = 100;
/**
 * The built-in storage: the transcript in the platform's object store, read by
 * the Sessions dashboard and the transcript API.
 *
 * One object per conversation, rewritten each turn, holding the transcript plus
 * the runtime state. Once a conversation has been compacted, it keeps roughly
 * the last hundred messages rather than all of them, so the object stops
 * growing with the conversation. An app that needs the full history keeps its
 * own transcript storage.
 */
export function snapshotTranscriptStorage() {
    return {
        async load(scope, opts) {
            if (opts?.limit !== undefined || opts?.before !== undefined) {
                const page = await readTranscriptPage(scope.chatId, opts);
                if (page)
                    return page;
            }
            const snapshot = await readChatSnapshot(scope.chatId);
            const full = snapshot
                ? { entries: snapshot.messages, state: snapshot.state }
                : emptyTranscriptState();
            return {
                ...pageEntries(full.entries, opts),
                state: full.state,
                cursors: snapshot
                    ? { lastOutEventId: snapshot.lastOutEventId, lastInEventId: snapshot.lastInEventId }
                    : undefined,
            };
        },
        async save(ctx, changeset) {
            const entries = trimTranscriptForSnapshot(changeset.transcript.entries, changeset.transcript.state, { keep: SNAPSHOT_KEEP_MESSAGES });
            await writeChatSnapshot(ctx.chatId, {
                version: 2,
                savedAt: Date.now(),
                messages: entries,
                state: normalizeRuntimeStateForWindow(changeset.transcript.state, entries.map((entry) => entry.id)),
                lastOutEventId: changeset.cursors?.lastOutEventId,
                lastInEventId: changeset.cursors?.lastInEventId,
            });
        },
    };
}
/**
 * A page of the platform transcript read server-side, for a render read with
 * `limit`/`before` from an app server holding a secret key. `undefined` when
 * the call is not possible from here (a run's public token cannot use the
 * endpoint), so the caller falls back to reading the whole blob.
 *
 * Carries no runtime `state`: the endpoint serves the transcript only, so a
 * paged result always reports `state: null`. The model lane is restored from
 * the whole-blob read instead, which is reachable only with private auth.
 */
async function readTranscriptPage(chatId, opts) {
    try {
        const page = await apiClientManager.clientOrThrow().getSessionTranscript(chatId, opts);
        return {
            messages: page.messages,
            state: null,
            cursors: page.cursors,
            nextCursor: page.nextCursor,
        };
    }
    catch {
        return undefined;
    }
}
/** The storage `chat.agent` uses when none is configured: {@link snapshotTranscriptStorage}. */
export const defaultStorage = snapshotTranscriptStorage();
function pageEntries(all, opts) {
    const page = pageTranscriptEntries(all, opts);
    return {
        messages: page.entries.map((e) => e.message),
        nextCursor: page.nextCursor,
        nonFinalIds: page.entries.filter((e) => !e.final).map((e) => e.id),
    };
}
/**
 * A storage that keeps every transcript in process memory. The reference
 * implementation for the conformance tests, and a way to inspect exactly
 * what the runtime hands a storage.
 */
export function memoryTranscriptStorage() {
    const transcripts = new Map();
    const changesets = [];
    return {
        changesets,
        transcript(chatId) {
            return transcripts.get(chatId);
        },
        async load(scope, opts) {
            const stored = transcripts.get(scope.chatId);
            if (!stored)
                return { messages: [], state: null, cursors: undefined, nextCursor: undefined };
            return {
                ...pageEntries(stored.entries, opts),
                state: stored.state,
                cursors: stored.cursors,
            };
        },
        async save(ctx, changeset) {
            changesets.push({ ctx, changeset });
            const prev = transcripts.get(ctx.chatId);
            const next = reduceTranscriptChanges(prev ?? emptyTranscriptState(), changeset.changes);
            transcripts.set(ctx.chatId, { ...next, cursors: changeset.cursors ?? prev?.cursors });
        },
    };
}
/**
 * The slice of a transcript worth storing, which is the last `keep` messages
 * once a conversation has compacted, and all of it before that.
 *
 * Expressed relative to the compaction watermark rather than as a plain tail,
 * because everything after the watermark is live context that the next boot
 * converts and must never be dropped. The runtime stamps the watermark at the
 * newest message on each compacted save, so in practice the two coincide and
 * this keeps the last `keep`; the watermark-relative form is what keeps it
 * correct if a watermark ever lands earlier in the transcript.
 *
 * Without a watermark nothing is dropped: every entry is still context.
 *
 * This is what stops the object rewritten each turn from growing with the
 * conversation. An app that needs the whole history keeps its own transcript
 * storage.
 */
export function trimTranscriptForSnapshot(entries, state, opts) {
    const throughId = parseTranscriptRuntimeState(state)?.compaction?.throughId;
    if (throughId === undefined || throughId === "")
        return entries;
    const idx = entries.findIndex((entry) => entry.id === throughId);
    if (idx === -1)
        return entries;
    // Keep the watermark entry itself, so a restored lane can still find it.
    const start = Math.max(0, idx + 1 - Math.max(1, opts.keep));
    return start === 0 ? entries : entries.slice(start);
}
/**
 * Rewrite runtime state so it still describes the transcript window being
 * persisted.
 *
 * A compaction watermark that has moved out of the window becomes `""`, which
 * is how a restored lane says "the compacted messages cover everything before
 * this window". Left as-is, the watermark would name an entry the window does
 * not contain, and restoring the lane would discard the compacted messages and
 * re-convert the window from scratch — an agent that has silently forgotten the
 * conversation. Injections anchored outside the window go too: the span they
 * belonged to is already inside the compacted lane.
 */
export function normalizeRuntimeStateForWindow(state, windowIds) {
    const runtimeState = parseTranscriptRuntimeState(state);
    if (!runtimeState)
        return state;
    const ids = new Set(windowIds);
    const compaction = runtimeState.compaction;
    const watermarkOutside = compaction !== undefined && compaction.throughId !== "" && !ids.has(compaction.throughId);
    const injections = runtimeState.injections?.filter((injection) => injection.afterId === "" || ids.has(injection.afterId));
    if (!watermarkOutside && injections?.length === runtimeState.injections?.length) {
        return state;
    }
    return {
        ...runtimeState,
        ...(compaction
            ? {
                compaction: {
                    modelMessages: compaction.modelMessages,
                    throughId: watermarkOutside ? "" : compaction.throughId,
                },
            }
            : {}),
        ...(injections ? { injections } : {}),
    };
}
export function parseTranscriptRuntimeState(value) {
    if (!value || typeof value !== "object")
        return undefined;
    const record = value;
    if (record.v !== 1)
        return undefined;
    const out = { v: 1 };
    const compaction = record.compaction;
    if (compaction &&
        typeof compaction === "object" &&
        Array.isArray(compaction.modelMessages) &&
        typeof compaction.throughId === "string") {
        out.compaction = {
            modelMessages: compaction.modelMessages,
            throughId: compaction.throughId,
        };
    }
    if (Array.isArray(record.injections)) {
        out.injections = record.injections.flatMap((entry) => {
            const inj = entry;
            return inj && typeof inj.afterId === "string" && Array.isArray(inj.messages)
                ? [{ afterId: inj.afterId, messages: inj.messages }]
                : [];
        });
    }
    if (Array.isArray(record.queued) && record.queued.length > 0) {
        out.queued = record.queued;
    }
    return out;
}
/**
 * Rebuild the model lane for a transcript at boot. Uses the persisted
 * compacted lane while the transcript still contains its `throughId`
 * boundary, then converts the rest of the transcript, re-inserting persisted
 * injections after the messages they followed.
 */
export async function restoreModelLane(messages, state, convert) {
    const lane = [];
    let start = 0;
    let compacted = false;
    if (state?.compaction) {
        const throughId = state.compaction.throughId;
        const idx = throughId === "" ? -1 : messages.findIndex((m) => m.id === throughId);
        if (idx !== -1 || throughId === "") {
            lane.push(...state.compaction.modelMessages);
            start = idx + 1;
            compacted = true;
        }
    }
    const anchored = (state?.injections ?? [])
        .map((inj) => ({
        inj,
        idx: inj.afterId === "" ? -1 : messages.findIndex((m) => m.id === inj.afterId),
    }))
        .filter(({ inj, idx }) => (inj.afterId === "" ? start === 0 : idx >= start))
        .sort((a, b) => a.idx - b.idx);
    let cursor = start;
    for (const { inj, idx } of anchored) {
        if (idx + 1 > cursor) {
            lane.push(...(await convert(messages.slice(cursor, idx + 1))));
            cursor = idx + 1;
        }
        lane.push(...inj.messages);
    }
    if (cursor < messages.length) {
        lane.push(...(await convert(messages.slice(cursor))));
    }
    return { messages: lane, compacted, injections: anchored.map(({ inj }) => inj) };
}
//# sourceMappingURL=transcriptStorage.js.map