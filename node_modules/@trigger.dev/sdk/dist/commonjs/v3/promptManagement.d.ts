import { type ApiRequestOptions, type CreatePromptOverrideRequestBody, type ListPromptsResponseBody, type ListPromptVersionsResponseBody, type PromptOkResponseBody, type PromptOverrideCreatedResponseBody, type UpdatePromptOverrideRequestBody } from "@trigger.dev/core/v3";
import type { AnyPromptHandle, PromptIdentifier, PromptVariables, ResolvedPrompt } from "./prompt.js";
/**
 * Resolve a prompt by slug, calling the API to get the current version's
 * compiled text. Works both inside and outside of a task context — requires
 * an API client to be configured (via `configure()` or task runtime).
 */
export declare function resolvePrompt<TPromptHandle extends AnyPromptHandle = AnyPromptHandle>(slug: PromptIdentifier<TPromptHandle>, variables?: PromptVariables<TPromptHandle>, options?: {
    label?: string;
    version?: number;
    requestOptions?: ApiRequestOptions;
}): Promise<ResolvedPrompt>;
/** List all prompts in the current environment. */
export declare function listPrompts(requestOptions?: ApiRequestOptions): Promise<ListPromptsResponseBody>;
/** List all versions for a prompt. */
export declare function listPromptVersions(slug: string, requestOptions?: ApiRequestOptions): Promise<ListPromptVersionsResponseBody>;
/** Promote a code-deployed version to be the current version. */
export declare function promotePromptVersion(slug: string, version: number, requestOptions?: ApiRequestOptions): Promise<PromptOkResponseBody>;
/** Create an override — a dashboard/API edit that takes priority over the deployed version. */
export declare function createPromptOverride(slug: string, body: CreatePromptOverrideRequestBody, requestOptions?: ApiRequestOptions): Promise<PromptOverrideCreatedResponseBody>;
/** Update the active override's content or model. */
export declare function updatePromptOverride(slug: string, body: UpdatePromptOverrideRequestBody, requestOptions?: ApiRequestOptions): Promise<PromptOkResponseBody>;
/** Remove the active override, reverting to the current deployed version. */
export declare function removePromptOverride(slug: string, requestOptions?: ApiRequestOptions): Promise<PromptOkResponseBody>;
/** Reactivate a previously removed override version. */
export declare function reactivatePromptOverride(slug: string, version: number, requestOptions?: ApiRequestOptions): Promise<PromptOkResponseBody>;
