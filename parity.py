set -euo pipefail
python - <<'PY'
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib

py = tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))
name = py["project"]["name"]
version = py["project"]["version"]
assert name == "sovereign-harness", f"unexpected distribution name: {name}"

code = "import harness; print(harness.__version__)"
reported = subprocess.run(
    [sys.executable, "-c", code], check=True, capture_output=True, text=True
).stdout.strip()
assert reported == version, (
    f"harness.__version__ ({reported}) != pyproject ({version})"
)
# A PEP 440 version must not carry the tag's leading "v".
assert re.fullmatch(r"\d+(\.\d+)*((a|b|rc)\d+)?(\.post\d+)?(\.dev\d+)?", version), (
    f"pyproject version {version!r} is not a plain PEP 440 release"
)
print(f"parity OK: {name} {version} (importable, reads {reported})")

tag = (os.environ.get("RELEASE_TAG") or "").strip()
if tag:
    expected = f"v{version}"
    assert tag == expected, f"tag {tag!r} does not match pyproject version {expected!r}"
    print(f"tag parity OK: {tag} == {expected}")
else:
    print("no tag in context (dispatch without a tag input): tag parity not checked")
PY
