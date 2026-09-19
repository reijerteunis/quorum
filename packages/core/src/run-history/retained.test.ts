// Q-0137 AC-1, AC-2, AC-3, AC-6 and AC-13: what an occurrence retained, named without being opened
// and then read one file at a time.
//
// **Three of these criteria cannot be learned from `.quorum/runs` and every fixture here is built**
// (R-1). All 940 `occurrence_dir` values on this machine are well-formed `steps/NNN-<step id>`,
// nothing under a run directory is anything but a regular file, no file fails a UTF-8 decode, and
// `kind: 'script'` has never occurred — so a fixture drawn from that store would pass over an
// implementation with no confinement at all. Every clause below is shown red against the shape it
// forbids rather than observed green over the shape this machine happens to hold.
//
// It is a file of its own rather than a block in `reader.test.ts` because these are two subjects:
// that file is about resolving a run and this is about what one retained. `coreSourceFiles` skips
// `.test.ts`, so the three-file register over `run-history/`'s SOURCE is untouched.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { listRetainedFiles, occurrenceSeq, readRetainedFile, readRun } from './reader.js';
import type { Occurrence, RunManifest } from './manifest.js';
import { removeTempDirs, tempDir, walk, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** A complete, valid manifest, so a case states only the field it is about. */
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({
  schema_version: 1,
  run_id: 'Q-0137-1',
  ticket_id: 'Q-0137',
  ticket_path: 'backlog/Q-0137-the-drill-down-serves-what-an-occurrence/ticket.md',
  flow: 'chore',
  flow_file: 'harness/flows/chore.yaml',
  stage: { before: 'requirements', after: 'reviewed' },
  started_at: '2026-09-19T01:00:00.000Z',
  ended_at: '2026-09-19T01:05:00.000Z',
  duration_ms: 300_000,
  status: 'completed',
  steps: [],
  rollup: [],
  ...fields,
});

/** One occurrence as a manifest records it, with only the fields a case is about supplied. */
const occurrence = (over: Partial<Occurrence> & { step_id: string; occurrence_dir: string }): Occurrence => ({
  kind: 'adapter', role: null, adapter: 'mock', model: null, branch: null, worktree: null,
  started_at: '2026-09-19T01:00:00.000Z', duration_ms: 1000, attempts: 1, status: 'completed',
  verdict: null, error: null, usage: null, ...over,
});

/**
 * A runs root holding one run, two levels below the temporary directory.
 *
 * The depth is what lets {@link outsideOf} put a fixture genuinely outside the runs root and still
 * inside the tree `removeTempDirs` deletes, so a symlink target is not litter the next ticket
 * inherits. `reader.test.ts` builds its own for the same reason.
 */
function storeWith(document: unknown, files: Record<string, Record<string, string>> = {}): string {
  const root = path.join(tempDir('retained-'), 'quorum', 'runs');
  const run = path.join(root, 'Q-0137-1');
  fs.mkdirSync(run, { recursive: true });
  write(path.join(run, 'manifest.json'), typeof document === 'string' ? document : JSON.stringify(document));
  for (const [dir, held] of Object.entries(files)) {
    fs.mkdirSync(path.join(run, dir), { recursive: true });
    for (const [name, text] of Object.entries(held)) write(path.join(run, dir, name), text);
  }
  return root;
}

/** The same, for the ordinary case: a sound manifest recording these occurrences. */
const runWith = (steps: Occurrence[], files: Record<string, Record<string, string>> = {}): string =>
  storeWith(manifest({ steps }), files);

/** The sandbox a runs root sits in — outside it, and still inside what `removeTempDirs` deletes. */
const outsideOf = (root: string, name: string): string => {
  const dir = path.join(path.dirname(path.dirname(root)), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Interleave `change` between the enumeration's `lstat` of `target` and the open that follows it.
 *
 * **Staged rather than reasoned about** (Q-0127's round-4 precedent, which staged a race a finding
 * had said no test could stage). The window this opens is the real one: `retainedIn` lstats every
 * entry to size it, and `readRetainedFile` opens the chosen leaf afterwards.
 *
 * Three things about the hook are deliberate and each would be a defect if it were not.
 * **`fs.statSync` is the delegate rather than the real `lstatSync`**, because taking a read API as a
 * VALUE is a shape `turbo-inputs.test.ts`'s clause C4 refuses by design — and it is faithful here
 * rather than merely convenient: neither fixture holds a symlink at the moment the enumeration runs,
 * which is the only case where the two disagree, and the replacement this stages happens after it.
 * **It fires once**, because the change itself touches the filesystem and an unguarded hook
 * re-enters. And **`unlinkSync` rather than `rmSync`**, which stats what it removes.
 */
function stageOn(target: string, change: () => void): MockInstance {
  let staged = false;
  // The hook is typed from `node:fs`'s own parameter types and cast opaquely, rather than through
  // `typeof fs.lstatSync`: naming a read API in a TYPE position is still naming it as a value, and
  // `turbo-inputs.test.ts`'s clause C4 reports that shape rather than skipping it.
  // The options are spelled structurally rather than as `fs.StatSyncOptions`, which `node:fs` marks
  // `@deprecated` — and which `.claude/rules/engineering.md` forbids in new code.
  const hook = (given: fs.PathLike, options?: { throwIfNoEntry?: boolean; bigint?: boolean }): unknown => {
    const found: unknown = fs.statSync(given, options);
    if (!staged && String(given) === target) {
      staged = true;
      change();
    }
    return found;
  };
  return vi.spyOn(fs, 'lstatSync').mockImplementation(hook as never);
}

/** A path inside the one run these fixtures build. */
const inRun = (root: string, ...rest: string[]): string => path.join(root, 'Q-0137-1', ...rest);

/**
 * The same path as the code sees it.
 *
 * `readRun` answers the **resolved** run directory, which is what everything below it joins onto —
 * and on darwin the system temporary directory is itself a link, so `/var/…` and `/private/var/…`
 * are the same file under two names. A comparison against the unresolved path passes vacuously
 * there, which is the shape a spy or a hook has to get right before it can be trusted.
 */
const realInRun = (root: string, ...rest: string[]): string =>
  path.join(fs.realpathSync(inRun(root)), ...rest);

describe('Q-0137 AC-1 — an occurrence\'s retained files are named and measured, and none is opened', () => {
  test('every occurrence is keyed by seq, with its files sorted and sized from the filesystem', () => {
    const root = runWith(
      [
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'integrate', occurrence_dir: 'steps/002-integrate', kind: 'integrate', adapter: null }),
      ],
      {
        // Written out of alphabetical order, so the sort is doing work rather than inheriting one.
        'steps/001-implement': { 'prompt.txt': 'ask', 'output.txt': 'answered' },
        'steps/002-integrate': { 'output.txt': 'merged and green' },
      },
    );
    const answer = listRetainedFiles(root, 'Q-0137-1');
    expect(answer.outcome).toBe('listing');
    if (answer.outcome !== 'listing') return;
    expect(answer.warnings, 'a sound store produced a warning').toStrictEqual([]);
    expect(answer.occurrences).toStrictEqual([
      { seq: 1, step_id: 'implement', files: [{ name: 'output.txt', bytes: 8 }, { name: 'prompt.txt', bytes: 3 }] },
      { seq: 2, step_id: 'integrate', files: [{ name: 'output.txt', bytes: 16 }] },
    ]);
    // The sizes are the filesystem's rather than a length this test computed from its own fixture,
    // which is the assertion satisfied by construction.
    for (const entry of answer.occurrences) {
      const dir = entry.seq === 1 ? 'steps/001-implement' : 'steps/002-integrate';
      for (const held of entry.files) {
        expect(fs.statSync(inRun(root, dir, held.name)).size, `${dir}/${held.name}`).toBe(held.bytes);
      }
    }
  });

  test('every name it answers is one leaf name, which is what makes a listing addressable', () => {
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask', 'notes.md': 'a third name nobody registered' } },
    );
    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    const names = answer.occurrences.flatMap((entry) => entry.files.map((file) => file.name));
    expect(names, 'a third retained name was not listed').toStrictEqual(['notes.md', 'prompt.txt']);
    for (const name of names) {
      expect(name, 'an empty name').not.toBe('');
      expect(['.', '..'], `${name} is a directory reference`).not.toContain(name);
      expect(name.includes('/') || name.includes('\\'), `${name} holds a separator`).toBe(false);
      expect(path.basename(name), `${name} is not its own basename`).toBe(name);
    }
  });

  test('an entry whose own NAME is not a leaf this module will join is skipped, not offered', () => {
    // Review round 1's major, staged rather than reasoned about: `a\b` is a legal POSIX filename,
    // so `readdir` answers it and it passed the `isFile` test — while `readRetainedFile` refuses
    // the same string as `not-a-file-name`. The listing named a file no request could fetch.
    //
    // Constructed, because nothing in this repository's own store carries such a name: `persist`
    // takes the artifact's name as a parameter and its two callers pass constants, so a fixture
    // drawn from `.quorum/runs` would pass over an implementation with no clause at all (R-1).
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    const dir = inRun(root, 'steps/001-implement');
    const awkward = 'a\\b.txt';
    write(path.join(dir, awkward), 'BACKSLASH');
    // The fixture really holds it, and the operating system really reports it as a regular file —
    // so what omits it below is the name clause rather than the `isFile` clause above it.
    expect(fs.readdirSync(dir).sort(), 'the fixture does not hold the awkward name')
      .toStrictEqual([awkward, 'prompt.txt'].sort());
    expect(fs.lstatSync(path.join(dir, awkward)).isFile(), 'the fixture is not a regular file').toBe(true);

    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences[0].files, 'a name this module will not join was offered as addressable')
      .toStrictEqual([{ name: 'prompt.txt', bytes: 3 }]);
    // The two halves are one answer: what the listing declines to name is what the read declines to
    // open, so nothing offered is unfetchable and nothing fetchable is unlisted.
    expect(readRetainedFile(root, 'Q-0137-1', 1, awkward).outcome, 'the read accepted what the listing refused')
      .toBe('not-a-file-name');
    // Skipped and NOT an error, exactly as a non-regular entry is: the occurrence is still listed.
    expect(answer.warnings, 'an unaddressable name was reported as a failure of the occurrence')
      .toStrictEqual([]);
  });

  test('a directory entry that is not a regular file is skipped rather than measured', () => {
    // A directory NAMED `output.txt` is a shape this product can actually produce: `terminal()`
    // guards its write with `fs.existsSync`, which answers true for a directory, so the writer
    // leaves one alone in silence — landed preserved behaviour this ticket declines to trip over.
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    const dir = inRun(root, 'steps/001-implement');
    fs.mkdirSync(path.join(dir, 'output.txt'));
    fs.symlinkSync(path.join(dir, 'prompt.txt'), path.join(dir, 'alias.txt'));
    // The fixture really holds all three, so the clause discriminates rather than passing over an
    // empty directory.
    expect(fs.readdirSync(dir).sort()).toStrictEqual(['alias.txt', 'output.txt', 'prompt.txt']);

    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences[0].files, 'a directory or a symlink was measured as a file')
      .toStrictEqual([{ name: 'prompt.txt', bytes: 3 }]);
    // Skipped and NOT an error: the occurrence is still listed and the rest of its files are named.
    expect(answer.warnings, 'a non-regular entry was reported as a failure').toStrictEqual([]);
  });

  test('an absent occurrence directory is a warning, and an empty one lists no files', () => {
    // Two different answers, and the second is reachable while a run is live: `allocate` creates
    // the directory and the first `persist` is what puts anything in it.
    const root = runWith([
      occurrence({ step_id: 'gone', occurrence_dir: 'steps/001-gone' }),
      occurrence({ step_id: 'fresh', occurrence_dir: 'steps/002-fresh' }),
    ]);
    fs.mkdirSync(inRun(root, 'steps/002-fresh'), { recursive: true });
    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences, 'an empty directory was not listed as holding nothing')
      .toStrictEqual([{ seq: 2, step_id: 'fresh', files: [] }]);
    expect(answer.warnings.map((warning) => warning.seq), 'an absent directory was not named').toStrictEqual([1]);
    expect(answer.warnings[0].message, 'the warning does not name the condition').toContain('not there');
  });

  test('it opens no retained file, and the one file it does open is the manifest', () => {
    // **The satisfiable form of AC-1's `Test:` clause, and the divergence is named rather than
    // smoothed over.** That clause asks for zero `readFileSync`/`openSync` calls across the whole
    // invocation. `listRetainedFiles` takes a run TOKEN and resolves it internally — which is the
    // requirement's own §4.3, no path crossing `core`'s boundary in either direction — so it must
    // read the manifest, and zero is unreachable for any implementation of the criterion's
    // normative half. What is asserted instead is the property that clause is about, in a stronger
    // form than a count: the exact set of paths opened, which names the manifest and no retained
    // file. A reviewer should weigh an erratum.
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask', 'output.txt': 'answered' } },
    );
    const opens = vi.spyOn(fs, 'openSync');
    const reads = vi.spyOn(fs, 'readFileSync');
    try {
      const answer = listRetainedFiles(root, 'Q-0137-1');
      expect(answer.outcome).toBe('listing');
      expect(opens, 'a retained file was opened by a listing').not.toHaveBeenCalled();
      expect(reads.mock.calls.map(([target]) => String(target)),
        'a listing read something other than the manifest')
        .toStrictEqual([realInRun(root, 'manifest.json')]);
    } finally {
      opens.mockRestore();
      reads.mockRestore();
    }
  });

  test('the two ways a run is not a run are told apart, exactly as readRun tells them apart', () => {
    const sound = runWith([]);
    expect(listRetainedFiles(sound, 'Q-0137-404')).toStrictEqual({ outcome: 'not-a-run' });
    expect(listRetainedFiles(sound, '../escape')).toStrictEqual({ outcome: 'not-a-run' });
    const answer = listRetainedFiles(storeWith('{ not json'), 'Q-0137-1');
    expect(answer.outcome, 'an unreadable manifest was reported as an absent run').toBe('malformed');
  });

  test('a manifest whose steps are not an array, or whose members are not objects, is survived', () => {
    // `readRun` casts rather than checks and `manifestShapeError` does not run on a single-run read
    // at all, so both shapes reach this function on a hand-edited file.
    for (const steps of [42, 'steps', null, [1, 2, 3], [null]] as unknown[]) {
      const answer = listRetainedFiles(storeWith({ ...manifest(), steps }), 'Q-0137-1');
      expect(answer.outcome, JSON.stringify(steps)).toBe('listing');
      if (answer.outcome !== 'listing') continue;
      expect(answer.occurrences, JSON.stringify(steps)).toStrictEqual([]);
    }
  });
});

