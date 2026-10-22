import { z } from "zod/v4";
export declare const RunEngineVersion: z.ZodUnion<readonly [z.ZodLiteral<"V1">, z.ZodLiteral<"V2">]>;
export declare const WhoAmIResponseSchema: z.ZodObject<{
    userId: z.ZodString;
    email: z.ZodString;
    dashboardUrl: z.ZodString;
    project: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
        orgTitle: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WhoAmIResponse = z.infer<typeof WhoAmIResponseSchema>;
export declare const GetProjectResponseBody: z.ZodObject<{
    id: z.ZodString;
    externalRef: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    defaultRegion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultRuntime: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        bun: "bun";
        node: "node";
        "node-22": "node-22";
        "node-24": "node-24";
        "node-26": "node-26";
    }>>>;
    organization: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        slug: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GetProjectResponseBody = z.infer<typeof GetProjectResponseBody>;
export declare const GetProjectsResponseBody: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    externalRef: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    defaultRegion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    defaultRuntime: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        bun: "bun";
        node: "node";
        "node-22": "node-22";
        "node-24": "node-24";
        "node-26": "node-26";
    }>>>;
    organization: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        slug: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>;
}, z.core.$strip>>;
export type GetProjectsResponseBody = z.infer<typeof GetProjectsResponseBody>;
/** The Node.js major version currently targeted by the runtime update report. */
export declare const NODE_RUNTIME_UPDATE_MAJOR = 21;
/**
 * Returns the observed Node.js major version for a deployment.
 *
 * `runtime: "node"` is an alias whose underlying Node.js version has changed over time, so the
 * recorded runtimeVersion is deliberately the source of truth here.
 */
