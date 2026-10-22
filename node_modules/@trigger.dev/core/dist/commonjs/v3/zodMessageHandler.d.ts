import { z } from "zod/v4";
import type { AnyZodSchema, ZodErrorLike, inferZodSchemaInput, inferZodSchemaOutput } from "./types/schemas.js";
import type { StructuredLogger } from "./utils/structuredLogger.js";
export declare class ZodSchemaParsedError extends Error {
    error: ZodErrorLike;
    payload: unknown;
    constructor(error: ZodErrorLike, payload: unknown);
}
export type ZodMessageValueSchema<TSchema extends AnyZodSchema = AnyZodSchema> = TSchema;
export interface ZodMessageCatalogSchema {
    [key: string]: AnyZodSchema;
}
export type ZodMessageHandlers<TCatalogSchema extends ZodMessageCatalogSchema> = Partial<{
    [K in keyof TCatalogSchema]: (payload: inferZodSchemaOutput<TCatalogSchema[K]>) => Promise<any>;
}>;
export type ZodMessageHandlerOptions<TMessageCatalog extends ZodMessageCatalogSchema> = {
    schema: TMessageCatalog;
    messages?: ZodMessageHandlers<TMessageCatalog>;
    logger?: StructuredLogger;
};
export type MessageFromSchema<K extends keyof TMessageCatalog, TMessageCatalog extends ZodMessageCatalogSchema> = {
    type: K;
    payload: inferZodSchemaInput<TMessageCatalog[K]>;
};
export type MessagePayloadFromSchema<K extends keyof TMessageCatalog, TMessageCatalog extends ZodMessageCatalogSchema> = inferZodSchemaOutput<TMessageCatalog[K]>;
export type MessageFromCatalog<TMessageCatalog extends ZodMessageCatalogSchema> = {
    [K in keyof TMessageCatalog]: MessageFromSchema<K, TMessageCatalog>;
}[keyof TMessageCatalog];
export declare const ZodMessageSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<"v1">>;
    type: z.ZodString;
    payload: z.ZodUnknown;
}, z.core.$strip>;
export interface EventEmitterLike {
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}
export declare class ZodMessageHandler<TMessageCatalog extends ZodMessageCatalogSchema> {
    #private;
    constructor(options: ZodMessageHandlerOptions<TMessageCatalog>);
    handleMessage(message: unknown): Promise<{
        success: true;
        data: unknown;
    } | {
        success: false;
        error: string;
    }>;
    parseMessage(message: unknown): {
        success: true;
        data: MessageFromCatalog<TMessageCatalog>;
    } | {
        success: false;
        error: string;
    };
    registerHandlers(emitter: EventEmitterLike, logger?: StructuredLogger): void;
}
export declare function parseMessageFromCatalog<TMessageCatalog extends ZodMessageCatalogSchema>(message: unknown, schema: TMessageCatalog): MessageFromCatalog<TMessageCatalog>;
type ZodMessageSenderCallback<TMessageCatalog extends ZodMessageCatalogSchema> = (message: {
    type: keyof TMessageCatalog;
    payload: inferZodSchemaOutput<TMessageCatalog[keyof TMessageCatalog]>;
    version: "v1";
}) => Promise<void>;
export type ZodMessageSenderOptions<TMessageCatalog extends ZodMessageCatalogSchema> = {
    schema: TMessageCatalog;
    sender: ZodMessageSenderCallback<TMessageCatalog>;
    canSendMessage?: () => Promise<boolean> | boolean;
};
export declare class ZodMessageSender<TMessageCatalog extends ZodMessageCatalogSchema> {
    #private;
    constructor(options: ZodMessageSenderOptions<TMessageCatalog>);
    validateCanSendMessage(): Promise<boolean>;
    send<K extends keyof TMessageCatalog>(type: K, payload: inferZodSchemaInput<TMessageCatalog[K]>): Promise<void>;
    forwardMessage(message: unknown): Promise<void>;
}
export declare function sendMessageInCatalog<TMessageCatalog extends ZodMessageCatalogSchema>(catalog: TMessageCatalog, type: keyof TMessageCatalog, payload: inferZodSchemaInput<TMessageCatalog[keyof TMessageCatalog]>, sender: ZodMessageSenderCallback<TMessageCatalog>): Promise<void>;
export type MessageCatalogToSocketIoEvents<TCatalog extends ZodMessageCatalogSchema> = {
    [K in keyof TCatalog]: (message: inferZodSchemaOutput<TCatalog[K]>) => void;
};
export {};
