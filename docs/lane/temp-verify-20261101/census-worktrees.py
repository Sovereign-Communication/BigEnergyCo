#!/usr/bin/env python3
"""Step 4 census: every registered worktree, its HEAD, and a per-file proof of its
working tree (tracked modifications + untracked files).

For each dirty file: git status code, size, git blob SHA-1, and whether that exact
blob already exists in the shared object database (i.e. some ref reaches it). A file
that is "no" is unique to that working tree until proven otherwise.

Read-only.
"""
import hashlib
import os
import subprocess
import sys

REPO = sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/SCM/Documents/GitHub/BigEnergyCo/BigEnergyCo"


def git(*args, cwd=REPO):
    return subprocess.run(
        ["git", "-C", cwd, *args], capture_output=True, text=True, errors="replace"
    )


def blob_sha1(path):
    data = open(path, "rb").read()
    h = hashlib.sha1(b"blob %d\0" % len(data))
    h.update(data)
    return h.hexdigest(), len(data)


def odb_has(hashes):
    if not hashes:
        return {}
    out = subprocess.run(
        ["git", "-C", REPO, "cat-file", "--batch-check=%(objectname) %(objecttype)"],
        input="".join(h + "\n" for h in hashes),
        capture_output=True,
        text=True,
    ).stdout.splitlines()
    res = {}
    for h, line in zip(hashes, out):
        parts = line.split()
        res[h] = len(parts) == 2 and parts[1] == "blob"
    return res


def main():
    porcelain = git("worktree", "list", "--porcelain").stdout
    worktrees = []
    cur = {}
    for line in porcelain.splitlines():
        if line.startswith("worktree "):
            if cur:
                worktrees.append(cur)
            cur = {"path": line[9:]}
        elif line.startswith("HEAD "):
            cur["head"] = line[5:]
        elif line.startswith("branch "):
            cur["branch"] = line[7:]
        elif line == "detached":
            cur["branch"] = "DETACHED"
        elif line == "bare":
            cur["branch"] = "BARE"
    if cur:
        worktrees.append(cur)

    print(f"# worktrees: {len(worktrees)}")
    summary = []
    for w in worktrees:
        p = w["path"]
        st = git("status", "--porcelain", "--untracked-files=all", cwd=p)
        lines = [x for x in st.stdout.splitlines() if x.strip()]
        files = []
        for ln in lines:
            code, rel = ln[:2], ln[3:]
            full = os.path.join(p, rel.replace("/", os.sep))
            if not os.path.isfile(full):
                files.append((code, rel, None, None, None))
                continue
            try:
                sha, size = blob_sha1(full)
            except Exception as e:
                files.append((code, rel, None, None, f"ERR {e}"))
                continue
            files.append((code, rel, size, sha, None))
        hashes = [f[3] for f in files if f[3]]
        exists = odb_has(hashes)
        print(f"\n## {p}")
        print(f"   HEAD {w.get('head','?')}  branch {w.get('branch','?')}  dirty {len(files)}")
        for code, rel, size, sha, err in files:
            if err:
                print(f"   {code} {rel}\t{err}")
            elif sha:
                print(
                    f"   {code} {rel}\t{size}\t{sha}\t{'in-odb' if exists.get(sha) else 'UNIQUE'}"
                )
            else:
                print(f"   {code} {rel}\t(no file on disk)")
        summary.append((p, len(files)))

    print("\n# summary")
    for p, n in summary:
        print(f"{n:5d} dirty  {p}")


if __name__ == "__main__":
    main()
