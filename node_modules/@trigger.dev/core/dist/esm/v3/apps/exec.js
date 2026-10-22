import { SimpleStructuredLogger } from "../utils/structuredLogger.js";
import { x } from "tinyexec";
export class ExecResult {
    pid;
    exitCode;
    aborted;
    killed;
    constructor(result) {
        this.pid = result.pid;
        this.exitCode = result.exitCode;
        this.aborted = result.aborted;
        this.killed = result.killed;
    }
}
// Long-form flags whose value carries a credential - the following arg (or inline
// `--flag=value`) is replaced before args are logged so it never reaches log sinks.
const REDACTED_FLAGS = new Set([
    "--password",
    "--token",
    "--secret",
    "--access-token",
    "--registry-token",
    "--registry-password",
    "--api-key",
]);
export function redactArgsForLogging(args) {
    if (!args) {
        return args;
    }
    return args.map((arg, index) => {
        const previous = index > 0 ? args[index - 1]?.trim() : undefined;
        if (previous && REDACTED_FLAGS.has(previous)) {
            return "[redacted]";
        }
        const equalsIndex = arg.indexOf("=");
        if (equalsIndex > 0 && REDACTED_FLAGS.has(arg.slice(0, equalsIndex).trim())) {
            return `${arg.slice(0, equalsIndex)}=[redacted]`;
        }
        return arg;
    });
}
export class Exec {
    logger;
    abortSignal;
    logOutput;
    trimArgs;
    neverThrow;
    constructor(opts) {
        this.logger = opts.logger ?? new SimpleStructuredLogger("exec");
        this.abortSignal = opts.abortSignal;
        this.logOutput = opts.logOutput ?? true;
        this.trimArgs = opts.trimArgs ?? true;
        this.neverThrow = opts.neverThrow ?? false;
    }
    async x(command, args, opts) {
        const argsTrimmed = this.trimArgs ? args?.map((arg) => arg.trim()) : args;
        const argsForLogging = redactArgsForLogging(args);
        const argsTrimmedForLogging = redactArgsForLogging(argsTrimmed);
        const commandWithFirstArg = `${command}${argsTrimmedForLogging?.length ? ` ${argsTrimmedForLogging[0]}` : ""}`;
        this.logger.debug(`exec: ${commandWithFirstArg}`, {
            command,
            args: argsForLogging,
            argsTrimmed: argsTrimmedForLogging,
        });
        const result = x(command, argsTrimmed, {
            signal: opts?.ignoreAbort ? undefined : this.abortSignal,
            // We don't use this as it doesn't cover killed and aborted processes
            // throwOnError: true,
        });
        const output = await result;
        const metadata = {
            command,
            argsRaw: argsForLogging,
            argsTrimmed: argsTrimmedForLogging,
            globalOpts: {
                trimArgs: this.trimArgs,
                neverThrow: this.neverThrow,
                hasAbortSignal: !!this.abortSignal,
            },
            localOpts: opts,
            stdout: output.stdout,
            stderr: output.stderr,
            pid: result.pid,
            exitCode: result.exitCode,
            aborted: result.aborted,
            killed: result.killed,
        };
        if (this.logOutput) {
            this.logger.debug(`output: ${commandWithFirstArg}`, metadata);
        }
        if (this.neverThrow || opts?.neverThrow) {
            return output;
        }
        if (result.aborted) {
            this.logger.error(`aborted: ${commandWithFirstArg}`, metadata);
            throw new ExecResult(result);
        }
        if (result.killed) {
            this.logger.error(`killed: ${commandWithFirstArg}`, metadata);
            throw new ExecResult(result);
        }
        if (result.exitCode !== 0) {
            this.logger.error(`non-zero exit: ${commandWithFirstArg}`, metadata);
            throw new ExecResult(result);
        }
        return output;
    }
    static Result = ExecResult;
}
//# sourceMappingURL=exec.js.map