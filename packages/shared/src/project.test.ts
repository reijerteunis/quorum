// Q-0043 AC-11: the project config, declared once and validated nowhere.
//
// The witness is the two `harness.yaml` files this repository actually ships — its own and the one
// `init` copies into an adopter's repo — rather than a fixture written to match the schema. A
// schema written from a fixture is a schema checked against itself.
//
// Q-0065 AC-3 is at the foot of the file, for the same reason: the claim is about the `commands.test`
// string this repository actually configures, and this is where that string is already read.
import { describe, expect, test } from 'vitest';

import { adapterConfigSchema, projectConfigSchema, retryPolicySchema } from './project.js';
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
    const core = repoFile('packages/core/src/backlog/project.ts');
    expect(core).toContain('ProjectConfig');
    for (const call of ['projectConfigSchema.parse(', 'projectConfigSchema.safeParse(', '.safeParse(']) {
      expect(core.includes(call), `validating a config that loads today is a behaviour change: ${call}`).toBe(false);
    }
  });
});

/**
 * Whether `command`'s turbo invocation defeats the cache.
 *
 * A pure function of the string, so the assertion below cannot pass or fail on whether a local
 * cache happens to be warm — which is the whole point: the subject is what `integrate` will run,
 * not what it ran here. The split on `&&` is now defensive rather than load-bearing: since Q-0106
 * `commands.test` is the single command `pnpm turbo run test --force --continue`, which splits into
 * one segment, and the split survives because a flag on a segment that is not turbo's has never
 * been turbo's — an adopter's `commands.test` is still theirs to chain.
 */
const forcesTurbo = (command: string): boolean => {
  const segment = command.split('&&').map((part) => part.trim()).find((part) => part.includes('turbo run test'));
  return segment !== undefined && segment.split(/\s+/).includes('--force');
};

describe('Q-0065 AC-3 — the configured test command defeats this repository\'s cache', () => {
  test('the turbo half carries --force, so a replayed pass cannot write tests=ok', () => {
    // Turbo without it prints every package's full pass output and reports `7 successful,
    // 7 cached` having executed nothing; `integrate` reads the exit code and advances the flow.
    const config = projectConfigSchema.parse(parseYaml(path.join(repoRoot, 'harness/harness.yaml')));
    const command = config.commands?.test;
    expect(typeof command, 'harness.yaml must declare commands.test').toBe('string');
    expect(forcesTurbo(command ?? ''), `commands.test must force a fresh run: ${command ?? '(absent)'}`).toBe(true);
  });

  test('and the check has a subject — the command as it stood before this ticket fails it', () => {
    // A guard whose only evidence is a green run has not been shown to have one (Q-0069).
    // Q-0106 retired the two-suite chain from `harness.yaml`, and these five stay: they are
    // literals in a test file rather than a claim about the tree, each still fails for a reason
    // somebody would act on, and between them they are what shows the function discriminates
    // instead of answering `true` — a check outliving its subject is admissible while it can still
    // fail (2026-09-05).
    expect(forcesTurbo('npm test --prefix spike && pnpm turbo run test')).toBe(false);
    expect(forcesTurbo('npm test --prefix spike && pnpm turbo run test --force')).toBe(true);
    // A flag on the spike half, and a flag that merely starts the same way, are both refused.
    expect(forcesTurbo('npm test --force --prefix spike && pnpm turbo run test')).toBe(false);
    expect(forcesTurbo('pnpm turbo run test --force-something')).toBe(false);
    // A command that has stopped running turbo at all is not silently reported as forcing it.
    expect(forcesTurbo('npm test --prefix spike')).toBe(false);
    // Q-0106: the single-command shape that ships today, both ways round. Without this pair every
    // POSITIVE fixture above is a two-segment chain, so the assertion at the top of this block
    // would be the only evidence that a one-segment command can pass at all.
    expect(forcesTurbo('pnpm turbo run test --continue')).toBe(false);
    expect(forcesTurbo('pnpm turbo run test --force --continue')).toBe(true);
  });
});

// Q-0058 — a shipped `harness.yaml` may not name a key spelling nothing reads.
//
// The subject is the UNCOMMENTED document, and that is the load-bearing half. `base_delay_ms` sat
// in a commented example from the day both files were written; every check above parses the live
// YAML, so none of them could see it, and neither could a schema made strict — a commented example
// is not a key. Each guard below therefore restores the examples first and checks the document an
// adopter gets by doing what the file invites.

