import { z } from "zod/v4";
import type { ZodIssueLike } from "../types/schemas.js";
export declare const ServerBackgroundWorker: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    contentHash: z.ZodString;
    engine: z.ZodOptional<z.ZodEnum<{
        V1: "V1";
        V2: "V2";
    }>>;
}, z.core.$strip>;
export type ServerBackgroundWorker = z.infer<typeof ServerBackgroundWorker>;
export declare const UncaughtExceptionMessage: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<"v1">>;
    error: z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    origin: z.ZodEnum<{
        uncaughtException: "uncaughtException";
        unhandledRejection: "unhandledRejection";
    }>;
}, z.core.$strip>;
export declare const TaskMetadataFailedToParseData: z.ZodObject<{
    version: z.ZodDefault<z.ZodLiteral<"v1">>;
    tasks: z.ZodUnknown;
    zodIssues: z.ZodCustom<readonly ZodIssueLike[], readonly ZodIssueLike[]>;
}, z.core.$strip>;
export declare const indexerToWorkerMessages: {
    INDEX_COMPLETE: z.ZodObject<{
        version: z.ZodDefault<z.ZodLiteral<"v1">>;
        manifest: z.ZodObject<{
            configPath: z.ZodString;
            tasks: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
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
                filePath: z.ZodString;
                exportName: z.ZodOptional<z.ZodString>;
                entryPoint: z.ZodString;
            }, z.core.$strip>>;
            prompts: z.ZodOptional<z.ZodArray<z.ZodObject<{
                filePath: z.ZodString;
                exportName: z.ZodOptional<z.ZodString>;
                entryPoint: z.ZodString;
                id: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                content: z.ZodOptional<z.ZodString>;
                model: z.ZodOptional<z.ZodString>;
                config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                variableSchema: z.ZodOptional<z.ZodUnknown>;
            }, z.core.$strip>>>;
            skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
                filePath: z.ZodString;
                exportName: z.ZodOptional<z.ZodString>;
                entryPoint: z.ZodString;
                id: z.ZodString;
                sourcePath: z.ZodString;
            }, z.core.$strip>>>;
            webhooks: z.ZodOptional<z.ZodArray<z.ZodObject<{
                filePath: z.ZodString;
                exportName: z.ZodOptional<z.ZodString>;
                entryPoint: z.ZodString;
                id: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
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
            unclaimedSessionWebhooks: z.ZodOptional<z.ZodArray<z.ZodString>>;
            queues: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                concurrencyLimit: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>>;
            workerEntryPoint: z.ZodString;
            controllerEntryPoint: z.ZodOptional<z.ZodString>;
            loaderEntryPoint: z.ZodOptional<z.ZodString>;
            initEntryPoint: z.ZodOptional<z.ZodString>;
            runtime: z.ZodEnum<{
                bun: "bun";
                node: "node";
                "node-22": "node-22";
                "node-24": "node-24";
                "node-26": "node-26";
            }>;
            runtimeVersion: z.ZodOptional<z.ZodString>;
            customConditions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            timings: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            processKeepAlive: z.ZodOptional<z.ZodObject<{
                enabled: z.ZodBoolean;
                maxExecutionsPerProcess: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            otelImportHook: z.ZodOptional<z.ZodObject<{
                include: z.ZodOptional<z.ZodArray<z.ZodString>>;
                exclude: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        importErrors: z.ZodArray<z.ZodObject<{
            message: z.ZodString;
            file: z.ZodString;
            stack: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    TASKS_FAILED_TO_PARSE: z.ZodObject<{
        version: z.ZodDefault<z.ZodLiteral<"v1">>;
        tasks: z.ZodUnknown;
        zodIssues: z.ZodCustom<readonly ZodIssueLike[], readonly ZodIssueLike[]>;
    }, z.core.$strip>;
    TASKS_FAILED_TO_INDEX: z.ZodObject<{
        version: z.ZodDefault<z.ZodLiteral<"v1">>;
        collisions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            filePaths: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    UNCAUGHT_EXCEPTION: z.ZodObject<{
        version: z.ZodDefault<z.ZodLiteral<"v1">>;
        error: z.ZodObject<{
            name: z.ZodString;
            message: z.ZodString;
            stack: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        origin: z.ZodEnum<{
            uncaughtException: "uncaughtException";
            unhandledRejection: "unhandledRejection";
        }>;
    }, z.core.$strip>;
};
export declare const ExecutorToWorkerMessageCatalog: {
    TASK_RUN_COMPLETED: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            execution: z.ZodObject<{
                task: z.ZodObject<{
                    id: z.ZodString;
                    filePath: z.ZodString;
                }, z.core.$loose>;
                queue: z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                environment: z.ZodObject<{
                    id: z.ZodString;
                    slug: z.ZodString;
                    type: z.ZodEnum<{
                        DEVELOPMENT: "DEVELOPMENT";
                        PREVIEW: "PREVIEW";
                        PRODUCTION: "PRODUCTION";
                        STAGING: "STAGING";
                    }>;
                    branchName: z.ZodOptional<z.ZodString>;
                    git: z.ZodOptional<z.ZodObject<{
                        provider: z.ZodOptional<z.ZodString>;
                        source: z.ZodOptional<z.ZodEnum<{
                            github_actions: "github_actions";
                            local: "local";
                            trigger_github_app: "trigger_github_app";
                        }>>;
                        ghUsername: z.ZodOptional<z.ZodString>;
                        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                        commitAuthorName: z.ZodOptional<z.ZodString>;
                        commitMessage: z.ZodOptional<z.ZodString>;
                        commitRef: z.ZodOptional<z.ZodString>;
                        commitSha: z.ZodOptional<z.ZodString>;
                        dirty: z.ZodOptional<z.ZodBoolean>;
                        remoteUrl: z.ZodOptional<z.ZodString>;
                        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                        pullRequestTitle: z.ZodOptional<z.ZodString>;
                        pullRequestState: z.ZodOptional<z.ZodEnum<{
                            closed: "closed";
                            merged: "merged";
                            open: "open";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
                organization: z.ZodObject<{
                    id: z.ZodString;
                    slug: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                project: z.ZodObject<{
                    id: z.ZodString;
                    ref: z.ZodString;
                    slug: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                machine: z.ZodObject<{
                    name: z.ZodEnum<{
                        "large-1x": "large-1x";
                        "large-2x": "large-2x";
                        "medium-1x": "medium-1x";
                        "medium-2x": "medium-2x";
                        micro: "micro";
                        "small-1x": "small-1x";
                        "small-2x": "small-2x";
                    }>;
                    cpu: z.ZodNumber;
                    memory: z.ZodNumber;
                    centsPerMs: z.ZodNumber;
                }, z.core.$strip>;
                batch: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                }, z.core.$strip>>;
                deployment: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    shortCode: z.ZodString;
                    version: z.ZodString;
                    runtime: z.ZodString;
                    runtimeVersion: z.ZodString;
                    git: z.ZodOptional<z.ZodObject<{
                        provider: z.ZodOptional<z.ZodString>;
                        source: z.ZodOptional<z.ZodEnum<{
                            github_actions: "github_actions";
                            local: "local";
                            trigger_github_app: "trigger_github_app";
                        }>>;
                        ghUsername: z.ZodOptional<z.ZodString>;
                        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                        commitAuthorName: z.ZodOptional<z.ZodString>;
                        commitMessage: z.ZodOptional<z.ZodString>;
                        commitRef: z.ZodOptional<z.ZodString>;
                        commitSha: z.ZodOptional<z.ZodString>;
                        dirty: z.ZodOptional<z.ZodBoolean>;
                        remoteUrl: z.ZodOptional<z.ZodString>;
                        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                        pullRequestTitle: z.ZodOptional<z.ZodString>;
                        pullRequestState: z.ZodOptional<z.ZodEnum<{
                            closed: "closed";
                            merged: "merged";
                            open: "open";
                        }>>;
                    }, z.core.$strip>>;
                    externalId: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attempt: z.ZodObject<{
                    number: z.ZodNumber;
                    startedAt: z.ZodCoercedDate<unknown>;
                }, z.core.$loose>;
                run: z.ZodIntersection<z.ZodObject<{
                    id: z.ZodString;
                    payload: z.ZodString;
                    payloadType: z.ZodString;
                    tags: z.ZodArray<z.ZodString>;
                    isTest: z.ZodDefault<z.ZodBoolean>;
                    isReplay: z.ZodDefault<z.ZodBoolean>;
                    createdAt: z.ZodCoercedDate<unknown>;
                    startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
                    idempotencyKey: z.ZodOptional<z.ZodString>;
                    idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
                        attempt: "attempt";
                        global: "global";
                        run: "run";
                    }>>;
                    maxAttempts: z.ZodOptional<z.ZodNumber>;
                    version: z.ZodOptional<z.ZodString>;
                    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>>>;
                    maxDuration: z.ZodOptional<z.ZodNumber>;
                    priority: z.ZodOptional<z.ZodNumber>;
                    baseCostInCents: z.ZodOptional<z.ZodNumber>;
                    parentTaskRunId: z.ZodOptional<z.ZodString>;
                    rootTaskRunId: z.ZodOptional<z.ZodString>;
                    durationMs: z.ZodOptional<z.ZodNumber>;
                    costInCents: z.ZodOptional<z.ZodNumber>;
                    region: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                    realtimeStreamsVersion: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            result: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                ok: z.ZodLiteral<true>;
                id: z.ZodString;
                output: z.ZodOptional<z.ZodString>;
                outputType: z.ZodString;
                usage: z.ZodOptional<z.ZodObject<{
                    durationMs: z.ZodNumber;
                }, z.core.$strip>>;
                taskIdentifier: z.ZodOptional<z.ZodString>;
                metadata: z.ZodOptional<z.ZodObject<{
                    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>>>;
                    operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                    parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                    rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>>;
                flushedMetadata: z.ZodOptional<z.ZodObject<{
                    data: z.ZodOptional<z.ZodString>;
                    dataType: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                ok: z.ZodLiteral<false>;
                id: z.ZodString;
                error: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                    type: z.ZodLiteral<"BUILT_IN_ERROR">;
                    name: z.ZodString;
                    message: z.ZodString;
                    stackTrace: z.ZodString;
                    causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        name: z.ZodOptional<z.ZodString>;
                        message: z.ZodString;
                        stackTrace: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>>;
                }, z.core.$strip>, z.ZodObject<{
                    type: z.ZodLiteral<"CUSTOM_ERROR">;
                    raw: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    type: z.ZodLiteral<"STRING_ERROR">;
                    raw: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    type: z.ZodLiteral<"INTERNAL_ERROR">;
                    code: z.ZodEnum<{
                        BATCH_ITEM_COULD_NOT_TRIGGER: "BATCH_ITEM_COULD_NOT_TRIGGER";
                        CONFIGURED_INCORRECTLY: "CONFIGURED_INCORRECTLY";
                        COULD_NOT_FIND_EXECUTOR: "COULD_NOT_FIND_EXECUTOR";
                        COULD_NOT_FIND_TASK: "COULD_NOT_FIND_TASK";
                        COULD_NOT_IMPORT_TASK: "COULD_NOT_IMPORT_TASK";
                        DISK_SPACE_EXCEEDED: "DISK_SPACE_EXCEEDED";
                        GRACEFUL_EXIT_TIMEOUT: "GRACEFUL_EXIT_TIMEOUT";
                        HANDLE_ERROR_ERROR: "HANDLE_ERROR_ERROR";
                        MAX_DURATION_EXCEEDED: "MAX_DURATION_EXCEEDED";
                        OUTDATED_SDK_VERSION: "OUTDATED_SDK_VERSION";
                        PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
                        POD_EVICTED: "POD_EVICTED";
                        POD_UNKNOWN_ERROR: "POD_UNKNOWN_ERROR";
                        RECURSIVE_WAIT_DEADLOCK: "RECURSIVE_WAIT_DEADLOCK";
                        TASK_ALREADY_RUNNING: "TASK_ALREADY_RUNNING";
                        TASK_DEQUEUED_INVALID_STATE: "TASK_DEQUEUED_INVALID_STATE";
                        TASK_DEQUEUED_QUEUE_NOT_FOUND: "TASK_DEQUEUED_QUEUE_NOT_FOUND";
                        TASK_DID_CONCURRENT_WAIT: "TASK_DID_CONCURRENT_WAIT";
                        TASK_EXECUTION_ABORTED: "TASK_EXECUTION_ABORTED";
                        TASK_EXECUTION_FAILED: "TASK_EXECUTION_FAILED";
                        TASK_HAS_N0_EXECUTION_SNAPSHOT: "TASK_HAS_N0_EXECUTION_SNAPSHOT";
                        TASK_INPUT_ERROR: "TASK_INPUT_ERROR";
                        TASK_MIDDLEWARE_ERROR: "TASK_MIDDLEWARE_ERROR";
                        TASK_OUTPUT_ERROR: "TASK_OUTPUT_ERROR";
                        TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE: "TASK_PROCESS_EXITED_WITH_NON_ZERO_CODE";
                        TASK_PROCESS_MAYBE_OOM_KILLED: "TASK_PROCESS_MAYBE_OOM_KILLED";
                        TASK_PROCESS_OOM_KILLED: "TASK_PROCESS_OOM_KILLED";
                        TASK_PROCESS_SIGKILL_TIMEOUT: "TASK_PROCESS_SIGKILL_TIMEOUT";
                        TASK_PROCESS_SIGSEGV: "TASK_PROCESS_SIGSEGV";
                        TASK_PROCESS_SIGTERM: "TASK_PROCESS_SIGTERM";
                        TASK_RUN_CANCELLED: "TASK_RUN_CANCELLED";
                        TASK_RUN_CRASHED: "TASK_RUN_CRASHED";
                        TASK_RUN_DEQUEUED_MAX_RETRIES: "TASK_RUN_DEQUEUED_MAX_RETRIES";
                        TASK_RUN_HEARTBEAT_TIMEOUT: "TASK_RUN_HEARTBEAT_TIMEOUT";
                        TASK_RUN_STALLED_EXECUTING: "TASK_RUN_STALLED_EXECUTING";
                        TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS: "TASK_RUN_STALLED_EXECUTING_WITH_WAITPOINTS";
                        TASK_RUN_UNCAUGHT_EXCEPTION: "TASK_RUN_UNCAUGHT_EXCEPTION";
                        UNSPECIFIED_ERROR: "UNSPECIFIED_ERROR";
                    }>;
                    message: z.ZodOptional<z.ZodString>;
                    stackTrace: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>]>;
                retry: z.ZodOptional<z.ZodObject<{
                    timestamp: z.ZodNumber;
                    delay: z.ZodNumber;
                    error: z.ZodOptional<z.ZodUnknown>;
                }, z.core.$strip>>;
                skippedRetrying: z.ZodOptional<z.ZodBoolean>;
                usage: z.ZodOptional<z.ZodObject<{
                    durationMs: z.ZodNumber;
                }, z.core.$strip>>;
                taskIdentifier: z.ZodOptional<z.ZodString>;
                metadata: z.ZodOptional<z.ZodObject<{
                    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>>>;
                    operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                    parentOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                    rootOperations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
                        type: z.ZodLiteral<"update">;
                        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"set">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"delete">;
                        key: z.ZodString;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"append">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"remove">;
                        key: z.ZodString;
                        value: z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>;
                    }, z.core.$strip>, z.ZodObject<{
                        type: z.ZodLiteral<"increment">;
                        key: z.ZodString;
                        value: z.ZodNumber;
                    }, z.core.$strip>]>>>;
                }, z.core.$strip>>;
                flushedMetadata: z.ZodOptional<z.ZodObject<{
                    data: z.ZodOptional<z.ZodString>;
                    dataType: z.ZodString;
                }, z.core.$strip>>;
            }, z.core.$strip>]>;
        }, z.core.$strip>;
    };
    TASK_HEARTBEAT: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            id: z.ZodString;
        }, z.core.$strip>;
    };
    UNCAUGHT_EXCEPTION: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            error: z.ZodObject<{
                name: z.ZodString;
                message: z.ZodString;
                stack: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
            origin: z.ZodEnum<{
                uncaughtException: "uncaughtException";
                unhandledRejection: "unhandledRejection";
            }>;
        }, z.core.$strip>;
    };
    SEND_DEBUG_LOG: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            message: z.ZodString;
            properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>;
    };
    SET_SUSPENDABLE: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            suspendable: z.ZodBoolean;
        }, z.core.$strip>;
    };
    MAX_DURATION_EXCEEDED: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            maxDurationInSeconds: z.ZodNumber;
            elapsedTimeInSeconds: z.ZodNumber;
        }, z.core.$strip>;
    };
};
export declare const WorkerToExecutorMessageCatalog: {
    EXECUTE_TASK_RUN: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            execution: z.ZodObject<{
                task: z.ZodObject<{
                    id: z.ZodString;
                    filePath: z.ZodString;
                }, z.core.$loose>;
                queue: z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                environment: z.ZodObject<{
                    id: z.ZodString;
                    slug: z.ZodString;
                    type: z.ZodEnum<{
                        DEVELOPMENT: "DEVELOPMENT";
                        PREVIEW: "PREVIEW";
                        PRODUCTION: "PRODUCTION";
                        STAGING: "STAGING";
                    }>;
                    branchName: z.ZodOptional<z.ZodString>;
                    git: z.ZodOptional<z.ZodObject<{
                        provider: z.ZodOptional<z.ZodString>;
                        source: z.ZodOptional<z.ZodEnum<{
                            github_actions: "github_actions";
                            local: "local";
                            trigger_github_app: "trigger_github_app";
                        }>>;
                        ghUsername: z.ZodOptional<z.ZodString>;
                        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                        commitAuthorName: z.ZodOptional<z.ZodString>;
                        commitMessage: z.ZodOptional<z.ZodString>;
                        commitRef: z.ZodOptional<z.ZodString>;
                        commitSha: z.ZodOptional<z.ZodString>;
                        dirty: z.ZodOptional<z.ZodBoolean>;
                        remoteUrl: z.ZodOptional<z.ZodString>;
                        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                        pullRequestTitle: z.ZodOptional<z.ZodString>;
                        pullRequestState: z.ZodOptional<z.ZodEnum<{
                            closed: "closed";
                            merged: "merged";
                            open: "open";
                        }>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
                organization: z.ZodObject<{
                    id: z.ZodString;
                    slug: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                project: z.ZodObject<{
                    id: z.ZodString;
                    ref: z.ZodString;
                    slug: z.ZodString;
                    name: z.ZodString;
                }, z.core.$strip>;
                machine: z.ZodObject<{
                    name: z.ZodEnum<{
                        "large-1x": "large-1x";
                        "large-2x": "large-2x";
                        "medium-1x": "medium-1x";
                        "medium-2x": "medium-2x";
                        micro: "micro";
                        "small-1x": "small-1x";
                        "small-2x": "small-2x";
                    }>;
                    cpu: z.ZodNumber;
                    memory: z.ZodNumber;
                    centsPerMs: z.ZodNumber;
                }, z.core.$strip>;
                batch: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                }, z.core.$strip>>;
                deployment: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    shortCode: z.ZodString;
                    version: z.ZodString;
                    runtime: z.ZodString;
                    runtimeVersion: z.ZodString;
                    git: z.ZodOptional<z.ZodObject<{
                        provider: z.ZodOptional<z.ZodString>;
                        source: z.ZodOptional<z.ZodEnum<{
                            github_actions: "github_actions";
                            local: "local";
                            trigger_github_app: "trigger_github_app";
                        }>>;
                        ghUsername: z.ZodOptional<z.ZodString>;
                        ghUserAvatarUrl: z.ZodOptional<z.ZodString>;
                        commitAuthorName: z.ZodOptional<z.ZodString>;
                        commitMessage: z.ZodOptional<z.ZodString>;
                        commitRef: z.ZodOptional<z.ZodString>;
                        commitSha: z.ZodOptional<z.ZodString>;
                        dirty: z.ZodOptional<z.ZodBoolean>;
                        remoteUrl: z.ZodOptional<z.ZodString>;
                        pullRequestNumber: z.ZodOptional<z.ZodNumber>;
                        pullRequestTitle: z.ZodOptional<z.ZodString>;
                        pullRequestState: z.ZodOptional<z.ZodEnum<{
                            closed: "closed";
                            merged: "merged";
                            open: "open";
                        }>>;
                    }, z.core.$strip>>;
                    externalId: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                attempt: z.ZodObject<{
                    number: z.ZodNumber;
                    startedAt: z.ZodCoercedDate<unknown>;
                }, z.core.$loose>;
                run: z.ZodIntersection<z.ZodObject<{
                    id: z.ZodString;
                    payload: z.ZodString;
                    payloadType: z.ZodString;
                    tags: z.ZodArray<z.ZodString>;
                    isTest: z.ZodDefault<z.ZodBoolean>;
                    isReplay: z.ZodDefault<z.ZodBoolean>;
                    createdAt: z.ZodCoercedDate<unknown>;
                    startedAt: z.ZodDefault<z.ZodCoercedDate<unknown>>;
                    idempotencyKey: z.ZodOptional<z.ZodString>;
                    idempotencyKeyScope: z.ZodOptional<z.ZodEnum<{
                        attempt: "attempt";
                        global: "global";
                        run: "run";
                    }>>;
                    maxAttempts: z.ZodOptional<z.ZodNumber>;
                    version: z.ZodOptional<z.ZodString>;
                    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../index.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../index.js").DeserializedJson, unknown>>>>;
                    maxDuration: z.ZodOptional<z.ZodNumber>;
                    priority: z.ZodOptional<z.ZodNumber>;
                    baseCostInCents: z.ZodOptional<z.ZodNumber>;
                    parentTaskRunId: z.ZodOptional<z.ZodString>;
                    rootTaskRunId: z.ZodOptional<z.ZodString>;
                    durationMs: z.ZodOptional<z.ZodNumber>;
                    costInCents: z.ZodOptional<z.ZodNumber>;
                    region: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>, z.ZodObject<{
                    traceContext: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                    realtimeStreamsVersion: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            metadata: z.ZodObject<{
                id: z.ZodString;
                version: z.ZodString;
                contentHash: z.ZodString;
                engine: z.ZodOptional<z.ZodEnum<{
                    V1: "V1";
                    V2: "V2";
                }>>;
            }, z.core.$strip>;
            metrics: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                event: z.ZodString;
                timestamp: z.ZodNumber;
                duration: z.ZodNumber;
            }, z.core.$strip>>>;
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            isWarmStart: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
    };
    FLUSH: {
        message: z.ZodObject<{
            timeoutInMs: z.ZodNumber;
            disableContext: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
        callback: z.ZodVoid;
    };
    CANCEL: {
        message: z.ZodObject<{
            timeoutInMs: z.ZodNumber;
        }, z.core.$strip>;
        callback: z.ZodVoid;
    };
    RESOLVE_WAITPOINT: {
        message: z.ZodObject<{
            version: z.ZodDefault<z.ZodLiteral<"v1">>;
            waitpoint: z.ZodObject<{
                id: z.ZodString;
                index: z.ZodOptional<z.ZodNumber>;
                friendlyId: z.ZodString;
                type: z.ZodEnum<{
                    BATCH: "BATCH";
                    DATETIME: "DATETIME";
                    MANUAL: "MANUAL";
                    RUN: "RUN";
                }>;
                completedAt: z.ZodCoercedDate<unknown>;
                idempotencyKey: z.ZodOptional<z.ZodString>;
                completedByTaskRun: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    friendlyId: z.ZodString;
                    batch: z.ZodOptional<z.ZodObject<{
                        id: z.ZodString;
                        friendlyId: z.ZodString;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                completedAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
                completedByBatch: z.ZodOptional<z.ZodObject<{
                    id: z.ZodString;
                    friendlyId: z.ZodString;
                }, z.core.$strip>>;
                output: z.ZodOptional<z.ZodString>;
                outputType: z.ZodOptional<z.ZodString>;
                outputIsError: z.ZodBoolean;
            }, z.core.$strip>;
        }, z.core.$strip>;
    };
};
