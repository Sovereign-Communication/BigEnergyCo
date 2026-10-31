import { LOCALES } from "file:///C:/tmp/be-mission-pr230-20261022/assets/js/shared/locales.js";
const en = LOCALES.en;
const nl = LOCALES.nl;
const missing = Object.keys(en).filter((key) => !(key in nl)).sort();
console.log(JSON.stringify(missing.map((key) => [key, en[key]]), null, 2));
console.log(`missing=${missing.length} extra=${Object.keys(nl).filter((key) => !(key in en)).join(",")}`);