describe('Q-0137 AC-3 — a traversing occurrence_dir is refused, and nothing is joined until it is', () => {
  test('every traversing shape is refused, and the refused value is never quoted back', () => {
    // The fourth shape is the one that matters most and is easy to leave out: it carries a readable
    // `steps/NNN-` prefix, so it is ADDRESSABLE — the confinement is what refuses it, rather than
    // the sequence lookup failing first and the guard never being reached. `occurrenceSeq` is what
    // says which number each is asked for under, because a hand-written expectation there would be
    // this test asserting its own arithmetic instead of the confinement.
    const shapes: [string, string][] = [
      ['../escape', 'a parent of the run directory'],
      ['steps/../../escape', 'a path that climbs out after looking as if it does not'],
      ['/etc', 'an absolute path'],
      ['steps/001-implement/../../../escape', 'a traversing path under an addressable sequence number'],
    ];
    expect(occurrenceSeq('steps/001-implement/../../../escape'),
      'the addressable shape is not addressable, so one clause here has no subject').toBe(1);
    for (const [dir, shape] of shapes) {
      const root = runWith([occurrence({ step_id: 'implement', occurrence_dir: dir })]);
      const answer = listRetainedFiles(root, 'Q-0137-1');
      if (answer.outcome !== 'listing') throw new Error(`${shape} did not list, so this clause has no subject`);
      expect(answer.occurrences, `${shape} was listed`).toStrictEqual([]);
      expect(answer.warnings, `${shape} was not named`).toHaveLength(1);
      expect(answer.warnings[0].message, `${shape} does not name the condition`)
        .toContain("not inside the run's own directory");
      // **No outside name appears in any answer.** The value is the untrusted one here, so quoting
      // a refused `../escape` back would put a path nobody asked for into a response.
      for (const leaked of ['escape', '/etc']) {
        expect(JSON.stringify(answer), `${shape} quoted ${leaked} back`).not.toContain(leaked);
      }
      // …and the read refuses it under its own outcome rather than as an absence.
      expect(readRetainedFile(root, 'Q-0137-1', occurrenceSeq(dir), 'prompt.txt').outcome, shape)
        .toBe('unsafe-occurrence-directory');
    }
  });

  test('a single-segment occurrence directory that is a SYMLINK out of the run is refused, unread', () => {
    // The clause a lexical test cannot make: `steps/001-implement` is strictly inside the run
    // directory as a string, and only resolving it sees through the link. A file is planted at the
    // target and asserted unread, so the refusal is about the bytes and not only about the name.
    const root = runWith([occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })]);
    const outside = outsideOf(root, 'elsewhere');
    write(path.join(outside, 'prompt.txt'), 'SECRET-PROMPT');
    fs.mkdirSync(inRun(root, 'steps'), { recursive: true });
    fs.symlinkSync(outside, inRun(root, 'steps', '001-implement'));
    // The link resolves and a walk through it would have worked, so the refusal is the guard's.
    expect(fs.readdirSync(inRun(root, 'steps', '001-implement')),
      'the link is dead, so this clause has no subject').toStrictEqual(['prompt.txt']);

    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences, 'a symlinked occurrence directory was listed').toStrictEqual([]);
    expect(answer.warnings[0]?.message).toContain("not inside the run's own directory");
    expect(JSON.stringify(answer), 'the outside name reached the answer').not.toContain('SECRET');

    const read = readRetainedFile(root, 'Q-0137-1', 1, 'prompt.txt');
    expect(read.outcome, 'the linked target was read').toBe('unsafe-occurrence-directory');
    expect(JSON.stringify(read), "the linked target's bytes reached the answer").not.toContain('SECRET');
    // Nothing at the target moved either, which is the other half of "refused rather than followed".
    expect(fs.readFileSync(path.join(outside, 'prompt.txt'), 'utf8'), 'the planted file was altered')
      .toBe('SECRET-PROMPT');
  });

  test('an occurrence_dir that is not a string at all is a warning rather than a throw', () => {
    for (const dir of [42, null, ['steps/001-a'], { dir: 'steps/001-a' }] as unknown[]) {
      const steps = [{ ...occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }), occurrence_dir: dir }];
      const answer = listRetainedFiles(storeWith({ ...manifest(), steps }), 'Q-0137-1');
      expect(answer.outcome, JSON.stringify(dir)).toBe('listing');
      if (answer.outcome !== 'listing') continue;
      expect(answer.warnings, JSON.stringify(dir)).toHaveLength(1);
      expect(answer.warnings[0].message, JSON.stringify(dir)).toContain('records no directory');
    }
  });
});

