import type { ApiPromise, ApiRequestOptions, AsyncIterableStream, CloseSessionRequestBody, ControlEvent, CreateSessionRequestBody, CreatedSessionResponseBody, InputStreamOnceOptions, InputStreamWaitOptions, InputStreamWaitWithIdleTimeoutOptions, ListSessionsOptions, ListedSessionItem, PipeStreamOptions, PipeStreamResult, RetrieveSessionResponseBody, SessionTriggerConfig, StreamWriteResult, UpdateSessionRequestBody, WriterStreamOptions, CursorPagePromise, AnySessionChannel, SessionChannel, SessionChannelIn, SessionChannelName, SessionChannelOut, SessionChannelShape } from "@trigger.dev/core/v3";
import { InputStreamOncePromise, ManualWaitpointPromise } from "@trigger.dev/core/v3";
export type { CloseSessionRequestBody, CreateSessionRequestBody, CreatedSessionResponseBody, ListSessionsOptions, ListedSessionItem, RetrieveSessionResponseBody, UpdateSessionRequestBody, };
/**
 * `SessionTriggerConfig` as callers supply it. `externalDeploymentId` is normally discovered from
 * the environment, so passing it is optional; pass `null` to opt this chat out of version pinning.
 */
export type SessionTriggerConfigInput = Omit<SessionTriggerConfig, "externalDeploymentId"> & {
    externalDeploymentId?: string | null;
};
/** {@link CreateSessionRequestBody} with the caller-facing trigger config. */
export type CreateSessionInput = Omit<CreateSessionRequestBody, "triggerConfig"> & {
    triggerConfig: SessionTriggerConfigInput;
};
export declare const sessions: {
    start: typeof startSession;
    retrieve: typeof retrieveSession;
    update: typeof updateSession;
    close: typeof closeSession;
    list: typeof listSessions;
    open: typeof open;
    defineChannel: typeof defineChannel;
};
type SessionOpenImpl = (sessionIdOrExternalId: string) => SessionHandle;
export declare function __setSessionOpenImplForTests(impl: SessionOpenImpl | undefined): void;
type SessionStartImpl = (body: CreateSessionRequestBody) => Promise<CreatedSessionResponseBody> | CreatedSessionResponseBody;
export declare function __setSessionStartImplForTests(impl: SessionStartImpl | undefined): void;
type SessionCloseImpl = (sessionIdOrExternalId: string, body?: CloseSessionRequestBody) => Promise<RetrieveSessionResponseBody> | RetrieveSessionResponseBody;
export declare function __setSessionCloseImplForTests(impl: SessionCloseImpl | undefined): void;
/**
 * Start a {@link Session} — a stateful execution of an agent, with
 * two-way streaming and durable compute, that can span multiple runs.
 * The server creates the row (idempotent on `externalId`)
 * and triggers the first run from `triggerConfig` in one round-trip.
 * Returns the new run's id and a session-scoped public access token
 * for browser-side use against `.in/append`, `.out` SSE, and
 * `end-and-continue`.
 *
 * If a session with the same `(env, externalId)` already exists,
 * returns the existing row plus the live (or freshly re-triggered) run.
 * Two browser tabs of the same chat converge to one session.
 */
declare function startSession(input: CreateSessionInput, requestOptions?: ApiRequestOptions): ApiPromise<CreatedSessionResponseBody>;
/**
 * Retrieve a Session by `friendlyId` (`session_*`) or user-supplied
 * `externalId`. The server disambiguates via the `session_` prefix.
 */
declare function retrieveSession(sessionIdOrExternalId: string, requestOptions?: ApiRequestOptions): ApiPromise<RetrieveSessionResponseBody>;
/** Update mutable fields on a Session (tags, metadata, externalId). */
declare function updateSession(sessionIdOrExternalId: string, body: UpdateSessionRequestBody, requestOptions?: ApiRequestOptions): ApiPromise<RetrieveSessionResponseBody>;
/** Mark a Session as closed (terminal, idempotent). */
declare function closeSession(sessionIdOrExternalId: string, body?: CloseSessionRequestBody, requestOptions?: ApiRequestOptions): ApiPromise<RetrieveSessionResponseBody>;
/**
 * List Sessions in the current environment with filters + cursor pagination.
 * Returns a {@link CursorPagePromise} so callers can iterate pages with
 * `for await`.
 */
declare function listSessions(options?: ListSessionsOptions, requestOptions?: ApiRequestOptions): CursorPagePromise<typeof ListedSessionItem>;
/**
 * Open a lightweight handle to a Session's realtime channels. Does not
 * perform a network call on its own — each channel method hits the
 * corresponding realtime endpoint.
 */
