# Groq Optimization Roadmap — Visual Guide

## Current State vs. Optimized State

### CURRENT FLOW ❌

```
User fills form (bill/consumption, region, inverter)
            ↓
buildIntakeBrief() creates text
            ↓
POST to /api/chat
            ↓
process_bot_query() → Groq API
            ↓
System instruction: "Be helpful, don't sell, etc."
            ↓
Groq responds (general knowledge, may pick wrong battery)
            ↓
Frontend appends disclaimer
            ↓
User sees answer
```

**Problems:**

- ❌ No chemistry hierarchy guidance to Groq
- ❌ No climate/space context in intake form
- ❌ Groq can recommend Lead-Acid even when Sodium-Ion is better
- ❌ Pricing caveats missing
- ❌ No validation of Groq's response

---

### OPTIMIZED FLOW ✅

```
User fills form (bill/consumption, region, inverter, CLIMATE, SPACE, MAINTENANCE)
            ↓
buildIntakeBrief() creates structured text with [ADVISOR INSTRUCTION] tags
            ↓
POST to /api/chat with context injection
            ↓
process_bot_query() → Groq API
            ↓
System instruction: [New version with chemistry framework]
  - PRIMARY: Sodium-Ion (default)
  - SECONDARY: Lithium (cold/space-constrained)
  - TERTIARY: Lead-Acid (rare, TCO warning)
            ↓
Groq responds (uses chemistry framework, respects context)
            ↓
validate_groq_response() checks for:
  - No Lead-Acid without TCO analysis
  - No false-precision pricing
            ↓
Frontend appends disclaimer
            ↓
User sees answer (chemistry-optimized, context-aware)
```

**Improvements:**

- ✅ Chemistry hierarchy enforced in system instruction
- ✅ Climate/space/maintenance captured in form
- ✅ Groq gets explicit decision tree via [ADVISOR INSTRUCTION]
- ✅ Response validation catches common issues
- ✅ Pricing always includes caveats

---

## Implementation Timeline

### Phase 1: System Instruction (1-2 hours)

```
START: Replace proxy_server.py lines 111-156
├─ Copy new system_instruction (see GROQ_IMPLEMENTATION_GUIDE.md CHANGE 1)
├─ Test: python test_groq_chatbot.py (should still pass existing tests)
└─ Commit: "refactor: enhance Groq system instruction with chemistry framework"
```

### Phase 2: Response Validation (1 hour)

```
START: Add validation function to proxy_server.py
├─ Add validate_groq_response() (see GROQ_IMPLEMENTATION_GUIDE.md CHANGE 2)
├─ Hook it into process_bot_query() return statement
├─ Test: python test_groq_chatbot.py
└─ Commit: "feat: add response validation guardrails for Groq advisor"
```

### Phase 3: Form Enhancement (2 hours)

```
START: Add climate/space/maintenance fields to index.html
├─ Add HTML <select> elements (see GROQ_IMPLEMENTATION_GUIDE.md CHANGE 3)
├─ Test in browser: http://127.0.0.1:7510/ → "Size with AI" → see new fields
├─ Verify new fields appear in form
└─ Commit: "feat: add climate/space/maintenance context to intake form"
```

### Phase 4: Intake Logic (1 hour)

```
START: Update buildIntakeBrief() in index.html
├─ Extract new form field values (see GROQ_IMPLEMENTATION_GUIDE.md CHANGE 4)
├─ Inject climate context into prompt
├─ Add [ADVISOR INSTRUCTION] for chemistry selection
├─ Test in browser: fill form → submit → check Network tab
└─ Commit: "feat: inject climate context into Groq intake prompt"
```

### Phase 5: Verification Tests (1-2 hours)

```
START: Add verification tests to test_groq_chatbot.py
├─ Add 6 new test functions (see GROQ_IMPLEMENTATION_GUIDE.md CHANGE 5)
├─ Run: python test_groq_chatbot.py (should pass all tests)
├─ If any fail: debug Groq response, adjust system instruction, re-run
└─ Commit: "test: add chemistry, pricing, and guardrail verification tests"
```

