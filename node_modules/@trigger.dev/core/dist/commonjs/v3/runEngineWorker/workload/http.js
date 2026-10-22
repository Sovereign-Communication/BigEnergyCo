"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkloadHttpClient = void 0;
const v4_1 = require("zod/v4");
const schemas_js_1 = require("./schemas.js");
const util_js_1 = require("./util.js");
const zodfetch_js_1 = require("../../zodfetch.js");
class WorkloadHttpClient {
    opts;
    apiUrl;
    runnerId;
    constructor(opts) {
        this.opts = opts;
        this.apiUrl = opts.workerApiUrl.replace(/\/$/, "");
        this.runnerId = opts.runnerId;
        if (!this.apiUrl) {
            throw new Error("apiURL is required and needs to be a non-empty string");
        }
        if (!opts.deploymentId) {
            throw new Error("deploymentId is required and needs to be a non-empty string");
        }
    }
    updateApiUrl(apiUrl) {
        this.apiUrl = apiUrl.replace(/\/$/, "");
    }
    updateRunnerId(runnerId) {
        this.runnerId = runnerId;
    }
    defaultHeaders() {
        return (0, util_js_1.getDefaultWorkloadHeaders)({
            ...this.opts,
            runnerId: this.runnerId,
        });
    }
    isConnectionError(error) {
        const connectionErrors = [
            "Connection error",
            "ECONNREFUSED",
            "ETIMEDOUT",
            "ENOTFOUND",
            "ECONNRESET",
            "EHOSTUNREACH",
            "ENETUNREACH",
            "EPIPE",
            "ECONNABORTED",
        ];
        return connectionErrors.some((errType) => error.includes(errType));
    }
    async withConnectionErrorDetection(operation) {
        const result = await operation();
        if (result.success) {
            return result;
        }
        // Check if this is a connection error
        if (this.isConnectionError(result.error)) {
            return {
                ...result,
                isConnectionError: true,
            };
        }
        return result;
    }
    async heartbeatRun(runId, snapshotId, body) {
        return this.withConnectionErrorDetection(() => (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadHeartbeatResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/${snapshotId}/heartbeat`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body ?? {}),
            signal: AbortSignal.timeout(10_000), // 10 second timeout
        }));
    }
    async suspendRun(runId, snapshotId) {
        return (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadSuspendRunResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/${snapshotId}/suspend`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders(),
            },
        });
    }
    async continueRunExecution(runId, snapshotId, snapshotRoute) {
        const query = snapshotRoute
            ? `?snapshotRoute=${encodeURIComponent(JSON.stringify(snapshotRoute))}`
            : "";
        return this.withConnectionErrorDetection(() => (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadContinueRunExecutionResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/${snapshotId}/continue${query}`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders(),
            },
        }, {
            // This hop only reaches the supervisor's workload server, so retry
            // generously with jittered backoff to ride out a transient blip
            // talking to the supervisor (e.g. a restart) rather than aborting the
            // run. Database outages surface one hop further in, on the
            // supervisor-to-engine call, which carries its own retry for them.
            retry: {
                minTimeoutInMs: 500,
                maxTimeoutInMs: 10_000,
                maxAttempts: 8,
                factor: 2,
                randomize: true,
            },
        }));
    }
    async startRunAttempt(runId, snapshotId, body) {
        return (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadRunAttemptStartResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/${snapshotId}/attempts/start`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders(),
            },
            body: JSON.stringify(body),
        }, {
            retry: {
                minTimeoutInMs: 1000,
                maxTimeoutInMs: 10_000,
                maxAttempts: 6,
                factor: 2,
                randomize: true,
            },
        });
    }
    async completeRunAttempt(runId, snapshotId, body) {
        return (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadRunAttemptCompleteResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/${snapshotId}/attempts/complete`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders(),
            },
            body: JSON.stringify(body),
        });
    }
    async getSnapshotsSince(runId, snapshotId) {
        return this.withConnectionErrorDetection(() => (0, zodfetch_js_1.wrapZodFetch)(schemas_js_1.WorkloadRunSnapshotsSinceResponseBody, `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/snapshots/since/${snapshotId}`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders(),
            },
            signal: AbortSignal.timeout(10_000), // 10 second timeout
        }));
    }
    async sendDebugLog(runId, body) {
        try {
            const res = await (0, zodfetch_js_1.wrapZodFetch)(v4_1.z.unknown(), `${this.apiUrl}/api/v1/workload-actions/runs/${runId}/logs/debug`, {
                method: "POST",
                headers: {
                    ...this.defaultHeaders(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (!res.success) {
                console.error("Failed to send debug log", res);
            }
        }
        catch (error) {
            console.error("Failed to send debug log", { error });
        }
    }
}
exports.WorkloadHttpClient = WorkloadHttpClient;
//# sourceMappingURL=http.js.map