/**
 * Percent-encode a task id for use as a single URL path segment. `encodeURIComponent` throws a
 * `URIError` for a string that cannot be represented in a URL (an unpaired UTF-16 surrogate);
 * rethrow it as a clear, actionable error naming the id instead of a cryptic "URI malformed".
 */
export declare function encodeTaskIdForPath(taskId: string): string;
