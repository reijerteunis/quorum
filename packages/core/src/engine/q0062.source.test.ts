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
 * The argv-shaped tokens of `text`.
 *
 * A quote is a property of the spelling and not of the command, so quotes are **separators** here:
 * `['branch', '-d', b]`, `["branch", "-d", b]`, `` runCommand(`git branch -d ${b}`) `` and a plain
 * `git branch -d` inside a shell string all reduce to the same two adjacent tokens. A property
 * access stays **one** token, because `.` is part of a token — `list.push` is never the verb
 * `push` — which is the only reason the two `push` clauses below can be written at all: measured
 * across both trees' production sources, there are 138 `x.push(` sites and not one bare `push`.
 *
 * A colon that **ends** a token is JavaScript punctuation — an object key, a type annotation, a
 * label — and is dropped; one that **begins** it is a refspec, and is kept. Without that,
 * `{ deleteBranch: true }` tokenises as `deleteBranch:` and the clause that exists to catch it
 * reads clean.
 */
const argv = (text: string): string[] =>
  text
    .split(/[^\w.:/@-]+/)
    .map((token) => (/^:+$/.test(token) ? token : token.replace(/:+$/, '')))
    .filter(Boolean);

/** A token equal to one of `flags`. */
const is =
  (...flags: readonly string[]) =>
  (token: string): boolean =>
    flags.includes(token);

/** Whether `verb` appears with a token `matches` accepts among the three that follow it. */
const near = (tokens: readonly string[], verb: string, matches: (token: string) => boolean): boolean =>
  tokens.some((token, index) => token === verb && tokens.slice(index + 1, index + 4).some(matches));

/**
 * Every way a source could delete a ref, or ask {@link removeWorktree} to delete one for it.
 *
 * Each clause reads tokens rather than a quoted literal, so it is blind to quote style and to
 * whether the command was built as an argv array or written out as a shell line — the three
 * spellings a review of an earlier round named as passing unnoticed. The last clause is the
 * backstop: the corpus contains **no** `-d`, `-D` or `--delete` token outside the primitive, so a
 * deletion flag attached to a verb nobody anticipated is still reported, under a label that says
 * only that much.
 *
 * What it does not see, stated rather than left to be discovered: a flag assembled at run time
 * (`args.push(flag)` where `flag` is a variable) is invisible to any scan of the text, which is why
 * the two-parameter `WorktreeRemover` asserted below is the half of this pin that cannot be talked
 * out of firing.
 */
const CLAUSES: readonly (readonly [string, (tokens: readonly string[]) => boolean])[] = [
  ['deleteBranch', (t) => t.includes('deleteBranch')],
  ['branch -d', (t) => near(t, 'branch', is('-d'))],
  ['branch -D', (t) => near(t, 'branch', is('-D'))],
  ['branch --delete', (t) => near(t, 'branch', is('--delete'))],
  ['tag -d', (t) => near(t, 'tag', is('-d', '-D', '--delete'))],
  ['update-ref', (t) => t.includes('update-ref')],
  ['push --delete', (t) => near(t, 'push', is('-d', '--delete'))],
  ['push :ref', (t) => near(t, 'push', (token) => token.startsWith(':'))],
  ['a delete flag', (t) => t.some(is('-d', '-D', '--delete'))],
];

/**
 * The clauses {@link CLAUSES} reports over `text`, in their declared order.
 *
 * A function over its input rather than assertions over the corpus, so each clause can be shown
 * firing on a mutated copy — showing that a guard has a subject proves the guard fires, not that
 * each of its clauses does (Q-0071).
 */
function refDeletions(text: string): string[] {
  const tokens = argv(text);
  return CLAUSES.filter(([, fires]) => fires(tokens)).map(([label]) => label);
}

