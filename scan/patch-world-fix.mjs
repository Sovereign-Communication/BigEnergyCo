// Applies the worldwide-market copy fixes to /c/tmp/world-fix, preserving CRLF.
// Every replacement asserts it matched exactly once, so a silent no-op cannot
// pass as a fix.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = "C:/tmp/world-fix";
let applied = 0;

function patch(file, pairs) {
  const path = `${ROOT}/${file}`;
  let src = readFileSync(path, "utf8");
  for (const [oldText, newText, label] of pairs) {
    const count = src.split(oldText).length - 1;
    if (count !== 1) {
      console.error(`FAIL ${file}: ${label} matched ${count} times (want 1)`);
      process.exit(1);
    }
    src = src.replace(oldText, newText);
    applied++;
  }
  writeFileSync(path, src);
  console.log(`OK   ${file}: ${pairs.length} replacement(s)`);
}

// ── 1. locales.js ───────────────────────────────────────────────────────────
// The three keys whose sentences interpolated an imperative label ("Cut my
// electricity bill") into a noun slot and an "of …" metric fragment into a
// prepositional slot, which reads as "Your Cut my electricity bill result" and
// "Measured for Cut my electricity bill against of your bill removed over 20
// years". The label stays where it can read as a heading (after a colon), and
// the metric fragment stays where it belongs: under the number it labels.
patch("assets/js/shared/locales.js", [
  [
    `    useCaseOutcomeTitle: "Your {useCase} result",\r\n    useCaseVerdictFooter:\r\n      "Measured for {useCase} against {metric}, using this location's own hourly weather.",\r\n    useCaseNotMeasured:\r\n      "Not measured: this combination cannot be sized at all, so there is no {metric} to report.",`,
    `    useCaseOutcomeTitle: "Your result: {useCase}",\r\n    useCaseVerdictFooter:\r\n      "{useCase} — measured from this location's own hourly weather, not an estimate.",\r\n    useCaseNotMeasured:\r\n      "Not measured: this combination cannot be sized at all, so there is no number to report here.",`,
    "en use-case card sentences",
  ],
  [
    `    useCaseOutcomeTitle: "Tu resultado de {useCase}",\r\n    useCaseVerdictFooter:\r\n      "Medido para {useCase} frente a {metric}, con el clima horario de esta ubicación.",\r\n    useCaseNotMeasured:\r\n      "Sin medir: esta combinación no se puede dimensionar, así que no hay {metric} que informar.",`,
    `    useCaseOutcomeTitle: "Tu resultado: {useCase}",\r\n    useCaseVerdictFooter:\r\n      "{useCase}: medido con el clima horario de esta ubicación, no es una estimación.",\r\n    useCaseNotMeasured:\r\n      "Sin medir: esta combinación no se puede dimensionar, así que no hay ningún número que informar.",`,
    "es use-case card sentences",
  ],
  [
    `    useCaseOutcomeTitle: "Seu resultado de {useCase}",\r\n    useCaseVerdictFooter:\r\n      "Medido para {useCase} em relação a {metric}, com o clima horário deste local.",\r\n    useCaseNotMeasured:\r\n      "Sem medir: esta combinação não pode ser dimensionada, então não há {metric} a informar.",`,
    `    useCaseOutcomeTitle: "Seu resultado: {useCase}",\r\n    useCaseVerdictFooter:\r\n      "{useCase}: medido com o clima horário deste local — não é uma estimativa.",\r\n    useCaseNotMeasured:\r\n      "Sem medir: esta combinação não pode ser dimensionada, então não há número a informar.",`,
    "pt use-case card sentences",
  ],
  [
    `    useCaseVerdictFooter:\r\n      "Mesuré pour {useCase} au regard de {metric}, avec la météo horaire de ce lieu.",\r\n    useCaseNotMeasured:\r\n      "Non mesuré : cette combinaison ne peut pas être dimensionnée, il n'y a donc pas de {metric} à annoncer.",`,
    `    useCaseVerdictFooter:\r\n      "{useCase} : mesuré avec la météo horaire de ce lieu — pas une estimation.",\r\n    useCaseNotMeasured:\r\n      "Non mesuré : cette combinaison ne peut pas être dimensionnée, il n'y a donc aucun chiffre à annoncer.",`,
    "fr use-case card sentences",
  ],
  [
    `    useCaseVerdictFooter:\r\n      "Gemessen für {useCase} anhand von {metric}, mit dem stündlichen Wetter dieses Ortes.",\r\n    useCaseNotMeasured:\r\n      "Nicht gemessen: Diese Kombination lässt sich überhaupt nicht auslegen, es gibt also kein {metric} zu nennen.",`,
    `    useCaseVerdictFooter:\r\n      "{useCase}: gemessen mit dem stündlichen Wetter dieses Ortes — keine Schätzung.",\r\n    useCaseNotMeasured:\r\n      "Nicht gemessen: Diese Kombination lässt sich überhaupt nicht auslegen, es gibt also keine Zahl zu nennen.",`,
    "de use-case card sentences",
  ],
  [
    `    useCaseVerdictFooter:\r\n      "قِيست لـ {useCase} مقابل {metric}، باستخدام بيانات الطقس الساعية لهذا الموقع.",\r\n    useCaseNotMeasured:\r\n      "غير مقيس: هذا التركيب لا يمكن تحجيمه أصلًا، فلا يوجد {metric} للإبلاغ عنه.",`,
    `    useCaseVerdictFooter:\r\n      "{useCase}: قِيست باستخدام الطقس الساعي لهذا الموقع، وليست تقديرًا.",\r\n    useCaseNotMeasured:\r\n      "غير مقيس: هذا التركيب لا يمكن تحجيمه أصلًا، فلا يوجد رقم للإبلاغ عنه.",`,
    "ar use-case card sentences",
  ],
]);

