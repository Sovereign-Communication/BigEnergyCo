// The locale string contract: how a dictionary key becomes the final text a
// visitor reads — key resolution plus `{name}` placeholder substitution.
//
// This used to have two independent owners. i18n.js translated the markup
// (data-i18n) and the sizing controller translated runtime-rendered copy, each
// with its own copy of the lookup-then-substitute dance. They agreed by luck
// rather than by construction, and the same defect — a string replacer reading
// "$200" as the "$2" pattern, dropping the dollars — had to be discovered and
// fixed twice. Substitution now has exactly one implementation, so the next
// fix to it lands once and both readers inherit it.

/**
 * Look up a key in the active dictionary, then English, then fall back to the
 * raw key. A string that only one locale carries reads as English everywhere
 * else, never as key-ese.
 */
export function pickString(dict, key, fallbackDict = {}) {
  return dict?.[key] ?? fallbackDict?.[key] ?? key;
}

/**
 * Fill the `{name}` slots in `text` from `vars`.
 *
 * The replacement is a function, never a string: a value containing "$&" or
 * "$n" — any formatted money figure — would otherwise be read as a replacement
 * pattern and silently mangled. A nullish value renders as nothing rather than
 * as the word "undefined" in the middle of a sentence.
 */
export function interpolate(text, vars = null) {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (out, [name, value]) =>
      out.replaceAll(`{${name}}`, () => (value == null ? "" : String(value))),
    text,
  );
}

/**
 * Placeholder names are matched literally, so a name is safe to use as long as
 * it is not itself ambiguous. Kept next to the substitution so the rule has one
 * home: a name outside this shape is a typo in a locale string, and the gate in
 * tests/interpolate.test.mjs fails rather than letting it half-render.
 */
export const PLACEHOLDER_NAME = /^[A-Za-z0-9_]+$/;
