export declare function stripAnsi(input: string): string;
export type TelnetLogServerOptions = {
    /** TCP port to listen on. */
    port: number;
    /** Defaults to 127.0.0.1 — never bind a public interface for an unauthenticated stream. */
    host?: string;
    /** Short label used in startup/error messages, e.g. "webapp". */
    name: string;
    /** Optional one-line greeting written to each client on connect. */
    banner?: string;
};
/**
 * A tiny write-only TCP server that fans out log lines to every connected client.
 * Robust by design: a bind failure or a slow client never crashes the host process.
 */
export declare class TelnetLogServer {
    #private;
    readonly name: string;
    readonly port: number;
    readonly host: string;
    constructor(options: TelnetLogServerOptions);
    /** Begin listening. Returns `this`. Bind failures are swallowed (logged, not thrown). */
    start(): this;
    /** Write one line to every healthy client. Lagging clients (over the buffer cap) are skipped. */
    broadcast(line: string): void;
    close(): void;
}
export declare function startTelnetLogServer(options: TelnetLogServerOptions): TelnetLogServer;
/**
 * Format a structured log object (from either `Logger` or `SimpleStructuredLogger`) into a
 * single plain-text line. Normalizes the two shapes (`level`/`$level`, `name`/`$name`).
 */
export declare function formatLogLine(log: Record<string, unknown>): string;
/**
 * Given a single console line, pretty-format it if it's a JSON structured log (as emitted by
 * `Logger`/`SimpleStructuredLogger`, including bundled copies in plugins). Otherwise returns it
 * unchanged. Lets a console tap surface structured logs as readable lines while passing plain
 * `console.log` output through verbatim.
 */
export declare function formatConsoleLine(line: string): string;
/**
 * Mirror `console.*` output to a telnet server. Use this (rather than the `Logger.onLog` sink)
 * when you need to capture EVERYTHING on stdout — including logs from a separate/bundled copy of
 * the logger (e.g. a plugin), which the static `onLog` hook can't see. With `pretty` (default),
 * JSON structured-log lines are reformatted via `formatConsoleLine`; other output passes through.
 * Returns a restore function.
 */
export declare function patchConsoleToTelnet(server: TelnetLogServer, options?: {
    pretty?: boolean;
}): () => void;