describe('Q-0137 AC-2 — one retained file\'s bytes, with membership and the read in one call', () => {
  /** One run holding one adapter occurrence with both artifacts. */
  const store = (): string => runWith(
    [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
    { 'steps/001-implement': { 'prompt.txt': 'ask', 'output.txt': 'answered' } },
  );

  test('the bytes are what the file holds, identically to reading it directly', () => {
    const root = store();
    const read = readRetainedFile(root, 'Q-0137-1', 1, 'prompt.txt');
    expect(read.outcome).toBe('file');
    if (read.outcome !== 'file') return;
    expect(read.name).toBe('prompt.txt');
    expect(read.bytes).toStrictEqual(fs.readFileSync(inRun(root, 'steps/001-implement', 'prompt.txt')));
    // A Buffer and never a string: `readFileSync(file, 'utf8')` substitutes U+FFFD without
    // throwing, so a caller that must characterise these bytes has to be handed what was read.
    expect(Buffer.isBuffer(read.bytes), 'the bytes were decoded before the caller saw them').toBe(true);
  });

  test('a name this occurrence does not hold is refused, and so is one that is not a leaf', () => {
    const root = store();
    expect(readRetainedFile(root, 'Q-0137-1', 1, 'nope.txt').outcome).toBe('not-an-occurrence-file');
    for (const name of ['', '.', '..', 'a/b', '../prompt.txt', 'sub\\prompt.txt', '/etc/passwd']) {
      expect(readRetainedFile(root, 'Q-0137-1', 1, name).outcome, JSON.stringify(name)).toBe('not-a-file-name');
    }
  });

  test('a listed name that is a directory is refused rather than read', () => {
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    fs.mkdirSync(inRun(root, 'steps/001-implement', 'output.txt'));
    // Refused at membership, the enumeration having skipped it — which is the first of the two
    // clauses. The second is the descriptor's own `fstat`, and it is what the next test stages.
    expect(readRetainedFile(root, 'Q-0137-1', 1, 'output.txt').outcome).toBe('not-an-occurrence-file');
  });

  test('a file removed between the enumeration and the read is refused rather than throwing', () => {
    // **Staged rather than reasoned about** (Q-0127's round-4 precedent): the removal happens
    // inside the `lstat` the enumeration performs, so the name genuinely is listed and genuinely is
    // gone by the time the open runs. This store grows and shrinks under a reader in ordinary
    // operation, so the race is real rather than a hypothetical one a hook invents.
    const root = store();
    const target = realInRun(root, 'steps/001-implement', 'prompt.txt');
    let read;
    const lstat = stageOn(target, () => { fs.unlinkSync(target); });
    try {
      read = readRetainedFile(root, 'Q-0137-1', 1, 'prompt.txt');
    } finally {
      lstat.mockRestore();
    }
    expect(fs.existsSync(target), 'the removal was not staged, so this clause has no subject').toBe(false);
    expect(read.outcome, 'a file that vanished mid-call threw or was served').toBe('no-such-file');
  });

  test('a listed name replaced by a SYMLINK is refused, and its target is not followed', () => {
    // `O_NOFOLLOW`'s half. The enumeration saw a regular file, and by the time the open runs the
    // name is a link pointing outside the run directory — so following it would serve bytes no
    // confinement check ever saw. Refused before the target is read rather than after.
    const root = store();
    const outside = outsideOf(root, 'elsewhere');
    write(path.join(outside, 'secret.txt'), 'SECRET-BYTES');
    const target = realInRun(root, 'steps/001-implement', 'prompt.txt');
    let read;
    const lstat = stageOn(target, () => {
      fs.unlinkSync(target);
      fs.symlinkSync(path.join(outside, 'secret.txt'), target);
    });
    try {
      read = readRetainedFile(root, 'Q-0137-1', 1, 'prompt.txt');
    } finally {
      lstat.mockRestore();
    }
    expect(fs.lstatSync(target).isSymbolicLink(), 'the replacement was not staged, so this clause has no subject')
      .toBe(true);
    expect(read.outcome, 'the replacement symlink was followed').toBe('no-such-file');
    expect(JSON.stringify(read), "the target's bytes reached the answer").not.toContain('SECRET');
  });

  test('membership is enumerated for THIS call, so a listing fetched earlier grants nothing', () => {
    // `persist(occurrence, name, text)` takes the artifact's name as a plain `string` parameter and
    // confines it nowhere, so a register of the two constants would claim what the writer's callers
    // write rather than what a directory holds. What decides is the directory, now.
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    expect(readRetainedFile(root, 'Q-0137-1', 1, 'output.txt').outcome).toBe('not-an-occurrence-file');
    write(inRun(root, 'steps/001-implement', 'output.txt'), 'later');
    expect(readRetainedFile(root, 'Q-0137-1', 1, 'output.txt').outcome, 'a file that appeared is still refused')
      .toBe('file');
  });

  test('an occurrence whose directory is absent holds no name at all, rather than refusing as unsafe', () => {
    // The distinction the outcome union exists for: *this directory is gone* enumerated nothing, so
    // no name is one this occurrence holds — a true sentence about the name that was asked for —
    // while *this directory is outside the run* is reported as itself, because a caller must not
    // read it as absence.
    const root = runWith([occurrence({ step_id: 'gone', occurrence_dir: 'steps/001-gone' })]);
    expect(readRetainedFile(root, 'Q-0137-1', 1, 'prompt.txt').outcome).toBe('not-an-occurrence-file');
  });

  test('the run-level failures are readRun\'s own, before any name is considered', () => {
    expect(readRetainedFile(store(), 'Q-0137-404', 1, 'prompt.txt').outcome).toBe('not-a-run');
    expect(readRetainedFile(storeWith('{ not json'), 'Q-0137-1', 1, 'prompt.txt').outcome).toBe('malformed');
  });

  test('an empty retained file is read as itself rather than as an absence', () => {
    // Eight of the 1,797 files this repository's run history retains are empty, and every one is an
    // `output.txt` — the ordinary shape of a step that answered nothing.
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'output.txt': '' } },
    );
    const read = readRetainedFile(root, 'Q-0137-1', 1, 'output.txt');
    expect(read.outcome).toBe('file');
    if (read.outcome !== 'file') return;
    expect(read.bytes.length).toBe(0);
  });
});

