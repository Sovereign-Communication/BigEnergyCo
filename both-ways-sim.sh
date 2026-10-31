#!/usr/bin/env bash
# Both-ways proof for the merged direct-push audit, run in a throwaway clone.
set -u
CLONE=/c/tmp/audit-sim3

rm -rf "$CLONE"
git clone -q --depth 40 --no-tags https://github.com/Sovereign-Communication/BigEnergyCo.git "$CLONE" || exit 9
cd "$CLONE" || exit 9
git -c user.name=sim -c user.email=sim@example.com config user.name sim
git -c user.name=sim -c user.email=sim@example.com config user.email sim@example.com

BASE=$(git rev-parse HEAD)
echo "clone tip (== main before the simulated push): $(git log --oneline -1)"
echo "tip commit is the merged fix? $(git log --oneline -1 --all --grep='judge a commit by the merge' --format=%h | head -1)"

echo
echo "################ CASE A — a real direct fast-forward push of a NON-documentation commit ################"
printf '\n// direct-to-main, no PR\n' >> assets/js/sizing/money.js
git add assets/js/sizing/money.js
git commit -q -m "fix(sizing): tweak the 20-year cost series straight on main"
DIRECT=$(git rev-parse HEAD)
echo "pushed range: $BASE..$DIRECT"
node scripts/direct-push-audit.mjs --before "$BASE" --after "$DIRECT"
echo "AUDIT_EXIT=$? (1 means blocked)"

echo
echo "################ REVERT — reset the clone back ################"
git reset --hard -q "$BASE"
node scripts/direct-push-audit.mjs --before "$BASE" --after "$BASE"
echo "AUDIT_EXIT_AFTER_REVERT=$? (0 because the range is empty again)"
echo "tree clean? $(git status --porcelain | wc -l) modified path(s); tip back at $(git rev-parse --short HEAD)"

echo
echo "################ CASE B — the same change, landed as a PR merge commit ################"
git checkout -q -b sim/pr-branch "$BASE"
printf '\n// landed through a PR\n' >> assets/js/sizing/money.js
git add assets/js/sizing/money.js
git commit -q -m "fix(sizing): tweak the 20-year cost series (no PR trailer in this subject)"
BRANCH_SHA=$(git rev-parse HEAD)
git checkout -q main 2>/dev/null || git checkout -q master
git merge --no-ff -q sim/pr-branch -m "Merge pull request #9999 from Sovereign-Communication/sim/pr-branch"
MERGE=$(git rev-parse HEAD)
echo "branch commit subject (deliberately carries no PR reference):"
git log -1 --format='  %h %s' "$BRANCH_SHA"
echo "merge commit: $(git log -1 --format='%h %s' "$MERGE")"
node scripts/direct-push-audit.mjs --before "$BASE" --after "$MERGE"
echo "AUDIT_EXIT=$? (0 means the PR-delivered branch commit is recognised)"
