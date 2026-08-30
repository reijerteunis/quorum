import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { repoRoot } from '../test/corpus.js';

/**
 * Q-0079 — a commit-creating git subcommand in a test carries an explicit identity.
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
  // apps/ is in scope and was missed on the first pass: apps/web exists, ESLint already covers
  // apps/**/*.ts, and a commit-creating call added there would have been invisible while the
  // corpus floor stayed green. Reported by Q-0079's cross-vendor review.
  { dir: 'apps', match: (p: string) => /\.test\.tsx?$/.test(p) || /\/test\//.test(p) },
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

/**
 * `tag` writes an object only when annotated or signed; a lightweight tag is a ref and nothing
 * else. Every form git accepts, not only the three anyone reaches for: `-F`/`--file` reads the
 * message from a file and annotates just as `-m` does, and `-u`/`--local-user` signs. The `=value`
 * spellings are matched by prefix. Missing forms were found by Q-0079's cross-vendor review.
 */
const TAG_WRITES = [
  '-a', '-s', '-m', '-F', '-u',
  '--annotate', '--sign', '--message', '--file', '--local-user', '--trailer',
];
/**
 * Short options whose presence anywhere in a bundle means an object is written. git accepts both
 * attached values (`-mtext`) and bundles (`-am 'x'`, `-sm 'x'`), so the test is membership in the
 * cluster rather than equality with a flag. `-n` and `-l` are deliberately absent: they list.
 * Found by Q-0079's cross-vendor review, round 3.
 */
const TAG_WRITE_LETTERS = ['a', 's', 'm', 'F', 'u'];
const annotates = (arg: string): boolean => {
  if (TAG_WRITES.includes(arg)) return true;
  if (arg.startsWith('--')) return TAG_WRITES.some((flag) => flag.startsWith('--') && arg.startsWith(`${flag}=`));
  if (!arg.startsWith('-') || arg.length < 2) return false;
  // A short-option cluster: every character up to the first value is a flag letter.
  const cluster = arg.slice(1);
  for (const letter of cluster) {
    if (TAG_WRITE_LETTERS.includes(letter)) return true;
    // A letter that takes a value swallows the rest of the token, so stop at the first non-flag.
    if (!/[A-Za-z]/.test(letter)) break;
  }
  return false;
};

function walk(dir: string, match: (p: string) => boolean, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(full)) out.push(full);
  }
  return out;
}

const SELF = 'packages/core/src/git-identity.test.ts';

/**
 * The marker exempting one line, and nothing else.
 *
 * Why per line rather than per file: this file was first excluded from its own corpus wholesale,
 * because its fixtures are bare commit-creating calls written to prove the guard fires. That hid
 * any REAL call later added here — the guard blind to itself, which is precisely its own subject.
 * Now the file is scanned like any other and each fixture line says so, so an unmarked call in it
 * fails. Found by Q-0079's cross-vendor review.
 */
const FIXTURE_MARK = 'scan-fixture';

/** Every file the guard reads, repository-relative and sorted. */
export function corpusFiles(): string[] {
  return CORPUS
    .flatMap(({ dir, match }) => walk(path.join(repoRoot, dir), match))
    .map((f) => path.relative(repoRoot, f))
    .sort();
}

interface Invocation {
  readonly file: string;
  readonly line: number;
  readonly subcommand: string;
  readonly args: readonly string[];
  /** The literals consumed before the subcommand — where a `-c key=value` pair has to appear. */
  readonly options: readonly string[];
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
      file, subcommand, args: literals.slice(k + 1), options: literals.slice(0, k),
      line: text.slice(0, m.index).split('\n').length,
    });
  }
  return found;
}

/** Whether this invocation writes an object, and so must carry an identity. */
function writesAnObject({ subcommand, args }: Invocation): boolean {
  if (subcommand === 'tag') return args.some(annotates);
  const inert = INERT[subcommand];
  if (inert && args[0] !== undefined && inert.has(args[0])) return false;
  return true;
}

/**
 * Whether both identity fields are supplied as `-c key=value` pairs among the leading options.
 *
 * Why structural: the first version read the invocation's own source LINE for `user.email=`, so a
 * comment beside the call — or any unrelated argument text — satisfied it, and
 * `git(root, 'merge', B); // user.email=x user.name=y` passed. A guard that can be talked out of  (scan-fixture)
 * firing by a comment is the class this file exists to catch. Found by Q-0079's cross-vendor review.
 */
