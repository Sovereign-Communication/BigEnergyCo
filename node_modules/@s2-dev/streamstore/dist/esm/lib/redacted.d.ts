export interface Redacted<out A = string> {
}
export declare namespace Redacted {
    type Value<T extends Redacted<any>> = [T] extends [Redacted<infer _A>] ? _A : never;
}
export declare const make: <T>(value: T) => Redacted<T>;
export declare const value: <T>(self: Redacted<T>) => T;
export declare const unsafeWipe: <T>(self: Redacted<T>) => boolean;
//# sourceMappingURL=redacted.d.ts.map