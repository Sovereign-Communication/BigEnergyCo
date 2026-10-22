"use strict";
/**
 * S2S HTTP/2 transport for Node.js
 * Uses the s2s binary protocol over HTTP/2 for efficient streaming
 *
 * This file should only be imported in Node.js environments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.S2STransport = void 0;
const debug_1 = require("debug");
const error_js_1 = require("../../../../error.js");
const Proto = require("../../../../generated/proto/s2.js");
const mappers_js_1 = require("../../../../internal/mappers.js");
const encryption_js_1 = require("../../../encryption.js");
const queue_js_1 = require("../../../queue.js");
const Redacted = require("../../../redacted.js");
const result_js_1 = require("../../../result.js");
const retry_js_1 = require("../../../retry.js");
const runtime_js_1 = require("../../runtime.js");
const proto_js_1 = require("../proto.js");
const compression_js_1 = require("./compression.js");
const framing_js_1 = require("./framing.js");
const pool_js_1 = require("./pool.js");
const debug = (0, debug_1.default)("s2:s2s");
const COMPRESSION_THRESHOLD_BYTES = 1024;
class S2STransport {
    transportConfig;
    compression;
    endpointOrigin;
    attached = false;
    closed = false;
    closingPromise;
    constructor(config) {
        this.transportConfig = config;
        this.compression = config.compression ?? "none";
        this.endpointOrigin = new URL(config.baseUrl).origin;
    }
    async makeAppendSession(stream, sessionOptions, requestOptions) {
        await (0, compression_js_1.assertCompressionSupported)(this.compression);
        return retry_js_1.RetryAppendSession.create((myOptions) => {
            return S2SAppendSession.create(this.transportConfig.baseUrl, this.transportConfig.accessToken, stream, (headers) => this.openH2Stream(headers), this.transportConfig.basinName, this.transportConfig.encryptionKey, this.compression, myOptions, requestOptions);
        }, sessionOptions, this.transportConfig.retry, stream);
    }
    async makeReadSession(stream, args, options) {
        await (0, compression_js_1.assertCompressionSupported)(this.compression);
        return retry_js_1.RetryReadSession.create((myArgs) => {
            return S2SReadSession.create(this.transportConfig.baseUrl, this.transportConfig.accessToken, stream, myArgs, options, (headers) => this.openH2Stream(headers), this.transportConfig.basinName, this.transportConfig.encryptionKey, this.compression);
        }, args, this.transportConfig.retry);
    }
    /** Open an HTTP/2 stream through the shared connection pool. */
    openH2Stream(headers) {
        // Retries may fire after close(); re-attaching then would leak the pool entry.
        if (this.closed) {
            throw new error_js_1.S2Error({
                message: "S2STransport is closed",
                status: 400,
                origin: "sdk",
            });
        }
        if (!this.attached) {
            pool_js_1.sharedConnectionPool.attach(this.endpointOrigin, this.transportConfig.http2);
            this.attached = true;
        }
        return pool_js_1.sharedConnectionPool.request(this.endpointOrigin, headers, {
            connectionTimeoutMillis: this.transportConfig.connectionTimeoutMillis,
            http2: this.transportConfig.http2,
        });
    }
    async close() {
        this.closed = true;
        if (this.closingPromise) {
            return this.closingPromise;
        }
        this.closingPromise = (async () => {
            if (this.attached) {
                this.attached = false;
                await pool_js_1.sharedConnectionPool.detach(this.endpointOrigin, this.transportConfig.http2);
            }
        })();
        try {
            await this.closingPromise;
        }
        finally {
            this.closingPromise = undefined;
        }
    }
}
exports.S2STransport = S2STransport;
class S2SReadSession extends ReadableStream {
    streamName;
    args;
    authToken;
    url;
    options;
    openH2Stream;
    basinName;
    encryptionKey;
    compression;
    http2Stream;
    _lastObservedTail;
    parser = new framing_js_1.S2SFrameParser();
    static async create(baseUrl, bearerToken, streamName, args, options, openH2Stream, basinName, encryptionKey, compression = "none") {
        const url = new URL(baseUrl);
        return new S2SReadSession(streamName, args, bearerToken, url, options, openH2Stream, basinName, encryptionKey, compression);
    }
    constructor(streamName, args, authToken, url, options, openH2Stream, basinName, encryptionKey, compression = "none") {
        // Initialize parser and textDecoder before super() call
        const parser = new framing_js_1.S2SFrameParser();
        const textDecoder = new TextDecoder();
        let http2Stream;
        // Track timeout for detecting when server stops sending data
        const TAIL_TIMEOUT_MS = 20000; // 20 seconds
        let timeoutTimer;
        super({
            start: async (controller) => {
                let controllerClosed = false;
                let responseCode;
                let pendingChunks;
                // Listener references for cleanup (issue #142)
                let abortHandler;
                let goawayHandler;
                let sessionConnection;
                const cleanupListeners = () => {
                    if (abortHandler && options?.signal) {
                        options.signal.removeEventListener("abort", abortHandler);
                    }
                    abortHandler = undefined;
                    if (goawayHandler && sessionConnection) {
                        sessionConnection.removeListener("goaway", goawayHandler);
                    }
                    goawayHandler = undefined;
                    sessionConnection = undefined;
                };
                const safeClose = () => {
                    if (!controllerClosed) {
                        controllerClosed = true;
                        cleanupListeners();
                        if (timeoutTimer) {
                            clearTimeout(timeoutTimer);
                            timeoutTimer = undefined;
                        }
                        try {
                            controller.close();
                        }
                        catch {
                            // Controller may already be closed, ignore
                        }
                    }
                };
                const safeError = (err) => {
                    if (!controllerClosed) {
                        controllerClosed = true;
                        cleanupListeners();
                        if (timeoutTimer) {
                            clearTimeout(timeoutTimer);
                            timeoutTimer = undefined;
                        }
                        // Convert error to S2Error and enqueue as error result
                        controller.enqueue({ ok: false, error: (0, error_js_1.s2Error)(err) });
                        controller.close();
                    }
                };
                // Helper to start/reset the timeout timer
                // Resets on every tail received, fires only if no tail for 20s
                const resetTimeoutTimer = () => {
                    if (timeoutTimer) {
                        clearTimeout(timeoutTimer);
                    }
                    timeoutTimer = setTimeout(() => {
                        const timeoutError = new error_js_1.S2Error({
                            message: `No tail received for ${TAIL_TIMEOUT_MS / 1000}s`,
                            status: 408, // Request Timeout
                            code: "TIMEOUT",
                        });
                        debug("tail timeout detected");
                        safeError(timeoutError);
                    }, TAIL_TIMEOUT_MS);
                };
                try {
                    // Start the timeout timer - will fire in 20s if no tail received
                    resetTimeoutTimer();
                    // Build query string
                    const queryParams = new URLSearchParams();
                    const { as, ...readParams } = args ?? {};
                    if (readParams.seq_num !== undefined)
                        queryParams.set("seq_num", readParams.seq_num.toString());
                    if (readParams.timestamp !== undefined)
                        queryParams.set("timestamp", readParams.timestamp.toString());
                    if (readParams.tail_offset !== undefined)
                        queryParams.set("tail_offset", readParams.tail_offset.toString());
                    if (readParams.count !== undefined)
                        queryParams.set("count", readParams.count.toString());
                    if (readParams.bytes !== undefined)
                        queryParams.set("bytes", readParams.bytes.toString());
                    if (readParams.wait !== undefined)
                        queryParams.set("wait", readParams.wait.toString());
                    if (typeof readParams.until === "number") {
                        queryParams.set("until", readParams.until.toString());
                    }
                    const queryString = queryParams.toString();
                    const path = `${url.pathname}/streams/${encodeURIComponent(streamName)}/records${queryString ? `?${queryString}` : ""}`;
                    const acceptEncoding = await (0, compression_js_1.acceptEncodingHeader)(compression);
                    const stream = await openH2Stream({
                        ":method": "GET",
                        ":path": path,
                        ":scheme": url.protocol.slice(0, -1),
                        ":authority": url.host,
                        "user-agent": runtime_js_1.DEFAULT_USER_AGENT,
                        authorization: `Bearer ${Redacted.value(authToken)}`,
                        accept: "application/protobuf",
                        "content-type": "s2s/proto",
                        ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}),
                        ...(basinName ? { "s2-basin": basinName } : {}),
                        ...(encryptionKey
                            ? {
                                [encryption_js_1.S2_ENCRYPTION_KEY_HEADER]: Redacted.value(encryptionKey),
                            }
                            : {}),
                    });
                    http2Stream = stream;
                    abortHandler = () => {
                        if (!stream.closed) {
                            stream.close();
                        }
                    };
                    options?.signal?.addEventListener("abort", abortHandler);
                    stream.on("response", (headers) => {
                        // Cache the status.
                        // This informs whether we should attempt to parse s2s frames in the "data" handler.
                        responseCode = headers[":status"] ?? 500;
                        if (pendingChunks) {
                            const buffered = pendingChunks;
                            pendingChunks = undefined;
                            for (const chunk of buffered) {
                                processChunk(chunk);
                            }
                        }
                    });
                    sessionConnection = stream.session;
                    goawayHandler = (errorCode, lastStreamID, opaqueData) => {
                        debug("received GOAWAY from server");
                    };
                    sessionConnection?.on("goaway", goawayHandler);
                    stream.on("error", (err) => {
                        safeError(err);
                    });
                    const processChunk = (chunk) => {
                        try {
                            const status = responseCode ?? 500;
                            if (status >= 400) {
                                const errorText = textDecoder.decode(chunk);
                                debug("error response: status=%d body=%s", status, errorText);
                                if (status === 416) {
                                    try {
                                        const errorJson = JSON.parse(errorText);
                                        safeError(new error_js_1.RangeNotSatisfiableError({
                                            status,
                                            code: errorJson.code,
                                            tail: errorJson.tail
                                                ? (0, mappers_js_1.fromAPIStreamPosition)(errorJson.tail)
                                                : undefined,
                                        }));
                                    }
                                    catch {
                                        safeError(new error_js_1.RangeNotSatisfiableError({ status }));
                                    }
                                    return;
                                }
                                try {
                                    const errorJson = JSON.parse(errorText);
                                    safeError(new error_js_1.S2Error({
                                        message: errorJson.message ?? "Unknown error",
                                        code: errorJson.code,
                                        status,
                                        origin: "server",
                                    }));
                                }
                                catch {
                                    safeError(new error_js_1.S2Error({
                                        message: errorText || "Unknown error",
                                        status,
                                        origin: "server",
                                    }));
                                }
                                return;
                            }
                            // Buffer already extends Uint8Array in Node.js, no need to convert
                            parser.push(chunk);
                            let frame = parser.parseFrame();
                            while (frame) {
                                if (frame.terminal) {
                                    if (frame.statusCode && frame.statusCode >= 400) {
                                        const errorText = textDecoder.decode(frame.body);
                                        try {
                                            const errorJson = JSON.parse(errorText);
                                            const status = frame.statusCode ?? 500;
                                            // Map known read errors
                                            if (status === 416) {
                                                safeError(new error_js_1.RangeNotSatisfiableError({
                                                    status,
                                                    code: errorJson.code,
                                                    tail: errorJson.tail
                                                        ? (0, mappers_js_1.fromAPIStreamPosition)(errorJson.tail)
                                                        : undefined,
                                                }));
                                            }
                                            else {
                                                safeError((0, error_js_1.makeServerError)({ status, statusText: undefined }, errorJson));
                                            }
                                        }
                                        catch {
                                            safeError((0, error_js_1.makeServerError)({
                                                status: frame.statusCode ?? 500,
                                                statusText: undefined,
                                            }, errorText));
                                        }
                                    }
                                    else {
                                        safeClose();
                                    }
                                    stream.close();
                                }
                                else {
                                    try {
                                        const batchBytes = frame.compression === "none"
                                            ? frame.body
                                            : (0, compression_js_1.decompressFrameBody)(frame.body, frame.compression);
                                        const protoBatch = Proto.ReadBatch.fromBinary(batchBytes);
                                        resetTimeoutTimer();
                                        let tail;
                                        if (protoBatch.tail) {
                                            tail = convertStreamPosition(protoBatch.tail);
                                            this._lastObservedTail = tail;
                                            debug("received tail");
                                        }
                                        const records = protoBatch.records.map((record) => {
                                            const converted = this.convertRecord(record, as ?? "string", textDecoder);
                                            return converted;
                                        });
                                        controller.enqueue({
                                            ok: true,
                                            batch: { records, ...(tail ? { tail } : {}) },
                                        });
                                    }
                                    catch (err) {
                                        safeError(new error_js_1.S2Error({
                                            message: `Failed to parse ReadBatch: ${err}`,
                                            status: 500,
                                            origin: "sdk",
                                        }));
                                    }
                                }
                                frame = parser.parseFrame();
                            }
                        }
                        catch (error) {
                            safeError(error instanceof error_js_1.S2Error
                                ? error
                                : new error_js_1.S2Error({
                                    message: `Failed to process read data: ${error}`,
                                    status: 500,
                                    origin: "sdk",
                                }));
                        }
                    };
                    stream.on("data", (chunk) => {
                        // Deno >= 2.7.5 emits "data" before "response";
                        // buffer until the status is known so an error body isn't parsed as acks.
                        if (responseCode === undefined) {
                            (pendingChunks ??= []).push(chunk);
                            return;
                        }
                        processChunk(chunk);
                    });
                    stream.on("end", () => {
                        if (stream.rstCode != 0) {
                            debug("stream reset code=%d", stream.rstCode);
                            safeError(new error_js_1.S2Error({
                                message: `Stream ended with error: ${stream.rstCode}`,
                                status: 500,
                                code: "stream reset",
                                origin: "sdk",
                            }));
                        }
                    });
                    stream.on("close", () => {
                        if (pendingChunks || parser.hasData()) {
                            safeError(new error_js_1.S2Error({
                                message: "Stream closed with unparsed data remaining",
                                status: 500,
                                code: "STREAM_CLOSED_PREMATURELY",
                                origin: "sdk",
                            }));
                        }
                        else {
                            safeClose();
                        }
                    });
                }
                catch (err) {
                    safeError(err);
                }
            },
            cancel: async () => {
                if (http2Stream && !http2Stream.closed) {
                    http2Stream.close();
                }
            },
        });
        this.streamName = streamName;
        this.args = args;
        this.authToken = authToken;
        this.url = url;
        this.options = options;
        this.openH2Stream = openH2Stream;
        this.basinName = basinName;
        this.encryptionKey = encryptionKey;
        this.compression = compression;
        // Assign parser to instance property after super() completes
        this.parser = parser;
        this.http2Stream = http2Stream;
    }
    /**
     * Convert a protobuf SequencedRecord to the requested format
     */
    convertRecord(record, format, textDecoder) {
        return (0, proto_js_1.convertProtoRecord)(record, format, textDecoder);
    }
    async [Symbol.asyncDispose]() {
        await this.cancel("disposed");
    }
    // Polyfill for older browsers / Node.js environments
    [Symbol.asyncIterator]() {
        const proto = ReadableStream.prototype;
        const fn = proto[Symbol.asyncIterator];
        if (typeof fn === "function") {
            try {
                return fn.call(this);
            }
            catch {
                // Native method may throw "Illegal invocation" when called on subclass
                // Fall through to manual implementation
            }
        }
        const reader = this.getReader();
        return {
            next: async () => {
                const r = await reader.read();
                if (r.done) {
                    reader.releaseLock();
                    return { done: true, value: undefined };
                }
                return { done: false, value: r.value };
            },
            throw: async (e) => {
                try {
                    await reader.cancel(e);
                }
                catch (err) {
                    if (err?.code !== "ERR_INVALID_STATE")
                        throw err;
                }
                reader.releaseLock();
                return { done: true, value: undefined };
            },
            return: async () => {
                try {
                    await reader.cancel("done");
                }
                catch (err) {
                    if (err?.code !== "ERR_INVALID_STATE")
                        throw err;
                }
                reader.releaseLock();
                return { done: true, value: undefined };
            },
            [Symbol.asyncIterator]() {
                return this;
            },
        };
    }
    lastObservedTail() {
        return this._lastObservedTail;
    }
}
/**
 * AcksStream for S2S append session
 */
