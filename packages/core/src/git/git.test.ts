// Q-0042: worktrees, ancestry and containment, asserted against real git.
//
// The independent witness here is git itself, not the spike's suite — both suites can be green
// over a wrong port (harness/port-charter.md §2), because a test ported alongside a mis-ported
// module agrees with it. So every case below builds the repository, the topology and the shallow
// state it asserts, and no case asserts the containment state of a branch in THIS repository.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { PushLagResult } from '@quorum/shared';

import {
  ancestry, configuredUser, containment, emptyRangeEvidence, ensureExcluded, ensureWorktree, mergeBase, pushLag,
  removeWorktree, shallowState, shortSha,
} from './git.js';
import {
  commit, commitAll, counting, git, installGitShim, notARepo, removeTempDirs, repo, shallowCloneOf,
  tempDir, walk, write,
} from '../../test/repo.js';

afterAll(removeTempDirs);

/** `feature` forked before `main` moved on: feature is contained in main, main is not in feature. */
function forked(): string {
  const dir = repo();
  git(dir, 'branch', 'feature');
  commit(dir, 'main moves on');
  return dir;
}

const TICKET_BRANCH = 'harness/T-1/integration';

/** A repository whose ticket branch exists and is contained in `main`. */
function withTicketBranch(): string {
  const dir = repo();
  git(dir, 'branch', TICKET_BRANCH);
  return dir;
}

describe('AC-2 — ancestry selects its state from git\'s exit code and from nothing else', () => {
  test('exit 0 is contained, and every result carries all four keys', () => {
    expect(ancestry(forked(), 'feature', 'main')).toStrictEqual({
      state: 'contained',
      reason: null,
      detail: null,
      command: 'git merge-base --is-ancestor feature main',
    });
  });

  test('exit 0 stays contained whatever the shallow state — found history is real', () => {
    const dir = forked();
    for (const shallow of [true, false, null] as const) {
      expect(ancestry(dir, 'feature', 'main', { shallow }).state, `shallow: ${shallow}`).toBe('contained');
    }
  });

  test('exit 1 in a repository known not to be shallow is provably not contained', () => {
    expect(ancestry(forked(), 'main', 'feature')).toStrictEqual({
      state: 'not-contained',
      reason: null,
      detail: null,
      command: 'git merge-base --is-ancestor main feature',
    });
  });

  test('exit 1 in a shallow repository is indeterminate — absent history cannot disprove ancestry', () => {
    expect(ancestry(forked(), 'main', 'feature', { shallow: true })).toStrictEqual({
      state: 'indeterminate',
      reason: 'shallow clone',
      detail: null,
      command: 'git merge-base --is-ancestor main feature',
    });
  });

  test('exit 1 with an unanswered shallow probe is indeterminate, and carries the probe\'s detail', () => {
    const result = ancestry(forked(), 'main', 'feature', {
      shallow: null,
      shallowDetail: 'fatal: not a git repository',
    });
    expect(result.state).toBe('indeterminate');
    expect(result.reason).toBe('shallow state unknown');
    expect(result.detail).toBe('fatal: not a git repository');
  });

  test('any other exit, and a git that could not answer at all, are indeterminate — never not-contained', () => {
    for (const [what, result] of [
      ['a ref that does not resolve', ancestry(forked(), 'no/such/ref', 'main')],
      ['a directory that is not a repository', ancestry(notARepo(), 'main', 'main')],
    ] as const) {
      expect(result.state, what).toBe('indeterminate');
      expect(result.reason, what).toBe('git failed');
      expect(result.detail, what).toBeTruthy();
      expect(String(result.detail), what).not.toContain('\n');
      expect(result.command, what).toContain('merge-base --is-ancestor');
    }
  });

  test('detail is one line of at most 200 characters', () => {
    const detail = ancestry(forked(), 'x'.repeat(400), 'main').detail;
    expect(detail).toBeTruthy();
    expect(String(detail).length).toBeLessThanOrEqual(200);
  });

  test('detail decides nothing: two different failures give the same state and reason', () => {
    const missingRef = ancestry(forked(), 'no/such/ref', 'main');
    const outside = ancestry(notARepo(), 'main', 'main');
    expect(missingRef.detail).not.toBe(outside.detail);
    expect([missingRef.state, missingRef.reason]).toEqual([outside.state, outside.reason]);
  });
});

describe('AC-3 — shallowState is three-valued and says when it could not ask', () => {
  test('an ordinary repository reports false', () => {
    expect(shallowState(repo())).toStrictEqual({ shallow: false, detail: null });
  });

  test('a genuinely shallow clone reports true', () => {
    expect(shallowState(shallowCloneOf(forked()))).toStrictEqual({ shallow: true, detail: null });
  });

  test('a probe that fails reports null and why — never false', () => {
    const probe = shallowState(notARepo());
    expect(probe.shallow).toBeNull();
    expect(probe.detail).toBeTruthy();
    expect(String(probe.detail)).not.toContain('\n');
  });

  test('any other successful output is false, preserved from the spike (OQ-4)', () => {
    const dir = repo();
    const shim = installGitShim('case " $* " in *--is-shallow-repository*) echo maybe; exit 0 ;; esac');
    try {
      expect(shallowState(dir)).toStrictEqual({ shallow: false, detail: null });
    } finally {
      shim.restore();
    }
  });
});

