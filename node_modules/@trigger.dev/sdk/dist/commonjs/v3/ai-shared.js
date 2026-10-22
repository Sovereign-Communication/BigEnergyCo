"use strict";
/**
 * Browser-safe primitives shared between `@trigger.dev/sdk/ai` (server) and
 * `@trigger.dev/sdk/chat` / `@trigger.dev/sdk/chat/react` (client).
 *
 * This module exists to keep `ai.ts` reachable only from the server graph.
 * `ai.ts` weighs in at ~7000 lines and statically imports the agent-skills
 * runtime (which uses `node:child_process` / `node:fs/promises`). When a
 * browser bundle imports a runtime value from `ai.ts` — historically the
 * `PENDING_MESSAGE_INJECTED_TYPE` constant in `chat-react.ts` — the bundler
 * traces `ai.ts`'s entire module graph into the client chunk and hits the
 * `node:` builtins, which Turbopack rejects outright (and webpack flags as
 * a "Critical dependency" warning).
 *
 * Anything in this file MUST stay free of `node:*` imports and free of any
 * import from `ai.ts`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EOF_RESUBSCRIBES = exports.PENDING_MESSAGE_INJECTED_TYPE = void 0;
exports.upsertIncomingMessage = upsertIncomingMessage;
exports.slimSubmitMessageForWire = slimSubmitMessageForWire;
exports.chatRunTags = chatRunTags;
exports.waitBeforeEofResubscribe = waitBeforeEofResubscribe;
/**
 * Message-part `type` value for the pending-message data part the agent
 * injects when a follow-up message arrives mid-turn.
 */
exports.PENDING_MESSAGE_INJECTED_TYPE = "data-pending-message-injected";
/**
 * Upsert an incoming wire message into the customer's DB-backed chain
 * inside a `hydrateMessages` hook. Returns `true` iff the chain was
 * mutated (the caller should persist).
 *
 * Handles the three cases that matter:
 *
 *  - **Non-submit-message trigger** (`regenerate-message` / `action`,
 *    or `submit-message` with no incoming): no-op. Returns `false`.
 *  - **Incoming id already in `stored`** (HITL `addToolOutput` /
 *    `addToolApproveResponse` continuation — the wire carries the
 *    existing assistant's id with a slim resolution payload): no-op.
 *    The runtime's per-turn merge overlays the new tool-state advance
 *    onto the existing entry; pushing again would duplicate the row
 *    in the chain you return, and the duplicate slim copy would hit
 *    `toModelMessages` with no `input`. Returns `false`.
 *  - **Incoming id not in `stored`** (typically a fresh user message
 *    on a new turn): push. Returns `true`.
 *
 * Mutates `stored` in place. The caller persists `stored`, not the
 * return value.
 *
 * @example
 * ```ts
 * import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai";
 *
 * chat.agent({
 *   hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
 *     const record = await db.chat.findUnique({ where: { id: chatId } });
 *     const stored = record?.messages ?? [];
 *     if (upsertIncomingMessage(stored, { trigger, incomingMessages })) {
 *       await db.chat.update({ where: { id: chatId }, data: { messages: stored } });
 *     }
 *     return stored;
 *   },
 * });
 * ```
 */
function upsertIncomingMessage(stored, event) {
    if (event.trigger !== "submit-message")
        return false;
    if (event.incomingMessages.length === 0)
        return false;
    const newMsg = event.incomingMessages[event.incomingMessages.length - 1];
    if (!newMsg)
        return false;
    if (newMsg.id) {
        const existingIdx = stored.findIndex((m) => m.id === newMsg.id);
        if (existingIdx !== -1)
            return false;
    }
    stored.push(newMsg);
    return true;
}
/**
 * Tool-part states that the client advances and ships back over the wire.
 * Covers HITL `addToolOutput` (output-available / output-error) and the
 * approval flow (approval-responded / output-denied). `input-streaming` /
 * `input-available` / `approval-requested` are server-emitted only — if
 * we see them on the wire we treat them as no-ops and skip the slim/merge.
 */
