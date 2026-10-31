import fs from 'node:fs';
const file = 'blog/battery-longevity-and-dod-reference/index.html';
let html = fs.readFileSync(file, 'utf8');
const ldPattern = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
const ldMatch = html.match(ldPattern);
if (!ldMatch) throw new Error('JSON-LD block not found');
const graph = JSON.parse(ldMatch[2]);
const faq = graph['@graph'].find((item) => item['@type'] === 'FAQPage');
const updates = [
  {
    name: 'Can a sodium-ion battery be discharged to 0 V?',
    text: 'There is no chemistry-wide cell-voltage cutoff that can be treated as a normal discharge target. The permitted lower voltage and instructions after over-discharge depend on the exact cell or pack. Follow that product’s data sheet and battery-management-system limits; do not infer a safe endpoint from the chemistry name.'
  },
  {
    name: 'How much of a sodium-ion battery can a standard inverter use?',
    text: 'There is no chemistry-wide usable percentage. Usable energy depends on the exact cell or pack voltage range, inverter low-voltage settings, and battery-management system. CATL describes dedicated voltage regulation and a sodium-specific battery-management system for its TENER Sodium system; that product-specific design does not establish a cutoff or usable fraction for other packs. Check the manuals and compatibility information for the exact battery and inverter before pairing them.'
  },
  {
    name: 'Can an oversized AGM battery bank be expected to last 20 years?',
    text: 'Do not infer a 20-year service life or fixed replacement count from bank size alone. Service depends on the exact model and duty cycle. Discover’s Standard AGM Performance data sheet says stand-by life depends on frequency and depth of discharge, charge voltage, and ambient temperature; cyclic life also depends on capacity taken, discharge rate, operating temperature, and charging method. Use the exact product data sheet and label any projection as an estimate.'
  },
  {
    name: 'Does oversizing a battery bank always save money?',
    text: 'No. A larger bank may change operating depth of discharge for a given load, but that alone does not establish cycle life, service life, or lifetime cost. Compare the exact battery model, usable capacity, installed price, warranty, operating conditions, replacement assumptions, and analysis period using the inputs listed above. Do not claim a saving or replacement schedule without sourced assumptions.'
  }
];
for (let i = 0; i < updates.length; i++) {
  faq.mainEntity[i + 1].name = updates[i].name;
  faq.mainEntity[i + 1].acceptedAnswer.text = updates[i].text;
}
const indentJson = JSON.stringify(graph, null, 2).split('\n').map((line) => `      ${line}`).join('\n');
html = html.replace(ldPattern, `${ldMatch[1]}\n${indentJson}\n    ${ldMatch[3]}`);
const visiblePattern = /<div class="faq-item">\s*<div class="faq-question">([\s\S]*?)<\/div>\s*<div class="faq-answer">([\s\S]*?)<\/div>\s*<\/div>/g;
let itemIndex = 0;
html = html.replace(visiblePattern, (whole, question, answer) => {
  if (itemIndex === 0) { itemIndex++; return whole; }
  const update = updates[itemIndex - 1];
  if (!update) throw new Error(`Unexpected FAQ item ${itemIndex}`);
  let visibleText = update.text
    .replace('CATL describes dedicated voltage regulation and a sodium-specific battery-management system for its TENER Sodium system', '<a href="https://www.catl.com/en/news/6861.html" target="_blank" rel="noopener">CATL describes dedicated voltage regulation and a sodium-specific battery-management system for its TENER Sodium system</a>')
    .replace('Discover’s Standard AGM Performance data sheet', '<a href="https://assets.discoverbattery.com/documents/07_sla/885_product_literature/standard-agm-battery-performance.pdf" target="_blank" rel="noopener">Discover’s Standard AGM Performance data sheet</a>');
  itemIndex++;
  return `        <div class="faq-item">\n          <div class="faq-question">\n            ${update.name}\n          </div>\n          <div class="faq-answer">\n            ${visibleText}\n          </div>\n        </div>`;
});
if (itemIndex !== 5) throw new Error(`Expected 5 visible FAQ items, found ${itemIndex}`);
fs.writeFileSync(file, html, 'utf8');