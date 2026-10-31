import { defineConfig } from "@trigger.dev/sdk";

// Trigger.dev v4 configuration. The `dirs` entry points at the tasks
// registered with the dev CLI and the deployed instance; the site itself
// (assets/, index.html) never imports any of this — the calculator stays
// 100% client-side and dependency-free.
export default defineConfig({
  project: "proj_fpxfbgdxhogpeyaowhqm",
  dirs: ["./src/trigger"],
  // The heaviest task in this repo (full NASA POWER year, hourly) fits well
  // inside this ceiling.
  maxDuration: 300,
  retries: {
    enabledInDev: false,
  },
});
