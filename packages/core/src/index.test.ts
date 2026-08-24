import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/core is scaffolded', () => {
  expect(name).toBe('@quorum/core');
});
