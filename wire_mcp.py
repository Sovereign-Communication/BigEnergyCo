import json

PATH = r"C:\Users\SCM\.claude.json"
with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

RUNTIME_PY = r"C:\Users\SCM\.config\freebuff-desktop\runtimes\harness-mcp\Scripts\python.exe"
ROOTS = ";".join([
    r"C:\Users\SCM\Documents\GitHub\Harness",
    r"C:\Users\SCM\Documents\GitHub",
    r"C:\Users\Sean\.freebuff\worktrees",
    r"C:\Users\Sean\.codex\worktrees",
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

projects = data.get("projects") or {}
changed = []
for key, pcfg in list(projects.items()):
    if not isinstance(pcfg, dict):
        continue
    norm = key.replace(chr(92), "/").rstrip("/").lower()
    if norm != "c:/users/sean/documents/github/harness":
        continue
    servers = pcfg.get("mcpServers")
    if not servers:
        continue
    if "harness-oc" in servers:
        del servers["harness-oc"]
        changed.append(key + ": removed harness-oc (dead EC2 lane)")
    servers["harness"] = json.loads(json.dumps(NEW))
    changed.append(key + ": harness -> durable runtimes venv (0.4.2 @ origin/main)")

with open(PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("backup: C:/Users/Sean/.claude.json.bak-20261022-mcp")
for c in changed:
    print(" -", c)
if not changed:
    print("!! nothing changed -- check project keys")
