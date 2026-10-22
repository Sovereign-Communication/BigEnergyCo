"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookVerifierResult = exports.WebhookRoutingTarget = exports.WebhookVerifierArtifact = exports.WebhookHandshakeConfig = exports.WebhookVerifierConfig = exports.WebhookUrlSecretConfig = exports.WebhookSharedSecretConfig = exports.WebhookAsymmetricConfig = exports.WebhookHmacConfig = exports.WebhookFormPayload = exports.WebhookSigningString = exports.WebhookSecretTransform = exports.WebhookTimestampConfig = exports.WebhookSignatureExtraction = exports.WebhookValueSource = exports.WebhookIdempotencyField = exports.WebhookSecretProvisioning = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
// Ingress webhook verification config. Kept in a LEAF module (imports only `z` and
// the Zod compatibility helper) so it can be consumed by resources.ts / schemas.ts without dragging in the alert-webhook
// `Webhook` union in webhooks.ts, which imports api.js (RunStatus). resources.ts is
// imported by api.ts, so a resources -> webhooks -> api edge would be a module-init cycle.
// Who supplies the signing secret / key, driving the dashboard Connect UI (NOT a provider-name
// switch — it's data on the source). "provider": the provider generates it and you paste it in
// (Stripe, Slack, Svix). "integrator": you choose it, so the dashboard can generate-and-reveal one
// for you to paste into the provider (GitHub, GitLab). "either": offer both.
exports.WebhookSecretProvisioning = v4_1.z.enum(["provider", "integrator", "either"]);
// Q9: the provider delivery id can live in a header (GitHub x-github-delivery) or the body (Stripe id).
exports.WebhookIdempotencyField = v4_1.z.object({
    from: v4_1.z.enum(["header", "body"]),
    name: v4_1.z.string(),
});
// ── Shared, data-only verification primitives (no per-provider code) ──
// Where a scalar value comes from. Used for the timestamp and for signing-string template vars.
// "signatureField" reads a field parsed out of the signature header (e.g. Stripe `t`).
// "url" is the inbound request URL (e.g. Square signs `{url}{body}`). "constant" is a literal.
exports.WebhookValueSource = (0, zod_js_1.discriminatedUnion)("from", [
    v4_1.z.object({ from: v4_1.z.literal("header"), name: v4_1.z.string() }),
    v4_1.z.object({ from: v4_1.z.literal("signatureField"), field: v4_1.z.string() }),
    v4_1.z.object({ from: v4_1.z.literal("body"), path: v4_1.z.string() }),
    v4_1.z.object({ from: v4_1.z.literal("url") }),
    v4_1.z.object({ from: v4_1.z.literal("constant"), value: v4_1.z.string() }),
]);
// How to pull the signature value(s) out of one header. All fields optional → the whole
// header value IS the signature (Shopify, Linear). With fieldSeparator+field we select
// named element(s): GitHub `sha256=<hex>`, Stripe `t=…,v1=…`, Svix `v1,<b64> v1,<b64>`.
// Field extraction is multi-valued (rotation / signature lists) → the verifier accepts ANY match.
exports.WebhookSignatureExtraction = v4_1.z.object({
    itemSeparator: v4_1.z.string().optional(), // split header into elements: Stripe "," · Svix " "
    fieldSeparator: v4_1.z.string().optional(), // split element into name<sep>value: "=" · Svix ","
    field: v4_1.z.string().optional(), // element name carrying the signature: "v1" | "sha256" | "v0"
    trim: v4_1.z.boolean().optional(), // trim each element (WorkOS "t=…, v1=…")
});
// Replay protection + a `{timestamp}` template var. Source is a header, an in-signature field
// (Stripe `t`), or a body field (Linear `webhookTimestamp`). Unit defaults to seconds.
exports.WebhookTimestampConfig = v4_1.z.object({
    source: exports.WebhookValueSource,
    unit: v4_1.z.enum(["seconds", "milliseconds"]).optional(),
    toleranceSeconds: v4_1.z.number().optional(),
});
// The stored credential transform. Most providers use the secret as-is (utf8). Svix-family
// secrets are `whsec_<base64>` and must be base64-decoded after stripping the prefix.
exports.WebhookSecretTransform = v4_1.z.object({
    encoding: v4_1.z.enum(["utf8", "base64"]).optional(),
    stripPrefix: v4_1.z.string().optional(),
});
// The bytes that get signed. "raw" = the body verbatim. Otherwise a template with `{body}`,
// `{timestamp}` (auto-bound) and any named `vars` (e.g. `{id}` for Svix, `{url}` for Square).
exports.WebhookSigningString = v4_1.z.union([
    v4_1.z.literal("raw"),
    v4_1.z.object({
        template: v4_1.z.string(),
        vars: v4_1.z.record(v4_1.z.string(), exports.WebhookValueSource).optional(),
    }),
]);
/**
 * Body-parsing hint. Some providers send an event as JSON but a SECOND kind of callback (e.g. Slack
 * interactivity) as `application/x-www-form-urlencoded` with the JSON in a single field (Slack: `payload`).
 * When JSON parsing fails, the engine form-decodes and JSON-parses `field`'s value. The signature is over
 * the raw body either way, so verification is unaffected. Generic (a field name), no provider code in the engine.
 */
