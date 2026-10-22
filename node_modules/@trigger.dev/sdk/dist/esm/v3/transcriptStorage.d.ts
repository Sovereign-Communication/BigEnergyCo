import { type TaskRunContext, type TranscriptSnapshotEntry } from "@trigger.dev/core/v3";
import type { ModelMessage, UIMessage } from "ai";
/**
 * One change to a transcript. Ops address messages by id; position is the
 * storage's own concern.
 *
 * - `put` upserts by `message.id`: an unknown id appends, a known id is
 *   replaced in place. `final` is false when the runtime captured a partial
 *   assistant message from an errored or stopped turn; it defaults to true.
 * - `remove` deletes by id and is a no-op for an unknown id.
 * - `truncateAfter` drops every message ordered after `afterId` (a rollback)
 *   and is a no-op when `afterId` is unknown.
 * - `state` replaces the opaque runtime record; `null` clears it.
 */
export type TranscriptChange = {
    op: "put";
    message: UIMessage;
    final?: boolean;
} | {
    op: "remove";
    id: string;
} | {
    op: "truncateAfter";
    afterId: string;
} | {
    op: "state";
    value: unknown | null;
};
export type TranscriptChangeReason = "turn-start" | "turn-complete" | "turn-error" | "action" | "compaction" | "recovery";
export type TranscriptCursors = {
    lastOutEventId?: string;
    lastInEventId?: string;
};
/**
 * What the runtime hands to `save`: the ordered changes since the last save
 * (one transaction where the backend supports it), the whole transcript as
 * it stands after those changes, and the stream cursors the next boot should
 * resume from. A row-per-message store applies `changes`; a store that keeps
 * the conversation as one document writes `transcript` as-is and needs no
 * state of its own. Cursors are runtime-computed and persisted opaquely; a
 * storage never interprets them.
 */
export type TranscriptChangeset = {
    reason: TranscriptChangeReason;
    changes: TranscriptChange[];
    transcript: TranscriptState;
    cursors?: TranscriptCursors;
};
/** The tenant scope of a read. A render read has no run, so this is all `load` gets. */
export type TranscriptScope<TClientData = unknown> = {
    chatId: string;
    clientData: TClientData;
};
/** The run context of a write. Supplied by the runtime; always in-run. */
export type TranscriptStorageContext<TClientData = unknown> = TranscriptScope<TClientData> & {
    turn: number;
    trigger: "submit-message" | "regenerate-message" | "action";
    runId: string;
    ctx: TaskRunContext;
};
export type TranscriptLoadOptions = {
    /** Return at most this many messages, the most recent ones. */
    limit?: number;
    /** Return messages ordered before this message id (a `nextCursor` from a previous page). */
    before?: string;
};
export type TranscriptLoadResult<TUIMessage extends UIMessage = UIMessage> = {
    messages: TUIMessage[];
    state: unknown | null;
    cursors?: TranscriptCursors;
    /** The id to pass as `before` for the previous page; absent on the last page. */
    nextCursor?: string;
    /**
     * Ids among `messages` that were saved with `final: false` (a partial
     * answer). A storage that keeps `final` returns them so a partial stays
     * partial when a continuation saves it again unchanged; a storage that
     * does not keep `final` may leave this out.
     */
    nonFinalIds?: string[];
};
/** What `loadContext` receives on every turn and action. */
export type LoadContextEvent<TClientData = unknown, TUIMessage extends UIMessage = UIMessage> = {
    chatId: string;
    /** The turn number (0-indexed). */
    turn: number;
    trigger: "submit-message" | "regenerate-message" | "action";
    /** The messages the frontend sent for this turn. Empty for actions. */
    incomingMessages: TUIMessage[];
    /** The runtime's transcript before this turn, including any tail it recovered. */
    previousMessages: TUIMessage[];
    clientData?: TClientData;
    continuation: boolean;
    previousRunId?: string;
};
/**
 * A persistence adapter for a `chat.agent` transcript. The runtime calls
 * `load` once at a continuation boot and `save` after every change to the
 * conversation. Both are best-effort from the runtime's point of view: an
 * error is logged and the turn continues.
 *
 * `loadContext` is optional. Its presence declares that the application
 * owns the model's context: the runtime calls it on every turn and action
 * and uses what it returns as the conversation, instead of the transcript
 * it accumulated. Tail recovery still runs and `save` is still called.
 */
