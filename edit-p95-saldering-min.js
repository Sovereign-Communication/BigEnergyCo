const fs = require("node:fs");
const articlePath = "blog/salderingsregeling-stopt-2027/index.html";
const listingPath = "blog/index.html";
let html = fs.readFileSync(articlePath, "utf8");
const oldDescription = "De salderingsregeling stopt op 1 januari 2027. Wat betekent dat voor jouw zonnepanelen? Terugleververgoeding, eigen verbruik en een eerlijk rekenvoorbeeld.";
const description = "Wat verandert er op 1 januari 2027? Lees de regels voor teruglevering en bekijk een rekenvoorbeeld met expliciete aannames.";
function replaceOnce(text, regex, value, label) {
  if (!regex.test(text)) throw new Error(`Missing ${label}`);
  return text.replace(regex, value);
}
html = replaceOnce(html, /<p class="meta">[\s\S]*?<\/p>/, `<p class="meta">
          Lucas Ballek · Laatst gecontroleerd:
          <time datetime="2026-10-22">22 oktober 2026</time> · informatieve uitleg,
          geen contract- of belastingadvies
        </p>`, "article byline");
if (!html.includes(oldDescription)) throw new Error("Missing article description");
html = html.replaceAll(oldDescription, description);
html = replaceOnce(html, /"dateModified": "2026-10-16T00:00:00Z"/, '"dateModified": "2026-10-22T00:00:00Z"', "article dateModified");
html = html.replace(/<meta\b[^>]*>/g, (tag) => /property="article:modified_time"/.test(tag) ? tag.replace(/content="[^"]*"/, 'content="2026-10-22T00:00:00Z"') : tag);
html = html.replace('&#128242; Install App', 'Install App');
html = replaceOnce(html, /(<h2>De drie dingen die je met je zonnestroom kunt doen<\/h2>\s*<p>)[\s\S]*?(<\/p>)/, '$1Vanaf 2027 worden afname en teruglevering apart afgerekend. De waarden hieronder zijn voorbeelden met een aangenomen inkooptarief van € 0,30 en kaal leveringstarief van € 0,12 — geen landelijk gemiddelde of actuele contractofferte.$2', "value comparison intro");
html = replaceOnce(html, /<tr>\s*<td><strong>Opslaan in een thuisbatterij<\/strong><\/td>[\s\S]*?<\/tr>/, `<tr>
                <td><strong>Opslaan in een thuisbatterij</strong></td>
                <td class="num"><strong>Verschilt</strong></td>
                <td>
                  Hangt af van omzettingsverlies, bruikbare capaciteit,
                  gebruikspatroon, aansturing en totale kosten. Een vast
                  percentage verlies of rendement geldt niet voor ieder systeem.
                </td>
              </tr>`, "battery value row");
html = replaceOnce(html, /<p>\s*Kijk goed naar die verhoudingen:[\s\S]*?<\/p>/, `<p>
          Met de aangenomen tarieven is direct gebruik (€ 0,30) in dit
          voorbeeld vijf keer de vergoeding van € 0,06. Dit is geen algemene
          verhouding: contracttarieven en terugleverkosten verschillen.
        </p>`, "value comparison conclusion");
html = replaceOnce(html, /<p>\s*Neem een gemiddeld Nederlands huishouden:[\s\S]*?dat is het Nederlandse gemiddelde voor wie niets bijstuurt\.[\s\S]*?<\/p>/, `<p>
          Neem voor de berekening 10 panelen van 410 Wp (4,1 kWp), een
          veronderstelde opbrengst van 3.500 kWh per jaar en een verbruik van
          3.000 kWh. We nemen aan dat 30% van de zonnestroom direct wordt
          gebruikt. Dit zijn invoerwaarden voor het voorbeeld, geen Nederlands
          gemiddelde; dak, weer en verbruik veranderen de uitkomst.
        </p>`, "worked example assumptions");
html = replaceOnce(html, /<caption>\s*Jaarrekening na 2027: 10 panelen, 3\.000 kWh verbruik\s*<\/caption>/, `<caption>Illustratieve variabele stroomrekening na 2027</caption>`, "example table caption");
html = replaceOnce(html, /<td>Terugleververgoeding<\/td>/, `<td>Terugleververgoeding vóór terugleverkosten</td>`, "example export row");
html = replaceOnce(html, /<p>\s*Zonder panelen kost die 3\.000[\s\S]*?het verschil maakt\.[\s\S]*?<\/p>/, `<p>
          Zonder panelen kost de ingekochte stroom in dit voorbeeld € 900 per
          jaar. Het verschil met de berekende variabele rekening is € 462 per
          jaar vóór terugleverkosten en vaste kosten. Dit is geen
          terugverdientijd: aanschaf, installatie, financiering en onderhoud
          van de panelen zijn niet meegerekend.
        </p>`, "bill comparison explanation");
html = replaceOnce(html, /<p>\s*Til je het eigen verbruik met simpele maatregelen[\s\S]*?<\/p>/, `<p>
          Bij 50% direct eigen verbruik komt dezelfde voorbeeldrekening uit op
          € 630 variabele besparing per jaar. Elke 10 procentpunt extra eigen
          verbruik verplaatst hier 350 kWh van teruglevering naar eigen
          gebruik en scheelt € 84 per jaar vóór terugleverkosten. Dit blijft
          een rekenvoorbeeld, geen besparingsbelofte.
        </p>`, "self-consumption arithmetic");
html = replaceOnce(html, /<h2>Wordt een thuisbatterij nu interessant\?<\/h2>[\s\S]*?<\/p>/, `<h2>Wordt een thuisbatterij nu interessant?</h2>
        <p>
          Dat hangt af van de stroom die je kunt verschuiven, de efficiëntie
          van het gekozen systeem, je tarieven en de totale kosten. Deze
          pagina berekent geen batterijrendement of levensduur. Vergelijk
          productspecificaties, garanties en installatiekosten met je eigen
          verbruiksprofiel. Lees ook onze
          <a href="../is-a-home-battery-worth-it/">gids over thuisbatterijen</a>.
        </p>`, "battery section");
html = replaceOnce(html, /<p>\s*Of dat de batterij terugverdient[\s\S]*?<\/p>/, "", "stale battery lifetime claim");
html = html.replace(/\s*<li>\s*<strong>Na 2030 vervalt het minimum\.<\/strong>[\s\S]*?<\/li>/, "");
const caveats = `<h2>Eerlijke kanttekeningen</h2>
        <ul>
          <li><strong>Geen landelijk tarief.</strong> De prijzen en hoeveelheden hieronder zijn aannames voor een rekenvoorbeeld, geen voorspelling van een contract.</li>
          <li><strong>Terugleverkosten.</strong> De vergoeding van € 0,06 volgt uit de aangenomen kale prijs van € 0,12 en de wettelijke minimumregel tot 1 januari 2030. Mogelijke terugleverkosten zijn niet meegerekend.</li>
          <li><strong>Geen terugverdientijd.</strong> De berekening laat vaste kosten, aanschaf, financiering, installatie en onderhoud buiten beschouwing.</li>
          <li>Controleer de actuele tarieven en voorwaarden bij je leverancier; contracten verschillen.</li>
        </ul>`;
html = replaceOnce(html, /<h2>Eerlijke kanttekeningen<\/h2>\s*<ul>[\s\S]*?<\/ul>/, caveats, "tariff caveat");
html = replaceOnce(html, /<h2>Een dankwoord aan Nederland<\/h2>[\s\S]*?(?=<h2>Bronnen<\/h2>)/, "", "unsupported personal section");
html = replaceOnce(html, /<li>\s*ACM ConsuWijzer[\s\S]*?gemiddelde maandvergoeding\.[\s\S]*?<\/li>/, `<li>
            <a href="https://consument.acm.nl/elektriciteit-en-gas/duurzame-energie/wat-is-salderen">ACM ConsuWijzer: Salderen en terugleveren</a>
            — terugleverkosten, contracttarieven en afrekening vanaf 2027.
          </li>`, "ACM source link");
html = replaceOnce(html, /<div class="cta-box">[\s\S]*?<\/div>/, `<div class="cta-box">
          <p>
            <strong>Bekijk de locatiegebonden schatting.</strong> Gebruik de
            calculator om zonne-opbrengst en systeemsizing te verkennen. Dit
            is geen offerte of berekening van jouw energierekening.
          </p>
          <a class="btn" href="https://freeoffgridcalculator.com/#sizing"
            >Bekijk de calculator</a
          >
        </div>`, "calculator CTA");
const newFaq = "Dat hangt af van aanschaf- en installatiekosten, opbrengst, direct eigen verbruik, contracttarieven en terugleverkosten. Er is geen universeel antwoord. Het rekenvoorbeeld op deze pagina is geen terugverdientijdberekening.";
html = replaceOnce(html, /(<summary>Blijven zonnepanelen lonen na 2027\?<\/summary>\s*<p>)[\s\S]*?(<\/p>)/, (_, start, end) => start + newFaq + end, "visible payback FAQ");
const normalizeFaq = (value) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const visibleFaq = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map(([, q, a]) => ({ name: normalizeFaq(q), text: normalizeFaq(a) }));
let faqUpdated = false;
html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
  if (!body.includes('"@type": "FAQPage"')) return whole;
  const data = JSON.parse(body);
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
  const faq = graph.find((item) => item["@type"] === "FAQPage");
  if (!faq || !Array.isArray(faq.mainEntity)) throw new Error("FAQPage questions are missing");
  let updated = body;
  for (const { name, text } of visibleFaq) {
    const question = faq.mainEntity.find((item) => item.name === name);
    if (!question) throw new Error(`FAQPage is missing: ${name}`);
    const oldAnswer = JSON.stringify(question.acceptedAnswer.text);
    const newAnswer = JSON.stringify(text);
    if (!updated.includes(oldAnswer)) throw new Error(`FAQPage answer is missing: ${name}`);
    updated = updated.replace(oldAnswer, newAnswer);
  }
  faqUpdated = true;
  return whole.replace(body, updated);
});
if (!faqUpdated) throw new Error("FAQPage was not updated");fs.writeFileSync(articlePath, html);

