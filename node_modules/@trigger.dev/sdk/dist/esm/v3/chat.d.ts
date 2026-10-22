/**
 * @module @trigger.dev/sdk/chat
 *
 * Browser-safe module for AI SDK chat transport integration.
 * Use this on the frontend with the AI SDK's `useChat` hook.
 *
 * For backend helpers (`chatAgent`, `pipeChat`), use `@trigger.dev/sdk/ai` instead.
 *
 * @example
 * ```tsx
 * import { useChat } from "@ai-sdk/react";
 * import { TriggerChatTransport } from "@trigger.dev/sdk/chat";
 *
 * function Chat() {
 *   const { messages, sendMessage, status } = useChat({
 *     transport: new TriggerChatTransport({
 *       task: "my-chat-task",
 *       accessToken: async ({ chatId }) => fetchSessionToken(chatId),
 *       startSession: async ({ chatId, taskId }) => createChatSession({ chatId, taskId }),
 *     }),
 *   });
 * }
 * ```
 */
import type { ChatTransport, ModelMessage, UIMessage, UIMessageChunk, ChatRequestOptions } from "ai";
/**
 * The wire payload shape sent by `TriggerChatTransport`.
 * Uses `metadata` to match the AI SDK's `ChatRequestOptions` field name.
 *
 * Slim wire: at most ONE message per record. The agent runtime
 * reconstructs prior history at run boot from a durable S3 snapshot +
 * `session.out` replay (or `hydrateMessages` if registered).
 *
 * Declared here (rather than the internal shared module) so `declaration:
 * true` consumers can name inferred agent types via this public subpath.
 */
export type ChatTaskWirePayload<TMessage extends UIMessage = UIMessage, TMetadata = unknown> = {
    /**
     * The single message being delivered on this trigger. Set for:
     *   - `submit-message`: the new user message OR a tool-approval-responded
     *     assistant message (with `state: "approval-responded"` tool parts).
     *   - `regenerate-message`: omitted (the agent slices its own history).
     *   - `preload` / `close` / `action`: omitted.
     *   - `handover-prepare`: omitted (use `headStartMessages` instead).
     */
    message?: TMessage;
    /**
     * Bespoke escape hatch for `chat.headStart`. The customer's HTTP route
     * handler ships full `UIMessage[]` history at the very first turn — before
     * any snapshot exists. The route handler isn't subject to the
     * `MAX_APPEND_BODY_BYTES` cap on `/in/append` because it goes through the
     * customer's own HTTP endpoint. Used ONLY by `trigger: "handover-prepare"`.
     * Ignored on every other trigger.
     */
    headStartMessages?: TMessage[];
    chatId: string;
    trigger: "submit-message" | "regenerate-message" | "preload" | "close" | "action"
    /**
     * The customer's `chat.handover` route handler kicked us off in
     * parallel with the first-turn `streamText` running in the warm
     * Next.js process. The run sits idle on `session.in` waiting for
     * a `kind: "handover"` (continue from tool execution) or
     * `kind: "handover-skip"` (handler finished pure-text, exit
     * cleanly). See `chat.handover` in `@trigger.dev/sdk/chat-server`.
     */
     | "handover-prepare";
    messageId?: string;
    metadata?: TMetadata;
    /**
     * Custom action payload when `trigger` is `"action"`. Managed agents validate
     * this against `actionSchema`; raw custom agents must validate it themselves.
     */
    action?: unknown;
    /** Whether this run is continuing an existing chat whose previous run ended. */
    continuation?: boolean;
    /** The run ID of the previous run (only set when `continuation` is true). */
    previousRunId?: string;
    /** Override idle timeout for this run (seconds). Set by transport.preload(). */
    idleTimeoutInSeconds?: number;
    /**
     * The friendlyId of the Session primitive backing this chat. The
     * transport opens (or lazy-creates) the session with
     * `externalId = chatId` on first message, then sends this friendlyId
     * through to the run so the agent can attach to `.in` / `.out`
     * without needing to round-trip through the control plane again.
     * Optional for backward-compat while the migration is in flight;
     * required once the legacy run-scoped stream path is removed.
     */
    sessionId?: string;
};
/**
 * One chunk on the chat input stream. `kind` discriminates the variants —
 * a single ordered stream carries all the signals (`message`, `stop`,
 * `handover`, `handover-skip`).
 */
