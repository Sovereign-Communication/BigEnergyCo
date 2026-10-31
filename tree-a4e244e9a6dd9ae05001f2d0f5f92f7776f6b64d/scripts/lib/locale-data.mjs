// Node-only locale loader shared by validation scripts and tests. Browser code
// loads exactly one matching JSON file through shared/i18n.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const localeDirectory = new URL("../../assets/i18n/", import.meta.url);

export const LOCALE_IDS = Object.freeze(["en", "es", "pt", "fr", "de", "ar"]);
export const LOCALES = Object.freeze(
  Object.fromEntries(
    LOCALE_IDS.map((id) => [
      id,
      JSON.parse(
        readFileSync(
          fileURLToPath(new URL(`${id}.json`, localeDirectory)),
          "utf8",
        ),
      ),
    ]),
  ),
);
