"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToolParametersToSchema = convertToolParametersToSchema;
const schemas_js_1 = require("./schemas.js");
function convertToolParametersToSchema(toolParameters) {
    return (0, schemas_js_1.isSchemaZodEsque)(toolParameters)
        ? toolParameters
        : convertAISchemaToTaskSchema(toolParameters);
}
function convertAISchemaToTaskSchema(schema) {
    return async (payload) => {
        const result = await schema.validate?.(payload);
        if (!result) {
            throw new Error("Invalid payload");
        }
        if (!result.success) {
            throw result.error;
        }
        return result.value;
    };
}
//# sourceMappingURL=tools.js.map