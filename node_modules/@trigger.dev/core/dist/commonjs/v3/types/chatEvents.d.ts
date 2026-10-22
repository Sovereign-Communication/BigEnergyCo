import type { WebhookSecretProvisioning, WebhookVerifierArtifact } from "../schemas/webhookConfig.js";
export type WebhookKeyScalar = string | number | boolean | bigint;
export interface WebhookKeyMeta {
    externalRef: string;
    tenantId: string;
    id: string;
    source: string;
    deliveryId: string;
}
declare const invalidBrand: unique symbol;
type Invalid = {
    readonly [invalidBrand]: true;
};
type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}` ? Head extends keyof T ? PathValue<NonNullable<T[Head]>, Rest> : Invalid : P extends keyof T ? NonNullable<T[P]> : Invalid;
export type WebhookKeyError<M extends string> = `✖ ${M}`;
type TrimSpace<S extends string> = S extends ` ${infer R}` ? TrimSpace<R> : S extends `${infer L} ` ? TrimSpace<L> : S;
type CheckKeyPathSingle<TEvent, Path extends string> = Path extends `webhook.${infer Rest}` ? PathValue<WebhookKeyMeta, Rest> extends WebhookKeyScalar ? true : WebhookKeyError<`unknown or non-scalar webhook meta path: ${Rest}`> : Path extends `header.${infer Name}` ? Name extends "" ? WebhookKeyError<`empty header name`> : true : Path extends `body.${infer Rest}` ? PathValue<TEvent, Rest> extends WebhookKeyScalar ? true : WebhookKeyError<`unknown or non-scalar event path: ${Rest}`> : PathValue<TEvent, Path> extends WebhookKeyScalar ? true : WebhookKeyError<`unknown or non-scalar event path: ${Path}`>;
type CheckKeyPath<TEvent, Path extends string> = Path extends `${infer L}||${infer R}` ? CheckKeyPathSingle<TEvent, TrimSpace<L>> extends true ? CheckKeyPath<TEvent, TrimSpace<R>> : CheckKeyPathSingle<TEvent, TrimSpace<L>> : CheckKeyPathSingle<TEvent, TrimSpace<Path>>;
type CheckKeyTemplate<TEvent, S extends string> = S extends `${infer _Pre}{${infer Path}}${infer Rest}` ? CheckKeyPath<TEvent, Path> extends true ? CheckKeyTemplate<TEvent, Rest> : CheckKeyPath<TEvent, Path> : true;
export type ValidatedWebhookKey<TEvent, S extends string> = CheckKeyTemplate<TEvent, S> extends true ? S : CheckKeyTemplate<TEvent, S>;
declare const dEvt: unique symbol;
export interface ChatEvent<TType extends string, TEvent> {
    id: string;
    type: TType;
    key: string;
    source: string;
    verifierArtifact: WebhookVerifierArtifact;
    secretProvisioning?: WebhookSecretProvisioning;
    filter?: string;
    readonly [dEvt]?: TEvent;
}
export type AnyChatEvent = ChatEvent<string, any>;
export type ChatEventAction<W> = W extends ChatEvent<infer TType, infer TEvent> ? {
    type: TType;
    event: TEvent;
    source: string;
    headers: Record<string, string>;
    deliveryId: string;
} : never;
export type ChatEventActions<TW extends readonly AnyChatEvent[]> = ChatEventAction<TW[number]>;
export {};
