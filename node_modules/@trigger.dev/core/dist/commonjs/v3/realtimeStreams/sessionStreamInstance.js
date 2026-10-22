"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStreamInstance = void 0;
const streamsWriterV2_js_1 = require("./streamsWriterV2.js");
/**
 * Session-scoped parallel to {@link StreamInstance}. Calls
 * `initializeSessionStream` to fetch S2 credentials for the session's
 * channel, then pipes `source` directly to S2 via {@link StreamsWriterV2}.
 *
 * Sessions are S2-only — there's no v1 (Redis) fallback — so this
 * skips the version-detection dance `StreamInstance` does.
 */
class SessionStreamInstance {
    options;
    streamPromise;
    constructor(options) {
        this.options = options;
        this.streamPromise = this.initializeWriter();
        // Same detached-writer guard as `StreamsWriterV2`: the error is still
        // surfaced by `wait()` / `stream`.
        this.streamPromise.catch(() => { });
    }
    async initializeWriter() {
        const initializeFn = this.options.initializeSession ??
            (() => this.options.apiClient.initializeSessionStream(this.options.sessionId, this.options.io, this.options?.requestOptions));
        const response = await initializeFn();
        const headers = response.headers ?? {};
        const accessToken = headers["x-s2-access-token"];
        const basin = headers["x-s2-basin"];
        const streamName = headers["x-s2-stream-name"];
        const endpoint = headers["x-s2-endpoint"];
        const flushIntervalMs = headers["x-s2-flush-interval-ms"]
            ? parseInt(headers["x-s2-flush-interval-ms"])
            : undefined;
        const maxRetries = headers["x-s2-max-retries"]
            ? parseInt(headers["x-s2-max-retries"])
            : undefined;
        if (!accessToken || !basin || !streamName) {
            throw new Error("Session stream initialize did not return S2 credentials — server may be configured for v1 realtime streams, which sessions do not support.");
        }
        return new streamsWriterV2_js_1.StreamsWriterV2({
            basin,
            stream: streamName,
            accessToken,
            endpoint,
            source: this.options.source,
            signal: this.options.signal,
            debug: this.options.debug,
            flushIntervalMs,
            maxRetries,
        });
    }
    async wait() {
        const writer = await this.streamPromise;
        return writer.wait();
    }
    get stream() {
        // eslint-disable-next-line no-this-alias
        const self = this;
        return new ReadableStream({
            async start(controller) {
                const streamWriter = await self.streamPromise;
                const iterator = streamWriter[Symbol.asyncIterator]();
                while (true) {
                    if (self.options.signal?.aborted) {
                        controller.close();
                        break;
                    }
                    const { done, value } = await iterator.next();
                    if (done) {
                        controller.close();
                        break;
                    }
                    controller.enqueue(value);
                }
            },
        });
    }
}
exports.SessionStreamInstance = SessionStreamInstance;
//# sourceMappingURL=sessionStreamInstance.js.map