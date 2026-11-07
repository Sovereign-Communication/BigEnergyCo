#!/usr/bin/env python3
"""Resumption scan (2026-11-01): size-exact candidates + git blob SHA-1 verdict.

Targets (git blob SHA-1, --no-filters semantics):
  cities.js   a964fc51666cc1d36b6f73c6477b8957b594ffc4   size 20722
  frontier.js 1a6da8de6311ca9ae11667fbe06a7e564d76c6a7   size 24977

Scope:
  1. C:/Users  -- bounded size-exact walk (re-derives the 6 Users candidates)
  2. C:/Windows/SoftwareDistribution/Download -- *.cat, size-exact
  3. C:/Windows/WinSxS -- DiagSvc.dll, size-exact

No writes outside stdout.
"""
import hashlib
import os
import sys

TARGETS = {
    "a964fc51666cc1d36b6f73c6477b8957b594ffc4": ("cities.js", 20722),
    "1a6da8de6311ca9ae11667fbe06a7e564d76c6a7": ("frontier.js", 24977),
}
SIZES = {20722, 24977}


def blob_sha1(path):
    data = open(path, "rb").read()
    h = hashlib.sha1(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest(), len(data)


def scan(root, predicate, label):
    print(f"\n=== {label}: {root} ===", flush=True)
    n = 0
    seen = 0
    errors = 0
    for dp, dn, fn in os.walk(root, onerror=lambda e: None):
        for f in fn:
            p = os.path.join(dp, f)
            if not predicate(p):
                continue
            try:
                st = os.stat(p)
            except Exception:
                errors += 1
                continue
            if st.st_size not in SIZES:
                continue
            seen += 1
            try:
                sha, size = blob_sha1(p)
            except Exception as e:
                errors += 1
                print(f"  UNREADABLE | {p} | {st.st_size} | {e}", flush=True)
                continue
            verdict = "MATCH" if sha in TARGETS else "no-match"
            if sha in TARGETS:
                n += 1
            print(f"  {p} | {size} | {sha} | {verdict}", flush=True)
    print(
        f"  -- {label} size-exact candidates: {seen}; matches: {n}; stat/read errors: {errors}",
        flush=True,
    )
    return seen, n, errors


def main():
    totals = [0, 0, 0]
    for root, pred, label in (
        ("C:/Users", lambda p: True, "USERS"),
        (
            "C:/Windows/SoftwareDistribution/Download",
            lambda p: p.lower().endswith(".cat"),
            "SOFTWAREDISTRIBUTION-CAT",
        ),
        ("C:/Windows/WinSxS", lambda p: os.path.basename(p).lower() == "diagsvc.dll", "WINSXS-DIAGSVC"),
    ):
        if not os.path.isdir(root):
            print(f"\n=== {label}: {root} ABSENT ===", flush=True)
            continue
        s, m, e = scan(root, pred, label)
        totals[0] += s
        totals[1] += m
        totals[2] += e
    print(
        f"\nTOTAL size-exact candidates: {totals[0]}; exact blob matches: {totals[1]}; errors: {totals[2]}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
