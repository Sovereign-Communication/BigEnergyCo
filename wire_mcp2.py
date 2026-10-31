import json, os

home = os.path.expanduser("~")
PATH = os.path.join(home, ".claude.json")
with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

RUNTIME_PY = os.path.join(home, ".config", "freebuff-desktop", "runtimes",
                          "harness-mcp", "Scripts", "python.exe")
if not os.path.exists(RUNTIME_PY):
    raise SystemExit("runtime venv python missing: " + RUNTIME_PY)

ROOTS = ",".join([
    os.path.join(home, "Documents", "GitHub"),
    os.path.join(home, ".freebuff", "worktrees"),
    os.path.join(home, ".codex", "worktrees"),
])
NEW = {
    "type": "stdio",
    "command": RUNTIME_PY,
    "args": ["-m", "harness.mcp"],
    "env": {
        "HARNESS_MCP_ALLOWED_ROOTS": ROOTS,
        "PYTHONIOENCODING": "utf-8",
    },
}

changed = []
# user scope -> every project/lane sees it
data.setdefault("mcpServers", {})["harness"] = json.loads(json.dumps(NEW))
changed.append("user-scope mcpServers.harness -> runtimes venv")

# operator project scope -> replace stale venv entry, drop dead OC tunnel
for key, pcfg in list((data.get("projects") or {}).items()):
    if not isinstance(pcfg, dict):
        continue
    norm = key.replace(chr(92), "/").rstrip("/").lower()
    if not norm.endswith("documents/github/harness"):
        continue
    servers = pcfg.get("mcpServers")
    if servers is None:
        continue
    if "harness-oc" in servers:
        del servers["harness-oc"]
        changed.append(key + ": removed harness-oc (terminated EC2 lane)")
    servers["harness"] = json.loads(json.dumps(NEW))
    changed.append(key + ": harness -> runtimes venv (latest main)")

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("home:", home)
print("runtime:", RUNTIME_PY)
print("roots:", ROOTS)
for c in changed:
    print(" -", c)
