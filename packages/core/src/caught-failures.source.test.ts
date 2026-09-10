// Q-0115 AC-2 and AC-3 — the census of caught git failures, as a register that fails when a new one
// is added unclassified.
//
// **The predicate is *a git invocation whose failure is caught*, and never *a call to `safe()`*.**
// That distinction is the finding this file exists to carry. Decision 088's own census enumerated
// `safe()` call sites — twenty-four of them, thirteen collapsing, both numbers exactly right for the
// predicate it named — and that key is blind to six hand-written `catch` blocks in `git/git.ts`, one
// of which collapsed: `containment`'s work-tree probe, `catch { return null; }`, which made
// `packages/cli/src/board.ts` render EVERY row with no containment token at all, indistinguishably
// from a directory that is not a repository. A register keyed on the primitive's name cannot see the
// site that most needs it, which is the fail-open shape this repository has now shipped six times
// (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108, and that one). Nothing decision 088 states is false; the
// predicate was too narrow, and the ruling is the part an entry is for.
//
// See *"A probe that could not answer is not a negative"* (2026-09-10). The rule it states —
// `safe()` is correct wherever the caller's question cannot tell its two inputs apart, and wrong
// wherever the caller acts differently on them — is what the `disposition` column below records, one
// site at a time.
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { coreSourceFiles, repoFile, repoRoot } from '../test/corpus.js';

// ---------------------------------------------------------------------------------------------
// The scanner
// ---------------------------------------------------------------------------------------------

/** What a caller does with a caught git failure, which is decision 088's question. */
const DISPOSITIONS = ['distinguish', 'propagate', 'best-effort', 'collapses'] as const;

type Disposition = (typeof DISPOSITIONS)[number];

/** One place a git invocation's failure is caught, identified by what the tree says rather than by a line. */
interface Site {
  /** The corpus key — `git/git.ts`, never a bare filename. */
  readonly file: string;
  /** The nearest preceding top-level declaration: the function the site belongs to. */
  readonly fn: string;
  /** Which half of the predicate found it, so the two can be shown to fail separately. */
  readonly half: 'safe' | 'catch';
  /** The site's own line, whitespace-normalised. Edit the line and the identity changes. */
  readonly text: string;
}

/** How a site is written down: file, function and the line itself, so nothing is keyed by a number. */
const identify = (site: Site): string => `${site.file} ${site.fn}: ${site.text}`;

/**
 * `text` with every block comment blanked to spaces, so prose is not scanned as code.
 *
 * Line comments are deliberately left: `//` inside a string literal would make a line-comment
 * blanker eat real code, and the site rules below already refuse a `catch` that is neither at the
 * start of its line nor preceded by a closing brace. Blanking rather than deleting keeps every
 * offset, so a line number reported in a failure still points where a reader can look.
 */
const withoutBlockComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));

/** The top-level declarations of a file, as `[line index, name]`, in source order. */
function declarations(lines: readonly string[]): [number, string][] {
  const found: [number, string][] = [];
  lines.forEach((line, index) => {
    const declared = /^(?:export\s+)?(?:async\s+)?(?:function|const|let|class|interface|type)\s+([A-Za-z_$][\w$]*)/
      .exec(line);
    if (declared?.[1] !== undefined) found.push([index, declared[1]]);
  });
  return found;
}

