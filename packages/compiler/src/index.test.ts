import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/compiler is scaffolded', () => {
  expect(name).toBe('@quorum/compiler');
});
