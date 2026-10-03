import test from "node:test";
import assert from "node:assert/strict";
import { isAbsolute, sep } from "node:path";
import {
  createPagesRoutes,
  createPagesWorkerSource,
  injectTurnstileSiteKey,
  resolveOutputDirectory,
  validateTurnstileSiteKey,
} from "../scripts/stage-showcase.mjs";

test("showcase worker preserves API requests and sends them only to the showcase worker", async () => {
  const source = createPagesWorkerSource();
  const worker = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
  const originalFetch = globalThis.fetch;
  let proxiedRequest;
  globalThis.fetch = async (request) => {
    proxiedRequest = request;
    return new Response("proxied");
  };
  try {
    const request = new Request(
      "https://showcase.pages.dev/api/chat?mode=demo&x=1",
      {
        method: "POST",
        headers: {
          origin: "https://showcase.pages.dev",
          "content-type": "application/json",
        },
        body: JSON.stringify({ prompt: "hello" }),
      },
    );
    const response = await worker.default.fetch(request, {
      ASSETS: {
        fetch: () => assert.fail("API request fell through to static assets"),
      },
    });

    assert.equal(await response.text(), "proxied");
    assert.ok(proxiedRequest instanceof Request);
    assert.equal(
      new URL(proxiedRequest.url).origin,
      "https://bigenergyco-api-showcase.bigenergyco.workers.dev",
    );
    assert.equal(new URL(proxiedRequest.url).pathname, "/api/chat");
    assert.equal(new URL(proxiedRequest.url).search, "?mode=demo&x=1");
    assert.equal(proxiedRequest.method, "POST");
    assert.equal(
      proxiedRequest.headers.get("origin"),
      "https://showcase.pages.dev",
    );
    assert.deepEqual(await proxiedRequest.json(), { prompt: "hello" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-API requests bypass proxy fetch and go to static assets", async () => {
  const worker = await import(
    `data:text/javascript;base64,${Buffer.from(createPagesWorkerSource()).toString("base64")}`
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail("non-API request was proxied");
  try {
    const request = new Request("https://showcase.pages.dev/assets/logo.svg");
    const expected = new Response("static asset");
    let assetRequest;
    const response = await worker.default.fetch(request, {
      ASSETS: {
        fetch(received) {
          assetRequest = received;
          return expected;
        },
      },
    });
    assert.equal(assetRequest, request);
    assert.equal(response, expected);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pages Functions are invoked for /api/* only", () => {
  assert.deepEqual(JSON.parse(createPagesRoutes()), {
    version: 1,
    include: ["/api/*"],
    exclude: [],
  });
});

test("Turnstile key is injected as escaped homepage metadata and replaces an old key", () => {
  assert.equal(validateTurnstileSiteKey("0x4AAAAkey"), "0x4AAAAkey");
  const html = injectTurnstileSiteKey(
    "<html><head><title>Demo</title></head></html>",
    "0x4AAAAkey",
  );
  assert.match(
    html,
    /<meta name="bec-turnstile-site-key" content="0x4AAAAkey" \/>/,
  );
  const updated = injectTurnstileSiteKey(
    html.replace("0x4AAAAkey", "1x00000000000000000000AA"),
    "0x4BBBBkey",
  );
  assert.equal((updated.match(/bec-turnstile-site-key/g) ?? []).length, 1);
  assert.match(updated, /content="0x4BBBBkey"/);
});

test("invalid keys and output paths outside the repository are refused", () => {
  for (const value of [
    "",
    "REPLACE_WITH_TURNSTILE_SITE_KEY",
    "not-a-key",
    '0xabc" onload=alert(1)',
  ]) {
    assert.throws(() => validateTurnstileSiteKey(value));
  }
  assert.throws(() => resolveOutputDirectory("../outside"));
  assert.throws(() => resolveOutputDirectory("."));
  for (const protectedDir of ["assets", "scripts", "tests", ".git", "worker"]) {
    assert.throws(() => resolveOutputDirectory(`${protectedDir}/demo`));
  }
  if (isAbsolute("C:\\outside\\stage")) {
    assert.throws(() => resolveOutputDirectory("C:\\outside\\stage"));
  }
  assert.equal(
    resolveOutputDirectory(`_pages_showcase${sep}demo`).stageArgument,
    `_pages_showcase${sep}demo`,
  );
});