describe('AC-4 — containment derives the board\'s answer and never guesses an ahead count', () => {
  test('a directory that is not a repository yields null — the probe could not answer', () => {
    expect(containment(notARepo(), 'main')).toBeNull();
  });

  test('a bare repository yields null too — the probe answered, and said "no work tree"', () => {
    const bare = tempDir('bare-');
    git(bare, 'init', '-q', '--bare');
    expect(containment(bare, 'main')).toBeNull();
  });

  test('a value that is not a string names nothing, so there is no question to ask', () => {
    const derived = containment(withTicketBranch(), 'main');
    expect(derived).not.toBeNull();
    for (const value of [undefined, null, 42, {}, ['main']]) {
      expect(derived?.stateOf(value), JSON.stringify(value ?? null)).toBeNull();
    }
  });

  test('a name that is not a local branch is indeterminate (no branch), not silence', () => {
    // Until Q-0070 this answered null, the same as "nothing was named" — so a reviewed ticket
    // whose work never reached a branch was indistinguishable from one nobody had looked at.
    // Whether the answer is worth rendering is the board's call; producing it is this one's.
    expect(containment(withTicketBranch(), 'main')?.stateOf('never/created'))
      .toStrictEqual({ state: 'indeterminate', reason: 'no branch' });
  });

  test('a base that does not resolve is indeterminate (missing ref), never a containment claim', () => {
    expect(containment(withTicketBranch(), 'trunk')?.stateOf(TICKET_BRANCH))
      .toStrictEqual({ state: 'indeterminate', reason: 'missing ref' });
  });

  test('a contained branch carries no reason and no ahead count', () => {
    expect(containment(withTicketBranch(), 'main')?.stateOf(TICKET_BRANCH))
      .toStrictEqual({ state: 'contained' });
  });

  test('the configured base is used literally — a master-based repository never mentions main', () => {
    const dir = tempDir('master-');
    git(dir, 'init', '-q', '-b', 'master');
    commit(dir, 'init');
    git(dir, 'branch', TICKET_BRANCH);
    expect(containment(dir, 'master')?.stateOf(TICKET_BRANCH)).toStrictEqual({ state: 'contained' });
    expect(containment(dir, 'main')?.stateOf(TICKET_BRANCH))
      .toStrictEqual({ state: 'indeterminate', reason: 'missing ref' });
  });

  test('a diverged branch counts base..branch, not the symmetric difference', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', TICKET_BRANCH);
    commit(dir, 'ours 1');
    commit(dir, 'ours 2');
    git(dir, 'checkout', '-q', 'main');
    commit(dir, 'theirs 1');
    // A symmetric-difference count would read 3.
    expect(containment(dir, 'main')?.stateOf(TICKET_BRANCH))
      .toStrictEqual({ state: 'not-contained', ahead: 2 });
  });

  test('a shallow clone turns a provable-only-with-history negative into indeterminate, with no ahead count', () => {
    const origin = repo();
    git(origin, 'branch', TICKET_BRANCH);
    commit(origin, 'later work on main');
    // In the full history the branch IS contained; the shallow clone must not claim otherwise.
    git(origin, 'merge-base', '--is-ancestor', `refs/heads/${TICKET_BRANCH}`, 'refs/heads/main');
    const clone = shallowCloneOf(origin);
    git(clone, 'branch', TICKET_BRANCH, `origin/${TICKET_BRANCH}`);
    expect(containment(clone, 'main')?.stateOf(TICKET_BRANCH))
      .toStrictEqual({ state: 'indeterminate', reason: 'shallow clone' });
  });

  test('a failed ancestry check, and a failed ahead count, are both indeterminate (git failed)', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', TICKET_BRANCH);
    commit(dir, 'ours');
    git(dir, 'checkout', '-q', 'main');

    for (const subcommand of ['merge-base', 'rev-list']) {
      const shim = installGitShim(`case " $* " in *${subcommand}*) exit 3 ;; esac`);
      try {
        expect(containment(dir, 'main')?.stateOf(TICKET_BRANCH), `${subcommand} failing`)
          .toStrictEqual({ state: 'indeterminate', reason: 'git failed' });
      } finally {
        shim.restore();
      }
    }
  });

  test('deriving containment writes nothing, moves no ref and leaves every file byte-identical', () => {
    const dir = repo();
    git(dir, 'branch', TICKET_BRANCH);
    git(dir, 'checkout', '-q', '-b', 'harness/T-2/integration');
    commit(dir, 'ahead of main');
    git(dir, 'checkout', '-q', 'main');
    write(path.join(dir, 'ticket.md'), 'stage: green\n');
    commitAll(dir, 'a file that must not change');

    const filesBefore = walk(dir);
    const refsBefore = git(dir, 'for-each-ref');
    const ticketBefore = fs.readFileSync(path.join(dir, 'ticket.md'));

    const derived = containment(dir, 'main');
    for (const branch of [TICKET_BRANCH, 'harness/T-2/integration', 'never/created', 42]) derived?.stateOf(branch);

    expect(walk(dir)).toEqual(filesBefore);
    expect(git(dir, 'for-each-ref')).toBe(refsBefore);
    expect(fs.readFileSync(path.join(dir, 'ticket.md'))).toEqual(ticketBefore);
  });
});

describe('Q-0064 — the snapshot above ignores git\'s own lock files, and nothing else', () => {
  // Both cases write inside the snapshot window themselves rather than waiting for git's
  // background maintenance to do it, which is what made the assertion above fail on some runs and
  // pass on others.

  test('a lock file appearing under .git while the snapshot is open does not fail it', () => {
    const dir = repo();
    git(dir, 'branch', TICKET_BRANCH);
    const filesBefore = walk(dir);

    const derived = containment(dir, 'main');
    write(path.join(dir, '.git', 'objects', 'maintenance.lock'), '');
    derived?.stateOf(TICKET_BRANCH);

    expect(walk(dir)).toEqual(filesBefore);
  });

  test('a non-lock file under .git, and a .lock outside it, are both still seen', () => {
    const dir = repo();
    git(dir, 'branch', TICKET_BRANCH);
    const filesBefore = walk(dir);

    const derived = containment(dir, 'main');
    // A cache under .git is exactly what the containment rule forbids, so excluding .git/**
    // wholesale would blind the snapshot to it.
    write(path.join(dir, '.git', 'quorum-cache'), 'derived containment\n');
    write(path.join(dir, 'derived.lock'), 'in the user\'s tree\n');
    derived?.stateOf(TICKET_BRANCH);

    const filesAfter = walk(dir);
    expect(filesAfter).not.toEqual(filesBefore);
    expect(filesAfter).toContain(path.join('.git', 'quorum-cache'));
    expect(filesAfter).toContain('derived.lock');
  });
});

