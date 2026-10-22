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
export const NO_FILE_CONTEXT = "<no-context>";
export class StandardResourceCatalog {
    _taskSchemas = new Map();
    _taskMetadata = new Map();
    _taskFunctions = new Map();
    _taskFileMetadata = new Map();
    _promptMetadata = new Map();
    _promptFunctions = new Map();
    _promptFileMetadata = new Map();
    _promptSchemas = new Map();
    _currentFileContext;
    _queueMetadata = new Map();
    _skillMetadata = new Map();
    _skillFileMetadata = new Map();
    _webhookMetadata = new Map();
    _webhookFileMetadata = new Map();
    _webhookIdCollisions = [];
    _declaredSessionWebhooks = new Set();
    _claimedSessionWebhooks = new Set();
    _sentinelContextWarned = new Set();
    // Task ids registered more than once (across files and task types). Tasks are
    // keyed by id below, so a second registration silently overwrites the first;
    // we record the collision here so the indexer can fail loudly instead. Only
    // consumed by the index workers — runtime never reads it.
    _taskIdCollisions = [];
    setCurrentFileContext(filePath, entryPoint) {
        this._currentFileContext = { filePath, entryPoint };
    }
    clearCurrentFileContext() {
        this._currentFileContext = undefined;
    }
    // Task ids that were registered more than once during this indexing pass.
    listTaskIdCollisions() {
        return this._taskIdCollisions;
    }
    registerQueueMetadata(queue) {
        const existingQueue = this._queueMetadata.get(queue.name);
        //if it exists already AND concurrencyLimit is different, log a warning
        if (existingQueue) {
            const isConcurrencyLimitDifferent = existingQueue.concurrencyLimit !== queue.concurrencyLimit;
            if (isConcurrencyLimitDifferent) {
                let message = `Queue "${queue.name}" is defined twice, with different settings.`;
                if (isConcurrencyLimitDifferent) {
                    message += `\n        - concurrencyLimit: ${existingQueue.concurrencyLimit} vs ${queue.concurrencyLimit}`;
                }
                message += "\n       Keeping the first definition:";
                message += `\n        - concurrencyLimit: ${existingQueue.concurrencyLimit}`;
                console.warn(message);
                return;
            }
        }
        this._queueMetadata.set(queue.name, queue);
    }
    registerWorkerManifest(workerManifest) {
        for (const task of workerManifest.tasks) {
            this._taskFileMetadata.set(task.id, {
                filePath: task.filePath,
                entryPoint: task.entryPoint,
            });
        }
    }
    registerTaskMetadata(task) {
        if (!this._currentFileContext) {
            return;
        }
        const { fns, schema, ...metadata } = task;
        if (!task.id) {
            return;
        }
        // When the current context is the sentinel set by TaskExecutor around a
        // run, the task() call fired during execution — most commonly via a
        // dynamic import inside another task's run(). Warn once per task id so
        // the pattern stays visible.
        if (this._currentFileContext.filePath === NO_FILE_CONTEXT &&
            !this._sentinelContextWarned.has(task.id)) {
            this._sentinelContextWarned.add(task.id);
            console.warn(`[trigger.dev] task "${task.id}" was registered via dynamic import during another task's run(); move to a static import if you notice any issues.`);
        }
        // Detect a duplicate task id before the maps below overwrite the first
        // registration. Skip the runtime sentinel context (a task() firing during
        // another task's run) — that's a re-registration, not a duplicate
        // definition, and the indexer never uses the sentinel.
        if (this._taskMetadata.has(task.id) && this._currentFileContext.filePath !== NO_FILE_CONTEXT) {
            const existingFilePath = this._taskFileMetadata.get(task.id)?.filePath;
            const currentFilePath = this._currentFileContext.filePath;
            const collision = this._taskIdCollisions.find((c) => c.id === task.id);
            if (collision) {
                collision.filePaths.push(currentFilePath);
            }
            else {
                this._taskIdCollisions.push({
                    id: task.id,
                    filePaths: [existingFilePath ?? currentFilePath, currentFilePath],
                });
            }
        }
        this._taskFileMetadata.set(task.id, {
            ...this._currentFileContext,
        });
        this._taskMetadata.set(task.id, metadata);
        this._taskFunctions.set(task.id, fns);
        if (schema) {
            this._taskSchemas.set(task.id, schema);
        }
    }
    updateTaskMetadata(id, updates) {
        const { fns, schema, ...metadataUpdates } = updates;
        const existingMetadata = this._taskMetadata.get(id);
        if (existingMetadata && Object.keys(metadataUpdates).length > 0) {
            this._taskMetadata.set(id, {
                ...existingMetadata,
                ...metadataUpdates,
            });
        }
        if (fns) {
            const existingFunctions = this._taskFunctions.get(id);
            if (existingFunctions) {
                this._taskFunctions.set(id, {
                    ...existingFunctions,
                    ...fns,
                });
            }
        }
        if (schema) {
            this._taskSchemas.set(id, schema);
        }
    }
    // Return all the tasks, without the functions
    listTaskManifests() {
        const result = [];
        for (const [id, metadata] of this._taskMetadata) {
            const fileMetadata = this._taskFileMetadata.get(id);
            if (!fileMetadata) {
                continue;
            }
            const taskManifest = {
                ...metadata,
                ...fileMetadata,
            };
            result.push(taskManifest);
        }
        return result;
    }
    getTaskSchema(id) {
        return this._taskSchemas.get(id);
    }
    listQueueManifests() {
        return Array.from(this._queueMetadata.values());
    }
    getTaskManifest(id) {
        const metadata = this._taskMetadata.get(id);
        const fileMetadata = this._taskFileMetadata.get(id);
        if (!metadata || !fileMetadata) {
            return undefined;
        }
        return {
            ...metadata,
            ...fileMetadata,
        };
    }
    getTask(id) {
        const metadata = this._taskMetadata.get(id);
        const fileMetadata = this._taskFileMetadata.get(id);
        const fns = this._taskFunctions.get(id);
        if (!metadata || !fns || !fileMetadata) {
            return undefined;
        }
        return {
            ...metadata,
            ...fileMetadata,
            fns,
        };
    }
    taskExists(id) {
        return this._taskMetadata.has(id);
    }
    registerPromptMetadata(prompt) {
        if (!this._currentFileContext) {
            return;
        }
        const { fns, schema, ...metadata } = prompt;
        if (!prompt.id) {
            return;
        }
        this._promptFileMetadata.set(prompt.id, {
            ...this._currentFileContext,
        });
        this._promptMetadata.set(prompt.id, metadata);
        this._promptFunctions.set(prompt.id, fns);
        if (schema) {
            this._promptSchemas.set(prompt.id, schema);
        }
    }
    getPromptSchema(id) {
        return this._promptSchemas.get(id);
    }
    listPromptManifests() {
        const result = [];
        for (const [id, metadata] of this._promptMetadata) {
            const fileMetadata = this._promptFileMetadata.get(id);
            if (!fileMetadata) {
                continue;
            }
            result.push({
                ...metadata,
                ...fileMetadata,
            });
        }
        return result;
    }
    getPrompt(id) {
        const metadata = this._promptMetadata.get(id);
        const fileMetadata = this._promptFileMetadata.get(id);
        const fns = this._promptFunctions.get(id);
        if (!metadata || !fns || !fileMetadata) {
            return undefined;
        }
        return {
            ...metadata,
            ...fileMetadata,
            fns,
        };
    }
    registerSkillMetadata(skill) {
        if (!this._currentFileContext) {
            return;
        }
        if (!skill.id) {
            return;
        }
        const existing = this._skillMetadata.get(skill.id);
        if (existing && existing.sourcePath !== skill.sourcePath) {
            console.warn(`Skill "${skill.id}" is defined twice with different paths. Keeping the first:\n` +
                `  existing: ${existing.sourcePath}\n` +
                `  ignored:  ${skill.sourcePath}`);
            return;
        }
        this._skillFileMetadata.set(skill.id, {
            ...this._currentFileContext,
        });
        this._skillMetadata.set(skill.id, skill);
    }
    listSkillManifests() {
        const result = [];
        for (const [id, metadata] of this._skillMetadata) {
            const fileMetadata = this._skillFileMetadata.get(id);
            if (!fileMetadata)
                continue;
            result.push({
                ...metadata,
                ...fileMetadata,
            });
        }
        return result;
    }
    getSkillManifest(id) {
        const metadata = this._skillMetadata.get(id);
        const fileMetadata = this._skillFileMetadata.get(id);
        if (!metadata || !fileMetadata)
            return undefined;
        return {
            ...metadata,
            ...fileMetadata,
        };
    }
    registerWebhookMetadata(webhook) {
        if (!this._currentFileContext) {
            return;
        }
        if (!webhook.id) {
            return;
        }
        if (this._webhookMetadata.has(webhook.id) &&
            this._currentFileContext.filePath !== NO_FILE_CONTEXT) {
            const existingFilePath = this._webhookFileMetadata.get(webhook.id)?.filePath;
            const currentFilePath = this._currentFileContext.filePath;
            const collision = this._webhookIdCollisions.find((c) => c.id === webhook.id);
            if (collision) {
                collision.filePaths.push(currentFilePath);
            }
            else {
                this._webhookIdCollisions.push({
                    id: webhook.id,
                    filePaths: [existingFilePath ?? currentFilePath, currentFilePath],
                });
            }
        }
        this._webhookFileMetadata.set(webhook.id, { ...this._currentFileContext });
        this._webhookMetadata.set(webhook.id, webhook);
    }
    listWebhookIdCollisions() {
        return this._webhookIdCollisions;
    }
    registerDeclaredSessionWebhook(id) {
        if (!id)
            return;
        this._declaredSessionWebhooks.add(id);
    }
    markSessionWebhookClaimed(id) {
        if (!id)
            return;
        this._claimedSessionWebhooks.add(id);
    }
    listUnclaimedSessionWebhooks() {
        return [...this._declaredSessionWebhooks].filter((id) => !this._claimedSessionWebhooks.has(id));
    }
    listWebhookManifests() {
        const result = [];
        for (const [id, metadata] of this._webhookMetadata) {
            const fileMetadata = this._webhookFileMetadata.get(id);
            if (!fileMetadata)
                continue;
            result.push({ ...metadata, ...fileMetadata });
        }
        return result;
    }
    getWebhookManifest(id) {
        const metadata = this._webhookMetadata.get(id);
        const fileMetadata = this._webhookFileMetadata.get(id);
        if (!metadata || !fileMetadata)
            return undefined;
        return { ...metadata, ...fileMetadata };
    }
    disable() {
        // noop
    }
}
//# sourceMappingURL=standardResourceCatalog.js.map