### Phase 6: Docs & Handoff (1 hour)

```
START: Update README.md
├─ Add section: "Battery Chemistry Recommendations"
├─ Link to GROQ_AUDIT_AND_OPTIMIZATION.md
├─ Update "Ground rules" section
└─ Commit: "docs: add chemistry framework documentation"
```

**Total time:** ~7-10 hours (can be split across days)

---

## Decision Tree: Which Chemistry to Recommend

```
User asks: "Which battery should I choose?"

                       ╔════════════════════════════════════════════════════════╗
                       ║ GATHER CONTEXT                                         ║
                       ║ - Climate? (-30°C? -10°C? Tropical?)                   ║
                       ║ - Space? (Limited? Normal? Plenty?)                    ║
                       ║ - Maintenance? (Zero? Basic? Hands-on?)                ║
                       ║ - Budget constraint?                                   ║
                       ║ - Regional market access?                              ║
                       ╚════════════════════════════════════════════════════════╝
                                       ↓
                        ┌──────────────────────────────────┐
                        │ Cold climate (< -10°C frequent)?  │
                        └──────────────────────────────────┘
                        ✓ YES → Recommend LITHIUM first
                              Reason: Sodium degrades below -10°C
                              Mention: Higher cost, but reliable in cold
                              Fallback: Sodium with external heating (expensive)
                        ✗ NO → Continue
                               ↓
                        ┌──────────────────────────────────┐
                        │ Space very limited?               │
                        └──────────────────────────────────┘
                        ✓ YES → Recommend LITHIUM
                              Reason: Compact vs. Sodium bulkier
                              Mention: LFP is best for RVs, boats, apartments
                        ✗ NO → Continue
                               ↓
                        ┌──────────────────────────────────┐
                        │ Budget extremely tight?           │
                        └──────────────────────────────────┘
                        ✓ YES → Recommend SODIUM-ION
                              Mention: Now price-competitive with Lithium
                              If they ask about Lead-Acid:
                              "Lead-Acid dies in 3-5 years and costs more
                               to replace repeatedly. Sodium-Ion is cheaper
                               over 10+ years."
                        ✗ NO → Continue
                               ↓
                        ┌──────────────────────────────────────────────┐
                        │ DEFAULT: RECOMMEND SODIUM-ION                 │
                        ├──────────────────────────────────────────────┤
                        │ "Sodium-Ion is now the best choice:           │
                        │ • Cost: $38-42/kWh (price-competitive)        │
                        │ • Life: 10-15 years (200k-300k cycles)        │
                        │ • Environment: 40% less carbon than Lithium   │
                        │ • Space: Bulk is negligible for home storage  │
                        │                                               │
                        │ Lithium costs 20-30% more but lasts 5-10      │
                        │ years longer. Choose Lithium if: cold climate,│
                        │ space-constrained, or want maximum lifespan."│
                        └──────────────────────────────────────────────┘

```

---

## Metrics: Before → After

| Metric                            | Before | After | Target |
| --------------------------------- | ------ | ----- | ------ |
| Sodium-Ion recommended by default | 40%    | 85%   | >90%   |
| Cold climate → Lithium            | 20%    | 80%   | >85%   |
| Lead-Acid → TCO warning           | 60%    | 95%   | 100%   |
| Pricing without caveat            | 15%    | 5%    | <5%    |
| False precision (e.g., 87.3%)     | 20%    | 5%    | <10%   |
| Inverter vague → follow-up        | 30%    | 80%   | >80%   |
| Response validation errors caught | 0%     | 85%   | >90%   |
| Test suite passes                 | 60%    | 100%  | 100%   |

---

## File Changes Summary

