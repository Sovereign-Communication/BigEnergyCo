import { TriggerChatTransport, type TriggerChatTransportOptions } from "./chat.js";
import type { AnyTask, TaskIdentifier } from "@trigger.dev/core/v3";
import { type InferChatClientData, type InferChatUIMessage } from "./ai-shared.js";
import type { UIMessage, ChatRequestOptions } from "ai";
/**
 * Options for `useTriggerChatTransport`, with a type-safe `task` field.
 *
 * Pass a task type parameter to get compile-time validation of the task ID:
 * ```ts
 * useTriggerChatTransport<typeof myTask>({ task: "my-task", ... })
 * ```
 */
export type UseTriggerChatTransportOptions<TTask extends AnyTask = AnyTask> = Omit<TriggerChatTransportOptions<InferChatClientData<TTask>>, "task"> & {
    /** The task ID. Strongly typed when a task type parameter is provided. */
    task: TaskIdentifier<TTask>;
};
export type { InferChatUIMessage };
export type { ChatTransportEvent, ChatTransportSendSource } from "./chat.js";
/** What a `chat.createLoadTranscriptAction` action returns, as `useLoadTranscript` reads it. */
export type LoadTranscriptResult<TUIMessage extends UIMessage = UIMessage> = {
    messages: TUIMessage[];
    cursors?: {
        lastOutEventId?: string;
        lastInEventId?: string;
    };
    nextCursor?: string;
};
export type UseLoadTranscriptOptions = {
    /**
     * When given, the transport's resume cursor for this chat is seeded from
     * the loaded transcript, so the live subscription opens just past the
     * persisted history instead of replaying it. Only applies once the
     * transport knows the session (from `sessions` or after `start`).
     */
    transport?: TriggerChatTransport;
    /** Page size passed to the action. */
    limit?: number;
};
/**
 * Move the transport's resume cursor for `chatId` to the transcript's
 * `lastOutEventId`, so the live subscription opens just past the persisted
 * history. Applied to the session now if it exists, otherwise held by the
 * transport until the session is created, so a load that resolves before the
 * session exists still moves the cursor. A no-op when the transcript carries
 * no cursor. Returns whether a cursor was provided.
 */
export declare function seedTranscriptCursor(transport: Pick<TriggerChatTransport, "seedResumeCursor">, chatId: string, cursors: {
    lastOutEventId?: string;
} | undefined): boolean;
/**
 * Load a conversation's history through a server action created with
 * `chat.createLoadTranscriptAction`, for rendering before the chat connects.
 *
 * Re-runs when `chatId` changes. Pass `undefined` to load nothing.
 *
 * @example
 * ```tsx
 * const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, { transport });
 * if (isLoading) return <Spinner />;
 * return <ChatView chatId={chatId} initialMessages={messages} transport={transport} />;
 * ```
 */
export declare function useLoadTranscript<TUIMessage extends UIMessage = UIMessage>(chatId: string | undefined, load: (params: {
    chatId: string;
    limit?: number;
}) => Promise<LoadTranscriptResult<TUIMessage>>, options?: UseLoadTranscriptOptions): {
    messages: TUIMessage[];
    isLoading: boolean;
    error: Error | undefined;
    /** The id to pass as `before` to the action for the page before this one. */
    nextCursor: string | undefined;
};
/**
 * React hook that creates and memoizes a `TriggerChatTransport` instance.
 *
 * The transport is created once on first render and reused for the lifetime
 * of the component. This avoids the need for `useMemo` and ensures the
 * transport's internal session state (run IDs, lastEventId, etc.)
 * is preserved across re-renders.
 *
 * For dynamic access tokens, pass a function — it will be called on each
 * request without needing to recreate the transport.
 *
 * The `onSessionChange` callback is kept in a ref so the transport always
 * calls the latest version without needing to be recreated.
 *
 * @example
 * ```tsx
 * import { useChat } from "@ai-sdk/react";
 * import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
 * import type { chat } from "@/trigger/chat";
 *
 * function Chat() {
 *   const transport = useTriggerChatTransport<typeof chat>({
 *     task: "ai-chat",
 *     accessToken: ({ chatId }) => fetchToken(chatId),
 *   });
 *
 *   const { messages, sendMessage } = useChat({ transport });
 * }
 * ```
 */
export declare function useTriggerChatTransport<TTask extends AnyTask = AnyTask>(options: UseTriggerChatTransportOptions<TTask>): TriggerChatTransport;
/**
 * Sync chat messages across browser tabs.
 *
 * Requires `multiTab: true` on the transport. Handles:
 * - Tracking read-only state (`isReadOnly`) when another tab is active
 * - Broadcasting messages from the active tab to other tabs
 * - Receiving messages from other tabs and updating local state via `setMessages`
 *
 * @example
 * ```tsx
 * const transport = useTriggerChatTransport({ task: "my-chat", multiTab: true, accessToken });
 * const { messages, setMessages } = useChat({ id: chatId, transport });
 * const { isReadOnly } = useMultiTabChat(transport, chatId, messages, setMessages);
 *
 * <input disabled={isReadOnly} placeholder={isReadOnly ? "Active in another tab" : "Type a message..."} />
 * ```
 */
