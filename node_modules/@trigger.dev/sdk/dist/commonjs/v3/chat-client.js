"use strict";
/**
 * Server-side API for chatting with Trigger.dev agents.
 *
 * @example
 * ```ts
 * import { AgentChat } from "@trigger.dev/sdk/chat";
 *
 * const chat = new AgentChat<typeof myAgent>({
 *   agent: "my-agent",
 *   clientData: { userId: "user_123" },
 * });
 *
 * const stream = await chat.sendMessage("Review PR #1");
 * const text = await stream.text();
 * await chat.close();
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentChat = exports.ChatStream = void 0;
// `readUIMessageStream` is a runtime value — via the ESM/CJS shim so the CJS
// build can `require` ESM-only `ai@7` (see ../imports/ai-runtime.ts).
const ai_runtime_js_1 = require("../imports/ai-runtime.js");
const v3_1 = require("@trigger.dev/core/v3");
const ai_shared_js_1 = require("./ai-shared.js");
const sessions_js_1 = require("./sessions.js");
/**
 * A single turn's response stream from an agent.
 *
 * Pick one consumption mode:
 * - `for await (const chunk of stream)` — typed UIMessageChunk iteration
 * - `await stream.result()` — accumulated `{ text, toolCalls, toolResults }`
 * - `await stream.text()` — just the text
 * - `yield* stream.messages()` — sub-agent pattern (yields UIMessage snapshots)
 */