export type ChatInputChunk<TMessage extends UIMessage = UIMessage, TMetadata = unknown> = {
    kind: "message";
    /** Full wire payload for a new user message or regeneration. */
    payload: ChatTaskWirePayload<TMessage, TMetadata>;
} | {
    kind: "stop";
    /** Optional human-readable reason. */
    message?: string;
} | {
    /**
     * Sent by `chat.headStart` when the customer's first-turn
     * `streamText` finishes. The agent run (parked in
     * `handover-prepare`) wakes, seeds its accumulators with
     * `partialAssistantMessage`, and runs the normal turn loop.
     * `isFinal: false` means step 1 ended in tool-calls (the agent
     * executes them and continues); `isFinal: true` means step 1 was
     * the complete response (the agent skips the LLM call).
     */
    kind: "handover";
    /** Customer's step-1 response messages (ModelMessage form). */
    partialAssistantMessage: ModelMessage[];
    /**
     * The UI messageId the customer's handler used for its step-1
     * assistant message, reused so post-handover chunks merge into
     * the SAME assistant message on the browser side.
     */
    messageId?: string;
    isFinal: boolean;
} | {
    /**
     * Sent by `chat.headStart` only when the customer's handler
     * ABORTS before producing a finishReason. The agent run exits
     * cleanly without firing turn hooks.
     */
    kind: "handover-skip";
};
/**
 * Discriminator passed to per-endpoint `baseURL` and `fetch` callbacks.
 *
 * - `"in"` — `POST /realtime/v1/sessions/{chatId}/in/append` (user messages,
 *   stops, actions).
 * - `"out"` — `GET /realtime/v1/sessions/{chatId}/out` (SSE response stream).
 *
 * Other endpoints (`/api/v1/sessions`, `/api/v1/auth/jwt/claims`) are reached
 * from the server-side `chat.createStartSessionAction` and `accessToken`
 * callback, not the transport — they accept the same callback shape on their
 * own option objects.
 */
export type ChatTransportEndpoint = "in" | "out";
/** Context passed to `baseURL` and `fetch` callbacks. */
export type ChatTransportEndpointContext = {
    endpoint: ChatTransportEndpoint;
    chatId: string;
};
/** Resolver form of `baseURL` — return the base for the given endpoint. */
export type ChatBaseURLResolver = (ctx: ChatTransportEndpointContext) => string;
/**
 * Per-request fetch override. Receives the fully-resolved URL and the
 * RequestInit the transport would have used, plus endpoint context for
 * routing decisions. Customers can rewrite the URL, inject headers, or
 * delegate to a custom transport (e.g. a Cloudflare worker fronting
 * `api.trigger.dev`). Must return a `Response` semantically equivalent to
 * what `globalThis.fetch(url, init)` would have returned.
 */
export type ChatFetchOverride = (url: string, init: RequestInit, ctx: ChatTransportEndpointContext) => Promise<Response>;
/**
 * Which transport path produced a send-lifecycle event: `useChat` sends,
 * steering (`sendPendingMessage`), actions, stops, or the first-turn
 * `headStart` POST.
 */
export type ChatTransportSendSource = "submit-message" | "regenerate-message" | "steer" | "action" | "stop" | "head-start";
/**
 * Lifecycle events emitted through the transport's `onEvent` callback.
 *
 * Send events are terminal: `message-sent` fires when the append is
 * durably acknowledged (2xx from the session input stream, after any
 * internal token-refresh retries), `message-send-failed` when the send
 * definitively failed. Response events follow the output stream:
 * `stream-connected` when the SSE subscription opens, `first-chunk` on
 * the first response chunk of a turn, `turn-completed` when the agent's
 * turn-complete control record arrives, and `stream-error` when the
 * stream fails unrecoverably.
 */
