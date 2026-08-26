/**
 * Finding the project, and loading it. Lifted out of the CLI rather than ported from a `spike/src`
 * module — the spike's module boundary is not the boundary to reproduce (charter §7), and M3's
 * server needs `loadProject(dir)` exactly as much as the CLI does.
 *
 * Why: the CLI's version ends in `die()`, and a library may not do that to its host — this throws
 * {@link ProjectNotFoundError} carrying THE SAME SENTENCE, byte for byte, which Q-0010 prints
 * unchanged. Nothing in this file writes to the terminal or terminates anything.
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import type { ProjectConfig } from '@quorum/shared';

import { Backlog } from './backlog.js';

/**
 * The default backlog root, relative to the repository — `config.backlog.path` when the file names
 * one. A literal rather than a constant in shared, deliberately: this is the only spelling in the
 * package, and the constant belongs to whichever ticket first has two (Q-0043 OQ-5).
 */
const DEFAULT_BACKLOG_PATH = 'backlog';

/**
 * No `harness/harness.yaml` was found at or above the starting directory.
 *
 * Why: the message is the sentence the CLI prints today, unchanged — including that it names
 * `harness` where the binary will be `quorum` (Q-0010). Carried, not fixed (charter §2).
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
   * rejecting a config that loads today would change what a command prints and its exit code
   * (Q-0043 AC-11).
   */
  config: ProjectConfig;
  backlog: Backlog;
}

/**
 * The nearest directory at or above `start` that holds `harness/harness.yaml`, or `null` at the
 * filesystem root. Reads directories and nothing else; creates nothing. `start` is resolved first,
 * so a relative argument walks from the working directory rather than from `a/b` → `a` → `.`.
 */
export function findProject(start: string = process.cwd()): string | null {
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
 * `dir` is given. `dir` stays optional so Q-0010 does not have to re-implement the
 * `--project`-absent case (Q-0043 OQ-4). Creates no directory and no file: loading a project is a
 * read.
 *
 * @throws {ProjectNotFoundError} when no `harness/harness.yaml` is found.
 */
export function loadProject(dir?: string): Project {
  const repoDir = dir ? path.resolve(dir) : findProject();
  if (!repoDir) throw new ProjectNotFoundError();
  const harnessDir = path.join(repoDir, 'harness');
  // The untyped boundary: `YAML.parse` answers `any`, and this is the one place the parsed document
  // is claimed to be a config — an assertion, for the reason `Project.config` above gives.
  const config = (YAML.parse(fs.readFileSync(path.join(harnessDir, 'harness.yaml'), 'utf8')) ?? {}) as ProjectConfig;
  const backlogRoot = path.resolve(repoDir, config.backlog?.path ?? DEFAULT_BACKLOG_PATH);
  return { repoDir, harnessDir, config, backlog: new Backlog(backlogRoot) };
}
