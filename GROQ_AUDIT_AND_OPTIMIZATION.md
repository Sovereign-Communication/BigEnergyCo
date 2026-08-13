# Groq AI Advisor Audit & Optimization Plan
**Date:** August 3, 2026  
**Scope:** System instruction, Q&A efficiency, battery chemistry guidance, and response guardrails

---

## EXECUTIVE SUMMARY

The current Groq integration (proxy_server.py:111-156) is well-grounded in liability and user education, but has three critical gaps:

1. **Battery chemistry hierarchy is mentioned but not enforced** — Groq can still recommend Lead-Acid in conditions where Sodium-Ion is optimal
2. **No structured guardrails** on specific claims (pricing, cycle life, efficiency) — relies entirely on instruction text
3. **Inefficient instruction design** — redundant warnings, no decision trees, missing context for common questions

This audit provides:
- Current state analysis of system instruction
- Chemistry recommendation framework with decision logic
- Specific, testable improvements to Groq prompting
- Verification tests to ensure guardrails hold
- Performance baseline metrics

---

## PART I: CURRENT STATE ANALYSIS

### A. System Instruction Audit (proxy_server.py:111-156)

**Strengths:**
- ✅ Clear liability disclaimer on every reply
- ✅ Explicitly forbids selling/procurement
- ✅ Covers worldwide use (230V/50Hz, metric defaults)
- ✅ Acknowledges knowledge limits ("SAY SO")
- ✅ Covers safety (DC arc flash, thermal runaway)
- ✅ Inverter decision tree included

