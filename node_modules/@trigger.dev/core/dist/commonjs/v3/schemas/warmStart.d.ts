import { z } from "zod/v4";
export declare const WarmStartConnectResponse: z.ZodObject<{
    connectionTimeoutMs: z.ZodOptional<z.ZodNumber>;
    keepaliveMs: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type WarmStartConnectResponse = z.infer<typeof WarmStartConnectResponse>;
