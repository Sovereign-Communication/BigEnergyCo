import { z } from "zod/v4";
export declare const ExceptionEventProperties: z.ZodObject<{
    type: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    stacktrace: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExceptionEventProperties = z.infer<typeof ExceptionEventProperties>;
export declare const ExceptionSpanEvent: z.ZodObject<{
    name: z.ZodLiteral<"exception">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ExceptionSpanEvent = z.infer<typeof ExceptionSpanEvent>;
export declare const CancellationSpanEvent: z.ZodObject<{
    name: z.ZodLiteral<"cancellation">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type CancellationSpanEvent = z.infer<typeof CancellationSpanEvent>;
export declare const AttemptFailedSpanEvent: z.ZodObject<{
    name: z.ZodLiteral<"attempt_failed">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        attemptNumber: z.ZodNumber;
        runId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type AttemptFailedSpanEvent = z.infer<typeof AttemptFailedSpanEvent>;
export declare const OtherSpanEvent: z.ZodObject<{
    name: z.ZodString;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export type OtherSpanEvent = z.infer<typeof OtherSpanEvent>;
export declare const SpanEvent: z.ZodUnion<readonly [z.ZodObject<{
    name: z.ZodLiteral<"exception">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodLiteral<"cancellation">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodLiteral<"attempt_failed">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        attemptNumber: z.ZodNumber;
        runId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>]>;
export type SpanEvent = z.infer<typeof SpanEvent>;
export declare const SpanEvents: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
    name: z.ZodLiteral<"exception">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodLiteral<"cancellation">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        reason: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodLiteral<"attempt_failed">;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodObject<{
        exception: z.ZodObject<{
            type: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
            stacktrace: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        attemptNumber: z.ZodNumber;
        runId: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    time: z.ZodCoercedDate<unknown>;
    properties: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>]>>;
export type SpanEvents = z.infer<typeof SpanEvents>;
export declare function isExceptionSpanEvent(event: SpanEvent): event is ExceptionSpanEvent;
export declare function isCancellationSpanEvent(event: SpanEvent): event is CancellationSpanEvent;
export declare function isAttemptFailedSpanEvent(event: SpanEvent): event is AttemptFailedSpanEvent;
export declare const SpanMessagingEvent: z.ZodObject<{
    system: z.ZodOptional<z.ZodString>;
    client_id: z.ZodOptional<z.ZodString>;
    operation: z.ZodEnum<{
        create: "create";
        deliver: "deliver";
        publish: "publish";
        receive: "receive";
    }>;
    message: z.ZodAny;
    destination: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SpanMessagingEvent = z.infer<typeof SpanMessagingEvent>;