/** One spelling of a ref deletion, and the clause that must see it. */
const FORMS: readonly (readonly [string, string, string])[] = [
  ['a single-quoted argv', "git(['branch', '-d', branch], repo)", 'branch -d'],
  ['a double-quoted argv', 'git(["branch", "-d", branch], repo)', 'branch -d'],
  ['a shell line in a template literal', 'runCommand(`git branch -D ${branch}`, repo)', 'branch -D'],
  ['a shell line built by concatenation', 'exec("git branch --delete " + branch)', 'branch --delete'],
  ['a tag, which is a ref too', 'git(["tag", "-d", name], repo)', 'tag -d'],
  ['plumbing', "git(['update-ref', '-d', ref], repo)", 'update-ref'],
  ['a double-quoted push deletion', 'git(["push", "origin", "--delete", branch], repo)', 'push --delete'],
  ['a colon refspec assembled', "git(['push', 'origin', ':' + branch], repo)", 'push :ref'],
  ['a colon refspec written out', 'exec(`git push origin :refs/heads/${branch}`)', 'push :ref'],
  ['the primitive asked to do it', 'removeWorktree(dir, branch, { deleteBranch: true })', 'deleteBranch'],
];

/** What the scan must stay silent over, or it reports the whole corpus and means nothing. */
const INNOCENT: readonly (readonly [string, string])[] = [
  ['an array push carrying a colon', 'messages.push(`${branch}: worktree removed — ${dir}`)'],
  ['an array push carrying a flag', "args.push('--force', dir)"],
  ['the removal this ticket adds', "git(['worktree', 'remove', '--force', dir], repo)"],
  ['listing the branches it keeps', "git(['branch', '--list', 'harness/*'], repo)"],
  ['the call site as it ships', 'context.removeWorktree(context.repoDir, branch)'],
];

describe('AC-4 — no production file asks for a ref to be deleted', () => {
  test('the option is spelled in git.ts alone, and no other source carries a delete verb', () => {
    const offenders = sources()
      .filter(([name]) => name !== PRIMITIVE)
      .flatMap(([name, text]) => refDeletions(text).map((label) => `${name}: ${label}`));
    expect(offenders).toStrictEqual([]);
    // The positive control: without it the scan above passes just as well over a clause set that
    // matches nothing at all. Three clauses live over the one file allowed to spell the deletion.
    expect(refDeletions(source(PRIMITIVE))).toStrictEqual(['deleteBranch', 'branch -D', 'a delete flag']);
  });

  test('the scan fires over the call site edited to ask for a deletion, in either spelling', () => {
    const site = source('engine/lifecycle.ts');
    expect(site, 'the call site the mutations below rewrite').toContain('context.removeWorktree(context.repoDir, branch)');

    const asked = site.replace(
      'context.removeWorktree(context.repoDir, branch)',
      'context.removeWorktree(context.repoDir, branch, { deleteBranch: true })');
    expect(asked).not.toBe(site);
    expect(refDeletions(asked)).toStrictEqual(['deleteBranch']);

    // The form the earlier scan could not see: a double-quoted argv inserted into the real file.
    const tidied = site.replace(
      'context.removeWorktree(context.repoDir, branch)',
      'context.removeWorktree(context.repoDir, branch); git(["branch", "-d", branch], context.repoDir)');
    expect(tidied).not.toBe(site);
    expect(refDeletions(tidied)).toStrictEqual(['branch -d', 'a delete flag']);
  });

  test('every spelling of a deletion is seen, and nothing that is not one', () => {
    // Quote style and command construction are properties of the spelling; the clause set is a
    // property of the command. Each row is the positive control for one clause.
    for (const [form, snippet, clause] of FORMS) {
      expect(refDeletions(snippet), `${form} must be seen as ${clause}`).toContain(clause);
    }
    // And the other half, which is what makes the first half mean anything: a scan that fires over
    // the whole corpus reports nothing. `x.push` is not the verb `push`.
    for (const [what, snippet] of INNOCENT) {
      expect(refDeletions(snippet), `${what} is not a ref deletion`).toStrictEqual([]);
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