describe('Q-0137 AC-6 — the identity is seq, and a number two occurrences share is refused', () => {
  /** Two occurrences whose directory names carry no readable sequence prefix, so both collide. */
  const colliding = (): string => runWith(
    [
      occurrence({ step_id: 'first', occurrence_dir: 'steps/unreadable-a' }),
      occurrence({ step_id: 'second', occurrence_dir: 'steps/unreadable-b' }),
    ],
    { 'steps/unreadable-a': { 'prompt.txt': 'ONE' }, 'steps/unreadable-b': { 'prompt.txt': 'TWO' } },
  );

  test('occurrenceSeq answers MAX_SAFE_INTEGER for a name it cannot read, so a collision is real', () => {
    // The premise, asserted rather than assumed: this is the value the shipped function gives two
    // unreadable directory names, which is what makes the case reachable rather than invented.
    expect(occurrenceSeq('steps/unreadable-a')).toBe(Number.MAX_SAFE_INTEGER);
    expect(occurrenceSeq('steps/unreadable-b')).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('the listing offers neither and names both, so nothing it offers is unfetchable', () => {
    const answer = listRetainedFiles(colliding(), 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences, 'a colliding sequence number was offered').toStrictEqual([]);
    expect(answer.warnings.map((warning) => warning.step_id).sort(), 'both occurrences were not named')
      .toStrictEqual(['first', 'second']);
    for (const warning of answer.warnings) expect(warning.message).toContain('shares sequence number');
  });

  test('the read refuses it as ambiguous rather than serving either, which is not an absence', () => {
    // *More than one* is not *none*: answering `no-such-occurrence` here would report a run's own
    // record as missing, which is the class Q-0074 and Q-0115 spent two tickets removing.
    const read = readRetainedFile(colliding(), 'Q-0137-1', Number.MAX_SAFE_INTEGER, 'prompt.txt');
    expect(read.outcome).toBe('ambiguous-occurrence');
    for (const served of ['ONE', 'TWO']) {
      expect(JSON.stringify(read), `${served} was served anyway`).not.toContain(served);
    }
  });

  test('a sequence number no occurrence carries is a plain absence', () => {
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'prompt.txt': 'ask' } },
    );
    expect(readRetainedFile(root, 'Q-0137-1', 9, 'prompt.txt').outcome).toBe('no-such-occurrence');
  });
});

