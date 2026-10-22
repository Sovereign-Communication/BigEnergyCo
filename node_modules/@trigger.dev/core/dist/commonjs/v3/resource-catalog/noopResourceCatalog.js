"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopResourceCatalog = void 0;
class NoopResourceCatalog {
    registerTaskMetadata(task) {
        // noop
    }
    setCurrentFileContext(filePath, entryPoint) {
        // noop
    }
    clearCurrentFileContext() {
        // noop
    }
    updateTaskMetadata(id, updates) {
        // noop
    }
    listTaskManifests() {
        return [];
    }
    listTaskIdCollisions() {
        return [];
    }
    getTaskManifest(id) {
        return undefined;
    }
    getTask(id) {
        return undefined;
    }
    getTaskSchema(id) {
        return undefined;
    }
    taskExists(id) {
        return false;
    }
    disable() {
        // noop
    }
    registerWorkerManifest(workerManifest) {
        // noop
    }
    registerQueueMetadata(queue) {
        // noop
    }
    listQueueManifests() {
        return [];
    }
    registerPromptMetadata(prompt) {
        // noop
    }
    listPromptManifests() {
        return [];
    }
    getPrompt(id) {
        return undefined;
    }
    getPromptSchema(id) {
        return undefined;
    }
    registerSkillMetadata(skill) {
        // noop
    }
    listSkillManifests() {
        return [];
    }
    getSkillManifest(id) {
        return undefined;
    }
    registerWebhookMetadata(webhook) {
        // noop
    }
    listWebhookManifests() {
        return [];
    }
    getWebhookManifest(id) {
        return undefined;
    }
    listWebhookIdCollisions() {
        return [];
    }
    registerDeclaredSessionWebhook(id) {
        // noop
    }
    markSessionWebhookClaimed(id) {
        // noop
    }
    listUnclaimedSessionWebhooks() {
        return [];
    }
}
exports.NoopResourceCatalog = NoopResourceCatalog;
//# sourceMappingURL=noopResourceCatalog.js.map