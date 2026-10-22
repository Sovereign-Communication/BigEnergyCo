import { type AnyTask, type Task, type ApiClientConfiguration, type inferSchemaIn, type inferSchemaOut, type MachinePresetName, type RealtimeDefinedInputStream, type RealtimeDefinedStream, type TaskIdentifier, type TaskOptions, type TaskRunContext, type TaskSchema, type TaskWithSchema, type AnySessionChannel, type SessionChannelName } from "@trigger.dev/core/v3";
import type { streamText as aiStreamTextSignature, FinishReason, LanguageModelUsage, ModelMessage, SystemModelMessage, ProviderMetadata, Tool, ToolSet, UIMessage, UIMessageChunk, UIMessageStreamOptions } from "ai";
import { type TranscriptLoadResult, type TranscriptStorage } from "./transcriptStorage.js";
import { type ChatInputChunk, type ChatTaskWirePayload, type InferChatClientData, type InferChatUIMessage, type InferChatUIMessageFromTools, PENDING_MESSAGE_INJECTED_TYPE, upsertIncomingMessage } from "./ai-shared.js";
import { locals } from "./locals.js";
import type { ResolvedPrompt } from "./prompt.js";
import type { ResolvedSkill } from "./skill.js";
type ToolCallOptions = {
    toolCallId: string;
    messages?: ModelMessage[];
    abortSignal?: AbortSignal;
    experimental_context?: unknown;
    context?: unknown;
};
import { type ChatVersionSkewPolicy } from "./chatVersionSkew.js";
import { type SessionChannelHandleFor, type SessionTriggerConfigInput } from "./sessions.js";
/** Re-export for typing `ctx` in `chat.agent` hooks without importing `@trigger.dev/core`. */
export type { TaskRunContext } from "@trigger.dev/core/v3";
export type ToolCallExecutionOptions = {
    toolCallId: string;
    experimental_context?: unknown;
    /** v7 name for the user context (`experimental_context` on v6). */
    context?: unknown;
    /** Chat context — only present when the tool runs inside a chat.agent turn. */
    chatId?: string;
    turn?: number;
    continuation?: boolean;
    clientData?: unknown;
};
/** Chat context stored in locals during each chat.agent turn for auto-detection. */
type ChatTurnContext<TClientData = unknown> = {
    chatId: string;
    turn: number;
    continuation: boolean;
    clientData?: TClientData;
};
export { __readChatSnapshotProductionPathForTests, __setReadChatSnapshotImplForTests, __setWriteChatSnapshotImplForTests, __writeChatSnapshotProductionPathForTests, } from "./chatSnapshotIo.js";
export { defaultStorage, memoryTranscriptStorage, reduceTranscriptChanges, snapshotTranscriptStorage, type LoadContextEvent, type MemoryTranscriptStorage, type TranscriptChange, type TranscriptChangeReason, type TranscriptChangeset, type TranscriptCursors, type TranscriptLoadOptions, type TranscriptLoadResult, type TranscriptScope, type TranscriptState, type TranscriptStorage, type TranscriptStorageContext, } from "./transcriptStorage.js";
type ReplaySessionOutTailImpl = <TUIMessage extends UIMessage>(sessionId: string, options?: {
    lastEventId?: string;
}) => Promise<ReplaySessionOutTailResult<TUIMessage>>;
export declare function __setReplaySessionOutTailImplForTests(impl: ReplaySessionOutTailImpl | undefined): void;
export declare function __setReplaySessionInTailImplForTests(impl: ReplaySessionInTailImpl | undefined): void;
type ToolResultContent = Array<{
    type: "text";
    text: string;
} | {
    type: "image";
    data: string;
    mimeType?: string;
}>;
export type ToolOptions<TResult> = {
    experimental_toToolResultContent?: (result: TResult) => ToolResultContent;
};
/** Satisfies AI SDK `ToolSet` index signature alongside concrete `Tool` input/output types. */
type ToolSetCompatible<T extends Tool<any, any>> = T & NonNullable<ToolSet[string]>;
/**
 * Returns an `execute` function for the AI SDK `tool()` helper (or any compatible tool definition).
 * Preferred API for task-backed tools: the same Trigger wiring as the deprecated `ai.tool()`
 * (`triggerAndSubscribe`, tool-call metadata, chat context, `chat.local` serialization) without
 * building the tool object. You supply `description`, `inputSchema`, and any AI-SDK-only options
 * (e.g. `experimental_toToolResultContent`) on `tool()` yourself.
 *
 * @example
 * ```ts
 * import { tool } from "ai";
 * import { z } from "zod";
 * import { ai } from "@trigger.dev/sdk/ai";
 * import { myTask } from "./trigger/myTask";
 *
 * export const myTool = tool({
 *   description: myTask.description ?? "",
 *   inputSchema: z.object({ id: z.string() }),
 *   execute: ai.toolExecute(myTask),
 * });
 * ```
 */
declare function toolExecute<TIdentifier extends string, TInput = void, TOutput = unknown>(task: Task<TIdentifier, TInput, TOutput>): (input: TInput, toolOpts: ToolCallOptions) => Promise<TOutput>;
declare function toolExecute<TIdentifier extends string, TTaskSchema extends TaskSchema | undefined = undefined, TOutput = unknown>(task: TaskWithSchema<TIdentifier, TTaskSchema, TOutput>): (input: inferSchemaIn<TTaskSchema>, toolOpts: ToolCallOptions) => Promise<TOutput>;
/**
 * @deprecated Use `tool()` from the `ai` package with `execute: ai.toolExecute(task)` instead.
 * This helper may be removed in a future major release.
 */
declare function toolFromTask<TIdentifier extends string, TInput = void, TOutput = unknown>(task: Task<TIdentifier, TInput, TOutput>, options?: ToolOptions<TOutput>): ToolSetCompatible<Tool<TInput, TOutput>>;
/** @deprecated Use `tool()` from `ai` with `execute: ai.toolExecute(task)`. */
declare function toolFromTask<TIdentifier extends string, TTaskSchema extends TaskSchema | undefined = undefined, TOutput = unknown>(task: TaskWithSchema<TIdentifier, TTaskSchema, TOutput>, options?: ToolOptions<TOutput>): ToolSetCompatible<Tool<inferSchemaIn<TTaskSchema>, TOutput>>;
declare function getToolOptionsFromMetadata(): ToolCallExecutionOptions | undefined;
/**
 * Get the current tool call ID from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`).
 * Returns `undefined` if not running as a tool subtask.
 */
declare function getToolCallId(): string | undefined;
/**
 * Get the chat context from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`) within a `chat.agent`.
 * Pass `typeof yourChatTask` as the type parameter to get typed `clientData`.
 * Returns `undefined` if the parent is not a chat task.
 *
 * @example
 * ```ts
 * const ctx = ai.chatContext<typeof myChat>();
 * // ctx?.clientData is typed based on myChat's clientDataSchema
 * ```
 */
declare function getToolChatContext<TChatTask extends AnyTask = AnyTask>(): ChatTurnContext<InferChatClientData<TChatTask>> | undefined;
/**
 * Get the chat context from inside a subtask, throwing if not in a chat context.
 * Pass `typeof yourChatTask` as the type parameter to get typed `clientData`.
 *
 * @example
 * ```ts
 * const ctx = ai.chatContextOrThrow<typeof myChat>();
 * // ctx.chatId, ctx.clientData are guaranteed non-null
 * ```
 */
declare function getToolChatContextOrThrow<TChatTask extends AnyTask = AnyTask>(): ChatTurnContext<InferChatClientData<TChatTask>>;
export declare const ai: {
    /**
     * @deprecated Use `tool()` from the `ai` package with `execute: ai.toolExecute(task)` instead.
     */
    tool: typeof toolFromTask;
    /**
     * Preferred: return value for the `execute` field of AI SDK `tool()`. Keeps Trigger subtask and
     * metadata behavior without coupling to a specific `ai` version’s `Tool` / `ToolSet` types.
     */
    toolExecute: typeof toolExecute;
    currentToolOptions: typeof getToolOptionsFromMetadata;
    /** Get the tool call ID from inside a subtask invoked via `ai.toolExecute()` (or legacy `ai.tool()`). */
    toolCallId: typeof getToolCallId;
    /** Get chat context (chatId, turn, clientData, etc.) from inside a subtask of a `chat.agent`. Returns undefined if not in a chat context. */
    chatContext: typeof getToolChatContext;
    /** Get chat context or throw if not in a chat context. Pass `typeof yourChatTask` for typed clientData. */
    chatContextOrThrow: typeof getToolChatContextOrThrow;
};
/**
 * Creates a public access token for a chat task.
 *
 * This is a convenience helper that creates a multi-use trigger public token
 * scoped to the given task. Use it in a server action to provide the frontend
 * `TriggerChatTransport` with an `accessToken`.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat } from "@trigger.dev/sdk/ai";
 * import type { myChat } from "@/trigger/chat";
 *
 * export const getChatToken = () => chat.createAccessToken<typeof myChat>("my-chat");
 * ```
 */
declare function createChatAccessToken<TTask extends AnyTask>(taskId: TaskIdentifier<TTask>): Promise<string>;
/**
 * Register work that must land before anything from this turn reaches the
 * frontend.
 *
 * Like {@link chatDefer} the work starts immediately and is never awaited by
 * the hook that registered it, so it runs alongside the model and costs no
 * time to first token. Unlike `chat.defer`, the output stream waits for it:
 * no chunk of the answer is written to the session until it settles. That
 * makes it the right home for a write the next page load has to see (a
 * conversation row, a message insert), because a reader that can see the
 * answer can also see what the write persisted.
 *
 * Reach for `chat.defer` instead when the timing does not matter for a
 * reload: analytics, audit logs, search-index updates.
 *
 * This is not a consistency barrier for the turn. The work is still in flight
 * while the model runs, so a tool, a `prepareStep`, or anything else executing
 * during the turn can still read the state as it was before the write. It
 * orders the write against what the frontend can see, nothing more. When the
 * turn's own code has to read the write back, `await` it instead and accept
 * the cost.
 *
 * A write registered here that fails, or outlasts the internal timeout, lets
 * the stream through rather than stalling the conversation.
 *
 * @example
 * ```ts
 * onTurnStart: async ({ chatId, uiMessages }) => {
 *   chat.deferBeforeOutput(
 *     db.chat.update({ where: { id: chatId }, data: { messages: uiMessages } })
 *   );
 * },
 * ```
 */
declare function chatDeferBeforeOutput(promiseOrFn: Promise<unknown> | (() => Promise<unknown>)): void;
/**
 * A stream writer passed to chat lifecycle callbacks (`onPreload`, `onChatStart`,
 * `onTurnStart`, `onTurnComplete`, `onCompacted`).
 *
 * Write custom `UIMessageChunk` parts (e.g. `data-*` parts) directly to the chat
 * stream without the ceremony of `chat.stream.writer({ execute })`.
 *
 * The writer is lazy — no stream overhead if you don't call `write()` or `merge()`.
 *
 * @example
 * ```ts
 * onTurnStart: async ({ writer }) => {
 *   writer.write({ type: "data-status", data: { loading: true } });
 * },
 * onTurnComplete: async ({ writer, uiMessages }) => {
 *   writer.write({ type: "data-analytics", data: { messageCount: uiMessages.length } });
 * },
 * ```
 */
export type ChatWriter = {
    /** Write a single UIMessageChunk to the chat stream. */
    write(part: UIMessageChunk): void;
    /** Merge another stream's chunks into the chat stream. */
    merge(stream: ReadableStream<UIMessageChunk>): void;
};
type ChatCustomAgentClientDataErrorHandler = (event: {
    error: unknown;
    payload: ChatTaskWirePayload;
}) => Promise<void> | void;
/**
 * The payload shape passed to the `chatAgent` run function.
 *
 * - `messages` contains model-ready messages (converted via `convertToModelMessages`) —
 *   pass these directly to `streamText`.
 * - `clientData` contains custom data from the frontend (the `metadata` field from `sendMessage()`).
 *
 * The backend accumulates the full conversation history across turns, so the frontend
 * only needs to send new messages after the first turn.
 */
export type ChatTaskPayload<TClientData = unknown> = {
    /** Model-ready messages — pass directly to `streamText({ messages })`. */
    messages: ModelMessage[];
    /** The unique identifier for the chat session */
    chatId: string;
    /**
     * The trigger type:
     * - `"submit-message"`: A new user message
     * - `"regenerate-message"`: Regenerate the last assistant response
     * - `"preload"`: Run was preloaded before the first message (only on turn 0)
     * - `"action"`: A typed action from the frontend (see `actionSchema` + `onAction`).
     *   The action has already been applied before `run()` fires — check `trigger === "action"`
     *   to short-circuit the LLM call when an action doesn't need a response.
     * - `"close"`: The chat session is being closed (internal; `run()` is not called).
     */
    trigger: "submit-message" | "regenerate-message" | "preload" | "action" | "action-turn" | "close";
    /** The ID of the message to regenerate (only for `"regenerate-message"`) */
    messageId?: string;
    /** Custom data from the frontend (passed via `metadata` on `sendMessage()` or the transport). */
    clientData?: TClientData;
    /** Whether this run is continuing an existing chat (previous run timed out or was cancelled). False for brand new chats. */
    continuation: boolean;
    /** The run ID of the previous run (only set when `continuation` is true). */
    previousRunId?: string;
    /** Whether this run was preloaded before the first message. */
    preloaded: boolean;
    /**
     * The friendlyId of the Session primitive backing this chat. Use with
     * `sessions.open(sessionId)` when you need direct access to the session's
     * `.in` / `.out` channels outside the hooks the agent already wires for
     * you. Undefined only for legacy transports that predate the sessions
     * migration.
     */
    sessionId?: string;
};
/**
 * Abort signals provided to the `chatAgent` run function.
 */
export type ChatTaskSignals = {
    /** Combined signal — fires on run cancel OR stop generation. Pass to `streamText`. */
    signal: AbortSignal;
    /** Fires only when the run is cancelled, expired, or exceeds maxDuration. */
    cancelSignal: AbortSignal;
    /** Fires only when the frontend stops generation for this turn (per-turn, reset each turn). */
    stopSignal: AbortSignal;
};
/**
 * The full payload passed to a `chatAgent` run function.
 * Extends `ChatTaskPayload` (the wire payload) with abort signals.
 */
export type ChatTaskRunPayload<TClientData = unknown, TTools extends ToolSet = ToolSet> = ChatTaskPayload<TClientData> & ChatTaskSignals & {
    /**
     * Task run context — same object as the `ctx` passed to a standard `task({ run })` handler’s second argument.
     * Use for tags, metadata, parent run links, or any API that needs the full run record.
     */
    ctx: TaskRunContext;
    /**
     * `streamText` with this agent's managed options already applied: the
     * prompt from `chat.prompt.set()`, the skill tools, telemetry, and the
     * `prepareStep` that delivers steering, compaction and injected context.
     *
     * Prefer it over importing `streamText` from `ai`. The imported one takes
     * none of that unless you spread `chat.toStreamTextOptions()` yourself, and
     * forgetting the spread fails silently.
     */
    streamText: AiStreamTextFn;
    /** Token usage from the previous turn. Undefined on turn 0. */
    previousTurnUsage?: LanguageModelUsage;
    /** Cumulative token usage across all completed turns so far. */
    totalUsage: LanguageModelUsage;
    /**
     * The resolved tool set for this turn, the same `tools` you declared on
     * `chat.agent({ tools })` (or the result of the per-turn `tools` function).
     * Pass straight to `streamText({ tools })` so you don't redeclare them:
     *
     * ```ts
     * run: ({ messages, tools, signal }) =>
     *   streamText({ model, messages, tools, abortSignal: signal })
     * ```
     *
     * Declaring `tools` on the config is also what lets the SDK re-run each
     * tool's `toModelOutput` when it re-converts prior-turn history (see the
     * `tools` option on `chat.agent`). Empty object when no `tools` were declared.
     */
    tools: TTools;
};
/**
 * One message record delivered through {@link chat.messages}.
 *
 * `id` is the append's stable idempotency key and `seqNum` is its monotonic
 * sequence on the Session `.in` channel. Both remain stable if the record is
 * delivered again after a reconnect.
 */
export type ChatMessageRecord = Readonly<{
    id: string;
    seqNum: number;
    payload: ChatTaskWirePayload;
}>;
export type ChatMessages = RealtimeDefinedInputStream<ChatTaskWirePayload> & {
    /** Whether the local buffer head is a message that can be consumed immediately. */
    hasPending(): Promise<boolean>;
    /** Consume one message record, or return `undefined` when the optional timeout elapses. */
    next(options?: {
        timeoutInSeconds?: number;
    }): Promise<ChatMessageRecord | undefined>;
};
/**
 * Signal received by a `handover-prepare` agent run waiting on
 * `session.in`. Either the customer's first-turn `streamText` finished
 * with pending tool calls (`"handover"` — agent picks up from tool
 * execution), or it finished pure-text (`"handover-skip"` — agent
 * exits cleanly without making an LLM call).
 *
 * Returned by `chat.waitForHandover()` for custom-agent loops.
 */
export type HandoverSignal = {
    kind: "handover";
    partialAssistantMessage: ModelMessage[];
    messageId?: string;
    /**
     * Whether the customer's step 1 is the final response. When
     * true, the agent's turn loop runs hooks but skips the LLM
     * call (the partial IS the response). When false, the agent
     * runs `streamText` which executes pending tool-calls via the
     * approval round and continues from step 2.
     */
    isFinal: boolean;
} | {
    kind: "handover-skip";
};
/**
 * Wait for a `chat.headStart` handover signal inside a custom-agent loop or
 * `chat.createSession`. Returns:
 * - `null` — this run is not a `handover-prepare` boot, or the wait idled out /
 *   the warm handler crashed before signaling. Treat as "no handover".
 * - `{ kind: "handover-skip" }` — the warm handler aborted; exit without a turn.
 * - `{ kind: "handover", partialAssistantMessage, messageId?, isFinal }` — splice
 *   the partial (`chat.MessageAccumulator.applyHandover`) and, when `isFinal` is
 *   false, fall through to `streamText` to run the handed-over tool round.
 *
 * For the common case prefer `accumulator.consumeHandover()`, which also seeds
 * `payload.headStartMessages` and applies the partial for you.
 *
 * Safe to call at any point in turn 0: the handover signal has its own route,
 * so a message facade waiting at the same time cannot take it.
 */