export type ChatTransportEvent = {
    /**
     * The chat's run is parked waiting for its deployment (version skew protection). Messages
     * sent meanwhile are durable and drain when it lands, but nothing answers until then.
     * Re-emitted on every send while parked; clear the notice on `first-chunk`.
     */
    type: "run-pending-version";
    chatId: string;
    timestamp: number;
    /**
     * Where we learned it: creating the session, a send, the `headStart` POST, or an
     * upgrade handing over to a deployment that has not landed yet.
     */
    source: "start" | "send" | "head-start" | "upgrade";
} | {
    type: "message-sent";
    chatId: string;
    timestamp: number;
    messageId?: string;
    source: ChatTransportSendSource;
    durationMs: number;
    /** The append's idempotency key — also stored on the server-side record. */
    partId?: string;
    /** Serialized request body size in bytes. */
    bodyBytes?: number;
} | {
    type: "message-send-failed";
    chatId: string;
    timestamp: number;
    messageId?: string;
    source: ChatTransportSendSource;
    error: Error;
    status?: number;
    durationMs: number;
    partId?: string;
    bodyBytes?: number;
} | {
    type: "stream-connected";
    chatId: string;
    timestamp: number;
    resumed: boolean;
    /** The resume cursor the subscription connected from, if any. */
    lastEventId?: string;
    /** The last turn-producing send on this chat (client-side attribution). */
    messageId?: string;
} | {
    type: "stream-error";
    chatId: string;
    timestamp: number;
    error: Error;
    status?: number;
} | {
    type: "session-closed";
    chatId: string;
    timestamp: number;
    /** The reason supplied to `chat.close()` / `sessions.close()`, if any. */
    reason?: string;
    /** How the transport learned: the terminal record, or a refused send. */
    source: "stream" | "append";
} | {
    type: "first-chunk";
    chatId: string;
    timestamp: number;
    chunkType?: string;
    lastEventId?: string;
    messageId?: string;
    /** Milliseconds since the last turn-producing send on this chat (time to first token). */
    sinceSendMs?: number;
} | {
    type: "turn-completed";
    chatId: string;
    timestamp: number;
    lastEventId?: string;
    /** The agent's committed input-stream cursor from the turn-complete record. */
    sessionInEventId?: string;
    messageId?: string;
    /** Milliseconds since the last turn-producing send on this chat (full turn latency). */
    sinceSendMs?: number;
};
/**
 * Arguments for the `accessToken` callback. The transport invokes this
 * whenever it needs a fresh session-scoped PAT — initial use, and
 * after a 401 from any session-PAT-authed request.
 *
 * The callback's job is to return a token, not to start a run.
 * Customers whose implementation also creates the session (typical for
 * `chat.createStartSessionAction` server actions) own the trigger
 * payload server-side — they know their own user/context and don't
 * need anything from the browser to populate `basePayload.metadata`.
 */
export type AccessTokenParams = {
    /** Conversation id — same value passed to `sendMessage` / `useChat`. */
    chatId: string;
};
/**
 * Arguments for the `startSession` callback. The transport invokes this
 * when it needs a session for a chatId — on `transport.preload(chatId)`,
 * on `transport.start(chatId)`, and lazily on the first `sendMessage`
 * for any chatId without a cached session.
 *
 * The callback typically wraps a server action that calls
 * `chat.createStartSessionAction(taskId)({ chatId, clientData })`. That
 * action is idempotent on `(env, externalId)`, so concurrent / repeat
 * calls converge on the same session.
 *
 * The `clientData` field carries the transport's current `clientData`
 * option — same value the transport merges into per-turn `metadata` on
 * each `.in` chunk. Passing it through `startSession` makes the first
 * run's `payload.metadata` (visible in `onPreload` / `onChatStart`)
 * match what subsequent turns see.
 *
 * @typeParam TClientData – Type of the agent's `clientDataSchema` (when
 * the transport is parameterised with `useTriggerChatTransport<typeof agent>`).
 */
