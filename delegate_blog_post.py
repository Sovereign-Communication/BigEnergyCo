"""Delegate the BigEnergyCo SEO blog post to a smaller model via the ModelStudio
token-plan endpoint (OpenAI-compatible). Measures duration + token usage so we
can evaluate cost/efficiency of smaller-model content delegation.

v2 reliability upgrades:
- Hard-requirements checklist in the brief (URL CTAs, end-at-conclusion, keyword placement)
- Per-section word budgets that sum into the 4,800-5,200 target
- Structure-aware continuation: expands shortest sections in place instead of
  appending after the conclusion
- Automated QA: detects + repairs missing estimator URL and oversized title tag,
  then prints a PASS/FAIL compliance report

Usage: python delegate_blog_post.py
Output: blog-drafts/diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage.<model>.md
"""
import sys, json, os, re, time, urllib.request, urllib.error
sys.stdout.reconfigure(encoding='utf-8')

MODEL = 'qwen3.6-flash'
THINKING = False
ENDPOINT = 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions'
OUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        'blog-drafts',
                        f'diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage.{MODEL}.md')
TARGET_MIN, TARGET_MAX = 4800, 5200
MAX_PASSES = 3
SITE_URL = 'https://treystu.github.io/BigEnergyCo'

def get_key():
    k = os.environ.get('BAILIAN_CODING_PLAN_API_KEY') or os.environ.get('DASHSCOPE_API_KEY')
    if k:
        return k
    p = os.path.expanduser(r'C:\Users\SCM\.qwen\settings.json')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            s = json.load(f)
        env = s.get('env') or {}
        return env.get('BAILIAN_CODING_PLAN_API_KEY') or env.get('DASHSCOPE_API_KEY')
    return None

SYSTEM = (
    "You are an expert energy-storage journalist and SEO content writer. "
    "You write accurate, practical, well-structured long-form articles in English. "
    "You follow every requirement in the task's HARD REQUIREMENTS checklist exactly. "
    "Output ONLY clean Markdown file content (YAML frontmatter on the first pass, then article body). "
    "Never add commentary, explanations, or code fences around the article."
)

