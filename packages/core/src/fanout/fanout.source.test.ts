// Q-0048: the criteria that are properties of the code rather than of its behaviour.
//
// "The shell appears in exactly one file in core" cannot be observed at run time, and it is exactly
// what a later module breaks silently — the same shape as the ancestry rule Q-0042 pinned here
// after this repository had already answered one question two ways.
import { describe, expect, test } from 'vitest';

import * as commandModule from './command.js';
import * as fanoutModule from './fanout.js';
import * as barrel from '../index.js';
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

/**
 * Every module specifier a file reaches for, in source order — three shapes.
 *
 * Q-0107 AC-12 added `require('…')` and the side-effect `import '…'` to the `from '…'` this read.
 * Both are shapes the retired spike line scan caught and this parser did not, so retiring that scan
 * without widening here would have lost them rather than moved them. The side-effect form was found
 * by demonstrating the first widening red and watching the suite stay green — see
 * `lint.source.test.ts`, where the same hole is recorded at length.
 */
const importsOf = (text: string): string[] =>
  [...text.matchAll(/\bfrom\s*'([^']+)'|\brequire\s*\(\s*'([^']+)'\s*\)|^\s*import\s+'([^']+)'/gm)]
    .map((m) => m[1] ?? m[2] ?? m[3]);