let listing = fs.readFileSync(listingPath, "utf8");
const slug = "salderingsregeling-stopt-2027";
const cardLink = listing.indexOf(`href="./${slug}/"`);
if (cardLink < 0) throw new Error("Missing Dutch solar card");
const excerptStart = listing.indexOf('<p class="card-excerpt">', cardLink);
const excerptEnd = listing.indexOf("</p>", excerptStart) + 4;
const excerpt = "Vanaf 1 januari 2027 verandert salderen. Lees de regels voor teruglevering en bekijk een rekenvoorbeeld met expliciete aannames.";
listing = listing.slice(0, excerptStart) + `<p class="card-excerpt">\n              ${excerpt}\n            </p>` + listing.slice(excerptEnd);
listing = listing.replace(/<span>[^<]*16 okt 2026[^<]*<\/span>/, '<span>16 okt 2026 · gecontroleerd 22 okt 2026</span>');
const marker = '"headline": "Salderingsregeling stopt in 2027: wat het betekent voor jouw zonnepanelen"';
const start = listing.indexOf(marker);
const next = listing.indexOf('"@type": "BlogPosting"', start + marker.length);
if (start < 0 || next < 0) throw new Error("Missing Dutch BlogPosting metadata");
let post = listing.slice(start, next);
post = post.replace(/("description": ")[^"]*"/, (_, prefix) => prefix + excerpt + '"');
post = post.replace(/("dateModified": ")[^"]*"/, (_, prefix) => prefix + '2026-10-22T00:00:00Z"');
listing = listing.slice(0, start) + post + listing.slice(next);
fs.writeFileSync(listingPath, listing);