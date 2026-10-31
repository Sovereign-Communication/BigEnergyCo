const fs = require("node:fs");
const p = "blog/salderingsregeling-stopt-2027/index.html";
let h = fs.readFileSync(p, "utf8");
const from = h.indexOf("<h2>Bronnen</h2>");
const end = h.indexOf("</ul>", from);
if (from < 0 || end < 0) throw new Error("Sources list not found");
const item = `          <li>
            <a href="https://zoek.officielebekendmakingen.nl/stcrt-2025-43817.html">Staatscourant 2025, 43817</a>
            — weighted monthly average of the feed-in compensation may not be negative.
          </li>
`;
h = h.slice(0, end) + item + h.slice(end);
fs.writeFileSync(p, h);