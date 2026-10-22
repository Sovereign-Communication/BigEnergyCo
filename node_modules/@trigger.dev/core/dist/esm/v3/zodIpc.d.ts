import type { ExecutorToWorkerMessageCatalog, WorkerToExecutorMessageCatalog } from "./schemas/messages.js";
import type { inferZodSchemaInput, inferZodSchemaOutput } from "./types/schemas.js";
import type { GetSocketCallbackSchema, GetSocketMessageSchema, GetSocketMessagesWithCallback, GetSocketMessagesWithoutCallback, SocketMessageHasCallback, ZodSocketMessageCatalogSchema } from "./zodSocket.js";
interface ZodIpcMessageSender<TEmitCatalog extends ZodSocketMessageCatalogSchema> {
    send<K extends GetSocketMessagesWithoutCallback<TEmitCatalog>>(type: K, payload: inferZodSchemaInput<GetSocketMessageSchema<TEmitCatalog, K>>): Promise<void>;
    sendWithAck<K extends GetSocketMessagesWithCallback<TEmitCatalog>>(type: K, payload: inferZodSchemaInput<GetSocketMessageSchema<TEmitCatalog, K>>): Promise<inferZodSchemaOutput<GetSocketCallbackSchema<TEmitCatalog, K>>>;
}
type ZodIpcMessageHandlers<TListenCatalog extends ZodSocketMessageCatalogSchema, TEmitCatalog extends ZodSocketMessageCatalogSchema> = Partial<{
    [K in keyof TListenCatalog]: (payload: inferZodSchemaOutput<GetSocketMessageSchema<TListenCatalog, K>>, sender: ZodIpcMessageSender<TEmitCatalog>) => Promise<SocketMessageHasCallback<TListenCatalog, K> extends true ? inferZodSchemaInput<GetSocketCallbackSchema<TListenCatalog, K>> : void>;
}>;
interface ZodIpcConnectionOptions<TListenCatalog extends ZodSocketMessageCatalogSchema, TEmitCatalog extends ZodSocketMessageCatalogSchema> {
    listenSchema: TListenCatalog;
    emitSchema: TEmitCatalog;
    process: {
        send?: (message: any) => any;
        on?: (event: "message", listener: (message: any) => void) => void;
        connected?: boolean;
    };
    handlers?: ZodIpcMessageHandlers<TListenCatalog, TEmitCatalog>;
}
export declare class ZodIpcConnection<TListenCatalog extends ZodSocketMessageCatalogSchema, TEmitCatalog extends ZodSocketMessageCatalogSchema> {
    #private;
    private opts;
    constructor(opts: ZodIpcConnectionOptions<TListenCatalog, TEmitCatalog>);
    connect(): Promise<void>;
    send<K extends GetSocketMessagesWithoutCallback<TEmitCatalog>>(type: K, payload: inferZodSchemaInput<GetSocketMessageSchema<TEmitCatalog, K>>): Promise<void>;
    sendWithAck<K extends GetSocketMessagesWithCallback<TEmitCatalog>>(type: K, payload: inferZodSchemaInput<GetSocketMessageSchema<TEmitCatalog, K>>, timeoutInMs?: number): Promise<inferZodSchemaOutput<GetSocketCallbackSchema<TEmitCatalog, K>>>;
}
export type WorkerToExecutorProcessConnection = ZodIpcConnection<typeof ExecutorToWorkerMessageCatalog, typeof WorkerToExecutorMessageCatalog>;
export type ExecutorToWorkerProcessConnection = ZodIpcConnection<typeof WorkerToExecutorMessageCatalog, typeof ExecutorToWorkerMessageCatalog>;
export {};
