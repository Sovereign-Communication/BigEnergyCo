"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTypescript = loadTypescript;
const node_module_1 = require("node:module");
const node_path_1 = require("node:path");
const compilerPackages = ["typescript", "@typescript/typescript6"];
function hasTranspileModule(value) {
    return (typeof value === "object" &&
        value !== null &&
        "transpileModule" in value &&
        typeof value.transpileModule === "function");
}
function isUnavailablePackage(error) {
    return (error instanceof Error &&
        "code" in error &&
        (error.code === "MODULE_NOT_FOUND" || error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"));
}
function loadTypescript(projectDir, packageNames = compilerPackages) {
    const requireFromProject = (0, node_module_1.createRequire)((0, node_path_1.join)(projectDir, "package.json"));
    const loadErrors = [];
    for (const packageName of packageNames) {
        let resolvedPackage;
        try {
            resolvedPackage = requireFromProject.resolve(packageName);
        }
        catch (error) {
            if (isUnavailablePackage(error)) {
                continue;
            }
            throw error;
        }
        let compiler;
        try {
            compiler = requireFromProject(resolvedPackage);
        }
        catch (error) {
            loadErrors.push(new Error(`Failed to load "${packageName}" from ${projectDir}.`, { cause: error }));
            continue;
        }
        if (hasTranspileModule(compiler)) {
            return compiler;
        }
    }
    if (loadErrors.length === 1) {
        throw loadErrors[0];
    }
    if (loadErrors.length > 1) {
        throw new AggregateError(loadErrors, `Failed to load a compatible TypeScript compiler from ${projectDir}.`);
    }
    throw new Error([
        "The emitDecoratorMetadata() build extension requires the TypeScript JavaScript compiler API,",
        "which TypeScript 7 does not expose.",
        "",
        "Install the TypeScript 6 compatibility package alongside TypeScript 7:",
        "",
        "  npm install --save-dev @typescript/typescript6",
        "",
        "Restart the Trigger.dev dev server after installing the package.",
        "See https://trigger.dev/docs/config/extensions/emitDecoratorMetadata#using-with-typescript-7",
    ].join("\n"));
}
//# sourceMappingURL=loadTypescript.js.map