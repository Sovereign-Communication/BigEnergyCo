"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZodIpcConnection = void 0;
const crypto_1 = require("crypto");
const v4_1 = require("zod/v4");
const zod_js_1 = require("./utils/zod.js");
const zodMessageHandler_js_1 = require("./zodMessageHandler.js");
const messageSchema = v4_1.z.object({
    version: v4_1.z.literal("v1").default("v1"),
    type: v4_1.z.string(),
    payload: v4_1.z.unknown(),
});
class ZodIpcMessageHandler {
    #schema;
    #handlers;
    #sender;
    constructor(options) {
        this.#schema = options.schema;
        this.#handlers = options.handlers;
        this.#sender = options.sender;
    }
    async handleMessage(message) {
        const parsedMessage = this.parseMessage(message);
        if (!this.#handlers) {
            throw new Error("No handlers provided");
        }
        const handler = this.#handlers[parsedMessage.type];
        if (!handler) {
            // console.error(`No handler for message type: ${String(parsedMessage.type)}`);
            return;
        }
        // parsedMessage.payload is parsed output at runtime; zod v4 distinguishes input/output
        const ack = await handler(parsedMessage.payload, this.#sender);
        return ack;
    }
    parseMessage(message) {
        const parsedMessage = messageSchema.safeParse(message);
        if (!parsedMessage.success) {
            throw new Error(`Failed to parse message: ${JSON.stringify(parsedMessage.error)}`);
        }
        const schema = this.#schema[parsedMessage.data.type]?.["message"];
        if (!schema) {
            throw new Error(`Unknown message type: ${parsedMessage.data.type}`);
        }
        const parsedPayload = schema.safeParse(parsedMessage.data.payload);
        if (!parsedPayload.success) {
            throw new Error(`Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`);
        }
        return {
            type: parsedMessage.data.type,
            payload: parsedPayload.data,
        };
    }
}
const Packet = (0, zod_js_1.discriminatedUnion)("type", [
    v4_1.z.object({
        type: v4_1.z.literal("CONNECT"),
        sessionId: v4_1.z.string().optional(),
    }),
    v4_1.z.object({
        type: v4_1.z.literal("ACK"),
        message: v4_1.z.any(),
        id: v4_1.z.number(),
    }),
    v4_1.z.object({
        type: v4_1.z.literal("EVENT"),
        message: v4_1.z.any(),
        id: v4_1.z.number().optional(),
    }),
]);
class ZodIpcConnection {
    opts;
    #sessionId;
    #messageCounter = 0;
    #handler;
    #acks = new Map();
    constructor(opts) {
        this.opts = opts;
        this.#handler = new ZodIpcMessageHandler({
            schema: opts.listenSchema,
            handlers: opts.handlers,
            sender: {
                send: this.send.bind(this),
                sendWithAck: this.sendWithAck.bind(this),
            },
        });
        this.#registerHandlers();
        // this.connect();
    }
    async #registerHandlers() {
        if (!this.opts.process.on) {
            return;
        }
        this.opts.process.on("message", async (message) => {
            this.#handlePacket(message);
        });
    }
    async connect() {
        this.#sendPacket({ type: "CONNECT" });
    }
    async #handlePacket(packet) {
        const parsedPacket = Packet.safeParse(packet);
        if (!parsedPacket.success) {
            return;
        }
        switch (parsedPacket.data.type) {
            case "ACK": {
                // Check our list of ACKs and resolve with the message
                const ack = this.#acks.get(parsedPacket.data.id);
                if (!ack) {
                    return;
                }
                clearTimeout(ack.timeout);
                ack.resolve(parsedPacket.data.message);
                break;
            }
            case "CONNECT": {
                if (!parsedPacket.data.sessionId) {
                    // This is a client trying to connect, so we generate and send back a session ID
                    const id = (0, crypto_1.randomUUID)();
                    await this.#sendPacket({ type: "CONNECT", sessionId: id });
                    return;
                }
                // This is a server replying to our connect message
                if (this.#sessionId) {
                    // We're already connected
                    return;
                }
                this.#sessionId = parsedPacket.data.sessionId;
                break;
            }
            case "EVENT": {
                const result = await this.#handler.handleMessage(parsedPacket.data.message);
                if (typeof parsedPacket.data.id === "undefined") {
                    return;
                }
                // There's an ID so we should ACK
                await this.#sendPacket({
                    type: "ACK",
                    id: parsedPacket.data.id,
                    message: result,
                });
                break;
            }
            default: {
                break;
            }
        }
    }
    async #sendPacket(packet) {
        // When the IPC channel is closed (e.g. parent process exited), there is no
        // recipient — drop the packet rather than letting `process.send` throw
        // ERR_IPC_CHANNEL_CLOSED, which would otherwise propagate as an
        // uncaughtException and re-enter any handler that itself calls `process.send`.
        if (this.opts.process.connected === false) {
            return;
        }
        try {
            await this.opts.process.send?.(packet);
        }
        catch {
            // swallow: channel raced from open to closed between the check and the send
        }
    }
    async send(type, payload) {
        const schema = this.opts.emitSchema[type]?.["message"];
        if (!schema) {
            throw new Error(`Unknown message type: ${type}`);
        }
        const parsedPayload = schema.safeParse(payload);
        if (!parsedPayload.success) {
            throw new zodMessageHandler_js_1.ZodSchemaParsedError(parsedPayload.error, payload);
        }
        await this.#sendPacket({
            type: "EVENT",
            message: {
                type,
                payload,
                version: "v1",
            },
        });
    }
    async sendWithAck(type, payload, timeoutInMs) {
        const currentId = this.#messageCounter++;
        return new Promise((resolve, reject) => {
            const defaultTimeoutInMs = 2000;
            // Timeout if the ACK takes too long to get back to us
            const timeout = setTimeout(() => {
                reject(JSON.stringify({
                    reason: "sendWithAck() timeout",
                    timeoutInMs: timeoutInMs ?? defaultTimeoutInMs,
                    type,
                    payload,
                }));
            }, timeoutInMs ?? defaultTimeoutInMs);
            this.#acks.set(currentId, { resolve: resolve, reject, timeout });
            const schema = this.opts.emitSchema[type]?.["message"];
            if (!schema) {
                clearTimeout(timeout);
                return reject(`Unknown message type: ${type}`);
            }
            const parsedPayload = schema.safeParse(payload);
            if (!parsedPayload.success) {
                clearTimeout(timeout);
                return reject(`Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`);
            }
            this.#sendPacket({
                type: "EVENT",
                message: {
                    type,
                    payload,
                    version: "v1",
                },
                id: currentId,
            }).catch(reject);
        });
    }
}
exports.ZodIpcConnection = ZodIpcConnection;
//# sourceMappingURL=zodIpc.js.map