// Removed S2SAcksStream - transport sessions no longer expose streams
/**
 * S2S-based transport session for appending records via HTTP/2.
 * Pipelined: multiple requests can be in-flight simultaneously.
 * No backpressure, no retry logic, no streams - just submit/close with value-encoded errors.
 */
class S2SAppendSession {
    baseUrl;
    authToken;
    streamName;
    openH2Stream;
    basinName;
    encryptionKey;
    compression;
    options;
    http2Stream;
    parser = new framing_js_1.S2SFrameParser();
    closed = false;
    pendingAcks = new queue_js_1.FifoQueue();
    initPromise;
    _effectSignalled = false;
    abortHandler;
    static async create(baseUrl, bearerToken, streamName, openH2Stream, basinName, encryptionKey, compression, sessionOptions, requestOptions) {
        return new S2SAppendSession(baseUrl, bearerToken, streamName, openH2Stream, basinName, encryptionKey, compression, sessionOptions, requestOptions);
    }
    constructor(baseUrl, authToken, streamName, openH2Stream, basinName, encryptionKey, compression, sessionOptions, options) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
        this.streamName = streamName;
        this.openH2Stream = openH2Stream;
        this.basinName = basinName;
        this.encryptionKey = encryptionKey;
        this.compression = compression;
        this.options = options;
        // No stream setup
        // Initialization happens lazily on first submit
    }
    async initializeStream() {
        const url = new URL(this.baseUrl);
        const path = `${url.pathname}/streams/${encodeURIComponent(this.streamName)}/records`;
        const acceptEncoding = await (0, compression_js_1.acceptEncodingHeader)(this.compression);
        const stream = await this.openH2Stream({
            ":method": "POST",
            ":path": path,
            ":scheme": url.protocol.slice(0, -1),
            ":authority": url.host,
            "user-agent": runtime_js_1.DEFAULT_USER_AGENT,
            authorization: `Bearer ${Redacted.value(this.authToken)}`,
            "content-type": "s2s/proto",
            accept: "application/protobuf",
            ...(acceptEncoding ? { "accept-encoding": acceptEncoding } : {}),
            ...(this.basinName ? { "s2-basin": this.basinName } : {}),
            ...(this.encryptionKey
                ? {
                    [encryption_js_1.S2_ENCRYPTION_KEY_HEADER]: Redacted.value(this.encryptionKey),
                }
                : {}),
        });
        this.http2Stream = stream;
        // Store the handler so close() can remove it. A caller-provided signal
        // can outlive many sessions (RetryAppendSession recreates a session per
        // recovery, reusing the same signal), so an unremovable listener leaks.
        this.abortHandler = () => {
            if (!stream.closed) {
                stream.close();
            }
        };
        this.options?.signal?.addEventListener("abort", this.abortHandler);
        const textDecoder = new TextDecoder();
        let responseCode;
        let pendingChunks;
        const safeError = (error) => {
            // Resolve all pending acks with error result
            for (const pending of this.pendingAcks) {
                pending.resolve((0, result_js_1.err)((0, error_js_1.s2Error)(error)));
            }
            this.pendingAcks.clear();
            // Note: do NOT reset _effectSignalled here. Data may have been
            // written to the wire before the error occurred, so the flag
            // must stay true until the session is recreated.
        };
        // Capture HTTP response status
        stream.on("response", (headers) => {
            responseCode = headers[":status"] ?? 500;
            if (pendingChunks) {
                const buffered = pendingChunks;
                pendingChunks = undefined;
                for (const chunk of buffered) {
                    processChunk(chunk);
                }
            }
        });
        // Handle incoming data (acks or error response)
        const processChunk = (chunk) => {
            try {
                // Check for HTTP-level errors first (before s2s frame parsing)
                if ((responseCode ?? 200) >= 400) {
                    const errorText = textDecoder.decode(chunk);
                    try {
                        const errorJson = JSON.parse(errorText);
                        safeError(new error_js_1.S2Error({
                            message: errorJson.message ?? "Unknown error",
                            code: errorJson.code,
                            status: responseCode,
                            origin: "server",
                        }));
                    }
                    catch {
                        safeError(new error_js_1.S2Error({
                            message: errorText || "Unknown error",
                            status: responseCode,
                            origin: "server",
                        }));
                    }
                    return;
                }
                this.parser.push(chunk);
                let frame = this.parser.parseFrame();
                while (frame) {
                    if (frame.terminal) {
                        if (frame.statusCode && frame.statusCode >= 400) {
                            const errorText = textDecoder.decode(frame.body);
                            const status = frame.statusCode ?? 500;
                            try {
                                const errorJson = JSON.parse(errorText);
                                const err = status === 412
                                    ? (0, error_js_1.makeAppendPreconditionError)(status, errorJson)
                                    : (0, error_js_1.makeServerError)({ status, statusText: undefined }, errorJson);
                                queueMicrotask(() => safeError(err));
                            }
                            catch {
                                const err = (0, error_js_1.makeServerError)({ status, statusText: undefined }, errorText);
                                queueMicrotask(() => safeError(err));
                            }
                        }
                        stream.close();
                    }
                    else {
                        // Parse AppendAck
                        try {
                            const ackBytes = frame.compression === "none"
                                ? frame.body
                                : (0, compression_js_1.decompressFrameBody)(frame.body, frame.compression);
                            const protoAck = Proto.AppendAck.fromBinary(ackBytes);
                            const ack = convertAppendAck(protoAck);
                            // Resolve the pending ack promise (FIFO)
                            const pending = this.pendingAcks.shift();
                            if (pending) {
                                pending.resolve((0, result_js_1.ok)(ack));
                            }
                            // Reset effect signal when dormant (no pending acks)
                            if (this.pendingAcks.length === 0) {
                                this._effectSignalled = false;
                            }
                        }
                        catch (parseErr) {
                            queueMicrotask(() => safeError(new error_js_1.S2Error({
                                message: `Failed to parse AppendAck: ${parseErr}`,
                                status: 500,
                            })));
                        }
                    }
                    frame = this.parser.parseFrame();
                }
            }
            catch (error) {
                queueMicrotask(() => safeError(error));
            }
        };
        stream.on("data", (chunk) => {
            // Deno >= 2.7.5 emits "data" before "response";
            // buffer until the status is known so an error body isn't parsed as acks.
            if (responseCode === undefined) {
                (pendingChunks ??= []).push(chunk);
                return;
            }
            processChunk(chunk);
        });
        stream.on("error", (streamErr) => {
            queueMicrotask(() => safeError(streamErr));
        });
        stream.on("close", () => {
            this.removeAbortListener();
            // Stream closed - resolve any remaining pending acks with error
            // This can happen if the server closes the stream without sending all acks
            if (this.pendingAcks.length > 0) {
                queueMicrotask(() => safeError(new error_js_1.S2Error({
                    message: "Stream closed with pending acks",
                    status: 502,
                    code: "BAD_GATEWAY",
                })));
            }
        });
    }
    /**
     * Send a batch and wait for ack. Returns AppendResult (never throws).
     * Pipelined: multiple sends can be in-flight; acks resolve FIFO.
     */
    async sendBatch(input) {
        if (!this.http2Stream || this.http2Stream.closed) {
            return Promise.resolve((0, result_js_1.err)(new error_js_1.S2Error({ message: "HTTP/2 stream is not open", status: 502 })));
        }
        const protoBytes = (0, proto_js_1.encodeProtoAppendInput)(input);
        const shouldCompress = this.compression !== "none" &&
            protoBytes.byteLength >= COMPRESSION_THRESHOLD_BYTES;
        const frameCompression = shouldCompress
            ? this.compression
            : "none";
        const bodyBytes = shouldCompress
            ? await (0, compression_js_1.compressFrameBody)(protoBytes, this.compression)
            : protoBytes;
        const frame = (0, framing_js_1.frameMessage)({
            terminal: false,
            compression: frameCompression,
            body: bodyBytes,
        });
        // Track pending ack - this promise resolves when the ack is received (FIFO)
        return new Promise((resolve) => {
            this.pendingAcks.push({
                resolve,
                batchSize: input.meteredBytes,
            });
            // Send the frame (pipelined - non-blocking)
            this._effectSignalled = true;
            this.http2Stream.write(frame, (writeErr) => {
                if (writeErr) {
                    // Remove from pending acks on write error
                    this.pendingAcks.removeFirst((p) => p.resolve === resolve);
                    // Note: do NOT reset _effectSignalled here. The write call
                    // was attempted, so data may have partially entered the
                    // kernel buffer before the error was reported.
                    // Resolve with error result
                    resolve((0, result_js_1.err)((0, error_js_1.s2Error)(writeErr)));
                }
                // Write completed successfully - promise resolves later when ack is received
            });
        });
    }
    /**
     * Returns true if data may have been written to the HTTP/2 stream
     * since the last time pendingAcks was empty (dormant).
     */
    effectSignalled() {
        return this._effectSignalled;
    }
    /** Remove the abort listener from the caller-provided signal, if attached. */
    removeAbortListener() {
        if (this.abortHandler && this.options?.signal) {
            this.options.signal.removeEventListener("abort", this.abortHandler);
        }
        this.abortHandler = undefined;
    }
    /**
     * Close the append session.
     * Waits for all pending appends to complete before resolving.
     * Never throws - returns CloseResult.
     */
    async close() {
        try {
            this.closed = true;
            // Wait for any in-flight lazy initialization to finish. Otherwise a
            // concurrent initializeStream() can open and assign the HTTP/2 stream
            // after close() has already returned, orphaning it and permanently
            // holding a pool slot (activeStreams only decrements on stream close).
            // initPromise is only set by submit(), so if it's unset no stream was
            // ever opened and there is nothing to await.
            if (this.initPromise) {
                await this.initPromise.catch(() => { });
            }
            // Detach from the caller-provided signal (init has now run, so the
            // handler is registered if it ever will be).
            this.removeAbortListener();
            // Wait for all pending acks to complete
            while (this.pendingAcks.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            // Close the HTTP/2 stream (client doesn't send terminal frame for clean close)
            if (this.http2Stream && !this.http2Stream.closed) {
                this.http2Stream.end();
            }
            return (0, result_js_1.okClose)();
        }
        catch (error) {
            return (0, result_js_1.errClose)((0, error_js_1.s2Error)(error));
        }
    }
    /**
     * Submit an append request to the session.
     * Returns AppendResult (never throws).
     * Pipelined: multiple submits can be in-flight; acks resolve FIFO.
     */
    async submit(input) {
        // Validate closed state
        if (this.closed) {
            return (0, result_js_1.err)(new error_js_1.S2Error({ message: "AppendSession is closed", status: 400 }));
        }
        // Lazy initialize HTTP/2 stream on first submit
        if (!this.initPromise) {
            this.initPromise = this.initializeStream();
        }
        try {
            await this.initPromise;
        }
        catch (initErr) {
            return (0, result_js_1.err)((0, error_js_1.s2Error)(initErr));
        }
        const recordsArray = Array.from(input.records);
        // Validate batch size limits (non-retryable 400-level error)
        // Note: This should already be validated by AppendInput.create(), but we check defensively
        if (recordsArray.length > 1000) {
            return (0, result_js_1.err)(new error_js_1.S2Error({
                message: `Batch of ${recordsArray.length} exceeds maximum batch size of 1000 records`,
                status: 400,
                code: "INVALID_ARGUMENT",
            }));
        }
        if (input.meteredBytes > 1024 * 1024) {
            return (0, result_js_1.err)(new error_js_1.S2Error({
                message: `Batch size ${input.meteredBytes} bytes exceeds maximum of 1 MiB (1048576 bytes)`,
                status: 400,
                code: "INVALID_ARGUMENT",
            }));
        }
        return this.sendBatch(input);
    }
}
/**
 * Convert protobuf StreamPosition to API StreamPosition (internal use)
 */
function convertStreamPosition(proto) {
    return {
        seq_num: (0, proto_js_1.bigintToSafeNumber)(proto.seqNum, "StreamPosition.seqNum"),
        timestamp: (0, proto_js_1.bigintToSafeNumber)(proto.timestamp, "StreamPosition.timestamp"),
    };
}
/**
 * Convert API StreamPosition to SDK StreamPosition (public interface)
 */
function toSDKStreamPosition(pos) {
    return {
        seqNum: pos.seq_num,
        timestamp: new Date(pos.timestamp),
    };
}
function convertAppendAck(proto) {
    if (!proto.start || !proto.end || !proto.tail) {
        throw new Error("Invariant violation: AppendAck is missing required fields");
    }
    return {
        start: toSDKStreamPosition(convertStreamPosition(proto.start)),
        end: toSDKStreamPosition(convertStreamPosition(proto.end)),
        tail: toSDKStreamPosition(convertStreamPosition(proto.tail)),
    };
}
//# sourceMappingURL=index.js.map