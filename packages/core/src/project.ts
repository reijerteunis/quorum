// Finding the project, and loading it. Lifted out of the CLI for Q-0043
// (spike/bin/harness.js:46-61), not ported from a `spike/src` module — the spike's module boundary
// is not the boundary to reproduce (harness/port-charter.md §7). `docs/04-architecture.md` names
// `loadProject(dir)` as part of core's public API and M3's server needs it exactly as much as the
// CLI does; six of the spike's commands call it today and a seventh consumer would otherwise copy
// discovery, YAML and path resolution a third time.
//
// One thing has to change shape, and it is the only change here: the CLI's version ends in `die()`,
// which prints a red line and terminates the interpreter. A library may not do that to its host,
// so this throws {@link ProjectNotFoundError} carrying THE SAME SENTENCE, byte for byte, and
// Q-0010 prints it unchanged. Nothing in this file writes to the terminal or terminates anything.
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import type { ProjectConfig } from '@quorum/shared';

import { Backlog } from './backlog.js';

/**
 * The default backlog root, relative to the repository — `config.backlog.path` when the file names
 * one (spike/bin/harness.js:57).
 *
 * A literal rather than a constant in `shared`, deliberately: `constants.ts` exists to kill SECOND
 * spellings, and this is the only one in this package. The spike's other copy is inside `harness
 * init`, which hard-codes `backlog` regardless of what the config says (spike/bin/harness.js:397)
 * — that copy arrives with Q-0010, and the constant belongs to whichever ticket first has two.
 * Q-0043 OQ-5.
 */
const DEFAULT_BACKLOG_PATH = 'backlog';

/**
 * No `harness/harness.yaml` was found at or above the starting directory.
 *
 * Its message is the sentence the CLI prints today, unchanged — including that it names `harness`
 * where the binary will be `quorum` (Q-0010). Carried, not fixed (harness/port-charter.md §2), and
 * named in the implementation report.
 */
export class ProjectNotFoundError extends Error {
  constructor(message = 'no harness/harness.yaml found — run `harness init` in your repo') {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

/** A loaded project: where it is, what it is configured with, and its backlog. */
export interface Project {
  /** Absolute path of the repository root — the directory holding `harness/`. */
  repoDir: string;
  /** Absolute path of `<repoDir>/harness`. */
  harnessDir: string;
  /**
   * `harness/harness.yaml`, as YAML parsed it. NOT validated: `projectConfigSchema` supplies this
   * static type and is called nowhere, because every consumer supplies its own fallback and
   * rejecting a config that loads today would change what a command prints and its exit code.
   * Q-0043 AC-11.
   */
  config: ProjectConfig;
  backlog: Backlog;
}

/**
 * The nearest directory at or above `start` that holds `harness/harness.yaml`, or `null` at the
 * filesystem root. Reads directories and nothing else; creates nothing.
 */
export function findProject(start: string = process.cwd()): string | null {
  // `path.resolve` is what makes the answer absolute for a relative `start` too. The spike walks
  // the argument as given (spike/bin/harness.js:47), which is unreachable there because its only
  // caller passes the working directory; a relative start would otherwise walk `a/b` → `a` → `.`
  // and stop. No caller's behaviour changes, and AC-10 requires the resolved form.
  let d = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(d, 'harness', 'harness.yaml'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

/**
 * Load the project rooted at `dir`, or the nearest one at or above the working directory when no
 * `dir` is given — the two branches of `spike/bin/harness.js:55` in one signature. `dir` stays
 * optional so Q-0010 does not have to re-implement the `--project`-absent case (Q-0043 OQ-4).
 *
 * Creates no directory and no file: loading a project is a read.
 *
 * @throws {ProjectNotFoundError} when no `harness/harness.yaml` is found.
 */
export function loadProject(dir?: string): Project {
  const repoDir = dir ? path.resolve(dir) : findProject();
  if (!repoDir) throw new ProjectNotFoundError();
  const harnessDir = path.join(repoDir, 'harness');
  // The untyped boundary: YAML.parse answers `any`, and this is the one place the parsed document
  // is claimed to be a config. It is an assertion and not a parse for the reason in the type's own
  // documentation above — see also packages/shared/src/project.ts.
  const config = (YAML.parse(fs.readFileSync(path.join(harnessDir, 'harness.yaml'), 'utf8')) ?? {}) as ProjectConfig;
  const backlogRoot = path.resolve(repoDir, config.backlog?.path ?? DEFAULT_BACKLOG_PATH);
  return { repoDir, harnessDir, config, backlog: new Backlog(backlogRoot) };
}