/** The two configs Quorum ships, as `[name, text]`. Both readers throw when their file is gone. */
const shippedText = (): [string, string][] => [
  ['harness/harness.yaml', repoFile('harness/harness.yaml')],
  ['spike/templates/harness/harness.yaml', spikeSource('templates/harness/harness.yaml')],
];

/** A whole-line comment: its indentation, and its body after the `#` and one optional space. */
const COMMENT = /^(\s*)#\s?(.*)$/;

/** A plain YAML identifier immediately followed by a colon — what tells an example from prose. */
const EXAMPLE_BODY = /^[A-Za-z_][A-Za-z0-9_]*:/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whether `body` is a YAML mapping. A body YAML refuses is not one, and says so as `false`. */
function mapsToObject(body: string): boolean {
  try {
    return isRecord(YAML.parse(body));
  } catch {
    return false;
  }
}

/**
 * `text` with every commented example restored in place, and the bodies it restored.
 *
 * The selection rule is narrower than "the body is YAML" deliberately, and the narrowing is
 * measured rather than argued — see AC-5(c) below, where the weaker rule selects ten lines of
 * `harness/harness.yaml` against this one's three. Both files are more comment than configuration
 * and prose is full of colons.
 *
 * Restoring in place rather than parsing each body on its own is what makes the key PATHS come out
 * right: an example is indented under the block it belongs to, so removing its marker leaves it a
 * child of that block and the whole file parses as one document.
 *
 * A line the identifier rule selects and YAML then refuses THROWS rather than being dropped. A
 * silently skipped example is this guard losing its subject, which is the class it exists in.
 */
function restoreExamples(text: string): { document: string; restored: string[] } {
  const restored: string[] = [];
  const lines = text.split('\n').map((line) => {
    const match = COMMENT.exec(line);
    if (!match || !EXAMPLE_BODY.test(match[2])) return line;
    if (!mapsToObject(match[2])) {
      throw new Error(`an example line does not parse as YAML, and is not dropped for it: ${match[2]}`);
    }
    restored.push(match[2]);
    return `${match[1]}${match[2]}`;
  });
  return { document: lines.join('\n'), restored };
}

/** The uncommented document of a shipped file, parsed. */
const uncommented = (text: string): unknown => YAML.parse(restoreExamples(text).document);

/**
 * The declared keys behind a schema, unwrapping the optional wrapper every nested block carries.
 *
 * `null` where the schema declares no keys of its own — a scalar, or the record whose entries
 * {@link RECORD_VALUES} names instead.
 */
function shapeOf(schema: unknown): Record<string, unknown> | null {
  const node = schema as { shape?: Record<string, unknown>; unwrap?: () => unknown } | undefined;
  if (node?.shape) return node.shape;
  if (typeof node?.unwrap === 'function') return shapeOf(node.unwrap());
  return null;
}

/**
 * Key paths whose declaration is a `z.record` rather than a shape, with the schema its values
 * carry — `adapters` being keyed by an OPEN adapter name, so any key there is declared.
 *
 * Named rather than reached through the record's own wrapper: `.shape.adapters` → `.valueType` →
 * `.shape.retry` → `.unwrap()` would make this guard's subject zod's internals instead of the
 * configuration, which is what the two exports it uses exist to avoid (AC-3).
 */
const RECORD_VALUES: Record<string, unknown> = { adapters: adapterConfigSchema };

/** One key a document carries that no schema on its path declares. */
interface Undeclared {
  /** The full dotted key path, from the document root. */
  readonly path: string;
  /** What is declared beside it — the useful half of the message when the defect is a spelling. */
  readonly siblings: string[];
}

/**
 * Every key path in `value` that the schema reached along it does not declare, at any depth.
 *
 * A `safeParse` cannot serve here and a test below shows why: every schema in this file is a
 * `looseObject`, because `harness.yaml` belongs to the adopter, so `base_delay_ms` parses clean.
 * The walk is over DECLARED `.shape` keys, and it is applied to the two files Quorum itself ships
 * rather than to anybody's config.
 */
function undeclared(value: unknown, schema: unknown, prefix: string[] = []): Undeclared[] {
  if (!isRecord(value)) return [];
  const shape = shapeOf(schema);
  const siblings = Object.keys(shape ?? {});
  const out: Undeclared[] = [];
  for (const [key, child] of Object.entries(value)) {
    const here = [...prefix, key];
    if (!shape || !(key in shape)) {
      out.push({ path: here.join('.'), siblings });
      continue;
    }
    const values = RECORD_VALUES[here.join('.')];
    if (values !== undefined) {
      if (isRecord(child)) {
        for (const [name, entry] of Object.entries(child)) out.push(...undeclared(entry, values, [...here, name]));
      }
      continue;
    }
    out.push(...undeclared(child, shape[key], here));
  }
  return out;
}

