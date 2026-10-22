import type { PromptManifest, QueueManifest, SkillManifest, SkillMetadata, TaskManifest, WebhookManifest, WebhookMetadata, WorkerManifest } from "../schemas/index.js";
import { type PromptMetadataWithFunctions, type TaskMetadataWithFunctions, type TaskSchema } from "../types/index.js";
import type { ResourceCatalog } from "./catalog.js";
export declare class NoopResourceCatalog implements ResourceCatalog {
    registerTaskMetadata(task: TaskMetadataWithFunctions): void;
    setCurrentFileContext(filePath: string, entryPoint: string): void;
    clearCurrentFileContext(): void;
    updateTaskMetadata(id: string, updates: Partial<TaskMetadataWithFunctions>): void;
    listTaskManifests(): Array<TaskManifest>;
    listTaskIdCollisions(): Array<{
        id: string;
        filePaths: string[];
    }>;
    getTaskManifest(id: string): TaskManifest | undefined;
    getTask(id: string): TaskMetadataWithFunctions | undefined;
    getTaskSchema(id: string): TaskSchema | undefined;
    taskExists(id: string): boolean;
    disable(): void;
    registerWorkerManifest(workerManifest: WorkerManifest): void;
    registerQueueMetadata(queue: QueueManifest): void;
    listQueueManifests(): Array<QueueManifest>;
    registerPromptMetadata(prompt: PromptMetadataWithFunctions): void;
    listPromptManifests(): Array<PromptManifest>;
    getPrompt(id: string): PromptMetadataWithFunctions | undefined;
    getPromptSchema(id: string): TaskSchema | undefined;
    registerSkillMetadata(skill: SkillMetadata): void;
    listSkillManifests(): Array<SkillManifest>;
    getSkillManifest(id: string): SkillManifest | undefined;
    registerWebhookMetadata(webhook: WebhookMetadata): void;
    listWebhookManifests(): Array<WebhookManifest>;
    getWebhookManifest(id: string): WebhookManifest | undefined;
    listWebhookIdCollisions(): Array<{
        id: string;
        filePaths: string[];
    }>;
    registerDeclaredSessionWebhook(id: string): void;
    markSessionWebhookClaimed(id: string): void;
    listUnclaimedSessionWebhooks(): Array<string>;
}
