/**
 * Turning somebody else's repository into one Quorum can run in: `<dir>/harness` from a template
 * tree, `<dir>/backlog` beside it, and the base branch the checkout is actually on.
 *
 * **Why this is `core`'s and not the CLI's.** It is the one thing `packages/cli` has genuinely no
 * counterpart for — every other helper its commands need was already here (Q-0093 §M-1) — and it is
 * filesystem and git work, which `04-architecture.md`'s first principle gives to this package and
 * which `packages/cli/src/frame.source.test.ts`'s module scan forbids the CLI to import a way to do.
 * M3's server wants the same function for a projects-home "new project".
 *
 * **It throws rather than exiting**, which is the reason `project.ts` gives for
 * `ProjectNotFoundError`: a library may not do that to its host. The refusal carries the spike's
 * sentence byte for byte, so a caller prints it unchanged.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:317–339` (Q-0093 AC-6, AC-7, AC-9).
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { currentBranch } from '../git/git.js';

/**
 * `<dir>/harness` is already there, so nothing was scaffolded.
 *
 * The message is `${dst} already exists` — the **absolute** path, as the spike's `die` prints it —
 * and it is the whole of what a caller renders. Named as its own class for the reason
 * `ProjectNotFoundError` is: a command that cannot tell this case from a crash prints a Node stack
 * where the spike prints one sentence.
 */
export class ProjectExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectExistsError';
  }
}

/**
 * The file whose `repo.base_branch` is aimed at the checkout's own branch, relative to `<dir>`.
 *
 * A literal rather than a constant in `shared` for the reason `project.ts`'s
 * `DEFAULT_BACKLOG_PATH` gives: `harness/harness.yaml` is spelled there as two `path.join`
 * segments, and the constant belongs to whichever ticket first needs a third spelling.
 */
const CONFIG_FILE = 'harness.yaml';

/**
 * Scaffold a project at `dir` from `templates`.
 *
 * Copies the template tree to `<dir>/harness`, creates `<dir>/backlog`, and replaces the template's
 * `repo.base_branch` with the branch `dir` is on where git can name one.
 *
 * **The order is load-bearing and is preserved rather than tidied.** The `harness/` check runs
 * *before* `backlog/` is created, so a refusal leaves a previously absent backlog absent — and only
 * `harness/` is tested, so an existing `<dir>/backlog` is not a refusal and the `recursive: true`
 * over it is a no-op. Both are what a tidier implementation would close, and both are what the spike
 * does (Q-0093 AC-6(b)).
 *
 * **The config is edited, not re-emitted.** `parseDocument` + `setIn` + `toString` moves the one
 * scalar and keeps every comment and the rest of the file's formatting; a parse/stringify round trip
 * would destroy the comments an adopter's first file is mostly made of. A failure of that edit is
 * swallowed, because the template's own `base_branch` remains valid and `init` may not fail over a
 * branch name.
 *
 * @param dir the directory to scaffold. Resolved by the caller; nothing here consults the working
 *   directory.
 * @param templates the template tree to copy, as a path or a `file:` URL. A URL is what lets
 *   `packages/cli` resolve `<package>/templates/harness/` from the binary's own location without
 *   importing `node:url` (Q-0093 AC-8).
 * @throws {ProjectExistsError} when `<dir>/harness` already exists. Nothing has been written.
 */
export function initProject(dir: string, templates: string | URL): void {
  const dst = path.join(dir, 'harness');
  if (fs.existsSync(dst)) throw new ProjectExistsError(`${dst} already exists`);
  fs.cpSync(templates, dst, { recursive: true });
  fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });

  // Best-effort: a nameable branch — including a fresh, unborn `git init -b <name>` — replaces the
  // template's default. No repository, a detached HEAD, a broken GIT_DIR: the template's `main`
  // stands and init still succeeds.
  const branch = currentBranch(dir);
  if (branch === null) return;
  const configFile = path.join(dst, CONFIG_FILE);
  try {
    const doc = YAML.parseDocument(fs.readFileSync(configFile, 'utf8'));
    doc.setIn(['repo', 'base_branch'], branch);
    fs.writeFileSync(configFile, doc.toString());
  } catch { /* best-effort: the template's default base_branch remains valid */ }
}
