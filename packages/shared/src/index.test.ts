import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/shared is scaffolded', () => {
  expect(name).toBe('@quorum/shared');
});
