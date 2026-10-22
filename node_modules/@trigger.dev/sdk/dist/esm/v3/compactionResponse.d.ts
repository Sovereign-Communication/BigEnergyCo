import type { UIMessage } from "ai";
/**
 * Inner compaction summarizes completed model steps, but the captured UI response
 * still contains every step. Trim that prefix before model-message conversion:
 * one step can produce zero, one or several model messages (hidden reasoning,
 * provider tools, custom tool outputs), so a model-message count is not a UI offset.
 * The full response is left untouched for display and transcript persistence.
 */
export declare function responseAfterCompaction<T extends UIMessage>(response: T, compactedSteps?: number, originalResponse?: UIMessage): T;
