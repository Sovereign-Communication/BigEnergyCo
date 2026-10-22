import { z } from "zod/v4";
export declare const ConfigManifest: z.ZodObject<{
    project: z.ZodString;
    dirs: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ConfigManifest = z.infer<typeof ConfigManifest>;
