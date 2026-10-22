import { z } from "zod/v4";
export const MAX_ABSOLUTE_SCHEDULE_WINDOW_SECONDS = 24 * 60 * 60;
/** Parses and normalizes the public schedule-window syntax. */
export function parseScheduleWindow(value) {
    const durationMatch = /^(0|[1-9]\d*)([mh])$/.exec(value);
    if (durationMatch) {
        const amount = Number(durationMatch[1]);
        const unit = durationMatch[2];
        const durationSeconds = amount * (unit === "m" ? 60 : 3_600);
        if (!Number.isSafeInteger(durationSeconds) ||
            durationSeconds > MAX_ABSOLUTE_SCHEDULE_WINDOW_SECONDS) {
            throw new RangeError("Schedule window duration cannot exceed 24 hours");
        }
        return { type: "duration", durationSeconds };
    }
    const percentageMatch = /^(0|[1-9]\d*)%$/.exec(value);
    if (percentageMatch) {
        const percentage = Number(percentageMatch[1]);
        if (!Number.isSafeInteger(percentage) || percentage > 100) {
            throw new RangeError("Schedule window percentage cannot exceed 100%");
        }
        return { type: "percentage", percentage };
    }
    throw new TypeError('Schedule window must be a whole duration such as "30m" or "2h", or a percentage such as "30%"');
}
/** Runtime authority for public schedule-window values. */
export const ScheduleWindow = z.string().superRefine((value, ctx) => {
    try {
        parseScheduleWindow(value);
    }
    catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: error instanceof Error ? error.message : String(error),
        });
    }
});
//# sourceMappingURL=scheduleWindow.js.map