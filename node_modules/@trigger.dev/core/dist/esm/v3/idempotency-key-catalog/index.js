const API_NAME = "idempotency-key-catalog";
import { getGlobal, registerGlobal } from "../utils/globals.js";
import { InMemoryIdempotencyKeyCatalog } from "./inMemoryIdempotencyKeyCatalog.js";
export class IdempotencyKeyCatalogAPI {
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
        let catalog = getGlobal(API_NAME);
        if (!catalog) {
            // Auto-initialize on first access
            catalog = new InMemoryIdempotencyKeyCatalog();
            registerGlobal(API_NAME, catalog, true);
        }
        return catalog;
    }
}
//# sourceMappingURL=index.js.map