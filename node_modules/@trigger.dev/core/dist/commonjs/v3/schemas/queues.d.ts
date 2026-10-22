import { z } from "zod/v4";
/**
 * The type of queue, either "task" or "custom"
 * "task" are created automatically for each task.
 * "custom" are created by you explicitly in your code.
 * */
export declare const QueueType: z.ZodEnum<{
    custom: "custom";
    task: "task";
}>;
export type QueueType = z.infer<typeof QueueType>;
export declare const RetrieveQueueType: z.ZodEnum<{
    custom: "custom";
    id: "id";
    task: "task";
}>;
export type RetrieveQueueType = z.infer<typeof RetrieveQueueType>;
export declare const QueueItem: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        custom: "custom";
        task: "task";
    }>;
    running: z.ZodNumber;
    queued: z.ZodNumber;
    paused: z.ZodBoolean;
    concurrencyLimit: z.ZodNullable<z.ZodNumber>;
    concurrency: z.ZodOptional<z.ZodObject<{
        current: z.ZodNullable<z.ZodNumber>;
        base: z.ZodNullable<z.ZodNumber>;
        override: z.ZodNullable<z.ZodNumber>;
        overriddenAt: z.ZodNullable<z.ZodCoercedDate<unknown>>;
        overriddenBy: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type QueueItem = z.infer<typeof QueueItem>;
export declare const ListQueueOptions: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    perPage: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ListQueueOptions = z.infer<typeof ListQueueOptions>;
export declare const QueueTypeName: z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        task: "task";
    }>;
    name: z.ZodString;
}, z.core.$strip>;
export type QueueTypeName = z.infer<typeof QueueTypeName>;
/**
 * When retrieving a queue you can either use the queue id,
 * or the type and name.
 *
 * @example
 *
 * ```ts
 * // Use a queue id (they start with queue_
 * const q1 = await queues.retrieve("queue_12345");
 *
 * // Or use the type and name
 * // The default queue for your "my-task-id"
 * const q2 = await queues.retrieve({ type: "task", name: "my-task-id"});
 *
 * // The custom queue you defined in your code
 * const q3 = await queues.retrieve({ type: "custom", name: "my-custom-queue" });
 * ```
 */
export declare const RetrieveQueueParam: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    type: z.ZodEnum<{
        custom: "custom";
        task: "task";
    }>;
    name: z.ZodString;
}, z.core.$strip>]>;
export type RetrieveQueueParam = z.infer<typeof RetrieveQueueParam>;
