import { type ShardKey } from "./runOpsResidency.js";
export declare function mintWaitpointIdForShard(key: ShardKey): {
    id: string;
    friendlyId: string;
};
export declare function mintWaitpointIdFor(anchorId: string | undefined): {
    id: string;
    friendlyId: string;
};
