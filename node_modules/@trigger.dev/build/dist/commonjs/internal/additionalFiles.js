"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAdditionalFilesToBuild = addAdditionalFilesToBuild;
const copyFiles_js_1 = require("./copyFiles.js");
async function addAdditionalFilesToBuild(source, options, context, manifest) {
    const matcherResults = await (0, copyFiles_js_1.findFilesByMatchers)(options.files ?? [], manifest.outputPath, { cwd: context.workingDir });
    for (const { assets, matcher } of matcherResults) {
        if (assets.length === 0) {
            context.logger.warn(`[${source}] No files found for matcher`, matcher);
        }
        else {
            context.logger.debug(`[${source}] Found ${assets.length} files for matcher`, matcher);
        }
    }
    await (0, copyFiles_js_1.copyMatcherResults)(matcherResults, (pair) => {
        context.logger.debug(`[${source}] Copying ${pair.source} to ${pair.destination}`);
    });
}
//# sourceMappingURL=additionalFiles.js.map