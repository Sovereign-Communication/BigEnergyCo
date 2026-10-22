import { type TaskSchema, type inferSchemaIn } from "@trigger.dev/core/v3";
type PromptOptions<TIdentifier extends string = string, TVariables extends TaskSchema | undefined = undefined> = {
    id: TIdentifier;
    description?: string;
    model?: string;
    config?: Record<string, unknown>;
    variables?: TVariables;
    content: string;
};
type ResolvedPrompt = {
    promptId: string;
    version: number;
    labels: string[];
    text: string;
    model: string | undefined;
    config: Record<string, unknown> | undefined;
    /** Returns `experimental_telemetry` options for AI SDK calls (`generateText`, `streamText`, etc.) */
    toAISDKTelemetry(additionalMetadata?: Record<string, string>): {
        experimental_telemetry: {
            isEnabled: true;
            metadata: Record<string, string>;
        };
    };
};
export type { PromptOptions, ResolvedPrompt };
export type PromptHandle<TIdentifier extends string = string, TVariables extends TaskSchema | undefined = undefined> = {
    id: TIdentifier;
    resolve(variables: inferSchemaIn<TVariables>, options?: {
        label?: string;
        version?: number;
    }): Promise<ResolvedPrompt>;
};
export type AnyPromptHandle = PromptHandle<string, any>;
/** Extract the identifier (id literal type) from a PromptHandle */
export type PromptIdentifier<T extends AnyPromptHandle> = T extends PromptHandle<infer TId, any> ? TId : string;
/** Extract the variables input type from a PromptHandle */
export type PromptVariables<T extends AnyPromptHandle> = T extends PromptHandle<any, infer TVariables> ? inferSchemaIn<TVariables> : Record<string, unknown>;
export declare function definePrompt<TIdentifier extends string, TVariables extends TaskSchema | undefined = undefined>(options: PromptOptions<TIdentifier, TVariables>): PromptHandle<TIdentifier, TVariables>;
