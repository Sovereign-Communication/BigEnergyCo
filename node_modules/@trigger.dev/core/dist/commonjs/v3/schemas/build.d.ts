import { z } from "zod/v4";
export declare const BuildExternal: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
}, z.core.$strip>;
export type BuildExternal = z.infer<typeof BuildExternal>;
export declare const BuildTarget: z.ZodEnum<{
    deploy: "deploy";
    dev: "dev";
    unmanaged: "unmanaged";
}>;
export type BuildTarget = z.infer<typeof BuildTarget>;
export declare const ConfigRuntime: z.ZodEnum<{
    bun: "bun";
    "experimental-node-24": "experimental-node-24";
    "experimental-node-26": "experimental-node-26";
    node: "node";
    "node-22": "node-22";
    "node-24": "node-24";
    "node-26": "node-26";
}>;
export type ConfigRuntime = z.infer<typeof ConfigRuntime>;
export declare const BuildRuntime: z.ZodEnum<{
    bun: "bun";
    node: "node";
    "node-22": "node-22";
    "node-24": "node-24";
    "node-26": "node-26";
}>;
export type BuildRuntime = z.infer<typeof BuildRuntime>;
export declare const BuildManifest: z.ZodObject<{
    target: z.ZodEnum<{
        deploy: "deploy";
        dev: "dev";
        unmanaged: "unmanaged";
    }>;
    packageVersion: z.ZodString;
    cliPackageVersion: z.ZodString;
    contentHash: z.ZodString;
    runtime: z.ZodEnum<{
        bun: "bun";
        node: "node";
        "node-22": "node-22";
        "node-24": "node-24";
        "node-26": "node-26";
    }>;
    environment: z.ZodString;
    branch: z.ZodOptional<z.ZodString>;
    config: z.ZodObject<{
        project: z.ZodString;
        dirs: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    files: z.ZodArray<z.ZodObject<{
        entry: z.ZodString;
        out: z.ZodString;
    }, z.core.$strip>>;
    sources: z.ZodRecord<z.ZodString, z.ZodObject<{
        contents: z.ZodString;
        contentHash: z.ZodString;
    }, z.core.$strip>>;
    outputPath: z.ZodString;
    runWorkerEntryPoint: z.ZodString;
    runControllerEntryPoint: z.ZodOptional<z.ZodString>;
    indexWorkerEntryPoint: z.ZodString;
    indexControllerEntryPoint: z.ZodOptional<z.ZodString>;
    loaderEntryPoint: z.ZodOptional<z.ZodString>;
    initEntryPoint: z.ZodOptional<z.ZodString>;
    configPath: z.ZodString;
    externals: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
    }, z.core.$strip>>>;
    build: z.ZodObject<{
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        commands: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    customConditions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    deploy: z.ZodObject<{
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        sync: z.ZodOptional<z.ZodObject<{
            env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            parentEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            secretEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            secretParentEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    image: z.ZodOptional<z.ZodObject<{
        pkgs: z.ZodOptional<z.ZodArray<z.ZodString>>;
        instructions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    otelImportHook: z.ZodOptional<z.ZodObject<{
        include: z.ZodOptional<z.ZodArray<z.ZodString>>;
        exclude: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    outputHashes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filePath: z.ZodString;
        exportName: z.ZodOptional<z.ZodString>;
        entryPoint: z.ZodString;
        id: z.ZodString;
        sourcePath: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type BuildManifest = z.infer<typeof BuildManifest>;
export declare const IndexMessage: z.ZodObject<{
    type: z.ZodLiteral<"index">;
    data: z.ZodObject<{
        build: z.ZodObject<{
            target: z.ZodEnum<{
                deploy: "deploy";
                dev: "dev";
                unmanaged: "unmanaged";
            }>;
            packageVersion: z.ZodString;
            cliPackageVersion: z.ZodString;
            contentHash: z.ZodString;
            runtime: z.ZodEnum<{
                bun: "bun";
                node: "node";
                "node-22": "node-22";
                "node-24": "node-24";
                "node-26": "node-26";
            }>;
            environment: z.ZodString;
            branch: z.ZodOptional<z.ZodString>;
            config: z.ZodObject<{
                project: z.ZodString;
                dirs: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            files: z.ZodArray<z.ZodObject<{
                entry: z.ZodString;
                out: z.ZodString;
            }, z.core.$strip>>;
            sources: z.ZodRecord<z.ZodString, z.ZodObject<{
                contents: z.ZodString;
                contentHash: z.ZodString;
            }, z.core.$strip>>;
            outputPath: z.ZodString;
            runWorkerEntryPoint: z.ZodString;
            runControllerEntryPoint: z.ZodOptional<z.ZodString>;
            indexWorkerEntryPoint: z.ZodString;
            indexControllerEntryPoint: z.ZodOptional<z.ZodString>;
            loaderEntryPoint: z.ZodOptional<z.ZodString>;
            initEntryPoint: z.ZodOptional<z.ZodString>;
            configPath: z.ZodString;
            externals: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                version: z.ZodString;
            }, z.core.$strip>>>;
            build: z.ZodObject<{
                env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                commands: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
            customConditions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            deploy: z.ZodObject<{
                env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                sync: z.ZodOptional<z.ZodObject<{
                    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    parentEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    secretEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                    secretParentEnv: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            image: z.ZodOptional<z.ZodObject<{
                pkgs: z.ZodOptional<z.ZodArray<z.ZodString>>;
                instructions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            otelImportHook: z.ZodOptional<z.ZodObject<{
                include: z.ZodOptional<z.ZodArray<z.ZodString>>;
                exclude: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            outputHashes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            skills: z.ZodOptional<z.ZodArray<z.ZodObject<{
                filePath: z.ZodString;
                exportName: z.ZodOptional<z.ZodString>;
                entryPoint: z.ZodString;
                id: z.ZodString;
                sourcePath: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type IndexMessage = z.infer<typeof IndexMessage>;
export declare const WorkerManifest: z.ZodObject<{
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
export type WorkerManifest = z.infer<typeof WorkerManifest>;
export declare const WorkerManifestMessage: z.ZodObject<{
    type: z.ZodLiteral<"worker-manifest">;
    data: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>;
export type WorkerManifestMessage = z.infer<typeof WorkerManifestMessage>;
export declare const ImportError: z.ZodObject<{
    message: z.ZodString;
    file: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ImportError = z.infer<typeof ImportError>;
export declare const ImportTaskFileErrors: z.ZodArray<z.ZodObject<{
    message: z.ZodString;
    file: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export type ImportTaskFileErrors = z.infer<typeof ImportTaskFileErrors>;
