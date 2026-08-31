import { describe, expect, test } from 'vitest';

import { coreSourceFiles } from '../../test/corpus.js';

/**
 * Q-0053 AC-2/AC-3 — the three properties this ticket's two new modules exist to make checkable,
 * and the two symbols it needed that may not live in its own folder.
 *
 * `suite-output.ts` decides whether a red phase can be believed and imports nothing at all, so a
 * later change cannot reach for the filesystem inside a detector. `commandTimeout` and the merge
 * base each have exactly one definition in `packages/core/src`, because two copies of a default
 * drift silently and nothing would fail when they did.
 *
 * Derived from the corpus rather than from a list of names, for the reason Q-0051's AC-9d fix
 * gives: a hard-coded array fails open the day another file arrives.
 */
const engine = new Map(
  coreSourceFiles()
    .filter(([name]) => name.startsWith('engine/'))
    .map(([name, text]) => [name.slice('engine/'.length), text] as const),
);
const source = (name: string): string => {
  const text = engine.get(name);
  if (text === undefined) throw new Error(`corpus missing: packages/core/src/engine/${name}`);
  return text;
};

/** Whether `text` carries an `import` statement of any form — value, type, side-effect or dynamic. */
const importsAnything = (text: string): boolean =>
  /^\s*import[\s({]/m.test(text) || /\bimport\s*\(/.test(text) || /\brequire\s*\(/.test(text);

/** The one expression `commands.timeout_ms` is read through. */
const TIMEOUT_EXPRESSION = 'context.config.commands?.timeout_ms ?? 15 * 60_000';

describe('Q-0053 AC-2 — suite-output.ts imports nothing at all', () => {
  test('no node builtin, no sibling module, and not @quorum/shared', () => {
    expect(importsAnything(source('suite-output.ts'))).toBe(false);
  });

  test('the scan has teeth: it fires over every import form it forbids', () => {
    // Demonstrated against the violating text before it is trusted over the file, because a scan
    // that cannot fire reports the property it was written to check over anything at all.
    for (const violation of [
      "import fs from 'node:fs';",
      "import { interpolate } from './loaders.js';",
      "import type { Event } from '@quorum/shared';",
      "import '@quorum/shared';",
      "const YAML = await import('yaml');",
      "const fs = require('node:fs');",
    ]) expect(importsAnything(violation), violation).toBe(true);
    // …and does not fire over the module's own prose, which says the word.
    expect(importsAnything(' * **This module imports nothing** — no `node:` builtin.')).toBe(false);
  });

  test('the positive control: the folder\'s other new module does import', () => {
    // Without it the assertion above passes just as well over a scan that never matches anything.
    expect(importsAnything(source('composite.ts'))).toBe(true);
  });
});

describe('Q-0053 AC-3c — one definition each, in the file that is allowed to hold it', () => {
  test('the command timeout is read in exactly one non-test source file', () => {
    const holders = coreSourceFiles().filter(([, text]) => text.includes(TIMEOUT_EXPRESSION)).map(([name]) => name);
    expect(holders).toStrictEqual(['engine/steps.ts']);
    // …and it is EXPORTED there, which is what stopped `composite.ts` needing a second copy.
    expect(source('steps.ts')).toContain(`export const commandTimeout = (context: RunContext): number => ${TIMEOUT_EXPRESSION}`);
  });

  test('the merge base is asked for in exactly one non-test source file', () => {
    const holders = coreSourceFiles().filter(([, text]) => text.includes('merge-base')).map(([name]) => name);
    expect(holders).toStrictEqual(['git/git.ts']);
    // Its caller reaches it by name, never by re-spelling the subcommand.
    expect(source('composite.ts')).toContain('mergeBase(context.repoDir, into, branch)');
  });

  test('the accepted stderr divergence is registered where it lives, and cites its erratum', () => {
    // Errata E-1 is the charter §2 vehicle for it. `q0050.source.test.ts`'s register is scoped to
    // `engine/` and cannot see a marker in `git/`, so the citation is pinned here instead — see the
    // implement report, which says so rather than leaving the gap to be discovered.
    const git = coreSourceFiles().find(([name]) => name === 'git/git.ts');
    expect(git, 'corpus missing: packages/core/src/git/git.ts').toBeDefined();
    expect(git![1]).toMatch(/Why: deliberate addition, not preservation — see Q-0053 errata E-1/);
  });
});
