import json, os, subprocess

home = os.path.expanduser("~")
PATH = os.path.join(home, ".claude.json")
with open(PATH, encoding="utf-8") as f:
    data = json.load(f)

print("== user-scope ==")
u = (data.get("mcpServers") or {}).get("harness")
print(json.dumps(u, indent=2) if u else "MISSING")

print("== operator project key ==")
for key, pcfg in (data.get("projects") or {}).items():
    if not isinstance(pcfg, dict):
        continue
    norm = key.replace(chr(92), "/").rstrip("/").lower()
    if norm.endswith("documents/github/harness"):
        servers = pcfg.get("mcpServers") or {}
        print(key, "->", list(servers.keys()))
        if "harness-oc" in servers:
            print("  !! harness-oc still present")

print("== harness-oc anywhere in file ==")
print("occurrences:", open(PATH, encoding="utf-8").read().count("harness-oc"))
