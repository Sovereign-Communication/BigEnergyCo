import type { ApiDeploymentListOptions, ApiDeploymentListResponseItem, ApiRequestOptions, CursorPagePromise, RetrieveCurrentDeploymentResponseBody } from "@trigger.dev/core/v3";
export type { ApiDeploymentListResponseItem, RetrieveCurrentDeploymentResponseBody };
export declare const deployments: {
    retrieveCurrent: typeof retrieveCurrentDeployment;
    list: typeof listDeployments;
};
/**
 * Retrieve the currently promoted deployment for this environment.
 *
 * Use inside a task to check whether a newer version has been deployed:
 *
 * ```ts
 * import { deployments } from "@trigger.dev/sdk";
 *
 * const current = await deployments.retrieveCurrent();
 * if (current.version !== ctx.run.version) {
 *   // A newer version is promoted
 * }
 * ```
 */
declare function retrieveCurrentDeployment(requestOptions?: ApiRequestOptions): Promise<RetrieveCurrentDeploymentResponseBody>;
/**
 * List deployments for the current environment.
 */
declare function listDeployments(options?: ApiDeploymentListOptions, requestOptions?: ApiRequestOptions): CursorPagePromise<typeof ApiDeploymentListResponseItem>;
