/**
 * Coordinates multi-tab access to chat sessions via BroadcastChannel.
 *
 * When multiple browser tabs open the same chat, only one can be the active
 * sender. Others enter read-only mode. The coordinator uses a simple
 * claim/release/heartbeat protocol to track ownership per chatId.
 *
 * Gracefully degrades to a no-op when BroadcastChannel is unavailable
 * (SSR, Node.js, old browsers).
 *
 * @internal
 */
type ReadOnlyListener = (chatId: string, isReadOnly: boolean) => void;
type MessagesListener = (chatId: string, messages: unknown[]) => void;
type SessionListener = (chatId: string, session: {
    lastEventId?: string;
}) => void;
export declare class ChatTabCoordinator {
    private tabId;
    private channel;
    /** Claims held by OTHER tabs: chatId -> { tabId, lastSeen } */
    private claims;
    /** chatIds that THIS tab has claimed */
    private myClaims;
    private listeners;
    private messagesListeners;
    private sessionListeners;
    private heartbeatTimer;
    private beforeUnloadHandler;
    constructor();
    /**
     * Attempt to claim a chatId for sending.
     * Returns false if another tab already holds it.
     */
    claim(chatId: string): boolean;
    /** Release a chatId so other tabs can claim it. */
    release(chatId: string): void;
    /** Check if THIS tab currently holds a claim for the chatId. */
    hasClaim(chatId: string): boolean;
    /** Check if another tab holds this chatId. */
    isReadOnly(chatId: string): boolean;
    addListener(fn: ReadOnlyListener): void;
    removeListener(fn: ReadOnlyListener): void;
    /** Broadcast the current messages to other tabs (for real-time sync). */
    broadcastMessages(chatId: string, messages: unknown[]): void;
    addMessagesListener(fn: MessagesListener): void;
    removeMessagesListener(fn: MessagesListener): void;
    /** Broadcast session state (lastEventId) to other tabs. */
    broadcastSession(chatId: string, session: {
        lastEventId?: string;
    }): void;
    addSessionListener(fn: SessionListener): void;
    removeSessionListener(fn: SessionListener): void;
    /** Clean up channel, timers, and event listeners. */
    dispose(): void;
    private handleMessage;
    private sendHeartbeats;
    private expireStaleClaimsFromOtherTabs;
    private releaseAll;
    private broadcast;
    private notify;
    private notifyMessages;
    private notifySession;
}
export {};
