const API_NAME = "resource-catalog";
import { getGlobal, registerGlobal, unregisterGlobal } from "../utils/globals.js";
import { NoopResourceCatalog } from "./noopResourceCatalog.js";
const NOOP_RESOURCE_CATALOG = new NoopResourceCatalog();
export class ResourceCatalogAPI {
    static _instance;
    constructor() { }
    static getInstance() {
        if (!this._instance) {
            this._instance = new ResourceCatalogAPI();
        }
        return this._instance;
    }
    setGlobalResourceCatalog(resourceCatalog) {
        return registerGlobal(API_NAME, resourceCatalog);
    }
    disable() {
        unregisterGlobal(API_NAME);
    }
    registerQueueMetadata(queue) {
        this.#getCatalog().registerQueueMetadata(queue);
    }
    registerTaskMetadata(task) {
        this.#getCatalog().registerTaskMetadata(task);
    }
    updateTaskMetadata(id, updates) {
        this.#getCatalog().updateTaskMetadata(id, updates);
    }
    setCurrentFileContext(filePath, entryPoint) {
        this.#getCatalog().setCurrentFileContext(filePath, entryPoint);
    }
    clearCurrentFileContext() {
        this.#getCatalog().clearCurrentFileContext();
    }
    registerWorkerManifest(workerManifest) {
        this.#getCatalog().registerWorkerManifest(workerManifest);
    }
    listTaskManifests() {
        return this.#getCatalog().listTaskManifests();
    }
    listTaskIdCollisions() {
        return this.#getCatalog().listTaskIdCollisions();
    }
    getTaskManifest(id) {
        return this.#getCatalog().getTaskManifest(id);
    }
    getTask(id) {
        return this.#getCatalog().getTask(id);
    }
    getTaskSchema(id) {
        return this.#getCatalog().getTaskSchema(id);
    }
    taskExists(id) {
        return this.#getCatalog().taskExists(id);
    }
    listQueueManifests() {
        return this.#getCatalog().listQueueManifests();
    }
    registerPromptMetadata(prompt) {
        this.#getCatalog().registerPromptMetadata(prompt);
    }
    listPromptManifests() {
        return this.#getCatalog().listPromptManifests();
    }
    getPrompt(id) {
        return this.#getCatalog().getPrompt(id);
    }
    getPromptSchema(id) {
        return this.#getCatalog().getPromptSchema(id);
    }
    registerSkillMetadata(skill) {
        this.#getCatalog().registerSkillMetadata(skill);
    }
    listSkillManifests() {
        return this.#getCatalog().listSkillManifests();
    }
    getSkillManifest(id) {
        return this.#getCatalog().getSkillManifest(id);
    }
    registerWebhookMetadata(webhook) {
        this.#getCatalog().registerWebhookMetadata(webhook);
    }
    listWebhookManifests() {
        return this.#getCatalog().listWebhookManifests();
    }
    getWebhookManifest(id) {
        return this.#getCatalog().getWebhookManifest(id);
    }
    listWebhookIdCollisions() {
        return this.#getCatalog().listWebhookIdCollisions();
    }
    registerDeclaredSessionWebhook(id) {
        this.#getCatalog().registerDeclaredSessionWebhook(id);
    }
    markSessionWebhookClaimed(id) {
        this.#getCatalog().markSessionWebhookClaimed(id);
    }
    listUnclaimedSessionWebhooks() {
        return this.#getCatalog().listUnclaimedSessionWebhooks();
    }
    #getCatalog() {
        return getGlobal(API_NAME) ?? NOOP_RESOURCE_CATALOG;
    }
}
//# sourceMappingURL=index.js.map