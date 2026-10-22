import { z } from "zod/v4";
export declare const PRIMARY_VARIANT = "primary";
export declare const WARM_VARIANT = "warm";
export declare const COLD_VARIANT = "cold";
declare const Variant: z.ZodEnum<{
    cold: "cold";
    primary: "primary";
    warm: "warm";
}>;
export type Variant = z.infer<typeof Variant>;
declare const Accessory: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        text: z.ZodString;
        variant: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    style: z.ZodOptional<z.ZodEnum<{
        codepath: "codepath";
        pills: "pills";
    }>>;
}, z.core.$strip>;
export type Accessory = z.infer<typeof Accessory>;
export declare const TaskEventStyle: z.ZodDefault<z.ZodObject<{
    icon: z.ZodOptional<z.ZodString>;
    variant: z.ZodOptional<z.ZodEnum<{
        cold: "cold";
        primary: "primary";
        warm: "warm";
    }>>;
    accessory: z.ZodOptional<z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            text: z.ZodString;
            variant: z.ZodOptional<z.ZodString>;
            url: z.ZodOptional<z.ZodString>;
            icon: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        style: z.ZodOptional<z.ZodEnum<{
            codepath: "codepath";
            pills: "pills";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export type TaskEventStyle = z.infer<typeof TaskEventStyle>;
export {};
