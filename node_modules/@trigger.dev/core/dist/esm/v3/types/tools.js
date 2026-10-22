import { isSchemaZodEsque, } from "./schemas.js";
export function convertToolParametersToSchema(toolParameters) {
    return isSchemaZodEsque(toolParameters)
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