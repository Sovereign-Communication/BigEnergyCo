#!/usr/bin/env node
// Show the degraded advisor reply as a visitor actually sees it, in every
// shipped locale.
//
// Why a script and not only tests: the tests assert that each locale rendered
// ITS OWN string, which is a correctness claim. This prints the text, so the
// claim can also be READ — a translation that resolves but reads badly is still
// a bad translation, and no assertion catches that.
//
// It drives the shipped assets/js/chat.js sendChatMsg() against a fake DOM, the
// same way tests/worker-i18n.test.mjs does, and renders the real dictionary.
//
// Usage: node scripts/smoke/advisor-i18n.mjs [--lang <id>] [--json]
import { makeDom, loadChatJs } from "./advisor-fallbacks.mjs";
import { buildDegradedReply } from "../../worker/advisor-fallback.mjs";
import { ensureDisclaimer } from "../../worker/index.js";
import { translate } from "../../assets/js/shared/i18n.js";
import { LOCALES } from "../../assets/js/shared/locales.js";

const LANGS = ["en", "es", "pt", "fr", "de", "ar"];

async function renderIn(lang) {
  const { doc, chatWindow, chatInput } = makeDom();
  // The server side is REAL: the same buildDegradedReply the worker calls.
  const server = buildDegradedReply(
    "groq_unavailable",
    { hasSystem: true, language: lang },
    ensureDisclaimer,
  );
  const win = {
    location: { hostname: "example.test" },
    addEventListener() {},
    becoLang: lang,
    becoT: (key, vars) => translate(key, vars, lang),
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => server,
      headers: new Headers(),
    }),
  };
  const sandbox = loadChatJs({ doc, win });
  chatInput.value = "How big a solar battery do I need?";
  await sandbox.sendChatMsg();
  await new Promise((r) => setTimeout(r, 20));
  const bot = chatWindow.children.find(
    (c) => c.className === "chat-msg bot" && c.id !== "loadingMsg",
  );
  return {
    lang,
    label: (bot?.children[1]?.textContent || "").trim(),
    body: (bot?.children[0]?.textContent || "").trim(),
  };
}

export async function renderAll(langs = LANGS) {
  const out = [];
  for (const l of langs) out.push(await renderIn(l));
  return out;
}

async function main() {
  const only = process.argv.includes("--lang")
    ? process.argv[process.argv.indexOf("--lang") + 1]
    : null;
  const langs = only ? [only] : LANGS;
  const results = await renderAll(langs);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.log(
    "Degraded advisor reply — rendered by the shipped client, upstream failing\n",
  );
  for (const r of results) {
    const name = (Object.keys(LOCALES).length && r.lang) || r.lang;
    console.log(`─── ${name.toUpperCase()} ${"─".repeat(56 - name.length)}`);
    console.log(`  [label] ${r.label}`);
    console.log("");
    for (const line of r.body.split("\n")) console.log(`  ${line}`);
    console.log("");
  }
  // A cheap regression net for the READER: flag any locale that still shows an
  // English sentence, which is the defect this whole pass exists to close.
  const leaked = results.filter(
    (r) =>
      r.lang !== "en" && r.body.includes("I cannot answer this one right now"),
  );
  if (leaked.length) {
    console.error(`ENGLISH LEAK in: ${leaked.map((r) => r.lang).join(", ")}`);
    process.exit(1);
  }
  console.log(
    `  ${results.length} locale(s) rendered, no English left in the body.`,
  );
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  main();
}
