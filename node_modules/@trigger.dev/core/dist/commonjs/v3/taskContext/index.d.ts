import type { Attributes } from "@opentelemetry/api";
import type { ServerBackgroundWorker, TaskRunContext } from "../schemas/index.js";
import type { TaskContext } from "./types.js";
export declare class TaskContextAPI {
    #private;
    private static _instance?;
    private _runDisabled;
    private _conversationId?;
    private constructor();
    static getInstance(): TaskContextAPI;
    get isInsideTask(): boolean;
    get isRunDisabled(): boolean;
    get ctx(): TaskRunContext | undefined;
    get worker(): ServerBackgroundWorker | undefined;
    get isWarmStart(): boolean | undefined;
    get attributes(): Attributes;
    get conversationAttributes(): Attributes;
    get conversationId(): string | undefined;
    setConversationId(conversationId: string | undefined): void;
    get resourceAttributes(): Attributes;
    get workerAttributes(): Attributes;
    get contextAttributes(): Attributes;
    disable(): void;
    setGlobalTaskContext(taskContext: TaskContext): boolean;
}
