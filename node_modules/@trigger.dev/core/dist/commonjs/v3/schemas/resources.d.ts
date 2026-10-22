import { z } from "zod/v4";
export declare const AgentConfig: z.ZodObject<{
    type: z.ZodString;
}, z.core.$strip>;
export type AgentConfig = z.infer<typeof AgentConfig>;
export declare const TaskResource: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    queue: z.ZodOptional<z.ZodObject<{
        concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        factor: z.ZodOptional<z.ZodNumber>;
        minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
        randomize: z.ZodOptional<z.ZodBoolean>;
        outOfMemory: z.ZodOptional<z.ZodObject<{
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    machine: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>>;
        memory: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>>;
        preset: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
    }, z.core.$strip>>;
    triggerSource: z.ZodOptional<z.ZodString>;
    agentConfig: z.ZodOptional<z.ZodObject<{
        type: z.ZodString;
    }, z.core.$strip>>;
    schedule: z.ZodOptional<z.ZodObject<{
        cron: z.ZodString;
        timezone: z.ZodString;
        environments: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            DEVELOPMENT: "DEVELOPMENT";
            PREVIEW: "PREVIEW";
            PRODUCTION: "PRODUCTION";
            STAGING: "STAGING";
        }>>>;
        window: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    payloadSchema: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type TaskResource = z.infer<typeof TaskResource>;
export declare const BackgroundWorkerSourceFileMetadata: z.ZodObject<{
    filePath: z.ZodString;
    contents: z.ZodString;
    contentHash: z.ZodString;
    taskIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type BackgroundWorkerSourceFileMetadata = z.infer<typeof BackgroundWorkerSourceFileMetadata>;
export declare const PromptResource: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    variableSchema: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type PromptResource = z.infer<typeof PromptResource>;
export declare const WebhookResource: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    exportName: z.ZodOptional<z.ZodString>;
    source: z.ZodString;
    verifierArtifact: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"config">;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"preset">;
        preset: z.ZodString;
        config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            scheme: z.ZodLiteral<"hmac">;
            algorithm: z.ZodEnum<{
                sha1: "sha1";
                sha256: "sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            secret: z.ZodOptional<z.ZodObject<{
                encoding: z.ZodOptional<z.ZodEnum<{
                    base64: "base64";
                    utf8: "utf8";
                }>>;
                stripPrefix: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
            formPayload: z.ZodOptional<z.ZodObject<{
                field: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"shared-secret">;
            placement: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                body: "body";
                header: "header";
            }>;
            fieldName: z.ZodOptional<z.ZodString>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"url-secret">;
            placement: z.ZodEnum<{
                path: "path";
                query: "query";
            }>;
            paramName: z.ZodString;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            scheme: z.ZodLiteral<"asymmetric">;
            algorithm: z.ZodEnum<{
                "ecdsa-p256": "ecdsa-p256";
                ed25519: "ed25519";
                "rsa-sha256": "rsa-sha256";
            }>;
            encoding: z.ZodEnum<{
                base64: "base64";
                hex: "hex";
            }>;
            signatureHeader: z.ZodString;
            signature: z.ZodOptional<z.ZodObject<{
                itemSeparator: z.ZodOptional<z.ZodString>;
                fieldSeparator: z.ZodOptional<z.ZodString>;
                field: z.ZodOptional<z.ZodString>;
                trim: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            timestamp: z.ZodOptional<z.ZodObject<{
                source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>;
                unit: z.ZodOptional<z.ZodEnum<{
                    milliseconds: "milliseconds";
                    seconds: "seconds";
                }>>;
                toleranceSeconds: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                template: z.ZodString;
                vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    from: z.ZodLiteral<"header">;
                    name: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"signatureField">;
                    field: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"body">;
                    path: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"url">;
                }, z.core.$strip>, z.ZodObject<{
                    from: z.ZodLiteral<"constant">;
                    value: z.ZodString;
                }, z.core.$strip>]>>>;
            }, z.core.$strip>]>;
            publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                pem: "pem";
                "raw-base64": "raw-base64";
                "raw-hex": "raw-hex";
                "spki-der-base64": "spki-der-base64";
            }>>;
            idempotencyField: z.ZodOptional<z.ZodObject<{
                from: z.ZodEnum<{
                    body: "body";
                    header: "header";
                }>;
                name: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>]>;
        handshake: z.ZodOptional<z.ZodObject<{
            matchPath: z.ZodString;
            matchValue: z.ZodString;
            respondPath: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"bundle">;
        bundleUrl: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strip>]>;
    routingTarget: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"task">;
        taskId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"session">;
        taskIdentifier: z.ZodString;
        keyTemplate: z.ZodString;
        deliverAs: z.ZodEnum<{
            action: "action";
            message: "message";
        }>;
        actionType: z.ZodOptional<z.ZodString>;
        connectorId: z.ZodOptional<z.ZodString>;
        triggerConfigTemplate: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        startOn: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>;
    secretProvisioning: z.ZodOptional<z.ZodEnum<{
        either: "either";
        integrator: "integrator";
        provider: "provider";
    }>>;
    filter: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type WebhookResource = z.infer<typeof WebhookResource>;