/** Every undeclared key in `text` once its examples are restored, as a sentence a reader can act on. */
const parityFailures = (name: string, text: string): string[] =>
  undeclared(uncommented(text), projectConfigSchema)
    .map((miss) => `${name}: ${miss.path} is declared nowhere (declared beside it: ${miss.siblings.join(', ')})`);

/**
 * `text` as it stood before AC-1 — the fix reversed rather than the old file transcribed, so the
 * fixture cannot drift from the thing it is the previous version of. Throws when the reversal finds
 * nothing, because a fixture equal to the fixed text would make every assertion over it vacuous.
 */
function beforeTheFix(name: string, text: string): string {
  const before = text.replace('baseDelayMs: 5000, maxDelayMs: 60000', 'base_delay_ms: 5000');
  if (before === text) {
    throw new Error(`${name}: the example no longer carries the spelling AC-1 wrote, so this is not the pre-fix text`);
  }
  return before;
}

/**
 * `withRetry`'s destructured defaults, read out of a tree's own source.
 *
 * The oracle is the source text rather than three numbers retyped here: a later change to a default
 * turns AC-2 red instead of quietly converting the shipped example into a trap. It THROWS when it
 * matches nothing — a regex that has stopped matching would otherwise compare zero fields and
 * report a pass over them.
 */
function retryDefaults(source: string, where: string): Record<string, number> {
  const block = /function withRetry\([\s\S]*?\{([^}]*)\}/.exec(source);
  if (!block) throw new Error(`${where}: withRetry's destructuring pattern no longer matches — this check would compare zero fields`);
  const defaults = Object.fromEntries(
    [...block[1].matchAll(/([A-Za-z][A-Za-z0-9]*)\s*=\s*(\d+)/g)].map((match) => [match[1], Number(match[2])]),
  );
  if (!Object.keys(defaults).length) throw new Error(`${where}: withRetry destructures no defaulted field — this check would compare zero fields`);
  return defaults;
}

describe('Q-0058 AC-1 — the shipped example is spelled the way the code reads it', () => {
  test('both files name all three fields, and neither names the spelling nothing reads', () => {
    for (const [name, text] of shippedText()) {
      expect(text, name).toContain('baseDelayMs');
      expect(text, name).toContain('maxDelayMs');
      expect(text.includes('base_delay_ms'), `${name} still names a key no code reads`).toBe(false);
      // The example stays commented, keeps its position under `adapters.codex`, and keeps the
      // sentence that says which failures it is for — the BYOS half of it especially.
      expect(text, name).toContain('    # retry: {');
      expect(text, name).toContain('# transient network/5xx only; never auth or model errors');
    }
  });
});

describe('Q-0058 AC-2 — uncommenting the example is a no-op, oracled against both trees', () => {
  test('both trees destructure the same defaults, and the example is exactly them', () => {
    const spike = retryDefaults(spikeSource('src/adapters/index.js'), 'spike/src/adapters/index.js');
    const core = retryDefaults(repoFile('packages/core/src/adapters/adapters.ts'), 'packages/core/src/adapters/adapters.ts');
    expect(core, 'the port and its witness disagree about a default').toStrictEqual(spike);
    expect(Object.keys(spike)).toStrictEqual(['attempts', 'baseDelayMs', 'maxDelayMs']);
    for (const [name, text] of shippedText()) {
      const doc = uncommented(text) as { adapters?: { codex?: { retry?: unknown } } };
      expect(doc.adapters?.codex?.retry, `${name}: uncommenting the example would change behaviour`).toStrictEqual(spike);
    }
  });

  test('the extraction throws rather than reporting a pass over nothing', () => {
    expect(() => retryDefaults('export function elsewhere() {}', 'a fixture')).toThrow(/no longer matches/);
    expect(() => retryDefaults('function withRetry(adapter, { attempts, baseDelayMs } = {}) {}', 'a fixture'))
      .toThrow(/no defaulted field/);
  });
});

