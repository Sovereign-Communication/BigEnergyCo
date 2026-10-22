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
const CHANNEL_NAME = "trigger-chat-tab-coord";
const HEARTBEAT_INTERVAL_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
export class ChatTabCoordinator {
    tabId;
    channel = null;
    /** Claims held by OTHER tabs: chatId -> { tabId, lastSeen } */
    claims = new Map();
    /** chatIds that THIS tab has claimed */
    myClaims = new Set();
    listeners = new Set();
    messagesListeners = new Set();
    sessionListeners = new Set();
    heartbeatTimer = null;
    beforeUnloadHandler = null;
    constructor() {
        this.tabId =
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (typeof BroadcastChannel === "undefined") {
            return; // No-op mode
        }
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        // Heartbeat: send for our claims + check for stale claims from other tabs
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeats();
            this.expireStaleClaimsFromOtherTabs();
        }, HEARTBEAT_INTERVAL_MS);
        // Best-effort release on tab close
        this.beforeUnloadHandler = () => this.releaseAll();
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this.beforeUnloadHandler);
        }
    }
    /**
     * Attempt to claim a chatId for sending.
     * Returns false if another tab already holds it.
     */
    claim(chatId) {
        if (!this.channel)
            return true; // No-op mode
        const existing = this.claims.get(chatId);
        if (existing && existing.tabId !== this.tabId) {
            return false; // Another tab holds this chat
        }
        this.myClaims.add(chatId);
        this.broadcast({ type: "claim", chatId, tabId: this.tabId });
        return true;
    }
    /** Release a chatId so other tabs can claim it. */
    release(chatId) {
        if (!this.channel)
            return;
        if (!this.myClaims.has(chatId))
            return;
        this.myClaims.delete(chatId);
        this.broadcast({ type: "release", chatId, tabId: this.tabId });
    }
    /** Check if THIS tab currently holds a claim for the chatId. */
    hasClaim(chatId) {
        return this.myClaims.has(chatId);
    }
    /** Check if another tab holds this chatId. */
    isReadOnly(chatId) {
        if (!this.channel)
            return false;
        const claim = this.claims.get(chatId);
        return claim != null && claim.tabId !== this.tabId;
    }
    addListener(fn) {
        this.listeners.add(fn);
    }
    removeListener(fn) {
        this.listeners.delete(fn);
    }
    /** Broadcast the current messages to other tabs (for real-time sync). */
    broadcastMessages(chatId, messages) {
        if (!this.channel)
            return;
        this.broadcast({ type: "messages", chatId, tabId: this.tabId, messages });
    }
    addMessagesListener(fn) {
        this.messagesListeners.add(fn);
    }
    removeMessagesListener(fn) {
        this.messagesListeners.delete(fn);
    }
    /** Broadcast session state (lastEventId) to other tabs. */
    broadcastSession(chatId, session) {
        if (!this.channel)
            return;
        this.broadcast({ type: "session", chatId, tabId: this.tabId, session });
    }
    addSessionListener(fn) {
        this.sessionListeners.add(fn);
    }
    removeSessionListener(fn) {
        this.sessionListeners.delete(fn);
    }
    /** Clean up channel, timers, and event listeners. */
    dispose() {
        this.releaseAll();
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.beforeUnloadHandler && typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.listeners.clear();
        this.messagesListeners.clear();
        this.sessionListeners.clear();
    }
    // --- Private ---
    handleMessage(msg) {
        if (msg.tabId === this.tabId)
            return; // Ignore own messages
        switch (msg.type) {
            case "claim": {
                const wasReadOnly = this.isReadOnly(msg.chatId);
                this.claims.set(msg.chatId, { tabId: msg.tabId, lastSeen: Date.now() });
                if (!wasReadOnly) {
                    this.notify(msg.chatId, true);
                }
                break;
            }
            case "release": {
                const claim = this.claims.get(msg.chatId);
                if (claim && claim.tabId === msg.tabId) {
                    this.claims.delete(msg.chatId);
                    this.notify(msg.chatId, false);
                }
                break;
            }
            case "heartbeat": {
                const claim = this.claims.get(msg.chatId);
                if (claim && claim.tabId === msg.tabId) {
                    claim.lastSeen = Date.now();
                }
                break;
            }
            case "messages": {
                this.notifyMessages(msg.chatId, msg.messages);
                break;
            }
            case "session": {
                this.notifySession(msg.chatId, msg.session);
                break;
            }
        }
    }
    sendHeartbeats() {
        for (const chatId of this.myClaims) {
            this.broadcast({ type: "heartbeat", chatId, tabId: this.tabId });
        }
    }
    expireStaleClaimsFromOtherTabs() {
        const now = Date.now();
        for (const [chatId, claim] of this.claims) {
            if (claim.tabId !== this.tabId && now - claim.lastSeen > HEARTBEAT_TIMEOUT_MS) {
                this.claims.delete(chatId);
                this.notify(chatId, false);
            }
        }
    }
    releaseAll() {
        for (const chatId of [...this.myClaims]) {
            this.release(chatId);
        }
    }
    broadcast(msg) {
        try {
            this.channel?.postMessage(msg);
        }
        catch {
            // Channel may be closed
        }
    }
    notify(chatId, isReadOnly) {
        for (const fn of this.listeners) {
            try {
                fn(chatId, isReadOnly);
            }
            catch {
                // Non-fatal
            }
        }
    }
    notifyMessages(chatId, messages) {
        for (const fn of this.messagesListeners) {
            try {
                fn(chatId, messages);
            }
            catch {
                // Non-fatal
            }
        }
    }
    notifySession(chatId, session) {
        for (const fn of this.sessionListeners) {
            try {
                fn(chatId, session);
            }
            catch {
                // Non-fatal
            }
        }
    }
}
//# sourceMappingURL=chat-tab-coordinator.js.map