import { makeAppendPreconditionError, makeServerError, RangeNotSatisfiableError, S2Error, s2Error, } from "../../../../error.js";
import { append, read } from "../../../../generated/index.js";
import { fromAPIAppendAck, fromAPIStreamPosition, toAPIAppendRecord, } from "../../../../internal/mappers.js";
import { computeAppendRecordFormat } from "../../../../utils.js";
import { decodeProtoAppendAck, decodeProtoReadBatch, encodeProtoAppendInput, protoAppendAckToJson, } from "../proto.js";
function mergeHeaders(...headersList) {
    const merged = Object.assign({}, ...headersList.filter((headers) => Boolean(headers)));
    return Object.keys(merged).length > 0 ? merged : undefined;
}
export async function streamRead(stream, client, args, options) {
    const { as, ignore_command_records, ...queryParams } = args ?? {};
    const { headers: customHeaders, ...requestOptions } = options ?? {};
    const wantsBytes = (as ?? "string") === "bytes";
    let response;
    try {
        response = await read({
            client,
            path: {
                stream,
            },
            headers: mergeHeaders(customHeaders, wantsBytes ? { Accept: "application/protobuf" } : undefined),
            query: queryParams,
            parseAs: wantsBytes ? "arrayBuffer" : undefined,
            ...requestOptions,
        });
    }
    catch (error) {
        throw s2Error(error);
    }
    if (response.error || !response.response.ok) {
        const status = response.response.status;
        if (status === 416) {
            const err = response.error;
            throw new RangeNotSatisfiableError({
                status,
                tail: err?.tail ? fromAPIStreamPosition(err.tail) : undefined,
                code: err?.code,
            });
        }
        throw makeServerError({ status, statusText: response.response.statusText }, response.error);
    }
    if (wantsBytes) {
        const batch = decodeProtoReadBatch(response.data);
        return batch;
    }
    const res = {
        ...response.data,
        records: response.data.records?.map((record) => ({
            ...record,
            headers: record.headers || undefined,
        })) ?? [],
    };
    return res;
}
export async function streamAppend(stream, client, input, options) {
    const { preferProtobuf, headers: customHeaders, ...requestOptions } = options ?? {};
    const hasAnyBytesRecords = input.records.some((record) => computeAppendRecordFormat(record) === "bytes");
    const useProtobuf = hasAnyBytesRecords || preferProtobuf === true;
    let response;
    if (useProtobuf) {
        const protoBody = encodeProtoAppendInput(input);
        const headers = mergeHeaders(customHeaders, {
            Accept: "application/protobuf",
            "Content-Type": "application/protobuf",
        });
        try {
            response = await append({
                client,
                path: {
                    stream,
                },
                body: protoBody,
                bodySerializer: null,
                parseAs: "arrayBuffer",
                headers,
                ...requestOptions,
            });
        }
        catch (error) {
            throw s2Error(error);
        }
        if (response.error || !response.response.ok) {
            const status = response.response.status;
            if (status === 412) {
                throw makeAppendPreconditionError(status, response.error);
            }
            throw makeServerError({ status, statusText: response.response.statusText }, response.error);
        }
        const ack = decodeProtoAppendAck(response.data);
        return protoAppendAckToJson(ack);
    }
    const encodedRecords = [...input.records].map(toAPIAppendRecord);
    try {
        response = await append({
            client,
            path: {
                stream,
            },
            body: {
                fencing_token: input.fencingToken,
                match_seq_num: input.matchSeqNum,
                records: encodedRecords,
            },
            headers: customHeaders,
            ...requestOptions,
        });
    }
    catch (error) {
        throw s2Error(error);
    }
    if (response.error || !response.response.ok) {
        const status = response.response.status;
        if (status === 412) {
            throw makeAppendPreconditionError(status, response.error);
        }
        throw makeServerError({ status, statusText: response.response.statusText }, response.error);
    }
    return fromAPIAppendAck(response.data);
}
//# sourceMappingURL=shared.js.map