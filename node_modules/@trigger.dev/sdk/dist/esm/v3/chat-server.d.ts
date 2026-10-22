/**
 * Server-side helpers for the `chat.agent` head-start flow — a
 * customer's warm process (Next.js route handler, Express, etc.)
 * gets the conversation moving while the heavy chat.agent run boots
 * in parallel. Mid-turn, ownership of the durable stream hands over
 * to the agent.
 *
 * The `chat.headStart({ agentId, run })` entry point returns a
 * Next.js-style POST handler. Inside the customer's `run` callback
 * they call `streamText` themselves, spreading
 * `chat.toStreamTextOptions({ tools })` to inherit handover wiring.
 * The handler runs `streamText` step 1 in the customer's process
 * while the chat.agent run boots in parallel; on `tool-calls` the
 * agent run picks up tool execution and continues, on pure-text the
 * agent run exits clean without an LLM call.
 *
 * Two-layer naming: customer-facing surface is "head start"
 * (describes the *benefit* — fast first-turn TTFC). The internal
 * protocol still uses "handover" (describes the *mechanism* — the
 * conversation hands off mid-turn from the warm process to the
 * agent). Customers see `chat.headStart`, `HeadStartSession`, etc.
 * The wire format and run-loop locals stay on `handover` /
 * `handover-prepare` / `handover-skip`.
 *
 * Cooperative ordering only — handler stops writing to `session.out`
 * before sending the `handover` chunk on `session.in`. No S2 fencing.
 *
 * ⚠️ HARD CONSTRAINT — bundle isolation
 *
 * This module is the customer-facing boundary for the route handler.
 * The whole TTFC win comes from the customer's process being
 * lightweight while the heavy agent run boots in parallel. **The
 * route-handler bundle must not include heavy tool execute deps**:
 * E2B, puppeteer/playwright, native bindings, the trigger SDK
 * runtime, turndown, image processing libs, anything that pulls
 * weight or pulls `node:` builtins.
 *
 * "Schema-only" tools must live in a module that imports only `ai`
 * (for `tool()`) and `zod`. The agent task module imports those
 * schemas and adds execute fns elsewhere — that's where the heavy
 * deps live, and it's never reached by the route handler bundle.
 *
 * Runtime "strip executes" helpers (anything that takes a tool
 * catalog with executes and removes them) DO NOT solve this. The
 * import chain is resolved at bundle/build time, so importing the
 * full catalog drags every dep in regardless of what the SDK does
 * with the value at runtime.
 *
 * IMPORTANT (internal): this module must NOT import from `./ai.ts`.
 * `ai.ts` statically imports `agentSkillsRuntime` (which uses `node:`
 * builtins unfit for some serverless runtimes) and the heavy task
 * runtime. Allowed imports: `./ai-shared.js`, `./chat-client.js`,
 * `@trigger.dev/core/v3` (api client), `ai` (types + lightweight
 * helpers like `stepCountIs` / `convertToModelMessages`).
 */
import { type ApiClientConfiguration } from "@trigger.dev/core/v3";
import type { streamText as aiStreamTextSignature, FinishReason, ModelMessage, Tool, UIMessage, UIMessageChunk } from "ai";
import type { SessionTriggerConfigInput } from "./sessions.js";
type AnyStreamTextResult = {
    readonly finishReason: PromiseLike<FinishReason>;
    readonly response: PromiseLike<{
        messages: ModelMessage[];
    }>;
    toUIMessageStream: (...args: any[]) => any;
    toUIMessageStreamResponse: (...args: any[]) => Response;
};
/**
 * The options `toStreamTextOptions()` hands back to spread into `streamText`.
 * Typed concretely (rather than `Record<string, unknown>`) so the `messages`
 * AI SDK 7 requires is statically present, and so `streamText` infers its tools
 * from the call (rather than collapsing to `never` off a loose spread).
 *
 * `tools` and `stopWhen` are deliberately omitted: they're wired in at runtime,
 * but `streamText` reads them from the runtime value, and leaving them off the
 * type keeps it version-agnostic and avoids constraining the tool inference.
 */