export declare const BackgroundWorkerMetadata: z.ZodObject<{
    packageVersion: z.ZodString;
    contentHash: z.ZodString;
    cliPackageVersion: z.ZodOptional<z.ZodString>;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
        queue: z.ZodOptional<z.ZodObject<{
            concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        retry: z.ZodOptional<z.ZodObject<{
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            factor: z.ZodOptional<z.ZodNumber>;
            minTimeoutInMs: z.ZodOptional<z.ZodNumber>;
            maxTimeoutInMs: z.ZodOptional<z.ZodNumber>;
            randomize: z.ZodOptional<z.ZodBoolean>;
            outOfMemory: z.ZodOptional<z.ZodObject<{
                machine: z.ZodOptional<z.ZodEnum<{
                    "large-1x": "large-1x";
                    "large-2x": "large-2x";
                    "medium-1x": "medium-1x";
                    "medium-2x": "medium-2x";
                    micro: "micro";
                    "small-1x": "small-1x";
                    "small-2x": "small-2x";
                }>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        machine: z.ZodOptional<z.ZodObject<{
            cpu: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]>>;
            memory: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<0.25>, z.ZodLiteral<0.5>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>, z.ZodLiteral<8>]>>;
            preset: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
        }, z.core.$strip>>;
        triggerSource: z.ZodOptional<z.ZodString>;
        agentConfig: z.ZodOptional<z.ZodObject<{
            type: z.ZodString;
        }, z.core.$strip>>;
        schedule: z.ZodOptional<z.ZodObject<{
            cron: z.ZodString;
            timezone: z.ZodString;
            environments: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                DEVELOPMENT: "DEVELOPMENT";
                PREVIEW: "PREVIEW";
                PRODUCTION: "PRODUCTION";
                STAGING: "STAGING";
            }>>>;
            window: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        payloadSchema: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>;
    prompts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        variableSchema: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
    webhooks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
        source: z.ZodString;
        verifierArtifact: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            kind: z.ZodLiteral<"config">;
            config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                scheme: z.ZodLiteral<"hmac">;
                algorithm: z.ZodEnum<{
                    sha1: "sha1";
                    sha256: "sha256";
                }>;
                encoding: z.ZodEnum<{
                    base64: "base64";
                    hex: "hex";
                }>;
                signatureHeader: z.ZodString;
                signature: z.ZodOptional<z.ZodObject<{
                    itemSeparator: z.ZodOptional<z.ZodString>;
                    fieldSeparator: z.ZodOptional<z.ZodString>;
                    field: z.ZodOptional<z.ZodString>;
                    trim: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strip>>;
                timestamp: z.ZodOptional<z.ZodObject<{
                    source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>;
                    unit: z.ZodOptional<z.ZodEnum<{
                        milliseconds: "milliseconds";
                        seconds: "seconds";
                    }>>;
                    toleranceSeconds: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                    template: z.ZodString;
                    vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>]>;
                secret: z.ZodOptional<z.ZodObject<{
                    encoding: z.ZodOptional<z.ZodEnum<{
                        base64: "base64";
                        utf8: "utf8";
                    }>>;
                    stripPrefix: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
                formPayload: z.ZodOptional<z.ZodObject<{
                    field: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"shared-secret">;
                placement: z.ZodEnum<{
                    basic: "basic";
                    bearer: "bearer";
                    body: "body";
                    header: "header";
                }>;
                fieldName: z.ZodOptional<z.ZodString>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"url-secret">;
                placement: z.ZodEnum<{
                    path: "path";
                    query: "query";
                }>;
                paramName: z.ZodString;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"asymmetric">;
                algorithm: z.ZodEnum<{
                    "ecdsa-p256": "ecdsa-p256";
                    ed25519: "ed25519";
                    "rsa-sha256": "rsa-sha256";
                }>;
                encoding: z.ZodEnum<{
                    base64: "base64";
                    hex: "hex";
                }>;
                signatureHeader: z.ZodString;
                signature: z.ZodOptional<z.ZodObject<{
                    itemSeparator: z.ZodOptional<z.ZodString>;
                    fieldSeparator: z.ZodOptional<z.ZodString>;
                    field: z.ZodOptional<z.ZodString>;
                    trim: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strip>>;
                timestamp: z.ZodOptional<z.ZodObject<{
                    source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>;
                    unit: z.ZodOptional<z.ZodEnum<{
                        milliseconds: "milliseconds";
                        seconds: "seconds";
                    }>>;
                    toleranceSeconds: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                    template: z.ZodString;
                    vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>]>;
                publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                    pem: "pem";
                    "raw-base64": "raw-base64";
                    "raw-hex": "raw-hex";
                    "spki-der-base64": "spki-der-base64";
                }>>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>]>;
            handshake: z.ZodOptional<z.ZodObject<{
                matchPath: z.ZodString;
                matchValue: z.ZodString;
                respondPath: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"preset">;
            preset: z.ZodString;
            config: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                scheme: z.ZodLiteral<"hmac">;
                algorithm: z.ZodEnum<{
                    sha1: "sha1";
                    sha256: "sha256";
                }>;
                encoding: z.ZodEnum<{
                    base64: "base64";
                    hex: "hex";
                }>;
                signatureHeader: z.ZodString;
                signature: z.ZodOptional<z.ZodObject<{
                    itemSeparator: z.ZodOptional<z.ZodString>;
                    fieldSeparator: z.ZodOptional<z.ZodString>;
                    field: z.ZodOptional<z.ZodString>;
                    trim: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strip>>;
                timestamp: z.ZodOptional<z.ZodObject<{
                    source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>;
                    unit: z.ZodOptional<z.ZodEnum<{
                        milliseconds: "milliseconds";
                        seconds: "seconds";
                    }>>;
                    toleranceSeconds: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                    template: z.ZodString;
                    vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>]>;
                secret: z.ZodOptional<z.ZodObject<{
                    encoding: z.ZodOptional<z.ZodEnum<{
                        base64: "base64";
                        utf8: "utf8";
                    }>>;
                    stripPrefix: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
                formPayload: z.ZodOptional<z.ZodObject<{
                    field: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"shared-secret">;
                placement: z.ZodEnum<{
                    basic: "basic";
                    bearer: "bearer";
                    body: "body";
                    header: "header";
                }>;
                fieldName: z.ZodOptional<z.ZodString>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"url-secret">;
                placement: z.ZodEnum<{
                    path: "path";
                    query: "query";
                }>;
                paramName: z.ZodString;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                scheme: z.ZodLiteral<"asymmetric">;
                algorithm: z.ZodEnum<{
                    "ecdsa-p256": "ecdsa-p256";
                    ed25519: "ed25519";
                    "rsa-sha256": "rsa-sha256";
                }>;
                encoding: z.ZodEnum<{
                    base64: "base64";
                    hex: "hex";
                }>;
                signatureHeader: z.ZodString;
                signature: z.ZodOptional<z.ZodObject<{
                    itemSeparator: z.ZodOptional<z.ZodString>;
                    fieldSeparator: z.ZodOptional<z.ZodString>;
                    field: z.ZodOptional<z.ZodString>;
                    trim: z.ZodOptional<z.ZodBoolean>;
                }, z.core.$strip>>;
                timestamp: z.ZodOptional<z.ZodObject<{
                    source: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>;
                    unit: z.ZodOptional<z.ZodEnum<{
                        milliseconds: "milliseconds";
                        seconds: "seconds";
                    }>>;
                    toleranceSeconds: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                signingString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
                    template: z.ZodString;
                    vars: z.ZodOptional<z.ZodRecord<z.ZodString, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        from: z.ZodLiteral<"header">;
                        name: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"signatureField">;
                        field: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"body">;
                        path: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"url">;
                    }, z.core.$strip>, z.ZodObject<{
                        from: z.ZodLiteral<"constant">;
                        value: z.ZodString;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>]>;
                publicKeyEncoding: z.ZodOptional<z.ZodEnum<{
                    pem: "pem";
                    "raw-base64": "raw-base64";
                    "raw-hex": "raw-hex";
                    "spki-der-base64": "spki-der-base64";
                }>>;
                idempotencyField: z.ZodOptional<z.ZodObject<{
                    from: z.ZodEnum<{
                        body: "body";
                        header: "header";
                    }>;
                    name: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>]>;
            handshake: z.ZodOptional<z.ZodObject<{
                matchPath: z.ZodString;
                matchValue: z.ZodString;
                respondPath: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"bundle">;
            bundleUrl: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strip>]>;
        routingTarget: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"task">;
            taskId: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"session">;
            taskIdentifier: z.ZodString;
            keyTemplate: z.ZodString;
            deliverAs: z.ZodEnum<{
                action: "action";
                message: "message";
            }>;
            actionType: z.ZodOptional<z.ZodString>;
            connectorId: z.ZodOptional<z.ZodString>;
            triggerConfigTemplate: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            startOn: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>;
        secretProvisioning: z.ZodOptional<z.ZodEnum<{
            either: "either";
            integrator: "integrator";
            provider: "provider";
        }>>;
        filter: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
    queues: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
    sourceFiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filePath: z.ZodString;
        contents: z.ZodString;
        contentHash: z.ZodString;
        taskIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>>;
    runtime: z.ZodOptional<z.ZodString>;
    runtimeVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BackgroundWorkerMetadata = z.infer<typeof BackgroundWorkerMetadata>;
export declare const ImageDetailsMetadata: z.ZodObject<{
    contentHash: z.ZodString;
    imageTag: z.ZodString;
}, z.core.$strip>;
export type ImageDetailsMetadata = z.infer<typeof ImageDetailsMetadata>;
