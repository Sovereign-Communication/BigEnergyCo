import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const dirs = readdirSync("blog", { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== "assets");
const clean = s => s.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
for (const d of dirs) {
 const f = join("blog", d.name, "index.html"); const html = readFileSync(f, "utf8");
 const main = html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1] || html;
 const title = clean(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
 const headings = [...main.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => clean(m[1]));
 const body = clean(main);
 const nums = [...new Set(body.match(/(?:[$€£]\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:kWh|kW|W|Ah|V|%|years?|months?|days?|hours?|minutes?|°C|°F|degrees?|MPH|mph|watts?|cycles?)\b|\b(?:19|20)\d{2}\b)/gi) || [])];
 const links = [...main.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => clean(m[2]) + " => " + m[1]).slice(0, 18);
 const ld = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1])}catch{return null}}).filter(Boolean);
 const date = ld.flatMap(x => Array.isArray(x["@graph"])?x["@graph"]:[x]).find(x => ["BlogPosting","Article"].includes(x["@type"])) || {};
 const reviewed = body.match(/last reviewed[^.]{0,80}/i)?.[0] || "";
 console.log(JSON.stringify({file:d.name,title,headings,claims:nums,links,datePublished:date.datePublished,dateModified:date.dateModified,reviewed,bodyStart:body.slice(0,480)}));
}
