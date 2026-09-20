import { task, wait } from "@trigger.dev/sdk";

// One real background task, wired to this repo's own reality: proving that a
// release-path transport flake (the class `scripts/lib/transient-retry.mjs`
// classifies) clears on a retry. It fetches a URL, classifies the failure the
// same way the verifier does, and waits between attempts with the SDK's
// durable `wait` — every `wait` is awaited directly, never inside
// Promise.all (waits are checkpointed outside the run's process, so they
// cannot be parallelized).
export const flakeProbe = task({
  id: "flake-probe",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: { url?: string }) => {
    const url = payload.url ?? "https://freeoffgridcalculator.com/";
    const startedAt = new Date().toISOString();

    try {
      const res = await fetch(url, { cache: "no-store" });
      return {
        ok: res.ok,
        url,
        status: res.status,
        startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { isTransientFailure } =
        await import("../../scripts/lib/transient-retry.mjs");
      const transient = isTransientFailure(message);
      if (!transient) {
        // A non-transport failure (404, bad body) is a verdict, not a flake:
        // fail immediately and let the task's own retry policy decide.
        throw error;
      }
      // Transport-class: report it, then ride out the backoff durably so the
      // retry lands on a fresh attempt rather than a still-warm failure.
      await wait.for({ seconds: 5 });
      return {
        ok: false,
        url,
        transient,
        error: message.slice(0, 200),
        startedAt,
        checkedAt: new Date().toISOString(),
      };
    }
  },
});