describe('Q-0058 AC-3 — the two nested schemas are exported, and are what the walk descends into', () => {
  test('both expose a shape, and the record\'s value schema is reached by name', () => {
    expect(Object.keys(retryPolicySchema.shape)).toStrictEqual(['attempts', 'baseDelayMs', 'maxDelayMs']);
    expect(Object.keys(adapterConfigSchema.shape)).toStrictEqual(['bin', 'extraArgs', 'retry']);
    expect(RECORD_VALUES.adapters, 'the walk descends into the exported schema').toBe(adapterConfigSchema);
    expect(Object.keys(shapeOf(adapterConfigSchema.shape.retry) ?? {}))
      .toStrictEqual(Object.keys(retryPolicySchema.shape));
  });
});

describe('Q-0058 AC-4 — every key the shipped configs name is one the schema declares', () => {
  test('both files, uncommented, name only declared keys', () => {
    for (const [name, text] of shippedText()) expect(parityFailures(name, text), name).toEqual([]);
  });

  test('a looseObject parse cannot be the oracle, which is why the walk is over declared keys', () => {
    // The document the walk refuses is one safeParse accepts, and that is correct of safeParse:
    // the top level of this file belongs to the adopter ("Unknown keys are refused where Quorum
    // owns the key set, and preserved where it does not", 2026-08-25). What the walk judges is
    // narrower — the two files QUORUM ships, where a key Quorum does not read is Quorum's mistake.
    const [name, text] = shippedText()[0];
    const wrong = uncommented(beforeTheFix(name, text));
    expect(projectConfigSchema.safeParse(wrong).success, 'safeParse accepts the defect').toBe(true);
    expect(parityFailures(name, beforeTheFix(name, text))).not.toEqual([]);
  });
});

describe('Q-0058 AC-5 — the restoration rule selects examples and not prose', () => {
  test('(a) each shipped file restores exactly the three examples it carries', () => {
    for (const [name, text] of shippedText()) {
      const { restored } = restoreExamples(text);
      expect(restored, name).toHaveLength(3);
      expect(restored.map((body) => /^[A-Za-z_][A-Za-z0-9_]*/.exec(body)?.[0]), name)
        .toStrictEqual(['extraArgs', 'retry', 'extraArgs']);
    }
    // Accepted and loud: a future prose comment beginning `# Note:` would move these counts and
    // fail here. That is the correct failure — the alternative is a rule that quietly reads two
    // examples of three and reports coverage it does not have.
  });

  test('(b) an example deleted from a fixture moves the count, so the pin is not decorative', () => {
    const [name, text] = shippedText()[0];
    const without = text.split('\n').filter((line) => !line.includes('extraArgs: ["--full-auto"]')).join('\n');
    expect(without, `${name}: the fixture really lost a line`).not.toBe(text);
    expect(restoreExamples(without).restored).toHaveLength(2);
  });

  test('(c) the weaker rule selects prose too, and would be red before anyone fixed anything', () => {
    // Measured by executing it rather than reasoned about. "The body parses as a YAML mapping"
    // selects ten lines of harness/harness.yaml where the identifier rule selects three, and FOUR
    // of the ten throw — so under this file's own clause that an unparseable restored line fails
    // the test, the weaker rule is red on an unmodified repository. The discriminator that works is
    // narrower: every prose "key" here contains a space, and `extraArgs` and `retry` do not.
    const weak = (text: string): { selected: string[]; throwing: string[] } => {
      const bodies = text.split('\n').map((line) => COMMENT.exec(line)?.[2]).filter((body) => body !== undefined);
      const throwing = bodies.filter((body) => {
        try {
          YAML.parse(body);
          return false;
        } catch {
          return true;
        }
      });
      return { selected: [...bodies.filter(mapsToObject), ...throwing], throwing };
    };

    const own = weak(repoFile('harness/harness.yaml'));
    expect(own.selected).toHaveLength(10);
    expect(own.throwing).toHaveLength(4);
    expect(own.selected.some((body) => body.startsWith('Used by integrate steps with run_tests:')),
      'the weaker rule really does select prose').toBe(true);
    expect(restoreExamples(repoFile('harness/harness.yaml')).restored).toHaveLength(3);

    const template = weak(spikeSource('templates/harness/harness.yaml'));
    expect(template.selected).toHaveLength(6);
    expect(restoreExamples(spikeSource('templates/harness/harness.yaml')).restored).toHaveLength(3);
  });
});