function carriesIdentity({ options }: Invocation): boolean {
  const assigned = (key: string): boolean =>
    options.some((literal, i) =>
      options[i - 1] === '-c' && literal.startsWith(`${key}=`) && literal.slice(key.length + 1).trim() !== '');
  return assigned('user.email') && assigned('user.name');
}

/**
 * Whether a marked line is exempt, which is true in this file and nowhere else.
 *
 * Why its own function: repository-wide the marker would be the comment bypass round 1 found, under
 * a new token — a fix repeating the shape of the defect it fixes. Round 2 caught that; round 3 then
 * caught that the test guarding it could not fail, because it exercised the predicates rather than
 * this decision. It is a function so the `file === SELF` clause has a mutation a test can kill.
 */
function exempt(file: string, line: string): boolean {
  return file === SELF && line.includes(FIXTURE_MARK);
}

function violations(): Invocation[] {
  const out: Invocation[] = [];
  for (const rel of corpusFiles()) {
    const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const call of invocations(rel, text)) {
      if (!writesAnObject(call) || carriesIdentity(call)) continue;
      if (exempt(rel, text.split('\n')[call.line - 1] ?? '')) continue;
      out.push(call);
    }
  }
  return out;
}

describe('Q-0079 — a commit-creating git call in a test carries an explicit identity', () => {
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

  test('the fixture marker is load-bearing, and this file is scanned like any other', () => {
    expect(corpusFiles(), 'the guard scans itself — a real call added here must fail')
      .toContain(SELF);
    const text = fs.readFileSync(path.join(repoRoot, SELF), 'utf8');
    const marked = text.split('\n').filter((line) => line.includes(FIXTURE_MARK)).length;
    // If the fixtures below stopped being bare, the marker would be excusing nothing and would
    // read as coverage while covering no one — Q-0073's finding about a register entry that
    // became uncollectable on day one.
    expect(marked, 'the marker must still exempt real would-be violations').toBeGreaterThan(4);
    const unmarkedHere = violations().filter((v) => v.file === SELF);
    expect(unmarkedHere, 'and nothing unmarked in this file may slip through').toEqual([]);
  });

  test('the fixture marker is honoured in this file only, and never silences a real call', () => {
    // Repository-wide, the marker would be the comment bypass under a new token. Proven on a real
    // corpus file rather than argued: the same source is a violation when it is not SELF.
    const line = "git(root, 'merge', '-q', '--no-ff', B); // scan-fixture";  // scan-fixture
    // Aimed at the exemption decision itself, so deleting its `file === SELF` clause kills this
    // test. The earlier version asserted over the predicates and would have survived that edit.
    expect(exempt(SELF, line), 'the marker works here').toBe(true);
    expect(exempt('packages/core/src/engine/diff.test.ts', line), 'and nowhere else').toBe(false);
    expect(exempt('spike/test/q0035-empty-range.js', line), 'nor in the spike tree').toBe(false);
    expect(violations().map((v) => v.file), 'and the live corpus is clean').toEqual([]);
  });

  test('every marked line in this file is a would-be violation, so the marker excuses nothing dead', () => {
    const text = fs.readFileSync(path.join(repoRoot, SELF), 'utf8').split('\n');
    const marked = text.map((line, i) => [i + 1, line] as const)
      // The declaration itself necessarily contains the token and marks nothing.
      .filter(([, line]) => line.includes(FIXTURE_MARK) && !line.includes('const FIXTURE_MARK'));
    expect(marked.length, 'the marker must still have subjects').toBeGreaterThan(4);
    const dead = marked.filter(([, line]) =>
      !invocations(SELF, line).some((c) => writesAnObject(c) && !carriesIdentity(c)));
    expect(dead.map(([n]) => n),
      'a marked line that is no longer a violation reads as coverage while covering nothing (Q-0073)')
      .toEqual([]);
  });

  test('the scan collects the calls it exists to police — it is not passing by seeing nothing', () => {
    const collected = corpusFiles().flatMap((rel) =>
      invocations(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')));
    expect(collected.length, 'the scan must find the commit-creating calls the tree actually has')
      .toBeGreaterThan(20);
    expect(collected.filter((c) => c.subcommand === 'merge').length,
      'the merge calls Q-0051 and Q-0079 fixed must be visible to the scan').toBeGreaterThanOrEqual(6);
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
    const fixture = "git(root, 'merge', '-q', '--no-ff', '-m', 'take the branch', BRANCH);";  // scan-fixture
    const found = invocations('fixture.ts', fixture);
    expect(found).toHaveLength(1);
    expect(writesAnObject(found[0]!)).toBe(true);
  });

  test('each exemption clause is demonstrated firing on its own, not covered by a neighbour', () => {
    const cases: ReadonlyArray<readonly [string, boolean]> = [
      ["git(d, 'merge', '--abort');", false],
      ["git(d, 'merge', '--no-ff', B);", true],  // scan-fixture
      ["git(d, 'rebase', '--skip');", false],
      ["git(d, 'rebase', B);", true],  // scan-fixture
      ["git(d, 'am', '--continue');", false],
      ["git(d, 'cherry-pick', '--abort');", false],
      ["git(d, 'revert', '--continue');", false],
      ["git(d, 'stash', 'list');", false],
      ["git(d, 'stash', 'pop');", false],
      ["git(d, 'stash');", true],  // scan-fixture
      ["git(d, 'notes', 'show');", false],
      ["git(d, 'notes', 'add', '-m', 'x');", true],  // scan-fixture
      ["git(d, 'tag', 'v1');", false],
      ["git(d, 'tag', '-a', 'v1', '-m', 'x');", true],  // scan-fixture
      ["git(d, 'tag', '-m', 'x', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '-F', 'msg.txt', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '--file=msg.txt', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '-u', 'KEYID', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '--local-user=KEYID', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '--message=x', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '--trailer', 'k:v', '-m', 'x', 'v1');", true],  // scan-fixture
      ["git(d, 'tag', '-mtext', 'v1');", true],  // scan-fixture — attached short form
      ["git(d, 'tag', '-Fmsg.txt', 'v1');", true],  // scan-fixture — attached short form
      ["git(d, 'tag', '-uKEYID', 'v1');", true],  // scan-fixture — attached short form
      ["git(d, 'tag', '-am', 'x', 'v1');", true],  // scan-fixture — bundled
      ["git(d, 'tag', '-sm', 'x', 'v1');", true],  // scan-fixture — bundled
      ["git(d, 'tag', '-n5');", false],
      ["git(d, 'tag', '-l');", false],
    ];
    for (const [source, expected] of cases) {
      const found = invocations('fixture.ts', source);
      expect(found, source).toHaveLength(1);
      expect(writesAnObject(found[0]!), source).toBe(expected);
    }
  });

  test('identity is read from the -c pairs, not from the source line around them', () => {
    // A comment beside the call used to satisfy the check, so the guard could be talked out of
    // firing by text it does not execute. Found by the cross-vendor review.
    const commented = invocations('fixture.ts', "git(root, 'merge', B); // user.email=x user.name=y");  // scan-fixture
    expect(commented).toHaveLength(1);
    expect(carriesIdentity(commented[0]!), 'a comment is not an argument').toBe(false);

    const real = invocations('fixture.ts',
      "git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'merge', B);");
    expect(carriesIdentity(real[0]!)).toBe(true);

    for (const source of [
      "git(root, '-c', 'user.email=q@a', 'merge', B);",  // scan-fixture — name missing
      "git(root, '-c', 'user.email=', '-c', 'user.name=qa', 'merge', B);",  // scan-fixture — empty value
      "git(root, '-c', 'user.email=q@a', '-c', 'user.name= ', 'merge', B);",  // scan-fixture — whitespace only
      "git(root, '-c', 'user.email=  ', '-c', 'user.name=qa', 'merge', B);",  // scan-fixture — whitespace only
    ]) {
      const found = invocations('fixture.ts', source);
      expect(found, source).toHaveLength(1);
      expect(carriesIdentity(found[0]!), source).toBe(false);
    }

    // Bare `key=value` before the subcommand is not an option form git accepts — it would read
    // the assignment ITSELF as the subcommand — so nothing is collected, which is the honest
    // answer rather than a violation.
    expect(invocations('fixture.ts', "git(root, 'user.email=q@a', 'user.name=qa', 'merge', B);"))
      .toEqual([]);
  });

  test('leading -c pairs are consumed, so the subcommand is found behind an identity', () => {
    const found = invocations('fixture.ts',
      "git(root, '-c', 'user.email=q@a', '-c', 'user.name=qa', 'merge', '-q', '--no-ff', B);");
    expect(found).toHaveLength(1);
    expect(found[0]!.subcommand).toBe('merge');
  });
});
