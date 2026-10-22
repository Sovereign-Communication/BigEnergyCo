import type { ConsoleInterceptor } from "../consoleInterceptor.js";
import type { TracingSDK } from "../otel/index.js";
import type { RetryOptions, TaskRunContext, TaskRunExecution, TaskRunExecutionResult } from "../schemas/index.js";
import type { TriggerTracer } from "../tracer.js";
import type { TaskMetadataWithFunctions } from "../types/index.js";
export type TaskExecutorOptions = {
    tracingSDK: TracingSDK;
    tracer: TriggerTracer;
    consoleInterceptor: ConsoleInterceptor;
    retries?: {
        enabledInDev?: boolean;
        default?: RetryOptions;
    };
    isWarmStart?: boolean;
    executionCount?: number;
};
export declare class TaskExecutor {
    #private;
    task: TaskMetadataWithFunctions;
    private _tracingSDK;
    private _tracer;
    private _consoleInterceptor;
    private _retries;
    private _isWarmStart;
    private _executionCount;
    constructor(task: TaskMetadataWithFunctions, options: TaskExecutorOptions);
    execute(execution: TaskRunExecution, ctx: TaskRunContext, signal: AbortSignal): Promise<{
        result: TaskRunExecutionResult;
    }>;
}
