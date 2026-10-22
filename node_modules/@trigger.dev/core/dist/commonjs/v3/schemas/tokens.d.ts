import { z } from "zod/v4";
export declare const CreateAuthorizationCodeResponseSchema: z.ZodObject<{
    url: z.ZodString;
    authorizationCode: z.ZodString;
}, z.core.$strip>;
export type CreateAuthorizationCodeResponse = z.infer<typeof CreateAuthorizationCodeResponseSchema>;
export declare const GetPersonalAccessTokenRequestSchema: z.ZodObject<{
    authorizationCode: z.ZodString;
}, z.core.$strip>;
export type GetPersonalAccessTokenRequest = z.infer<typeof GetPersonalAccessTokenRequestSchema>;
export declare const GetPersonalAccessTokenResponseSchema: z.ZodObject<{
    token: z.ZodNullable<z.ZodObject<{
        token: z.ZodString;
        obfuscatedToken: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GetPersonalAccessTokenResponse = z.infer<typeof GetPersonalAccessTokenResponseSchema>;
