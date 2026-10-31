import fs from "node:fs";
const path = "blog/how-to-cut-electricity-bill-with-solar/index.html";
let html = fs.readFileSync(path, "utf8");
const eol = html.includes("\r\n") ? "\r\n" : "\n";
const start = html.indexOf("        <h2>Compare the complete system price</h2>");
const end = html.indexOf("        <h2>What the estimate can and cannot tell you</h2>", start);
if (start < 0 || end < 0) throw new Error("comparison section markers not found");
const lines = [
  "        <h2>Compare the complete system price</h2>",
  "        <p>",
  "          Compare offers against the same scope. Equipment or cell-only prices are not the cost of a finished installed system.",
  "        </p>",
  "        <div class=\"table-container\">",
  "          <table>",
  "            <caption>Items to verify in a solar and storage quote</caption>",
  "            <thead>",
  "              <tr>",
  "                <th scope=\"col\">Quote item</th>",
  "                <th scope=\"col\">What to confirm</th>",
  "              </tr>",
  "            </thead>",
  "            <tbody>",
  "              <tr>",
  "                <td>Solar generation</td>",
  "                <td>Panels, inverter, mounting, wiring, labor, and electrical upgrades.</td>",
  "              </tr>",
  "              <tr>",
  "                <td>Battery storage</td>",
  "                <td>Usable capacity and power, protection, enclosure, shipping, and installation.</td>",
  "              </tr>",
  "              <tr>",
  "                <td>Project and service</td>",
  "                <td>Permits, inspection, interconnection, taxes, financing, warranty, and replacement terms.</td>",
  "              </tr>",
  "              <tr>",
  "                <td>DIY build</td>",
  "                <td>Battery-management system, tools, support, inspection, and qualified electrical work.</td>",
  "              </tr>",
  "            </tbody>",
  "          </table>",
  "        </div>",
  "",
  "",
].join(eol);
html = html.slice(0, start) + lines + html.slice(end);
fs.writeFileSync(path, html, "utf8");
