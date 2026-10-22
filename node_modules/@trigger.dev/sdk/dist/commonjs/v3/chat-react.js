"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTranscriptCursor = seedTranscriptCursor;
exports.useLoadTranscript = useLoadTranscript;
exports.useTriggerChatTransport = useTriggerChatTransport;
exports.useMultiTabChat = useMultiTabChat;
exports.usePendingMessages = usePendingMessages;
exports.useChatActions = useChatActions;
/**
 * @module @trigger.dev/sdk/chat/react
 *
 * React hooks for AI SDK chat transport integration.
 * Use alongside `@trigger.dev/sdk/chat` for a type-safe, ergonomic DX.
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
const react_1 = require("react");
const chat_js_1 = require("./chat.js");
const ai_shared_js_1 = require("./ai-shared.js");
/**
 * Move the transport's resume cursor for `chatId` to the transcript's
 * `lastOutEventId`, so the live subscription opens just past the persisted
 * history. Applied to the session now if it exists, otherwise held by the
 * transport until the session is created, so a load that resolves before the
 * session exists still moves the cursor. A no-op when the transcript carries
 * no cursor. Returns whether a cursor was provided.
 */
function seedTranscriptCursor(transport, chatId, cursors) {
    const lastEventId = cursors?.lastOutEventId;
    if (!lastEventId)
        return false;
    transport.seedResumeCursor(chatId, lastEventId);
    return true;
}
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
function useLoadTranscript(chatId, load, options) {
    const [state, setState] = (0, react_1.useState)({
        chatId,
        messages: [],
        isLoading: chatId !== undefined,
        error: undefined,
        nextCursor: undefined,
    });
    const loadRef = (0, react_1.useRef)(load);
    loadRef.current = load;
    const transportRef = (0, react_1.useRef)(options?.transport);
    transportRef.current = options?.transport;
    const limit = options?.limit;
    (0, react_1.useEffect)(() => {
        if (chatId === undefined) {
            setState({ chatId, messages: [], isLoading: false, error: undefined, nextCursor: undefined });
            return;
        }
        let cancelled = false;
        setState({ chatId, messages: [], isLoading: true, error: undefined, nextCursor: undefined });
        loadRef
            .current({ chatId, ...(limit !== undefined ? { limit } : {}) })
            .then((result) => {
            if (cancelled)
                return;
            if (transportRef.current) {
                seedTranscriptCursor(transportRef.current, chatId, result.cursors);
            }
            setState({
                chatId,
                messages: result.messages,
                isLoading: false,
                error: undefined,
                nextCursor: result.nextCursor,
            });
        })
            .catch((cause) => {
            if (cancelled)
                return;
            const error = cause instanceof Error ? cause : new Error(String(cause));
            setState({ chatId, messages: [], isLoading: false, error, nextCursor: undefined });
        });
        return () => {
            cancelled = true;
        };
    }, [chatId, limit]);
    return {
        messages: state.chatId === chatId ? state.messages : [],
        isLoading: state.chatId === chatId ? state.isLoading : chatId !== undefined,
        error: state.chatId === chatId ? state.error : undefined,
        nextCursor: state.chatId === chatId ? state.nextCursor : undefined,
    };
}
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
function useTriggerChatTransport(options) {
    const ref = (0, react_1.useRef)(null);
    if (ref.current === null) {
        ref.current = new chat_js_1.TriggerChatTransport(options);
    }
    // Keep callbacks up to date without recreating the transport.
    const { onSessionChange, clientData, onEvent, accessToken, startSession, fetch: fetchOverride, } = options;
    (0, react_1.useEffect)(() => {
        ref.current?.setOnSessionChange(onSessionChange);
    }, [onSessionChange]);
    (0, react_1.useEffect)(() => {
        ref.current?.setOnEvent(onEvent);
    }, [onEvent]);
    // Keep `clientData` up to date so the transport's per-turn merge and
    // `startSession` callback both see the latest value without
    // reconstructing the transport.
    (0, react_1.useEffect)(() => {
        ref.current?.setClientData(clientData);
    }, [clientData]);
    // Same for the request-time callbacks: a host that closes over a changing
    // endpoint (a dashboard navigating between projects) would otherwise keep
    // sending to the one captured on first render.
    (0, react_1.useEffect)(() => {
        ref.current?.setAccessToken(accessToken);
    }, [accessToken]);
    (0, react_1.useEffect)(() => {
        ref.current?.setStartSession(startSession);
    }, [startSession]);
    (0, react_1.useEffect)(() => {
        ref.current?.setFetch(fetchOverride);
    }, [fetchOverride]);
    // Note: dispose() is NOT called in effect cleanup because React strict mode
    // runs cleanup+re-setup, but the transport lives in a ref and isn't recreated.
    // Calling dispose() would permanently close the BroadcastChannel.
    // The coordinator's beforeunload handler handles tab close cleanup instead.
    return ref.current;
}
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
function useMultiTabChat(transport, chatId, messages, setMessages) {
    const [isReadOnly, setIsReadOnly] = (0, react_1.useState)(() => transport.isReadOnly(chatId));
    // Track read-only state
    (0, react_1.useEffect)(() => {
        const listener = (id, readOnly) => {
            if (id === chatId)
                setIsReadOnly(readOnly);
        };
        transport.addReadOnlyListener(listener);
        setIsReadOnly(transport.isReadOnly(chatId));
        return () => transport.removeReadOnlyListener(listener);
    }, [transport, chatId]);
    // Active tab: broadcast messages to other tabs on change.
    // Only broadcast when THIS tab holds the claim (is the current sender).
    // Deferred via requestIdleCallback so the structured clone in
    // BroadcastChannel.postMessage never blocks rendering during streaming.
    const idleRef = (0, react_1.useRef)(null);
    const latestMessagesRef = (0, react_1.useRef)(messages);
    latestMessagesRef.current = messages;
    (0, react_1.useEffect)(() => {
        if (!transport.hasClaim(chatId) || messages.length === 0)
            return;
        if (idleRef.current !== null)
            return; // Already scheduled
        const schedule = typeof requestIdleCallback === "function"
            ? requestIdleCallback
            : (fn) => setTimeout(fn, 50);
        idleRef.current = schedule(() => {
            idleRef.current = null;
            if (transport.hasClaim(chatId)) {
                transport.broadcastMessages(chatId, latestMessagesRef.current);
            }
        });
    }, [transport, chatId, messages]);
    // Flush final state when claim is released (turn complete)
    (0, react_1.useEffect)(() => {
        if (!transport.hasClaim(chatId) && latestMessagesRef.current.length > 0) {
            if (idleRef.current !== null) {
                const cancel = typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout;
                cancel(idleRef.current);
                idleRef.current = null;
            }
            transport.broadcastMessages(chatId, latestMessagesRef.current);
        }
    }, [transport, chatId, isReadOnly]);
    // Read-only tab: receive messages from the active tab
    (0, react_1.useEffect)(() => {
        const listener = (id, msgs) => {
            if (id === chatId) {
                setMessages(msgs);
            }
        };
        transport.addMessagesListener(listener);
        return () => transport.removeMessagesListener(listener);
    }, [transport, chatId, setMessages]);
    return { isReadOnly };
}
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
function usePendingMessages(options) {
    const { transport, chatId, status, messages, setMessages: _setMessages, sendMessage, metadata, } = options;
    const [pendingMsgs, setPendingMsgs] = (0, react_1.useState)([]);
    const pendingMsgsRef = (0, react_1.useRef)(pendingMsgs);
    pendingMsgsRef.current = pendingMsgs;
    const injectedIdsRef = (0, react_1.useRef)(new Set());
    const prevStatusRef = (0, react_1.useRef)(status);
    // Watch for injection confirmation chunks in streaming messages
    (0, react_1.useEffect)(() => {
        if (status !== "streaming")
            return;
        let newlyInjected = false;
        for (const msg of messages) {
            if (msg.role !== "assistant")
                continue;
            for (const part of msg.parts ?? []) {
                if (part.type === ai_shared_js_1.PENDING_MESSAGE_INJECTED_TYPE) {
                    const messageIds = part.data?.messageIds;
                    if (Array.isArray(messageIds)) {
                        for (const id of messageIds) {
                            if (!injectedIdsRef.current.has(id)) {
                                injectedIdsRef.current.add(id);
                                newlyInjected = true;
                            }
                        }
                    }
                }
            }
        }
        // Remove injected steering messages from the pending overlay immediately
        if (newlyInjected) {
            setPendingMsgs((prev) => prev.filter((m) => !injectedIdsRef.current.has(m.id)));
        }
    }, [status, messages]);
    // Handle turn completion
    (0, react_1.useEffect)(() => {
        const turnCompleted = prevStatusRef.current === "streaming" && status === "ready";
        prevStatusRef.current = status;
        if (!turnCompleted)
            return;
        // Auto-send non-injected messages as the next turn.
        // This includes queued messages AND steering messages that weren't
        // injected (arrived too late, no prepareStep boundary, etc.).
        // Note: steering messages were also sent via sendPendingMessage to
        // the backend's wire buffer, so the backend may already have them.
        // Calling sendMessage here ensures useChat subscribes to the response.
        const toSend = pendingMsgs.filter((m) => !injectedIdsRef.current.has(m.id));
        // Clean up
        setPendingMsgs([]);
        injectedIdsRef.current.clear();
        promotedIdsRef.current.clear();
        // Auto-send as next turn
        if (toSend.length > 0) {
            const text = toSend.map((m) => m.parts?.[0]?.text ?? "").join("\n");
            sendMessage({ text }, metadata ? { metadata } : undefined);
        }
    }, [status, pendingMsgs, sendMessage, metadata, messages]);
    // Send a steering message (injected mid-response via prepareStep)
    const steer = (0, react_1.useCallback)((text) => {
        if (status === "streaming") {
            const msg = {
                id: crypto.randomUUID(),
                role: "user",
                parts: [{ type: "text", text }],
                _mode: "steering",
            };
            transport.sendPendingMessage(chatId, msg, metadata);
            setPendingMsgs((prev) => [...prev, msg]);
        }
        else {
            // Not streaming — just send normally
            sendMessage({ text }, metadata ? { metadata } : undefined);
        }
    }, [status, transport, chatId, sendMessage, metadata]);
    // Queue a message for the next turn (no injection attempt)
    const queue = (0, react_1.useCallback)((text) => {
        if (status === "streaming") {
            const msg = {
                id: crypto.randomUUID(),
                role: "user",
                parts: [{ type: "text", text }],
                _mode: "queued",
            };
            setPendingMsgs((prev) => [...prev, msg]);
        }
        else {
            sendMessage({ text }, metadata ? { metadata } : undefined);
        }
    }, [status, sendMessage, metadata]);
    // Promote a queued message to steering (send via input stream immediately)
    const promotedIdsRef = (0, react_1.useRef)(new Set());
    const promoteToSteering = (0, react_1.useCallback)((id) => {
        // Guard against double-click — ref check is synchronous
        if (promotedIdsRef.current.has(id)) {
            return;
        }
        // Read from the ref, send OUTSIDE the state updater. React may invoke
        // updaters more than once (StrictMode, update rebasing), so a network
        // call inside one can double-send.
        const msg = pendingMsgsRef.current.find((m) => m.id === id);
        if (!msg || msg._mode !== "queued")
            return;
        promotedIdsRef.current.add(id);
        transport.sendPendingMessage(chatId, msg, metadata);
        setPendingMsgs((prev) => prev.map((m) => (m.id === id ? { ...m, _mode: "steering" } : m)));
    }, [transport, chatId, metadata]);
    const isInjectionPoint = (0, react_1.useCallback)((part) => typeof part === "object" &&
        part !== null &&
        part.type === ai_shared_js_1.PENDING_MESSAGE_INJECTED_TYPE, []);
    const getInjectedMessageIds = (0, react_1.useCallback)((part) => {
        if (!isInjectionPoint(part))
            return [];
        const ids = part.data?.messageIds;
        return Array.isArray(ids) ? ids : [];
    }, [isInjectionPoint]);
    const getInjectedMessages = (0, react_1.useCallback)((part) => {
        if (!isInjectionPoint(part))
            return [];
        const msgs = part.data?.messages;
        return Array.isArray(msgs) ? msgs : [];
    }, [isInjectionPoint]);
    const pending = pendingMsgs.map((m) => ({
        id: m.id,
        text: m.parts?.[0]?.text ?? "",
        mode: m._mode,
        injected: injectedIdsRef.current.has(m.id),
    }));
    return {
        pending,
        steer,
        queue,
        promoteToSteering,
        isInjectionPoint,
        getInjectedMessageIds,
        getInjectedMessages,
    };
}
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
function useChatActions(options) {
    const { sendMessage } = options;
    const sendMessageRef = (0, react_1.useRef)(sendMessage);
    sendMessageRef.current = sendMessage;
    const sendAction = (0, react_1.useCallback)(async (action) => {
        await sendMessageRef.current(undefined, { body: { action } });
    }, []);
    return { sendAction };
}
//# sourceMappingURL=chat-react.js.map