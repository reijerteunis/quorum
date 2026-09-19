/**
 * Q-0138 AC-10 — the running-occurrence shape this screen renders is one the writer produces.
 *
 * `src/history-retained.test.ts` keeps its hand-built fixture, for the reason its own header gives:
 * the states that screen has to get right are ones `.quorum/runs` cannot supply. What a fixture
 * cannot establish is that the shape it invents is the shape the product writes — so the two are
 * joined here, by reading the producer and the branch that consumes it and requiring them to name
 * the same value. **Editing the fixture changes neither, so it cannot satisfy this on its own.**
 *
 * It sits in `test/` rather than in `src/` because it reads the filesystem, which every file under
 * `src` is forbidden to do — see `test/source.test.ts`'s header for the whole of that reasoning.
 * The read it performs is declared in `apps/web/turbo.json`: `@quorum/web` does not depend on
 * `@quorum/core`, so no `^test` edge carries that file's hash and a cache hit would otherwise stand
 * over a changed producer (Q-0072).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** The repository root: `apps/web/test/` → three levels up. */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Any file in this repository, by path from the root. Throws when it is not there. */
const repoFile = (relative: string): string => {
  const file = path.join(REPO_ROOT, relative);
  if (!fs.existsSync(file)) throw new Error(`corpus missing: ${relative} does not exist under ${REPO_ROOT}`);
  return fs.readFileSync(file, 'utf8');
};

const WRITER = 'packages/core/src/run-history/writer.ts';
const SCREEN = 'apps/web/src/history-screen.tsx';

/**
 * The body of `RunHistory.allocate`, which is the one function that brings an occurrence into
 * existence — `terminal` writes the same object afterwards and would answer for a state this
 * screen's running branch never sees.
 *
 * @throws {Error} when the function cannot be found or its body reads as empty, rather than letting
 *   every clause below assert over nothing.
 */
function allocateBody(): string {
  const source = repoFile(WRITER);
  const opens = source.indexOf('allocate(step, kind, fields = {}) {');
  const closes = source.indexOf('\n    terminal(', opens);
  if (opens === -1 || closes === -1) {
    throw new Error(`${WRITER} no longer declares allocate(step, kind, fields) followed by terminal — this check has lost its subject`);
  }
  const body = source.slice(opens, closes);
  if (body.trim().length < 200) throw new Error(`${WRITER}'s allocate body read as ${String(body.length)} characters — this check has lost its subject`);
  return body;
}

describe('Q-0138 AC-10 — the fixture and the producer name the same running occurrence', () => {
  test('allocate persists the manifest, so the state this screen renders is on disk at all', () => {
    // The half that makes a running occurrence reachable by any reader: without it the manifest
    // learns of a step only when a neighbour ends, and this screen's running branch is unreachable
    // on a serial flow. `packages/core` asserts the behaviour; this asserts that the site is here,
    // because it is the premise every clause below rests on.
    expect(allocateBody(), 'allocate no longer replaces the manifest').toContain('replaceManifest()');
  });

  test('the status the writer stamps is the one the screen branches on', () => {
    const produced = /\bstatus:\s*'([a-z-]+)'/.exec(allocateBody())?.[1];
    expect(produced, `${WRITER}'s allocate stamps no status literal`).toBeDefined();
    expect(produced).toBe('running');
    // The join. `history-screen.tsx` chooses between the two no-output sentences on this value, so a
    // writer that stamped something else, or a screen that compared against something else, fails
    // here — and neither is reachable by editing a fixture.
    expect(repoFile(SCREEN), `${SCREEN} does not branch on the status ${WRITER} writes`)
      .toContain(`step.status === '${String(produced)}'`);
  });

  test('and it records no duration, which is what the screen calls not-yet-finished', () => {
    expect(allocateBody(), `${WRITER}'s allocate no longer leaves duration_ms null`).toContain('duration_ms: null');
  });

  test('the extraction has a subject — a writer that stamped something else fails these clauses', () => {
    // A check on the check (Q-0135 E-3): a reader that stopped finding `allocate` would throw above
    // rather than pass, and one that found it and matched nothing is what this shows.
    const hostile = "allocate(step, kind, fields = {}) {\n      const occurrence = { status: 'finished', duration_ms: 0 };\n      return occurrence;";
    expect(/\bstatus:\s*'([a-z-]+)'/.exec(hostile)?.[1], 'the extraction cannot read a status at all').toBe('finished');
    expect(hostile.includes('duration_ms: null'), 'a zero duration satisfied the null clause').toBe(false);
    expect(hostile.includes('replaceManifest()'), 'a body that persists nothing satisfied the first clause').toBe(false);
  });
});
