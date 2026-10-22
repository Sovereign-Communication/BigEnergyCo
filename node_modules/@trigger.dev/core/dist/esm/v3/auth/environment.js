// Slim shape of an authenticated runtime environment, structural and
// independent of @trigger.dev/database. Carried across the auth boundary
// (RBAC plugin contract → host webapp) so plugins can return all the
// fields handlers consume without a follow-up DB lookup.
//
// This is hand-rolled rather than derived from `Prisma.RuntimeEnvironmentGetPayload`
// because the contract package (@trigger.dev/plugins) is published while
// @trigger.dev/database is private — and because callers of this type
// genuinely use only a fraction of the columns Prisma would expose.
//
// If a downstream consumer needs a field that's not here:
//   - Used in the auth-cross-cutting hot path → add it
//   - Used in a service that already loads the env → fetch it there instead
//
// `concurrencyLimitBurstFactor` is a `Decimal(4,2)` in Postgres — values
// are O(2.00) in practice; coerced to `number` here (lossless at this
// scale, avoids dragging in Prisma's Decimal class via type imports).
export {};
//# sourceMappingURL=environment.js.map