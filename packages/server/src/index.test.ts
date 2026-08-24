import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/server is scaffolded', () => {
  expect(name).toBe('@quorum/server');
});