export type TranscriptStorage<TClientData = unknown> = {
    load<TUIMessage extends UIMessage = UIMessage>(scope: TranscriptScope<TClientData>, opts?: TranscriptLoadOptions): Promise<TranscriptLoadResult<TUIMessage>>;
    save(ctx: TranscriptStorageContext<TClientData>, changeset: TranscriptChangeset): Promise<void>;
    loadContext?<TUIMessage extends UIMessage = UIMessage>(scope: TranscriptScope<TClientData>, event: LoadContextEvent<TClientData, TUIMessage>): Promise<TUIMessage[]> | TUIMessage[];
};
/** An in-memory transcript: ordered entries plus the opaque state record. */
export type TranscriptState<TUIMessage extends UIMessage = UIMessage> = {
    entries: TranscriptSnapshotEntry<TUIMessage>[];
    state: unknown | null;
};
export declare function emptyTranscriptState<TUIMessage extends UIMessage = UIMessage>(): TranscriptState<TUIMessage>;
/**
 * Apply changes to a transcript, in order. Pure: returns a new state and
 * never mutates the input. Replaying the same changes converges, which is
 * what lets a storage retry a failed write without checking what landed.
 */
export declare function reduceTranscriptChanges<TUIMessage extends UIMessage = UIMessage>(prev: TranscriptState<TUIMessage>, changes: readonly TranscriptChange[]): TranscriptState<TUIMessage>;
/**
 * What the runtime remembers about the transcript it last handed to
 * `save`: the ids in order and a fingerprint per message, so the next
 * changeset can be derived from the accumulator without asking the storage.
 */
export type TranscriptShadow = {
    ids: string[];
    fingerprints: Map<string, string>;
    /** Ids last saved with `final: false`. Everything else was saved final. */
    nonFinal: Set<string>;
};
/**
 * Build the shadow for `messages`. An id is non-final when this save says so
 * (`nonFinalIds`) or when it was non-final before and its content has not
 * changed: a partial answer stays partial until the message itself changes.
 */
export declare function createTranscriptShadow(messages: readonly UIMessage[], nonFinalIds?: ReadonlySet<string>, previous?: TranscriptShadow): TranscriptShadow;
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
export declare function diffTranscript(shadow: TranscriptShadow, next: readonly UIMessage[], options?: {
    nonFinalIds?: ReadonlySet<string>;
}): {
    changes: TranscriptChange[];
    shadow: TranscriptShadow;
};
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
export declare function snapshotTranscriptStorage(): TranscriptStorage<unknown>;
/** The storage `chat.agent` uses when none is configured: {@link snapshotTranscriptStorage}. */
export declare const defaultStorage: TranscriptStorage<unknown>;
export type MemoryTranscriptStorage = TranscriptStorage<unknown> & {
    /** The stored transcript for a chat, or `undefined` when nothing has been saved. */
    transcript(chatId: string): (TranscriptState & {
        cursors?: TranscriptCursors;
    }) | undefined;
    /** Every changeset `save` received, in order. */
    readonly changesets: Array<{
        ctx: TranscriptStorageContext<unknown>;
        changeset: TranscriptChangeset;
    }>;
};
/**
 * A storage that keeps every transcript in process memory. The reference
 * implementation for the conformance tests, and a way to inspect exactly
 * what the runtime hands a storage.
 */
export declare function memoryTranscriptStorage(): MemoryTranscriptStorage;
type ModelLaneInjection = {
    afterId: string;
    messages: ModelMessage[];
};
/**
 * What the runtime keeps in the storage's `state` slot: the parts of the
 * model's context that cannot be rebuilt from the transcript. Opaque to a
 * storage; only the runtime reads it.
 *
 * `compaction` is the whole model lane after a compaction, covering the
 * transcript prefix ending at `throughId`. It is used as long as `throughId`
 * still exists in the transcript, so a rollback or truncation that removes it
 * rebuilds the lane from the transcript instead. Editing a message before
 * `throughId` in place is unsupported and does not invalidate the lane.
 * `injections` are conversational messages `chat.inject` added, anchored
 * after the transcript message they followed.
 */
export type TranscriptRuntimeState = {
    v: 1;
    compaction?: {
        modelMessages: ModelMessage[];
        throughId: string;
    };
    injections?: ModelLaneInjection[];
    /** `chat.inject` messages queued but not yet drained into a turn when the save happened. */
    queued?: ModelMessage[];
};
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
export declare function trimTranscriptForSnapshot<TEntry extends {
    id: string;
}>(entries: TEntry[], state: unknown, opts: {
    keep: number;
}): TEntry[];
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
export declare function normalizeRuntimeStateForWindow(state: unknown, windowIds: Iterable<string>): unknown;
export declare function parseTranscriptRuntimeState(value: unknown): TranscriptRuntimeState | undefined;
/**
 * Rebuild the model lane for a transcript at boot. Uses the persisted
 * compacted lane while the transcript still contains its `throughId`
 * boundary, then converts the rest of the transcript, re-inserting persisted
 * injections after the messages they followed.
 */
export declare function restoreModelLane<TUIMessage extends UIMessage>(messages: TUIMessage[], state: TranscriptRuntimeState | undefined, convert: (messages: TUIMessage[]) => Promise<ModelMessage[]>): Promise<{
    messages: ModelMessage[];
    compacted: boolean;
    injections: ModelLaneInjection[];
}>;
export {};
