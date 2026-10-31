"""HV-2 live dogfood: real repo, real settings, real condensation path.

Exercises the code that PR-shipped in 5b0415f outside the test suite:
AutonomousAgent._hourglass_request_context -> condenser.distill_context ->
MicroBrief.to_brief_pack() -> brief.validate/freshness/render, and the
brief_built ledger event appended by harness/agent.py.

The ledger is redirected to a sandbox path via HARNESS_LEDGER so the real
operator ledger is not touched.  No model call, no network: condensation is
model-free by contract.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
LEDGER = Path(sys.argv[2]).resolve()
os.environ["HARNESS_LEDGER"] = str(LEDGER)
sys.path.insert(0, str(ROOT))

from harness.agent import AutonomousAgent          # noqa: E402
from harness.brief import (                          # noqa: E402
    estimate_brief_tokens,
    freshness_report,
    render_brief,
    validate_brief,
)

PROMPT = (
    "Explain what the evidence-bearing context brief in harness/brief.py "
    "guarantees about source freshness."
)

agent = AutonomousAgent(root_dir=ROOT)
context, files, micro, web_sources = agent._hourglass_request_context(PROMPT)
pack = micro.to_brief_pack()

print("== live intake ==")
print("prompt        :", PROMPT[:70], "...")
print("files in      :", len(files), sorted(files)[:6])
print("web sources   :", web_sources)
print("prompt context:", len(context), "chars (the bounded text a seat receives)")
print()
print("== schema-v2 pack (HV-2) ==")
print("schema_version     :", pack.get("schema_version"))
print("built_at           :", pack.get("built_at"))
print("goal               :", (pack.get("goal") or "")[:80])
print("sources            :", len(pack.get("sources", [])), "cited with sha256")
for s in pack.get("sources", [])[:4]:
    print("   -", s.get("path"), "sha", str(s.get("sha256"))[:16],
          "bytes", s.get("bytes"), "observed_at", s.get("observed_at"))
print("windows            :", len(pack.get("windows", [])))
print("scope.included     :", len(pack.get("scope", {}).get("included", [])))
print("scope.excluded     :", len(pack.get("scope", {}).get("excluded", [])))
print("coverage counters  :", json.dumps(pack.get("coverage", {})))
print("omitted (visible)  :", pack.get("omitted"))
print("conflicts          :", pack.get("conflicts"))
print("estimated_tokens   :", pack.get("estimated_tokens"),
      "| re-measured:", estimate_brief_tokens(pack))
print()
print("== independent consumers (zero I/O) ==")
print("validate_brief issues :", validate_brief(pack) or "none (valid)")
rendered = render_brief(pack)
print("render_brief          :", len(rendered), "chars, first line:",
      rendered.splitlines()[0][:80] if rendered else "(empty)")
print("validate re-render    :", validate_brief(pack) or "none (valid)")
print()
print("== freshness against the live filesystem ==")
rep = freshness_report(pack, reader=lambda p: (ROOT / p).read_text(
    encoding="utf-8", errors="replace"))
print(json.dumps(rep, indent=1)[:1200])
print()
print("== ledger event (durable evidence) ==")
if LEDGER.exists():
    for line in LEDGER.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        if rec.get("event") == "brief_built" or "brief" in str(rec.get("event", "")):
            print(json.dumps({k: v for k, v in rec.items()
                              if k not in ("prev_hash", "hash", "ts", "timestamp")},
                             indent=1))
else:
    print("NO LEDGER WRITTEN AT", LEDGER)
print()
print("DOGFOOK_LOCAL: OK")