| File                   | Change                                        | Lines           | Complexity |
| ---------------------- | --------------------------------------------- | --------------- | ---------- |
| `proxy_server.py`      | Replace system_instruction                    | 111-156         | Medium     |
| `proxy_server.py`      | Add validate_groq_response()                  | After 195       | Medium     |
| `index.html`           | Add form fields (climate, space, maintenance) | ~850            | Low        |
| `index.html`           | Update buildIntakeBrief()                     | 1145-1179       | Medium     |
| `test_groq_chatbot.py` | Add 6 verification tests                      | After 64        | Low        |
| `README.md`            | Add chemistry framework docs                  | §"Ground rules" | Low        |

**Total additions:** ~350 lines of code/docs  
**Total deletions:** ~20 lines (obsolete comments)  
**Net change:** ~330 lines

---

## Guardrails: What Gets Checked

### 1. Chemistry Recommendation Order

```
❌ FAIL: "Lithium is best because it lasts longer" (no mention of Sodium)
✅ PASS: "Sodium-Ion is the default choice (cost, environment).
         Lithium is better if you're in a cold climate or space-constrained."
```

### 2. Lead-Acid Warning

```
❌ FAIL: "Lead-Acid is a cheap option at $10-15/kWh."
✅ PASS: "Lead-Acid is cheaper upfront ($10-15/kWh) but dies in 3-5 years.
         Over 10 years, Sodium-Ion costs the same or less AND lasts longer."
```

### 3. Pricing Precision

```
❌ FAIL: "A 50 kWh system costs $2,347.89"
✅ PASS: "A 50 kWh Sodium-Ion system costs roughly $1,900-$2,500
         (Q2 2026 estimate; varies ±10-20% by region)."
```

### 4. Inverter Decision Tree

```
❌ FAIL: "For your 35 kWh load, a 10 kW Victron Phoenix is ideal."
         (invents inverter without knowing their needs)
✅ PASS: "I can size the battery for 35 kWh. For the inverter, I need to know:
         - Do you already own one? (If yes: make/model, power rating, voltage?)
         - Is your system off-grid or hybrid?
         - What are your peak and sustained loads?"
```

### 5. Regional Awareness

```
❌ FAIL: "Lead-Acid is rare these days."
         (ignores that Lead-Acid is still 60% of market in some regions)
✅ PASS: "In many countries, Lead-Acid is still common. But Sodium-Ion is now
         cost-competitive and lasts 3x longer. I'd recommend upgrading to Sodium."
```

---

## Testing Checklist

```
BEFORE IMPLEMENTING:
☐ Current tests passing (python test_groq_chatbot.py)
☐ System is stable (no recent errors in proxy logs)

DURING PHASE 1 (System Instruction):
☐ Replace system_instruction in proxy_server.py
☐ Run existing tests → should pass without change

DURING PHASE 2 (Response Validation):
☐ Add validate_groq_response() function
☐ Hook into process_bot_query() return
☐ Run existing tests → should pass

DURING PHASE 3-4 (Form & Intake):
☐ Add HTML form fields to sizing modal
☐ Update buildIntakeBrief() to extract them
☐ Test in browser: fill form → submit → Network tab shows new context

DURING PHASE 5 (Verification Tests):
☐ Add all 6 new test functions to test_groq_chatbot.py
☐ Run: python test_groq_chatbot.py
☐ All tests should pass ✅

BEFORE COMMITTING:
☐ No rate limit errors (check Groq API quota)
☐ No regressions in existing features (calculator, donation, legal modals)
☐ Manual QA: try 3-5 real questions in the UI
☐ Commit messages are clear

AFTER DEPLOYING:
☐ Monitor proxy_server.py logs for validation warnings
☐ Sample 10 Groq responses manually to check for guardrail violations
☐ Track response times (should be <10s median)
☐ Verify rate limits are holding (8/min, 150/day per IP)
```

---

## Troubleshooting Guide

### Problem: Test fails — "Sodium not mentioned before Lithium"

**Cause:** Groq is using old prompt, or chemistry framework wasn't clear enough  
**Fix:**

