import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { repoRoot } from '../test/corpus.js';

/**
 * Q-0081 — a commit-creating git subcommand in a test carries an explicit identity.
 *
 * The tripwire half of *"A test's verdict is a property of the commit, not of the checkout or the
 * account"* (2026-08-30). `git merge --no-ff` and its siblings write an object, so they resolve a
 * committer identity: macOS derives one from the OS user record and a Linux runner cannot, which is
 * how Q-0051's merge turned CI red while implement, review, `integrate` and two hand verifications
 * all reported green.
 *
 * **Its limit, stated rather than discovered: it sees literals only.** A subcommand held in a
 * variable, or reached through a helper with a computed argument list, is invisible here. That is
 * why this is the tripwire and the hostile-environment sweep is the oracle, and why this file may
 * never be read as coverage for the checkout-shaped instances of the same class (Q-0072, Q-0073).
 */

/** Directories the corpus is drawn from, each relative to the repository root. */
const CORPUS = [
  { dir: 'packages', match: (p: string) => /\.test\.ts$/.test(p) || /\/test\//.test(p) },
  { dir: 'spike/test', match: (p: string) => p.endsWith('.js') },
];

/**
 * A floor on the corpus, so an empty or implausibly small listing fails rather than passing over
 * nothing. Measured 2026-08-30: 43 packages files and 17 spike files.
 */
const CORPUS_FLOOR = 45;

/** Subcommands that can write a commit, tag or note object, and so resolve an identity. */
const COMMIT_CREATING = new Set([
  'commit', 'commit-tree', 'merge', 'cherry-pick', 'revert', 'rebase', 'am', 'stash', 'notes', 'tag',
]);

/**
 * Second arguments that make a commit-creating subcommand create nothing. Each clause is
 * demonstrated firing by its own fixture below: showing that a guard has a subject proves the guard
 * fires, not that each of its clauses does (Q-0071).
 */
const INERT: Record<string, ReadonlySet<string>> = {
  merge: new Set(['--abort', '--continue', '--quit']),
  rebase: new Set(['--abort', '--continue', '--skip', '--quit']),
  am: new Set(['--abort', '--continue', '--skip', '--quit']),
  'cherry-pick': new Set(['--abort', '--continue', '--skip', '--quit']),
  revert: new Set(['--abort', '--continue', '--skip', '--quit']),
  stash: new Set(['list', 'show', 'drop', 'pop', 'apply', 'clear', 'branch']),
  notes: new Set(['list', 'show']),
};

/** `tag` writes an object only when annotated or signed; a lightweight tag is a ref and nothing else. */
const TAG_WRITES = new Set(['-a', '-s', '-m', '--annotate', '--sign']);

function walk(dir: string, match: (p: string) => boolean, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}

/**
 * This file, which is the one deliberate exclusion: its fixtures are bare commit-creating calls
 * written to prove the guard fires, so scanning itself would report its own evidence as violations.
 * The exclusion is asserted to be load-bearing below — an exclusion that stopped excusing anything
 * would be reported rather than left standing, which is Q-0073's finding about a register entry
 * that became uncollectable on day one.
 */
const SELF = 'packages/core/src/git-identity.test.ts';

/** Every file the guard reads, repository-relative and sorted. */
export function corpusFiles(): string[] {
  return CORPUS
    .flatMap(({ dir, match }) => walk(path.join(repoRoot, dir), match))
    .map((f) => path.relative(repoRoot, f))
    .filter((f) => f !== SELF)
    .sort();
}

interface Invocation {
  readonly file: string;
  readonly line: number;
  readonly subcommand: string;
  readonly args: readonly string[];
}

/**
 * Every `git(…)` call in `text` whose argument list is literal, with its arguments in order.
 *
 * Anchored on the invocation rather than on the token, which is the whole difficulty and was
 * measured before this was written: a substring match trips on `merge-base` and on
 * `5d16e06^{commit}`; an exact-token match still trips on `{ id: 'merge', type: 'integrate' }`,
 * a flow step id that is not a git call at all, and on assertion strings quoting
 * `git merge-base --is-ancestor`. Only a call to the file's own `git` helper counts, and only its
 * first non-option literal is read as the subcommand.
 */
function invocations(file: string, text: string): Invocation[] {
  const found: Invocation[] = [];
  const call = /\bgit\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(text)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth -= 1;
    }
    if (depth !== 0) continue;
    const raw = text.slice(m.index + m[0].length, i - 1);
    const literals = [...raw.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)].map((q) => q[1] ?? q[2] ?? '');
    let k = 0;
    while (k < literals.length && literals[k]!.startsWith('-')) k += (literals[k] === '-c' || literals[k] === '-C') ? 2 : 1;
    const subcommand = literals[k];
    if (subcommand === undefined || !COMMIT_CREATING.has(subcommand)) continue;
    found.push({
      file, subcommand, args: literals.slice(k + 1),
      line: text.slice(0, m.index).split('\n').length,
    });
  }
  return found;
}

