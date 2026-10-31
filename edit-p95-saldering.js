const fs = require("node:fs");

function formatJsonScript(whole, body, data) {
  const baseIndent = body.match(/^\s*\n([ \t]*)\{/)?.[1] ?? "      ";
  const closingIndent = body.match(/\n([ \t]*)$/)?.[1] ?? "";
  const json = JSON.stringify(data, null, 2)
    .split("\n")
    .map((line) => baseIndent + line)
    .join("\n");
  return whole.replace(body, `\n${json}\n${closingIndent}`);
}function replaceOnce(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Expected one match for ${label}`);
  return text.replace(regex, replacement);
}
function replaceSection(text, start, end, replacement) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing section boundary: ${start} / ${end}`);
  return text.slice(0, from) + replacement + "\n\n        " + text.slice(to);
}
const articlePath = "blog/salderingsregeling-stopt-2027/index.html";
let html = fs.readFileSync(articlePath, "utf8");
const description = "Wat verandert er op 1 januari 2027? Lees de regels voor teruglevering en bekijk een rekenvoorbeeld met expliciete aannames.";

html = replaceOnce(html, /<p class="meta">[\s\S]*?<\/p>/, `<p class="meta">
          Lucas Ballek · Laatst gecontroleerd:
          <time datetime="2026-10-22">22 oktober 2026</time> · informatieve uitleg,
          geen contract- of belastingadvies
        </p>`, "article byline");
html = replaceOnce(html, /<p>\s*<em class="kicker">Het korte antwoord:<\/em>[\s\S]*?<\/p>/, `<p>
          <em class="kicker">Het korte antwoord:</em> De wettelijke
          salderingsregeling stopt op <strong>1 januari 2027</strong>. Vanaf die
          datum worden afgenomen en teruggeleverde stroom apart afgerekend.
          Leveranciers blijven een terugleververgoeding betalen; tot 1 januari
          2030 geldt een minimum van 50% van het kale leveringstarief. Je exacte
          rekening hangt af van je contract, verbruik, terugleverkosten en
          hoeveel zonnestroom je direct gebruikt.
        </p>`, "opening summary");

