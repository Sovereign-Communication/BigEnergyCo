import type { WebhookVerifierArtifact, WebhookSecretProvisioning } from "../schemas/webhookConfig.js";
declare const __webhookEvent: unique symbol;
export type WebhookSource<TEvent = unknown> = {
    /** provider tag, e.g. "stripe" | "github" | "custom" */
    provider: string;
    /** data-only verifier artifact (config | preset in P1) */
    verifier: WebhookVerifierArtifact;
    /** who supplies the secret/key; drives the Connect UI (paste vs generate). Defaults to "either". */
    secretProvisioning?: WebhookSecretProvisioning;
    /** phantom, type-level only; never present at runtime */
    [__webhookEvent]?: TEvent;
};
export type AnyWebhookSource = WebhookSource<any>;
export type InferWebhookEvent<S> = S extends WebhookSource<infer TEvent> ? TEvent : unknown;
export type WebhookRunPayload<TEvent = unknown> = {
    event: TEvent;
    headers: Record<string, string>;
};
export type CreateWebhookEndpointParams = {
    /** declared webhook() id (string ref; GOLDEN LAW, never the value) */
    handler: string;
    tenantId?: string;
    externalRef?: string;
    metadata?: Record<string, unknown>;
};
export {};
