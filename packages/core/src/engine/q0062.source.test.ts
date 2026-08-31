// Q-0062 AC-4/AC-9 — the properties of the code rather than of its behaviour: a run removes
// directories and never refs, and it reaches the removal through a capability rather than a git of
// its own.
//
// "No ref is ever deleted" cannot be observed by running a flow that never deletes one, which is
// every flow: the only evidence a behavioural test can offer is that the branches are still there
// after a run that did not try. What stops the next change trying is here.
import { describe, expect, test } from 'vitest';

import { coreSourceFiles } from '../../test/corpus.js';

/** The one file that may spell the option, because it declares it. */
const PRIMITIVE = 'git/git.ts';

const sources = (): [string, string][] => coreSourceFiles();

const source = (name: string): string => {
  const found = sources().find(([key]) => key === name);
  if (!found) throw new Error(`corpus missing: packages/core/src/${name}`);
  return found[1];
};

/**
 * Every way `text` could delete a ref, or ask {@link removeWorktree} to delete one for it.
 *
 * A function over its input rather than assertions over the corpus, so each clause can be shown
 * firing on a mutated copy — showing that a guard has a subject proves the guard fires, not that
 * each of its clauses does (Q-0071).
 */
function refDeletions(text: string): string[] {
  const found: string[] = [];
  for (const [label, pattern] of [
    ['deleteBranch', /deleteBranch/],
    ['branch -d', /'branch',\s*'-d'/],
    ['branch -D', /'-D'/],
    ['branch --delete', /'--delete'/],
    ['update-ref -d', /update-ref/],
    ['push --delete', /'push'/],
  ] as const) {
    if (pattern.test(text)) found.push(label);
  }
  return found;
}

describe('AC-4 — no production file asks for a ref to be deleted', () => {
  test('the option is spelled in git.ts alone, and no other source carries a delete verb', () => {
    const offenders = sources()
      .filter(([name]) => name !== PRIMITIVE)
      .flatMap(([name, text]) => refDeletions(text).map((label) => `${name}: ${label}`));
    expect(offenders).toStrictEqual([]);
    // The positive control: without it the scan above passes just as well over a pattern set that
    // matches nothing at all.
    expect(refDeletions(source(PRIMITIVE))).toStrictEqual(['deleteBranch', 'branch -D']);
  });

  test('the scan fires over the call site edited to ask for a deletion, and over each verb', () => {
    const site = source('engine/lifecycle.ts');
    expect(site, 'the call site the mutation below rewrites').toContain('context.removeWorktree(context.repoDir, branch)');
    const mutated = site.replace(
      'context.removeWorktree(context.repoDir, branch)',
      'context.removeWorktree(context.repoDir, branch, { deleteBranch: true })');
    expect(mutated).not.toBe(site);
    expect(refDeletions(mutated)).toStrictEqual(['deleteBranch']);

    for (const [verb, snippet] of [
      ['branch -d', "git(['branch', '-d', branch], repo)"],
      ['branch -D', "git(['branch', '-D', branch], repo)"],
      ['branch --delete', "git(['branch', '--delete', branch], repo)"],
      ['update-ref -d', "git(['update-ref', '-d', ref], repo)"],
      ['push --delete', "git(['push', 'origin', ':' + branch], repo)"],
    ] as const) {
      expect(refDeletions(snippet), `${verb} must be seen`).toContain(verb);
    }
  });

  test('the capability has no third parameter, so no call site can pass one', () => {
    // The type is the other half of the pin, and it is the half a scan cannot be talked out of: a
    // remover that takes no options cannot be asked for a deletion however the call is written.
    expect(source('engine/types.ts'))
      .toContain('export type WorktreeRemover = (repoDir: string, branch: string) => void;');
  });
});

describe('AC-9 — the removal is reached through a capability, not through a git of its own', () => {
  test('lifecycle.ts imports no git module and spawns no process', () => {
    // The two module names are written without their `../` prefix on purpose: a `..`-escaping
    // literal is one clause C3 of turbo-inputs.test.ts collects and a register would then have to
    // excuse, and the prefix carries none of the discrimination — an import of either module
    // contains the tail whatever route it is spelled by.
    const text = source('engine/lifecycle.ts');
    for (const forbidden of ['git/git.js', 'fanout/fanout.js', 'node:child_process', 'execFileSync']) {
      expect(text.includes(forbidden), `lifecycle.ts must not reach for ${forbidden}`).toBe(false);
    }
    expect(text).toContain('context.readWorktreeChanges(dir)');
  });

  test('engine.ts is the one place the removal and the status read are wired', () => {
    const holders = sources()
      .filter(([, text]) => text.includes("import { removeWorktree } from '../git/git.js'"))
      .map(([name]) => name);
    expect(holders).toStrictEqual(['engine/engine.ts']);
    expect(source('engine/engine.ts')).toContain("['status', '--porcelain']");
  });

  test('no configuration key and no flag was added for any of it', () => {
    // OQ-1 and OQ-2, both declined: the policy is the run's own terminal status and nothing a
    // project or a command line can vary, so an adopter's backlog is fixed without being configured.
    for (const [name, text] of sources()) {
      for (const forbidden of ['keepWorktrees', 'keep_worktrees', 'keep-worktrees', 'pruneWorktrees']) {
        expect(text.includes(forbidden), `${name} must not introduce ${forbidden}`).toBe(false);
      }
    }
  });
});
