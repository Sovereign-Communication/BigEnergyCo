import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod/v4";
import { HttpReply } from "../apps/http.js";
import type { Registry } from "prom-client";
import type { AnyZodSchema, inferZodSchemaOutput } from "../types/schemas.js";
type RouteHandler<TParams extends AnyZodSchema = z.ZodUnknown, TQuery extends AnyZodSchema = z.ZodUnknown, TBody extends AnyZodSchema = z.ZodUnknown> = (ctx: {
    params: inferZodSchemaOutput<TParams>;
    queryParams: inferZodSchemaOutput<TQuery>;
    body: inferZodSchemaOutput<TBody>;
    req: IncomingMessage;
    res: ServerResponse;
    reply: HttpReply;
}) => Promise<any>;
interface RouteDefinition<TParams extends AnyZodSchema = z.ZodUnknown, TQuery extends AnyZodSchema = z.ZodUnknown, TBody extends AnyZodSchema = z.ZodUnknown> {
    paramsSchema?: TParams;
    querySchema?: TQuery;
    bodySchema?: TBody;
    keepConnectionAlive?: boolean;
    /** Skip reading + parsing the request body. The handler receives `body: undefined`.
     * Node drains any unconsumed body before the next keep-alive request. */
    skipBodyParsing?: boolean;
    handler: RouteHandler<TParams, TQuery, TBody>;
}
declare const HttpMethod: z.ZodEnum<{
    CONNECT: "CONNECT";
    DELETE: "DELETE";
    GET: "GET";
    HEAD: "HEAD";
    OPTIONS: "OPTIONS";
    PATCH: "PATCH";
    POST: "POST";
    PUT: "PUT";
    TRACE: "TRACE";
}>;
type HttpMethod = z.infer<typeof HttpMethod>;
type HttpServerOptions = {
    port: number;
    host: string;
    metrics?: {
        register?: Registry;
        expose?: boolean;
        collect?: boolean;
    };
};
export declare class HttpServer {
    private static httpRequestDuration?;
    private static httpRequestTotal?;
    private readonly metricsRegister?;
    private readonly port;
    private readonly host;
    private routes;
    readonly server: ReturnType<typeof createServer>;
    constructor(options: HttpServerOptions);
    route<TParams extends AnyZodSchema = z.ZodUnknown, TQuery extends AnyZodSchema = z.ZodUnknown, TBody extends AnyZodSchema = z.ZodUnknown>(path: `/${string}`, method: HttpMethod, definition: RouteDefinition<TParams, TQuery, TBody>): this;
    start(): Promise<void>;
    stop(): Promise<void>;
    private collectMetrics;
    private optionalSchema;
    private parseQueryParams;
    private parseRouteParams;
    private findRoute;
    private formatError;
}
export {};
