import { pathToFileURL } from "node:url";
const moduleUrl = pathToFileURL("C:/tmp/pr232-jev-quality/scripts/lib/jev-live.mjs");
const { resolveKeys } = await import(moduleUrl);
console.log(JSON.stringify({typesafeKeyAvailable:Boolean(resolveKeys(process.cwd()).typesafeKey)}));