/**
 * Returns whether a key has the additional environment API key format.
 *
 * This is only a routing hint. It must never be used as a security boundary;
 * servers authenticate additional keys by resolving their stored hash.
 */
export declare function isAdditionalApiKey(key: string): boolean;