describe('Q-0058 AC-6 — the guard has a subject today, demonstrated rather than claimed', () => {
  test('(a) the text as it stood before the fix fails, and the failure names the key', () => {
    for (const [name, text] of shippedText()) {
      const failures = parityFailures(name, beforeTheFix(name, text));
      expect(failures, name).toHaveLength(1);
      expect(failures[0]).toContain('adapters.codex.retry.base_delay_ms');
      expect(failures[0], 'the message names the spelling that would have worked').toContain('baseDelayMs');
    }
  });

  test('(b) and it fails with the comment marker gone, so the marker is not what it turns on', () => {
    for (const [name, text] of shippedText()) {
      const live = beforeTheFix(name, text).replace(/^(\s*)# (retry: )/m, '$1$2');
      expect(live, `${name}: the retry example is live YAML in this fixture`).not.toContain('# retry:');
      const failures = parityFailures(name, live);
      expect(failures, name).toHaveLength(1);
      expect(failures[0]).toContain('adapters.codex.retry.base_delay_ms');
    }
  });
});

/** Every key path in a parsed document, dotted, at every depth. */
function keyPaths(value: unknown, prefix: string[] = []): string[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const here = [...prefix, key];
    return [here.join('.'), ...keyPaths(child, here)];
  });
}

const CAMEL = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;
const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

/**
 * Every key path breaking the convention: camelCase under `adapters.<vendor>`, snake_case outside
 * it. A single-word key carries no case and is a claim in neither direction.
 *
 * THE SCOPE IS KEYS WRITTEN IN A `harness.yaml` FILE, which is the clause both shipped comments
 * also carry. `adapterOverride` is a top-level camelCase key both engines read
 * (spike/src/engine.js:236, packages/core/src/engine/steps.ts:161) and is not a counterexample: the
 * CLI sets it on the already-loaded config from `--adapter` (spike/bin/harness.js:619) and it has
 * never existed in a file. A rule stated without that clause is false on the day it lands — see
 * "A config key is camelCase under `adapters.<vendor>` and snake_case everywhere else" (2026-08-31).
 */
function conventionBreaches(value: unknown): string[] {
  return keyPaths(value).filter((dotted) => {
    const key = dotted.split('.').pop() ?? '';
    if (!key.includes('_') && !/[A-Z]/.test(key)) return false;
    return dotted.startsWith('adapters.') ? !CAMEL.test(key) : !SNAKE.test(key);
  });
}

describe('Q-0058 AC-8 — the convention is stated where a reader of the config looks', () => {
  test('both shipped files state the rule and the mechanism behind it', () => {
    for (const [name, text] of shippedText()) {
      expect(text, name).toContain('camelCase');
      expect(text, name).toContain('snake_case');
      expect(text, name).toContain('getAdapter');
    }
  });

  test('and every multi-word key in both files, uncommented, obeys it', () => {
    for (const [name, text] of shippedText()) {
      const doc = uncommented(text);
      expect(conventionBreaches(doc), name).toEqual([]);
      // With a multi-word key on each side of the seam, so neither half is judged over nothing.
      expect(keyPaths(doc), name).toContain('adapters.codex.retry.baseDelayMs');
      expect(keyPaths(doc), name).toContain('repo.base_branch');
    }
  });

  test('both halves have a subject, each demonstrated on its own', () => {
    expect(conventionBreaches({ repo: { baseBranch: 'main' } })).toStrictEqual(['repo.baseBranch']);
    expect(conventionBreaches({ adapters: { codex: { retry: { base_delay_ms: 5000 } } } }))
      .toStrictEqual(['adapters.codex.retry.base_delay_ms']);
    expect(conventionBreaches({ adapters: { codex: { extraArgs: [] } }, repo: { base_branch: 'main' } })).toEqual([]);
  });
});

describe('Q-0058 AC-9 — three doc comments stop reporting a defect that is fixed', () => {
  test('the declaration no longer names the spelling, and cites this ticket', () => {
    const declaration = repoFile('packages/shared/src/project.ts');
    expect(declaration.includes('base_delay_ms'), 'the comment still reports the mismatch as present').toBe(false);
    expect(declaration).toContain('Q-0058');
  });

  test('and neither core interface still explains itself by a visibility that has changed', () => {
    // Both stay locally declared — backlog.source.test.ts forbids any file in packages/core from
    // importing zod, which is the real reason and the one they now give. Only the reason moved.
    expect(repoFile('packages/core/src/adapters/adapters.ts').includes('module-private'),
      'a comment claiming the shared schemas are module-private is now false').toBe(false);
  });
});
