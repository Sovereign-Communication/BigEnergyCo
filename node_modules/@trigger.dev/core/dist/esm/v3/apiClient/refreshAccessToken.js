const pendingRefreshes = new WeakMap();
/**
 * Call `refreshAccessToken`, deduping concurrent calls to the same function.
 * Several subscriptions (or several React hooks sharing one refresher) can hit
 * an expired token at once; they reuse the in-flight mint instead of firing one
 * per caller. Keyed on the refresher itself so callers only share a mint when
 * they share a token owner.
 */
export function refreshAccessTokenOnce(refreshAccessToken) {
    const pending = pendingRefreshes.get(refreshAccessToken);
    if (pending)
        return pending;
    const promise = refreshAccessToken().finally(() => {
        pendingRefreshes.delete(refreshAccessToken);
    });
    pendingRefreshes.set(refreshAccessToken, promise);
    return promise;
}
//# sourceMappingURL=refreshAccessToken.js.map