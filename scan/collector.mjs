// Local collector: the brand domain only answers a real browser (a JS
// challenge), so the only way to bring its bytes somewhere they can be compared
// with the repo's own canonicaliser is to have the browser hand them over.
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";

const DIR = "/c/tmp/scan/brand";
mkdirSync(DIR, { recursive: true });

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  const name = new URL(req.url, "http://localhost").searchParams.get("name");
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const file = `${DIR}/${String(name || "blob").replace(/[^a-z0-9._-]/gi, "_")}`;
    writeFileSync(file, body);
    console.log(`COLLECTED ${file} ${body.length} bytes`);
    res.writeHead(200, { "content-type": "text/plain" }).end(String(body.length));
  });
}).listen(8899, "127.0.0.1", () => console.log("collector listening on 127.0.0.1:8899"));
