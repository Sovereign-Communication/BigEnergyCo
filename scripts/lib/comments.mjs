// Comment stripping for the static gates, as ONE owner.
//
// WHY A SCANNER AND NOT A REGEX. Every gate that scans shipped bytes has to
// decide what "shipped" means, and comments are not it: a comment can NAME a
// constant it refuses to ship, so a gate that scans comments punishes its own
// explanation, and a gate that punishes its own explanation gets switched off
// rather than obeyed. Four gates had each grown their own
//
//     src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "")
//
// and that line is a defect, not a style. CodeQL read it as an INCOMPLETE
// MULTI-CHARACTER SANITIZATION (js/incomplete-multi-character-sanitization,
// high severity, raised against this repo on 2026-10-05): a regex `replace` is
// a non-overlapping sweep that only removes a comment once it has found BOTH
// delimiters, so a comment left unclosed keeps its opener, and the opener is
// exactly what the gate then scans for. The sanitizer was supposed to make the
// string safe to scan and instead could leave the dangerous prefix in place.
//
// Plan §Q-15 holds this repo to "0 CodeQL alerts", so the fix is structural
// rather than a suppression: ONE left-to-right pass that, on meeting an
// opener, CONSUMES to the matching closer — or to end of input when there is
// none. An unterminated comment therefore cannot leave an opener behind, by
// construction instead of by argument, and there is no second pass for an
// attacker to outwit.
//
// WHAT IT DELIBERATELY DOES NOT DO. It does not parse the surrounding
// language. A `/*` or `<!--` inside a string literal is still treated as an
// opener, which is exactly what the regexes these gates used before did — the
// behaviour the gates were already passing on is preserved rather than
// silently changed underneath four gates at once. What changes is only the
// failure mode: a delimiter that can survive the strip is now impossible.

/** The comment openers this strips, and the closer that terminates each. */
const COMMENT_DELIMITERS = [
  ["<!--", "-->"],
  ["/*", "*/"],
];

/**
 * Every comment removed, everything else byte-for-byte intact.
 *
 * @param {string} src JavaScript or HTML source text.
 * @returns {string} `src` with each comment — closed or not — removed.
 */
export function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const open = COMMENT_DELIMITERS.find(([opener]) =>
      src.startsWith(opener, i),
    );
    if (!open) {
      out += src[i++];
      continue;
    }
    const [opener, closer] = open;
    const end = src.indexOf(closer, i + opener.length);
    // No closer anywhere ahead: consume the rest of the input rather than
    // handing the opener back to the caller. This is the whole point.
    i = end === -1 ? src.length : end + closer.length;
  }
  return out;
}
