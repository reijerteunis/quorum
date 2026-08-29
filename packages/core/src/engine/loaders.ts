/**
 * Q-0050 engine loaders: flow and role file readers, and the small pure helpers the run loop
 * composes them with. Why: behaviour preserved from spike/src/engine.js (charter §2, Q-0050).
 */
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import type { Flow, Role } from '@quorum/shared';

import { parseFrontmatter } from '../backlog/backlog.js';
import { FlowError, lintFlow } from '../lint/lint.js';

/** Parses a flow file, records the path it was read from, and lints it before returning. */
export function loadFlow(file: string): Flow {
  const flow = YAML.parse(fs.readFileSync(file, 'utf8')) as Flow;
  flow.file = file;
  lintFlow(flow);
  return flow;
}

/** Loads `<harnessDir>/flows/<name>.yaml`; a missing file throws the raw `ENOENT`, not `FlowError`. */
export function loadFlowByName(name: string, harnessDir: string): Flow {
  return loadFlow(path.join(harnessDir, 'flows', `${name}.yaml`));
}

/**
 * Loads a role's frontmatter. A falsy name is the empty role; a missing file names its full path.
 *
 * The contracted return type is the shared `Role` (a role file's typed `meta`), but what this
 * loader actually returns is the untyped `{ meta, body }` frontmatter wrapper `parseFrontmatter`
 * produces — `meta` is deliberately `unknown` there, and each caller narrows it. Every caller of
 * `loadRole` in this port reads `.meta` and `.body` off the result, matching spike/src/engine.js's
 * `loadRole`/`parseFrontmatter(...)`. The two shapes do not structurally overlap, so the boundary
 * is bridged through `unknown` rather than asserted directly. Flagged for the contract to name the
 * wrapper type explicitly instead of `Role`.
 */
export function loadRole(name: string | null | undefined, harnessDir: string): Role {
  if (!name) return { meta: {}, body: '' } as unknown as Role;
  const file = path.join(harnessDir, 'roles', `${name}.md`);
  if (!fs.existsSync(file)) throw new FlowError(`role "${name}" not found at ${file}`);
  return parseFrontmatter(fs.readFileSync(file, 'utf8')) as unknown as Role;
}

/** Flat key substitution; dotted and unknown placeholders are left untouched. */
export function interpolate(template: string, values: Readonly<Record<string, unknown>>): string {
  return template.replace(/\{([\w.]+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** The step's output paths: singular `output.write` is preferred over plural `output.writes`. */
export function writesOf(step: Readonly<Record<string, unknown>>): readonly string[] {
  const output = (step.output ?? {}) as { write?: string; writes?: readonly string[] };
  return output.write ? [output.write] : (output.writes ?? []);
}

/** One past the highest review round with a completed `verdict.md`; 1 when review has not started. */
export function reviewRound(ticketDir: string): number {
  const dir = path.join(ticketDir, 'review');
  if (!fs.existsSync(dir)) return 1;
  const completed = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name.match(/^round-(\d+)$/)?.[1])
    .filter((round): round is string => round !== undefined)
    .map(Number)
    .filter((round) => fs.existsSync(path.join(dir, `round-${round}`, 'verdict.md')));
  return (completed.length ? Math.max(...completed) : 0) + 1;
}