class ChatStream {
    _consumerStream;
    _messageCollector;
    resultPromise;
    /** @internal Last UIMessage snapshot from the assistant's response. */
    lastAssistantMessage;
    /** @internal Callback to capture the assistant's response message for accumulation. */
    onAssistantMessage;
    constructor(stream, onAssistantMessage) {
        this.onAssistantMessage = onAssistantMessage;
        if (onAssistantMessage) {
            // Tee the stream: one branch for the consumer, one for message collection
            const [consumer, collector] = stream.tee();
            this._consumerStream = consumer;
            this._messageCollector = (async () => {
                for await (const msg of (0, ai_runtime_js_1.readUIMessageStream)({ stream: collector })) {
                    this.lastAssistantMessage = msg;
                }
                if (this.lastAssistantMessage) {
                    onAssistantMessage(this.lastAssistantMessage);
                }
            })();
        }
        else {
            this._consumerStream = stream;
        }
    }
    /** The raw ReadableStream for direct use with AI SDK utilities. */
    get stream() {
        return this._consumerStream;
    }
    async *[Symbol.asyncIterator]() {
        const reader = this._consumerStream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                yield value;
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    /**
     * Yields accumulated UIMessage snapshots for the sub-agent tool pattern.
     *
     * @example
     * ```ts
     * const stream = await chat.sendMessage("Research this topic");
     * yield* stream.messages();
     * ```
     */
    async *messages() {
        for await (const message of (0, ai_runtime_js_1.readUIMessageStream)({ stream: this._consumerStream })) {
            this.lastAssistantMessage = message;
            yield message;
        }
        // When the constructor set up `_messageCollector` (because
        // `onAssistantMessage` was provided), that collector IIFE owns
        // firing the callback. Skipping it here prevents a double-invoke.
        if (this.lastAssistantMessage && this.onAssistantMessage && !this._messageCollector) {
            this.onAssistantMessage(this.lastAssistantMessage);
        }
    }
    /** Consume the stream and return the accumulated result. */
    result() {
        if (!this.resultPromise) {
            this.resultPromise = this.consumeStream();
        }
        return this.resultPromise;
    }
    /** Consume the stream and return just the text. */
    async text() {
        return (await this.result()).text;
    }
    async consumeStream() {
        let text = "";
        const toolCalls = [];
        const toolResults = [];
        for await (const chunk of this) {
            if (chunk.type === "text-delta") {
                text += chunk.delta;
            }
            else if (chunk.type === "tool-input-available") {
                toolCalls.push({
                    toolName: chunk.toolName,
                    toolCallId: chunk.toolCallId,
                    input: chunk.input,
                });
            }
            else if (chunk.type === "tool-output-available") {
                toolResults.push({
                    toolCallId: chunk.toolCallId,
                    output: chunk.output,
                });
            }
        }
        return { text, toolCalls, toolResults };
    }
}
exports.ChatStream = ChatStream;
// ─── AgentChat ─────────────────────────────────────────────────────
/**
 * A chat conversation with a Trigger.dev agent.
 *
 * @example
 * ```ts
 * // Simple usage
 * const chat = new AgentChat<typeof myAgent>({ agent: "my-agent" });
 * const text = await (await chat.sendMessage("Hello")).text();
 * await chat.close();
 *
 * // Stateless request handler — persist and restore session
 * const chat = new AgentChat<typeof myAgent>({
 *   agent: "my-agent",
 *   id: chatId,
 *   session: { lastEventId: savedLastEventId },
 *   onTriggered: ({ runId }) => db.save(chatId, { runId }),
 *   onTurnComplete: ({ lastEventId }) => db.update(chatId, { lastEventId }),
 * });
 * ```
 */
class AgentChat {
    taskId;
    chatId;
    streamTimeoutSeconds;
    clientData;
    triggerConfigDefault;
    onTriggered;
    onTurnComplete;
    baseURLResolver;
    fetchOverride;
    state;
    /**
     * Which subscription armed `skipToTurnComplete`, so only that stream ends at
     * the gated boundary. A later stream reads the same boundary as stale history
     * and keeps reading to its own turn. Deliberately not in `state`: a stop does
     * not outlive the process that issued it.
     */
    streamSeq = 0;
    stoppedStreamId;
    constructor(options) {
        this.taskId = options.agent;
        this.chatId = options.id ?? crypto.randomUUID();
        this.streamTimeoutSeconds = options.streamTimeoutSeconds ?? 120;
        this.clientData = options.clientData;
        this.triggerConfigDefault = options.triggerConfig;
        this.onTriggered = options.onTriggered;
        this.onTurnComplete = options.onTurnComplete;
        const baseURLOption = options.baseURL;
        this.baseURLResolver =
            typeof baseURLOption === "function"
                ? baseURLOption
                : () => baseURLOption ?? v3_1.apiClientManager.baseURL ?? "https://api.trigger.dev";
        this.fetchOverride = options.fetch;
        // Hydration: a non-empty `session` means the caller knows the
        // session already exists (started in a previous request). Mark
        // `started` so we don't re-`sessions.start()` on first message.
        const hydrated = !!options.session;
        this.state = {
            lastEventId: options.session?.lastEventId,
            started: hydrated,
            pinRefreshed: !hydrated,
        };
    }
    /** The conversation ID. */
    get id() {
        return this.chatId;
    }
    /** Persistable session state — pass back via `options.session` to resume. */
    get session() {
        return { lastEventId: this.state.lastEventId };
    }
    /**
     * Eagerly start the session — creates the row and triggers the first
     * run. The agent's `onPreload` hook fires immediately. Idempotent: a
     * second call is a no-op.
     */
    async preload(options) {
        await this.ensureStarted({ idleTimeoutInSeconds: options?.idleTimeoutInSeconds });
        return this.session;
    }
    /**
     * Send a text message and get the response stream.
     *
     * @example
     * ```ts
     * const stream = await chat.sendMessage("Review PR #1");
     * const text = await stream.text();
     * ```
     */
    async sendMessage(text, options) {
        const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const message = {
            id: msgId,
            role: "user",
            parts: [{ type: "text", text }],
        };
        const rawStream = await this.sendRaw([message], { abortSignal: options?.abortSignal });
        return new ChatStream(rawStream);
    }
    /** Send raw UIMessage-like objects. Use `sendMessage()` for simple text. */
    async sendRaw(messages, options) {
        const triggerType = options?.trigger ?? "submit-message";
        // Make sure the session exists (and a run is alive). The .in/append
        // handler on the server probes currentRunId on every call and
        // re-triggers if needed — so we don't need to track runId here.
        await this.ensureStarted();
        // Slim wire — at most ONE message per record. The agent rebuilds prior
        // history from its durable S3 snapshot + session.out replay at run
        // boot (or `hydrateMessages` if registered).
        //
        // For `submit-message`, assistant messages carrying resolved tool parts
        // (HITL `addToolOutput` answers) are slimmed to just the resolution
        // payload — reasoning blobs, text, and tool `input` come from the
        // agent's authoritative chain. `regenerate-message` omits `message`.
        if (triggerType === "submit-message" && messages.length === 0) {
            throw new Error("AgentChat.sendRaw: 'submit-message' trigger requires at least one message");
        }
        const lastIfSubmit = triggerType === "submit-message"
            ? (0, ai_shared_js_1.slimSubmitMessageForWire)(messages.at(-1))
            : undefined;
        const payload = {
            ...(lastIfSubmit ? { message: lastIfSubmit } : {}),
            chatId: this.chatId,
            trigger: triggerType,
            metadata: this.clientData,
        };
        await this.appendInputChunk(serializeInputChunk({ kind: "message", payload }));
        return this.subscribeToSessionStream(options?.abortSignal, { resumeAfterEof: true });
    }
    /** Send a steering message during an active stream. */
    async steer(text) {
        if (!this.state.started)
            return false;
        const payload = {
            message: {
                id: `steer-${Date.now()}`,
                role: "user",
                parts: [{ type: "text", text }],
            },
            chatId: this.chatId,
            trigger: "submit-message",
            metadata: this.clientData,
        };
        try {
            await this.appendInputChunk(serializeInputChunk({ kind: "message", payload }));
            return true;
        }
        catch {
            return false;
        }
    }
    /** Stop the current generation (agent stays alive for next turn). */
    async stop() {
        if (!this.state.started)
            return;
        this.state.skipToTurnComplete = true;
        this.stoppedStreamId = this.streamSeq;
        await this.appendInputChunk(serializeInputChunk({ kind: "stop" })).catch(() => { });
    }
    /**
     * Hand over from a `chat.handover` route handler to a parked
     * `handover-prepare` agent run. Wakes the run, which seeds its
     * accumulators with `partialAssistantMessage` and continues from
     * tool execution onward — the model call for step 1 is skipped.
     *
     * Used internally by `chat.handover`; not part of the customer
     * surface.
     */
    async sendHandover(args) {
        await this.appendInputChunk(serializeInputChunk({
            kind: "handover",
            partialAssistantMessage: args.partialAssistantMessage,
            messageId: args.messageId,
            isFinal: args.isFinal,
        }));
    }
    /**
     * Tell a parked `handover-prepare` agent run that the customer's
     * first turn finished pure-text (no tool calls) — the run exits
     * cleanly without making an LLM call.
     *
     * Used internally by `chat.handover`; not part of the customer
     * surface.
     */
    async sendHandoverSkip() {
        await this.appendInputChunk(serializeInputChunk({ kind: "handover-skip" }));
    }
    /**
     * Send a custom action to the agent.
     *
     * Actions are not turns. They wake the agent, fire `hydrateMessages`
     * (if configured) and `onAction` only — no `onTurnStart` /
     * `prepareMessages` / `onBeforeTurnComplete` / `onTurnComplete`, no
     * `run()` invocation.
     *
     * The action payload is validated against the agent's `actionSchema`
     * on the backend. Use `chat.history.*` inside `onAction` to mutate
     * state. To produce a model response from the action, return a
     * `StreamTextResult` (or `string` / `UIMessage`) from `onAction` —
     * the returned stream is auto-piped over this stream. When `onAction`
     * returns `void`, the action is side-effect-only and the returned
     * stream completes immediately with `trigger:turn-complete`.
     *
     * @returns A `ChatStream`. For void actions the stream completes
     * immediately. For actions that return a model response, the stream
     * carries the assistant chunks.
     *
     * @example
     * ```ts
     * const stream = await agentChat.sendAction({ type: "undo" });
     * for await (const chunk of stream) {
     *   if (chunk.type === "text-delta") process.stdout.write(chunk.delta);
     * }
     * ```
     */
    async sendAction(action, options) {
        await this.ensureStarted();
        const payload = {
            chatId: this.chatId,
            trigger: "action",
            action,
            metadata: this.clientData,
        };
        try {
            await this.appendInputChunk(serializeInputChunk({ kind: "message", payload }));
        }
        catch {
            throw new Error("Failed to send action. The session may have ended.");
        }
        const rawStream = this.subscribeToSessionStream(options?.abortSignal, {
            resumeAfterEof: true,
        });
        return new ChatStream(rawStream);
    }
    /** Close the conversation — agent exits its loop gracefully. */
    async close() {
        if (!this.state.started)
            return false;
        try {
            await this.appendInputChunk(serializeInputChunk({
                kind: "message",
                payload: {
                    chatId: this.chatId,
                    trigger: "close",
                },
            }));
            this.state = { ...this.state, started: false };
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Reconnect to the response stream to resume an already-established session
     * after a disconnect. Requests the caught-up settle probe (`X-Peek-Settled`)
     * so a resumed stream already at a turn-complete tail closes promptly instead
     * of holding the full SSE window, mirroring the browser transport's
     * `reconnectToStream`.
     *
     * Do not call this immediately after `sendMessage()` to read a fresh turn: the
     * settle probe can race the newly-triggered turn's first record, see the prior
     * turn's `turn-complete` tail, and hand back an empty stream (unlike the
     * browser transport, there is no auto-resubscribe). `sendMessage()` already
     * returns the turn's stream; use `reconnect()` only to resume an idle or
     * mid-turn stream.
     */
    async reconnect(abortSignal) {
        if (!this.state.started)
            return null;
        return this.subscribeToSessionStream(abortSignal, {
            sendStopOnAbort: false,
            peekSettled: true,
        });
    }
    // ─── Private ───────────────────────────────────────────────────
    resolveBaseURL(endpoint) {
        return this.baseURLResolver({ endpoint, chatId: this.chatId }).replace(/\/$/, "");
    }
    async doFetch(ctx, url, init) {
        return this.fetchOverride ? this.fetchOverride(url, init, ctx) : fetch(url, init);
    }
    async appendInputChunk(body) {
        const accessToken = v3_1.apiClientManager.accessToken ?? "";
        const ctx = { endpoint: "in", chatId: this.chatId };
        const url = `${this.resolveBaseURL("in")}/realtime/v1/sessions/${encodeURIComponent(this.chatId)}/in/append`;
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "x-trigger-source": "sdk",
            // Idempotency key: the server skips appends whose part id it has
            // already committed, so a retried POST can't duplicate the record.
            "X-Part-Id": crypto.randomUUID(),
        };
        // Preview-env sessions are branch-scoped, so the realtime in/out calls must
        // carry the branch the session was created on. sessions.start sends it via
        // the API client; these raw fetches have to set it themselves.
        const branch = v3_1.apiClientManager.branchName;
        if (branch)
            headers["x-trigger-branch"] = branch;
        const response = await this.doFetch(ctx, url, { method: "POST", headers, body });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            // Match the error shape that ApiClient/zodfetch produced before the
            // inline-POST refactor so callers inspecting `error.name ===
            // "TriggerApiError"` or `error.status` keep working.
            const err = new Error(`appendToSessionStream failed: ${response.status} ${text}`);
            err.name = "TriggerApiError";
            err.status = response.status;
            throw err;
        }
    }
    /**
     * Idempotent: `sessions.start` upserts on `(env, externalId)`. Two
     * concurrent AgentChat instances on the same chatId converge to the
     * same session.
     */
    async ensureStarted(options) {
        if (this.state.started && this.state.pinRefreshed)
            return;
        const idleTimeoutInSeconds = options?.idleTimeoutInSeconds ?? this.triggerConfigDefault?.idleTimeoutInSeconds;
        const triggerConfig = {
            basePayload: {
                // `trigger: "preload"` mirrors the browser-mediated
                // `chat.createStartSessionAction` shape so the agent runtime fires
                // `onPreload` (not `onChatStart` with `preloaded: true`). Without
                // this, AgentChat's first run skips both preload and start hooks,
                // which is where customer apps typically upsert their Chat row.
                // Slim wire — preload carries no message body.
                trigger: "preload",
                ...(this.triggerConfigDefault?.basePayload ?? {}),
                chatId: this.chatId,
                ...(this.clientData ? { metadata: this.clientData } : {}),
            },
            ...(this.triggerConfigDefault?.machine ? { machine: this.triggerConfigDefault.machine } : {}),
            ...(this.triggerConfigDefault?.queue ? { queue: this.triggerConfigDefault.queue } : {}),
            tags: (0, ai_shared_js_1.chatRunTags)(this.chatId, this.triggerConfigDefault?.tags),
            ...(this.triggerConfigDefault?.maxAttempts !== undefined
                ? { maxAttempts: this.triggerConfigDefault.maxAttempts }
                : {}),
            ...(this.triggerConfigDefault?.maxDuration !== undefined
                ? { maxDuration: this.triggerConfigDefault.maxDuration }
                : {}),
            ...(this.triggerConfigDefault?.region ? { region: this.triggerConfigDefault.region } : {}),
            ...(this.triggerConfigDefault?.lockToVersion
                ? { lockToVersion: this.triggerConfigDefault.lockToVersion }
                : {}),
            ...(this.triggerConfigDefault?.ttl !== undefined
                ? { ttl: this.triggerConfigDefault.ttl }
                : {}),
            // Not truthiness: `null` opts out and must reach the resolver in `sessions.start`.
            ...(this.triggerConfigDefault?.externalDeploymentId !== undefined
                ? { externalDeploymentId: this.triggerConfigDefault.externalDeploymentId }
                : {}),
            ...(idleTimeoutInSeconds !== undefined ? { idleTimeoutInSeconds } : {}),
        };
        const created = await sessions_js_1.sessions.start({
            type: "chat.agent",
            externalId: this.chatId,
            taskIdentifier: this.taskId,
            triggerConfig,
        });
        const wasInitialStart = !this.state.started;
        this.state.started = true;
        this.state.pinRefreshed = true;
        // `onTriggered` is documented as the initial start, so a restored session
        // refreshing its config does not fire it: the caller handed us that
        // session, and a hook that writes a row would write it again on every
        // request that rehydrates the conversation.
        if (wasInitialStart) {
            await this.onTriggered?.({
                runId: created.runId,
                chatId: this.chatId,
            });
        }
    }
    subscribeToSessionStream(abortSignal, options) {
        const state = this.state;
        const streamId = ++this.streamSeq;
        // A stop was outstanding when I subscribed and it isn't mine: my window
        // replays the stopped turn's tail, so I drop records up to and including
        // its boundary. Captured per subscription — the stopped stream is still
        // live and may consume the shared seed before I reach that record.
        let skipStaleBoundary = state.skipToTurnComplete === true && this.stoppedStreamId !== streamId;
        const accessToken = v3_1.apiClientManager.accessToken ?? "";
        const onTurnComplete = this.onTurnComplete;
        const chatId = this.chatId;
        const sseCtx = { endpoint: "out", chatId };
        const fetchOverride = this.fetchOverride;
        const sseFetchClient = fetchOverride
            ? ((input, init) => {
                if (typeof input === "string") {
                    return fetchOverride(input, init ?? {}, sseCtx);
                }
                if (input instanceof URL) {
                    return fetchOverride(input.toString(), init ?? {}, sseCtx);
                }
                // Request — preserve its url + intrinsic init, let any provided
                // init override on top (matches fetch(Request, init) semantics).
                return fetchOverride(input.url, {
                    method: input.method,
                    headers: input.headers,
                    signal: input.signal,
                    ...(init ?? {}),
                }, sseCtx);
            })
            : undefined;
        const internalAbort = new AbortController();
        const combinedSignal = abortSignal
            ? AbortSignal.any([abortSignal, internalAbort.signal])
            : internalAbort.signal;
        // Detached once the stream ends (see the `finally` below): a caller reusing
        // one signal across turns would otherwise stack listeners, and a late abort
        // would post a stop that gates the next turn.
        const onExternalAbort = () => {
            if (options?.sendStopOnAbort !== false) {
                state.skipToTurnComplete = true;
                this.stoppedStreamId = streamId;
                this.appendInputChunk(serializeInputChunk({ kind: "stop" })).catch(() => { });
            }
            internalAbort.abort();
        };
        abortSignal?.addEventListener("abort", onExternalAbort, { once: true });
        const streamUrl = `${this.resolveBaseURL("out")}/realtime/v1/sessions/${encodeURIComponent(chatId)}/out`;
        return new ReadableStream({
            start: async (controller) => {
                let eofResubscribes = 0;
                let sawLiveTurn = false;
                const closeController = () => {
                    try {
                        controller.close();
                    }
                    catch {
                        // Controller may already be closed
                    }
                };
                const openSubscription = () => new v3_1.SSEStreamSubscription(streamUrl, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        // Preview-env sessions are branch-scoped (see appendInputChunk).
                        ...(v3_1.apiClientManager.branchName
                            ? { "x-trigger-branch": v3_1.apiClientManager.branchName }
                            : {}),
                        ...(options?.peekSettled ? { "X-Peek-Settled": "1" } : {}),
                    },
                    signal: combinedSignal,
                    timeoutInSeconds: this.streamTimeoutSeconds,
                    lastEventId: state.lastEventId,
                    fetchClient: sseFetchClient,
                });
                try {
                    while (true) {
                        const subscription = openSubscription();
                        const sseStream = await subscription.subscribe();
                        const reader = sseStream.getReader();
                        try {
                            while (true) {
                                const next = await reader.read();
                                if (next.done) {
                                    break;
                                }
                                if (combinedSignal.aborted) {
                                    internalAbort.abort();
                                    await reader.cancel();
                                    closeController();
                                    return;
                                }
                                const value = next.value;
                                if (value.id)
                                    state.lastEventId = value.id;
                                // Any record re-earns the resubscribe budget: a clean EOF is
                                // the normal end of every long-poll window, so a long turn
                                // spanning many windows must not exhaust it.
                                eofResubscribes = 0;
                                // Trigger control records (turn-complete, upgrade-required)
                                // route by header — see `client-protocol.mdx`. Their bodies
                                // are empty; everything substantive is on `value.headers`.
                                //
                                // Cross-version bridge: an old agent SDK still writing
                                // turn-complete / upgrade-required as `chunk.type` data
                                // records would otherwise stall this loop. Fall back to
                                // the legacy chunk-type form when no header is present
                                // so the deploy-skew window between an `AgentChat`
                                // consumer and a not-yet-redeployed agent doesn't hang.
                                let controlValue = (0, v3_1.controlSubtype)(value.headers);
                                if (!controlValue && value.chunk && typeof value.chunk === "object") {
                                    const chunk = value.chunk;
                                    if (chunk.type === "trigger:turn-complete") {
                                        controlValue = v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE;
                                    }
                                    else if (chunk.type === "trigger:upgrade-required") {
                                        controlValue = v3_1.TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED;
                                    }
                                    else if (typeof chunk.type === "string" && chunk.type.startsWith("trigger:")) {
                                        // Future / unknown `trigger:*` legacy control type —
                                        // drop so it doesn't leak as a UIMessageChunk.
                                        continue;
                                    }
                                }
                                // Stale tail of a turn someone else stopped: swallow it and
                                // keep reading to my own turn.
                                if (skipStaleBoundary) {
                                    if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE) {
                                        skipStaleBoundary = false;
                                        state.skipToTurnComplete = false;
                                    }
                                    continue;
                                }
                                // I am the stopped stream, so this turn is over at its
                                // boundary: close rather than resume into windows it will
                                // never fill. Keyed on the id alone, so it holds however far
                                // the follow-up subscription has got.
                                if (this.stoppedStreamId === streamId) {
                                    if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE) {
                                        state.skipToTurnComplete = false;
                                        this.stoppedStreamId = undefined;
                                        internalAbort.abort();
                                        closeController();
                                        return;
                                    }
                                    continue;
                                }
                                // Both handover markers mean the turn carries on in a
                                // successor run, so they count as a live turn: its chunks
                                // may only arrive in a later window.
                                if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.UPGRADE_REQUIRED) {
                                    // Server has already triggered the new run via
                                    // `end-and-continue`; v2's chunks arrive on the same
                                    // S2 stream. Filter the marker for cleanliness and
                                    // keep reading.
                                    sawLiveTurn = true;
                                    continue;
                                }
                                if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.PENDING_VERSION) {
                                    sawLiveTurn = true;
                                    continue;
                                }
                                // A standalone session-closed record is written after
                                // turn-complete, so only a reconnect ever reads it. The
                                // conversation is over: end the stream, no stop, no error.
                                if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.SESSION_CLOSED) {
                                    internalAbort.abort();
                                    closeController();
                                    return;
                                }
                                if (controlValue === v3_1.TRIGGER_CONTROL_SUBTYPE.TURN_COMPLETE) {
                                    // Customer's callback may be async (e.g. persisting
                                    // lastEventId to a DB). Wrap so a rejected Promise
                                    // doesn't surface as an unhandled rejection — that
                                    // would crash Node under `--unhandled-rejections=throw`.
                                    Promise.resolve(onTurnComplete?.({
                                        chatId,
                                        lastEventId: state.lastEventId,
                                    })).catch(() => { });
                                    internalAbort.abort();
                                    closeController();
                                    return;
                                }
                                // Data record — `value.chunk` is the parsed UIMessageChunk
                                // (the SSE parser does the JSON envelope unwrap). Drop
                                // empty/malformed payloads defensively.
                                if (value.chunk == null)
                                    continue;
                                // Parts and the handover markers above are the only evidence of
                                // a live turn. Unknown control records stay neutral: they are no
                                // reason for a reconnect to pin another long-poll window.
                                sawLiveTurn = true;
                                controller.enqueue(value.chunk);
                            }
                        }
                        catch (readError) {
                            reader.releaseLock();
                            throw readError;
                        }
                        reader.releaseLock();
                        // The body ended without a turn-complete. A turn is in flight
                        // either by construction (the send paths) or because records have
                        // already flowed on this stream — so unless the server says the
                        // session settled we lost the window mid-turn, and resubscribing
                        // from the last event id beats truncating the turn. A `reconnect()`
                        // that never saw a record can't tell a live turn from a dead
                        // session, so it closes rather than pin another long-poll window.
                        const turnInFlight = options?.resumeAfterEof || sawLiveTurn;
                        if (!turnInFlight || subscription.sessionSettled || combinedSignal.aborted) {
                            closeController();
                            return;
                        }
                        if (eofResubscribes >= ai_shared_js_1.MAX_EOF_RESUBSCRIBES) {
                            throw new Error("Chat stream ended before the turn completed (reconnect budget exhausted).");
                        }
                        eofResubscribes++;
                        await (0, ai_shared_js_1.waitBeforeEofResubscribe)(eofResubscribes, combinedSignal);
                        if (combinedSignal.aborted) {
                            closeController();
                            return;
                        }
                    }
                }
                catch (error) {
                    if (error instanceof Error && error.name === "AbortError") {
                        closeController();
                        return;
                    }
                    controller.error(error);
                }
                finally {
                    abortSignal?.removeEventListener("abort", onExternalAbort);
                }
            },
            // A consumer that stops reading must also stop the resubscribe loop —
            // otherwise it keeps reopening a subscription nobody is draining.
            cancel: () => {
                internalAbort.abort();
            },
        });
    }
}
exports.AgentChat = AgentChat;
/**
 * Serialize a {@link ChatInputChunk} for `POST …/sessions/:session/:io/append`.
 * Session channel records are raw JSON strings — the server wraps them
 * in `{ data: <body>, id }` for S2 storage and the subscribe side
 * parses the string back for consumers.
 */
function serializeInputChunk(chunk) {
    return JSON.stringify(chunk);
}
//# sourceMappingURL=chat-client.js.map