describe('AC-5 — an untrusted branch name never reaches a git command line', () => {
  test('injection-shaped values spawn nothing, whatever they are answered with', () => {
    const dir = withTicketBranch();
    const derived = containment(dir, 'main');
    const hostile = ['--upload-pack=touch pwned', 'main; echo hi', '../../../etc/passwd'];
    const { result, calls } = counting(() => hostile.map((value) => derived?.stateOf(value)));
    // The property is the two assertions below — no invocation, no artefact. What the call
    // ANSWERS is incidental to it: a hostile name is simply not in the set that came out of git,
    // so it takes the same route as any other absent branch and reaches no command line. Q-0070
    // changed that answer from null; it did not change what is asserted here.
    expect(result).toEqual(hostile.map(() => ({ state: 'indeterminate', reason: 'no branch' })));
    expect(calls, 'a name that came from frontmatter must cost no git invocation').toBe(0);
    expect(fs.existsSync(path.join(dir, 'pwned'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'pwned'))).toBe(false);
  });

  test('a tag sharing the branch\'s name does not hide the branch', () => {
    const dir = withTicketBranch();
    // With refs/tags/<name> beside refs/heads/<name>, %(refname:short) emits "heads/<name>" and
    // the lookup would miss a branch that resolves. lstrip=2 does not shorten.
    git(dir, 'tag', TICKET_BRANCH);
    expect(containment(dir, 'main')?.stateOf(TICKET_BRANCH)).toStrictEqual({ state: 'contained' });
  });
});

describe('AC-6 — a board of n tickets costs at most 2n + 3 git invocations', () => {
  test('the per-invocation probes are issued once per containment() call', () => {
    const dir = repo();
    const { calls } = counting(() => containment(dir, 'main'));
    expect(calls).toBe(3);
  });

  test('each ticket costs at most two more, contained and not-contained alike', () => {
    const dir = repo();
    const branches = ['harness/T-1/integration', 'harness/T-2/integration', 'harness/T-3/integration'];
    for (const branch of branches) git(dir, 'branch', branch);
    git(dir, 'checkout', '-q', branches[0]);
    commit(dir, 'so one of them is ahead');
    git(dir, 'checkout', '-q', 'main');

    const { calls } = counting(() => {
      const derived = containment(dir, 'main');
      for (const branch of branches) derived?.stateOf(branch);
    });
    expect(calls).toBeLessThanOrEqual(2 * branches.length + 3);
  });
});

describe('AC-7 — emptyRangeEvidence asks the question in the right direction', () => {
  /** `feature` adds a file `main` does not have, so it is provably not contained in main. */
  function divergedContent(): string {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    write(path.join(dir, 'a.txt'), 'feature only\n');
    commitAll(dir, 'feature work');
    git(dir, 'checkout', '-q', 'main');
    return dir;
  }

  test('it asks whether the RIGHT endpoint is contained in the left', () => {
    const evidence = emptyRangeEvidence(forked(), 'main', 'feature');
    expect(evidence.check.command).toBe('git merge-base --is-ancestor feature main');
    expect(evidence.check.state).toBe('contained');
    expect(evidence.sameTree, 'sameTree is asked only of a proven negative').toBeNull();
  });

  test('a proven negative over differing trees is sameTree false', () => {
    const evidence = emptyRangeEvidence(divergedContent(), 'main', 'feature');
    expect(evidence.check.state).toBe('not-contained');
    expect(evidence.sameTree).toBe(false);
  });

  test('two commits holding the same tree are sameTree true', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'feature');
    commit(dir, 'an empty commit changes nothing');
    git(dir, 'checkout', '-q', 'main');
    const evidence = emptyRangeEvidence(dir, 'main', 'feature');
    expect(evidence.check.state).toBe('not-contained');
    expect(evidence.sameTree).toBe(true);
  });

  test('an endpoint that does not resolve claims nothing, about ancestry or about trees', () => {
    const evidence = emptyRangeEvidence(repo(), 'main', 'no/such/ref');
    expect(evidence.check.state).toBe('indeterminate');
    expect(evidence.check.reason).toBe('git failed');
    expect(evidence.sameTree).toBeNull();
  });

  test('a failed tree comparison never changes the ancestry state', () => {
    const dir = divergedContent();
    const shim = installGitShim('case " $* " in *"^{tree}"*) exit 3 ;; esac');
    try {
      const evidence = emptyRangeEvidence(dir, 'main', 'feature');
      expect(evidence.check.state).toBe('not-contained');
      expect(evidence.sameTree).toBeNull();
    } finally {
      shim.restore();
    }
  });

  test('in a shallow repository a would-be negative arrives as indeterminate (shallow clone)', () => {
    // In the full history `feature` is contained in `main`; the shallow clone's grafted parents
    // make the same check exit 1, and absent history may not be rendered as a negative.
    const clone = shallowCloneOf(forked());
    git(clone, 'branch', 'feature', 'origin/feature');
    const evidence = emptyRangeEvidence(clone, 'main', 'feature');
    expect(evidence.check.state).toBe('indeterminate');
    expect(evidence.check.reason).toBe('shallow clone');
    expect(evidence.sameTree).toBeNull();
  });
});

describe('AC-8 — shortSha returns git\'s own abbreviation, or null', () => {
  test('it equals what git itself reports, at whatever length git chose', () => {
    const dir = repo();
    expect(shortSha(dir, 'main')).toBe(git(dir, 'rev-parse', '--short', 'main'));
  });

  test('a ref that does not resolve is null, and so is a directory git cannot read', () => {
    expect(shortSha(repo(), 'no/such/ref')).toBeNull();
    expect(shortSha(notARepo(), 'main')).toBeNull();
  });
});

