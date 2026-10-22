"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStream = exports.AgentChat = exports.TriggerChatTransport = void 0;
exports.createChatTransport = createChatTransport;
const v3_1 = require("@trigger.dev/core/v3");
function byteLength(body) {
    return new TextEncoder().encode(body).byteLength;
}
const chat_tab_coordinator_js_1 = require("./chat-tab-coordinator.js");
const ai_shared_js_1 = require("./ai-shared.js");
const DEFAULT_BASE_URL = "https://api.trigger.dev";
const DEFAULT_STREAM_TIMEOUT_SECONDS = 120;
/**
 * Detect 401/403 from realtime/input-stream calls without relying on `instanceof`
 * (Vitest can load duplicate `@trigger.dev/core` copies, which breaks subclass checks).
 */
function isAuthError(error) {
    if (error === null || typeof error !== "object")
        return false;
    const e = error;
    return e.name === "TriggerApiError" && (e.status === 401 || e.status === 403);
}
/**
 * Detect the closed-session refusal from `.in/append`: HTTP 409 with the
 * stable `session_closed` code. Terminal — never retried.
 */
function isSessionClosedError(error) {
    if (error === null || typeof error !== "object")
        return false;
    const e = error;
    return e.name === "TriggerApiError" && e.status === 409 && e.code === "session_closed";
}
function sessionClosedReasonOf(error) {
    if (error === null || typeof error !== "object")
        return undefined;
    const reason = error.closedReason;
    return typeof reason === "string" ? reason : undefined;
}
/** The local form of the refusal, for sends the transport rejects itself. */
function sessionClosedError(chatId, reason) {
    const err = new Error(reason ? `Chat session ${chatId} is closed: ${reason}` : `Chat session ${chatId} is closed`);
    err.name = "TriggerApiError";
    err.status = 409;
    err.code = "session_closed";
    if (reason)
        err.closedReason = reason;
    return err;
}
/**
 * Detect a 404 from a session-PAT-authed call — i.e. the session doesn't
 * exist in the current environment. Happens when hydrated session state
 * (the `sessions` option / a customer's persisted record) was created in a
 * different trigger environment, or predates the upgrade to the sessions
 * model, so there's no real Session row behind the cached PAT.
 */
function isSessionNotFoundError(error) {
    if (error === null || typeof error !== "object")
        return false;
    const e = error;
    return e.name === "TriggerApiError" && e.status === 404;
}
/**
 * Parses an SSE byte/text stream of `data: <UIMessageChunk JSON>\n\n`
 * frames back into `UIMessageChunk` objects. Used by the handover
 * first-turn path to convert the customer's route handler response
 * (which is AI-SDK-shaped SSE text) into the chunk form the AI SDK's
 * `useChat` consumes from a transport.
 *
 * Spec-light parser — assumes well-formed `data:` events from our own
 * `chat.handover` SSE writer. Lines starting with `:` (comments) and
 * other event types are ignored.
 */
