import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import { removeTempDirs, tempDir, write } from '../../test/repo.js';
import { FlowError } from '../lint/lint.js';
import { interpolate, loadFlow, loadFlowByName, loadRole, reviewRound, writesOf } from './loaders.js';

afterAll(removeTempDirs);

function implemented<T>(call: () => T): T {
  try {
    return call();
  } catch (error) {
    expect(error).not.toHaveProperty('message', 'Q-0050 contract stub');
    throw error;
  }
}

describe('Q-0050 AC-11b..AC-11g — loaders and pure helpers', () => {
  test('loadFlow lints and records its file; loadFlowByName preserves ENOENT', () => {
    const harness = tempDir('q0050-harness-');
    const valid = path.join(harness, 'flows', 'ok.yaml');
    write(valid, 'name: ok\nconsumes: draft\nproduces: requirements\nsteps: []\n');
    expect(implemented(() => loadFlow(valid))).toMatchObject({ name: 'ok', file: valid });
    expect(() => loadFlowByName('ghost', harness)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
    const broken = path.join(harness, 'flows', 'broken.yaml');
    write(broken, 'name: broken\nconsumes: draft\nproduces: requirements\nsteps:\n  - id: x\n    on_fail:\n      max_iterations: 1\n');
    expect(() => loadFlow(broken)).toThrow(FlowError);
  });

  test('loadRole returns the empty role for falsy input and names a missing full path', () => {
    const harness = tempDir('q0050-roles-');
    expect(implemented(() => loadRole(undefined, harness))).toStrictEqual({ meta: {}, body: '' });
    const expected = path.join(harness, 'roles', 'ghost.md');
    expect(() => loadRole('ghost', harness)).toThrow(expected);
  });

  test('interpolate uses flat keys and leaves unknown placeholders intact', () => {
    expect(implemented(() => interpolate('{known}/{unknown}/{a.b}', { known: 'yes', a: { b: 'no' } })))
      .toBe('yes/{unknown}/{a.b}');
    expect(implemented(() => interpolate('{a.b}', { 'a.b': 'flat' }))).toBe('flat');
  });

  test('writesOf returns output.write first, then output.writes in order', () => {
    // The spike CONCATENATES (spike/src/engine.js:739) and so does the ported lint in this same
    // package (lint.ts:82-86), whose JSDoc states the rule; shared/src/step-output.ts:33 cites the
    // spike line by number. AC-11's "singular before plural" is an ORDERING, and a step declaring
    // both must get both — precedence would write one artifact and skip the rest with no message.
    expect(implemented(() => writesOf({ output: { write: 'one', writes: ['two'] } }))).toStrictEqual(['one', 'two']);
    expect(writesOf({ output: { write: 'one', writes: ['two', 'three'] } })).toStrictEqual(['one', 'two', 'three']);
    expect(writesOf({ output: { writes: ['two', 'three'] } })).toStrictEqual(['two', 'three']);
    expect(writesOf({ output: { write: 'one' } })).toStrictEqual(['one']);
    expect(writesOf({})).toStrictEqual([]);
  });

  test('reviewRound counts only completed verdict rounds', () => {
    const ticket = tempDir('q0050-review-');
    write(path.join(ticket, 'review/round-1/verdict.md'), 'approve\n');
    fs.mkdirSync(path.join(ticket, 'review/round-2'), { recursive: true });
    expect(implemented(() => reviewRound(ticket))).toBe(2);
    expect(reviewRound(tempDir('q0050-no-review-'))).toBe(1);
  });
});