html = replaceSection(
  html,
  "<h2>De drie dingen die je met je zonnestroom kunt doen</h2>",
  "<h2>Rekenvoorbeeld: 10 panelen, 3.500 kWh per jaar</h2>",
  `<h2>Hoe verschilt de waarde per kWh?</h2>
        <p>
          Vanaf 2027 worden afname en teruglevering apart afgerekend. De waarde
          verschilt daarom per gebruik:
        </p>
        <ul>
          <li>
            <strong>Direct zelf gebruiken.</strong> Je vermijdt de variabele
            inkoopkosten voor die stroom. De uitkomst hangt af van je contract
            en het tijdstip waarop je stroom gebruikt.
          </li>
          <li>
            <strong>Terugleveren.</strong> Je leverancier betaalt een
            vergoeding. Tot 1 januari 2030 is die minimaal 50% van het kale
            leveringstarief; eventuele terugleverkosten moet je apart
            meetellen.
          </li>
          <li>
            <strong>Opslaan in een batterij.</strong> Opslag kan een deel van
            het overschot verschuiven, maar omzettingsverlies, vermogen,
            gebruikspatroon en aanschaf- en installatiekosten bepalen de
            uitkomst. Een vast rendement geldt niet voor iedere woning.
          </li>
        </ul>`
);
html = replaceSection(
  html,
  "<h2>Rekenvoorbeeld: 10 panelen, 3.500 kWh per jaar</h2>",
  "<h2>Eigen verbruik verhogen: zo doe je dat</h2>",
  `<h2>Rekenvoorbeeld met expliciete aannames</h2>
        <p>
          Dit is een rekenvoorbeeld, geen landelijk gemiddelde of voorspelling.
          Stel: panelen wekken 3.500 kWh per jaar op, het huishouden gebruikt
          3.000 kWh en gebruikt 30% van de zonnestroom direct. Voor de
          berekening nemen we € 0,30 per ingekochte kWh en een kaal
          leveringstarief van € 0,12. De wettelijke minimumvergoeding is in
          dit voorbeeld dus € 0,06 per teruggeleverde kWh. Werkelijke opbrengst
          en tarieven verschillen per dak, contract en leverancier.
        </p>
        <table>
          <caption>Illustratieve variabele stroomrekening na 1 januari 2027</caption>
          <thead>
            <tr><th scope="col">Post</th><th scope="col">Berekening</th><th scope="col">Bedrag</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Direct eigen verbruik</th><td>1.050 kWh × € 0,30 vermeden inkoop</td><td>€ 315</td></tr>
            <tr><th scope="row">Terugleververgoeding</th><td>2.450 kWh × € 0,06, vóór terugleverkosten</td><td>€ 147</td></tr>
            <tr><th scope="row">Stroom uit het net</th><td>1.950 kWh × € 0,30</td><td>−€ 585</td></tr>
            <tr><th scope="row">Netto variabele kosten met panelen</th><td>€ 585 − € 147</td><td>€ 438 per jaar</td></tr>
          </tbody>
        </table>
        <p>
          Zonder panelen zou de variabele stroom in dit voorbeeld € 900 kosten.
          Het verschil is € 462 per jaar vóór terugleverkosten en vaste kosten;
          dit bedrag is geen terugverdientijd en trekt de aanschaf, financiering,
          onderhoud of installatie van de panelen niet af.
        </p>
        <p>
          Bij 50% direct eigen verbruik verschuiven 700 kWh van teruglevering
          naar eigen gebruik. Met dezelfde aannames komt de variabele
          rekeningbesparing uit op € 630 per jaar. Iedere extra 10
          procentpunt eigen verbruik verplaatst hier 350 kWh en scheelt € 84
          per jaar vóór terugleverkosten. Dit is alleen de uitkomst van dit
          voorbeeld; het is geen besparingsbelofte.
        </p>`
);
html = replaceSection(
  html,
  "<h2>Wordt een thuisbatterij nu interessant?</h2>",
  "<h2>Eerlijke kanttekeningen</h2>",
  `<h2>Is een thuisbatterij interessant?</h2>
        <p>
          Dat hangt af van de stroom die je kunt verschuiven, het rendement van
          het gekozen systeem, je tarieven en de totale kosten. Deze
          net-meteringberekening modelleert geen batterij en voorspelt geen
          levensduur of terugverdientijd. Vergelijk productspecificaties,
          garanties, installatiekosten en je eigen verbruiksprofiel voordat je
          een aanbod beoordeelt. Lees ook onze
          <a href="../is-a-home-battery-worth-it/">gids over thuisbatterijen</a>.
        </p>`
);
html = replaceSection(
  html,
  "<h2>Eerlijke kanttekeningen</h2>",
  "<h2>Een dankwoord aan Nederland</h2>",
  `<h2>Aannames en grenzen</h2>
        <ul>
          <li>
            De tarieven en hoeveelheden in het voorbeeld zijn rekenaannames,
            geen actuele Nederlandse gemiddelde prijzen of leveranciersaanbod.
          </li>
          <li>
            De vergoeding van € 0,06 volgt alleen uit de gekozen kale prijs van
            € 0,12 en de wettelijke minimumregel tot 1 januari 2030. Mogelijke
            terugleverkosten staan niet in de voorbeeldrekening.
          </li>
          <li>
            De berekening laat vaste leverings- en netbeheerkosten,
            financiering, aanschaf, installatie en onderhoud buiten
            beschouwing. Ze geeft dus geen oordeel over terugverdientijd.
          </li>
          <li>
            Controleer de actuele voorwaarden bij je leverancier. De
            Rijksoverheid en ACM leggen de wettelijke regels uit; je contract
            bepaalt je tarieven.
          </li>
        </ul>`
);
html = replaceSection(
  html,
  "<h2>Een dankwoord aan Nederland</h2>",
  "<h2>Bronnen</h2>",
  ""
);

