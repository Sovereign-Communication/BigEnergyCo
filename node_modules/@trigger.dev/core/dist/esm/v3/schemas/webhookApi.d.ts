import { z } from "zod/v4";
export declare const WebhookEndpointApiStatus: z.ZodEnum<{
    active: "active";
    deleting: "deleting";
    inactive: "inactive";
}>;
export type WebhookEndpointApiStatus = z.infer<typeof WebhookEndpointApiStatus>;
export declare const WebhookDeliveryApiStatus: z.ZodEnum<{
    failed: "failed";
    filtered: "filtered";
    pending: "pending";
    processing: "processing";
    succeeded: "succeeded";
}>;
export type WebhookDeliveryApiStatus = z.infer<typeof WebhookDeliveryApiStatus>;
export declare const WebhookEndpointObject: z.ZodObject<{
    id: z.ZodString;
    webhook: z.ZodString;
    source: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        deleting: "deleting";
        inactive: "inactive";
    }>;
    secretProvisioning: z.ZodEnum<{
        either: "either";
        integrator: "integrator";
        provider: "provider";
    }>;
    secretSet: z.ZodBoolean;
    tenantId: z.ZodNullable<z.ZodString>;
    externalRef: z.ZodNullable<z.ZodString>;
    url: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type WebhookEndpointObject = z.infer<typeof WebhookEndpointObject>;
export declare const ListWebhookEndpointsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        webhook: z.ZodString;
        source: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            deleting: "deleting";
            inactive: "inactive";
        }>;
        secretProvisioning: z.ZodEnum<{
            either: "either";
            integrator: "integrator";
            provider: "provider";
        }>;
        secretSet: z.ZodBoolean;
        tenantId: z.ZodNullable<z.ZodString>;
        externalRef: z.ZodNullable<z.ZodString>;
        url: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ListWebhookEndpointsResponse = z.infer<typeof ListWebhookEndpointsResponse>;
export declare const WebhookDeliveryListItem: z.ZodObject<{
    id: z.ZodString;
    webhook: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        failed: "failed";
        filtered: "filtered";
        pending: "pending";
        processing: "processing";
        succeeded: "succeeded";
    }>;
    externalDeliveryId: z.ZodString;
    runId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
    processedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export type WebhookDeliveryListItem = z.infer<typeof WebhookDeliveryListItem>;
export declare const ListWebhookDeliveriesResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        webhook: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            failed: "failed";
            filtered: "filtered";
            pending: "pending";
            processing: "processing";
            succeeded: "succeeded";
        }>;
        externalDeliveryId: z.ZodString;
        runId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodCoercedDate<unknown>;
        processedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        next: z.ZodOptional<z.ZodString>;
        previous: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListWebhookDeliveriesResponse = z.infer<typeof ListWebhookDeliveriesResponse>;
export declare const WebhookDeliveryObject: z.ZodObject<{
    id: z.ZodString;
    webhook: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        failed: "failed";
        filtered: "filtered";
        pending: "pending";
        processing: "processing";
        succeeded: "succeeded";
    }>;
    externalDeliveryId: z.ZodString;
    runId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
    processedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodString;
    event: z.ZodNullable<z.ZodUnknown>;
    headers: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
    rawBodyHash: z.ZodNullable<z.ZodString>;
    error: z.ZodNullable<z.ZodString>;
    filterReason: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type WebhookDeliveryObject = z.infer<typeof WebhookDeliveryObject>;
/** Rotating/setting a signing secret returns the plaintext ONCE; it is never readable again. */
export declare const RotateWebhookEndpointSecretResponse: z.ZodObject<{
    id: z.ZodString;
    secretSet: z.ZodLiteral<true>;
    secret: z.ZodString;
}, z.core.$strip>;
export type RotateWebhookEndpointSecretResponse = z.infer<typeof RotateWebhookEndpointSecretResponse>;
/** Replaying re-runs a delivery's task from its stored event as a new delivery. */
export declare const ReplayWebhookDeliveryResponse: z.ZodObject<{
    deliveryId: z.ZodString;
    replayedFrom: z.ZodString;
}, z.core.$strip>;
export type ReplayWebhookDeliveryResponse = z.infer<typeof ReplayWebhookDeliveryResponse>;
