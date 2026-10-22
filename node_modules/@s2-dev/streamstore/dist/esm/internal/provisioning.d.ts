import type { ProvisionResult } from "../types.js";
type ResponseLike = {
    status?: number;
    statusText?: string;
    headers?: {
        get(name: string): string | null;
    };
};
type GeneratedResponse<T> = {
    data?: T;
    error?: unknown;
    response?: ResponseLike;
} | T;
export declare function provisionResultFromResponse(response: ResponseLike | undefined): ProvisionResult;
export declare function withS2DataAndResponse<T>(fn: () => Promise<GeneratedResponse<T>>): Promise<{
    data: T;
    response?: ResponseLike;
}>;
export {};
//# sourceMappingURL=provisioning.d.ts.map