export declare function nodeMajor(runtime: string | null | undefined, runtimeVersion: string | null | undefined): number | undefined;
export declare function needsNodeRuntimeUpdate(runtime: string | null | undefined, runtimeVersion: string | null | undefined): boolean;
export declare const GetProjectRuntimesResponseBody: z.ZodArray<z.ZodObject<{
    organization: z.ZodObject<{
        title: z.ZodString;
        slug: z.ZodString;
    }, z.core.$strip>;
    project: z.ZodObject<{
        name: z.ZodString;
        slug: z.ZodString;
        externalRef: z.ZodString;
    }, z.core.$strip>;
    environment: z.ZodObject<{
        slug: z.ZodString;
    }, z.core.$strip>;
    deployment: z.ZodNullable<z.ZodObject<{
        runtime: z.ZodNullable<z.ZodString>;
        runtimeVersion: z.ZodNullable<z.ZodString>;
        nodeMajor: z.ZodNullable<z.ZodNumber>;
        deployedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
        shortCode: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type GetProjectRuntimesResponseBody = z.infer<typeof GetProjectRuntimesResponseBody>;
export declare const GetOrgsResponseBody: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    slug: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>>;
export type GetOrgsResponseBody = z.infer<typeof GetOrgsResponseBody>;
export declare const CreateOrgRequestBody: z.ZodObject<{
    title: z.ZodString;
    companySize: z.ZodOptional<z.ZodString>;
    companyUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateOrgRequestBody = z.infer<typeof CreateOrgRequestBody>;
export declare const CreateOrgResponseBody: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    slug: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type CreateOrgResponseBody = z.infer<typeof CreateOrgResponseBody>;
export declare const CreateProjectRequestBody: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type CreateProjectRequestBody = z.infer<typeof CreateProjectRequestBody>;
export declare const GetProjectEnvResponse: z.ZodObject<{
    apiKey: z.ZodString;
    name: z.ZodString;
    apiUrl: z.ZodString;
    projectId: z.ZodString;
    defaultRuntime: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        bun: "bun";
        node: "node";
        "node-22": "node-22";
        "node-24": "node-24";
        "node-26": "node-26";
    }>>>;
}, z.core.$strip>;
export type GetProjectEnvResponse = z.infer<typeof GetProjectEnvResponse>;
export declare const ProjectEnvironment: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    type: z.ZodEnum<{
        DEVELOPMENT: "DEVELOPMENT";
        PREVIEW: "PREVIEW";
        PRODUCTION: "PRODUCTION";
        STAGING: "STAGING";
    }>;
    isBranchableEnvironment: z.ZodBoolean;
    branchName: z.ZodNullable<z.ZodString>;
    paused: z.ZodBoolean;
}, z.core.$strip>;
export type ProjectEnvironment = z.infer<typeof ProjectEnvironment>;
export declare const GetProjectEnvironmentsResponseBody: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    type: z.ZodEnum<{
        DEVELOPMENT: "DEVELOPMENT";
        PREVIEW: "PREVIEW";
        PRODUCTION: "PRODUCTION";
        STAGING: "STAGING";
    }>;
    isBranchableEnvironment: z.ZodBoolean;
    branchName: z.ZodNullable<z.ZodString>;
    paused: z.ZodBoolean;
}, z.core.$strip>>;
export type GetProjectEnvironmentsResponseBody = z.infer<typeof GetProjectEnvironmentsResponseBody>;
export declare const GetWorkerTaskResponse: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    filePath: z.ZodString;
    triggerSource: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    payloadSchema: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
    queueConfig: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
}, z.core.$strip>;
export declare const GetWorkerByTagResponse: z.ZodObject<{
    worker: z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        engine: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sdkVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cliVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            slug: z.ZodString;
            filePath: z.ZodString;
            triggerSource: z.ZodString;
            createdAt: z.ZodCoercedDate<unknown>;
            payloadSchema: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
            queueConfig: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    urls: z.ZodObject<{
        runs: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GetWorkerByTagResponse = z.infer<typeof GetWorkerByTagResponse>;
export declare const GetJWTRequestBody: z.ZodObject<{
    claims: z.ZodOptional<z.ZodObject<{
        scopes: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    expirationTime: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
}, z.core.$strip>;
export type GetJWTRequestBody = z.infer<typeof GetJWTRequestBody>;
export declare const GetJWTResponse: z.ZodObject<{
    token: z.ZodString;
    environmentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type GetJWTResponse = z.infer<typeof GetJWTResponse>;
export declare const CreateBackgroundWorkerRequestBody: z.ZodObject<{
    localOnly: z.ZodBoolean;
    metadata: z.ZodObject<{
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
    engine: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<"V1">, z.ZodLiteral<"V2">]>>;
    supportsLazyAttempts: z.ZodOptional<z.ZodBoolean>;
    buildPlatform: z.ZodOptional<z.ZodString>;
    targetPlatform: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateBackgroundWorkerRequestBody = z.infer<typeof CreateBackgroundWorkerRequestBody>;
export declare const BackgroundWorkerWarning: z.ZodObject<{
    code: z.ZodEnum<{
        schedule_default_window: "schedule_default_window";
        schedule_minimum_window: "schedule_minimum_window";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type BackgroundWorkerWarning = z.infer<typeof BackgroundWorkerWarning>;
export declare const CreateBackgroundWorkerResponse: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    contentHash: z.ZodString;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<{
            schedule_default_window: "schedule_default_window";
            schedule_minimum_window: "schedule_minimum_window";
        }>;
        message: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CreateBackgroundWorkerResponse = z.infer<typeof CreateBackgroundWorkerResponse>;
export declare const RunTags: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
export type RunTags = z.infer<typeof RunTags>;
/** Stores the original user-provided idempotency key and scope */
export declare const IdempotencyKeyOptionsSchema: z.ZodObject<{
    key: z.ZodString;
    scope: z.ZodEnum<{
        attempt: "attempt";
        global: "global";
        run: "run";
    }>;
}, z.core.$strip>;
export type IdempotencyKeyOptionsSchema = z.infer<typeof IdempotencyKeyOptionsSchema>;
export declare const TriggerTaskRequestBody: z.ZodObject<{
    payload: z.ZodOptional<z.ZodAny>;
    context: z.ZodOptional<z.ZodAny>;
    options: z.ZodOptional<z.ZodObject<{
        dependentAttempt: z.ZodOptional<z.ZodString>;
        parentAttempt: z.ZodOptional<z.ZodString>;
        dependentBatch: z.ZodOptional<z.ZodString>;
        parentBatch: z.ZodOptional<z.ZodString>;
        parentRunId: z.ZodOptional<z.ZodString>;
        resumeParentOnCompletion: z.ZodOptional<z.ZodBoolean>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        queue: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            concurrencyLimit: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
        idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            scope: z.ZodEnum<{
                attempt: "attempt";
                global: "global";
                run: "run";
            }>;
        }, z.core.$strip>>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodAny>;
        metadataType: z.ZodOptional<z.ZodString>;
        payloadType: z.ZodOptional<z.ZodString>;
        payloadSize: z.ZodOptional<z.ZodNumber>;
        tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        test: z.ZodOptional<z.ZodBoolean>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        priority: z.ZodOptional<z.ZodNumber>;
        bulkActionId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        debounce: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            delay: z.ZodString;
            mode: z.ZodOptional<z.ZodEnum<{
                leading: "leading";
                trailing: "trailing";
            }>>;
            maxDelay: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TriggerTaskRequestBody = z.infer<typeof TriggerTaskRequestBody>;
export declare const TriggerTaskResponse: z.ZodObject<{
    id: z.ZodString;
    isCached: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TriggerTaskResponse = z.infer<typeof TriggerTaskResponse>;
export declare const BatchTriggerTaskRequestBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        payload: z.ZodOptional<z.ZodAny>;
        context: z.ZodOptional<z.ZodAny>;
        options: z.ZodOptional<z.ZodObject<{
            dependentAttempt: z.ZodOptional<z.ZodString>;
            parentAttempt: z.ZodOptional<z.ZodString>;
            dependentBatch: z.ZodOptional<z.ZodString>;
            parentBatch: z.ZodOptional<z.ZodString>;
            parentRunId: z.ZodOptional<z.ZodString>;
            resumeParentOnCompletion: z.ZodOptional<z.ZodBoolean>;
            lockToVersion: z.ZodOptional<z.ZodString>;
            externalDeploymentId: z.ZodOptional<z.ZodString>;
            queue: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
                concurrencyLimit: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
            delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
            idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                scope: z.ZodEnum<{
                    attempt: "attempt";
                    global: "global";
                    run: "run";
                }>;
            }, z.core.$strip>>;
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            maxDuration: z.ZodOptional<z.ZodNumber>;
            metadata: z.ZodOptional<z.ZodAny>;
            metadataType: z.ZodOptional<z.ZodString>;
            payloadType: z.ZodOptional<z.ZodString>;
            payloadSize: z.ZodOptional<z.ZodNumber>;
            tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            test: z.ZodOptional<z.ZodBoolean>;
            ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
            priority: z.ZodOptional<z.ZodNumber>;
            bulkActionId: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            debounce: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                delay: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    leading: "leading";
                    trailing: "trailing";
                }>>;
                maxDelay: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    dependentAttempt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BatchTriggerTaskRequestBody = z.infer<typeof BatchTriggerTaskRequestBody>;
export declare const BatchTriggerTaskItem: z.ZodObject<{
    task: z.ZodString;
    payload: z.ZodOptional<z.ZodAny>;
    context: z.ZodOptional<z.ZodAny>;
    options: z.ZodOptional<z.ZodObject<{
        concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
        idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            scope: z.ZodEnum<{
                attempt: "attempt";
                global: "global";
                run: "run";
            }>;
        }, z.core.$strip>>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodAny>;
        metadataType: z.ZodOptional<z.ZodString>;
        parentAttempt: z.ZodOptional<z.ZodString>;
        payloadType: z.ZodOptional<z.ZodString>;
        payloadSize: z.ZodOptional<z.ZodNumber>;
        queue: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
        }, z.core.$strip>>;
        tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        test: z.ZodOptional<z.ZodBoolean>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        priority: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
        debounce: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            delay: z.ZodString;
            mode: z.ZodOptional<z.ZodEnum<{
                leading: "leading";
                trailing: "trailing";
            }>>;
            maxDelay: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BatchTriggerTaskItem = z.infer<typeof BatchTriggerTaskItem>;
export declare const BatchTriggerTaskV2RequestBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        task: z.ZodString;
        payload: z.ZodOptional<z.ZodAny>;
        context: z.ZodOptional<z.ZodAny>;
        options: z.ZodOptional<z.ZodObject<{
            concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
            delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
            idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                scope: z.ZodEnum<{
                    attempt: "attempt";
                    global: "global";
                    run: "run";
                }>;
            }, z.core.$strip>>;
            lockToVersion: z.ZodOptional<z.ZodString>;
            externalDeploymentId: z.ZodOptional<z.ZodString>;
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            maxDuration: z.ZodOptional<z.ZodNumber>;
            metadata: z.ZodOptional<z.ZodAny>;
            metadataType: z.ZodOptional<z.ZodString>;
            parentAttempt: z.ZodOptional<z.ZodString>;
            payloadType: z.ZodOptional<z.ZodString>;
            payloadSize: z.ZodOptional<z.ZodNumber>;
            queue: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
            }, z.core.$strip>>;
            tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            test: z.ZodOptional<z.ZodBoolean>;
            ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
            priority: z.ZodOptional<z.ZodNumber>;
            region: z.ZodOptional<z.ZodString>;
            debounce: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                delay: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    leading: "leading";
                    trailing: "trailing";
                }>>;
                maxDelay: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    dependentAttempt: z.ZodOptional<z.ZodString>;
    parentRunId: z.ZodOptional<z.ZodString>;
    resumeParentOnCompletion: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type BatchTriggerTaskV2RequestBody = z.infer<typeof BatchTriggerTaskV2RequestBody>;
export declare const BatchTriggerTaskV2Response: z.ZodObject<{
    id: z.ZodString;
    isCached: z.ZodBoolean;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    runs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        taskIdentifier: z.ZodString;
        isCached: z.ZodBoolean;
        idempotencyKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BatchTriggerTaskV2Response = z.infer<typeof BatchTriggerTaskV2Response>;
export declare const BatchTriggerTaskV3RequestBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        task: z.ZodString;
        payload: z.ZodOptional<z.ZodAny>;
        context: z.ZodOptional<z.ZodAny>;
        options: z.ZodOptional<z.ZodObject<{
            concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
            delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
            idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                scope: z.ZodEnum<{
                    attempt: "attempt";
                    global: "global";
                    run: "run";
                }>;
            }, z.core.$strip>>;
            lockToVersion: z.ZodOptional<z.ZodString>;
            externalDeploymentId: z.ZodOptional<z.ZodString>;
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            maxDuration: z.ZodOptional<z.ZodNumber>;
            metadata: z.ZodOptional<z.ZodAny>;
            metadataType: z.ZodOptional<z.ZodString>;
            parentAttempt: z.ZodOptional<z.ZodString>;
            payloadType: z.ZodOptional<z.ZodString>;
            payloadSize: z.ZodOptional<z.ZodNumber>;
            queue: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
            }, z.core.$strip>>;
            tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
            test: z.ZodOptional<z.ZodBoolean>;
            ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
            priority: z.ZodOptional<z.ZodNumber>;
            region: z.ZodOptional<z.ZodString>;
            debounce: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                delay: z.ZodString;
                mode: z.ZodOptional<z.ZodEnum<{
                    leading: "leading";
                    trailing: "trailing";
                }>>;
                maxDelay: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    parentRunId: z.ZodOptional<z.ZodString>;
    resumeParentOnCompletion: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type BatchTriggerTaskV3RequestBody = z.infer<typeof BatchTriggerTaskV3RequestBody>;
export declare const BatchTriggerTaskV3Response: z.ZodObject<{
    id: z.ZodString;
    runCount: z.ZodNumber;
}, z.core.$strip>;
export type BatchTriggerTaskV3Response = z.infer<typeof BatchTriggerTaskV3Response>;
/**
 * Phase 1: Create batch request body
 * Creates the batch record and optionally blocks parent run for batchTriggerAndWait
 */
export declare const CreateBatchRequestBody: z.ZodObject<{
    runCount: z.ZodNumber;
    taskIdentifiers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    parentRunId: z.ZodOptional<z.ZodString>;
    resumeParentOnCompletion: z.ZodOptional<z.ZodBoolean>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
        key: z.ZodString;
        scope: z.ZodEnum<{
            attempt: "attempt";
            global: "global";
            run: "run";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreateBatchRequestBody = z.infer<typeof CreateBatchRequestBody>;
/**
 * Phase 1: Create batch response
 */
export declare const CreateBatchResponse: z.ZodObject<{
    id: z.ZodString;
    runCount: z.ZodNumber;
    isCached: z.ZodBoolean;
    idempotencyKey: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateBatchResponse = z.infer<typeof CreateBatchResponse>;
/**
 * Phase 2: Individual item in the NDJSON stream
 * Each line in the NDJSON body should match this schema.
 *
 * `options` reuses the strict shape from BatchTriggerTaskItem so that the
 * Phase-2 streaming path validates option fields identically to the V2/V3
 * batch trigger endpoints — historically this used z.record(z.string(), z.unknown()) and
 * let invalid values (e.g. numeric concurrencyKey) reach Prisma.
 */
export declare const BatchItemNDJSON: z.ZodObject<{
    index: z.ZodNumber;
    task: z.ZodString;
    payload: z.ZodOptional<z.ZodUnknown>;
    options: z.ZodOptional<z.ZodObject<{
        concurrencyKey: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>, z.ZodTransform<string, string | number>>>;
        delay: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
        idempotencyKeyOptions: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            scope: z.ZodEnum<{
                attempt: "attempt";
                global: "global";
                run: "run";
            }>;
        }, z.core.$strip>>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodAny>;
        metadataType: z.ZodOptional<z.ZodString>;
        parentAttempt: z.ZodOptional<z.ZodString>;
        payloadType: z.ZodOptional<z.ZodString>;
        payloadSize: z.ZodOptional<z.ZodNumber>;
        queue: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
        }, z.core.$strip>>;
        tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        test: z.ZodOptional<z.ZodBoolean>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        priority: z.ZodOptional<z.ZodNumber>;
        region: z.ZodOptional<z.ZodString>;
        debounce: z.ZodOptional<z.ZodObject<{
            key: z.ZodString;
            delay: z.ZodString;
            mode: z.ZodOptional<z.ZodEnum<{
                leading: "leading";
                trailing: "trailing";
            }>>;
            maxDelay: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BatchItemNDJSON = z.infer<typeof BatchItemNDJSON>;
/**
 * Phase 2: Stream items response
 * Returned after the NDJSON stream completes
 */
export declare const StreamBatchItemsResponse: z.ZodObject<{
    id: z.ZodString;
    itemsAccepted: z.ZodNumber;
    itemsDeduplicated: z.ZodNumber;
    sealed: z.ZodBoolean;
    enqueuedCount: z.ZodOptional<z.ZodNumber>;
    expectedCount: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type StreamBatchItemsResponse = z.infer<typeof StreamBatchItemsResponse>;
export declare const BatchTriggerTaskResponse: z.ZodObject<{
    batchId: z.ZodString;
    runs: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type BatchTriggerTaskResponse = z.infer<typeof BatchTriggerTaskResponse>;
export declare const GetBatchResponseBody: z.ZodObject<{
    id: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        taskRunId: z.ZodString;
        status: z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            FAILED: "FAILED";
            PENDING: "PENDING";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type GetBatchResponseBody = z.infer<typeof GetBatchResponseBody>;
export declare const AddTagsRequestBody: z.ZodObject<{
    tags: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
}, z.core.$strip>;
export type AddTagsRequestBody = z.infer<typeof AddTagsRequestBody>;
export declare const RescheduleRunRequestBody: z.ZodObject<{
    delay: z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>;
}, z.core.$strip>;
export type RescheduleRunRequestBody = z.infer<typeof RescheduleRunRequestBody>;
export declare const GetEnvironmentVariablesResponseBody: z.ZodObject<{
    variables: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type GetEnvironmentVariablesResponseBody = z.infer<typeof GetEnvironmentVariablesResponseBody>;
export declare const StartDeploymentIndexingRequestBody: z.ZodObject<{
    imageReference: z.ZodString;
    selfHosted: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type StartDeploymentIndexingRequestBody = z.infer<typeof StartDeploymentIndexingRequestBody>;
export declare const StartDeploymentIndexingResponseBody: z.ZodObject<{
    id: z.ZodString;
    contentHash: z.ZodString;
}, z.core.$strip>;
export type StartDeploymentIndexingResponseBody = z.infer<typeof StartDeploymentIndexingResponseBody>;
export declare const FinalizeDeploymentRequestBody: z.ZodObject<{
    skipPromotion: z.ZodOptional<z.ZodBoolean>;
    imageDigest: z.ZodOptional<z.ZodString>;
    skipPushToRegistry: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type FinalizeDeploymentRequestBody = z.infer<typeof FinalizeDeploymentRequestBody>;
export declare const BuildServerMetadata: z.ZodObject<{
    buildId: z.ZodOptional<z.ZodString>;
    isNativeBuild: z.ZodOptional<z.ZodBoolean>;
    artifactKey: z.ZodOptional<z.ZodString>;
    skipPromotion: z.ZodOptional<z.ZodBoolean>;
    configFilePath: z.ZodOptional<z.ZodString>;
    skipEnqueue: z.ZodOptional<z.ZodBoolean>;
    fromBundle: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type BuildServerMetadata = z.infer<typeof BuildServerMetadata>;
export declare const GetDeploymentArtifactUrlResponseBody: z.ZodObject<{
    url: z.ZodString;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type GetDeploymentArtifactUrlResponseBody = z.infer<typeof GetDeploymentArtifactUrlResponseBody>;
export declare const ProgressDeploymentRequestBody: z.ZodObject<{
    contentHash: z.ZodOptional<z.ZodString>;
    gitMeta: z.ZodOptional<z.ZodObject<{
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
    runtime: z.ZodOptional<z.ZodString>;
    buildServerMetadata: z.ZodOptional<z.ZodObject<{
        buildId: z.ZodOptional<z.ZodString>;
        isNativeBuild: z.ZodOptional<z.ZodBoolean>;
        artifactKey: z.ZodOptional<z.ZodString>;
        skipPromotion: z.ZodOptional<z.ZodBoolean>;
        configFilePath: z.ZodOptional<z.ZodString>;
        skipEnqueue: z.ZodOptional<z.ZodBoolean>;
        fromBundle: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ProgressDeploymentRequestBody = z.infer<typeof ProgressDeploymentRequestBody>;
export declare const CancelDeploymentRequestBody: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CancelDeploymentRequestBody = z.infer<typeof CancelDeploymentRequestBody>;
export declare const ExternalBuildData: z.ZodObject<{
    buildId: z.ZodString;
    buildToken: z.ZodString;
    projectId: z.ZodString;
}, z.core.$strip>;
export type ExternalBuildData = z.infer<typeof ExternalBuildData>;
export declare const DeploymentTriggeredVia: z.ZodUnion<[z.ZodEnum<{
    "cli:azure_pipelines": "cli:azure_pipelines";
    "cli:bitbucket_pipelines": "cli:bitbucket_pipelines";
    "cli:buildkite": "cli:buildkite";
    "cli:ci_other": "cli:ci_other";
    "cli:circleci": "cli:circleci";
    "cli:github_actions": "cli:github_actions";
    "cli:gitlab_ci": "cli:gitlab_ci";
    "cli:jenkins": "cli:jenkins";
    "cli:manual": "cli:manual";
    "cli:travis_ci": "cli:travis_ci";
    dashboard: "dashboard";
    "git_integration:github": "git_integration:github";
}>, z.ZodCustom<string & {}, string & {}>]>;
export type DeploymentTriggeredVia = z.infer<typeof DeploymentTriggeredVia>;
export declare const UpsertBranchRequestBody: z.ZodObject<{
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
    env: z.ZodEnum<{
        development: "development";
        preview: "preview";
    }>;
    branch: z.ZodString;
}, z.core.$strip>;
export type UpsertBranchRequestBody = z.infer<typeof UpsertBranchRequestBody>;
export declare const UpsertBranchResponseBody: z.ZodObject<{
    id: z.ZodString;
    autoArchivedBranches: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        branchName: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type UpsertBranchResponseBody = z.infer<typeof UpsertBranchResponseBody>;
export declare const CreateArtifactRequestBody: z.ZodObject<{
    type: z.ZodDefault<z.ZodEnum<{
        deployment_bundle: "deployment_bundle";
        deployment_context: "deployment_context";
    }>>;
    contentType: z.ZodDefault<z.ZodString>;
    contentLength: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CreateArtifactRequestBody = z.infer<typeof CreateArtifactRequestBody>;
export declare const CreateArtifactResponseBody: z.ZodObject<{
    artifactKey: z.ZodString;
    uploadUrl: z.ZodString;
    uploadFields: z.ZodRecord<z.ZodString, z.ZodString>;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type CreateArtifactResponseBody = z.infer<typeof CreateArtifactResponseBody>;
export declare const InitializeDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
    contentHash: z.ZodString;
    shortCode: z.ZodString;
    version: z.ZodString;
    imageTag: z.ZodString;
    imagePlatform: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    outcome: z.ZodOptional<z.ZodEnum<{
        created: "created";
        existing: "existing";
    }>>;
    isPromoted: z.ZodOptional<z.ZodBoolean>;
    externalBuildData: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        buildId: z.ZodString;
        buildToken: z.ZodString;
        projectId: z.ZodString;
    }, z.core.$strip>>>;
    canceledDeployments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        version: z.ZodString;
        shortCode: z.ZodString;
    }, z.core.$strip>>>;
    eventStream: z.ZodOptional<z.ZodObject<{
        s2: z.ZodObject<{
            basin: z.ZodString;
            stream: z.ZodString;
            accessToken: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type InitializeDeploymentResponseBody = z.infer<typeof InitializeDeploymentResponseBody>;
declare const InitializeDeploymentRequestBodyBase: z.ZodObject<{
    contentHash: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    selfHosted: z.ZodOptional<z.ZodBoolean>;
    gitMeta: z.ZodOptional<z.ZodObject<{
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
    type: z.ZodOptional<z.ZodEnum<{
        MANAGED: "MANAGED";
        UNMANAGED: "UNMANAGED";
        V1: "V1";
    }>>;
    runtime: z.ZodOptional<z.ZodString>;
    initialStatus: z.ZodOptional<z.ZodEnum<{
        BUILDING: "BUILDING";
        PENDING: "PENDING";
    }>>;
    isLocalBuild: z.ZodOptional<z.ZodBoolean>;
    triggeredVia: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
        "cli:azure_pipelines": "cli:azure_pipelines";
        "cli:bitbucket_pipelines": "cli:bitbucket_pipelines";
        "cli:buildkite": "cli:buildkite";
        "cli:ci_other": "cli:ci_other";
        "cli:circleci": "cli:circleci";
        "cli:github_actions": "cli:github_actions";
        "cli:gitlab_ci": "cli:gitlab_ci";
        "cli:jenkins": "cli:jenkins";
        "cli:manual": "cli:manual";
        "cli:travis_ci": "cli:travis_ci";
        dashboard: "dashboard";
        "git_integration:github": "git_integration:github";
    }>, z.ZodCustom<string & {}, string & {}>]>>;
    buildId: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    force: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type BaseOutput = z.output<typeof InitializeDeploymentRequestBodyBase>;
type NativeBuildOutput = BaseOutput & {
    isNativeBuild: true;
    skipPromotion?: boolean;
    artifactKey?: string;
    configFilePath?: string;
    skipEnqueue?: boolean;
    fromBundle?: boolean;
    buildEnvVars?: Record<string, string>;
};
type NonNativeBuildOutput = BaseOutput & {
    isNativeBuild: false;
    skipPromotion?: never;
    artifactKey?: never;
    configFilePath?: never;
    skipEnqueue?: never;
    fromBundle?: never;
    buildEnvVars?: never;
};
export declare const InitializeDeploymentRequestBody: z.ZodPipe<z.ZodObject<{
    contentHash: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    selfHosted: z.ZodOptional<z.ZodBoolean>;
    gitMeta: z.ZodOptional<z.ZodObject<{
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
    type: z.ZodOptional<z.ZodEnum<{
        MANAGED: "MANAGED";
        UNMANAGED: "UNMANAGED";
        V1: "V1";
    }>>;
    runtime: z.ZodOptional<z.ZodString>;
    initialStatus: z.ZodOptional<z.ZodEnum<{
        BUILDING: "BUILDING";
        PENDING: "PENDING";
    }>>;
    isLocalBuild: z.ZodOptional<z.ZodBoolean>;
    triggeredVia: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
        "cli:azure_pipelines": "cli:azure_pipelines";
        "cli:bitbucket_pipelines": "cli:bitbucket_pipelines";
        "cli:buildkite": "cli:buildkite";
        "cli:ci_other": "cli:ci_other";
        "cli:circleci": "cli:circleci";
        "cli:github_actions": "cli:github_actions";
        "cli:gitlab_ci": "cli:gitlab_ci";
        "cli:jenkins": "cli:jenkins";
        "cli:manual": "cli:manual";
        "cli:travis_ci": "cli:travis_ci";
        dashboard: "dashboard";
        "git_integration:github": "git_integration:github";
    }>, z.ZodCustom<string & {}, string & {}>]>>;
    buildId: z.ZodOptional<z.ZodString>;
    externalId: z.ZodOptional<z.ZodString>;
    force: z.ZodOptional<z.ZodBoolean>;
    isNativeBuild: z.ZodDefault<z.ZodBoolean>;
    skipPromotion: z.ZodOptional<z.ZodBoolean>;
    artifactKey: z.ZodOptional<z.ZodString>;
    configFilePath: z.ZodOptional<z.ZodString>;
    skipEnqueue: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    fromBundle: z.ZodOptional<z.ZodBoolean>;
    buildEnvVars: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>, z.ZodTransform<NativeBuildOutput | NonNativeBuildOutput, {
    contentHash: string;
    userId?: string | undefined;
    selfHosted?: boolean | undefined;
    gitMeta?: {
        provider?: string | undefined;
        source?: "github_actions" | "local" | "trigger_github_app" | undefined;
        ghUsername?: string | undefined;
        ghUserAvatarUrl?: string | undefined;
        commitAuthorName?: string | undefined;
        commitMessage?: string | undefined;
        commitRef?: string | undefined;
        commitSha?: string | undefined;
        dirty?: boolean | undefined;
        remoteUrl?: string | undefined;
        pullRequestNumber?: number | undefined;
        pullRequestTitle?: string | undefined;
        pullRequestState?: "closed" | "merged" | "open" | undefined;
    } | undefined;
    type?: "MANAGED" | "UNMANAGED" | "V1" | undefined;
    runtime?: string | undefined;
    initialStatus?: "BUILDING" | "PENDING" | undefined;
    isLocalBuild?: boolean | undefined;
    triggeredVia?: "cli:azure_pipelines" | "cli:bitbucket_pipelines" | "cli:buildkite" | "cli:ci_other" | "cli:circleci" | "cli:github_actions" | "cli:gitlab_ci" | "cli:jenkins" | "cli:manual" | "cli:travis_ci" | "dashboard" | "git_integration:github" | (string & {}) | undefined;
    buildId?: string | undefined;
    externalId?: string | undefined;
    force?: boolean | undefined;
    isNativeBuild: boolean;
    skipPromotion?: boolean | undefined;
    artifactKey?: string | undefined;
    configFilePath?: string | undefined;
    skipEnqueue: boolean;
    fromBundle?: boolean | undefined;
    buildEnvVars?: Record<string, string> | undefined;
}>>;
export type InitializeDeploymentRequestBody = z.infer<typeof InitializeDeploymentRequestBody>;
export declare const DeployBuildPath: z.ZodEnum<{
    depot: "depot";
    native: "native";
    native_local_bundle: "native_local_bundle";
}>;
export type DeployBuildPath = z.infer<typeof DeployBuildPath>;
export declare const GetDeploySettingsResponseBody: z.ZodObject<{
    build_path: z.ZodEnum<{
        depot: "depot";
        native: "native";
        native_local_bundle: "native_local_bundle";
    }>;
}, z.core.$strip>;
export type GetDeploySettingsResponseBody = z.infer<typeof GetDeploySettingsResponseBody>;
export declare const RemoteBuildProviderStatusResponseBody: z.ZodObject<{
    status: z.ZodEnum<{
        degraded: "degraded";
        operational: "operational";
        unknown: "unknown";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type RemoteBuildProviderStatusResponseBody = z.infer<typeof RemoteBuildProviderStatusResponseBody>;
export declare const GenerateRegistryCredentialsResponseBody: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    expiresAt: z.ZodString;
    repositoryUri: z.ZodString;
}, z.core.$strip>;
export type GenerateRegistryCredentialsResponseBody = z.infer<typeof GenerateRegistryCredentialsResponseBody>;
export declare const DeploymentErrorData: z.ZodObject<{
    name: z.ZodString;
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    stderr: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DeploymentErrorData = z.infer<typeof DeploymentErrorData>;
export declare const FailDeploymentRequestBody: z.ZodObject<{
    error: z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type FailDeploymentRequestBody = z.infer<typeof FailDeploymentRequestBody>;
export declare const FailDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type FailDeploymentResponseBody = z.infer<typeof FailDeploymentResponseBody>;
export declare const PromoteDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodString;
    shortCode: z.ZodString;
}, z.core.$strip>;
export type PromoteDeploymentResponseBody = z.infer<typeof PromoteDeploymentResponseBody>;
export declare const GetDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        INSTALLING: "INSTALLING";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>;
    contentHash: z.ZodString;
    shortCode: z.ZodString;
    version: z.ZodString;
    imageReference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imagePlatform: z.ZodString;
    commitSHA: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    externalId: z.ZodOptional<z.ZodString>;
    externalBuildData: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        buildId: z.ZodString;
        buildToken: z.ZodString;
        projectId: z.ZodString;
    }, z.core.$strip>>>;
    errorData: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    canceledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    worker: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            slug: z.ZodString;
            filePath: z.ZodString;
            exportName: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    integrationDeployments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        integrationName: z.ZodString;
        integrationDeploymentId: z.ZodString;
        commitSHA: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type GetDeploymentResponseBody = z.infer<typeof GetDeploymentResponseBody>;
export declare const GetDeploymentBuildEnvVarsResponseBody: z.ZodObject<{
    variables: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
export type GetDeploymentBuildEnvVarsResponseBody = z.infer<typeof GetDeploymentBuildEnvVarsResponseBody>;
export declare const GetLatestDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        INSTALLING: "INSTALLING";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>;
    contentHash: z.ZodString;
    shortCode: z.ZodString;
    version: z.ZodString;
    imageReference: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imagePlatform: z.ZodString;
    commitSHA: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    externalId: z.ZodOptional<z.ZodString>;
    externalBuildData: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        buildId: z.ZodString;
        buildToken: z.ZodString;
        projectId: z.ZodString;
    }, z.core.$strip>>>;
    errorData: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    canceledReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    integrationDeployments: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        integrationName: z.ZodString;
        integrationDeploymentId: z.ZodString;
        commitSHA: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type GetLatestDeploymentResponseBody = z.infer<typeof GetLatestDeploymentResponseBody>;
export declare const DeploymentLogEvent: z.ZodObject<{
    type: z.ZodLiteral<"log">;
    data: z.ZodObject<{
        level: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            debug: "debug";
            error: "error";
            info: "info";
            warn: "warn";
        }>>>;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DeploymentFinalizedEvent: z.ZodObject<{
    type: z.ZodLiteral<"finalized">;
    data: z.ZodObject<{
        result: z.ZodUnion<[z.ZodEnum<{
            canceled: "canceled";
            failed: "failed";
            succeeded: "succeeded";
            timed_out: "timed_out";
        }>, z.ZodCustom<string & {}, string & {}>]>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const DeploymentEvent: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"log">;
    data: z.ZodObject<{
        level: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            debug: "debug";
            error: "error";
            info: "info";
            warn: "warn";
        }>>>;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"finalized">;
    data: z.ZodObject<{
        result: z.ZodUnion<[z.ZodEnum<{
            canceled: "canceled";
            failed: "failed";
            succeeded: "succeeded";
            timed_out: "timed_out";
        }>, z.ZodCustom<string & {}, string & {}>]>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>]>;
export type DeploymentEvent = z.infer<typeof DeploymentEvent>;
export type DeploymentLogEvent = z.infer<typeof DeploymentLogEvent>;
export type DeploymentFinalizedEvent = z.infer<typeof DeploymentFinalizedEvent>;
export declare const DeploymentEventFromString: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>, import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"log">;
    data: z.ZodObject<{
        level: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            debug: "debug";
            error: "error";
            info: "info";
            warn: "warn";
        }>>>;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"finalized">;
    data: z.ZodObject<{
        result: z.ZodUnion<[z.ZodEnum<{
            canceled: "canceled";
            failed: "failed";
            succeeded: "succeeded";
            timed_out: "timed_out";
        }>, z.ZodCustom<string & {}, string & {}>]>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>]>>;
export declare const CreateUploadPayloadUrlResponseBody: z.ZodObject<{
    presignedUrl: z.ZodString;
    storagePath: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** One page of a `chat.agent` session transcript, from `GET /api/v1/sessions/{id}/transcript`. */
export declare const SessionTranscriptResponseBody: z.ZodObject<{
    messages: z.ZodArray<z.ZodUnknown>;
    cursors: z.ZodOptional<z.ZodObject<{
        lastOutEventId: z.ZodOptional<z.ZodString>;
        lastInEventId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    nextCursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SessionTranscriptResponseBody = z.infer<typeof SessionTranscriptResponseBody>;
export declare const WorkersListResponseBody: z.ZodArray<z.ZodObject<{
    type: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    latestVersion: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lastHeartbeatAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isDefault: z.ZodBoolean;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>>;
export type WorkersListResponseBody = z.infer<typeof WorkersListResponseBody>;
export declare const WorkersCreateRequestBody: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WorkersCreateRequestBody = z.infer<typeof WorkersCreateRequestBody>;
export declare const WorkersCreateResponseBody: z.ZodObject<{
    workerGroup: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
    token: z.ZodObject<{
        plaintext: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkersCreateResponseBody = z.infer<typeof WorkersCreateResponseBody>;
export declare const DevConfigResponseBody: z.ZodObject<{
    environmentId: z.ZodString;
    dequeueIntervalWithRun: z.ZodNumber;
    dequeueIntervalWithoutRun: z.ZodNumber;
    maxConcurrentRuns: z.ZodNumber;
    engineUrl: z.ZodString;
}, z.core.$strip>;
export type DevConfigResponseBody = z.infer<typeof DevConfigResponseBody>;
export declare const DevDequeueRequestBody: z.ZodObject<{
    currentWorker: z.ZodString;
    oldWorkers: z.ZodArray<z.ZodString>;
    maxResources: z.ZodOptional<z.ZodObject<{
        cpu: z.ZodNumber;
        memory: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DevDequeueRequestBody = z.infer<typeof DevDequeueRequestBody>;
export declare const DevDequeueResponseBody: z.ZodObject<{
    dequeuedMessages: z.ZodArray<z.ZodObject<{
        version: z.ZodLiteral<"1">;
        snapshot: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            executionStatus: z.ZodEnum<{
                DELAYED: "DELAYED";
                EXECUTING: "EXECUTING";
                EXECUTING_WITH_WAITPOINTS: "EXECUTING_WITH_WAITPOINTS";
                FINISHED: "FINISHED";
                PENDING_CANCEL: "PENDING_CANCEL";
                PENDING_EXECUTING: "PENDING_EXECUTING";
                QUEUED: "QUEUED";
                QUEUED_EXECUTING: "QUEUED_EXECUTING";
                RUN_CREATED: "RUN_CREATED";
                SUSPENDED: "SUSPENDED";
            }>;
            description: z.ZodString;
            createdAt: z.ZodCoercedDate<unknown>;
        }, z.core.$strip>;
        snapshotRoute: z.ZodOptional<z.ZodObject<{
            version: z.ZodLiteral<1>;
            residency: z.ZodEnum<{
                mirrored: "mirrored";
                postgres: "postgres";
                "redis-primary": "redis-primary";
            }>;
            organizationId: z.ZodString;
        }, z.core.$strip>>;
        dequeuedAt: z.ZodCoercedDate<unknown>;
        workerQueueLength: z.ZodOptional<z.ZodNumber>;
        image: z.ZodOptional<z.ZodString>;
        checkpoint: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<{
                COMPUTE: "COMPUTE";
                DOCKER: "DOCKER";
                KUBERNETES: "KUBERNETES";
            }>;
            location: z.ZodString;
            imageRef: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
        completedWaitpoints: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strip>>;
        backgroundWorker: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            version: z.ZodString;
            runtime: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        deployment: z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            friendlyId: z.ZodOptional<z.ZodString>;
            imagePlatform: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        run: z.ZodObject<{
            id: z.ZodString;
            friendlyId: z.ZodString;
            isTest: z.ZodBoolean;
            isReplay: z.ZodDefault<z.ZodBoolean>;
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
            attemptNumber: z.ZodNumber;
            masterQueue: z.ZodString;
            traceContext: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            annotations: z.ZodOptional<z.ZodObject<{
                triggerSource: z.ZodUnion<[z.ZodEnum<{
                    api: "api";
                    cli: "cli";
                    dashboard: "dashboard";
                    mcp: "mcp";
                    schedule: "schedule";
                    sdk: "sdk";
                }>, z.ZodCustom<string & {}, string & {}>]>;
                triggerAction: z.ZodUnion<[z.ZodEnum<{
                    replay: "replay";
                    test: "test";
                    trigger: "trigger";
                }>, z.ZodCustom<string & {}, string & {}>]>;
                rootTriggerSource: z.ZodUnion<[z.ZodEnum<{
                    api: "api";
                    cli: "cli";
                    dashboard: "dashboard";
                    mcp: "mcp";
                    schedule: "schedule";
                    sdk: "sdk";
                }>, z.ZodCustom<string & {}, string & {}>]>;
                rootScheduleId: z.ZodOptional<z.ZodString>;
                taskKind: z.ZodOptional<z.ZodUnion<[z.ZodEnum<{
                    AGENT: "AGENT";
                    SCHEDULED: "SCHEDULED";
                    STANDARD: "STANDARD";
                }>, z.ZodCustom<string & {}, string & {}>]>>;
                externalDeploymentId: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        environment: z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<{
                DEVELOPMENT: "DEVELOPMENT";
                PREVIEW: "PREVIEW";
                PRODUCTION: "PRODUCTION";
                STAGING: "STAGING";
            }>;
        }, z.core.$strip>;
        organization: z.ZodObject<{
            id: z.ZodString;
            hasPrivateLink: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>;
        project: z.ZodObject<{
            id: z.ZodString;
        }, z.core.$strip>;
        placementTags: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            values: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type DevDequeueResponseBody = z.infer<typeof DevDequeueResponseBody>;
export declare const DevDisconnectRequestBody: z.ZodObject<{
    runFriendlyIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type DevDisconnectRequestBody = z.infer<typeof DevDisconnectRequestBody>;
export declare const DevDisconnectResponseBody: z.ZodObject<{
    cancelled: z.ZodNumber;
    bulkActionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DevDisconnectResponseBody = z.infer<typeof DevDisconnectResponseBody>;
export type CreateUploadPayloadUrlResponseBody = z.infer<typeof CreateUploadPayloadUrlResponseBody>;
export declare const ReplayRunResponse: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type ReplayRunResponse = z.infer<typeof ReplayRunResponse>;
export declare const CanceledRunResponse: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type CanceledRunResponse = z.infer<typeof CanceledRunResponse>;
export declare const ResetIdempotencyKeyResponse: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type ResetIdempotencyKeyResponse = z.infer<typeof ResetIdempotencyKeyResponse>;
export declare const ScheduleType: z.ZodUnion<readonly [z.ZodLiteral<"DECLARATIVE">, z.ZodLiteral<"IMPERATIVE">]>;
export declare const ScheduledTaskPayload: z.ZodObject<{
    scheduleId: z.ZodString;
    type: z.ZodUnion<readonly [z.ZodLiteral<"DECLARATIVE">, z.ZodLiteral<"IMPERATIVE">]>;
    timestamp: z.ZodDate;
    lastTimestamp: z.ZodOptional<z.ZodDate>;
    externalId: z.ZodOptional<z.ZodString>;
    timezone: z.ZodString;
    upcoming: z.ZodArray<z.ZodDate>;
}, z.core.$strip>;
export type ScheduledTaskPayload = z.infer<typeof ScheduledTaskPayload>;
export declare const CreateScheduleOptions: z.ZodObject<{
    task: z.ZodString;
    cron: z.ZodString;
    deduplicationKey: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    window: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateScheduleOptions = z.infer<typeof CreateScheduleOptions>;
export declare const UpdateScheduleOptions: z.ZodObject<{
    task: z.ZodString;
    cron: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    window: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateScheduleOptions = z.infer<typeof UpdateScheduleOptions>;
export declare const ScheduleGenerator: z.ZodObject<{
    type: z.ZodLiteral<"CRON">;
    expression: z.ZodString;
    description: z.ZodString;
}, z.core.$strip>;
export type ScheduleGenerator = z.infer<typeof ScheduleGenerator>;
export declare const ScheduleObject: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodUnion<readonly [z.ZodLiteral<"DECLARATIVE">, z.ZodLiteral<"IMPERATIVE">]>;
    task: z.ZodString;
    active: z.ZodBoolean;
    deduplicationKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    generator: z.ZodObject<{
        type: z.ZodLiteral<"CRON">;
        expression: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>;
    timezone: z.ZodString;
    window: z.ZodOptional<z.ZodString>;
    nextRun: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    nextRunEffectiveAt: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
    appliedSchedulePolicy: z.ZodOptional<z.ZodObject<{
        minimumWindowSeconds: z.ZodNumber;
        reason: z.ZodLiteral<"free_schedule">;
    }, z.core.$strip>>;
    environments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        userName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ScheduleObject = z.infer<typeof ScheduleObject>;
export declare const DeletedScheduleObject: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type DeletedScheduleObject = z.infer<typeof DeletedScheduleObject>;
export declare const ListSchedulesResult: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodUnion<readonly [z.ZodLiteral<"DECLARATIVE">, z.ZodLiteral<"IMPERATIVE">]>;
        task: z.ZodString;
        active: z.ZodBoolean;
        deduplicationKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        generator: z.ZodObject<{
            type: z.ZodLiteral<"CRON">;
            expression: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>;
        timezone: z.ZodString;
        window: z.ZodOptional<z.ZodString>;
        nextRun: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
        nextRunEffectiveAt: z.ZodOptional<z.ZodNullable<z.ZodCoercedDate<unknown>>>;
        appliedSchedulePolicy: z.ZodOptional<z.ZodObject<{
            minimumWindowSeconds: z.ZodNumber;
            reason: z.ZodLiteral<"free_schedule">;
        }, z.core.$strip>>;
        environments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            userName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        currentPage: z.ZodNumber;
        totalPages: z.ZodNumber;
        count: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListSchedulesResult = z.infer<typeof ListSchedulesResult>;
export declare const ListScheduleOptions: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    perPage: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ListScheduleOptions = z.infer<typeof ListScheduleOptions>;
export declare const TimezonesResult: z.ZodObject<{
    timezones: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type TimezonesResult = z.infer<typeof TimezonesResult>;
export declare const RunStatus: z.ZodEnum<{
    CANCELED: "CANCELED";
    COMPLETED: "COMPLETED";
    CRASHED: "CRASHED";
    DELAYED: "DELAYED";
    DEQUEUED: "DEQUEUED";
    EXECUTING: "EXECUTING";
    EXPIRED: "EXPIRED";
    FAILED: "FAILED";
    PENDING_VERSION: "PENDING_VERSION";
    QUEUED: "QUEUED";
    SYSTEM_FAILURE: "SYSTEM_FAILURE";
    TIMED_OUT: "TIMED_OUT";
    WAITING: "WAITING";
}>;
export type RunStatus = z.infer<typeof RunStatus>;
export declare const AttemptStatus: z.ZodEnum<{
    CANCELED: "CANCELED";
    COMPLETED: "COMPLETED";
    EXECUTING: "EXECUTING";
    FAILED: "FAILED";
    PAUSED: "PAUSED";
    PENDING: "PENDING";
}>;
export type AttemptStatus = z.infer<typeof AttemptStatus>;
export declare const RunEnvironmentDetails: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    user: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RunEnvironmentDetails = z.infer<typeof RunEnvironmentDetails>;
export declare const RunScheduleDetails: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    deduplicationKey: z.ZodOptional<z.ZodString>;
    generator: z.ZodObject<{
        type: z.ZodLiteral<"CRON">;
        expression: z.ZodString;
        description: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RunScheduleDetails = z.infer<typeof RunScheduleDetails>;
export declare const TriggerFunction: z.ZodEnum<{
    batchTrigger: "batchTrigger";
    batchTriggerAndWait: "batchTriggerAndWait";
    trigger: "trigger";
    triggerAndWait: "triggerAndWait";
}>;
export type TriggerFunction = z.infer<typeof TriggerFunction>;
export declare const RelatedRunDetails: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        CANCELED: "CANCELED";
        COMPLETED: "COMPLETED";
        CRASHED: "CRASHED";
        DELAYED: "DELAYED";
        DEQUEUED: "DEQUEUED";
        EXECUTING: "EXECUTING";
        EXPIRED: "EXPIRED";
        FAILED: "FAILED";
        PENDING_VERSION: "PENDING_VERSION";
        QUEUED: "QUEUED";
        SYSTEM_FAILURE: "SYSTEM_FAILURE";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    taskIdentifier: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    isQueued: z.ZodBoolean;
    isExecuting: z.ZodBoolean;
    isWaiting: z.ZodBoolean;
    isCompleted: z.ZodBoolean;
    isSuccess: z.ZodBoolean;
    isFailed: z.ZodBoolean;
    isCancelled: z.ZodBoolean;
    isTest: z.ZodBoolean;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    ttl: z.ZodOptional<z.ZodString>;
    expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    costInCents: z.ZodNumber;
    baseCostInCents: z.ZodNumber;
    durationMs: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    taskKind: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    depth: z.ZodNumber;
    triggerFunction: z.ZodEnum<{
        batchTrigger: "batchTrigger";
        batchTriggerAndWait: "batchTriggerAndWait";
        trigger: "trigger";
        triggerAndWait: "triggerAndWait";
    }>;
    batchId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RetrieveRunResponse: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        CANCELED: "CANCELED";
        COMPLETED: "COMPLETED";
        CRASHED: "CRASHED";
        DELAYED: "DELAYED";
        DEQUEUED: "DEQUEUED";
        EXECUTING: "EXECUTING";
        EXPIRED: "EXPIRED";
        FAILED: "FAILED";
        PENDING_VERSION: "PENDING_VERSION";
        QUEUED: "QUEUED";
        SYSTEM_FAILURE: "SYSTEM_FAILURE";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    taskIdentifier: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    isQueued: z.ZodBoolean;
    isExecuting: z.ZodBoolean;
    isWaiting: z.ZodBoolean;
    isCompleted: z.ZodBoolean;
    isSuccess: z.ZodBoolean;
    isFailed: z.ZodBoolean;
    isCancelled: z.ZodBoolean;
    isTest: z.ZodBoolean;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    ttl: z.ZodOptional<z.ZodString>;
    expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    costInCents: z.ZodNumber;
    baseCostInCents: z.ZodNumber;
    durationMs: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    taskKind: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    depth: z.ZodNumber;
    triggerFunction: z.ZodEnum<{
        batchTrigger: "batchTrigger";
        batchTriggerAndWait: "batchTriggerAndWait";
        trigger: "trigger";
        triggerAndWait: "triggerAndWait";
    }>;
    batchId: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodAny>;
    payloadPresignedUrl: z.ZodOptional<z.ZodString>;
    output: z.ZodOptional<z.ZodAny>;
    outputPresignedUrl: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodObject<{
        message: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        stackTrace: z.ZodOptional<z.ZodString>;
        causes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodOptional<z.ZodString>;
            message: z.ZodString;
            stackTrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    schedule: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        externalId: z.ZodOptional<z.ZodString>;
        deduplicationKey: z.ZodOptional<z.ZodString>;
        generator: z.ZodObject<{
            type: z.ZodLiteral<"CRON">;
            expression: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    relatedRuns: z.ZodObject<{
        root: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED: "COMPLETED";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                FAILED: "FAILED";
                PENDING_VERSION: "PENDING_VERSION";
                QUEUED: "QUEUED";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING: "WAITING";
            }>;
            taskIdentifier: z.ZodString;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            isQueued: z.ZodBoolean;
            isExecuting: z.ZodBoolean;
            isWaiting: z.ZodBoolean;
            isCompleted: z.ZodBoolean;
            isSuccess: z.ZodBoolean;
            isFailed: z.ZodBoolean;
            isCancelled: z.ZodBoolean;
            isTest: z.ZodBoolean;
            createdAt: z.ZodCoercedDate<unknown>;
            updatedAt: z.ZodCoercedDate<unknown>;
            startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            ttl: z.ZodOptional<z.ZodString>;
            expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            tags: z.ZodArray<z.ZodString>;
            costInCents: z.ZodNumber;
            baseCostInCents: z.ZodNumber;
            durationMs: z.ZodNumber;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            taskKind: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            depth: z.ZodNumber;
            triggerFunction: z.ZodEnum<{
                batchTrigger: "batchTrigger";
                batchTriggerAndWait: "batchTriggerAndWait";
                trigger: "trigger";
                triggerAndWait: "triggerAndWait";
            }>;
            batchId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        parent: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED: "COMPLETED";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                FAILED: "FAILED";
                PENDING_VERSION: "PENDING_VERSION";
                QUEUED: "QUEUED";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING: "WAITING";
            }>;
            taskIdentifier: z.ZodString;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            isQueued: z.ZodBoolean;
            isExecuting: z.ZodBoolean;
            isWaiting: z.ZodBoolean;
            isCompleted: z.ZodBoolean;
            isSuccess: z.ZodBoolean;
            isFailed: z.ZodBoolean;
            isCancelled: z.ZodBoolean;
            isTest: z.ZodBoolean;
            createdAt: z.ZodCoercedDate<unknown>;
            updatedAt: z.ZodCoercedDate<unknown>;
            startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            ttl: z.ZodOptional<z.ZodString>;
            expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            tags: z.ZodArray<z.ZodString>;
            costInCents: z.ZodNumber;
            baseCostInCents: z.ZodNumber;
            durationMs: z.ZodNumber;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            taskKind: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            depth: z.ZodNumber;
            triggerFunction: z.ZodEnum<{
                batchTrigger: "batchTrigger";
                batchTriggerAndWait: "batchTriggerAndWait";
                trigger: "trigger";
                triggerAndWait: "triggerAndWait";
            }>;
            batchId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        children: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<{
                CANCELED: "CANCELED";
                COMPLETED: "COMPLETED";
                CRASHED: "CRASHED";
                DELAYED: "DELAYED";
                DEQUEUED: "DEQUEUED";
                EXECUTING: "EXECUTING";
                EXPIRED: "EXPIRED";
                FAILED: "FAILED";
                PENDING_VERSION: "PENDING_VERSION";
                QUEUED: "QUEUED";
                SYSTEM_FAILURE: "SYSTEM_FAILURE";
                TIMED_OUT: "TIMED_OUT";
                WAITING: "WAITING";
            }>;
            taskIdentifier: z.ZodString;
            idempotencyKey: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            isQueued: z.ZodBoolean;
            isExecuting: z.ZodBoolean;
            isWaiting: z.ZodBoolean;
            isCompleted: z.ZodBoolean;
            isSuccess: z.ZodBoolean;
            isFailed: z.ZodBoolean;
            isCancelled: z.ZodBoolean;
            isTest: z.ZodBoolean;
            createdAt: z.ZodCoercedDate<unknown>;
            updatedAt: z.ZodCoercedDate<unknown>;
            startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            ttl: z.ZodOptional<z.ZodString>;
            expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
            tags: z.ZodArray<z.ZodString>;
            costInCents: z.ZodNumber;
            baseCostInCents: z.ZodNumber;
            durationMs: z.ZodNumber;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            taskKind: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            depth: z.ZodNumber;
            triggerFunction: z.ZodEnum<{
                batchTrigger: "batchTrigger";
                batchTriggerAndWait: "batchTriggerAndWait";
                trigger: "trigger";
                triggerAndWait: "triggerAndWait";
            }>;
            batchId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    attemptCount: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type RetrieveRunResponse = z.infer<typeof RetrieveRunResponse>;
export declare const ListRunResponseItem: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        CANCELED: "CANCELED";
        COMPLETED: "COMPLETED";
        CRASHED: "CRASHED";
        DELAYED: "DELAYED";
        DEQUEUED: "DEQUEUED";
        EXECUTING: "EXECUTING";
        EXPIRED: "EXPIRED";
        FAILED: "FAILED";
        PENDING_VERSION: "PENDING_VERSION";
        QUEUED: "QUEUED";
        SYSTEM_FAILURE: "SYSTEM_FAILURE";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    taskIdentifier: z.ZodString;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    isQueued: z.ZodBoolean;
    isExecuting: z.ZodBoolean;
    isWaiting: z.ZodBoolean;
    isCompleted: z.ZodBoolean;
    isSuccess: z.ZodBoolean;
    isFailed: z.ZodBoolean;
    isCancelled: z.ZodBoolean;
    isTest: z.ZodBoolean;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    ttl: z.ZodOptional<z.ZodString>;
    expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    costInCents: z.ZodNumber;
    baseCostInCents: z.ZodNumber;
    durationMs: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    taskKind: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    env: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        user: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListRunResponseItem = z.infer<typeof ListRunResponseItem>;
export declare const ListRunResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            FAILED: "FAILED";
            PENDING_VERSION: "PENDING_VERSION";
            QUEUED: "QUEUED";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING: "WAITING";
        }>;
        taskIdentifier: z.ZodString;
        idempotencyKey: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        isQueued: z.ZodBoolean;
        isExecuting: z.ZodBoolean;
        isWaiting: z.ZodBoolean;
        isCompleted: z.ZodBoolean;
        isSuccess: z.ZodBoolean;
        isFailed: z.ZodBoolean;
        isCancelled: z.ZodBoolean;
        isTest: z.ZodBoolean;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        startedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        finishedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        delayedUntil: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        ttl: z.ZodOptional<z.ZodString>;
        expiredAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        tags: z.ZodArray<z.ZodString>;
        costInCents: z.ZodNumber;
        baseCostInCents: z.ZodNumber;
        durationMs: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        taskKind: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        env: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            user: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        next: z.ZodOptional<z.ZodString>;
        previous: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListRunResponse = z.infer<typeof ListRunResponse>;
export declare const CreateBulkActionRequestBody: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
    filter: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            FAILED: "FAILED";
            PENDING_VERSION: "PENDING_VERSION";
            QUEUED: "QUEUED";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING: "WAITING";
        }>, z.ZodArray<z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            FAILED: "FAILED";
            PENDING_VERSION: "PENDING_VERSION";
            QUEUED: "QUEUED";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING: "WAITING";
        }>>]>>;
        taskIdentifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        version: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        from: z.ZodOptional<z.ZodUnion<readonly [z.ZodCoercedDate<unknown>, z.ZodNumber]>>;
        to: z.ZodOptional<z.ZodUnion<readonly [z.ZodCoercedDate<unknown>, z.ZodNumber]>>;
        period: z.ZodOptional<z.ZodString>;
        bulkAction: z.ZodOptional<z.ZodString>;
        tag: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        schedule: z.ZodOptional<z.ZodString>;
        isTest: z.ZodOptional<z.ZodBoolean>;
        batch: z.ZodOptional<z.ZodString>;
        queue: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                task: "task";
            }>;
            name: z.ZodString;
        }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                task: "task";
            }>;
            name: z.ZodString;
        }, z.core.$strip>>]>>;
        machine: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>, z.ZodArray<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>]>>;
        region: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
    runIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    action: z.ZodLiteral<"cancel">;
    targetRegion: z.ZodOptional<z.ZodNever>;
}, z.core.$strip>, z.ZodObject<{
    filter: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            FAILED: "FAILED";
            PENDING_VERSION: "PENDING_VERSION";
            QUEUED: "QUEUED";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING: "WAITING";
        }>, z.ZodArray<z.ZodEnum<{
            CANCELED: "CANCELED";
            COMPLETED: "COMPLETED";
            CRASHED: "CRASHED";
            DELAYED: "DELAYED";
            DEQUEUED: "DEQUEUED";
            EXECUTING: "EXECUTING";
            EXPIRED: "EXPIRED";
            FAILED: "FAILED";
            PENDING_VERSION: "PENDING_VERSION";
            QUEUED: "QUEUED";
            SYSTEM_FAILURE: "SYSTEM_FAILURE";
            TIMED_OUT: "TIMED_OUT";
            WAITING: "WAITING";
        }>>]>>;
        taskIdentifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        version: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        from: z.ZodOptional<z.ZodUnion<readonly [z.ZodCoercedDate<unknown>, z.ZodNumber]>>;
        to: z.ZodOptional<z.ZodUnion<readonly [z.ZodCoercedDate<unknown>, z.ZodNumber]>>;
        period: z.ZodOptional<z.ZodString>;
        bulkAction: z.ZodOptional<z.ZodString>;
        tag: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        schedule: z.ZodOptional<z.ZodString>;
        isTest: z.ZodOptional<z.ZodBoolean>;
        batch: z.ZodOptional<z.ZodString>;
        queue: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                task: "task";
            }>;
            name: z.ZodString;
        }, z.core.$strip>, z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                custom: "custom";
                task: "task";
            }>;
            name: z.ZodString;
        }, z.core.$strip>>]>>;
        machine: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>, z.ZodArray<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>]>>;
        region: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    }, z.core.$strip>>;
    runIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    action: z.ZodLiteral<"replay">;
    targetRegion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>;
export type CreateBulkActionRequestBody = z.infer<typeof CreateBulkActionRequestBody>;
export declare const BulkActionStatus: z.ZodEnum<{
    ABORTED: "ABORTED";
    COMPLETED: "COMPLETED";
    PENDING: "PENDING";
}>;
export type BulkActionStatus = z.infer<typeof BulkActionStatus>;
export declare const BulkActionType: z.ZodEnum<{
    CANCEL: "CANCEL";
    REPLAY: "REPLAY";
}>;
export type BulkActionType = z.infer<typeof BulkActionType>;
export declare const BulkActionObject: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        CANCEL: "CANCEL";
        REPLAY: "REPLAY";
    }>;
    status: z.ZodEnum<{
        ABORTED: "ABORTED";
        COMPLETED: "COMPLETED";
        PENDING: "PENDING";
    }>;
    counts: z.ZodObject<{
        total: z.ZodNumber;
        success: z.ZodNumber;
        failure: z.ZodNumber;
    }, z.core.$strip>;
    createdAt: z.ZodCoercedDate<unknown>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export type BulkActionObject = z.infer<typeof BulkActionObject>;
export declare const CreateBulkActionResponseBody: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type CreateBulkActionResponseBody = z.infer<typeof CreateBulkActionResponseBody>;
export declare const AbortBulkActionResponseBody: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type AbortBulkActionResponseBody = z.infer<typeof AbortBulkActionResponseBody>;
export declare const ListBulkActionsResponseBody: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            CANCEL: "CANCEL";
            REPLAY: "REPLAY";
        }>;
        status: z.ZodEnum<{
            ABORTED: "ABORTED";
            COMPLETED: "COMPLETED";
            PENDING: "PENDING";
        }>;
        counts: z.ZodObject<{
            total: z.ZodNumber;
            success: z.ZodNumber;
            failure: z.ZodNumber;
        }, z.core.$strip>;
        createdAt: z.ZodCoercedDate<unknown>;
        completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        next: z.ZodOptional<z.ZodString>;
        previous: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListBulkActionsResponseBody = z.infer<typeof ListBulkActionsResponseBody>;
export declare const CreateEnvironmentVariableRequestBody: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
    isSecret: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type CreateEnvironmentVariableRequestBody = z.infer<typeof CreateEnvironmentVariableRequestBody>;
export declare const UpdateEnvironmentVariableRequestBody: z.ZodObject<{
    value: z.ZodString;
}, z.core.$strip>;
export type UpdateEnvironmentVariableRequestBody = z.infer<typeof UpdateEnvironmentVariableRequestBody>;
export declare const ImportEnvironmentVariablesRequestBody: z.ZodObject<{
    variables: z.ZodRecord<z.ZodString, z.ZodString>;
    parentVariables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    override: z.ZodOptional<z.ZodBoolean>;
    isSecret: z.ZodOptional<z.ZodBoolean>;
    source: z.ZodOptional<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"user">;
        userId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"integration">;
        integration: z.ZodString;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type ImportEnvironmentVariablesRequestBody = z.infer<typeof ImportEnvironmentVariablesRequestBody>;
export declare const EnvironmentVariableResponseBody: z.ZodObject<{
    success: z.ZodBoolean;
}, z.core.$strip>;
export type EnvironmentVariableResponseBody = z.infer<typeof EnvironmentVariableResponseBody>;
export declare const EnvironmentVariableValue: z.ZodObject<{
    value: z.ZodString;
}, z.core.$strip>;
export type EnvironmentVariableValue = z.infer<typeof EnvironmentVariableValue>;
export declare const EnvironmentVariable: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
export declare const EnvironmentVariables: z.ZodArray<z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>>;
export type EnvironmentVariables = z.infer<typeof EnvironmentVariables>;
export declare const EnvironmentVariableWithSecret: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
    isSecret: z.ZodBoolean;
}, z.core.$strip>;
export type EnvironmentVariableWithSecret = z.infer<typeof EnvironmentVariableWithSecret>;
export declare const UpdateMetadataRequestBody: z.ZodObject<{
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>>;
    operations: z.ZodOptional<z.ZodArray<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
        type: z.ZodLiteral<"update">;
        value: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"set">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
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
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
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
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        key: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"append">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"remove">;
        key: z.ZodString;
        value: z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"increment">;
        key: z.ZodString;
        value: z.ZodNumber;
    }, z.core.$strip>]>>>;
}, z.core.$strip>;
export type UpdateMetadataRequestBody = z.infer<typeof UpdateMetadataRequestBody>;
export declare const UpdateMetadataResponseBody: z.ZodObject<{
    metadata: z.ZodRecord<z.ZodString, z.ZodType<import("../../schemas/json.js").DeserializedJson, unknown, z.core.$ZodTypeInternals<import("../../schemas/json.js").DeserializedJson, unknown>>>;
}, z.core.$strip>;
export type UpdateMetadataResponseBody = z.infer<typeof UpdateMetadataResponseBody>;
export declare const SubscribeRunRawShape: z.ZodObject<{
    id: z.ZodString;
    taskIdentifier: z.ZodString;
    friendlyId: z.ZodString;
    status: z.ZodString;
    createdAt: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodCoercedDate<string>>;
    updatedAt: z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodCoercedDate<string>>;
    startedAt: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | Date | null | undefined, string | null | undefined>>;
    delayUntil: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | Date | null | undefined, string | null | undefined>>;
    queuedAt: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | Date | null | undefined, string | null | undefined>>;
    expiredAt: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | Date | null | undefined, string | null | undefined>>;
    completedAt: z.ZodPipe<z.ZodOptional<z.ZodNullable<z.ZodString>>, z.ZodTransform<string | Date | null | undefined, string | null | undefined>>;
    idempotencyKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    number: z.ZodDefault<z.ZodNumber>;
    isTest: z.ZodDefault<z.ZodBoolean>;
    usageDurationMs: z.ZodDefault<z.ZodNumber>;
    costInCents: z.ZodDefault<z.ZodNumber>;
    baseCostInCents: z.ZodDefault<z.ZodNumber>;
    ttl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payload: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payloadType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadataType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    output: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    outputType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    runTags: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
    error: z.ZodOptional<z.ZodNullable<import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
    }, z.core.$strip>]>>>;
    realtimeStreams: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>>;
}, z.core.$strip>;
export type SubscribeRunRawShape = z.infer<typeof SubscribeRunRawShape>;
export declare const BatchStatus: z.ZodEnum<{
    ABORTED: "ABORTED";
    COMPLETED: "COMPLETED";
    PARTIAL_FAILED: "PARTIAL_FAILED";
    PENDING: "PENDING";
    PROCESSING: "PROCESSING";
}>;
export type BatchStatus = z.infer<typeof BatchStatus>;
export declare const RetrieveBatchResponse: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        ABORTED: "ABORTED";
        COMPLETED: "COMPLETED";
        PARTIAL_FAILED: "PARTIAL_FAILED";
        PENDING: "PENDING";
        PROCESSING: "PROCESSING";
    }>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    runCount: z.ZodNumber;
    runs: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type RetrieveBatchResponse = z.infer<typeof RetrieveBatchResponse>;
export declare const RetrieveBatchV2Response: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        ABORTED: "ABORTED";
        COMPLETED: "COMPLETED";
        PARTIAL_FAILED: "PARTIAL_FAILED";
        PENDING: "PENDING";
        PROCESSING: "PROCESSING";
    }>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    runCount: z.ZodNumber;
    runs: z.ZodArray<z.ZodString>;
    processing: z.ZodObject<{
        completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
        errors: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            taskIdentifier: z.ZodString;
            error: z.ZodString;
            errorCode: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RetrieveBatchV2Response = z.infer<typeof RetrieveBatchV2Response>;
export declare const SubscribeRealtimeStreamChunkRawShape: z.ZodObject<{
    id: z.ZodString;
    runId: z.ZodString;
    sequence: z.ZodNumber;
    key: z.ZodString;
    value: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type SubscribeRealtimeStreamChunkRawShape = z.infer<typeof SubscribeRealtimeStreamChunkRawShape>;
export declare const TimePeriod: z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>;
export type TimePeriod = z.infer<typeof TimePeriod>;
export declare const CreateWaitpointTokenRequestBody: z.ZodObject<{
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
    timeout: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodCoercedDate<unknown>]>>;
    tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
}, z.core.$strip>;
export type CreateWaitpointTokenRequestBody = z.infer<typeof CreateWaitpointTokenRequestBody>;
export declare const CreateWaitpointTokenResponseBody: z.ZodObject<{
    id: z.ZodString;
    isCached: z.ZodBoolean;
    url: z.ZodString;
}, z.core.$strip>;
export type CreateWaitpointTokenResponseBody = z.infer<typeof CreateWaitpointTokenResponseBody>;
export declare const CreateInputStreamWaitpointRequestBody: z.ZodObject<{
    streamId: z.ZodString;
    timeout: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    lastSeqNum: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CreateInputStreamWaitpointRequestBody = z.infer<typeof CreateInputStreamWaitpointRequestBody>;
export declare const CreateInputStreamWaitpointResponseBody: z.ZodObject<{
    waitpointId: z.ZodString;
    isCached: z.ZodBoolean;
}, z.core.$strip>;
export type CreateInputStreamWaitpointResponseBody = z.infer<typeof CreateInputStreamWaitpointResponseBody>;
/**
 * Create a run-scoped waitpoint that completes when the next record lands on
 * a Session channel (`.in` or `.out`). Mirrors `CreateInputStreamWaitpointRequestBody`
 * but keyed by `{sessionId, io}` instead of `{runId, streamId}`. The run is
 * still the thing being suspended — Session only supplies the trigger source.
 */
export declare const CreateSessionStreamWaitpointRequestBody: z.ZodObject<{
    session: z.ZodString;
    io: z.ZodEnum<{
        in: "in";
        out: "out";
    }>;
    timeout: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    lastSeqNum: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CreateSessionStreamWaitpointRequestBody = z.infer<typeof CreateSessionStreamWaitpointRequestBody>;
export declare const CreateSessionStreamWaitpointResponseBody: z.ZodObject<{
    waitpointId: z.ZodString;
    isCached: z.ZodBoolean;
}, z.core.$strip>;
export type CreateSessionStreamWaitpointResponseBody = z.infer<typeof CreateSessionStreamWaitpointResponseBody>;
export declare const waitpointTokenStatuses: readonly ["WAITING", "COMPLETED", "TIMED_OUT"];
export declare const WaitpointTokenStatus: z.ZodEnum<{
    COMPLETED: "COMPLETED";
    TIMED_OUT: "TIMED_OUT";
    WAITING: "WAITING";
}>;
export type WaitpointTokenStatus = z.infer<typeof WaitpointTokenStatus>;
export declare const WaitpointTokenItem: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    status: z.ZodEnum<{
        COMPLETED: "COMPLETED";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    completedAfter: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    timeoutAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyExpiresAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type WaitpointTokenItem = z.infer<typeof WaitpointTokenItem>;
export declare const WaitpointListTokenItem: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    status: z.ZodEnum<{
        COMPLETED: "COMPLETED";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    timeoutAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyExpiresAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type WaitpointListTokenItem = z.infer<typeof WaitpointListTokenItem>;
export declare const WaitpointRetrieveTokenResponse: z.ZodIntersection<z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    status: z.ZodEnum<{
        COMPLETED: "COMPLETED";
        TIMED_OUT: "TIMED_OUT";
        WAITING: "WAITING";
    }>;
    completedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    timeoutAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyExpiresAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    tags: z.ZodArray<z.ZodString>;
    createdAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>, z.ZodObject<{
    output: z.ZodOptional<z.ZodString>;
    outputType: z.ZodOptional<z.ZodString>;
    outputIsError: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>>;
export type WaitpointRetrieveTokenResponse = z.infer<typeof WaitpointRetrieveTokenResponse>;
export declare const CompleteWaitpointTokenRequestBody: z.ZodObject<{
    data: z.ZodOptional<z.ZodNullable<z.ZodAny>>;
}, z.core.$strip>;
export type CompleteWaitpointTokenRequestBody = z.infer<typeof CompleteWaitpointTokenRequestBody>;
/**
 * Trigger config persisted on a Session. Drives every run the session
 * schedules — `basePayload` is the customer's wire payload (for
 * chat.agent: `{ chatId, ...clientData }`), runtime fields like
 * `trigger: "preload" | "trigger"` are merged on top per-call by the
 * server's trigger machinery.
 */
export declare const SessionTriggerConfig: z.ZodObject<{
    basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    machine: z.ZodOptional<z.ZodEnum<{
        "large-1x": "large-1x";
        "large-2x": "large-2x";
        "medium-1x": "medium-1x";
        "medium-2x": "medium-2x";
        micro: "micro";
        "small-1x": "small-1x";
        "small-2x": "small-2x";
    }>>;
    queue: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    maxAttempts: z.ZodOptional<z.ZodNumber>;
    maxDuration: z.ZodOptional<z.ZodNumber>;
    lockToVersion: z.ZodOptional<z.ZodString>;
    externalDeploymentId: z.ZodOptional<z.ZodString>;
    region: z.ZodOptional<z.ZodString>;
    idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
    ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
export type SessionTriggerConfig = z.infer<typeof SessionTriggerConfig>;
/**
 * Request body for `POST /api/v1/sessions`. Creates a Session and
 * triggers its first run. Sessions are task-bound: `taskIdentifier` and
 * `triggerConfig` are required, and re-runs scheduled by the server
 * (after run termination, after `end-and-continue`) reuse the same
 * config.
 */
export declare const CreateSessionRequestBody: z.ZodObject<{
    type: z.ZodString;
    externalId: z.ZodOptional<z.ZodString>;
    taskIdentifier: z.ZodString;
    triggerConfig: z.ZodObject<{
        basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        queue: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    expiresAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
}, z.core.$strip>;
export type CreateSessionRequestBody = z.infer<typeof CreateSessionRequestBody>;
export declare const SessionItem: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodNullable<z.ZodString>;
    type: z.ZodString;
    taskIdentifier: z.ZodString;
    triggerConfig: z.ZodOptional<z.ZodObject<{
        basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        queue: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>>;
    currentRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodArray<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    closedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    closedReason: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type SessionItem = z.infer<typeof SessionItem>;
export declare const CreatedSessionResponseBody: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodNullable<z.ZodString>;
    type: z.ZodString;
    taskIdentifier: z.ZodString;
    triggerConfig: z.ZodOptional<z.ZodObject<{
        basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        queue: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>>;
    currentRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodArray<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    closedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    closedReason: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
    runId: z.ZodString;
    publicAccessToken: z.ZodString;
    isCached: z.ZodBoolean;
    pendingVersion: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type CreatedSessionResponseBody = z.infer<typeof CreatedSessionResponseBody>;
export declare const RetrieveSessionResponseBody: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodNullable<z.ZodString>;
    type: z.ZodString;
    taskIdentifier: z.ZodString;
    triggerConfig: z.ZodOptional<z.ZodObject<{
        basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        queue: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>>;
    currentRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodArray<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    closedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    closedReason: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type RetrieveSessionResponseBody = z.infer<typeof RetrieveSessionResponseBody>;
/**
 * Body for `POST /api/v1/sessions/:session/end-and-continue`. Used by the
 * running agent to request a clean handoff to a fresh run on the latest
 * deployed version (typical use case: `chat.requestUpgrade`). The
 * server triggers a new run, atomically swaps `currentRunId`, and the
 * caller exits.
 */
export declare const EndAndContinueSessionRequestBody: z.ZodObject<{
    callingRunId: z.ZodString;
    reason: z.ZodString;
    externalDeploymentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EndAndContinueSessionRequestBody = z.infer<typeof EndAndContinueSessionRequestBody>;
export declare const EndAndContinueSessionResponseBody: z.ZodObject<{
    runId: z.ZodString;
    swapped: z.ZodBoolean;
    pendingVersion: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type EndAndContinueSessionResponseBody = z.infer<typeof EndAndContinueSessionResponseBody>;
export declare const UpdateSessionRequestBody: z.ZodObject<{
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    externalId: z.ZodOptional<z.ZodUnion<readonly [z.ZodLiteral<null>, z.ZodString]>>;
}, z.core.$strip>;
export type UpdateSessionRequestBody = z.infer<typeof UpdateSessionRequestBody>;
export declare const CloseSessionRequestBody: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
    callingRunId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CloseSessionRequestBody = z.infer<typeof CloseSessionRequestBody>;
export declare const SessionStatus: z.ZodEnum<{
    ACTIVE: "ACTIVE";
    CLOSED: "CLOSED";
    EXPIRED: "EXPIRED";
}>;
export type SessionStatus = z.infer<typeof SessionStatus>;
/**
 * Server-side validation schema for `GET /api/v1/sessions`. Follows the same
 * cursor-pagination convention as runs/waitpoints (`page[size]`,
 * `page[after]`, `page[before]`) and uses the `filter[*]` prefix for
 * narrowing fields — both produced automatically by `zodfetchCursorPage`
 * and the matching client-side search-query helper.
 */
export declare const ListSessionsQueryParams: z.ZodObject<{
    "page[size]": z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    "page[after]": z.ZodOptional<z.ZodString>;
    "page[before]": z.ZodOptional<z.ZodString>;
    "filter[type]": z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    "filter[tags]": z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    "filter[taskIdentifier]": z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    "filter[externalId]": z.ZodOptional<z.ZodString>;
    "filter[status]": z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        ACTIVE: "ACTIVE";
        CLOSED: "CLOSED";
        EXPIRED: "EXPIRED";
    }>, z.ZodArray<z.ZodEnum<{
        ACTIVE: "ACTIVE";
        CLOSED: "CLOSED";
        EXPIRED: "EXPIRED";
    }>>]>>;
    "filter[createdAt][period]": z.ZodOptional<z.ZodString>;
    "filter[createdAt][from]": z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    "filter[createdAt][to]": z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ListSessionsQueryParams = z.infer<typeof ListSessionsQueryParams>;
/**
 * Client-facing list options — flattened shape that
 * {@link ApiClient.listSessions} converts into the `filter[*]` / `page[*]`
 * query string before sending.
 */
export declare const ListSessionsOptions: z.ZodObject<{
    limit: z.ZodOptional<z.ZodNumber>;
    after: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    tag: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    taskIdentifier: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    externalId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodUnion<readonly [z.ZodEnum<{
        ACTIVE: "ACTIVE";
        CLOSED: "CLOSED";
        EXPIRED: "EXPIRED";
    }>, z.ZodArray<z.ZodEnum<{
        ACTIVE: "ACTIVE";
        CLOSED: "CLOSED";
        EXPIRED: "EXPIRED";
    }>>]>>;
    period: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodDate]>>;
    to: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodDate]>>;
}, z.core.$strip>;
export type ListSessionsOptions = z.infer<typeof ListSessionsOptions>;
export declare const ListedSessionItem: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodNullable<z.ZodString>;
    type: z.ZodString;
    taskIdentifier: z.ZodString;
    triggerConfig: z.ZodOptional<z.ZodObject<{
        basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        machine: z.ZodOptional<z.ZodEnum<{
            "large-1x": "large-1x";
            "large-2x": "large-2x";
            "medium-1x": "medium-1x";
            "medium-2x": "medium-2x";
            micro: "micro";
            "small-1x": "small-1x";
            "small-2x": "small-2x";
        }>>;
        queue: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
        maxAttempts: z.ZodOptional<z.ZodNumber>;
        maxDuration: z.ZodOptional<z.ZodNumber>;
        lockToVersion: z.ZodOptional<z.ZodString>;
        externalDeploymentId: z.ZodOptional<z.ZodString>;
        region: z.ZodOptional<z.ZodString>;
        idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
        ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    }, z.core.$strip>>;
    currentRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodArray<z.ZodString>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    closedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    closedReason: z.ZodNullable<z.ZodString>;
    expiresAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
    createdAt: z.ZodCoercedDate<unknown>;
    updatedAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type ListedSessionItem = z.infer<typeof ListedSessionItem>;
export declare const ListSessionsResponseBody: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        externalId: z.ZodNullable<z.ZodString>;
        type: z.ZodString;
        taskIdentifier: z.ZodString;
        triggerConfig: z.ZodOptional<z.ZodObject<{
            basePayload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            machine: z.ZodOptional<z.ZodEnum<{
                "large-1x": "large-1x";
                "large-2x": "large-2x";
                "medium-1x": "medium-1x";
                "medium-2x": "medium-2x";
                micro: "micro";
                "small-1x": "small-1x";
                "small-2x": "small-2x";
            }>>;
            queue: z.ZodOptional<z.ZodString>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
            maxAttempts: z.ZodOptional<z.ZodNumber>;
            maxDuration: z.ZodOptional<z.ZodNumber>;
            lockToVersion: z.ZodOptional<z.ZodString>;
            externalDeploymentId: z.ZodOptional<z.ZodString>;
            region: z.ZodOptional<z.ZodString>;
            idleTimeoutInSeconds: z.ZodOptional<z.ZodNumber>;
            ttl: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        }, z.core.$strip>>;
        currentRunId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        tags: z.ZodArray<z.ZodString>;
        metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        closedAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
        closedReason: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        next: z.ZodOptional<z.ZodString>;
        previous: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ListSessionsResponseBody = z.infer<typeof ListSessionsResponseBody>;
export declare const CompleteWaitpointTokenResponseBody: z.ZodObject<{
    success: z.ZodLiteral<true>;
}, z.core.$strip>;
export type CompleteWaitpointTokenResponseBody = z.infer<typeof CompleteWaitpointTokenResponseBody>;
export declare const WaitForWaitpointTokenResponseBody: z.ZodObject<{
    success: z.ZodBoolean;
}, z.core.$strip>;
export type WaitForWaitpointTokenResponseBody = z.infer<typeof WaitForWaitpointTokenResponseBody>;
export declare const WaitForDurationRequestBody: z.ZodObject<{
    idempotencyKey: z.ZodOptional<z.ZodString>;
    idempotencyKeyTTL: z.ZodOptional<z.ZodString>;
    date: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export type WaitForDurationRequestBody = z.infer<typeof WaitForDurationRequestBody>;
export declare const WaitForDurationResponseBody: z.ZodObject<{
    waitUntil: z.ZodCoercedDate<unknown>;
    waitpoint: z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WaitForDurationResponseBody = z.infer<typeof WaitForDurationResponseBody>;
export declare function isWaitpointOutputTimeout(output: string): boolean;
export declare function timeoutError(timeout: Date): {
    code: string;
    message: string;
};
export declare const ApiDeploymentListParams: {
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    period: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
};
export declare const ApiDeploymentListOptions: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    period: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ApiDeploymentListOptions = z.infer<typeof ApiDeploymentListOptions>;
export declare const ApiDeploymentListSearchParams: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    period: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>>;
    "page[after]": z.ZodOptional<z.ZodString>;
    "page[size]": z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ApiDeploymentListSearchParams = z.infer<typeof ApiDeploymentListSearchParams>;
export declare const ApiDeploymentListResponseItem: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    shortCode: z.ZodString;
    version: z.ZodString;
    runtime: z.ZodNullable<z.ZodString>;
    runtimeVersion: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>;
    deployedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    git: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    error: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type ApiDeploymentListResponseItem = z.infer<typeof ApiDeploymentListResponseItem>;
export declare const RetrieveCurrentDeploymentResponseBody: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodCoercedDate<unknown>;
    shortCode: z.ZodString;
    version: z.ZodString;
    runtime: z.ZodNullable<z.ZodString>;
    runtimeVersion: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        BUILDING: "BUILDING";
        CANCELED: "CANCELED";
        DEPLOYED: "DEPLOYED";
        DEPLOYING: "DEPLOYING";
        FAILED: "FAILED";
        PENDING: "PENDING";
        TIMED_OUT: "TIMED_OUT";
    }>;
    deployedAt: z.ZodOptional<z.ZodCoercedDate<unknown>>;
    git: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    error: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        stderr: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    externalId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type RetrieveCurrentDeploymentResponseBody = ApiDeploymentListResponseItem;
export declare const ApiBranchListResponseBody: z.ZodObject<{
    branches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
        updatedAt: z.ZodCoercedDate<unknown>;
        git: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        isPaused: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ApiBranchListResponseBody = z.infer<typeof ApiBranchListResponseBody>;
export declare const RetrieveRunTraceSpanSchema: z.ZodObject<{
    id: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    runId: z.ZodString;
    data: z.ZodObject<{
        message: z.ZodString;
        taskSlug: z.ZodOptional<z.ZodString>;
        taskPath: z.ZodOptional<z.ZodString>;
        events: z.ZodOptional<z.ZodArray<z.ZodAny>>;
        startTime: z.ZodCoercedDate<unknown>;
        duration: z.ZodNumber;
        isError: z.ZodBoolean;
        isPartial: z.ZodBoolean;
        isCancelled: z.ZodBoolean;
        level: z.ZodString;
        workerVersion: z.ZodOptional<z.ZodString>;
        queueName: z.ZodOptional<z.ZodString>;
        machinePreset: z.ZodOptional<z.ZodString>;
        properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        output: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RetrieveRunTraceSpan = z.infer<typeof RetrieveRunTraceSpanSchema> & {
    children: Array<RetrieveRunTraceSpan>;
};
export declare const RetrieveRunTraceSpan: z.ZodType<RetrieveRunTraceSpan>;
export declare const RetrieveRunTraceResponseBody: z.ZodObject<{
    trace: z.ZodObject<{
        traceId: z.ZodString;
        rootSpan: z.ZodType<RetrieveRunTraceSpan, unknown, z.core.$ZodTypeInternals<RetrieveRunTraceSpan, unknown>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RetrieveRunTraceResponseBody = z.infer<typeof RetrieveRunTraceResponseBody>;
export declare const RetrieveSpanDetailResponseBody: z.ZodObject<{
    spanId: z.ZodString;
    parentId: z.ZodNullable<z.ZodString>;
    runId: z.ZodString;
    message: z.ZodString;
    isError: z.ZodBoolean;
    isPartial: z.ZodBoolean;
    isCancelled: z.ZodBoolean;
    level: z.ZodString;
    startTime: z.ZodCoercedDate<unknown>;
    durationMs: z.ZodNumber;
    properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    events: z.ZodOptional<z.ZodArray<z.ZodAny>>;
    entityType: z.ZodOptional<z.ZodString>;
    ai: z.ZodOptional<z.ZodObject<{
        model: z.ZodString;
        provider: z.ZodString;
        operationName: z.ZodString;
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        totalTokens: z.ZodNumber;
        cachedTokens: z.ZodOptional<z.ZodNumber>;
        reasoningTokens: z.ZodOptional<z.ZodNumber>;
        inputCost: z.ZodOptional<z.ZodNumber>;
        outputCost: z.ZodOptional<z.ZodNumber>;
        totalCost: z.ZodOptional<z.ZodNumber>;
        cachedCost: z.ZodOptional<z.ZodNumber>;
        cacheCreationCost: z.ZodOptional<z.ZodNumber>;
        tokensPerSecond: z.ZodOptional<z.ZodNumber>;
        msToFirstChunk: z.ZodOptional<z.ZodNumber>;
        durationMs: z.ZodNumber;
        finishReason: z.ZodOptional<z.ZodString>;
        responseText: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    triggeredRuns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        runId: z.ZodString;
        taskIdentifier: z.ZodString;
        status: z.ZodString;
        createdAt: z.ZodCoercedDate<unknown>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RetrieveSpanDetailResponseBody = z.infer<typeof RetrieveSpanDetailResponseBody>;
export declare const CreateStreamResponseBody: z.ZodObject<{
    version: z.ZodString;
}, z.core.$strip>;
export type CreateStreamResponseBody = z.infer<typeof CreateStreamResponseBody>;
export declare const AppendToStreamResponseBody: z.ZodObject<{
    ok: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AppendToStreamResponseBody = z.infer<typeof AppendToStreamResponseBody>;
export declare const SendInputStreamResponseBody: z.ZodObject<{
    ok: z.ZodBoolean;
}, z.core.$strip>;
export type SendInputStreamResponseBody = z.infer<typeof SendInputStreamResponseBody>;
/**
 * Response body for `GET /realtime/v1/sessions/:id/:io/records`. A non-SSE,
 * `wait=0` drain of a session channel — used at run boot for snapshot
 * replay where the SSE long-poll tax (~1s on empty streams) was the
 * dominant cost.
 *
 * `data` is the parsed chunk body (the SDK writer puts the chunk object
 * directly into the S2 record envelope; the route unwraps the envelope
 * and forwards the inner object as-is). Callers use it directly — no
 * additional JSON.parse step. Schema is `z.unknown()` because chunk
 * shape varies by `chunk.type` (the AI SDK's `UIMessageChunk`
 * discriminated union plus Trigger control records); consumers
 * already runtime-check on the discriminator and tolerate malformed
 * records by skipping them.
 */
export declare const ReadSessionStreamRecordsResponseBody: z.ZodObject<{
    records: z.ZodArray<z.ZodObject<{
        data: z.ZodUnknown;
        id: z.ZodString;
        seqNum: z.ZodNumber;
        headers: z.ZodOptional<z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ReadSessionStreamRecordsResponseBody = z.infer<typeof ReadSessionStreamRecordsResponseBody>;
export declare const ResolvePromptRequestBody: z.ZodObject<{
    variables: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    label: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ResolvePromptRequestBody = z.infer<typeof ResolvePromptRequestBody>;
export declare const ResolvePromptResponseBody: z.ZodObject<{
    data: z.ZodObject<{
        promptId: z.ZodString;
        slug: z.ZodString;
        version: z.ZodNumber;
        labels: z.ZodArray<z.ZodString>;
        template: z.ZodOptional<z.ZodString>;
        text: z.ZodOptional<z.ZodString>;
        model: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        config: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ResolvePromptResponseBody = z.infer<typeof ResolvePromptResponseBody>;
export declare const ListPromptsResponseBody: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        slug: z.ZodString;
        friendlyId: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        tags: z.ZodArray<z.ZodString>;
        defaultModel: z.ZodNullable<z.ZodString>;
        currentVersion: z.ZodNullable<z.ZodNumber>;
        hasOverride: z.ZodBoolean;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ListPromptsResponseBody = z.infer<typeof ListPromptsResponseBody>;
export declare const ListPromptVersionsResponseBody: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodNumber;
        labels: z.ZodArray<z.ZodString>;
        source: z.ZodString;
        model: z.ZodNullable<z.ZodString>;
        textContent: z.ZodNullable<z.ZodString>;
        commitMessage: z.ZodNullable<z.ZodString>;
        contentHash: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ListPromptVersionsResponseBody = z.infer<typeof ListPromptVersionsResponseBody>;
export declare const PromotePromptVersionRequestBody: z.ZodObject<{
    version: z.ZodNumber;
}, z.core.$strip>;
export type PromotePromptVersionRequestBody = z.infer<typeof PromotePromptVersionRequestBody>;
export declare const CreatePromptOverrideRequestBody: z.ZodObject<{
    textContent: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
    commitMessage: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreatePromptOverrideRequestBody = z.infer<typeof CreatePromptOverrideRequestBody>;
export declare const UpdatePromptOverrideRequestBody: z.ZodObject<{
    textContent: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    commitMessage: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdatePromptOverrideRequestBody = z.infer<typeof UpdatePromptOverrideRequestBody>;
export declare const ReactivatePromptOverrideRequestBody: z.ZodObject<{
    version: z.ZodNumber;
}, z.core.$strip>;
export type ReactivatePromptOverrideRequestBody = z.infer<typeof ReactivatePromptOverrideRequestBody>;
export declare const PromptOkResponseBody: z.ZodObject<{
    ok: z.ZodBoolean;
}, z.core.$strip>;
export type PromptOkResponseBody = z.infer<typeof PromptOkResponseBody>;
export declare const PromptOverrideCreatedResponseBody: z.ZodObject<{
    ok: z.ZodBoolean;
    version: z.ZodNumber;
}, z.core.$strip>;
export type PromptOverrideCreatedResponseBody = z.infer<typeof PromptOverrideCreatedResponseBody>;
export {};
