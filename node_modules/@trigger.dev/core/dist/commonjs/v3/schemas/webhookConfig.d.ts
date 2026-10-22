import { z } from "zod/v4";
export declare const WebhookSecretProvisioning: z.ZodEnum<{
    either: "either";
    integrator: "integrator";
    provider: "provider";
}>;
export type WebhookSecretProvisioning = z.infer<typeof WebhookSecretProvisioning>;
export declare const WebhookIdempotencyField: z.ZodObject<{
    from: z.ZodEnum<{
        body: "body";
        header: "header";
    }>;
    name: z.ZodString;
}, z.core.$strip>;
export type WebhookIdempotencyField = z.infer<typeof WebhookIdempotencyField>;
export declare const WebhookValueSource: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
export type WebhookValueSource = z.infer<typeof WebhookValueSource>;
export declare const WebhookSignatureExtraction: z.ZodObject<{
    itemSeparator: z.ZodOptional<z.ZodString>;
    fieldSeparator: z.ZodOptional<z.ZodString>;
    field: z.ZodOptional<z.ZodString>;
    trim: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type WebhookSignatureExtraction = z.infer<typeof WebhookSignatureExtraction>;
export declare const WebhookTimestampConfig: z.ZodObject<{
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
}, z.core.$strip>;
export type WebhookTimestampConfig = z.infer<typeof WebhookTimestampConfig>;
export declare const WebhookSecretTransform: z.ZodObject<{
    encoding: z.ZodOptional<z.ZodEnum<{
        base64: "base64";
        utf8: "utf8";
    }>>;
    stripPrefix: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WebhookSecretTransform = z.infer<typeof WebhookSecretTransform>;
export declare const WebhookSigningString: z.ZodUnion<readonly [z.ZodLiteral<"raw">, z.ZodObject<{
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
export type WebhookSigningString = z.infer<typeof WebhookSigningString>;
/**
 * Body-parsing hint. Some providers send an event as JSON but a SECOND kind of callback (e.g. Slack
 * interactivity) as `application/x-www-form-urlencoded` with the JSON in a single field (Slack: `payload`).
 * When JSON parsing fails, the engine form-decodes and JSON-parses `field`'s value. The signature is over
 * the raw body either way, so verification is unaffected. Generic (a field name), no provider code in the engine.
 */
export declare const WebhookFormPayload: z.ZodObject<{
    field: z.ZodString;
}, z.core.$strip>;
export type WebhookFormPayload = z.infer<typeof WebhookFormPayload>;
export declare const WebhookHmacConfig: z.ZodObject<{
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
}, z.core.$strip>;
export type WebhookHmacConfig = z.infer<typeof WebhookHmacConfig>;
export declare const WebhookAsymmetricConfig: z.ZodObject<{
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
}, z.core.$strip>;
export type WebhookAsymmetricConfig = z.infer<typeof WebhookAsymmetricConfig>;
export declare const WebhookSharedSecretConfig: z.ZodObject<{
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
}, z.core.$strip>;
export type WebhookSharedSecretConfig = z.infer<typeof WebhookSharedSecretConfig>;
export declare const WebhookUrlSecretConfig: z.ZodObject<{
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
}, z.core.$strip>;
export type WebhookUrlSecretConfig = z.infer<typeof WebhookUrlSecretConfig>;
export declare const WebhookVerifierConfig: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
export type WebhookVerifierConfig = z.infer<typeof WebhookVerifierConfig>;
export declare const WebhookHandshakeConfig: z.ZodObject<{
    matchPath: z.ZodString;
    matchValue: z.ZodString;
    respondPath: z.ZodString;
}, z.core.$strip>;
export type WebhookHandshakeConfig = z.infer<typeof WebhookHandshakeConfig>;
export declare const WebhookVerifierArtifact: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
export type WebhookVerifierArtifact = z.infer<typeof WebhookVerifierArtifact>;
export declare const WebhookRoutingTarget: import("../utils/zod.js").CompatibleZodDiscriminatedUnion<readonly [z.ZodObject<{
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
export type WebhookRoutingTarget = z.infer<typeof WebhookRoutingTarget>;
export declare const WebhookVerifierResult: z.ZodObject<{
    ok: z.ZodBoolean;
    idempotencyKey: z.ZodString;
    parsedEvent: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WebhookVerifierResult = z.infer<typeof WebhookVerifierResult>;
export type StripeWebhookEvent = {
    id: string;
    object: "event";
    type: string;
    created: number;
    data: {
        object: Record<string, unknown>;
    };
    [k: string]: unknown;
};
export type GitHubWebhookEvent = {
    [k: string]: unknown;
};