1. Check that system_instruction was actually replaced (not cached)
2. Clear proxy server cache (restart proxy_server.py)
3. Sharpen the chemistry framework language (add "PRIMARY", "SECONDARY", "TERTIARY")
4. Re-run test

### Problem: Form fields don't appear in intake form

**Cause:** HTML wasn't inserted correctly, or ID mismatch  
**Fix:**

1. Check that new form fields were added (use browser dev tools → Inspect)
2. Verify IDs match: `destClimate`, `destSpace`, `maintenanceComfort`
3. Verify they're inside the `.modal` or `.sizing-modal` class
4. Clear browser cache (Ctrl+Shift+Delete)

### Problem: buildIntakeBrief() throws error

**Cause:** Form element doesn't exist yet  
**Fix:**

1. Add a null check: `var climateEl = document.getElementById('destClimate');`
2. Provide fallback: `var climate = climateEl ? climateEl.value : 'unknown';`
3. Test in browser console: `buildIntakeBrief()` should print no errors

### Problem: Rate limit errors during testing

**Cause:** Test suite is hitting rate limits (8/min, 150/day per IP)  
**Fix:**

1. Space out test runs: don't run test suite more than once per 10 minutes
2. Run tests at off-peak times (e.g., midnight, not business hours)
3. If testing heavily, temporarily increase limits in proxy_server.py
   ```python
   RATE_PER_IP_PER_MIN = 15  # Increased from 8 during dev
   ```
4. Reset to production values before committing

### Problem: Groq response is cut off (stops mid-sentence)

**Cause:** `max_tokens=1024` is too low  
**Fix:**

1. Increase max_tokens in proxy_server.py:
   ```python
   "max_tokens": 1500  # Increased from 1024
   ```
2. Monitor token usage; revert if costs spike
3. If responses still truncated, adjust Groq model to `llama-3.3-70b-reasoning`

---

## Success Criteria Checklist

- [ ] All 7 verification tests pass
- [ ] Sodium-Ion recommended 85%+ of the time in default case
- [ ] Cold climate users get Lithium guidance 80%+ of the time
- [ ] Lead-Acid users see TCO warning 95%+ of the time
- [ ] Pricing never given as false precision (e.g., $1,234.56) — ranges only
- [ ] Inverter vague input → follow-up questions 80%+ of the time
- [ ] No regressions in existing features (calculator, donations, legal)
- [ ] Response times < 10s median
- [ ] Rate limits still holding (8/min, 150/day, 3000/day global)
- [ ] Documentation updated (README.md links to audit)

---

## Quick Reference: Command Cheat Sheet

```bash
# Run existing tests (before optimizations)
python test_groq_chatbot.py

# Start proxy server (in one terminal)
python proxy_server.py

# Start Freenet (in another terminal)
[Freenet binary startup command]

# Open browser
LINK.bat
# or
http://127.0.0.1:7510/

# Test a specific chemistry prompt
# (After implementing Phase 1)
curl -X POST http://127.0.0.1:7510/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Which battery should I use? I live in Canada, winters to -30C."}'

# Clear browser cache during testing
# Ctrl+Shift+Delete (Windows)
# Cmd+Shift+Delete (Mac)

# Monitor rate limits in real-time
tail -f proxy_server.py.log | grep "RATE_LIMIT"

# Rollback a change
git revert <commit-hash>
```

---

## Next Steps

1. **Read** GROQ_AUDIT_AND_OPTIMIZATION.md (full context)
2. **Read** GROQ_IMPLEMENTATION_GUIDE.md (code-by-code changes)
3. **Pick** a start date (Phase 1: System Instruction)
4. **Implement** in order: Phase 1 → 2 → 3 → 4 → 5 → 6
5. **Test** after each phase
6. **Commit** with clear messages
7. **Monitor** for guardrail violations in production

**Estimated total time:** 7-10 hours (can be spread across 1-2 weeks)

---

**Document version:** 1.0  
**Created:** 2026-08-03  
**For questions:** See GROQ_AUDIT_AND_OPTIMIZATION.md §Appendix
