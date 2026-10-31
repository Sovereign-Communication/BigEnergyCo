// Staging deployable files from the bytes the repository HOLDS, not from the
// working tree.
//
// Why. `deployList()` has always enumerated from git's index — the manifest is
// index-derived by design. The CONTENT, though, was copied with `cpSync` from
// the working tree, so the two halves could disagree. On a checkout with
// `core.autocrlf = true` they did: git stores LF (`.gitattributes` says
// `* text=auto`) and checks CRLF out to disk, so every promote run from such a
// machine shipped CRLF — 3,441 extra bytes on index.html alone, which put the
// live artifact 266 bytes OVER the repo's own 125,000 first-load budget while
// the committed blob sat 3,175 bytes under it. The artifact that deploys was
// therefore not the artifact that was reviewed.
//
// The fix is not a second normalisation mechanism. `.gitattributes` stays the
// single source of truth for what gets committed, and it has already been
// applied — the index holds the post-filter bytes. Reading the index is reading
// git's own answer, not imposing a second opinion.
//
// WHAT THIS COSTS, stated rather than buried:
//
//   A local, UNCOMMITTED edit to a deployable file no longer reaches a staged
//   build. The staged tree is the committed tree. This is invisible to the
//   production promote, which already refuses to run on a dirty tree
//   (`scripts/promote.mjs`: "working tree is not clean — the artifact would not
//   match the commit it claims"). It is visible to a developer previewing an
//   edit locally, which is why `stageFromIndex` reports every divergence by
//   name rather than letting a preview quietly show stale bytes.
//
// The upside is that the deployed artifact is now byte-identical to the commit
// it claims, on every machine, whatever their checkout settings.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Parse one `git cat-file --batch -z` stream.
 *
 * The wire format per object is `<sha> SP <type> SP <size> LF <contents> LF`,
 * or `<name> SP missing LF` when the index has no such path. Sizes are in
 * BYTES, so the contents are sliced from a Buffer, never decoded as text —
 * the allowlist carries binary (png, ico, webp) and a text round-trip would
 * corrupt it.
 */
export function parseBatch(buf, { encoding = null } = {}) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const nl = buf.indexOf(0x0a, i);
    if (nl === -1) break;
    const header = buf.subarray(i, nl).toString("utf8");
    i = nl + 1;
    const parts = header.split(" ");
    if (parts[1] === "missing") {
      out.push({ name: parts[0], missing: true });
      continue;
    }
    const size = Number(parts[2]);
    const body = buf.subarray(i, i + size);
    i += size + 1; // + the trailing LF
    out.push({
      name: parts[0],
      size,
      // `encoding: "buffer"` is the default and the only safe one for a
      // manifest that includes binary assets.
      content: encoding === "utf8" ? body.toString("utf8") : Buffer.from(body),
    });
  }
  return out;
}

/**
 * Read the index blob for each repo-relative path, in ONE git process.
 *
 * `checkout-index` is deliberately NOT used: it re-applies the smudge filter on
 * the way out, so it hands back the CRLF working-tree form — the exact bytes
 * this module exists to stop shipping. `cat-file --batch` reads the raw blob.
 */
export function readIndexBlobs(root, paths) {
  if (!paths.length) return new Map();
  // Git paths are ALWAYS forward-slash. `path.relative()` on Windows hands back
  // backslashes, and `:assets\js\sizing\ui.js` is a path git cannot resolve — it
  // answers "missing", which would read as an absent blob rather than a bad
  // separator. Normalised here so every caller is safe by construction.
  const wanted = paths.map((p) => p.split("\\").join("/"));
  const input = wanted.map((p) => `:${p}\0`).join("");
  const buf = execFileSync("git", ["cat-file", "--batch", "-z"], {
    cwd: root,
    input,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const parsed = parseBatch(buf);
  // `git cat-file --batch` answers in REQUEST ORDER and echoes the resolved
  // OBJECT ID, not the `:path` that was asked for. So the input list is the
  // only reliable key: results are zipped back by position, and a count
  // mismatch is refused rather than silently mis-paired.
  if (parsed.length !== paths.length)
    throw new Error(
      `git cat-file returned ${parsed.length} records for ${paths.length} ` +
        `requested paths; refusing to pair them by position`,
    );
  const out = new Map();
  for (let i = 0; i < wanted.length; i++) {
    const rec = parsed[i];
    if (rec.missing)
      throw new Error(
        `git index has no blob for ${wanted[i]}; the deploy contract is ` +
          `index-derived, so a tracked path with no staged content cannot be staged`,
      );
    out.set(wanted[i], rec.content);
  }
  return out;
}

/** The committed bytes of one repo-relative path. */
export function committedBytes(root, path) {
  const key = path.split("\\").join("/");
  return readIndexBlobs(root, [path]).get(key);
}

/**
 * Stage `paths` into `stageDir` from the index.
 *
 * Returns the paths whose WORKING TREE differs from the index — those edits
 * are deliberately not in the build, and the caller is expected to say so out
 * loud rather than let a preview look stale for no stated reason.
 */
export function stageFromIndex(root, stageDir, paths) {
  const blobs = readIndexBlobs(root, paths);
  for (const [p, content] of blobs) {
    const dest = join(stageDir, p);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
  }
  return workingTreeDivergences(root, paths);
}

/**
 * Tracked paths whose working-tree bytes differ from the index.
 *
 * `git diff --name-only` is used deliberately, NOT a byte comparison of the
 * file on disk. Git applies the same clean filter (.gitattributes +
 * core.autocrlf) when deciding whether a file is modified, so a CRLF working
 * tree is correctly reported as UNCHANGED against an LF index. Comparing raw
 * disk bytes would report every tracked file as diverged on this checkout and
 * the warning below would be pure noise.
 *
 * An empty result is the normal, healthy case: it means a staged build and the
 * working tree agree, which is what every gate and every promote assumes.
 */
export function workingTreeDivergences(root, paths) {
  return splitDivergences(root, paths).all;
}

/**
 * The two halves of a divergence, kept apart because they mean OPPOSITE things.
 *
 *   UNSTAGED — index vs working tree. The build, which reads the index, does NOT
 *     contain this edit. Measuring the build and reporting the result as a
 *     statement about the working tree is wrong, and it is wrong invisibly: the
 *     numbers come out fine and describe a page nobody is looking at.
 *   STAGED-BUT-UNCOMMITTED — HEAD vs index. The build DOES contain it, and the
 *     next commit will carry it. Naming it is what keeps the word "committed"
 *     in the staging note honest; failing on it would refuse to measure work in
 *     progress, which is the ordinary state of a branch.
 *
 * This split exists because that confusion cost a real measurement twice in one
 * session: a mutation was written to the working tree, the build was staged
 * without it, and the gate reported a clean page. Both times it was caught by
 * noticing the numbers made no sense, never by an instrument. A gate that
 * cannot tell the difference is an instrument that will say the wrong thing
 * quietly, so it is now told the difference.
 */
export function splitDivergences(root, paths) {
  if (!paths.length) return { unstaged: [], staged: [], all: [] };
  const wanted = paths.map((p) => p.split("\\").join("/"));
  const collect = (argv) => {
    const out = execFileSync("git", [...argv, "--name-only", "-z"], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return new Set(out.split("\0").filter(Boolean));
  };
  const inWorktree = collect(["diff"]);
  const inIndex = collect(["diff", "--cached"]);
  const unstaged = wanted.filter((p) => inWorktree.has(p));
  const staged = wanted.filter((p) => !unstaged.includes(p) && inIndex.has(p));
  return { unstaged, staged, all: [...unstaged, ...staged] };
}
