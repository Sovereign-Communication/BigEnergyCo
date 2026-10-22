export type TypeScriptCompiler = typeof import("typescript");
export declare function loadTypescript(projectDir: string, packageNames?: readonly string[]): TypeScriptCompiler;