BRIEF = rf"""Write a long-form SEO blog post for the BigEnergyCo website.

## Site context (positioning — follow exactly)
BigEnergyCo ({SITE_URL}) is a free, worldwide solar & battery storage estimator.
- Educational only. No signup, nothing for sale.
- It does NOT offer specific products — no specific Ah ratings, cell models, or manufacturers are offered. It informs readers about ALL options, prices, and possibilities.
- The estimator UI includes illustrative presets (e.g., "LFP 3.2V 314Ah prismatic, ~6,000+ cycles", "Sodium-ion 3.0V 210Ah, non-flammable, good to -40°C") — calculation examples only, never offerings.
- Standard disclaimer stance: "Educational estimates only — verify with a licensed professional."

## The article
Topic: the advantages of DIY battery builds over pre-bought/turnkey battery storage, for two cell chemistries: sodium-ion (Na-ion) and lithium iron phosphate (LiFePO4 / LFP).

LENGTH CONTRACT — the article body must land between 4,800 and 5,200 words. Write these 12 sections, each at its full budgeted length. Never compress later sections, never summarize to save space, never stop before section 12 is complete. Use the section TITLES exactly as given for the H2 headings; the "cover" lines are editorial notes for you only and must never appear in any heading:
 1. Title: "The DIY Battery Decision in 2026" (~400 words) — cover: growth of DIY vs turnkey storage, who this guide is for, frame the stakes
 2. Title: "The Economic Case: Cost per kWh and Markup Layers" (~480 words) — cover: what turnkey pricing includes (R&D, marketing, channel margins, warranty pool), right-sizing vs fixed 5/10 kWh modules, sourcing flexibility
 3. Title: "Modularity, Repairability, and No Firmware Lock-In" (~450 words) — cover: replacing one cell instead of the pack, custom series/parallel voltages, open BMS protocols vs proprietary inverter handshakes
 4. Title: "Cell Sourcing and Grade Selection" (~420 words) — cover: Grade A vs Grade B, what to verify (capacity/internal-resistance testing, seller reputation), the second-hand market
 5. Title: "LiFePO4 Deep Dive: The Proven DIY Favorite" (~470 words) — cover: ~3.2V/cell, 4,000-6,000+ cycles at 80% DoD, mature supply chain, proven BMS ecosystem, compression/mounting practice
 6. Title: "Sodium-Ion Deep Dive: The Emerging Contender" (~470 words) — cover: ~3.0V/cell, charging at sub-zero temperatures where LFP cannot, tolerance of full-discharge storage, non-flammable electrolyte positioning, lower energy density; honestly note the thinner second-hand market and fewer off-the-shelf BMS options as of 2026
 7. Title: "LFP vs Sodium-Ion: Head-to-Head Comparison" (~420 words) — MUST include a Markdown table comparing the two chemistries' characteristics (voltage, cycle life, temperature behavior, safety, energy density, cost trend, DIY ecosystem maturity)
 8. Title: "The Honest Disadvantages of DIY Builds" (~430 words) — cover: safety risk, time/tools, no warranty, BMS integration, busbar torque/fusing/enclosure responsibility
 9. Title: "When Pre-Bought Is the Better Choice" (~380 words) — cover: time-poor users, warranty needs, certified grid-tied installs; MUST include a Markdown table comparing DIY vs pre-bought across cost, time, warranty, safety responsibility, customization, support
 10. Title: "Safety First: Non-Negotiable Rules" (~400 words) — cover: DC arc risk, fusing, licensed electrician for grid connection; informational level only, no build instructions
 11. Title: "Frequently Asked Questions" (~500 words) — 6-8 questions phrased as likely search queries with concise featured-snippet-style answers, e.g., "Is it cheaper to build your own LiFePO4 battery?", "Can I mix sodium-ion and LFP cells?", "How many cycles does a DIY LFP battery last?"
 12. Title: "Conclusion: Making the Right Choice" (~280 words) — decision framework + CTA to the free estimator

## HARD REQUIREMENTS (verify every one before you finish)
1. The literal URL {SITE_URL} appears at least TWICE in the article body — once in a mid-article CTA and once in the conclusion. Use it as a Markdown link at least once.
2. The article ENDS with the conclusion section. Write nothing after it.
3. The primary keyword "DIY battery storage" appears in the H1 and within the first 100 words of body text.
4. BOTH Markdown tables are present: the LFP-vs-Na-ion chemistry table in section 7 and the DIY-vs-pre-bought table in section 9.
5. Educational-only positioning: the site sells nothing and offers no specific products; specific cells appear only as illustrative examples.
6. Output starts directly with the YAML frontmatter delimiter `---`. No code fences, no commentary, ever.
7. Every H2 heading is a clean reader-facing title. Never put editorial notes, format references, word counts, or instructions in any heading.

## SEO requirements
- Primary keywords: "DIY battery storage", "DIY vs prebuilt battery", "LiFePO4 DIY battery", "sodium-ion battery".
- Secondary/long-tail: "DIY home battery backup", "off-grid battery storage cost", "sodium-ion vs LiFePO4", "DIY solar battery pack", "battery storage cost per kWh", "is it cheaper to build your own battery".
- Natural density; no stuffing. One H1, logical H2 hierarchy (use the 12 sections above as H2s), short paragraphs, bulleted lists where helpful.

## File format (first pass)
Start the file with YAML frontmatter:
---
title: "<SEO title tag, MAX 60 characters including spaces, contains a primary keyword>"
meta_description: "<150-160 characters, compelling, contains a primary keyword>"
slug: "diy-vs-prebuilt-sodium-ion-lifepo4-battery-storage"
date: "2026-08-20"
keywords: [DIY battery storage, DIY vs prebuilt battery, LiFePO4 DIY battery, sodium-ion battery, DIY home battery backup, off-grid battery storage cost]
---
then the article body starting with the H1.

Remember: output ONLY the Markdown. Write ALL 12 sections at full length in this response."""