/** Whether this invocation writes an object, and so must carry an identity. */
function writesAnObject({ subcommand, args }: Invocation): boolean {
  if (subcommand === 'tag') return args.some((a) => TAG_WRITES.has(a));
  const inert = INERT[subcommand];
  if (inert && args[0] !== undefined && inert.has(args[0])) return false;
  return true;
}

function violations(): Invocation[] {
  const out: Invocation[] = [];
  for (const rel of corpusFiles()) {
    const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const call of invocations(rel, text)) {
      if (!writesAnObject(call)) continue;
      const all = [call.subcommand, ...call.args];
      const raw = text.split('\n')[call.line - 1] ?? '';
      const hasEmail = raw.includes('user.email=') || all.some((a) => a.startsWith('user.email='));
      const hasName = raw.includes('user.name=') || all.some((a) => a.startsWith('user.name='));
      if (!hasEmail || !hasName) out.push(call);
    }
  }
  return out;
}

describe('Q-0081 — a commit-creating git call in a test carries an explicit identity', () => {
  test('the corpus is named, and an implausibly small one fails rather than passing over nothing', () => {
    const files = corpusFiles();
    expect(files.length, `corpus is ${files.length} files; the floor is ${CORPUS_FLOOR}`)
      .toBeGreaterThanOrEqual(CORPUS_FLOOR);
    expect(files.some((f) => f.startsWith('spike/test/')), 'spike/test must be in the corpus').toBe(true);
    expect(files.some((f) => f === 'packages/core/test/repo.ts'),
      'packages/*/test/** is in the corpus deliberately: repo.ts holds two commit sites and states this rule in prose')
      .toBe(true);
  });

  test('every commit-creating invocation in the corpus carries both identity fields', () => {
    const found = violations().map((v) => `${v.file}:${v.line} git ${v.subcommand} ${v.args.join(' ')}`.trim());
    expect(found, 'a git call that writes an object must carry -c user.email=… and -c user.name=…').toEqual([]);
  });

  test('the one exclusion is load-bearing — this file would fail the scan it defines', () => {
    const own = invocations(SELF, fs.readFileSync(path.join(repoRoot, SELF), 'utf8')).filter(writesAnObject);
    expect(own.length, 'the fixtures proving the guard fires must still be bare, or the exclusion excuses nothing')
      .toBeGreaterThan(0);
    expect(corpusFiles(), 'and the file must actually be out of the corpus').not.toContain(SELF);
  });

  test('the scan collects the calls it exists to police — it is not passing by seeing nothing', () => {
    const collected = corpusFiles().flatMap((rel) =>
      invocations(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')));
    expect(collected.length, 'the scan must find the commit-creating calls the tree actually has')
      .toBeGreaterThan(20);
    expect(collected.filter((c) => c.subcommand === 'merge').length,
      'the merge calls Q-0051 and Q-0081 fixed must be visible to the scan').toBeGreaterThanOrEqual(6);
  });

  test('it anchors on the invocation, not the token — the measured false positives stay clean', () => {
    const fixture = [
      "git(root, 'merge-base', '--is-ancestor', a, b);",
      "git(root, 'rev-parse', '5d16e06^{commit}');",
      "const step = { id: 'merge', type: 'integrate', into: 'harness/{id}/landing' };",
      "expect(message).toContain('git merge-base --is-ancestor');",
      "expect(out).toMatch(/git commit -m/);",
    ].join('\n');
    expect(invocations('fixture.ts', fixture)).toEqual([]);
  });

  test('a bare commit-creating call is caught — the guard has a subject', () => {
    const fixture = "git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);";
    const found = invocations('fixture.ts', fixture);
    expect(found).toHaveLength(1);
    expect(writesAnObject(found[0]!)).toBe(true);
  });

  test('each exemption clause is demonstrated firing on its own, not covered by a neighbour', () => {
    const cases: ReadonlyArray<readonly [string, boolean]> = [
      ["git(d, 'merge', '--abort');", false],
      ["git(d, 'merge', '--no-ff', B);", true],
      ["git(d, 'rebase', '--skip');", false],
      ["git(d, 'rebase', B);", true],
      ["git(d, 'am', '--continue');", false],
      ["git(d, 'cherry-pick', '--abort');", false],
      ["git(d, 'revert', '--continue');", false],
      ["git(d, 'stash', 'list');", false],
      ["git(d, 'stash', 'pop');", false],
      ["git(d, 'stash');", true],
      ["git(d, 'notes', 'show');", false],
      ["git(d, 'notes', 'add', '-m', 'x');", true],
      ["git(d, 'tag', 'v1');", false],
      ["git(d, 'tag', '-a', 'v1', '-m', 'x');", true],
      ["git(d, 'tag', '-m', 'x', 'v1');", true],
    ];
    for (const [source, expected] of cases) {
      const found = invocations('fixture.ts', source);
      expect(found, source).toHaveLength(1);
      expect(writesAnObject(found[0]!), source).toBe(expected);
    }
  });

  test('leading -c pairs are consumed, so the subcommand is found behind an identity', () => {
    const found = invocations('fixture.ts',
      "git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'merge', '-q', '--no-ff', B);");
    expect(found).toHaveLength(1);
    expect(found[0]!.subcommand).toBe('merge');
  });
});