declare function waitForHandover(options: {
    /** The run's wire payload (only `trigger` / `idleTimeoutInSeconds` are read). */
    payload: {
        trigger?: string;
        idleTimeoutInSeconds?: number;
    };
    idleTimeoutInSeconds?: number;
    timeout?: string;
    spanName?: string;
}): Promise<HandoverSignal | null>;
/** Convenience re-export of the AI SDK's `LanguageModelUsage` type. */
export type ChatTurnUsage = LanguageModelUsage;
/**
 * Replace the accumulated conversation messages for the current run.
 *
 * Call from `onTurnStart` to compact before `run()` executes, or from
 * `onTurnComplete` to compact before the next turn. Takes `UIMessage[]`
 * and converts to `ModelMessage[]` internally.
 */
declare function setChatMessages<TUIM extends UIMessage = UIMessage>(uiMessages: TUIM[]): void;
/**
 * A tool call surfaced by `chat.history.getPendingToolCalls()` /
 * `getResolvedToolCalls()`. Identifies the call by its `toolCallId` plus
 * the `messageId` of the assistant message that hosts it, so callers can
 * locate the part precisely without re-walking the chain.
 */
export type ChatToolCallRef = {
    toolCallId: string;
    toolName: string;
    messageId: string;
};
/**
 * A new tool result surfaced by `chat.history.extractNewToolResults()`.
 * `errorText` is set iff the part is in `output-error` state; otherwise
 * `output` carries the resolved value.
 */
export type ChatNewToolResult = {
    toolCallId: string;
    toolName: string;
    output: unknown;
    errorText?: string;
};
/** State stored in locals during prepareStep compaction. */
interface CompactionState {
    summary: string;
    baseResponseMessageCount: number;
    /** Completed steps summarized this turn; unlike message counts, matches UI step markers. */
    baseResponseStepCount: number;
}
/**
 * Event passed to `summarize` callbacks.
 */
export type SummarizeEvent = {
    /** The current model messages to summarize. */
    messages: ModelMessage[];
    /** Full usage object from the triggering step/turn. */
    usage?: LanguageModelUsage;
    /** Cumulative token usage across all completed turns. Present in chat.agent contexts. */
    totalUsage?: LanguageModelUsage;
    /** The chat session ID (if running inside a chat.agent). */
    chatId?: string;
    /** The current turn number (0-indexed, if inside a chat.agent). */
    turn?: number;
    /** Custom data from the frontend (if inside a chat.agent). */
    clientData?: unknown;
    /**
     * Where compaction is running:
     * - `"inner"` — between tool-call steps (prepareStep)
     * - `"outer"` — between turns
     */
    source?: "inner" | "outer";
    /** The step number (0-indexed). Only present when `source` is `"inner"`. */
    stepNumber?: number;
};
/**
 * Event passed to `compactUIMessages` and `compactModelMessages` callbacks.
 */
export type CompactMessagesEvent<TUIM extends UIMessage = UIMessage> = {
    /** The generated summary text. */
    summary: string;
    /** The current UI messages (full conversation). */
    uiMessages: TUIM[];
    /** The current model messages (full conversation). */
    modelMessages: ModelMessage[];
    /** The chat session ID. */
    chatId: string;
    /** The current turn number (0-indexed). */
    turn: number;
    /** Custom data from the frontend. */
    clientData?: unknown;
    /**
     * Where compaction is running:
     * - `"inner"` — between tool-call steps (prepareStep)
     * - `"outer"` — between turns
     */
    source: "inner" | "outer";
};
/**
 * Options for the `compaction` field on `chat.agent()`.
 *
 * Handles compaction automatically in both the inner loop (prepareStep, between
 * tool-call steps) and the outer loop (between turns, for single-step responses
 * where prepareStep never fires).
 */
export type ChatAgentCompactionOptions<TUIM extends UIMessage = UIMessage> = {
    /** Decide whether to compact. Return true to trigger compaction. */
    shouldCompact: (event: ShouldCompactEvent) => boolean | Promise<boolean>;
    /** Generate a summary from the current messages. Return the summary text. */
    summarize: (event: SummarizeEvent) => Promise<string>;
    /**
     * Transform UI messages after compaction (what gets persisted and displayed).
     * Default: preserve all UI messages unchanged.
     *
     * @example
     * ```ts
     * // Flatten to summary
     * compactUIMessages: ({ summary }) => [{
     *   id: generateId(), role: "assistant",
     *   parts: [{ type: "text", text: `[Summary]\n\n${summary}` }],
     * }],
     *
     * // Summary + keep last 4 messages
     * compactUIMessages: ({ uiMessages, summary }) => [
     *   { id: generateId(), role: "assistant",
     *     parts: [{ type: "text", text: `[Summary]\n\n${summary}` }] },
     *   ...uiMessages.slice(-4),
     * ],
     * ```
     */
    compactUIMessages?: (event: CompactMessagesEvent<TUIM>) => TUIM[] | Promise<TUIM[]>;
    /**
     * Transform model messages after compaction (what gets sent to the LLM).
     * Default: replace all with a single summary message.
     *
     * @example
     * ```ts
     * // Summary + keep last 2 model messages
     * compactModelMessages: ({ modelMessages, summary }) => [
     *   { role: "user", content: summary },
     *   ...modelMessages.slice(-2),
     * ],
     * ```
     */
    compactModelMessages?: (event: CompactMessagesEvent<TUIM>) => ModelMessage[] | Promise<ModelMessage[]>;
};
/**
 * Event passed to `shouldInject` and `prepareMessages` callbacks.
 */
export type PendingMessagesBatchEvent<TUIM extends UIMessage = UIMessage> = {
    /** All pending UI messages that arrived during streaming (batch). */
    messages: TUIM[];
    /** Current model messages in the conversation. */
    modelMessages: ModelMessage[];
    /** Completed steps so far. */
    steps: CompactionStep[];
    /** Current step number (0-indexed). */
    stepNumber: number;
    /** Chat session ID. */
    chatId: string;
    /** Current turn number (0-indexed). */
    turn: number;
    /** Custom data from the frontend. */
    clientData?: unknown;
};
/**
 * Event passed to `onReceived` callback (per-message, as they arrive).
 */
export type PendingMessageReceivedEvent<TUIM extends UIMessage = UIMessage> = {
    /** The UI message that arrived during streaming. */
    message: TUIM;
    /** Chat session ID. */
    chatId: string;
    /** Current turn number (0-indexed). */
    turn: number;
};
/**
 * Event passed to `onInjected` callback (batch, after injection).
 */
export type PendingMessagesInjectedEvent<TUIM extends UIMessage = UIMessage> = {
    /** All UI messages that were injected. */
    messages: TUIM[];
    /** The model messages that were injected. */
    injectedModelMessages: ModelMessage[];
    /** Chat session ID. */
    chatId: string;
    /** Current turn number (0-indexed). */
    turn: number;
    /** Step number where injection occurred. */
    stepNumber: number;
};
/**
 * Options for the `pendingMessages` field on `chat.agent()`, `chat.createSession()`,
 * or `ChatMessageAccumulator`.
 *
 * Configures how messages that arrive during streaming are handled. When
 * `shouldInject` is provided and returns `true`, the full batch of pending
 * messages is injected between tool-call steps via `prepareStep`.
 * Otherwise, messages queue for the next turn.
 */
export type PendingMessagesOptions<TUIM extends UIMessage = UIMessage> = {
    /**
     * Decide whether to inject pending messages between tool-call steps.
     * Called once per step boundary with the full batch of pending messages.
     * If absent, no injection happens — messages only queue for the next turn.
     */
    shouldInject?: (event: PendingMessagesBatchEvent<TUIM>) => boolean | Promise<boolean>;
    /**
     * Transform the batch of pending messages before injection.
     * Return the model messages to inject.
     * Default: convert each UI message via `convertToModelMessages`.
     */
    prepare?: (event: PendingMessagesBatchEvent<TUIM>) => ModelMessage[] | Promise<ModelMessage[]>;
    /** Called when a message arrives during streaming (per-message). */
    onReceived?: (event: PendingMessageReceivedEvent<TUIM>) => void | Promise<void>;
    /** Called after a batch of messages is injected via `prepareStep`. */
    onInjected?: (event: PendingMessagesInjectedEvent<TUIM>) => void | Promise<void>;
};
/**
 * The data part type used to signal that pending messages were injected
 * between tool-call steps. The frontend can match on this to render
 * injection points inline in the assistant response.
 */
export { PENDING_MESSAGE_INJECTED_TYPE, upsertIncomingMessage };
export type { InferChatClientData, InferChatUIMessage, InferChatUIMessageFromTools };
/**
 * Event passed to the `prepareMessages` hook.
 */
export type PrepareMessagesEvent<TClientData = unknown> = {
    /** The messages to transform. Return the transformed array. */
    messages: ModelMessage[];
    /** Why messages are being prepared. */
    reason: "run" | "compaction-rebuild" | "compaction-result";
    /** The chat session ID. */
    chatId: string;
    /** The current turn number (0-indexed). */
    turn: number;
    /** Custom data from the frontend. */
    clientData?: TClientData;
};
/**
 * Event passed to the per-turn `tools` function form on `chat.agent`.
 *
 * Use this when the active tool set depends on per-turn context (the user, a
 * feature flag, etc.). Return the `ToolSet` to use for converting this turn's
 * history. Only `inputSchema` and `toModelOutput` are read during conversion,
 * so a lightweight map (no `execute`) is fine.
 */
export type ResolveToolsEvent<TClientData = unknown> = {
    /** The chat session ID. */
    chatId: string;
    /** The current turn number (0-indexed). */
    turn: number;
    /** Whether this run is continuing an existing chat. */
    continuation: boolean;
    /** Custom data from the frontend. */
    clientData?: TClientData;
};
/**
 * Data shape for `data-compaction` stream chunks emitted during compaction.
 * Use to type the `data` field when rendering compaction parts in the frontend.
 */
export type CompactionChunkData = {
    status: "compacting" | "complete";
    totalTokens: number | undefined;
};
/**
 * Event passed to the `onCompacted` callback.
 */
export type CompactedEvent = {
    /** Task run context — same as `task` lifecycle hooks and `chat.agent` `run({ ctx })`. */
    ctx: TaskRunContext;
    /** The generated summary text. */
    summary: string;
    /** The messages that were compacted (pre-compaction). */
    messages: ModelMessage[];
    /** Number of messages before compaction. */
    messageCount: number;
    /** Token usage from the step that triggered compaction. */
    usage: LanguageModelUsage;
    /** Total token count that triggered compaction. */
    totalTokens: number | undefined;
    /** Input token count from the triggering step. */
    inputTokens: number | undefined;
    /** Output token count from the triggering step. */
    outputTokens: number | undefined;
    /** The step number where compaction occurred (0-indexed). */
    stepNumber: number;
    /** The chat session ID (if running inside a chat.agent). */
    chatId?: string;
    /** The current turn number (if running inside a chat.agent). */
    turn?: number;
    /** Stream writer — write custom `UIMessageChunk` parts to the chat stream. Lazy: no overhead if unused. */
    writer: ChatWriter;
};
/**
 * Event passed to `shouldCompact` callbacks.
 */
export type ShouldCompactEvent = {
    /** The current model messages (full conversation). */
    messages: ModelMessage[];
    /**
     * Total token count of the triggering model call: the step that just finished
     * (`"inner"`), or the turn's LAST step (`"outer"`). This is the size of the
     * context the model held on that call, which is what a compaction decision is
     * about. It is never the sum over a multi-step turn; see `turnUsage` for that.
     */
    totalTokens: number | undefined;
    /** Input token count of the triggering model call (see `totalTokens`). */
    inputTokens: number | undefined;
    /** Output token count of the triggering model call (see `totalTokens`). */
    outputTokens: number | undefined;
    /** Full usage object of the triggering model call (see `totalTokens`). */
    usage?: LanguageModelUsage;
    /**
     * The whole turn's usage summed over every step, as the provider billed it.
     * Only present when `source` is `"outer"`.
     */
    turnUsage?: LanguageModelUsage;
    /** Cumulative token usage across all completed turns. Present in chat.agent contexts. */
    totalUsage?: LanguageModelUsage;
    /** The chat session ID (if running inside a chat.agent). */
    chatId?: string;
    /** The current turn number (0-indexed, if inside a chat.agent). */
    turn?: number;
    /** Custom data from the frontend (if inside a chat.agent). */
    clientData?: unknown;
    /**
     * Where this check is running:
     * - `"inner"` — between tool-call steps (prepareStep)
     * - `"outer"` — between turns (after response, before onBeforeTurnComplete)
     */
    source?: "inner" | "outer";
    /** The step number (0-indexed). Only present when `source` is `"inner"`. */
    stepNumber?: number;
    /** The steps array from prepareStep. Only present when `source` is `"inner"`. */
    steps?: CompactionStep[];
};
/**
 * Options for `chat.compaction()` — the high-level prepareStep factory.
 */
export type CompactionOptions = {
    /** Generate a summary from the current messages. Return the summary text. */
    summarize: (messages: ModelMessage[]) => Promise<string>;
    /** Token threshold — compact when totalTokens exceeds this. Ignored if `shouldCompact` is provided. */
    threshold?: number;
    /** Custom compaction trigger. When provided, used instead of `threshold`. */
    shouldCompact?: (event: ShouldCompactEvent) => boolean | Promise<boolean>;
};
/** A step object as received in prepareStep's `steps` array. */
export type CompactionStep = {
    usage: LanguageModelUsage;
    finishReason: string;
    content: Array<{
        type: string;
        toolCallId?: string;
    }>;
    response: {
        messages: Array<any>;
    };
};
/**
 * Result of `chat.compact()`. Discriminated union so you can inspect
 * what happened, but also directly compatible with prepareStep's return type.
 *
 * - `"skipped"` — no compaction needed (first step, boundary unsafe, or under threshold). Return `undefined` to prepareStep.
 * - `"rebuilt"` — previous compaction exists, messages rebuilt from summary + new response messages.
 * - `"compacted"` — compaction just happened, includes the generated summary.
 */
export type CompactResult = {
    type: "skipped";
} | {
    type: "rebuilt";
    messages: ModelMessage[];
} | {
    type: "compacted";
    messages: ModelMessage[];
    summary: string;
};
/**
 * Options for `chat.compact()` — the low-level compaction function.
 */
export type CompactOptions = {
    /** Generate a summary from the current messages. Return the summary text. */
    summarize: (messages: ModelMessage[]) => Promise<string>;
    /** Token threshold — compact when totalTokens exceeds this. Ignored if `shouldCompact` is provided. */
    threshold?: number;
    /** Custom compaction trigger. When provided, used instead of `threshold`. */
    shouldCompact?: (event: ShouldCompactEvent) => boolean | Promise<boolean>;
};
/**
 * Read the current compaction state. Returns the summary and base message count
 * if compaction has occurred in this turn, or `undefined` if not.
 *
 * Use in a custom `prepareStep` to rebuild from a previous compaction:
 * ```ts
 * const state = chat.getCompactionState();
 * if (state) {
 *   return { messages: [{ role: "user", content: state.summary }, ...newMsgs] };
 * }
 * ```
 */
declare function getCompactionState(): CompactionState | undefined;
/**
 * Low-level compaction for use inside a custom `prepareStep`.
 *
 * Handles the full decision tree: first step, already-compacted rebuild,
 * boundary safety, threshold check, summarization, stream chunks, state
 * storage, and accumulator update.
 *
 * Returns a `CompactResult` — inspect `result.type` to see what happened,
 * or convert to a prepareStep return with `result.type === "skipped" ? undefined : result`.
 *
 * @example
 * ```ts
 * prepareStep: async ({ messages, steps }) => {
 *   // your custom logic here...
 *   const result = await chat.compact(messages, steps, {
 *     threshold: 80_000,
 *     summarize: async (msgs) => generateText({ model, messages: msgs }).then(r => r.text),
 *   });
 *   if (result.type === "compacted") {
 *     logger.info("Compacted!", { summary: result.summary });
 *   }
 *   return result.type === "skipped" ? undefined : result;
 * },
 * ```
 */
declare function chatCompact(messages: ModelMessage[], steps: CompactionStep[], options: CompactOptions): Promise<CompactResult>;
/**
 * Returns a `prepareStep` function that handles context compaction automatically.
 *
 * Monitors token usage between tool-call steps. When `totalTokens` exceeds
 * the threshold, generates a summary via `summarize()`, replaces the message
 * history, and emits `data-compaction` stream chunks for the frontend.
 *
 * @example
 * ```ts
 * return streamText({
 *   ...chat.toStreamTextOptions({ registry }),
 *   messages: chat.addCacheBreaks(messages),
 *   prepareStep: chat.compactionStep({
 *     threshold: 80_000,
 *     summarize: async (messages) => {
 *       return generateText({ model, messages: [...messages, { role: "user", content: "Summarize." }] })
 *         .then((r) => r.text);
 *     },
 *   }),
 *   tools: { ... },
 * });
 * ```
 */
declare function chatCompactionStep(options: CompactionOptions): (args: {
    messages: ModelMessage[];
    steps: CompactionStep[];
}) => Promise<{
    messages: ModelMessage[];
} | undefined>;
/**
 * Checks whether it's safe to compact the message history. Returns `false`
 * if any tool calls are in-flight (incomplete tool invocations without results).
 *
 * Call before `chat.setMessages()` to avoid corrupting tool-call state.
 */
declare function isCompactionSafe(messages: UIMessage[]): boolean;
/**
 * A resolved prompt stored via `chat.prompt.set()`. Either a full `ResolvedPrompt`
 * from `prompts.define().resolve()`, or a lightweight wrapper around a plain string.
 */
export type ChatPromptValue = ResolvedPrompt | {
    text: string;
    model: undefined;
    config: undefined;
    promptId: string;
    version: number;
    labels: string[];
    toAISDKTelemetry: (additionalMetadata?: Record<string, string>) => {
        experimental_telemetry: {
            isEnabled: true;
            metadata: Record<string, string>;
        };
    };
};
/**
 * Options for `chat.prompt.set()`.
 */
