import { RealtimeStreamsAPI } from "./realtimeStreams/index.js";
export declare const realtimeStreams: RealtimeStreamsAPI;
export * from "./realtimeStreams/types.js";
export { SessionStreamInstance } from "./realtimeStreams/sessionStreamInstance.js";
export type { SessionStreamInstanceOptions, InitializeSessionStreamResponseLike, } from "./realtimeStreams/sessionStreamInstance.js";
export { trimSessionStream, writeSessionControlRecord, writeTurnCompleteRecord, writeUpgradeRequiredRecord, } from "./realtimeStreams/sessionStreamOneshot.js";
