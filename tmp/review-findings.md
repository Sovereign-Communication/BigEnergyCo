# Translation meaning review — findings (working)

Reviewer: AI fluent back-read (Buffy/Codebuff lane), 2026-10-24. Source of truth: English values in assets/js/shared/locales.js at eabb378c.

## Chunk 1 (keys homeIntro..rateLimitDisclaimer)

1. quickSetupTitle — NL missing the "⚡ " prefix all six other locales carry (rendering parity).
2. EN source spacing defects (rendered strings): " ," in applianceWattages ("per day , capped"), emailSupportExpectations ("financial advice , and"), footerWarranty ("of any kind , express"); trailing " :" in feedInCreditLabel, fixedMonthlyChargeLabel, independenceTarget, billCutTarget. (FR " :" is correct French typography — keep.)
3. NL uses anglicism "engineer" in donationTerms, emailSupportExpectations, resultEstimateDisclaimer where independentVerification uses "ingenieur" — terminology inconsistency (borderline readable).

## Chunk 2 (keys monthlyBillHint..readoutBillIncomplete)

4. runBtn — missing "☀️ " in es/pt/fr/ar (DE/NL/EN have it); runBtnReady has it in pt/fr/ar. The CTA visibly changes between states. VERIFY usage before fixing.
5. heroTag — missing "🌍 " in es/pt/fr (en/de/nl have it). VERIFY.
6. statusSuccess — AR "من البيانات الساعة" ungrammatical for "of hourly data"; should be "البيانات الساعية".
7. offlineNote — es "modo offline típico", pt "modo offline típico", fr "mode hors ligne typique" all drop the "year" of EN "offline typical-year mode"; de/nl/ar keep it.
8. AR button-name inconsistency for "Size My System": runBtn/inputsChanged/shareLoaded use "احسب نظامي"; quickSetupHint/preciseLocationHelp use "تحديد حجم النظام"; navSizing uses "صمّم نظامك". References to the button should match the button's own AR label. VERIFY against terminology anchors.
9. borderline: errorSim/errorTimeout name the sizing engine differently in DE ("Dimensionierungs-Engine" vs "Auslegungssoftware") and AR ("محرك التقدير" vs "محرك الحساب").
10. borderline: FR mixed straight/curly apostrophes (heroIntro "l'excédent", heroTitle1 "d'électricité", errorTimeout "n'a") vs "’" elsewhere.
11. borderline: tariffSpendLine AR "بعد الشمسي" — adjective used as noun ("after the solar"); needs "بعد الطاقة الشمسية" or "بعد الألواح".
12. borderline: footerHeatmap NL "Wereldkaart" loses "heat" (consistent internally).

## Chunk 3 (keys readoutKwhEmpty..frontierCeilingTag)

13. frontierIntro — DE is NOT a translation: drops EN's second sentence entirely ("The line is the best result any budget can buy — so you can see at a glance whether your goal here is easy, expensive, or out of reach") and rewrites the first. MATERIAL MEANING LOSS. Fix.
14. advisorBusy — ES truncated word: "está satur ahora" -> "está saturado ahora". Fix.
15. advisorSubtitle — DE "nur Bildungswerte" is not idiomatic for "educational estimates"; rest of DE uses "Lernschätzung". Fix to "nur Lernschätzungen".
16. sanityTooltip — DE broken agreement: "kein Standort, Text oder personenbezogener Daten verlässt" (mixed sing/plural). Fix.
17. borderline: sanityOk/sanityFlag NL "fysisch" (vs natuurkundig); simpleWhatItMeans DE "Paneele" (vs Module elsewhere); advisorPlaceholder "sodio-ion"/"sódio-ion"; frontierTitle AR "مالك" ambiguous (money vs owner).
18. borderline: readoutKwhEmpty es/pt/ar add "to see the estimate" not in EN.