export type HeadStartStreamTextOptions = {
    messages: ModelMessage[];
    abortSignal: AbortSignal;
};
/**
 * The AI SDK's own `streamText` signature, borrowed rather than restated, so it
 * resolves to whichever of `ai` v5/v6/v7 the caller installed.
 */
type AiStreamTextFn = typeof aiStreamTextSignature;
/**
 * The same signature minus the options the handover owns.
 *
 * Borrowed and narrowed rather than restated: `Omit` removes exactly the four
 * keys `buildStreamTextOptions` supplies, so passing one is a compile error
 * before it is a runtime throw. Taking `typeof streamText` unchanged would be
 * worse than useless here, since it *requires* `messages` — the one key the
 * caller must not set.
 */
type HeadStartStreamTextFn = (options: Omit<Parameters<AiStreamTextFn>[0], "messages" | "prompt" | "stopWhen" | "abortSignal">) => ReturnType<AiStreamTextFn>;
export type HeadStartRunArgs<TTools extends Record<string, Tool>> = {
    /** User messages parsed from the incoming request. */
    messages: UIMessage[];
    /** Aborts when the request closes or the SDK times out the handover. */
    signal: AbortSignal;
    /** Helper exposing `toStreamTextOptions(...)` and a session escape hatch. */
    chat: HeadStartChatHelper<TTools>;
    /**
     * `streamText` with the options the handover protocol depends on already
     * applied: the converted `messages`, `stopWhen: stepCountIs(1)` and the
     * combined `abortSignal`, plus the `tools` you pass to it.
     *
     * Prefer it over importing `streamText` from `ai`. Spreading
     * `chat.toStreamTextOptions()` into the imported one is equivalent, but
     * setting `messages`, `prompt`, `stopWhen` or `abortSignal` after the spread
     * breaks the handover, and nothing catches that. Passing any of those four
     * here is a type error, and a throw if you get past the types. `tools` is
     * yours to supply.
     */
    streamText: HeadStartStreamTextFn;
};
export type HeadStartChatHelper<TTools extends Record<string, Tool>> = {
    /**
     * Spread into the customer's `streamText` call to inherit handover
     * wiring. Returns options for:
     *
     * - `messages` — converted from the wire payload's UIMessages
     * - `tools` — the customer's tool set (typically schema-only — see
     *   the bundle-isolation note in this module's header)
     * - `abortSignal` — combined request-lifecycle + idle timeout
     * - `stopWhen` — `stepCountIs(1)`. Step 1 only. The agent run picks
     *   up tool execution and step 2+ after the handover signal.
     *
     * Customer adds `model`, `system`, `providerOptions`, etc. on top.
     * The customer keeps full control of the `streamText` call shape;
     * this helper just hands back the options the SDK needs to own.
     *
     * The customer COULD override any of these by re-setting them after
     * the spread, but doing so for `stopWhen` / `messages` / `prompt` /
     * `abortSignal` will break the handover protocol. The intent is
     * that customers spread first, then add only their own keys.
     */
    toStreamTextOptions(opts?: {
        tools?: TTools;
    }): HeadStartStreamTextOptions;
    /** Lower-level escape hatch with manual `out` / `in` / dispatch primitives. */
    session: HeadStartSession;
};
export type HeadStartSession = {
    readonly chatId: string;
    /**
     * The agent run is parked waiting for a deployment carrying the session's external deployment
     * id. Step 1 still streams from this process; step 2 lands once the deployment does.
     */
    readonly pendingVersion: boolean;
    /**
     * Tees a UIMessage stream into `session.out` for durability/resume,
     * fire-and-forget. Returns a passthrough that the caller can use as
     * the HTTP response body.
     */
    tee(stream: ReadableStream<UIMessageChunk>): ReadableStream<UIMessageChunk>;
    /**
     * Awaits `result.finishReason` and dispatches `handover` (with the
     * partial assistant ModelMessages) or `handover-skip`.
     */
    handoverWhenDone(result: AnyStreamTextResult): Promise<void>;
    /**
     * Sugar over `tee` + `handoverWhenDone` + standard SSE response.
     * Returns a `Response` with `Content-Type: text/event-stream` whose
     * body is the teed stream.
     */
    handoverResponse(result: AnyStreamTextResult): Response;
    /**
     * Manually dispatch the `handover` signal on `session.in`.
     *
     * - `isFinal: true` — the partial assistant message IS the response.
     *   The agent runs `onChatStart` / `onTurnStart` / `onTurnComplete`
     *   against it but skips the LLM call. Use for pure-text replies.
     * - `isFinal: false` — the partial assistant message ends with
     *   pending tool calls. The agent executes them and then runs a
     *   step-2 LLM call to produce the final response.
     *
     * `messageId` lets the caller carry a stable assistant message id
     * across the handover boundary so the browser merges step 1 and
     * step 2 into the same `UIMessage`.
     */
    handover(args: {
        partialAssistantMessage: ModelMessage[];
        isFinal: boolean;
        messageId?: string;
    }): Promise<void>;
    /** Manually dispatch the `handover-skip` signal on `session.in`. */
    handoverSkip(): Promise<void>;
};
export type HeadStartHandlerOptions<TTools extends Record<string, Tool>> = {
    /** The `chat.agent({ id })` of the agent we're handing off to. */
    agentId: string;
    /**
     * Customer's first-turn implementation. Receives `messages`,
     * `signal`, and a `chat` helper. Should call `streamText` with
     * `...chat.toStreamTextOptions({ tools })` and return the
     * `StreamTextResult`.
     */
    run: (args: HeadStartRunArgs<TTools>) => Promise<AnyStreamTextResult>;
    /**
     * Seconds the agent run waits for the handover signal before
     * exiting. Defaults to 60.
     */
    idleTimeoutInSeconds?: number;
    /**
     * Run options for the auto-triggered `handover-prepare` session run —
     * tags, queue, machine, etc. Mirrors `chat.createStartSessionAction`.
     * The `chat:{chatId}` tag is prepended automatically when it fits within
     * the tag length limit (see `chatRunTags`).
     */
    triggerConfig?: Partial<SessionTriggerConfigInput>;
    /**
     * API client config (base URL + access token) for creating the session
     * and triggering the agent run. When set, the handler runs under this
     * config instead of the ambient `apiClientManager` config — use it when
     * the agent lives in a different project/env than the warm server's
     * default (mirrors `chat.createStartSessionAction`'s `apiClient` option).
     * The customer's LLM provider keys are unaffected; they stay in `run`.
     */
    apiClient?: ApiClientConfiguration;
};
export type StartHeadStartOptions<TTools extends Record<string, Tool>> = {
    /** The `chat.agent` / `chat.customAgent` / `chat.createSession` id to hand off to. */
    agentId: string;
    /** Stable chat id (the session externalId). You own it; reuse it on the destination page. */
    chatId: string;
    /** First-turn user history. Becomes the agent run's `headStartMessages`. */
    messages: UIMessage[];
    /** Your first-turn implementation — same shape as `chat.headStart`'s `run`. */
    run: (args: HeadStartRunArgs<TTools>) => Promise<AnyStreamTextResult>;
    /** Seconds the agent run waits for the handover signal before exiting. Default 60. */
    idleTimeoutInSeconds?: number;
    /** Run options for the auto-triggered `handover-prepare` run (tags, queue, machine, …). */
    triggerConfig?: Partial<SessionTriggerConfigInput>;
    /** API client config for session creation + trigger when the agent lives in another project/env. */
    apiClient?: ApiClientConfiguration;
    /** Metadata merged into the run's wire payload (auth tokens, context, …). Never sent to the browser. */
    metadata?: Record<string, unknown>;
};
export type StartHeadStartResult = {
    /** The chat id you passed in — echoed for convenience. */
    chatId: string;
    /** See {@link HeadStartSession.pendingVersion}. */
    pendingVersion: boolean;
    /**
     * Resolves once step 1 has drained to `session.out` and the handover is
     * dispatched. Hand to `waitUntil` / `after` on serverless; ignore it on a
     * long-lived server. Rejects if the warm step or the dispatch fails.
     */
    completion: Promise<void>;
};
export declare const chat: {
    /**
     * Returns a Next.js-style POST handler for the chat.agent
     * head-start flow. Customer mounts it as
     * `export const { POST } = chat.headStart({...})` (or
     * `export const POST = chat.headStart({...})`).
     *
     * Pair with the browser transport's `headStart: "/api/chat"`
     * option so the first message of a brand-new chat lands here
     * before the agent run boots.
     */
    headStart<TTools extends Record<string, Tool>>(opts: HeadStartHandlerOptions<TTools>): (req: Request) => Promise<Response>;
    /**
     * Detached head start for backends that create the chat AND trigger the
     * run in their own endpoint (e.g. a "create chat" API), then navigate the
     * browser to a separate page that resumes the chat. Unlike
     * `chat.headStart`, this does NOT return an SSE `Response`: it creates the
     * session, triggers the `handover-prepare` run, then streams step 1 from
     * your warm process straight into `session.out` and dispatches the
     * handover — all as the returned `completion` promise. The destination
     * page sees the whole turn (step 1 + the agent's step 2+) by resuming
     * `session.out`; no `headStart` transport option is needed there.
     *
     * `createSession` is awaited before this resolves, so the returned
     * `chatId` is immediately resumable. `completion` resolves once step 1 has
     * drained and the handover is dispatched — hand it to the platform's
     * "run after response" primitive (`waitUntil` / Next.js `after`) on
     * serverless, or ignore it on a long-lived server.
     *
     * @example
     * ```ts
     * const { chatId, completion } = await chat.startHeadStart({
     *   agentId: "my-chat",
     *   chatId,
     *   messages,
     *   run: async ({ chat: helper }) =>
     *     streamText({ ...helper.toStreamTextOptions({ tools }), model, system }),
     * });
     * waitUntil(completion); // serverless: keep warm until step 1 + handover finish
     * return Response.json({ chatId });
     * ```
     */
    startHeadStart<TTools extends Record<string, Tool>>(opts: StartHeadStartOptions<TTools>): Promise<StartHeadStartResult>;
    /**
     * Lower-level primitive for power users who want to call
     * `streamText` themselves outside the `run` callback shape — custom
     * transforms, non-AI-SDK code paths, or manual control over the
     * response. Same wiring `chat.headStart` builds on internally.
     */
    openSession(opts: {
        req: Request;
        agentId: string;
        idleTimeoutInSeconds?: number;
        triggerConfig?: Partial<SessionTriggerConfigInput>;
    }): Promise<HeadStartSession>;
    /**
     * Wrap a Web Fetch handler — `(req: Request) => Promise<Response>` —
     * as a Node `http` listener — `(req: IncomingMessage, res: ServerResponse) => Promise<void>`.
     *
     * Use this to mount `chat.headStart` (or any other Web Fetch
     * handler) inside Node-only frameworks like Express, Fastify, Koa,
     * or raw `node:http`. Web-native frameworks (Next.js App Router,
     * Hono, SvelteKit, Remix, Workers, Bun, Deno, etc.) don't need
     * this — they pass `Request` objects directly.
     *
     * Streams the response body chunk-by-chunk to the Node response,
     * so the `chat.headStart` SSE chunks reach the browser as they
     * arrive (no buffering). Aborts the underlying handler if the
     * client closes the connection.
     *
     * Type-only import of `node:http` types — no runtime dep on `node:http`,
     * so this stays safe to bundle into edge / Workers builds (the
     * function just won't be called there).
     *
     * @example
     * ```ts
     * import express from "express";
     * import { chat } from "@trigger.dev/sdk/chat-server";
     *
     * const handler = chat.headStart({
     *   agentId: "my-chat",
     *   run: async ({ chat: helper }) => streamText({ ... }),
     * });
     *
     * const app = express();
     * app.post("/api/chat", chat.toNodeListener(handler));
     * ```
     */
    toNodeListener: typeof toNodeListener;
};
export {};
