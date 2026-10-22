import { z } from "zod/v4";
export declare const stringPatternMatchers: readonly [z.ZodObject<{
    $endsWith: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    $startsWith: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    $ignoreCaseEquals: z.ZodString;
}, z.core.$strip>];
declare const EventMatcherSchema: z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodBoolean>, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
    $endsWith: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    $startsWith: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    $ignoreCaseEquals: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    $exists: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    $isNull: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    $anythingBut: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
}, z.core.$strip>, z.ZodObject<{
    $anythingBut: z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodArray<z.ZodNumber>, z.ZodArray<z.ZodBoolean>]>;
}, z.core.$strip>, z.ZodObject<{
    $gt: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    $lt: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    $gte: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    $lte: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    $between: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
}, z.core.$strip>, z.ZodObject<{
    $includes: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
}, z.core.$strip>, z.ZodObject<{
    $not: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>;
}, z.core.$strip>]>>]>;
type EventMatcher = z.infer<typeof EventMatcherSchema>;
/** A filter for matching against data */
export type EventFilter = {
    [key: string]: EventMatcher | EventFilter;
};
export declare const EventFilterSchema: z.ZodType<EventFilter>;
export declare const EventRuleSchema: z.ZodObject<{
    event: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>;
    source: z.ZodString;
    payload: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
    context: z.ZodOptional<z.ZodType<EventFilter, unknown, z.core.$ZodTypeInternals<EventFilter, unknown>>>;
}, z.core.$strip>;
export type EventRule = z.infer<typeof EventRuleSchema>;
export {};