declare function open(sessionIdOrExternalId: string): SessionHandle;
export declare class SessionHandle {
    readonly id: string;
    /**
     * Producer-to-consumer channel: the task writes records; external
     * clients read them. Mirrors `streams.define` — `append` / `pipe` /
     * `writer` / `read`.
     */
    readonly out: SessionOutputChannel;
    /**
     * Consumer-to-producer channel: external clients call `.send()`; the
     * task consumes via `.on` / `.once` / `.peek` / `.wait` /
     * `.waitWithIdleTimeout`. Mirrors `streams.input` but keyed on the
     * session so a conversation can survive across run boundaries.
     */
    readonly in: SessionInputChannel;
    constructor(id: string, overrides?: {
        in?: SessionInputChannel;
        out?: SessionOutputChannel;
    });
    /**
     * Open a named side channel on this session: a durable, cross-run `.in`/`.out`
     * pair addressed by `name` rather than the reserved default pair. Writing a
     * side channel's `.in` does not wake or trigger a run; a run observes it via
     * `.in.on()` / `.in.once()`. Records outlive any single run and are bounded by
     * the org's stream retention, the same as the reserved chat streams.
     *
     * Pass a `sessions.defineChannel(...)` definition to type `.in`/`.out` records;
     * a bare name string works too, with records typed `unknown`.
     */
    channel<C extends AnySessionChannel = AnySessionChannel>(channel: SessionChannelName<C> | C): SessionChannelHandleFor<C>;
}
export type SessionChannelHandleFor<C extends AnySessionChannel> = {
    readonly name: string;
    readonly out: SessionOutputChannel<SessionChannelOut<C>>;
    readonly in: SessionInputChannel<SessionChannelIn<C>>;
};
export type SessionChannelHandle = SessionChannelHandleFor<AnySessionChannel>;
/**
 * Declare a named Session channel with typed `.in` / `.out` records, inferred
 * on both the producer and the consumer. The channel analogue of a task
 * definition: pass the result to `session.channel(...)` / `chat.channel(...)`
 * and to `useSessionStreamChannel<typeof channel>` so the record types line up
 * on every side.
 */
declare function defineChannel<TShape extends SessionChannelShape = SessionChannelShape, const TName extends string = string>(name: TName): SessionChannel<TName, TShape>;
/**
 * Options accepted by {@link SessionOutputChannel.pipe}. Session-scoped,
 * so it omits the `target` field (self/parent/root/runId) that run-scoped
 * {@link PipeStreamOptions} uses — the session is the target.
 */
export type SessionPipeStreamOptions = Omit<PipeStreamOptions, "target">;
/**
 * The `.out` side of a Session's bidirectional channel pair. Mirrors the
 * consume-side of {@link streams.define}: `pipe` / `writer` / `append`
 * for the task to produce records, `read` for external clients to
 * consume via SSE. S2 credentials for direct writes are fetched
 * internally by `pipe`/`writer` — there's no public `initialize()`.
 */
export declare class SessionOutputChannel<TOut = unknown> {
    #private;
    readonly sessionId: string;
    readonly channel?: string | undefined;
    constructor(sessionId: string, channel?: string | undefined);
    /**
     * Append a single record. Routes through {@link writer} internally so
     * subscribers receive the same parsed-object shape as multi-record
     * writes — the server-side append endpoint wraps the body in a string,
     * which would give SSE consumers a JSON-string instead of an object.
     * Mirrors how `streams.define.append` delegates to `streams.writer`.
     */
    append(value: TOut, options?: SessionPipeStreamOptions): Promise<void>;
    /**
     * Pipe an `AsyncIterable` / `ReadableStream` directly to S2. Fetches
     * session S2 credentials internally and streams through
     * {@link SessionStreamInstance}. Parallel to {@link streams.pipe} but
     * session-scoped — no `target` option because the session is the target.
     */
    pipe<T = TOut>(value: AsyncIterable<T> | ReadableStream<T>, options?: SessionPipeStreamOptions): PipeStreamResult<T>;
    /**
     * Mirror of {@link streams.writer}: runs `execute({ write, merge })`
     * against an in-memory queue whose records are piped to S2. Returns
     * `{ stream, waitUntilComplete }` so callers can observe the local
     * stream and await completion. Span is collapsible via `options.spanName`
     * / `options.collapsed`.
     */
    writer<T = TOut>(options: WriterStreamOptions<T>): PipeStreamResult<T>;
    /**
     * Subscribe to SSE records on `.out`. Returns an async-iterable stream —
     * auto-retry, Last-Event-ID resume, and abort propagation come from the
     * shared {@link SSEStreamSubscription} plumbing used by run-scoped
     * realtime streams.
     */
    read<T = TOut>(options?: SessionSubscribeOptions<T>): Promise<AsyncIterableStream<T>>;
    /**
     * Write a single Trigger control record to `.out`. The record carries a
     * `trigger-control` header valued with `subtype` plus any sibling
     * `extraHeaders`; the body is empty. Control records are filtered out of
     * the consumer-facing chunk stream by the SDK transport — readers route
     * them via the `onControl` callback instead.
     *
     * The returned `lastEventId` is the S2 seq_num of the written record,
     * useful for trim chains (e.g. trim back to the previous turn-complete).
     */
    writeControl(subtype: string, extraHeaders?: ReadonlyArray<readonly [string, string]>): Promise<StreamWriteResult>;
    /**
     * Append an S2 `trim` command record to `.out`. Records with seq_num
     * less than `earliestSeqNum` are eventually removed from the stream.
     *
     * Idempotent and monotonic at S2's layer (`max(existing, min(provided,
     * current_tail))`) — backward trims are silently no-ops for deletion
     * but still consume a seq_num. Used by `chat.agent`'s turn loop to
     * keep `session.out` bounded to roughly one turn at steady state.
     */
    trimTo(earliestSeqNum: number): Promise<void>;
}
/**
 * The `.in` side of a Session's bidirectional channel pair. Mirrors
 * {@link streams.input} — consumer-side primitives for the task
 * (`on`/`once`/`peek`/`wait`/`waitWithIdleTimeout`) plus `send` for
 * external clients. Keyed on the session rather than the run so a
 * conversation can survive across run boundaries.
 */
