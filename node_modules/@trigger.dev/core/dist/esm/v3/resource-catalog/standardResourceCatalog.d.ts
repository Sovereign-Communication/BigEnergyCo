import type { PromptManifest, SkillManifest, SkillMetadata, TaskManifest, WebhookManifest, WebhookMetadata, WorkerManifest, QueueManifest } from "../schemas/index.js";
import type { PromptMetadataWithFunctions, TaskMetadataWithFunctions, TaskSchema } from "../types/index.js";
import type { ResourceCatalog } from "./catalog.js";
/**
 * Sentinel file-context value the runtime workers set around task execution
 * (via `TaskExecutor.execute`) so that `task()` calls firing during a run —
 * e.g. as a side effect of `await import(...)` of a module containing a
 * task definition — register normally instead of hitting the silent-drop
 * guard in `registerTaskMetadata`. The catalog uses this exact string to
 * detect "registered during execution" and emit a one-time warning per
 * task id. The indexer never sets this context, so its behavior is
 * unchanged.
 */
export declare const NO_FILE_CONTEXT = "<no-context>";
export declare class StandardResourceCatalog implements ResourceCatalog {
    private _taskSchemas;
    private _taskMetadata;
    private _taskFunctions;
    private _taskFileMetadata;
    private _promptMetadata;
    private _promptFunctions;
    private _promptFileMetadata;
    private _promptSchemas;
    private _currentFileContext?;
    private _queueMetadata;
    private _skillMetadata;
    private _skillFileMetadata;
    private _webhookMetadata;
    private _webhookFileMetadata;
    private _webhookIdCollisions;
    private _declaredSessionWebhooks;
    private _claimedSessionWebhooks;
    private _sentinelContextWarned;
    private _taskIdCollisions;
    setCurrentFileContext(filePath: string, entryPoint: string): void;
    clearCurrentFileContext(): void;
    listTaskIdCollisions(): Array<{
        id: string;
        filePaths: string[];
    }>;
    registerQueueMetadata(queue: QueueManifest): void;
    registerWorkerManifest(workerManifest: WorkerManifest): void;
    registerTaskMetadata(task: TaskMetadataWithFunctions): void;
    updateTaskMetadata(id: string, updates: Partial<TaskMetadataWithFunctions>): void;
    listTaskManifests(): Array<TaskManifest>;
    getTaskSchema(id: string): TaskSchema | undefined;
    listQueueManifests(): Array<QueueManifest>;
    getTaskManifest(id: string): TaskManifest | undefined;
    getTask(id: string): TaskMetadataWithFunctions | undefined;
    taskExists(id: string): boolean;
    registerPromptMetadata(prompt: PromptMetadataWithFunctions): void;
    getPromptSchema(id: string): TaskSchema | undefined;
    listPromptManifests(): Array<PromptManifest>;
    getPrompt(id: string): PromptMetadataWithFunctions | undefined;
    registerSkillMetadata(skill: SkillMetadata): void;
    listSkillManifests(): Array<SkillManifest>;
    getSkillManifest(id: string): SkillManifest | undefined;
    registerWebhookMetadata(webhook: WebhookMetadata): void;
    listWebhookIdCollisions(): Array<{
        id: string;
        filePaths: string[];
    }>;
    registerDeclaredSessionWebhook(id: string): void;
    markSessionWebhookClaimed(id: string): void;
    listUnclaimedSessionWebhooks(): Array<string>;
    listWebhookManifests(): Array<WebhookManifest>;
    getWebhookManifest(id: string): WebhookManifest | undefined;
    disable(): void;
}
