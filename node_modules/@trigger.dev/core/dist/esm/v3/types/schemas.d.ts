type SchemaZodEsque<TInput, TParsedInput> = {
    _input: TInput;
    _output: TParsedInput;
    parse: (input: unknown) => TParsedInput;
    parseAsync: (input: unknown) => Promise<TParsedInput>;
    safeParse: (input: unknown) => {
        success: true;
        data: TParsedInput;
    } | {
        success: false;
        error: any;
    };
};
export type AnyZodSchema = SchemaZodEsque<any, any>;
export type inferZodSchemaInput<TSchema extends AnyZodSchema> = TSchema["_input"];
export type inferZodSchemaOutput<TSchema extends AnyZodSchema> = TSchema["_output"];
export type ZodIssueLike = {
    message: string;
    path: ReadonlyArray<PropertyKey>;
};
export type ZodErrorLike = {
    message: string;
    issues: ReadonlyArray<ZodIssueLike>;
};
export declare function isSchemaZodEsque<TInput, TParsedInput>(schema: unknown): schema is SchemaZodEsque<TInput, TParsedInput>;
type SchemaValibotEsque<TInput, TParsedInput> = {
    schema: {
        _types?: {
            input: TInput;
            output: TParsedInput;
        };
    };
};
export declare function isSchemaValibotEsque<TInput, TParsedInput>(schema: Schema): schema is SchemaValibotEsque<TInput, TParsedInput>;
type SchemaArkTypeEsque<TInput, TParsedInput> = {
    inferIn: TInput;
    infer: TParsedInput;
};
export declare function isSchemaArkTypeEsque<TInput, TParsedInput>(schema: Schema): schema is SchemaArkTypeEsque<TInput, TParsedInput>;
type SchemaMyZodEsque<TInput> = {
    parse: (input: any) => TInput;
};
type SchemaSuperstructEsque<TInput> = {
    create: (input: unknown) => TInput;
};
type SchemaCustomValidatorEsque<TInput> = (input: unknown) => Promise<TInput> | TInput;
type SchemaYupEsque<TInput> = {
    validateSync: (input: unknown) => TInput;
};
type SchemaScaleEsque<TInput> = {
    assert(value: unknown): asserts value is TInput;
};
type SchemaWithoutInput<TInput> = SchemaCustomValidatorEsque<TInput> | SchemaMyZodEsque<TInput> | SchemaScaleEsque<TInput> | SchemaSuperstructEsque<TInput> | SchemaYupEsque<TInput>;
type SchemaWithInputOutput<TInput, TParsedInput> = SchemaZodEsque<TInput, TParsedInput> | SchemaValibotEsque<TInput, TParsedInput> | SchemaArkTypeEsque<TInput, TParsedInput>;
export type Schema = SchemaWithInputOutput<any, any> | SchemaWithoutInput<any>;
type inferSchema<TSchema extends Schema> = TSchema extends SchemaWithInputOutput<infer $TIn, infer $TOut> ? {
    in: $TIn;
    out: $TOut;
} : TSchema extends SchemaWithoutInput<infer $InOut> ? {
    in: $InOut;
    out: $InOut;
} : never;
export type inferSchemaIn<TSchema extends Schema | undefined, TDefault = unknown> = TSchema extends Schema ? inferSchema<TSchema>["in"] : TDefault;
export type inferSchemaOut<TSchema extends Schema | undefined, TDefault = unknown> = TSchema extends Schema ? inferSchema<TSchema>["out"] : TDefault;
export type SchemaParseFn<TType> = (value: unknown) => Promise<TType> | TType;
export type AnySchemaParseFn = SchemaParseFn<any>;
export declare function getSchemaParseFn<TType>(procedureParser: Schema): SchemaParseFn<TType>;
export {};