export type StartSessionParams<TClientData = unknown> = {
    /** The Trigger.dev task ID associated with this transport. */
    taskId: string;
    /** Conversation id — same value passed to `sendMessage` / `useChat`. */
    chatId: string;
    /**
     * The transport's current `clientData`. Pass through to the server
     * action's `basePayload.metadata` so the first run's `payload.metadata`
     * matches per-turn `metadata`.
     */
    clientData: TClientData;
};
/**
 * Result returned from the `startSession` callback. Carries the
 * session-scoped PAT the transport caches and uses for every
 * `.in/append`, `.out` SSE, and `end-and-continue` call afterward.
 */
export type StartSessionResult = {
    /** Session-scoped PAT — `read:sessions:{chatId} + write:sessions:{chatId}`. */
    publicAccessToken: string;
    /**
     * Pass through `pendingVersion` from `chat.createStartSessionAction` (or `POST
     * /api/v1/sessions`) and the transport emits `run-pending-version`.
     */
    pendingVersion?: boolean;
};
/**
 * Public surface of {@link TriggerChatTransport}'s session state. Everything
 * the customer should persist for resumption across page reloads. The
 * transport addresses by `chatId` everywhere, so this is light: just a PAT,
 * resume cursors, and a couple of UX-state flags.
 */
export type ChatSessionPersistedState = {
    publicAccessToken: string;
    lastEventId?: string;
    /** The `.in` append sequence of the last send this client owned; reused as `sinceInSeq` on reconnect. */
    activeInputSeq?: number;
    isStreaming?: boolean;
    /** Set once the session is closed. Persisted so a reload doesn't retry a dead session. */
    closed?: boolean;
    /** The reason the session was closed, when one was given. */
    closedReason?: string;
};
/**
 * Common options for the {@link TriggerChatTransport}.
 *
 * @typeParam TClientData – Type of the per-call client data merged into
 * the wire payload via `metadata`. When the task uses `clientDataSchema`,
 * pin this to the schema's input type for end-to-end type safety.
 */
