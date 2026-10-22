import type { WebhookAsymmetricConfig, WebhookHmacConfig } from "../schemas/webhookConfig.js";
/**
 * Preset verifier-config builders: the single source of truth for how each supported provider signs.
 * The public SDK `webhooks.stripe()` producers wrap these (attaching provider + secretProvisioning +
 * the phantom event type), and `@internal/webhook-sources` uses them to sign-and-verify its samples.
 * These carry zero SDK dependency (pure `WebhookVerifierConfig` data), so they live in core.
 */
export declare function stripeVerifierConfig(opts?: {
    toleranceSeconds?: number;
}): WebhookHmacConfig;
export declare function githubVerifierConfig(): WebhookHmacConfig;
export declare function svixVerifierConfig(): WebhookHmacConfig;
export declare function squareVerifierConfig(): WebhookHmacConfig;
export declare function discordVerifierConfig(opts?: {
    publicKeyEncoding?: "raw-hex" | "pem";
}): WebhookAsymmetricConfig;
export declare const WEBHOOK_PRESET_IDS: readonly ["custom", "stripe", "github", "svix", "square", "discord"];
export type WebhookPresetId = (typeof WEBHOOK_PRESET_IDS)[number];
/**
 * Per-provider verifier configs for providers whose signature is a plain HMAC variant that maps onto
 * the config primitives (a different header name / prefix / signing template than the shared presets,
 * but no new verifier capability). Each is round-trip tested in @internal/webhook-sources and wrapped
 * by a `webhooks.X()` SDK producer. Providers needing asymmetric verification, hex-decoded keys, or
 * URL+param signing are NOT here (they ship sample-only until the verifier gains those).
 */
export declare const webhookProviderConfigs: {
    slack: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    zoom: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    calendly: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    "cal-com": {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    sentry: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    pagerduty: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    vercel: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    linear: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    notion: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    typeform: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    docusign: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    jira: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    intercom: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    zendesk: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    attio: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    workos: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    elevenlabs: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    vapi: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    retell: {
        secretProvisioning: "provider";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
    shopify: {
        secretProvisioning: "integrator";
        config: () => {
            scheme: "hmac";
            algorithm: "sha1" | "sha256";
            encoding: "base64" | "hex";
            signatureHeader: string;
            signature?: {
                itemSeparator?: string | undefined;
                fieldSeparator?: string | undefined;
                field?: string | undefined;
                trim?: boolean | undefined;
            } | undefined;
            timestamp?: {
                source: {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                };
                unit?: "milliseconds" | "seconds" | undefined;
                toleranceSeconds?: number | undefined;
            } | undefined;
            signingString: "raw" | {
                template: string;
                vars?: Record<string, {
                    from: "header";
                    name: string;
                } | {
                    from: "signatureField";
                    field: string;
                } | {
                    from: "body";
                    path: string;
                } | {
                    from: "url";
                } | {
                    from: "constant";
                    value: string;
                }> | undefined;
            };
            secret?: {
                encoding?: "base64" | "utf8" | undefined;
                stripPrefix?: string | undefined;
            } | undefined;
            idempotencyField?: {
                from: "body" | "header";
                name: string;
            } | undefined;
            formPayload?: {
                field: string;
            } | undefined;
        };
    };
};
export type WebhookProviderId = keyof typeof webhookProviderConfigs;
export * from "../schemas/webhookConfig.js";
