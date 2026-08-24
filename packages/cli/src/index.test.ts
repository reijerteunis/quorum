import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/cli is scaffolded', () => {
  expect(name).toBe('@quorum/cli');
});