export type TriggerChatTransportOptions<TClientData = unknown> = {
    /**
     * The Trigger.dev task ID this transport drives. Sessions created by
     * `transport.start(chatId)` are bound to this task — every run the
     * Session schedules invokes it. Threaded into `startSession` so the
     * customer's server action knows which task to bind.
     */
    task: string;
    /**
     * Returns a fresh session-scoped PAT for an existing chat session.
     * The transport invokes this on a 401/403 from any session-PAT-authed
     * request — pure refresh, never creates a session.
     *
     * Customer implementation typically does
     * `auth.createPublicToken({ scopes: { read: { sessions: chatId },
     * write: { sessions: chatId } } })` server-side and returns the token.
     *
     * Required so the transport can recover from PAT expiry — never
     * leaves the consumer in an unrecoverable state.
     */
    accessToken: (params: AccessTokenParams) => string | Promise<string>;
    /**
     * Creates (or no-ops on existing) a session for the given chatId, and
     * returns the session-scoped PAT the transport will use afterward.
     *
     * Wraps a server action that calls
     * `chat.createStartSessionAction(taskId)({ chatId, clientData })`.
     * Customer's server controls authorization, the rest of the
     * triggerConfig, and any atomic DB writes paired with session creation.
     *
     * The transport invokes this:
     *   - when `transport.start(chatId)` / `transport.preload(chatId)` is called
     *   - lazily on the first `sendMessage` for a chatId with no cached PAT
     *
     * Concurrent and repeat calls dedupe via an in-flight promise + the
     * customer-side idempotency on `(env, externalId)`.
     *
     * Optional only when the customer fully manages session lifecycle
     * externally (hydrating `sessions: { ... }` and never calling
     * `start` / `preload`). Most customers should provide it.
     */
    startSession?: (params: StartSessionParams<TClientData extends Record<string, unknown> ? TClientData : Record<string, unknown>>) => Promise<StartSessionResult>;
    /**
     * Base URL for the Trigger.dev API. Either a single string applied to every
     * endpoint, or a function called per request that picks a base URL from the
     * endpoint discriminator and chat ID. @default "https://api.trigger.dev"
     *
     * @example Route appends through a proxy, SSE direct:
     * ```ts
     * baseURL: ({ endpoint }) =>
     *   endpoint === "out" ? "https://api.trigger.dev" : "https://proxy.example.com",
     * ```
     */
    baseURL?: string | ChatBaseURLResolver;
    /**
     * Base URL for the SSE stream subscription only (`GET .../sessions/{chatId}/out`).
     * @deprecated Pass a function for `baseURL` instead and branch on
     * `endpoint === "out"`. `streamBaseURL` continues to work for backwards
     * compatibility and wins over `baseURL` for the SSE endpoint when both
     * are set.
     */
    streamBaseURL?: string;
    /**
     * Optional per-request fetch override. Called with the resolved URL and the
     * RequestInit the transport built, plus endpoint context. Use this to
     * inject custom headers (e.g. distributed tracing), redirect via a proxy,
     * or wrap fetch with retries/logging.
     *
     * @example Add a tracing header to every chat request:
     * ```ts
     * fetch: (url, init, ctx) => {
     *   init.headers = new Headers(init.headers);
     *   init.headers.set("traceparent", currentTraceparent());
     *   return globalThis.fetch(url, init);
     * },
     * ```
     */
    fetch?: ChatFetchOverride;
    /**
     * Observability callback for transport lifecycle events (sends,
     * stream connects, first chunk, turn completion). See
     * {@link ChatTransportEvent} for the event catalog and semantics.
     * Exceptions thrown by the callback are swallowed.
     *
     * @example Record send metrics:
     * ```ts
     * onEvent: (event) => {
     *   if (event.type === "message-sent") {
     *     metrics.timing("chat.send", event.durationMs);
     *   }
     * },
     * ```
     */
    onEvent?: (event: ChatTransportEvent) => void;
    /** Additional headers included in every API request. */
    headers?: Record<string, string>;
    /**
     * Seconds to wait for the realtime stream to produce data before timing
     * out. @default 120
     */
    streamTimeoutSeconds?: number;
    /**
     * Default client data merged into every wire `metadata`. Per-call
     * `metadata` overrides transport-level defaults.
     */
    clientData?: TClientData extends Record<string, unknown> ? TClientData : Record<string, unknown>;
    /**
     * Restore active session state from external storage (e.g. localStorage)
     * after a page refresh. Hydrated entries skip the start round-trip and
     * use their `publicAccessToken` directly. On 401, the transport
     * invokes `accessToken` to refresh.
     */
    sessions?: Record<string, ChatSessionPersistedState>;
    /**
     * Called whenever a chat session's state changes. Use this to persist
     * state for reconnection after a page refresh — `null` is passed when
     * the session is removed.
     */
    onSessionChange?: (chatId: string, session: ChatSessionPersistedState | null) => void;
    /**
     * Enable multi-tab coordination. When `true`, only one tab at a time
     * can send messages to a given chatId; other tabs go read-only.
     *
     * No-op when `BroadcastChannel` is unavailable. @default false
     */
    multiTab?: boolean;
    /**
     * Read-only "watch" mode for observing an existing chat run from the
     * outside (e.g. a dashboard viewer). When `true`, the SSE subscription
     * stays open across `trigger:turn-complete` so consumers see turn 2,
     * 3, … through one long-lived stream. Pair with `sessions` hydration
     * and `reconnectToStream` for the typical viewer flow. @default false
     */
    watch?: boolean;
    /**
     * Opt-in URL that gives a brand-new chat a head start: instead of
     * waiting for the trigger.dev agent run to dequeue + boot before
     * the first LLM call, the transport POSTs the first user message
     * to a route handler in your warm process (Next.js, etc.) that
     * exports `chat.handover({ agentId, run })` from
     * `@trigger.dev/sdk/chat-server`. That handler runs `streamText`
     * step 1 right away while the agent boots in parallel, then hands
     * off mid-turn for tool execution (or exits clean for pure-text
     * turns).
     *
     * First turn only. Subsequent turns on the same chat bypass this
     * URL and write directly to `session.in` — the same direct-trigger
     * path used when `headStart` is unset. Customers using `headStart`
     * still need `accessToken` and (optionally) `startSession` for
     * those subsequent turns.
     *
     * NOT a stock `useChat` "endpoint" — this is not the canonical
     * request URL for every turn, just the warm first-turn shortcut.
     *
     * In benchmarks, head-starting drops first-turn TTFC roughly in
     * half versus the direct-trigger flow (cold-start agent boot +
     * onTurnStart hook overlap with the LLM TTFB instead of stacking
     * before it).
     *
     * @default undefined (direct-trigger flow on every turn)
     */
    headStart?: string;
};
/**
 * A custom AI SDK `ChatTransport` that runs chat completions as durable
 * Trigger.dev tasks via the Sessions primitive.
 *
 * Lifecycle:
 *   1. Customer pre-creates the session server-side OR calls
 *      `transport.start(chatId)` to mint a one-shot start token and
 *      `POST /api/v1/sessions` from the browser.
 *   2. The server triggers the first run as part of session create and
 *      returns a session-scoped PAT.
 *   3. `sendMessages` appends to `.in` and subscribes to `.out`. When a
 *      run dies (idle, cancel, end-and-continue), the server's
 *      append-time probe triggers a fresh run for the same session —
 *      transport keeps streaming.
 *   4. `stop()` posts a `{kind:"stop"}` chunk; the agent's turn aborts
 *      but the run keeps reading `.in` for the next message.
 *   5. PAT expiry: transport invokes `accessToken` to refresh and
 *      retries the failing request once.
 */
