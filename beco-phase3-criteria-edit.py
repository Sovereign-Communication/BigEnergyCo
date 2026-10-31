import json
from pathlib import Path

root = Path(r'C:\tmp\beco-issue287-proven-criteria-20261023')
path = root / 'scripts/lib/jev-complete.pack.json'
pack = json.loads(path.read_text(encoding='utf-8'))
criteria = {
    'spec': 'Acceptance outcomes map to current implementation and exercised behavior, with no requested outcome missing or unexplained scope added.',
    'design': 'Module boundaries, state ownership and dependency checks demonstrate one owner per responsibility; no unresolved coupling or ownership defect remains.',
    'correctness': 'The current full suite and real-surface journeys exercise critical boundaries, asynchronous ordering, cleanup and state synchronization; no recorded failure is waived by prose.',
    'quality': 'Current full-tree formatting, duplication, dead-code and style checks enforce their stated rules with zero unresolved exceptions. Counts alone do not prove concision; known unnecessary code or duplication remains a gap.',
    'security': 'Current secret, header, CSP, consent and untrusted-input checks cover the exposed paths and pass; no known unresolved security or free-public-mission violation remains.',
    'performance': 'Measured first paint, warm interactions and network reuse satisfy enforced numeric CI ceilings. State the tested device and network scope; do not infer performance on untested surfaces.',
    'accessibility': 'Keyboard paths, accessible names, contrast, motion preferences and the required assistive-technology coverage are exercised across the stated main flows with no unresolved violations; missing required coverage remains a gap.',
    'i18n': 'Every shipped locale passes key and placeholder parity and rendered main-flow checks, with no raw keys or unexplained English leakage; locale switching and Intl formatting are exercised.',
    'seo': 'The current code-owned sitemap, JSON-LD, metadata and character gates are recorded green; absent or red results cannot be replaced by narrative.',
    'resilience': 'Injected failures and stuck-run checks demonstrate recovery on the tested paths, and nested timeout budgets fit. Explicitly distinguish exercised recovery from source-only timer arithmetic.',
    'experience': 'Recorded first-run and returning-user journeys demonstrate understandable actions, acknowledgement, useful errors and empty states, and coherent result hierarchy; unresolved observed usability defects remain gaps.',
    'docs': 'Architecture, gate inventory and deployment/runbook instructions are checked against current code and commands, with no known stale ownership, removed behavior or unverified release step.',
    'testing': 'A complete unit-suite run for the current tree is recorded green. A partial suite, missing result or recorded failure is not a complete passing run.',
    'release': 'Current code-owned CI, browser smoke and clean-tree facts are all green for the assessed revision; distinguish local readiness from any separately required live deployment verification.',
    'advisor': 'Current adversarial and failure-path checks demonstrate calculator-result authority, result pairing, safe uncertainty, locale behavior and privacy disclosure. Unrun required live checks remain unverified.',
    'physics': 'Deterministic hourly calculations, physical boundary invariants and the required reference-validation cases pass without weakened thresholds or substituted assumptions.',
    'provenance': 'Every displayed number has a visitor-visible dated source and grade, or is explicitly unknown; current freshness and citation checks cover the assumptions actually displayed.',
    'comparison': 'Tests demonstrate all four purchase paths use the same system and 20-year definitions, including permits, incentives, replacements and end-of-term choices; no unmatched cost omission remains.',
    'usecases': 'All six use cases are exercised through the unified flow with distinct outcome metrics and honest success or infeasibility verdicts; copy or a shared metric alone does not demonstrate a use case.',
    'privacy': 'Browser network and storage checks demonstrate disclosed, chosen data transfers, coordinate rounding before transmission, and no cookies, identifiers or tracking on the tested paths.',
    'translation': 'Each shipped locale has parity, formatting, direction and glyph checks plus meaning and natural-phrasing verification for user decisions and safety/error copy. Disclose sampling and reviewer scope; terminology parity or unvalidated model agreement alone cannot prove semantic quality.',
}
assert set(criteria) == set(pack['axes'])
for axis, text in criteria.items():
    pack['axes'][axis]['proven_criteria'] = text
path.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