export type SetChatPromptOptions = {
    /**
     * Provider options attached to the system prompt so a provider can cache it.
     * The most common use is an Anthropic prompt-cache breakpoint on the (large,
     * stable) system block — see the prompt-caching guide. Carried through to
     * `chat.toStreamTextOptions()` automatically; a `systemProviderOptions` /
     * `cacheControl` passed there overrides this.
     *
     * @example
     * chat.prompt.set(SYSTEM_PROMPT, {
     *   providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
     * });
     */
    providerOptions?: ProviderMetadata;
};
/**
 * Store a resolved prompt (or plain string) for the current run.
 * Call from any hook (`onPreload`, `onChatStart`, `onTurnStart`) or `run()`.
 */
declare function setChatPrompt(resolved: ResolvedPrompt | string, options?: SetChatPromptOptions): void;
/**
 * Read the stored prompt. Throws if `chat.prompt.set()` has not been called.
 */
declare function getChatPrompt(): ChatPromptValue;
/**
 * Store resolved skills for the current run. Call from any hook
 * (`onPreload`, `onChatStart`, `onTurnStart`) or `run()`.
 */
declare function setChatSkills(skills: ResolvedSkill[]): void;
/** Read the stored skills. Returns `undefined` if none set. */
declare function getChatSkills(): ResolvedSkill[] | undefined;
/**
 * Build the three tools we auto-inject into `streamText` when skills are
 * set: `loadSkill`, `readFile`, `bash`. Scoped per-skill by name.
 *
 * Exported so callers can use the same tools outside the auto-wired path
 * (e.g. in a `chat.createSession` loop with custom streamText).
 */
export declare function buildSkillTools(skills: ResolvedSkill[]): Record<string, Tool>;
/**
 * Options for {@link toStreamTextOptions}.
 */
export type ToStreamTextOptionsOptions = {
    /**
     * A base system prompt, used when `chat.prompt.set()` has not supplied one.
     * `chat.agent({ system })` and a `system` passed to the managed `streamText`
     * both arrive here.
     */
    system?: string | SystemModelMessage;
    /** Additional telemetry metadata merged into `experimental_telemetry.metadata`. */
    telemetry?: Record<string, string>;
    /**
     * An AI SDK provider registry (from `createProviderRegistry`) or any object
     * with a `languageModel(id)` method. When provided and the stored prompt has
     * a `model` string, the resolved `LanguageModel` is included in the returned
     * options so `streamText` uses it directly.
     *
     * The model string should use the `"provider:model-id"` format
     * (e.g. `"openai:gpt-4o"`, `"anthropic:claude-sonnet-4-6"`).
     */
    registry?: {
        languageModel(modelId: string): unknown;
    };
    /**
     * User-defined tools to merge alongside the auto-injected skill tools
     * (`loadSkill`, `readFile`, `bash`). User tools win on name conflicts.
     *
     * If you don't pass `tools` here and skills are set, the returned options
     * will include just the skill tools — spread after any `tools` you pass
     * directly to `streamText` and they'll be replaced. Easiest: pass all
     * your tools here.
     */
    tools?: Record<string, Tool>;
    /**
     * Provider options attached to the system prompt so a provider can cache it.
     * When set (or when {@link cacheControl} or `chat.prompt.set`'s
     * `providerOptions` is set), `system` is returned as a structured
     * `SystemModelMessage` carrying these options instead of a plain string —
     * letting providers like Anthropic apply prompt caching to the (large,
     * stable) system block, which is the single highest-value cache target.
     *
     * Overrides any `providerOptions` set on `chat.prompt.set()`.
     *
     * @example
     * chat.toStreamTextOptions({
     *   systemProviderOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
     * });
     */
    systemProviderOptions?: ProviderMetadata;
    /**
     * Anthropic-only convenience for {@link systemProviderOptions}: caches the
     * system prompt with the given cache breakpoint. Equivalent to
     * `systemProviderOptions: { anthropic: { cacheControl } }`. For other
     * providers (e.g. Amazon Bedrock's `cachePoint`), use `systemProviderOptions`.
     *
     * @example
     * chat.toStreamTextOptions({ cacheControl: { type: "ephemeral" } });
     */
    cacheControl?: SystemCacheControl;
};
/**
 * Anthropic prompt-cache breakpoint shape (`providerOptions.anthropic.cacheControl`).
 * `ttl` defaults to the 5-minute cache; `"1h"` selects the 1-hour cache.
 */
export type SystemCacheControl = {
    type: "ephemeral";
    ttl?: "5m" | "1h";
};
/**
 * Returns an options object ready to spread into `streamText()`.
 *
 * Includes `system`, `experimental_telemetry`, and any config fields
 * (temperature, maxTokens, etc.) from the stored prompt.
 *
 * When a `registry` is provided and the prompt has a `model` string,
 * the resolved `LanguageModel` is included as `model`.
 *
 * If no prompt has been set, returns `{}` (no-op spread).
 */
/**
 * The AI SDK's own `streamText` signature, borrowed rather than restated.
 *
 * The peer range spans `ai` v5, v6 and v7, whose `streamText` options differ.
 * Describing the shape here would drift against all three; `typeof` resolves to
 * whichever version the user installed, so generics, overloads and tool
 * inference are exactly theirs.
 */
type AiStreamTextFn = typeof aiStreamTextSignature;
/**
 * The `streamText` handed to a `chat.agent` `run()`, carrying the agent's
 * managed options.
 *
 * Exported so a loop factored out of `run` can take it as a parameter and keep
 * them: `function loop(messages: ModelMessage[], streamText: ChatStreamText)`.
 */
export type ChatStreamText = AiStreamTextFn;
declare function toStreamTextOptions(options?: ToStreamTextOptionsOptions): Record<string, unknown>;
/**
 * Options for `pipeChat`.
 */
export type PipeChatOptions = {
    /**
     * Override the stream key. Must match the `streamKey` on `TriggerChatTransport`.
     * @default "chat"
     */
    streamKey?: string;
    /** An AbortSignal to cancel the stream. */
    signal?: AbortSignal;
    /**
     * The target run ID to pipe to.
     * @default "self" (current run)
     */
    target?: string;
    /** Override the default span name for this operation. */
    spanName?: string;
};
/**
 * Options for customizing the `toUIMessageStream()` call used when piping
 * `streamText` results to the frontend.
 *
 * Set static defaults via `uiMessageStreamOptions` on `chat.agent()`, or
 * override per-turn via `chat.setUIMessageStreamOptions()`.
 *
 * `onFinish` is omitted because it is managed internally for response capture.
 * Use `streamText`'s `onFinish` for custom finish handling, or drop down to
 * raw task mode with `chat.pipe()` for full control.
 *
 * `originalMessages` is omitted because it is automatically set from the
 * accumulated conversation history, ensuring message IDs are reused across
 * turns (e.g. for tool approval continuations).
 *
 * `generateMessageId` can be set to control ID generation for response
 * messages (e.g. UUID-v7). If not set, the AI SDK's default `generateId` is used.
 */
export type ChatUIMessageStreamOptions<TUIM extends UIMessage = UIMessage> = Omit<UIMessageStreamOptions<TUIM>, "onFinish" | "originalMessages">;
/**
 * An object with a `toUIMessageStream()` method (e.g. `StreamTextResult` from `streamText()`).
 */
type UIMessageStreamable = {
    toUIMessageStream: (...args: any[]) => AsyncIterable<unknown> | ReadableStream<unknown>;
};
declare const actionTurnBrand: unique symbol;
/**
 * The marker `onAction` returns to have a turn run on the history it just
 * edited. Produce it with {@link chat.turn}.
 */
export type ActionTurn = {
    readonly [actionTurnBrand]: true;
};
/**
 * Turn the current action into a turn.
 *
 * Return it from `onAction` after editing history. The action's own work is
 * finished first (the edit is applied and snapshotted), then a turn runs on the
 * result exactly as a message turn does: `onTurnStart`, `run()` with the edited
 * history, `onBeforeTurnComplete`, `onTurnComplete`, and the turn counter
 * advances. That gives the answer everything a turn has, the system prompt,
 * tools, steering, compaction, injected instructions and persistence, with no
 * action-specific handling.
 *
 * @example
 * ```ts
 * onAction: async ({ action }) => {
 *   if (action.type === "regenerate") {
 *     chat.history.slice(0, -1);
 *     return chat.turn();
 *   }
 *   if (action.type === "undo") chat.history.slice(0, -2); // no turn
 * },
 * ```
 */
declare function chatTurn(): ActionTurn;
/**
 * Pipes a chat stream to the realtime stream, making it available to the
 * `TriggerChatTransport` on the frontend.
 *
 * Accepts:
 * - A `StreamTextResult` from `streamText()` (has `.toUIMessageStream()`)
 * - An `AsyncIterable` of `UIMessageChunk`s
 * - A `ReadableStream` of `UIMessageChunk`s
 *
 * Must be called from inside a Trigger.dev task's `run` function.
 *
 * @example
 * ```ts
 * import { task } from "@trigger.dev/sdk";
 * import { chat, type ChatTaskPayload } from "@trigger.dev/sdk/ai";
 * import { streamText, convertToModelMessages } from "ai";
 *
 * export const myChatTask = task({
 *   id: "my-chat-task",
 *   run: async (payload: ChatTaskPayload) => {
 *     const result = streamText({
 *       model: openai("gpt-4o"),
 *       messages: payload.messages,
 *     });
 *
 *     await chat.pipe(result);
 *   },
 * });
 * ```
 *
 * @example
 * ```ts
 * // Works from anywhere inside a task — even deep in your agent code
 * async function runAgentLoop(messages: CoreMessage[]) {
 *   const result = streamText({ model, messages });
 *   await chat.pipe(result);
 * }
 * ```
 */
declare function pipeChat(source: UIMessageStreamable | AsyncIterable<unknown> | ReadableStream<unknown>, options?: PipeChatOptions): Promise<void>;
/**
 * Options for defining a chat task.
 *
 * Extends the standard `TaskOptions` but pre-types the payload as `ChatTaskPayload`
 * and overrides `run` to accept `ChatTaskRunPayload` (with abort signals).
 *
 * **Auto-piping:** If the `run` function returns a value with `.toUIMessageStream()`
 * (like a `StreamTextResult`), the stream is automatically piped to the frontend.
 *
 * **Single-run mode:** By default, the task uses input streams so that the
 * entire conversation lives inside one run. After each AI response, the task
 * emits a control chunk and suspends via `messagesInput.wait()`. The frontend
 * transport resumes the same run by sending the next message via input streams.
 */
/**
 * Event passed to the `onPreload` callback.
 */
export type PreloadEvent<TClientData = unknown> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The Trigger.dev run ID for this conversation. */
    runId: string;
    /** A scoped access token for this chat run. */
    chatAccessToken: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
    /** Stream writer — write custom `UIMessageChunk` parts to the chat stream. Lazy: no overhead if unused. */
    writer: ChatWriter;
};
/**
 * Event passed to the `onBoot` callback.
 *
 * Fires once at the start of every run boot — for the initial first-message
 * run, for preloaded runs, AND for reactive continuation runs (post-cancel,
 * post-crash, post-`endRun`, `chat.requestUpgrade`, OOM-retry attempts).
 * Does NOT fire when the SAME run resumes from snapshot via the
 * idle-window suspend/resume path — use `onChatResume` for that.
 *
 * Use this for per-process setup that needs to run every time a fresh
 * worker picks up the chat: initialize `chat.local` state, open
 * per-process resources (DB connections, sandboxes, etc.), or
 * re-hydrate customer state from your DB on continuation.
 *
 * Ordering:
 *   - First message of a chat: `onBoot` → `onChatStart` → `onTurnStart` → `run()`
 *   - Preloaded run:           `onBoot` → `onPreload` → (wait) → `onChatStart` → ...
 *   - Continuation run:        `onBoot` → (wait for first message) → `onTurnStart` → `run()`
 *                              (`onChatStart` does NOT fire on continuation runs)
 */
export type BootEvent<TClientData = unknown> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The Trigger.dev run ID for this run boot. */
    runId: string;
    /** A scoped access token for this chat run. Persist this for frontend reconnection. */
    chatAccessToken: string;
    /** Custom data from the frontend (passed via `metadata` on `sendMessage()` or the transport). */
    clientData: TClientData;
    /**
     * True when this run is a reactive continuation — the prior run died
     * (cancel / crash / `endRun` / `requestUpgrade` / OOM retry) and this
     * fresh worker is taking over the chat. Branch on this to re-load
     * customer-owned state from your DB.
     */
    continuation: boolean;
    /** Public id of the prior run when `continuation` is true. */
    previousRunId?: string;
    /** Whether this run was triggered as a preload. */
    preloaded: boolean;
};
/**
 * A tool call extracted from the partial assistant message of a dead run.
 * Surfaced on `RecoveryBootEvent.pendingToolCalls` so the customer can
 * decide how to repair the chain (synthesize a result, drop the partial,
 * etc.).
 */
export type RecoveryPendingToolCall = {
    /** The AI SDK tool call id. */
    toolCallId: string;
    /** The tool name (the `tool-${name}` suffix). */
    toolName: string;
    /** The input the model produced for the tool call. */
    input: unknown;
    /** The part index inside `partialAssistant.parts` for in-place edits. */
    partIndex: number;
};
/**
 * Event passed to the `onRecoveryBoot` callback.
 *
 * Fires once at boot when a continuation run inherits in-flight state from
 * a dead predecessor (cancel / crash / OOM / deploy eviction / graceful
 * `chat.requestUpgrade`). The runtime reads both `session.in` and
 * `session.out` past the last `turn-complete` cursor and surfaces the
 * recovered pieces here so the customer can shape the conversational
 * chain before the first turn fires.
 *
 * Does NOT fire when there's nothing to recover (clean continuation after
 * `chat.endRun()` with no buffered user messages, fresh chat, OOM retry
 * after a successful turn-complete with no in-flight tail).
 *
 * Fires regardless of who owns the model's context. With `hydrateMessages`
 * or a storage `loadContext`, the recovered tail reaches that hook in
 * `previousMessages` on the next turn.
 */
export type RecoveryBootEvent<TUIM extends UIMessage = UIMessage> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The Trigger.dev run ID for this run boot. */
    runId: string;
    /** Public id of the prior run that died. */
    previousRunId: string;
    /**
     * Best-effort cause of the predecessor's death. Currently always
     * `"unknown"` — the run engine doesn't yet plumb the real reason
     * into the continuation payload. Future SDK versions will narrow
     * this. Don't branch behavior on it yet.
     */
    cause: "cancelled" | "crashed" | "unknown";
    /**
     * The conversation chain that was successfully persisted by the
     * predecessor's last `onTurnComplete`. Empty if the predecessor died
     * before turn 1 ever completed.
     */
    settledMessages: TUIM[];
    /**
     * User messages that arrived on `session.in` past the cursor — i.e.
     * the message(s) the predecessor was processing or had queued when
     * it died. The runtime's default re-dispatches each as a fresh turn
     * after the chain is restored, except when a `partialAssistant` is
     * present AND there are two or more of them: the first is then
     * spliced into the chain (as the question the partial was answering)
     * rather than dispatched. Return a different list via
     * `recoveredTurns` to skip / reorder / collapse them.
     */
    inFlightUsers: TUIM[];
    /**
     * The trailing assistant message the predecessor was streaming when
     * it died — the orphan whose `turn-complete` never fired. Undefined
     * if the predecessor died before any assistant output reached
     * `session.out` (cancel-before-first-token, snapshot-only path).
     */
    partialAssistant: TUIM | undefined;
    /**
     * Tool calls extracted from `partialAssistant.parts` that the model
     * had started but the tool runtime never resolved. Empty when
     * `partialAssistant` is undefined or carries no `input-available`
     * tool parts.
     */
    pendingToolCalls: RecoveryPendingToolCall[];
    /**
     * Lazy session.out writer — identical to the `writer` passed to
     * `onTurnStart` / `onTurnComplete` / `onChatStart`. Use this to emit
     * a recovery signal (e.g. a `data-chat-recovery` UIMessage chunk)
     * BEFORE the first recovered turn fires so the bridge can render a
     * "recovering..." banner. Lazy: no overhead if unused.
     */
    writer: ChatWriter;
};
/**
 * Return shape for the `onRecoveryBoot` callback. Every field is optional —
 * omit one to accept the default.
 */
export type RecoveryBootResult<TUIM extends UIMessage = UIMessage> = {
    /**
     * The chain the new run boots with. Replaces the default
     * (`settledMessages`). Use this to keep the partial assistant in
     * context, mutate its tool parts to inject synthesized results,
     * collapse history, etc.
     *
     * With `hydrateMessages` or a storage `loadContext`, this chain is what
     * the hook receives as `previousMessages` on the next turn; the hook's
     * return value is the chain the model sees.
     */
    chain?: TUIM[];
    /**
     * The user messages to re-dispatch as fresh turns after the chain is
     * restored. Default: `inFlightUsers.slice(1)` when a
     * `partialAssistant` is present and there are two or more in-flight
     * users (the first one is spliced into the chain instead), otherwise
     * `inFlightUsers` — including the single-user case, where the
     * interrupted user is re-dispatched and the orphan partial is
     * dropped. Return `[]` to suppress all of them; return a filtered /
     * reordered subset to skip specific ones.
     */
    recoveredTurns?: TUIM[];
    /**
     * Awaitable run AFTER the writer flushes and BEFORE the first
     * recovered turn fires. Use for blocking persistence (e.g. write the
     * partial assistant to your DB so a follow-up turn can reference
     * it). Errors bubble — wrap your own try/catch if you want to soft-
     * fail.
     */
    beforeBoot?: () => Promise<void>;
};
/**
 * Event passed to the `onChatStart` callback.
 *
 * Fires exactly once per chat, on the very first user message of the chat's
 * lifetime. Does NOT fire on continuation runs (post-`endRun`,
 * post-waitpoint-timeout, `chat.requestUpgrade`) or on OOM-retry attempts —
 * those are runs of an already-started chat.
 */
