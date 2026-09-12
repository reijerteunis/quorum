/**
 * Where the backlog store may write, and where its guarded reads may reach: inside its own root.
 *
 * **The four guarded methods are `write`, `writeFile`, `log` and `readFiles`**, and for those this
 * module is the whole of the boundary, so that a fifth caller cannot get a fifth answer. `read` and
 * `list` are **deliberately outside it**: they open a `ticket.md` without leaf confinement, which is
 * the behaviour this ticket preserved rather than changed, and `backlog.ts`'s own docblock and
 * `04-architecture.md` state the same exception. A contract claiming more than that is a false
 * security claim in source, which is worse than none.
 *
 * Every path those four touch is built from a string somebody else supplied — a ticket token from
 * argv and, from M3, from a request body; a write path or an `input.backlog` glob from a flow file.
 *
 * **{@link pathInside} has a second caller outside this store since Q-0122**, and the module stays
 * where it is rather than moving: `packages/server`'s static route turns a URL into a file read
 * under the built bundle, which is the same question about a different declared root. It is on
 * `@quorum/core`'s barrel for that reason, which is `docs/GLOSSARY.md`'s **Confinement** sentence —
 * *"Enforced in `core`, so the CLI and M3's server inherit one rule instead of each writing a
 * weaker one"* — being executed rather than reinterpreted. What is scoped to the backlog store is
 * the paragraph above about **which methods** are guarded; the two questions below are general, and
 * the register in `backlog.source.test.ts` is what keeps a third caller from growing its own copy.
 *
 * Why: narrowed by hand after the gate, per *"A refused finding is a gate, not another round"*
 * (2026-08-31), which puts the repair for an overridden finding on the merge rather than on the
 * branch the gate approved. Q-0059's review raised it three times and the third was answered by an
 * override at the exhaustion gate; this is that override's other half.
 *
 * It answers two questions and holds no others. **Is this token one name?** — decided on the string
 * alone, touching no filesystem, so a refusal discloses nothing. **Does this path resolve to
 * somewhere inside this root?** — decided with both sides resolved through `realpathSync` and
 * compared component by component, because `path.resolve` does no filesystem work and `statSync`
 * follows links, so a single-segment symlink inside the root passes every string test there is.
 * {@link pathInside} asks that second question of a leaf — one that exists, which is what a file
 * about to be read or appended to is, and one that does not, which is what a write into a directory
 * nobody has created is.
 *
 * Nothing here is cached: `Backlog.create` may create the root, so a real path computed once per
 * instance is an answer that was true earlier.
 *
 * Why: the `realpathSync` here is the second in the two production files that may declare one —
 * `backlog.source.test.ts`'s Q-0059 register carries both and why each is separate.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * A path split into its names, so containment is decided between components and never between
 * prefixes: `/x/backlog-old` starts with `/x/backlog` as a string and is not inside it.
 */
const components = (target: string): string[] => target.split(path.sep).filter((part) => part !== '');

/** Whether `inner` begins with the whole of `outer` — equal counting as inside. */
const startsWith = (outer: readonly string[], inner: readonly string[]): boolean =>
  inner.length >= outer.length && outer.every((name, at) => inner[at] === name);

/**
 * Resolves symlinks, and answers `null` when the path does not exist or cannot be resolved — which
 * includes a token the operating system refuses outright, so a caller of this module gets its own
 * refusal rather than a resolver's error.
 */
const realPath = (target: string): string | null => {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
};

/**
 * Whether a name stands at `target` — asked of the name itself, so a link is present whether or not
 * anything is at the other end of it.
 *
 * A failure is read as nothing there, which is what the two ordinary shapes are: `ENOENT` for a path
 * nobody has created, `ENOTDIR` for one whose parent is a file. A failure for any other reason is
 * one the caller could not act on either — a name it cannot stat is a name it cannot open.
 */
const present = (target: string): boolean => {
  try {
    fs.lstatSync(target);
    return true;
  } catch {
    return false;
  }
};

/**
 * The resolved deepest ancestor of `target` that exists, `target` itself included, or `null` at the
 * filesystem root and at the first name that stands there and does not resolve. What a path that has
 * yet to be created is checked through: the segments below the answer are names nothing has claimed,
 * so no link can hide under them.
 *
 * "Does not exist" and "is there and does not resolve" are different answers, and climbing past the
 * second is how a refused destination becomes a file outside the root: an open with `O_CREAT`
 * follows a dangling link and CREATES what it points at, while the parent this used to answer with
 * is inside the folder. An unresolvable name is refused here exactly as {@link isFolderIn} already
 * refuses one, so the module keeps one rule rather than two.
 */
const deepestExisting = (target: string): string | null => {
  for (let at = target; ; at = path.dirname(at)) {
    const real = realPath(at);
    if (real !== null) return real;
    if (present(at)) return null;
    if (path.dirname(at) === at) return null;
  }
};

/**
 * Whether `token` is one name: no separator, no `.` or `..`, not a root, not empty.
 *
 * The lexical half, and the only question here answered without touching the filesystem. `../x`,
 * `a/b`, `Q-0001/` and `/etc` all fail it, and fail it before anything is opened.
 */
export function isOneName(token: string): boolean {
  return token !== '' && token !== '.' && token !== '..' && token === path.basename(token);
}

/**
 * Whether `candidate` is a directory whose real path sits directly inside `root`'s.
 *
 * Both sides are resolved, so a root reached through a symlink still admits its own children and an
 * aliased child that resolves elsewhere is refused. A child that resolves to a *sibling* inside the
 * same root is an alias rather than an escape and is admitted — it is inside the boundary, and a
 * write through it writes the same bytes in the same folder.
 */
export function isFolderIn(root: string, candidate: string): boolean {
  const realRoot = realPath(root);
  const realCandidate = realPath(candidate);
  if (realRoot === null || realCandidate === null) return false;
  const outer = components(realRoot);
  const inner = components(realCandidate);
  if (inner.length !== outer.length + 1 || !startsWith(outer, inner)) return false;
  return fs.statSync(realCandidate, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

/**
 * The absolute path `rel` names strictly inside `folder`, or `null` when it names anything else.
 *
 * Two clauses, and neither covers the other. **Lexically**, `path.join` has already collapsed every
 * `..`, so a remainder that climbed out is one the folder is no longer a prefix of — and an
 * *absolute* `rel` is refused here rather than neutered by the join, because a caller that supplied
 * one asked for a path of its own rather than for one inside this folder. **On the filesystem**, the
 * deepest existing ancestor is resolved, which is the clause a lexical comparison cannot make —
 * `rel` itself where `rel` already exists, so a link standing at the destination is refused rather
 * than followed, and the first real parent where nothing stands there at all. A name that stands
 * there and resolves to nothing is neither, and is refused: see {@link deepestExisting}.
 *
 * @returns `path.join(folder, rel)` — the joined path, never the resolved one, so what a caller
 *   writes to and reports is the path it named.
 */
export function pathInside(folder: string, rel: string): string | null {
  if (rel === '' || path.isAbsolute(rel)) return null;
  const target = path.join(folder, rel);
  const outer = components(folder);
  const inner = components(target);
  if (inner.length <= outer.length || !startsWith(outer, inner)) return null;
  const realFolder = realPath(folder);
  const anchor = deepestExisting(target);
  if (realFolder === null || anchor === null) return null;
  return startsWith(components(realFolder), components(anchor)) ? target : null;
}