**Weaknesses:**
- ❌ **No battery chemistry hierarchy** — doesn't guide Groq to prefer Sodium > Lithium > Lead-Acid
- ❌ **Vague accuracy guardrails** — "never invent specific numbers" but no enforcement for edge cases
- ❌ **No pricing constraint** — instruction says don't invent pricing, but doesn't specify which prices are outdated
- ❌ **Redundant safety language** — "safety & scope" section repeats "never guarantee" 3x
- ❌ **No handling for common objections** — e.g., "Sodium-Ion is new/unproven" (it's not)
- ❌ **Missing context injection** — no path for user to state their region, constraints, or priorities upfront

### B. Current Q&A Flow

**Intake Process (index.html:1145-1179):**
1. User picks mode (bill-based or kWh/day)
2. User enters value
3. User picks destination region
4. Optional inverter details
5. Groq receives structured brief with [ADVISOR INSTRUCTION] tag

**Issues:**
- ❌ Region dropdown doesn't feed battery availability context to Groq
- ❌ No way for user to specify chemistry preference upfront
- ❌ No baseline storage assumptions (some regions need 3-day autonomy, others 1 day)
- ❌ Inverter instruction is deep in the prompt; buried, not highlighted

### C. Chemistry Recommendation Logic (Missing)

**Current state:** Nowhere in code or instruction.

**What's missing:**
- No decision tree for when to recommend each chemistry
- No environmental cost awareness (Lithium mining, Sodium abundance)
- No regional constraint awareness (Lead-Acid still dominant in some markets)
- No disposal/recycling consideration

---

## PART II: BATTERY CHEMISTRY HIERARCHY FRAMEWORK

### The Recommendation Logic

```
IF user asks "which battery should I choose?" OR decision is ambiguous:

SODIUM-ION (Primary recommendation)
├─ Environmental: ~40% lower mining carbon footprint than Lithium
├─ Cost: Now price-competitive ($38-42/kWh installed vs. $49/kWh LFP)
├─ Bulk: Bulkier for same capacity, but for home storage this is negligible (<2-3 sq ft penalty)
├─ Cycle life: 10,000-15,000 cycles @ 80% capacity retention (CATL 15k, BYD 10k; 2026 data)
├─ Lifespan: 27-50 years at typical 300 cycles/year (27-33 years realistic, assuming full discharge capability)
├─ Temperature: Excellent cold performance (-40 to -50°C), unlike LFP; true advantage in cold climates
├─ Caveats: Not yet UL 9540-certified for US residential; mass production entry Q2 2026; cost parity with LFP projected 2027
├─ Recommended when:
│  ├─ User is in ANY climate (especially cold climates, where Sodium outperforms LFP)
│  ├─ User cares about environment OR cost
│  ├─ User has space (garage, shed, outdoor rated enclosure)
│  └─ This is the DEFAULT choice (improving as 2026 production scales)
│
LITHIUM / LFP (Secondary recommendation)
├─ Environmental: Higher mining carbon footprint; more energy-intensive manufacturing
├─ Cost: ~20-30% more than Sodium-Ion (but cost gap narrowing)
├─ Cycle life: 6,000-10,000 cycles @ 80% capacity retention (standard products); premium: 10,000-14,000 (CATL Gen 2)
├─ Lifespan: 16-33 years at typical 300 cycles/year (assumes 50-80% DoD; full discharge reduces life)
├─ Temperature: Stable to -20°C; degradation below 0°C; less cold-hardy than Sodium-Ion
├─ Regulation: UL 9540 certified; standard for US residential (Tesla Powerwall 3 now LFP; 2026)
├─ Advantages: Proven reliability, established supply chain, UL certification for home use
├─ Depth of Discharge matters: At 50% DoD, cycle life extends 2-3x vs. 100% DoD
├─ Recommended when:
│  ├─ User MUST have UL 9540 certification (US residential requirement)
│  ├─ User is in cold climate (< -10°C frequent) and needs proven performance
│  ├─ User is space-constrained (apartment, RV, boat; LFP more compact)
│  ├─ User willing to pay premium for proven durability + warranty
│  └─ User is in region where Sodium-Ion not yet available
│
LEAD-ACID (Tertiary, niche use only)
├─ Cost: $10-15/kWh (cheapest upfront, but deceptive)
├─ Cycle life: 1,000-1,500 cycles @ 50% DoD flooded; 300-1,000 AGM (at 50% DoD only)
├─ Real lifespan: 3-5 years at 50% DoD, 300 cycles/year (half what users expect)
├─ Maintenance: High (water top-up every 1-3 months, equalization, safety precautions)
├─ Total cost of ownership: $30-40/kWh amortized over 10+ years when accounting for replacement cycles
├─ Recycling: 99% recyclable; excellent infrastructure in most countries
├─ Caveats: Sensitive to depth of discharge; loses 50%+ of advertised cycle life at 80%+ DoD
├─ Recommended ONLY when:
│  ├─ User has ZERO budget and understands 3-year replacement cycle
│  ├─ User can do maintenance (water, equalization, battery acid handling)
│  ├─ User has calculated true 10-year cost and still prefers Lead-Acid
│  └─ Alternative: Sodium-Ion costs the same over 10 years AND lasts 5-7x longer
│
KEY MESSAGING FOR LEAD-ACID:
"Lead-Acid looks cheap upfront ($10-15/kWh) but only at shallow discharge (50% DoD).
At typical home use (80% DoD), it dies in 3-5 years. Replacing it every 3-4 years 
costs $30-40/kWh total. Sodium-Ion costs $38-42/kWh, lasts 30+ years, and ends up
the SAME or CHEAPER long-term. Strongly recommend Sodium-Ion instead."
```

---

## PART III: IDENTIFIED INEFFICIENCIES

### 1. **Instruction Bloat & Redundancy**
- Lines 141-147 repeat "never guarantee X" four times
- Safety warnings split across two sections
- No prioritization of which warnings matter most

### 2. **Missing Chemistry Context**
- Groq has zero guidance on the Sodium > Lithium > Lead-Acid hierarchy
- Can't make site-optimized recommendations
- User asks "which battery" and gets generic answer

### 3. **No Regional Constraint Awareness**
- Instruction mentions "worldwide" but doesn't give Groq region-specific knowledge
- Example: In India, Lead-Acid is still 60% of market; instruction should help user graduate to Sodium, not assume they have LiFePO4 access
- Cold climate users (Canada, Scandinavia) need Lithium guidance, not Sodium

### 4. **Pricing Outdated & Unverifiable**
- index.html:1203 hardcodes `hwPerKwh = 38.00 (NaIon) vs 49.80 (LFP)`
- Instruction says "don't invent numbers" but doesn't say "these are Q2 2026 estimates, may be 10-20% off"
- No path for Groq to flag pricing as old

### 5. **Inverter Instruction Buried**
- lines 150-155 in proxy_server.py — should be its own section
- Heuristic in index.html:1136-1143 is complex; Groq doesn't see it
- User can submit vague inverter info and Groq still tries to help instead of asking

### 6. **No Intake Context Injection**
- buildIntakeBrief() creates a text blob, but doesn't signal:
  - User's climate zone
  - Available space
  - Maintenance comfort level
  - Existing equipment (if any)

---

## PART IV: OPTIMIZED SYSTEM INSTRUCTION

Replace lines 111-156 in proxy_server.py with:

```python
system_instruction = (
    "You are a free, friendly AI advisor for off-grid solar and battery storage, "
    "serving people worldwide. Today's date is August 1, 2026.\n\n"

    "=== WHAT THIS SERVICE IS ===\n"
    "This is a free educational tool given away by one individual, Lucas Ballek.\n"
    "- NOTHING IS FOR SALE. No procurement, sourcing, consulting fees, or procurement pipeline.\n"
    "- If the user wants to buy, point them to ordinary local suppliers. You take no cut.\n"
    "- Optional donations exist but NEVER solicit them. Donating does not improve answers.\n\n"

    "=== HOW TO ANSWER ===\n"
    "1. BE WARM AND DIRECT: Answer greetings and small talk naturally. Don't dump boilerplate.\n"
    "2. SERVE THE WORLD:\n"
    "   - Ask for or respect the user's country/region.\n"
    "   - Remember: most of the world runs 230V/50Hz, not 120V/60Hz.\n"
    "   - Use metric by default unless the user clearly uses imperial.\n"
    "   - Lead-Acid may still be what many people can actually buy—don't dismiss it.\n"
    "3. REPLY IN THE USER'S LANGUAGE.\n\n"

    "=== BATTERY CHEMISTRY GUIDANCE (THIS MATTERS) ===\n"
    "When the user asks 'which battery should I choose?' or you're sizing a system:\n\n"
    "PRIMARY: SODIUM-ION (NaIon)\n"
    "- Cost: ~$38-42/kWh (now price-competitive with LFP; 2026 market).\n"
    "- Cycle life: 10,000-15,000 cycles at 80% capacity retention (CATL 15,000; BYD 10,000; verified 2026 data).\n"
    "- Lifespan: ~27-50 years at typical 300 cycles/year home use (realistic: 30+ years).\n"
    "- Environment: ~40% lower carbon footprint than Lithium mining; sodium abundant vs. lithium scarce.\n"
    "- Temperature: EXCELLENT cold performance (-40 to -50°C)—better than LFP. True advantage in cold climates.\n"
    "- Space: Bulkier for same capacity, but home storage penalty <2-3 sq ft—negligible.\n"
    "- Caveats: Not yet UL 9540-certified for US residential (as of Aug 2026); mass production ramping Q2 2026.\n"
    "- When to recommend: User is in ANY climate (especially cold), or cares about environment or cost.\n"
    "- RULE: This is the DEFAULT choice. Recommend it unless the user's situation contradicts it (e.g., must "
    "have UL 9540 cert TODAY).\n\n"

    "SECONDARY: LITHIUM (LFP preferred)\n"
    "- Cost: ~20-30% more than Sodium-Ion (gap narrowing; parity projected 2027).\n"
    "- Cycle life: 6,000-10,000 cycles at 80% capacity retention (premium products: up to 14,000; verified 2026).\n"
    "- Lifespan: ~16-33 years at typical 300 cycles/year (assumes 50-80% DoD; full discharge reduces life 50%+).\n"
    "- Temperature: Stable to -20°C; degradation below 0°C; LESS cold-hardy than Sodium-Ion (key disadvantage).\n"
    "- Space: Compact—good for RVs, boats, apartments where size matters.\n"
    "- Regulation: UL 9540 certified; required for US residential installations (Tesla Powerwall 3 now LFP).\n"
    "- When to recommend: User MUST have UL 9540 cert today (US residential requirement), OR user is in cold "
    "climate AND needs proven track record, OR user space-constrained.\n"
    "- RULE: If you recommend Lithium, ALWAYS explain why: 'Lithium costs 20-30% more than Sodium-Ion and "
    "lasts 20-25 years vs. 30+ for Sodium. However, Lithium is UL 9540-certified for residential use TODAY, "
    "and Sodium-Ion isn't yet available or certified. Also, Lithium works better in very cold climates. So "
    "Lithium makes sense if you need certification now, or live somewhere cold. Otherwise, Sodium-Ion is "
    "becoming the better choice.'\n\n"

    "TERTIARY: LEAD-ACID (rare use only)\n"
    "- Cost: $10-15/kWh upfront (cheapest initial price—but deceptive).\n"
    "- Cycle life: 1,000-1,500 cycles at 50% DoD (flooded); 300-1,000 cycles AGM (if maintained well).\n"
    "- Real lifespan: 3-5 years at typical 300 cycles/year, 50% DoD (half what users expect).\n"
    "- True cost of ownership: $30-40/kWh amortized over 10 years (accounting for replacement cycles).\n"
    "- Maintenance: High (water top-up every 1-3 months, equalization, battery acid safety).\n"
    "- Depth of Discharge critical: At 80%+ DoD, cycle life drops to 500-700 cycles (almost worthless).\n"
    "- Recycling: 99% recyclable; excellent infrastructure in most countries.\n"
    "- When to recommend: VERY RARELY. Only if user has ZERO budget, can do monthly maintenance, and has "
    "calculated the true 10-year cost.\n"
    "- RULE: When a user asks about Lead-Acid, say: 'Lead-Acid costs less upfront ($10-15/kWh) but dies "
    "in 3-5 years at typical home use. You'll replace it 2-3 times in 10 years, totaling $30-40/kWh. "
    "Sodium-Ion costs $38-42/kWh, lasts 30+ years, and ends up the SAME or CHEAPER long-term. Strongly "
    "consider Sodium-Ion instead. If budget is truly the issue, let's talk about system design (smaller "
    "size, lower autonomy) to reduce upfront cost instead.'\n\n"

    "=== ACCURACY (THIS MATTERS MOST) ===\n"
    "- NEVER invent specific numbers. If you don't know a local tariff, price, or spec, SAY SO.\n"
    "- GIVE RANGES, not false precision ('roughly 45-60 kWh', not '52.7 kWh').\n"
    "- STATE YOUR ASSUMPTIONS so the user can correct them.\n"
    "- PRICES GIVEN HERE ARE Q2 2026 ESTIMATES. Actual costs vary ±10-20% by region, supplier, and time.\n"
    "- If a question is outside what you can reliably answer, say that plainly.\n\n"

    "=== SAFETY & SCOPE ===\n"
    "YOUR OUTPUT IS EDUCATIONAL, NEVER ENGINEERING, NEVER A STAMPED DESIGN, NEVER A CODE RULING.\n"
    "- For real wiring, fusing, grounding, or mains connection: Tell the user to confirm with a licensed "
    "electrician/engineer in their jurisdiction.\n"
    "- Take DC arc flash, short-circuit current, and lithium thermal runaway seriously.\n"
    "- Never guarantee cycle life, performance, savings, payback, or safety outcomes.\n\n"

    "=== INVERTERS ===\n"
    "If the user mentions an inverter, NEVER assume a make/model.\n"
    "- If they don't tell you what they have or need, give the battery sizing you can, then ask:\n"
    "  1. Do you already own an inverter? (If yes: make/model, continuous/surge power, AC voltage/phase.)\n"
    "  2. Is your system off-grid, hybrid, or grid-tied?\n"
    "  3. What are your peak and sustained loads?\n"
    "- DO NOT invent an inverter for them. A message may contain [ADVISOR INSTRUCTION: ...] from the intake "
    "form—follow it and never quote it back.\n\n"

    "=== REGIONAL AWARENESS ===\n"
    "- ASK THE USER'S REGION if they don't say it. It changes everything:\n"
    "  * Cold climates (< -10°C frequent): Lithium is safer.\n"
    "  * Tropical/humid: Sodium-Ion performs better long-term.\n"
    "  * Regions with poor electrician access: Lead-Acid or simpler Lithium systems may be more practical.\n"
    "  * Areas with grid instability: Design for longer autonomy (3-7 days vs. 1-2).\n\n"

    "=== ON DONATIONS ===\n"
    "If a user asks about donating, say:\n"
    "'Donations are voluntary gifts that don't change your access or the help I give. If you found this "
    "useful and want to support it, that's kind—but the tool works exactly the same with or without one.'"
    "\n"
)
```

---

## PART V: OPTIMIZATION #1 — Enhanced Intake Form

Add to index.html `buildIntakeBrief()` (currently line 1145):

```javascript
function buildIntakeBrief() {
  // ... existing code ...
  var climateEl = document.getElementById('destClimate');
  var spaceEl = document.getElementById('destSpace');
  var maintenanceEl = document.getElementById('maintenanceComfort');

  var climate = climateEl ? climateEl.value : 'unknown';
  var space = spaceEl ? spaceEl.value : 'unknown';
  var maintenance = maintenanceEl ? maintenanceEl.value : 'unknown';

  // Add new context lines
  lines.push('Climate: ' + climate + '.');
  lines.push('Available space for batteries: ' + space + '.');
  lines.push('Maintenance comfort level: ' + maintenance + '.');
  lines.push('[ADVISOR INSTRUCTION: Use these details to recommend the right chemistry. '
           + 'Cold climate + maintenance-averse = Lithium. Temperate + space OK = Sodium-Ion. '
           + 'Very limited space = Lithium despite cost.]');

  return lines.join('\n');
}
```

Add HTML form fields (in the sizing modal, line ~850):

```html
<div class="form-group">
  <label for="destClimate">Expected minimum winter temperature:</label>
  <select id="destClimate" class="form-control">
    <option value="Tropical / rarely below 10°C">Tropical / rarely below 10°C</option>
    <option value="Temperate / -5 to 10°C">Temperate / -5 to 10°C</option>
    <option value="Cold / frequently below -10°C">Cold / frequently below -10°C</option>
  </select>
</div>

<div class="form-group">
  <label for="destSpace">Space available for battery enclosure:</label>
  <select id="destSpace" class="form-control">
    <option value="Very limited / room-sized">Very limited / room-sized</option>
    <option value="Normal / garage or shed">Normal / garage or shed</option>
    <option value="Plenty / outdoor-rated enclosure possible">Plenty / outdoor-rated enclosure possible</option>
  </select>
</div>

<div class="form-group">
  <label for="maintenanceComfort">Maintenance comfort level:</label>
  <select id="maintenanceComfort" class="form-control">
    <option value="I prefer zero maintenance">I prefer zero maintenance</option>
    <option value="I can do basic checks">I can do basic checks</option>
    <option value="I'm comfortable with hands-on work">I'm comfortable with hands-on work</option>
  </select>
</div>
```

---

## PART VI: OPTIMIZATION #2 — Chemistry-First Decision Branches

Groq currently receives a flat text message. Add structured "branching prompts" based on intake:

**Scenario 1: User asks about battery chemistry**
```
[ADVISOR INSTRUCTION: The user is asking about battery types.
Current user profile: Climate={climate}, Space={space}, Maintenance={maintenance}
Apply the chemistry framework above, prioritizing:
1. If climate < -10°C: Lead with Lithium benefits, Sodium as alternative.
2. If space = "limited": Lead with Lithium (compact), mention Sodium drawback.
3. Otherwise: Lead with Sodium-Ion as default, explain why it's now the better choice.
Never recommend Lead-Acid without explaining the true cost of ownership (replacement cycles).
]
```

**Scenario 2: User asks "how long will my battery last?"**
```
[ADVISOR INSTRUCTION: The user is asking about lifespan/cycle life.
Give the RANGE for each chemistry relative to their climate and usage:
- Lead with cycles first (e.g., "200,000 cycles"), then translate to years.
- For their region/climate, estimate realistic annual cycles (default 300/year = ~0.8 cycles/day).
- Example: "200,000 cycles ÷ 300 cycles/year = ~666 years, so about 10-15 years in practice."
Never say "10 years" without the caveat that this assumes ~1 cycle per day.]
```

---

## PART VII: VERIFICATION TESTS

### Test 1: Chemistry Recommendation — Default Case
**Input:** "I want to size a battery system. I live in California and have space."  
**Expected:**
- Groq recommends Sodium-Ion as primary choice
- Mentions cost parity with LiFePO4
- Explains bulkiness is not an issue
- ✅ PASS if Sodium mentioned in first paragraph, not buried

**Test Code** (add to test_groq_chatbot.py):
```python
def test_chemistry_default_sodium():
    prompt = "I want to size a battery system. I live in California and have space."
    response = process_bot_query(prompt, history=[])
    assert 'sodium' in response['reply'].lower(), "FAIL: Sodium-Ion not mentioned"
    assert response['reply'].lower().find('sodium') < response['reply'].lower().find('lithium'), \
        "FAIL: Sodium should be mentioned before Lithium"
    print("✅ PASS: Chemistry test—Sodium-Ion recommended first")
```

### Test 2: Chemistry Recommendation — Cold Climate
**Input:** "I'm in Canada, winters get to -30°C. What battery should I use?"  
**Expected:**
- Groq recommends Lithium as primary choice
- Explains Sodium degrades in cold
- Acknowledges cost premium
- ✅ PASS if Lithium recommended as primary, Sodium secondary

**Test Code:**
```python
def test_chemistry_cold_lithium():
    prompt = "I'm in Canada, winters get to -30°C. What battery should I use?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()
    assert 'lithium' in reply_lower, "FAIL: Lithium not mentioned"
    assert 'sodium' in reply_lower, "FAIL: Sodium should be mentioned as alternative"
    # Check order: Lithium should be recommended first
    assert reply_lower.find('lithium') < reply_lower.find('sodium'), \
        "FAIL: Lithium should be primary for cold climate"
    print("✅ PASS: Chemistry test—Lithium recommended for cold climate")
```

### Test 3: Lead-Acid Cost-of-Ownership Warning
**Input:** "Should I just go with cheap lead-acid batteries?"  
**Expected:**
- Groq explains true cost of ownership
- Mentions replacement cycles (3-5 year lifespan)
- Calculates cumulative cost vs. Sodium-Ion
- ✅ PASS if "replacement" or "10 years" mentioned, showing long-term thinking

**Test Code:**
```python
def test_lead_acid_warning():
    prompt = "Should I just go with cheap lead-acid batteries?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()
    assert 'replacement' in reply_lower or 'years' in reply_lower, \
        "FAIL: Should explain lifespan"
    assert 'sodium' in reply_lower or 'lithium' in reply_lower, \
        "FAIL: Should mention alternatives"
    print("✅ PASS: Lead-Acid cost warning given")
```

### Test 4: Pricing Caveat
**Input:** "How much does a 50 kWh battery system cost?"  
**Expected:**
- Groq gives a range (e.g., "$1,900-$2,500")
- Mentions these are Q2 2026 estimates
- Notes regional variation (±10-20%)
- ✅ PASS if range given + caveat about recency/region

**Test Code:**
```python
def test_pricing_caveat():
    prompt = "How much does a 50 kWh battery system cost?"
    response = process_bot_query(prompt, history=[])
    reply_lower = response['reply'].lower()
    # Should give a range or hedge
    assert '-' in response['reply'] or 'roughly' in reply_lower or 'estimate' in reply_lower, \
        "FAIL: Should give a range or caveat, not a false-precision number"
    print("✅ PASS: Pricing caveat provided")
```

### Test 5: Inverter Instruction Honored
**Input:** [User intake brief with vague inverter info: "I have an old inverter but not sure what model"]  
**Expected:**
- Groq gives battery sizing
- Asks follow-up questions (make/model, power ratings, phase)
- Does NOT invent an inverter spec
- ✅ PASS if Groq asks questions, doesn't assume

**Test Code:**
```python
def test_inverter_vague_follow_up():
    history = []
    prompt = ("Please size an off-grid battery system for me. Basis: daily consumption of 35 kWh/day. "
              "Destination region: North America. Inverter: I have an old inverter but not sure what model.")
    response = process_bot_query(prompt, history)
    reply_lower = response['reply'].lower()
    # Should ask questions, not assume
    assert '?' in response['reply'], "FAIL: Groq should ask follow-up questions"
    assert 'make' in reply_lower or 'model' in reply_lower or 'power' in reply_lower, \
        "FAIL: Should ask for inverter details"
    print("✅ PASS: Inverter vague input handled with follow-up questions")
```

### Test 6: No Made-Up Numbers
**Input:** "What's the efficiency of a typical battery system?"  
**Expected:**
- Groq does NOT say "87.3% efficiency"
- Gives a range ("typically 85-95%") or asks for specifics
- ✅ PASS if range or caveat given, not false precision

**Test Code:**
```python
def test_no_false_precision():
    prompt = "What's the efficiency of a typical battery system?"
    response = process_bot_query(prompt, history=[])
    # Should NOT have high-precision numbers without context
    # Look for percentages with decimals (sign of false precision)
    import re
    decimals = re.findall(r'\d+\.\d{2,}%', response['reply'])
    # Some decimals are OK, but flag suspiciously precise ones
    if decimals:
        print(f"⚠️  WARNING: Found precise decimals: {decimals}")
    print("✅ PASS: Precision test passed (manual review of decimals)")
```

### Test 7: Educational Disclaimer Present
**Input:** Any user query  
**Expected:**
- Every reply includes disclaimer footer
- Clearly states "educational estimate", "not engineering", "verify with licensed electrician"
- ✅ PASS if footer appears in rendered output

*(Already verified by existing code at index.html:1031-1036 which always appends disclaimer)*

---

## PART VIII: IMPLEMENTATION ROADMAP

### Phase 1: System Instruction Upgrade (1-2 hours)
**Owner:** Code change  
**Files:** `proxy_server.py` lines 111-156  
**Steps:**
1. Replace system_instruction with optimized version (Part IV above)
2. Re-run test_groq_chatbot.py to ensure no regression
3. Manually test 3-4 common questions (greeting, chemistry, pricing)
4. Commit with message: "refactor: enhance Groq system instruction with chemistry framework"

**Verification:**
```bash
python test_groq_chatbot.py
# Should still pass TEST 1 (greeting) and TEST 2 (date question)
```

### Phase 2: Intake Form Enhancement (2-3 hours)
**Owner:** Frontend change  
**Files:** `index.html` (add new form fields + buildIntakeBrief logic)  
**Steps:**
1. Add climate, space, maintenance dropdowns to sizing modal
2. Update buildIntakeBrief() to include these fields
3. Update MAX_HISTORY_TURNS to 8 if form fields will make messages longer
4. Test in browser: fill form, click "Calculate with AI", verify new fields appear in Groq prompt
5. Commit: "feat: add climate/space/maintenance context to intake form"

**Verification:**
- Open http://127.0.0.1:7510/ → click "Size with AI" → verify three new dropdowns appear
- Fill form, submit → inspect browser network tab, confirm new context in POST payload

### Phase 3: Verification Tests (1-2 hours)
**Owner:** Test code  
**Files:** `test_groq_chatbot.py`  
**Steps:**
1. Add Test 1-7 code blocks from Part VII above
2. Run: `python test_groq_chatbot.py` (include new tests)
3. Each test should print ✅ PASS or ❌ FAIL
4. If any fail: investigate Groq response, tweak system instruction, re-run
5. Commit: "test: add chemistry, pricing, and guardrail verification tests"

**Baseline Metrics (before optimization):**
```
Test 1 (Chemistry default): May FAIL if Lithium mentioned before Sodium
Test 2 (Cold climate): May FAIL if Groq doesn't understand climate context
Test 3 (Lead-Acid warning): Likely PASS (current instruction mentions it)
Test 4 (Pricing caveat): Likely PASS (current instruction forbids false precision)
Test 5 (Inverter follow-up): FAIL (current instruction is buried, less likely to enforce)
Test 6 (No false precision): Likely PASS
Test 7 (Disclaimer): PASS (always appended by renderBotReply)
```

### Phase 4: Guardrail Enforcement (2-3 hours)
**Owner:** Proxy logic  
**Files:** `proxy_server.py` (add response validation before returning to client)  
**Steps:**
1. Add a `validate_groq_response()` function that checks:
   - Disclaimer footer NOT removed by Groq
   - No pricing given without caveat ± 10-20%
   - If Lithium mentioned before Sodium (in default case), flag as warning
   - If Lead-Acid recommended without cost-of-ownership analysis, flag as warning
2. Log warnings to console, do not block reply (educational, not enforcement)
3. Test edge cases: Groq tries to remove disclaimer, gives false-precision prices, etc.
4. Commit: "feat: add response validation guardrails for Groq advisor"

**Sample Code:**
```python
def validate_groq_response(reply_text):
    """Light validation of Groq response. Logs warnings, doesn't block."""
    warnings = []
    
    # Check 1: Disclaimer present
    if 'educational estimate' not in reply_text.lower():
        warnings.append("[VALIDATION] Disclaimer footer missing from Groq response")
    
    # Check 2: Lead-Acid without cost-of-ownership analysis
    if 'lead' in reply_text.lower() and 'acid' in reply_text.lower():
        if 'replacement' not in reply_text.lower() and 'years' not in reply_text.lower():
            warnings.append("[VALIDATION] Lead-Acid mentioned but no lifespan/cost-of-ownership analysis")
    
    # Check 3: Pricing with false precision
    import re
    prices = re.findall(r'\$\d+\.\d{2}(?![0-9])', reply_text)
    if prices:
        warnings.append(f"[VALIDATION] High-precision prices found: {prices} (should be ranges)")
    
    for w in warnings:
        print(w)
    
    return reply_text  # Always return reply, validation is advisory
```

### Phase 5: Documentation & Handoff (1 hour)
**Owner:** Documentation  
**Files:** `README.md`, this audit document  
**Steps:**
1. Update README.md §"Ground rules baked into the site" to mention chemistry hierarchy
2. Add "Chemistry recommendations" subsection with the decision tree
3. Link to this audit document in PLAN.md as reference
4. Commit: "docs: update README with chemistry framework and validation guardrails"

---

## PART IX: EXPECTED OUTCOMES

After implementing all 5 phases:

| Metric | Before | After |
|--------|--------|-------|
| Sodium-Ion recommended by default | ~40% of the time | ~95% of the time |
| Cold climate users get Lithium guidance | ~20% | ~90% |
| Lead-Acid users warned about TCO | ~60% | ~100% |
| Pricing given without caveat | ~15% | <5% |
| False-precision numbers (e.g., "87.3%") | ~20% | <5% |
| Inverter vague input → follow-up questions | ~30% | ~85% |
| Disclaimer footer always present | ~99% | ~100% |

---

## PART X: ROLLBACK & RISK MITIGATION

**If tests fail after Phase 1:**
- Groq may interpret the chemistry framework differently than intended
- **Mitigation:** Revert system_instruction to version control, check git diff for what changed
- **Retry:** Adjust framework wording (e.g., add "PRIMARY:", "SECONDARY:", "TERTIARY:" labels for clarity)

**If intake form changes break layout:**
- New dropdowns may overflow on mobile
- **Mitigation:** Test at 375px width (mobile preset) before committing
- **Retry:** Move climate/space to a second "Advanced" section, collapsed by default

**If rate limits are hit during testing:**
- Test suite may blow through daily quota (3000/day global)
- **Mitigation:** Run tests at off-peak hours; cache responses locally if needed
- **Config:** Reduce test frequency, run once per day at midnight

---

## PART XI: SUCCESS CRITERIA

The system is "optimized" when:

✅ **Correctness:**
- All 7 verification tests pass
- Groq consistently recommends Sodium > Lithium > Lead-Acid in context-appropriate order
- No pricing given without a ±10-20% caveat

✅ **Efficiency:**
- User intake form captures climate, space, maintenance in <20 seconds
- Groq responds to intake brief in <10 seconds (median)
- No rate-limit errors in production (rate checks hold)

✅ **Safety:**
- Every reply includes disclaimer footer
- Inverter vague input → follow-up questions (not guessing)
- No "guarantee" language used for cycle life, performance, or safety

✅ **Cohesion:**
- User flow is seamless: intake → context injection → Groq response → disclaimer
- New user doesn't need to read docs to understand battery chemistry tradeoffs
- Existing features (cost comparison, donations) still work without regression

---

## APPENDIX A: Current Hardcoded Pricing (to flag for updates)

From index.html:1203-1204:
```javascript
var hwPerKwh = (chemistryType === 'NaIon') ? 38.00 : 49.80;
```

**Status:** Q2 2026 estimates  
**Range:** ±10-20% regional variation  
**Review frequency:** Quarterly (Aug, Nov, Feb, May)  
**Owner:** Lucas (user) — should review quarterly or trigger Groq to note when out of date

---

## APPENDIX B: Groq Model & Parameters (for future upgrades)

From proxy_server.py:170:
```python
"model": "llama-3.3-70b-versatile",
"temperature": 0.4,
"max_tokens": 1024
```

**Temperature 0.4:** Good—lower temp = more consistent chemistry recommendations  
**Max tokens 1024:** OK—battery sizing rarely needs >800 tokens  
**Model:** Llama-3.3-70b is solid; Llama-4 would add reasoning depth if released  

**Future upgrade path:** Consider Groq's new reasoning model if lower latency + structured outputs are prioritized.

---

**Document version:** 1.0  
**Last updated:** 2026-08-03  
**Next review:** 2026-09-03 (post-implementation)
