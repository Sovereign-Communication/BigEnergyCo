"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitDecoratorMetadata = emitDecoratorMetadata;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const loadTypescript_js_1 = require("./internal/loadTypescript.js");
const decoratorMatcher = new RegExp(/((?<![(\s]\s*['"])@\w[.[\]\w\d]*\s*(?![;])[((?=\s)])/);
function emitDecoratorMetadata() {
    return {
        name: "emitDecoratorMetadata",
        onBuildStart(context) {
            const { convertCompilerOptionsFromJson, transpileModule, ModuleKind } = (0, loadTypescript_js_1.loadTypescript)(context.workingDir);
            context.registerPlugin({
                name: "emitDecoratorMetadata",
                async setup(build) {
                    const { parse, TSConfckCache } = await import("tsconfck");
                    const cache = new TSConfckCache();
                    build.onLoad({ filter: /\.ts$/ }, async (args) => {
                        context.logger.debug("emitDecoratorMetadata onLoad", { args });
                        const { tsconfigFile, tsconfig } = await parse(args.path, {
                            ignoreNodeModules: true,
                            cache,
                        });
                        const { options: compilerOptions } = convertCompilerOptionsFromJson(tsconfig.compilerOptions ?? {}, tsconfigFile ? (0, node_path_1.dirname)(tsconfigFile) : context.workingDir);
                        context.logger.debug("emitDecoratorMetadata parsed tsconfig", {
                            tsconfig,
                            tsconfigFile,
                            args,
                        });
                        if (compilerOptions.emitDecoratorMetadata !== true) {
                            context.logger.debug("emitDecoratorMetadata skipping", {
                                args,
                                tsconfig,
                            });
                            return undefined;
                        }
                        const ts = await (0, promises_1.readFile)(args.path, "utf8");
                        if (!ts)
                            return undefined;
                        // Find the decorator and if there isn't one, return out
                        if (!decoratorMatcher.test(ts)) {
                            context.logger.debug("emitDecoratorMetadata skipping, no decorators found", {
                                args,
                            });
                            return undefined;
                        }
                        const program = transpileModule(ts, {
                            fileName: args.path,
                            compilerOptions: {
                                ...compilerOptions,
                                module: ModuleKind.ES2022,
                            },
                        });
                        return { contents: program.outputText };
                    });
                },
            });
        },
    };
}
//# sourceMappingURL=typescript.js.map