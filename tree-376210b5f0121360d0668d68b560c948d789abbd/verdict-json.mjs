// Test-only: pull one machine-readable verdict out of a child process's
// output.
//
// The one-liner this replaces was JSON.parse(out.slice(out.indexOf("{"))) —
// "everything from the first brace to the end". That is only correct while the
// first brace in the buffer happens to open the verdict, and the buffer these
// tests build is the child's stdout AND stderr concatenated in arrival order.
// So any log line carrying a brace, any Node warning, any thrown-error dump
// that lands first silently redefines where the JSON starts, and the parse
// throws a SyntaxError that reads as "the gate crashed" when the gate in fact
// returned a perfectly good verdict. Whether that happened depended on how two
// pipes interleaved — which is exactly the timing the rest of this suite tries
// not to be casual about.
//
// The rules, in order:
//   1. a candidate must be a complete, balanced, parseable JSON object or
//      array — a truncated one is not a verdict, and neither is a scalar;
//   2. when the caller says which fields the verdict must carry, a candidate
//      missing any of them is not the verdict (this is what separates a
//      well-formed JSON log line from the report);
//   3. of what survives, the LAST one wins, because that is the position a
//      verdict occupies: every script here prints its notes first and
//      `JSON.stringify(payload, null, 2)` last, just before it exits.
// A document is never entered twice: once one qualifies, the scan resumes
// past its closing brace, so a field inside the verdict — its own
// `failures: [...]`, say — can never be mistaken for a verdict of its own.
//
// Nothing here guesses and nothing here swallows: no qualifying candidate means
// a thrown error naming what was seen, so a child that printed no verdict at
// all fails the test that asked for one instead of quietly passing on `{}`.
const CLOSERS = { "{": "}", "[": "]" };

/**
 * Index just past the end of the JSON value that starts at `from`, or -1 when
 * the text from there does not close into a complete value.
 *
 * String-aware and escape-aware: a `}` inside a note, a regex, or a Windows
 * path must not close the document, and a `\"` must not end a string.
 */
export function endOfJsonValue(text, from) {
  if (!CLOSERS[text[from]]) return -1;
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (CLOSERS[ch]) {
      stack.push(CLOSERS[ch]);
    } else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1; // crossed brackets: not a value
      if (stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/** The parsed value at `from`, or undefined when it is not a usable verdict. */
function verdictAt(text, from, keys) {
  const end = endOfJsonValue(text, from);
  if (end < 0) return undefined;
  let value;
  try {
    value = JSON.parse(text.slice(from, end));
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== "object") return undefined;
  if (keys && !keys.every((k) => k in value)) return undefined;
  return value;
}

/**
 * The verdict in `text`, optionally requiring `keys` to be present.
 *
 * @param {string} text  the child's combined output
 * @param {string[]} [keys]  fields the verdict must carry
 */
export function extractVerdict(text, keys) {
  if (typeof text !== "string") {
    throw new TypeError(
      `extractVerdict needs the child's output as a string, got ${typeof text}`,
    );
  }
  let found;
  let i = 0;
  while (i < text.length) {
    if (!CLOSERS[text[i]]) {
      i++;
      continue;
    }
    const value = verdictAt(text, i, keys);
    if (value === undefined) {
      i++; // not a document (or not this one) — try the next brace
      continue;
    }
    found = value; // last one wins: see rule 3
    i = endOfJsonValue(text, i); // and never look inside it
  }
  if (found !== undefined) return found;
  throw new Error(
    `no JSON verdict in the child's output` +
      (keys ? ` carrying ${keys.join(", ")}` : "") +
      ` — first 400 chars: ${JSON.stringify(text.slice(0, 400))}`,
  );
}