describe('Q-0053 AC-3a — mergeBase answers with a revision, or with nothing', () => {
  // Ported from spike/src/engine.js's `safeMergeBase`, which lives in the engine and may not be
  // written there in `core`: a landed Q-0042 guard permits `merge-base` in this file alone.
  test('two divergent branches fork at the commit git itself names', () => {
    const dir = forked();
    git(dir, 'checkout', '-q', 'feature');
    commit(dir, 'feature moves on too');
    git(dir, 'checkout', '-q', 'main');

    expect(mergeBase(dir, 'main', 'feature')).toBe(git(dir, 'merge-base', 'main', 'feature'));
    // The whole sha, trimmed — `git()`'s own `.trim()` discharges that half.
    expect(mergeBase(dir, 'main', 'feature')).toMatch(/^[0-9a-f]{40}$/);
    // Symmetric, as git is.
    expect(mergeBase(dir, 'feature', 'main')).toBe(mergeBase(dir, 'main', 'feature'));
  });

  test('a ref that does not exist is null, and so is a directory that is not a repository', () => {
    const dir = forked();
    expect(mergeBase(dir, 'main', 'no/such/branch')).toBeNull();
    expect(mergeBase(dir, 'no/such/branch', 'main')).toBeNull();
    expect(mergeBase(notARepo(), 'main', 'feature')).toBeNull();
  });

  test('two unrelated histories are null rather than an invented ancestor', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '--orphan', 'other');
    write(path.join(dir, 'other.txt'), 'other\n');
    commitAll(dir, 'an unrelated root');
    git(dir, 'checkout', '-q', 'main');

    expect(mergeBase(dir, 'main', 'other')).toBeNull();
  });

  test('it is the branch ahead of the fork that identifies it: an ancestor is its own merge base', () => {
    const dir = forked();
    expect(mergeBase(dir, 'main', 'feature')).toBe(git(dir, 'rev-parse', 'feature'));
  });
});