const sourceHeading = html.indexOf("<h2>Bronnen</h2>");
const sourceStart = html.indexOf("<ul>", sourceHeading);
const sourceEnd = html.indexOf("</ul>", sourceStart) + "</ul>".length;
if (sourceHeading < 0 || sourceStart < 0 || sourceEnd < 6) throw new Error("Missing source list");
html = html.slice(0, sourceStart) + `<ul>
          <li>
            <a href="https://www.rijksoverheid.nl/themas/klimaat-milieu-en-natuur/energie-thuis/salderingsregeling">Rijksoverheid: Salderingsregeling stopt in 2027</a>
            — einddatum, aparte vergoeding, de minimumvergoeding tot 2030 en direct eigen verbruik.
          </li>
          <li>
            <a href="https://consument.acm.nl/elektriciteit-en-gas/duurzame-energie/wat-is-salderen">ACM ConsuWijzer: Salderen en terugleveren</a>
            — contracttarieven, terugleverkosten en afrekening vanaf 2027.
          </li>
        </ul>` + html.slice(sourceEnd);
html = replaceOnce(html, /<div class="cta-box">[\s\S]*?<\/div>/, `<div class="cta-box">
          <p>
            <strong>Bekijk de locatiegebonden schatting.</strong> Gebruik de
            calculator om zonne-opbrengst en systeemsizing te verkennen. De
            calculator is geen offerte of berekening van jouw energierekening.
          </p>
          <a class="btn" href="https://freeoffgridcalculator.com/#sizing"
            >Bekijk de calculator</a
          >
        </div>`, "calculator call to action");
html = replaceOnce(html, /<h2>Veelgestelde vragen<\/h2>[\s\S]*?<\/article>/, `<h2>Veelgestelde vragen</h2>
        <details>
          <summary>Stopt salderen echt op 1 januari 2027?</summary>
          <p>
            Ja. De Rijksoverheid zegt dat de wettelijke regeling op 1 januari
            2027 stopt. Vanaf die datum worden afname en teruglevering apart
            afgerekend.
          </p>
        </details>
        <details>
          <summary>Wat krijg ik na 2027 voor teruggeleverde stroom?</summary>
          <p>
            Je leverancier betaalt een terugleververgoeding. Tot 1 januari
            2030 geldt een minimum van 50% van het kale leveringstarief,
            zonder energiebelasting en btw. De precieze vergoeding volgt uit
            je contract.
          </p>
        </details>
        <details>
          <summary>Wat is het kale leveringstarief?</summary>
          <p>
            Dat is de prijs voor de geleverde stroom zonder energiebelasting
            en btw. Bij een aangenomen tarief van € 0,12 is de helft € 0,06;
            dat is een voorbeeld, geen voorspelling van jouw contracttarief.
          </p>
        </details>
        <details>
          <summary>Mag mijn leverancier terugleverkosten blijven rekenen?</summary>
          <p>
            Ja. De ACM zegt dat leveranciers kosten voor teruglevering mogen
            rekenen en duidelijk moeten uitleggen waarvoor je betaalt. Die
            kosten verschillen per contract en kunnen hoger zijn dan de
            vergoeding.
          </p>
        </details>
        <details>
          <summary>Blijven zonnepanelen lonen na 2027?</summary>
          <p>
            Dat hangt af van de aanschaf- en installatiekosten, opbrengst,
            direct eigen verbruik, contracttarieven en terugleverkosten. Er is
            geen universeel antwoord. Het rekenvoorbeeld op deze pagina is
            geen terugverdientijdberekening.
          </p>
        </details>
      </article>`, "visible FAQ");

