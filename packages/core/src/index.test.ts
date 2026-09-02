import { expect, test } from 'vitest';

import * as barrel from './index.js';
import { repoFile } from '../test/corpus.js';

test('the barrel is no longer the one-line stub (Q-0096 AC-2)', () => {
  // Until Q-0096 this file read `export const name = '@quorum/core';` and this test asserted that
  // string. An `exports` key over that stub would have relocated the trap rather than closed it:
  // `@quorum/core` would have resolved, to an object holding one useless name, and Q-0091 would
  // have discovered it at its first import.
  //
  // Read through `repoFile` rather than through a base of this file's own, because a new read
  // route in a suite `turbo-inputs.test.ts` audits has to be registered four ways; the corpus
  // helper is the route that already is.
  expect(repoFile('packages/core/src/index.ts')).not.toBe("export const name = '@quorum/core';\n");
  expect(Object.keys(barrel)).not.toContain('name');
});

test('and it exports a real surface, whose identity is pinned where it is derived', () => {
  // The sixteen names are asserted as an identity by `packages/cli/src/package.test.ts`, because
  // that is where thirteen of them are already written down — its `DOMAIN` register — and a list
  // retyped here would be the second copy that register exists to prevent (Q-0096 AC-2). What is
  // checked here is that the surface is real and reaches this package's own modules, so a barrel
  // gutted in `core` fails in `core` rather than only in its consumer.
  expect(Object.keys(barrel).length).toBeGreaterThan(10);
  expect(typeof barrel.runFlow).toBe('function');
  expect(typeof barrel.Backlog).toBe('function');
  expect(Object.values(barrel).every((value) => value !== undefined)).toBe(true);
});
