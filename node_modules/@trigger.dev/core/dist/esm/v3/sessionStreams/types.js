import { InputStreamOncePromise, InputStreamTimeoutError } from "../inputStreams/types.js";
/**
 * Re-export the run-scoped input stream once-promise machinery so callers
 * depending on sessionStreams don't also need to import from inputStreams.
 * Both APIs return the same shape.
 */
export { InputStreamOncePromise, InputStreamTimeoutError };
//# sourceMappingURL=types.js.map