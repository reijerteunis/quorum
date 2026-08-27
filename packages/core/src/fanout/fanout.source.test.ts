// Q-0048: the criteria that are properties of the code rather than of its behaviour.
//
// "The shell appears in exactly one file in core" cannot be observed at run time, and it is exactly
// what a later module breaks silently — the same shape as the ancestry rule Q-0042 pinned here
// after this repository had already answered one question two ways.
import { describe, expect, test } from 'vitest';

import * as commandModule from './command.js';
import * as fanoutModule from './fanout.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/** Corpus keys are whole paths below `src`, so a same-named file elsewhere never answers for these. */
const FANOUT_SOURCE = 'fanout/fanout.ts';
const COMMAND_SOURCE = 'fanout/command.ts';

/** Every non-test source this ticket added — the corpus's own view of the module's folder. */
const moduleSources = (): [string, string][] => {
  const files = coreSourceFiles().filter(([name]) => name.startsWith('fanout/'));
  if (!files.length) throw new Error('corpus missing: packages/core/src/fanout/ holds no source file');
  return files;
};

const sourceOf = (key: string): string => {
  const found = moduleSources().find(([name]) => name === key);
  if (!found) throw new Error(`corpus missing: packages/core/src/${key} does not exist`);
  return found[1];
};

/** Every module specifier a file imports from, in source order. */
const importsOf = (text: string): string[] => [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

describe('AC-1 — two files, the exact surface, no dependency, and nothing printed', () => {
  test('the folder is exactly the two files, and neither is a barrel', () => {
    expect(moduleSources().map(([name]) => name)).toStrictEqual([COMMAND_SOURCE, FANOUT_SOURCE]);
  });

  test('fanout.ts exports the twelve names the port assigns it, and no thirteenth', () => {
    expect(Object.keys(fanoutModule).sort()).toStrictEqual([
      'IntegrationError', 'branchExists', 'branchHead', 'commitAll', 'loadTasks', 'mergeInto',
      'resetBranchTo', 'scopeToFailing', 'taskPromptSection', 'taskVars', 'ticketWorktree', 'waves',
    ]);
  });

  test('command.ts exports runCommand and nothing else', () => {
    expect(Object.keys(commandModule)).toStrictEqual(['runCommand']);
    expect(typeof commandModule.runCommand).toBe('function');
  });

  test('packages/core/src/index.ts is untouched, so Q-0041\'s byte pin stays green', () => {
    // Deliberate: this ticket adds no public re-export. Its only declared dependent (Q-0053) is in
    // the same package and imports ./fanout.js directly (OQ-4, settled).
    expect(repoFile('packages/core/src/index.ts')).toBe("export const name = '@quorum/core';\n");
  });

  test('core declares no new dependency', () => {
    const pkg = JSON.parse(repoFile('packages/core/package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toStrictEqual(['@quorum/shared', 'ajv', 'ajv-formats', 'yaml']);
  });

  test('neither file prints, and neither carries an escape sequence', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['console.', 'process.stdout', 'process.stderr', '\\x1b', '\\u001b', '']) {
        expect(text.includes(forbidden), `${name} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
      }
    }
  });

  test('strict TypeScript: no `any` and no suppressed diagnostic', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of [': any', '<any>', 'as any', '@ts-ignore', '@ts-expect-error']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  test('every exported symbol is immediately preceded by a JSDoc block', () => {
    for (const [name, text] of moduleSources()) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (!line.startsWith('export ')) return;
        expect(lines[i - 1]?.trim().endsWith('*/'), `${name}:${i + 1} — ${line.slice(0, 48)} has no JSDoc`).toBe(true);
      });
    }
  });

  test('it imports node builtins, yaml, shared and its own siblings — never the spike', () => {
    // About SPECIFIERS: this package cites spike paths in comments as its evidence, which is the
    // house style, and a check that forbade the word would forbid the citations.
    const allowed = ['node:child_process', 'node:fs', 'node:path', 'yaml', '@quorum/shared', '../git/git.js'];
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(allowed.includes(specifier), `${name} imports ${specifier}`).toBe(true);
      }
      for (const line of text.split('\n').filter((l) => /^\s*(import|export)\b/.test(l) || l.includes('require('))) {
        expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
      }
    }
  });
});

describe('AC-13 — the shell appears in exactly one file in core', () => {
  test('execSync is in fanout/command.ts and in no other non-test source under src', () => {
    for (const [name, text] of coreSourceFiles()) {
      expect(text.includes('execSync'), `${name} ${name === COMMAND_SOURCE ? 'must' : 'must not'} reach for a shell`)
        .toBe(name === COMMAND_SOURCE);
    }
  });

  test('fanout.ts runs git through an argv array and reaches for no shell of its own', () => {
    const text = sourceOf(FANOUT_SOURCE);
    expect(text).toContain('execFileSync');
    for (const forbidden of ['execSync', 'spawnSync', 'shell:']) {
      expect(text.includes(forbidden), `fanout.ts must not reach for ${forbidden}`).toBe(false);
    }
  });

  test('command.ts keeps the fifteen-minute default as that expression, and ignores stdin', () => {
    const text = sourceOf(COMMAND_SOURCE);
    expect(text).toContain('timeoutMs = 15 * 60_000');
    expect(text).toContain("stdio: ['ignore', 'pipe', 'pipe']");
    expect(text).toContain("killSignal: 'SIGKILL'");
    // All three ways a kill shows up. Dropping one makes a timeout look like an ordinary failure.
    for (const disjunct of ["'killed'", "'signal'", "'ETIMEDOUT'"]) expect(text).toContain(disjunct);
  });
});

describe('AC-13 — IntegrationError is a bare subclass, exactly as FlowError is', () => {
  test('the declaration is the whole class body', () => {
    expect(sourceOf(FANOUT_SOURCE)).toContain('export class IntegrationError extends Error {}');
  });

  test('it overrides nothing the CLI\'s message-only rendering depends on', () => {
    const text = sourceOf(FANOUT_SOURCE);
    for (const forbidden of ['this.name', 'captureStackTrace', 'super(message)']) {
      expect(text.includes(forbidden), `IntegrationError must not set ${forbidden}`).toBe(false);
    }
    const error = new fanoutModule.IntegrationError('one sentence');
    expect(error.name).toBe('Error');
    expect(error.message).toBe('one sentence');
  });
});

describe('AC-9/AC-13 — no literal is re-spelled', () => {
  test('the worktree root and the naming rule come from shared', () => {
    const text = sourceOf(FANOUT_SOURCE);
    expect(text).toContain('REPO_WORKTREE_ROOT');
    expect(text).toContain('worktreeDirName');
    for (const [name, source] of moduleSources()) {
      expect(source.includes('.harness/worktrees'), `${name}: the worktree root belongs to shared`).toBe(false);
      expect(source.includes('replace(/\\//g'), `${name}: the / → __ rule belongs to shared`).toBe(false);
    }
  });

  test('the only names taken from shared are those two', () => {
    // AC-13's "packages/shared gains no export" seen from this side: the module's import surface is
    // fixed, so a schema smuggled into shared for this ticket would have no caller here.
    expect(sourceOf(FANOUT_SOURCE)).toContain("import { REPO_WORKTREE_ROOT, worktreeDirName } from '@quorum/shared';");
    expect(sourceOf(COMMAND_SOURCE).includes('@quorum/shared'), 'command.ts needs nothing from shared').toBe(false);
  });

  test('mergeInto keeps the TAIL of git\'s reason, not its head', () => {
    expect(sourceOf(FANOUT_SOURCE)).toContain('.slice(-500)');
  });
});

describe('AC-13 — no schema, no worktree lifecycle, and one write', () => {
  test('no zod schema is defined and nothing is validated at run time', () => {
    // OQ-3, settled: `loadTasks` validates nothing today, and a schema would refuse files the
    // engine currently accepts — a rule arriving through a type. Specifiers and call shapes rather
    // than the bare word, because the module names the zod boundary in a comment to say what it is
    // deliberately NOT, and a check forbidding the word would forbid the citation.
    for (const [name, text] of moduleSources()) {
      expect(importsOf(text).some((s) => s.includes('zod')), `${name} must not import zod`).toBe(false);
      for (const forbidden of ['z.object(', 'safeParse', 'Schema.parse(']) {
        expect(text.includes(forbidden), `${name} must not validate: found ${forbidden}`).toBe(false);
      }
    }
  });

  test('removeWorktree is not imported, and no task-branch rollback helper is added', () => {
    // Register row 20 is Q-0050's and stays open: `finish()` does not roll back task branches, and
    // this module must not close that by accident. Q-0062 owns the worktree lifecycle.
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['removeWorktree', 'for-each-ref', "'-D'", "'branch', '-d'"]) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
    expect(sourceOf(FANOUT_SOURCE)).toContain("import { ensureWorktree } from '../git/git.js';");
  });

  test('the folder performs exactly one filesystem write, and it is loadTasks\'s', () => {
    // AC-11: every other write this module makes goes into a worktree or a ref, through git.
    const writes = moduleSources().flatMap(([name, text]) =>
      [...text.matchAll(/fs\.(\w*(?:write|append|rm|mkdir|rename|copy|cp|unlink|chmod)\w*)\(/gi)].map((m) => `${name}: fs.${m[1]}`));
    expect(writes).toStrictEqual([`${FANOUT_SOURCE}: fs.writeFileSync`]);
  });

  test('each preserved defect names its authority on one line', () => {
    // harness/rules.md: one line naming the authority where behaviour is deliberately strange, and a
    // pointer rather than a transcription of the argument.
    const citations = moduleSources()
      .flatMap(([, text]) => [...text.matchAll(/Why: preserved defect, see Q-0048 AC-\d+/g)].map((m) => m[0]));
    expect(citations.length, 'AC-6, AC-9 defect 2, AC-12 defects 1, 3 and 4 each carry one').toBeGreaterThanOrEqual(5);
  });
});
