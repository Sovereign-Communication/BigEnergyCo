#!/usr/bin/env python3
"""Per-file proof pass over C:/temp (unified plan Step 1 rules).

For every file: size, mtime, git blob SHA-1, and whether that exact blob exists in
the canonical clone's object database (i.e. some live or archived ref reaches it).

Usage: python prove-ctemp.py <repo-path> > ctemp-proof.tsv
Read-only.
"""
import hashlib
import os
import subprocess
import sys
import time

ROOT = "C:/temp"


def blob_sha1(path):
    data = open(path, "rb").read()
    h = hashlib.sha1(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest(), len(data)


def main():
    repo = sys.argv[1]
    # Build the set of objects reachable from all refs (batch check against the odb).
    files = []
    for dp, dn, fn in os.walk(ROOT):
        for f in fn:
            p = os.path.join(dp, f)
            try:
                st = os.stat(p)
            except Exception:
                continue
            files.append((p, st.st_size, st.st_mtime))
    files.sort()

    rows = []
    hashes = []
    for p, size, mtime in files:
        try:
            sha, n = blob_sha1(p)
        except Exception as e:
            rows.append((p, size, mtime, "READ-ERROR", str(e)))
            continue
        rows.append((p, size, mtime, sha, ""))
        hashes.append((p, sha))

    # git cat-file --batch-check tells us if the object exists in the odb.
    inp = "".join(h + "\n" for _, h in hashes)
    out = subprocess.run(
        ["git", "-C", repo, "cat-file", "--batch-check=%(objectname) %(objecttype)"],
        input=inp,
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    exists = {}
    for (p, h), line in zip(hashes, out):
        parts = line.split()
        exists[p] = len(parts) == 2 and parts[1] == "blob"

    print("path\tbytes\tmtime\tblob_sha1\tin_repo_odb")
    for p, size, mtime, sha, extra in rows:
        ts = time.strftime("%Y-%m-%dT%H:%M", time.localtime(mtime))
        if sha == "READ-ERROR":
            print(f"{p}\t{size}\t{ts}\tREAD-ERROR\t{extra}")
        else:
            print(f"{p}\t{size}\t{ts}\t{sha}\t{'YES' if exists.get(p) else 'no'}")


if __name__ == "__main__":
    main()