// ── 2. ui.js ────────────────────────────────────────────────────────────────
// The call sites stop passing the metric fragment into sentences that cannot
// take it, and the time-of-use verdict's cash slots stop rendering raw USD
// integers where a visitor expects money in their own currency.
patch("assets/js/sizing/ui.js", [
  [
    `      t("useCaseVerdictFooter", {\r\n        useCase: t(c.labelKey),\r\n        metric: t(o.labelKey),\r\n      }),`,
    `      t("useCaseVerdictFooter", { useCase: t(c.labelKey) }),`,
    "verdict footer call site",
  ],
  [
    `        t("useCaseNotMeasured", { metric: t(o.labelKey) }),`,
    `        t("useCaseNotMeasured"),`,
    "not-measured call site",
  ],
  [
    `    saving: round(m.touSavingUsd20y),\r\n    cost: round(m.touBatteryCostUsd20y),\r\n    spread: (Number(m.touSpreadPerKwh) || 0).toFixed(2),`,
    `    // Cash slots go through money() like every other amount on the page: the\n    // engine stores them in USD, and a bare integer reads as no currency at\n    // all to a reader whose money is in another one.\n    saving: money(m.touSavingUsd20y),\n    cost: money(m.touBatteryCostUsd20y),\n    spread: money(m.touSpreadPerKwh),`,
    "TOU verdict cash slots",
  ],
]);

// ── 3. build-city-pages.mjs ─────────────────────────────────────────────────
// The worked example stops quoting US-dollar benchmarks as a bare "$" on a
// page whose calculator shows the visitor's own currency, and stops presenting
// the band-derived battery illustration as the size the simulator will choose.
patch("scripts/build-city-pages.mjs", [
  [
    `      <p>Using the \${c.name} latitude band (\${lo}–\${hi} kWh/kWp/yr), a household using 10 kWh per day typically lands in this range — a rough illustration from the band (with a dark-week margin), not a simulation; your exact figures come from running it:</p>`,
    `      <p>Using the \${c.name} latitude band (\${lo}–\${hi} kWh/kWp/yr), a household using 10 kWh per day typically lands in this range — a rough illustration from the band (with a dark-week margin), not a simulation. The panel column follows that band; the battery column is the one the simulator re-sizes, because it sizes the bank against your own darkest week — so its number usually comes out higher. Your exact figures come from running it:</p>`,
    "worked-example intro",
  ],
  [
    `      <p>\${wx.paybackLine}</p>`,
    `      <p><em>Every money figure here is in US dollars; the calculator converts to your own currency.</em> \${wx.paybackLine}</p>`,
    "payback paragraph",
  ],
]);

console.log(`\n${applied} replacement(s) applied under ${ROOT}`);