describe('AC-1 — two files, the exact surface, no dependency, and nothing printed', () => {
  test('the folder is exactly the two files, and neither is a barrel', () => {
    expect(moduleSources().map(([name]) => name)).toStrictEqual([COMMAND_SOURCE, FANOUT_SOURCE]);
  });

  test('fanout.ts exports the twelve names the port assigns it, and no thirteenth', () => {
    expect(Object.keys(fanoutModule).sort()).toStrictEqual([
      'IntegrationError', 'branchHead', 'branchProbe', 'commitAll', 'loadTasks', 'mergeInto',
      'resetBranchTo', 'scopeToFailing', 'taskPromptSection', 'taskVars', 'ticketWorktree', 'waves',
    ]);
  });

  test('and that pin MOVED rather than widening — the set it held before Q-0074 is refused', () => {
    // Still twelve: `branchExists` became `branchProbe`, which is the rename that turns each of its
    // six call sites into a compile error rather than a truthiness test that silently reads a
    // three-answer probe as a boolean. Shown red against the value it replaces rather than edited to
    // fit, which is the demonstration `git.source.test.ts` already writes for itself — a `toContain`
    // here would have accepted either list and recorded nothing.
    expect(Object.keys(fanoutModule).sort(), 'the module still exports the twelve it had before Q-0074')
      .not.toStrictEqual([
        'IntegrationError', 'branchExists', 'branchHead', 'commitAll', 'loadTasks', 'mergeInto',
        'resetBranchTo', 'scopeToFailing', 'taskPromptSection', 'taskVars', 'ticketWorktree', 'waves',
      ]);
  });

  test('command.ts exports runCommand and nothing else', () => {
    expect(Object.keys(commandModule)).toStrictEqual(['runCommand']);
    expect(typeof commandModule.runCommand).toBe('function');
  });

  test('the barrel re-exports exactly this folder\'s public contribution (Q-0096 AC-2)', () => {
    // Until Q-0096 this pinned `packages/core/src/index.ts` byte for byte, asserting that this
    // port child added no public re-export. Q-0096 opens the surface, so what survives is the half
    // still under decision: `IntegrationError` is a class a caller has to catch, and the rest of
    // this folder — the fan-out itself and `runCommand` — stays in-package.
    expect([...Object.keys(fanoutModule), ...Object.keys(commandModule)]
      .filter((symbol) => symbol in barrel).sort()).toStrictEqual(['IntegrationError']);
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

  test('so is every field of an exported interface', () => {
    // AC-1 asks for JSDoc on "every exported symbol, interface field and non-obvious parameter",
    // and the assertion above reads `export` lines only — a field is not one, which is how two
    // undocumented fields reached a review round. The declared type surface is what a consumer of
    // this module reads, so it is checked at the same grain as the exports.
    const fields: string[] = [];
    for (const [name, text] of moduleSources()) {
      const lines = text.split('\n');
      let open = false;
      lines.forEach((line, i) => {
        if (/^export interface \w+/.test(line)) { open = true; return; }
        if (open && line === '}') { open = false; return; }
        if (!open || !/^ {2}(?:readonly )?[A-Za-z_$][\w$]*\??:/.test(line)) return;
        fields.push(`${name}:${i + 1}`);
        expect(lines[i - 1]?.trim().endsWith('*/'), `${name}:${i + 1} — ${line.trim()} has no JSDoc`).toBe(true);
      });
    }
    // The walk itself is the fragile part: an interface it failed to enter would assert nothing and
    // still report green. Sixteen fields across six interfaces — TaskNode 2, Task 4, TicketFolder 1
    // and MergeResult 4 in fanout.ts; RunCommandOptions 1 and CommandResult 4 in command.ts.
    // MergeResult gained `worktreeClean` at Q-0074: an abort is best-effort, so what the worktree
    // was left holding is a fourth thing a merge reports rather than a promise its JSDoc made.
    expect(fields.length).toBe(16);
  });

  test('it imports node builtins, yaml, shared and its own siblings — and nothing else', () => {
    // About SPECIFIERS: this package cites spike paths in comments as its evidence, which is the
    // house style, and a check that forbade the word would forbid the citations.
    // node:os is Q-0070's, and deliberate: the capture directory belongs under os.tmpdir() because
    // anywhere inside the worktree would be committed onto the step branch by commitAll's git add -A.
    //
    // Q-0107 AC-12 — `retired`, the line scan that stood below this loop. Decision 079 classes it
    // (b): after the cutover it can still fail, but only over a comment on an export line, which is
    // not a dependency. This allow-list is the sibling and is strictly stronger, naming what is
    // permitted rather than one thing that is not; `importsOf` gained the `require(` shape in the
    // same change, which is the one thing the retired scan saw and this loop did not.
    const allowed = ['node:child_process', 'node:fs', 'node:os', 'node:path', 'yaml', '@quorum/shared', '../git/git.js'];
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(allowed.includes(specifier), `${name} imports ${specifier}`).toBe(true);
      }
    }
    for (const [shape, escape] of [
      ['a CommonJS specifier', `const git = require('../../../../${'spi'}ke/src/git.js');`],
      ['a side-effect import', `import '../../../../${'spi'}ke/src/git.js';`],
    ] as const) {
      expect(importsOf(escape), `the parser sees ${shape}`).toHaveLength(1);
      expect(allowed.includes(importsOf(escape)[0]), `and the allow-list refuses ${shape}`).toBe(false);
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
    // Since Q-0070 the child writes through descriptors rather than pipes, which is what removes
    // the ceiling: maxBuffer bounds a pipe and bounds nothing here. stdin stays ignored.
    expect(text).toContain("stdio: ['ignore', out, err]");
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
    // Register row 20 is settled rather than open: task branches are kept, deliberately, and so is
    // every other ref — see *"A run removes the worktrees it made, and never the refs"*
    // (2026-08-31), which Q-0062 wrote. That STRENGTHENS these assertions instead of releasing
    // them: the worktree lifecycle lives on the run's terminal path in `engine/`, this module
    // obtains worktrees and never gives them back, and nothing anywhere deletes a branch.
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['removeWorktree', 'for-each-ref', "'-D'", "'branch', '-d'"]) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
    // The one specifier this module takes from `core/git`, and every name it takes through it.
    // `exitStatus` and `failureDetail` joined `ensureWorktree` at Q-0074: reading git's exit code is
    // what makes a third answer possible, `git.ts` already had both module-private, and a copy
    // beside this module's own runner is the duplication the `safe()` register exists to bound
    // (Q-0074 OQ-6). The anchor is the whole import, so a widening is a visible act here.
    expect(sourceOf(FANOUT_SOURCE)).toContain("import { ensureWorktree, exitStatus, failureDetail } from '../git/git.js';");
  });

  test('the folder writes in exactly two places: loadTasks\'s artifact, and a capture it removes', () => {
    // AC-11: every other write this module makes goes into a worktree or a ref, through git.
    //
    // Q-0070 adds the second surface — one directory per invocation under os.tmpdir(), created by
    // runCommand and removed on every exit path. `mkdtemp` and `open` join the verbs because that
    // is how the capture writes: a pin that cannot see the write it exists to bound would report
    // success over the very thing it was meant to examine. Neither verb matches anything in
    // fanout.ts, so the widening costs no precision.
    const writes = moduleSources().flatMap(([name, text]) =>
      [...text.matchAll(/fs\.(\w*(?:write|append|rm|mkdir|mkdtemp|open|rename|copy|cp|unlink|chmod)\w*)\(/gi)].map((m) => `${name}: fs.${m[1]}`));
    expect(writes).toStrictEqual([
      `${COMMAND_SOURCE}: fs.mkdtempSync`,
      `${COMMAND_SOURCE}: fs.openSync`,
      `${COMMAND_SOURCE}: fs.openSync`,
      `${COMMAND_SOURCE}: fs.rmSync`,
      `${FANOUT_SOURCE}: fs.writeFileSync`,
    ]);
  });

  test('each preserved defect names its authority, as an identity and not a floor', () => {
    // harness/rules.md: one line naming the authority where behaviour is deliberately strange, and a
    // pointer rather than a transcription of the argument.
    //
    // A `toBeGreaterThanOrEqual(5)` stood here, which is the shape Q-0073 named: a floor cannot see
    // a citation swapped out, and — the reason it moved now — it cannot see one REMOVED either,
    // because Q-0074 closed three of these and the floor would have gone on passing at five if the
    // count had happened to be met by the survivors. Identities, in source order.
    expect(moduleSources().flatMap(([name, text]) =>
      [...text.matchAll(/Why: preserved defect, see (Q-\d+ AC-\d+(?: defect \d+)?)/g)].map(([, cited]) => `${name}: ${cited!}`)))
      .toStrictEqual([
        `${FANOUT_SOURCE}: Q-0048 AC-12`, // parsedTasks — an empty tasks.yaml still throws a raw TypeError
        `${FANOUT_SOURCE}: Q-0048 AC-12`, // taskVars — a hostile task id is handed back unescaped
        `${FANOUT_SOURCE}: Q-0048 AC-12`, // resetBranchTo — the route is chosen from fs.existsSync alone
      ]);
  });

  test('and the three Q-0074 closed are gone, named by the token they were cited under', () => {
    // AC-1's third half. A reader told to find these lines by their TICKET finds nothing: they cite
    // `Q-0048`, and `Q-0074` appeared exactly once in the whole of `packages/core/src` before this
    // change — a search that failed to look, read as proven absence, which is this ticket's own
    // subject sitting inside its own instrument.
    const text = sourceOf(FANOUT_SOURCE);
    for (const [token, subject] of [
      ['Why: preserved defect, see Q-0048 AC-6', 'branchExists and branchHead conflating a failed git with an absent branch'],
      ['Why: preserved defect, see Q-0048 AC-12 defect 4', 'commitAll reporting a revert that failed as a discard'],
    ] as const) {
      // Shown to have a subject before it is believed (Q-0111, whose first needle matched nothing at
      // all including itself): the needle is exercised against the line as it stood, so a scan that
      // could never fire fails HERE rather than passing over a module that had kept it.
      expect(`  * ${token}. This returns \`false\` when git itself failed`.includes(token),
        `the needle for ${subject} matches nothing`).toBe(true);
      expect(text.includes(token), `fanout.ts still carries the pin for ${subject}`).toBe(false);
    }
    // The third is not a token but a sentence, because `mergeInto`'s and `commitAll`'s pins shared
    // the `Q-0048 AC-12` citation the three survivors above still carry.
    for (const claim of [
      'reports through `onDiscard` as though it had discarded',
      'leave the worktree clean either way',
    ]) {
      expect(`a JSDoc promising to ${claim} today`.includes(claim), `the needle for "${claim}" matches nothing`).toBe(true);
      expect(text.includes(claim), `fanout.ts still claims: ${claim}`).toBe(false);
    }
  });

  test('and every site that KEEPS safe() says why, which the ones that stopped needing it do not', () => {
    // AC-1's second half, scoped to this module because `git/git.ts`'s half is Q-0115's and its own
    // register carries it.
    //
    // Chunked on the JSDoc that OPENS each declaration rather than on the declaration line, which
    // is the correction this clause needed on its first run: splitting at `export function` puts a
    // symbol's doc comment in the chunk BEFORE it, so `resetBranchTo` — whose authority line is in
    // its JSDoc — was reported as citing none while `mergeInto` inherited it. A chunker that
    // mis-attributes is worse than none, because it reads as coverage in both directions.
    const text = sourceOf(FANOUT_SOURCE);
    const chunks = text.split(/\n(?=\/\*\*\n)/).filter((chunk) => /\bsafe\(\(\) =>/.test(chunk));
    // Three, named rather than counted: the two halves of `commitAll`'s revert live in one chunk,
    // `mergeInto`'s conflict probe and abort in another, and `resetBranchTo`'s clean in a third. A
    // fourth retained site fails here until it is named, and a chunker that lost one fails too.
    // Anchored at a line start, because a JSDoc that says "this function cannot promise…" answers
    // an unanchored match with the word after `function` — measured on this file's first run.
    expect(chunks.map((chunk) => /^(?:export )?(?:function|const) (\w+)/m.exec(chunk)?.[1]))
      .toStrictEqual(['resetBranchTo', 'commitAll', 'mergeInto']);
    for (const chunk of chunks) {
      expect(chunk, `a retained safe() with no authority line: ${String(chunk.split('\n').find((l) => l.includes('function')))}`)
        .toMatch(/Why: /);
    }
  });
});
