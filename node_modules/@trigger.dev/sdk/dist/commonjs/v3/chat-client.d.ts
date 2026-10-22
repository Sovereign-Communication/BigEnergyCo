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
import type { Task } from "@trigger.dev/core/v3";
import type { ModelMessage, UIMessage, UIMessageChunk } from "ai";
import type { ChatTaskWirePayload } from "./ai-shared.js";
import { type SessionTriggerConfigInput } from "./sessions.js";
/** Extract the client data (metadata) type from a chat agent task. */
export type InferChatClientData<T> = T extends Task<any, ChatTaskWirePayload<any, infer TMetadata>, any> ? unknown extends TMetadata ? Record<string, unknown> : TMetadata : Record<string, unknown>;
/** Extract the UIMessage type from a chat agent task. */
export type InferChatUIMessage<T> = T extends Task<any, ChatTaskWirePayload<infer TUIMessage, any>, any> ? TUIMessage : UIMessage;
/** Persistable session state — store this to resume across requests. */
export type ChatSession = {
    /** Last SSE event ID seen on `session.out` — used to resume without replay. */
    lastEventId?: string;
};
/**
 * Discriminator passed to per-endpoint `baseURL` and `fetch` callbacks on
 * `AgentChat`. Same shape as the type on `TriggerChatTransport` — these
 * mirror so customers can share a single resolver between the two clients.
 */
type AgentChatEndpoint = "in" | "out";
type AgentChatEndpointContext = {
    endpoint: AgentChatEndpoint;
    chatId: string;
};
type AgentChatBaseURLResolver = (ctx: AgentChatEndpointContext) => string;
type AgentChatFetchOverride = (url: string, init: RequestInit, ctx: AgentChatEndpointContext) => Promise<Response>;
export type AgentChatOptions<TAgent = unknown> = {
    /** The agent task ID to trigger. */
    agent: string;
    /**
     * Conversation ID. Used for tagging runs and correlating messages.
     * @default crypto.randomUUID()
     */
    id?: string;
    /** Client data included in every request. Typed from the agent's clientDataSchema. */
    clientData?: InferChatClientData<TAgent>;
    /**
     * Restore a previous session. Pass `lastEventId` from a previous
     * request to resume the SSE stream without replaying old chunks.
     */
    session?: ChatSession;
    /**
     * Called when a new run is triggered for this session (initial start).
     * Useful for telemetry / dashboard linking. The runId is the
     * friendlyId.
     */
    onTriggered?: (event: {
        runId: string;
        chatId: string;
    }) => void | Promise<void>;
    /**
     * Called when a turn completes. Persist `lastEventId` for stream
     * resumption across requests.
     */
    onTurnComplete?: (event: {
        chatId: string;
        lastEventId?: string;
    }) => void | Promise<void>;
    /** SSE timeout in seconds. @default 120 */
    streamTimeoutSeconds?: number;
    /**
     * Default trigger config used when starting a new session for this
     * chat. Folded into `sessions.start({...triggerConfig})` body.
     */
    triggerConfig?: SessionTriggerConfigInput;
    /**
     * Override the Trigger.dev API base URL for the chat's `.in/append` and
     * `.out` SSE endpoints. String form applies to both; pass a function to
     * pick per endpoint. Defaults to `apiClientManager.baseURL` (whatever
     * `@trigger.dev/sdk` was configured with — typically `TRIGGER_API_URL`
     * env var).
     *
     * Session creation (`POST /api/v1/sessions`) and token mint
     * (`POST /api/v1/auth/jwt/claims`) still flow through
     * `apiClientManager` — pass equivalent options to
     * `chat.createStartSessionAction` if you need those routed too.
     */
    baseURL?: string | AgentChatBaseURLResolver;
    /**
     * Optional per-request fetch override. Receives the resolved URL, the
     * RequestInit, and endpoint context. Use this for header injection
     * (tracing), proxy routing, or custom retries. Applies to both the
     * `.in/append` POSTs and the `.out` SSE GET.
     */
    fetch?: AgentChatFetchOverride;
};
/** Parsed tool call from the stream. */
export type ChatToolCall = {
    toolName: string;
    toolCallId: string;
    input: unknown;
};
/** Parsed tool result from the stream. */
export type ChatToolResult = {
    toolCallId: string;
    output: unknown;
};
/** Accumulated result after a stream completes. */
export type ChatStreamResult = {
    text: string;
    toolCalls: ChatToolCall[];
    toolResults: ChatToolResult[];
};
/**
 * A single turn's response stream from an agent.
 *
 * Pick one consumption mode:
 * - `for await (const chunk of stream)` — typed UIMessageChunk iteration
 * - `await stream.result()` — accumulated `{ text, toolCalls, toolResults }`
 * - `await stream.text()` — just the text
 * - `yield* stream.messages()` — sub-agent pattern (yields UIMessage snapshots)
 */