export declare function useMultiTabChat<T = unknown>(transport: TriggerChatTransport, chatId: string, messages: T[], setMessages: (messages: T[]) => void): {
    isReadOnly: boolean;
};
/** A pending message tracked by `usePendingMessages`. */
export type PendingMessage = {
    id: string;
    text: string;
    /** How this message is being handled. */
    mode: "steering" | "queued";
    /** Whether the backend confirmed this message was injected mid-response. */
    injected: boolean;
};
/** Options for `usePendingMessages`. */
export type UsePendingMessagesOptions<TUIMessage extends UIMessage = UIMessage> = {
    /** The chat transport instance. */
    transport: TriggerChatTransport;
    /** The chat session ID. */
    chatId: string;
    /** The current useChat status. */
    status: string;
    /** The current messages from useChat. */
    messages: TUIMessage[];
    /** The setMessages function from useChat. */
    setMessages: (fn: TUIMessage[] | ((prev: TUIMessage[]) => TUIMessage[])) => void;
    /** The sendMessage function from useChat. */
    sendMessage: (message: {
        text: string;
    }, options?: ChatRequestOptions) => void;
    /** Metadata to include when sending (e.g. `{ model }` for model selection). */
    metadata?: Record<string, unknown>;
};
/** A message embedded in an injection point data part. */
export type InjectedMessage = {
    id: string;
    text: string;
};
/** Return value of `usePendingMessages`. */
export type UsePendingMessagesReturn = {
    /** Current pending messages with their mode and injection status. */
    pending: PendingMessage[];
    /** Send a steering message during streaming, or a normal message when ready. */
    steer: (text: string) => void;
    /** Queue a message for the next turn (sent after current response finishes). */
    queue: (text: string) => void;
    /** Promote a queued message to a steering message (sends via input stream immediately). */
    promoteToSteering: (id: string) => void;
    /** Check if an assistant message part is an injection point. */
    isInjectionPoint: (part: unknown) => boolean;
    /** Get the injected message IDs from an injection point part. */
    getInjectedMessageIds: (part: unknown) => string[];
    /** Get the injected messages (id + text) from an injection point part. Self-contained — works after turn complete. */
    getInjectedMessages: (part: unknown) => InjectedMessage[];
};
/**
 * React hook for managing pending messages (steering) during streaming.
 *
 * Handles:
 * - Sending messages via input stream during streaming (bypassing useChat)
 * - Tracking which messages were injected mid-response vs queued for next turn
 * - Inserting injected messages into the conversation on turn complete
 * - Auto-sending non-injected messages as the next turn
 *
 * @example
 * ```tsx
 * const pending = usePendingMessages({
 *   transport, chatId, status, messages, setMessages, sendMessage,
 *   metadata: { model },
 * });
 *
 * // In the form:
 * <form onSubmit={(e) => {
 *   e.preventDefault();
 *   pending.send(input);
 *   setInput("");
 * }}>
 *
 * // Render pending messages:
 * {pending.pending.map(msg => (
 *   <div key={msg.id}>{msg.text} — {msg.injected ? "Injected" : "Pending"}</div>
 * ))}
 *
 * // Render injection points inline in assistant messages:
 * {msg.parts.map((part, i) =>
 *   pending.isInjectionPoint(part)
 *     ? <InjectionMarker key={i} ids={pending.getInjectedMessageIds(part)} />
 *     : <Part key={i} part={part} />
 * )}
 * ```
 */
export declare function usePendingMessages<TUIMessage extends UIMessage = UIMessage>(options: UsePendingMessagesOptions<TUIMessage>): UsePendingMessagesReturn;
/**
 * Send actions through `useChat`, so an action that returns `chat.turn()` on
 * the server renders like any turn.
 *
 * `transport.sendAction` returns the response as a stream that `useChat` never
 * reads. This hook sends the action as a `useChat` request instead (the
 * transport recognises `body.action` and sends it as an action), so `useChat`
 * owns the response: it streams into the message list, `status` and `error`
 * behave as for a message, and `stop` works. An action that returns nothing on
 * the server completes with no message added.
 *
 * History changes the action makes on the server (an undo removing messages,
 * for example) are not mirrored automatically; apply those with `setMessages`
 * optimistically, as before.
 *
 * @example
 * ```tsx
 * const transport = useTriggerChatTransport({ task: "my-chat", accessToken });
 * const { messages, sendMessage, setMessages } = useChat({ id: chatId, transport });
 * const { sendAction } = useChatActions({ sendMessage });
 *
 * <button onClick={() => sendAction({ type: "regenerate" })}>Regenerate</button>
 * ```
 */
export declare function useChatActions(options: {
    /** `useChat`'s `sendMessage`. */
    sendMessage: (message: undefined, options?: {
        body?: object;
        headers?: Record<string, string> | Headers;
    }) => Promise<void> | void;
}): {
    /** Send an action; resolves when `useChat` has finished the request. */
    sendAction: (action: unknown) => Promise<void>;
};
