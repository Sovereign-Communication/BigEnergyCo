export type RefreshAccessTokenFn = () => Promise<string>;
/**
 * Call `refreshAccessToken`, deduping concurrent calls to the same function.
 * Several subscriptions (or several React hooks sharing one refresher) can hit
 * an expired token at once; they reuse the in-flight mint instead of firing one
 * per caller. Keyed on the refresher itself so callers only share a mint when
 * they share a token owner.
 */
export declare function refreshAccessTokenOnce(refreshAccessToken: RefreshAccessTokenFn): Promise<string>;
