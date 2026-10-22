import type { AnyZodSchema, inferZodSchemaOutput } from "../types/schemas.js";
import { type AsyncIterableStream } from "../streams/asyncIterableStream.js";
export type ZodShapeStreamOptions = {
    headers?: Record<string, string>;
    fetchClient?: typeof fetch;
    signal?: AbortSignal;
    onError?: (e: Error) => void;
};
export type ZodShapeStreamInstance<TShapeSchema extends AnyZodSchema> = {
    stream: AsyncIterableStream<inferZodSchemaOutput<TShapeSchema>>;
    stop: (delay?: number) => void;
};
export declare function zodShapeStream<TShapeSchema extends AnyZodSchema>(schema: TShapeSchema, url: string, options?: ZodShapeStreamOptions): ZodShapeStreamInstance<TShapeSchema>;
