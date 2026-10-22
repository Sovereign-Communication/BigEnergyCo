"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyKeyCatalogAPI = void 0;
const API_NAME = "idempotency-key-catalog";
const globals_js_1 = require("../utils/globals.js");
const inMemoryIdempotencyKeyCatalog_js_1 = require("./inMemoryIdempotencyKeyCatalog.js");
class IdempotencyKeyCatalogAPI {
    static _instance;
    constructor() { }
    static getInstance() {
        if (!this._instance) {
            this._instance = new IdempotencyKeyCatalogAPI();
        }
        return this._instance;
    }
    registerKeyOptions(hash, options) {
        this.#getCatalog().registerKeyOptions(hash, options);
    }
    getKeyOptions(hash) {
        return this.#getCatalog().getKeyOptions(hash);
    }
    clear() {
        this.#getCatalog().clear();
    }
    #getCatalog() {
        let catalog = (0, globals_js_1.getGlobal)(API_NAME);
        if (!catalog) {
            // Auto-initialize on first access
            catalog = new inMemoryIdempotencyKeyCatalog_js_1.InMemoryIdempotencyKeyCatalog();
            (0, globals_js_1.registerGlobal)(API_NAME, catalog, true);
        }
        return catalog;
    }
}
exports.IdempotencyKeyCatalogAPI = IdempotencyKeyCatalogAPI;
//# sourceMappingURL=index.js.map