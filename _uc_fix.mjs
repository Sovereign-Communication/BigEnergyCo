import { readFileSync, writeFileSync } from "node:fs";

const file = "C:/tmp/be-usecase-20261028/assets/js/sizing/ui.js";
const raw = readFileSync(file, "utf8");
const toCrlf = (s) => s.split("\n").join("\r\n");

const edits = [];

// A3: route the goal through the case before touching any chrome.
edits.push({
  label: "route setGoal through applyUseCase",
  old: [
    "  const setGoal = (goal) => {",
    '    const isGt = goal === "gridtie";',
    "    if (isGt) {",
  ].join("\n"),
  next: [
    "  const setGoal = (goal) => {",
    '    const isGt = goal === "gridtie";',
    "    // Single writer: the goal buttons never touch systemGoal. They select a",
    "    // CASE and let applyUseCase derive the enum from it, so the highlighted",
    "    // button and the six-case chooser cannot drift apart. A case that already",
    "    // derives to this mode is left alone, which keeps this a no-op when the",
    "    // change came from the chooser itself (applyUseCase dispatches here).",
    "    // Choosing by mode rather than by label is deliberate: backup and",
    "    // offgrid share the mode, and backup sizes the essentials only, so",
    '    // defaulting a mode switch onto it would silently resize the system.',
    '    const chooser = $("useCase");',
    '    const current =',
    '      chooser && useCase(chooser.value) ? chooser.value : "billcut";',
    "    if (deriveLegacy(current).mode !== goal)",
    '      applyUseCase(goal === "gridtie" ? "billcut" : "offgrid", {',
    "        silent: true,",
    "      });",
    "    if (isGt) {",
  ].join("\n"),
});

// A1: drop the gridtie literal write.
edits.push({
  label: "remove gridtie literal write",
  old: [
    '      btnOff.classList.remove("active");',
    '      if (sysGoal) sysGoal.value = "gridtie";',
  ].join("\n"),
  next: ['      btnOff.classList.remove("active");'].join("\n"),
});

// A2: drop the offgrid literal write.
edits.push({
  label: "remove offgrid literal write",
  old: [
    '      btnGt.classList.remove("active");',
    '      if (sysGoal) sysGoal.value = "offgrid";',
  ].join("\n"),
  next: ['      btnGt.classList.remove("active");'].join("\n"),
});

// B: share-link restore must not write the derived enum either.
edits.push({
  label: "remove share-link literal write",
  old: [
    '  if ($("systemGoal"))',
    '    $("systemGoal").value = o.g === 1 ? "gridtie" : "offgrid";',
  ].join("\n"),
  next: [
    "  // systemGoal is deliberately not written here: the case named below is the",
    '  // single source of truth and applyUseCase derives the enum from it, so a',
    "  // restored link cannot leave the two disagreeing.",
  ].join("\n"),
});

let text = raw;
for (const e of edits) {
  const oldCrlf = toCrlf(e.old);
  const hits = text.split(oldCrlf).length - 1;
  if (hits !== 1) {
    console.error(`ABORT "${e.label}": expected 1 match, found ${hits}`);
    process.exit(1);
  }
  text = text.replace(oldCrlf, toCrlf(e.next));
}

writeFileSync(file, text, "utf8");

const check = readFileSync(file, "utf8");
console.log("edits applied:", edits.length);
console.log("bare LF remaining:", (check.match(/(?<!\r)\n/g) || []).length);
console.log(
  "literal systemGoal writes left:",
  (check.match(/sysGoal\.value = |systemGoal"\)\.value = /g) || []).length,
);
