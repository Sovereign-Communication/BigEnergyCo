"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskContextAPI = void 0;
const semanticInternalAttributes_js_1 = require("../semanticInternalAttributes.js");
const index_js_1 = require("../sdkScope/index.js");
const globals_js_1 = require("../utils/globals.js");
const API_NAME = "task-context";
class TaskContextAPI {
    static _instance;
    _runDisabled = false;
    _conversationId;
    constructor() { }
    static getInstance() {
        if (!this._instance) {
            this._instance = new TaskContextAPI();
        }
        return this._instance;
    }
    get isInsideTask() {
        if (this.#isolatedFromContext())
            return false;
        return this.#getTaskContext() !== undefined;
    }
    get isRunDisabled() {
        return this._runDisabled;
    }
    get ctx() {
        if (this.#isolatedFromContext())
            return undefined;
        return this.#getTaskContext()?.ctx;
    }
    get worker() {
        if (this.#isolatedFromContext())
            return undefined;
        return this.#getTaskContext()?.worker;
    }
    get isWarmStart() {
        if (this.#isolatedFromContext())
            return undefined;
        return this.#getTaskContext()?.isWarmStart;
    }
    #isolatedFromContext() {
        const scope = index_js_1.sdkScope.getStore();
        return !!scope && !scope.inheritContext;
    }
    get attributes() {
        if (this.ctx) {
            return {
                ...this.contextAttributes,
                ...this.workerAttributes,
                ...this.conversationAttributes,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.WARM_START]: !!this.isWarmStart,
            };
        }
        return {};
    }
    get conversationAttributes() {
        if (!this._conversationId)
            return {};
        return { [semanticInternalAttributes_js_1.SemanticInternalAttributes.GEN_AI_CONVERSATION_ID]: this._conversationId };
    }
    get conversationId() {
        return this._conversationId;
    }
    setConversationId(conversationId) {
        this._conversationId = conversationId || undefined;
    }
    get resourceAttributes() {
        if (this.ctx) {
            return {
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ENVIRONMENT_ID]: this.ctx.environment.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ENVIRONMENT_TYPE]: this.ctx.environment.type,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ORGANIZATION_ID]: this.ctx.organization.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.PROJECT_ID]: this.ctx.project.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.PROJECT_REF]: this.ctx.project.ref,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.PROJECT_NAME]: this.ctx.project.name,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ORGANIZATION_SLUG]: this.ctx.organization.slug,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ORGANIZATION_NAME]: this.ctx.organization.name,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.MACHINE_PRESET_NAME]: this.ctx.machine?.name,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.MACHINE_PRESET_CPU]: this.ctx.machine?.cpu,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.MACHINE_PRESET_MEMORY]: this.ctx.machine?.memory,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.MACHINE_PRESET_CENTS_PER_MS]: this.ctx.machine?.centsPerMs,
            };
        }
        return {};
    }
    get workerAttributes() {
        if (this.worker) {
            return {
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.WORKER_ID]: this.worker.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.WORKER_VERSION]: this.worker.version,
            };
        }
        return {};
    }
    get contextAttributes() {
        if (this.ctx) {
            return {
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.ATTEMPT_NUMBER]: this.ctx.attempt.number,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.TASK_SLUG]: this.ctx.task.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.TASK_PATH]: this.ctx.task.filePath,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.QUEUE_NAME]: this.ctx.queue.name,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.QUEUE_ID]: this.ctx.queue.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.RUN_ID]: this.ctx.run.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.RUN_IS_TEST]: this.ctx.run.isTest,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.RUN_IS_REPLAY]: this.ctx.run.isReplay,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.BATCH_ID]: this.ctx.batch?.id,
                [semanticInternalAttributes_js_1.SemanticInternalAttributes.IDEMPOTENCY_KEY]: this.ctx.run.idempotencyKey,
            };
        }
        return {};
    }
    disable() {
        this._runDisabled = true;
    }
    setGlobalTaskContext(taskContext) {
        this._runDisabled = false;
        // Each run boot re-registers the global; clear any conversation id
        // left over from a previous run on this warm-restarted process so
        // attributes don't bleed across runs that don't call
        // `setConversationId` themselves.
        this._conversationId = undefined;
        return (0, globals_js_1.registerGlobal)(API_NAME, taskContext, true);
    }
    #getTaskContext() {
        return (0, globals_js_1.getGlobal)(API_NAME);
    }
}
exports.TaskContextAPI = TaskContextAPI;
//# sourceMappingURL=index.js.map