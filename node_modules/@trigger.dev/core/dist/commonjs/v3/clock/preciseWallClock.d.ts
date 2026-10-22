import { PreciseDate } from "@google-cloud/precise-date";
import type { Clock, ClockTime } from "./clock.js";
type PreciseWallClockOptions = {
    origin?: ClockTime;
    now?: PreciseDate;
};
export declare class PreciseWallClock implements Clock {
    #private;
    private _origin;
    constructor(options?: PreciseWallClockOptions);
    preciseNow(): [number, number];
    reset(): void;
}
export {};
