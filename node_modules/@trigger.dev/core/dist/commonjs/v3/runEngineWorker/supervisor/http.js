"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupervisorHttpClient = void 0;
const v4_1 = require("zod/v4");
const schemas_js_1 = require("./schemas.js");
const util_js_1 = require("./util.js");
const zodfetch_js_1 = require("../../zodfetch.js");
const util_js_2 = require("../util.js");
const consts_js_1 = require("../consts.js");
const structuredLogger_js_1 = require("../../utils/structuredLogger.js");
class SupervisorHttpClient {
    apiUrl;
    workerToken;
    instanceName;
    defaultHeaders;
    sendRunDebugLogs;
    resolveResponseSchema;
    onHttpRequestComplete;
    logger = new structuredLogger_js_1.SimpleStructuredLogger("supervisor-http-client");
    constructor(opts) {
        this.apiUrl = opts.apiUrl.replace(/\/$/, "");
        this.workerToken = opts.workerToken;
        this.instanceName = opts.instanceName;
        this.defaultHeaders = (0, util_js_1.getDefaultWorkerHeaders)(opts);
        this.sendRunDebugLogs = opts.sendRunDebugLogs ?? false;
        this.resolveResponseSchema = opts.resolveResponseSchema;
        this.onHttpRequestComplete = opts.onHttpRequestComplete;
        if (!this.apiUrl) {
            throw new Error("apiURL is required and needs to be a non-empty string");
        }
        if (!this.workerToken) {
            throw new Error("workerToken is required and needs to be a non-empty string");
        }
        if (!this.instanceName) {
            throw new Error("instanceName is required and needs to be a non-empty string");
        }
    }
    async request(name, schema, url, requestInit, options) {
        const start = performance.now();
        const result = await (0, zodfetch_js_1.wrapZodFetch)(this.resolveResponseSchema?.(schema) ?? schema, url, requestInit, options);
        if (this.onHttpRequestComplete) {
            const durationMs = performance.now() - start;
            const method = requestInit?.method ?? "GET";
            if (result.success) {
                this.onHttpRequestComplete({ name, method, status: "2xx", outcome: "ok", durationMs });
            }
            else if (result.statusCode === 200) {
                this.onHttpRequestComplete({
                    name,
                    method,
                    status: "200",
                    outcome: "invalid_response",
                    durationMs,
                });
            }
            else if (typeof result.statusCode === "number") {
                this.onHttpRequestComplete({
                    name,
                    method,
                    status: String(result.statusCode),
                    outcome: "http_error",
                    durationMs,
                });
            }
            else {
                this.onHttpRequestComplete({
                    name,
                    method,
                    status: "none",
                    outcome: "network_error",
                    durationMs,
                });
            }
        }
        return result;
    }
    async connect(body) {
        return this.request("connect", schemas_js_1.WorkerApiConnectResponseBody, `${this.apiUrl}/engine/v1/worker-actions/connect`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
    async dequeue(body) {
        return this.request("dequeue", schemas_js_1.WorkerApiDequeueResponseBody, `${this.apiUrl}/engine/v1/worker-actions/dequeue`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
    async heartbeatWorker(body) {
        return this.request("heartbeat_worker", schemas_js_1.WorkerApiHeartbeatResponseBody, `${this.apiUrl}/engine/v1/worker-actions/heartbeat`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
    async heartbeatRun(runId, snapshotId, body, runnerId) {
        return this.request("heartbeat_run", schemas_js_1.WorkerApiRunHeartbeatResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/${snapshotId}/heartbeat`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
    async startRunAttempt(runId, snapshotId, body, runnerId, environmentId) {
        return this.request("start_run_attempt", schemas_js_1.WorkerApiRunAttemptStartResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/${snapshotId}/attempts/start`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                ...this.environmentIdHeader(environmentId),
            },
            body: JSON.stringify(body),
        });
    }
    async completeRunAttempt(runId, snapshotId, body, runnerId, environmentId) {
        return this.request("complete_run_attempt", schemas_js_1.WorkerApiRunAttemptCompleteResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/${snapshotId}/attempts/complete`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                ...this.environmentIdHeader(environmentId),
            },
            body: JSON.stringify(body),
        });
    }
    async getLatestSnapshot(runId, runnerId, environmentId) {
        return this.request("get_latest_snapshot", schemas_js_1.WorkerApiRunLatestSnapshotResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/latest`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                ...this.environmentIdHeader(environmentId),
            },
        });
    }
    async getSnapshotsSince(runId, snapshotId, runnerId, environmentId) {
        return this.request("get_snapshots_since", schemas_js_1.WorkerApiRunSnapshotsSinceResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/since/${snapshotId}`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                ...this.environmentIdHeader(environmentId),
            },
        });
    }
    async sendDebugLog(runId, body, runnerId) {
        if (!this.sendRunDebugLogs) {
            return;
        }
        try {
            const res = await this.request("send_debug_log", v4_1.z.unknown(), `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/logs/debug`, {
                method: "POST",
                headers: {
                    ...this.defaultHeaders,
                    ...this.runnerIdHeader(runnerId),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (!res.success) {
                this.logger.error("Failed to send debug log", { error: res.error });
            }
        }
        catch (error) {
            this.logger.error("Failed to send debug log (caught error)", { error });
        }
    }
    async continueRunExecution(runId, snapshotId, runnerId, environmentId) {
        return this.request("continue_run_execution", schemas_js_1.WorkerApiContinueRunExecutionRequestBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/${snapshotId}/continue`, {
            method: "GET",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                ...this.environmentIdHeader(environmentId),
            },
        }, {
            // This is the hop that reaches the engine, so it's where a transient
            // database outage during resume surfaces (as a retryable 5xx). Resuming
            // is idempotent server-side (guarded by the snapshot id), so retry
            // generously to ride out the outage rather than aborting the run.
            // `randomize` jitters the delay so a fleet of runs resuming at once
            // doesn't stampede the DB the moment it recovers.
            retry: {
                minTimeoutInMs: 500,
                maxTimeoutInMs: 10_000,
                maxAttempts: 8,
                factor: 2,
                randomize: true,
            },
        });
    }
    async submitSuspendCompletion({ runId, snapshotId, runnerId, body, }) {
        return this.request("submit_suspend_completion", schemas_js_1.WorkerApiSuspendRunResponseBody, `${this.apiUrl}/engine/v1/worker-actions/runs/${runId}/snapshots/${snapshotId}/suspend`, {
            method: "POST",
            headers: {
                ...this.defaultHeaders,
                ...this.runnerIdHeader(runnerId),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
    }
    runnerIdHeader(runnerId) {
        return (0, util_js_2.createHeaders)({
            [consts_js_1.WORKER_HEADERS.RUNNER_ID]: runnerId,
        });
    }
    environmentIdHeader(environmentId) {
        return (0, util_js_2.createHeaders)({
            [consts_js_1.WORKER_HEADERS.ENVIRONMENT_ID]: environmentId,
        });
    }
}
exports.SupervisorHttpClient = SupervisorHttpClient;
//# sourceMappingURL=http.js.map