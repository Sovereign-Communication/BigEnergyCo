#!/usr/bin/env python3
"""Enumerate the stat/read failures from the C:/Users size-exact walk so the
proof ledger can name what the scan could not see (permission / reparse points).

Read-only. Prints the first N error paths plus a summary by error string.
"""
import os
import sys
from collections import Counter

N = 400
errors = []


def onerr(e):
    errors.append((getattr(e, "filename", "?"), repr(e)))


n = 0
for dp, dn, fn in os.walk("C:/Users", onerror=onerr):
    for f in fn:
        p = os.path.join(dp, f)
        try:
            os.stat(p)
        except Exception as e:
            errors.append((p, repr(e)))
        n += 1

kinds = Counter(err[1] for err in errors)
print(f"files visited: {n}")
print(f"errors: {len(errors)}")
print("\n=== error kinds ===")
for k, c in kinds.most_common():
    print(f"  {c:6d}  {k}")
print(f"\n=== first {N} error paths ===")
for p, k in errors[:N]:
    print(f"  {p} | {k}")