H2_RE = re.compile(r'^## ', re.M)

def word_count(text):
    return len(re.findall(r"\b\w+\b", text))

def strip_body(text):
    t = text.strip()
    if t.startswith('```'):
        t = re.sub(r'^```\w*\s*', '', t)
        t = re.sub(r'\s*```$', '', t)
    return t.strip()

def body_only(text):
    if text.startswith('---'):
        end = text.find('---', 3)
        if end != -1:
            return text[end + 3:]
    return text

def frontmatter_of(text):
    if text.startswith('---'):
        end = text.find('---', 3)
        if end != -1:
            return text[3:end]
    return ''

def fm_field(fm, key):
    m = re.search(rf'^{key}:\s*"?(.*?)"?\s*$', fm, re.M)
    return m.group(1).strip() if m else ''

def split_sections(body):
    idxs = [m.start() for m in H2_RE.finditer(body)]
    if not idxs:
        return body, []
    return body[:idxs[0]], [body[s:(idxs[i + 1] if i + 1 < len(idxs) else len(body))]
                            for i, s in enumerate(idxs)]

def heading_of(section):
    return section.splitlines()[0][3:].strip()

def is_terminal(section):
    return bool(re.search(r'FAQ|conclusion|final thought', heading_of(section), re.I))

def call_api(messages, max_tokens):
    payload = {'model': MODEL, 'messages': messages, 'temperature': 0.7,
               'max_tokens': max_tokens, 'enable_thinking': THINKING}
    req = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload).encode('utf-8'),
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=590) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        if 'enable_thinking' in body:
            payload.pop('enable_thinking')
            req = urllib.request.Request(
                ENDPOINT, data=json.dumps(payload).encode('utf-8'),
                headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=590) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        else:
            raise RuntimeError(f'HTTP {e.code}: {body}') from e
    dt = time.time() - t0
    return (data['choices'][0]['message']['content'], data.get('usage', {}),
            data['choices'][0].get('finish_reason'), dt)

def tally(usage, total_usage, dt, total_time):
    for k in total_usage:
        total_usage[k] += usage.get(k, 0)
    return total_time + dt