function parseUIMessageSseTransform() {
    let buffer = "";
    return new TransformStream({
        transform(chunk, controller) {
            buffer += chunk;
            // Frames are separated by blank lines.
            let idx = buffer.indexOf("\n\n");
            while (idx !== -1) {
                const frame = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 2);
                for (const line of frame.split("\n")) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (!data)
                            continue;
                        try {
                            controller.enqueue(JSON.parse(data));
                        }
                        catch {
                            /* drop malformed chunk; the response source is our own writer */
                        }
                    }
                }
                idx = buffer.indexOf("\n\n");
            }
        },
        flush(controller) {
            // Trailing data without a closing blank line — treat as a final frame.
            if (buffer.trim().length === 0)
                return;
            for (const line of buffer.split("\n")) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (!data)
                        continue;
                    try {
                        controller.enqueue(JSON.parse(data));
                    }
                    catch {
                        /* drop */
                    }
                }
            }
            buffer = "";
        },
    });
}
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
class TriggerChatTransport {
    taskId;
    resolveAccessToken;
    resolveStartSession;
    resolveBaseURLFn;
    fetchOverride;
    extraHeaders;
    streamTimeoutSeconds;
    defaultMetadata;
    watchMode;
    headStart;
    coordinator = null;
    _onSessionChange;
    _onEvent;
    sessions = new Map();
    pendingResumeCursors = new Map();
    activeStreams = new Map();
    pendingStarts = new Map();
    // Last turn-producing send per chat — attribution source for the
    // response-side events' `messageId` / `sinceSendMs`.
    lastTurnSends = new Map();
    constructor(options) {
        this.taskId = options.task;
        this.resolveAccessToken = options.accessToken;
        this.resolveStartSession = options.startSession;
        const baseURLOption = options.baseURL ?? DEFAULT_BASE_URL;
        const streamOverride = options.streamBaseURL;
        this.resolveBaseURLFn =
            typeof baseURLOption === "function"
                ? (ctx) => (ctx.endpoint === "out" && streamOverride ? streamOverride : baseURLOption(ctx))
                : (ctx) => (ctx.endpoint === "out" && streamOverride ? streamOverride : baseURLOption);
        this.fetchOverride = options.fetch;
        this.extraHeaders = options.headers ?? {};
        this.streamTimeoutSeconds = options.streamTimeoutSeconds ?? DEFAULT_STREAM_TIMEOUT_SECONDS;
        this.defaultMetadata = options.clientData;
        this._onSessionChange = options.onSessionChange;
        this._onEvent = options.onEvent;
        this.watchMode = options.watch ?? false;
        this.headStart = options.headStart;
        if (options.multiTab && !this.watchMode) {
            this.coordinator = new chat_tab_coordinator_js_1.ChatTabCoordinator();
            this.coordinator.addSessionListener((chatId, sessionUpdate) => {
                const session = this.sessions.get(chatId);
                if (session && sessionUpdate.lastEventId) {
                    session.lastEventId = sessionUpdate.lastEventId;
                }
            });
        }
        if (options.sessions) {
            for (const [chatId, session] of Object.entries(options.sessions)) {
                this.sessions.set(chatId, {
                    publicAccessToken: session.publicAccessToken,
                    lastEventId: session.lastEventId,
                    activeInputSeq: session.activeInputSeq,
                    isStreaming: session.isStreaming,
                    closed: session.closed,
                    closedReason: session.closedReason,
                });
            }
        }
    }
    // -------------------------------------------------------------------------
    // Public lifecycle
    // -------------------------------------------------------------------------
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
    async start(chatId) {
        const existing = this.sessions.get(chatId);
        if (existing?.publicAccessToken) {
            return this.toPersisted(existing);
        }
        const inflight = this.pendingStarts.get(chatId);
        if (inflight)
            return inflight.then(this.toPersisted);
        const promise = this.doStart(chatId).finally(() => {
            this.pendingStarts.delete(chatId);
        });
        this.pendingStarts.set(chatId, promise);
        return promise.then(this.toPersisted);
    }
    /**
     * Eagerly create the session before the user types. Same semantics as
     * {@link start} — kept as a separate name for the AI SDK Chat hook,
     * which calls `preload` rather than `start`.
     */
    async preload(chatId) {
        await this.start(chatId);
    }
    /**
     * Send a user message via the session's `.in` channel. The server
     * probes `currentRunId`; if terminal/null it triggers a fresh run on
     * the same session before the append lands. The returned
     * `ReadableStream` carries the agent's response chunks via `.out` SSE.
     */
    sendMessages = async (options) => {
        const { trigger, chatId, messageId, messages, abortSignal, body, metadata } = options;
        const closedState = this.sessions.get(chatId);
        if (closedState?.closed) {
            throw sessionClosedError(chatId, closedState.closedReason);
        }
        if (this.coordinator) {
            if (this.coordinator.isReadOnly(chatId)) {
                throw new Error("This chat is active in another tab");
            }
            this.coordinator.claim(chatId);
        }
        const mergedMetadata = this.defaultMetadata || metadata
            ? { ...(this.defaultMetadata ?? {}), ...(metadata ?? {}) }
            : undefined;
        // An action sent through `useChat`. `useChatActions` (or any caller) puts
        // it in `body.action`; sending it here rather than through
        // `transport.sendAction` means `useChat` owns the response stream, so an
        // action that becomes a turn renders the way a message turn does.
        const actionInBody = body?.action;
        if (actionInBody !== undefined) {
            return this.sendAction(chatId, actionInBody, { abortSignal, metadata: mergedMetadata });
        }
        // First-turn handover routing — when `headStart` is set AND no
        // session state exists yet for this chatId, POST the wire payload
        // to the customer's `chat.handover` route handler. The handler
        // creates the session, triggers the agent run with
        // `handover-prepare`, runs `streamText` step 1 in its warm
        // process, and tees the output back as the SSE response. We
        // hydrate session state from the response headers so subsequent
        // turns bypass the handler and use direct `session.in` writes.
        if (this.headStart && !this.sessions.has(chatId)) {
            return this.sendMessagesViaHandover({
                trigger,
                chatId,
                messageId,
                messages,
                abortSignal,
                body,
                metadata: mergedMetadata,
            });
        }
        // Slim wire — at most ONE message per record. The agent rebuilds prior
        // history from its durable S3 snapshot + session.out replay at run boot
        // (or `hydrateMessages`, if registered).
        //
        //   - "submit-message": ship the latest message (new user message OR a
        //     tool-approval-responded assistant message). Throw if absent.
        //     Assistant messages with already-resolved tool parts are slimmed
        //     to just their resolution payload — reasoning blobs, prior text,
        //     and tool `input` stay on the agent side (rebuilt from snapshot
        //     or `hydrateMessages`). Keeps continuation payloads under the
        //     `.in/append` cap on reasoning-heavy turns.
        //   - "regenerate-message": omit `message`; the agent slices its own
        //     history (drops the trailing assistant) and re-runs.
        if (trigger === "submit-message" && messages.length === 0) {
            throw new Error("TriggerChatTransport.sendMessages: 'submit-message' trigger requires at least one message");
        }
        const wirePayload = {
            ...(body ?? {}),
            ...(trigger === "submit-message"
                ? { message: (0, ai_shared_js_1.slimSubmitMessageForWire)(messages.at(-1)) }
                : {}),
            chatId,
            trigger,
            messageId,
            metadata: mergedMetadata,
        };
        const state = await this.ensureSessionState(chatId);
        // Generated outside the closure so auth-retries reuse the same part id
        // and the server-side dedupe sees one logical append.
        const partId = crypto.randomUUID();
        const serializedBody = this.serializeInputChunk({ kind: "message", payload: wirePayload });
        const sendChatMessage = (token) => this.appendInputChunk(chatId, token, serializedBody, partId);
        const inSeq = await this.sendWithEvents(chatId, trigger, {
            messageId: messageId ?? messages.at(-1)?.id,
            partId,
            bodyBytes: byteLength(serializedBody),
        }, () => this.callWithAuthRetry(chatId, state, sendChatMessage));
        // Cancel any in-flight stream for this chat — the new turn supersedes it.
        const activeStream = this.activeStreams.get(chatId);
        if (activeStream) {
            activeStream.abort();
            this.activeStreams.delete(chatId);
        }
        state.activeInputSeq = inSeq;
        state.isStreaming = true;
        state.outstandingTurnAbandoned = false;
        this.notifySessionChange(chatId, state);
        // Owning turn: aborting this live send stops the turn the user drives.
        return this.subscribeToSessionStream(state, abortSignal, chatId, {
            sinceInSeq: inSeq,
            sendStopOnAbort: true,
        });
    };
    /**
     * First-turn-only path used when `headStart` is configured. POSTs the
     * wire payload to the customer's `chat.handover` route handler and
     * pipes its SSE response back as a UIMessageChunk stream. Hydrates
     * session state from response headers so subsequent turns bypass
     * the endpoint and use the direct `session.in` path.
     */
    async sendMessagesViaHandover(args) {
        if (!this.headStart) {
            throw new Error("sendMessagesViaHandover called without headStart configured");
        }
        // Head-start ships full UIMessage history via `headStartMessages`. The
        // route handler runs on the customer's own HTTP endpoint (NOT
        // `/realtime/v1/sessions/{id}/in/append`), so the 512 KiB body cap
        // doesn't apply. The agent's run boot consumes `headStartMessages` ONLY
        // when no snapshot exists yet (very first turn) — see plan section B.3.
        const wirePayload = {
            ...(args.body ?? {}),
            headStartMessages: args.messages,
            chatId: args.chatId,
            trigger: args.trigger,
            messageId: args.messageId,
            metadata: args.metadata,
        };
        let response;
        const serializedBody = JSON.stringify(wirePayload);
        await this.sendWithEvents(args.chatId, "head-start", {
            messageId: args.messageId ?? args.messages.at(-1)?.id,
            bodyBytes: byteLength(serializedBody),
        }, async () => {
            response = await fetch(this.headStart, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...this.extraHeaders,
                },
                body: serializedBody,
                signal: args.abortSignal,
            });
            if (!response.ok) {
                const err = new Error(`chat.handover endpoint returned ${response.status} ${response.statusText}`);
                err.status = response.status;
                throw err;
            }
        });
        if (!response.body) {
            throw new Error("chat.handover endpoint returned no response body");
        }
        // Hydrate session state from response headers so subsequent turns
        // skip the endpoint and write directly to session.in. Failing fast
        // when the header is missing avoids a quiet degraded state where
        // every later turn re-runs the handover route instead of taking
        // the slim-wire path.
        const accessToken = response.headers.get("X-Trigger-Chat-Access-Token");
        const chatId = args.chatId;
        if (!accessToken) {
            throw new Error("chat.handover response is missing the X-Trigger-Chat-Access-Token header. chat.agent's handover endpoint must echo the session PAT so the transport can hydrate.");
        }
        const state = {
            publicAccessToken: accessToken,
            isStreaming: true,
        };
        this.sessions.set(chatId, state);
        this.notifySessionChange(chatId, state);
        // Step 1 streams from the warm server either way; this says the agent run that owes step 2
        // is parked on an undeployed external deployment id.
        if (response.headers.get("X-Trigger-Chat-Pending-Version") === "1") {
            this.emitEvent({
                type: "run-pending-version",
                chatId,
                timestamp: Date.now(),
                source: "head-start",
            });
        }
        // Filter the parsed UIMessage stream:
        //   - Drop control chunks (`trigger:turn-complete`,
        //     `trigger:session-state`) before they reach AI SDK — they
        //     aren't valid UIMessageChunks and the AI SDK chunk parser
        //     would reject them.
        //   - On `trigger:turn-complete`, clear `isStreaming` so the
        //     useChat resume / reconnectToStream path doesn't open a
        //     second `session.out` subscription on top of our stitched
        //     response.
        //   - On `trigger:session-state`, hydrate `state.lastEventId`
        //     with the agent's final S2 event id. Without this, turn 2's
        //     `session.out` subscribe reads from the start and replays
        //     turn 1's chunks back into the UI.
        //   - On stream end (handover-skip case — no
        //     `trigger:turn-complete` arrives, customer's stream just
        //     ends), also clear `isStreaming` for the same reason.
        const sessions = this.sessions;
        const notifyChange = (id, state) => this.notifySessionChange(id, state);
        const TRIGGER_TURN_COMPLETE = "trigger:turn-complete";
        const TRIGGER_SESSION_STATE = "trigger:session-state";
        const clearStreaming = () => {
            const state = sessions.get(chatId);
            if (state && state.isStreaming) {
                state.isStreaming = false;
                notifyChange(chatId, state);
            }
        };
        const setLastEventId = (lastEventId) => {
            const state = sessions.get(chatId);
            if (state) {
                state.lastEventId = lastEventId;
                notifyChange(chatId, state);
            }
        };
        const emit = (event) => this.emitEvent(event);
        const attribution = () => this.turnAttribution(chatId);
        let sawFirstChunk = false;
        emit({
            type: "stream-connected",
            chatId,
            timestamp: Date.now(),
            resumed: false,
            messageId: this.lastTurnSends.get(chatId)?.messageId,
        });
        const piped = response.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(parseUIMessageSseTransform())
            .pipeThrough(new TransformStream({
            transform(chunk, controller) {
                if (chunk && typeof chunk === "object") {
                    const type = chunk.type;
                    if (type === TRIGGER_TURN_COMPLETE) {
                        clearStreaming();
                        emit({
                            type: "turn-completed",
                            chatId,
                            timestamp: Date.now(),
                            lastEventId: sessions.get(chatId)?.lastEventId,
                            ...attribution(),
                        });
                        return; // drop — not a real UIMessageChunk
                    }
                    if (type === TRIGGER_SESSION_STATE) {
                        const lastEventId = chunk.lastEventId;
                        if (typeof lastEventId === "string") {
                            setLastEventId(lastEventId);
                        }
                        return; // drop
                    }
                }
                if (!sawFirstChunk) {
                    sawFirstChunk = true;
                    emit({
                        type: "first-chunk",
                        chatId,
                        timestamp: Date.now(),
                        chunkType: chunk?.type,
                        ...attribution(),
                    });
                }
                controller.enqueue(chunk);
            },
            flush() {
                clearStreaming();
            },
        }));
        // Pump wrapper: a TransformStream can't observe upstream errors, so
        // read here to emit stream-error (aborts close cleanly, matching the
        // session subscribe path).
        const pipedReader = piped.getReader();
        return new ReadableStream({
            async pull(controller) {
                try {
                    const next = await pipedReader.read();
                    if (next.done) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(next.value);
                }
                catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        try {
                            controller.close();
                        }
                        catch {
                            /* already closed */
                        }
                        return;
                    }
                    const errorStatus = error.status;
                    emit({
                        type: "stream-error",
                        chatId,
                        timestamp: Date.now(),
                        error: error instanceof Error ? error : new Error(String(error)),
                        status: typeof errorStatus === "number" ? errorStatus : undefined,
                    });
                    controller.error(error);
                }
            },
            cancel(reason) {
                return pipedReader.cancel(reason);
            },
        });
    }
    /**
     * Send a steering message during an active stream without disrupting
     * it. The agent's `pendingMessages` config decides whether to inject
     * between tool-call steps or buffer for the next turn.
     */
    sendPendingMessage = async (chatId, message, metadata) => {
        const state = this.sessions.get(chatId);
        if (!state)
            return false;
        const mergedMetadata = this.defaultMetadata || metadata
            ? { ...(this.defaultMetadata ?? {}), ...(metadata ?? {}) }
            : undefined;
        const wirePayload = {
            message,
            chatId,
            trigger: "submit-message",
            metadata: mergedMetadata,
        };
        const partId = crypto.randomUUID();
        const serializedBody = this.serializeInputChunk({ kind: "message", payload: wirePayload });
        const send = async (token) => {
            await this.appendInputChunk(chatId, token, serializedBody, partId);
        };
        try {
            await this.sendWithEvents(chatId, "steer", { messageId: message.id, partId, bodyBytes: byteLength(serializedBody) }, () => this.callWithAuthRetry(chatId, state, send));
            return true;
        }
        catch {
            return false;
        }
    };
    /**
     * Re-establish an SSE subscription to a known session. Used after a
     * page refresh: the customer hydrates `sessions` in the constructor,
     * the AI SDK calls `reconnectToStream` to resume the stream.
     */
    reconnectToStream = async (options) => {
        const state = this.sessions.get(options.chatId);
        if (!state)
            return null;
        // A closed session has no further turns to resume.
        if (state.closed)
            return null;
        // Watch is a standing subscription: a settled session is exactly the
        // state it waits in, so a completed last turn must not block the resume.
        if (state.isStreaming === false && !this.watchMode)
            return null;
        if (this.activeStreams.has(options.chatId))
            return null;
        const abortController = new AbortController();
        this.activeStreams.set(options.chatId, abortController);
        const abortSignal = options.abortSignal
            ? AbortSignal.any([options.abortSignal, abortController.signal])
            : abortController.signal;
        return this.subscribeToSessionStream(state, abortSignal, options.chatId, {
            resumed: true,
            sendStopOnAbort: options.stopOnAbort ?? false,
            sinceInSeq: state.activeInputSeq,
            // Reconnect-on-reload opts into the server's settled-peek shortcut
            // so the SSE doesn't hang for 60s when no turn is in flight. A known
            // active input must not peek because the previous turn's completion
            // can remain at the tail until the current turn writes its first chunk.
            // Watch mode must NOT peek: a settled peek between turns closes the
            // standing subscription, so the viewer never sees the next turn.
            peekSettled: !this.watchMode && state.activeInputSeq === undefined,
        });
    };
    /**
     * Stop the current generation. Sends `{kind:"stop"}` on `.in`; the
     * agent aborts its `streamText` call but stays alive for the next
     * message.
     */
    stopGeneration = async (chatId) => {
        const state = this.sessions.get(chatId);
        if (!state)
            return false;
        const partId = crypto.randomUUID();
        const serializedBody = this.serializeInputChunk({ kind: "stop" });
        const send = async (token) => {
            await this.appendInputChunk(chatId, token, serializedBody, partId);
        };
        try {
            await this.sendWithEvents(chatId, "stop", { partId, bodyBytes: byteLength(serializedBody) }, () => this.callWithAuthRetry(chatId, state, send));
        }
        catch {
            return false;
        }
        // Only gate when a sent turn is still outstanding. A stop at a boundary has
        // nothing to supersede, and gating it would swallow the next turn.
        if (!state.outstandingTurnAbandoned &&
            (state.isStreaming || state.activeInputSeq !== undefined)) {
            state.skipToTurnComplete = true;
            state.supersededInputSeq = state.activeInputSeq;
        }
        const activeStream = this.activeStreams.get(chatId);
        if (activeStream) {
            activeStream.abort();
            this.activeStreams.delete(chatId);
        }
        // Release here, not in the stream teardown: that only releases while it
        // still owns the map entry, and we just deleted it. Unlike a supersede,
        // no successor stream follows a stop, so the claim would never be freed
        // and other tabs would stay read-only until this one closes.
        this.coordinator?.release(chatId);
        // The turn won't reach its turn-complete on this client (we just
        // aborted the reader), so clear the streaming flag here and persist —
        // otherwise a reload resumes mid-turn and replays the chunks the user
        // explicitly stopped.
        state.isStreaming = false;
        this.notifySessionChange(chatId, state);
        return true;
    };
    /**
     * Clear the supersede gate armed by a stop. Call this when the stopped
     * turn died without ever writing its `trigger:turn-complete` boundary,
     * otherwise the next turn stays gated forever.
     */
    clearSupersedeGate = (chatId) => {
        const state = this.sessions.get(chatId);
        if (!state)
            return;
        state.skipToTurnComplete = false;
        state.supersededInputSeq = undefined;
        state.outstandingTurnAbandoned = true;
    };
    /**
     * Send a custom action chunk (for `chat.agent`'s `actionSchema` /
     * `onAction` hook). An action is an edit: only `hydrateMessages` and
     * `onAction` fire on the agent side, and the returned stream completes
     * with `trigger:turn-complete` once the edit is persisted. When `onAction`
     * returns `chat.turn()` the turn's response follows on the same stream.
     * Per-action `metadata` is merged over the transport's `clientData`.
     */
    sendAction = async (chatId, action, options) => {
        if (this.coordinator) {
            if (this.coordinator.isReadOnly(chatId)) {
                throw new Error("This chat is active in another tab");
            }
            this.coordinator.claim(chatId);
        }
        const state = await this.ensureSessionState(chatId);
        const wirePayload = {
            chatId,
            trigger: "action",
            action,
            metadata: this.defaultMetadata || options?.metadata
                ? { ...(this.defaultMetadata ?? {}), ...(options?.metadata ?? {}) }
                : undefined,
        };
        const body = this.serializeInputChunk({ kind: "message", payload: wirePayload });
        const partId = crypto.randomUUID();
        const send = (token) => this.appendInputChunk(chatId, token, body, partId);
        const inSeq = await this.sendWithEvents(chatId, "action", { partId, bodyBytes: byteLength(body) }, () => this.callWithAuthRetry(chatId, state, send));
        // Supersede any in-flight reader before subscribing — same as
        // `sendMessages`. Two concurrent readers both write `state.lastEventId`
        // and the slower one can regress the cursor, replaying records on the
        // next reconnect.
        const activeStream = this.activeStreams.get(chatId);
        if (activeStream) {
            activeStream.abort();
            this.activeStreams.delete(chatId);
        }
        // Mark streaming + persist so a reload mid-action resumes (reconnectToStream
        // no-ops when the persisted session says isStreaming: false).
        state.activeInputSeq = inSeq;
        state.isStreaming = true;
        state.outstandingTurnAbandoned = false;
        this.notifySessionChange(chatId, state);
        // Owning action: aborting this send stops the turn the user drives.
        return this.subscribeToSessionStream(state, options?.abortSignal, chatId, {
            sinceInSeq: inSeq,
            sendStopOnAbort: true,
        });
    };
    // -------------------------------------------------------------------------
    // External-state surface
    // -------------------------------------------------------------------------
    getSession = (chatId) => {
        const state = this.sessions.get(chatId);
        if (!state)
            return undefined;
        return this.toPersisted(state);
    };
    setSession(chatId, session) {
        this.sessions.set(chatId, this.applyPendingResumeCursor(chatId, {
            publicAccessToken: session.publicAccessToken,
            lastEventId: session.lastEventId,
            activeInputSeq: session.activeInputSeq,
            isStreaming: session.isStreaming,
        }));
        this.notifySessionChange(chatId, this.toPersisted(this.sessions.get(chatId)));
    }
    /**
     * Seed the `.out` resume cursor from a loaded transcript. Applied to the
     * session now if it exists, otherwise held until the session is created so
     * the first live subscription opens past the persisted history instead of
     * replaying it. Never moves an existing cursor backward: the transcript load
     * is async, so a live `.out` record can already have advanced the session
     * past the snapshot, and overwriting it would replay those records.
     */
    seedResumeCursor = (chatId, lastEventId) => {
        const existing = this.sessions.get(chatId);
        if (existing?.publicAccessToken) {
            if (existing.lastEventId === undefined) {
                existing.lastEventId = lastEventId;
                this.notifySessionChange(chatId, this.toPersisted(existing));
            }
            this.pendingResumeCursors.delete(chatId);
            return;
        }
        this.pendingResumeCursors.set(chatId, lastEventId);
    };
    applyPendingResumeCursor(chatId, state) {
        const pending = this.pendingResumeCursors.get(chatId);
        if (pending !== undefined && state.lastEventId === undefined) {
            state.lastEventId = pending;
        }
        this.pendingResumeCursors.delete(chatId);
        return state;
    }
    setOnSessionChange(callback) {
        this._onSessionChange = callback;
    }
    /** Update the `onEvent` callback without recreating the transport. */
    setOnEvent(callback) {
        this._onEvent = callback;
    }
    emitEvent(event) {
        const cb = this._onEvent;
        if (!cb)
            return;
        try {
            cb(event);
        }
        catch {
            // observability must never break the chat
        }
    }
    /** Run a send op, emitting the terminal message-sent / message-send-failed event. */
    async sendWithEvents(chatId, source, extras, op) {
        const startedAt = Date.now();
        try {
            const result = await op();
            const turnProducing = source === "submit-message" || source === "regenerate-message" || source === "head-start";
            if (turnProducing) {
                this.lastTurnSends.set(chatId, { messageId: extras.messageId, at: Date.now() });
            }
            this.emitEvent({
                type: "message-sent",
                chatId,
                timestamp: Date.now(),
                source,
                durationMs: Date.now() - startedAt,
                ...extras,
            });
            return result;
        }
        catch (error) {
            const status = error.status;
            this.emitEvent({
                type: "message-send-failed",
                chatId,
                timestamp: Date.now(),
                source,
                error: error instanceof Error ? error : new Error(String(error)),
                status: typeof status === "number" ? status : undefined,
                durationMs: Date.now() - startedAt,
                ...extras,
            });
            throw error;
        }
    }
    /** Attribution fields for response-side events. */
    turnAttribution(chatId) {
        const lastSend = this.lastTurnSends.get(chatId);
        if (!lastSend)
            return {};
        return { messageId: lastSend.messageId, sinceSendMs: Date.now() - lastSend.at };
    }
    /**
     * Update the transport's `clientData`. Used by `useTriggerChatTransport`
     * to keep the latest value reachable from inside `startSession` and
     * the per-turn `metadata` merge without recreating the transport.
     *
     * Reads always go through the live field — closures around the
     * transport see the latest value the next time they fire.
     */
    setClientData(clientData) {
        this.defaultMetadata = clientData;
    }
    /**
     * Update the request-time callbacks. Same reason as `setClientData`:
     * a host that rebuilds these per render (a dashboard navigating between
     * projects) would otherwise keep hitting the endpoint captured at
     * construction. Every read goes through the live field, so the next
     * request uses the latest callback.
     */
    setAccessToken(accessToken) {
        this.resolveAccessToken = accessToken;
    }
    setStartSession(startSession) {
        this.resolveStartSession = startSession;
    }
    setFetch(fetchOverride) {
        this.fetchOverride = fetchOverride;
    }
    // -------------------------------------------------------------------------
    // Multi-tab coordination passthrough
    // -------------------------------------------------------------------------
    isReadOnly(chatId) {
        return this.coordinator?.isReadOnly(chatId) ?? false;
    }
    hasClaim(chatId) {
        return this.coordinator?.hasClaim(chatId) ?? false;
    }
    addReadOnlyListener(fn) {
        this.coordinator?.addListener(fn);
    }
    removeReadOnlyListener(fn) {
        this.coordinator?.removeListener(fn);
    }
    broadcastMessages(chatId, messages) {
        this.coordinator?.broadcastMessages(chatId, messages);
    }
    addMessagesListener(fn) {
        this.coordinator?.addMessagesListener(fn);
    }
    removeMessagesListener(fn) {
        this.coordinator?.removeMessagesListener(fn);
    }
    dispose() {
        // Tear down any open session.out subscriptions before the coordinator
        // goes away. Otherwise controllers in `activeStreams` keep reading
        // until they time out, leaking network and memory on every
        // unmount/navigation.
        for (const controller of this.activeStreams.values()) {
            controller.abort();
        }
        this.activeStreams.clear();
        this.coordinator?.dispose();
        this.coordinator = null;
    }
    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    serializeInputChunk(chunk) {
        return JSON.stringify(chunk);
    }
    toPersisted = (state) => ({
        publicAccessToken: state.publicAccessToken,
        lastEventId: state.lastEventId,
        activeInputSeq: state.activeInputSeq,
        isStreaming: state.isStreaming,
        closed: state.closed,
        closedReason: state.closedReason,
    });
    /**
     * Flip a session to closed and tell listeners once. Terminal: sends and
     * reconnects stop from here on, and there is no reopening.
     */
    markSessionClosed(chatId, state, reason, source) {
        if (state.closed)
            return;
        state.closed = true;
        if (reason)
            state.closedReason = reason;
        state.isStreaming = false;
        state.activeInputSeq = undefined;
        state.skipToTurnComplete = false;
        state.supersededInputSeq = undefined;
        this.emitEvent({
            type: "session-closed",
            chatId,
            timestamp: Date.now(),
            ...(reason ? { reason } : {}),
            source,
        });
        this.notifySessionChange(chatId, state);
        this.coordinator?.release(chatId);
    }
    /**
     * Whether the conversation has been closed — by the agent via
     * `chat.close()`, or from outside via `sessions.close()`. Closed is
     * one-way: the transport refuses further sends and reconnects, and the
     * transcript stays readable.
     */
    sessionStatus = (chatId) => this.sessions.get(chatId)?.closed ? "closed" : "open";
    /** The reason the session was closed, when one was given. */
    sessionClosedReason = (chatId) => this.sessions.get(chatId)?.closedReason;
    notifySessionChange(chatId, session) {
        if (!this._onSessionChange)
            return;
        this._onSessionChange(chatId, session ? this.toPersisted(session) : null);
    }
    /**
     * Resolves the session state for a chatId, starting the session if
     * needed (and `getStartToken` is configured). Customers who provide
     * `accessToken` but no `getStartToken` are expected to have created
     * the session server-side; in that case the first `accessToken` call
     * returns a fresh session PAT.
     */
    async ensureSessionState(chatId) {
        const existing = this.sessions.get(chatId);
        if (existing?.publicAccessToken)
            return existing;
        if (this.resolveStartSession) {
            // Lazily start: customer's server action creates the session and
            // returns a PAT. Idempotent on `(env, externalId)` so concurrent
            // tabs / repeat calls converge to the same session.
            const inflight = this.pendingStarts.get(chatId);
            if (inflight)
                return inflight;
            const promise = this.doStart(chatId).finally(() => {
                this.pendingStarts.delete(chatId);
            });
            this.pendingStarts.set(chatId, promise);
            return promise;
        }
        // No `startSession` configured. Customer fully manages session
        // lifecycle externally — they're expected to have hydrated
        // `sessions: { ... }` already, or the very first `accessToken` call
        // returns a PAT for an out-of-band-created session.
        const token = await this.resolveAccessToken({ chatId });
        const state = this.applyPendingResumeCursor(chatId, { publicAccessToken: token });
        this.sessions.set(chatId, state);
        this.notifySessionChange(chatId, state);
        return state;
    }
    async doStart(chatId) {
        if (!this.resolveStartSession) {
            throw new Error("TriggerChatTransport: `startSession` is required to call `start()` / `preload()`. Either provide it or pre-hydrate the session via `sessions: { ... }`.");
        }
        const { publicAccessToken, pendingVersion } = await this.resolveStartSession({
            taskId: this.taskId,
            chatId,
            clientData: (this.defaultMetadata ?? {}),
        });
        if (pendingVersion) {
            this.emitEvent({
                type: "run-pending-version",
                chatId,
                timestamp: Date.now(),
                source: "start",
            });
        }
        const state = this.applyPendingResumeCursor(chatId, {
            publicAccessToken,
            isStreaming: false,
        });
        this.sessions.set(chatId, state);
        this.notifySessionChange(chatId, state);
        return state;
    }
    /**
     * Run `op` with the session's stored PAT. On 401/403, refresh the PAT
     * via `accessToken` and retry once. Surfaces non-auth errors as-is.
     */
    resolveBaseURL(ctx) {
        const raw = this.resolveBaseURLFn(ctx);
        return raw.replace(/\/$/, "");
    }
    /**
     * `fetchClient` for an `out` subscription. Reads `this.fetchOverride` on
     * every call, not once per subscription: a watch-mode subscription
     * reconnects for the lifetime of the page, and `setFetch` may have swapped
     * the override in between.
     */
    sseFetchClient(ctx) {
        return ((input, init) => {
            const override = this.fetchOverride;
            if (!override)
                return fetch(input, init);
            if (typeof input === "string") {
                return override(input, init ?? {}, ctx);
            }
            if (input instanceof URL) {
                return override(input.toString(), init ?? {}, ctx);
            }
            // Request — preserve its url + intrinsic init, let any provided init
            // override on top (matches fetch(Request, init) semantics).
            return override(input.url, {
                method: input.method,
                headers: input.headers,
                signal: input.signal,
                ...(init ?? {}),
            }, ctx);
        });
    }
    async doFetch(ctx, url, init) {
        return this.fetchOverride ? this.fetchOverride(url, init, ctx) : fetch(url, init);
    }
    async appendInputChunk(chatId, token, body, partId) {
        const ctx = { endpoint: "in", chatId };
        const url = `${this.resolveBaseURL(ctx)}/realtime/v1/sessions/${encodeURIComponent(chatId)}/in/append`;
        // extraHeaders first so the fixed headers below win — a transport-wide
        // X-Part-Id must not override the per-append idempotency key.
        const headers = {
            ...this.extraHeaders,
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-trigger-source": "sdk",
            "X-Part-Id": partId ?? crypto.randomUUID(),
        };
        const response = await this.doFetch(ctx, url, { method: "POST", headers, body });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const err = new Error(`appendToSessionStream failed: ${response.status} ${text}`);
            err.name = "TriggerApiError";
            err.status = response.status;
            let parsed;
            try {
                parsed = JSON.parse(text);
            }
            catch {
                parsed = undefined;
            }
            if (typeof parsed?.code === "string")
                err.code = parsed.code;
            if (typeof parsed?.closedReason === "string")
                err.closedReason = parsed.closedReason;
            throw err;
        }
        // The appended record's `.in` seq, for correlating the response stream to
        // this send. Omitted by older webapps / a lost idempotency claim.
        const data = (await response.json().catch(() => undefined));
        if (data?.pendingVersion === true) {
            this.emitEvent({
                type: "run-pending-version",
                chatId,
                timestamp: Date.now(),
                source: "send",
            });
        }
        return typeof data?.seq === "number" ? data.seq : undefined;
    }
    async callWithAuthRetry(chatId, state, op) {
        if (state.closed) {
            throw sessionClosedError(chatId, state.closedReason);
        }
        // Every attempt goes through here, so a closed-session refusal is terminal
        // on whichever one hits it. Reaching a 409 from a later attempt and not
        // marking it would leave local status open on a conversation the server
        // has already ended.
        const attempt = async (token) => {
            try {
                return await op(token);
            }
            catch (err) {
                if (isSessionClosedError(err)) {
                    // Terminal. Retrying, refreshing the PAT, or recreating the session
                    // would all be wrong: the conversation is over.
                    this.markSessionClosed(chatId, state, sessionClosedReasonOf(err), "append");
                }
                throw err;
            }
        };
        // 1) Try with the current PAT.
        try {
            return await attempt(state.publicAccessToken);
        }
        catch (err) {
            if (isSessionClosedError(err))
                throw err;
            if (isSessionNotFoundError(err)) {
                // The cached PAT authenticated but the session doesn't exist here —
                // recreate it and retry.
                await this.recreateSession(chatId, state);
                return await attempt(state.publicAccessToken);
            }
            if (!isAuthError(err))
                throw err;
        }
        // 2) Auth error — refresh the PAT and retry. (A cross-environment cached
        //    PAT fails auth here because it was signed by another env's keys.)
        const fresh = await this.resolveAccessToken({ chatId });
        state.publicAccessToken = fresh;
        this.notifySessionChange(chatId, state);
        try {
            return await attempt(fresh);
        }
        catch (err) {
            if (!isSessionNotFoundError(err))
                throw err;
        }
        // 3) PAT is now valid but the session still 404s — the hydrated session
        //    state is stale (created in a different environment, or before the
        //    sessions upgrade). Recreate the session and retry once.
        await this.recreateSession(chatId, state);
        return await attempt(state.publicAccessToken);
    }
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
    async recreateSession(chatId, state) {
        if (!this.resolveStartSession) {
            throw new Error("TriggerChatTransport: session not found and no `startSession` configured to recreate it. The stored session state for this chat may be stale (e.g. created in a different environment) — provide `startSession` or clear the stored session so a fresh one can be created.");
        }
        const { publicAccessToken, pendingVersion } = await this.resolveStartSession({
            taskId: this.taskId,
            chatId,
            clientData: (this.defaultMetadata ?? {}),
        });
        if (pendingVersion) {
            this.emitEvent({
                type: "run-pending-version",
                chatId,
                timestamp: Date.now(),
                source: "start",
            });
        }
        state.publicAccessToken = publicAccessToken;
        state.lastEventId = undefined;
        state.isStreaming = false;
        this.sessions.set(chatId, state);
        this.notifySessionChange(chatId, state);
    }
    /**
     * Open an SSE subscription to the session's `.out` stream and pipe
     * UIMessageChunks through to the AI SDK. Trigger control records
     * (`turn-complete`, `upgrade-required` — see `trigger-control` header
     * on `client-protocol.mdx#records-on-session-out`) are routed by
     * header and never reach the consumer. `upgrade-required` is purely
     * telemetry now since the server handles the run swap inline (see
     * `end-and-continue`).
     */
    subscribeToSessionStream(state, abortSignal, chatId, options) {
        const internalAbort = new AbortController();
        this.activeStreams.set(chatId, internalAbort);
        const combinedSignal = abortSignal
            ? AbortSignal.any([abortSignal, internalAbort.signal])
            : internalAbort.signal;
        if (abortSignal) {
            abortSignal.addEventListener("abort", () => {
                // A late abort (unmount, or the consumer dropping a drained stream)
                // has no turn to stop: don't gate the next one, don't write a stop.
                const outstanding = !state.outstandingTurnAbandoned &&
                    (state.isStreaming || state.activeInputSeq !== undefined);
                if (options?.sendStopOnAbort !== false && outstanding && !internalAbort.signal.aborted) {
                    state.skipToTurnComplete = true;
                    state.supersededInputSeq = state.activeInputSeq;
                    this.appendInputChunk(chatId, state.publicAccessToken, this.serializeInputChunk({ kind: "stop" })).catch(() => { });
                }
                internalAbort.abort();
            }, { once: true });
        }
        const streamUrl = `${this.resolveBaseURL({ endpoint: "out", chatId })}/realtime/v1/sessions/${encodeURIComponent(chatId)}/out`;
        return new ReadableStream({
            start: async (controller) => {
                // Track the live subscription so browser wake events can act
                // on it. Three classes of wake:
                //   - `online`: network came back. Existing connection might
                //     be silently dead; force a fresh one.
                //   - `visibilitychange` → visible after long hidden: tab
                //     was backgrounded long enough that the OS likely killed
                //     the TCP socket. Force reconnect.
                //   - `visibilitychange` → visible after short hidden: cheap
                //     wake of any in-flight backoff.
                //   - `pageshow` with `event.persisted`: bfcache restore
                //     (mobile Safari back/forward, app-switcher resume). The
                //     socket is definitely dead. Force reconnect.
                let currentSubscription = null;
                let hiddenSince = null;
                const FORCE_RECONNECT_AFTER_HIDDEN_MS = 30_000;
                const onVisibilityChange = () => {
                    if (typeof document === "undefined")
                        return;
                    if (document.visibilityState === "hidden") {
                        hiddenSince = Date.now();
                        return;
                    }
                    const wasHiddenForMs = hiddenSince ? Date.now() - hiddenSince : 0;
                    hiddenSince = null;
                    if (wasHiddenForMs >= FORCE_RECONNECT_AFTER_HIDDEN_MS) {
                        currentSubscription?.forceReconnect();
                    }
                    else {
                        currentSubscription?.retryNow();
                    }
                };
                const onPageShow = (event) => {
                    // PageTransitionEvent in browsers; type guard via `persisted`.
                    if (event.persisted) {
                        currentSubscription?.forceReconnect();
                    }
                };
                const onOnline = () => currentSubscription?.forceReconnect();
                const teardownWakeListeners = typeof document !== "undefined" && typeof window !== "undefined"
                    ? (() => {
                        document.addEventListener("visibilitychange", onVisibilityChange);
                        window.addEventListener("online", onOnline);
                        window.addEventListener("pageshow", onPageShow);
                        return () => {
                            document.removeEventListener("visibilitychange", onVisibilityChange);
                            window.removeEventListener("online", onOnline);
                            window.removeEventListener("pageshow", onPageShow);
                        };
                    })()
                    : () => { };
                const sseCtx = { endpoint: "out", chatId };
                const sseFetchClient = this.sseFetchClient(sseCtx);
                let sawFirstChunk = false;
                let sinceInSeq = options?.sinceInSeq;
                const connectSseOnce = async (token) => {
                    const subscription = new v3_1.SSEStreamSubscription(streamUrl, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            ...this.extraHeaders,
                            ...(options?.peekSettled ? { "X-Peek-Settled": "1" } : {}),
                        },
                        signal: combinedSignal,
                        timeoutInSeconds: this.streamTimeoutSeconds,
                        lastEventId: state.lastEventId,
                        // Catch silent-dead-socket: if no chunk (or server
                        // keepalive) arrives in 60s, force reconnect. Sized
                        // generously over typical agent thinking pauses.
                        stallTimeoutMs: 60_000,
                        fetchClient: sseFetchClient,
                    });
                    currentSubscription = subscription;
                    const sseStream = await subscription.subscribe();
                    const reader = sseStream.getReader();
                    try {
                        const first = await reader.read();
                        if (first.done) {
                            reader.releaseLock();
                            return null;
                        }
                        return { reader, primed: first.value, subscription };
                    }
                    catch (readErr) {
                        reader.releaseLock();
                        throw readErr;
                    }
                };
                const openWithAuthRetry = async () => {
                    try {
                        return await connectSseOnce(state.publicAccessToken);
                    }
                    catch (e) {
                        if (!isAuthError(e))
                            throw e;
                        const fresh = await this.resolveAccessToken({ chatId });
                        state.publicAccessToken = fresh;
                        this.notifySessionChange(chatId, state);
                        return await connectSseOnce(fresh);
                    }
                };
                let eofResubscribes = 0;
                const resumeAfterEof = async () => {
                    // Watch mode is a standing subscription: it outlives turn-complete
                    // (which clears `isStreaming`) and idle windows EOF by design, so the
                    // give-up budget doesn't apply. Only abort or a settled session ends it.
                    while ((this.watchMode || (state.isStreaming && eofResubscribes < ai_shared_js_1.MAX_EOF_RESUBSCRIBES)) &&
                        !currentSubscription?.sessionSettled &&
                        !combinedSignal.aborted) {
                        eofResubscribes++;
                        await (0, ai_shared_js_1.waitBeforeEofResubscribe)(eofResubscribes, combinedSignal);
                        if (combinedSignal.aborted)
                            break;
                        const opened = await openWithAuthRetry();
                        if (opened)
                            return opened;
                    }
                    // A settled session or an abort ends the turn cleanly. Exhausting the
                    // resubscribe budget while the turn is still streaming means it was cut
                    // off — surface an error so the UI doesn't read a truncated reply as
                    // complete. The caller's catch emits stream-error and errors the stream.
                    if (state.isStreaming &&
                        !currentSubscription?.sessionSettled &&
                        !combinedSignal.aborted) {
                        // Clear + persist before throwing so the surfaced error leaves
                        // consistent state — otherwise a reload sees isStreaming: true
                        // and reopens a doomed subscription.
                        state.isStreaming = false;
                        this.notifySessionChange(chatId, state);
                        throw new Error("Chat stream ended before the turn completed (reconnect budget exhausted).");
                    }
                    // Settled close, or the turn is gone — tell the UI instead of
                    // leaving it spinning on a stream nobody will finish.
                    if (state.isStreaming) {
                        state.isStreaming = false;
                        this.notifySessionChange(chatId, state);
                    }
                    return null;
                };
                try {
                    let reader;
                    let primed;
                    const opened = (await openWithAuthRetry()) ?? (await resumeAfterEof());
                    if (opened === null) {
                        try {
                            controller.close();
                        }
                        catch {
                            /* already closed by a consumer cancel */
                        }
                        return;
                    }
                    reader = opened.reader;
                    primed = opened.primed;
                    this.emitEvent({
                        type: "stream-connected",
                        chatId,
                        timestamp: Date.now(),
                        resumed: options?.resumed ?? false,
                        lastEventId: state.lastEventId,
                        messageId: this.lastTurnSends.get(chatId)?.messageId,
                    });
                    while (true) {
                        let value;
                        if (primed !== undefined) {
                            value = primed;
                            primed = undefined;
                        }
                        else {
                            const next = await reader.read();
                            if (next.done) {
                                const resumed = await resumeAfterEof();
                                if (resumed === null) {
                                    try {
                                        controller.close();
                                    }
                                    catch {
                                        /* already closed by a consumer cancel */
                                    }
                                    return;
                                }
                                reader = resumed.reader;
                                primed = resumed.primed;
                                continue;
                            }
                            value = next.value;
                        }
                        if (combinedSignal.aborted) {
                            internalAbort.abort();
                            await reader.cancel();
                            try {
                                controller.close();
                            }
                            catch {
                                /* already closed by a consumer cancel */
                            }
                            return;
                        }
                        if (value.id)
                            state.lastEventId = value.id;
                        // Any record — including the first of a resumed connection, which
                        // arrives via `primed` — re-earns the resubscribe budget, so a long
                        // turn spanning many long-poll windows keeps streaming.
                        eofResubscribes = 0;
                        // Trigger control record (turn-complete, upgrade-required) —
                        // routed by header, body is empty. Detect via the
                        // `trigger-control` header on the SSE record. Data records
                        // (UIMessageChunks) fall through to the chunk path below.
                        //
                        // Cross-version bridge: a customer who redeploys their
                        // Next.js app (new browser SDK) before their next
                        // `trigger deploy` (old agent SDK still writing turn-complete
                        // / upgrade-required as `chunk.type` data records) would
                        // otherwise hang. Fall back to the legacy chunk-type form
                        // when no header is present so the deploy-skew window
                        // closes turns correctly.
                        let controlValue = (0, v3_1.controlSubtype)(value.headers);
                        let legacyChunk;
                        if (!controlValue && value.chunk && typeof value.chunk === "object") {
                            const chunk = value.chunk;
                            if (chunk.type === "trigger:turn-complete") {
                                controlValue = v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE;
                                legacyChunk = chunk;
                            }
                            else if (chunk.type === "trigger:upgrade-required") {
                                controlValue = v3_1.TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED;
                            }
                            else if (typeof chunk.type === "string" && chunk.type.startsWith("trigger:")) {
                                // Future / unknown `trigger:*` legacy control type from
                                // a pre-upgrade agent — drop so it doesn't reach the AI
                                // SDK as an unrecognised UIMessageChunk.
                                continue;
                            }
                        }
                        if (state.skipToTurnComplete &&
                            controlValue !== v3_1.TRIGGER_CONTROL_SUBTYPE.SESSION_CLOSED &&
                            controlValue !== v3_1.TRIGGER_CONTROL_SUBTYPE.PENDING_VERSION) {
                            // Fall through on a boundary so the `sinceInSeq` check and the
                            // turn-completed emit below still run; content records are skipped.
                            // A close is terminal and a pending version is the gated turn's own
                            // handover status, so neither is ever gated away.
                            if (controlValue !== v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE)
                                continue;
                            // A boundary older than the superseded turn is not its boundary —
                            // keep gating. A header-less boundary (legacy wire) still clears.
                            const gateCursorRaw = (0, v3_1.headerValue)(value.headers, v3_1.SESSION_IN_EVENT_ID_HEADER);
                            const gateCursor = gateCursorRaw !== undefined ? Number.parseInt(gateCursorRaw, 10) : NaN;
                            if (state.supersededInputSeq !== undefined &&
                                !Number.isNaN(gateCursor) &&
                                gateCursor < state.supersededInputSeq) {
                                continue;
                            }
                            state.skipToTurnComplete = false;
                            state.supersededInputSeq = undefined;
                            // This boundary is the new turn's own, so the gate swallowed its
                            // output: fail the turn instead of completing an empty answer, and
                            // leave nothing armed for the retry.
                            if (sinceInSeq !== undefined &&
                                !Number.isNaN(gateCursor) &&
                                gateCursor >= sinceInSeq) {
                                // The lost boundary may also carry the session close.
                                if ((0, v3_1.headerValue)(value.headers, v3_1.SESSION_CLOSED_HEADER) === "true") {
                                    this.markSessionClosed(chatId, state, (0, v3_1.headerValue)(value.headers, v3_1.SESSION_CLOSED_REASON_HEADER), "stream");
                                }
                                state.activeInputSeq = undefined;
                                state.isStreaming = false;
                                this.notifySessionChange(chatId, state);
                                throw new Error("The previous turn's output was lost. Try again.");
                            }
                        }
                        if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED) {
                            // Server has already triggered the new run via
                            // `end-and-continue`; the next chunks on this same `.out`
                            // stream come from v2. Filter the marker for cleanliness
                            // and keep reading.
                            continue;
                        }
                        if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.SESSION_CLOSED) {
                            this.markSessionClosed(chatId, state, (0, v3_1.headerValue)(value.headers, v3_1.SESSION_CLOSED_REASON_HEADER), "stream");
                            internalAbort.abort();
                            try {
                                controller.close();
                            }
                            catch {
                                /* already closed */
                            }
                            return;
                        }
                        if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.PENDING_VERSION) {
                            this.emitEvent({
                                type: "run-pending-version",
                                chatId,
                                timestamp: Date.now(),
                                source: "upgrade",
                            });
                            continue;
                        }
                        if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE) {
                            // Skip a turn-complete from an earlier turn (committed `.in` cursor
                            // below this send's seq), e.g. an undo action that raced this send.
                            if (sinceInSeq !== undefined) {
                                const cursorRaw = (0, v3_1.headerValue)(value.headers, v3_1.SESSION_IN_EVENT_ID_HEADER);
                                const cursor = cursorRaw !== undefined ? Number.parseInt(cursorRaw, 10) : NaN;
                                if (!Number.isNaN(cursor) && cursor < sinceInSeq) {
                                    continue;
                                }
                            }
                            // A close decided during this turn rides out on turn-complete —
                            // the last record a reader sees before it ends the stream.
                            if ((0, v3_1.headerValue)(value.headers, v3_1.SESSION_CLOSED_HEADER) === "true") {
                                this.markSessionClosed(chatId, state, (0, v3_1.headerValue)(value.headers, v3_1.SESSION_CLOSED_REASON_HEADER), "stream");
                            }
                            const refreshedToken = (0, v3_1.headerValue)(value.headers, v3_1.PUBLIC_ACCESS_TOKEN_HEADER) ??
                                legacyChunk?.publicAccessToken;
                            if (refreshedToken) {
                                state.publicAccessToken = refreshedToken;
                            }
                            this.emitEvent({
                                type: "turn-completed",
                                chatId,
                                timestamp: Date.now(),
                                lastEventId: state.lastEventId,
                                sessionInEventId: (0, v3_1.headerValue)(value.headers, v3_1.SESSION_IN_EVENT_ID_HEADER),
                                ...this.turnAttribution(chatId),
                            });
                            state.activeInputSeq = undefined;
                            sinceInSeq = undefined;
                            state.isStreaming = false;
                            this.notifySessionChange(chatId, state);
                            this.coordinator?.release(chatId);
                            this.coordinator?.broadcastSession(chatId, {
                                lastEventId: state.lastEventId,
                            });
                            // Re-arm per-turn events for watch mode's next turn.
                            sawFirstChunk = false;
                            if (this.watchMode)
                                continue;
                            internalAbort.abort();
                            try {
                                controller.close();
                            }
                            catch {
                                /* already closed */
                            }
                            return;
                        }
                        // Data record — `value.chunk` is the parsed UIMessageChunk
                        // unwrapped from the S2 record envelope (the parser does the
                        // JSON unwrap). Drop empty/malformed payloads defensively.
                        if (value.chunk == null)
                            continue;
                        if (!sawFirstChunk) {
                            sawFirstChunk = true;
                            this.emitEvent({
                                type: "first-chunk",
                                chatId,
                                timestamp: Date.now(),
                                chunkType: value.chunk.type,
                                lastEventId: value.id || undefined,
                                ...this.turnAttribution(chatId),
                            });
                        }
                        controller.enqueue(value.chunk);
                    }
                }
                catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        try {
                            controller.close();
                        }
                        catch {
                            /* already closed */
                        }
                        return;
                    }
                    const errorStatus = error.status;
                    this.emitEvent({
                        type: "stream-error",
                        chatId,
                        timestamp: Date.now(),
                        error: error instanceof Error ? error : new Error(String(error)),
                        status: typeof errorStatus === "number" ? errorStatus : undefined,
                    });
                    controller.error(error);
                }
                finally {
                    teardownWakeListeners();
                    // Only clear the entry (and drop the tab claim) if it is still
                    // ours — a superseding send registers its controller before this
                    // teardown runs, and owns the claim from then on.
                    if (this.activeStreams.get(chatId) === internalAbort) {
                        this.activeStreams.delete(chatId);
                        this.coordinator?.release(chatId);
                    }
                }
            },
            // A consumer that stops reading without aborting (drops the reader)
            // would otherwise leave the resubscribe loop running forever.
            cancel() {
                internalAbort.abort();
            },
        });
    }
}
exports.TriggerChatTransport = TriggerChatTransport;
/**
 * Convenience constructor matching {@link TriggerChatTransport}.
 */
function createChatTransport(options) {
    return new TriggerChatTransport(options);
}
// Server-side agent chat re-exports.
var chat_client_js_1 = require("./chat-client.js");
Object.defineProperty(exports, "AgentChat", { enumerable: true, get: function () { return chat_client_js_1.AgentChat; } });
Object.defineProperty(exports, "ChatStream", { enumerable: true, get: function () { return chat_client_js_1.ChatStream; } });
//# sourceMappingURL=chat.js.map