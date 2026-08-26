// Q-0043 AC-11: the project config, declared once and validated nowhere.
//
// The witness is the two `harness.yaml` files this repository actually ships — its own and the one
// `init` copies into an adopter's repo — rather than a fixture written to match the schema. A
// schema written from a fixture is a schema checked against itself.
import { describe, expect, test } from 'vitest';

import { projectConfigSchema } from './project.js';
import type { ProjectConfig } from './project.js';
import { repoFile, parseYaml, spikeSource, repoRoot } from '../test/corpus.js';

import YAML from 'yaml';

import path from 'node:path';

const shippedConfigs = (): [string, unknown][] => [
  ['harness/harness.yaml', parseYaml(path.join(repoRoot, 'harness/harness.yaml'))],
  ['spike/templates/harness/harness.yaml', YAML.parse(spikeSource('templates/harness/harness.yaml'))],
];

describe('AC-11 — every shipped config parses, with no key added and none removed', () => {
  test('both files parse, and come back with no key added and none removed', () => {
    for (const [name, parsed] of shippedConfigs()) {
      const result = projectConfigSchema.safeParse(parsed);
      expect(result.success, `${name}: ${result.error?.message ?? ''}`).toBe(true);
      expect(result.data, name).toStrictEqual(parsed);
      expect(Object.keys(result.data as object).sort(), name).toStrictEqual(Object.keys(parsed as object).sort());
    }
  });

  test('parsing REORDERS the keys, which is one more reason nothing on a load path parses', () => {
    // Declared keys come back in schema order and unknown ones last. Harmless here because nothing
    // writes `harness.yaml` back — and exactly the failure Q-0043 AC-4 forbids for `ticket.md`,
    // which something does write back. Asserted so the fact stays on the record rather than being
    // rediscovered by whoever first reaches for `parse` in `loadProject`.
    const ordered = { commands: { test: 'x' }, backlog: { path: 'b' }, zzz: 1, repo: { base_branch: 'main' } };
    expect(Object.keys(projectConfigSchema.parse(ordered))).toStrictEqual(['backlog', 'repo', 'commands', 'zzz']);
  });

  test('this repository\'s config still carries the keys the schema was written from', () => {
    // A loud failure if the corpus stops containing the shape — a schema checked against nothing
    // reports success over nothing.
    const config = projectConfigSchema.parse(parseYaml(path.join(repoRoot, 'harness/harness.yaml')));
    expect(config.backlog?.path).toBe('backlog');
    expect(config.backlog?.layout).toBe('in-repo');
    expect(config.repo?.base_branch).toBe('main');
    expect(typeof config.repo?.max_diff_bytes).toBe('number');
    expect(typeof config.commands?.test).toBe('string');
    expect(typeof config.commands?.install).toBe('string');
    expect(typeof config.commands?.timeout_ms).toBe('number');
    expect(typeof config.budget?.per_run_usd).toBe('number');
    expect(Object.keys(config.adapters ?? {})).toStrictEqual(['claude', 'codex']);
  });
});

describe('AC-11 — every key optional, unknown keys preserved, nothing defaulted', () => {
  test('an empty config, a partial one, and one that is nothing but comments all parse', () => {
    expect(projectConfigSchema.parse({})).toStrictEqual({});
    expect(projectConfigSchema.parse({ repo: { base_branch: 'trunk' } })).toStrictEqual({ repo: { base_branch: 'trunk' } });
    expect(projectConfigSchema.parse({ backlog: {} })).toStrictEqual({ backlog: {} });
  });

  test('no key acquires a value the file did not carry', () => {
    // A default here would hand thirteen later tickets state the config never held, in the package
    // everything imports, and no test would fail — which is why this is a test.
    expect(Object.keys(projectConfigSchema.parse({}))).toStrictEqual([]);
    const partial = projectConfigSchema.parse({ commands: { test: 'pnpm test' } });
    expect(partial.repo).toBeUndefined();
    expect(partial.backlog).toBeUndefined();
    expect(partial.commands).toStrictEqual({ test: 'pnpm test' });
  });

  test('an unknown key survives, at the top level and inside a declared block', () => {
    // `harness.yaml` belongs to the user, not to Quorum: an adopter annotating their own config
    // with a key we have never heard of is not committing an error, and stripping it would be
    // silent data loss on any parse-then-write path.
    const config = {
      backlog: { path: 'tickets', mirror: 'central' },
      repo: { base_branch: 'main', remote: 'origin' },
      telemetry: { enabled: false },
    };
    expect(projectConfigSchema.parse(config)).toStrictEqual(config);
  });

  test('a wrong TYPE is still refused — the schema types even though it polices no key', () => {
    expect(projectConfigSchema.safeParse({ repo: { base_branch: 42 } }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ commands: { timeout_ms: 'soon' } }).success).toBe(false);
    expect(projectConfigSchema.safeParse({ adapters: { claude: { bin: 7 } } }).success).toBe(false);
  });

  test('the inferred type reads the way its consumers read it', () => {
    const config: ProjectConfig = projectConfigSchema.parse({ repo: { base_branch: 'main' } });
    const base: string = config.repo?.base_branch ?? 'main';
    const limit: number = config.repo?.max_diff_bytes ?? 200000;
    const command: string = config.commands?.test ?? 'npm test';
    expect([base, limit, command]).toStrictEqual(['main', 200000, 'npm test']);
  });
});

describe('AC-11 — the declaration lives here and is called nowhere in core', () => {
  test('the entry point re-exports it in this file\'s existing shape', () => {
    expect(repoFile('packages/shared/src/index.ts')).toContain("export * from './project.js';");
  });

  test('loadProject imports the type and does not run the schema', () => {
    const core = repoFile('packages/core/src/project.ts');
    expect(core).toContain('ProjectConfig');
    for (const call of ['projectConfigSchema.parse(', 'projectConfigSchema.safeParse(', '.safeParse(']) {
      expect(core.includes(call), `validating a config that loads today is a behaviour change: ${call}`).toBe(false);
    }
  });
});
