import { type AnyZodSchema, type inferZodSchemaOutput, type Schema } from "./schemas.js";
type ValidationResult<T> = {
    success: true;
    value: T;
} | {
    success: false;
    error: Error;
};
type AISchema<T> = {
    _type: T;
    readonly jsonSchema: unknown;
    readonly validate?: (value: unknown) => ValidationResult<T> | PromiseLike<ValidationResult<T>>;
};
export type ToolTaskParameters = AnyZodSchema | AISchema<any>;
export type inferToolParameters<PARAMETERS extends ToolTaskParameters> = PARAMETERS extends AnyZodSchema ? inferZodSchemaOutput<PARAMETERS> : PARAMETERS extends AISchema<any> ? PARAMETERS["_type"] : never;
export declare function convertToolParametersToSchema<TToolParameters extends ToolTaskParameters>(toolParameters: TToolParameters): Schema;
export {};
