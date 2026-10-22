import { SemanticInternalAttributes } from "../semanticInternalAttributes.js";
import { sdkScope } from "../sdkScope/index.js";
import { getGlobal, registerGlobal } from "../utils/globals.js";
const API_NAME = "task-context";
export class TaskContextAPI {
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
        const scope = sdkScope.getStore();
        return !!scope && !scope.inheritContext;
    }
    get attributes() {
        if (this.ctx) {
            return {
                ...this.contextAttributes,
                ...this.workerAttributes,
                ...this.conversationAttributes,
                [SemanticInternalAttributes.WARM_START]: !!this.isWarmStart,
            };
        }
        return {};
    }
    get conversationAttributes() {
        if (!this._conversationId)
            return {};
        return { [SemanticInternalAttributes.GEN_AI_CONVERSATION_ID]: this._conversationId };
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
                [SemanticInternalAttributes.ENVIRONMENT_ID]: this.ctx.environment.id,
                [SemanticInternalAttributes.ENVIRONMENT_TYPE]: this.ctx.environment.type,
                [SemanticInternalAttributes.ORGANIZATION_ID]: this.ctx.organization.id,
                [SemanticInternalAttributes.PROJECT_ID]: this.ctx.project.id,
                [SemanticInternalAttributes.PROJECT_REF]: this.ctx.project.ref,
                [SemanticInternalAttributes.PROJECT_NAME]: this.ctx.project.name,
                [SemanticInternalAttributes.ORGANIZATION_SLUG]: this.ctx.organization.slug,
                [SemanticInternalAttributes.ORGANIZATION_NAME]: this.ctx.organization.name,
                [SemanticInternalAttributes.MACHINE_PRESET_NAME]: this.ctx.machine?.name,
                [SemanticInternalAttributes.MACHINE_PRESET_CPU]: this.ctx.machine?.cpu,
                [SemanticInternalAttributes.MACHINE_PRESET_MEMORY]: this.ctx.machine?.memory,
                [SemanticInternalAttributes.MACHINE_PRESET_CENTS_PER_MS]: this.ctx.machine?.centsPerMs,
            };
        }
        return {};
    }
    get workerAttributes() {
        if (this.worker) {
            return {
                [SemanticInternalAttributes.WORKER_ID]: this.worker.id,
                [SemanticInternalAttributes.WORKER_VERSION]: this.worker.version,
            };
        }
        return {};
    }
    get contextAttributes() {
        if (this.ctx) {
            return {
                [SemanticInternalAttributes.ATTEMPT_NUMBER]: this.ctx.attempt.number,
                [SemanticInternalAttributes.TASK_SLUG]: this.ctx.task.id,
                [SemanticInternalAttributes.TASK_PATH]: this.ctx.task.filePath,
                [SemanticInternalAttributes.QUEUE_NAME]: this.ctx.queue.name,
                [SemanticInternalAttributes.QUEUE_ID]: this.ctx.queue.id,
                [SemanticInternalAttributes.RUN_ID]: this.ctx.run.id,
                [SemanticInternalAttributes.RUN_IS_TEST]: this.ctx.run.isTest,
                [SemanticInternalAttributes.RUN_IS_REPLAY]: this.ctx.run.isReplay,
                [SemanticInternalAttributes.BATCH_ID]: this.ctx.batch?.id,
                [SemanticInternalAttributes.IDEMPOTENCY_KEY]: this.ctx.run.idempotencyKey,
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
        return registerGlobal(API_NAME, taskContext, true);
    }
    #getTaskContext() {
        return getGlobal(API_NAME);
    }
}
//# sourceMappingURL=index.js.map