def continue_draft(draft, total_usage, total_time):
    """Add words to an under-target draft. If terminal sections already exist,
    expand the shortest body sections in place; otherwise append."""
    body = body_only(draft)
    need = (TARGET_MIN + 150) - word_count(body)
    pre, secs = split_sections(body)
    has_terminal = any(is_terminal(s) for s in secs)
    if has_terminal and len(secs) >= 4:
        candidates = sorted((s for s in secs if not is_terminal(s)),
                            key=word_count)[:2]
        targets = []
        share = need // len(candidates)
        for s in candidates:
            targets.append((s, word_count(s) + share))
        listing = '\n\n'.join(
            f'SECTION {i + 1} (expand to about {t} words):\n{s.strip()}'
            for i, (s, t) in enumerate(targets))
        prompt = (
            f'The article draft needs about {need} more words. Rewrite the following '
            'sections in substantially expanded form at the stated word targets. Keep '
            "each section's exact heading line, same style and depth; add concrete "
            'detail, examples, numbers, and practical considerations. Do not add new '
            'headings, do not write any other sections, no commentary. Output ONLY the '
            f'rewritten sections in markdown, in this order.\n\n{listing}')
        messages = [{'role': 'system', 'content': SYSTEM},
                    {'role': 'user', 'content': BRIEF},
                    {'role': 'assistant', 'content': draft},
                    {'role': 'user', 'content': prompt}]
        content, usage, finish, dt = call_api(messages, 6144)
        print(f'    expand pass done in {dt:.0f}s | finish={finish} | '
              f'usage: {usage.get("prompt_tokens",0)} in / {usage.get("completion_tokens",0)} out')
        total_time = tally(usage, total_usage, dt, total_time)
        returned = split_sections(strip_body(content))[1]
        for src, _t in targets:
            h = heading_of(src).lower()
            match = next((r for r in returned if heading_of(r).lower() == h), None)
            if match and word_count(match) > word_count(src):
                secs[secs.index(src)] = match.rstrip() + '\n\n'
        body_start = draft.find(body)
        draft = draft[:body_start] + pre + ''.join(secs)
        return draft.rstrip() + '\n', total_usage, total_time
    anchor = body.strip()[-300:]
    prompt = (
        f'The article draft so far ends with:\n"""{anchor}"""\n\n'
        f'Current body word count: {word_count(body)}. Target: 5,000.\n'
        'Continue the article from exactly where it stopped. Do NOT repeat any existing '
        'text or headings. Write the remaining planned sections in the same style and '
        'depth. The conclusion section must be the LAST thing you write — nothing after '
        'it. Output ONLY the continuation Markdown (no frontmatter, no commentary).')
    messages = [{'role': 'system', 'content': SYSTEM},
                {'role': 'user', 'content': BRIEF},
                {'role': 'assistant', 'content': draft},
                {'role': 'user', 'content': prompt}]
    content, usage, finish, dt = call_api(messages, 8192)
    print(f'    append pass done in {dt:.0f}s | finish={finish} | '
          f'usage: {usage.get("prompt_tokens",0)} in / {usage.get("completion_tokens",0)} out')
    total_time = tally(usage, total_usage, dt, total_time)
    draft = draft.rstrip() + '\n\n' + strip_body(content)
    return draft.rstrip() + '\n', total_usage, total_time

def ensure_url(draft, total_usage, total_time):
    """Guarantee the estimator URL appears >=2x; repair via the model, with a
    deterministic fallback."""
    if draft.count('bigenergyco.github.io') >= 2:
        return draft, total_usage, total_time, 'ok'
    body = body_only(draft)
    pre_body, secs = split_sections(body)
    concl = next((s for s in reversed(secs)
                  if re.search(r'conclusion|final thought', heading_of(s), re.I)), None)
    if concl:
        prompt = (
            'Below is the conclusion section of the article. Rewrite it so the literal '
            f'URL {SITE_URL} appears exactly twice as natural CTAs to the free estimator '
            '(at least once as a Markdown link). Keep the same meaning, tone and length '
            '(±20%). Output ONLY the rewritten conclusion section in markdown, starting '
            f'with its heading.\n\n{concl.strip()}')
        try:
            content, usage, finish, dt = call_api(
                [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt}],
                2048)
            total_time = tally(usage, total_usage, dt, total_time)
            fixed = strip_body(content)
            if fixed.count('bigenergyco.github.io') >= 2 and fixed.startswith('##'):
                secs[secs.index(concl)] = fixed.rstrip() + '\n\n'
                body_start = draft.find(body)
                draft = draft[:body_start] + pre_body + ''.join(secs)
                return draft.rstrip() + '\n', total_usage, total_time, 'model-repaired'
        except Exception as e:
            print(f'    URL repair call failed ({e}); using deterministic fallback')
    cta = ('\n\nReady to see what your system could look like? Use the free '
           f'[BigEnergyCo solar & battery estimator]({SITE_URL}) to size your setup '
           f'before you buy or build — no signup, nothing for sale. Visit {SITE_URL}.\n')
    draft = draft.rstrip() + cta
    return draft, total_usage, total_time, 'fallback-injected'

