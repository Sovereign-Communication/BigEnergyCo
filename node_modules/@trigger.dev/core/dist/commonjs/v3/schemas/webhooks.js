"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Webhook = exports.AlertWebhookErrorGroupObject = exports.AlertWebhookDeploymentFailedObject = exports.AlertWebhookDeploymentSuccessObject = exports.DeployError = void 0;
const v4_1 = require("zod/v4");
const zod_js_1 = require("../utils/zod.js");
const api_js_1 = require("./api.js");
const common_js_1 = require("./common.js");
/** Represents a failed run alert webhook payload */
const AlertWebhookRunFailedObject = v4_1.z.object({
    /** Task information */
    task: v4_1.z.object({
        /** Unique identifier for the task */
        id: v4_1.z.string(),
        /** File path where the task is defined */
        filePath: v4_1.z.string(),
        /** Name of the exported task function */
        exportName: v4_1.z.string().optional(),
        /** Version of the task */
        version: v4_1.z.string(),
        /** Version of the SDK used */
        sdkVersion: v4_1.z.string(),
        /** Version of the CLI used */
        cliVersion: v4_1.z.string(),
    }),
    /** Run information */
    run: v4_1.z.object({
        /** Unique identifier for the run */
        id: v4_1.z.string(),
        /** Run number */
        number: v4_1.z.number(),
        /** Current status of the run */
        status: api_js_1.RunStatus,
        /** When the run was created */
        createdAt: v4_1.z.coerce.date(),
        /** When the run started executing */
        startedAt: v4_1.z.coerce.date().optional(),
        /** When the run finished executing */
        completedAt: v4_1.z.coerce.date().optional(),
        /** Whether this is a test run */
        isTest: v4_1.z.boolean(),
        /** Idempotency key for the run */
        idempotencyKey: v4_1.z.string().optional(),
        /** Associated tags */
        tags: v4_1.z.array(v4_1.z.string()),
        /** Error information */
        error: common_js_1.TaskRunError,
        /** Whether the run was an out-of-memory error */
        isOutOfMemoryError: v4_1.z.boolean(),
        /** Machine preset used for the run */
        machine: v4_1.z.string(),
        /** URL to view the run in the dashboard */
        dashboardUrl: v4_1.z.string(),
    }),
    /** Environment information */
    environment: v4_1.z.object({
        /** Environment ID */
        id: v4_1.z.string(),
        /** Environment type */
        type: common_js_1.RuntimeEnvironmentTypeSchema,
        /** Environment slug */
        slug: v4_1.z.string(),
        /** Environment branch name */
        branchName: v4_1.z.string().optional(),
    }),
    /** Organization information */
    organization: v4_1.z.object({
        /** Organization ID */
        id: v4_1.z.string(),
        /** Organization slug */
        slug: v4_1.z.string(),
        /** Organization name */
        name: v4_1.z.string(),
    }),
    /** Project information */
    project: v4_1.z.object({
        /** Project ID */
        id: v4_1.z.string(),
        /** Project reference */
        ref: v4_1.z.string(),
        /** Project slug */
        slug: v4_1.z.string(),
        /** Project name */
        name: v4_1.z.string(),
    }),
});
/** Represents a deployment error */
exports.DeployError = v4_1.z.object({
    /** Error name */
    name: v4_1.z.string(),
    /** Error message */
    message: v4_1.z.string(),
    /** Error stack trace */
    stack: v4_1.z.string().optional(),
    /** Standard error output */
    stderr: v4_1.z.string().optional(),
});
const deploymentCommonProperties = {
    /** Environment information */
    environment: v4_1.z.object({
        id: v4_1.z.string(),
        type: common_js_1.RuntimeEnvironmentTypeSchema,
        slug: v4_1.z.string(),
        /** Environment branch name */
        branchName: v4_1.z.string().optional(),
    }),
    /** Organization information */
    organization: v4_1.z.object({
        id: v4_1.z.string(),
        slug: v4_1.z.string(),
        name: v4_1.z.string(),
    }),
    /** Project information */
    project: v4_1.z.object({
        id: v4_1.z.string(),
        ref: v4_1.z.string(),
        slug: v4_1.z.string(),
        name: v4_1.z.string(),
    }),
    /** Git metadata for the deployment source code */
    git: v4_1.z
        .object({
        branch: v4_1.z.string(),
        commitSha: v4_1.z.string(),
        commitMessage: v4_1.z.string(),
        commitUrl: v4_1.z.string(),
        branchUrl: v4_1.z.string(),
        pullRequestNumber: v4_1.z.number().optional(),
        pullRequestTitle: v4_1.z.string().optional(),
        pullRequestUrl: v4_1.z.string().optional(),
        provider: v4_1.z.string().optional(),
    })
        .optional(),
    /** Vercel integration data */
    vercel: v4_1.z
        .object({
        deploymentUrl: v4_1.z.string(),
    })
        .optional(),
};
const deploymentDeploymentCommonProperties = {
    /** Deployment ID */
    id: v4_1.z.string(),
    /** Deployment status */
    status: v4_1.z.string(),
    /** Deployment version */
    version: v4_1.z.string(),
    /** Short code identifier */
    shortCode: v4_1.z.string(),
};
/** Represents a successful deployment alert webhook payload */
exports.AlertWebhookDeploymentSuccessObject = v4_1.z.object({
    ...deploymentCommonProperties,
    deployment: v4_1.z.object({
        ...deploymentDeploymentCommonProperties,
        /** When the deployment completed */
        deployedAt: v4_1.z.coerce.date(),
    }),
    /** Deployed tasks */
    tasks: v4_1.z.array(v4_1.z.object({
        /** Task ID */
        id: v4_1.z.string(),
        /** File path where the task is defined */
        filePath: v4_1.z.string(),
        /** Name of the exported task function */
        exportName: v4_1.z.string().optional(),
        /** Source of the trigger */
        triggerSource: v4_1.z.string(),
    })),
});
/** Represents a failed deployment alert webhook payload */
exports.AlertWebhookDeploymentFailedObject = v4_1.z.object({
    ...deploymentCommonProperties,
    deployment: v4_1.z.object({
        ...deploymentDeploymentCommonProperties,
        /** When the deployment failed */
        failedAt: v4_1.z.coerce.date(),
    }),
    /** Error information */
    error: exports.DeployError,
});
/** Represents an error group alert webhook payload */
exports.AlertWebhookErrorGroupObject = v4_1.z.object({
    /** Classification of the error alert */
    classification: v4_1.z.enum(["new_issue", "regression", "unignored"]),
    /** Error information */
    error: v4_1.z.object({
        /** Error fingerprint identifier */
        fingerprint: v4_1.z.string(),
        /** Error type */
        type: v4_1.z.string(),
        /** Error message */
        message: v4_1.z.string(),
        /** Sample stack trace */
        stackTrace: v4_1.z.string().optional(),
        /** When the error was first seen */
        firstSeen: v4_1.z.coerce.date(),
        /** When the error was last seen */
        lastSeen: v4_1.z.coerce.date(),
        /** Number of occurrences */
        occurrenceCount: v4_1.z.number(),
        /** Task identifier where the error occurred */
        taskIdentifier: v4_1.z.string(),
    }),
    /** Environment information */
    environment: v4_1.z.object({
        /** Environment ID */
        id: v4_1.z.string(),
        /** Environment name */
        name: v4_1.z.string(),
    }),
    /** Organization information */
    organization: v4_1.z.object({
        /** Organization ID */
        id: v4_1.z.string(),
        /** Organization slug */
        slug: v4_1.z.string(),
        /** Organization name */
        name: v4_1.z.string(),
    }),
    /** Project information */
    project: v4_1.z.object({
        /** Project ID */
        id: v4_1.z.string(),
        /** Project reference */
        ref: v4_1.z.string(),
        /** Project slug */
        slug: v4_1.z.string(),
        /** Project name */
        name: v4_1.z.string(),
    }),
    /** URL to view the error in the dashboard */
    dashboardUrl: v4_1.z.string(),
});
/** Common properties for all webhooks */
const commonProperties = {
    /** Webhook ID */
    id: v4_1.z.string(),
    /** When the webhook was created */
    created: v4_1.z.coerce.date(),
    /** Version of the webhook */
    webhookVersion: v4_1.z.string(),
};
/** Represents all possible webhook types */
exports.Webhook = (0, zod_js_1.discriminatedUnion)("type", [
    /** Run failed alert webhook */
    v4_1.z.object({
        ...commonProperties,
        type: v4_1.z.literal("alert.run.failed"),
        object: AlertWebhookRunFailedObject,
    }),
    /** Deployment success alert webhook */
    v4_1.z.object({
        ...commonProperties,
        type: v4_1.z.literal("alert.deployment.success"),
        object: exports.AlertWebhookDeploymentSuccessObject,
    }),
    /** Deployment failed alert webhook */
    v4_1.z.object({
        ...commonProperties,
        type: v4_1.z.literal("alert.deployment.failed"),
        object: exports.AlertWebhookDeploymentFailedObject,
    }),
    /** Error group alert webhook */
    v4_1.z.object({
        ...commonProperties,
        type: v4_1.z.literal("alert.error"),
        object: exports.AlertWebhookErrorGroupObject,
    }),
]);
// The ingress webhook verification schemas live in ./webhookConfig.ts (a leaf module),
// re-exported via schemas/index.ts. They are deliberately NOT here: this file imports
// api.js (RunStatus) for the alert union, and resources.ts (imported by api.ts) needs
// those config schemas, so keeping them here would create a module-init cycle.
//# sourceMappingURL=webhooks.js.map