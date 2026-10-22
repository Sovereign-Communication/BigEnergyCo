import { z } from "zod/v4";
/**
 * Signed, deployment-scoped token carried in the TRIGGER_DEPLOYMENT_ID env var to identify a run
 * controller. Long-lived identity token, not a rotating credential; the `ver` claim allows a future
 * format revision.
 */
export declare const WORKLOAD_DEPLOYMENT_TOKEN_VERSION: 1;
export declare const WorkloadDeploymentTokenClaims: z.ZodObject<{
    ver: z.ZodLiteral<1>;
    deployment: z.ZodString;
    deployment_version: z.ZodString;
    environment_id: z.ZodString;
    environment_type: z.ZodString;
    org_id: z.ZodString;
    project_id: z.ZodString;
    exp: z.ZodNumber;
}, z.core.$strip>;
export type WorkloadDeploymentTokenClaims = z.infer<typeof WorkloadDeploymentTokenClaims>;
/** Claims the caller supplies; `ver` and `exp` are set by the minter. */
export type WorkloadDeploymentTokenInput = Omit<WorkloadDeploymentTokenClaims, "ver" | "exp">;
/**
 * `expiresAtSeconds` is an absolute epoch (caller-supplied — the supervisor drives it). Combined with
 * the omitted `iat`, the token is byte-deterministic per deployment: identical claims mint identical
 * bytes, so the OTel `worker.id` the runner derives from it stays one value per deployment.
 */
export declare function mintWorkloadDeploymentToken(claims: WorkloadDeploymentTokenInput, secret: string, expiresAtSeconds: number): Promise<string>;
export type WorkloadDeploymentTokenVerification = {
    ok: true;
    claims: WorkloadDeploymentTokenClaims;
} | {
    ok: false;
    reason: "invalid_signature" | "malformed_claims";
    error: string;
};
export declare function verifyWorkloadDeploymentToken(token: string, secret: string): Promise<WorkloadDeploymentTokenVerification>;
/**
 * A legacy TRIGGER_DEPLOYMENT_ID is a bare friendlyId (deployment_xxxx); a minted token is a JWT of
 * three non-empty base64url segments. Used by the dry-run to tell a pre-upgrade runner from a token.
 */
export declare function looksLikeWorkloadDeploymentToken(value: string): boolean;
export type DeploymentIdHeaderOutcome = "jwt_valid" | "jwt_invalid" | "legacy_bare";
/**
 * Classify the value carried in the deployment-id header for the rollout metric, verifying the
 * signature when it is JWT-shaped. Returns the claims on a valid token so callers avoid a second verify.
 */
export declare function classifyDeploymentIdHeader(value: string, secret: string): Promise<{
    outcome: DeploymentIdHeaderOutcome;
    claims?: WorkloadDeploymentTokenClaims;
}>;
