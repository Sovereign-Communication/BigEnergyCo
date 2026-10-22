"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayWebhookDeliveryResponse = exports.RotateWebhookEndpointSecretResponse = exports.WebhookDeliveryObject = exports.ListWebhookDeliveriesResponse = exports.WebhookDeliveryListItem = exports.ListWebhookEndpointsResponse = exports.WebhookEndpointObject = exports.WebhookDeliveryApiStatus = exports.WebhookEndpointApiStatus = void 0;
const v4_1 = require("zod/v4");
// Reuse the source-side enum (provider | integrator | either) rather than redefining it.
const webhookConfig_js_1 = require("./webhookConfig.js");
// Public HTTP API objects for webhooks (endpoints + deliveries). Read surface for now; the create
// path (dynamic endpoints) and lifecycle actions layer on later. Mirrors the Errors API shape:
// list endpoints return `{ data, pagination? }`, detail endpoints return the object directly.
// Statuses are exposed lowercase over the API (the DB enums are uppercase).
exports.WebhookEndpointApiStatus = v4_1.z.enum(["active", "inactive", "deleting"]);
exports.WebhookDeliveryApiStatus = v4_1.z.enum([
    "pending",
    "processing",
    "succeeded",
    "failed",
    "filtered",
]);
exports.WebhookEndpointObject = v4_1.z.object({
    /** Stable friendly id, e.g. `wh_...`. */
    id: v4_1.z.string(),
    /** The declared webhook() id this endpoint routes to. */
    webhook: v4_1.z.string(),
    /** Provider tag, e.g. "stripe" | "github" | "standard". */
    source: v4_1.z.string(),
    status: exports.WebhookEndpointApiStatus,
    /** Who supplies the secret/key; drives paste-vs-generate in the dashboard. */
    secretProvisioning: webhookConfig_js_1.WebhookSecretProvisioning,
    /** Whether a signing secret/public key has been set. The value is never returned. */
    secretSet: v4_1.z.boolean(),
    /** Tenant scope (P2 dynamic endpoints); null for the declared default endpoint. */
    tenantId: v4_1.z.string().nullable(),
    externalRef: v4_1.z.string().nullable(),
    /** The hosted ingress URL to point the provider at. */
    url: v4_1.z.string(),
    createdAt: v4_1.z.coerce.date(),
    updatedAt: v4_1.z.coerce.date(),
});
exports.ListWebhookEndpointsResponse = v4_1.z.object({
    data: v4_1.z.array(exports.WebhookEndpointObject),
});
exports.WebhookDeliveryListItem = v4_1.z.object({
    /** Stable friendly id, e.g. `whd_...`. */
    id: v4_1.z.string(),
    /** The webhook() id this delivery was routed to, if resolvable. */
    webhook: v4_1.z.string().nullable(),
    status: exports.WebhookDeliveryApiStatus,
    /** Provider delivery id (Stripe event id, GitHub X-GitHub-Delivery, …). */
    externalDeliveryId: v4_1.z.string(),
    /** The triggered run's friendly id, if any. */
    runId: v4_1.z.string().nullable(),
    createdAt: v4_1.z.coerce.date(),
    processedAt: v4_1.z.coerce.date().nullable(),
});
exports.ListWebhookDeliveriesResponse = v4_1.z.object({
    data: v4_1.z.array(exports.WebhookDeliveryListItem),
    pagination: v4_1.z.object({
        next: v4_1.z.string().optional(),
        previous: v4_1.z.string().optional(),
    }),
});
exports.WebhookDeliveryObject = exports.WebhookDeliveryListItem.extend({
    idempotencyKey: v4_1.z.string(),
    /** The size-capped, verified event body. */
    event: v4_1.z.unknown().nullable(),
    /** The inbound request headers. */
    headers: v4_1.z.record(v4_1.z.string(), v4_1.z.string()).nullable(),
    rawBodyHash: v4_1.z.string().nullable(),
    error: v4_1.z.string().nullable(),
    /** For a `filtered` delivery: why it was not routed (failing clause + actual value). */
    filterReason: v4_1.z.string().nullable(),
    updatedAt: v4_1.z.coerce.date(),
});
// ── Write actions ──
/** Rotating/setting a signing secret returns the plaintext ONCE; it is never readable again. */
exports.RotateWebhookEndpointSecretResponse = v4_1.z.object({
    id: v4_1.z.string(),
    secretSet: v4_1.z.literal(true),
    secret: v4_1.z.string(),
});
/** Replaying re-runs a delivery's task from its stored event as a new delivery. */
exports.ReplayWebhookDeliveryResponse = v4_1.z.object({
    /** The new delivery's friendly id (GET it once processed for the run). */
    deliveryId: v4_1.z.string(),
    /** The original delivery id the replay was created from. */
    replayedFrom: v4_1.z.string(),
});
//# sourceMappingURL=webhookApi.js.map