/** A git invocation: a call to a module's own runner, or the one place a runner is spelled inline. */
const INVOKES_GIT = /\bgit\(\[|execFileSync\('git'/;

/**
 * Every site in one file where a git invocation's failure is caught.
 *
 * Both halves of the predicate, because neither sees the other: a scan written for `safe(` cannot
 * see a `catch`, and one written for `catch` cannot see a `safe(`. `safe()`'s own declaration is
 * excluded by name — it is the primitive rather than a call site, and AC-3 registers it separately —
 * and that exclusion is asserted to be load-bearing rather than assumed.
 *
 * **The subject is a GIT failure**, which is what bounds this to two modules rather than to every
 * `catch` in the package: a `safe(` site qualifies where its own line invokes git, and a `catch`
 * where its enclosing declaration does. The second is deliberately the coarser test — a function
 * holding a git invocation and an unrelated `catch` is over-collected, which costs a register entry
 * saying so and never a site silently dropped. Tracking each `try` back to its own block would be
 * the precise rule and buys nothing here: measured against this tree, the coarse one selects exactly
 * the functions that probe git.
 *
 * @throws {Error} when a site has no enclosing top-level declaration, rather than skipping it: a
 *   scanner that quietly drops what it cannot place is the fail-open shape this file is about.
 */
function sitesIn(file: string, source: string): Site[] {
  const lines = withoutBlockComments(source).split('\n');
  const declared = declarations(lines);
  const enclosing = (index: number): string => {
    const found = [...declared].reverse().find(([at]) => at <= index);
    if (found === undefined) {
      throw new Error(`${file}:${String(index + 1)} catches a failure outside any declaration, so it cannot be classified`);
    }
    return found[1];
  };
  const probesGit = (fn: string): boolean => INVOKES_GIT.test(bodyOf(source, fn));
  /**
   * The `safe(` call starting at `index`, joined until its parentheses balance.
   *
   * The predicate read one physical line until 2026-09-11, so `safe(() =>\n  git([…]))` — the same
   * call under a formatter that wrapped it — was invisible, and a caught git failure could be added
   * with no register entry while this census stayed green. Reported by the cross-vendor review of
   * this ticket's own change: the fail-open shape, in the register written to close it.
   */
  const statementAt = (index: number): string => {
    let depth = 0;
    let text = '';
    for (let at = index; at < lines.length && at < index + 12; at += 1) {
      const line = lines[at] ?? '';
      text += ` ${line}`;
      for (const ch of line) {
        if (ch === '(') depth += 1;
        else if (ch === ')') depth -= 1;
      }
      if (at > index || depth <= 0) { if (depth <= 0) break; }
    }
    return text;
  };
  return lines.flatMap((line, index): Site[] => {
    const isSafe = line.includes('safe(') && INVOKES_GIT.test(statementAt(index));
    const isCatch = /(?:^|\})\s*catch\b/.test(line);
    if (!isSafe && !isCatch) return [];
    const fn = enclosing(index);
    // The primitive's own body, which is what AC-3 registers by identity instead.
    if (fn === 'safe') return [];
    const text = line.trim().replace(/\s+/g, ' ');
    return [
      ...(isSafe ? [{ file, fn, half: 'safe' as const, text }] : []),
      ...(isCatch && probesGit(fn) ? [{ file, fn, half: 'catch' as const, text }] : []),
    ];
  });
}

/** Every site across a corpus, as `[relative path, text]` pairs. */
const sitesAcross = (corpus: readonly (readonly [string, string])[], prefix = ''): Site[] =>
  corpus.flatMap(([name, text]) => sitesIn(`${prefix}${name}`, text));

/** The text of one top-level declaration, from its own line to the next one, comments and all. */
function bodyOf(source: string, fn: string): string {
  const lines = withoutBlockComments(source).split('\n');
  const declared = declarations(lines);
  const at = declared.findIndex(([, name]) => name === fn);
  if (at === -1) throw new Error(`no top-level declaration named ${fn}`);
  const next = declared[at + 1]?.[0] ?? lines.length;
  return source.split('\n').slice(declared[at]![0], next).join('\n');
}

/**
 * {@link bodyOf} with its prose taken out: block comments blanked, whole-line `//` comments dropped.
 *
 * What a {@link Classified.becomes} fragment is matched against, so that a register entry cannot be
 * satisfied by a sentence describing the code instead of by the code. The bound, stated: a TRAILING
 * `//` comment survives, because blanking one means deciding whether a `//` sits inside a string
 * literal and this file is not a lexer — so a fragment can still match a remark on a line of code,
 * which is adjacent to a real site rather than anywhere in the file.
 */
const codeOf = (source: string, fn: string): string => withoutBlockComments(bodyOf(source, fn))
  .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

// ---------------------------------------------------------------------------------------------
// AC-2 — the register
// ---------------------------------------------------------------------------------------------

/** One classified site: what the failure becomes, quoted from the tree, and why that is right. */
interface Classified {
  readonly disposition: Disposition;
  /**
   * A verbatim fragment of the enclosing function that DOES what `disposition` claims.
   *
   * Required to appear in that function's own text, which is what stops the classification drifting
   * from the code: a hand edit to the clause that turns the failure into an answer fails this
   * register rather than leaving it describing code that is gone. It is not a parse and does not
   * pretend to be one — a WRONG classification is still possible, a STALE one is not.
   */
  readonly becomes: string;
  /** One sentence: what a caught failure becomes here, and why that is right or merely registered. */
  readonly reason: string;
}

/**
 * Every site in `packages/core/src` where a git invocation's failure is caught.
 *
 * **No assertion below reads a total.** The census rotted twice before this file existed — 23 on
 * 2026-09-07, 24 on 2026-09-08 when Q-0112 added `configuredUser`, and again when the predicate
 * widened from `safe()` to a caught failure — so a criterion resting on a count is one a correct
 * addition turns red. This is a register of identities (Q-0073), and its arithmetic is nobody's.
 *
 * `fanout/fanout.ts` was classified and **not repaired** when this landed: that half was Q-0074's,
 * which keeps the id because a landed entry cites it by name against those functions. **Q-0074 has
 * since moved all seven of its collapsing rows**, which is what this register was left as — a
 * forcing function rather than a description, since a repair that did not move its own row's
 * `disposition` and `becomes` left this guard red. Its authority lines live in that module and are
 * pinned by `fanout/fanout.source.test.ts`; the citation rule below stays scoped to `git/git.ts`,
 * which is where this ticket's own retained collapses are.
 */
const REGISTER: Record<string, Classified> = {
  // -------------------------------------------------------------------------------------------
  // packages/core/src/git/git.ts — this ticket's half
  // -------------------------------------------------------------------------------------------
  "git/git.ts ancestry: catch (error) {": {
    disposition: 'distinguish',
    becomes: 'exitStatus(error) !== 1',
    reason: 'Any exit that is not git\'s own 1 is `git failed`, so "not contained" is never inferred from a failure — the containment decision of 2026-08-24, and Q-0035, which removed the engine-side catch that did.',
  },
  "git/git.ts configuredUser: const name = safe(() => git(['config', 'user.name'], dir))?.trim();": {
    disposition: 'propagate',
    becomes: 'return name ? name : null;',
    reason: 'Decision 088\'s worked example of the CORRECT case: *git could not run* and *nobody configured a name* both honestly mean nobody said, and the policy is `packages/cli`\'s `ticket.ts` — "A ticket\'s owner is supplied, never guessed" (2026-09-08).',
  },
  "git/git.ts containment: catch (error) { return workTreeFailure(error, repoDir) === 'outside' ? null : UNANSWERABLE; }": {
    disposition: 'distinguish',
    becomes: "workTreeFailure(error, repoDir) === 'outside' ? null : UNANSWERABLE",
    reason: 'Q-0115\'s second repair, and the site no `safe()`-keyed census could see: `catch { return null; }` made `board.ts`\'s `where?.stateOf(…)` undefined, so EVERY row rendered with no token at all, indistinguishably from a directory that is not a repository.',
  },
  "git/git.ts containment: const ahead = safe(() => git(['rev-list', '--count', `refs/heads/${base}..refs/heads/${branch}`], repoDir));": {
    disposition: 'distinguish',
    becomes: "if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };",
    reason: 'A count that could not be read is `git failed`, never an ahead of zero and never a containment claim.',
  },
  "git/git.ts containment: const listed = safe(() => git(['for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads'], repoDir));": {
    disposition: 'distinguish',
    becomes: "if (branches === null) return { state: 'indeterminate', reason: 'git failed' };",
    reason: 'Q-0115\'s headline repair: the `?? \'\'` that stood here emptied the branch set, so one failed `for-each-ref` answered `no branch` for every ticket in the backlog — a state the glossary defines as "git was never asked".',
  },
  "git/git.ts currentBranch: const name = safe(() => git(['branch', '--show-current'], dir));": {
    disposition: 'propagate',
    becomes: "return name === null || name === '' ? null : name;",
    reason: 'Its own JSDoc says the empty string, an unborn HEAD, a detached HEAD and a broken GIT_DIR are all "cannot name a branch" for its one caller, which scaffolds a project — a question that cannot tell them apart.',
  },
  "git/git.ts emptyRangeEvidence: const leftTree = safe(() => git(['rev-parse', `${left}^{tree}`], repoDir));": {
    disposition: 'distinguish',
    becomes: 'leftTree && rightTree ? leftTree === rightTree : null',
    reason: 'A tree that could not be read makes `sameTree` null rather than false, so the diagnostic claims nothing about trees it could not compare (Q-0035).',
  },
  "git/git.ts emptyRangeEvidence: const rightTree = safe(() => git(['rev-parse', `${right}^{tree}`], repoDir));": {
    disposition: 'distinguish',
    becomes: 'leftTree && rightTree ? leftTree === rightTree : null',
    reason: 'The right endpoint\'s half of the same comparison, and the same null.',
  },
  'git/git.ts ensureExcluded: } catch (error) {': {
    disposition: 'best-effort',
    becomes: 'console.warn(',
    reason: 'The exclusion is a courtesy to the user\'s `git status` and nothing downstream claims it happened; the failure is recorded rather than swallowed, naming the pattern and the best-known target path.',
  },
  "git/git.ts ensureWorktree: const baseExists = base ? safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${base}`], repoDir)) : null;": {
    disposition: 'collapses',
    becomes: "base && baseExists ? base : 'HEAD'",
    reason: 'Registered and NOT repaired (Q-0115 NG-3): a failed base probe silently cuts the worktree from HEAD, which is the one place a probe failure changes where an agent writes. Q-0038\'s closing entry names it a non-goal with its reasons — another module, it governs fan-out task bases too, and throw-warn-or-which-callers is unasked.',
  },
  "git/git.ts ensureWorktree: const branchExists = safe(() => git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repoDir));": {
    disposition: 'collapses',
    becomes: 'if (branchExists) {',
    reason: 'Registered and NOT repaired (Q-0115 NG-4): it collapses and then FAILS LOUDLY — `worktree add -b` throws on a branch that exists — so no false claim survives the call.',
  },
  "git/git.ts mergeBase: return safe(() => git(['merge-base', a, b], repoDir));": {
    disposition: 'propagate',
    becomes: "return safe(() => git(['merge-base', a, b], repoDir));",
    reason: 'Its own JSDoc says it deliberately does not tell a ref that does not exist from the other reasons; the value is read for the revision it names, in an evidence line, and an absent revision is an absent line.',
  },
  "git/git.ts pushLag: const ahead = safe(() => git(['rev-list', '--count', `${upstreamRef}..${baseRef}`], repoDir));": {
    disposition: 'distinguish',
    becomes: "if (ahead == null) return { state: 'indeterminate', reason: 'git failed' };",
    reason: 'Every push-lag state is selected from an answer git gave, and none of them reaches `pushed`.',
  },
  "git/git.ts pushLag: const remotes = safe(() => git(['remote'], repoDir));": {
    disposition: 'distinguish',
    becomes: "if (remotes == null) return { state: 'indeterminate', reason: 'git failed' };",
    reason: 'A failed remote probe is `git failed`, held apart from the empty output that is `no remote` — an answer rather than a failure.',
  },
  "git/git.ts pushLag: const tracking = safe(() => git(['for-each-ref', '--format=%(upstream) %(upstream:short)', baseRef], repoDir));": {
    disposition: 'distinguish',
    becomes: "if (tracking == null) return { state: 'indeterminate', reason: 'git failed' };",
    reason: 'Held apart from the empty `%(upstream)` that is `no upstream`, which is git answering that the base tracks nothing.',
  },
  "git/git.ts removeWorktree: if (deleteBranch) safe(() => git(['branch', '-D', branch], repoDir));": {
    disposition: 'best-effort',
    becomes: 'if (deleteBranch) safe(',
    reason: 'The caller is cleaning up after itself, the function returns nothing, and a delete that fails changes nothing anyone goes on to claim — `branch -D main` fails while main is checked out, which is ordinary.',
  },
  "git/git.ts repositoryAt: catch (error) { return errorProperty(error, 'code') === 'ENOENT' ? 'absent' : 'failed'; }": {
    disposition: 'distinguish',
    becomes: "=== 'ENOENT' ? 'absent' : 'failed'",
    reason: 'The filesystem half of the probe, and the only one that can prove absence: `ENOENT` is absence and every other errno is the inspection failing, which is never reported as absence either.',
  },
  "git/git.ts repositoryAt: if (safe(() => git(['rev-parse', '--resolve-git-dir', gitDir], repoDir)) != null) return 'present';": {
    disposition: 'distinguish',
    becomes: 'try { fs.lstatSync(gitDir); return \'present\'; }',
    reason: 'The `!= null` reads as a collapse and is not one: git\'s failure falls through to a second question rather than becoming an answer, which is exactly what decision 088 asks a caller to do with one.',
  },
  'git/git.ts resolvesToCommit: catch (error) { return exitStatus(error) === 1 ? false : null; }': {
    disposition: 'distinguish',
    becomes: 'exitStatus(error) === 1 ? false : null',
    reason: '`false` only on git\'s own documented "no such ref" exit of 1; `null` for any other reason, so a broken git is never reported as an absent ref.',
  },
  'git/git.ts shallowState: catch (error) { return { shallow: null, detail: failureDetail(error) }; }': {
    disposition: 'distinguish',
    becomes: '{ shallow: null, detail: failureDetail(error) }',
    reason: '`null` is "could not ask" and not `false`, because reading an unanswered shallow probe as "not shallow" hands back a confident negative through the side door (Q-0035).',
  },
  'git/git.ts shortSha: catch (error) {': {
    disposition: 'distinguish',
    becomes: "? { state: 'no-such-ref', sha: null, detail: null }",
    reason: 'Q-0115 AC-9: the third of this ticket\'s repairs. Both consumers in `engine/diff.ts` read the old `null` as "the ref is not there", so a probe that failed stopped a run naming `repo.base_branch`, `--base` or an earlier step for a ref that may be perfectly present.',
  },
  'git/git.ts workTreeProbe: catch (error) { return workTreeFailure(error, repoDir); }': {
    disposition: 'distinguish',
    becomes: 'return workTreeFailure(error, repoDir);',
    reason: 'Three answers rather than a boolean, and the one `pushLag` renders: `outside` is silence and is reached only where absence is proven, so a probe that could not answer never renders as a clean bill of health.',
  },

  // -------------------------------------------------------------------------------------------
  // packages/core/src/fanout/fanout.ts — Q-0074's half, repaired there
  // -------------------------------------------------------------------------------------------
  //
  // These rows were `collapses` and unrepaired when this file landed, because that half was the
  // successor's: "What a run's event stream carries" (2026-08-28) cites Q-0074 by name against these
  // functions and `engine/composite.ts` said "Q-0074 owns it". Q-0074 moved them, which is the
  // register working as the forcing function it was left as rather than as a description — every
  // repair had to move its own row's `disposition` and `becomes` or this guard stayed red.
  //
  // The three that keep `safe()` keep it because the exit code answers nothing there and something
  // ELSE does: a status read, or a probe for a merge in progress. That is decision 088's own rule
  // rather than an exception to it — the primitive is not the defect.
  "fanout/fanout.ts backlogChanges: catch (error) {": {
    disposition: 'distinguish',
    becomes: 'throw new IntegrationError(',
    reason: 'Q-0074 AC-9, and decision 088\'s third unnamed site: the `?? \'\'` this replaces read a failed status probe as a clean `backlog/`, so no revert ran, `onDiscard` never fired, and `git add -A` committed the agent\'s edit to a ticket\'s frontmatter. Response 1 — the next act is a commit, which is not undoable by the caller.',
  },
  "fanout/fanout.ts branchHead: catch (error) {": {
    disposition: 'distinguish',
    becomes: "? { state: 'no-such-ref', sha: null, detail: null }",
    reason: 'Decision 088\'s worked example of the WRONG case, repaired: `finish()` reads this to decide whether to roll the ticket branch back, so *the branch is absent* and *git could not be asked* lead to different actions — and collapsing them let a failed run silently keep whatever integrate merged.',
  },
  "fanout/fanout.ts branchProbe: catch (error) { return exitStatus(error) === 1 ? 'absent' : 'failed'; }": {
    disposition: 'distinguish',
    becomes: "exitStatus(error) === 1 ? 'absent' : 'failed'",
    reason: 'Q-0074 AC-4. `--verify --quiet` exits 1 for a ref that is not there and that exit alone is `absent`; the renaming from `branchExists` is what made each of its six consumers a compile error, since neither `if (!x)` nor a filter predicate is a type error under any three-answer shape.',
  },
  "fanout/fanout.ts commitAll: safe(() => git(['checkout', '--', 'backlog'], dir)); // revert tracked edits": {
    disposition: 'best-effort',
    becomes: "const left = backlogChanges(dir, 'after reverting it');",
    reason: 'Q-0074 AC-10. Its exit code is not read because it answers nothing — `checkout -- backlog` legitimately fails where the only edit is a file the agent ADDED, which the clean beside it removes — so the status read below is what establishes the revert, and `onDiscard` fires only once it has.',
  },
  "fanout/fanout.ts commitAll: safe(() => git(['clean', '-qfd', '--', 'backlog'], dir)); // drop files the agent added": {
    disposition: 'best-effort',
    becomes: "const left = backlogChanges(dir, 'after reverting it');",
    reason: 'The second half of that same revert, judged by the same outcome — and symmetrically, `clean` has nothing to do where the only edit is a tracked one the checkout reverted.',
  },
  "fanout/fanout.ts mergeInto: const listed = safe(() => git(['diff', '--name-only', '--diff-filter=U'], dir));": {
    disposition: 'distinguish',
    becomes: 'listed === null ? null : listed.split',
    reason: 'Q-0074 AC-12. The `?? \'\'` this replaces read a failed probe as no conflicting paths, so a `MergeResult` saying `ok: false` named none of them and the caller was told a conflict has no files; `null` is now an unread list and `mergeFailure` says so rather than saying there were none.',
  },
  "fanout/fanout.ts mergeInto: safe(() => git(['merge', '--abort'], dir));": {
    disposition: 'best-effort',
    becomes: "const merging = branchHead(dir, 'MERGE_HEAD');",
    reason: 'Q-0074 AC-12, and the one place reading an exit code would have been the SAME defect in the other direction: an abort fails when there was no merge to abort, so its status would report a dirty worktree over a clean one. The probe below answers instead, and `worktreeClean` carries it.',
  },
  'fanout/fanout.ts mergeInto: } catch (e) {': {
    disposition: 'distinguish',
    becomes: 'ok: false,',
    reason: 'The merge failing is a RESULT rather than a throw, and the caller decides on it — the one caught failure in this module that already carried its own state before Q-0074 touched it.',
  },
  "fanout/fanout.ts resetBranchTo: if (fs.existsSync(dir)) { git(['reset', '--hard', sha], dir); safe(() => git(['clean', '-qfd'], dir)); }": {
    disposition: 'best-effort',
    becomes: "safe(() => git(['clean', '-qfd'], dir))",
    reason: 'The claim this function makes is that the branch is back at `sha`, and the unwrapped `reset --hard` beside it is what makes that true or throws; a failed clean leaves untracked files and moves no claim.',
  },
};

describe('Q-0115 AC-2 — every caught git failure is classified, and a new one fails until it is', () => {
  const corpus = (): Site[] => sitesAcross(coreSourceFiles());
  const source = (file: string): string =>
    coreSourceFiles().find(([name]) => name === file)?.[1]
      ?? ((): never => { throw new Error(`corpus missing: packages/core/src/${file}`); })();

  test('the register names exactly the sites the tree holds', () => {
    const found = corpus().map(identify).sort();
    // A duplicate identity would let one entry silently cover two sites, which is the register
    // failing open in the one way a `toStrictEqual` cannot show. It stops rather than disambiguating
    // by position: an ordinal within a function rots exactly as a line number does.
    expect(found, 'two sites share an identity, so one register entry answers for both')
      .toStrictEqual([...new Set(found)]);
    expect(found).toStrictEqual(Object.keys(REGISTER).sort());
  });

  test('and each classification still describes the code, because it quotes it', () => {
    // What stops the register drifting from the tree. The identity above pins the site's own line;
    // this pins the clause that turns the failure into an answer, which is usually somewhere else in
    // the function — so an edit to EITHER fails here. It is not a parse and does not pretend to be
    // one: a wrong classification is still possible, a stale one is not.
    for (const site of corpus()) {
      const entry = REGISTER[identify(site)]!;
      expect(DISPOSITIONS as readonly string[], `${identify(site)}: unknown disposition`)
        .toContain(entry.disposition);
      expect(entry.reason.length, `${identify(site)}: a classification with no reason`).toBeGreaterThan(40);
      expect(codeOf(source(site.file), site.fn), `${identify(site)}: \`becomes\` no longer appears in ${site.fn}`)
        .toContain(entry.becomes);
    }
  });

  test('a catch that does not bind the error cannot be classified as telling two failures apart', () => {
    // The one clause here that is DERIVED rather than transcribed, and it is the clause that would
    // have caught `containment`'s bare `catch { return null; }` on the day it was written: a catch
    // with no binding has not looked at what it caught, so it cannot have told two of them apart.
    for (const site of corpus()) {
      if (site.half !== 'catch' || /catch\s*\(/.test(site.text)) continue;
      expect(REGISTER[identify(site)]!.disposition,
        `${identify(site)}: a catch that discards the error claims to distinguish two failures`)
        .not.toBe('distinguish');
    }
  });

  test('every collapse this ticket leaves in git.ts carries one line naming its authority', () => {
    // AC-1. Scoped to `git/git.ts`, which is this ticket's half: `fanout/fanout.ts`'s citations are
    // Q-0074's, whose landed entry cites it by name against those functions.
    const collapsing = corpus().filter((site) => site.file === 'git/git.ts'
      && REGISTER[identify(site)]!.disposition === 'collapses');
    expect(collapsing.length, 'no collapse is registered in git.ts, so this clause has no subject')
      .toBeGreaterThan(0);
    for (const site of collapsing) {
      expect(bodyOf(source(site.file), site.fn), `${site.fn} retains a collapse and cites no authority`)
        .toMatch(/Why: /);
    }
  });

  test('the scan sees both halves of its own predicate, in both modules', () => {
    // Neither half sees the other, and a register that has silently lost one would go on passing
    // over the sites the survivor happens to reach. No clause here reads a total: the census rotted
    // twice on its way to this file, and once more when the predicate widened.
    const found = corpus();
    for (const file of ['git/git.ts', 'fanout/fanout.ts']) {
      for (const half of ['safe', 'catch'] as const) {
        expect(found.filter((site) => site.file === file && site.half === half).length,
          `the scan found no ${half} site in ${file}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Q-0115 AC-2 — and the register is shown to fail, on each half of the predicate separately', () => {
  // A register keyed on one spelling passes over the other while reading as coverage, which is the
  // whole finding this file carries. So both halves are demonstrated red HERE, over a corpus this
  // test builds, rather than described in a report: the scanner takes its corpus as an argument for
  // exactly the reason `test/corpus.ts` grew the same seam — "a guard that cannot fire is the defect
  // this ticket exists to prevent".

  /** A module shaped like the two real ones: its own runner, and whatever `body` adds. */
  const module = (body: string): [string, string][] => [['probe/probe.ts', [
    "const git = (args: readonly string[], cwd: string): string => execFileSync('git', args, { cwd });",
    'const safe = <T>(fn: () => T): T | null => {',
    '  try { return fn(); } catch { return null; }',
    '};',
    '',
    body,
  ].join('\n')]];

  const unregistered = (corpus: readonly (readonly [string, string])[]): string[] =>
    sitesAcross(corpus).map(identify).filter((key) => !(key in REGISTER));

  test('a `safe()` added to a git module is reported, by name', () => {
    const found = unregistered(module([
      'export function probe(repo: string): boolean {',
      "  return safe(() => git(['rev-parse', 'HEAD'], repo)) != null;",
      '}',
    ].join('\n')));
    expect(found).toStrictEqual(["probe/probe.ts probe: return safe(() => git(['rev-parse', 'HEAD'], repo)) != null;"]);
  });

  test('a bare `catch { return null; }` is reported too, and its signature is a DIFFERENT one', () => {
    // The site decision 088's own census could not see. The two failures name different lines and
    // different halves, so a register that had quietly lost the `catch` half could not pass on the
    // strength of the `safe(` half — which is what "distinct signatures" has to mean to be worth
    // asserting (Q-0107: a guard shown red only by its neighbour has not been established).
    const found = unregistered(module([
      'export function probe(repo: string): string | null {',
      "  try { return git(['rev-parse', 'HEAD'], repo); }",
      '  catch { return null; }',
      '}',
    ].join('\n')));
    expect(found).toStrictEqual(['probe/probe.ts probe: catch { return null; }']);
    expect(found[0], 'the two halves report the same thing, so one stands in for the other')
      .not.toContain('safe(');
  });

  test('a `catch` written in PROSE is not a site, so the scan is not satisfied by a comment', () => {
    expect(unregistered(module([
      '/**',
      ' * Q-0035 removed an engine-side `catch { return false }` that inferred a negative.',
      ' */',
      'export function probe(repo: string): string {',
      "  return git(['rev-parse', 'HEAD'], repo);",
      '}',
    ].join('\n')))).toStrictEqual([]);
  });

  test('a catch in a module that never invokes git is not this register\'s business', () => {
    // The predicate is a GIT failure. Without this clause the register would demand a classification
    // for every `catch` in the package — twenty-odd of them around `fs` calls and JSON parses — and
    // a register that asks for more than it is about is one nobody keeps accurate.
    expect(unregistered([['probe/other.ts', [
      'export function readIt(file: string): string | null {',
      '  try { return fs.readFileSync(file, \'utf8\'); }',
      '  catch { return null; }',
      '}',
    ].join('\n')]])).toStrictEqual([]);
  });

  test('a site the scanner cannot place stops it, rather than being dropped', () => {
    expect(() => sitesAcross([['probe/loose.ts', "  try { git(['x'], '.'); } catch { }"]]))
      .toThrow(/cannot be classified/);
  });
});

// ---------------------------------------------------------------------------------------------
// AC-3 — `safe()` is declared twice, and a third is a visible act
// ---------------------------------------------------------------------------------------------

/**
 * The two production files that declare the `safe()` primitive, and why each keeps its own.
 *
 * A register of identities rather than a count (Q-0073), in `backlog.source.test.ts`'s
 * `REALPATH_SITES` shape: a THIRD declaration fails here, which is what makes the next one a visible
 * act rather than the state Q-0074 was opened on — one primitive declared byte-for-byte twice, with
 * nobody's attention on either copy. They are **not unified** (Q-0115 NG-1): `fanout.ts` keeps its
 * own git runner on a recorded argument, and the same argument covers the helper beside it.
 */
const SAFE_DECLARATIONS: Record<string, string> = {
  'packages/core/src/git/git.ts':
    'the git module\'s own, beside the runner every git call in `core` goes through — a landed guard permits `merge-base` in this file alone, so the runner cannot move and neither can the helper wrapping it',
  'packages/core/src/fanout/fanout.ts':
    'the fan-out module\'s own, beside its own runner, which `fanout.source.test.ts` pins as a deliberate second one (Q-0048) — the duplication is registered here rather than removed, because removing it is a change to that module and this ticket does not touch it',
};

/**
 * The package source trees this scan walks, as literals clause B can collect.
 *
 * **`packages/shared/src` is deliberately not among them, and the bound is stated rather than
 * implied.** Walking it means declaring it as an input of `@quorum/core#test`, which would be the
 * workspace dependency edge's claim written a second time and free to drift — the shape Q-0108's
 * cross-vendor review removed one ticket ago, where a package-level re-declaration of
 * `vitest.shared.js` was refused because the root already hashed it another way. What that costs is
 * exactly one thing: a `safe()` declared inside `packages/shared` would not be reported here. It is
 * accepted because `safe()` wraps a git invocation and `shared` declares no runner, holds no
 * `node:child_process` import, and is the one package that may depend on nothing — and because a
 * change there re-runs this suite through that same edge, so the next reader of this file is looking
 * at a tree they have just invalidated. The near-miss below is read as a single FILE for the same
 * reason: clause B honours the dependency edge for a file and only a directory walk needs declaring.
 */
const PACKAGE_SOURCE_ROOTS = ['packages/core/src', 'packages/cli/src'];

describe('Q-0115 AC-3 — the primitive is declared exactly twice, and the near-miss is not one', () => {
  const declaredIn = (root: string): string[] => coreSourceFiles(path.join(repoRoot, root))
    .filter(([, text]) => declarations(withoutBlockComments(text).split('\n')).some(([, name]) => name === 'safe'))
    .map(([name]) => `${root}/${name}`);

  test('exactly those two files across the two production roots this census walks', () => {
    const scanned = PACKAGE_SOURCE_ROOTS.flatMap((root) => coreSourceFiles(path.join(repoRoot, root)));
    // A scan over an empty corpus reports success over nothing, and every root must contribute.
    for (const root of PACKAGE_SOURCE_ROOTS) {
      expect(coreSourceFiles(path.join(repoRoot, root)).length, `${root} contributed no source`)
        .toBeGreaterThan(0);
    }
    expect(scanned.length, 'the corpus is empty, so finding two declarations proves nothing')
      .toBeGreaterThan(PACKAGE_SOURCE_ROOTS.length);
    expect(PACKAGE_SOURCE_ROOTS.flatMap(declaredIn).sort()).toStrictEqual(Object.keys(SAFE_DECLARATIONS).sort());
  });

  test('and `safeId` is shown NOT to satisfy it, which is the near miss the rule has to survive', () => {
    // `packages/shared/src/constants.ts` declares `safeId` inside a function. It is unrelated — it
    // sanitises a step id for a directory name — and a rule matching a prefix, or matching any
    // declaration rather than a top-level one, would collect it and read as a third copy. Read as
    // one file rather than through a walk of that tree, for the reason above the root list.
    const constants = repoFile('packages/shared/src/constants.ts');
    expect(constants, 'the near-miss is gone, so this clause has no subject').toContain('safeId');
    const names = declarations(withoutBlockComments(constants).split('\n')).map(([, name]) => name);
    expect(names, 'safeId was collected as a declaration of safe()').not.toContain('safe');
    // And the rule is shown to be the discriminating one rather than merely silent here: applied to
    // a file that DOES declare it, the same predicate fires.
    expect(declarations(withoutBlockComments('const safe = <T>(fn: () => T): T | null => null;').split('\n'))
      .map(([, name]) => name), 'the predicate does not fire on a real declaration either').toContain('safe');
  });

  test('a third declaration under either walked root fails, by name', () => {
    // Injected into EVERY walked root rather than into `core` alone: a mutation proving detection
    // in one root says nothing about the other, which is the shape this file exists to refuse.
    for (const root of PACKAGE_SOURCE_ROOTS) {
      const third = [...coreSourceFiles(path.join(repoRoot, root)),
        ['third/copy.ts', 'const safe = <T>(fn: () => T): T | null => {\n  try { return fn(); } catch { return null; }\n};\n'] as [string, string]];
      const found = third
        .filter(([, text]) => declarations(withoutBlockComments(text).split('\n')).some(([, name]) => name === 'safe'))
        .map(([name]) => `${root}/${name}`);
      expect(found, `a third declaration in ${root} was not reported`).toContain(`${root}/third/copy.ts`);
      expect(found.sort(), `${root} still matched the two-declaration register`)
        .not.toStrictEqual(Object.keys(SAFE_DECLARATIONS).sort());
    }
  });
});

// ---------------------------------------------------------------------------------------------
// AC-1 — the ruling is cited, never transcribed
// ---------------------------------------------------------------------------------------------

/** The entry every behaviour in this change traces to, read whole so the scan has a real corpus. */
const ENTRY = 'docs/decisions/088-a-probe-that-could-not-answer-is-not-a-negative.md';

/**
 * `markdown` as sentences a transcriber would have produced, long enough to be a transcription.
 *
 * Paragraphs are unwrapped BEFORE sentences are split, and the markdown emphasis a copier drops is
 * taken off both sides — Q-0050's own version of this scan is where both lessons come from: its
 * first draft split on every newline, so a sentence spanning two soft-wrapped lines was shredded and
 * 65 of 72 real sentences were invisible while it reported green. The floor is what stops a clause
 * like "Decision" or a code fragment being read as a copied sentence.
 */
const sentencesOf = (markdown: string): string[] => markdown
  .replace(/```[\s\S]*?```/g, ' ')
  .split(/\n\s*\n/)
  .filter((paragraph) => !paragraph.trim().startsWith('#'))
  .flatMap((paragraph) => plainly(paragraph).split(/(?<=[.?!])\s+/))
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence.length >= 60);

/** Both sides of the comparison, with the punctuation a copier does not carry over taken off. */
const plainly = (text: string): string => text.replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim();

describe('Q-0115 AC-1 — no source file transcribes the entry it cites', () => {
  // `fanout/` joined the two at Q-0074, which is where that half's citations landed: a scan that
  // forbids transcription in the modules a ruling has already reached, and not in the one it is
  // reaching next, is a scan that arrives after the copy it exists to stop.
  const scanned = (): [string, string][] => coreSourceFiles()
    .filter(([name]) => ['git/', 'engine/', 'fanout/'].some((folder) => name.startsWith(folder)));

  test('the scan has a corpus and a subject, before it is believed', () => {
    // Q-0111's lesson, and the reason this clause is written before the one below it: that guard's
    // first needle was the sentence AS IT READS, which the source escapes, so it matched nothing at
    // all — including its own subject — while reporting green. So the matcher is shown to fire, on a
    // real sentence of the real entry pasted onto a comment line, which is what transcribing is.
    const sentences = sentencesOf(repoFile(ENTRY));
    expect(sentences.length, 'the entry yielded no sentences, so the scan reports success over nothing')
      .toBeGreaterThan(10);
    expect(scanned().length, 'the corpus of files to scan is empty').toBeGreaterThan(5);

    const copied = sentences[0]!;
    const line = `  // Why: ${copied}`;
    expect(sentences.some((sentence) => plainly(line).includes(sentence)),
      'the matcher does not fire on a sentence copied verbatim, so it can find nothing').toBe(true);
    expect(sentences.some((sentence) => plainly('  // Why: see "A probe that could not answer is not a negative" (2026-09-10).').includes(sentence)),
      'the matcher fires on a CITATION, which is what the rule asks for instead').toBe(false);
  });

  test('and no line under git/, engine/ or fanout/ carries one', () => {
    // `harness/rules.md`: cite, do not transcribe — one line naming the authority, never a copy of
    // the argument. Scanned line by line rather than whole-file, because an authority comment that
    // runs to three lines puts its continuation outside a scan anchored on the marker (Q-0050).
    const sentences = sentencesOf(repoFile(ENTRY));
    for (const [name, text] of scanned()) {
      for (const line of text.split('\n')) {
        const transcribed = sentences.find((sentence) => plainly(line).includes(sentence));
        expect(transcribed, `${name} transcribes the entry: "${String(transcribed).slice(0, 70)}…"`)
          .toBeUndefined();
      }
    }
  });

  test('and the entry is cited, by title and date, where the behaviour it rules lives', () => {
    // The other direction: a scan that only forbids can be satisfied by a file that mentions its
    // authority nowhere, which is the state `git/git.ts` was actually in — six `Why:` lines, not one
    // of them at any of the six collapsing sites, and neither Q-0074 nor Q-0115 anywhere in it.
    const git = scanned().find(([name]) => name === 'git/git.ts')![1];
    expect(git, 'the entry is cited by title').toContain('A probe that could not answer is not a negative');
    expect(git, 'and by date, which is how an entry is cited rather than by its file name or number')
      .toContain('(2026-09-10)');
    expect(git, 'an entry may not be cited by its file name').not.toContain('088-a-probe');
  });
});