def fix_title(draft):
    fm = frontmatter_of(draft)
    title = fm_field(fm, 'title')
    if not title or len(title) <= 60:
        return draft, 'ok'
    cut = title[:57].rsplit(' ', 1)[0] + '…'
    return draft.replace(f'title: "{title}"', f'title: "{cut}"', 1), f'trimmed to {len(cut)}'

KEY = get_key()
if not KEY:
    print('No API key found!')
    sys.exit(1)
print(f'Key found: {KEY[:8]}...{KEY[-4:]}')

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
total_usage = {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}
total_time = 0.0
draft = ''

for p in range(1, MAX_PASSES + 1):
    if p == 1:
        messages = [{'role': 'system', 'content': SYSTEM},
                    {'role': 'user', 'content': BRIEF}]
        print(f'--- Pass {p}: calling {MODEL} ...')
        content, usage, finish, dt = call_api(messages, 12288)
        total_time = tally(usage, total_usage, dt, total_time)
        print(f'    done in {dt:.0f}s | finish={finish} | usage: {usage.get("prompt_tokens",0)} in / '
              f'{usage.get("completion_tokens",0)} out')
        draft = strip_body(content)
    else:
        print(f'--- Pass {p}: under target, repairing structure ...')
        draft, total_usage, total_time = continue_draft(draft, total_usage, total_time)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(draft + '\n')
    wc = word_count(body_only(draft))
    print(f'    cumulative body word count: {wc}')
    if wc >= TARGET_MIN:
        break

# QA: URL CTAs and title length
draft, total_usage, total_time, url_fix = ensure_url(draft, total_usage, total_time)
draft, title_fix = fix_title(draft)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(draft + '\n')

# Compliance report
body = body_only(draft)
wc = word_count(body)
fm = frontmatter_of(draft)
title = fm_field(fm, 'title')
meta = fm_field(fm, 'meta_description')
first100 = ' '.join(re.findall(r"\b\w+\b", body)[:100]).lower()
_, secs = split_sections(body)
headings = [heading_of(s) for s in secs]
last_is_concl = bool(headings) and bool(re.search(r'conclusion|final thought', headings[-1], re.I))
checks = [
    ('word count in 4,800-5,200', TARGET_MIN <= wc <= TARGET_MAX, f'{wc}'),
    ('title tag <= 60 chars', len(title) <= 60, f'{len(title)} ({title_fix})'),
    ('meta description 140-165 chars', 140 <= len(meta) <= 165, f'{len(meta)}'),
    ('slug + date + keywords present',
     bool(fm_field(fm, 'slug')) and bool(fm_field(fm, 'date')) and bool(fm_field(fm, 'keywords')), ''),
    ('exactly one H1', len(re.findall(r'^# ', body, re.M)) == 1, ''),
    ('primary keyword in first 100 words', 'diy battery storage' in first100, ''),
    ('estimator URL >= 2x', draft.count('bigenergyco.github.io') >= 2,
     f'{draft.count("bigenergyco.github.io")} ({url_fix})'),
    ('2+ markdown tables', len(re.findall(r'^\|[\s:|-]+\|', body, re.M)) >= 2, ''),
    ('FAQ section present', any(re.search(r'FAQ|frequently asked', h, re.I) for h in headings), ''),
    ('headings free of editorial notes',
     not any(re.search(r'(?i)(markdown|featured|snippet|\bwords?\b|cover:|section \d|style\))', h)
             for h in headings), ''),
    ('ends at conclusion', last_is_concl, headings[-1] if headings else 'none'),
]
print('\n=== QA REPORT ===')
for name, ok, detail in checks:
    print(f'  [{"PASS" if ok else "FAIL"}] {name}' + (f' — {detail}' if detail else ''))
print(f'\nfile: {OUT_PATH}')
print(f'body words: {wc} | passes: {p} | wall time: {total_time:.0f}s')
print(f'total usage: {json.dumps(total_usage)}')
print(f'verdict: {"READY" if all(c[1] for c in checks) else "NEEDS REVIEW"}')