exports.WebhookFormPayload = v4_1.z.object({
    field: v4_1.z.string(),
});
exports.WebhookHmacConfig = v4_1.z.object({
    scheme: v4_1.z.literal("hmac"),
    algorithm: v4_1.z.enum(["sha256", "sha1"]),
    encoding: v4_1.z.enum(["hex", "base64"]), // explicit, no auto-detect (design decision 3)
    signatureHeader: v4_1.z.string(),
    signature: exports.WebhookSignatureExtraction.optional(), // omit = bare whole-header value
    timestamp: exports.WebhookTimestampConfig.optional(),
    signingString: exports.WebhookSigningString,
    secret: exports.WebhookSecretTransform.optional(), // omit = utf8, no prefix strip
    idempotencyField: exports.WebhookIdempotencyField.optional(),
    formPayload: exports.WebhookFormPayload.optional(),
});
// Asymmetric (public-key) signatures: the provider signs with a private key, we verify with
// their public key. Same parsing/template primitives as HMAC; only the final verify differs.
// Covers Discord (ed25519), SendGrid (ecdsa-p256), RSA providers. Dynamic key fetch (PayPal
// cert URL / JWKS) is out of scope → the custom-bundle escape hatch.
exports.WebhookAsymmetricConfig = v4_1.z.object({
    scheme: v4_1.z.literal("asymmetric"),
    algorithm: v4_1.z.enum(["ed25519", "ecdsa-p256", "rsa-sha256"]),
    encoding: v4_1.z.enum(["hex", "base64"]), // how the signature value is encoded
    signatureHeader: v4_1.z.string(),
    signature: exports.WebhookSignatureExtraction.optional(),
    timestamp: exports.WebhookTimestampConfig.optional(),
    signingString: exports.WebhookSigningString,
    // How the stored public key is encoded: a PEM string, base64 of DER SPKI (SendGrid),
    // or raw key bytes (ed25519 raw, Discord). Defaults to "pem".
    publicKeyEncoding: v4_1.z.enum(["pem", "spki-der-base64", "raw-hex", "raw-base64"]).optional(),
    idempotencyField: exports.WebhookIdempotencyField.optional(),
});
exports.WebhookSharedSecretConfig = v4_1.z.object({
    scheme: v4_1.z.literal("shared-secret"),
    placement: v4_1.z.enum(["header", "bearer", "basic", "body"]),
    fieldName: v4_1.z.string().optional(),
    idempotencyField: exports.WebhookIdempotencyField.optional(),
});
exports.WebhookUrlSecretConfig = v4_1.z.object({
    scheme: v4_1.z.literal("url-secret"),
    placement: v4_1.z.enum(["query", "path"]),
    paramName: v4_1.z.string(),
    idempotencyField: exports.WebhookIdempotencyField.optional(),
});
exports.WebhookVerifierConfig = (0, zod_js_1.discriminatedUnion)("scheme", [
    exports.WebhookHmacConfig,
    exports.WebhookSharedSecretConfig,
    exports.WebhookUrlSecretConfig,
    exports.WebhookAsymmetricConfig,
]);
// ── Provider handshake: a signed request that must get a synchronous echo, not a recorded/routed
// delivery (Slack url_verification, Discord PING). Generic + data-only: if the verified body's
// `matchPath` equals `matchValue`, ingest responds 200 with the body's `respondPath` value. ──
exports.WebhookHandshakeConfig = v4_1.z.object({
    matchPath: v4_1.z.string(), // dotted path into the body, e.g. "type"
    matchValue: v4_1.z.string(), // e.g. "url_verification"
    respondPath: v4_1.z.string(), // dotted path to echo, e.g. "challenge"
});
// ── Verifier artifact: data-only tagged union stored on WebhookEndpoint.verifierArtifact ──
exports.WebhookVerifierArtifact = (0, zod_js_1.discriminatedUnion)("kind", [
    v4_1.z.object({
        kind: v4_1.z.literal("config"),
        config: exports.WebhookVerifierConfig,
        handshake: exports.WebhookHandshakeConfig.optional(),
    }),
    v4_1.z.object({
        kind: v4_1.z.literal("preset"),
        preset: v4_1.z.string(),
        config: exports.WebhookVerifierConfig,
        handshake: exports.WebhookHandshakeConfig.optional(),
    }),
    v4_1.z.object({ kind: v4_1.z.literal("bundle"), bundleUrl: v4_1.z.string(), hash: v4_1.z.string() }), // P3 seam
]);
// ── Routing target: data-only tagged union stored on WebhookEndpoint.routingTarget ──
// P1 implements only { type: "task" }. The session variant routes a delivery to a find-or-created
// session: keyTemplate resolves the externalId, deliverAs selects the mode. "action" (chat.event)
// carries actionType → the onAction envelope's action.type; "message" (channels) carries connectorId
// → the run resolves the connector's inbound() mapper and runs a turn.
exports.WebhookRoutingTarget = (0, zod_js_1.discriminatedUnion)("type", [
    v4_1.z.object({ type: v4_1.z.literal("task"), taskId: v4_1.z.string() }),
    v4_1.z.object({
        type: v4_1.z.literal("session"),
        taskIdentifier: v4_1.z.string(),
        keyTemplate: v4_1.z.string(),
        deliverAs: v4_1.z.enum(["action", "message"]),
        actionType: v4_1.z.string().optional(),
        connectorId: v4_1.z.string().optional(),
        triggerConfigTemplate: v4_1.z.record(v4_1.z.string(), v4_1.z.unknown()).optional(),
        // Gate session CREATION: an event that already resolves to an existing session always resumes it,
        // but a key with no session is only started when the event matches this filter. Absent => always start.
        startOn: v4_1.z.string().optional(),
    }),
]);
// ── Data-only verdict the engine verifier returns (M5 consumes) ──
exports.WebhookVerifierResult = v4_1.z.object({
    ok: v4_1.z.boolean(),
    idempotencyKey: v4_1.z.string(),
    parsedEvent: v4_1.z.unknown().optional(),
    error: v4_1.z.string().optional(),
});
//# sourceMappingURL=webhookConfig.js.map