describe('AC-9 — worktrees are created where the safety rule says, and only there', () => {
  // Spelled out rather than assembled from the constants the module uses, so this is an
  // independent witness of the path rather than a restatement of it.
  const worktreeOf = (dir: string): string =>
    path.join(dir, '.harness', 'worktrees', 'harness__T-1__integration');

  test('it returns the path under the repository\'s worktree root', () => {
    const dir = repo();
    expect(ensureWorktree(dir, TICKET_BRANCH)).toBe(worktreeOf(dir));
    expect(fs.existsSync(worktreeOf(dir))).toBe(true);
  });

  test('an existing directory is returned unchanged, with git not invoked at all', () => {
    const dir = repo();
    fs.mkdirSync(worktreeOf(dir), { recursive: true });
    const { result, calls } = counting(() => ensureWorktree(dir, TICKET_BRANCH));
    expect(result).toBe(worktreeOf(dir));
    expect(calls).toBe(0);
  });

  test('the exclusion is written before the worktree is added', () => {
    const dir = repo();
    const shim = installGitShim('case " $* " in *worktree*) exit 3 ;; esac');
    try {
      expect(() => ensureWorktree(dir, TICKET_BRANCH)).toThrow();
    } finally {
      shim.restore();
    }
    expect(fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8')).toContain('.harness/');
    expect(fs.existsSync(worktreeOf(dir)), 'the worktree add itself failed').toBe(false);
  });

  test('an existing branch is checked out, and nothing is created or reset', () => {
    const dir = withTicketBranch();
    const tip = git(dir, 'rev-parse', TICKET_BRANCH);
    const refsBefore = git(dir, 'for-each-ref', '--format=%(refname)', 'refs/heads');
    const worktree = ensureWorktree(dir, TICKET_BRANCH);
    expect(git(worktree, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(TICKET_BRANCH);
    expect(git(dir, 'rev-parse', TICKET_BRANCH)).toBe(tip);
    expect(git(dir, 'for-each-ref', '--format=%(refname)', 'refs/heads')).toBe(refsBefore);
  });

  test('an absent branch is created from the base when the base resolves', () => {
    const dir = repo();
    git(dir, 'checkout', '-q', '-b', 'release');
    commit(dir, 'release only');
    git(dir, 'checkout', '-q', 'main');
    const worktree = ensureWorktree(dir, TICKET_BRANCH, 'release');
    expect(git(worktree, 'rev-parse', 'HEAD')).toBe(git(dir, 'rev-parse', 'release'));
    expect(git(worktree, 'rev-parse', 'HEAD')).not.toBe(git(dir, 'rev-parse', 'main'));
  });

  test('an absent base, a null base and a base that does not resolve all start from HEAD', () => {
    // fanout.js:138 passes null, so null is not a hypothetical.
    for (const base of [undefined, null, 'no-such-base']) {
      const dir = repo();
      commit(dir, 'so HEAD is not the repository\'s only commit');
      const head = git(dir, 'rev-parse', 'HEAD');
      const worktree = ensureWorktree(dir, TICKET_BRANCH, base);
      expect(git(worktree, 'rev-parse', 'HEAD'), `base: ${base}`).toBe(head);
    }
  });

  test('the user\'s working tree is never written to, and the worktree root does not even show up', () => {
    const dir = repo();
    write(path.join(dir, 'src.txt'), 'the user\'s own file\n');
    commitAll(dir, 'user work');
    const head = git(dir, 'rev-parse', 'HEAD');
    const contents = fs.readFileSync(path.join(dir, 'src.txt'), 'utf8');

    ensureWorktree(dir, TICKET_BRANCH);

    expect(git(dir, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.readFileSync(path.join(dir, 'src.txt'), 'utf8')).toBe(contents);
    expect(git(dir, 'status', '--porcelain')).toBe('');
  });

  test('removeWorktree removes the worktree and keeps the branch', () => {
    const dir = repo();
    const worktree = ensureWorktree(dir, TICKET_BRANCH);
    expect(fs.existsSync(worktree)).toBe(true);
    removeWorktree(dir, TICKET_BRANCH);
    expect(fs.existsSync(worktree)).toBe(false);
    expect(git(dir, 'for-each-ref', '--format=%(refname:lstrip=2)', `refs/heads/${TICKET_BRANCH}`))
      .toBe(TICKET_BRANCH);
  });

  test('no directory means no removal command', () => {
    const dir = repo();
    const { calls } = counting(() => removeWorktree(dir, TICKET_BRANCH));
    expect(calls).toBe(0);
  });

  test('deleteBranch removes the branch afterwards, and a delete that fails is swallowed', () => {
    const dir = repo();
    ensureWorktree(dir, TICKET_BRANCH);
    removeWorktree(dir, TICKET_BRANCH, { deleteBranch: true });
    expect(git(dir, 'for-each-ref', '--format=%(refname:lstrip=2)', `refs/heads/${TICKET_BRANCH}`)).toBe('');

    // `main` is checked out in the repository itself, so `branch -D main` fails. It must not throw.
    expect(() => removeWorktree(dir, 'main', { deleteBranch: true })).not.toThrow();
    expect(git(dir, 'rev-parse', '--verify', '--quiet', 'refs/heads/main')).toBeTruthy();
  });
});

describe('AC-10 — ensureExcluded resolves the exclude file through git and never throws', () => {
  const excludeFile = (dir: string): string => {
    const resolved = git(dir, 'rev-parse', '--git-path', 'info/exclude');
    return path.isAbsolute(resolved) ? resolved : path.resolve(dir, resolved);
  };

  test('the first call appends and the second does not', () => {
    const dir = repo();
    ensureExcluded(dir, '.harness/');
    ensureExcluded(dir, '.harness/');
    const lines = fs.readFileSync(excludeFile(dir), 'utf8').split('\n');
    expect(lines.filter((line) => line === '.harness/')).toHaveLength(1);
  });

  test('a file without a trailing newline gains one, and an empty file gains no leading blank', () => {
    const noNewline = repo();
    fs.writeFileSync(excludeFile(noNewline), 'build');
    ensureExcluded(noNewline, '.harness/');
    expect(fs.readFileSync(excludeFile(noNewline), 'utf8')).toBe('build\n.harness/\n');

    const empty = repo();
    fs.writeFileSync(excludeFile(empty), '');
    ensureExcluded(empty, '.harness/');
    expect(fs.readFileSync(excludeFile(empty), 'utf8')).toBe('.harness/\n');
  });

  test('a pattern that is a prefix of an existing line is still appended', () => {
    const dir = repo();
    fs.writeFileSync(excludeFile(dir), '.harness/worktrees\n');
    ensureExcluded(dir, '.harness/');
    expect(fs.readFileSync(excludeFile(dir), 'utf8')).toBe('.harness/worktrees\n.harness/\n');
  });

  test('a linked worktree writes where git says, not where the layout is guessed', () => {
    const dir = repo();
    const worktree = ensureWorktree(dir, TICKET_BRANCH);
    ensureExcluded(worktree, 'scratch/');
    expect(fs.readFileSync(excludeFile(worktree), 'utf8')).toContain('scratch/');
  });

  test('a repository git cannot read produces one warning, not an exception', () => {
    const dir = notARepo();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      expect(() => ensureExcluded(dir, '.harness/')).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      const message = String(warn.mock.calls[0]?.[0]);
      expect(message, 'the warning names the pattern').toContain('.harness/');
      expect(message, 'and the best-known target path').toContain(path.join(dir, '.git', 'info', 'exclude'));
    } finally {
      warn.mockRestore();
    }
  });
});

// -------------------------------------------------------------------------------------------
// Q-0105 — pushLag
// -------------------------------------------------------------------------------------------
//
// Every fixture below builds its own remote, its own tracking ref and its own identity, so no
// verdict here is a property of this repository, of the checkout, or of the account running it
// ("A test's verdict is a property of the commit, not of the checkout or the account", 2026-08-30).
// That matters more than usual for this subject: the one fact under test is about a remote, and the
// checkout these tests run in has one.

/**
 * git's exit code for a fatal. Declared here rather than imported: the module keeps it private, and
 * a test that shared the constant with the code would agree with it about the one thing under test.
 */
const GIT_FATAL = 128;

/** A bare repository, which is what a remote is when nobody has to check anything out of it. */
function bareRemote(branch: string): string {
  const dir = tempDir('remote-');
  git(dir, 'init', '-q', '--bare', '-b', branch);
  return dir;
}

/**
 * A repository whose `branch` tracks `<remote>/<branch>` in a bare repository of its own, with
 * `local` further commits on top of the pushed tip.
 *
 * The remote is deliberately not called `origin` and the branch deliberately not `main`, so a
 * result that carried either name would have had to invent it. Nothing in this fixture depends on
 * git's `init.defaultBranch` or on the machine's configuration.
 */
function tracking(
  { remote = 'backup', branch = 'trunk', local = 0, remoteAhead = 0 } = {},
): string {
  const dir = tempDir('tracking-');
  git(dir, 'init', '-q', '-b', branch);
  commit(dir, 'shared history');
  git(dir, 'remote', 'add', remote, bareRemote(branch));
  git(dir, 'push', '-q', '-u', remote, branch);
  if (remoteAhead > 0) {
    // Moved on the remote side only, from a second clone that is then discarded — the repository
    // under test must not hold these commits anywhere but in its tracking ref. `git clone` names
    // its own remote `origin` whatever this fixture calls the one it is imitating.
    const other = tempDir('other-');
    git(other, 'clone', '-q', git(dir, 'remote', 'get-url', remote), other);
    for (let i = 0; i < remoteAhead; i += 1) commit(other, `theirs ${String(i)}`);
    git(other, 'push', '-q', 'origin', branch);
    git(dir, 'fetch', '-q', remote);
  }
  for (let i = 0; i < local; i += 1) commit(dir, `ours ${String(i)}`);
  // The fixture asserts its own topology, because every claim below is about telling one count from
  // another: if the divergence silently failed to happen, `ahead` and the symmetric difference
  // would be the same number and the discriminating tests would pass while discriminating nothing.
  const upstream = `refs/remotes/${remote}/${branch}`;
  expect(git(dir, 'rev-list', '--count', `refs/heads/${branch}..${upstream}`),
    'the fixture is not behind by what it was asked for').toBe(String(remoteAhead));
  expect(git(dir, 'rev-list', '--count', `${upstream}..refs/heads/${branch}`),
    'the fixture is not ahead by what it was asked for').toBe(String(local));
  return dir;
}

describe('Q-0105 AC-3 — every push-lag state is selected from an answer git gave', () => {
  test('outside a work tree there is no question, and the answer is null', () => {
    // git ANSWERED here: it exits 128 saying there is no repository, which is what `null` is for.
    // Its neighbour below — a probe that could not answer at all — is `git failed`, and the two are
    // told apart by git's exit code rather than by its prose, which a locale would decide.
    expect(pushLag(notARepo(), 'main')).toBeNull();
  });

  /**
   * The exit status git ended with, or `null` where it did not fail. The two fixtures below turn on
   * a refusal being indistinguishable from absence by exit code, and a test that asserted that by
   * reading the source would be establishing it by reading it (2026-08-29).
   */
  function statusOf(dir: string): number | null {
    try { git(dir, 'rev-parse', '--is-inside-work-tree'); return null; }
    catch (error) { return (error as { status?: number }).status ?? null; }
  }

  test('a repository git refuses to OPEN is `git failed`, and absence alone is silent', () => {
    // Round 2's review finding. git spends 128 on every fatal, so the code that says "there is no
    // repository" is the same one it says "there is a repository and I will not open it" with —
    // and reading it as absence rendered a refused repository as silence, which for a fact whose
    // success output is silence is the clean bill of health nobody earned.
    const refused = repo();
    git(refused, 'config', 'core.repositoryformatversion', '99');
    const absent = notARepo();

    // The premise, measured rather than asserted from the code: both fatal, with the same status.
    expect(statusOf(refused), 'the fixture opens fine, so it is not a refused repository')
      .toBe(GIT_FATAL);
    expect(statusOf(absent), 'the neighbour is not fatal, so the pair discriminates nothing')
      .toBe(GIT_FATAL);

    expect(pushLag(refused, 'main'), 'a repository git refused was reported as no repository')
      .toStrictEqual({ state: 'indeterminate', reason: 'git failed' });
    expect(pushLag(absent, 'main'), 'absence stopped being silent, which AC-10 forbids').toBeNull();
  });

  /**
   * Does this git honour `GIT_TEST_ASSUME_DIFFERENT_OWNER` — its own hook for staging a refused
   * repository without a second user account?
   *
   * Asked rather than assumed, because the answer is a property of the git BUILD and not of the
   * commit: measured on 2026-09-07, git 2.55.0 on darwin refuses and git 2.55.0 on `ubuntu-latest`
   * does not, same version string either side. A test that needed the hook therefore had a verdict
   * that turned on the machine, which is the one thing a verdict may not turn on — *"A test's
   * verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) — and it
   * was red on CI inside the sweep built to enforce that very rule.
   */
  function refusesForOwnership(dir: string): boolean {
    vi.stubEnv('GIT_TEST_ASSUME_DIFFERENT_OWNER', '1');
    try { return statusOf(dir) === GIT_FATAL; }
    finally { vi.unstubAllEnvs(); }
  }

  test('a repository git refuses to open for OWNERSHIP is `git failed` too', (ctx) => {
    // The review's other named cause, and it fails at a different moment — ownership is refused
    // during discovery, an unreadable format during setup — so one fixture does not stand in for
    // the other AS A FIXTURE. It does as COVERAGE: both reach `repositoryAt` and both must come
    // back `git failed`, and the format case above stages itself by writing a file, so it needs no
    // capability and runs everywhere. That is what makes the skip below a lost fixture rather than
    // a hole — if this ever becomes a permanent skip, `:705` is still the assertion that fails when
    // a refused repository is read as absence.
    const dir = repo();
    ctx.skip(!refusesForOwnership(dir),
      'this git build does not honour GIT_TEST_ASSUME_DIFFERENT_OWNER, so the subject cannot be '
      + 'staged here; the same code path is covered unconditionally by the repository-format case');

    vi.stubEnv('GIT_TEST_ASSUME_DIFFERENT_OWNER', '1');
    try {
      // The premise still holds inside the test, so a probe that passed and a run that does not
      // cannot be confused for one another.
      expect(statusOf(dir), 'the probe said this git refuses, and then it did not')
        .toBe(GIT_FATAL);
      expect(pushLag(dir, 'main')).toStrictEqual({ state: 'indeterminate', reason: 'git failed' });
    } finally {
      vi.unstubAllEnvs();
    }
    // And the refusal was the only thing between it and an answer: unstubbed, the same directory
    // reports an ordinary state, so the assertion above is about ownership and not about the fixture.
    expect(pushLag(dir, 'main')).toStrictEqual({ state: 'indeterminate', reason: 'no remote' });
  });

  test('a repository with no remotes is `no remote`, and never `pushed`', () => {
    // The state an adopter's freshly initialised project is in. It is an ANSWER — there is nowhere
    // the base could be ahead of — and it is not silence invented by the caller.
    expect(pushLag(repo(), 'main')).toStrictEqual({ state: 'indeterminate', reason: 'no remote' });
  });

  test('a base branch that does not resolve is `missing ref`', () => {
    expect(pushLag(tracking(), 'nosuchbranch'))
      .toStrictEqual({ state: 'indeterminate', reason: 'missing ref' });
  });

  test('a remote exists and the base tracks nothing: `no upstream`, not `pushed`', () => {
    const dir = repo();
    git(dir, 'remote', 'add', 'backup', bareRemote('main'));
    expect(pushLag(dir, 'main')).toStrictEqual({ state: 'indeterminate', reason: 'no upstream' });
  });

  test('truncated history is `shallow clone`, because the count could only be too small', () => {
    // A clone is the one fixture that arrives with a remote and a tracking ref already set up, so
    // this reaches the shallow branch through the same path a real shallow checkout would.
    const clone = shallowCloneOf(repo());
    expect(pushLag(clone, 'main')).toStrictEqual({ state: 'indeterminate', reason: 'shallow clone' });
  });

  /**
   * The fixture the four failure cases below share, built once on first use.
   *
   * Shared rather than rebuilt because building it costs about a dozen git spawns; **one test per
   * case** rather than one loop because four shim installations plus four probes in a single test
   * measured 3.5 s under the git-identity sweep's load against Vitest's 5-second default, and a
   * test that is merely near a timeout is a test whose verdict is a property of the machine — which
   * is what this file's own rules forbid, and the shape Q-0102 names. Splitting weakens no
   * assertion: the same four mutations run, each inside its own budget.
   */
  let diverged: string | undefined;
  const divergedRepo = (): string => (diverged ??= tracking({ local: 2 }));

  // The mutation AC-3 names, run against each step in turn. Every one of them is a failure INSIDE a
  // work tree, so every one of them is a reason — `rev-parse` included, which is round 1's first
  // review finding: a probe that could not answer used to be returned as `null` and rendered as
  // silence, which for a fact whose success output is silence is a clean bill of health nobody
  // earned. `null` is now reachable only from git's own "there is no repository here".
  const FAILING_STEPS: [string, PushLagResult | null][] = [
    ['remote', { state: 'indeterminate', reason: 'git failed' }],
    ['for-each-ref', { state: 'indeterminate', reason: 'git failed' }],
    ['rev-list', { state: 'indeterminate', reason: 'git failed' }],
    ['rev-parse', { state: 'indeterminate', reason: 'git failed' }],
  ];

  test.each(FAILING_STEPS)('breaking git %s is answered honestly, never as `pushed`', (subcommand, expected) => {
    // Built BEFORE the shim is installed. Inside `counting` the fixture's own `git remote add` runs
    // under the mutation and fails, which is a broken fixture wearing a failed assertion's clothes.
    const dir = divergedRepo();
    const { result } = counting(() => pushLag(dir, 'trunk'),
      `case "$1" in ${subcommand}) exit 3 ;; esac`);
    expect(result, `breaking git ${subcommand} did not produce the honest answer`)
      .toStrictEqual(expected);
  });

  // The three probes that are `rev-parse` invocations of their own, broken one at a time by matching
  // the WHOLE argv rather than the subcommand. Breaking `rev-parse` wholesale stops at the work-tree
  // probe, so without these the steps behind it have no subject — and two of the three are branches
  // where a broken git would otherwise be reported as a fact about the repository: an absent ref.
  const FAILING_PROBES: [string, string][] = [
    ['the shallow probe', 'rev-parse --is-shallow-repository'],
    ['the base ref check', 'rev-parse --verify --quiet refs/heads/trunk^{commit}'],
    ['the upstream ref check', 'rev-parse --verify --quiet refs/remotes/backup/trunk^{commit}'],
  ];

  test.each(FAILING_PROBES)('a probe that fails inside a confirmed work tree is `git failed` (%s)', (_name, argv) => {
    const dir = divergedRepo();
    const { result } = counting(() => pushLag(dir, 'trunk'), `case "$*" in "${argv}") exit 3 ;; esac`);
    expect(result, `breaking \`git ${argv}\` did not produce the honest answer`)
      .toStrictEqual({ state: 'indeterminate', reason: 'git failed' });
  });

  test('an upstream whose tracking ref is gone is `missing ref`, not `git failed`', () => {
    // Round 1's second review finding. The configuration outlives the ref: deleting
    // `refs/remotes/backup/trunk` leaves `branch.trunk.remote` and `.merge` in place, so
    // `%(upstream)` still names it — measured, it prints `refs/remotes/backup/trunk` and
    // `%(upstream:track)` prints `[gone]` — and only counting over it fails. A ref that does not
    // resolve is `missing ref`; reporting it as `git failed` blames the instrument for the subject.
    const dir = tracking({ local: 2 });
    git(dir, 'update-ref', '-d', 'refs/remotes/backup/trunk');
    expect(git(dir, 'for-each-ref', '--format=%(upstream)', 'refs/heads/trunk'),
      'the configuration went with the ref, so this fixture is `no upstream` and proves nothing')
      .toBe('refs/remotes/backup/trunk');
    expect(pushLag(dir, 'trunk')).toStrictEqual({ state: 'indeterminate', reason: 'missing ref' });
  });
});

describe('Q-0105 AC-6 — the count is upstream..base, and behind-only is not push lag', () => {
  test('two local commits against one remote commit report 2, never the symmetric difference', () => {
    // The discriminating topology: a symmetric-difference count would read 3, which is the shape
    // `containment`'s own ahead count is pinned with.
    expect(pushLag(tracking({ local: 2, remoteAhead: 1 }), 'trunk'))
      .toStrictEqual({ state: 'unpushed', ahead: 2, upstream: 'backup/trunk' });
  });

  test('a base that is only behind its upstream has nothing waiting, so it is `pushed`', () => {
    expect(pushLag(tracking({ remoteAhead: 3 }), 'trunk')).toStrictEqual({ state: 'pushed' });
  });

  test('a base level with its upstream is `pushed`, and carries no count', () => {
    expect(pushLag(tracking(), 'trunk')).toStrictEqual({ state: 'pushed' });
  });

  test('one unpushed commit is one, so nothing here has a floor above 1', () => {
    expect(pushLag(tracking({ local: 1 }), 'trunk'))
      .toStrictEqual({ state: 'unpushed', ahead: 1, upstream: 'backup/trunk' });
  });
});

describe('Q-0105 AC-4 and AC-5 — it reads, it never reaches the network, and it spells no name', () => {
  test('no git argv it issues can touch a remote, and the shim reads argv rather than source', () => {
    // A source scan for these verbs cannot tell a git argument from a function called `pushLag`,
    // and gets weaker every time something is renamed. This reads what git was actually handed.
    const dir = tracking({ local: 2 });
    const { args } = counting(() => pushLag(dir, 'trunk'));
    expect(args.length, 'the shim recorded nothing, so this proves nothing').toBeGreaterThan(0);
    for (const argv of args) {
      for (const verb of ['fetch', 'ls-remote', 'push', 'remote update']) {
        expect(argv.split(' ').join(' ').includes(verb),
          `pushLag issued a git command that reaches the network: git ${argv}`).toBe(false);
      }
    }
    // And `git remote` alone — which lists what is configured and asks nobody anything — is what it
    // does use, so the clause above is discriminating rather than vacuously true.
    expect(args.some((argv) => argv === 'remote'), 'the local remote probe is not being made').toBe(true);
  });

  test('it writes nothing: no ref moves and no file appears or vanishes', () => {
    const dir = tracking({ local: 2 });
    const refsBefore = git(dir, 'for-each-ref');
    const filesBefore = walk(dir);
    expect(pushLag(dir, 'trunk')?.state).toBe('unpushed');
    expect(git(dir, 'for-each-ref'), 'no ref may move').toBe(refsBefore);
    expect(walk(dir), 'no file may appear or vanish').toStrictEqual(filesBefore);
    expect(refsBefore, 'the fixture has no tracking ref, so half this claim is vacuous')
      .toContain('refs/remotes/backup/trunk');
  });

  test('the remote name comes out of git, so a repository that calls it something else renders that', () => {
    const named = pushLag(tracking({ remote: 'somewhere-else', branch: 'release', local: 1 }), 'release');
    expect(named).toStrictEqual({ state: 'unpushed', ahead: 1, upstream: 'somewhere-else/release' });
  });

  test('it costs seven spawns, and that is constant in the number of tickets', () => {
    // The measured half of `containment`'s revised budget sentence: 2n + 3 for the board's rows,
    // plus this, which does not move when n does. Pinned exactly rather than bounded, so that a
    // probe added or removed moves the number the JSDoc states instead of hiding inside a ceiling
    // — the budget is a sentence somebody reads, and a sentence nothing checks goes stale.
    const dir = tracking({ local: 2 });
    const { calls } = counting(() => pushLag(dir, 'trunk'));
    expect(calls, 'the longest path costs what the JSDoc says it costs').toBe(7);
    expect(counting(() => pushLag(repo(), 'main')).calls,
      'the cheap answers must not cost more than the expensive one').toBeLessThanOrEqual(7);
  });
});

describe('Q-0112 — configuredUser answers what git is configured to call this user, and nothing else', () => {
  // `GIT_CONFIG_COUNT` with its `GIT_CONFIG_KEY_*` pairs outranks every file — repository-local
  // included — and is what the identity sweep itself uses. Closed for EVERY test here, not only the
  // two that ask for nothing: an inherited pair naming `user.name` decided three of these five on
  // one machine and nowhere else, which running them under a hostile pair is what showed.
  beforeEach(() => { vi.stubEnv('GIT_CONFIG_COUNT', '0'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  /** A repository whose `user.name` is exactly `name`; `repo()` sets none of its own. */
  function named(name: string): string {
    const dir = repo();
    git(dir, 'config', 'user.name', name);
    return dir;
  }

  test('a configured name is returned as it is written', () => {
    expect(configuredUser(named('Ada Lovelace'))).toBe('Ada Lovelace');
  });

  test('surrounding whitespace is trimmed, because a name is what git holds and not how it is spaced', () => {
    expect(configuredUser(named('  Ada  '))).toBe('Ada');
  });

  test('a name that is only whitespace is NOT a name, and reads as unconfigured', () => {
    // The clause `'' || null` would miss: git stores the value, `--get` returns it, and a caller
    // that took it would attribute a ticket to a blank string.
    expect(configuredUser(named('   '))).toBeNull();
  });

  /**
   * The same isolation `.github/scripts/git-identity-sweep.sh` uses, and for the same reason.
   *
   * Unsetting `user.name` in the repository is NOT enough — `git config user.name` falls back to the
   * global file, so the first draft of the two tests below asserted `null` and got this developer's
   * own name. That is the behaviour we want (git's answer, wherever git found it) and a test premise
   * that was simply wrong, which running it is what caught.
   */
  function withNoConfiguredIdentity<T>(body: () => T): T {
    vi.stubEnv('GIT_CONFIG_GLOBAL', path.join(tempDir('q0112-absent-'), 'nothing-here'));
    vi.stubEnv('GIT_CONFIG_SYSTEM', '/dev/null');
    // `GIT_CONFIG_COUNT` is already `0` from the `beforeEach`; these two are what the FILES add.
    // The isolation is then proven rather than assumed, which is the sweep's own discipline.
    expect(configuredUser(repo()), 'the git-identity stubs did not take').toBeNull();
    return body();
  }

  test('a name configured nowhere at all is null rather than a fallback', () => {
    const dir = repo();
    expect(withNoConfiguredIdentity(() => configuredUser(dir))).toBeNull();
  });

  test('and a directory that is not a repository is null too, rather than throwing', () => {
    // `ticket.ts` calls this on the way to writing a ticket, so a throw here would turn "git has no
    // opinion" into a crash on the command's own path. Isolated for the same reason: outside a
    // repository git still answers from the global file.
    expect(withNoConfiguredIdentity(() => configuredUser(notARepo()))).toBeNull();
  });
});