export declare class ChatStream {
    private readonly _consumerStream;
    private readonly _messageCollector?;
    private resultPromise;
    constructor(stream: ReadableStream<UIMessageChunk>, onAssistantMessage?: (message: UIMessage) => void);
    /** The raw ReadableStream for direct use with AI SDK utilities. */
    get stream(): ReadableStream<UIMessageChunk>;
    [Symbol.asyncIterator](): AsyncIterableIterator<UIMessageChunk>;
    /**
     * Yields accumulated UIMessage snapshots for the sub-agent tool pattern.
     *
     * @example
     * ```ts
     * const stream = await chat.sendMessage("Research this topic");
     * yield* stream.messages();
     * ```
     */
    messages(): AsyncGenerator<UIMessage, void, unknown>;
    /** Consume the stream and return the accumulated result. */
    result(): Promise<ChatStreamResult>;
    /** Consume the stream and return just the text. */
    text(): Promise<string>;
    private consumeStream;
}
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
export declare class AgentChat<TAgent = unknown> {
    private readonly taskId;
    private readonly chatId;
    private readonly streamTimeoutSeconds;
    private readonly clientData;
    private readonly triggerConfigDefault;
    private readonly onTriggered;
    private readonly onTurnComplete;
    private readonly baseURLResolver;
    private readonly fetchOverride;
    private state;
    /**
     * Which subscription armed `skipToTurnComplete`, so only that stream ends at
     * the gated boundary. A later stream reads the same boundary as stale history
     * and keeps reading to its own turn. Deliberately not in `state`: a stop does
     * not outlive the process that issued it.
     */
    private streamSeq;
    private stoppedStreamId;
    constructor(options: AgentChatOptions<TAgent>);
    /** The conversation ID. */
    get id(): string;
    /** Persistable session state — pass back via `options.session` to resume. */
    get session(): ChatSession;
    /**
     * Eagerly start the session — creates the row and triggers the first
     * run. The agent's `onPreload` hook fires immediately. Idempotent: a
     * second call is a no-op.
     */
    preload(options?: {
        idleTimeoutInSeconds?: number;
    }): Promise<ChatSession>;
    /**
     * Send a text message and get the response stream.
     *
     * @example
     * ```ts
     * const stream = await chat.sendMessage("Review PR #1");
     * const text = await stream.text();
     * ```
     */
    sendMessage(text: string, options?: {
        abortSignal?: AbortSignal;
    }): Promise<ChatStream>;
    /** Send raw UIMessage-like objects. Use `sendMessage()` for simple text. */
    sendRaw(messages: UIMessage[] | Array<{
        id: string;
        role: string;
        parts?: unknown[];
        [key: string]: unknown;
    }>, options?: {
        trigger?: "submit-message" | "regenerate-message";
        abortSignal?: AbortSignal;
    }): Promise<ReadableStream<UIMessageChunk>>;
    /** Send a steering message during an active stream. */
    steer(text: string): Promise<boolean>;
    /** Stop the current generation (agent stays alive for next turn). */
    stop(): Promise<void>;
    /**
     * Hand over from a `chat.handover` route handler to a parked
     * `handover-prepare` agent run. Wakes the run, which seeds its
     * accumulators with `partialAssistantMessage` and continues from
     * tool execution onward — the model call for step 1 is skipped.
     *
     * Used internally by `chat.handover`; not part of the customer
     * surface.
     */
    sendHandover(args: {
        partialAssistantMessage: ModelMessage[];
        /**
         * UI messageId from the customer's step-1 stream — propagated to
         * the agent so its post-handover chunks merge into the same
         * assistant message on the browser.
         */
        messageId?: string;
        /**
         * Whether the customer's step 1 is the final response (pure-text
         * finish). When true, the agent runs hooks but skips the LLM
         * call. When false, the agent runs `streamText` which executes
         * pending tool-calls and continues from step 2.
         */
        isFinal: boolean;
    }): Promise<void>;
    /**
     * Tell a parked `handover-prepare` agent run that the customer's
     * first turn finished pure-text (no tool calls) — the run exits
     * cleanly without making an LLM call.
     *
     * Used internally by `chat.handover`; not part of the customer
     * surface.
     */
    sendHandoverSkip(): Promise<void>;
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
    sendAction(action: unknown, options?: {
        abortSignal?: AbortSignal;
    }): Promise<ChatStream>;
    /** Close the conversation — agent exits its loop gracefully. */
    close(): Promise<boolean>;
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
    reconnect(abortSignal?: AbortSignal): Promise<ReadableStream<UIMessageChunk> | null>;
    private resolveBaseURL;
    private doFetch;
    private appendInputChunk;
    /**
     * Idempotent: `sessions.start` upserts on `(env, externalId)`. Two
     * concurrent AgentChat instances on the same chatId converge to the
     * same session.
     */
    private ensureStarted;
    private subscribeToSessionStream;
}
export {};