describe('Q-0137 AC-13 — listing and reading create, repair and delete nothing', () => {
  test('the whole store is byte-identical afterwards, across every outcome these two produce', () => {
    const root = runWith(
      [
        occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' }),
        occurrence({ step_id: 'escaped', occurrence_dir: 'steps/../../escape' }),
        occurrence({ step_id: 'gone', occurrence_dir: 'steps/003-gone' }),
      ],
      { 'steps/001-implement': { 'prompt.txt': 'ask', 'notes.md': 'a third name' } },
    );
    const snapshot = (): [string, string][] =>
      walk(root)
        .filter((entry) => fs.statSync(path.join(root, entry)).isFile())
        .map((entry) => [entry, fs.readFileSync(path.join(root, entry)).toString('base64')] as [string, string]);
    const before = snapshot();
    expect(before.length, 'the fixture is empty, so this clause has no subject').toBeGreaterThan(1);

    listRetainedFiles(root, 'Q-0137-1');
    listRetainedFiles(root, 'Q-0137-404');
    const asked: [number, string][] = [
      [1, 'prompt.txt'], [1, 'notes.md'], [1, 'nope.txt'], [2, 'prompt.txt'], [3, 'prompt.txt'], [9, 'prompt.txt'],
    ];
    for (const [seq, name] of asked) readRetainedFile(root, 'Q-0137-1', seq, name);

    expect(snapshot(), 'reading run history changed something under it').toStrictEqual(before);
    // The refused manifest is reported as it stands and is not repaired, which is `readRun`'s own
    // contract holding through a caller that had every reason to tidy it.
    const read = readRun(root, 'Q-0137-1');
    expect(read.outcome).toBe('run');
    if (read.outcome !== 'run') return;
    expect(read.manifest.steps[1].occurrence_dir, 'a traversing occurrence_dir was rewritten')
      .toBe('steps/../../escape');
  });

  test('a third retained name is listed and read with no register of names anywhere', () => {
    const root = runWith(
      [occurrence({ step_id: 'implement', occurrence_dir: 'steps/001-implement' })],
      { 'steps/001-implement': { 'transcript.jsonl': '{"a":1}' } },
    );
    const answer = listRetainedFiles(root, 'Q-0137-1');
    if (answer.outcome !== 'listing') throw new Error('the fixture did not list, so this clause has no subject');
    expect(answer.occurrences[0].files).toStrictEqual([{ name: 'transcript.jsonl', bytes: 7 }]);
    const read = readRetainedFile(root, 'Q-0137-1', 1, 'transcript.jsonl');
    expect(read.outcome).toBe('file');
    if (read.outcome !== 'file') return;
    expect(read.bytes.toString('utf8')).toBe('{"a":1}');
  });
});