export declare class TriggerChatTransport implements ChatTransport<UIMessage> {
    private readonly taskId;
    private resolveAccessToken;
    private resolveStartSession;
    private readonly resolveBaseURLFn;
    private fetchOverride;
    private readonly extraHeaders;
    private readonly streamTimeoutSeconds;
    private defaultMetadata;
    private readonly watchMode;
    private readonly headStart;
    private coordinator;
    private _onSessionChange;
    private _onEvent;
    private sessions;
    private pendingResumeCursors;
    private activeStreams;
    private pendingStarts;
    private lastTurnSends;
    constructor(options: TriggerChatTransportOptions);
    /**
     * Eagerly create a Session and trigger its first run. Useful as a
     * "the user might be about to send a message — boot the agent now"
     * preload, or to take ownership of the session before any sendMessage.
     *
     * Idempotent: calling `start(chatId)` twice converges to the same
     * session via the `(env, externalId)` upsert. Concurrent calls
     * deduplicate via an in-flight promise.
     *
     * Requires `getStartToken` to be configured. Customers who pre-create
     * sessions server-side don't need to call this.
     */
    start(chatId: string): Promise<ChatSessionPersistedState>;
    /**
     * Eagerly create the session before the user types. Same semantics as
     * {@link start} — kept as a separate name for the AI SDK Chat hook,
     * which calls `preload` rather than `start`.
     */
    preload(chatId: string): Promise<void>;
    /**
     * Send a user message via the session's `.in` channel. The server
     * probes `currentRunId`; if terminal/null it triggers a fresh run on
     * the same session before the append lands. The returned
     * `ReadableStream` carries the agent's response chunks via `.out` SSE.
     */
    sendMessages: (options: {
        trigger: "submit-message" | "regenerate-message";
        chatId: string;
        messageId: string | undefined;
        messages: UIMessage[];
        abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions) => Promise<ReadableStream<UIMessageChunk>>;
    /**
     * First-turn-only path used when `headStart` is configured. POSTs the
     * wire payload to the customer's `chat.handover` route handler and
     * pipes its SSE response back as a UIMessageChunk stream. Hydrates
     * session state from response headers so subsequent turns bypass
     * the endpoint and use the direct `session.in` path.
     */
    private sendMessagesViaHandover;
    /**
     * Send a steering message during an active stream without disrupting
     * it. The agent's `pendingMessages` config decides whether to inject
     * between tool-call steps or buffer for the next turn.
     */
    sendPendingMessage: (chatId: string, message: UIMessage, metadata?: Record<string, unknown>) => Promise<boolean>;
    /**
     * Re-establish an SSE subscription to a known session. Used after a
     * page refresh: the customer hydrates `sessions` in the constructor,
     * the AI SDK calls `reconnectToStream` to resume the stream.
     */
    reconnectToStream: (options: {
        chatId: string;
        abortSignal?: AbortSignal | undefined;
        /**
         * Whether aborting this subscription sends `{kind:"stop"}` on `.in`.
         * A subscription ending is not session ownership — a passive/watch
         * reader unmounting must never stop a turn it doesn't drive. Only
         * pass `true` from a caller that owns the live turn. @default false
         */
        stopOnAbort?: boolean;
    } & ChatRequestOptions) => Promise<ReadableStream<UIMessageChunk> | null>;
    /**
     * Stop the current generation. Sends `{kind:"stop"}` on `.in`; the
     * agent aborts its `streamText` call but stays alive for the next
     * message.
     */
    stopGeneration: (chatId: string) => Promise<boolean>;
    /**
     * Clear the supersede gate armed by a stop. Call this when the stopped
     * turn died without ever writing its `trigger:turn-complete` boundary,
     * otherwise the next turn stays gated forever.
     */
    clearSupersedeGate: (chatId: string) => void;
    /**
     * Send a custom action chunk (for `chat.agent`'s `actionSchema` /
     * `onAction` hook). An action is an edit: only `hydrateMessages` and
     * `onAction` fire on the agent side, and the returned stream completes
     * with `trigger:turn-complete` once the edit is persisted. When `onAction`
     * returns `chat.turn()` the turn's response follows on the same stream.
     * Per-action `metadata` is merged over the transport's `clientData`.
     */
    sendAction: (chatId: string, action: unknown, options?: {
        abortSignal?: AbortSignal;
        metadata?: Record<string, unknown>;
    }) => Promise<ReadableStream<UIMessageChunk>>;
    getSession: (chatId: string) => ChatSessionPersistedState | undefined;
    setSession(chatId: string, session: ChatSessionPersistedState): void;
    /**
     * Seed the `.out` resume cursor from a loaded transcript. Applied to the
     * session now if it exists, otherwise held until the session is created so
     * the first live subscription opens past the persisted history instead of
     * replaying it. Never moves an existing cursor backward: the transcript load
     * is async, so a live `.out` record can already have advanced the session
     * past the snapshot, and overwriting it would replay those records.
     */
    seedResumeCursor: (chatId: string, lastEventId: string) => void;
    private applyPendingResumeCursor;
    setOnSessionChange(callback: ((chatId: string, session: ChatSessionPersistedState | null) => void) | undefined): void;
    /** Update the `onEvent` callback without recreating the transport. */
    setOnEvent(callback: ((event: ChatTransportEvent) => void) | undefined): void;
    private emitEvent;
    /** Run a send op, emitting the terminal message-sent / message-send-failed event. */
    private sendWithEvents;
    /** Attribution fields for response-side events. */
    private turnAttribution;
    /**
     * Update the transport's `clientData`. Used by `useTriggerChatTransport`
     * to keep the latest value reachable from inside `startSession` and
     * the per-turn `metadata` merge without recreating the transport.
     *
     * Reads always go through the live field — closures around the
     * transport see the latest value the next time they fire.
     */
    setClientData(clientData: Record<string, unknown> | undefined): void;
    /**
     * Update the request-time callbacks. Same reason as `setClientData`:
     * a host that rebuilds these per render (a dashboard navigating between
     * projects) would otherwise keep hitting the endpoint captured at
     * construction. Every read goes through the live field, so the next
     * request uses the latest callback.
     */
    setAccessToken(accessToken: (params: AccessTokenParams) => string | Promise<string>): void;
    setStartSession(startSession: ((params: StartSessionParams<Record<string, unknown>>) => Promise<StartSessionResult>) | undefined): void;
    setFetch(fetchOverride: ChatFetchOverride | undefined): void;
    isReadOnly(chatId: string): boolean;
    hasClaim(chatId: string): boolean;
    addReadOnlyListener(fn: (chatId: string, isReadOnly: boolean) => void): void;
    removeReadOnlyListener(fn: (chatId: string, isReadOnly: boolean) => void): void;
    broadcastMessages(chatId: string, messages: unknown[]): void;
    addMessagesListener(fn: (chatId: string, messages: unknown[]) => void): void;
    removeMessagesListener(fn: (chatId: string, messages: unknown[]) => void): void;
    dispose(): void;
    private serializeInputChunk;
    private toPersisted;
    /**
     * Flip a session to closed and tell listeners once. Terminal: sends and
     * reconnects stop from here on, and there is no reopening.
     */
    private markSessionClosed;
    /**
     * Whether the conversation has been closed — by the agent via
     * `chat.close()`, or from outside via `sessions.close()`. Closed is
     * one-way: the transport refuses further sends and reconnects, and the
     * transcript stays readable.
     */
    sessionStatus: (chatId: string) => "open" | "closed";
    /** The reason the session was closed, when one was given. */
    sessionClosedReason: (chatId: string) => string | undefined;
    private notifySessionChange;
    /**
     * Resolves the session state for a chatId, starting the session if
     * needed (and `getStartToken` is configured). Customers who provide
     * `accessToken` but no `getStartToken` are expected to have created
     * the session server-side; in that case the first `accessToken` call
     * returns a fresh session PAT.
     */
    private ensureSessionState;
    private doStart;
    /**
     * Run `op` with the session's stored PAT. On 401/403, refresh the PAT
     * via `accessToken` and retry once. Surfaces non-auth errors as-is.
     */
    private resolveBaseURL;
    /**
     * `fetchClient` for an `out` subscription. Reads `this.fetchOverride` on
     * every call, not once per subscription: a watch-mode subscription
     * reconnects for the lifetime of the page, and `setFetch` may have swapped
     * the override in between.
     */
    private sseFetchClient;
    private doFetch;
    private appendInputChunk;
    private callWithAuthRetry;
    /**
     * Repair a stale/phantom hydrated session. The cached state pointed at a
     * session that doesn't exist in the current environment (404) — typically
     * because it was persisted against a different trigger environment, or
     * predates the upgrade to the sessions model. Recreate the session via
     * `startSession` and overwrite the cached state **in place** so callers
     * holding a reference (e.g. `sendMessages` before it opens the SSE) pick
     * up the new PAT. The stale `lastEventId` resume cursor is dropped — it
     * pointed at a different environment's stream.
     */
    private recreateSession;
    /**
     * Open an SSE subscription to the session's `.out` stream and pipe
     * UIMessageChunks through to the AI SDK. Trigger control records
     * (`turn-complete`, `upgrade-required` — see `trigger-control` header
     * on `client-protocol.mdx#records-on-session-out`) are routed by
     * header and never reach the consumer. `upgrade-required` is purely
     * telemetry now since the server handles the run swap inline (see
     * `end-and-continue`).
     */
    private subscribeToSessionStream;
}
/**
 * Convenience constructor matching {@link TriggerChatTransport}.
 */
export declare function createChatTransport(options: TriggerChatTransportOptions): TriggerChatTransport;
export { AgentChat, ChatStream, type AgentChatOptions, type ChatSession, type ChatStreamResult, type ChatToolCall, type ChatToolResult, type InferChatClientData, type InferChatUIMessage, } from "./chat-client.js";