const faqEntries = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map(([, q, a]) => ({ name: q, text: a }));
const plain = (value) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
if (faqEntries.length !== 5) throw new Error(`Expected five visible FAQs, found ${faqEntries.length}`);
const oldDescription = "De salderingsregeling stopt op 1 januari 2027. Wat betekent dat voor jouw zonnepanelen? Terugleververgoeding, eigen verbruik en een eerlijk rekenvoorbeeld.";
if (!html.includes(oldDescription)) throw new Error("Missing original article description");
html = html.replaceAll(oldDescription, description);
html = html.replace(/"dateModified": "2026-10-16T00:00:00Z"/, '"dateModified": "2026-10-22T00:00:00Z"');
function updateFaqScript(body) {
  let updated = body;
  for (const { name, text } of faqEntries) {
    const marker = `"name": ${JSON.stringify(plain(name))},`;
    const question = updated.indexOf(marker);
    if (question < 0) throw new Error(`FAQ JSON is missing ${plain(name)}`);
    const key = updated.indexOf('"text": ', question);
    if (key < 0) throw new Error(`FAQ answer is missing ${plain(name)}`);
    const quote = updated.indexOf('"', key + '"text": '.length);
    let end = quote + 1;
    let escaped = false;
    for (; end < updated.length; end += 1) {
      const char = updated[end];
      if (!escaped && char === '"') break;
      if (!escaped && char === "\\") escaped = true;
      else escaped = false;
    }
    if (end >= updated.length) throw new Error(`FAQ answer is unterminated ${plain(name)}`);
    updated = updated.slice(0, quote) + JSON.stringify(plain(text)) + updated.slice(end + 1);
  }
  return updated;
}
let updatedFaq = false;
html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
  if (!body.includes('"@type": "FAQPage"')) return whole;
  updatedFaq = true;
  return whole.replace(body, updateFaqScript(body));
});
if (!updatedFaq) throw new Error("FAQPage schema was not updated");html = replaceOnce(html, /<meta\b[^>]*>/g, (tag) => tag, "meta tags");
html = html.replace(/<meta\b[^>]*>/g, (tag) => {
  if (/name="description"|property="og:description"|name="twitter:description"/.test(tag)) {
    return tag.replace(/content="[^"]*"/, `content="${description}"`);
  }
  if (/property="article:modified_time"/.test(tag)) {
    return tag.replace(/content="[^"]*"/, 'content="2026-10-22T00:00:00Z"');
  }
  return tag;
});
fs.writeFileSync(articlePath, html);

const listingPath = "blog/index.html";
let listing = fs.readFileSync(listingPath, "utf8");
const slug = "salderingsregeling-stopt-2027";
const cardLink = listing.indexOf(`href="./${slug}/"`);
if (cardLink < 0) throw new Error("Missing Dutch solar article card");
const excerptStart = listing.indexOf('<p class="card-excerpt">', cardLink);
const excerptEnd = listing.indexOf("</p>", excerptStart) + 4;
if (excerptStart < 0 || excerptEnd < 4) throw new Error("Missing article card excerpt");
const excerpt = "Vanaf 1 januari 2027 verandert salderen. Lees de regels voor teruglevering en bekijk een rekenvoorbeeld met expliciete aannames.";
listing = listing.slice(0, excerptStart) + `<p class="card-excerpt">\n              ${excerpt}\n            </p>` + listing.slice(excerptEnd);
listing = listing.replace(/<span>[^<]*16 okt 2026[^<]*<\/span>/, '<span>16 okt 2026 · gecontroleerd 22 okt 2026</span>');
const postMarker = '"headline": "Salderingsregeling stopt in 2027: wat het betekent voor jouw zonnepanelen"';
const postStart = listing.indexOf(postMarker);
const nextPost = listing.indexOf('"@type": "BlogPosting"', postStart + postMarker.length);
if (postStart < 0 || nextPost < 0) throw new Error("Could not locate the Dutch BlogPosting metadata");
let postBlock = listing.slice(postStart, nextPost);
postBlock = postBlock.replace(/("description": ")[^"]*"/, (_, prefix) => prefix + excerpt + '"');
postBlock = postBlock.replace(/("dateModified": ")[^"]*"/, (_, prefix) => prefix + '2026-10-22T00:00:00Z"');
listing = listing.slice(0, postStart) + postBlock + listing.slice(nextPost);fs.writeFileSync(listingPath, listing);