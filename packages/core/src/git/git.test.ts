// Q-0042: worktrees, ancestry and containment, asserted against real git.
//
// The independent witness here is git itself, not the spike's suite — both suites can be green
// over a wrong port (harness/port-charter.md §2), because a test ported alongside a mis-ported
// module agrees with it. So every case below builds the repository, the topology and the shallow
// state it asserts, and no case asserts the containment state of a branch in THIS repository.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import {
  ancestry, containment, emptyRangeEvidence, ensureExcluded, ensureWorktree, removeWorktree,
  shallowState, shortSha,
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

  test('a value that is not a string, and a name that is not a local branch, render unannotated', () => {
    const derived = containment(withTicketBranch(), 'main');
    expect(derived).not.toBeNull();
    for (const value of [undefined, null, 42, {}, ['main'], 'never/created']) {
      expect(derived?.stateOf(value), JSON.stringify(value ?? null)).toBeNull();
    }
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
  test('injection-shaped values return null and spawn nothing', () => {
    const dir = withTicketBranch();
    const derived = containment(dir, 'main');
    const hostile = ['--upload-pack=touch pwned', 'main; echo hi', '../../../etc/passwd'];
    const { result, calls } = counting(() => hostile.map((value) => derived?.stateOf(value)));
    expect(result).toEqual([null, null, null]);
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