export type ChatStartEvent<TClientData = unknown> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /**
     * The initial model-ready messages for this conversation. Typically just
     * the first user message (or empty if `chat.headStart` is in play and the
     * seed message is supplied elsewhere). Since this hook only fires for the
     * chat's very first message, there's no prior history to load here.
     */
    messages: ModelMessage[];
    /** Custom data from the frontend (passed via `metadata` on `sendMessage()` or the transport). */
    clientData: TClientData;
    /** The Trigger.dev run ID for this conversation. */
    runId: string;
    /** A scoped access token for this chat run. Persist this for frontend reconnection. */
    chatAccessToken: string;
    /**
     * @deprecated Always `false` — `onChatStart` no longer fires on continuation
     * runs. Kept for backward compatibility; remove your `continuation` checks
     * from `onChatStart` and rely on the contract (this hook fires exactly once
     * per chat, on the very first message).
     */
    continuation: boolean;
    /**
     * @deprecated Always `undefined` — `onChatStart` no longer fires on
     * continuation runs.
     */
    previousRunId?: string;
    /** Whether this run was preloaded before the first message. */
    preloaded: boolean;
    /** Stream writer — write custom `UIMessageChunk` parts to the chat stream. Lazy: no overhead if unused. */
    writer: ChatWriter;
};
/**
 * Event passed to the `hydrateMessages` callback.
 */
export type HydrateMessagesEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The turn number (0-indexed). */
    turn: number;
    /** The trigger type for this turn. */
    trigger: "submit-message" | "regenerate-message" | "action";
    /** Validated incoming UI messages from the wire payload (what the frontend sent). Empty for actions. */
    incomingMessages: TUIM[];
    /** The accumulated UI messages before this turn (empty on turn 0). */
    previousMessages: TUIM[];
    /** Parsed client data from the transport metadata. */
    clientData?: TClientData;
    /** Whether this run is continuing from a previous run. */
    continuation: boolean;
    /** The ID of the previous run (if continuation). */
    previousRunId?: string;
};
/**
 * Event passed to the `onValidateMessages` callback.
 */
export type ValidateMessagesEvent<TUIM extends UIMessage = UIMessage> = {
    /**
     * The incoming UI messages for this turn (after cleanup of aborted tool parts).
     *
     * For HITL continuations the assistant entry is slim — `state` + `output` /
     * `errorText` / `approval` only, no `input` or other parts. Don't pass the
     * full `messages` array to `validateUIMessages` from `ai`; filter to user
     * messages (or your own subset) first.
     */
    messages: TUIM[];
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The turn number (0-indexed). */
    turn: number;
    /** The trigger type for this turn. */
    trigger: "submit-message" | "regenerate-message" | "preload" | "close";
};
/**
 * Event passed to the `onAction` callback.
 */
export type ActionEvent<TAction = unknown, TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** The parsed and validated action payload. */
    action: TAction;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The turn number (0-indexed). */
    turn: number;
    /** Parsed client data from the transport metadata. */
    clientData?: TClientData;
    /** The accumulated UI messages (after hydration, if set). */
    uiMessages: TUIM[];
    /** The accumulated model messages (after hydration, if set). */
    messages: ModelMessage[];
};
/**
 * Event passed to the `onTurnStart` callback.
 */
export type TurnStartEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The accumulated model-ready messages (all turns so far, including new user message). */
    messages: ModelMessage[];
    /** The accumulated UI messages (all turns so far, including new user message). */
    uiMessages: TUIM[];
    /** The turn number (0-indexed). */
    turn: number;
    /** The Trigger.dev run ID for this conversation. */
    runId: string;
    /** A scoped access token for this chat run. */
    chatAccessToken: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
    /** Whether this run is continuing an existing chat (previous run timed out or was cancelled). False for brand new chats. */
    continuation: boolean;
    /** The run ID of the previous run (only set when `continuation` is true). */
    previousRunId?: string;
    /** Whether this run was preloaded before the first message. */
    preloaded: boolean;
    /** Token usage from the previous turn. Undefined on turn 0. */
    previousTurnUsage?: LanguageModelUsage;
    /** Cumulative token usage across all completed turns so far. */
    totalUsage: LanguageModelUsage;
    /** Stream writer — write custom `UIMessageChunk` parts to the chat stream. Lazy: no overhead if unused. */
    writer: ChatWriter;
};
/**
 * Event passed to the `onTurnComplete` callback.
 */
export type TurnCompleteEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** Task run context — same as `task({ run })` second-argument `ctx`. */
    ctx: TaskRunContext;
    /** The unique identifier for the chat session. */
    chatId: string;
    /** The full accumulated conversation in model format (all turns so far). */
    messages: ModelMessage[];
    /**
     * The full accumulated conversation in UI format (all turns so far).
     * This is the format expected by `useChat` — store this for persistence.
     */
    uiMessages: TUIM[];
    /**
     * Model messages for this turn's user message(s) and complete assistant response,
     * including steps summarized during the turn. Same-ID approval and handover
     * continuations include the full replacement response, so these are not always
     * an append-only delta. Persist `messages` for future model context, or upsert
     * `newUIMessages` by ID for the visible conversation.
     */
    newMessages: ModelMessage[];
    /**
     * New or updated UI messages from this turn (user message(s) + assistant response).
     * Upsert by message ID: approval and handover continuations can replace an
     * existing assistant message.
     */
    newUIMessages: TUIM[];
    /** The assistant's response for this turn, with aborted parts cleaned up when `stopped` is true. Undefined if `pipeChat` was used manually. */
    responseMessage: TUIM | undefined;
    /**
     * The raw assistant response before abort cleanup. Includes incomplete tool parts
     * (`input-available`, `partial-call`) and streaming reasoning/text parts.
     * Use this if you need custom cleanup logic. Same as `responseMessage` when not stopped.
     */
    rawResponseMessage: TUIM | undefined;
    /** The turn number (0-indexed). */
    turn: number;
    /** The Trigger.dev run ID for this conversation. */
    runId: string;
    /** A fresh scoped access token for this chat run (renewed each turn). Persist this for frontend reconnection. */
    chatAccessToken: string;
    /** The last event ID from the stream writer. Use this with `resume: true` to avoid replaying events after refresh. */
    lastEventId?: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
    /** Whether the user stopped generation during this turn. */
    stopped: boolean;
    /** Whether this run is continuing an existing chat (previous run timed out or was cancelled). False for brand new chats. */
    continuation: boolean;
    /** The run ID of the previous run (only set when `continuation` is true). */
    previousRunId?: string;
    /** Whether this run was preloaded before the first message. */
    preloaded: boolean;
    /** Token usage for this turn. Undefined if usage couldn't be captured (e.g. manual pipeChat). */
    usage?: LanguageModelUsage;
    /** Cumulative token usage across all turns in this run (including this turn). */
    totalUsage: LanguageModelUsage;
    /**
     * Why the LLM stopped generating this turn:
     * - `"stop"` — model generated a stop sequence (normal completion)
     * - `"tool-calls"` — model stopped on one or more tool calls. If any tool
     *   has no `execute` function (e.g. an `ask_user` HITL tool), the turn is
     *   paused awaiting user input; inspect `responseMessage.parts` for tool
     *   parts in `input-available` state to distinguish.
     * - `"length"` — max tokens reached
     * - `"content-filter"` — content filter stopped the model
     * - `"error"` — model errored
     * - `"other"` — provider-specific reason
     *
     * Undefined if the underlying stream didn't provide a finish reason (e.g.
     * manual `pipeChat()` or an aborted stream).
     */
    finishReason?: FinishReason;
    /**
     * Set when the turn failed (the `run()` body or a lifecycle hook threw).
     * On an errored turn `responseMessage` is undefined or partial and
     * `finishReason` is `"error"`. Use this to mark the turn failed in your
     * persistence. Undefined on a successful turn.
     */
    error?: unknown;
};
/**
 * Event passed to the `onBeforeTurnComplete` callback.
 * Same as `TurnCompleteEvent` but includes a `writer` since the stream is still open.
 */
export type BeforeTurnCompleteEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = TurnCompleteEvent<TClientData, TUIM> & {
    /** Stream writer — write custom `UIMessageChunk` parts to the chat stream. Lazy: no overhead if unused. */
    writer: ChatWriter;
};
/**
 * Discriminated event passed to the `onChatSuspend` callback.
 * Use `phase` to distinguish preload vs turn suspension.
 */
export type ChatSuspendEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** Suspend is happening after onPreload, before the first message. */
    phase: "preload";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
} | {
    /**
     * Suspend is happening on a continuation run that booted with no incoming
     * message (post-`endRun`, post-waitpoint-timeout, etc.) and is waiting
     * for the next session.in record before running any turn. Distinct from
     * `phase: "preload"` — the chat already started; `onPreload` has not
     * fired and will not fire on this run.
     */
    phase: "continuation";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
} | {
    /** Suspend is happening after a completed turn, waiting for the next message. */
    phase: "turn";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** The turn number (0-indexed) that just completed. */
    turn: number;
    /** The accumulated model messages after the completed turn. */
    messages: ModelMessage[];
    /** The accumulated UI messages after the completed turn. */
    uiMessages: TUIM[];
    /** Custom data from the frontend. */
    clientData?: TClientData;
};
/**
 * Discriminated event passed to the `onChatResume` callback.
 * Use `phase` to distinguish preload vs turn resumption.
 */
