/** The warm window uses compute; it must not be presented as a waitpoint. */
export declare function traceSessionIdle<T>(sessionId: string, idleTimeoutInSeconds: number, read: () => Promise<T>): Promise<T>;
/** Attach the waitpoint before starting the wait, including for partial spans. */
export declare function traceSessionWait<T extends {
    ok: boolean;
    error?: Error;
}>(sessionId: string, waitpointId: string, wait: () => Promise<T>): Promise<T>;