export declare class SessionInputChannel<TIn = unknown> {
    #private;
    readonly sessionId: string;
    readonly channel?: string | undefined;
    constructor(sessionId: string, channel?: string | undefined);
    /**
     * Send a single record to the channel. Called by external clients
     * (browser, server action, another task) producing input for the run.
     * Matches {@link streams.input.send} but session-scoped — the session
     * is the address, no `runId` required.
     */
    send(value: TIn, requestOptions?: ApiRequestOptions): Promise<void>;
    /**
     * Register a handler that fires for every record landing on `.in`.
     * Buffered records are offered to the handler on attach, and handlers
     * are cleaned up automatically when the task run completes. Returns
     * `{ off }` to unsubscribe early.
     *
     * A handler that synchronously returns `true` CONSUMES the record: it
     * won't be buffered for a later `once()` and won't be re-delivered on a
     * future `on()` attach. Plain observers should return nothing.
     */
    on<T = TIn>(handler: (data: T) => void | boolean | Promise<void>): {
        off: () => void;
    };
    /**
     * Wait for the next record on `.in` without suspending the run.
     * Returns `{ ok: true, output }` on arrival or `{ ok: false, error }`
     * when the timeout fires. Chain `.unwrap()` to get the data directly.
     */
    once<T = TIn>(options?: InputStreamOnceOptions): InputStreamOncePromise<T>;
    /** Non-blocking peek at the head of the `.in` buffer. */
    peek<T = TIn>(): T | undefined;
    /**
     * The highest S2 sequence number that is safe to persist as consumed.
     * This stays behind the earliest unconsumed record if a later record was
     * handled first. Distinct from "last received", which advances for records
     * that may still be pending.
     *
     * Used by `chat.agent` to persist the `.in` resume cursor on each
     * `turn-complete` control record, so the next worker boot can subscribe
     * past already-processed user messages.
     */
    lastDispatchedSeqNum(): number | undefined;
    wait<T = unknown>(options?: InputStreamWaitOptions): ManualWaitpointPromise<T>;
    /**
     * Wait for a record with an idle-then-suspend strategy. Keeps the run
     * active (using compute) for `idleTimeoutInSeconds`, then suspends via
     * {@link wait} if nothing arrives. If a record arrives during the idle
     * phase the run responds without suspending.
     */
    waitWithIdleTimeout<T = unknown>(options: InputStreamWaitWithIdleTimeoutOptions): Promise<{
        ok: true;
        output: T;
    } | {
        ok: false;
        error?: Error;
    }>;
}
export type SessionSubscribeOptions<T = unknown> = {
    signal?: AbortSignal;
    lastEventId?: string | number;
    /** Timeout in seconds for the underlying long-poll (max 600). */
    timeoutInSeconds?: number;
    /** Called for each SSE event with the full event metadata (id, timestamp). */
    onPart?: (part: {
        id: string;
        chunk: T;
        timestamp: number;
    }) => void;
    /**
     * Called when a `trigger-control` record arrives on the stream (e.g.
     * `turn-complete`, `upgrade-required`). Control records are filtered
     * out of the consumer chunk stream — handle them here. See
     * `docs/ai-chat/client-protocol.mdx` for the wire shape.
     */
    onControl?: (event: ControlEvent) => void;
    /** Called when the server signals end-of-stream. */
    onComplete?: () => void;
    /** Called on unrecoverable errors after the retry budget is exhausted. */
    onError?: (error: Error) => void;
};