export type ChatResumeEvent<TClientData = unknown, TUIM extends UIMessage = UIMessage> = {
    /** First message arrived after preload suspension. */
    phase: "preload";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
} | {
    /**
     * First message arrived after continuation-wait suspension. Distinct
     * from `phase: "preload"` — the chat already started; this is a new
     * run picking up after a prior run ended (`endRun`, waitpoint timeout,
     * etc.).
     */
    phase: "continuation";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** Custom data from the frontend. */
    clientData?: TClientData;
} | {
    /** Next message arrived after turn suspension. */
    phase: "turn";
    /** Task run context. */
    ctx: TaskRunContext;
    /** The chat session ID. */
    chatId: string;
    /** The Trigger.dev run ID. */
    runId: string;
    /** The turn number that was completed before suspension. */
    turn: number;
    /** The accumulated model messages (from before suspension). */
    messages: ModelMessage[];
    /** The accumulated UI messages (from before suspension). */
    uiMessages: TUIM[];
    /** Custom data from the frontend. */
    clientData?: TClientData;
};
export type ChatAgentOptions<TIdentifier extends string, TClientDataSchema extends TaskSchema | undefined = undefined, TUIMessage extends UIMessage = UIMessage, TActionSchema extends TaskSchema | undefined = undefined, TTools extends ToolSet = ToolSet> = Omit<TaskOptions<TIdentifier, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>, "run" | "retry"> & {
    /**
     * Fallback machine preset to use when an attempt fails with an
     * out-of-memory (OOM) error. Setting this enables a single OOM retry:
     * the next attempt boots on the larger machine, and the chat picks
     * up via the standard continuation path (same `chatId` / Session,
     * accumulator rebuilds via `hydrateMessages` or post-`onTurnStart`
     * persisted state).
     *
     * Set `machine` (top-level `TaskOptions`) to control the *default*
     * machine the agent runs on. `oomMachine` is the *retry-only* swap.
     *
     * Note: an OOM retry restarts the entire turn from the top — the
     * model call and any in-flight tool executes re-run on the larger
     * machine. Make tool executes idempotent or persist results before
     * returning if you can't tolerate re-execution.
     *
     * Generic `retry` options are not exposed on `chat.agent` because
     * arbitrary retries against an LLM-driven loop tend to be expensive
     * and side-effecting. If you need richer retry semantics, drop down
     * to `chat.task` (the raw primitive).
     *
     * @example
     * ```ts
     * chat.agent({
     *   id: "my-chat",
     *   machine: "small-1x",
     *   oomMachine: "medium-2x",
     *   run: async ({ messages, signal }) =>
     *     streamText({ model, messages, abortSignal: signal }),
     * });
     * ```
     */
    oomMachine?: MachinePresetName;
    /**
     * What to do when the session's `externalDeploymentId` no longer names the deployment
     * this run is on — after a redeploy re-pins the session, say.
     *
     * - `"follow"` (default) hands the conversation to the pinned deployment at the next
     *   turn boundary, so no `chat.requestUpgrade()` of your own is needed.
     * - `"hold"` stays put until you ask to move. Manual `chat.requestUpgrade()` works either way.
     *
     * Ignored for sessions with no pin, and for sessions using `lockToVersion`.
     */
    versionSkew?: ChatVersionSkewPolicy;
    /**
     * Schema for validating `clientData` from the frontend.
     * Accepts Zod, ArkType, Valibot, or any supported schema library.
     * When provided, `clientData` is parsed and typed in all hooks and `run`.
     *
     * @example
     * ```ts
     * import { z } from "zod";
     *
     * chat.agent({
     *   id: "my-chat",
     *   clientDataSchema: z.object({ model: z.string().optional(), userId: z.string() }),
     *   run: async ({ messages, clientData, ctx, signal }) => {
     *     // clientData is typed as { model?: string; userId: string }
     *     // ctx is the same TaskRunContext as in task({ run: (payload, { ctx }) => ... })
     *   },
     * });
     * ```
     */
    clientDataSchema?: TClientDataSchema;
    /**
     * Schema for validating custom actions sent via `transport.sendAction()`.
     *
     * When the frontend sends `trigger: "action"`, the `action` payload is
     * parsed against this schema before reaching `onAction`. Invalid actions
     * throw and abort the turn.
     *
     * @example
     * ```ts
     * import { z } from "zod";
     *
     * chat.agent({
     *   id: "my-chat",
     *   actionSchema: z.discriminatedUnion("type", [
     *     z.object({ type: z.literal("undo") }),
     *     z.object({ type: z.literal("rollback"), targetMessageId: z.string() }),
     *   ]),
     *   onAction: async ({ action }) => {
     *     if (action.type === "undo") chat.history.slice(0, -2);
     *     if (action.type === "rollback") chat.history.rollbackTo(action.targetMessageId);
     *   },
     *   run: async ({ messages, signal }) => { ... },
     * });
     * ```
     */
    actionSchema?: TActionSchema;
    /**
     * Called when the frontend sends a custom action via `transport.sendAction()`.
     *
     * Actions are not turns. They fire `hydrateMessages` (if configured) and
     * `onAction` only — no `onTurnStart` / `prepareMessages` /
     * `onBeforeTurnComplete` / `onTurnComplete`, no `run()`. Use
     * `chat.history.*` inside `onAction` to mutate state.
     *
     * To answer after the edit, return `chat.turn()`: the edit is applied and
     * snapshotted, then a turn runs on the result with every turn guarantee. An
     * action that returns nothing is a state edit only. Returning anything else
     * is an error; a response can no longer be returned directly.
     */
    onAction?: (event: ActionEvent<[
        TActionSchema
    ] extends [TaskSchema] ? inferSchemaOut<TActionSchema> : unknown, inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void | ActionTurn> | void | ActionTurn;
    /**
     * The tools available to this agent.
     *
     * `chat.agent` doesn't call the model for you. Your tools still go to
     * `streamText({ tools })` inside `run()`. Declaring them here additionally
     * lets the SDK re-run each tool's
     * [`toModelOutput`](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#tomodeloutput)
     * when it re-converts persisted history on later turns. Without this, the
     * AI SDK has no `tools` to look up `toModelOutput` against, so a tool's
     * transformed result (e.g. raw image bytes → an image content part, or a
     * sub-agent summary) silently degrades to its raw JSON output from turn 2
     * onward.
     *
     * Only `inputSchema` and `toModelOutput` are read during conversion (never
     * `execute`), so you may pass a lightweight map if you keep heavy execute
     * deps out of this module.
     *
     * Pass either a static `ToolSet` or a function of per-turn context (for
     * tools that depend on the user, a feature flag, etc.). The resolved set is
     * available on the `run()` payload as `tools`.
     *
     * @example
     * ```ts
     * const tools = { read_file, search };
     * chat.agent({
     *   tools,
     *   run: async ({ messages, tools, signal }) =>
     *     streamText({ model, messages, tools, abortSignal: signal }),
     * });
     * ```
     */
    tools?: TTools | ((event: ResolveToolsEvent<inferSchemaOut<TClientDataSchema>>) => TTools | Promise<TTools>);
    /**
     * The run function for the chat task.
     *
     * Receives a `ChatTaskRunPayload` with the conversation messages, chat session ID,
     * trigger type, task `ctx` (same as `task({ run })`’s second argument), and abort signals
     * (`signal`, `cancelSignal`, `stopSignal`).
     *
     * **Auto-piping:** If this function returns a value with `.toUIMessageStream()`,
     * the stream is automatically piped to the frontend.
     */
    run: (payload: ChatTaskRunPayload<inferSchemaOut<TClientDataSchema>, TTools>) => Promise<unknown>;
    /**
     * Called once at the start of every run boot — for the initial run, for
     * preloaded runs, AND for reactive continuation runs (post-cancel /
     * crash / `endRun` / `requestUpgrade` / OOM retry).
     *
     * Use this for per-process setup that needs to run every time a fresh
     * worker picks up the chat: initialize `chat.local` state, open
     * per-process resources, or re-hydrate customer state from your DB
     * on continuation. Branch on `continuation` to decide whether to load
     * existing state vs. start fresh.
     *
     * Fires BEFORE `onPreload` (preloaded path) and `onChatStart`
     * (first-message path), so `chat.local` is safe to read in those hooks.
     *
     * Does NOT fire when the same run resumes from snapshot via the
     * idle-window suspend/resume path — use `onChatResume` for that.
     *
     * @example
     * ```ts
     * onBoot: async ({ chatId, clientData, continuation }) => {
     *   const user = await db.user.findFirst({ where: { id: clientData.userId } });
     *   userContext.init({ name: user.name, plan: user.plan });
     *   if (continuation) {
     *     // re-hydrate any per-chat in-memory state from your DB
     *   }
     * }
     * ```
     */
    onBoot?: (event: BootEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void;
    /**
     * Recovery boot hook — fires once on a continuation run that inherited
     * in-flight state from a dead predecessor (cancel / crash / OOM /
     * deploy eviction / `chat.requestUpgrade()`). The runtime reads both
     * stream tails past the last `turn-complete` cursor and hands the
     * customer the recovered pieces (settled chain, in-flight users,
     * partial assistant, pending tool calls) so the chain can be shaped
     * before the first recovered turn fires.
     *
     * Does NOT fire when there's nothing to recover — e.g. a clean
     * continuation after `chat.endRun()` with no buffered user, a fresh
     * chat, or an OOM retry on top of a complete snapshot.
     *
     * Fires regardless of who owns the model's context; a `hydrateMessages`
     * hook or a storage `loadContext` receives the recovered tail in
     * `previousMessages` on the next turn.
     *
     * Defaults (returned when the hook is omitted or returns no field):
     *   - With two or more in-flight users, the partial and the user it
     *     was answering are spliced into the chain:
     *     `chain` = `[...settledMessages, inFlightUsers[0], partialAssistant]`
     *     and `recoveredTurns` = `inFlightUsers.slice(1)`.
     *   - Otherwise `chain` = `settledMessages` (drop the orphan partial)
     *     and `recoveredTurns` = `inFlightUsers` (re-dispatch every user)
     *     — so a single interrupted user is answered on the new run.
     *
     * @example
     * ```ts
     * onRecoveryBoot: async ({ partialAssistant, inFlightUsers, writer, cause }) => {
     *   writer.write({
     *     type: "data-chat-recovery",
     *     id: generateId(),
     *     data: { cause, partial: partialAssistant?.id },
     *   });
     *   return {}; // accept defaults: drop partial, re-dispatch users
     * }
     * ```
     */
    onRecoveryBoot?: (event: RecoveryBootEvent<TUIMessage>) => Promise<RecoveryBootResult<TUIMessage> | void> | RecoveryBootResult<TUIMessage> | void;
    /**
     * Called when a preloaded run starts, before the first message arrives.
     *
     * Use this to initialize state, create DB records, and load context early —
     * so everything is ready when the user's first message comes through.
     *
     * @example
     * ```ts
     * onPreload: async ({ ctx, chatId, clientData }) => {
     *   await db.chat.create({ data: { id: chatId } });
     *   userContext.init(await loadUser(clientData.userId));
     * }
     * ```
     */
    onPreload?: (event: PreloadEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void;
    /**
     * Called exactly once per chat, on the very first user message of the
     * chat's lifetime. Does NOT fire on continuation runs (post-`endRun`,
     * post-waitpoint-timeout, `chat.requestUpgrade`) or on OOM-retry attempts —
     * those are runs of an already-started chat.
     *
     * Use this for one-time chat-setup work — creating the Chat DB row,
     * initializing per-chat in-memory state, minting resources tied to the
     * chat's lifetime. Safe to assume no prior history exists here.
     *
     * For per-turn work, use `onTurnStart`.
     *
     * @example
     * ```ts
     * onChatStart: async ({ ctx, chatId, messages, clientData }) => {
     *   await db.chat.create({ data: { id: chatId, userId: clientData.userId } });
     * }
     * ```
     */
    onChatStart?: (event: ChatStartEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void;
    /**
     * Validate or transform incoming UI messages before they are converted to model
     * messages and accumulated. Fires once per turn with the raw `UIMessage[]` from
     * the wire payload (after cleanup of aborted tool parts).
     *
     * Return the validated messages array. Throw to abort the turn with an error.
     *
     * This is the right place to call the AI SDK's `validateUIMessages` on fresh
     * user input. For HITL continuations (`addToolOutput` /
     * `addToolApproveResponse`), the wire carries a slim assistant message — only
     * the resolved tool parts, with `state` + `output` / `errorText` / `approval`
     * and no `input`. `validateUIMessages` against the AI SDK schema rejects
     * that shape, so filter to user messages (or skip validation entirely) on
     * those turns.
     *
     * @example
     * ```ts
     * import { validateUIMessages } from "ai";
     *
     * chat.agent({
     *   id: "my-chat",
     *   onValidateMessages: async ({ messages }) => {
     *     const userMessages = messages.filter((m) => m.role === "user");
     *     if (userMessages.length > 0) {
     *       await validateUIMessages({ messages: userMessages, tools: chatTools });
     *     }
     *     return messages;
     *   },
     *   run: async ({ messages }) => {
     *     return streamText({ model, messages, tools: chatTools });
     *   },
     * });
     * ```
     */
    onValidateMessages?: (event: ValidateMessagesEvent<TUIMessage>) => TUIMessage[] | Promise<TUIMessage[]>;
    /**
     * Load the full message history from your backend on every turn,
     * replacing the built-in linear accumulator.
     *
     * When set, the returned messages become the accumulated state for this turn.
     * The normal accumulation logic (append for submit, replace for regenerate)
     * is skipped entirely — the hook is the source of truth.
     *
     * After the hook returns, any incoming wire messages with matching IDs are
     * auto-merged (handles tool approval responses transparently).
     *
     * Use cases:
     * - Backend trust: prevent clients from injecting fabricated history
     * - Branching conversations (DAGs): load only the active branch
     * - Rollback/undo: exclude undone messages from history
     *
     * @example
     * ```ts
     * chat.agent({
     *   id: "my-chat",
     *   hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
     *     // Persist the new message
     *     const newMsg = incomingMessages[incomingMessages.length - 1];
     *     if (newMsg && trigger === "submit-message") {
     *       await db.chatMessages.create({ chatId, message: newMsg });
     *     }
     *     // Return the full authoritative history
     *     return db.chatMessages.findMany({ where: { chatId } });
     *   },
     *   run: async ({ messages, signal }) => {
     *     return streamText({ model: openai("gpt-4o"), messages, abortSignal: signal });
     *   },
     * });
     * ```
     */
    hydrateMessages?: (event: HydrateMessagesEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => TUIMessage[] | Promise<TUIMessage[]>;
    /**
     * Where the conversation is persisted. The runtime calls `save` after
     * every turn, failed turn and history-changing action with the changes
     * since the last save, and `load` once when a new run boots to continue
     * the conversation.
     *
     * Defaults to `defaultStorage`, the platform's snapshot in object storage
     * that the Sessions dashboard renders. Bring your own to write each change
     * to your database; `memoryTranscriptStorage()` is the reference
     * implementation and `runTranscriptStorageTests` from
     * `@trigger.dev/sdk/ai/test` checks yours against the contract.
     *
     * A storage with `loadContext` also owns the model's context on every
     * turn, which is what `hydrateMessages` did. The two cannot be combined.
     *
     * @example
     * ```ts
     * chat.agent({
     *   id: "my-chat",
     *   storage: myPostgresTranscriptStorage,
     *   run: async ({ messages, signal, streamText }) =>
     *     streamText({ model, messages, abortSignal: signal }),
     * });
     * ```
     */
    storage?: TranscriptStorage<inferSchemaOut<TClientDataSchema>>;
    /**
     * Called at the start of every turn, after message accumulation and `onChatStart` (turn 0),
     * but before the `run` function executes.
     *
     * Use this to persist messages before streaming begins, so a mid-stream page refresh
     * still shows the user's message.
     *
     * @example
     * ```ts
     * onTurnStart: async ({ ctx, chatId, uiMessages }) => {
     *   await db.chat.update({ where: { id: chatId }, data: { messages: uiMessages } });
     * }
     * ```
     */
    onTurnStart?: (event: TurnStartEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void;
    /**
     * Called after the response is captured but before the stream closes.
     * The stream is still open, so you can write custom chunks to the frontend
     * (e.g. compaction progress). Use this for compaction, post-processing,
     * or any work where the user should see real-time status updates.
     *
     * @example
     * ```ts
     * onBeforeTurnComplete: async ({ ctx, writer, usage }) => {
     *   if (usage?.inputTokens && usage.inputTokens > 5000) {
     *     writer.write({ type: "data-compaction", id: generateId(), data: { status: "compacting" } });
     *     // ... compact messages ...
     *     chat.setMessages(compactedMessages);
     *     writer.write({ type: "data-compaction", id: generateId(), data: { status: "complete" } });
     *   }
     * }
     * ```
     */
    onBeforeTurnComplete?: (event: BeforeTurnCompleteEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void;
    /**
     * Called when conversation compaction occurs (via `chat.compact()` or
     * `chat.compactionStep()`). Use for logging, billing, or persisting the summary.
     *
     * @example
     * ```ts
     * onCompacted: async ({ ctx, summary, totalTokens, chatId }) => {
     *   logger.info("Compacted", { totalTokens, chatId });
     *   await db.compactionLog.create({ data: { chatId, summary } });
     * }
     * ```
     */
    onCompacted?: (event: CompactedEvent) => Promise<void> | void;
    /**
     * Automatic context compaction. When provided, compaction runs automatically
     * in both the inner loop (prepareStep, between tool-call steps) and the
     * outer loop (between turns, for single-step responses where prepareStep
     * never fires).
     *
     * The `shouldCompact` callback decides when to compact, and `summarize`
     * generates the summary. The prepareStep is auto-injected into
     * `chat.toStreamTextOptions()` — if you provide your own `prepareStep`
     * after spreading, it overrides the auto-injected one.
     *
     * @example
     * ```ts
     * chat.agent({
     *   id: "my-chat",
     *   compaction: {
     *     shouldCompact: ({ totalTokens }) => (totalTokens ?? 0) > 80_000,
     *     summarize: async (messages) =>
     *       generateText({ model, messages: [...messages, { role: "user", content: "Summarize." }] })
     *         .then((r) => r.text),
     *   },
     *   run: async ({ messages, signal }) => {
     *     return streamText({ ...chat.toStreamTextOptions({ registry }), messages });
     *   },
     * });
     * ```
     */
    /**
     * A provider registry, so the runtime can resolve the managed prompt's model
     * for the `streamText` it hands to `run()`. Only needed when you set a model
     * through `chat.prompt.set()` and want the bound `streamText` to honour it.
     */
    registry?: ToStreamTextOptionsOptions["registry"];
    /**
     * The agent's system prompt. Injected instructions append to it, and the
     * `streamText` handed to `run()` carries it without a spread.
     *
     * Set it here, at the call site, or through `chat.prompt.set()` for versioned
     * config, but only in one of them.
     */
    system?: ToStreamTextOptionsOptions["system"];
    /**
     * Mark the system prompt for provider-side caching, the same sugar
     * `chat.toStreamTextOptions({ cacheControl })` takes. See
     * [prompt caching](/ai-chat/prompt-caching).
     */
    cacheControl?: ToStreamTextOptionsOptions["cacheControl"];
    /**
     * Provider options for the system block, when `cacheControl` is not enough.
     * Takes precedence over `cacheControl`.
     */
    systemProviderOptions?: ToStreamTextOptionsOptions["systemProviderOptions"];
    compaction?: ChatAgentCompactionOptions<TUIMessage>;
    /**
     * Configure how messages that arrive during streaming are handled.
     *
     * By default, messages queue for the next turn. When `shouldInject` is provided
     * and returns `true`, messages are injected between tool-call steps via
     * `prepareStep` — allowing users to steer the agent mid-execution.
     *
     * @example
     * ```ts
     * pendingMessages: {
     *   shouldInject: ({ steps }) => steps.length > 0,
     *   onReceived: ({ message }) => logger.info("Steering message received"),
     * },
     * ```
     */
    pendingMessages?: PendingMessagesOptions<TUIMessage>;
    /**
     * Called after each assistant response completes. Use to persist the
     * conversation to your database after each assistant response.
     *
     * @example
     * ```ts
     * onTurnComplete: async ({ ctx, chatId, messages }) => {
     *   await db.chat.update({ where: { id: chatId }, data: { messages } });
     * }
     * ```
     */
    onTurnComplete?: (event: TurnCompleteEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void;
    /**
     * Maximum number of conversational turns (message round-trips) a single run
     * will handle before ending. After this many turns the run completes
     * normally and the next message will start a fresh run.
     *
     * @default 100
     */
    maxTurns?: number;
    /**
     * How long to wait for the next message before timing out and ending the run.
     * Accepts any duration string (e.g. `"1h"`, `"30m"`).
     *
     * @default "1h"
     */
    turnTimeout?: string;
    /**
     * How long (in seconds) the run stays idle (active, using compute) after each
     * turn, waiting for the next message. During this window responses are instant.
     * After this timeout the run suspends (frees compute) and waits via
     * `inputStream.wait()`.
     *
     * Set to `0` to suspend immediately after each turn.
     *
     * @default 30
     */
    idleTimeoutInSeconds?: number;
    /**
     * How long the `chatAccessToken` (scoped to this run) remains valid.
     * A fresh token is minted after each turn, so this only needs to cover
     * the gap between turns.
     *
     * Accepts a duration string (e.g. `"1h"`, `"30m"`, `"2h"`).
     *
     * @default "1h"
     */
    chatAccessTokenTTL?: string;
    /**
     * How long (in seconds) the run stays idle after `onPreload` fires,
     * waiting for the first message before suspending.
     *
     * Only applies to preloaded runs (triggered via `transport.preload()`).
     * Takes precedence over `transport.preload(..., { idleTimeoutInSeconds })`
     * and over {@link ChatAgentOptions.idleTimeoutInSeconds}.
     *
     * @default Same as `idleTimeoutInSeconds`
     */
    preloadIdleTimeoutInSeconds?: number;
    /**
     * How long to wait (suspended) for the first message after a preloaded run starts.
     * If no message arrives within this time, the run ends.
     *
     * Only applies to preloaded runs.
     *
     * @default Same as `turnTimeout`
     */
    preloadTimeout?: string;
    /**
     * Transform model messages before they're used anywhere — in `run()`,
     * in compaction rebuilds, and in compaction results.
     *
     * Define once, applied everywhere. Use for Anthropic cache breaks,
     * injecting system context, stripping PII, etc.
     *
     * @example
     * ```ts
     * prepareMessages: async ({ messages, reason }) => {
     *   // Add Anthropic cache breaks to the last message
     *   if (messages.length === 0) return messages;
     *   const last = messages[messages.length - 1];
     *   return [...messages.slice(0, -1), {
     *     ...last,
     *     providerOptions: { ...last.providerOptions, anthropic: { cacheControl: { type: "ephemeral" } } },
     *   }];
     * }
     * ```
     */
    prepareMessages?: (event: PrepareMessagesEvent<inferSchemaOut<TClientDataSchema>>) => ModelMessage[] | Promise<ModelMessage[]>;
    /**
     * Default options for `toUIMessageStream()` when auto-piping or using
     * `turn.complete()` / `chat.pipeAndCapture()`.
     *
     * Controls how the `StreamTextResult` is converted to a `UIMessageChunk`
     * stream — error handling, reasoning/source visibility, metadata, etc.
     *
     * Can be overridden per-turn by calling `chat.setUIMessageStreamOptions()`
     * inside `run()` or lifecycle hooks. Per-turn values are merged on top
     * of these defaults (per-turn wins on conflicts).
     *
     * `onFinish` and `originalMessages` are managed internally and cannot be
     * overridden here. Use `streamText`'s `onFinish` for custom finish
     * handling. `generateMessageId` can be set to control response message
     * ID generation (e.g. UUID-v7).
     *
     * @example
     * ```ts
     * chat.agent({
     *   id: "my-chat",
     *   uiMessageStreamOptions: {
     *     sendReasoning: true,
     *     onError: (error) => error instanceof Error ? error.message : "An error occurred.",
     *   },
     *   run: async ({ messages, signal }) => { ... },
     * });
     * ```
     */
    uiMessageStreamOptions?: ChatUIMessageStreamOptions<TUIMessage>;
    /**
     * Called right before the run suspends to wait for a message.
     *
     * The `phase` discriminator tells you when the suspend happened:
     * - `"preload"`: after `onPreload`, waiting for the first message
     * - `"turn"`: after `onTurnComplete`, waiting for the next message
     *
     * Use this for cleanup before suspension (e.g. disposing sandboxes, closing connections).
     *
     * @example
     * ```ts
     * onChatSuspend: async (event) => {
     *   await disposeExpensiveResources(event.ctx.run.id);
     *   if (event.phase === "turn") {
     *     logger.info("Suspending after turn", { turn: event.turn });
     *   }
     * }
     * ```
     */
    onChatSuspend?: (event: ChatSuspendEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void;
    /**
     * Called right after the run resumes from suspension with a new message.
     *
     * The `phase` discriminator tells you when the resume happened:
     * - `"preload"`: first message arrived after preload suspension
     * - `"turn"`: next message arrived after turn suspension
     *
     * Use this for re-initialization after wake (e.g. warming caches, reconnecting).
     *
     * @example
     * ```ts
     * onChatResume: async (event) => {
     *   warmCache(event.ctx.run.id);
     *   if (event.phase === "turn") {
     *     logger.info("Resumed after turn", { turn: event.turn });
     *   }
     * }
     * ```
     */
    onChatResume?: (event: ChatResumeEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void;
    /**
     * When `true`, the run exits successfully after the preload idle timeout
     * instead of suspending and waiting. The run completes with no turn executed.
     *
     * Use this for "fire and forget" preloads where you only want to do eager
     * initialization. If the user doesn't send a message during the idle window,
     * the run ends cleanly.
     *
     * Only applies to preloaded runs (triggered via `transport.preload()`).
     *
     * @default false
     */
    exitAfterPreloadIdle?: boolean;
};
/**
 * Creates a Trigger.dev task pre-configured for AI SDK chat.
 *
 * - **Pre-types the payload** as `ChatTaskRunPayload` — includes abort signals
 * - **Auto-pipes the stream** if `run` returns a `StreamTextResult`
 * - **Multi-turn**: keeps the conversation in a single run using input streams
 * - **Stop support**: frontend can stop generation mid-stream via the stop input stream
 * - For complex flows, use `pipeChat()` from anywhere inside your task code
 *
 * @example
 * ```ts
 * import { chat } from "@trigger.dev/sdk/ai";
 * import { streamText, convertToModelMessages } from "ai";
 * import { openai } from "@ai-sdk/openai";
 *
 * export const myChat = chat.agent({
 *   id: "my-chat",
 *   run: async ({ messages, signal }) => {
 *     return streamText({
 *       model: openai("gpt-4o"),
 *       messages, // already converted via convertToModelMessages
 *       abortSignal: signal,
 *     });
 *   },
 * });
 * ```
 */
type ChatCustomAgentOptions<TIdentifier extends string, TClientDataSchema extends TaskSchema | undefined = undefined, TUIMessage extends UIMessage = UIMessage> = Omit<TaskOptions<TIdentifier, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>, "triggerSource" | "agentConfig" | "run"> & {
    /**
     * Schema for validating `metadata` from the frontend.
     *
     * The initial payload and later `chat.messages` frames are parsed before
     * user code receives them. Invalid submitted turns and async reads write an
     * error chunk followed by `turn-complete`. Messageless boots and active
     * subscriptions use `onClientDataValidationError` and the task log because
     * there is no submitted turn to complete or a response may still be streaming.
     * This validates `metadata` only; raw `action` payloads remain `unknown`.
     */
    clientDataSchema?: TClientDataSchema;
    /**
     * Called when a custom-agent input fails `clientDataSchema` validation.
     *
     * Submitted turns and async reads also write an error chunk followed by
     * `turn-complete`. Messageless boots and active `chat.messages.on()`
     * subscriptions are reported through this callback and the task log only.
     *
     * `payload.metadata` is typed `unknown`: this callback only fires when
     * the metadata failed to parse, so it can be any shape the client sent.
     */
    onClientDataValidationError?: (event: {
        error: unknown;
        payload: ChatTaskWirePayload<TUIMessage, unknown>;
    }) => Promise<void> | void;
    /**
     * When a frame that arrived mid-turn fails `clientDataSchema` validation,
     * decides when the terminal error reaches the client.
     *
     * - `"turn-end"` (default) waits until the turn has closed. A terminal error
     *   written into a live response can close it, so this keeps a bad client
     *   send from truncating an answer the user is already reading.
     * - `"arrival"` writes it as soon as validation fails, which surfaces the
     *   problem sooner at the cost of ending the response in progress.
     *
     * `onClientDataValidationError` and the task log fire on arrival either way;
     * this only governs the stream-visible error. The frame is never delivered as
     * a turn in either mode.
     */
    clientDataReportErrorAt?: "turn-end" | "arrival";
    run: TaskOptions<TIdentifier, ChatTaskWirePayload<TUIMessage, inferSchemaOut<TClientDataSchema>>, unknown>["run"];
};
declare function chatCustomAgent<TIdentifier extends string, TClientDataSchema extends TaskSchema | undefined = undefined, TUIMessage extends UIMessage = UIMessage>(options: ChatCustomAgentOptions<TIdentifier, TClientDataSchema, TUIMessage>): Task<TIdentifier, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>;
declare function chatAgent<TIdentifier extends string, TClientDataSchema extends TaskSchema | undefined = undefined, TUIMessage extends UIMessage = UIMessage, TActionSchema extends TaskSchema | undefined = undefined, TTools extends ToolSet = ToolSet>(options: ChatAgentOptions<TIdentifier, TClientDataSchema, TUIMessage, TActionSchema, TTools>): Task<TIdentifier, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>;
/**
 * Optional config for {@link chat.withUIMessage}. `streamOptions` become default
 * static `toUIMessageStream()` settings; inner `chat.agent({ uiMessageStreamOptions })`
 * shallow-merges on top (task wins on conflicts).
 */
export type ChatWithUIMessageConfig<TUIM extends UIMessage = UIMessage> = {
    streamOptions?: ChatUIMessageStreamOptions<TUIM>;
};
/**
 * A chainable builder for configuring chat tasks with fixed UI message types,
 * client data schemas, and builder-level hooks that compose with task-level hooks.
 *
 * Obtain a builder via {@link chat.withUIMessage} or {@link chat.withClientData}.
 *
 * @example
 * ```ts
 * export const myChat = chat
 *   .withUIMessage<AgentUiMessage>({ streamOptions: { sendReasoning: true } })
 *   .withClientData({ schema: z.object({ userId: z.string() }) })
 *   .onChatSuspend(async ({ ctx }) => { await disposeResources(ctx.run.id) })
 *   .task({
 *     id: "my-chat",
 *     run: async ({ messages, signal }) => streamText({ model, messages, abortSignal: signal }),
 *   });
 * ```
 */
export interface ChatBuilder<TUIMessage extends UIMessage = UIMessage, TClientDataSchema extends TaskSchema | undefined = undefined> {
    /** Fix the UI message type. Returns a new builder preserving all accumulated state. */
    withUIMessage<TUIM extends UIMessage = UIMessage>(config?: ChatWithUIMessageConfig<TUIM>): ChatBuilder<TUIM, TClientDataSchema>;
    /**
     * Fix the client data schema, and how validation failures are handled.
     * Returns a new builder preserving all accumulated state.
     */
    withClientData<TSchema extends TaskSchema>(config: {
        schema: TSchema;
        /**
         * When a frame that arrived mid-turn fails validation, decides when the
         * client-visible error is written.
         *
         * `"turn-end"` (default) waits for the turn to close, so a bad send cannot
         * truncate an answer already being read. `"arrival"` writes it as soon as
         * validation fails, ending the response in progress.
         *
         * `onValidationError` and the task log fire on arrival either way, and the
         * frame is never delivered as a turn.
         */
        reportErrorAt?: "turn-end" | "arrival";
        /** Called when an input fails validation. Composes with the task-level hook. */
        onValidationError?: (event: {
            error: unknown;
            payload: ChatTaskWirePayload<TUIMessage, unknown>;
        }) => Promise<void> | void;
    }): ChatBuilder<TUIMessage, TSchema>;
    /** Register a builder-level `onBoot` hook. Runs before the task-level hook if both are set. */
    onBoot(fn: (event: BootEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onPreload` hook. Runs before the task-level hook if both are set. */
    onPreload(fn: (event: PreloadEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onChatStart` hook. Runs before the task-level hook if both are set. */
    onChatStart(fn: (event: ChatStartEvent<inferSchemaOut<TClientDataSchema>>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onTurnStart` hook. Runs before the task-level hook if both are set. */
    onTurnStart(fn: (event: TurnStartEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onBeforeTurnComplete` hook. Runs before the task-level hook if both are set. */
    onBeforeTurnComplete(fn: (event: BeforeTurnCompleteEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onTurnComplete` hook. Runs before the task-level hook if both are set. */
    onTurnComplete(fn: (event: TurnCompleteEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onCompacted` hook. Runs before the task-level hook if both are set. */
    onCompacted(fn: (event: CompactedEvent) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onChatSuspend` hook. Runs before the task-level hook if both are set. */
    onChatSuspend(fn: (event: ChatSuspendEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /** Register a builder-level `onChatResume` hook. Runs before the task-level hook if both are set. */
    onChatResume(fn: (event: ChatResumeEvent<inferSchemaOut<TClientDataSchema>, TUIMessage>) => Promise<void> | void): ChatBuilder<TUIMessage, TClientDataSchema>;
    /**
     * Create the chat agent with the accumulated builder configuration.
     *
     * When `withClientData` was called, `clientDataSchema` is injected automatically
     * and omitted from options. Otherwise, it can still be set directly in options
     * (backwards compatible).
     */
    agent: [TClientDataSchema] extends [undefined] ? <TId extends string, TInfer extends TaskSchema | undefined = undefined, TAction extends TaskSchema | undefined = undefined, TTools extends ToolSet = ToolSet>(options: ChatAgentOptions<TId, TInfer, TUIMessage, TAction, TTools>) => Task<TId, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TInfer>>, unknown> : <TId extends string, TAction extends TaskSchema | undefined = undefined, TTools extends ToolSet = ToolSet>(options: Omit<ChatAgentOptions<TId, TClientDataSchema, TUIMessage, TAction, TTools>, "clientDataSchema">) => Task<TId, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>;
    /**
     * Create a custom agent with manual lifecycle control.
     *
     * The agent appears in the playground but you manage the turn loop,
     * message waiting, and streaming yourself using composable primitives
     * (`chat.messages`, `chat.MessageAccumulator`, `chat.pipeAndCapture`, etc.).
     *
     * Builder hooks (`onPreload`, `onChatStart`, etc.) are not applied —
     * those are managed-lifecycle concepts handled by `.agent()`.
     */
    customAgent: [TClientDataSchema] extends [undefined] ? <TId extends string>(options: ChatCustomAgentOptions<TId, undefined, TUIMessage>) => Task<TId, ChatTaskWirePayload<TUIMessage, undefined>, unknown> : <TId extends string>(options: Omit<ChatCustomAgentOptions<TId, TClientDataSchema, TUIMessage>, "clientDataSchema">) => Task<TId, ChatTaskWirePayload<TUIMessage, inferSchemaIn<TClientDataSchema>>, unknown>;
}
/**
 * Fix the UI message type for a chat task (AI SDK `UIMessage` generics) while
 * keeping `id` and `clientDataSchema` inference on the inner {@link chat.agent} call.
 *
 * Returns a {@link ChatBuilder} that supports chaining `.withClientData()`,
 * hook methods (`.onPreload()`, `.onChatSuspend()`, etc.), and `.task()`.
 *
 * @example
 * ```ts
 * type AgentUiMessage = UIMessage<unknown, UIDataTypes, UITools>;
 *
 * export const myChat = chat.withUIMessage<AgentUiMessage>({
 *   streamOptions: { sendReasoning: true },
 * }).task({
 *   id: "my-chat",
 *   run: async ({ messages, signal }) => { ... },
 * });
 * ```
 */
declare function withUIMessage<TUIM extends UIMessage = UIMessage>(config?: ChatWithUIMessageConfig<TUIM>): ChatBuilder<TUIM, undefined>;
/**
 * Fix the client data schema for a chat task, providing typed `clientData`
 * in all hooks and the `run` function.
 *
 * Returns a {@link ChatBuilder} that supports chaining `.withUIMessage()`,
 * hook methods (`.onPreload()`, `.onChatSuspend()`, etc.), and `.task()`.
 *
 * @example
 * ```ts
 * export const myChat = chat
 *   .withClientData({ schema: z.object({ userId: z.string() }) })
 *   .task({
 *     id: "my-chat",
 *     onPreload: async ({ clientData }) => {
 *       // clientData is typed as { userId: string }
 *     },
 *     run: async ({ messages, signal }) => { ... },
 *   });
 * ```
 */
declare function withClientData<TSchema extends TaskSchema>(config: {
    schema: TSchema;
    reportErrorAt?: "turn-end" | "arrival";
    onValidationError?: ChatCustomAgentClientDataErrorHandler;
}): ChatBuilder<UIMessage, TSchema>;
/**
 * Override the turn timeout for subsequent turns in the current run.
 *
 * The turn timeout controls how long the run stays suspended (freeing compute)
 * waiting for the next user message. When it expires, the run completes
 * gracefully and the next message starts a fresh run.
 *
 * Call from inside a `chatAgent` run function to adjust based on context.
 *
 * @param duration - A duration string (e.g. `"5m"`, `"1h"`, `"30s"`)
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setTurnTimeout("2h");
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
declare function setTurnTimeout(duration: string): void;
/**
 * Override the turn timeout in seconds for subsequent turns in the current run.
 *
 * @param seconds - Number of seconds to wait for the next message before ending the run
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setTurnTimeoutInSeconds(3600); // 1 hour
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
declare function setTurnTimeoutInSeconds(seconds: number): void;
/**
 * Override the idle timeout for subsequent turns in the current run.
 *
 * The idle timeout controls how long the run stays active (using compute)
 * after each turn, waiting for the next message. During this window,
 * responses are instant. After it expires, the run suspends.
 *
 * @param seconds - Number of seconds to stay idle (0 to suspend immediately)
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setIdleTimeoutInSeconds(60);
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
declare function setIdleTimeoutInSeconds(seconds: number): void;
/**
 * Override the `toUIMessageStream()` options for the current turn.
 *
 * These options control how the `StreamTextResult` is converted to a
 * `UIMessageChunk` stream — error handling, reasoning/source visibility,
 * message metadata, etc.
 *
 * Per-turn options are merged on top of the static `uiMessageStreamOptions`
 * set on `chat.agent()`. Per-turn values win on conflicts.
 *
 * @example
 * ```ts
 * run: async ({ messages, signal }) => {
 *   chat.setUIMessageStreamOptions({
 *     sendReasoning: true,
 *     onError: (error) => error instanceof Error ? error.message : "An error occurred.",
 *   });
 *   return streamText({ model, messages, abortSignal: signal });
 * }
 * ```
 */
declare function setUIMessageStreamOptions(options: ChatUIMessageStreamOptions<UIMessage>): void;
/**
 * Check whether the user stopped generation during the current turn.
 *
 * Works from **anywhere** inside a `chat.agent` run — including inside
 * `streamText`'s `onFinish` callback — without needing to thread the
 * `stopSignal` through closures.
 *
 * This is especially useful when the AI SDK's `isAborted` flag is unreliable
 * (e.g. when using `createUIMessageStream` + `writer.merge()`).
 *
 * @example
 * ```ts
 * onFinish: ({ isAborted }) => {
 *   const wasStopped = isAborted || chat.isStopped();
 *   if (wasStopped) {
 *     // handle stop
 *   }
 * }
 * ```
 */
declare function isStopped(): boolean;
/**
 * Hand the conversation over to another deployment.
 *
 * The handover happens immediately and server-side: a successor run is created
 * and picks the conversation up from `session.in`. The transport keeps reading
 * the same session output, so no client action is needed and nothing waits for
 * the next message.
 *
 * Without a target the session's pin is cleared, so the successor lands on the
 * latest deployed version; with `externalDeploymentId` the session is re-pinned
 * to that deployment.
 *
 * When called from `onTurnStart` or `onValidateMessages`, `run()` is skipped
 * entirely and the successor answers the message that opened the turn.
 *
 * When called from `run()` or `chat.defer()`, the current turn completes
 * normally and the handover happens afterward.
 *
 * Call from `onTurnStart`, `onValidateMessages`, `onChatResume`, `run()`,
 * or inside `chat.defer()`.
 *
 * @example
 * ```ts
 * const SUPPORTED_VERSIONS = new Set(["v2", "v3"]);
 *
 * chat.agent({
 *   id: "my-chat",
 *   onTurnStart: async ({ clientData }) => {
 *     if (clientData?.protocolVersion && !SUPPORTED_VERSIONS.has(clientData.protocolVersion)) {
 *       chat.requestUpgrade();
 *     }
 *   },
 *   run: async ({ messages }) => { ... },
 * });
 * ```
 */
declare function requestUpgrade(options?: {
    externalDeploymentId?: string;
}): void;
/**
 * Hand off the current custom agent Session to a fresh run.
 *
 * This is the low-level handoff for a fully hand-rolled
 * `chat.customAgent()` loop. This method rejects while a
 * `chat.createSession()` iterator is active. Close the iterator before calling
 * it. If `return()` races an active `next()`, it waits for that read to settle
 * before releasing the handoff guard. Call only between turns and after
 * detaching input listeners for the old run. If the old run completed its
 * current turn, persist its state and call {@link chatWriteTurnComplete} before
 * handing off.
 * Do not write a new turn boundary after input that the continuation run should
 * process has been dispatched: the boundary acknowledges that input.
 *
 * The server starts the continuation run but does not stop this run, so return
 * from the task immediately after awaiting this function. The promise rejects
 * if the server cannot complete the handoff.
 *
 * Pending Session input that the old run has not consumed remains on the
 * durable `.in` stream and is delivered to the continuation run.
 *
 * @example
 * ```ts
 * // Detach any chat.messages.on() subscriptions you created.
 * await persistMessages();
 * await chat.writeTurnComplete();
 * await chat.endAndContinue();
 * return;
 * ```
 */
declare function endAndContinue(): Promise<void>;
/**
 * Exit the run after the current turn completes, without waiting for the
 * next message. Unlike {@link requestUpgrade}, no upgrade-required signal
 * is sent to the client — the turn finishes normally, `onTurnComplete`
 * fires, and the loop exits instead of going idle.
 *
 * Call from `run()`, `chat.defer()`, `onBeforeTurnComplete`, or
 * `onTurnComplete` to end the run on your own terms (budget exhausted,
 * task complete, goal achieved, etc.).
 *
 * The next user message on the same `chatId` starts a fresh run via the
 * normal continuation mechanism.
 *
 * @example
 * ```ts
 * chat.agent({
 *   id: "one-shot-agent",
 *   run: async ({ messages, signal }) => {
 *     const result = streamText({ model: openai("gpt-4o"), messages, abortSignal: signal });
 *     // Single-response agent — exit after this turn.
 *     chat.endRun();
 *     return result;
 *   },
 * });
 * ```
 */
declare function endRun(): void;
/**
 * End the whole conversation, permanently. The session row is closed, further
 * appends are refused, and the run exits without scheduling a continuation.
 *
 * This is the session-level stop. {@link endRun} ends the current run and lets
 * the next message start a fresh one; `chat.close()` ends the session itself,
 * so there is no next message. Use it for a budget cap, a completed goal,
 * abuse detection, or a user signing out.
 *
 * In a `chat.agent`, call it from `run()`, `prepareStep`, or
 * `onBeforeTurnComplete`. Called mid-step, it aborts the in-flight
 * `streamText` the same way the stop signal does, so the partial response is
 * still captured and streamed. The turn then completes normally, a terminal
 * `session-closed` record carrying `reason` is written to the response stream,
 * and the loop exits.
 *
 * Prefer `onBeforeTurnComplete` over `onTurnComplete`. It carries the same
 * fields but still runs while the stream is open, so the closed state rides
 * out on the turn's final record. `onTurnComplete` runs after that record, so
 * a close decided there does not reach a reader that has already finished the
 * turn, and the user only finds out when their next message is refused.
 *
 * In a `chat.customAgent`, call it anywhere in your own loop. The close is
 * performed when `run()` returns, so it lands whether you break out of a
 * `chat.createSession` loop, return early, or hand-roll the loop entirely.
 *
 * Closing is one-way: a closed session cannot be reopened. Its transcript
 * stays readable.
 *
 * @example
 * ```ts
 * chat.agent({
 *   id: "budgeted-agent",
 *   onBeforeTurnComplete: async ({ usage }) => {
 *     if (await overBudget(usage)) {
 *       chat.close({ reason: "Monthly budget reached" });
 *     }
 *   },
 * });
 * ```
 */
declare function close(options?: {
    reason?: string;
}): void;
/**
 * Register a promise that runs in the background during the current turn.
 *
 * Use this to move non-blocking work (DB writes, analytics, etc.) out of
 * the critical path. The promise runs in parallel with streaming and is
 * awaited (with a 5 s timeout) before `onTurnComplete` fires.
 *
 * @example
 * ```ts
 * onTurnStart: async ({ chatId, uiMessages }) => {
 *   // Pass a promise directly
 *   chat.defer(db.chat.update({ where: { id: chatId }, data: { messages: uiMessages } }));
 *
 *   // Or pass an async function — cleaner for multi-step work
 *   chat.defer(async () => {
 *     const flags = await getFeatureFlags();
 *     if (flags.forceUpgrade) chat.requestUpgrade();
 *   });
 * },
 * ```
 */
declare function chatDefer(promiseOrFn: Promise<unknown> | (() => Promise<unknown>)): void;
/**
 * Queue model messages for injection at the next `prepareStep` boundary.
 *
 * Use this to inject context from background work into the agent's conversation.
 * Messages are appended to the model messages before the next LLM inference call.
 *
 * Combine with `chat.defer()` to run background analysis and inject results:
 *
 * @example
 * ```ts
 * onTurnComplete: async ({ messages }) => {
 *   chat.defer((async () => {
 *     const review = await generateObject({
 *       model: openai("gpt-4o-mini"),
 *       messages: [...messages, { role: "user", content: "Review the last response." }],
 *       schema: z.object({ suggestions: z.array(z.string()) }),
 *     });
 *     if (review.object.suggestions.length > 0) {
 *       chat.inject([{
 *         role: "system",
 *         content: `Improvements for next response:\n${review.object.suggestions.join("\n")}`,
 *       }]);
 *     }
 *   })());
 * },
 * ```
 */
declare function injectBackgroundContext(messages: ModelMessage[]): void;
/**
 * Clean up a UIMessage that was captured during an aborted/stopped turn.
 *
 * When generation is stopped mid-stream, the captured message may contain:
 * - Tool parts stuck in incomplete states (`partial-call`, `input-available`,
 *   `input-streaming`) that cause permanent UI spinners
 * - Reasoning parts with `state: "streaming"` instead of `"done"`
 * - Text parts with `state: "streaming"` instead of `"done"`
 *
 * This function returns a cleaned copy with:
 * - Incomplete tool parts removed entirely
 * - Reasoning and text parts marked as `"done"`
 *
 * `chat.agent` calls this automatically when stop is detected before passing
 * the response to `onTurnComplete`. Use this manually when calling `pipeChat`
 * directly and capturing response messages yourself.
 *
 * @example
 * ```ts
 * onTurnComplete: async ({ responseMessage, stopped }) => {
 *   // Already cleaned automatically by chat.agent — but if you captured
 *   // your own message via pipeChat, clean it manually:
 *   const cleaned = chat.cleanupAbortedParts(myMessage);
 *   await db.messages.save(cleaned);
 * }
 * ```
 */
declare function cleanupAbortedParts<TUIM extends UIMessage>(message: TUIM): TUIM;
/**
 * Create a managed stop signal wired to the chat stop input stream.
 *
 * Call once at the start of your run. Use `signal` as the abort signal for
 * `streamText`. Call `reset()` at the start of each turn to get a fresh
 * per-turn signal. Call `cleanup()` when the run ends.
 *
 * @example
 * ```ts
 * const stop = chat.createStopSignal();
 * for (let turn = 0; turn < 100; turn++) {
 *   stop.reset();
 *   const result = streamText({ model, messages, abortSignal: stop.signal });
 *   await chat.pipe(result);
 *   // ...
 * }
 * stop.cleanup();
 * ```
 */
declare function createStopSignal(): {
    readonly signal: AbortSignal;
    reset: () => void;
    cleanup: () => void;
};
/**
 * Signal the frontend that the current turn is complete.
 *
 * The `TriggerChatTransport` intercepts this to close the ReadableStream
 * for the current turn. Call after piping the response stream.
 *
 * Returns two resume cursors for the turn boundary, both saveable from the
 * task instead of round-tripping them back from the client:
 * - `lastEventId` — the turn-complete control record's seq_num on
 *   `session.out`; where the next turn's output stream resumes.
 * - `sessionInEventId` — the safe-to-resume-from cursor on `session.in` as of
 *   this turn-complete. It is the highest sequence that can be resumed past
 *   without skipping an unhandled message, so it is held back behind any
 *   message still buffered unconsumed and is NOT necessarily the sequence of
 *   the record this turn answered. Trigger owns input-cursor recovery, so this
 *   is for correlation / out-of-sync detection, not required. Treat it as a
 *   lower bound: a value below the record you just handled is expected, not a
 *   sign of a lost turn.
 *
 * Either is `undefined` when the corresponding cursor isn't available.
 *
 * @example
 * ```ts
 * await chat.pipe(result);
 * const { lastEventId, sessionInEventId } = await chat.writeTurnComplete();
 * await db.chats.update(chatId, { lastEventId, sessionInEventId });
 * ```
 */
declare function chatWriteTurnComplete(options?: {
    publicAccessToken?: string;
}): Promise<{
    lastEventId?: string;
    sessionInEventId?: string;
}>;
/**
 * The outcome of a turn's stream, reported by {@link pipeChatAndCapture}.
 *
 * - `complete` — the stream finished on its own.
 * - `aborted` — the stream was stopped via the `signal` (user stop / cancel).
 * - `error` — the stream threw; `error` carries what was thrown.
 *
 * `message` holds whatever the assistant produced and is present for every
 * status — including `aborted` and `error` — as long as any output streamed
 * before the stop or failure, so partial responses are never lost.
 */
export type PipeAndCaptureResult = {
    /** The captured assistant message, or `undefined` if nothing streamed. */
    message: UIMessage | undefined;
    /** Coarse outcome of the stream. */
    status: "complete" | "aborted" | "error";
    /** The AI SDK finish reason, when the stream reported one. */
    finishReason?: FinishReason;
    /** What the stream threw, present only when `status === "error"`. */
    error?: unknown;
};
/**
 * Pipe a `StreamTextResult` (or similar) to the chat stream and capture
 * the assistant's response message via `onFinish`.
 *
 * Combines `toUIMessageStream()` + `onFinish` callback + `chat.pipe()`.
 * Never throws on a stopped or failed stream: it returns a
 * {@link PipeAndCaptureResult} whose `message` holds any partial output
 * captured before the stop/failure, alongside a typed `status` (and `error`
 * on failure). Save the partial after a stop or error without separate
 * capture logic.
 *
 * @example
 * ```ts
 * const result = streamText({ model, messages, abortSignal: signal });
 * const { message, status, error } = await chat.pipeAndCapture(result, { signal });
 * if (message) conversation.addResponse(message);
 * if (status === "error") logger.error("turn failed", { error });
 * ```
 */
declare function pipeChatAndCapture(source: UIMessageStreamable, options?: {
    signal?: AbortSignal;
    spanName?: string;
    originalMessages?: UIMessage[];
}): Promise<PipeAndCaptureResult>;
/**
 * Accumulates conversation messages across turns.
 *
 * Handles the transport protocol: turn 0 sends full history (replace),
 * subsequent turns send only new messages (append), regenerate sends
 * full history minus last assistant message (replace).
 *
 * @example
 * ```ts
 * const conversation = new chat.MessageAccumulator();
 * for (let turn = 0; turn < 100; turn++) {
 *   const messages = await conversation.addIncoming(payload.messages, payload.trigger, turn);
 *   const result = streamText({ model, messages });
 *   const { message } = await chat.pipeAndCapture(result);
 *   if (message) await conversation.addResponse(message);
 * }
 * ```
 */
declare class ChatMessageAccumulator {
    modelMessages: ModelMessage[];
    uiMessages: UIMessage[];
    private _compaction?;
    /** The run a spliced head-start partial contributed, until its response replaces it. */
    private _handoverRun?;
    private _pendingMessages?;
    private _steeringQueue;
    constructor(options?: {
        compaction?: ChatAgentCompactionOptions;
        pendingMessages?: PendingMessagesOptions;
    });
    /**
     * Add incoming messages from the transport payload.
     * Returns the full accumulated model messages for `streamText`.
     */
    addIncoming(messages: UIMessage[], trigger: string, turn: number): Promise<ModelMessage[]>;
    /**
     * Add the assistant's response to the accumulator.
     * Call after `pipeAndCapture` with the captured response.
     */
    /**
     * Replace all accumulated messages (for compaction).
     * Converts UIMessages to ModelMessages internally.
     */
    setMessages(uiMessages: UIMessage[]): Promise<void>;
    /**
     * Splice a `chat.headStart` handover partial into the accumulator (the warm
     * step-1 response). Dedups by `messageId` so a seeded/hydrated history that
     * already carries the partial isn't doubled. Seed any prior history first
     * (e.g. `setMessages(payload.headStartMessages)`). Low-level — see
     * `consumeHandover` for the wait+seed+apply convenience.
     */
    applyHandover(signal: {
        partialAssistantMessage: ModelMessage[];
        messageId?: string;
    }): void;
    /**
     * One-call `chat.headStart` handover for a custom-agent loop: waits for the
     * handover signal, seeds prior history from `payload.headStartMessages`,
     * applies the warm step-1 partial, and reports what to do next.
     *
     * Returns `{ isFinal, skipped }`:
     * - `skipped: true` — not a `handover-prepare` run, the wait idled out, or the
     *   warm handler aborted. Exit the run without a turn.
     * - `isFinal: true` — step 1 IS the response (pure text). Write turn-complete
     *   and continue; do not call `streamText`.
     * - `isFinal: false` — fall through to `streamText`, which runs the pending
     *   tool round handed over from step 1.
     */
    consumeHandover(options: {
        payload: {
            trigger?: string;
            idleTimeoutInSeconds?: number;
            headStartMessages?: UIMessage[];
        };
        idleTimeoutInSeconds?: number;
        timeout?: string;
    }): Promise<{
        isFinal: boolean;
        skipped: boolean;
    }>;
    addResponse(response: UIMessage): Promise<void>;
    /**
     * Queue a message for injection via `prepareStep`. Call from a
     * `messagesInput.on()` listener when a message arrives during streaming.
     */
    steer(message: UIMessage, modelMessages?: ModelMessage[]): void;
    /**
     * Queue a message for injection, converting to model messages automatically.
     */
    steerAsync(message: UIMessage): Promise<void>;
    /**
     * Record the messages a steering drain consumed.
     *
     * The drain only puts them in this step's prompt, so without this they
     * shape one answer and then exist in neither lane: not in `uiMessages`,
     * which is what an app persists from, and not in `modelMessages`, which is
     * what every later turn sends.
     *
     * Both lanes are appended to. The model lane is never reconverted from the
     * UI lane, because `compactIfNeeded` replaces it with a summary and leaves
     * the UI lane whole: a reconversion would restore everything the summary
     * replaced.
     */
    absorbSteering(claimed: UIMessage[], injected?: ModelMessage[]): Promise<void>;
    /**
     * Get and clear unconsumed steering messages.
     */
    drainSteering(): UIMessage[];
    /**
     * Returns a `prepareStep` function that handles both compaction and
     * pending message injection. Pass to `streamText({ prepareStep: conversation.prepareStep() })`.
     */
    prepareStep(): ((args: {
        messages: ModelMessage[];
        steps: CompactionStep[];
    }) => Promise<{
        messages: ModelMessage[];
    } | undefined>) | undefined;
    /**
     * Run outer-loop compaction if needed. Call after adding the response
     * and capturing usage. Pass the LAST step's usage (`result.usage`), which is
     * the context the model held on its final call; `result.totalUsage` sums every
     * step of a tool-using turn and belongs in `context.turnUsage`. Applies
     * `compactModelMessages` and `compactUIMessages` callbacks if configured.
     *
     * @returns `true` if compaction was performed, `false` otherwise.
     */
    compactIfNeeded(usage: LanguageModelUsage | undefined, context?: {
        chatId?: string;
        turn?: number;
        clientData?: unknown;
        /** The whole turn summed over its steps (`result.totalUsage`). */
        turnUsage?: LanguageModelUsage;
        totalUsage?: LanguageModelUsage;
    }): Promise<boolean>;
}
export type ChatSessionOptions = {
    /** Run-level cancel signal (from task context). */
    signal: AbortSignal;
    /** Seconds to stay idle between turns before suspending. @default 30 */
    idleTimeoutInSeconds?: number;
    /** Duration string for suspend timeout. @default "1h" */
    timeout?: string;
    /** Max turns before ending. @default 100 */
    maxTurns?: number;
    /**
     * What to do when the session's `externalDeploymentId` no longer names this deployment.
     * `"follow"` (default) hands over at the next turn boundary; `"hold"` stays put.
     */
    versionSkew?: ChatVersionSkewPolicy;
    /** Automatic context compaction — same options as `chat.agent({ compaction })`. */
    compaction?: ChatAgentCompactionOptions;
    /** Configure mid-execution message injection — same options as `chat.agent({ pendingMessages })`. */
    pendingMessages?: PendingMessagesOptions;
};
export type ChatTurn<TClientData = unknown> = {
    /** Turn number (0-indexed). */
    number: number;
    /** Chat session ID. */
    chatId: string;
    /** What triggered this turn. */
    trigger: string;
    /** Client data from the transport (`metadata` field on the wire payload). */
    clientData: TClientData;
    /** Full accumulated model messages — pass directly to `streamText`. */
    readonly messages: ModelMessage[];
    /** Full accumulated UI messages — use for persistence. */
    readonly uiMessages: UIMessage[];
    /** Combined stop+cancel AbortSignal (fresh each turn). */
    signal: AbortSignal;
    /** Whether the user stopped generation this turn. */
    readonly stopped: boolean;
    /** Whether this is a continuation run. */
    continuation: boolean;
    /** Token usage from the previous turn. Undefined on turn 0. */
    previousTurnUsage?: LanguageModelUsage;
    /** Cumulative token usage across all completed turns so far. */
    totalUsage: LanguageModelUsage;
    /**
     * Set on the first turn of a `chat.headStart` handover; `null` otherwise.
     * When `isFinal` is true the warm step-1 IS the response — call
     * `turn.complete()` with no argument (don't call `streamText`). When false,
     * call `streamText` as usual; it runs the handed-over tool round.
     */
    handover: {
        isFinal: boolean;
    } | null;
    /**
     * Replace accumulated messages (for compaction). Takes UIMessages and
     * converts to ModelMessages internally. After calling this, `turn.messages`
     * reflects the compacted history.
     */
    setMessages(uiMessages: UIMessage[]): Promise<void>;
    /**
     * Easy path: pipe stream, capture response, accumulate it,
     * clean up aborted parts if stopped, and write turn-complete chunk.
     *
     * Call with no argument on a head-start final turn (`turn.handover?.isFinal`)
     * — the warm step-1 partial is already the response, so there's nothing to pipe.
     */
    complete(source?: UIMessageStreamable): Promise<UIMessage | undefined>;
    /**
     * Manual path: just write turn-complete chunk.
     * Use when you've already piped and accumulated manually.
     */
    done(): Promise<void>;
    /**
     * Add the response to the accumulator manually.
     * Use with `chat.pipeAndCapture` when you need control between pipe and done.
     */
    addResponse(response: UIMessage): Promise<void>;
    /**
     * Returns a `prepareStep` function that handles both compaction and
     * pending message injection. Pass to `streamText({ prepareStep: turn.prepareStep() })`.
     * Only needed when not using `chat.toStreamTextOptions()` (which auto-injects it).
     */
    prepareStep(): ((args: {
        messages: ModelMessage[];
        steps: CompactionStep[];
    }) => Promise<{
        messages: ModelMessage[];
    } | undefined>) | undefined;
};
/**
 * Create a chat session that yields turns as an async iterator.
 *
 * Handles: preload wait, stop signals, message accumulation, turn-complete
 * signaling, and idle/suspend between turns. You control: initialization,
 * model/tool selection, persistence, and any custom per-turn logic.
 *
 * Call from inside a `chat.customAgent()` run — the wrapper binds the
 * backing Session that the iterator's stop signal and message channels
 * resolve to. (A plain `task()` does not bind it, so `createSession`
 * would throw "session handle is not initialized".)
 *
 * @example
 * ```ts
 * import { chat, type ChatTaskWirePayload } from "@trigger.dev/sdk/ai";
 * import { streamText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 *
 * export const myChat = chat.customAgent({
 *   id: "my-chat",
 *   run: async (payload: ChatTaskWirePayload, { signal }) => {
 *     const session = chat.createSession(payload, { signal });
 *
 *     for await (const turn of session) {
 *       const result = streamText({
 *         model: openai("gpt-4o"),
 *         messages: turn.messages,
 *         abortSignal: turn.signal,
 *       });
 *       await turn.complete(result);
 *     }
 *   },
 * });
 * ```
 */
declare function createChatSession<TClientData = unknown>(payload: ChatTaskWirePayload<UIMessage, TClientData>, options: ChatSessionOptions): AsyncIterable<ChatTurn<TClientData>>;
/**
 * A Proxy-backed, run-scoped data object that appears as `T` to users.
 * Includes helper methods for initialization, dirty tracking, and serialization.
 * Internal metadata is stored behind Symbols and invisible to
 * `Object.keys()`, `JSON.stringify()`, and spread.
 */
export type ChatLocal<T extends Record<string, unknown>> = T & {
    /** Initialize the local with a value. Call in `onChatStart` or `run()`. */
    init(value: T): void;
    /** Returns `true` if any property was set since the last check. Resets the dirty flag. */
    hasChanged(): boolean;
    /** Returns a plain object copy of the current value. Useful for persistence. */
    get(): T;
    readonly [CHAT_LOCAL_KEY]: ReturnType<typeof locals.create<T>>;
    readonly [CHAT_LOCAL_DIRTY_KEY]: ReturnType<typeof locals.create<boolean>>;
};
/**
 * Creates a per-run typed data object accessible from anywhere during task execution.
 *
 * Declare at module level, then initialize inside `onBoot` (recommended — fires
 * on every fresh worker including continuation runs). Do NOT initialize in
 * `onChatStart` alone: `onChatStart` only fires on the chat's very first
 * message, so `chat.local` would be uninitialized on continuation runs and
 * `run()` would throw.
 *
 * Multiple locals can coexist — each gets its own isolated run-scoped storage.
 *
 * The `id` is required and must be unique across all `chat.local()` calls in
 * your project. It's used to serialize values into subtask metadata so that
 * `ai.toolExecute()` (or legacy `ai.tool()`) subtasks can auto-hydrate parent locals (read-only).
 *
 * @example
 * ```ts
 * import { chat } from "@trigger.dev/sdk/ai";
 *
 * const userPrefs = chat.local<{ theme: string; language: string }>({ id: "userPrefs" });
 * const gameState = chat.local<{ score: number; streak: number }>({ id: "gameState" });
 *
 * export const myChat = chat.agent({
 *   id: "my-chat",
 *   onBoot: async ({ clientData }) => {
 *     const prefs = await db.prefs.findUnique({ where: { userId: clientData.userId } });
 *     userPrefs.init(prefs ?? { theme: "dark", language: "en" });
 *     gameState.init({ score: 0, streak: 0 });
 *   },
 *   onTurnComplete: async ({ chatId }) => {
 *     if (gameState.hasChanged()) {
 *       await db.save({ where: { chatId }, data: gameState.get() });
 *     }
 *   },
 *   run: async ({ messages }) => {
 *     gameState.score++;
 *     return streamText({
 *       system: `User prefers ${userPrefs.theme} theme. Score: ${gameState.score}`,
 *       messages,
 *     });
 *   },
 * });
 * ```
 */
declare function chatLocal<T extends Record<string, unknown>>(options: {
    id: string;
}): ChatLocal<T>;
/**
 * Extracts the client data (metadata) type from a chat task.
 * Use this to type the `metadata` option on the transport.
 *
 * @example
 * ```ts
 * import type { InferChatClientData } from "@trigger.dev/sdk/ai";
 * import type { myChat } from "@/trigger/chat";
 *
 * type MyClientData = InferChatClientData<typeof myChat>;
 * // { model?: string; userId: string }
 * ```
 */
/**
 * Options for {@link createChatStartSessionAction}.
 */
/**
 * Discriminator for per-endpoint `baseURL` / `fetch` callbacks on
 * `createChatStartSessionAction`.
 *
 * - `"sessions"` — `POST /api/v1/sessions` (session create + first run trigger).
 * - `"auth"` — `POST /api/v1/auth/jwt/claims` (only fired when
 *   `tokenTTL` is set; otherwise the publicAccessToken from session create
 *   is reused as-is).
 */
export type ChatStartSessionEndpoint = "sessions" | "auth";
export type ChatStartSessionEndpointContext = {
    endpoint: ChatStartSessionEndpoint;
    chatId: string;
};
export type ChatStartSessionBaseURLResolver = (ctx: ChatStartSessionEndpointContext) => string;
export type ChatStartSessionFetchOverride = (url: string, init: RequestInit, ctx: ChatStartSessionEndpointContext) => Promise<Response>;
export type CreateChatStartSessionActionOptions = {
    /** TTL for the session-scoped public access token. @default "1h" */
    tokenTTL?: string | number | Date;
    /**
     * Default trigger config used when starting a new session for a chat.
     * Per-call `params.triggerConfig` shallow-merges on top.
     */
    triggerConfig?: Partial<SessionTriggerConfigInput>;
    /**
     * Override the Trigger.dev API base URL. String applies to both
     * `/api/v1/sessions` and `/api/v1/auth/jwt/claims`; function picks per
     * endpoint. When unset, falls back to `apiClientManager.baseURL`
     * (typically the `TRIGGER_API_URL` env var). Set this to route session
     * create through a trusted edge proxy that injects server-side signal
     * into `basePayload.metadata` before forwarding upstream.
     */
    baseURL?: string | ChatStartSessionBaseURLResolver;
    /**
     * Per-request fetch override. Receives the resolved URL, RequestInit,
     * and endpoint context. Use for header injection, proxy routing, or
     * custom retry. Applies to both session-create and JWT-claims POSTs.
     */
    fetch?: ChatStartSessionFetchOverride;
    /**
     * API client config (baseURL / accessToken) to scope this action to a specific
     * environment, for callers that can't set a global `TRIGGER_SECRET_KEY`. The
     * returned action runs under this config.
     */
    apiClient?: ApiClientConfiguration;
};
/**
 * Params for the function returned by {@link createChatStartSessionAction}.
 */
export type ChatStartSessionParams<TChat extends AnyTask = AnyTask> = {
    /** Conversation id (mapped to the Session's `externalId`). */
    chatId: string;
    /**
     * Typed client data — folded into the first run's `payload.metadata` so
     * `onPreload`, `onChatStart`, etc. see the same `clientData` shape on the
     * first turn as subsequent turns get via the transport's `clientData`
     * option. Typed via the agent's `clientDataSchema` when the action is
     * parameterised with `createStartSessionAction<typeof myChat>(...)`.
     */
    clientData?: InferChatClientData<TChat>;
    /**
     * Per-call trigger config. Shallow-merged over the action's default
     * `triggerConfig`. `basePayload` is the customer's wire payload (for
     * `chat.agent`: anything beyond `chatId`/`messages`/`trigger`/`metadata`,
     * which the runtime injects automatically).
     */
    triggerConfig?: Partial<SessionTriggerConfigInput>;
    /**
     * Opaque session-level metadata stored on the Session row. Separate from
     * the per-turn `clientData` above. Use this when you want to attach
     * server-side metadata that doesn't go through the agent's `clientDataSchema`.
     */
    metadata?: Record<string, unknown>;
};
/**
 * Result from {@link createChatStartSessionAction}'s returned function.
 */
export type ChatStartSessionResult = {
    /**
     * Session-scoped public access token (`read:sessions:{chatId} +
     * write:sessions:{chatId}`). Pass this to the browser; the transport
     * uses it to call `.in/append`, `.out`, `end-and-continue`.
     */
    publicAccessToken: string;
    /** Friendly id of the run triggered alongside session create. */
    runId: string;
    /** Session friendlyId — informational. */
    sessionId: string;
    /**
     * The session's run is parked waiting for its deployment. Messages sent meanwhile are durable
     * and delivered once it lands; surface this so the wait reads as a deploy in progress.
     */
    pendingVersion?: boolean;
};
/**
 * Creates a server-side helper that starts (or resumes) a Session for a
 * given chatId — atomically creating the row, triggering the first run,
 * and returning a session-scoped PAT for the browser to use.
 *
 * Wrap in a Next.js server action (or any server-side handler) so the
 * customer's secret key never crosses to the browser.
 *
 * Parameterise the action with `<typeof yourChatAgent>` to type the
 * `clientData` field against your agent's `clientDataSchema`.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat } from "@trigger.dev/sdk/ai";
 * import type { myChat } from "@/trigger/chat";
 *
 * export const startChatSession = chat.createStartSessionAction<typeof myChat>(
 *   "my-chat",
 *   { triggerConfig: { machine: "small-1x" } }
 * );
 * ```
 *
 * Then in the browser, threading the typed `clientData` from the transport:
 * ```tsx
 * const transport = useTriggerChatTransport<typeof myChat>({
 *   task: "my-chat",
 *   accessToken: ({ chatId }) => mintChatAccessToken(chatId),
 *   startSession: ({ chatId, clientData }) =>
 *     startChatSession({ chatId, clientData }),
 * });
 * ```
 */
declare function createChatStartSessionAction<TChat extends AnyTask = AnyTask>(taskId: string, options?: CreateChatStartSessionActionOptions): (params: ChatStartSessionParams<TChat>) => Promise<ChatStartSessionResult>;
export type CreateChatLoadTranscriptActionOptions = {
    /**
     * Scope the action to a specific API client configuration (secret key,
     * base URL) instead of the process-wide one. The default storage reads
     * through this client.
     */
    apiClient?: ApiClientConfiguration;
    /** Page size when the caller passes none. */
    limit?: number;
};
export type ChatLoadTranscriptParams<TClientData = unknown> = {
    chatId: string;
    clientData?: TClientData;
    limit?: number;
    before?: string;
};
/**
 * Creates a server-side helper that reads a conversation from a transcript
 * storage, for rendering history before the chat connects. Works the same
 * for every storage, the platform default included, so the browser never
 * reads a store directly and the secret key stays on the server.
 *
 * Wrap it in a Next.js server action (or any server-side handler), scope it
 * to the authenticated user through `clientData`, and pass the result to
 * `useLoadTranscript` in the browser.
 *
 * @example
 * ```ts
 * // actions.ts
 * "use server";
 * import { chat, defaultStorage } from "@trigger.dev/sdk/ai";
 *
 * export const loadTranscript = chat.createLoadTranscriptAction(defaultStorage, { limit: 50 });
 * ```
 */
declare function createChatLoadTranscriptAction<TClientData = unknown>(storage: TranscriptStorage<TClientData>, options?: CreateChatLoadTranscriptActionOptions): (params: ChatLoadTranscriptParams<TClientData>) => Promise<TranscriptLoadResult>;
export declare const chat: {
    /** Create a chat agent. See {@link chatAgent}. */
    agent: typeof chatAgent;
    /** Create a custom agent with manual lifecycle control. See {@link chatCustomAgent}. */
    customAgent: typeof chatCustomAgent;
    /** Create a chat task with a fixed {@link UIMessage} subtype and optional default stream options. See {@link withUIMessage}. */
    withUIMessage: typeof withUIMessage;
    /** Create a chat task with a fixed client data schema. See {@link withClientData}. */
    withClientData: typeof withClientData;
    /** Create a server-side helper for starting (or resuming) a Session for a chatId. See {@link createChatStartSessionAction}. */
    createStartSessionAction: typeof createChatStartSessionAction;
    /** Returns a server-side helper that reads a conversation from a transcript storage. */
    createLoadTranscriptAction: typeof createChatLoadTranscriptAction;
    /** Pipe a stream to the chat transport. See {@link pipeChat}. */
    pipe: typeof pipeChat;
    /** Return from `onAction` to run a turn on the edited history. See {@link chatTurn}. */
    turn: typeof chatTurn;
    /** Create a per-run typed local. See {@link chatLocal}. */
    local: typeof chatLocal;
    /** Create a public access token for a chat task. See {@link createChatAccessToken}. */
    createAccessToken: typeof createChatAccessToken;
    /** Override the turn timeout at runtime (duration string). See {@link setTurnTimeout}. */
    setTurnTimeout: typeof setTurnTimeout;
    /** Override the turn timeout at runtime (seconds). See {@link setTurnTimeoutInSeconds}. */
    setTurnTimeoutInSeconds: typeof setTurnTimeoutInSeconds;
    /** Override the idle timeout at runtime. See {@link setIdleTimeoutInSeconds}. */
    setIdleTimeoutInSeconds: typeof setIdleTimeoutInSeconds;
    /** Override toUIMessageStream() options for the current turn. See {@link setUIMessageStreamOptions}. */
    setUIMessageStreamOptions: typeof setUIMessageStreamOptions;
    /** Check if the current turn was stopped by the user. See {@link isStopped}. */
    isStopped: typeof isStopped;
    /** Request that the run exits after the current turn so the next message starts on the latest version. See {@link requestUpgrade}. */
    requestUpgrade: typeof requestUpgrade;
    /** Hand off a custom agent Session to a fresh run. See {@link endAndContinue}. */
    endAndContinue: typeof endAndContinue;
    /** Exit the run after the current turn completes, without any upgrade signal. See {@link endRun}. */
    endRun: typeof endRun;
    /** End the conversation permanently: close the session and exit the run. See {@link close}. */
    close: typeof close;
    /** Clean up aborted parts from a UIMessage. See {@link cleanupAbortedParts}. */
    cleanupAbortedParts: typeof cleanupAbortedParts;
    /** Register background work that runs in parallel with streaming. See {@link chatDefer}. */
    defer: typeof chatDefer;
    deferBeforeOutput: typeof chatDeferBeforeOutput;
    /** Queue model messages for injection at the next `prepareStep` boundary. See {@link injectBackgroundContext}. */
    inject: typeof injectBackgroundContext;
    /** Typed chat output stream for writing custom chunks or piping from subtasks. */
    stream: RealtimeDefinedStream<UIMessageChunk>;
    /** Write data parts that persist to the response message. See {@link chatResponse}. */
    response: {
        /**
         * Write a single chunk. Non-transient data parts are accumulated into the
         * response message; everything else is stream-only.
         */
        write(part: UIMessageChunk): void;
    };
    /** Pre-built input stream for receiving messages from the transport. */
    messages: ChatMessages;
    /** The current chat.agent run's Session handle. See {@link SessionHandle}. */
    session: typeof getChatSession;
    /**
     * Open a named side channel on the current chat.agent run's Session: a
     * durable, cross-run `.in`/`.out` pair addressed by `name`, separate from the
     * chat transcript. Writing its `.in` does not wake a run. Shortcut for
     * `chat.session().channel(name)`.
     */
    channel: <C extends AnySessionChannel = AnySessionChannel>(channel: SessionChannelName<C> | C) => SessionChannelHandleFor<C>;
    /** Create a managed stop signal wired to the stop input stream. See {@link createStopSignal}. */
    createStopSignal: typeof createStopSignal;
    /** Signal the frontend that the current turn is complete. See {@link chatWriteTurnComplete}. */
    writeTurnComplete: typeof chatWriteTurnComplete;
    /** Pipe a stream and capture the response message. See {@link pipeChatAndCapture}. */
    pipeAndCapture: typeof pipeChatAndCapture;
    /** Message accumulator class for raw task chat. See {@link ChatMessageAccumulator}. */
    MessageAccumulator: typeof ChatMessageAccumulator;
    /** Create a chat session (async iterator). See {@link createChatSession}. */
    createSession: typeof createChatSession;
    /**
     * Wait for a `chat.headStart` handover signal inside a `chat.customAgent`
     * loop (turn 0). See {@link waitForHandover}. For most loops prefer the
     * `chat.MessageAccumulator.consumeHandover()` convenience, which also seeds
     * `payload.headStartMessages` and applies the partial.
     */
    waitForHandover: typeof waitForHandover;
    /**
     * Store and retrieve a resolved prompt for the current run.
     *
     * - `chat.prompt.set(resolved)` — store a `ResolvedPrompt` or plain string
     * - `chat.prompt.set(resolved, { providerOptions })` — also attach provider
     *   options to the system block so a provider can cache it (e.g. Anthropic
     *   prompt caching). See the prompt-caching guide.
     * - `chat.prompt()` — read the stored prompt (throws if not set)
     */
    prompt: typeof getChatPrompt & {
        set: typeof setChatPrompt;
    };
    /**
     * Store and retrieve resolved agent skills for the current run.
     *
     * - `chat.skills.set([...])` — store an array of `ResolvedSkill`s
     * - `chat.skills()` — read the stored skills (returns undefined if none)
     *
     * Skills set here are automatically injected into `streamText` by
     * `chat.toStreamTextOptions()`: skill descriptions land in the system
     * prompt and `loadSkill` / `readFile` / `bash` tools are added to the
     * tool set.
     */
    skills: typeof getChatSkills & {
        set: typeof setChatSkills;
    };
    /**
     * Returns an options object ready to spread into `streamText()`.
     * Reads the stored prompt and returns `{ system, experimental_telemetry, ...config }`.
     * Returns `{}` if no prompt has been set.
     */
    toStreamTextOptions: typeof toStreamTextOptions;
    /**
     * Replace the accumulated conversation messages for compaction.
     * Call from `onTurnStart` or `onTurnComplete`. Takes `UIMessage[]` and
     * converts to `ModelMessage[]` internally.
     */
    setMessages: typeof setChatMessages;
    /**
     * Imperative API for modifying the accumulated message history.
     * Supports rollback, remove, replace, slice, and full replacement.
     * Can be called from any hook or `run()`.
     */
    history: {
        /** Read the current accumulated UI messages (copy). */
        all(): UIMessage[];
        /**
         * Read the current chain as an ordered `UIMessage[]`. Identical to
         * `all()`; use whichever name reads better in context.
         */
        getChain(): UIMessage[];
        /**
         * Find a message by id. Returns `undefined` if no message with that id
         * is present in the current chain.
         */
        findMessage(messageId: string): UIMessage | undefined;
        /**
         * Tool calls on the *most recent* assistant message that are still in
         * `input-available` state (waiting on an `addToolOutput` answer). The
         * scan walks back from the tail and stops at the first assistant
         * message it finds, so a trailing user message does not change the
         * result — pending tool calls remain pending until they're resolved
         * on that assistant or the assistant is removed.
         *
         * Use this to gate fresh user turns or actions during HITL flows: if
         * `getPendingToolCalls().length > 0`, an `addToolOutput` is expected.
         *
         * Returns `[]` if there is no assistant message yet, or if the most
         * recent assistant has no pending tool calls.
         *
         * Approval flows (`approval-requested` / `approval-responded` states)
         * are not surfaced here. Those are about the user authorizing a tool
         * to run; "pending" is about the user *answering* a tool call.
         */
        getPendingToolCalls(): ChatToolCallRef[];
        /**
         * Tool calls across the chain with a final result (`output-available`
         * or `output-error`). Use this to dedup re-saves when the AI SDK
         * resends an assistant message with progressively more answered parts.
         */
        getResolvedToolCalls(): ChatToolCallRef[];
        /**
         * Pure helper: returns the tool parts in `message` whose results are
         * not already represented in the current chain. Use this when
         * persisting tool results to your own store: each call surfaces only
         * the *new* answers, so writes stay idempotent across re-streams.
         * Duplicate `toolCallId`s within `message` itself are also collapsed
         * to a single entry.
         */
        extractNewToolResults(message: UIMessage): ChatNewToolResult[];
        /** Replace all accumulated messages. Same as `chat.setMessages()`. */
        set(messages: UIMessage[]): void;
        /** Remove a specific message by ID. */
        remove(messageId: string): void;
        /** Keep messages up to and including the given ID (undo/rollback). */
        rollbackTo(messageId: string): void;
        /** Replace a specific message by ID (edit). */
        replace(messageId: string, message: UIMessage): void;
        /** Keep only messages in the given range. */
        slice(start: number, end?: number): void;
    };
    /** Check if it's safe to compact messages (no in-flight tool calls). */
    isCompactionSafe: typeof isCompactionSafe;
    /** Returns a `prepareStep` function that handles context compaction automatically. */
    compactionStep: typeof chatCompactionStep;
    /** Low-level compaction for use inside a custom `prepareStep`. */
    compact: typeof chatCompact;
    /** Read the current compaction state (summary + base message count). */
    getCompactionState: typeof getCompactionState;
    /**
     * The friendlyId (`session_*`) of the backing Session for the current chat.agent run.
     * Useful for persisting alongside `runId` so reloads can resume the same session.
     * Throws if called outside a chat.agent `run()` or hook.
     */
    readonly sessionId: string;
};