function isWireAdvanceableToolState(state) {
    return (state === "output-available" ||
        state === "output-error" ||
        state === "approval-responded" ||
        state === "output-denied");
}
/** Whether a tool-UI part is a static (`tool-${name}`) or dynamic tool. */
function isToolPartType(type) {
    return typeof type === "string" && (type.startsWith("tool-") || type === "dynamic-tool");
}
/**
 * Slim an outgoing assistant message before it ships on `submit-message`.
 *
 * When the client calls `addToolOutput(...)` to resolve a HITL tool (or
 * `addToolApproveResponse(...)` to approve/deny one), the AI SDK turns
 * it into a `submit-message` whose `messages.at(-1)` is the existing
 * assistant message with the new state stitched onto a single tool
 * part. On a reasoning-heavy multi-step turn, that full assistant
 * message can be 600 KB – 1 MB (encrypted reasoning blobs, reasoning
 * text, full tool `input` JSON, prior tool outputs) — well over the
 * `.in/append` cap.
 *
 * The agent runtime only consumes the wire-advanced fields of those
 * tool parts (state + output / errorText / approval). Everything else
 * (text, reasoning, tool `input`) is rebuilt server-side from the
 * durable snapshot or `hydrateMessages`. So we drop everything but
 * the advanced tool parts here, and reduce those to just the fields
 * the server overlays.
 *
 * The slim only fires when the assistant message carries at least one
 * wire-advanceable tool part. Plain assistant resends (no resolved /
 * approval-responded tool) and non-assistant messages pass through
 * untouched.
 *
 * Pairs with the per-turn merge on the agent side
 * (`mergeIncomingIntoHydrated` in `ai.ts`).
 */
function slimSubmitMessageForWire(message) {
    if (!message)
        return message;
    if (message.role !== "assistant")
        return message;
    const parts = (message.parts ?? []);
    const advancedToolParts = parts.filter((p) => p && typeof p === "object" && isToolPartType(p.type) && isWireAdvanceableToolState(p.state));
    if (advancedToolParts.length === 0)
        return message;
    const slimParts = advancedToolParts.map((p) => {
        const base = {
            type: p.type,
            toolCallId: p.toolCallId,
            state: p.state,
        };
        if (p.type === "dynamic-tool" && typeof p.toolName === "string") {
            base.toolName = p.toolName;
        }
        if (p.state === "output-available") {
            base.output = p.output;
            if (p.approval !== undefined)
                base.approval = p.approval;
        }
        else if (p.state === "output-error") {
            if (p.errorText !== undefined)
                base.errorText = p.errorText;
            if (p.approval !== undefined)
                base.approval = p.approval;
        }
        else if (p.state === "approval-responded" || p.state === "output-denied") {
            if (p.approval !== undefined)
                base.approval = p.approval;
        }
        return base;
    });
    return {
        id: message.id,
        role: message.role,
        parts: slimParts,
    };
}
/** Run tags accept at most 10 entries of at most 128 characters each. */
const MAX_RUN_TAGS = 10;
const MAX_RUN_TAG_LENGTH = 128;
/**
 * Build the run tags for a chat session: the automatic `chat:{chatId}` tag
 * followed by the caller's tags, capped at the run tag limit. The chat tag
 * is skipped when the chat ID is too long to fit within a single tag, so a
 * long ID degrades to "not filterable by chat" rather than failing to start.
 */
function chatRunTags(chatId, userTags = []) {
    const chatTag = `chat:${chatId}`;
    const tags = chatTag.length <= MAX_RUN_TAG_LENGTH ? [chatTag, ...userTags] : [...userTags];
    return tags.slice(0, MAX_RUN_TAGS);
}
/**
 * A session body that ends without a turn-complete is only terminal when the
 * server says the session settled — otherwise the turn is still running and
 * the connection was lost (long-poll window closed, proxy restarted). Both
 * transports resubscribe from the last event id, bounded so a permanently
 * empty stream can't spin.
 */
exports.MAX_EOF_RESUBSCRIBES = 5;
/**
 * Backoff before the nth (1-based) EOF resubscribe, jittered so many clients
 * dropped by the same window don't reconnect in lockstep. Resolves early on
 * abort — otherwise a stop landing mid-backoff leaves the stream open for the
 * rest of it.
 */
function waitBeforeEofResubscribe(attempt, signal) {
    // An already-aborted signal never fires `abort` again, so a listener added
    // here would wait out the whole backoff.
    if (signal.aborted)
        return Promise.resolve();
    return new Promise((resolve) => {
        let timer;
        const done = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
        };
        const backoff = Math.min(100 * 2 ** (attempt - 1), 5_000);
        timer = setTimeout(done, backoff * (0.5 + Math.random() * 0.5));
        signal.addEventListener("abort", done);
        if (signal.aborted)
            done();
    });
}
//# sourceMappingURL=ai-shared.js.map