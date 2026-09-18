// Deliberate, throwaway PROBE: each line is a verbatim pattern from CodeQL's
// DOM-XSS / URL-redirection / code-injection queries. This file exists only on a
// throwaway branch to prove `main-protection` blocks a merge when CodeQL reports
// findings, and is deleted with the branch. Do not merge; do not copy.
export function rewrite(el) {
  el.innerHTML = new URLSearchParams(location.search).get("html");
}

export function go() {
  location.href = new URLSearchParams(location.search).get("next");
}

export function run() {
  eval(location.hash.slice(1));
}
