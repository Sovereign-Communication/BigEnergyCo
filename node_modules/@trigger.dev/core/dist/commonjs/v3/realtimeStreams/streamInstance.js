"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamInstance = void 0;
const streamsWriterV1_js_1 = require("./streamsWriterV1.js");
const streamsWriterV2_js_1 = require("./streamsWriterV2.js");
class StreamInstance {
    options;
    streamPromise;
    constructor(options) {
        this.options = options;
        this.streamPromise = this.initializeWriter();
    }
    async initializeWriter() {
        const createStreamFn = this.options.createStream ??
            (() => this.options.apiClient.createStream(this.options.runId, "self", this.options.key, this.options?.requestOptions));
        const { version, headers } = await createStreamFn();
        const parsedResponse = parseCreateStreamResponse(version, headers);
        const streamWriter = parsedResponse.version === "v1"
            ? new streamsWriterV1_js_1.StreamsWriterV1({
                key: this.options.key,
                runId: this.options.runId,
                source: this.options.source,
                baseUrl: this.options.baseUrl,
                headers: this.options.apiClient.getHeaders(),
                signal: this.options.signal,
                version,
                target: "self",
            })
            : new streamsWriterV2_js_1.StreamsWriterV2({
                basin: parsedResponse.basin,
                stream: parsedResponse.streamName ?? this.options.key,
                accessToken: parsedResponse.accessToken,
                endpoint: parsedResponse.endpoint,
                source: this.options.source,
                signal: this.options.signal,
                debug: this.options.debug,
                flushIntervalMs: parsedResponse.flushIntervalMs,
                maxRetries: parsedResponse.maxRetries,
            });
        return streamWriter;
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
exports.StreamInstance = StreamInstance;
function parseCreateStreamResponse(version, headers) {
    if (version === "v1") {
        return { version: "v1" };
    }
    const accessToken = headers?.["x-s2-access-token"];
    const basin = headers?.["x-s2-basin"];
    if (!accessToken || !basin) {
        return { version: "v1" };
    }
    const endpoint = headers?.["x-s2-endpoint"];
    const flushIntervalMs = headers?.["x-s2-flush-interval-ms"];
    const maxRetries = headers?.["x-s2-max-retries"];
    const streamName = headers?.["x-s2-stream-name"];
    return {
        version: "v2",
        accessToken,
        basin,
        endpoint,
        flushIntervalMs: flushIntervalMs ? parseInt(flushIntervalMs) : undefined,
        maxRetries: maxRetries ? parseInt(maxRetries) : undefined,
        streamName,
    };
}
//# sourceMappingURL=streamInstance.js.map