var _a;
import { redact } from "../../logger.js";
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["log"] = 0] = "log";
    LogLevel[LogLevel["error"] = 1] = "error";
    LogLevel[LogLevel["warn"] = 2] = "warn";
    LogLevel[LogLevel["info"] = 3] = "info";
    LogLevel[LogLevel["debug"] = 4] = "debug";
    LogLevel[LogLevel["verbose"] = 5] = "verbose";
})(LogLevel || (LogLevel = {}));
export class SimpleStructuredLogger {
    name;
    level;
    fields;
    // Optional static sink called with the fully-structured log for every emitted line.
    // Used (e.g.) to fan logs out to a dev-only telnet stream. Must not re-enter the logger.
    static onLog;
    prettyPrint = ["1", "true"].includes(process.env.PRETTY_LOGS ?? "");
    constructor(name, level = ["1", "true"].includes(process.env.VERBOSE ?? "")
        ? LogLevel.verbose
        : ["1", "true"].includes(process.env.DEBUG ?? "")
            ? LogLevel.debug
            : LogLevel.info, fields) {
        this.name = name;
        this.level = level;
        this.fields = fields;
    }
    child(fields, level) {
        return new _a(this.name, level, { ...this.fields, ...fields });
    }
    log(message, ...args) {
        if (this.level < LogLevel.log)
            return;
        this.#structuredLog(console.log, message, "log", ...args);
    }
    error(message, ...args) {
        if (this.level < LogLevel.error)
            return;
        this.#structuredLog(console.error, message, "error", ...args);
    }
    warn(message, ...args) {
        if (this.level < LogLevel.warn)
            return;
        this.#structuredLog(console.warn, message, "warn", ...args);
    }
    info(message, ...args) {
        if (this.level < LogLevel.info)
            return;
        this.#structuredLog(console.info, message, "info", ...args);
    }
    debug(message, ...args) {
        if (this.level < LogLevel.debug)
            return;
        this.#structuredLog(console.debug, message, "debug", ...args);
    }
    verbose(message, ...args) {
        if (this.level < LogLevel.verbose)
            return;
        this.#structuredLog(console.debug, message, "verbose", ...args);
    }
    addFields(fields) {
        this.fields = {
            ...this.fields,
            ...fields,
        };
    }
    #structuredLog(loggerFunction, message, level, ...args) {
        const structuredLog = redact({
            timestamp: new Date(),
            message,
            $name: this.name,
            $level: level,
            ...this.fields,
            ...(args.length === 1 ? args[0] : args),
        });
        if (_a.onLog) {
            try {
                _a.onLog(structuredLog);
            }
            catch {
                // A sink must never break logging — and must never re-enter the logger.
            }
        }
        if (this.prettyPrint) {
            loggerFunction(JSON.stringify(structuredLog, null, 2));
        }
        else {
            loggerFunction(JSON.stringify(structuredLog));
        }
    }
}
_a = SimpleStructuredLogger;
//# sourceMappingURL=structuredLogger.js.map